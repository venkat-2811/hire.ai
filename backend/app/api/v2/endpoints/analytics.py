from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query

from app.api.v2.deps import require_user
from app.auth.clerk import ClerkUser
from app.services.db.supabase_service import get_db_admin_service
from app.utils.responses import api_error, ok

router = APIRouter(prefix="/analytics")


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _to_millis(value: Any) -> int:
    if not value:
        return 0
    try:
        return int(datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp() * 1000)
    except Exception:
        try:
            return int(datetime.fromtimestamp(float(value)).timestamp() * 1000)
        except Exception:
            return 0


@router.get("/dashboard")
async def get_dashboard_stats(user: ClerkUser = Depends(require_user)):
    db = get_db_admin_service()

    def _fetch_user_jobs():
        return (
            db.client.from_("job_descriptions")
            .select("id")
            .eq("created_by", user.id)
            .execute()
        )

    jobs_res = await db.run(_fetch_user_jobs)
    user_jobs = getattr(jobs_res, "data", None) or []
    user_job_ids = [j.get("id") for j in user_jobs if isinstance(j, dict) and j.get("id")]

    week_ago = _utc_now() - timedelta(days=7)
    week_ago_str = week_ago.isoformat()

    def _active_jobs_now():
        return (
            db.client.from_("job_descriptions")
            .select("id")
            .eq("created_by", user.id)
            .eq("is_active", True)
            .execute()
        )

    def _active_jobs_last_week():
        return (
            db.client.from_("job_descriptions")
            .select("id")
            .eq("created_by", user.id)
            .eq("is_active", True)
            .lt("created_at", week_ago_str)
            .execute()
        )

    active_now_res, active_last_week_res = await db.run(_active_jobs_now), await db.run(_active_jobs_last_week)
    active_jobs = len(getattr(active_now_res, "data", None) or [])
    active_jobs_last_week = len(getattr(active_last_week_res, "data", None) or [])

    active_jobs_change = (
        100
        if active_jobs_last_week == 0 and active_jobs > 0
        else 0
        if active_jobs_last_week == 0
        else round(((active_jobs - active_jobs_last_week) / active_jobs_last_week) * 100)
    )

    total_candidates = 0
    total_candidates_change = 0
    pending_interviews = 0
    pending_interviews_change = 0
    average_score = 0
    shortlist_rate = 0
    completed_today = 0
    completed_today_change = 0

    if user_job_ids:
        now = _utc_now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday_start = today_start - timedelta(days=1)

        def _candidates_count():
            return (
                db.client.from_("job_applications")
                .select("candidate_id")
                .in_("job_id", user_job_ids)
                .execute()
            )

        def _candidates_count_last_week():
            return (
                db.client.from_("job_applications")
                .select("candidate_id")
                .in_("job_id", user_job_ids)
                .lt("applied_at", week_ago_str)
                .execute()
            )

        def _pending_interviews_count():
            return (
                db.client.from_("ai_interview_sessions")
                .select("id")
                .in_("job_id", user_job_ids)
                .eq("status", "pending")
                .execute()
            )

        def _scores():
            return (
                db.client.from_("ats_screenings")
                .select("overall_score, shortlisted")
                .in_("job_id", user_job_ids)
                .execute()
            )

        def _completed_today_count():
            return (
                db.client.from_("ai_interview_sessions")
                .select("id")
                .in_("job_id", user_job_ids)
                .eq("status", "completed")
                .gte("completed_at", today_start.isoformat())
                .execute()
            )

        def _completed_yesterday_count():
            return (
                db.client.from_("ai_interview_sessions")
                .select("id")
                .in_("job_id", user_job_ids)
                .eq("status", "completed")
                .gte("completed_at", yesterday_start.isoformat())
                .lt("completed_at", today_start.isoformat())
                .execute()
            )

        # Run these concurrently-ish (Supabase python client isn't guaranteed thread-safe; we still await sequentially)
        cand_count_res = await db.run(_candidates_count)
        cand_last_week_res = await db.run(_candidates_count_last_week)
        pending_count_res = await db.run(_pending_interviews_count)
        scores_res = await db.run(_scores)
        today_count_res = await db.run(_completed_today_count)
        yesterday_count_res = await db.run(_completed_yesterday_count)

        total_candidates = len(getattr(cand_count_res, "data", None) or [])
        cand_last_week = len(getattr(cand_last_week_res, "data", None) or [])
        total_candidates_change = (
            100
            if cand_last_week == 0 and total_candidates > 0
            else 0
            if cand_last_week == 0
            else round(((total_candidates - cand_last_week) / cand_last_week) * 100)
        )

        pending_interviews = len(getattr(pending_count_res, "data", None) or [])
        pending_interviews_change = 0

        completed_today = len(getattr(today_count_res, "data", None) or [])
        completed_yesterday = len(getattr(yesterday_count_res, "data", None) or [])
        completed_today_change = (
            100
            if completed_yesterday == 0 and completed_today > 0
            else 0
            if completed_yesterday == 0
            else round(((completed_today - completed_yesterday) / completed_yesterday) * 100)
        )

        scores = getattr(scores_res, "data", None) or []
        valid_scores = [s.get("overall_score") for s in scores if isinstance(s, dict) and isinstance(s.get("overall_score"), (int, float))]
        average_score = round(sum(valid_scores) / len(valid_scores)) if valid_scores else 0

        shortlisted_count = len([s for s in scores if isinstance(s, dict) and s.get("shortlisted") is True])
        shortlist_rate = round((shortlisted_count / len(valid_scores)) * 100) if valid_scores else 0

    return ok(
        {
            "total_candidates": total_candidates,
            "total_candidates_change": total_candidates_change,
            "active_jobs": active_jobs,
            "active_jobs_change": active_jobs_change,
            "pending_interviews": pending_interviews,
            "pending_interviews_change": pending_interviews_change,
            "completed_today": completed_today,
            "completed_today_change": completed_today_change,
            "average_score": average_score,
            "shortlist_rate": shortlist_rate,
        }
    )


