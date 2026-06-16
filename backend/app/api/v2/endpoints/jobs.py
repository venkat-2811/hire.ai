from __future__ import annotations

from typing import List, Optional, Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.v2.deps import require_user
from app.auth.clerk import ClerkUser
from app.services.ai.factory import get_ai
from app.services.db.supabase_service import get_db_admin_service
from app.utils.responses import api_error, ok

router = APIRouter(prefix="/jobs")


class ExtractSkillsRequest(BaseModel):
    description: str = Field(..., min_length=20)
    title: Optional[str] = None
    role: Optional[str] = None


class ExtractSkillsResponse(BaseModel):
    must_have_skills: List[str]
    good_to_have_skills: List[str]


@router.post("/extract-skills")
async def extract_skills(
    payload: ExtractSkillsRequest,
    _user: ClerkUser = Depends(require_user),
):
    """Node-compatible: POST /api/jobs/extract-skills"""

    description = (payload.description or "").strip()
    if len(description) < 20:
        return api_error(message="Please provide a job description with at least 20 characters", status_code=400)

    title = (payload.title or "Not specified").strip() or "Not specified"
    role = (payload.role or "Not specified").strip() or "Not specified"

    prompt = (
        "You are an expert technical recruiter. Analyze the following job description and extract two categorized skill lists.\n\n"
        f"Job Title: {title}\n"
        f"Role: {role}\n\n"
        "Job Description:\n"
        f"{description[:4000]}\n\n"
        "Return ONLY valid JSON in this exact format:\n"
        "{\n"
        '  "must_have_skills": ["skill1", "skill2", ...],\n'
        '  "good_to_have_skills": ["skill1", "skill2", ...]\n'
        "}\n\n"
        "Rules:\n"
        "- \"must_have_skills\": Core technical skills explicitly required or strongly implied (5-10 skills)\n"
        "- \"good_to_have_skills\": Nice-to-have, supplementary, or bonus skills (3-8 skills)\n"
        "- Use concise, industry-standard skill names (e.g., \"React\", \"Node.js\", \"AWS\", \"Salesforce Apex\")\n"
        "- Do NOT include soft skills or generic terms like \"communication\" or \"teamwork\"\n"
        "- Do NOT duplicate skills between the two lists"
    )

    try:
        ai = get_ai()
        result = await ai.generate_json(prompt, temperature=0.1, max_tokens=1200, timeout_s=20)

        must_have_raw = result.get("must_have_skills") if isinstance(result, dict) else None
        good_to_have_raw = result.get("good_to_have_skills") if isinstance(result, dict) else None

        must_have = [s.strip() for s in (must_have_raw or []) if isinstance(s, str) and s.strip()]
        good_to_have = [s.strip() for s in (good_to_have_raw or []) if isinstance(s, str) and s.strip()]

        return ok(ExtractSkillsResponse(must_have_skills=must_have, good_to_have_skills=good_to_have).model_dump())
    except Exception as e:
        return api_error(message=f"Failed to extract skills. Please try again. ({e})", status_code=502)


@router.get("")
@router.get("/")
async def list_jobs(
    role: Optional[str] = None,
    level: Optional[str] = None,
    is_active: Optional[bool] = None,
    user: ClerkUser = Depends(require_user)
):
    """List jobs created by user. Excludes soft-deleted jobs."""
    db = get_db_admin_service()

    def _fetch():
        q = (
            db.client.from_("job_descriptions")
            .select("*")
            .eq("created_by", user.id)
            # Exclude soft-deleted jobs (is_deleted = true)
            .neq("is_deleted", True)
        )
        if role:
            q = q.ilike("role", f"%{role}%")
        if level:
            q = q.eq("level", level)
        if is_active is not None:
            q = q.eq("is_active", is_active)
        res = q.order("created_at", desc=True).execute()
        return res.data or []

    data = await db.run(_fetch)
    return ok(data)


