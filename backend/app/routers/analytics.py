from fastapi import APIRouter, HTTPException
from typing import List, Optional
from datetime import datetime, timedelta
from app.models.schemas import (
    DashboardStats, CandidateAnalytics, APIResponse
)
from app.models.enums import InterviewStatus, HireRecommendation
from app.database import get_supabase_admin_client

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats():
    """Get dashboard statistics."""
    supabase = get_supabase_admin_client()
    now = datetime.utcnow()
    start_7d = (now - timedelta(days=7)).isoformat()
    start_14d = (now - timedelta(days=14)).isoformat()
    
    # Total candidates
    candidates_result = supabase.table("candidates").select("id", count="exact").execute()
    total_candidates = candidates_result.count or 0

    candidates_last_7d = supabase.table("candidates").select("id", count="exact").gte(
        "created_at", start_7d
    ).execute().count or 0
    candidates_prev_7d = supabase.table("candidates").select("id", count="exact").gte(
        "created_at", start_14d
    ).lt("created_at", start_7d).execute().count or 0
    total_candidates_change = candidates_last_7d - candidates_prev_7d
    
    # Active jobs
    jobs_result = supabase.table("job_descriptions").select("id", count="exact").eq(
        "is_active", True
    ).execute()
    active_jobs = jobs_result.count or 0

    active_jobs_last_7d = supabase.table("job_descriptions").select("id", count="exact").eq(
        "is_active", True
    ).gte("created_at", start_7d).execute().count or 0
    active_jobs_prev_7d = supabase.table("job_descriptions").select("id", count="exact").eq(
        "is_active", True
    ).gte("created_at", start_14d).lt("created_at", start_7d).execute().count or 0
    active_jobs_change = active_jobs_last_7d - active_jobs_prev_7d
    
    # Pending interviews
    pending_result = supabase.table("interview_sessions").select("id", count="exact").eq(
        "status", InterviewStatus.PENDING.value
    ).execute()
    pending_interviews = pending_result.count or 0

    pending_last_7d = supabase.table("interview_sessions").select("id", count="exact").eq(
        "status", InterviewStatus.PENDING.value
    ).gte("created_at", start_7d).execute().count or 0
    pending_prev_7d = supabase.table("interview_sessions").select("id", count="exact").eq(
        "status", InterviewStatus.PENDING.value
    ).gte("created_at", start_14d).lt("created_at", start_7d).execute().count or 0
    pending_interviews_change = pending_last_7d - pending_prev_7d
    
    # Completed today
    today = now.date().isoformat()
    completed_result = supabase.table("interview_sessions").select("id", count="exact").eq(
        "status", InterviewStatus.COMPLETED.value
    ).gte("completed_at", today).execute()
    completed_today = completed_result.count or 0

    completed_last_7d = supabase.table("interview_sessions").select("id", count="exact").eq(
        "status", InterviewStatus.COMPLETED.value
    ).gte("completed_at", start_7d).execute().count or 0
    completed_prev_7d = supabase.table("interview_sessions").select("id", count="exact").eq(
        "status", InterviewStatus.COMPLETED.value
    ).gte("completed_at", start_14d).lt("completed_at", start_7d).execute().count or 0
    completed_today_change = completed_last_7d - completed_prev_7d
    
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
        total_candidates_change=total_candidates_change,
        active_jobs=active_jobs,
        active_jobs_change=active_jobs_change,
        pending_interviews=pending_interviews,
        pending_interviews_change=pending_interviews_change,
        completed_today=completed_today,
        completed_today_change=completed_today_change,
        average_score=int(round(average_score, 0)),
        shortlist_rate=int(round(shortlist_rate, 0))
    )


