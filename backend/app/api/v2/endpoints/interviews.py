from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Query

from app.api.v2.deps import require_user
from app.auth.clerk import ClerkUser
from app.services.db.supabase_service import get_db_admin_service
from app.utils.responses import api_error, ok

router = APIRouter(prefix="/interviews")


@router.get("")
async def list_interviews(
    status: Optional[str] = Query(None),
    candidate_id: Optional[str] = Query(None),
    job_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    user: ClerkUser = Depends(require_user),
):
    """Node-compatible: GET /api/interviews"""
    db = get_db_admin_service()

    def _fetch():
        q = db.client.from_("interview_sessions").select("*")
        if status:
            q = q.eq("status", status)
        if candidate_id:
            q = q.eq("candidate_id", candidate_id)
        if job_id:
            q = q.eq("job_id", job_id)
        return q.order("created_at", desc=True).limit(limit).execute()

    res = await db.run(_fetch)
    data = getattr(res, "data", None) or []
    return ok(data)


@router.post("")
async def create_interview(
    payload: Dict[str, Any],
    user: ClerkUser = Depends(require_user),
):
    """Node-compatible: POST /api/interviews"""
    candidate_id = payload.get("candidate_id")
    job_id = payload.get("job_id")
    if not candidate_id or not job_id:
        return api_error(message="candidate_id and job_id are required", status_code=400)

    db = get_db_admin_service()
    session_data = {
        "candidate_id": candidate_id,
        "job_id": job_id,
        "screening_id": payload.get("screening_id"),
        "scheduled_at": payload.get("scheduled_at"),
        "status": "pending",
        "question_seed": f"{candidate_id}-{job_id}-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        "proctoring_data": {
            "tab_switches": 0,
            "copy_paste_count": 0,
            "fullscreen_exits": 0,
            "warnings": [],
        },
    }

    def _insert():
        return db.client.from_("interview_sessions").insert(session_data).execute()

    res = await db.run(_insert)
    data = getattr(res, "data", None)
    created = data[0] if isinstance(data, list) and data else None
    if not isinstance(created, dict):
        return api_error(message="Failed to create interview session", status_code=500)
    return ok(created)


@router.get("/{interview_id}")
async def get_interview(
    interview_id: str,
    user: ClerkUser = Depends(require_user),
):
    """Node-compatible: GET /api/interviews/:id"""
    db = get_db_admin_service()

    def _fetch():
        return db.client.from_("interview_sessions").select("*").eq("id", interview_id).single().execute()

    res = await db.run(_fetch)
    data = getattr(res, "data", None)
    if not isinstance(data, dict):
        return api_error(message="Interview session not found", status_code=404)
    return ok(data)


@router.post("/{interview_id}/start")
async def start_interview(
    interview_id: str,
    user: ClerkUser = Depends(require_user),
):
    """Node-compatible: POST /api/interviews/:id/start"""
    db = get_db_admin_service()
    now = datetime.now(timezone.utc).isoformat()

    def _update():
        return (
            db.client.from_("interview_sessions")
            .update({"status": "in_progress", "started_at": now, "updated_at": now})
            .eq("id", interview_id)
            .execute()
        )

    up_res = await db.run(_update)
    if getattr(up_res, "error", None):
        return api_error(message="Interview session not found", status_code=404)

    def _fetch():
        return db.client.from_("interview_sessions").select("*").eq("id", interview_id).single().execute()

    res = await db.run(_fetch)
    data = getattr(res, "data", None)
    if not isinstance(data, dict):
        return api_error(message="Interview session not found", status_code=404)
    return ok(data)


@router.get("/{interview_id}/questions")
async def get_interview_questions(
    interview_id: str,
    user: ClerkUser = Depends(require_user),
):
    """Node-compatible: GET /api/interviews/:id/questions"""
    db = get_db_admin_service()

    def _fetch():
        return (
            db.client.from_("interview_questions")
            .select("*")
            .eq("session_id", interview_id)
            .order("order_index")
            .execute()
        )

    res = await db.run(_fetch)
    data = getattr(res, "data", None) or []
    return ok(data)