@router.get("/{job_id}")
async def get_job(job_id: str, user: ClerkUser = Depends(require_user)):
    """Get specific job."""
    db = get_db_admin_service()

    def _fetch():
        res = db.client.from_("job_descriptions").select("*").eq("id", job_id).eq("created_by", user.id).maybe_single().execute()
        return res.data

    data = await db.run(_fetch)
    if not data:
        return api_error(message="Job not found", status_code=404)
    return ok(data)


@router.post("")
@router.post("/")
async def create_job(payload: Dict[str, Any], user: ClerkUser = Depends(require_user)):
    """Create a new job description."""
    db = get_db_admin_service()
    
    # Billing check bypassed locally for create_job if no RPC exists
    pass

    # Validate end_customer_name is required when endCustomer is 'end_customer'
    end_customer_val = payload.get("endCustomer") or payload.get("end_customer")
    end_customer_name_val = (payload.get("end_customer_name") or "").strip() or None
    if end_customer_val == "end_customer" and not end_customer_name_val:
        return api_error(message="Name of Customer/Client is required when hiring for End Customer", status_code=400)

    # Validate Salesforce/Apex flags: include_apex_assessment requires is_salesforce_job=True
    is_salesforce_job = bool(payload.get("is_salesforce_job", False))
    include_apex_assessment = bool(payload.get("include_apex_assessment", False))
    if include_apex_assessment and not is_salesforce_job:
        return api_error(
            message="include_apex_assessment can only be enabled when is_salesforce_job is true.",
            status_code=400,
        )

    job_data = {
        "title": payload.get("title"),
        "role": payload.get("role"),
        "level": payload.get("level"),
        "description": payload.get("description"),
        "must_have_skills": payload.get("must_have_skills") or [],
        "good_to_have_skills": payload.get("good_to_have_skills") or [],
        "min_experience_years": payload.get("min_experience_years") or 0,
        "resume_cutoff": payload.get("resume_cutoff", 35),
        "assessment_cutoff": payload.get("assessment_cutoff", 40),
        "interview_cutoff": payload.get("interview_cutoff", 40),
        "include_sql_assessment": payload.get("include_sql_assessment", False),
        "location": payload.get("location"),
        "end_customer": end_customer_val,
        "end_customer_name": end_customer_name_val if end_customer_val == "end_customer" else None,
        "is_salesforce_job": is_salesforce_job,
        "include_apex_assessment": include_apex_assessment,
        "is_active": True,
        "is_deleted": False,
        "created_by": user.id,
    }

    def _insert():
        res = db.client.from_("job_descriptions").insert(job_data).execute()
        return res.data

    data = await db.run(_insert)
    row = data[0] if isinstance(data, list) and data else None
    if not isinstance(row, dict):
        return api_error(message="Failed to create job", status_code=500)
        
    def _update_profile():
        res = db.client.from_("profiles").select("jobs_count").eq("user_id", user.id).maybe_single().execute()
        if res.data:
            db.client.from_("profiles").update({"jobs_count": (res.data.get("jobs_count") or 0) + 1}).eq("user_id", user.id).execute()
            
    await db.run(_update_profile)

    return ok(row, status_code=201)


