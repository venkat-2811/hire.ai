from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, Query

from app.api.v2.deps import require_user
from app.auth.clerk import ClerkUser
from app.services.ai.factory import get_ai
from app.services.db.supabase_service import get_db_admin_service
from app.utils.responses import ok, api_error
from app.services.ats_screening import get_ats_screening_service
from app.models.schemas import ResumeData, JobDescription

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/screening")


@router.post("/run")
async def run_screening(
    payload: dict,
    user: ClerkUser = Depends(require_user),
):
    """Node-compatible: POST /api/screening/run

    Body: { candidate_id, job_id }
    Returns: { success: true, screeningData: <row> }
    """

    candidate_id = payload.get("candidate_id")
    job_id = payload.get("job_id")
    if not candidate_id or not job_id:
        return api_error(message=f"candidate_id ({candidate_id}) and job_id ({job_id}) are required", status_code=400)

    db = get_db_admin_service()

    # Candidate
    candidates = await db.select("candidates", filters={"id": candidate_id}, limit=1)
    candidate = candidates[0] if candidates else None
    if not candidate:
        return api_error(message=f"Candidate not found with ID: {candidate_id}", status_code=404)

    if not candidate.get("resume_parsed_data"):
        return api_error(
            message=f"Resume not parsed for candidate: {candidate_id}. Please ensure the resume is uploaded and processed first.",
            status_code=400,
        )

    # Job (scope to created_by)
    jobs = await db.select("job_descriptions", filters={"id": job_id, "created_by": user.id}, limit=1)
    job = jobs[0] if jobs else None
    if not job:
        return api_error(message="Job not found", status_code=404)

    try:
        screening_service = get_ats_screening_service()
        
        resume_model = ResumeData(**(candidate.get("resume_parsed_data") or {}))
        job_model = JobDescription(
            id=str(job.get("id")),
            title=str(job.get("title")),
            role=str(job.get("role") or "custom"),
            level=job.get("level") or "mid",
            description=str(job.get("description") or ""),
            must_have_skills=job.get("must_have_skills") or [],
            good_to_have_skills=job.get("good_to_have_skills") or [],
            min_experience_years=job.get("min_experience_years") or 0,
        )
        
        result = await screening_service.screen_candidate(resume_model, "", job_model)
    except Exception as e:
        logger.error(f"Failed to screen candidate {candidate_id}: {e}", exc_info=True)
        return api_error(message="Failed to run ATS screening. Please try again.", status_code=502)

    data_to_save = {
        "candidate_id": candidate_id,
        "job_id": job_id,
        "overall_score": result.overall_score,
        "skill_relevance_score": result.skill_relevance_score,
        "experience_score": result.experience_score,
        "education_score": result.education_score,
        "credibility_score": result.credibility_score,
        "shortlisted": result.shortlisted,
        "shortlist_reason": result.shortlist_reason,
        "reason_codes": [rc.model_dump() for rc in result.reason_codes],
        "detailed_analysis": result.detailed_analysis.model_dump() if result.detailed_analysis else {},
    }

    # Upsert-like behavior (match Node)
    existing = await db.select("ats_screenings", filters={"candidate_id": candidate_id, "job_id": job_id}, limit=1)
    if existing:
        updated = await db.update("ats_screenings", data_to_save, filters={"id": existing[0]["id"]})
        saved_row = updated[0] if updated else None
    else:
        inserted = await db.insert("ats_screenings", [data_to_save])
        saved_row = inserted[0] if inserted else None

    if not saved_row:
        return api_error(message="Failed to save screening result", status_code=500)

    return ok({"success": True, "screeningData": saved_row})


@router.get("/candidate/{candidate_id}")
async def get_candidate_screenings(candidate_id: str, _user: ClerkUser = Depends(require_user)):
    """Node-compatible: GET /api/screening/candidate/:candidateId"""

    db = get_db_admin_service()

    def _fetch():
        return (
            db.client.from_("ats_screenings")
            .select("*")
            .eq("candidate_id", candidate_id)
            .order("screened_at", desc=True)
            .execute()
        )

    res = await db.run(_fetch)
    data = getattr(res, "data", None) or []
    return ok(data)


@router.get("/job/{job_id}")
async def get_job_screenings(
    job_id: str,
    shortlisted_only: bool = Query(default=False),
    min_score: int | None = Query(default=None, ge=0, le=100),
    _user: ClerkUser = Depends(require_user),
):
    """Node-compatible: GET /api/screening/job/:jobId"""

    db = get_db_admin_service()

    def _fetch():
        q = db.client.from_("ats_screenings").select("*").eq("job_id", job_id)
        if shortlisted_only:
            q = q.eq("shortlisted", True)
        if min_score is not None:
            q = q.gte("overall_score", int(min_score))
        return q.order("overall_score", desc=True).execute()

    res = await db.run(_fetch)
    data = getattr(res, "data", None) or []
    return ok(data)


@router.get("/{screening_id}")
async def get_screening(screening_id: str, _user: ClerkUser = Depends(require_user)):
    """Node-compatible: GET /api/screening/:id"""

    db = get_db_admin_service()

    def _fetch():
        return db.client.from_("ats_screenings").select("*").eq("id", screening_id).single().execute()

    res = await db.run(_fetch)
    data = getattr(res, "data", None)
    if not isinstance(data, dict):
        return api_error(message="Screening not found", status_code=404)
    return ok(data)
