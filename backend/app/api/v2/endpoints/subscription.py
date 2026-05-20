from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, Request

from app.api.v2.deps import require_user
from app.auth.clerk import ClerkUser
from app.config import get_settings
from app.services.db.supabase_service import get_db_admin_service
from app.utils.responses import api_error, ok

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/subscription")

# ── Plan config (mirrors api/_lib/billing-utils.ts) ───────────────────────────

BILLING_PLAN_CONFIG: Dict[str, Dict[str, Any]] = {
    "free": {"monthly_deposit": 0, "overage_cap": 0},
    "pro": {"monthly_deposit": 36.13, "overage_cap": 180.72},
    "premium": {"monthly_deposit": 96.37, "overage_cap": None},
}


def _normalize_plan(raw: Optional[str]) -> str:
    p = str(raw or "free").lower()
    if p.startswith("pro"):
        return "pro"
    if p.startswith("premium"):
        return "premium"
    return "free"


def _get_stripe_key() -> str:
    settings = get_settings()
    return str(settings.stripe_secret_key or os.environ.get("STRIPE_SECRET_KEY", "") or "").strip()


async def _create_stripe_checkout(
    amount_cents: int,
    label: str,
    plan_id: str,
    success_url: str,
    cancel_url: str,
    metadata: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    key = _get_stripe_key()
    if not key:
        raise RuntimeError("STRIPE_SECRET_KEY not configured")

    params: Dict[str, str] = {
        "mode": "payment",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][product_data][name]": f"Hire.AI {label}",
        "line_items[0][price_data][unit_amount]": str(amount_cents),
        "line_items[0][quantity]": "1",
        "success_url": success_url,
        "cancel_url": cancel_url,
        "metadata[plan]": plan_id,
    }
    if metadata:
        for k, v in metadata.items():
            params[f"metadata[{k}]"] = v

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
        raise RuntimeError(f"Stripe error: {resp.text}")
    return resp.json()


def _get_frontend_url(request: Request) -> str:
    settings = get_settings()
    env_url = str(settings.frontend_url or os.environ.get("FRONTEND_URL", "") or "").strip()
    if env_url:
        return env_url.rstrip("/")

    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
    proto = (request.headers.get("x-forwarded-proto") or "https").split(",")[0].strip()
    is_local = "localhost" in host
    if is_local:
        proto = "http"
    dynamic = f"{proto}://{host}" if host else "https://hire-ai-sandy.vercel.app"
    return dynamic.rstrip("/")


# ── Routes ────────────────────────────────────────────────────────────────────


@router.get("")
async def get_subscription(user: ClerkUser = Depends(require_user)):
    """Node-compatible: GET /api/subscription"""
    db = get_db_admin_service()

    def _fetch():
        return db.client.from_("profiles").select("*").eq("user_id", user.id).maybe_single().execute()

    res = await db.run(_fetch)
    profile = getattr(res, "data", None)
    if not isinstance(profile, dict):
        return api_error(message="Profile not found", status_code=404)

    plan = _normalize_plan(profile.get("subscription_plan"))
    cfg = BILLING_PLAN_CONFIG[plan]

    return ok({
        "plan": plan,
        "status": str(profile.get("subscription_status") or "active"),
        "subscription_id": profile.get("subscription_id"),
        "plan_selected_at": profile.get("plan_selected_at"),
        "limits": {
            "max_jobs": 999999,
            "max_assessments": 999999,
            "max_interviews": 999999,
            "price": cfg["monthly_deposit"],
            "label": plan.capitalize(),
        },
        "usage": {
            "jobs_count": int(profile.get("jobs_count") or 0),
            "assessments_count": int(profile.get("assessments_count") or 0),
            "interviews_count": int(profile.get("interviews_count") or 0),
        },
    })


@router.post("/create-order")
async def create_order(payload: Dict[str, Any], request: Request, user: ClerkUser = Depends(require_user)):
    """Node-compatible: POST /api/subscription/create-order"""
    plan = _normalize_plan(payload.get("plan"))
    if plan == "free":
        return api_error(message="Free plan does not require payment", status_code=400)

    cfg = BILLING_PLAN_CONFIG[plan]
    frontend_url = _get_frontend_url(request)
    success_url = f"{frontend_url}/onboarding?session_id={{CHECKOUT_SESSION_ID}}&plan={plan}"
    cancel_url = f"{frontend_url}/onboarding?cancelled=true"

    try:
        session = await _create_stripe_checkout(
            amount_cents=int(cfg["monthly_deposit"] * 100),
            label=plan.capitalize(),
            plan_id=plan,
            success_url=success_url,
            cancel_url=cancel_url,
            # Include user_id and action so Stripe webhooks can process this session
            metadata={"action": "subscribe", "user_id": user.id, "plan": plan},
        )
    except Exception as exc:
        msg = str(exc)
        if "Stripe error:" in msg or "api.stripe.com" in msg:
            return api_error(message=msg, status_code=502)
        return api_error(message=msg, status_code=500)

    logger.info("[subscription.create_order] user_id=%s plan=%s session_id=%s", user.id, plan, session["id"])
    return ok({"session_id": session["id"], "url": session["url"], "plan": plan})