@router.get("/candidates", response_model=List[CandidateAnalytics])
async def get_candidate_analytics(
    job_id: Optional[str] = None,
    status: Optional[InterviewStatus] = None,
    recommendation: Optional[HireRecommendation] = None,
    limit: int = 50
):
    """Get candidate analytics with optional filters."""
    supabase = get_supabase_admin_client()
    
    # Get candidates with their screenings, assessments, and AI interviews
    query = supabase.table("candidates").select(
        "id, full_name, "
        "ats_screenings(overall_score, shortlisted, job_id, job_descriptions(title)), "
        "assessment_sessions(total_score, status, job_id, completed_at, created_at), "
        "ai_interview_sessions(status, job_id, completed_at, created_at, final_evaluation)"
    )
    
    result = query.limit(limit).execute()
    
    analytics = []
    for row in result.data:
        # Get the most recent screening
        screenings = row.get("ats_screenings", [])
        latest_screening = screenings[0] if screenings else None
        
        # Get the most recent assessment (prefer the selected job if provided)
        assessments = row.get("assessment_sessions", [])
        latest_assessment = None
        if assessments:
            filtered_assessments = assessments
            if job_id:
                filtered_assessments = [a for a in assessments if a.get("job_id") == job_id]

            def _assessment_sort_key(a):
                return a.get("completed_at") or a.get("created_at") or ""

            filtered_assessments.sort(key=_assessment_sort_key, reverse=True)
            latest_assessment = filtered_assessments[0] if filtered_assessments else None
        
        # Get the most recent AI interview (prefer selected job if provided)
        ai_sessions = row.get("ai_interview_sessions", [])
        latest_ai_session = None
        if ai_sessions:
            filtered_ai = ai_sessions
            if job_id:
                filtered_ai = [s for s in ai_sessions if s.get("job_id") == job_id]

            def _ai_sort_key(s):
                return s.get("completed_at") or s.get("created_at") or ""

            filtered_ai.sort(key=_ai_sort_key, reverse=True)
            latest_ai_session = filtered_ai[0] if filtered_ai else None

        final_eval = (latest_ai_session or {}).get("final_evaluation") or None
        interview_overall = None
        interview_technical = None
        interview_recommendation = None
        if isinstance(final_eval, dict):
            interview_overall = final_eval.get("overall_score")
            interview_technical = final_eval.get("technical_score")
            interview_recommendation = final_eval.get("recommendation")

        ai_status_value = None
        if latest_ai_session and latest_ai_session.get("status"):
            ai_status_value = latest_ai_session.get("status")

        interview_status_enum = InterviewStatus.PENDING
        if ai_status_value in {s.value for s in InterviewStatus}:
            interview_status_enum = InterviewStatus(ai_status_value)
        elif ai_status_value is not None:
            # ai_interview_sessions supports statuses like 'terminated'
            interview_status_enum = InterviewStatus.CANCELLED
        
        # Filter by job_id if specified
        if job_id:
            screening_match = bool(latest_screening and latest_screening.get("job_id") == job_id)
            assessment_match = bool(latest_assessment and latest_assessment.get("job_id") == job_id)
            interview_match = bool(latest_ai_session and latest_ai_session.get("job_id") == job_id)
            if not screening_match and not assessment_match and not interview_match:
                continue

        # Filter by status if specified
        if status and latest_ai_session:
            if latest_ai_session.get("status") != status.value:
                continue
        
        # Filter by recommendation if specified
        if recommendation and interview_recommendation:
            if interview_recommendation != recommendation.value:
                continue

        analytics.append(CandidateAnalytics(
            candidate_id=row["id"],
            candidate_name=row["full_name"],
            job_title=latest_screening.get("job_descriptions", {}).get("title", "N/A") if latest_screening else "N/A",
            ats_score=latest_screening.get("overall_score", 0) if latest_screening else 0,
            assessment_score=latest_assessment.get("total_score") if latest_assessment else None,
            interview_score=interview_overall,
            interview_status=interview_status_enum,
            technical_score=interview_technical,
            overall_score=interview_overall,
            recommendation=HireRecommendation(interview_recommendation) if interview_recommendation else None,
            shortlisted=latest_screening.get("shortlisted") if latest_screening else None,
            final_status=None,  # will be backfilled below
        ))
    
    # Backfill final_status from job_applications for accepted/offer_sent candidates
    if analytics and job_id:
        candidate_ids = [a.candidate_id for a in analytics]
        try:
            apps_result = supabase.table("job_applications").select(
                "candidate_id, final_status"
            ).in_("candidate_id", candidate_ids).eq("job_id", job_id).execute()
            
            final_status_map = {
                app["candidate_id"]: app.get("final_status")
                for app in (apps_result.data or [])
            }
            
            for item in analytics:
                item.final_status = final_status_map.get(item.candidate_id)
        except Exception as e:
            print(f"Failed to fetch final_status from job_applications: {e}")
    
    return analytics



@router.get("/job/{job_id}/summary")
async def get_job_analytics_summary(job_id: str):
    """Get analytics summary for a specific job."""
    supabase = get_supabase_admin_client()
    
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
    supabase = get_supabase_admin_client()
    
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