@router.get("/candidates")
async def get_candidate_analytics(
    user: ClerkUser = Depends(require_user),
    job_id: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
):
    db = get_db_admin_service()

    def _fetch_jobs():
        return (
            db.client.from_("job_descriptions")
            .select("id, title")
            .eq("created_by", user.id)
            .execute()
        )

    jobs_res = await db.run(_fetch_jobs)
    user_jobs = getattr(jobs_res, "data", None) or []
    user_job_ids = [j.get("id") for j in user_jobs if isinstance(j, dict) and j.get("id")]
    job_title_map = {j.get("id"): j.get("title") for j in user_jobs if isinstance(j, dict) and j.get("id")}

    if not user_job_ids:
        return ok([])

    if job_id and job_id not in user_job_ids:
        return ok([])

    effective_job_ids = [job_id] if job_id else user_job_ids

    def _fetch_applications():
        return (
            db.client.from_("job_applications")
            .select(
                "candidate_id, job_id, status, final_status, applied_at, interview_mode, manual_interview_score, interview_status"
            )
            .in_("job_id", effective_job_ids)
            .order("applied_at", desc=True)
            .limit(limit)
            .execute()
        )

    apps_res = await db.run(_fetch_applications)
    applications = getattr(apps_res, "data", None) or []

    applications_map: Dict[str, Dict[str, Any]] = {}
    for app in applications:
        if not isinstance(app, dict):
            continue
        key = f"{app.get('candidate_id')}:{app.get('job_id')}"
        existing = applications_map.get(key)
        if not existing or _to_millis(app.get("applied_at")) > _to_millis(existing.get("applied_at")):
            applications_map[key] = app

    candidate_ids = list({a.get("candidate_id") for a in applications if isinstance(a, dict) and a.get("candidate_id")})
    if not candidate_ids:
        return ok([])

    def _fetch_candidates():
        return (
            db.client.from_("candidates")
            .select("id, full_name, email, created_at")
            .in_("id", candidate_ids)
            .execute()
        )

    cands_res = await db.run(_fetch_candidates)
    candidates = getattr(cands_res, "data", None) or []
    if not isinstance(candidates, list) or not candidates:
        return ok([])

    candidate_map = {c.get("id"): c for c in candidates if isinstance(c, dict) and c.get("id")}

    def _make_key(candidate_id_value: str, job_id_value: str) -> str:
        return f"{candidate_id_value}:{job_id_value}"

    def _fetch_screenings():
        return (
            db.client.from_("ats_screenings")
            .select("candidate_id, overall_score, job_id, shortlisted, created_at")
            .in_("candidate_id", candidate_ids)
            .in_("job_id", effective_job_ids)
            .execute()
        )

    screenings_res = await db.run(_fetch_screenings)
    screenings = getattr(screenings_res, "data", None) or []
    screenings_map: Dict[str, Dict[str, Any]] = {}
    for s in screenings:
        if not isinstance(s, dict) or not s.get("candidate_id") or not s.get("job_id"):
            continue
        k = _make_key(str(s.get("candidate_id")), str(s.get("job_id")))
        existing = screenings_map.get(k)
        if not existing or _to_millis(s.get("created_at")) > _to_millis(existing.get("created_at")):
            screenings_map[k] = s

    # assessment_sessions
    assessments_map: Dict[str, Dict[str, Any]] = {}
    try:
        def _fetch_assessments():
            return (
                db.client.from_("assessment_sessions")
                .select("candidate_id, total_score, status, job_id, completed_at, updated_at, created_at")
                .in_("candidate_id", candidate_ids)
                .in_("job_id", effective_job_ids)
                .execute()
            )

        assessments_res = await db.run(_fetch_assessments)
        assessments = getattr(assessments_res, "data", None) or []
        for a in assessments:
            if not isinstance(a, dict) or not a.get("candidate_id") or not a.get("job_id"):
                continue
            k = _make_key(str(a.get("candidate_id")), str(a.get("job_id")))
            existing = assessments_map.get(k)
            a_ts = _to_millis(a.get("completed_at")) or _to_millis(a.get("updated_at")) or _to_millis(a.get("created_at"))
            e_ts = (
                _to_millis(existing.get("completed_at"))
                or _to_millis(existing.get("updated_at"))
                or _to_millis(existing.get("created_at"))
                if existing
                else 0
            )
            if not existing or a_ts >= e_ts:
                assessments_map[k] = a
    except Exception:
        pass

    # ai_interview_sessions
    interviews_map: Dict[str, Dict[str, Any]] = {}
    try:
        def _fetch_interviews():
            return (
                db.client.from_("ai_interview_sessions")
                .select("candidate_id, status, job_id, completed_at, updated_at, created_at, final_evaluation")
                .in_("candidate_id", candidate_ids)
                .in_("job_id", effective_job_ids)
                .execute()
            )

        interviews_res = await db.run(_fetch_interviews)
        interviews = getattr(interviews_res, "data", None) or []
        for i in interviews:
            if not isinstance(i, dict) or not i.get("candidate_id") or not i.get("job_id"):
                continue
            k = _make_key(str(i.get("candidate_id")), str(i.get("job_id")))
            existing = interviews_map.get(k)
            i_ts = _to_millis(i.get("completed_at")) or _to_millis(i.get("updated_at")) or _to_millis(i.get("created_at"))
            e_ts = (
                _to_millis(existing.get("completed_at"))
                or _to_millis(existing.get("updated_at"))
                or _to_millis(existing.get("created_at"))
                if existing
                else 0
            )
            if not existing or i_ts >= e_ts:
                interviews_map[k] = i
    except Exception:
        pass

    analytics: List[Dict[str, Any]] = []
    for application in applications_map.values():
        candidate = candidate_map.get(application.get("candidate_id"))
        if not candidate:
            continue

        applied_job_id = application.get("job_id") or job_id
        k = _make_key(str(application.get("candidate_id")), str(application.get("job_id")))
        screening = screenings_map.get(k)
        assessment = assessments_map.get(k)
        interview = interviews_map.get(k)

        assessment_terminated = (assessment or {}).get("status") == "terminated"
        interview_terminated = (interview or {}).get("status") == "terminated"

        interview_mode = application.get("interview_mode") or "ai"
        manual_interview_score = application.get("manual_interview_score")
        application_interview_status = application.get("interview_status")

        interview_score: Optional[float] = None
        technical_score: Optional[float] = None
        overall_score: Optional[float] = None
        recommendation: Optional[str] = None
        interview_status: Optional[str] = None

        final_eval = (interview or {}).get("final_evaluation") or {}
        if not isinstance(final_eval, dict):
            final_eval = {}

        if interview_mode == "manual" and manual_interview_score is not None:
            try:
                interview_score = float(manual_interview_score)
            except Exception:
                interview_score = None
            technical_score = interview_score
            overall_score = interview_score
            if interview_score is not None:
                if interview_score >= 80:
                    recommendation = "strong_hire"
                elif interview_score >= 60:
                    recommendation = "hire"
                elif interview_score >= 40:
                    recommendation = "borderline"
                else:
                    recommendation = "no_hire"
            interview_status = str(application_interview_status or "completed")
        else:
            if interview_terminated:
                interview_score = 0
                technical_score = 0
                overall_score = 0
                recommendation = "no_hire"
            else:
                interview_score = final_eval.get("overall_score")
                technical_score = final_eval.get("technical_score")
                overall_score = final_eval.get("overall_score")
                recommendation = final_eval.get("recommendation")
            interview_status = (interview or {}).get("status")

        assessment_score = 0 if assessment_terminated else (assessment or {}).get("total_score")

        analytics.append(
            {
                "candidate_id": candidate.get("id"),
                "candidate_name": candidate.get("full_name"),
                "candidate_email": candidate.get("email"),
                "job_title": job_title_map.get(applied_job_id) if applied_job_id else "N/A",
                "job_id": applied_job_id,
                "application_status": application.get("status") or "applied",
                "final_status": application.get("final_status"),
                "ats_score": (screening or {}).get("overall_score"),
                "shortlisted": (screening or {}).get("shortlisted"),
                "assessment_score": assessment_score,
                "assessment_status": (assessment or {}).get("status") if assessment else None,
                "interview_status": interview_status,
                "interview_score": interview_score,
                "technical_score": technical_score,
                "overall_score": overall_score,
                "recommendation": recommendation,
            }
        )

    return ok(analytics)


