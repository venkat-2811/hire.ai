from __future__ import annotations

import logging
import os
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, Request

from app.api.v2.deps import require_user
from app.auth.clerk import ClerkUser
from app.config import get_settings
from app.services.db.supabase_service import get_db_admin_service
from app.utils.responses import api_error, ok
from app.utils.billing_helpers import (
    BILLING_PLAN_CONFIG,
    _normalize_plan,
    get_candidate_count_after_deployment,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/subscription")

def _get_stripe_key() -> str:
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

async def _get_stripe_session(session_id: str) -> Dict[str, Any]:
    key = _get_stripe_key()
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.stripe.com/v1/checkout/sessions/{session_id}",
            headers={"Authorization": f"Bearer {key}"},
        )
    if resp.status_code != 200:
        err_body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
        err_code = (err_body.get("error") or {}).get("code", "")
        if err_code == "resource_missing":
            raise RuntimeError(
                "Checkout session not found in current Stripe account. "
                "This usually means the session was created with a different Stripe key "
                "than the one currently configured. Please start a fresh checkout."
            )
        raise RuntimeError(f"Stripe error: {resp.text}")
    return resp.json()

async def _cancel_stripe_subscription(subscription_id: str) -> None:
    key = _get_stripe_key()
    if not key or not subscription_id or subscription_id.startswith("cs_"):
        return
        
    async with httpx.AsyncClient() as client:
        resp = await client.delete(
            f"https://api.stripe.com/v1/subscriptions/{subscription_id}",
            headers={
                "Authorization": f"Bearer {key}",
            },
        )
    if resp.status_code != 200:
        logger.error("[Stripe] Failed to cancel subscription %s: %s", subscription_id, resp.text)

def _get_frontend_url(request: Request) -> str:
    """Resolve the correct frontend origin for Stripe redirect URLs.
    
    Priority:
    1. If the request Origin/Referer header shows a localhost URL → use that (dev mode)
    2. Otherwise use FRONTEND_URL from settings (staging / production)
    """
    settings = get_settings()

    # Check if request is coming from a localhost browser origin
    origin = request.headers.get("origin") or request.headers.get("referer") or ""
    if "localhost" in origin or "127.0.0.1" in origin:
        # Strip any path from referer, keep just scheme+host+port
        from urllib.parse import urlparse
        parsed = urlparse(origin)
        return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")

    # Production: use configured FRONTEND_URL
    env_url = str(settings.frontend_url or os.environ.get("FRONTEND_URL", "") or "").strip()
    if env_url:
        return env_url.rstrip("/")

    # Last resort: derive from request host headers
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
    proto = (request.headers.get("x-forwarded-proto") or "https").split(",")[0].strip()
    return f"{proto}://{host}".rstrip("/")

# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("")
async def get_subscription(user: ClerkUser = Depends(require_user)):
    """GET /api/v2/subscription"""
    db = get_db_admin_service()

    def _fetch():
        return db.client.from_("profiles").select("*").eq("user_id", user.id).maybe_single().execute()

    res = await db.run(_fetch)
    profile = getattr(res, "data", None)
    if not isinstance(profile, dict):
        return api_error(message="Profile not found", status_code=404)

    plan = _normalize_plan(profile.get("subscription_plan"))
    status = str(profile.get("subscription_status") or "active").lower()
    
    cfg = BILLING_PLAN_CONFIG[plan]
    
    # We will fetch a dynamic candidate usage count for display in layout and sidebar
    candidate_count = await get_candidate_count_after_deployment(db, user.id)

    return ok({
        "plan": plan,
        "status": status,
        "subscription_id": profile.get("subscription_id"),
        "plan_selected_at": profile.get("plan_selected_at"),
        "limits": {
            "max_jobs": 999999,
            "max_assessments": cfg["candidates"],
            "max_interviews": cfg["candidates"],
            "price": cfg["USD"]["price"],
            "label": cfg["name"],
        },
        "usage": {
            "jobs_count": int(profile.get("jobs_count") or 0),
            "assessments_count": candidate_count,
            "interviews_count": candidate_count,
        },
    })

