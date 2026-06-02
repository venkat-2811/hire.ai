from __future__ import annotations

import json
import secrets
import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from typing import Deque
from typing import Any, Dict, List, Optional, Tuple
import re

import logging

from collections import defaultdict, deque
from time import time

from fastapi import APIRouter, Body, Depends
from pydantic import BaseModel, Field

from app.api.v2.deps import require_user
from app.auth.clerk import ClerkUser
from app.config import get_settings
from app.services.ai.apex_blanks import (
    evaluate_apex_fill_in_the_blanks,
    generate_apex_fill_in_the_blanks,
)
from app.services.db.supabase_service import get_db_admin_service
from app.services.code_executor import HackerEarthExecutor
from app.services.email_queue import email_queue, Priority
from app.services.question_generator import get_question_generator
from app.utils.responses import api_error, ok

router = APIRouter(prefix="/assessments", tags=["assessments"])

logger = logging.getLogger(__name__)


def _derive_function_name_and_mode(
    *,
    starter_code: Any,
    solution_wrappers: Any,
    preferred_language: Optional[str] = None,
):
    lang_candidates = []
    if preferred_language:
        lang_candidates.append(str(preferred_language))
        lang_candidates.append(str(preferred_language).lower())

    if isinstance(starter_code, dict):
        lang_candidates.extend([str(k) for k in starter_code.keys()])
    if isinstance(solution_wrappers, dict):
        lang_candidates.extend([str(k) for k in solution_wrappers.keys()])

    seen = set()
    ordered_langs = []
    for l in lang_candidates:
        if l and l not in seen:
            seen.add(l)
            ordered_langs.append(l)

    def _get_code_for_lang(lang: str) -> str:
        if isinstance(starter_code, dict):
            v = starter_code.get(lang) or starter_code.get(lang.lower())
            if isinstance(v, str) and v.strip():
                return v
        if isinstance(solution_wrappers, dict):
            v = solution_wrappers.get(lang) or solution_wrappers.get(lang.lower())
            if isinstance(v, str) and v.strip():
                return v
        return ""

    for lang in ordered_langs:
        code = _get_code_for_lang(lang)
        if not code:
            continue

        if lang in ("python", "python3"):
            if re.search(r"\bclass\s+Solution\b", code):
                m = re.search(r"\bclass\s+Solution\b[\s\S]*?\n\s+def\s+(\w+)\s*\(", code)
                if m:
                    return m.group(1), "class", "Solution"
            m = re.search(r"\bdef\s+(\w+)\s*\(", code)
            if m:
                return m.group(1), "function", None

        if lang in ("csharp", "c#"):
            if re.search(r"\bclass\s+Solution\b", code):
                m = re.search(
                    r"\bclass\s+Solution\b[\s\S]*?\b(?:public|private|protected)?\s*\w+[\w\[\]<>]*\s+(\w+)\s*\(",
                    code,
                )
                if m:
                    return m.group(1), "class", "Solution"

        if lang == "java":
            if re.search(r"\bclass\s+Solution\b", code):
                m = re.search(
                    r"\bclass\s+Solution\b[\s\S]*?\b(?:public|private|protected)?\s*\w+[\w\[\]<>]*\s+(\w+)\s*\(",
                    code,
                )
                if m:
                    return m.group(1), "class", "Solution"

        if lang == "cpp":
            if re.search(r"\bclass\s+Solution\b", code):
                m = re.search(r"\bclass\s+Solution\b[\s\S]*?\b(\w+)\s*\(", code)
                if m:
                    return m.group(1), "class", "Solution"

    return None, None, None


def _derive_parameter_schema_from_test_cases(test_cases: Any) -> list:
    if not isinstance(test_cases, list) or not test_cases:
        return []
    for tc in test_cases:
        if not isinstance(tc, dict):
            continue
        raw_input = tc.get("input")
        if isinstance(raw_input, dict) and raw_input:
            return [{"name": str(k)} for k in raw_input.keys()]
    return []


async def _ensure_problem_execution_metadata(
    *,
    db,
    problem: Dict[str, Any],
    language: str,
):
    problem_id = problem.get("id")
    if not problem_id:
        return problem

    function_name = problem.get("function_name") or problem.get("method_name")

    solution_wrappers = problem.get("solution_wrappers")
    if not isinstance(solution_wrappers, dict):
        solution_wrappers = {}

    meta = solution_wrappers.get("__meta")
    if not isinstance(meta, dict):
        meta = {}

    execution_mode = meta.get("execution_mode")
    class_name = meta.get("class_name")
    parameter_schema = meta.get("parameter_schema")

    needs_fn = not function_name
    needs_mode = not execution_mode
    needs_params = not isinstance(parameter_schema, list) or not parameter_schema

    if needs_fn or needs_mode:
        derived_fn, derived_mode, derived_class = _derive_function_name_and_mode(
            starter_code=problem.get("starter_code"),
            solution_wrappers=problem.get("solution_wrappers"),
            preferred_language=str(language),
        )
        function_name = function_name or derived_fn
        execution_mode = execution_mode or derived_mode
        class_name = class_name or derived_class

    if needs_params:
        parameter_schema = _derive_parameter_schema_from_test_cases(problem.get("test_cases"))

    update_payload: Dict[str, Any] = {}

    # Persist execution metadata in solution_wrappers.__meta (no DB schema dependency)
    meta_update: Dict[str, Any] = {}
    if execution_mode and meta.get("execution_mode") != execution_mode:
        meta_update["execution_mode"] = execution_mode
    if class_name and meta.get("class_name") != class_name:
        meta_update["class_name"] = class_name
    if isinstance(parameter_schema, list) and parameter_schema and meta.get("parameter_schema") != parameter_schema:
        meta_update["parameter_schema"] = parameter_schema

    if meta_update:
        merged_sw = dict(solution_wrappers)
        merged_meta = dict(meta)
        merged_meta.update(meta_update)
        merged_sw["__meta"] = merged_meta
        update_payload["solution_wrappers"] = merged_sw

    if update_payload:
        try:
            await db.run(lambda: db.client.from_("dsa_problems").update(update_payload).eq("id", problem_id).execute())
        except Exception as e:
            logger.warning(
                "[assessments.execution_metadata] backfill_failed problem_id=%s error=%s",
                str(problem_id),
                str(e),
            )

    if update_payload:
        problem = {**problem, **update_payload}

    return problem

_rate_limit_buckets: Dict[str, Deque[float]] = defaultdict(deque)


def _check_rate_limit(key: str, *, max_per_minute: int) -> bool:
    now = time()
    bucket = _rate_limit_buckets[key]
    cutoff = now - 60
    while bucket and bucket[0] < cutoff:
        bucket.popleft()
    if len(bucket) >= max_per_minute:
        return False
    bucket.append(now)
    return True


_executor: Optional[HackerEarthExecutor] = None


def _get_executor() -> HackerEarthExecutor:
    global _executor
    if _executor is None:
        _executor = HackerEarthExecutor()
    return _executor


class AssessmentInviteRequest(BaseModel):
    candidate_ids: List[str] = Field(default_factory=list)
    job_id: str
    deadline: Optional[str] = None
    deadline_hours: Optional[int] = 72
    mcq_question_count: Optional[int] = 20
    coding_challenge_count: Optional[int] = 2
    difficulty: Optional[str] = "medium"
    include_mcq: Optional[bool] = True
    include_coding: Optional[bool] = True
    assessment_mode: Optional[str] = None
    total_time_minutes: Optional[int] = None
    include_sql: Optional[bool] = False
    sql_question_count: Optional[int] = 0


def _is_salesforce_role(job: Dict[str, Any]) -> bool:
    import re

    text = " ".join(
        [
            str(job.get("role") or ""),
            str(job.get("title") or ""),
            str(job.get("description") or ""),
            " ".join(job.get("must_have_skills") or [])
            if isinstance(job.get("must_have_skills"), list)
            else "",
            " ".join(job.get("good_to_have_skills") or [])
            if isinstance(job.get("good_to_have_skills"), list)
            else "",
        ]
    )
    return bool(re.search(r"(salesforce|apex|crm developer)", text, re.IGNORECASE))


def _calc_total_time_minutes(
    *,
    difficulty: str,
    mcq_count: int,
    coding_count: int,
) -> int:
    mcq_time_per_question = 1 if difficulty == "easy" else 2 if difficulty == "hard" else 1.5
    coding_time_per_challenge = 15 if difficulty == "easy" else 30 if difficulty == "hard" else 20
    total = int((mcq_count * mcq_time_per_question) + (coding_count * coding_time_per_challenge))
    return max(15, total)


async def _select_dsa_coding_challenges(
    *,
    db,
    difficulty: str,
    count: int,
) -> List[Dict[str, Any]]:
    if count <= 0:
        return []

    if difficulty == "easy":
        dist = ["easy"] * count
    elif difficulty == "hard":
        dist = ["medium"] + (["hard"] * (count - 1)) if count >= 2 else ["hard"]
    else:
        dist = ["easy"] + (["medium"] * (count - 1)) if count >= 2 else ["medium"]

    selected: List[Dict[str, Any]] = []

    def _fetch_for_diff(d: str):
        return (
            db.client.from_("dsa_problems")
            .select("*")
            .eq("difficulty", d)
            .eq("is_active", True)
            .limit(20)
            .execute()
        )

    for d in dist:
        res = await db.run(lambda d=d: _fetch_for_diff(d))
        problems = getattr(res, "data", None) or []
        if not isinstance(problems, list) or not problems:
            continue

        avail = [p for p in problems if isinstance(p, dict) and not any(s.get("id") == p.get("id") for s in selected)]
        if not avail:
            continue
        import random

        picked = random.choice(avail)
        selected.append(picked)

    def _public_test_cases(p: Dict[str, Any]) -> List[Dict[str, Any]]:
        tcs = p.get("test_cases") or []
        if not isinstance(tcs, list):
            return []
        return [
            {"id": tc.get("id"), "input": tc.get("input"), "expected_output": tc.get("expected_output")}
            for tc in tcs
            if isinstance(tc, dict) and tc.get("visibility") == "public"
        ]

    mapped: List[Dict[str, Any]] = []
    for p in selected:
        mapped.append(
            {
                "id": p.get("id"),
                "slug": p.get("slug"),
                "title": p.get("title"),
                "description": p.get("description"),
                "constraints": p.get("constraints") or "",
                "examples": p.get("examples") or [],
                "starter_code": p.get("starter_code") or {},
                "test_cases": _public_test_cases(p),
                "points": p.get("points"),
                "time_limit_seconds": p.get("time_limit_seconds"),
                "supported_languages": list((p.get("starter_code") or {}).keys()),
            }
        )
    return mapped


async def _fetch_job_for_user(
    *,
    db,
    job_id: str,
    user_id: str,
) -> Optional[Dict[str, Any]]:
    def _fetch():
        return (
            db.client.from_("job_descriptions")
            .select("id, title, role, level, description, must_have_skills, good_to_have_skills, include_sql_assessment")
            .eq("id", job_id)
            .eq("created_by", user_id)
            .single()
            .execute()
        )

    res = await db.run(_fetch)
    job = getattr(res, "data", None)
    return job if isinstance(job, dict) else None


