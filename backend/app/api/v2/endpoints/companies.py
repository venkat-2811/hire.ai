"""
companies.py — Company management endpoint.

Handles: company CRUD, join requests (email-based), member management,
         credits, activity feed, audit logs, subscription history, analytics.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Query, Request

from app.auth.clerk import ClerkUser
from app.auth.dependencies import require_user
from app.config import get_settings
from app.services.db.supabase_service import get_db_admin_service
from app.services.email_service import EmailService
from app.utils.audit_helpers import write_audit_log
from app.utils.email_templates import (
    approval_confirmation_email,
    join_request_email,
    rejection_email,
    invite_recruiter_email,
)
from app.utils.responses import api_error, ok

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/companies")

# ── Token helpers (stateless HMAC, 72-hour expiry) ────────────────────────────

def _get_token_secret() -> str:
    settings = get_settings()
    return getattr(settings, "company_token_secret", None) or getattr(settings, "secret_key", "rekshift-default-secret")


def _make_action_token(company_id: str, member_id: str, action: str, secret: str) -> str:
    expires = int(time.time()) + 72 * 3600
    payload = f"{company_id}:{member_id}:{action}:{expires}"
    sig = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}:{sig}"


def _verify_action_token(token: str, secret: str) -> Optional[Dict[str, str]]:
    """Returns dict with company_id, member_id, action if valid; else None."""
    try:
        parts = token.split(":")
        if len(parts) != 5:
            return None
        company_id, member_id, action, expires_str, provided_sig = parts
        expires = int(expires_str)
        if time.time() > expires:
            return None
        payload = f"{company_id}:{member_id}:{action}:{expires_str}"
        expected_sig = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected_sig, provided_sig):
            return None
        return {"company_id": company_id, "member_id": member_id, "action": action}
    except Exception:
        return None


# ── DB helpers ────────────────────────────────────────────────────────────────

async def _get_company(db, company_id: str) -> Optional[Dict[str, Any]]:
    def _f():
        return db.client.from_("companies").select("*").eq("id", company_id).maybe_single().execute()
    res = await db.run(_f)
    return getattr(res, "data", None) if isinstance(getattr(res, "data", None), dict) else None


async def _get_member(db, company_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    def _f():
        return db.client.from_("company_members").select("*").eq("company_id", company_id).eq("user_id", user_id).maybe_single().execute()
    res = await db.run(_f)
    return getattr(res, "data", None) if isinstance(getattr(res, "data", None), dict) else None


async def _get_member_by_id(db, member_id: str) -> Optional[Dict[str, Any]]:
    def _f():
        return db.client.from_("company_members").select("*").eq("id", member_id).maybe_single().execute()
    res = await db.run(_f)
    return getattr(res, "data", None) if isinstance(getattr(res, "data", None), dict) else None


async def _get_profile(db, user_id: str) -> Optional[Dict[str, Any]]:
    def _f():
        return db.client.from_("profiles").select("*").eq("user_id", user_id).maybe_single().execute()
    res = await db.run(_f)
    return getattr(res, "data", None) if isinstance(getattr(res, "data", None), dict) else None


async def _get_active_membership(db, user_id: str) -> Optional[Dict[str, Any]]:
    """Return the active company_members row for a user (any company)."""
    def _f():
        return db.client.from_("company_members").select("*, companies(*)").eq("user_id", user_id).eq("status", "active").maybe_single().execute()
    res = await db.run(_f)
    return getattr(res, "data", None) if isinstance(getattr(res, "data", None), dict) else None


async def _write_activity(db, *, company_id: str, user_id: str, action_type: str,
                          description: str, entity_type: Optional[str] = None,
                          entity_id: Optional[str] = None, metadata: Optional[Dict] = None) -> None:
    row = {
        "company_id": company_id,
        "user_id": user_id,
        "action_type": action_type,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "description": description,
        "metadata": metadata or {},
    }
    try:
        await db.run(lambda: db.client.from_("company_activity_feed").insert(row).execute())
    except Exception as exc:
        logger.warning("[company_activity] write failed: %s", exc)


def _resolve_name(profile: Optional[Dict]) -> str:
    if not profile:
        return "Unknown"
    full = str(profile.get("full_name") or "").strip()
    if full:
        return full
    first = str(profile.get("first_name") or "").strip()
    last = str(profile.get("last_name") or "").strip()
    return f"{first} {last}".strip() or "Unknown"


def _resolve_email(profile: Optional[Dict]) -> str:
    if not profile:
        return ""
    email = str(profile.get("email") or "").strip()
    if email and email.lower() != "unknown":
        return email
    return str(profile.get("organization_email") or "").strip()


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/plans")
async def list_company_plans(_: ClerkUser = Depends(require_user)):
    """Return all active company plan templates."""
    db = get_db_admin_service()
    def _f():
        return db.client.from_("company_plans").select("*").eq("is_active", True).order("recruiter_seats").execute()
    res = await db.run(_f)
    plans = getattr(res, "data", None) or []
    return ok({"plans": plans if isinstance(plans, list) else []})


@router.get("/search")
async def search_company(
    name: str = Query(..., min_length=1),
    _: ClerkUser = Depends(require_user),
):
    """Search for a company by name (case-insensitive prefix match)."""
    db = get_db_admin_service()
    name_lower = name.strip().lower()
    def _f():
        return (
            db.client.from_("companies")
            .select("id, name, owner_user_id, status, seats_total, seats_used")
            .ilike("name", f"%{name_lower}%")
            .eq("status", "active")
            .limit(10)
            .execute()
        )
    res = await db.run(_f)
    results = getattr(res, "data", None) or []
    return ok({"results": results if isinstance(results, list) else []})


@router.post("")
async def create_company(
    payload: Dict[str, Any],
    request: Request,
    user: ClerkUser = Depends(require_user),
):
    """
    Create a new company. Caller becomes owner and first active member.
    Requires a plan_id from /companies/plans.
    """
    db = get_db_admin_service()
    name = str(payload.get("name") or "").strip()
    plan_id = str(payload.get("plan_id") or "").strip()

    if not name:
        return api_error(message="Company name is required")
    if not plan_id:
        return api_error(message="plan_id is required")

    # Load plan
    def _load_plan():
        return db.client.from_("company_plans").select("*").eq("id", plan_id).eq("is_active", True).maybe_single().execute()
    plan_res = await db.run(_load_plan)
    plan = getattr(plan_res, "data", None)
    if not isinstance(plan, dict):
        return api_error(message="Invalid or inactive plan")

    now = datetime.now(timezone.utc).isoformat()
    seats = plan["recruiter_seats"]
    credits_per_seat = plan["credits_per_seat"]

    # Create company
    company_row = {
        "name": name,
        "owner_user_id": user.id,
        "plan_id": plan_id,
        "seats_total": seats,
        "seats_used": 1,  # owner takes first seat
        "status": "active",
        "domain": str(payload.get("domain") or "").strip() or None,
        "logo_url": str(payload.get("logo_url") or "").strip() or None,
        "metadata": payload.get("metadata") or {},
    }
    def _create_company():
        return db.client.from_("companies").insert(company_row).execute()
    company_res = await db.run(_create_company)
    # Fetch the newly created company
    def _fetch_company():
        return db.client.from_("companies").select("*").eq("owner_user_id", user.id).order("created_at", desc=True).limit(1).execute()
    fetch_res = await db.run(_fetch_company)
    company_data_list = getattr(fetch_res, "data", None)
    if not isinstance(company_data_list, list) or not company_data_list:
        return api_error(message="Failed to create company — name may already be taken", status_code=409)
    company = company_data_list[0]
    company_id = company["id"]

    # Add owner as first active member
    owner_member = {
        "company_id": company_id,
        "user_id": user.id,
        "role": "owner",
        "status": "active",
        "credits_allocated": credits_per_seat,
        "joined_at": now,
    }
    await db.run(lambda: db.client.from_("company_members").insert(owner_member).execute())

    # Create credit pool
    await db.run(lambda: db.client.from_("company_credits").insert({
        "company_id": company_id,
        "total_allocated": credits_per_seat * seats,
        "total_consumed": 0,
    }).execute())

    # Subscription history
    await db.run(lambda: db.client.from_("company_subscription_history").insert({
        "company_id": company_id,
        "plan_id": plan_id,
        "action": "purchased",
        "seats_before": 0,
        "seats_after": seats,
        "credits_before": 0,
        "credits_after": credits_per_seat * seats,
        "price_paid_usd": float(payload.get("price_paid_usd") or 0),
        "price_paid_inr": float(payload.get("price_paid_inr") or 0),
        "currency": str(payload.get("currency") or "USD"),
        "activated_by": user.id,
        "notes": "Company created",
    }).execute())

    await write_audit_log(db, actor_id=user.id, action="company.create", actor_role="owner",
                          target_type="company", target_id=company_id, company_id=company_id,
                          after_state=company, request=request)
    await _write_activity(db, company_id=company_id, user_id=user.id,
                          action_type="company_created", description=f"Company {name} created",
                          entity_type="company", entity_id=company_id)
    return ok({"company": company, "plan": plan})


@router.get("/my")
async def get_my_company(user: ClerkUser = Depends(require_user)):
    """Return the company + membership the current user belongs to (if any)."""
    db = get_db_admin_service()
    membership = await _get_active_membership(db, user.id)
    if not membership:
        # Also check if they have a pending request
        def _pending():
            return db.client.from_("company_members").select("*, companies(id, name, status)").eq("user_id", user.id).eq("status", "pending").maybe_single().execute()
        pres = await db.run(_pending)
        pending = getattr(pres, "data", None)
        if isinstance(pending, dict):
            return ok({"membership": pending, "status": "pending"})
        return ok({"membership": None, "status": "none"})

    company = membership.get("companies") or {}
    credits_res = await db.run(lambda: db.client.from_("company_credits").select("*").eq("company_id", company.get("id", "")).maybe_single().execute())
    credits = getattr(credits_res, "data", None) or {}

    return ok({
        "membership": membership,
        "company": company,
        "status": "active",
        "role": membership.get("role"),
        "credits": {
            "allocated": membership.get("credits_allocated", 0),
            "consumed": float(membership.get("credits_consumed", 0)),
            "remaining": max(0, membership.get("credits_allocated", 0) - float(membership.get("credits_consumed", 0))),
        },
        "company_credits": {
            "total_allocated": credits.get("total_allocated", 0),
            "total_consumed": float(credits.get("total_consumed", 0)),
        },
    })


@router.get("/{company_id}")
async def get_company(company_id: str, user: ClerkUser = Depends(require_user)):
    db = get_db_admin_service()
    company = await _get_company(db, company_id)
    if not company:
        return api_error(message="Company not found", status_code=404)
    member = await _get_member(db, company_id, user.id)
    if not member and company["owner_user_id"] != user.id:
        return api_error(message="Access denied", status_code=403)
    plan = None
    if company.get("plan_id"):
        def _lp():
            return db.client.from_("company_plans").select("*").eq("id", company["plan_id"]).maybe_single().execute()
        plan_res = await db.run(_lp)
        plan = getattr(plan_res, "data", None)
    return ok({"company": company, "plan": plan})


@router.post("/join-request")
async def join_request(
    payload: Dict[str, Any],
    request: Request,
    user: ClerkUser = Depends(require_user),
):
    """
    Recruiter submits a join request to a company.
    Sends an email to the company owner with approve/reject token links.
    """
    db = get_db_admin_service()
    company_id = str(payload.get("company_id") or "").strip()
    if not company_id:
        return api_error(message="company_id is required")

    company = await _get_company(db, company_id)
    if not company:
        return api_error(message="Company not found", status_code=404)
    if company["status"] != "active":
        return api_error(message="This company is not accepting members")
    if company["seats_used"] >= company["seats_total"]:
        return api_error(message="This company has no available seats")

    # Check if already a member or pending
    existing = await _get_member(db, company_id, user.id)
    if existing:
        if existing["status"] == "active":
            return api_error(message="You are already a member of this company")
        if existing["status"] == "pending":
            return api_error(message="You already have a pending request for this company")

    now = datetime.now(timezone.utc).isoformat()

    # Insert pending membership (no .select() chain — not supported on this postgrest-py version)
    def _insert():
        return db.client.from_("company_members").insert({
            "company_id": company_id,
            "user_id": user.id,
            "role": "recruiter",
            "status": "pending",
        }).execute()
    await db.run(_insert)

    # Fetch the newly inserted member row
    fresh = await _get_member(db, company_id, user.id)
    if not fresh:
        return api_error(message="Failed to submit join request", status_code=500)
    member = fresh
    member_id = member["id"]

    # Load profiles
    recruiter_profile = await _get_profile(db, user.id)
    owner_profile = await _get_profile(db, company["owner_user_id"])

    recruiter_name = _resolve_name(recruiter_profile)
    recruiter_email = _resolve_email(recruiter_profile)
    owner_name = _resolve_name(owner_profile)
    owner_email = _resolve_email(owner_profile)

    # Build token URLs
    settings = get_settings()
    secret = _get_token_secret()
    base_url = str(settings.frontend_url).rstrip("/")

    approve_token = _make_action_token(company_id, member_id, "approve", secret)
    reject_token = _make_action_token(company_id, member_id, "reject", secret)
    approve_url = f"{base_url}/company/action?token={approve_token}"
    reject_url = f"{base_url}/company/action?token={reject_token}"
    dashboard_url = f"{base_url}/company/dashboard"

    # Send email to owner
    if owner_email:
        try:
            logger.info("[join_request] sending join request email to owner %s", owner_email)
            subject, html, text = join_request_email(
                owner_name=owner_name,
                recruiter_name=recruiter_name,
                recruiter_email=recruiter_email,
                company_name=company["name"],
                approve_url=approve_url,
                reject_url=reject_url,
                dashboard_url=dashboard_url,
            )
            email_svc = EmailService()
            await email_svc.send_email(owner_email, subject, html, text=text)
            logger.info("[join_request] join request email sent to owner %s", owner_email)
        except Exception as exc:
            logger.error("[join_request] email failed to owner %s: %s", owner_email, exc)
    else:
        logger.warning("[join_request] owner email is empty for company %s, owner_user_id=%s", company_id, company['owner_user_id'])

    await write_audit_log(db, actor_id=user.id, action="member.request", actor_role="recruiter",
                          target_type="member", target_id=member_id, company_id=company_id,
                          after_state={"recruiter_user_id": user.id, "company_id": company_id},
                          request=request)

    return ok({"status": "pending", "member_id": member_id, "company_name": company["name"]})


@router.get("/{company_id}/join-requests")
async def list_join_requests(company_id: str, user: ClerkUser = Depends(require_user)):
    """Owner: list pending join requests."""
    db = get_db_admin_service()
    company = await _get_company(db, company_id)
    if not company:
        return api_error(message="Company not found", status_code=404)
    if company["owner_user_id"] != user.id:
        return api_error(message="Only the company owner can view join requests", status_code=403)

    def _f():
        return db.client.from_("company_members").select("*").eq("company_id", company_id).eq("status", "pending").order("created_at").execute()
    res = await db.run(_f)
    rows = getattr(res, "data", None) or []
    if not isinstance(rows, list):
        rows = []

    # Enrich with profiles
    enriched = []
    for row in rows:
        profile = await _get_profile(db, row["user_id"])
        enriched.append({
            **row,
            "recruiter_name": _resolve_name(profile),
            "recruiter_email": _resolve_email(profile),
        })
    return ok({"join_requests": enriched, "total": len(enriched)})


async def _perform_approval_action(
    db, *, company_id: str, member_id: str, action: str,
    actor_id: str, request: Optional[Request] = None
) -> Dict[str, Any]:
    """Core logic for approving or rejecting a join request."""
    company = await _get_company(db, company_id)
    if not company:
        return {"ok": False, "error": "Company not found"}

    member = await _get_member_by_id(db, member_id)
    if not member or member.get("company_id") != company_id:
        return {"ok": False, "error": "Join request not found"}
    if member.get("status") != "pending":
        return {"ok": False, "error": f"Request already {member.get('status', 'processed')}"}

    now = datetime.now(timezone.utc).isoformat()
    settings = get_settings()
    base_url = str(settings.frontend_url).rstrip("/")

    recruiter_profile = await _get_profile(db, member["user_id"])
    recruiter_name = _resolve_name(recruiter_profile)
    recruiter_email = _resolve_email(recruiter_profile)

    if action == "approve":
        if company["seats_used"] >= company["seats_total"]:
            return {"ok": False, "error": "No seats available"}

        # Load plan for credits per seat
        plan = None
        if company.get("plan_id"):
            plan_res = await db.run(lambda: db.client.from_("company_plans").select("*").eq("id", company["plan_id"]).maybe_single().execute())
            plan = getattr(plan_res, "data", None)
        credits_per_seat = int((plan or {}).get("credits_per_seat") or 100)

        # Update member
        def _approve():
            return db.client.from_("company_members").update({
                "status": "active",
                "credits_allocated": credits_per_seat,
                "joined_at": now,
                "updated_at": now,
            }).eq("id", member_id).execute()
        await db.run(_approve)

        # Increment seats_used
        await db.run(lambda: db.client.from_("companies").update({
            "seats_used": company["seats_used"] + 1,
            "updated_at": now,
        }).eq("id", company_id).execute())

        # Update company credits pool
        await db.run(lambda: db.client.from_("company_credits").update({
            "total_allocated": company["seats_total"] * credits_per_seat,
            "updated_at": now,
        }).eq("company_id", company_id).execute())

        # Subscription history
        await db.run(lambda: db.client.from_("company_subscription_history").insert({
            "company_id": company_id,
            "plan_id": company.get("plan_id"),
            "action": "seat_assigned",
            "seats_before": company["seats_used"],
            "seats_after": company["seats_used"] + 1,
            "credits_before": 0,
            "credits_after": credits_per_seat,
            "activated_by": actor_id,
            "notes": f"Seat approved for {member['user_id']}",
        }).execute())

        await _write_activity(db, company_id=company_id, user_id=member["user_id"],
                              action_type="seat_approved",
                              description=f"{recruiter_name} joined the company",
                              entity_type="member", entity_id=member_id)
        await write_audit_log(db, actor_id=actor_id, action="member.approve", actor_role="owner",
                              target_type="member", target_id=member_id, company_id=company_id,
                              before_state={"status": "pending"},
                              after_state={"status": "active", "credits_allocated": credits_per_seat},
                              request=request)

        # Send approval email to recruiter
        if recruiter_email:
            try:
                subject, html, text = approval_confirmation_email(
                    recruiter_name=recruiter_name,
                    company_name=company["name"],
                    credits_allocated=credits_per_seat,
                    seat_number=company["seats_used"] + 1,
                    dashboard_url=f"{base_url}/dashboard",
                )
                email_svc = EmailService()
                await email_svc.send_email(recruiter_email, subject, html, text=text)
                logger.info("[approve] approval email sent to recruiter %s", recruiter_email)
            except Exception as exc:
                logger.error("[approve] email to recruiter failed: %s", exc)

        # ── Mark recruiter's profile as onboarding complete so they reach dashboard ──
        try:
            def _unlock_profile():
                return db.client.from_("profiles").update({
                    "onboarding_completed": True,
                    "company_name": company["name"],
                }).eq("user_id", member["user_id"]).execute()
            await db.run(_unlock_profile)
            logger.info("[approve] recruiter profile unlocked for user %s", member["user_id"])
        except Exception as exc:
            logger.error("[approve] failed to update recruiter profile: %s", exc)

        return {"ok": True, "action": "approved", "company_name": company["name"],
                "credits_allocated": credits_per_seat, "recruiter_name": recruiter_name}

    else:  # reject
        await db.run(lambda: db.client.from_("company_members").update({
            "status": "rejected",
            "updated_at": now,
        }).eq("id", member_id).execute())

        await write_audit_log(db, actor_id=actor_id, action="member.reject", actor_role="owner",
                              target_type="member", target_id=member_id, company_id=company_id,
                              before_state={"status": "pending"},
                              after_state={"status": "rejected"},
                              request=request)
        await _write_activity(db, company_id=company_id, user_id=member["user_id"],
                              action_type="seat_rejected",
                              description=f"{recruiter_name}'s request was rejected",
                              entity_type="member", entity_id=member_id)

        if recruiter_email:
            try:
                subject, html, text = rejection_email(
                    recruiter_name=recruiter_name,
                    company_name=company["name"],
                    dashboard_url=f"{base_url}/dashboard",
                )
                email_svc = EmailService()
                await email_svc.send_email(recruiter_email, subject, html, text=text)
            except Exception as exc:
                logger.error("[reject] email to recruiter failed: %s", exc)

        return {"ok": True, "action": "rejected", "company_name": company["name"],
                "recruiter_name": recruiter_name}


@router.post("/{company_id}/join-requests/{member_id}/approve")
async def approve_join_request(
    company_id: str, member_id: str,
    request: Request,
    user: ClerkUser = Depends(require_user),
):
    """Owner approves a join request via the dashboard."""
    db = get_db_admin_service()
    company = await _get_company(db, company_id)
    if not company:
        return api_error(message="Company not found", status_code=404)
    if company["owner_user_id"] != user.id:
        return api_error(message="Only the company owner can approve requests", status_code=403)
    result = await _perform_approval_action(db, company_id=company_id, member_id=member_id,
                                            action="approve", actor_id=user.id, request=request)
    if not result.get("ok"):
        return api_error(message=result.get("error", "Action failed"))
    return ok(result)


@router.post("/{company_id}/join-requests/{member_id}/reject")
async def reject_join_request(
    company_id: str, member_id: str,
    request: Request,
    user: ClerkUser = Depends(require_user),
):
    """Owner rejects a join request via the dashboard."""
    db = get_db_admin_service()
    company = await _get_company(db, company_id)
    if not company:
        return api_error(message="Company not found", status_code=404)
    if company["owner_user_id"] != user.id:
        return api_error(message="Only the company owner can reject requests", status_code=403)
    result = await _perform_approval_action(db, company_id=company_id, member_id=member_id,
                                            action="reject", actor_id=user.id, request=request)
    if not result.get("ok"):
        return api_error(message=result.get("error", "Action failed"))
    return ok(result)


@router.get("/{company_id}/action")
async def email_action_handler(
    company_id: str,
    token: str = Query(...),
    request: Request = None,
):
    """
    Stateless email approve/reject handler.
    Owner clicks link in email → this validates HMAC token → performs action.
    No login required.
    """
    db = get_db_admin_service()
    secret = _get_token_secret()
    parsed = _verify_action_token(token, secret)
    if not parsed:
        return api_error(message="Invalid or expired token. Please use the dashboard to manage requests.", status_code=400)

    if parsed["company_id"] != company_id:
        return api_error(message="Token mismatch", status_code=400)

    action = parsed["action"]
    member_id = parsed["member_id"]
    company = await _get_company(db, company_id)
    if not company:
        return api_error(message="Company not found", status_code=404)

    result = await _perform_approval_action(db, company_id=company_id, member_id=member_id,
                                            action=action, actor_id=company["owner_user_id"],
                                            request=request)
    if not result.get("ok"):
        return api_error(message=result.get("error", "Action failed"))
    return ok({**result, "redirect": "/company/dashboard"})


@router.post("/{company_id}/invite")
async def invite_recruiter(
    company_id: str,
    payload: Dict[str, Any],
    request: Request,
    user: ClerkUser = Depends(require_user),
):
    """Owner: Send an email invitation to a recruiter."""
    db = get_db_admin_service()
    company = await _get_company(db, company_id)
    if not company:
        return api_error(message="Company not found", status_code=404)
    if company["owner_user_id"] != user.id:
        return api_error(message="Access denied", status_code=403)
    
    email = str(payload.get("email") or "").strip()
    if not email:
        return api_error(message="Email is required")

    # Check if the user is already a member
    def _find_profile():
        return db.client.from_("profiles").select("user_id").eq("email", email).maybe_single().execute()
    try:
        prof_res = await db.run(_find_profile)
        prof_data = getattr(prof_res, "data", None)
        if prof_data and prof_data.get("user_id"):
            target_user_id = prof_data["user_id"]
            def _check_membership():
                return db.client.from_("company_members").select("id").eq("company_id", company_id).eq("user_id", target_user_id).eq("status", "active").maybe_single().execute()
            mem_res = await db.run(_check_membership)
            if getattr(mem_res, "data", None):
                return api_error(message="Recruiter Already Exists", status_code=400)
    except Exception as e:
        logger.warning(f"Error checking existing membership: {e}")

    settings = get_settings()
    app_url = str(settings.frontend_url).rstrip("/")
    signup_url = f"{app_url}/onboarding?company={urlencode({'name': company['name']})}"

    subject, html, text = invite_recruiter_email(
        company_name=company["name"],
        signup_url=signup_url,
    )
    
    try:
        email_service = EmailService()
        await email_service.send_email(email, subject, html, text)
        await _write_activity(db, company_id=company_id, user_id=user.id,
                              action_type="recruiter_invited",
                              description=f"Invited {email} to join the company",
                              metadata={"invited_email": email})
        await write_audit_log(db, actor_id=user.id, action="member.invite", actor_role="owner",
                              company_id=company_id, target_id=email, target_type="email_invite",
                              after_state={"email": email}, request=request)
    except Exception as exc:
        logger.error(f"Failed to send invite email to {email}: {exc}")
        return api_error(message="Failed to send email invite", status_code=500)

    return ok({"action": "invited", "email": email})


@router.get("/{company_id}/members")
async def list_members(company_id: str, user: ClerkUser = Depends(require_user)):
    """Owner: list all members with performance stats."""
    db = get_db_admin_service()
    company = await _get_company(db, company_id)
    if not company:
        return api_error(message="Company not found", status_code=404)
    if company["owner_user_id"] != user.id:
        return api_error(message="Access denied", status_code=403)

    def _f():
        return db.client.from_("company_members").select("*").eq("company_id", company_id).neq("status", "removed").order("joined_at").execute()
    res = await db.run(_f)
    members = getattr(res, "data", None) or []
    if not isinstance(members, list):
        members = []

    enriched = []
    for m in members:
        profile = await _get_profile(db, m["user_id"])
        enriched.append({
            **m,
            "name": _resolve_name(profile),
            "email": _resolve_email(profile),
            "credits_remaining": max(0, m.get("credits_allocated", 0) - float(m.get("credits_consumed", 0))),
        })
    return ok({"members": enriched, "total": len(enriched)})


@router.get("/{company_id}/members/{member_user_id}/stats")
async def get_member_stats(company_id: str, member_user_id: str, user: ClerkUser = Depends(require_user)):
    """Owner: deep stats for one recruiter."""
    db = get_db_admin_service()
    company = await _get_company(db, company_id)
    if not company:
        return api_error(message="Company not found", status_code=404)
    if company["owner_user_id"] != user.id:
        return api_error(message="Access denied", status_code=403)
    member = await _get_member(db, company_id, member_user_id)
    if not member:
        return api_error(message="Member not found", status_code=404)
    profile = await _get_profile(db, member_user_id)

    # Recent activity for this user
    def _activity():
        return db.client.from_("company_activity_feed").select("*").eq("company_id", company_id).eq("user_id", member_user_id).order("created_at", desc=True).limit(20).execute()
    act_res = await db.run(_activity)
    activity = getattr(act_res, "data", None) or []

    return ok({
        "member": {
            **member,
            "name": _resolve_name(profile),
            "email": _resolve_email(profile),
            "credits_remaining": max(0, member.get("credits_allocated", 0) - float(member.get("credits_consumed", 0))),
        },
        "recent_activity": activity if isinstance(activity, list) else [],
    })


@router.delete("/{company_id}/members/{member_user_id}")
async def remove_member(
    company_id: str, member_user_id: str,
    request: Request,
    user: ClerkUser = Depends(require_user),
):
    """Owner removes a member and reclaims their seat."""
    db = get_db_admin_service()
    company = await _get_company(db, company_id)
    if not company:
        return api_error(message="Company not found", status_code=404)
    if company["owner_user_id"] != user.id:
        return api_error(message="Only the owner can remove members", status_code=403)
    if member_user_id == user.id:
        return api_error(message="Cannot remove yourself as owner")

    member = await _get_member(db, company_id, member_user_id)
    if not member or member.get("status") not in ("active", "pending"):
        return api_error(message="Member not found or already removed", status_code=404)

    now = datetime.now(timezone.utc).isoformat()
    await db.run(lambda: db.client.from_("company_members").update({
        "status": "removed",
        "removed_at": now,
        "updated_at": now,
    }).eq("id", member["id"]).execute())

    if member.get("status") == "active":
        new_seats_used = max(0, company["seats_used"] - 1)
        await db.run(lambda: db.client.from_("companies").update({
            "seats_used": new_seats_used,
            "updated_at": now,
        }).eq("id", company_id).execute())

    profile = await _get_profile(db, member_user_id)
    name = _resolve_name(profile)
    await _write_activity(db, company_id=company_id, user_id=user.id,
                          action_type="member_removed",
                          description=f"{name} was removed from the company",
                          entity_type="member", entity_id=member["id"])
    await write_audit_log(db, actor_id=user.id, action="member.remove", actor_role="owner",
                          target_type="member", target_id=member["id"], company_id=company_id,
                          before_state={"status": member["status"]},
                          after_state={"status": "removed"},
                          request=request)
    return ok({"ok": True, "removed_user_id": member_user_id})


@router.get("/{company_id}/credits")
async def get_credits(company_id: str, user: ClerkUser = Depends(require_user)):
    db = get_db_admin_service()
    company = await _get_company(db, company_id)
    if not company:
        return api_error(message="Company not found", status_code=404)
    if company["owner_user_id"] != user.id:
        return api_error(message="Access denied", status_code=403)
    def _f():
        return db.client.from_("company_credits").select("*").eq("company_id", company_id).maybe_single().execute()
    res = await db.run(_f)
    credits = getattr(res, "data", None) or {}
    total_allocated = int(credits.get("total_allocated") or 0)
    total_consumed = float(credits.get("total_consumed") or 0)
    return ok({
        "company_id": company_id,
        "total_allocated": total_allocated,
        "total_consumed": total_consumed,
        "total_remaining": max(0, total_allocated - total_consumed),
    })


@router.get("/{company_id}/activity-feed")
async def get_activity_feed(
    company_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: ClerkUser = Depends(require_user),
):
    db = get_db_admin_service()
    company = await _get_company(db, company_id)
    if not company:
        return api_error(message="Company not found", status_code=404)

    is_owner = company["owner_user_id"] == user.id

    # Non-owners must be an active member of this company
    if not is_owner:
        member = await _get_member(db, company_id, user.id)
        if not member or member.get("status") != "active":
            return api_error(message="Access denied", status_code=403)

    def _f():
        q = (
            db.client.from_("company_activity_feed")
            .select("*")
            .eq("company_id", company_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
        )
        # Recruiters only see their own activity
        if not is_owner:
            q = q.eq("user_id", user.id)
        return q.execute()

    res = await db.run(_f)
    feed = getattr(res, "data", None) or []

    # Enrich with recruiter names
    name_cache: Dict[str, str] = {}
    enriched = []
    for item in (feed if isinstance(feed, list) else []):
        uid = item.get("user_id", "")
        if uid not in name_cache:
            profile = await _get_profile(db, uid)
            name_cache[uid] = _resolve_name(profile)
        enriched.append({**item, "recruiter_name": name_cache[uid]})
    return ok({"feed": enriched, "total": len(enriched), "offset": offset, "limit": limit})


@router.get("/{company_id}/audit-logs")
async def get_audit_logs(
    company_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: ClerkUser = Depends(require_user),
):
    db = get_db_admin_service()
    company = await _get_company(db, company_id)
    if not company:
        return api_error(message="Company not found", status_code=404)
    if company["owner_user_id"] != user.id:
        return api_error(message="Access denied", status_code=403)
    def _f():
        return (
            db.client.from_("audit_logs")
            .select("*")
            .eq("company_id", company_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
    res = await db.run(_f)
    logs = getattr(res, "data", None) or []
    return ok({"logs": logs if isinstance(logs, list) else [], "offset": offset, "limit": limit})


@router.get("/{company_id}/subscription-history")
async def get_subscription_history(company_id: str, user: ClerkUser = Depends(require_user)):
    db = get_db_admin_service()
    company = await _get_company(db, company_id)
    if not company:
        return api_error(message="Company not found", status_code=404)
    if company["owner_user_id"] != user.id:
        return api_error(message="Access denied", status_code=403)
    def _f():
        return db.client.from_("company_subscription_history").select("*, company_plans(name, recruiter_seats, credits_per_seat)").eq("company_id", company_id).order("created_at", desc=True).execute()
    res = await db.run(_f)
    history = getattr(res, "data", None) or []
    return ok({"history": history if isinstance(history, list) else []})


@router.get("/{company_id}/analytics")
async def get_analytics(company_id: str, user: ClerkUser = Depends(require_user)):
    """Company-wide aggregated analytics for the owner dashboard."""
    db = get_db_admin_service()
    company = await _get_company(db, company_id)
    if not company:
        return api_error(message="Company not found", status_code=404)
    if company["owner_user_id"] != user.id:
        return api_error(message="Access denied", status_code=403)

    # Active members for per-recruiter breakdown
    def _members():
        return db.client.from_("company_members").select("*").eq("company_id", company_id).eq("status", "active").execute()
    m_res = await db.run(_members)
    members: List[Dict] = getattr(m_res, "data", None) or []
    if not isinstance(members, list):
        members = []

    total_candidates = sum(int(m.get("candidates_added") or 0) for m in members)
    total_assessments = sum(int(m.get("assessments_sent") or 0) for m in members)
    total_interviews = sum(int(m.get("interviews_sent") or 0) for m in members)
    total_hires = sum(int(m.get("hires") or 0) for m in members)
    total_jobs = sum(int(m.get("jobs_posted") or 0) for m in members)
    total_consumed = sum(float(m.get("credits_consumed") or 0) for m in members)

    # Per-recruiter breakdown
    per_recruiter = []
    for m in members:
        profile = await _get_profile(db, m["user_id"])
        per_recruiter.append({
            "user_id": m["user_id"],
            "name": _resolve_name(profile),
            "credits_allocated": m.get("credits_allocated", 0),
            "credits_consumed": float(m.get("credits_consumed", 0)),
            "credits_remaining": max(0, m.get("credits_allocated", 0) - float(m.get("credits_consumed", 0))),
            "candidates_added": m.get("candidates_added", 0),
            "assessments_sent": m.get("assessments_sent", 0),
            "interviews_sent": m.get("interviews_sent", 0),
            "hires": m.get("hires", 0),
            "jobs_posted": m.get("jobs_posted", 0),
        })

    # Recent activity (last 30 days summary by action type)
    def _activity_summary():
        thirty_days_ago = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()
        return (
            db.client.from_("company_activity_feed")
            .select("action_type, created_at")
            .eq("company_id", company_id)
            .gte("created_at", thirty_days_ago[:10])  # date prefix
            .order("created_at", desc=True)
            .limit(500)
            .execute()
        )
    act_res = await db.run(_activity_summary)
    activity_rows = getattr(act_res, "data", None) or []

    # Aggregate by day for chart
    daily: Dict[str, int] = {}
    for row in (activity_rows if isinstance(activity_rows, list) else []):
        day = str(row.get("created_at", ""))[:10]
        if day:
            daily[day] = daily.get(day, 0) + 1

    return ok({
        "summary": {
            "total_candidates": total_candidates,
            "total_assessments": total_assessments,
            "total_interviews": total_interviews,
            "total_hires": total_hires,
            "total_jobs": total_jobs,
            "total_credits_consumed": total_consumed,
            "active_members": len(members),
            "seats_used": company.get("seats_used", 0),
            "seats_total": company.get("seats_total", 0),
        },
        "per_recruiter": per_recruiter,
        "daily_activity": [{"date": d, "count": c} for d, c in sorted(daily.items())],
        "funnel": {
            "jobs_posted": total_jobs,
            "candidates_added": total_candidates,
            "assessments_sent": total_assessments,
            "interviews_sent": total_interviews,
            "hires": total_hires,
        },
    })


@router.patch("/{company_id}")
async def update_company(
    company_id: str,
    payload: Dict[str, Any],
    request: Request,
    user: ClerkUser = Depends(require_user),
):
    """Owner updates company metadata."""
    db = get_db_admin_service()
    company = await _get_company(db, company_id)
    if not company:
        return api_error(message="Company not found", status_code=404)
    if company["owner_user_id"] != user.id:
        return api_error(message="Only the owner can update company details", status_code=403)

    allowed = {"name", "domain", "logo_url", "metadata"}
    update = {k: v for k, v in payload.items() if k in allowed and v is not None}
    if not update:
        return api_error(message="Nothing to update")
    update["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.run(lambda: db.client.from_("companies").update(update).eq("id", company_id).execute())
    await write_audit_log(db, actor_id=user.id, action="company.update", actor_role="owner",
                          target_type="company", target_id=company_id, company_id=company_id,
                          before_state={k: company.get(k) for k in update},
                          after_state=update, request=request)
    updated = await _get_company(db, company_id)
    return ok({"company": updated})
