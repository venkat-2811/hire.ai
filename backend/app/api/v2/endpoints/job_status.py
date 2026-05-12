from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.v2.deps import require_user
from app.auth.clerk import ClerkUser
from app.services.db.supabase_service import get_db_admin_service
from app.utils.responses import api_error, ok

router = APIRouter(prefix="/job-status")


@router.get("/{job_id}")
async def get_job_status(job_id: str, _user: ClerkUser = Depends(require_user)):
    """Node-compatible: GET /api/job-status/:jobId

    Returns:
    { id, type, status, result, error, created_at, updated_at, completed_at }
    """

    db = get_db_admin_service()

    def _fetch():
        return db.client.from_("background_jobs").select("*").eq("id", job_id).maybe_single().execute()

    res = await db.run(_fetch)
    row = getattr(res, "data", None)
    if not isinstance(row, dict):
        return api_error(message="Job not found", status_code=404)

    return ok(
        {
            "id": row.get("id"),
            "type": row.get("type"),
            "status": row.get("status"),
            "result": row.get("result"),
            "error": row.get("error"),
            "created_at": row.get("created_at"),
            "updated_at": row.get("updated_at"),
            "completed_at": row.get("completed_at"),
        }
    )