@router.post("/{interview_id}/responses")
async def submit_response(
    interview_id: str,
    payload: Dict[str, Any],
    user: ClerkUser = Depends(require_user),
):
    """Node-compatible: POST /api/interviews/:id/responses"""
    question_id = payload.get("question_id")
    if not question_id:
        return api_error(message="question_id is required", status_code=400)

    db = get_db_admin_service()
    now = datetime.now(timezone.utc).isoformat()
    row = {
        "session_id": interview_id,
        "question_id": question_id,
        "response_text": payload.get("response_text"),
        "response_code": payload.get("response_code"),
        "time_taken_seconds": payload.get("time_taken_seconds"),
        "submitted_at": now,
    }

    def _insert():
        return db.client.from_("candidate_responses").insert(row).execute()

    res = await db.run(_insert)
    data = getattr(res, "data", None)
    created = data[0] if isinstance(data, list) and data else None
    if not isinstance(created, dict):
        return api_error(message="Failed to submit response", status_code=500)
    return ok(created)


@router.get("/{interview_id}/practicals")
async def get_practicals(
    interview_id: str,
    user: ClerkUser = Depends(require_user),
):
    """Node-compatible: GET /api/interviews/:id/practicals"""
    db = get_db_admin_service()

    def _fetch():
        return (
            db.client.from_("practical_assessments")
            .select("*")
            .eq("session_id", interview_id)
            .order("order_index")
            .execute()
        )

    res = await db.run(_fetch)
    data = getattr(res, "data", None) or []
    return ok(data)


@router.post("/{interview_id}/practicals/{assessment_id}/submit")
async def submit_practical(
    interview_id: str,
    assessment_id: str,
    payload: Dict[str, Any],
    user: ClerkUser = Depends(require_user),
):
    """Node-compatible: POST /api/interviews/:id/practicals/:aid/submit"""
    db = get_db_admin_service()
    now = datetime.now(timezone.utc).isoformat()
    row = {
        "session_id": interview_id,
        "assessment_id": assessment_id,
        "submitted_code": payload.get("submitted_code"),
        "submitted_answer": payload.get("submitted_answer"),
        "submitted_at": now,
    }

    def _insert():
        return db.client.from_("practical_submissions").insert(row).execute()

    res = await db.run(_insert)
    data = getattr(res, "data", None)
    created = data[0] if isinstance(data, list) and data else None
    if not isinstance(created, dict):
        return api_error(message="Failed to submit practical", status_code=500)
    return ok(created)


@router.post("/{interview_id}/proctoring")
async def update_proctoring(
    interview_id: str,
    payload: Dict[str, Any],
    user: ClerkUser = Depends(require_user),
):
    """Node-compatible: POST /api/interviews/:id/proctoring"""
    db = get_db_admin_service()
    now = datetime.now(timezone.utc).isoformat()

    def _update():
        return (
            db.client.from_("interview_sessions")
            .update({"proctoring_data": payload, "updated_at": now})
            .eq("id", interview_id)
            .execute()
        )

    await db.run(_update)
    return ok({"success": True})


@router.post("/{interview_id}/complete")
async def complete_interview(
    interview_id: str,
    user: ClerkUser = Depends(require_user),
):
    """Node-compatible: POST /api/interviews/:id/complete"""
    db = get_db_admin_service()
    now = datetime.now(timezone.utc).isoformat()

    def _update():
        return (
            db.client.from_("interview_sessions")
            .update({"status": "completed", "completed_at": now, "updated_at": now})
            .eq("id", interview_id)
            .execute()
        )

    up_res = await db.run(_update)
    data = getattr(up_res, "data", None)

    # Try to fetch evaluation
    def _fetch_eval():
        return (
            db.client.from_("interview_evaluations")
            .select("*")
            .eq("session_id", interview_id)
            .maybe_single()
            .execute()
        )

    eval_res = await db.run(_fetch_eval)
    evaluation = getattr(eval_res, "data", None)

    if isinstance(evaluation, dict):
        return ok(evaluation)

    def _fetch_session():
        return db.client.from_("interview_sessions").select("*").eq("id", interview_id).single().execute()

    sess_res = await db.run(_fetch_session)
    session = getattr(sess_res, "data", None)
    return ok(session or data)


@router.get("/{interview_id}/evaluation")
async def get_evaluation(
    interview_id: str,
    user: ClerkUser = Depends(require_user),
):
    """Node-compatible: GET /api/interviews/:id/evaluation"""
    db = get_db_admin_service()

    def _fetch():
        return (
            db.client.from_("interview_evaluations")
            .select("*")
            .eq("session_id", interview_id)
            .maybe_single()
            .execute()
        )

    res = await db.run(_fetch)
    data = getattr(res, "data", None)
    if not isinstance(data, dict):
        return api_error(message="Evaluation not found", status_code=404)
    return ok(data)