async def _fetch_candidates(
    *,
    db,
    candidate_ids: List[str],
) -> List[Dict[str, Any]]:
    if not candidate_ids:
        return []

    def _fetch():
        return (
            db.client.from_("candidates")
            .select("id, email, full_name")
            .in_("id", candidate_ids)
            .execute()
        )

    res = await db.run(_fetch)
    rows = getattr(res, "data", None) or []
    return rows if isinstance(rows, list) else []


@router.post("/invite")
async def invite_assessments(
    body: AssessmentInviteRequest,
    user: ClerkUser = Depends(require_user),
):
    db = get_db_admin_service()

    from app.utils.billing_helpers import check_candidate_limit
    err_msg = await check_candidate_limit(db, user.id)
    if err_msg:
        return api_error(message=err_msg, status_code=403)

    if not body.job_id:
        return api_error(message="Missing job_id", status_code=400)
    if not isinstance(body.candidate_ids, list) or len(body.candidate_ids) == 0:
        return api_error(message="No candidates selected", status_code=400)

    from datetime import timedelta

    try:
        if body.deadline:
            deadline_dt = _parse_iso_dt(body.deadline)
            if deadline_dt <= datetime.now(timezone.utc):
                return api_error(message="Deadline must be in the future", status_code=400)
        else:
            hours = int(body.deadline_hours or 72)
            deadline_dt = datetime.now(timezone.utc) + timedelta(hours=hours)
    except Exception:
        return api_error(message="Invalid deadline date/time format", status_code=400)

    job = await _fetch_job_for_user(db=db, job_id=body.job_id, user_id=user.id)
    if not job:
        return api_error(message="Job not found", status_code=404)

    is_salesforce = _is_salesforce_role(job)
    expected_mode = "apex" if is_salesforce else "dsa"
    if body.assessment_mode and body.assessment_mode != expected_mode:
        return api_error(
            message=f"Assessment mode '{body.assessment_mode}' is not valid for this job role. Expected '{expected_mode}'.",
            status_code=400,
        )
    assessment_mode = expected_mode
    is_apex_mode = assessment_mode == "apex"

    include_mcq = body.include_mcq is not False
    include_coding = body.include_coding is not False
    include_sql = body.include_sql is True

    difficulty = (body.difficulty or "medium").strip().lower()
    if difficulty not in ("easy", "medium", "hard"):
        difficulty = "medium"

    mcq_count_raw = body.mcq_question_count if body.mcq_question_count is not None else 20
    mcq_count = int(mcq_count_raw) if include_mcq else 0

    coding_count_raw = body.coding_challenge_count if body.coding_challenge_count is not None else (4 if is_apex_mode else 2)
    coding_count = int(coding_count_raw) if include_coding else 0
    apex_blanks_count = coding_count if is_apex_mode else 0

    sql_count_raw = body.sql_question_count if body.sql_question_count is not None else 0
    sql_count = int(sql_count_raw) if include_sql else 0

    if include_mcq and mcq_count < 1:
        return api_error(message="MCQ question count must be at least 1 when MCQ is enabled", status_code=400)

    total_time_minutes = (
        int(body.total_time_minutes) if body.total_time_minutes else _calc_total_time_minutes(
            difficulty=difficulty,
            mcq_count=mcq_count,
            coding_count=(apex_blanks_count if is_apex_mode else coding_count),
        )
    )

    candidates = await _fetch_candidates(db=db, candidate_ids=body.candidate_ids)
    if not candidates:
        return api_error(message="No candidates found", status_code=404)

    request_started = time()
    invites_sent = 0
    failed: List[str] = []

    # Fast path: only persist sessions. ALL heavy work (generation + email) runs in background.
    session_rows: List[Dict[str, Any]] = []
    session_meta: List[Dict[str, Any]] = []

    for c in candidates:
        candidate_id = c.get("id")
        if not candidate_id:
            continue

        token = secrets.token_urlsafe(32)
        session_id = str(uuid.uuid4())

        proctoring_data: Dict[str, Any] = {
            "tab_switches": 0,
            "fullscreen_exits": 0,
            "copy_paste_attempts": 0,
            "warnings": [],
            "terminated": False,
            "assessment_config": {
                "include_mcq": bool(include_mcq),
                "include_coding": bool(include_coding),
                "difficulty": difficulty,
                "assessment_mode": assessment_mode,
                "is_apex_mode": bool(is_apex_mode),
            },
            "content_generation": {
                "status": "queued",
                "queued_at": _utc_now_iso(),
            },
            "invite_delivery": {
                "status": "queued",
                "queued_at": _utc_now_iso(),
            },
        }

        session_rows.append(
            {
                "id": session_id,
                "candidate_id": candidate_id,
                "job_id": body.job_id,
                "token": token,
                "status": "pending",
                "deadline": deadline_dt.isoformat(),
                "mcq_question_count": mcq_count,
                "coding_challenge_count": apex_blanks_count if is_apex_mode else coding_count,
                "total_time_minutes": total_time_minutes,
                "mcq_questions": [],
                "coding_challenges": [],
                "proctoring_data": proctoring_data,
                "created_at": _utc_now_iso(),
            }
        )
        session_meta.append(
            {
                "session_id": session_id,
                "token": token,
                "email": str(c.get("email") or ""),
                "candidate_name": str(c.get("full_name") or "Candidate"),
                "candidate_id": candidate_id,
            }
        )

    if not session_rows:
        return api_error(message="No valid candidates to invite", status_code=400)

    def _bulk_insert():
        return db.client.from_("assessment_sessions").insert(session_rows).execute()

    ins = await db.run(_bulk_insert)
    if getattr(ins, "error", None):
        return api_error(message="Failed to create assessment sessions", status_code=500)

    invites_sent = len(session_rows)

    # Background: generate shared content once, update sessions, then send email per candidate.
    async def _generate_update_and_email():
        bg_started = time()
        bg_db = get_db_admin_service()
        qgen = get_question_generator()

        logger.info(
            "[assessments.invite] background_start invites=%s job_id=%s mode=%s difficulty=%s",
            str(invites_sent),
            str(body.job_id),
            str(assessment_mode),
            str(difficulty),
        )

        generated_mcqs: List[Dict[str, Any]] = []
        generated_coding: List[Dict[str, Any]] = []
        generated_apex_blanks: List[Dict[str, Any]] = []

        job_payload = {
            "title": job.get("title"),
            "role": job.get("role"),
            "level": job.get("level"),
            "description": job.get("description") or "",
            "must_have_skills": job.get("must_have_skills") or [],
            "good_to_have_skills": job.get("good_to_have_skills") or [],
        }

        gen_ok = False
        gen_error: Optional[str] = None
        gen_started = time()
        try:
            from app.models.schemas import JobDescription as JobDescriptionModel

            if include_mcq and mcq_count > 0:
                jd = JobDescriptionModel(
                    id=str(job.get("id")),
                    title=str(job.get("title")),
                    role=job.get("role"),
                    level=job.get("level"),
                    description=str(job.get("description") or ""),
                    must_have_skills=job.get("must_have_skills") or [],
                    good_to_have_skills=job.get("good_to_have_skills") or [],
                    min_experience_years=int(job.get("min_experience_years") or 0),
                    is_active=True,
                )
                generated_mcqs = await qgen.generate_mcq_questions(jd, count=mcq_count, difficulty=difficulty)

            if is_apex_mode:
                if apex_blanks_count > 0:
                    generated_apex_blanks = await generate_apex_fill_in_the_blanks(
                        job=job_payload,
                        count=max(1, min(20, apex_blanks_count)),
                        difficulty=difficulty,
                    )
            elif include_coding and coding_count > 0:
                generated_coding = await _select_dsa_coding_challenges(db=bg_db, difficulty=difficulty, count=coding_count)

            if include_sql and sql_count > 0:
                sql_challenges = await qgen.generate_sql_challenges(
                    job=JobDescriptionModel(
                        id=str(job.get("id")),
                        title=str(job.get("title")),
                        role=job.get("role"),
                        level=job.get("level"),
                        description=str(job.get("description") or ""),
                        must_have_skills=job.get("must_have_skills") or [],
                        good_to_have_skills=job.get("good_to_have_skills") or [],
                        min_experience_years=int(job.get("min_experience_years") or 0),
                        is_active=True,
                    ),
                    count=sql_count,
                    difficulty=difficulty
                )

            gen_ok = True
        except Exception as e:
            gen_error = str(e)
        finally:
            logger.info(
                "[assessments.invite] generation_done ok=%s duration_s=%.3f",
                str(gen_ok),
                float(time() - gen_started),
            )

        # Update sessions with generation status/content
        for meta in session_meta:
            sid = meta["session_id"]
            try:
                def _fetch_pd():
                    return bg_db.client.from_("assessment_sessions").select("proctoring_data").eq("id", sid).single().execute()

                res = await bg_db.run(_fetch_pd)
                row = getattr(res, "data", None) or {}
                existing_pd = row.get("proctoring_data") if isinstance(row, dict) else {}
                if not isinstance(existing_pd, dict):
                    existing_pd = {}

                new_pd = {
                    **existing_pd,
                    "content_generation": {
                        "status": "ready" if gen_ok else "failed",
                        "completed_at": _utc_now_iso(),
                        "error": gen_error,
                    },
                }
                if gen_ok and is_apex_mode:
                    new_pd["assessment_content"] = {"apex_blanks": generated_apex_blanks}
                
                if gen_ok and include_sql and sql_count > 0:
                    if "assessment_content" not in new_pd:
                        new_pd["assessment_content"] = {}
                    new_pd["assessment_content"]["sql_challenges"] = sql_challenges

                def _update_session():
                    return (
                        bg_db.client.from_("assessment_sessions")
                        .update(
                            {
                                "mcq_questions": generated_mcqs if isinstance(generated_mcqs, list) else [],
                                "coding_challenges": generated_coding if isinstance(generated_coding, list) else [],
                                "proctoring_data": new_pd,
                                "updated_at": _utc_now_iso(),
                            }
                        )
                        .eq("id", sid)
                        .execute()
                    )

                await bg_db.run(_update_session)
            except Exception as e:
                logger.exception("[assessments.invite] session_update_failed session_id=%s error=%s", str(sid), str(e))

        if not gen_ok:
            logger.error("[assessments.invite] background_abort generation_failed error=%s", str(gen_error))
            return

        # Send emails after content is ready (never blocks invite API response)
        settings = get_settings()
        for meta in session_meta:
            sid = meta["session_id"]
            token = meta["token"]
            assessment_link = f"{str(settings.frontend_url).rstrip('/')}/assessment/{token}"
            try:
                recipient_email = str(meta.get("email") or "").strip()

                def _fetch_pd_email():
                    return (
                        bg_db.client.from_("assessment_sessions")
                        .select("proctoring_data")
                        .eq("id", sid)
                        .single()
                        .execute()
                    )

                pd_res = await bg_db.run(_fetch_pd_email)
                pd_row = getattr(pd_res, "data", None) or {}
                email_pd = pd_row.get("proctoring_data") if isinstance(pd_row, dict) else {}
                if not isinstance(email_pd, dict):
                    email_pd = {}

                def _mark_email_sending():
                    return (
                        bg_db.client.from_("assessment_sessions")
                        .update(
                            {
                                "proctoring_data": {
                                    **email_pd,
                                    "invite_delivery": {
                                        **(email_pd.get("invite_delivery") if isinstance(email_pd.get("invite_delivery"), dict) else {}),
                                        "status": "sending",
                                        "sending_at": _utc_now_iso(),
                                    },
                                },
                                "updated_at": _utc_now_iso(),
                            }
                        )
                        .eq("id", sid)
                        .execute()
                    )

                await bg_db.run(_mark_email_sending)

                send_started = time()
                if not recipient_email:
                    raise RuntimeError("Candidate email is missing")

                html, text, subject = email_queue.build_assessment_invite(
                    str(meta.get("candidate_name") or "Candidate"),
                    str(job.get("title") or ""),
                    assessment_link,
                    deadline_dt.strftime("%B %d, %Y at %I:%M %p UTC")
                )
                await email_queue.enqueue(
                    to_email=recipient_email,
                    subject=subject,
                    html_body=html,
                    text_body=text,
                    priority=Priority.HIGH
                )

                def _mark_email_ok():
                    return (
                        bg_db.client.from_("assessment_sessions")
                        .update(
                            {
                                "proctoring_data": {
                                    **email_pd,
                                    "invite_delivery": {
                                        **(email_pd.get("invite_delivery") if isinstance(email_pd.get("invite_delivery"), dict) else {}),
                                        "status": "sent",
                                        "sent_at": _utc_now_iso(),
                                    },
                                },
                                "updated_at": _utc_now_iso(),
                            }
                        )
                        .eq("id", sid)
                        .execute()
                    )

                await bg_db.run(_mark_email_ok)
                logger.info(
                    "[assessments.invite] email_sent session_id=%s duration_s=%.3f",
                    str(sid),
                    float(time() - send_started),
                )
            except Exception as e:
                logger.exception("[assessments.invite] email_failed session_id=%s error=%s", str(sid), str(e))
                try:
                    def _fetch_pd_fail():
                        return (
                            bg_db.client.from_("assessment_sessions")
                            .select("proctoring_data")
                            .eq("id", sid)
                            .single()
                            .execute()
                        )

                    pd_res = await bg_db.run(_fetch_pd_fail)
                    pd_row = getattr(pd_res, "data", None) or {}
                    fail_pd = pd_row.get("proctoring_data") if isinstance(pd_row, dict) else {}
                    if not isinstance(fail_pd, dict):
                        fail_pd = {}

                    def _mark_email_fail():
                        return (
                            bg_db.client.from_("assessment_sessions")
                            .update(
                                {
                                    "proctoring_data": {
                                        **fail_pd,
                                        "invite_delivery": {
                                            **(fail_pd.get("invite_delivery") if isinstance(fail_pd.get("invite_delivery"), dict) else {}),
                                            "status": "failed",
                                            "failed_at": _utc_now_iso(),
                                            "error": str(e),
                                        },
                                    },
                                    "updated_at": _utc_now_iso(),
                                }
                            )
                            .eq("id", sid)
                            .execute()
                        )

                    await bg_db.run(_mark_email_fail)
                except Exception:
                    pass

        logger.info(
            "[assessments.invite] background_done duration_s=%.3f",
            float(time() - bg_started),
        )

    asyncio.create_task(_generate_update_and_email())

    logger.info(
        "[assessments.invite] response_ready invites=%s duration_s=%.3f",
        str(invites_sent),
        float(time() - request_started),
    )
    return ok({"success": invites_sent > 0, "invites_sent": invites_sent, "failed": failed})


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_iso_dt(value: Any) -> datetime:
    if value is None:
        raise ValueError("missing datetime")
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def _get_expires_at_from_session(session: Dict[str, Any]) -> Optional[str]:
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str) and expires_at.strip():
        return expires_at
    pd = session.get("proctoring_data") if isinstance(session.get("proctoring_data"), dict) else {}
    pd_expires = pd.get("expires_at")
    return pd_expires if isinstance(pd_expires, str) and pd_expires.strip() else None


