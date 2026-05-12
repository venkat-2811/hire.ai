from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Query

from app.api.v2.deps import require_user
from app.auth.clerk import ClerkUser
from app.services.ai.factory import get_ai
from app.services.db.supabase_service import get_db_admin_service
from app.utils.responses import ok, api_error

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

    resume_json = json.dumps(candidate.get("resume_parsed_data") or {})[:6000]
    prompt = f"""
Analyze this candidate's resume against the job requirements and provide ATS screening scores.

Job: {job.get('title')} ({job.get('role')}, {job.get('level')})
Required Skills: {', '.join(job.get('must_have_skills') or [])}
Nice-to-have Skills: {', '.join(job.get('good_to_have_skills') or [])}
Min Experience: {job.get('min_experience_years')} years

Candidate Resume JSON:
{resume_json}

Return JSON:
{{
  \"overall_score\": 0-100,
  \"skill_relevance_score\": 0-100,
  \"experience_score\": 0-100,
  \"education_score\": 0-100,
  \"credibility_score\": 0-100,
  \"shortlisted\": true/false,
  \"shortlist_reason\": \"...\",
  \"reason_codes\": [{{\"code\":\"SKILL_MATCH\",\"type\":\"positive\",\"description\":\"...\",\"impact\":10}}]
}}""".strip()

    ai = get_ai()
    try:
        screening_result = await ai.generate_json(prompt, temperature=0.1, max_tokens=1200, timeout_s=20)
    except Exception:
        return api_error(message="Failed to run ATS screening. Please try again.", status_code=502)

    data_to_save = {
        "candidate_id": candidate_id,
        "job_id": job_id,
        "overall_score": screening_result.get("overall_score"),
        "skill_relevance_score": screening_result.get("skill_relevance_score"),
        "experience_score": screening_result.get("experience_score"),
        "education_score": screening_result.get("education_score"),
        "credibility_score": screening_result.get("credibility_score"),
        "shortlisted": bool(screening_result.get("shortlisted")),
        "shortlist_reason": screening_result.get("shortlist_reason"),
        "reason_codes": screening_result.get("reason_codes") or [],
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
