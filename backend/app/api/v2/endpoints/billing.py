from __future__ import annotations

import hashlib
import hmac
import logging
import os
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, Request, HTTPException

from app.api.v2.deps import require_user
from app.auth.clerk import ClerkUser
from app.services.db.supabase_service import get_db_admin_service
from app.utils.responses import api_error, ok
from app.utils.billing_helpers import (
    BILLING_PLAN_CONFIG,
    _normalize_plan,
    get_candidate_count_after_deployment,
    check_candidate_limit,
    get_stripe_price_id,
    validate_plan_currency,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing")

# ── Stripe helpers ────────────────────────────────────────────────────────────

def _get_stripe_key() -> str:
    from app.config import get_settings
    settings = get_settings()
    return str(settings.stripe_secret_key or os.environ.get("STRIPE_SECRET_KEY", "") or "").strip()

def _get_webhook_secret() -> str:
    from app.config import get_settings
    settings = get_settings()
    return str(settings.stripe_webhook_secret or os.environ.get("STRIPE_WEBHOOK_SECRET", "") or "").strip()

def _verify_stripe_signature(payload: bytes, sig_header: str, secret: str) -> bool:
    """
    Verify Stripe webhook signature (HMAC-SHA256).
    Implements the standard Stripe signature verification protocol.
    Returns True if valid, False otherwise.
    """
    if not secret or not sig_header:
        return False

    try:
        # Parse t= and v1= from header
        parts = {k: v for part in sig_header.split(",") for k, v in [part.split("=", 1)]}
        timestamp = parts.get("t", "")
        signature = parts.get("v1", "")

        if not timestamp or not signature:
            return False

        # Reject events older than 5 minutes (replay attack protection)
        try:
            ts = int(timestamp)
            if abs(time.time() - ts) > 300:
                logger.warning("[webhook] Timestamp too old: %s", timestamp)
                return False
        except ValueError:
            return False

        # Compute expected signature
        signed_payload = f"{timestamp}.{payload.decode('utf-8')}"
        expected = hmac.new(
            secret.encode("utf-8"),
            signed_payload.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        return hmac.compare_digest(expected, signature)
    except Exception as exc:
        logger.error("[webhook] Signature verification error: %s", exc)
        return False


async def _create_stripe_checkout(
    plan_id: str,
    label: str,
    amount_cents: int,
    success_url: str,
    cancel_url: str,
    currency: str = "usd",
    interval: str = "month",
    interval_count: int = 1,
    metadata: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Create a Stripe Checkout Session.

    Strategy:
    - If a Price ID is configured in env, use it (preferred — lower Stripe fees).
    - Otherwise fall back to dynamic price_data (works without pre-created products).
    """
    key = _get_stripe_key()
    if not key:
        raise RuntimeError("STRIPE_SECRET_KEY not configured")

    price_id = get_stripe_price_id(plan_id, currency.upper())

    if price_id:
        logger.info(f"[_create_stripe_checkout] Selected Stripe Price ID: {price_id} for plan={plan_id}, currency={currency.upper()}")
        # Use pre-created Stripe Price ID
        params: Dict[str, str] = {
            "mode": "subscription",
            "line_items[0][price]": price_id,
            "line_items[0][quantity]": "1",
            "success_url": success_url,
            "cancel_url": cancel_url,
        }
    else:
        # Fall back to dynamic price_data (useful while Price IDs aren't yet created)
        params = {
            "mode": "subscription",
            "line_items[0][price_data][currency]": currency.lower(),
            "line_items[0][price_data][product_data][name]": f"Hire.AI {label} Plan",
            "line_items[0][price_data][unit_amount]": str(amount_cents),
            "line_items[0][price_data][recurring][interval]": interval,
            "line_items[0][price_data][recurring][interval_count]": str(interval_count),
            "line_items[0][quantity]": "1",
            "success_url": success_url,
            "cancel_url": cancel_url,
        }

    # Metadata — always include plan + currency
    base_metadata = {
        "plan": plan_id,
        "currency": currency.upper(),
    }
    if metadata:
        base_metadata.update(metadata)

    for k, v in base_metadata.items():
        params[f"metadata[{k}]"] = str(v)
        params[f"subscription_data[metadata][{k}]"] = str(v)

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.stripe.com/v1/checkout/sessions",
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            content=urlencode(params),
        )
    if resp.status_code != 200:
        err_data = {}
        try:
            err_data = resp.json()
        except Exception:
            pass
        err_msg = (err_data.get("error") or {}).get("message") or resp.text
        raise RuntimeError(f"Stripe checkout creation failed: {err_msg}")
    return resp.json()


def _get_frontend_url(request: Request) -> str:
    """Resolve the correct frontend origin for Stripe redirect URLs."""
    from urllib.parse import urlparse

    origin = request.headers.get("origin") or request.headers.get("referer") or ""
    if "localhost" in origin or "127.0.0.1" in origin:
        parsed = urlparse(origin)
        return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")

    env_url = os.environ.get("FRONTEND_URL", "").strip()
    if env_url:
        return env_url.rstrip("/")

    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
    proto = (request.headers.get("x-forwarded-proto") or "https").split(",")[0].strip()
    return f"{proto}://{host}".rstrip("/")


async def _get_or_create_subscription(db, user_id: str) -> Dict[str, Any]:
    def _fetch():
        return db.client.from_("subscriptions").select("*").eq("user_id", user_id).maybe_single().execute()

    res = await db.run(_fetch)
    existing = getattr(res, "data", None)
    if isinstance(existing, dict):
        return existing

    def _fetch_profile():
        return db.client.from_("profiles").select("*").eq("user_id", user_id).maybe_single().execute()

    p_res = await db.run(_fetch_profile)
    profile = getattr(p_res, "data", None) or {}

    plan = _normalize_plan(profile.get("subscription_plan"))
    status = str(profile.get("subscription_status") or "active").lower()
    if status not in ("active", "paused", "overdue", "cancel_at_period_end"):
        status = "active"

    cfg = BILLING_PLAN_CONFIG.get(plan, BILLING_PLAN_CONFIG["free"])
    now = datetime.now(timezone.utc)
    interval = cfg.get("interval", "month")
    interval_count = cfg.get("interval_count", 1)
    if interval == "year":
        cycle_end = now + timedelta(days=365 * interval_count)
    else:
        cycle_end = now + timedelta(days=30 * interval_count)

    def _insert():
        return db.client.from_("subscriptions").insert(
            {
                "user_id": user_id,
                "plan": plan,
                "status": status,
                "deposit_amount": cfg["USD"]["price"],
                "wallet_balance": cfg["USD"]["price"],
                "billing_cycle_start": now.isoformat(),
                "billing_cycle_end": cycle_end.isoformat(),
                "overage_amount": 0,
                "overage_cap": 0,
                "metadata": {"source": "auto-bootstrap"},
            }
        ).execute()

    ins_res = await db.run(_insert)
    if getattr(ins_res, "error", None):
        raise RuntimeError("Failed to create subscription record")

    res = await db.run(_fetch)
    created = getattr(res, "data", None)
    if not isinstance(created, dict):
        raise RuntimeError("Failed to create subscription record")
    return created


async def _check_duplicate_event(db, stripe_event_id: str) -> bool:
    """
    Idempotency check: returns True if this Stripe event was already processed.
    Checks the invoices table for an existing record with matching stripe_event_id.
    """
    if not stripe_event_id:
        return False
    try:
        def _fetch():
            return (
                db.client.from_("invoices")
                .select("id")
                .eq("stripe_event_id", stripe_event_id)
                .maybe_single()
                .execute()
            )
        res = await db.run(_fetch)
        existing = getattr(res, "data", None)
        return isinstance(existing, dict) and bool(existing.get("id"))
    except Exception:
        return False


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/webhook")
async def billing_webhook(request: Request):
    """
    Production-grade Stripe webhook handler.

    Security:
    - Stripe signature verification (HMAC-SHA256)
    - Replay attack protection (5-minute timestamp window)
    - Idempotency via stripe_event_id deduplication

    Handles:
    - checkout.session.completed
    - customer.subscription.created
    - customer.subscription.updated
    - customer.subscription.deleted
    """
    # Read raw bytes for signature verification (MUST be before any parsing)
    try:
        payload_bytes = await request.body()
    except Exception:
        return ok({"received": True})

    # Stripe signature verification
    sig_header = request.headers.get("stripe-signature", "")
    webhook_secret = _get_webhook_secret()

    if webhook_secret:
        if not _verify_stripe_signature(payload_bytes, sig_header, webhook_secret):
            logger.warning("[webhook] Invalid Stripe signature. Rejecting event.")
            raise HTTPException(status_code=400, detail="Invalid webhook signature")
    else:
        logger.warning("[webhook] STRIPE_WEBHOOK_SECRET not configured — skipping signature verification")

    # Parse event
    try:
        import json
        event = json.loads(payload_bytes)
    except Exception:
        return ok({"received": True})

    event_type = str(event.get("type") or "")
    event_id = str(event.get("id") or "")
    obj = (event.get("data") or {}).get("object") or {}

    db = get_db_admin_service()
    now = datetime.now(timezone.utc)

    # ── 1. checkout.session.completed ─────────────────────────────────────────
    if event_type == "checkout.session.completed":
        metadata = obj.get("metadata") or {}
        user_id = metadata.get("user_id")
        plan = _normalize_plan(metadata.get("plan"))
        currency = str(metadata.get("currency") or "USD").upper()
        amount = float((obj.get("amount_total") or 0)) / 100

        if not user_id:
            logger.warning("[webhook] checkout.session.completed missing user_id in metadata")
            return ok({"received": True})

        # Idempotency: skip if already processed
        if await _check_duplicate_event(db, event_id):
            logger.info("[webhook] Duplicate event %s — skipping", event_id)
            return ok({"received": True, "duplicate": True})

        try:
            sub = await _get_or_create_subscription(db, user_id)
            cfg = BILLING_PLAN_CONFIG.get(plan, BILLING_PLAN_CONFIG["free"])

            # Calculate billing cycle end
            interval = cfg["interval"]
            interval_count = cfg["interval_count"]
            if interval == "year":
                cycle_end = now + timedelta(days=365 * interval_count)
            else:
                cycle_end = now + timedelta(days=30 * interval_count)

            # Sync profiles table
            def _update_profile():
                return (
                    db.client.from_("profiles")
                    .update({
                        "subscription_plan": plan,
                        "subscription_status": "active",
                        "subscription_id": obj.get("subscription") or obj.get("id"),
                        "stripe_payment_id": obj.get("customer") or obj.get("payment_intent"),
                        "candidates_consumed": 0,
                        "plan_selected_at": now.isoformat(),
                        "updated_at": now.isoformat(),
                    })
                    .eq("user_id", user_id)
                    .execute()
                )
            await db.run(_update_profile)

            country = str(metadata.get("country") or ("IN" if currency == "INR" else "US")).upper()

            # Sync subscriptions table
            def _update_sub():
                return (
                    db.client.from_("subscriptions")
                    .update({
                        "plan": plan,
                        "status": "active",
                        "deposit_amount": amount,
                        "wallet_balance": amount,
                        "billing_cycle_start": now.isoformat(),
                        "billing_cycle_end": cycle_end.isoformat(),
                        "updated_at": now.isoformat(),
                        "metadata": {
                            "stripe_customer_id": obj.get("customer"),
                            "stripe_subscription_id": obj.get("subscription"),
                            "currency": currency,
                            "country": country,
                        }
                    })
                    .eq("id", sub["id"])
                    .execute()
                )
            await db.run(_update_sub)

            # Insert invoice record with stripe_event_id for idempotency
            invoice_id = obj.get("invoice") or f"inv_{now.strftime('%Y%m%d%H%M%S')}"
            def _insert_invoice():
                return db.client.from_("invoices").insert({
                    "user_id": user_id,
                    "stripe_event_id": event_id,
                    "period_start": now.isoformat(),
                    "period_end": cycle_end.isoformat(),
                    "line_items": [{"name": f"Hire.AI {plan.capitalize()} Plan", "amount": amount, "currency": currency}],
                    "subtotal": amount,
                    "tax_amount": 0,
                    "total": amount,
                    "status": "paid",
                    "due_date": now.isoformat(),
                    "paid_at": now.isoformat(),
                    "payment_reference": obj.get("payment_intent") or obj.get("id"),
                    "metadata": {"source": "webhook", "currency": currency, "country": country}
                }).execute()
            await db.run(_insert_invoice)

            logger.info("[webhook] Processed checkout.session.completed for user=%s plan=%s currency=%s", user_id, plan, currency)

        except Exception as e:
            logger.error("[billing_webhook] Failed processing checkout.session.completed: %s", e)

    # ── 2. customer.subscription.created ──────────────────────────────────────
    elif event_type == "customer.subscription.created":
        # Credits are assigned on checkout.session.completed — skip here to avoid duplication
        logger.info("[webhook] customer.subscription.created received — credits already handled by checkout.session.completed")

    # ── 3. customer.subscription.updated / deleted ─────────────────────────────
    elif event_type in ("customer.subscription.updated", "customer.subscription.deleted"):
        stripe_sub_id = obj.get("id")
        status = obj.get("status")
        cancel_at_period_end = bool(obj.get("cancel_at_period_end"))
        current_period_end = obj.get("current_period_end")

        def _fetch_by_stripe():
            return db.client.from_("profiles").select("user_id").eq("subscription_id", stripe_sub_id).maybe_single().execute()

        prof_res = await db.run(_fetch_by_stripe)
        profile_data = getattr(prof_res, "data", None)

        if isinstance(profile_data, dict) and profile_data.get("user_id"):
            user_id = profile_data["user_id"]

            try:
                sub = await _get_or_create_subscription(db, user_id)
                db_status = "active"
                if status in ("canceled", "unpaid"):
                    db_status = "inactive"
                elif status == "past_due":
                    db_status = "overdue"
                elif cancel_at_period_end:
                    db_status = "cancel_at_period_end"

                if db_status == "inactive":
                    def _revert_profile():
                        return (
                            db.client.from_("profiles")
                            .update({
                                "subscription_plan": "free",
                                "subscription_status": "active",
                                "subscription_id": None,
                                "updated_at": now.isoformat(),
                            })
                            .eq("user_id", user_id)
                            .execute()
                        )
                    await db.run(_revert_profile)

                    def _revert_sub():
                        return (
                            db.client.from_("subscriptions")
                            .update({
                                "plan": "free",
                                "status": "active",
                                "deposit_amount": 0,
                                "wallet_balance": 0,
                                "updated_at": now.isoformat(),
                            })
                            .eq("id", sub["id"])
                            .execute()
                        )
                    await db.run(_revert_sub)
                else:
                    cycle_end_iso = (
                        datetime.fromtimestamp(current_period_end, tz=timezone.utc).isoformat()
                        if current_period_end else now.isoformat()
                    )

                    is_renewal = False
                    current_period_start = obj.get("current_period_start")
                    db_cycle_start_str = sub.get("billing_cycle_start")
                    if current_period_start and db_cycle_start_str:
                        incoming_start_dt = datetime.fromtimestamp(current_period_start, tz=timezone.utc)
                        try:
                            # Handle potential Z suffix
                            db_cycle_start_clean = db_cycle_start_str.replace("Z", "+00:00")
                            db_cycle_start_dt = datetime.fromisoformat(db_cycle_start_clean)
                            if incoming_start_dt > db_cycle_start_dt:
                                is_renewal = True
                        except ValueError:
                            pass

                    def _sync_profile():
                        update_payload = {
                            "subscription_status": db_status,
                            "updated_at": now.isoformat(),
                        }
                        if is_renewal:
                            update_payload["candidates_consumed"] = 0
                            
                        return (
                            db.client.from_("profiles")
                            .update(update_payload)
                            .eq("user_id", user_id)
                            .execute()
                        )
                    await db.run(_sync_profile)

                    def _sync_sub():
                        update_payload = {
                            "status": db_status,
                            "billing_cycle_end": cycle_end_iso,
                            "updated_at": now.isoformat(),
                        }
                        if is_renewal:
                            update_payload["billing_cycle_start"] = incoming_start_dt.isoformat()

                        return (
                            db.client.from_("subscriptions")
                            .update(update_payload)
                            .eq("id", sub["id"])
                            .execute()
                        )
                    await db.run(_sync_sub)
            except Exception as e:
                logger.error("[billing_webhook] Failed updating subscription state: %s", e)

    return ok({"received": True})


@router.post("/subscribe")
async def billing_subscribe(payload: Dict[str, Any], request: Request, user: ClerkUser = Depends(require_user)):
    """POST /api/v2/billing/subscribe

    Creates a Stripe Checkout Session. Uses stored Price IDs when available,
    falls back to dynamic price_data if Price IDs are not yet configured.

    Security:
    - Plan and currency validated server-side
    - Never exposes Stripe secrets or internal errors to client
    """
    plan = _normalize_plan(payload.get("plan"))
    currency = str(payload.get("currency") or "USD").upper()
    country = str(payload.get("country") or "US").upper()

    # Normalize currency from country if not explicitly provided
    expected_currency = "INR" if country == "IN" else "USD"
    if currency not in ("USD", "INR") or currency != expected_currency:
        logger.warning(f"[billing.subscribe] Currency mismatch or invalid: user requested {currency} for country {country}. Forcing to {expected_currency}.")
        currency = expected_currency

    logger.info(f"[billing.subscribe] Init checkout: user={user.id}, plan={plan}, country={country}, currency={currency}")

    if plan == "free":
        return api_error(message="Free plan does not require payment", status_code=400)

    if plan not in BILLING_PLAN_CONFIG:
        return api_error(message=f"Unknown plan: {plan}", status_code=400)

    # Validate plan/currency combination
    currency_error = validate_plan_currency(plan, currency)
    if currency_error:
        return api_error(message=currency_error, status_code=400)

    cfg = BILLING_PLAN_CONFIG[plan]
    price = cfg[currency]["price"]
    interval = cfg["interval"]
    interval_count = cfg["interval_count"]

    frontend_url = _get_frontend_url(request)
    success_url = f"{frontend_url}/billing?checkout=success&action=subscribe&session_id={{CHECKOUT_SESSION_ID}}&plan={plan}"
    cancel_url = f"{frontend_url}/billing?checkout=cancelled&action=subscribe"

    try:
        session = await _create_stripe_checkout(
            plan_id=plan,
            label=cfg["name"],
            amount_cents=int(price * 100),
            success_url=success_url,
            cancel_url=cancel_url,
            currency=currency,
            interval=interval,
            interval_count=interval_count,
            metadata={
                "action": "subscribe",
                "user_id": user.id,
                "plan": plan,
                "currency": currency,
                "country": country,
            },
        )
        logger.info(f"[billing.subscribe] Successfully created checkout session {session['id']} for {plan} ({currency})")
    except Exception as exc:
        logger.error("[billing.subscribe] Stripe error for user=%s plan=%s: %s", user.id, plan, exc)
        return api_error(message="Checkout initialization failed. Please try again.", status_code=500)

    return ok({
        "success": True,
        "session_id": session["id"],
        "checkout_url": session["url"],
        "plan": plan,
        "currency": currency,
        "deposit_amount": price,
    })


@router.post("/verify-session")
async def billing_verify_session(payload: Dict[str, Any], user: ClerkUser = Depends(require_user)):
    """POST /api/v2/billing/verify-session

    Verifies checkout session directly from Stripe for instantaneous UI updates.
    Also handles idempotency — safe to call multiple times.
    """
    session_id = str(payload.get("session_id") or "").strip()
    plan = _normalize_plan(payload.get("plan"))
    if not session_id:
        return api_error(message="session_id is required", status_code=400)
    if plan == "free":
        return api_error(message="Free plan does not require payment verification", status_code=400)

    key = _get_stripe_key()
    if not key:
        return api_error(message="STRIPE_SECRET_KEY not configured", status_code=500)

    # Fetch the Stripe session
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.stripe.com/v1/checkout/sessions/{session_id}",
            headers={"Authorization": f"Bearer {key}"},
        )
    if resp.status_code != 200:
        err_body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
        err_code = (err_body.get("error") or {}).get("code", "")
        if err_code == "resource_missing":
            return api_error(
                message=(
                    "Checkout session not found. "
                    "This usually means the session was created with a different Stripe key. "
                    "Please start a fresh checkout."
                ),
                status_code=400,
            )
        return api_error(message="Failed to verify payment with Stripe. Please contact support.", status_code=502)

    stripe_session = resp.json()
    if stripe_session.get("payment_status") != "paid":
        return api_error(message="Payment not completed", status_code=400)

    amount = float((stripe_session.get("amount_total") or 0)) / 100
    session_currency = str(stripe_session.get("currency", "usd")).upper()
    cfg = BILLING_PLAN_CONFIG.get(plan, BILLING_PLAN_CONFIG["free"])
    db = get_db_admin_service()
    now = datetime.now(timezone.utc)

    interval = cfg["interval"]
    interval_count = cfg["interval_count"]
    if interval == "year":
        cycle_end = now + timedelta(days=365 * interval_count)
    else:
        cycle_end = now + timedelta(days=30 * interval_count)

    # 1. Update profiles table
    def _update_profile():
        return (
            db.client.from_("profiles")
            .update({
                "subscription_plan": plan,
                "subscription_id": stripe_session.get("subscription") or session_id,
                "stripe_payment_id": stripe_session.get("customer") or session_id,
                "subscription_status": "active",
                "candidates_consumed": 0,
                "plan_selected_at": now.isoformat(),
                "updated_at": now.isoformat(),
            })
            .eq("user_id", user.id)
            .execute()
        )
    await db.run(_update_profile)

    # 2. Upsert subscriptions table
    try:
        sub = await _get_or_create_subscription(db, user.id)

        def _update_sub():
            return (
                db.client.from_("subscriptions")
                .update({
                    "plan": plan,
                    "status": "active",
                    "deposit_amount": amount,
                    "wallet_balance": amount,
                    "billing_cycle_start": now.isoformat(),
                    "billing_cycle_end": cycle_end.isoformat(),
                    "updated_at": now.isoformat(),
                    "metadata": {
                        "stripe_customer_id": stripe_session.get("customer"),
                        "stripe_subscription_id": stripe_session.get("subscription"),
                        "currency": session_currency,
                        "country": str((stripe_session.get("metadata") or {}).get("country") or "").upper() or None,
                    }
                })
                .eq("id", sub["id"])
                .execute()
            )
        await db.run(_update_sub)

        # 3. Add invoice — check idempotency first
        payment_ref = stripe_session.get("payment_intent") or session_id

        def _check_existing_invoice():
            return (
                db.client.from_("invoices")
                .select("id")
                .eq("payment_reference", payment_ref)
                .eq("user_id", user.id)
                .maybe_single()
                .execute()
            )

        existing_inv_res = await db.run(_check_existing_invoice)
        existing_inv = getattr(existing_inv_res, "data", None)

        if not isinstance(existing_inv, dict) or not existing_inv.get("id"):
            def _insert_invoice():
                return db.client.from_("invoices").insert({
                    "user_id": user.id,
                    "period_start": now.isoformat(),
                    "period_end": cycle_end.isoformat(),
                    "line_items": [{"name": f"Hire.AI {plan.capitalize()} Plan", "amount": amount, "currency": session_currency}],
                    "subtotal": amount,
                    "tax_amount": 0,
                    "total": amount,
                    "status": "paid",
                    "due_date": now.isoformat(),
                    "paid_at": now.isoformat(),
                    "payment_reference": payment_ref,
                    "metadata": {
                        "source": "verify-session",
                        "currency": session_currency,
                        "country": str((stripe_session.get("metadata") or {}).get("country") or "").upper() or None,
                    }
                }).execute()
            await db.run(_insert_invoice)

    except Exception as e:
        logger.error("[verify-session] Failed updating subscriptions/invoices: %s", e)

    return ok({
        "success": True,
        "plan": plan,
        "message": f"{cfg['name']} plan activated successfully!",
    })


@router.get("/usage")
async def billing_usage(user: ClerkUser = Depends(require_user)):
    """GET /api/v2/billing/usage

    Provides structured billing status and real-time candidate limit metrics.
    """
    db = get_db_admin_service()

    def _fetch_profile():
        return db.client.from_("profiles").select("*").eq("user_id", user.id).maybe_single().execute()

    p_res = await db.run(_fetch_profile)
    profile = getattr(p_res, "data", None) or {}

    plan = _normalize_plan(profile.get("subscription_plan"))
    status = str(profile.get("subscription_status") or "active").lower()

    cfg = BILLING_PLAN_CONFIG.get(plan, BILLING_PLAN_CONFIG["free"])
    candidate_limit = cfg["candidates"]
    candidate_count = await get_candidate_count_after_deployment(db, user.id)

    # Determine currency and billing country from subscription metadata
    currency = "USD"
    billing_country = ""
    try:
        sub = await _get_or_create_subscription(db, user.id)
        cycle_end = sub.get("billing_cycle_end")
        if sub and isinstance(sub.get("metadata"), dict):
            currency = str(sub["metadata"].get("currency") or "USD").upper()
            if currency not in ("USD", "INR"):
                currency = "USD"
            billing_country = str(sub["metadata"].get("country") or "").upper()
    except Exception:
        cycle_end = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()

    if not billing_country or len(billing_country) != 2:
        profile_country = str(profile.get("country") or "").upper()
        if profile_country and len(profile_country) == 2:
            billing_country = profile_country
        else:
            # Leave billing_country empty so frontend useCountryDetection can fall back to IP/timezone
            billing_country = ""

    price = cfg[currency]["price"] if currency in cfg else cfg["USD"]["price"]

    return ok({
        "plan": plan,
        "status": status,
        "billing_cycle_end": cycle_end,
        "currency": currency,
        "country": billing_country,
        "validity": cfg["validity"],
        "candidates_limit": candidate_limit,
        "candidates_count": candidate_count,
        "price": price,
    })


@router.post("/topup")
async def billing_topup(payload: Dict[str, Any], request: Request, user: ClerkUser = Depends(require_user)):
    """POST /api/v2/billing/topup"""
    return api_error(message="Wallet top-ups are disabled. Please subscribe to a plan to increase limits.", status_code=400)


@router.post("/pay-invoice")
async def pay_invoice(payload: Dict[str, Any], request: Request, user: ClerkUser = Depends(require_user)):
    """POST /api/v2/billing/pay-invoice"""
    return ok({"success": True, "already_paid": True})


@router.get("/invoices")
async def list_invoices(user: ClerkUser = Depends(require_user)):
    """GET /api/v2/billing/invoices"""
    db = get_db_admin_service()

    def _fetch():
        return (
            db.client.from_("invoices")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", desc=True)
            .execute()
        )

    res = await db.run(_fetch)
    data = getattr(res, "data", None) or []
    return ok(data)
