from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, Request

from app.api.v2.deps import require_user
from app.auth.clerk import ClerkUser
from app.services.db.supabase_service import get_db_admin_service
from app.utils.responses import api_error, ok

router = APIRouter(prefix="/billing")

# ── Billing plan config (mirrors api/_lib/billing-utils.ts) ──────────────────

BILLING_PLAN_CONFIG: Dict[str, Dict[str, Any]] = {
    "free": {"monthly_deposit": 0, "overage_cap": 0, "free_caps": {
        "create_job": 10, "resume_parse": 30, "candidate_scoring": 60,
        "assessment_invite": 25, "ai_interview_invite": 25,
        "regenerate_interview_questions": 20, "assessment_mcq_generation": 40,
    }},
    "pro": {"monthly_deposit": 36.13, "overage_cap": 180.72, "free_caps": {}},
    "premium": {"monthly_deposit": 96.37, "overage_cap": None, "free_caps": {}},
}

FEATURE_COSTS: Dict[str, float] = {
    "create_job": 0.18,
    "resume_parse": 0.1,
    "candidate_scoring": 0.14,
    "assessment_invite": 0.12,
    "ai_interview_invite": 0.3,
    "regenerate_interview_questions": 0.06,
    "assessment_mcq_generation": 0.24,
}


def _normalize_plan(raw: Optional[str]) -> str:
    p = str(raw or "free").lower()
    if p.startswith("pro"):
        return "pro"
    if p.startswith("premium"):
        return "premium"
    return "free"


def _normalize_status(raw: Optional[str]) -> str:
    s = str(raw or "active").lower()
    if s == "paused":
        return "paused"
    if s == "overdue":
        return "overdue"
    if s in ("cancel_at_period_end", "cancelled", "canceled"):
        return "cancel_at_period_end"
    return "active"


def _get_stripe_key() -> str:
    return os.environ.get("STRIPE_SECRET_KEY", "")


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


def _get_frontend_url(request: Request) -> str:
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
    proto = (request.headers.get("x-forwarded-proto") or "https").split(",")[0].strip()
    is_local = "localhost" in host
    if is_local:
        proto = "http"
    dynamic = f"{proto}://{host}" if host else "https://hire-ai-sandy.vercel.app"
    env_url = os.environ.get("FRONTEND_URL", "")
    if env_url and "localhost" not in env_url and "hire-ai-sandy" not in env_url:
        return env_url
    return dynamic


async def _get_or_create_subscription(db, user_id: str) -> Dict[str, Any]:
    """Mirror of getOrCreateSubscription from Node billing-utils."""

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
    status = _normalize_status(profile.get("subscription_status"))
    cfg = BILLING_PLAN_CONFIG[plan]
    now = datetime.now(timezone.utc)
    cycle_end = now.replace(month=(now.month % 12) + 1) if now.month < 12 else now.replace(year=now.year + 1, month=1)

    def _insert():
        return db.client.from_("subscriptions").insert(
            {
                "user_id": user_id,
                "plan": plan,
                "status": status,
                "deposit_amount": cfg["monthly_deposit"],
                "wallet_balance": cfg["monthly_deposit"],
                "billing_cycle_start": now.isoformat(),
                "billing_cycle_end": cycle_end.isoformat(),
                "overage_amount": 0,
                "overage_cap": cfg["overage_cap"],
                "metadata": {"source": "auto-bootstrap"},
            }
        ).execute()

    ins_res = await db.run(_insert)
    if getattr(ins_res, "error", None):
        raise RuntimeError("Failed to create subscription record")

    # Separate fetch for SDK compatibility
    res = await db.run(_fetch)
    created = getattr(res, "data", None)
    if not isinstance(created, dict):
        raise RuntimeError("Failed to create subscription record")
    return created


async def _aggregate_usage(db, user_id: str, period_start: str, period_end: str) -> Dict[str, Any]:
    """Mirror of aggregateUsageByFeature."""

    def _fetch():
        return (
            db.client.from_("usage_events")
            .select("feature_type, quantity, unit_cost, total_cost, created_at")
            .eq("user_id", user_id)
            .gte("created_at", period_start)
            .lte("created_at", period_end)
            .order("created_at", desc=True)
            .execute()
        )

    res = await db.run(_fetch)
    rows = getattr(res, "data", None) or []
    by_feature: Dict[str, Dict[str, float]] = {}
    total_cost = 0.0
    for ev in rows:
        f = str(ev.get("feature_type") or "unknown")
        if f not in by_feature:
            by_feature[f] = {"quantity": 0, "total_cost": 0.0}
        by_feature[f]["quantity"] += int(ev.get("quantity") or 1)
        by_feature[f]["total_cost"] += float(ev.get("total_cost") or 0)
        total_cost += float(ev.get("total_cost") or 0)
    return {"by_feature": by_feature, "total_cost": total_cost}