@router.patch("/{job_id}")
async def update_job(job_id: str, payload: Dict[str, Any], user: ClerkUser = Depends(require_user)):
    """Update a job description."""
    db = get_db_admin_service()
    
    allowed_keys = [
        "title", "role", "level", "description",
        "must_have_skills", "good_to_have_skills", "min_experience_years",
        "is_active", "resume_cutoff", "assessment_cutoff", "interview_cutoff",
        "include_sql_assessment",
        "location", "end_customer", "end_customer_name",
        "is_salesforce_job", "include_apex_assessment",
    ]
    
    update_data = {k: v for k, v in payload.items() if k in allowed_keys}

    # Normalise: accept endCustomer as alias
    if "endCustomer" in payload and "end_customer" not in update_data:
        update_data["end_customer"] = payload["endCustomer"]

    # Validate end_customer_name required when end_customer is 'end_customer'
    ec = update_data.get("end_customer")
    if ec == "end_customer":
        ecn = (update_data.get("end_customer_name") or "").strip() or None
        if not ecn:
            return api_error(message="Name of Customer/Client is required when hiring for End Customer", status_code=400)
        update_data["end_customer_name"] = ecn
    elif ec and ec != "end_customer":
        update_data["end_customer_name"] = None

    # Validate Salesforce/Apex flags: include_apex_assessment requires is_salesforce_job=True.
    # We must consider both the payload values and the existing values in the DB.
    if "is_salesforce_job" in update_data or "include_apex_assessment" in update_data:
        # Fetch current job state to cross-validate
        def _fetch_current():
            return (
                db.client.from_("job_descriptions")
                .select("is_salesforce_job, include_apex_assessment")
                .eq("id", job_id)
                .eq("created_by", user.id)
                .maybe_single()
                .execute()
            )
        current_res = await db.run(_fetch_current)
        current = getattr(current_res, "data", None) or {}

        # Resolve effective values (payload overrides current)
        effective_is_salesforce = update_data.get(
            "is_salesforce_job",
            current.get("is_salesforce_job", False)
        )
        effective_include_apex = update_data.get(
            "include_apex_assessment",
            current.get("include_apex_assessment", False)
        )
        if effective_include_apex and not effective_is_salesforce:
            return api_error(
                message="include_apex_assessment can only be enabled when is_salesforce_job is true.",
                status_code=400,
            )
        # If is_salesforce_job is being set to False, force include_apex_assessment to False too.
        if "is_salesforce_job" in update_data and not update_data["is_salesforce_job"]:
            update_data["include_apex_assessment"] = False

    if not update_data:
        return api_error(message="No valid fields to update", status_code=400)

    def _update():
        res = db.client.from_("job_descriptions").update(update_data).eq("id", job_id).eq("created_by", user.id).execute()
        return res

    up_res = await db.run(_update)
    if getattr(up_res, "error", None):
        return api_error(message="Job not found or access denied", status_code=404)

    def _fetch():
        res = db.client.from_("job_descriptions").select("*").eq("id", job_id).eq("created_by", user.id).maybe_single().execute()
        return res.data

    data = await db.run(_fetch)
    if not data:
        return api_error(message="Job not found or access denied", status_code=404)
        
    return ok(data)


@router.delete("/{job_id}")
async def delete_job(job_id: str, permanent: bool = False, user: ClerkUser = Depends(require_user)):
    """Archive or permanently delete a job.

    IMPORTANT: Permanent deletion uses a SOFT-DELETE strategy (is_deleted=True).
    The job row is NOT physically removed. All candidate data — job_applications,
    assessment_sessions, interview_sessions, ats_screenings — is fully preserved.
    Candidates become 'Unassigned' and remain visible in the Candidates module.
    """
    db = get_db_admin_service()
    
    if permanent:
        def _soft_delete():
            # Verify the job exists and belongs to this user
            job = (
                db.client.from_("job_descriptions")
                .select("id, title, role")
                .eq("id", job_id)
                .eq("created_by", user.id)
                .maybe_single()
                .execute()
            )
            if not job.data:
                return None

            # Soft delete: mark as deleted and inactive, preserve ALL candidate data
            db.client.from_("job_descriptions").update({
                "is_deleted": True,
                "is_active": False,
            }).eq("id", job_id).eq("created_by", user.id).execute()

            return job.data

        data = await db.run(_soft_delete)
        if data is None:
            return api_error(message="Job not found", status_code=404)

        def _update_profile():
            res = db.client.from_("profiles").select("jobs_count").eq("user_id", user.id).maybe_single().execute()
            if res.data and (res.data.get("jobs_count") or 0) > 0:
                db.client.from_("profiles").update({"jobs_count": res.data["jobs_count"] - 1}).eq("user_id", user.id).execute()
                
        await db.run(_update_profile)
        return ok({
            "success": True,
            "message": "Job deleted. All associated candidates have been preserved as Unassigned Candidates.",
        })
    else:
        def _archive():
            res = db.client.from_("job_descriptions").update({"is_active": False}).eq("id", job_id).eq("created_by", user.id).execute()
            return res
            
        arch_res = await db.run(_archive)
        if getattr(arch_res, "error", None):
            return api_error(message="Job not found or access denied", status_code=404)
        return ok({"success": True, "message": "Job archived successfully"})



