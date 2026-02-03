from fastapi import APIRouter, HTTPException
from typing import List, Optional
from datetime import datetime, timedelta
from app.models.schemas import (
    DashboardStats, CandidateAnalytics, APIResponse
)
from app.models.enums import InterviewStatus, HireRecommendation
from app.database import get_supabase_client

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats():
    """Get dashboard statistics."""
    supabase = get_supabase_client()
    
    # Total candidates
    candidates_result = supabase.table("candidates").select("id", count="exact").execute()
    total_candidates = candidates_result.count or 0
    
    # Active jobs
    jobs_result = supabase.table("job_descriptions").select("id", count="exact").eq(
        "is_active", True
    ).execute()
    active_jobs = jobs_result.count or 0
    
    # Pending interviews
    pending_result = supabase.table("interview_sessions").select("id", count="exact").eq(
        "status", InterviewStatus.PENDING.value
    ).execute()
    pending_interviews = pending_result.count or 0
    
    # Completed today
    today = datetime.utcnow().date().isoformat()
    completed_result = supabase.table("interview_sessions").select("id", count="exact").eq(
        "status", InterviewStatus.COMPLETED.value
    ).gte("completed_at", today).execute()
    completed_today = completed_result.count or 0
    
    # Average ATS score
    scores_result = supabase.table("ats_screenings").select("overall_score").execute()
    scores = [s["overall_score"] for s in scores_result.data if s.get("overall_score")]
    average_score = sum(scores) / len(scores) if scores else 0.0
    
    # Shortlist rate
    shortlisted_result = supabase.table("ats_screenings").select("id", count="exact").eq(
        "shortlisted", True
    ).execute()
    total_screenings = len(scores_result.data)
    shortlisted_count = shortlisted_result.count or 0
    shortlist_rate = (shortlisted_count / total_screenings * 100) if total_screenings > 0 else 0.0
    
    return DashboardStats(
        total_candidates=total_candidates,
        active_jobs=active_jobs,
        pending_interviews=pending_interviews,
        completed_today=completed_today,
        average_score=round(average_score, 1),
        shortlist_rate=round(shortlist_rate, 1)
    )


@router.get("/candidates", response_model=List[CandidateAnalytics])
async def get_candidate_analytics(
    job_id: Optional[str] = None,
    status: Optional[InterviewStatus] = None,
    recommendation: Optional[HireRecommendation] = None,
    limit: int = 50
):
    """Get candidate analytics with optional filters."""
    supabase = get_supabase_client()
    
    # Get candidates with their screenings and interviews
    query = supabase.table("candidates").select(
        "id, full_name, ats_screenings(overall_score, job_id, job_descriptions(title)), "
        "interview_sessions(status, interview_evaluations(technical_score, overall_score, recommendation))"
    )
    
    result = query.limit(limit).execute()
    
    analytics = []
    for row in result.data:
        # Get the most recent screening
        screenings = row.get("ats_screenings", [])
        latest_screening = screenings[0] if screenings else None
        
        # Get the most recent interview
        sessions = row.get("interview_sessions", [])
        latest_session = sessions[0] if sessions else None
        
        # Get evaluation if exists
        evaluation = None
        if latest_session and latest_session.get("interview_evaluations"):
            evals = latest_session["interview_evaluations"]
            evaluation = evals[0] if evals else None
        
        # Filter by job_id if specified
        if job_id and latest_screening:
            if latest_screening.get("job_id") != job_id:
                continue
        
        # Filter by status if specified
        if status and latest_session:
            if latest_session.get("status") != status.value:
                continue
        
        # Filter by recommendation if specified
        if recommendation and evaluation:
            if evaluation.get("recommendation") != recommendation.value:
                continue
        
        analytics.append(CandidateAnalytics(
            candidate_id=row["id"],
            candidate_name=row["full_name"],
            job_title=latest_screening.get("job_descriptions", {}).get("title", "N/A") if latest_screening else "N/A",
            ats_score=latest_screening.get("overall_score", 0) if latest_screening else 0,
            interview_status=InterviewStatus(latest_session["status"]) if latest_session else InterviewStatus.PENDING,
            technical_score=evaluation.get("technical_score") if evaluation else None,
            overall_score=evaluation.get("overall_score") if evaluation else None,
            recommendation=HireRecommendation(evaluation["recommendation"]) if evaluation and evaluation.get("recommendation") else None
        ))
    
    return analytics


