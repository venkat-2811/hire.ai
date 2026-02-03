from fastapi import APIRouter, HTTPException
from typing import List, Optional
from app.models.schemas import (
    ATSScreeningResult, ATSScreeningRequest, ResumeData, JobDescription, APIResponse
)
from app.database import get_supabase_client
from app.services.ats_screening import get_ats_screening_service

router = APIRouter(prefix="/screening", tags=["ATS Screening"])


@router.post("/run", response_model=ATSScreeningResult)
async def run_ats_screening(request: ATSScreeningRequest):
    """
    Run ATS screening for a candidate against a job.
    Returns detailed scoring with explainable AI reason codes.
    """
    supabase = get_supabase_client()
    
    # Get candidate data
    candidate_result = supabase.table("candidates").select("*").eq(
        "id", request.candidate_id
    ).single().execute()
    
    if not candidate_result.data:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    candidate = candidate_result.data
    
    # Check if resume is parsed
    if not candidate.get("resume_parsed_data"):
        raise HTTPException(
            status_code=400, 
            detail="Candidate resume has not been parsed. Please upload and parse resume first."
        )
    
    # Get job data
    job_result = supabase.table("job_descriptions").select("*").eq(
        "id", request.job_id
    ).single().execute()
    
    if not job_result.data:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job_row = job_result.data
    job = JobDescription(
        id=job_row["id"],
        title=job_row["title"],
        role=job_row["role"],
        level=job_row["level"],
        description=job_row["description"],
        must_have_skills=job_row.get("must_have_skills", []),
        good_to_have_skills=job_row.get("good_to_have_skills", []),
        min_experience_years=job_row.get("min_experience_years", 0),
        is_active=job_row.get("is_active", True)
    )
    
    # Parse resume data
    resume_data = ResumeData(**candidate["resume_parsed_data"])
    resume_text = candidate.get("resume_text", "")
    
    # Run ATS screening
    ats_service = get_ats_screening_service()
    result = await ats_service.screen_candidate(resume_data, resume_text, job)
    
    # Update result with IDs
    result.candidate_id = request.candidate_id
    result.job_id = request.job_id
    
    # Save screening result to database
    screening_data = {
        "candidate_id": result.candidate_id,
        "job_id": result.job_id,
        "overall_score": result.overall_score,
        "skill_relevance_score": result.skill_relevance_score,
        "experience_score": result.experience_score,
        "education_score": result.education_score,
        "credibility_score": result.credibility_score,
        "shortlisted": result.shortlisted,
        "shortlist_reason": result.shortlist_reason,
        "reason_codes": [rc.model_dump() for rc in result.reason_codes],
        "detailed_analysis": result.detailed_analysis.model_dump() if result.detailed_analysis else None
    }
    
    # Upsert (update if exists, insert if not)
    existing = supabase.table("ats_screenings").select("id").eq(
        "candidate_id", request.candidate_id
    ).eq("job_id", request.job_id).execute()
    
    if existing.data:
        db_result = supabase.table("ats_screenings").update(screening_data).eq(
            "id", existing.data[0]["id"]
        ).execute()
        result.id = existing.data[0]["id"]
    else:
        db_result = supabase.table("ats_screenings").insert(screening_data).execute()
        if db_result.data:
            result.id = db_result.data[0]["id"]
    
    return result


@router.get("/candidate/{candidate_id}", response_model=List[ATSScreeningResult])
async def get_candidate_screenings(candidate_id: str):
    """Get all ATS screenings for a candidate."""
    supabase = get_supabase_client()
    
    result = supabase.table("ats_screenings").select("*").eq(
        "candidate_id", candidate_id
    ).order("screened_at", desc=True).execute()
    
    screenings = []
    for row in result.data:
        screenings.append(_row_to_screening(row))
    
    return screenings


@router.get("/job/{job_id}", response_model=List[ATSScreeningResult])
async def get_job_screenings(
    job_id: str,
    shortlisted_only: bool = False,
    min_score: Optional[int] = None
):
    """Get all ATS screenings for a job with optional filters."""
    supabase = get_supabase_client()
    
    query = supabase.table("ats_screenings").select("*").eq("job_id", job_id)
    
    if shortlisted_only:
        query = query.eq("shortlisted", True)
    
    if min_score is not None:
        query = query.gte("overall_score", min_score)
    
    result = query.order("overall_score", desc=True).execute()
    
    screenings = []
    for row in result.data:
        screenings.append(_row_to_screening(row))
    
    return screenings


@router.get("/{screening_id}", response_model=ATSScreeningResult)
async def get_screening(screening_id: str):
    """Get a specific ATS screening result."""
    supabase = get_supabase_client()
    
    result = supabase.table("ats_screenings").select("*").eq(
        "id", screening_id
    ).single().execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Screening not found")
    
    return _row_to_screening(result.data)


def _row_to_screening(row: dict) -> ATSScreeningResult:
    """Convert database row to ATSScreeningResult model."""
    from app.models.schemas import ReasonCode, DetailedAnalysis, SkillMatch
    from app.models.enums import ReasonCodeType, SkillRelevance
    
    reason_codes = []
    for rc in row.get("reason_codes", []):
        reason_codes.append(ReasonCode(
            code=rc.get("code", ""),
            type=ReasonCodeType(rc.get("type", "neutral")),
            description=rc.get("description", ""),
            impact=rc.get("impact", 0)
        ))
    
    detailed_analysis = None
    if row.get("detailed_analysis"):
        da = row["detailed_analysis"]
        skill_matches = []
        for sm in da.get("skill_match", []):
            skill_matches.append(SkillMatch(
                skill=sm.get("skill", ""),
                found=sm.get("found", False),
                relevance=SkillRelevance(sm.get("relevance", "good_to_have")),
                evidence=sm.get("evidence"),
                confidence=sm.get("confidence", 0)
            ))
        
        detailed_analysis = DetailedAnalysis(
            skill_match=skill_matches,
            experience_analysis=da.get("experience_analysis", ""),
            education_analysis=da.get("education_analysis", ""),
            career_gap_analysis=da.get("career_gap_analysis", ""),
            credibility_flags=da.get("credibility_flags", [])
        )
    
    return ATSScreeningResult(
        id=row["id"],
        candidate_id=row["candidate_id"],
        job_id=row["job_id"],
        overall_score=row["overall_score"],
        skill_relevance_score=row.get("skill_relevance_score"),
        experience_score=row.get("experience_score"),
        education_score=row.get("education_score"),
        credibility_score=row.get("credibility_score"),
        shortlisted=row.get("shortlisted", False),
        shortlist_reason=row.get("shortlist_reason"),
        reason_codes=reason_codes,
        detailed_analysis=detailed_analysis,
        screened_at=row.get("screened_at")
    )