class ExtractSkillsRequest(BaseModel):
    description: str = Field(..., min_length=20)
    title: Optional[str] = None
    role: Optional[str] = None


class ExtractSkillsResponse(BaseModel):
    must_have_skills: List[str]
    good_to_have_skills: List[str]


@router.post("/extract-skills")
async def extract_skills(
    payload: ExtractSkillsRequest,
    _user: ClerkUser = Depends(require_user),
):
    """Node-compatible: POST /api/jobs/extract-skills"""

    description = (payload.description or "").strip()
    if len(description) < 20:
        return api_error(message="Please provide a job description with at least 20 characters", status_code=400)

    title = (payload.title or "Not specified").strip() or "Not specified"
    role = (payload.role or "Not specified").strip() or "Not specified"

    prompt = (
        "You are an expert technical recruiter. Analyze the following job description and extract two categorized skill lists.\n\n"
        f"Job Title: {title}\n"
        f"Role: {role}\n\n"
        "Job Description:\n"
        f"{description[:4000]}\n\n"
        "Return ONLY valid JSON in this exact format:\n"
        "{\n"
        '  "must_have_skills": ["skill1", "skill2", ...],\n'
        '  "good_to_have_skills": ["skill1", "skill2", ...]\n'
        "}\n\n"
        "Rules:\n"
        "- \"must_have_skills\": Core technical skills explicitly required or strongly implied (5-10 skills)\n"
        "- \"good_to_have_skills\": Nice-to-have, supplementary, or bonus skills (3-8 skills)\n"
        "- Use concise, industry-standard skill names (e.g., \"React\", \"Node.js\", \"AWS\", \"Salesforce Apex\")\n"
        "- Do NOT include soft skills or generic terms like \"communication\" or \"teamwork\"\n"
        "- Do NOT duplicate skills between the two lists"
    )

    try:
        ai = get_ai()
        result = await ai.generate_json(prompt, temperature=0.1, max_tokens=1200, timeout_s=20)

        must_have_raw = result.get("must_have_skills") if isinstance(result, dict) else None
        good_to_have_raw = result.get("good_to_have_skills") if isinstance(result, dict) else None

        must_have = [s.strip() for s in (must_have_raw or []) if isinstance(s, str) and s.strip()]
        good_to_have = [s.strip() for s in (good_to_have_raw or []) if isinstance(s, str) and s.strip()]

        return ok(ExtractSkillsResponse(must_have_skills=must_have, good_to_have_skills=good_to_have).model_dump())
    except Exception as e:
        return api_error(message=f"Failed to extract skills. Please try again. ({e})", status_code=502)


@router.get("")
@router.get("/")
async def list_jobs(
    role: Optional[str] = None,
    level: Optional[str] = None,
    is_active: Optional[bool] = None,
    user: ClerkUser = Depends(require_user)
):
    """List jobs created by user."""
    db = get_db_admin_service()

    def _fetch():
        q = db.client.from_("job_descriptions").select("*").eq("created_by", user.id)
        if role:
            q = q.ilike("role", f"%{role}%")
        if level:
            q = q.eq("level", level)
        if is_active is not None:
            q = q.eq("is_active", is_active)
        res = q.order("created_at", desc=True).execute()
        return res.data or []

    data = await db.run(_fetch)
    return ok(data)


@router.get("/{job_id}")
async def get_job(job_id: str, user: ClerkUser = Depends(require_user)):
    """Get specific job."""
    db = get_db_admin_service()

    def _fetch():
        res = db.client.from_("job_descriptions").select("*").eq("id", job_id).eq("created_by", user.id).maybe_single().execute()
        return res.data

    data = await db.run(_fetch)
    if not data:
        return api_error(message="Job not found", status_code=404)
    return ok(data)