@router.get("/job/{job_id}/summary")
async def get_job_summary(job_id: str, user: ClerkUser = Depends(require_user)):
    db = get_db_admin_service()

    # Validate job belongs to user
    def _fetch_job():
        return (
            db.client.from_("job_descriptions")
            .select("id, title, role, level")
            .eq("id", job_id)
            .eq("created_by", user.id)
            .single()
            .execute()
        )

    job_res = await db.run(_fetch_job)
    job = getattr(job_res, "data", None)
    if not isinstance(job, dict):
        return api_error(message="Job not found", status_code=404)

    # Applicants total from job_applications
    def _apps_count():
        return (
            db.client.from_("job_applications")
            .select("id")
            .eq("job_id", job_id)
            .execute()
        )

    apps_count_res = await db.run(_apps_count)
    total_applicants = len(getattr(apps_count_res, "data", None) or [])

    # Shortlisted from ats_screenings
    def _shortlisted_count():
        return (
            db.client.from_("ats_screenings")
            .select("id")
            .eq("job_id", job_id)
            .eq("shortlisted", True)
            .execute()
        )

    shortlisted_res = await db.run(_shortlisted_count)
    shortlisted = len(getattr(shortlisted_res, "data", None) or [])

    # AI interview statuses
    interview_statuses = {"pending": 0, "in_progress": 0, "completed": 0, "terminated": 0}
    recommendations = {"strong_hire": 0, "hire": 0, "borderline": 0, "no_hire": 0}
    scores: List[float] = []

    try:
        def _fetch_interviews():
            return (
                db.client.from_("ai_interview_sessions")
                .select("status, final_evaluation")
                .eq("job_id", job_id)
                .execute()
            )

        interviews_res = await db.run(_fetch_interviews)
        interviews = getattr(interviews_res, "data", None) or []
        for i in interviews:
            if not isinstance(i, dict):
                continue
            status = str(i.get("status") or "pending")
            interview_statuses[status] = interview_statuses.get(status, 0) + 1

            final_eval = i.get("final_evaluation")
            if isinstance(final_eval, dict):
                rec = final_eval.get("recommendation")
                if isinstance(rec, str) and rec in recommendations:
                    recommendations[rec] += 1
                score = final_eval.get("overall_score")
                if isinstance(score, (int, float)):
                    scores.append(float(score))
    except Exception:
        pass

    average_score = round(sum(scores) / len(scores), 1) if scores else 0
    shortlist_rate = round((shortlisted / total_applicants) * 100, 1) if total_applicants > 0 else 0

    return ok(
        {
            "job": {
                "id": job.get("id"),
                "title": job.get("title"),
                "role": job.get("role"),
                "level": job.get("level"),
            },
            "applicants": {
                "total": total_applicants,
                "shortlisted": shortlisted,
                "shortlist_rate": shortlist_rate,
            },
            "interviews": interview_statuses,
            "recommendations": recommendations,
            "average_score": average_score,
        }
    )