@router.post("/verify")
async def verify_payment(payload: Dict[str, Any], user: ClerkUser = Depends(require_user)):
    """Node-compatible: POST /api/subscription/verify"""
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

    # 1. Update profiles table
    def _update_profile():
        return (
            db.client.from_("profiles")
            .update({
                "subscription_plan": plan,
                "subscription_id": session_id,
                "stripe_payment_id": session.get("payment_intent") or session_id,
                "subscription_status": "active",
                "plan_selected_at": now_iso,
                "updated_at": now_iso,
            })
            .eq("user_id", user.id)
            .execute()
        )

    up_res = await db.run(_update_profile)
    if getattr(up_res, "error", None):
        return api_error(message="Failed to update profile", status_code=500)

    # 2. Sync the subscriptions table so billing usage/plan display is accurate
    try:
        cycle_end = now.replace(month=(now.month % 12) + 1) if now.month < 12 else now.replace(year=now.year + 1, month=1)

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
                        "deposit_amount": amount or cfg["monthly_deposit"],
                        "wallet_balance": amount or cfg["monthly_deposit"],
                        "billing_cycle_start": now_iso,
                        "billing_cycle_end": cycle_end.isoformat(),
                        "overage_cap": cfg["overage_cap"],
                        "paused_at": None,
                        "resumed_at": now_iso,
                        "warning_80_sent_at": None,
                        "updated_at": now_iso,
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
                    "deposit_amount": amount or cfg["monthly_deposit"],
                    "wallet_balance": amount or cfg["monthly_deposit"],
                    "billing_cycle_start": now_iso,
                    "billing_cycle_end": cycle_end.isoformat(),
                    "overage_amount": 0,
                    "overage_cap": cfg["overage_cap"],
                    "metadata": {"source": "subscription-verify"},
                }).execute()
            await db.run(_insert_sub)
    except Exception as e:
        logger.warning("[subscription.verify] subscriptions sync failed user_id=%s: %s", user.id, e)

    def _fetch_profile():
        return db.client.from_("profiles").select("*").eq("user_id", user.id).maybe_single().execute()

    fetch_res = await db.run(_fetch_profile)
    updated = getattr(fetch_res, "data", None)
    if not isinstance(updated, dict):
        return api_error(message="Failed to update profile", status_code=500)

    logger.info("[subscription.verify] user_id=%s plan=%s activated", user.id, plan)
    return ok({
        "success": True,
        "plan": plan,
        "message": f"{plan.capitalize()} plan activated successfully!",
        "profile": updated,
    })


@router.post("/select-free")
async def select_free(user: ClerkUser = Depends(require_user)):
    """Node-compatible: POST /api/subscription/select-free"""
    db = get_db_admin_service()
    now = datetime.now(timezone.utc).isoformat()

    def _update():
        return (
            db.client.from_("profiles")
            .update({
                "subscription_plan": "free",
                "subscription_status": "active",
                "plan_selected_at": now,
                "updated_at": now,
            })
            .eq("user_id", user.id)
            .execute()
        )

    up_res = await db.run(_update)
    if getattr(up_res, "error", None):
        return api_error(message="Failed to update profile", status_code=500)

    def _fetch_profile():
        return db.client.from_("profiles").select("*").eq("user_id", user.id).maybe_single().execute()

    fetch_res = await db.run(_fetch_profile)
    updated = getattr(fetch_res, "data", None)
    return ok({"success": True, "plan": "free", "profile": updated})


@router.post("/cancel")
async def cancel_subscription(user: ClerkUser = Depends(require_user)):
    """Node-compatible: POST /api/subscription/cancel"""
    db = get_db_admin_service()

    def _fetch():
        return db.client.from_("profiles").select("subscription_id").eq("user_id", user.id).maybe_single().execute()

    res = await db.run(_fetch)
    profile = getattr(res, "data", None)
    if not isinstance(profile, dict) or not profile.get("subscription_id"):
        return api_error(message="No active subscription found", status_code=400)

    now = datetime.now(timezone.utc).isoformat()

    def _update():
        return (
            db.client.from_("profiles")
            .update({"subscription_status": "cancel_at_period_end", "updated_at": now})
            .eq("user_id", user.id)
            .execute()
        )

    await db.run(_update)
    return ok({"success": True, "message": "Subscription cancelled. Access continues until the end of the billing period."})