def _validate_assessment_content(session: Dict[str, Any]) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
    """Validate that assessment has valid content before allowing start.
    Returns (is_valid, error_message, repair_context).
    If repair_context is provided, the assessment can be auto-repaired instead of rejected."""
    proctoring_data = session.get("proctoring_data") if isinstance(session.get("proctoring_data"), dict) else {}
    assessment_config = proctoring_data.get("assessment_config") or {}
    assessment_mode = assessment_config.get("assessment_mode")
    is_apex_mode = assessment_mode == "apex"
    include_mcq = assessment_config.get("include_mcq") is not False
    include_coding = assessment_config.get("include_coding") is not False

    mcq_count_expected = int(session.get("mcq_question_count") or 0)
    coding_count_expected = int(session.get("coding_challenge_count") or 0)

    repair_context = {"needs_repair": False, "repairs": []}

    # Validate MCQ content
    if include_mcq and mcq_count_expected > 0:
        mcq_questions = session.get("mcq_questions") or []
        if not isinstance(mcq_questions, list) or len(mcq_questions) == 0:
            return False, "MCQ questions are not available for this session. Please ask the recruiter to resend the assessment.", None
        if len(mcq_questions) != mcq_count_expected:
            return False, f"MCQ question count mismatch. Expected {mcq_count_expected}, found {len(mcq_questions)}. Please ask the recruiter to resend the assessment.", None
        # Validate each MCQ has required fields
        for idx, q in enumerate(mcq_questions):
            if not isinstance(q, dict):
                return False, f"MCQ question {idx} is malformed.", None
            if not q.get("id"):
                return False, f"MCQ question {idx} is missing ID.", None
            if not q.get("question"):
                return False, f"MCQ question {idx} is missing question text.", None
            if not q.get("options") or not isinstance(q.get("options"), list):
                return False, f"MCQ question {idx} is missing options.", None
            if q.get("correct_index") is None:
                return False, f"MCQ question {idx} is missing correct_index.", None

    # Validate coding content - but mark for repair instead of hard-fail
    if include_coding and not is_apex_mode and coding_count_expected > 0:
        coding_challenges = session.get("coding_challenges") or []
        if not isinstance(coding_challenges, list) or len(coding_challenges) == 0:
            return False, "Coding challenges are not available for this session. Please ask the recruiter to resend the assessment.", None
        # Validate each coding challenge and mark for repair if needed
        for idx, c in enumerate(coding_challenges):
            if not isinstance(c, dict):
                return False, f"Coding challenge {idx} is malformed.", None
            if not c.get("id"):
                return False, f"Coding challenge {idx} is missing ID.", None
            if not c.get("title"):
                return False, f"Coding challenge {idx} is missing title.", None
            
            starter_code = c.get("starter_code") or {}
            if not isinstance(starter_code, dict) or not starter_code:
                repair_context["needs_repair"] = True
                repair_context["repairs"].append(f"Coding challenge {idx}: missing starter_code - will inject fallback")
            
            test_cases = c.get("test_cases") or []
            if not isinstance(test_cases, list) or not test_cases:
                repair_context["needs_repair"] = True
                repair_context["repairs"].append(f"Coding challenge {idx}: missing test cases - will inject fallback")
            else:
                public_tests = [tc for tc in test_cases if isinstance(tc, dict) and tc.get("visibility") == "public"]
                if not public_tests:
                    repair_context["needs_repair"] = True
                    repair_context["repairs"].append(f"Coding challenge {idx}: no public test cases - will inject fallback")

    # Validate Apex blanks
    if is_apex_mode:
        content = proctoring_data.get("assessment_content") or {}
        apex_blanks = content.get("apex_blanks") or []
        if not isinstance(apex_blanks, list) or len(apex_blanks) == 0:
            return False, "Apex questions are not available for this session. Please ask the recruiter to resend the assessment.", None

    if repair_context["needs_repair"]:
        logger.warning("[assessments.start] content_needs_repair session_id=%s repairs=%s", str(session.get("id")), str(repair_context["repairs"]))
        return True, None, repair_context

    return True, None, None


def _repair_coding_challenge(challenge: Dict[str, Any]) -> Dict[str, Any]:
    """Repair a coding challenge by injecting fallback test cases and starter code."""
    repaired = {**challenge}
    challenge_id = challenge.get("id", "unknown")
    title = challenge.get("title", "Untitled Challenge")
    
    # Repair starter code
    starter_code = challenge.get("starter_code")
    if not isinstance(starter_code, dict) or not starter_code:
        # Inject fallback starter code for common languages
        repaired["starter_code"] = {
            "python3": f"# {title}\ndef solution():\n    # Write your solution here\n    pass\n",
            "cpp": f"// {title}\n#include <iostream>\nusing namespace std;\nint main() {{\n    // Write your solution here\n    return 0;\n}}\n",
            "java": f"// {title}\npublic class Solution {{\n    public static void main(String[] args) {{\n        // Write your solution here\n    }}\n}}\n",
            "csharp": f"// {title}\npublic class Solution {{\n    public int Solve() {{\n        // Write your solution here\n        return 0;\n    }}\n}}\n",
        }
        logger.warning("[assessments.repair] injected_fallback_starter_code challenge_id=%s", str(challenge_id))
    else:
        # It's an existing dict, but might be missing C# or have JS
        repaired["starter_code"] = dict(starter_code)
        if "javascript" in repaired["starter_code"]:
            del repaired["starter_code"]["javascript"]
        if "typescript" in repaired["starter_code"]:
            del repaired["starter_code"]["typescript"]
            
        if "csharp" not in repaired["starter_code"] and "c#" not in repaired["starter_code"]:
            java_code = repaired["starter_code"].get("java", "")
            if java_code and "class Solution" in java_code:
                # Dynamically derive C# starter code from Java to preserve method signatures (like 2D arrays/lists)
                csharp_code = java_code.replace("String", "string").replace("boolean", "bool")
                csharp_code = csharp_code.replace("List<", "IList<").replace("Map<", "IDictionary<")
                csharp_code = csharp_code.replace("HashMap<", "Dictionary<").replace("ArrayList<", "List<")
                repaired["starter_code"]["csharp"] = csharp_code
            else:
                repaired["starter_code"]["csharp"] = f"// {title}\npublic class Solution {{\n    public int Solve() {{\n        // Write your solution here\n        return 0;\n    }}\n}}\n"
    
    # Repair test cases
    test_cases = challenge.get("test_cases") or []
    if not isinstance(test_cases, list) or not test_cases:
        # Inject fallback test cases
        repaired["test_cases"] = [
            {
                "id": f"{challenge_id}_public_1",
                "input": "1 2",
                "expected_output": "3",
                "visibility": "public",
            },
            {
                "id": f"{challenge_id}_hidden_1",
                "input": "5 5",
                "expected_output": "10",
                "visibility": "hidden",
            },
        ]
        logger.warning("[assessments.repair] injected_fallback_test_cases challenge_id=%s", str(challenge_id))
    else:
        # Check if public test cases exist, if not promote the first real test to public
        public_tests = [tc for tc in test_cases if isinstance(tc, dict) and tc.get("visibility") == "public"]
        if not public_tests:
            # Promote first test case to public so the runner actually sees real problem data
            repaired["test_cases"] = [
                {**test_cases[0], "visibility": "public"} if isinstance(test_cases[0], dict) else test_cases[0],
                *test_cases[1:],
            ]
            logger.warning("[assessments.repair] promoted_first_test_to_public challenge_id=%s", str(challenge_id))
    
    # Ensure supported_languages
    langs = repaired.get("supported_languages")
    if not langs or not isinstance(langs, list):
        repaired["supported_languages"] = ["python3", "cpp", "java", "csharp"]
        logger.warning("[assessments.repair] injected_fallback_languages challenge_id=%s", str(challenge_id))
    else:
        # Remove javascript from existing database records before sending to frontend
        repaired["supported_languages"] = [l for l in langs if l.lower() not in ("javascript", "typescript")]
        # Ensure csharp is available if it was missing from an old challenge
        if "csharp" not in repaired["supported_languages"] and "c#" not in repaired["supported_languages"]:
            repaired["supported_languages"].append("csharp")
    
    return repaired