@router.get("/trends")
async def get_trends(
    user: ClerkUser = Depends(require_user),
    days: int = Query(default=30, ge=1, le=365),
):
    db = get_db_admin_service()

    safe_days = int(days)
    period_days = safe_days

    end = _utc_now().replace(hour=23, minute=59, second=59, microsecond=999999)
    start = (_utc_now() - timedelta(days=safe_days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
    start_iso = start.isoformat()
    end_iso = end.isoformat()

    def _fetch_jobs():
        return (
            db.client.from_("job_descriptions")
            .select("id")
            .eq("created_by", user.id)
            .execute()
        )

    jobs_res = await db.run(_fetch_jobs)
    jobs = getattr(jobs_res, "data", None) or []
    user_job_ids = [j.get("id") for j in jobs if isinstance(j, dict) and j.get("id")]

    def _to_day_key(value: Any) -> str:
        if isinstance(value, datetime):
            return value.date().isoformat()
        return str(value).split("T")[0]

    day_map: Dict[str, Dict[str, Any]] = {}
    for i in range(safe_days):
        d = start + timedelta(days=i)
        k = d.date().isoformat()
        day_map[k] = {
            "date": k,
            "screenings": 0,
            "shortlisted": 0,
            "interviews_started": 0,
            "interviews_completed": 0,
            "score_sum": 0.0,
            "score_count": 0,
        }

    if not user_job_ids:
        trends = [
            {
                "date": v["date"],
                "screenings": 0,
                "shortlisted": 0,
                "interviews_started": 0,
                "interviews_completed": 0,
                "average_score": 0,
            }
            for v in day_map.values()
        ]
        return ok({"trends": trends, "period_days": period_days})

    def _fetch_screenings():
        return (
            db.client.from_("ats_screenings")
            .select("created_at, shortlisted, overall_score")
            .in_("job_id", user_job_ids)
            .gte("created_at", start_iso)
            .lte("created_at", end_iso)
            .execute()
        )

    screenings_res = await db.run(_fetch_screenings)
    screenings = getattr(screenings_res, "data", None) or []
    for s in screenings:
        if not isinstance(s, dict) or not s.get("created_at"):
            continue
        k = _to_day_key(s.get("created_at"))
        bucket = day_map.get(k)
        if not bucket:
            continue
        bucket["screenings"] += 1
        if s.get("shortlisted") is True:
            bucket["shortlisted"] += 1
        if isinstance(s.get("overall_score"), (int, float)):
            bucket["score_sum"] += float(s.get("overall_score"))
            bucket["score_count"] += 1

    try:
        def _fetch_interviews():
            return (
                db.client.from_("ai_interview_sessions")
                .select("status, created_at, completed_at, updated_at")
                .in_("job_id", user_job_ids)
                .gte("created_at", start_iso)
                .lte("created_at", end_iso)
                .execute()
            )

        interviews_res = await db.run(_fetch_interviews)
        interviews = getattr(interviews_res, "data", None) or []
        for irow in interviews:
            if not isinstance(irow, dict):
                continue
            if irow.get("created_at"):
                k = _to_day_key(irow.get("created_at"))
                bucket = day_map.get(k)
                if bucket:
                    bucket["interviews_started"] += 1

            if str(irow.get("status") or "").lower() == "completed":
                completed_at = irow.get("completed_at") or irow.get("updated_at")
                if completed_at:
                    k = _to_day_key(completed_at)
                    bucket = day_map.get(k)
                    if bucket:
                        bucket["interviews_completed"] += 1
    except Exception:
        pass

    trends = []
    for k in sorted(day_map.keys()):
        d = day_map[k]
        avg = round((d["score_sum"] / d["score_count"]) * 10) / 10 if d["score_count"] > 0 else 0
        trends.append(
            {
                "date": d["date"],
                "screenings": d["screenings"],
                "shortlisted": d["shortlisted"],
                "interviews_started": d["interviews_started"],
                "interviews_completed": d["interviews_completed"],
                "average_score": avg,
            }
        )

    return ok({"trends": trends, "period_days": period_days})