@router.post("")
@router.post("/")
async def create_job(payload: Dict[str, Any], user: ClerkUser = Depends(require_user)):
    """Create a new job description."""
    db = get_db_admin_service()
    
    # Billing check bypassed locally for create_job if no RPC exists
    pass

    # Validate end_customer_name is required when endCustomer is 'end_customer'
    end_customer_val = payload.get("endCustomer") or payload.get("end_customer")
    end_customer_name_val = (payload.get("end_customer_name") or "").strip() or None
    if end_customer_val == "end_customer" and not end_customer_name_val:
        return api_error(message="Name of Customer/Client is required when hiring for End Customer", status_code=400)

    # Validate Salesforce/Apex flags: include_apex_assessment requires is_salesforce_job=True
    is_salesforce_job = bool(payload.get("is_salesforce_job", False))
    include_apex_assessment = bool(payload.get("include_apex_assessment", False))
    if include_apex_assessment and not is_salesforce_job:
        return api_error(
            message="include_apex_assessment can only be enabled when is_salesforce_job is true.",
            status_code=400,
        )

    job_data = {
        "title": payload.get("title"),
        "role": payload.get("role"),
        "level": payload.get("level"),
        "description": payload.get("description"),
        "must_have_skills": payload.get("must_have_skills") or [],
        "good_to_have_skills": payload.get("good_to_have_skills") or [],
        "min_experience_years": payload.get("min_experience_years") or 0,
        "resume_cutoff": payload.get("resume_cutoff", 35),
        "assessment_cutoff": payload.get("assessment_cutoff", 40),
        "interview_cutoff": payload.get("interview_cutoff", 40),
        "include_sql_assessment": payload.get("include_sql_assessment", False),
        "location": payload.get("location"),
        "end_customer": end_customer_val,
        "end_customer_name": end_customer_name_val if end_customer_val == "end_customer" else None,
        "is_salesforce_job": is_salesforce_job,
        "include_apex_assessment": include_apex_assessment,
        "is_active": True,
        "created_by": user.id,
    }

    def _insert():
        res = db.client.from_("job_descriptions").insert(job_data).execute()
        return res.data

    data = await db.run(_insert)
    row = data[0] if isinstance(data, list) and data else None
    if not isinstance(row, dict):
        return api_error(message="Failed to create job", status_code=500)
        
    def _update_profile():
        res = db.client.from_("profiles").select("jobs_count").eq("user_id", user.id).maybe_single().execute()
        if res.data:
            db.client.from_("profiles").update({"jobs_count": (res.data.get("jobs_count") or 0) + 1}).eq("user_id", user.id).execute()
            
    await db.run(_update_profile)

    return ok(row, status_code=201)