async def _ensure_session_started(*, db, session: Dict[str, Any]) -> Dict[str, Any]:
    status = session.get("status")
    if status in ("completed", "terminated", "expired"):
        return session

    if status == "in_progress":
        return session

    if status != "pending":
        return session

    session_id = session.get("id")
    if not session_id:
        return session

    started_at = _utc_now_iso()
    total_time = int(session.get("total_time_minutes") or 90)
    try:
        started_dt = datetime.fromisoformat(str(started_at).replace("Z", "+00:00")).astimezone(timezone.utc)
    except Exception:
        started_dt = datetime.now(timezone.utc)
    expires_at = (started_dt + timedelta(minutes=total_time)).replace(microsecond=0).isoformat()

    existing_pd = session.get("proctoring_data") if isinstance(session.get("proctoring_data"), dict) else {}
    merged_pd = {
        **existing_pd,
        "started_at": started_at,
        "expires_at": expires_at,
        "time_limit_minutes": total_time,
    }

    def _update():
        return (
            db.client.from_("assessment_sessions")
            .update(
                {
                    "status": "in_progress",
                    "started_at": started_at,
                    "proctoring_data": merged_pd,
                    "updated_at": _utc_now_iso(),
                }
            )
            .eq("id", session_id)
            .eq("status", "pending")
            .execute()
        )

    try:
        updated_rows, db_err = await db.run_safe(
            _update,
            operation="update",
            table="assessment_sessions",
            context={"endpoint": "ensure_session_started", "session_id": str(session_id)},
        )
        if db_err:
            logger.error("[assessments.lifecycle] session_start_db_error session_id=%s error=%s", str(session_id), str(db_err.message))
            return session
        if isinstance(updated_rows, list) and updated_rows:
            logger.info(
                "[assessments.lifecycle] session_started session_id=%s started_at=%s expires_at=%s duration_minutes=%s",
                str(session_id),
                str(started_at),
                str(expires_at),
                str(total_time),
            )
            return updated_rows[0]
    except Exception as e:
        logger.error("[assessments.lifecycle] session_start_failed session_id=%s error=%s", str(session_id), str(e))

    return session


def _ensure_in_progress_or_error(session: Dict[str, Any]):
    status = session.get("status")
    if status in ("completed", "terminated", "expired"):
        return api_error(message="Assessment not available", status_code=400)
    # Allow pending sessions to proceed; endpoints should call _ensure_session_started
    if status not in ("pending", "in_progress"):
        return api_error(message="Invalid session", status_code=400)
    return None


def _weighted_mcq_score(stored_questions: List[Dict[str, Any]], submissions: List[Dict[str, Any]]):
    difficulty_weight = {"easy": 1, "medium": 2, "hard": 3}
    # Index submissions by question_id for O(1) lookup
    smap = {str(s.get("question_id") or ""): s for s in submissions if isinstance(s, dict)}

    total_weighted_points = 0.0
    scored_weighted_points = 0.0
    correct_count = 0
    total_count = 0
    detailed_results: List[Dict[str, Any]] = []

    # Iterate over ALL stored questions so unattempted ones count toward the total
    for q in stored_questions:
        if not isinstance(q, dict):
            continue
        qid = str(q.get("id") or "")
        if not qid:
            continue

        total_count += 1
        base_points = q.get("points")
        try:
            base_points_f = float(base_points if base_points is not None else 5)
        except Exception:
            base_points_f = 5
        weight = difficulty_weight.get(str(q.get("difficulty") or "medium").lower(), 2)
        weighted_points = base_points_f * float(weight)
        total_weighted_points += weighted_points

        s = smap.get(qid)
        selected_index = s.get("selected_index") if s else None
        correct_index = q.get("correct_index")
        # Unattempted (selected_index is None) is treated as incorrect.
        # Cast to int to guard against string/float selected_index from JSON payload.
        try:
            is_correct = selected_index is not None and int(selected_index) == int(correct_index)
        except (TypeError, ValueError):
            is_correct = False
        if is_correct:
            scored_weighted_points += weighted_points
            correct_count += 1

        detailed_results.append(
            {
                "question_id": q.get("id"),
                "question": q.get("question"),
                "options": q.get("options"),
                "selected_index": selected_index,
                "correct_index": correct_index,
                "explanation": q.get("explanation") or "",
                "is_correct": bool(is_correct),
                "difficulty": q.get("difficulty"),
                "topic": q.get("topic"),
                "points_possible": weighted_points,
                "points_earned": weighted_points if is_correct else 0,
            }
        )

    percentage = (scored_weighted_points / total_weighted_points * 100) if total_weighted_points > 0 else 0
    return {
        "score": float(percentage),
        "correct_count": int(correct_count),
        "total_count": int(total_count),
        "weighted_points_earned": float(scored_weighted_points),
        "weighted_points_possible": float(total_weighted_points),
        "results": detailed_results,
    }


@router.post("/{session_id}/mcq/submit")
async def submit_mcq(session_id: str, submissions: List[Dict[str, Any]] = Body(...)):
    db = get_db_admin_service()
    sessions, db_err = await db.select_safe(
        "assessment_sessions",
        columns="id,status,mcq_questions",
        filters={"id": session_id},
        limit=1,
        context={"endpoint": "mcq_submit", "session_id": str(session_id)},
    )
    if db_err:
        logger.error("[assessments.mcq_submit] db_error session_id=%s error=%s", str(session_id), str(db_err.message))
        return api_error(message="Database error. Please try again.", status_code=500)
    session = sessions[0] if sessions else None
    if not session:
        logger.error("[assessments.mcq_submit] session_not_found session_id=%s", str(session_id))
        return api_error(message="Session not found", status_code=404)

    session = await _ensure_session_started(db=db, session=session)

    err = _ensure_in_progress_or_error(session)
    if err:
        return err

    stored = session.get("mcq_questions") or []
    if not isinstance(stored, list) or not stored:
        logger.error("[assessments.mcq_submit] no_questions session_id=%s", str(session_id))
        return api_error(message="Questions not found for this session", status_code=400)

    if not isinstance(submissions, list):
        logger.warning("[assessments.mcq_submit] invalid_payload session_id=%s submissions_type=%s", str(session_id), str(type(submissions)))
        return api_error(message="Invalid submissions payload", status_code=400)

    logger.info(
        "[assessments.mcq_submit] submission_start session_id=%s submission_count=%s question_count=%s",
        str(session_id),
        str(len(submissions)),
        str(len(stored)),
    )

    score_payload = _weighted_mcq_score(stored, submissions)

    updated_rows, db_err = await db.update_safe(
        "assessment_sessions",
        {
            "mcq_submissions": score_payload["results"],
            "mcq_score": score_payload["score"],
            "updated_at": _utc_now_iso(),
        },
        filters={"id": session_id},
        context={"endpoint": "mcq_submit", "session_id": str(session_id)},
    )
    if db_err:
        logger.error("[assessments.mcq_submit] db_update_error session_id=%s error=%s", str(session_id), str(db_err.message))
        return api_error(message="Failed to save MCQ answers. Please try again.", status_code=500)

    logger.info(
        "[assessments.mcq_submit] submission_persisted session_id=%s score=%.2f correct_count=%s total_count=%s",
        str(session_id),
        float(score_payload["score"]),
        str(score_payload["correct_count"]),
        str(score_payload["total_count"]),
    )

    return ok(
        {
            "success": True,
            "score": score_payload["score"],
            "correct_count": score_payload["correct_count"],
            "total_count": score_payload["total_count"],
            "weighted_points_earned": score_payload["weighted_points_earned"],
            "weighted_points_possible": score_payload["weighted_points_possible"],
            "results": score_payload["results"],
        }
    )