@router.post("/create-order")
async def create_order(payload: Dict[str, Any], request: Request, user: ClerkUser = Depends(require_user)):
    """POST /api/v2/subscription/create-order"""
    plan = _normalize_plan(payload.get("plan"))
    currency = str(payload.get("currency") or "USD").upper()
    country = str(payload.get("country") or "US").upper()
    expected_currency = "INR" if country == "IN" else "USD"
    if currency not in ("USD", "INR") or currency != expected_currency:
        currency = expected_currency

    if plan == "free":
        return api_error(message="Free plan does not require payment", status_code=400)

    if plan not in BILLING_PLAN_CONFIG:
        return api_error(message=f"Unknown plan: {plan}", status_code=400)

    cfg = BILLING_PLAN_CONFIG[plan]
    price = cfg[currency]["price"]
    interval = cfg["interval"]
    interval_count = cfg["interval_count"]

    frontend_url = _get_frontend_url(request)
    success_url = f"{frontend_url}/onboarding?session_id={{CHECKOUT_SESSION_ID}}&plan={plan}"
    cancel_url = f"{frontend_url}/onboarding?cancelled=true"

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
            metadata={
                "action": "subscribe",
                "user_id": user.id,
                "plan": plan,
                "currency": currency,
                "country": country,
            },
        )
    except Exception as exc:
        return api_error(message=str(exc), status_code=500)

    return ok({"session_id": session["id"], "url": session["url"], "plan": plan})


@router.post("/select-free")
async def select_free_plan(user: ClerkUser = Depends(require_user)):
    """POST /api/v2/subscription/select-free

    Activates the free plan without Stripe checkout. Idempotent and safe to
    call multiple times during onboarding.
    """
    db = get_db_admin_service()
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    def _fetch_profile():
        return (
            db.client.from_("profiles")
            .select("subscription_plan, subscription_status, plan_selected_at")
            .eq("user_id", user.id)
            .maybe_single()
            .execute()
        )

    profile_res = await db.run(_fetch_profile)
    profile = getattr(profile_res, "data", None) or {}
    existing_plan = _normalize_plan(profile.get("subscription_plan"))

    def _update_profile():
        return (
            db.client.from_("profiles")
            .update({
                "subscription_plan": "free",
                "subscription_status": "active",
                "plan_selected_at": profile.get("plan_selected_at") or now_iso,
                "updated_at": now_iso,
            })
            .eq("user_id", user.id)
            .execute()
        )

    await db.run(_update_profile)

    def _fetch_sub():
        return (
            db.client.from_("subscriptions")
            .select("id")
            .eq("user_id", user.id)
            .maybe_single()
            .execute()
        )

    sub_res = await db.run(_fetch_sub)
    existing_sub = getattr(sub_res, "data", None)

    if isinstance(existing_sub, dict) and existing_sub.get("id"):
        def _update_sub():
            return (
                db.client.from_("subscriptions")
                .update({
                    "plan": "free",
                    "status": "active",
                    "billing_cycle_start": now_iso,
                    "billing_cycle_end": (now + timedelta(days=30)).isoformat(),
                    "deposit_amount": 0,
                    "wallet_balance": 0,
                    "updated_at": now_iso,
                    "metadata": {"source": "subscription-select-free", "currency": "USD"},
                })
                .eq("id", existing_sub["id"])
                .execute()
            )
        await db.run(_update_sub)
    else:
        def _insert_sub():
            return (
                db.client.from_("subscriptions")
                .insert({
                    "user_id": user.id,
                    "plan": "free",
                    "status": "active",
                    "billing_cycle_start": now_iso,
                    "billing_cycle_end": (now + timedelta(days=30)).isoformat(),
                    "deposit_amount": 0,
                    "wallet_balance": 0,
                    "overage_amount": 0,
                    "overage_cap": 0,
                    "metadata": {"source": "subscription-select-free", "currency": "USD"},
                })
                .execute()
            )
        await db.run(_insert_sub)

    return ok({
        "success": True,
        "plan": "free",
        "message": "Free plan activated successfully.",
        "previous_plan": existing_plan,
    })