async def _send_email(to: str, subject: str, html: str) -> None:
    try:
        from app.services.email_service import get_email_service
        email_service = get_email_service()
        await email_service.send_email(to=to, subject=subject, html=html)
    except Exception:
        pass


# ── Routes ────────────────────────────────────────────────────────────────────


@router.post("/webhook")
async def billing_webhook(request: Request):
    """Node-compatible: POST /api/billing/webhook — Stripe webhook (no auth)."""
    try:
        event = await request.json()
    except Exception:
        return ok({"received": True})

    event_type = str(event.get("type") or "")
    obj = (event.get("data") or {}).get("object") or {}

    if event_type == "checkout.session.completed":
        metadata = obj.get("metadata") or {}
        user_id = metadata.get("user_id")
        action = metadata.get("action")
        amount = float((obj.get("amount_total") or 0)) / 100

        if user_id and amount > 0:
            db = get_db_admin_service()
            try:
                sub = await _get_or_create_subscription(db, user_id)

                if action in ("topup", "invoice_payment"):
                    def _topup():
                        return (
                            db.client.from_("subscriptions")
                            .update({
                                "wallet_balance": float(sub.get("wallet_balance") or 0) + amount,
                                "status": "active",
                                "resumed_at": datetime.now(timezone.utc).isoformat(),
                                "updated_at": datetime.now(timezone.utc).isoformat(),
                            })
                            .eq("id", sub["id"])
                            .execute()
                        )
                    await db.run(_topup)

                    if action == "invoice_payment" and metadata.get("invoice_id"):
                        invoice_id = metadata["invoice_id"]
                        def _mark_paid():
                            return (
                                db.client.from_("invoices")
                                .update({
                                    "status": "paid",
                                    "paid_at": datetime.now(timezone.utc).isoformat(),
                                    "payment_reference": obj.get("payment_intent") or obj.get("id"),
                                    "updated_at": datetime.now(timezone.utc).isoformat(),
                                })
                                .eq("id", invoice_id)
                                .execute()
                            )
                        await db.run(_mark_paid)

                elif action == "subscribe":
                    next_plan = _normalize_plan(metadata.get("plan"))
                    cfg = BILLING_PLAN_CONFIG[next_plan]
                    now = datetime.now(timezone.utc)
                    cycle_end = now.replace(month=(now.month % 12) + 1) if now.month < 12 else now.replace(year=now.year + 1, month=1)

                    def _subscribe():
                        return (
                            db.client.from_("subscriptions")
                            .update({
                                "plan": next_plan,
                                "status": "active",
                                "deposit_amount": amount or cfg["monthly_deposit"],
                                "wallet_balance": amount or cfg["monthly_deposit"],
                                "billing_cycle_start": now.isoformat(),
                                "billing_cycle_end": cycle_end.isoformat(),
                                "paused_at": None,
                                "resumed_at": now.isoformat(),
                                "warning_80_sent_at": None,
                                "updated_at": now.isoformat(),
                            })
                            .eq("id", sub["id"])
                            .execute()
                        )
                    await db.run(_subscribe)

                    def _update_profile():
                        return (
                            db.client.from_("profiles")
                            .update({
                                "subscription_plan": next_plan,
                                "subscription_status": "active",
                                "subscription_id": obj.get("id"),
                                "stripe_payment_id": obj.get("payment_intent") or obj.get("id"),
                                "plan_selected_at": now.isoformat(),
                                "updated_at": now.isoformat(),
                            })
                            .eq("user_id", user_id)
                            .execute()
                        )
                    await db.run(_update_profile)

            except Exception:
                pass  # Webhook errors must not return 5xx to Stripe

    return ok({"received": True})


@router.post("/subscribe")
async def billing_subscribe(payload: Dict[str, Any], request: Request, user: ClerkUser = Depends(require_user)):
    """Node-compatible: POST /api/billing/subscribe"""
    plan = _normalize_plan(payload.get("plan"))
    if plan == "free":
        return api_error(message="Use free plan selection endpoint for free tier", status_code=400)

    cfg = BILLING_PLAN_CONFIG[plan]
    frontend_url = _get_frontend_url(request)
    success_url = f"{frontend_url}/billing?checkout=success&action=subscribe"
    cancel_url = f"{frontend_url}/billing?checkout=cancelled&action=subscribe"

    try:
        session = await _create_stripe_checkout(
            amount_cents=int(cfg["monthly_deposit"] * 100),
            label=f"{plan.upper()} Deposit",
            plan_id=plan,
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"action": "subscribe", "user_id": user.id, "plan": plan},
        )
    except Exception as exc:
        return api_error(message=str(exc), status_code=500)

    return ok({
        "success": True,
        "session_id": session["id"],
        "checkout_url": session["url"],
        "plan": plan,
        "deposit_amount": cfg["monthly_deposit"],
    })


