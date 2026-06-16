from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Request, UploadFile

from app.api.v2.deps import require_user
from app.auth.clerk import ClerkUser
from app.services.ai.factory import get_ai
from app.services.db.supabase_service import get_db_admin_service
from app.utils.responses import ok, api_error
from app.utils.tenant_guards import (
    verify_candidate_belongs_to_user,
    verify_job_belongs_to_user,
    get_user_job_ids,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/candidates")


@router.get("")
@router.get("/")
async def list_candidates(
    limit: int = 50,
    offset: int = 0,
    job_id: Optional[str] = None,
    unassigned: bool = False,
    user: ClerkUser = Depends(require_user),
):
    """Node-compatible: GET /api/candidates

    Returns one entry per (candidate, job) pair so the UI can group candidates per job.

    When `unassigned=true`, returns candidates whose job has been soft-deleted (is_deleted=true).
    These candidates retain all their assessment data and are shown in the Unassigned section.
    """

    db = get_db_admin_service()

    limit_i = max(1, min(200, int(limit or 50)))
    offset_i = max(0, int(offset or 0))

    # Fetch the user's jobs — filtering by deleted/non-deleted based on mode
    def _fetch_user_jobs():
        q = db.client.from_("job_descriptions").select("id, title, role").eq("created_by", user.id)
        if unassigned:
            # Only jobs that have been soft-deleted
            q = q.eq("is_deleted", True)
        else:
            # Only non-deleted jobs (is_deleted = false OR null for pre-migration rows)
            q = q.neq("is_deleted", True)
        return q.execute()

    jobs_res = await db.run(_fetch_user_jobs)
    user_jobs = getattr(jobs_res, "data", None) or []
    job_ids = [j.get("id") for j in user_jobs if isinstance(j, dict) and j.get("id")]
    if not job_ids:
        return ok([])

    # Build a map of job_id -> {title, role} for unassigned display
    job_meta: Dict[str, Dict[str, str]] = {
        j["id"]: {"title": j.get("title", ""), "role": j.get("role", "")}
        for j in user_jobs if isinstance(j, dict) and j.get("id")
    }

    if job_id:
        job_id_str = str(job_id)
        if job_id_str not in job_ids:
            return ok([])
        job_ids = [job_id_str]

    def _fetch_applications():
        return (
            db.client.from_("job_applications")
            .select("candidate_id, job_id, status, applied_at")
            .in_("job_id", job_ids)
            .order("applied_at", desc=True)
            .limit(limit_i)
            .execute()
        )

    apps_res = await db.run(_fetch_applications)
    applications = getattr(apps_res, "data", None) or []
    if not isinstance(applications, list) or not applications:
        return ok([])

    candidate_ids = list(
        {a.get("candidate_id") for a in applications if isinstance(a, dict) and a.get("candidate_id")}
    )
    if not candidate_ids:
        return ok([])

    def _fetch_candidates():
        return (
            db.client.from_("candidates")
            .select("id, full_name, email, phone, created_at, updated_at, consent_given, resume_url, resume_parsed_data")
            .in_("id", candidate_ids)
            .order("created_at", desc=True)
            .range(offset_i, offset_i + limit_i - 1)
            .execute()
        )

    cand_res = await db.run(_fetch_candidates)
    candidates = getattr(cand_res, "data", None) or []
    if not isinstance(candidates, list) or not candidates:
        return ok([])

    job_map: Dict[str, List[str]] = {}
    applied_at_map: Dict[str, Optional[str]] = {}
    for app in applications:
        if not isinstance(app, dict):
            continue
        cid = app.get("candidate_id")
        jid = app.get("job_id")
        if not cid or not jid:
            continue
        if cid not in job_map:
            job_map[cid] = []
        if jid not in job_map[cid]:
            job_map[cid].append(jid)
        key = f"{cid}:{jid}"
        if key not in applied_at_map:
            applied_at_map[key] = app.get("applied_at")

    def _fetch_screenings():
        return (
            db.client.from_("ats_screenings")
            .select("candidate_id, job_id, overall_score, shortlisted")
            .in_("candidate_id", candidate_ids)
            .in_("job_id", job_ids)
            .execute()
        )

    screenings_res = await db.run(_fetch_screenings)
    screenings = getattr(screenings_res, "data", None) or []
    screening_map: Dict[str, Dict[str, Any]] = {}
    for s in screenings:
        if isinstance(s, dict):
            cid = s.get("candidate_id")
            jid = s.get("job_id")
            if cid and jid:
                screening_map[f"{cid}:{jid}"] = s

    # Fetch per-recruiter candidate overrides from job_applications
    # These are mutable fields the recruiter has edited (name, phone, etc.)
    # stored privately so they never bleed across tenant boundaries.
    def _fetch_overrides():
        return (
            db.client.from_("job_applications")
            .select("candidate_id, job_id, candidate_overrides")
            .in_("job_id", job_ids)
            .in_("candidate_id", candidate_ids)
            .execute()
        )

    overrides_res = await db.run(_fetch_overrides)
    overrides_raw = getattr(overrides_res, "data", None) or []
    # Build map: (candidate_id, job_id) -> overrides dict
    overrides_map: Dict[str, Dict[str, Any]] = {}
    for ov in overrides_raw:
        if not isinstance(ov, dict):
            continue
        cid = ov.get("candidate_id")
        jid = ov.get("job_id")
        ov_data = ov.get("candidate_overrides")
        if cid and jid and isinstance(ov_data, dict) and ov_data:
            overrides_map[f"{cid}:{jid}"] = ov_data

    out: List[Dict[str, Any]] = []
    for c in candidates:
        if not isinstance(c, dict):
            continue
        cid = c.get("id")
        if not cid:
            continue
        for jid in job_map.get(cid, []):
            key = f"{cid}:{jid}"
            # Start from the canonical candidate data …
            item: Dict[str, Any] = {
                **c,
                "job_id": jid,
                "applied_at": applied_at_map.get(key),
            }
            # For unassigned candidates, surface the previous job info
            if unassigned and jid in job_meta:
                item["previous_job_title"] = job_meta[jid]["title"]
                item["previous_job_role"] = job_meta[jid]["role"]
                item["is_unassigned"] = True
            # … then layer this recruiter's private overrides on top
            tenant_overrides = overrides_map.get(key, {})
            if tenant_overrides:
                item.update(tenant_overrides)
            s_data = screening_map.get(key)
            if s_data:
                item["ats_score"] = s_data.get("overall_score")
                item["shortlisted"] = s_data.get("shortlisted")
            out.append(item)

    return ok(out)



@router.post("")
@router.post("/")
async def create_candidate(payload: Dict[str, Any], user: ClerkUser = Depends(require_user)):
    """Node-compatible: POST /api/candidates

    JSON-only create/update-by-email. Optional `job_id` will create a job_application.
    """

    db = get_db_admin_service()

    full_name = payload.get("full_name") or payload.get("fullName")
    email = payload.get("email")
    if not full_name or not email:
        return api_error(message="full_name and email are required", status_code=400)

    job_id = payload.get("job_id") or payload.get("jobId")
    if job_id:
        job_id = str(job_id)

        def _check_job():
            return (
                db.client.from_("job_descriptions")
                .select("id")
                .eq("id", job_id)
                .eq("created_by", user.id)
                .maybe_single()
                .execute()
            )

        job_res = await db.run(_check_job)
        if not isinstance(getattr(job_res, "data", None), dict):
            return api_error(message="Invalid job_id", status_code=400)

    def _find_existing():
        return (
            db.client.from_("candidates")
            .select("*")
            .eq("email", str(email))
            .limit(1)
            .execute()
        )

    existing_res = await db.run(_find_existing)
    existing = getattr(existing_res, "data", None) or []

    now = datetime.now(timezone.utc).isoformat()
    candidate_row: Optional[Dict[str, Any]] = None
    is_new_candidate: bool = False  # True only when we INSERT a new candidate row

    if isinstance(existing, list) and existing and isinstance(existing[0], dict) and existing[0].get("id"):
        existing_id = existing[0]["id"]
        existing_row = existing[0]

        # SECURITY: Only update fields that are currently null/empty on the shared candidate
        # record. This prevents a recruiter from clobbering another tenant's data when adding
        # an existing candidate (same email) to their own job.
        update_data: Dict[str, Any] = {"updated_at": now}

        def _merge_if_null(field: str, value: Any) -> None:
            """Only include the field in the update payload if the existing value is falsy."""
            if value and not existing_row.get(field):
                update_data[field] = value

        _merge_if_null("full_name", full_name)
        _merge_if_null("phone", payload.get("phone"))
        _merge_if_null("portfolio_url", payload.get("portfolio_url") or payload.get("portfolioUrl"))
        _merge_if_null("github_url", payload.get("github_url") or payload.get("githubUrl"))
        _merge_if_null("location", payload.get("location"))
        _merge_if_null("vendorName", payload.get("vendorName"))
        _merge_if_null("mainSkillset", payload.get("mainSkillset"))

        # Consent is always honoured for the candidate themselves (opt-in)
        if payload.get("consent_given") or payload.get("consentGiven"):
            update_data["consent_given"] = True
            if not existing_row.get("consent_timestamp"):
                update_data["consent_timestamp"] = now

        def _update():
            return (
                db.client.from_("candidates")
                .update(update_data)
                .eq("id", existing_id)
                .execute()
            )

        await db.run(_update)

        def _fetch_updated():
            return db.client.from_("candidates").select("*").eq("id", existing_id).maybe_single().execute()

        updated_res = await db.run(_fetch_updated)
        cand = getattr(updated_res, "data", None)
        candidate_row = cand if isinstance(cand, dict) else existing[0]
    else:
        from app.utils.billing_helpers import check_candidate_limit
        err_msg = await check_candidate_limit(db, user.id)
        if err_msg:
            return api_error(message=err_msg, status_code=403)

        insert_row: Dict[str, Any] = {
            "full_name": full_name,
            "email": email,
            "phone": payload.get("phone"),
            "portfolio_url": payload.get("portfolio_url") or payload.get("portfolioUrl"),
            "github_url": payload.get("github_url") or payload.get("githubUrl"),
            "consent_given": bool(payload.get("consent_given") or payload.get("consentGiven")),
            "consent_timestamp": now if (payload.get("consent_given") or payload.get("consentGiven")) else None,
            "resume_url": payload.get("resume_url") or payload.get("resumeUrl"),
            "resume_text": payload.get("resume_text") or payload.get("resumeText"),
            "resume_parsed_data": payload.get("resume_parsed_data") or payload.get("resumeParsedData"),
            "location": payload.get("location"),
            "vendorName": payload.get("vendorName"),
            "mainSkillset": payload.get("mainSkillset"),
        }
        def _insert():
            return db.client.from_("candidates").insert(insert_row).execute()

        ins_res = await db.run(_insert)
        data = getattr(ins_res, "data", None)
        candidate_row = data[0] if isinstance(data, list) and data and isinstance(data[0], dict) else None
        if candidate_row:
            is_new_candidate = True  # Mark for billing counter increment below

    if not candidate_row or not candidate_row.get("id"):
        return api_error(message="Failed to create candidate", status_code=500)

    # Increment the immutable billing counter for this recruiter.
    # Only fires when a brand-new candidate was inserted (is_new_candidate=True),
    # NOT when an existing candidate (same email) is added to another job.
    if is_new_candidate:
        from app.utils.billing_helpers import increment_candidates_consumed
        await increment_candidates_consumed(db, user.id)

    if job_id:
        candidate_id = str(candidate_row["id"])
        def _check_existing_app():
            return (
                db.client.from_("job_applications")
                .select("id")
                .eq("candidate_id", candidate_id)
                .eq("job_id", job_id)
                .maybe_single()
                .execute()
            )

        app_res = await db.run(_check_existing_app)
        existing_app = getattr(app_res, "data", None)
        if isinstance(existing_app, dict) and existing_app.get("id"):
            return api_error(message="This candidate has already applied to this job", status_code=400)

        from app.utils.billing_helpers import check_candidate_limit
        err_msg = await check_candidate_limit(db, user.id)
        if err_msg:
            return api_error(message=err_msg, status_code=403)

        def _insert_app():
            return (
                db.client.from_("job_applications")
                .insert(
                    {
                        "candidate_id": candidate_id,
                        "job_id": job_id,
                        "status": "applied",
                        "applied_at": now,
                    }
                )
                .execute()
            )

        await db.run(_insert_app)

    return ok({**candidate_row, "job_id": job_id}, status_code=201)


@router.post("/{candidate_id}/upload-resume")
async def upload_resume(
    candidate_id: str,
    resume: UploadFile = File(...),
    user: ClerkUser = Depends(require_user),
):
    """POST /api/v2/candidates/{candidate_id}/upload-resume

    Accepts a resume file (PDF / DOCX), uploads it to Supabase Storage,
    parses the text, runs AI extraction, and updates the candidate record.
    Returns the updated candidate object.
    """
    import uuid
    import os

    db = get_db_admin_service()

    # 1a. Tenant guard: verify this candidate applied to one of the user's jobs
    if not await verify_candidate_belongs_to_user(db, candidate_id, user.id):
        return api_error(message="Candidate not found", status_code=404)

    # 1b. Verify the candidate exists
    def _fetch_candidate():
        return (
            db.client.from_("candidates")
            .select("*")
            .eq("id", candidate_id)
            .maybe_single()
            .execute()
        )

    cand_res = await db.run(_fetch_candidate)
    candidate = getattr(cand_res, "data", None)
    if not isinstance(candidate, dict) or not candidate.get("id"):
        return api_error(message="Candidate not found", status_code=404)

    # 2. Read file bytes
    file_bytes = await resume.read()
    if not file_bytes:
        return api_error(message="Uploaded file is empty", status_code=400)

    original_name = resume.filename or "resume"
    ext = os.path.splitext(original_name)[1].lower() or ".pdf"
    # Object path is relative to the bucket root — no bucket-name prefix
    object_path = f"{candidate_id}/{uuid.uuid4().hex}{ext}"

    # 3. Upload to Supabase Storage (bucket: "resumes")
    resume_url: str = ""
    try:
        from app.config import get_settings
        settings = get_settings()

        # Ensure the bucket exists and is public; create it if missing
        def _ensure_bucket():
            try:
                db.client.storage.create_bucket("resumes", options={"public": True})
            except Exception:
                # Bucket already exists — make sure it is public
                try:
                    db.client.storage.update_bucket("resumes", options={"public": True})
                except Exception:
                    pass

        await db.run(_ensure_bucket)

        def _upload_storage():
            return db.client.storage.from_("resumes").upload(
                object_path,
                file_bytes,
                {"content-type": resume.content_type or "application/octet-stream"},
            )

        await db.run(_upload_storage)

        # Build the persistent public URL
        supabase_url = settings.supabase_url.rstrip("/")
        resume_url = f"{supabase_url}/storage/v1/object/public/resumes/{object_path}"
    except Exception as e:
        return api_error(message=f"Failed to upload resume to Supabase Storage: {e}", status_code=500)

    # 4. Extract text from the resume
    resume_text = ""
    try:
        from app.services.resume_parser import ResumeParserService
        rp = ResumeParserService()
        raw_text = await rp._extract_text(file_bytes, original_name)
        resume_text = (
            str(raw_text)
            .replace("\x00", "")
            .encode("utf-8", "ignore")
            .decode("utf-8")
        )[:50000]
    except Exception:
        resume_text = ""

    # 5. AI-parse the resume into structured data
    resume_parsed_data = None
    if resume_text and len(resume_text) >= 20:
        try:
            from app.services.ai.factory import get_ai
            ai = get_ai()
            prompt = (
                "You are an expert resume parser. Extract structured information from the resume below.\n\n"
                "Return ONLY valid JSON in this exact format:\n"
                "{\n"
                '  "skills": ["skill1", "skill2"],\n'
                '  "experience": [\n'
                '    {"title": "Job Title", "company": "Company", "duration": "Jan 2020 - Dec 2022", "description": "What they did"}\n'
                "  ],\n"
                '  "education": [\n'
                '    {"degree": "B.Tech Computer Science", "institution": "University Name", "year": "2019"}\n'
                "  ],\n"
                '  "summary": "Brief professional summary",\n'
                '  "total_experience_years": 5,\n'
                '  "certifications": ["cert1"]\n'
                "}\n\n"
                "Rules:\n"
                "- skills: list of technical/professional skills (max 20)\n"
                "- experience: list of work experiences (most recent first)\n"
                "- education: list of degrees/qualifications\n"
                "- summary: 2-3 sentence professional summary\n"
                "- total_experience_years: numeric estimate of total years of experience\n"
                "- certifications: list of certifications/courses (empty list if none)\n"
                "- Use empty strings/lists if a field cannot be determined\n\n"
                "RESUME TEXT:\n" + resume_text[:8000]
            )
            resume_parsed_data = await ai.generate_json(prompt, temperature=0.1, max_tokens=2000, timeout_s=30)
        except Exception:
            resume_parsed_data = None

    # 6. Update the candidate record
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    update_payload: Dict[str, Any] = {
        "resume_url": resume_url,
        "updated_at": now,
    }
    if resume_text:
        update_payload["resume_text"] = resume_text
    if resume_parsed_data and isinstance(resume_parsed_data, dict):
        update_payload["resume_parsed_data"] = resume_parsed_data

    def _update_candidate():
        return (
            db.client.from_("candidates")
            .update(update_payload)
            .eq("id", candidate_id)
            .execute()
        )

    await db.run(_update_candidate)

    # 7. Return fresh candidate row
    def _fetch_updated():
        return (
            db.client.from_("candidates")
            .select("*")
            .eq("id", candidate_id)
            .maybe_single()
            .execute()
        )

    updated_res = await db.run(_fetch_updated)
    updated = getattr(updated_res, "data", None)
    return ok(updated if isinstance(updated, dict) else {**candidate, **update_payload})


# NOTE: /offer-details must be registered BEFORE /{candidate_id} to avoid route shadowing.
@router.get("/offer-details")
async def offer_details(token: str):
    """GET /api/v2/candidates/offer-details?token=... (public, no auth required)"""
    if not token:
        return api_error(message="token is required", status_code=400)

    from jose import JWTError, jwt
    from app.config import get_settings

    settings = get_settings()
    secret = settings.supabase_service_key
    if not secret:
        return api_error(message="Offer token signing secret is not configured", status_code=500)

    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
    except JWTError:
        return api_error(message="Invalid or expired offer link", status_code=400)

    candidate_id = payload.get("candidate_id")
    job_id = payload.get("job_id")
    if not candidate_id or not job_id:
        return api_error(message="Invalid offer token", status_code=400)

    db = get_db_admin_service()

    def _fetch_application():
        return (
            db.client.from_("job_applications")
            .select("final_status, notes, offer_signature_name, offer_accepted_at, offer_acceptance_ip")
            .eq("candidate_id", candidate_id)
            .eq("job_id", job_id)
            .maybe_single()
            .execute()
        )

    app_res = await db.run(_fetch_application)
    application = getattr(app_res, "data", None)
    if not isinstance(application, dict):
        return api_error(message="Offer details not found", status_code=404)

    def _fetch_candidate():
        return (
            db.client.from_("candidates")
            .select("full_name, email")
            .eq("id", candidate_id)
            .maybe_single()
            .execute()
        )

    def _fetch_job():
        return (
            db.client.from_("job_descriptions")
            .select("title")
            .eq("id", job_id)
            .maybe_single()
            .execute()
        )

    cand_res, job_res = await db.run(_fetch_candidate), await db.run(_fetch_job)
    candidate = getattr(cand_res, "data", None)
    job = getattr(job_res, "data", None)
    if not isinstance(candidate, dict) or not isinstance(job, dict):
        return api_error(message="Offer details not found", status_code=404)

    snapshot = _extract_offer_snapshot(str(application.get("notes") or ""))
    status = str(application.get("final_status") or "")
    already_accepted = status in ("offer_accepted", "accepted")

    return ok(
        {
            "candidate_id": candidate_id,
            "job_id": job_id,
            "candidate_name": candidate.get("full_name"),
            "candidate_email": candidate.get("email"),
            "job_title": job.get("title"),
            "company_name": snapshot.get("company_name"),
            "ctc": snapshot.get("ctc"),
            "time_period_years": snapshot.get("time_period_years"),
            "time_period_months": snapshot.get("time_period_months"),
            "start_date": snapshot.get("start_date"),
            "reporting_manager": snapshot.get("reporting_manager"),
            "location": snapshot.get("location"),
            "accepted_signature_name": application.get("offer_signature_name"),
            "accepted_at": application.get("offer_accepted_at"),
            "accepted_ip": application.get("offer_acceptance_ip"),
            "already_accepted": already_accepted,
        }
    )


@router.get("/{candidate_id}")
async def get_candidate(candidate_id: str, user: ClerkUser = Depends(require_user)):
    """GET /api/v2/candidates/{candidate_id}"""
    db = get_db_admin_service()

    # Tenant guard: verify this candidate applied to one of the user's jobs
    if not await verify_candidate_belongs_to_user(db, candidate_id, user.id):
        return api_error(message="Candidate not found", status_code=404)

    def _fetch():
        return (
            db.client.from_("candidates")
            .select("*")
            .eq("id", candidate_id)
            .maybe_single()
            .execute()
        )

    res = await db.run(_fetch)
    candidate = getattr(res, "data", None)
    if not isinstance(candidate, dict) or not candidate.get("id"):
        return api_error(message="Candidate not found", status_code=404)

    # Merge the calling recruiter's per-tenant overrides on top of the
    # canonical candidate row so they see their private version of this record.
    user_job_ids = await get_user_job_ids(db, user.id)
    if user_job_ids:
        def _fetch_ov():
            return (
                db.client.from_("job_applications")
                .select("candidate_overrides")
                .eq("candidate_id", candidate_id)
                .in_("job_id", user_job_ids)
                .limit(1)
                .execute()
            )
        ov_res = await db.run(_fetch_ov)
        ov_rows = getattr(ov_res, "data", None) or []
        if ov_rows and isinstance(ov_rows[0], dict):
            overrides = ov_rows[0].get("candidate_overrides") or {}
            if isinstance(overrides, dict) and overrides:
                candidate = {**candidate, **overrides}

    return ok(candidate)


@router.patch("/{candidate_id}")
async def update_candidate(
    candidate_id: str,
    payload: Dict[str, Any],
    user: ClerkUser = Depends(require_user),
):
    """PATCH /api/v2/candidates/{candidate_id}

    Editable fields: full_name, phone, portfolio_url, github_url, location, vendorName, mainSkillset.
    Email is immutable after creation. Resume fields (resume_url, resume_text, resume_parsed_data)
    are intentionally excluded — immutable after submission.
    """
    db = get_db_admin_service()

    # Tenant guard: only the recruiter who owns the job this candidate applied to can edit
    if not await verify_candidate_belongs_to_user(db, candidate_id, user.id):
        return api_error(message="Candidate not found", status_code=404)

    if "email" in payload:
        return api_error(message="Candidate email cannot be modified", status_code=400)

    # Resume fields are immutable after application submission — never allow them via this endpoint
    allowed = {
        "full_name", "phone", "portfolio_url", "github_url",
        "location", "vendorName", "mainSkillset",
        "consent_given", "consent_timestamp",
    }
    update_data: Dict[str, Any] = {k: v for k, v in payload.items() if k in allowed}
    if not update_data:
        return api_error(message="No valid fields to update", status_code=400)

    logger.info("[candidates.update] candidate_id=%s fields=%s user=%s", candidate_id, list(update_data.keys()), user.id)

    # SECURITY: Write mutable fields into job_applications.candidate_overrides
    # (the recruiter's private per-tenant copy) — NOT into the global candidates
    # table. This prevents one recruiter's edits from leaking to other tenants.
    user_job_ids = await get_user_job_ids(db, user.id)
    if not user_job_ids:
        return api_error(message="No jobs found for this user", status_code=404)

    # Fetch current overrides from the recruiter's first matching application
    def _fetch_current_overrides():
        return (
            db.client.from_("job_applications")
            .select("id, job_id, candidate_overrides")
            .eq("candidate_id", candidate_id)
            .in_("job_id", user_job_ids)
            .execute()
        )

    ov_res = await db.run(_fetch_current_overrides)
    ov_rows = getattr(ov_res, "data", None) or []
    if not ov_rows:
        return api_error(message="Candidate not found", status_code=404)

    # Update candidate_overrides on ALL of this recruiter's applications for this candidate
    # (a recruiter may have the same candidate in multiple jobs)
    for app_row in ov_rows:
        if not isinstance(app_row, dict):
            continue
        app_job_id = app_row.get("job_id")
        if not app_job_id:
            continue
        existing_overrides = app_row.get("candidate_overrides") or {}
        if not isinstance(existing_overrides, dict):
            existing_overrides = {}
        merged = {**existing_overrides, **update_data}

        app_jid = app_job_id  # capture for closure
        def _write_overrides(jid=app_jid, data=merged):
            return (
                db.client.from_("job_applications")
                .update({"candidate_overrides": data, "updated_at": datetime.now(timezone.utc).isoformat()})
                .eq("candidate_id", candidate_id)
                .eq("job_id", jid)
                .execute()
            )
        await db.run(_write_overrides)

    # Return the merged view: base candidate + this recruiter's overrides
    def _fetch_base():
        return (
            db.client.from_("candidates")
            .select("*")
            .eq("id", candidate_id)
            .maybe_single()
            .execute()
        )
    base_res = await db.run(_fetch_base)
    base = getattr(base_res, "data", None)
    if not isinstance(base, dict) or not base.get("id"):
        return api_error(message="Candidate not found after update", status_code=404)

    # Use the latest overrides from the first app row for the response
    latest_overrides = {}
    if ov_rows and isinstance(ov_rows[0].get("candidate_overrides"), dict):
        latest_overrides = {**ov_rows[0]["candidate_overrides"], **update_data}
    return ok({**base, **latest_overrides})


@router.delete("/{candidate_id}")
async def delete_candidate(
    candidate_id: str,
    job_id: Optional[str] = None,
    user: ClerkUser = Depends(require_user),
):
    """DELETE /api/v2/candidates/{candidate_id}[?job_id=...]

    If job_id is provided, removes the candidate from that specific job
    including ALL related interview/assessment/screening data for that job.
    Otherwise removes the candidate entirely with all associated data.
    """
    db = get_db_admin_service()

    # Tenant guard: verify the caller owns the relevant job(s) before deletion
    if job_id:
        if not await verify_job_belongs_to_user(db, job_id, user.id):
            return api_error(message="Job not found or access denied", status_code=404)
        # Also verify the candidate actually applied to this specific job
        if not await verify_candidate_belongs_to_user(db, candidate_id, user.id, job_id=job_id):
            return api_error(message="Candidate not found for this job", status_code=404)
    else:
        # Full delete: only allowed if the candidate applied to at least one of the user's jobs
        if not await verify_candidate_belongs_to_user(db, candidate_id, user.id):
            return api_error(message="Candidate not found", status_code=404)

    if job_id:
        # --- Remove candidate from a specific job (full cleanup) ---
        logger.info(
            "[delete_candidate] Removing candidate=%s from job=%s with full data cleanup",
            candidate_id, job_id
        )

        def _del_job_specific():
            # Delete AI interview sessions (questions/responses stored as JSONB inside)
            db.client.from_("ai_interview_sessions") \
                .delete() \
                .eq("candidate_id", candidate_id) \
                .eq("job_id", job_id) \
                .execute()
            # Delete assessment sessions
            db.client.from_("assessment_sessions") \
                .delete() \
                .eq("candidate_id", candidate_id) \
                .eq("job_id", job_id) \
                .execute()
            # Delete ATS screenings
            db.client.from_("ats_screenings") \
                .delete() \
                .eq("candidate_id", candidate_id) \
                .eq("job_id", job_id) \
                .execute()
            # Delete interview sessions (cascades to interview_questions,
            # candidate_responses, practical_assessments, practical_submissions,
            # interview_evaluations via FK ON DELETE CASCADE)
            db.client.from_("interview_sessions") \
                .delete() \
                .eq("candidate_id", candidate_id) \
                .eq("job_id", job_id) \
                .execute()
            # Finally delete the job application link
            db.client.from_("job_applications") \
                .delete() \
                .eq("candidate_id", candidate_id) \
                .eq("job_id", job_id) \
                .execute()

        try:
            await db.run(_del_job_specific)
        except Exception as exc:
            logger.error(
                "[delete_candidate] Failed to delete candidate=%s from job=%s: %s",
                candidate_id, job_id, exc
            )
            return api_error(message="Failed to remove candidate from job", status_code=500)

        return ok({"success": True, "message": "Candidate removed from job with all related data"})

    # --- Full delete: remove ALL data for this candidate across all jobs ---
    logger.info("[delete_candidate] Full deletion of candidate=%s", candidate_id)

    def _del_all():
        # Delete AI interview sessions
        db.client.from_("ai_interview_sessions") \
            .delete() \
            .eq("candidate_id", candidate_id) \
            .execute()
        # Delete assessment sessions
        db.client.from_("assessment_sessions") \
            .delete() \
            .eq("candidate_id", candidate_id) \
            .execute()
        # Delete ATS screenings
        db.client.from_("ats_screenings") \
            .delete() \
            .eq("candidate_id", candidate_id) \
            .execute()
        # Delete interview sessions (cascades to questions, responses, evaluations)
        db.client.from_("interview_sessions") \
            .delete() \
            .eq("candidate_id", candidate_id) \
            .execute()
        # Delete all job applications
        db.client.from_("job_applications") \
            .delete() \
            .eq("candidate_id", candidate_id) \
            .execute()
        # Finally delete the candidate record itself
        db.client.from_("candidates") \
            .delete() \
            .eq("id", candidate_id) \
            .execute()

    try:
        await db.run(_del_all)
    except Exception as exc:
        logger.error(
            "[delete_candidate] Failed to fully delete candidate=%s: %s",
            candidate_id, exc
        )
        return api_error(message="Failed to delete candidate", status_code=500)

    return ok({"success": True, "message": "Candidate and all related data permanently deleted"})


@router.get("/{candidate_id}/parsed-resume")
async def get_parsed_resume(candidate_id: str, user: ClerkUser = Depends(require_user)):
    """GET /api/v2/candidates/{candidate_id}/parsed-resume"""
    db = get_db_admin_service()

    # Tenant guard
    if not await verify_candidate_belongs_to_user(db, candidate_id, user.id):
        return api_error(message="Candidate not found", status_code=404)

    def _fetch():
        return (
            db.client.from_("candidates")
            .select("resume_parsed_data")
            .eq("id", candidate_id)
            .maybe_single()
            .execute()
        )

    res = await db.run(_fetch)
    row = getattr(res, "data", None)
    if not isinstance(row, dict):
        return api_error(message="Candidate not found", status_code=404)
    parsed = row.get("resume_parsed_data")
    if not parsed:
        return api_error(message="No parsed resume data available", status_code=404)
    return ok(parsed)


@router.get("/{candidate_id}/assessment-details")
async def get_assessment_details(
    candidate_id: str,
    job_id: Optional[str] = None,
    user: ClerkUser = Depends(require_user),
):
    """GET /api/v2/candidates/{candidate_id}/assessment-details"""
    db = get_db_admin_service()

    # Tenant guard: if job_id provided verify ownership; otherwise verify general ownership
    if job_id:
        if not await verify_candidate_belongs_to_user(db, candidate_id, user.id, job_id=job_id):
            return api_error(message="Candidate not found for this job", status_code=404)
    else:
        if not await verify_candidate_belongs_to_user(db, candidate_id, user.id):
            return api_error(message="Candidate not found", status_code=404)

    # Scope the assessment query to only the user's jobs
    user_job_ids = await get_user_job_ids(db, user.id)

    def _fetch():
        q = (
            db.client.from_("assessment_sessions")
            .select("*")
            .eq("candidate_id", candidate_id)
        )
        if job_id:
            q = q.eq("job_id", job_id)
        elif user_job_ids:
            q = q.in_("job_id", user_job_ids)
        return q.order("created_at", desc=True).limit(1).execute()

    res = await db.run(_fetch)
    data = getattr(res, "data", None) or []
    session = data[0] if data else None
    if session and isinstance(session, dict):
        if session.get("sql_score") is None:
            pd = session.get("proctoring_data") or {}
            if isinstance(pd, dict):
                session["sql_score"] = pd.get("sql_score")
    return ok(session)


@router.get("/{candidate_id}/interview-details")
async def get_interview_details(
    candidate_id: str,
    job_id: Optional[str] = None,
    user: ClerkUser = Depends(require_user),
):
    """GET /api/v2/candidates/{candidate_id}/interview-details"""
    db = get_db_admin_service()

    # Tenant guard: verify this candidate applied to one of the user's jobs
    if job_id:
        if not await verify_candidate_belongs_to_user(db, candidate_id, user.id, job_id=job_id):
            return api_error(message="Candidate not found for this job", status_code=404)
    else:
        if not await verify_candidate_belongs_to_user(db, candidate_id, user.id):
            return api_error(message="Candidate not found", status_code=404)

    # Scope queries to user's jobs only
    user_job_ids = await get_user_job_ids(db, user.id)

    def _shape_ai_session(row: Dict[str, Any]) -> Dict[str, Any]:
        raw_questions = row.get("questions")
        questions_out: List[Dict[str, Any]] = []
        if isinstance(raw_questions, list):
            for q in raw_questions:
                if not isinstance(q, dict):
                    continue
                text = q.get("question_text") or q.get("text") or q.get("question")
                qtype = q.get("question_type") or q.get("type")
                if not text:
                    continue
                questions_out.append(
                    {
                        "question_text": str(text),
                        "question_type": str(qtype or "technical"),
                    }
                )

        raw_responses = row.get("responses")
        responses_out: List[Dict[str, Any]] = []
        if isinstance(raw_responses, list):
            for r in raw_responses:
                if not isinstance(r, dict):
                    continue
                q_idx_raw = r.get("question_index")
                if q_idx_raw is None:
                    continue
                try:
                    q_idx = int(q_idx_raw)
                except (TypeError, ValueError):
                    continue
                transcript = r.get("transcript")
                if transcript is None:
                    transcript = r.get("answer") or r.get("text")
                responses_out.append(
                    {
                        "question_index": q_idx,
                        "transcript": "" if transcript is None else str(transcript),
                        "audio_duration_seconds": r.get("audio_duration_seconds") or 0,
                        "confidence": r.get("confidence") or 0,
                        "submitted_at": r.get("submitted_at"),
                    }
                )

        return {
            "session_id": row.get("id"),
            "status": row.get("status"),
            "questions": questions_out,
            "responses": responses_out,
            "final_evaluation": row.get("final_evaluation"),
            "proctoring_data": row.get("proctoring_data"),
            "started_at": row.get("started_at"),
            "completed_at": row.get("completed_at"),
        }

    def _fetch():
        q = (
            db.client.from_("ai_interview_sessions")
            .select("*")
            .eq("candidate_id", candidate_id)
        )
        if job_id:
            q = q.eq("job_id", job_id)
        elif user_job_ids:
            q = q.in_("job_id", user_job_ids)
        return q.order("created_at", desc=True).limit(1).execute()

    res = await db.run(_fetch)
    data = getattr(res, "data", None) or []

    if isinstance(data, list) and data and isinstance(data[0], dict):
        return ok(_shape_ai_session(data[0]))

    def _fetch_legacy():
        q = (
            db.client.from_("interview_sessions")
            .select("*")
            .eq("candidate_id", candidate_id)
        )
        if job_id:
            q = q.eq("job_id", job_id)
        elif user_job_ids:
            q = q.in_("job_id", user_job_ids)
        return q.order("created_at", desc=True).limit(1).execute()

    legacy_res = await db.run(_fetch_legacy)
    legacy_data = getattr(legacy_res, "data", None) or []
    return ok(legacy_data[0] if legacy_data else None)


@router.get("/{candidate_id}/manual-interview")
async def get_manual_interview(
    candidate_id: str,
    job_id: str,
    user: ClerkUser = Depends(require_user),
):
    """GET /api/v2/candidates/{candidate_id}/manual-interview?job_id=..."""
    db = get_db_admin_service()

    # Tenant guard: verify the job belongs to this user
    if not await verify_job_belongs_to_user(db, job_id, user.id):
        return api_error(message="Job not found or access denied", status_code=404)

    def _fetch():
        return (
            db.client.from_("job_applications")
            .select(
                "candidate_id, job_id, interview_mode, interview_status, "
                "manual_interview_score, manual_interview_notes, "
                "manual_interview_at, interview_completed_at"
            )
            .eq("candidate_id", candidate_id)
            .eq("job_id", job_id)
            .maybe_single()
            .execute()
        )

    try:
        res = await db.run(_fetch)
        row = getattr(res, "data", None)
    except Exception as exc:
        logger.error("[get_manual_interview] DB error candidate=%s job=%s error=%s", candidate_id, job_id, exc)
        return api_error(message="Failed to fetch manual interview data", status_code=500)

    if not isinstance(row, dict):
        return ok(None)
    notes = row.get("manual_interview_notes") or ""
    at_val = row.get("manual_interview_at")
    return ok({
        "candidate_id": row.get("candidate_id", candidate_id),
        "job_id": row.get("job_id", job_id),
        "interview_mode": row.get("interview_mode"),
        "interview_status": row.get("interview_status"),
        "manual_interview_score": row.get("manual_interview_score"),
        "manual_interview_feedback": notes,
        "manual_interview_notes": notes,
        "manual_interview_at": at_val,
        "interview_completed_at": row.get("interview_completed_at"),
        "manual_interview_entered_by": None,
    })


@router.patch("/{candidate_id}/manual-interview")
async def update_manual_interview(
    candidate_id: str,
    job_id: str,
    payload: Dict[str, Any],
    user: ClerkUser = Depends(require_user),
):
    """PATCH /api/v2/candidates/{candidate_id}/manual-interview?job_id=..."""
    db = get_db_admin_service()
    now_iso = datetime.now(timezone.utc).isoformat()

    # --- Validate inputs -------------------------------------------------------
    if not candidate_id or not job_id:
        return api_error(message="candidate_id and job_id are required", status_code=400)

    # Tenant guard: verify the job belongs to this user
    if not await verify_job_belongs_to_user(db, job_id, user.id):
        return api_error(message="Job not found or access denied", status_code=404)

    # Backend score validation
    raw_score = payload.get("manual_interview_score")
    if raw_score is not None:
        try:
            score_val = float(raw_score)
        except (TypeError, ValueError):
            return api_error(message="Score must be a number between 0 and 100", status_code=400)
        if not (0.0 <= score_val <= 100.0):
            return api_error(message="Score must be between 0 and 100", status_code=400)
    else:
        score_val = None

    # --- Build update payload (only confirmed DB columns) ----------------------
    notes = payload.get("manual_interview_notes") or payload.get("manual_interview_feedback") or None
    if notes is not None:
        notes = str(notes).strip() or None

    db_update: Dict[str, Any] = {
        "updated_at": now_iso,
    }
    if "interview_mode" in payload:
        db_update["interview_mode"] = payload["interview_mode"]
    else:
        db_update["interview_mode"] = "manual"

    if score_val is not None:
        db_update["manual_interview_score"] = score_val
        # Auto-complete interview when a score is submitted
        db_update["interview_status"] = "completed"
        db_update["interview_completed_at"] = now_iso
    elif "manual_interview_score" in payload and raw_score is None:
        # Explicitly clearing the score
        db_update["manual_interview_score"] = None

    if notes is not None:
        db_update["manual_interview_notes"] = notes
    elif "manual_interview_notes" in payload or "manual_interview_feedback" in payload:
        db_update["manual_interview_notes"] = None

    if "interview_status" in payload and "interview_status" not in db_update:
        db_update["interview_status"] = payload["interview_status"]

    logger.info(
        "[update_manual_interview] candidate=%s job=%s update_keys=%s",
        candidate_id, job_id, list(db_update.keys())
    )

    # --- DB update -------------------------------------------------------------
    def _update():
        return (
            db.client.from_("job_applications")
            .update(db_update)
            .eq("candidate_id", candidate_id)
            .eq("job_id", job_id)
            .execute()
        )

    try:
        await db.run(_update)
    except Exception as exc:
        logger.error(
            "[update_manual_interview] DB update failed candidate=%s job=%s error=%s",
            candidate_id, job_id, exc
        )
        return api_error(message="Failed to save manual interview data", status_code=500)

    # --- Re-fetch --------------------------------------------------------------
    def _fetch():
        return (
            db.client.from_("job_applications")
            .select(
                "candidate_id, job_id, interview_mode, interview_status, "
                "manual_interview_score, manual_interview_notes, "
                "manual_interview_at, interview_completed_at"
            )
            .eq("candidate_id", candidate_id)
            .eq("job_id", job_id)
            .maybe_single()
            .execute()
        )

    try:
        res = await db.run(_fetch)
        row = getattr(res, "data", None)
    except Exception as exc:
        logger.error(
            "[update_manual_interview] DB re-fetch failed candidate=%s job=%s error=%s",
            candidate_id, job_id, exc
        )
        return api_error(message="Saved but failed to retrieve updated data", status_code=500)

    if not isinstance(row, dict):
        return ok(None)
    fetched_notes = row.get("manual_interview_notes") or ""
    return ok({
        "candidate_id": row.get("candidate_id", candidate_id),
        "job_id": row.get("job_id", job_id),
        "interview_mode": row.get("interview_mode"),
        "interview_status": row.get("interview_status"),
        "manual_interview_score": row.get("manual_interview_score"),
        "manual_interview_feedback": fetched_notes,
        "manual_interview_notes": fetched_notes,
        "manual_interview_at": row.get("manual_interview_at"),
        "interview_completed_at": row.get("interview_completed_at"),
        "manual_interview_entered_by": None,
    })


@router.post("/parse-resume-preview")
async def parse_resume_preview(
    _user: ClerkUser = Depends(require_user),
    resume: UploadFile = File(...),
):
    """Node-compatible: POST /api/candidates/parse-resume-preview

    Returns raw JSON with keys:
    full_name,email,phone,location,skills,summary,total_experience_years
    """

    try:
        file_bytes = await resume.read()
        # Reuse existing resume extraction+OpenAI by using ResumeParserService for detailed parsing is different.
        # For preview, match Node prompt (short JSON).
        from app.services.resume_parser import ResumeParserService

        rp = ResumeParserService()
        raw_text = await rp._extract_text(file_bytes, resume.filename)  # type: ignore[attr-defined]
        resume_text = (
            str(raw_text)
            .replace("\x00", "")
            .encode("utf-8", "ignore")
            .decode("utf-8")
        )[:50000]

        if not resume_text or len(resume_text) < 20:
            return api_error(message="Could not extract text from the resume. Please try a different file format.", status_code=400)

        prompt = (
            "You are an expert resume parser. Parse the following resume and extract key information for a candidate profile.\n\n"
            "Return ONLY valid JSON in this exact format:\n"
            "{\n"
            '  "full_name": "First Last",\n'
            '  "email": "email@example.com",\n'
            '  "phone": "+1234567890",\n'
            '  "location": "City, Country",\n'
            '  "skills": ["skill1", "skill2"],\n'
            '  "summary": "Brief professional summary",\n'
            '  "total_experience_years": 0\n'
            "}\n\n"
            "Rules:\n"
            "- Extract the candidate's full name as it appears on the resume\n"
            "- Extract email and phone if present, otherwise use empty string\n"
            "- Location should be their current city/country\n"
            "- Skills should be technical skills (max 15)\n"
            "- Summary should be 1-2 sentences\n"
            "- If a field cannot be determined, use an empty string or 0\n\n"
            "RESUME TEXT:\n"
            + resume_text[:8000]
        )

        ai = get_ai()
        parsed = await ai.generate_json(prompt, temperature=0.1, max_tokens=1200, timeout_s=20)

        return ok(
            {
                "full_name": parsed.get("full_name", "") if isinstance(parsed.get("full_name"), str) else "",
                "email": parsed.get("email", "") if isinstance(parsed.get("email"), str) else "",
                "phone": parsed.get("phone", "") if isinstance(parsed.get("phone"), str) else "",
                "location": parsed.get("location", "") if isinstance(parsed.get("location"), str) else "",
                "skills": parsed.get("skills", []) if isinstance(parsed.get("skills"), list) else [],
                "summary": parsed.get("summary", "") if isinstance(parsed.get("summary"), str) else "",
                "total_experience_years": parsed.get("total_experience_years", 0)
                if isinstance(parsed.get("total_experience_years"), (int, float))
                else 0,
            }
        )

    except Exception as e:
        return api_error(message=f"Failed to parse resume. Please try again or enter details manually. ({e})", status_code=502)


def _extract_offer_snapshot(notes: str) -> Dict[str, Any]:
    raw = str(notes or "")
    lines = raw.split("\n")

    def _extract(prefix: str) -> Optional[str]:
        for line in lines:
            if line.startswith(prefix):
                value = line.replace(prefix, "", 1).strip()
                return value or None
        return None

    return {
        "company_name": _extract("Company Name:") or "Our Company",
        "ctc": _extract("CTC:") or "As per attached offer letter",
        "time_period_years": int(_extract("Contract Years:") or 0) or None,
        "time_period_months": int(_extract("Contract Months:") or 0) or None,
        "start_date": _extract("Start Date:"),
        "reporting_manager": _extract("Reporting Manager:"),
        "location": _extract("Location:"),
    }


@router.post("/send-acceptance")
async def send_acceptance(payload: dict, user: ClerkUser = Depends(require_user)):
    db = get_db_admin_service()
    candidate_ids = payload.get("candidate_ids")
    job_id = payload.get("job_id")
    if not isinstance(candidate_ids, list) or not candidate_ids or not job_id:
        return api_error(message="candidate_ids and job_id are required", status_code=400)

    def _fetch_job():
        return (
            db.client.from_("job_descriptions")
            .select("id, title")
            .eq("id", job_id)
            .eq("created_by", user.id)
            .single()
            .execute()
        )

    job_res = await db.run(_fetch_job)
    job = getattr(job_res, "data", None)
    if not isinstance(job, dict):
        return api_error(message="Job not found or access denied", status_code=404)

    def _fetch_candidates():
        return (
            db.client.from_("candidates")
            .select("id, email, full_name")
            .in_("id", candidate_ids)
            .execute()
        )

    candidates_res = await db.run(_fetch_candidates)
    candidates = getattr(candidates_res, "data", None) or []
    if not candidates:
        return api_error(message="No candidates found", status_code=404)

    from app.services.email_service import get_email_service

    email_service = get_email_service()

    emails_sent = 0
    error_messages: List[str] = []

    for c in candidates:
        if not isinstance(c, dict):
            continue
        try:
            await email_service.send_acceptance_email(
                to=str(c.get("email") or ""),
                candidate_name=str(c.get("full_name") or ""),
                job_title=str(job.get("title") or ""),
            )
            emails_sent += 1

            def _update_app():
                return (
                    db.client.from_("job_applications")
                    .update({"final_status": "accepted", "updated_at": datetime.now(timezone.utc).isoformat()})
                    .eq("candidate_id", c.get("id"))
                    .eq("job_id", job_id)
                    .execute()
                )

            await db.run(_update_app)
        except Exception as e:
            error_messages.append(f"{c.get('full_name')}: {str(e)}")

    return ok({"success": emails_sent > 0, "emails_sent": emails_sent, "error_messages": error_messages})


@router.post("/bulk-update-interview-mode")
async def bulk_update_interview_mode(payload: dict, user: ClerkUser = Depends(require_user)):
    """Node-compatible: POST /api/candidates/bulk-update-interview-mode

    Body: { candidate_ids: string[], job_id: string, interview_mode: 'ai'|'manual' }
    Returns: { success, updated_count, error_messages }
    """

    db = get_db_admin_service()
    candidate_ids = payload.get("candidate_ids")
    job_id = payload.get("job_id")
    interview_mode = payload.get("interview_mode")

    if not isinstance(candidate_ids, list) or not candidate_ids or not job_id or not interview_mode:
        return api_error(message="candidate_ids, job_id, and interview_mode are required", status_code=400)

    interview_mode_str = str(interview_mode)
    if interview_mode_str not in ("ai", "manual"):
        return api_error(message='interview_mode must be either "ai" or "manual"', status_code=400)

    def _fetch_job():
        return (
            db.client.from_("job_descriptions")
            .select("id")
            .eq("id", job_id)
            .eq("created_by", user.id)
            .single()
            .execute()
        )

    job_res = await db.run(_fetch_job)
    job = getattr(job_res, "data", None)
    if not isinstance(job, dict):
        return api_error(message="Job not found or access denied", status_code=404)

    updated_count = 0
    error_messages: List[str] = []
    ts = datetime.now(timezone.utc).isoformat()

    for candidate_id in candidate_ids:
        try:
            candidate_id_str = str(candidate_id)

            def _fetch_existing_app():
                return (
                    db.client.from_("job_applications")
                    .select("id")
                    .eq("candidate_id", candidate_id_str)
                    .eq("job_id", job_id)
                    .maybe_single()
                    .execute()
                )

            existing_res = await db.run(_fetch_existing_app)
            existing = getattr(existing_res, "data", None)

            if isinstance(existing, dict) and existing.get("id"):

                def _update_app():
                    return (
                        db.client.from_("job_applications")
                        .update({"interview_mode": interview_mode_str, "updated_at": ts})
                        .eq("candidate_id", candidate_id_str)
                        .eq("job_id", job_id)
                        .execute()
                    )

                await db.run(_update_app)
                updated_count += 1
            else:

                def _insert_app():
                    return (
                        db.client.from_("job_applications")
                        .insert(
                            {
                                "candidate_id": candidate_id_str,
                                "job_id": job_id,
                                "interview_mode": interview_mode_str,
                                "created_at": ts,
                                "updated_at": ts,
                            }
                        )
                        .execute()
                    )

                await db.run(_insert_app)
                updated_count += 1

        except Exception as e:
            error_messages.append(f"Candidate {candidate_id}: {str(e)}")

    return ok({"success": updated_count > 0, "updated_count": updated_count, "error_messages": error_messages})


@router.post("/send-rejection")
async def send_rejection(payload: dict, user: ClerkUser = Depends(require_user)):
    db = get_db_admin_service()
    candidate_ids = payload.get("candidate_ids")
    job_id = payload.get("job_id")
    if not isinstance(candidate_ids, list) or not candidate_ids or not job_id:
        return api_error(message="candidate_ids and job_id are required", status_code=400)

    def _fetch_job():
        return (
            db.client.from_("job_descriptions")
            .select("id, title")
            .eq("id", job_id)
            .eq("created_by", user.id)
            .single()
            .execute()
        )

    job_res = await db.run(_fetch_job)
    job = getattr(job_res, "data", None)
    if not isinstance(job, dict):
        return api_error(message="Job not found or access denied", status_code=404)

    def _fetch_candidates():
        return (
            db.client.from_("candidates")
            .select("id, email, full_name")
            .in_("id", candidate_ids)
            .execute()
        )

    candidates_res = await db.run(_fetch_candidates)
    candidates = getattr(candidates_res, "data", None) or []
    if not candidates:
        return api_error(message="No candidates found", status_code=404)

    from app.services.email_service import get_email_service

    email_service = get_email_service()

    emails_sent = 0
    error_messages: List[str] = []

    for c in candidates:
        if not isinstance(c, dict):
            continue
        try:
            await email_service.send_rejection_email(
                to=str(c.get("email") or ""),
                candidate_name=str(c.get("full_name") or ""),
                job_title=str(job.get("title") or ""),
            )
            emails_sent += 1

            def _update_app():
                return (
                    db.client.from_("job_applications")
                    .update({"final_status": "rejected", "updated_at": datetime.now(timezone.utc).isoformat()})
                    .eq("candidate_id", c.get("id"))
                    .eq("job_id", job_id)
                    .execute()
                )

            await db.run(_update_app)
        except Exception as e:
            error_messages.append(f"{c.get('full_name')}: {str(e)}")

    return ok({"success": emails_sent > 0, "emails_sent": emails_sent, "error_messages": error_messages})


@router.post("/send-offer-letter")
async def send_offer_letter(payload: dict, user: ClerkUser = Depends(require_user)):
    db = get_db_admin_service()
    candidate_ids = payload.get("candidate_ids")
    job_id = payload.get("job_id")
    ctc = payload.get("ctc")
    company_name = payload.get("company_name")
    start_date = payload.get("start_date")
    reporting_manager = payload.get("reporting_manager")
    location = payload.get("location")
    time_period_years = payload.get("time_period_years")
    time_period_months = payload.get("time_period_months")

    if not isinstance(candidate_ids, list) or not candidate_ids or not job_id:
        return api_error(message="candidate_ids and job_id are required", status_code=400)
    if not ctc or not str(ctc).strip():
        return api_error(message="ctc is required", status_code=400)
    if not company_name or not str(company_name).strip():
        return api_error(message="company_name is required", status_code=400)

    def _fetch_job():
        return (
            db.client.from_("job_descriptions")
            .select("id, title")
            .eq("id", job_id)
            .eq("created_by", user.id)
            .single()
            .execute()
        )

    job_res = await db.run(_fetch_job)
    job = getattr(job_res, "data", None)
    if not isinstance(job, dict):
        return api_error(message="Job not found or access denied", status_code=404)

    def _fetch_candidates():
        return (
            db.client.from_("candidates")
            .select("id, email, full_name")
            .in_("id", candidate_ids)
            .execute()
        )

    candidates_res = await db.run(_fetch_candidates)
    candidates = getattr(candidates_res, "data", None) or []
    if not candidates:
        return api_error(message="No candidates found", status_code=404)

    from jose import jwt

    from app.config import get_settings
    from app.services.email_service import get_email_service
    from app.services.offer_letter_service import generate_offer_letter_pdf

    settings = get_settings()
    secret = settings.supabase_service_key
    if not secret:
        return api_error(message="Offer token signing secret is not configured", status_code=500)

    email_service = get_email_service()
    resolved_company = str(company_name).strip() or "Our Company"

    emails_sent = 0
    error_messages: List[str] = []

    for c in candidates:
        if not isinstance(c, dict):
            continue
        try:
            token_payload = {
                "candidate_id": c.get("id"),
                "job_id": job_id,
                "iat": int(datetime.now(timezone.utc).timestamp()),
            }
            token = jwt.encode(token_payload, secret, algorithm="HS256")

            base_url = str(settings.frontend_url).rstrip("/")
            acceptance_link = f"{base_url}/offer-acceptance?token={token}"

            pdf_bytes = generate_offer_letter_pdf(
                candidate_name=str(c.get("full_name") or ""),
                candidate_email=str(c.get("email") or ""),
                job_title=str(job.get("title") or ""),
                company_name=resolved_company,
                ctc=str(ctc).strip(),
                time_period_years=int(time_period_years) if isinstance(time_period_years, (int, float, str)) and str(time_period_years).strip().isdigit() else None,
                time_period_months=int(time_period_months) if isinstance(time_period_months, (int, float, str)) and str(time_period_months).strip().isdigit() else None,
                start_date=str(start_date) if start_date else None,
                reporting_manager=str(reporting_manager) if reporting_manager else None,
                location=str(location) if location else None,
            )

            await email_service.send_offer_letter_email(
                to=str(c.get("email") or ""),
                candidate_name=str(c.get("full_name") or ""),
                job_title=str(job.get("title") or ""),
                company_name=resolved_company,
                attachment_bytes=pdf_bytes,
                attachment_filename=f"Offer_Letter_{str(c.get('full_name') or 'Candidate').replace(' ', '_')}.pdf",
                attachment_content_type="application/pdf",
                acceptance_link=acceptance_link,
            )

            # Persist snapshot + update status
            note_lines = [
                "[Offer Letter Snapshot]",
                f"Company Name: {resolved_company}",
                f"CTC: {str(ctc).strip()}",
                f"Contract Years: {time_period_years if time_period_years is not None else ''}",
                f"Contract Months: {time_period_months if time_period_months is not None else ''}",
                f"Start Date: {start_date or ''}",
                f"Reporting Manager: {reporting_manager or ''}",
                f"Location: {location or ''}",
                "Attachment Format: PDF",
            ]
            snapshot_note = "\n".join(note_lines)
            ts = datetime.now(timezone.utc).isoformat()

            def _fetch_existing_notes():
                return (
                    db.client.from_("job_applications")
                    .select("notes")
                    .eq("candidate_id", c.get("id"))
                    .eq("job_id", job_id)
                    .maybe_single()
                    .execute()
                )

            existing_notes_res = await db.run(_fetch_existing_notes)
            existing_notes_row = getattr(existing_notes_res, "data", None) or {}
            existing_notes = str(existing_notes_row.get("notes") or "").strip()
            merged_notes = "\n".join([n for n in [existing_notes, snapshot_note] if n]).strip()

            def _update_app():
                return (
                    db.client.from_("job_applications")
                    .update({"final_status": "offer_sent", "notes": merged_notes, "updated_at": ts})
                    .eq("candidate_id", c.get("id"))
                    .eq("job_id", job_id)
                    .execute()
                )

            await db.run(_update_app)
            emails_sent += 1
        except Exception as e:
            error_messages.append(f"{c.get('full_name')}: {str(e)}")

    return ok({"success": emails_sent > 0, "emails_sent": emails_sent, "error_messages": error_messages})


@router.post("/submit-offer-acceptance")
async def submit_offer_acceptance(payload: dict, request: Request):
    token = payload.get("token")
    signature = payload.get("full_name_signature")
    if not token:
        return api_error(message="token is required", status_code=400)
    if not signature or not str(signature).strip():
        return api_error(message="Full name signature is required to accept the offer", status_code=400)

    from jose import JWTError, jwt

    from app.config import get_settings

    settings = get_settings()
    secret = settings.supabase_service_key
    if not secret:
        return api_error(message="Offer token signing secret is not configured", status_code=500)

    try:
        token_payload = jwt.decode(str(token), secret, algorithms=["HS256"])
    except JWTError:
        return api_error(message="Invalid or expired acceptance link", status_code=400)

    candidate_id = token_payload.get("candidate_id")
    job_id = token_payload.get("job_id")
    if not candidate_id or not job_id:
        return api_error(message="Invalid acceptance token", status_code=400)

    db = get_db_admin_service()

    def _fetch_application():
        return (
            db.client.from_("job_applications")
            .select("final_status, notes")
            .eq("candidate_id", candidate_id)
            .eq("job_id", job_id)
            .maybe_single()
            .execute()
        )

    app_res = await db.run(_fetch_application)
    application = getattr(app_res, "data", None)
    if not isinstance(application, dict):
        return api_error(message="Job application not found", status_code=404)

    current_status = str(application.get("final_status") or "")
    if current_status == "offer_accepted":
        return ok({"success": True, "message": "Offer already accepted", "already_accepted": True})
    if current_status not in ("offer_sent", "accepted"):
        return api_error(message="Offer is not currently open for acceptance", status_code=400)

    client_ip = str(
        (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
        or (request.client.host if request.client else "Unknown IP")
    )
    signature_str = str(signature).strip()
    ts = datetime.now(timezone.utc).isoformat()
    existing_notes = str(application.get("notes") or "").strip()
    acceptance_note = "\n".join(
        [
            "[Digital Offer Acceptance]",
            f"Accepted at: {ts}",
            f"IP Address: {client_ip}",
            f"Digital Signature: {signature_str}",
        ]
    )
    notes = "\n".join([n for n in [existing_notes, acceptance_note] if n]).strip()

    def _update_application():
        return (
            db.client.from_("job_applications")
            .update(
                {
                    "final_status": "offer_accepted",
                    "notes": notes,
                    "offer_signature_name": signature_str,
                    "offer_accepted_at": ts,
                    "offer_acceptance_ip": client_ip,
                    "updated_at": ts,
                }
            )
            .eq("candidate_id", candidate_id)
            .eq("job_id", job_id)
            .execute()
        )

    await db.run(_update_application)

    return ok({"success": True, "message": "Offer accepted successfully. Welcome aboard!", "already_accepted": False})