@router.post("/{session_id}/coding/run")
async def coding_run(session_id: str, body: Dict[str, Any] = Body(...)):
    if not _check_rate_limit(f"run:{session_id}", max_per_minute=10):
        logger.warning("[assessments.coding_run] rate_limit_exceeded session_id=%s", str(session_id))
        return api_error(message="Rate limit exceeded. Maximum 10 runs per minute.", status_code=429)

    db = get_db_admin_service()
    sessions, db_err = await db.select_safe(
        "assessment_sessions",
        columns="id,status,coding_challenges,proctoring_data",
        filters={"id": session_id},
        limit=1,
        context={"endpoint": "coding_run", "session_id": str(session_id)},
    )
    if db_err:
        logger.error("[assessments.coding_run] db_error session_id=%s error=%s", str(session_id), str(db_err.message))
        return api_error(message="Database error. Please try again.", status_code=500)
    session = sessions[0] if sessions else None
    if not session:
        logger.error("[assessments.coding_run] session_not_found session_id=%s", str(session_id))
        return api_error(message="Session not found", status_code=404)

    session = await _ensure_session_started(db=db, session=session)

    err = _ensure_in_progress_or_error(session)
    if err:
        return err

    challenge_id = body.get("challenge_id")
    code = body.get("code")
    language = body.get("language") or "python3"
    if not challenge_id or not isinstance(code, str):
        logger.warning("[assessments.coding_run] invalid_payload session_id=%s challenge_id=%s has_code=%s", str(session_id), str(challenge_id), bool(code))
        return api_error(message="challenge_id and code are required", status_code=400)

    logger.info(
        "[assessments.coding_run] execution_start session_id=%s challenge_id=%s language=%s code_length=%s",
        str(session_id),
        str(challenge_id),
        str(language),
        str(len(code)),
    )

    problem = None
    is_sql_challenge = False
    
    coding_challenges = session.get("coding_challenges") or []
    proctoring_data = session.get("proctoring_data") if isinstance(session.get("proctoring_data"), dict) else {}
    assessment_content = proctoring_data.get("assessment_content") if isinstance(proctoring_data.get("assessment_content"), dict) else {}
    sql_challenges = assessment_content.get("sql_challenges") or []
    
    for ch in sql_challenges:
        if ch.get("id") == challenge_id:
            problem = ch
            is_sql_challenge = True
            break
            
    if not problem:
        for ch in coding_challenges:
            if ch.get("id") == challenge_id:
                problem = ch
                break
            
    if not problem:
        def _fetch_problem():
            return db.client.from_("dsa_problems").select("*").eq("id", challenge_id).single().execute()

        prob_res = await db.run(_fetch_problem)
        problem = getattr(prob_res, "data", None)

    if not isinstance(problem, dict):
        logger.error("[assessments.coding_run] problem_not_found session_id=%s challenge_id=%s", str(session_id), str(challenge_id))
        return api_error(message="Problem not found", status_code=400)

    if is_sql_challenge:
        from app.services.sql_executor import SQLExecutor
        meta = problem.get("metadata", {})
        db_schema = meta.get("db_schema", "")
        sample_data = meta.get("sample_data", "")
        expected_query = meta.get("expected_query", "")
        
        # For 'run', we just evaluate the query
        candidate_result, cand_err, exec_time = SQLExecutor.execute_query(db_schema, sample_data, code)
        eval_result = SQLExecutor.evaluate_submission(db_schema, sample_data, code, expected_query)
        is_success = eval_result.get("score", 0) == 100
        stdout_str = json.dumps(candidate_result, indent=2) if candidate_result else ""
        
        results_out = [{
            "test_case_id": "sql_test",
            "input": "Database Schema + Sample Data",
            "expected_output": "Expected Query Results",
            "actual_output": stdout_str if not cand_err else "Error",
            "passed": is_success,
            "status": "Accepted" if is_success else "Wrong Answer",
            "time_used": eval_result.get("time_taken_seconds", 0),
            "memory_used": 0,
            "error": cand_err or eval_result.get("feedback", ""),
            "stdout": stdout_str,
            "stderr": cand_err
        }]
        
        return ok({
            "success": is_success,
            "compilation_error": None,
            "runtime_error": cand_err if cand_err else None,
            "results": results_out,
            "passed": 1 if is_success else 0,
            "total": 1,
            "score_percentage": eval_result.get("score", 0)
        })

    problem = await _ensure_problem_execution_metadata(db=db, problem=problem, language=str(language))

    all_tests = problem.get("test_cases") or []
    if not isinstance(all_tests, list):
        all_tests = []
    public_tests = [tc for tc in all_tests if isinstance(tc, dict) and tc.get("visibility") == "public"]
    if not public_tests:
        # Fall back to first 3 test cases regardless of visibility (run mode shows all)
        public_tests = [tc for tc in all_tests if isinstance(tc, dict)][:3]
    if not public_tests:
        logger.error("[assessments.coding_run] no_test_cases session_id=%s challenge_id=%s", str(session_id), str(challenge_id))
        return api_error(message="No test cases available for this problem", status_code=400)

    def _maybe_parse_json_string(v: Any) -> Any:
        if not isinstance(v, str):
            return v
        s = v.strip()
        if not s:
            return v
        if not ((s.startswith("{") and s.endswith("}")) or (s.startswith("[") and s.endswith("]")) or (s.startswith('"') and s.endswith('"'))):
            return v
        try:
            return json.loads(s)
        except Exception:
            return v

    def _normalize_value(v: Any, *, _depth: int = 0) -> Any:
        if _depth > 5:
            return v
        # repeatedly parse JSON-strings until stable
        if isinstance(v, str):
            parsed = _maybe_parse_json_string(v)
            if parsed is not v:
                return _normalize_value(parsed, _depth=_depth + 1)
            return v
        if isinstance(v, list):
            return [_normalize_value(x, _depth=_depth + 1) for x in v]
        if isinstance(v, dict):
            return {str(k): _normalize_value(val, _depth=_depth + 1) for k, val in v.items()}
        return v

    def _parse_input(value: Any) -> Dict[str, Any]:
        normalized = _normalize_value(value)
        if normalized is None:
            return {}
        # If we already have a dict, use it directly
        if isinstance(normalized, dict):
            # Unwrap common double-serialization shape: {"input": "{...}"} -> {...}
            if set(normalized.keys()) == {"input"}:
                inner = _normalize_value(normalized.get("input"))
                if isinstance(inner, dict):
                    return inner
                return {"input": inner}
            return normalized
        # For arrays/primitives, wrap in dict for the executor
        return {"input": normalized}

    def _parse_expected(value: Any) -> Any:
        return _normalize_value(value)

    wrappers = problem.get("solution_wrappers") or {}
    if not isinstance(wrappers, dict):
        wrappers = {}

    meta = wrappers.get("__meta")
    if not isinstance(meta, dict):
        meta = {}

    execution_mode = meta.get("execution_mode")
    class_name = meta.get("class_name")
    parameter_schema = meta.get("parameter_schema")
    _raw_wrapper = wrappers.get(str(language)) or wrappers.get(str(language).lower())
    # Only use DB wrapper_template if it's a proper custom harness (contains {{CODE}} placeholder).
    # Old auto-generated stubs with org.json/nlohmann are discarded in favour of built-in harnesses.
    wrapper_template = _raw_wrapper if (isinstance(_raw_wrapper, str) and "{{CODE}}" in _raw_wrapper) else None

    # Get function_name from (possibly backfilled) problem metadata.
    # For interpreted languages (Python only) function_name is optional — runner auto-detects.
    function_name = problem.get("function_name") or problem.get("method_name") or ""
    interpreted_langs = {"python3", "python"}
    if not function_name and str(language).lower() not in interpreted_langs:
        logger.warning(
            "[assessments.coding_run] function_name_missing session_id=%s challenge_id=%s language=%s",
            str(session_id), str(challenge_id), str(language),
        )

    executor = _get_executor()
    exec_started = time()
    exec_result = await executor.execute(
        code=code,
        test_cases=[
            {
                "input": _parse_input(tc.get("input")),
                "expected": _parse_expected(tc.get("expected_output") or tc.get("expected")),
            }
            for tc in public_tests
            if isinstance(tc, dict)
        ],
        language=str(language),
        function_name=str(function_name),
        execution_mode=str(execution_mode) if execution_mode else None,
        class_name=str(class_name) if class_name else None,
        parameter_schema=parameter_schema if isinstance(parameter_schema, list) else None,
        wrapper_template=wrapper_template if isinstance(wrapper_template, str) else None,
    )
    exec_duration = time() - exec_started

    logger.info(
        "[assessments.coding_run] execution_complete session_id=%s challenge_id=%s duration_s=%.3f passed=%s total=%s success=%s",
        str(session_id),
        str(challenge_id),
        float(exec_duration),
        str(exec_result.passed_count),
        str(exec_result.total_count),
        str(exec_result.success),
    )

    # Map to Node response shape
    compilation_error = exec_result.compilation_error
    runtime_error = exec_result.runtime_error

    results_out: List[Dict[str, Any]] = []
    for idx, r in enumerate(exec_result.test_results):
        results_out.append(
            {
                "test_case_id": public_tests[idx].get("id") if idx < len(public_tests) else None,
                "input": r.input_data,
                "expected_output": r.expected,
                "actual_output": r.actual,
                "passed": r.passed,
                "status": r.status,
                "time_used": r.time_used,
                "memory_used": r.memory_used,
                "error": r.error,
                "stdout": r.stdout,
                "stderr": r.stderr,
            }
        )

    return ok(
        {
            "success": bool(compilation_error is None and runtime_error is None),
            "compilation_error": compilation_error,
            "runtime_error": runtime_error,
            "results": results_out,
            "passed": exec_result.passed_count,
            "total": exec_result.total_count,
            "score_percentage": exec_result.score_percentage,
        }
    )


