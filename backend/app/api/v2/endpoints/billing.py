from __future__ import annotations

import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, Request

from app.api.v2.deps import require_user
from app.auth.clerk import ClerkUser
from app.services.db.supabase_service import get_db_admin_service
from app.utils.responses import api_error, ok
from app.utils.billing_helpers import (
    BILLING_PLAN_CONFIG,
    _normalize_plan,
    get_candidate_count_after_deployment,
    check_candidate_limit,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing")

def _get_stripe_key() -> str:
    from app.config import get_settings
    settings = get_settings()
    return str(settings.stripe_secret_key or os.environ.get("STRIPE_SECRET_KEY", "") or "").strip()

async def _create_stripe_checkout(
    amount_cents: int,
    label: str,
    plan_id: str,
    success_url: str,
    cancel_url: str,
    currency: str = "usd",
    interval: str = "month",
    interval_count: int = 1,
    metadata: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    key = _get_stripe_key()
    if not key:
        raise RuntimeError("STRIPE_SECRET_KEY not configured")

    params: Dict[str, str] = {
        "mode": "subscription",
        "line_items[0][price_data][currency]": currency.lower(),
        "line_items[0][price_data][product_data][name]": f"Hire.AI {label} Plan",
        "line_items[0][price_data][unit_amount]": str(amount_cents),
        "line_items[0][price_data][recurring][interval]": interval,
        "line_items[0][price_data][recurring][interval_count]": str(interval_count),
        "line_items[0][quantity]": "1",
        "success_url": success_url,
        "cancel_url": cancel_url,
        "metadata[plan]": plan_id,
        "metadata[currency]": currency.upper(),
    }
    
    if metadata:
        for k, v in metadata.items():
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
        raise RuntimeError(f"Stripe error: {resp.text}")
    return resp.json()

def _get_frontend_url(request: Request) -> str:
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
    proto = (request.headers.get("x-forwarded-proto") or "https").split(",")[0].strip()
    is_local = "localhost" in host
    if is_local:
        proto = "http"
    dynamic = f"{proto}://{host}" if host else "https://rekshift.com"
    env_url = os.environ.get("FRONTEND_URL", "")
    if env_url and "localhost" not in env_url and "rekshift" not in env_url:
        return env_url
    return dynamic

async def _get_or_create_subscription(db, user_id: str) -> Dict[str, Any]:
    def _fetch():
        return db.client.from_("subscriptions").select("*").eq("user_id", user_id).maybe_single().execute()

    res = await db.run(_fetch)
    existing = getattr(res, "data", None)
    if isinstance(existing, dict):
        return existing

    # Fetch profile to bootstrap from
    def _fetch_profile():
        return db.client.from_("profiles").select("*").eq("user_id", user_id).maybe_single().execute()

    p_res = await db.run(_fetch_profile)
    profile = getattr(p_res, "data", None) or {}

    plan = _normalize_plan(profile.get("subscription_plan"))
    status = str(profile.get("subscription_status") or "active").lower()
    if status not in ("active", "paused", "overdue", "cancel_at_period_end"):
        status = "active"
        
    cfg = BILLING_PLAN_CONFIG[plan]
    now = datetime.now(timezone.utc)
    cycle_end = now + timedelta(days=30)

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

# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/webhook")
async def billing_webhook(request: Request):
    """Production-ready Stripe webhook handler for subscription lifecycle."""
    try:
        event = await request.json()
    except Exception:
        return ok({"received": True})

    event_type = str(event.get("type") or "")
    obj = (event.get("data") or {}).get("object") or {}

    db = get_db_admin_service()
    now = datetime.now(timezone.utc)

    # 1. Successful payments or new subscription purchases
    if event_type == "checkout.session.completed":
        metadata = obj.get("metadata") or {}
        user_id = metadata.get("user_id")
        plan = _normalize_plan(metadata.get("plan"))
        currency = str(metadata.get("currency") or "USD").upper()
        amount = float((obj.get("amount_total") or 0)) / 100

        if user_id:
            try:
                sub = await _get_or_create_subscription(db, user_id)
                cfg = BILLING_PLAN_CONFIG[plan]
                
                # Calculate billing cycle end date
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
                            "plan_selected_at": now.isoformat(),
                            "updated_at": now.isoformat(),
                        })
                        .eq("user_id", user_id)
                        .execute()
                    )
                await db.run(_update_profile)

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
                            }
                        })
                        .eq("id", sub["id"])
                        .execute()
                    )
                await db.run(_update_sub)

                # Add a record to the invoices table
                invoice_id = obj.get("invoice") or f"inv_{now.strftime('%Y%m%d%H%M%S')}"
                def _insert_invoice():
                    return db.client.from_("invoices").insert({
                        "user_id": user_id,
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
                        "metadata": {"source": "webhook", "currency": currency}
                    }).execute()
                await db.run(_insert_invoice)

            except Exception as e:
                logger.error("[billing_webhook] Failed processing checkout.session.completed: %s", e)

    # 2. Subscription updates (upgrade, downgrade, cancellations, renewals)
    elif event_type in ("customer.subscription.updated", "customer.subscription.deleted"):
        stripe_sub_id = obj.get("id")
        stripe_customer_id = obj.get("customer")
        status = obj.get("status")
        cancel_at_period_end = bool(obj.get("cancel_at_period_end"))
        current_period_end = obj.get("current_period_end")

        # Lookup sub by stripe subscription id
        def _fetch_by_stripe():
            return db.client.from_("profiles").select("user_id").eq("subscription_id", stripe_sub_id).maybe_single().execute()
            
        prof_res = await db.run(_fetch_by_stripe)
        profile_data = getattr(prof_res, "data", None)

        if isinstance(profile_data, dict) and profile_data.get("user_id"):
            user_id = profile_data["user_id"]
            
            try:
                sub = await _get_or_create_subscription(db, user_id)
                db_status = "active"
                if status == "canceled" or status == "unpaid":
                    db_status = "inactive"
                elif status == "past_due":
                    db_status = "overdue"
                elif cancel_at_period_end:
                    db_status = "cancel_at_period_end"

                if db_status == "inactive":
                    # Revert to free plan immediately
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
                    # Sync updated status or cycle end date
                    cycle_end_iso = datetime.fromtimestamp(current_period_end, tz=timezone.utc).isoformat() if current_period_end else now.isoformat()
                    
                    def _sync_profile():
                        return (
                            db.client.from_("profiles")
                            .update({
                                "subscription_status": db_status,
                                "updated_at": now.isoformat(),
                            })
                            .eq("user_id", user_id)
                            .execute()
                        )
                    await db.run(_sync_profile)

                    def _sync_sub():
                        return (
                            db.client.from_("subscriptions")
                            .update({
                                "status": db_status,
                                "billing_cycle_end": cycle_end_iso,
                                "updated_at": now.isoformat(),
                            })
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
    
    Generates a live Stripe Checkout Session URL in subscription mode.
    """
    plan = _normalize_plan(payload.get("plan"))
    currency = str(payload.get("currency") or "USD").upper()
    if currency not in ("USD", "INR"):
        currency = "USD"

    if plan == "free":
        return api_error(message="Free plan does not require payment", status_code=400)

    cfg = BILLING_PLAN_CONFIG[plan]
    price = cfg[currency]["price"]
    interval = cfg["interval"]
    interval_count = cfg["interval_count"]

    frontend_url = _get_frontend_url(request)
    success_url = f"{frontend_url}/billing?checkout=success&action=subscribe&session_id={{CHECKOUT_SESSION_ID}}&plan={plan}"
    cancel_url = f"{frontend_url}/billing?checkout=cancelled&action=subscribe"

    try:
        session = await _create_stripe_checkout(
            amount_cents=int(price * 100),
            label=cfg["name"],
            plan_id=plan,
            success_url=success_url,
            cancel_url=cancel_url,
            currency=currency,
            interval=interval,
            interval_count=interval_count,
            metadata={"action": "subscribe", "user_id": user.id, "plan": plan, "currency": currency},
        )
    except Exception as exc:
        return api_error(message=str(exc), status_code=500)

    return ok({
        "success": True,
        "session_id": session["id"],
        "checkout_url": session["url"],
        "plan": plan,
        "deposit_amount": price,
    })

@router.post("/verify-session")
async def billing_verify_session(payload: Dict[str, Any], user: ClerkUser = Depends(require_user)):
    """POST /api/v2/billing/verify-session
    
    Verifies checkout session directly from Stripe to ensure instantaneous UI updates.
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

    # Fetch the Stripe session directly
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.stripe.com/v1/checkout/sessions/{session_id}",
            headers={"Authorization": f"Bearer {key}"},
        )
    if resp.status_code != 200:
        return api_error(message=f"Stripe error: {resp.text}", status_code=502)

    stripe_session = resp.json()
    if stripe_session.get("payment_status") != "paid":
        return api_error(message="Payment not completed", status_code=400)

    amount = float((stripe_session.get("amount_total") or 0)) / 100
    cfg = BILLING_PLAN_CONFIG[plan]
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
                        "currency": stripe_session.get("currency", "usd").upper(),
                    }
                })
                .eq("id", sub["id"])
                .execute()
            )
        await db.run(_update_sub)
        
        # Add Invoice record in DB
        def _insert_invoice():
            return db.client.from_("invoices").insert({
                "user_id": user.id,
                "period_start": now.isoformat(),
                "period_end": cycle_end.isoformat(),
                "line_items": [{"name": f"Hire.AI {plan.capitalize()} Plan", "amount": amount, "currency": stripe_session.get("currency", "usd").upper()}],
                "subtotal": amount,
                "tax_amount": 0,
                "total": amount,
                "status": "paid",
                "due_date": now.isoformat(),
                "paid_at": now.isoformat(),
                "payment_reference": stripe_session.get("payment_intent") or session_id,
                "metadata": {"source": "verify-session", "currency": stripe_session.get("currency", "usd").upper()}
            }).execute()
        await db.run(_insert_invoice)
        
    except Exception as e:
        logger.error("[verify-session] Failed updating subscriptions/invoices: %s", e)

    return ok({
        "success": True,
        "plan": plan,
        "message": f"{plan.capitalize()} plan activated successfully!",
    })