@router.get("/usage")
async def billing_usage(user: ClerkUser = Depends(require_user)):
    """Node-compatible: GET /api/billing/usage"""
    db = get_db_admin_service()
    try:
        sub = await _get_or_create_subscription(db, user.id)
    except Exception as exc:
        return api_error(message=str(exc), status_code=500)

    plan = _normalize_plan(sub.get("plan"))
    cfg = BILLING_PLAN_CONFIG[plan]
    now = datetime.now(timezone.utc)
    period_start = sub.get("billing_cycle_start") or now.replace(day=1).isoformat()
    period_end = sub.get("billing_cycle_end") or now.isoformat()

    aggregated = await _aggregate_usage(db, user.id, period_start, period_end)

    return ok({
        "plan": plan,
        "status": str(sub.get("status") or "active"),
        "wallet_balance": float(sub.get("wallet_balance") or 0),
        "deposit_amount": float(sub.get("deposit_amount") or 0),
        "overage_amount": float(sub.get("overage_amount") or 0),
        "overage_cap": sub.get("overage_cap"),
        "billing_cycle_start": sub.get("billing_cycle_start"),
        "billing_cycle_end": sub.get("billing_cycle_end"),
        "limits": {
            "free_caps": cfg["free_caps"],
            "feature_costs": FEATURE_COSTS,
        },
        "usage_breakdown": aggregated["by_feature"],
        "usage_total_cost": aggregated["total_cost"],
    })


@router.post("/topup")
async def billing_topup(payload: Dict[str, Any], request: Request, user: ClerkUser = Depends(require_user)):
    """Node-compatible: POST /api/billing/topup"""
    amount = float(payload.get("amount") or 0)
    if not amount or amount <= 0:
        return api_error(message="Valid amount is required", status_code=400)

    frontend_url = _get_frontend_url(request)
    success_url = f"{frontend_url}/billing?checkout=success&action=topup"
    cancel_url = f"{frontend_url}/billing?checkout=cancelled&action=topup"

    try:
        session = await _create_stripe_checkout(
            amount_cents=int(amount * 100),
            label="Wallet Top-up",
            plan_id="topup",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"action": "topup", "user_id": user.id, "amount": str(amount)},
        )
    except Exception as exc:
        return api_error(message=str(exc), status_code=500)

    return ok({"success": True, "session_id": session["id"], "checkout_url": session["url"]})


@router.post("/pay-invoice")
async def pay_invoice(payload: Dict[str, Any], request: Request, user: ClerkUser = Depends(require_user)):
    """Node-compatible: POST /api/billing/pay-invoice"""
    invoice_id = str(payload.get("invoice_id") or "")
    if not invoice_id:
        return api_error(message="invoice_id is required", status_code=400)

    db = get_db_admin_service()

    def _fetch_invoice():
        return (
            db.client.from_("invoices")
            .select("*")
            .eq("id", invoice_id)
            .eq("user_id", user.id)
            .single()
            .execute()
        )

    res = await db.run(_fetch_invoice)
    invoice = getattr(res, "data", None)
    if not isinstance(invoice, dict):
        return api_error(message="Invoice not found", status_code=404)
    if invoice.get("status") == "paid":
        return ok({"success": True, "already_paid": True})

    total = float(invoice.get("total") or 0)
    if total <= 0:
        return api_error(message="Invoice total is invalid", status_code=400)

    frontend_url = _get_frontend_url(request)
    success_url = f"{frontend_url}/billing?checkout=success&action=invoice_payment"
    cancel_url = f"{frontend_url}/billing?checkout=cancelled&action=invoice_payment"

    try:
        session = await _create_stripe_checkout(
            amount_cents=int(total * 100),
            label=f"Invoice {invoice_id}",
            plan_id="invoice_payment",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"action": "invoice_payment", "user_id": user.id, "invoice_id": invoice_id},
        )
    except Exception as exc:
        return api_error(message=str(exc), status_code=500)

    return ok({"success": True, "session_id": session["id"], "checkout_url": session["url"]})


@router.get("/invoices")
async def list_invoices(user: ClerkUser = Depends(require_user)):
    """Node-compatible: GET /api/billing/invoices"""
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