@router.post("/{session_id}/coding/submit")
async def coding_submit(session_id: str, body: Dict[str, Any] = Body(...)):
    if not _check_rate_limit(f"submit:{session_id}", max_per_minute=5):
        logger.warning("[assessments.coding_submit] rate_limit_exceeded session_id=%s", str(session_id))
        return api_error(message="Rate limit exceeded. Maximum 5 submissions per minute.", status_code=429)

    db = get_db_admin_service()
    sessions, db_err = await db.select_safe(
        "assessment_sessions",
        columns="id,status,coding_submissions,coding_score,coding_challenges,proctoring_data",
        filters={"id": session_id},
        limit=1,
        context={"endpoint": "coding_submit", "session_id": str(session_id)},
    )
    if db_err:
        logger.error("[assessments.coding_submit] db_error session_id=%s error=%s", str(session_id), str(db_err.message))
        return api_error(message="Database error. Please try again.", status_code=500)
    session = sessions[0] if sessions else None
    if not session:
        logger.error("[assessments.coding_submit] session_not_found session_id=%s", str(session_id))
        return api_error(message="Session not found", status_code=404)

    session = await _ensure_session_started(db=db, session=session)

    err = _ensure_in_progress_or_error(session)
    if err:
        return err

    challenge_id = body.get("challenge_id")
    code = body.get("code")
    language = body.get("language") or "python3"
    if not challenge_id or not isinstance(code, str):
        logger.warning("[assessments.coding_submit] invalid_payload session_id=%s challenge_id=%s has_code=%s", str(session_id), str(challenge_id), bool(code))
        return api_error(message="challenge_id and code are required", status_code=400)

    logger.info(
        "[assessments.coding_submit] submission_start session_id=%s challenge_id=%s language=%s code_length=%s",
        str(session_id),
        str(challenge_id),
        str(language),
        str(len(code)),
    )

    problem = None
    is_sql_challenge = False
    
    coding_challenges = session.get("coding_challenges") or []
    proctoring_data = session.get("proctoring_data") if isinstance(session.get("proctoring_data"), dict) else {}
    assessment_content = proctoring_data.get("assessment_content") if isinstance(proctoring_data.get("assessment_content"), dict) else {}
    sql_challenges = assessment_content.get("sql_challenges") or []
    
    for ch in sql_challenges:
        if ch.get("id") == challenge_id:
            problem = ch
            is_sql_challenge = True
            break
            
    if not problem:
        for ch in coding_challenges:
            if ch.get("id") == challenge_id:
                problem = ch
                break
            
    if not problem:
        def _fetch_problem():
            return db.client.from_("dsa_problems").select("*").eq("id", challenge_id).single().execute()

        prob_res = await db.run(_fetch_problem)
        problem = getattr(prob_res, "data", None)

    if not isinstance(problem, dict):
        return api_error(message="Problem not found", status_code=400)

    if is_sql_challenge:
        from app.services.sql_executor import SQLExecutor
        meta = problem.get("metadata", {})
        db_schema = meta.get("db_schema", "")
        sample_data = meta.get("sample_data", "")
        expected_query = meta.get("expected_query", "")
        
        candidate_result, cand_err, exec_time = SQLExecutor.execute_query(db_schema, sample_data, code)
        eval_result = SQLExecutor.evaluate_submission(db_schema, sample_data, code, expected_query)
        is_success = eval_result.get("score", 0) == 100
        stdout_str = json.dumps(candidate_result, indent=2) if candidate_result else ""
        
        submission = {
            "challenge_id": challenge_id,
            "problem_slug": "sql-challenge",
            "code": code,
            "language": "sql",
            "test_results": [{
                "test_case_id": "sql_test",
                "is_hidden": False,
                "input": "Database Schema + Sample Data",
                "expected_output": "Expected Query Results",
                "actual_output": stdout_str if not cand_err else "Error",
                "passed": is_success,
                "status": "Accepted" if is_success else "Wrong Answer",
                "time_used": eval_result.get("time_taken_seconds", 0),
                "memory_used": 0,
                "error": cand_err or eval_result.get("feedback", ""),
                "stdout": stdout_str,
                "stderr": cand_err
            }],
            "passed_count": 1 if is_success else 0,
            "total_tests": 1,
            "score_percentage": eval_result.get("score", 0),
            "submitted_at": _utc_now_iso(),
            "compilation_error": None,
            "runtime_error": cand_err if cand_err else None,
        }
        
        existing = proctoring_data.get("sql_submissions")
        existing_list = existing if isinstance(existing, list) else []
        existing_list = list(existing_list)
        idx = next((i for i, s in enumerate(existing_list) if isinstance(s, dict) and s.get("challenge_id") == challenge_id), -1)
        if idx >= 0:
            existing_list[idx] = submission
        else:
            existing_list.append(submission)

        scores = [float(s.get("score_percentage") or 0) for s in existing_list if isinstance(s, dict)]
        sql_score = sum(scores) / len(scores) if scores else float(eval_result.get("score", 0))
        
        new_pd = dict(proctoring_data)
        new_pd["sql_submissions"] = existing_list
        new_pd["sql_score"] = sql_score

        updated_rows, db_err = await db.update_safe(
            "assessment_sessions",
            {"proctoring_data": new_pd, "updated_at": _utc_now_iso()},
            filters={"id": session_id},
            context={"endpoint": "coding_submit", "session_id": str(session_id), "challenge_id": str(challenge_id)},
        )
        if db_err:
            logger.error("[assessments.coding_submit] db_update_error session_id=%s error=%s", str(session_id), str(db_err.message))
            return api_error(message="Failed to save code submission. Please try again.", status_code=500)

        return ok({
            "success": True,
            "challenge_id": challenge_id,
            "test_results": submission["test_results"],
            "passed_count": submission["passed_count"],
            "total_tests": submission["total_tests"],
            "score_percentage": submission["score_percentage"],
            "hidden_tests_passed": 0,
            "hidden_tests_total": 0,
            "compilation_error": None,
            "runtime_error": cand_err if cand_err else None,
        })

    problem = await _ensure_problem_execution_metadata(db=db, problem=problem, language=str(language))

    all_tests = problem.get("test_cases") or []
    if not isinstance(all_tests, list):
        all_tests = []
    total_tests = len(all_tests)
    if total_tests == 0:
        return api_error(message="No test cases available", status_code=400)

    def _maybe_parse_json_string(v: Any) -> Any:
        if not isinstance(v, str):
            return v
        s = v.strip()
        if not s:
            return v
        if not ((s.startswith("{") and s.endswith("}")) or (s.startswith("[") and s.endswith("]")) or (s.startswith('"') and s.endswith('"'))):
            return v
        try:
            return json.loads(s)
        except Exception:
            return v

    def _normalize_value(v: Any, *, _depth: int = 0) -> Any:
        if _depth > 5:
            return v
        if isinstance(v, str):
            parsed = _maybe_parse_json_string(v)
            if parsed is not v:
                return _normalize_value(parsed, _depth=_depth + 1)
            return v
        if isinstance(v, list):
            return [_normalize_value(x, _depth=_depth + 1) for x in v]
        if isinstance(v, dict):
            return {str(k): _normalize_value(val, _depth=_depth + 1) for k, val in v.items()}
        return v

    def _parse_input(value: Any) -> Dict[str, Any]:
        normalized = _normalize_value(value)
        if normalized is None:
            return {}
        if isinstance(normalized, dict):
            if set(normalized.keys()) == {"input"}:
                inner = _normalize_value(normalized.get("input"))
                if isinstance(inner, dict):
                    return inner
                return {"input": inner}
            return normalized
        return {"input": normalized}

    def _parse_expected(value: Any) -> Any:
        return _normalize_value(value)

    wrappers = problem.get("solution_wrappers") or {}
    if not isinstance(wrappers, dict):
        wrappers = {}

    meta = wrappers.get("__meta")
    if not isinstance(meta, dict):
        meta = {}

    execution_mode = meta.get("execution_mode")
    class_name = meta.get("class_name")
    parameter_schema = meta.get("parameter_schema")
    _raw_wrapper = wrappers.get(str(language)) or wrappers.get(str(language).lower())
    wrapper_template = _raw_wrapper if (isinstance(_raw_wrapper, str) and "{{CODE}}" in _raw_wrapper) else None

    # Get function_name from (possibly backfilled) problem metadata.
    # For interpreted languages (Python only) function_name is optional — runner auto-detects.
    function_name = problem.get("function_name") or problem.get("method_name") or ""
    interpreted_langs = {"python3", "python"}
    if not function_name and str(language).lower() not in interpreted_langs:
        logger.warning(
            "[assessments.coding_submit] function_name_missing session_id=%s challenge_id=%s language=%s",
            str(session_id), str(challenge_id), str(language),
        )

    executor = _get_executor()
    exec_started = time()
    exec_result = await executor.execute(
        code=code,
        test_cases=[
            {
                "input": _parse_input(tc.get("input")),
                "expected": _parse_expected(tc.get("expected_output") or tc.get("expected")),
            }
            for tc in all_tests
            if isinstance(tc, dict)
        ],
        language=str(language),
        function_name=str(function_name),
        execution_mode=str(execution_mode) if execution_mode else None,
        class_name=str(class_name) if class_name else None,
        parameter_schema=parameter_schema if isinstance(parameter_schema, list) else None,
        wrapper_template=wrapper_template if isinstance(wrapper_template, str) else None,
    )
    exec_duration = time() - exec_started

    logger.info(
        "[assessments.coding_submit] execution_complete session_id=%s challenge_id=%s duration_s=%.3f passed=%s total=%s success=%s",
        str(session_id),
        str(challenge_id),
        float(exec_duration),
        str(exec_result.passed_count),
        str(exec_result.total_count),
        str(exec_result.success),
    )

    # Build submission record
    submission = {
        "challenge_id": challenge_id,
        "problem_slug": problem.get("slug"),
        "code": code,
        "language": language,
        "test_results": [
            {
                "test_case_id": all_tests[i].get("id") if i < len(all_tests) else None,
                "is_hidden": (i < len(all_tests) and isinstance(all_tests[i], dict) and all_tests[i].get("visibility") == "hidden"),
                "input": None if (i < len(all_tests) and isinstance(all_tests[i], dict) and all_tests[i].get("visibility") == "hidden") else r.input_data,
                "expected_output": None if (i < len(all_tests) and isinstance(all_tests[i], dict) and all_tests[i].get("visibility") == "hidden") else r.expected,
                "actual_output": r.actual,
                "passed": r.passed,
                "status": r.status,
                "time_used": r.time_used,
                "memory_used": r.memory_used,
                "error": r.error,
                "stdout": r.stdout,
                "stderr": r.stderr,
            }
            for i, r in enumerate(exec_result.test_results)
        ],
        "passed_count": exec_result.passed_count,
        "total_tests": exec_result.total_count,
        "score_percentage": exec_result.score_percentage,
        "submitted_at": _utc_now_iso(),
        "compilation_error": exec_result.compilation_error,
        "runtime_error": exec_result.runtime_error,
    }

    existing = session.get("coding_submissions")
    existing_list = existing if isinstance(existing, list) else []
    existing_list = list(existing_list)
    idx = next((i for i, s in enumerate(existing_list) if isinstance(s, dict) and s.get("challenge_id") == challenge_id), -1)
    if idx >= 0:
        existing_list[idx] = submission
    else:
        existing_list.append(submission)

    # Compute coding score as average across submissions (Node-compatible, but simplified)
    scores = [float(s.get("score_percentage") or 0) for s in existing_list if isinstance(s, dict)]
    coding_score = sum(scores) / len(scores) if scores else float(exec_result.score_percentage)

    updated_rows, db_err = await db.update_safe(
        "assessment_sessions",
        {"coding_submissions": existing_list, "coding_score": coding_score, "updated_at": _utc_now_iso()},
        filters={"id": session_id},
        context={"endpoint": "coding_submit", "session_id": str(session_id), "challenge_id": str(challenge_id)},
    )
    if db_err:
        logger.error("[assessments.coding_submit] db_update_error session_id=%s error=%s", str(session_id), str(db_err.message))
        return api_error(message="Failed to save code submission. Please try again.", status_code=500)

    logger.info(
        "[assessments.coding_submit] submission_persisted session_id=%s challenge_id=%s coding_score=%.2f total_submissions=%s",
        str(session_id),
        str(challenge_id),
        float(coding_score),
        str(len(existing_list)),
    )

    hidden_total = len([tc for tc in all_tests if isinstance(tc, dict) and tc.get("visibility") == "hidden"])
    hidden_passed = 0
    for i, r in enumerate(exec_result.test_results):
        if i < len(all_tests) and isinstance(all_tests[i], dict) and all_tests[i].get("visibility") == "hidden" and r.passed:
            hidden_passed += 1

    return ok(
        {
            "success": True,
            "challenge_id": challenge_id,
            "test_results": submission["test_results"],
            "passed_count": exec_result.passed_count,
            "total_tests": exec_result.total_count,
            "score_percentage": exec_result.score_percentage,
            "hidden_tests_passed": hidden_passed,
            "hidden_tests_total": hidden_total,
            "compilation_error": exec_result.compilation_error,
            "runtime_error": exec_result.runtime_error,
        }
    )