@router.get("/job/{job_id}/summary")
async def get_job_analytics_summary(job_id: str):
    """Get analytics summary for a specific job."""
    supabase = get_supabase_client()
    
    # Get job details
    job_result = supabase.table("job_descriptions").select("*").eq("id", job_id).single().execute()
    if not job_result.data:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = job_result.data
    
    # Get all screenings for this job
    screenings_result = supabase.table("ats_screenings").select("*").eq("job_id", job_id).execute()
    screenings = screenings_result.data
    
    # Get all interviews for this job
    interviews_result = supabase.table("interview_sessions").select(
        "*, interview_evaluations(*)"
    ).eq("job_id", job_id).execute()
    interviews = interviews_result.data
    
    # Calculate statistics
    total_applicants = len(screenings)
    shortlisted = len([s for s in screenings if s.get("shortlisted")])
    
    interview_statuses = {
        "pending": 0,
        "in_progress": 0,
        "completed": 0,
        "cancelled": 0
    }
    
    recommendations = {
        "strong_hire": 0,
        "hire": 0,
        "borderline": 0,
        "no_hire": 0
    }
    
    scores = []
    
    for interview in interviews:
        status = interview.get("status", "pending")
        interview_statuses[status] = interview_statuses.get(status, 0) + 1
        
        evals = interview.get("interview_evaluations", [])
        if evals:
            eval_data = evals[0] if isinstance(evals, list) else evals
            if eval_data.get("recommendation"):
                rec = eval_data["recommendation"]
                recommendations[rec] = recommendations.get(rec, 0) + 1
            if eval_data.get("overall_score"):
                scores.append(eval_data["overall_score"])
    
    avg_score = sum(scores) / len(scores) if scores else 0
    
    return {
        "job": {
            "id": job["id"],
            "title": job["title"],
            "role": job["role"],
            "level": job["level"]
        },
        "applicants": {
            "total": total_applicants,
            "shortlisted": shortlisted,
            "shortlist_rate": round(shortlisted / total_applicants * 100, 1) if total_applicants > 0 else 0
        },
        "interviews": interview_statuses,
        "recommendations": recommendations,
        "average_score": round(avg_score, 1)
    }


@router.get("/trends")
async def get_hiring_trends(days: int = 30):
    """Get hiring trends over time."""
    supabase = get_supabase_client()
    
    start_date = (datetime.utcnow() - timedelta(days=days)).isoformat()
    
    # Get screenings over time
    screenings_result = supabase.table("ats_screenings").select(
        "screened_at, overall_score, shortlisted"
    ).gte("screened_at", start_date).order("screened_at").execute()
    
    # Get interviews over time
    interviews_result = supabase.table("interview_sessions").select(
        "created_at, status, completed_at"
    ).gte("created_at", start_date).order("created_at").execute()
    
    # Aggregate by day
    daily_data = {}
    
    for screening in screenings_result.data:
        date = screening["screened_at"][:10]
        if date not in daily_data:
            daily_data[date] = {
                "screenings": 0,
                "shortlisted": 0,
                "interviews_started": 0,
                "interviews_completed": 0,
                "avg_score": []
            }
        daily_data[date]["screenings"] += 1
        if screening.get("shortlisted"):
            daily_data[date]["shortlisted"] += 1
        if screening.get("overall_score"):
            daily_data[date]["avg_score"].append(screening["overall_score"])
    
    for interview in interviews_result.data:
        date = interview["created_at"][:10]
        if date not in daily_data:
            daily_data[date] = {
                "screenings": 0,
                "shortlisted": 0,
                "interviews_started": 0,
                "interviews_completed": 0,
                "avg_score": []
            }
        daily_data[date]["interviews_started"] += 1
        if interview.get("completed_at"):
            daily_data[date]["interviews_completed"] += 1
    
    # Format response
    trends = []
    for date in sorted(daily_data.keys()):
        data = daily_data[date]
        avg = sum(data["avg_score"]) / len(data["avg_score"]) if data["avg_score"] else 0
        trends.append({
            "date": date,
            "screenings": data["screenings"],
            "shortlisted": data["shortlisted"],
            "interviews_started": data["interviews_started"],
            "interviews_completed": data["interviews_completed"],
            "average_score": round(avg, 1)
        })
    
    return {"trends": trends, "period_days": days}