@router.post("/verify")
async def verify_payment(payload: Dict[str, Any], user: ClerkUser = Depends(require_user)):
    """POST /api/v2/subscription/verify"""
    session_id = str(payload.get("session_id") or "")
    plan = _normalize_plan(payload.get("plan"))
    if not session_id or not plan:
        return api_error(message="Missing session_id or plan", status_code=400)

    try:
        session = await _get_stripe_session(session_id)
    except Exception as exc:
        return api_error(message=str(exc), status_code=500)

    if session.get("payment_status") != "paid":
        return api_error(message="Payment not completed", status_code=400)

    amount = float((session.get("amount_total") or 0)) / 100
    cfg = BILLING_PLAN_CONFIG[plan]
    db = get_db_admin_service()
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    
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
                "subscription_id": session.get("subscription") or session_id,
                "stripe_payment_id": session.get("customer") or session_id,
                "subscription_status": "active",
                "plan_selected_at": now_iso,
                "updated_at": now_iso,
            })
            .eq("user_id", user.id)
            .execute()
        )

    await db.run(_update_profile)

    # 2. Sync the subscriptions table
    try:
        def _fetch_sub():
            return db.client.from_("subscriptions").select("id").eq("user_id", user.id).maybe_single().execute()

        sub_res = await db.run(_fetch_sub)
        existing_sub = getattr(sub_res, "data", None)

        if isinstance(existing_sub, dict) and existing_sub.get("id"):
            def _update_sub():
                return (
                    db.client.from_("subscriptions")
                    .update({
                        "plan": plan,
                        "status": "active",
                        "deposit_amount": amount,
                        "wallet_balance": amount,
                        "billing_cycle_start": now_iso,
                        "billing_cycle_end": cycle_end.isoformat(),
                        "updated_at": now_iso,
                        "metadata": {
                            "stripe_customer_id": session.get("customer"),
                            "stripe_subscription_id": session.get("subscription"),
                            "currency": session.get("currency", "usd").upper(),
                            "country": str((session.get("metadata") or {}).get("country") or "").upper() or None,
                        }
                    })
                    .eq("id", existing_sub["id"])
                    .execute()
                )
            await db.run(_update_sub)
        else:
            def _insert_sub():
                return db.client.from_("subscriptions").insert({
                    "user_id": user.id,
                    "plan": plan,
                    "status": "active",
                    "deposit_amount": amount,
                    "wallet_balance": amount,
                    "billing_cycle_start": now_iso,
                    "billing_cycle_end": cycle_end.isoformat(),
                    "overage_amount": 0,
                    "overage_cap": 0,
                    "metadata": {
                        "source": "subscription-verify",
                        "stripe_customer_id": session.get("customer"),
                        "stripe_subscription_id": session.get("subscription"),
                        "currency": session.get("currency", "usd").upper(),
                        "country": str((session.get("metadata") or {}).get("country") or "").upper() or None,
                    },
                }).execute()
            await db.run(_insert_sub)

        # Add invoice record
        def _insert_invoice():
            return db.client.from_("invoices").insert({
                "user_id": user.id,
                "period_start": now_iso,
                "period_end": cycle_end.isoformat(),
                "line_items": [{"name": f"Hire.AI {plan.capitalize()} Plan", "amount": amount, "currency": session.get("currency", "usd").upper()}],
                "subtotal": amount,
                "tax_amount": 0,
                "total": amount,
                "status": "paid",
                "due_date": now_iso,
                "paid_at": now_iso,
                "payment_reference": session.get("payment_intent") or session_id,
                "metadata": {
                    "source": "verify-session",
                    "currency": session.get("currency", "usd").upper(),
                    "country": str((session.get("metadata") or {}).get("country") or "").upper() or None,
                }
            }).execute()
        await db.run(_insert_invoice)
        
    except Exception as e:
        logger.error("[subscription.verify] subscriptions sync failed: %s", e)

    def _fetch_profile():
        return db.client.from_("profiles").select("*").eq("user_id", user.id).maybe_single().execute()

    fetch_res = await db.run(_fetch_profile)
    updated = getattr(fetch_res, "data", None)
    return ok({
        "success": True,
        "plan": plan,
        "message": f"{plan.capitalize()} plan activated successfully!",
        "profile": updated,
    })