@router.post("/{session_id}/proctoring")
async def proctoring(session_id: str, event: Dict[str, Any] = Body(...)):
    db = get_db_admin_service()
    sessions = await db.select(
        "assessment_sessions",
        columns="id,status,proctoring_data",
        filters={"id": session_id},
        limit=1,
    )
    session = sessions[0] if sessions else None
    if not session:
        return api_error(message="Session not found", status_code=404)

    proctoring_data = session.get("proctoring_data") if isinstance(session.get("proctoring_data"), dict) else {}

    et = event.get("event_type")
    if et == "tab_switch":
        proctoring_data["tab_switches"] = int(proctoring_data.get("tab_switches") or 0) + 1
    elif et == "fullscreen_exit":
        proctoring_data["fullscreen_exits"] = int(proctoring_data.get("fullscreen_exits") or 0) + 1
    elif et == "window_blur":
        proctoring_data["window_blurs"] = int(proctoring_data.get("window_blurs") or 0) + 1
    elif et == "copy_paste":
        proctoring_data["copy_paste_attempts"] = int(proctoring_data.get("copy_paste_attempts") or 0) + 1
    elif et == "right_click":
        proctoring_data["right_click_attempts"] = int(proctoring_data.get("right_click_attempts") or 0) + 1
    elif et == "face_not_detected":
        proctoring_data["face_detection_failures"] = int(proctoring_data.get("face_detection_failures") or 0) + 1
    elif et == "devtools_open":
        proctoring_data["devtools_attempts"] = int(proctoring_data.get("devtools_attempts") or 0) + 1

    warnings = proctoring_data.get("warnings")
    if not isinstance(warnings, list):
        warnings = []
    is_critical = et in ("tab_switch", "fullscreen_exit", "window_blur")
    warnings.append(
        {
            "type": et,
            "timestamp": event.get("timestamp") or _utc_now_iso(),
            "details": event.get("details"),
            "severity": "critical" if is_critical else "warning",
        }
    )
    proctoring_data["warnings"] = warnings

    # STRICT termination logic (Node-compatible)
    should_terminate = False
    termination_reason = ""
    if is_critical:
        should_terminate = True
        termination_reason = f"Assessment terminated: {str(et).replace('_', ' ')} detected. This is a strict proctoring violation."
    elif int(proctoring_data.get("face_detection_failures") or 0) >= 3:
        should_terminate = True
        termination_reason = "Assessment terminated: Face not visible 3 times."
    else:
        minor = (
            int(proctoring_data.get("copy_paste_attempts") or 0)
            + int(proctoring_data.get("right_click_attempts") or 0)
            + int(proctoring_data.get("devtools_attempts") or 0)
        )
        if minor >= 3:
            should_terminate = True
            termination_reason = "Assessment terminated: Too many proctoring violations."

    if should_terminate:
        proctoring_data["terminated"] = True
        proctoring_data["termination_reason"] = termination_reason
        await db.update(
            "assessment_sessions",
            {
                "proctoring_data": proctoring_data,
                "status": "terminated",
                "completed_at": _utc_now_iso(),
                "mcq_score": 0,
                "coding_score": 0,
                "total_score": 0,
                "updated_at": _utc_now_iso(),
            },
            filters={"id": session_id},
        )
        return ok({"warning": False, "terminated": True, "message": termination_reason, "violations_remaining": 0})

    minor = (
        int(proctoring_data.get("copy_paste_attempts") or 0)
        + int(proctoring_data.get("right_click_attempts") or 0)
        + int(proctoring_data.get("devtools_attempts") or 0)
    )
    await db.update(
        "assessment_sessions",
        {"proctoring_data": proctoring_data, "updated_at": _utc_now_iso()},
        filters={"id": session_id},
    )
    return ok(
        {
            "warning": True,
            "terminated": False,
            "violations_remaining": max(0, 3 - minor),
            "message": "Warning: Proctoring violation recorded. Repeated violations will terminate your assessment.",
            "event_type": et,
        }
    )


@router.post("/{session_id}/complete")
async def complete(session_id: str):
    db = get_db_admin_service()
    sessions, db_err = await db.select_safe(
        "assessment_sessions",
        columns="id,status,mcq_score,coding_score,started_at",
        filters={"id": session_id},
        limit=1,
        context={"endpoint": "complete", "session_id": str(session_id)},
    )
    if db_err:
        logger.error("[assessments.complete] db_error session_id=%s error=%s", str(session_id), str(db_err.message))
        return api_error(message="Database error. Please try again.", status_code=500)
    session = sessions[0] if sessions else None
    if not session:
        logger.error("[assessments.complete] session_not_found session_id=%s", str(session_id))
        return api_error(message="Session not found", status_code=404)

    session = await _ensure_session_started(db=db, session=session)

    current_status = session.get("status")
    if current_status not in ("in_progress", "pending"):
        logger.warning("[assessments.complete] invalid_status session_id=%s status=%s", str(session_id), str(current_status))
        return api_error(message="Assessment not in progress", status_code=400)

    logger.info(
        "[assessments.complete] completion_start session_id=%s status=%s mcq_score=%s coding_score=%s",
        str(session_id),
        str(current_status),
        str(session.get("mcq_score")),
        str(session.get("coding_score")),
    )

    if session.get("status") == "pending":
        await db.update(
            "assessment_sessions",
            {"status": "in_progress", "started_at": session.get("started_at") or _utc_now_iso(), "updated_at": _utc_now_iso()},
            filters={"id": session_id},
        )

    mcq_val = float(session.get("mcq_score") or 0)
    coding_raw = session.get("coding_score")
    coding_val = float(coding_raw) if coding_raw is not None else None

    if coding_val is None:
        total_score = mcq_val
    elif session.get("mcq_score") is None:
        total_score = coding_val
    else:
        total_score = (mcq_val + coding_val) / 2

    updated_rows, db_err = await db.update_safe(
        "assessment_sessions",
        {
            "status": "completed",
            "completed_at": _utc_now_iso(),
            "mcq_score": mcq_val,
            "coding_score": coding_val,
            "total_score": total_score,
            "updated_at": _utc_now_iso(),
        },
        filters={"id": session_id},
        context={"endpoint": "complete", "session_id": str(session_id)},
    )
    if db_err:
        logger.error("[assessments.complete] db_update_error session_id=%s error=%s", str(session_id), str(db_err.message))
        return api_error(message="Failed to complete assessment. Please try again.", status_code=500)

    logger.info(
        "[assessments.complete] completion_complete session_id=%s total_score=%.2f mcq_score=%.2f coding_score=%.2f",
        str(session_id),
        float(total_score),
        float(mcq_val),
        float(coding_val) if coding_val is not None else 0.0,
    )

    return ok({"success": True, "mcq_score": mcq_val, "coding_score": coding_val, "total_score": total_score})


@router.get("/start/{token}")
async def start_assessment(token: str):
    db = get_db_admin_service()

    def _fetch():
        return (
            db.client.from_("assessment_sessions")
            .select(
                "*, candidates(full_name, email), job_descriptions(title, role, level, description, must_have_skills, good_to_have_skills)"
            )
            .eq("token", token)
            .single()
            .execute()
        )

    try:
        res = await db.run(_fetch)
        session = getattr(res, "data", None)
        err = getattr(res, "error", None)

        if err or not session:
            return api_error(message="Assessment not found or link expired", status_code=404)

        if session.get("status") in ("completed", "terminated"):
            return api_error(message="Assessment already completed or terminated", status_code=400)

        try:
            deadline_dt = _parse_iso_dt(session.get("deadline"))
        except Exception:
            return api_error(message="Assessment session misconfigured (invalid deadline)", status_code=500)

        if datetime.now(timezone.utc) > deadline_dt.astimezone(timezone.utc):
            await db.update(
                "assessment_sessions",
                {
                    "status": "expired",
                    "mcq_score": 0,
                    "coding_score": 0,
                    "total_score": 0,
                    "completed_at": _utc_now_iso(),
                },
                filters={"id": session["id"]},
            )
            return api_error(message="Assessment deadline has passed", status_code=400)

        # Validate assessment content before allowing start
        is_valid, validation_error, repair_context = _validate_assessment_content(session)
        if not is_valid:
            logger.warning("[assessments.start] content_validation_failed session_id=%s error=%s", str(session.get("id")), str(validation_error))
            return api_error(message=validation_error, status_code=400)

        # Auto-repair coding challenges if needed
        if repair_context and repair_context.get("needs_repair"):
            coding_challenges = session.get("coding_challenges") or []
            if isinstance(coding_challenges, list) and len(coding_challenges) > 0:
                repaired_challenges = [_repair_coding_challenge(c) for c in coding_challenges]
                session["coding_challenges"] = repaired_challenges
                logger.info("[assessments.start] coding_challenges_repaired session_id=%s count=%s", str(session.get("id")), str(len(repaired_challenges)))
                # Persist repairs to DB
                try:
                    await db.update(
                        "assessment_sessions",
                        {"coding_challenges": repaired_challenges, "updated_at": _utc_now_iso()},
                        filters={"id": session["id"]},
                    )
                except Exception as e:
                    logger.error("[assessments.start] repair_persistence_failed session_id=%s error=%s", str(session.get("id")), str(e))
                    # Continue anyway - repairs are in memory

        proctoring_data = session.get("proctoring_data") or {}
        assessment_config = (
            proctoring_data.get("assessment_config") or {}
            if isinstance(proctoring_data, dict)
            else {}
        )

        assessment_mode = assessment_config.get("assessment_mode")
        if assessment_mode not in ("apex", "dsa"):
            is_apex_mode = bool(
                session.get("is_apex_mode") or assessment_config.get("is_apex_mode")
            )
            assessment_mode = "apex" if is_apex_mode else "dsa"
        is_apex_mode = assessment_mode == "apex" or bool(
            session.get("is_apex_mode") or assessment_config.get("is_apex_mode")
        )

        mcq_val = session.get("mcq_question_count")
        mcq_count_expected = int(mcq_val) if mcq_val is not None else 20
        coding_val = session.get("coding_challenge_count")
        coding_count_expected = int(coding_val) if coding_val is not None else 2

        include_mcq = assessment_config.get("include_mcq") is not False
        include_coding = assessment_config.get("include_coding") is not False

        include_mcq = bool(include_mcq and mcq_count_expected > 0)
        include_coding = bool(include_coding and coding_count_expected > 0)

        content = (
            proctoring_data.get("assessment_content") or {}
            if isinstance(proctoring_data, dict)
            else {}
        )
        apex_blanks: List[Dict[str, Any]] = []
        sql_challenges: List[Dict[str, Any]] = []
        
        stored_sql = content.get("sql_challenges") if isinstance(content, dict) else None
        if isinstance(stored_sql, list):
            sql_challenges = stored_sql

        if assessment_mode == "apex":
            stored = content.get("apex_blanks") if isinstance(content, dict) else None
            if isinstance(stored, list):
                apex_blanks = stored
            if not apex_blanks:
                return api_error(
                    message="Apex questions are not available for this session. Please ask the recruiter to resend the assessment.",
                    status_code=400,
                )

        mcq_questions = session.get("mcq_questions") or []
        if include_mcq:
            if not isinstance(mcq_questions, list) or len(mcq_questions) == 0:
                return api_error(
                    message="MCQ questions are not available for this session. Please ask the recruiter to resend the assessment.",
                    status_code=400,
                )
            if len(mcq_questions) != mcq_count_expected:
                return api_error(
                    message=f"MCQ question count mismatch for this session. Expected {mcq_count_expected}, found {len(mcq_questions)}.",
                    status_code=500,
                )
        else:
            mcq_questions = []

        coding_challenges = session.get("coding_challenges") or []
        if include_coding and not is_apex_mode:
            if not isinstance(coding_challenges, list) or len(coding_challenges) == 0:
                # This is a fundamental issue - cannot repair what doesn't exist
                return api_error(
                    message="Coding challenges are not available for this session. Please ask the recruiter to resend the assessment.",
                    status_code=400,
                )
        else:
            coding_challenges = []

        safe_mcq = [
            {
                "id": q.get("id"),
                "question": q.get("question"),
                "options": q.get("options"),
                "difficulty": q.get("difficulty"),
                "topic": q.get("topic"),
                "points": q.get("points"),
            }
            for q in (mcq_questions if isinstance(mcq_questions, list) else [])
            if isinstance(q, dict)
        ]

        candidates_rel = session.get("candidates") or {}
        jobs_rel = session.get("job_descriptions") or {}

        return ok(
            {
                "session_id": session.get("id"),
                "candidate_name": candidates_rel.get("full_name"),
                "job_title": jobs_rel.get("title"),
                "job_role": jobs_rel.get("role"),
                "assessment_mode": assessment_mode,
                "is_apex_mode": is_apex_mode,
                "coding_environment_label": "Apex Coding Environment (AI-Evaluated - Phase 1)"
                if is_apex_mode
                else None,
                "mcq_count": len(safe_mcq),
                "coding_count": len(coding_challenges)
                if isinstance(coding_challenges, list)
                else 0,
                "total_time_minutes": session.get("total_time_minutes") or 90,
                "deadline": session.get("deadline"),
                "started_at": session.get("started_at"),
                "expires_at": _get_expires_at_from_session(session),
                "mcq_questions": safe_mcq,
                "coding_challenges": coding_challenges,
                "apex_blanks": apex_blanks,
                "sql_challenges": sql_challenges,
                "difficulty": assessment_config.get("difficulty")
                or session.get("difficulty")
                or "medium",
            }
        )
    except Exception:
        return api_error(message="Failed to start assessment", status_code=500)


