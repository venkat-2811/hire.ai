from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, File, Form, UploadFile, HTTPException

from app.services.ats_screening import get_ats_screening_service
from app.services.db.supabase_service import get_db_admin_service
from app.services.email_queue import email_queue, Priority
from app.services.resume_parser import get_resume_parser
from app.utils.responses import api_error, ok

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/apply")


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("/job/{job_id}")
async def get_public_job(job_id: str):
    """Public job details. No auth required."""
    db = get_db_admin_service()

    jobs = await db.select(
        "job_descriptions",
        columns=(
            "id, title, role, level, description, must_have_skills, good_to_have_skills, "
            "min_experience_years, is_active, created_by"
        ),
        filters={"id": job_id, "is_active": True},
        limit=1,
    )
    if not jobs:
        return api_error(message="Job not found or no longer accepting applications", status_code=404)

    # Check candidate limit
    from app.utils.billing_helpers import check_candidate_limit
    err_msg = await check_candidate_limit(db, jobs[0].get("created_by"))
    if err_msg:
        return api_error(message="Candidates cannot be onboarded into this job", status_code=403)

    return ok(jobs[0])


@router.post("/submit")
async def submit_application(
    job_id: str = Form(...),
    full_name: str = Form(...),
    email: str = Form(...),
    phone: Optional[str] = Form(None),
    portfolio_url: Optional[str] = Form(None),
    github_url: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    vendorName: Optional[str] = Form(None),
    mainSkillset: Optional[str] = Form(None),
    consent_given: str = Form(...),
    resume: Optional[UploadFile] = File(None),
):
    """Submit a public job application. No auth required."""
    db = get_db_admin_service()

    if not job_id or not full_name or not email:
        return api_error(message="job_id, full_name, and email are required", status_code=400)

    consent = str(consent_given).lower() == "true"
    if not consent:
        return api_error(message="Consent is required to submit application", status_code=400)

    # Verify job exists and active (need full row for screening)
    job_rows = await db.select(
        "job_descriptions",
        columns="*",
        filters={"id": job_id, "is_active": True},
        limit=1,
    )
    if not job_rows:
        return api_error(message="Job not found or no longer accepting applications", status_code=404)
    job = job_rows[0]

    # Candidate lookup by email
    existing_candidates = await db.select(
        "candidates",
        columns="id",
        filters={"email": email},
        limit=1,
    )

    candidate_id: Optional[str] = None
    is_new_candidate = False
    is_new_for_recruiter = True
    recruiter_id = job.get("created_by")

    if existing_candidates:
        candidate_id = existing_candidates[0].get("id")

        # Check already applied
        existing_apps = await db.select(
            "job_applications",
            columns="id",
            filters={"candidate_id": candidate_id, "job_id": job_id},
            limit=1,
        )
        if existing_apps:
            return api_error(message="You have already applied to this job", status_code=400)
            
        def _check_recruiter_has_cand():
            return db.client.from_("job_applications").select("id, job_descriptions!inner(created_by)").eq("candidate_id", candidate_id).eq("job_descriptions.created_by", recruiter_id).limit(1).execute()
        cr_res = await db.run(_check_recruiter_has_cand)
        if getattr(cr_res, "data", None):
            is_new_for_recruiter = False
    else:
        is_new_candidate = True
        import uuid
        candidate_id = str(uuid.uuid4())

    if is_new_for_recruiter:
        from app.utils.billing_helpers import consume_candidate_slot
        err_msg = await consume_candidate_slot(db, recruiter_id, candidate_id, job_id)
        if err_msg:
            return api_error(message="Candidates cannot be onboarded into this job", status_code=403)

    try:

        # Parse resume (best-effort)
        resume_text = ""
        resume_parsed_data: Any = None
        if resume is not None:
            _resume_filename = resume.filename or "resume.pdf"
            try:
                content = await resume.read()
                parser = get_resume_parser()
                resume_text, parsed = await parser.parse_resume(content, _resume_filename)
                # Align with Node: store JSON-like dict, but keep any pydantic models serializable
                resume_parsed_data = parsed.model_dump() if hasattr(parsed, "model_dump") else parsed
                logger.info(
                    "apply: resume_parsed file=%s candidate_email=%s char_count=%d",
                    _resume_filename, email, len(resume_text),
                )
            except Exception as parse_exc:
                logger.error(
                    "apply: RESUME_PARSE_FAILED file=%s candidate_email=%s error=%s "
                    "– continuing without ATS screening",
                    _resume_filename, email, parse_exc,
                )
                resume_text = ""
                resume_parsed_data = None


        # Create or update candidate
        candidate_payload: Dict[str, Any] = {
            "full_name": full_name,
            "email": email,
            "phone": phone,
            "portfolio_url": portfolio_url,
            "github_url": github_url,
            "location": location,
            "vendorName": vendorName,
            "mainSkillset": mainSkillset,
            "consent_given": consent,
            "consent_timestamp": _utc_now_iso(),
            "updated_at": _utc_now_iso(),
        }
        if resume_text:
            candidate_payload["resume_text"] = resume_text
            candidate_payload["resume_parsed_data"] = resume_parsed_data

        if not is_new_candidate:
            # SECURITY: When updating an existing shared candidate record, only overwrite fields
            # that are currently null/empty. This prevents a new application from clobbering
            # contact details recorded by a different recruiter's tenant context.
            existing_full = await db.select("candidates", columns="*", filters={"id": candidate_id}, limit=1)
            existing_row = existing_full[0] if existing_full else {}

            safe_update: Dict[str, Any] = {"updated_at": _utc_now_iso()}
            # Always update consent (opt-in)
            if consent:
                safe_update["consent_given"] = True
                if not existing_row.get("consent_timestamp"):
                    safe_update["consent_timestamp"] = _utc_now_iso()
            # Only fill in missing contact fields
            for field, value in [
                ("full_name", full_name),
                ("phone", phone),
                ("portfolio_url", portfolio_url),
                ("github_url", github_url),
                ("location", location),
                ("vendorName", vendorName),
                ("mainSkillset", mainSkillset),
            ]:
                if value and not existing_row.get(field):
                    safe_update[field] = value
            # Resume data from this submission is always stored (application-specific)
            if resume_text:
                safe_update["resume_text"] = resume_text
                safe_update["resume_parsed_data"] = resume_parsed_data

            await db.update("candidates", safe_update, filters={"id": candidate_id})
        else:
            await db.insert(
                "candidates",
                [{"id": candidate_id, **candidate_payload, "created_at": _utc_now_iso()}],
            )

        # Create job application
        import uuid

        application_id = str(uuid.uuid4())
    
        app_payload = {
            "id": application_id,
            "candidate_id": candidate_id,
            "job_id": job_id,
            "status": "applied",
            "applied_at": _utc_now_iso(),
            "created_at": _utc_now_iso(),
        }

        # ISOLATION FIX: Always store the applicant's submitted identity fields in
        # candidate_overrides so their name/phone/etc. is scoped to this specific
        # job application rather than relying on the shared candidates row (which
        # is not overwritten when the email already exists).
        _overrides: Dict[str, Any] = {}
        if full_name:
            _overrides["full_name"] = full_name
        if phone:
            _overrides["phone"] = phone
        if location:
            _overrides["location"] = location
        if vendorName:
            _overrides["vendorName"] = vendorName
        if mainSkillset:
            _overrides["mainSkillset"] = mainSkillset
        if portfolio_url:
            _overrides["portfolio_url"] = portfolio_url
        if github_url:
            _overrides["github_url"] = github_url
        if _overrides:
            app_payload["candidate_overrides"] = _overrides

        await db.insert("job_applications", [app_payload])

        # ATS screening (best-effort) if resume parsed
        if resume_parsed_data:
            try:
                from app.models.schemas import JobDescription, ResumeData

                screening_service = get_ats_screening_service()

                resume_model = ResumeData(**resume_parsed_data) if isinstance(resume_parsed_data, dict) else ResumeData()
                job_model = JobDescription(
                    id=str(job.get("id")),
                    title=str(job.get("title")),
                    role=str(job.get("role") or "custom"),
                    level=job.get("level") or "mid",
                    description=str(job.get("description") or ""),
                    must_have_skills=job.get("must_have_skills") or [],
                    good_to_have_skills=job.get("good_to_have_skills") or [],
                    min_experience_years=int(job.get("min_experience_years") or 0),
                    resume_cutoff=int(job.get("resume_cutoff") or 0),
                    assessment_cutoff=int(job.get("assessment_cutoff") or 0),
                    interview_cutoff=int(job.get("interview_cutoff") or 0),
                    is_active=bool(job.get("is_active") is not False),
                    created_at=job.get("created_at"),
                    updated_at=job.get("updated_at"),
                )

                result = await screening_service.screen_candidate(resume_model, resume_text or "", job_model)

                screening_data = {
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
                    "detailed_analysis": result.detailed_analysis.model_dump() if result.detailed_analysis else None,
                    "screened_at": _utc_now_iso(),
                    "updated_at": _utc_now_iso(),
                }

                existing_screenings = await db.select(
                    "ats_screenings",
                    columns="id",
                    filters={"candidate_id": candidate_id, "job_id": job_id},
                    limit=1,
                )
                if existing_screenings:
                    await db.update(
                        "ats_screenings",
                        screening_data,
                        filters={"id": existing_screenings[0].get("id")},
                    )
                else:
                    await db.insert(
                        "ats_screenings",
                        [{"id": str(uuid.uuid4()), **screening_data, "created_at": _utc_now_iso()}],
                    )
            except Exception:
                pass

        # Confirmation email (best-effort, async via queue)
        try:
            html, text, subject = email_queue.build_application_received(
                candidate_name=full_name,
                job_title=str(job.get("title") or ""),
            )
            await email_queue.enqueue(
                to_email=email,
                subject=subject,
                html_body=html,
                text_body=text,
                priority=Priority.NORMAL,
                idempotency_key=f"apply:{application_id}",
            )
        except Exception:
            pass

        return ok(
            {
                "id": application_id,
                "job_id": job_id,
                "candidate_id": candidate_id,
                "status": "applied",
                "message": f"Application submitted successfully for {str(job.get('title') or '')}. Check your email for confirmation.",
            },
            status_code=201,
        )

    except Exception as e:
        if is_new_for_recruiter:
            from app.utils.billing_helpers import refund_candidate_slot
            await refund_candidate_slot(db, recruiter_id)
        raise e