@router.get("/usage")
async def billing_usage(user: ClerkUser = Depends(require_user)):
    """GET /api/v2/billing/usage
    
    Provides structured billing status and real-time candidate limit metrics.
    """
    db = get_db_admin_service()
    
    # Get profile subscription
    def _fetch_profile():
        return db.client.from_("profiles").select("*").eq("user_id", user.id).maybe_single().execute()
        
    p_res = await db.run(_fetch_profile)
    profile = getattr(p_res, "data", None) or {}
    
    plan = _normalize_plan(profile.get("subscription_plan"))
    status = str(profile.get("subscription_status") or "active").lower()
    
    # Get active candidate count & capacity limit
    cfg = BILLING_PLAN_CONFIG[plan]
    candidate_limit = cfg["candidates"]
    candidate_count = await get_candidate_count_after_deployment(db, user.id)

    # Get renewal date (from cycle end)
    try:
        sub = await _get_or_create_subscription(db, user.id)
        cycle_end = sub.get("billing_cycle_end")
    except Exception:
        cycle_end = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()

    # Dynamic Currency selection
    currency = "USD"
    if sub and isinstance(sub.get("metadata"), dict):
        currency = str(sub["metadata"].get("currency") or "USD").upper()

    return ok({
        "plan": plan,
        "status": status,
        "billing_cycle_end": cycle_end,
        "currency": currency,
        "validity": cfg["validity"],
        "candidates_limit": candidate_limit,
        "candidates_count": candidate_count,
        "price": cfg[currency]["price"],
    })

@router.post("/topup")
async def billing_topup(payload: Dict[str, Any], request: Request, user: ClerkUser = Depends(require_user)):
    """POST /api/v2/billing/topup"""
    # Simply return error since wallet top-up is no longer active in subscription model
    return api_error(message="Wallet top-ups are disabled. Please subscribe to a plan to increase limits.", status_code=400)

@router.post("/pay-invoice")
async def pay_invoice(payload: Dict[str, Any], request: Request, user: ClerkUser = Depends(require_user)):
    """POST /api/v2/billing/pay-invoice"""
    # Subscriptions handle invoice payments automatically; return ok
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
