from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.v2.deps import require_user
from app.auth.clerk import ClerkUser
from app.services.db.supabase_service import get_db_admin_service
from app.utils.responses import api_error, ok

router = APIRouter(prefix="/usage")


@router.get("")
async def get_usage(user: ClerkUser = Depends(require_user)):
    """Node-compatible: GET /api/usage

    Returns plan + usage counters from profiles.
    """

    db = get_db_admin_service()

    def _fetch_profile():
        return db.client.from_("profiles").select("*").eq("user_id", user.id).maybe_single().execute()

    res = await db.run(_fetch_profile)
    profile = getattr(res, "data", None)
    if not isinstance(profile, dict):
        return api_error(message="Profile not found", status_code=404)

    plan = str(profile.get("subscription_plan") or "free")
    plan_label = plan[:1].upper() + plan[1:]

    return ok(
        {
            "plan": plan,
            "plan_label": plan_label,
            "usage": {
                "jobs": {
                    "used": int(profile.get("jobs_count") or 0),
                    "limit": 999999,
                    "label": "Job Roles",
                },
                "assessments": {
                    "used": int(profile.get("assessments_count") or 0),
                    "limit": 999999,
                    "label": "Technical Assessments",
                },
                "interviews": {
                    "used": int(profile.get("interviews_count") or 0),
                    "limit": 999999,
                    "label": "Interviews",
                },
            },
        }
    )