@router.patch("/{job_id}")
async def update_job(job_id: str, payload: Dict[str, Any], user: ClerkUser = Depends(require_user)):
    """Update a job description."""
    db = get_db_admin_service()
    
    allowed_keys = [
        "title", "role", "level", "description",
        "must_have_skills", "good_to_have_skills", "min_experience_years",
        "is_active", "resume_cutoff", "assessment_cutoff", "interview_cutoff",
        "include_sql_assessment",
        "location", "end_customer", "end_customer_name",
        "is_salesforce_job", "include_apex_assessment",
    ]
    
    update_data = {k: v for k, v in payload.items() if k in allowed_keys}

    # Normalise: accept endCustomer as alias
    if "endCustomer" in payload and "end_customer" not in update_data:
        update_data["end_customer"] = payload["endCustomer"]

    # Validate end_customer_name required when end_customer is 'end_customer'
    ec = update_data.get("end_customer")
    if ec == "end_customer":
        ecn = (update_data.get("end_customer_name") or "").strip() or None
        if not ecn:
            return api_error(message="Name of Customer/Client is required when hiring for End Customer", status_code=400)
        update_data["end_customer_name"] = ecn
    elif ec and ec != "end_customer":
        update_data["end_customer_name"] = None

    # Validate Salesforce/Apex flags: include_apex_assessment requires is_salesforce_job=True.
    # We must consider both the payload values and the existing values in the DB.
    if "is_salesforce_job" in update_data or "include_apex_assessment" in update_data:
        # Fetch current job state to cross-validate
        def _fetch_current():
            return (
                db.client.from_("job_descriptions")
                .select("is_salesforce_job, include_apex_assessment")
                .eq("id", job_id)
                .eq("created_by", user.id)
                .maybe_single()
                .execute()
            )
        current_res = await db.run(_fetch_current)
        current = getattr(current_res, "data", None) or {}

        # Resolve effective values (payload overrides current)
        effective_is_salesforce = update_data.get(
            "is_salesforce_job",
            current.get("is_salesforce_job", False)
        )
        effective_include_apex = update_data.get(
            "include_apex_assessment",
            current.get("include_apex_assessment", False)
        )
        if effective_include_apex and not effective_is_salesforce:
            return api_error(
                message="include_apex_assessment can only be enabled when is_salesforce_job is true.",
                status_code=400,
            )
        # If is_salesforce_job is being set to False, force include_apex_assessment to False too.
        if "is_salesforce_job" in update_data and not update_data["is_salesforce_job"]:
            update_data["include_apex_assessment"] = False

    if not update_data:
        return api_error(message="No valid fields to update", status_code=400)

    def _update():
        res = db.client.from_("job_descriptions").update(update_data).eq("id", job_id).eq("created_by", user.id).execute()
        return res

    up_res = await db.run(_update)
    if getattr(up_res, "error", None):
        return api_error(message="Job not found or access denied", status_code=404)

    def _fetch():
        res = db.client.from_("job_descriptions").select("*").eq("id", job_id).eq("created_by", user.id).maybe_single().execute()
        return res.data

    data = await db.run(_fetch)
    if not data:
        return api_error(message="Job not found or access denied", status_code=404)
        
    return ok(data)


@router.delete("/{job_id}")
async def delete_job(job_id: str, permanent: bool = False, user: ClerkUser = Depends(require_user)):
    """Archive or permanently delete a job."""
    db = get_db_admin_service()
    
    if permanent:
        def _delete():
            job = db.client.from_("job_descriptions").select("id").eq("id", job_id).eq("created_by", user.id).maybe_single().execute()
            if not job.data:
                return None
                
            db.client.from_("assessment_sessions").delete().eq("job_id", job_id).execute()
            db.client.from_("interview_sessions").delete().eq("job_id", job_id).execute()
            db.client.from_("ats_screenings").delete().eq("job_id", job_id).execute()
            db.client.from_("job_applications").delete().eq("job_id", job_id).execute()
            
            # candidates clean up (simplified)
            res = db.client.from_("job_descriptions").delete().eq("id", job_id).eq("created_by", user.id).execute()
            return res.data
            
        data = await db.run(_delete)
        if data is None:
            return api_error(message="Job not found", status_code=404)
            
        def _update_profile():
            res = db.client.from_("profiles").select("jobs_count").eq("user_id", user.id).maybe_single().execute()
            if res.data and (res.data.get("jobs_count") or 0) > 0:
                db.client.from_("profiles").update({"jobs_count": res.data["jobs_count"] - 1}).eq("user_id", user.id).execute()
                
        await db.run(_update_profile)
        return ok({"success": True, "message": "Job permanently deleted"})
    else:
        def _archive():
            res = db.client.from_("job_descriptions").update({"is_active": False}).eq("id", job_id).eq("created_by", user.id).execute()
            return res
            
        arch_res = await db.run(_archive)
        if getattr(arch_res, "error", None):
            return api_error(message="Job not found or access denied", status_code=404)
        return ok({"success": True, "message": "Job archived successfully"})