@router.post("/cancel")
async def cancel_subscription(user: ClerkUser = Depends(require_user)):
    """POST /api/v2/subscription/cancel
    
    Sets cancel_at_period_end so the subscription continues until billing cycle end.
    The plan is NOT reverted to free immediately — the user retains full access
    until the billing_cycle_end date. The Stripe webhook handles the final downgrade.
    """
    db = get_db_admin_service()

    def _fetch():
        return db.client.from_("profiles").select(
            "subscription_id, subscription_status, subscription_plan"
        ).eq("user_id", user.id).maybe_single().execute()

    res = await db.run(_fetch)
    profile = getattr(res, "data", None)
    if not isinstance(profile, dict):
        return api_error(message="No active subscription found", status_code=400)

    current_plan = str(profile.get("subscription_plan") or "free").lower()
    if current_plan == "free":
        return api_error(message="No active subscription found", status_code=400)

    sub_id = profile.get("subscription_id")
    current_status = str(profile.get("subscription_status") or "").lower()

    if current_status == "cancel_at_period_end":
        return api_error(message="Subscription is already scheduled for cancellation.", status_code=400)

    # 1. Tell Stripe to cancel at period end (not immediately)
    key = _get_stripe_key()
    if key and sub_id and not sub_id.startswith("cs_"):
        try:
            async with __import__("httpx").AsyncClient() as client:
                resp = await client.post(
                    f"https://api.stripe.com/v1/subscriptions/{sub_id}",
                    headers={
                        "Authorization": f"Bearer {key}",
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    content="cancel_at_period_end=true",
                )
            if resp.status_code != 200:
                logger.error("[subscription.cancel] Stripe cancel_at_period_end failed: %s", resp.text)
        except Exception as e:
            logger.error("[subscription.cancel] Stripe request failed: %s", e)

    now = datetime.now(timezone.utc).isoformat()

    # 2. Mark profiles as cancel_at_period_end — keep the plan and don't downgrade yet
    def _update_profile():
        return (
            db.client.from_("profiles")
            .update({"subscription_status": "cancel_at_period_end", "updated_at": now})
            .eq("user_id", user.id)
            .execute()
        )
    await db.run(_update_profile)

    # 3. Mark subscriptions table the same way
    def _update_sub():
        return (
            db.client.from_("subscriptions")
            .update({"status": "cancel_at_period_end", "updated_at": now})
            .eq("user_id", user.id)
            .execute()
        )
    await db.run(_update_sub)

    return ok({
        "success": True,
        "message": "Your subscription has been scheduled for cancellation. You will retain full access until the end of your current billing period.",
    })

@router.post("/reactivate")
async def reactivate_subscription(user: ClerkUser = Depends(require_user)):
    """POST /api/v2/subscription/reactivate
    
    Reactivates a subscription that was previously scheduled for cancellation
    (status = cancel_at_period_end).
    """
    db = get_db_admin_service()

    def _fetch():
        return db.client.from_("profiles").select(
            "subscription_id, subscription_status, subscription_plan"
        ).eq("user_id", user.id).maybe_single().execute()

    res = await db.run(_fetch)
    profile = getattr(res, "data", None)
    if not isinstance(profile, dict):
        return api_error(message="No active subscription found", status_code=400)

    current_plan = str(profile.get("subscription_plan") or "free").lower()
    if current_plan == "free":
        return api_error(message="You are already on the Free plan", status_code=400)

    current_status = str(profile.get("subscription_status") or "").lower()
    if current_status != "cancel_at_period_end":
        return api_error(message="Subscription is not scheduled for cancellation.", status_code=400)

    sub_id = profile.get("subscription_id")

    # 1. Tell Stripe to remove cancel_at_period_end
    key = _get_stripe_key()
    if key and sub_id and not sub_id.startswith("cs_"):
        try:
            async with __import__("httpx").AsyncClient() as client:
                resp = await client.post(
                    f"https://api.stripe.com/v1/subscriptions/{sub_id}",
                    headers={
                        "Authorization": f"Bearer {key}",
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    content="cancel_at_period_end=false",
                )
            if resp.status_code != 200:
                logger.error("[subscription.reactivate] Stripe cancel_at_period_end=false failed: %s", resp.text)
        except Exception as e:
            logger.error("[subscription.reactivate] Stripe request failed: %s", e)

    now = datetime.now(timezone.utc).isoformat()

    # 2. Update DB status back to active
    def _update_profile():
        return (
            db.client.from_("profiles")
            .update({"subscription_status": "active", "updated_at": now})
            .eq("user_id", user.id)
            .execute()
        )
    await db.run(_update_profile)

    def _update_sub():
        return (
            db.client.from_("subscriptions")
            .update({"status": "active", "updated_at": now})
            .eq("user_id", user.id)
            .execute()
        )
    await db.run(_update_sub)

    return ok({
        "success": True,
        "message": "Your subscription has been successfully reactivated.",
    })

