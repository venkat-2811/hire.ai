"""
audit.py — Audit log endpoint (owner and admin access).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.auth.clerk import ClerkUser
from app.auth.dependencies import require_role, require_user
from app.services.db.supabase_service import get_db_admin_service
from app.utils.responses import api_error, ok

router = APIRouter(prefix="/audit")


@router.get("/company/{company_id}")
async def company_audit_log(
    company_id: str,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    user: ClerkUser = Depends(require_user),
):
    """Owner or admin: full audit log for a company."""
    db = get_db_admin_service()

    def _get_company():
        return db.client.from_("companies").select("owner_user_id").eq("id", company_id).maybe_single().execute()

    comp_res = await db.run(_get_company)
    company = getattr(comp_res, "data", None)
    if not isinstance(company, dict):
        return api_error(message="Company not found", status_code=404)

    # Allow access to owner or admin (admin check is via separate route guard in production)
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


@router.get("/recruiter/{user_id}")
async def recruiter_audit_log(
    user_id: str,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _: ClerkUser = Depends(require_role("admin")),
):
    """Admin only: all audit entries by a specific recruiter."""
    db = get_db_admin_service()

    def _f():
        return (
            db.client.from_("audit_logs")
            .select("*")
            .eq("actor_id", user_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )

    res = await db.run(_f)
    logs = getattr(res, "data", None) or []
    return ok({"logs": logs if isinstance(logs, list) else [], "offset": offset, "limit": limit})


@router.get("/admin/all")
async def all_audit_logs(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    action: str = Query(default=""),
    _: ClerkUser = Depends(require_role("admin")),
):
    """Admin only: full platform audit log with optional action filter."""
    db = get_db_admin_service()

    def _f():
        q = db.client.from_("audit_logs").select("*")
        if action:
            q = q.eq("action", action)
        return q.order("created_at", desc=True).range(offset, offset + limit - 1).execute()

    res = await db.run(_f)
    logs = getattr(res, "data", None) or []
    return ok({"logs": logs if isinstance(logs, list) else [], "offset": offset, "limit": limit})