@router.post("/{session_id}/begin")
async def begin_assessment(session_id: str):
    db = get_db_admin_service()
    sessions, db_err = await db.select_safe(
        "assessment_sessions",
        columns="id,status,started_at,deadline,total_time_minutes,proctoring_data",
        filters={"id": session_id},
        limit=1,
        context={"endpoint": "begin", "session_id": str(session_id)},
    )
    if db_err:
        logger.error("[assessments.begin] db_error session_id=%s error=%s", str(session_id), str(db_err.message))
        return api_error(message="Database error. Please try again.", status_code=500)
    session = sessions[0] if sessions else None
    if not session:
        logger.error("[assessments.begin] session_not_found session_id=%s", str(session_id))
        return api_error(message="Session not found", status_code=404)

    current_status = session.get("status")
    if current_status in ("completed", "terminated", "expired"):
        logger.warning("[assessments.begin] session_not_available session_id=%s status=%s", str(session_id), str(current_status))
        return api_error(message="Assessment not available", status_code=400)

    try:
        deadline_dt = _parse_iso_dt(session.get("deadline"))
    except Exception as e:
        logger.error("[assessments.begin] invalid_deadline session_id=%s error=%s", str(session_id), str(e))
        return api_error(message="Assessment session misconfigured (invalid deadline)", status_code=500)

    if datetime.now(timezone.utc) > deadline_dt.astimezone(timezone.utc):
        logger.warning("[assessments.begin] deadline_passed session_id=%s", str(session_id))
        await db.update(
            "assessment_sessions",
            {
                "status": "expired",
                "mcq_score": 0,
                "coding_score": 0,
                "total_score": 0,
                "completed_at": _utc_now_iso(),
            },
            filters={"id": session_id},
        )
        return api_error(message="Assessment deadline has passed", status_code=400)

    session = await _ensure_session_started(db=db, session=session)
    existing_total_time = int(session.get("total_time_minutes") or 90)
    started_at = session.get("started_at")
    expires_at = _get_expires_at_from_session(session)

    logger.info(
        "[assessments.begin] begin_return session_id=%s status=%s started_at=%s expires_at=%s duration_minutes=%s",
        str(session_id),
        str(session.get("status")),
        str(started_at),
        str(expires_at),
        str(existing_total_time),
    )

    return ok({
        "success": True,
        "started_at": started_at,
        "expires_at": expires_at,
        "time_limit_minutes": existing_total_time,
    })


@router.get("/{session_id}/apex-blanks")
async def get_apex_blanks(session_id: str):
    db = get_db_admin_service()
    sessions = await db.select(
        "assessment_sessions",
        columns="id,status,proctoring_data,deadline",
        filters={"id": session_id},
        limit=1,
    )
    session = sessions[0] if sessions else None
    if not session:
        return api_error(message="Session not found", status_code=404)

    if session.get("status") in ("completed", "terminated", "expired"):
        return api_error(message="Assessment not available", status_code=400)

    try:
        deadline_dt = _parse_iso_dt(session.get("deadline"))
        if datetime.now(timezone.utc) > deadline_dt.astimezone(timezone.utc):
            return api_error(message="Assessment deadline has passed", status_code=400)
    except Exception:
        pass

    proctoring_data = session.get("proctoring_data") or {}
    content = (
        proctoring_data.get("assessment_content") or {}
        if isinstance(proctoring_data, dict)
        else {}
    )
    blanks = content.get("apex_blanks") if isinstance(content, dict) else None
    if not isinstance(blanks, list) or len(blanks) == 0:
        return api_error(message="Apex questions not found for this session", status_code=404)

    return ok({"questions": blanks})


@router.post("/{session_id}/apex-blanks/submit")
async def submit_apex_blanks(
    session_id: str,
    body: Dict[str, Any] = Body(...),
):
    db = get_db_admin_service()
    sessions = await db.select(
        "assessment_sessions",
        columns="id,status,proctoring_data,deadline",
        filters={"id": session_id},
        limit=1,
    )
    session = sessions[0] if sessions else None
    if not session:
        return api_error(message="Session not found", status_code=404)

    if session.get("status") in ("terminated", "expired"):
        return api_error(message="Assessment not available", status_code=400)

    try:
        deadline_dt = _parse_iso_dt(session.get("deadline"))
        if datetime.now(timezone.utc) > deadline_dt.astimezone(timezone.utc):
            await db.update(
                "assessment_sessions",
                {
                    "status": "expired",
                    "mcq_score": 0,
                    "coding_score": 0,
                    "total_score": 0,
                    "completed_at": _utc_now_iso(),
                },
                filters={"id": session_id},
            )
            return api_error(message="Assessment deadline has passed", status_code=400)
    except Exception:
        pass

    submissions = body.get("submissions") if isinstance(body, dict) else None
    if submissions is None and isinstance(body, dict):
        submissions = body

    if not isinstance(submissions, dict):
        return api_error(message="Invalid submissions payload", status_code=400)

    proctoring_data = session.get("proctoring_data") or {}
    content = (
        proctoring_data.get("assessment_content") or {}
        if isinstance(proctoring_data, dict)
        else {}
    )
    questions = content.get("apex_blanks") if isinstance(content, dict) else None
    if not isinstance(questions, list) or len(questions) == 0:
        return api_error(message="Apex questions not found for this session", status_code=404)

    try:
        judged = await evaluate_apex_fill_in_the_blanks(
            questions=questions,
            submissions=submissions,
        )
    except Exception:
        return api_error(message="Failed to evaluate Apex answers", status_code=500)

    total_score = float(judged.get("total_score") or 0)
    max_score = float(judged.get("max_score") or 0)

    await db.update(
        "assessment_sessions",
        {
            "coding_score": total_score,
            "total_score": total_score,
            "proctoring_data": {
                **(proctoring_data if isinstance(proctoring_data, dict) else {}),
                "apex_blanks_submission": submissions,
                "apex_blanks_results": judged.get("results"),
                "apex_blanks_score": total_score,
                "apex_blanks_max_score": max_score,
            },
        },
        filters={"id": session_id},
    )

    return ok(
        {
            "success": True,
            "total_score": total_score,
            "max_score": max_score,
            "results": judged.get("results") or [],
        }
    )

from app.models.schemas import JobDescription as JobDescriptionModel

async def generate_assessment_questions(job_title: str, mcq_count: int, sql_count: int):
    qgen = get_question_generator()
    jd = JobDescriptionModel(
        id="dummy",
        title=job_title,
        role="developer",
        level="mid",
        description="",
        must_have_skills=[],
        good_to_have_skills=[],
        min_experience_years=0,
        is_active=True,
    )
    
    tasks = []
    if mcq_count > 0:
        tasks.append(qgen.generate_mcq_questions(jd, count=mcq_count, difficulty="medium"))
    else:
        tasks.append(asyncio.sleep(0, result=[]))
        
    if sql_count > 0:
        tasks.append(qgen.generate_sql_challenges(jd, count=sql_count, difficulty="medium"))
    else:
        tasks.append(asyncio.sleep(0, result=[]))
        
    mcqs, sqls = await asyncio.gather(*tasks)
    return mcqs, sqls

@router.post("/{candidate_id}/send", status_code=202)
async def send_assessment_single(
    candidate_id: str,
    body: AssessmentInviteRequest,
    user: ClerkUser = Depends(require_user)
):
    db = get_db_admin_service()
    
    job = await _fetch_job_for_user(db=db, job_id=body.job_id, user_id=user.id)
    if not job:
        return api_error(message="Job not found", status_code=404)
        
    candidates = await _fetch_candidates(db=db, candidate_ids=[candidate_id])
    if not candidates:
        return api_error(message="Candidate not found", status_code=404)
    candidate = candidates[0]
    
    mcq_count = int(body.mcq_question_count or 0) if body.include_mcq is not False else 0
    sql_count = int(body.sql_question_count or 0) if body.include_sql else 0
    
    async def _generate_and_enqueue():
        logger.info(f"Generating questions for {candidate_id}")
        mcqs, sqls = await generate_assessment_questions(
            str(job.get("title") or ""), 
            mcq_count, 
            sql_count
        )
        
        # Simulated DB storage logic
        
        assessment_link = f"{str(get_settings().frontend_url).rstrip('/')}/assessment/{uuid.uuid4()}"
        html, text, subject = email_queue.build_assessment_invite(
            str(candidate.get("full_name") or "Candidate"),
            str(job.get("title") or ""),
            assessment_link,
            "72 hours"
        )
        
        await email_queue.enqueue(
            to_email=str(candidate.get("email") or ""),
            subject=subject,
            html_body=html,
            text_body=text,
            priority=Priority.HIGH
        )
        
    asyncio.create_task(_generate_and_enqueue())
    return ok({"status": "Accepted"}, status_code=202)
