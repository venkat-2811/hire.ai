from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import List, Optional, Literal
import os
import uuid
from datetime import datetime
from app.models.schemas import (
    Candidate, CandidateCreate, CandidateUpdate, APIResponse, ResumeData
)
from app.database import get_supabase_client, get_supabase_admin_client
from app.services.resume_parser import get_resume_parser
from app.config import get_settings

router = APIRouter(prefix="/candidates", tags=["Candidates"])


@router.get("", response_model=List[Candidate])
async def list_candidates(
    limit: int = 50,
    offset: int = 0
):
    """List all candidates with pagination. Returns one entry per job application."""
    supabase = get_supabase_client()
    
    result = supabase.table("candidates").select("*").order(
        "created_at", desc=True
    ).range(offset, offset + limit - 1).execute()
    
    # Lookup ALL job_ids from job_applications for all candidates
    candidate_ids = [row["id"] for row in result.data]
    # Map candidate_id -> list of job_ids
    job_map: dict[str, list[str]] = {}
    if candidate_ids:
        try:
            apps = supabase.table("job_applications").select(
                "candidate_id, job_id"
            ).in_("candidate_id", candidate_ids).order("applied_at", desc=True).execute()
            for app in (apps.data or []):
                cid = app["candidate_id"]
                if cid not in job_map:
                    job_map[cid] = []
                job_map[cid].append(app["job_id"])
        except Exception:
            pass  # job_applications table may not exist yet
    
    # Return one entry per job application so candidates are grouped by job
    candidates = []
    for row in result.data:
        applied_jobs = job_map.get(row["id"], [])
        if applied_jobs:
            for jid in applied_jobs:
                candidates.append(_row_to_candidate(row, job_id=jid))
        # Skip candidates with no job applications
    
    return candidates


@router.get("/{candidate_id}", response_model=Candidate)
async def get_candidate(candidate_id: str):
    """Get a specific candidate."""
    supabase = get_supabase_client()
    
    result = supabase.table("candidates").select("*").eq("id", candidate_id).single().execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    return _row_to_candidate(result.data)


@router.post("", response_model=Candidate)
async def create_candidate(
    candidate: CandidateCreate
):
    """Create a new candidate or reuse an existing one by email. Optionally links to a job."""
    supabase = get_supabase_client()
    
    # Check if a candidate with the same email already exists
    existing = supabase.table("candidates").select("*").eq("email", candidate.email).execute()
    
    candidate_id = None
    job_id = getattr(candidate, 'job_id', None)
    
    if existing.data:
        # Reuse existing candidate, update their info
        candidate_id = existing.data[0]["id"]
        update_data = {
            "full_name": candidate.full_name,
            "phone": candidate.phone,
            "portfolio_url": candidate.portfolio_url,
            "github_url": candidate.github_url,
            "consent_given": candidate.consent_given,
            "consent_timestamp": datetime.utcnow().isoformat() if candidate.consent_given else None,
        }
        supabase.table("candidates").update(update_data).eq("id", candidate_id).execute()
        row = supabase.table("candidates").select("*").eq("id", candidate_id).single().execute()
        candidate_row = row.data
    else:
        # Create new candidate record
        data = {
            "full_name": candidate.full_name,
            "email": candidate.email,
            "phone": candidate.phone,
            "portfolio_url": candidate.portfolio_url,
            "github_url": candidate.github_url,
            "consent_given": candidate.consent_given,
            "consent_timestamp": datetime.utcnow().isoformat() if candidate.consent_given else None,
        }
        result = supabase.table("candidates").insert(data).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create candidate")
        candidate_row = result.data[0]
        candidate_id = candidate_row["id"]
    
    # Create job_application record if job_id is provided
    if job_id:
        # Check if already applied to this job
        existing_app = supabase.table("job_applications").select("id").eq(
            "candidate_id", candidate_id
        ).eq("job_id", job_id).execute()
        
        if existing_app.data:
            raise HTTPException(status_code=400, detail="This candidate has already applied to this job")
        
        try:
            app_data = {
                "id": str(uuid.uuid4()),
                "candidate_id": candidate_id,
                "job_id": job_id,
                "status": "applied",
                "applied_at": datetime.utcnow().isoformat(),
            }
            supabase.table("job_applications").insert(app_data).execute()
        except Exception as e:
            print(f"Failed to create job application: {e}")
    
    return _row_to_candidate(candidate_row, job_id=job_id)



@router.patch("/{candidate_id}", response_model=Candidate)
async def update_candidate(candidate_id: str, candidate: CandidateUpdate):
    """Update a candidate."""
    supabase = get_supabase_client()
    
    update_data = candidate.model_dump(exclude_unset=True)
    
    result = supabase.table("candidates").update(update_data).eq("id", candidate_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    return _row_to_candidate(result.data[0])


@router.delete("/{candidate_id}", response_model=APIResponse)
async def delete_candidate(candidate_id: str):
    """Delete a candidate."""
    supabase = get_supabase_client()
    
    # Check if candidate exists first
    existing = supabase.table("candidates").select("id").eq("id", candidate_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Candidate not found")

    try:
        # DB is expected to have ON DELETE CASCADE for related tables (interviews, assessments, etc.)
        # If not, we would need to manually delete them here.
        # Assuming CASCADE is configured for now based on existing bulk logic.
        supabase.table("candidates").delete().eq("id", candidate_id).execute()
        return APIResponse(success=True, message="Candidate deleted successfully")
    except Exception as e:
        print(f"Error deleting candidate {candidate_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete candidate: {str(e)}")


@router.post("/{candidate_id}/upload-resume", response_model=Candidate)
async def upload_resume(
    candidate_id: str,
    resume: UploadFile = File(...)
):
    """Upload or replace a candidate's resume."""
    supabase = get_supabase_client()
    settings = get_settings()
    
    # Verify candidate exists
    existing = supabase.table("candidates").select("id").eq("id", candidate_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Validate file type
    allowed_types = [".pdf", ".doc", ".docx"]
    file_ext = os.path.splitext(resume.filename)[1].lower()
    if file_ext not in allowed_types:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}"
        )
    
    # Read and save file
    file_content = await resume.read()
    file_id = str(uuid.uuid4())
    file_path = os.path.join(settings.upload_dir, f"{file_id}{file_ext}")
    os.makedirs(settings.upload_dir, exist_ok=True)
    
    with open(file_path, "wb") as f:
        f.write(file_content)
    
    # Parse resume
    resume_text = None
    resume_parsed_data = None
    
    try:
        parser = get_resume_parser()
        resume_text, parsed_data = await parser.parse_resume(file_content, resume.filename)
        resume_parsed_data = parsed_data.model_dump()
    except Exception:
        pass
    
    # Update candidate
    update_data = {
        "resume_url": file_path,
        "resume_text": resume_text,
        "resume_parsed_data": resume_parsed_data
    }
    
    result = supabase.table("candidates").update(update_data).eq("id", candidate_id).execute()
    
    return _row_to_candidate(result.data[0])


@router.get("/{candidate_id}/parsed-resume", response_model=ResumeData)
async def get_parsed_resume(candidate_id: str):
    """Get the parsed resume data for a candidate."""
    supabase = get_supabase_client()
    
    result = supabase.table("candidates").select(
        "resume_parsed_data"
    ).eq("id", candidate_id).single().execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    parsed_data = result.data.get("resume_parsed_data")
    if not parsed_data:
        raise HTTPException(status_code=404, detail="No parsed resume data available")
    
    return ResumeData(**parsed_data)


class BulkEmailRequest(BaseModel):
    candidate_ids: List[str]
    job_id: str


class BulkEmailResponse(BaseModel):
    success: bool
    emails_sent: int
    failed: List[str]
    error_messages: Optional[List[str]] = None


@router.post("/send-acceptance", response_model=BulkEmailResponse)
async def send_acceptance_emails(request: BulkEmailRequest):
    """Send acceptance emails to selected candidates."""
    from app.services.email_service import get_email_service
    
    supabase = get_supabase_admin_client()
    email_service = get_email_service()
    
    # Get job details
    job_result = supabase.table("job_descriptions").select("id, title").eq("id", request.job_id).execute()
    if not job_result.data:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = job_result.data[0]
    
    # Get candidates
    candidates_result = supabase.table("candidates").select(
        "id, email, full_name"
    ).in_("id", request.candidate_ids).execute()
    
    if not candidates_result.data:
        raise HTTPException(status_code=404, detail="No candidates found")
    
    emails_sent = 0
    failed = []
    error_messages: List[str] = []
    
    for candidate in candidates_result.data:
        try:
            await email_service.send_acceptance_email(
                to=candidate["email"],
                candidate_name=candidate["full_name"],
                job_title=job["title"],
            )
            
            # Update candidate status in job_applications
            supabase.table("job_applications").update({
                "final_status": "accepted"
            }).eq("candidate_id", candidate["id"]).eq("job_id", request.job_id).execute()
            
            emails_sent += 1
        except Exception as e:
            print(f"Failed to send acceptance email to {candidate['email']}: {e}")
            failed.append(candidate["id"])

            msg = str(e)
            if msg:
                error_messages.append(f"{candidate.get('email')}: {msg}")
    
    return BulkEmailResponse(
        success=emails_sent > 0 and len(failed) == 0,
        emails_sent=emails_sent,
        failed=failed,
        error_messages=error_messages or None,
    )


@router.post("/send-rejection", response_model=BulkEmailResponse)
async def send_rejection_emails(request: BulkEmailRequest):
    """Send rejection emails to selected candidates and optionally delete them."""
    from app.services.email_service import get_email_service
    
    supabase = get_supabase_admin_client()
    email_service = get_email_service()
    
    # Get job details
    job_result = supabase.table("job_descriptions").select("id, title").eq("id", request.job_id).execute()
    if not job_result.data:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = job_result.data[0]
    
    # Get candidates
    candidates_result = supabase.table("candidates").select(
        "id, email, full_name"
    ).in_("id", request.candidate_ids).execute()
    
    if not candidates_result.data:
        raise HTTPException(status_code=404, detail="No candidates found")
    
    emails_sent = 0
    failed = []
    error_messages: List[str] = []
    
    for candidate in candidates_result.data:
        try:
            await email_service.send_rejection_email(
                to=candidate["email"],
                candidate_name=candidate["full_name"],
                job_title=job["title"],
            )
            
            # Update candidate status (Audit trail) - Optional since we delete, but good for logs if delete fails
            supabase.table("job_applications").update({
                "final_status": "rejected"
            }).eq("candidate_id", candidate["id"]).eq("job_id", request.job_id).execute()
            
            emails_sent += 1
            
            # Auto-delete candidate as per privacy requirements
            try:
                supabase.table("candidates").delete().eq("id", candidate["id"]).execute()
            except Exception as e:
                print(f"Failed to auto-delete candidate {candidate['id']}: {e}")
                
        except Exception as e:
            print(f"Failed to send rejection email to {candidate['email']}: {e}")
            failed.append(candidate["id"])

            msg = str(e)
            if msg:
                error_messages.append(f"{candidate.get('email')}: {msg}")
    
    return BulkEmailResponse(
        success=emails_sent > 0 and len(failed) == 0,
        emails_sent=emails_sent,
        failed=failed,
        error_messages=error_messages or None,
    )


@router.delete("/bulk-delete")
async def bulk_delete_candidates(candidate_ids: List[str]):
    """Delete multiple candidates (filtered out candidates)."""
    supabase = get_supabase_admin_client()
    
    deleted = 0
    for candidate_id in candidate_ids:
        try:
            supabase.table("candidates").delete().eq("id", candidate_id).execute()
            deleted += 1
        except Exception as e:
            print(f"Failed to delete candidate {candidate_id}: {e}")
    
    return {"success": True, "deleted": deleted}


class SendOfferLetterRequest(BaseModel):
    candidate_id: str
    job_id: str
    ctc: str  # Annual Cost to Company - required
    company_name: Optional[str] = None
    document_format: Literal["pdf", "doc"] = "pdf"
    time_period_years: Optional[int] = None
    time_period_months: Optional[int] = None
    start_date: Optional[str] = None
    reporting_manager: Optional[str] = None
    location: Optional[str] = None


class SendOfferLetterResponse(BaseModel):
    success: bool
    message: str


@router.post("/send-offer-letter", response_model=SendOfferLetterResponse)
async def send_offer_letter(request: SendOfferLetterRequest):
    """
    Generate a PDF offer letter and email it to a single candidate.
    Requires the acceptance email to have been sent first (final_status = 'accepted').
    """
    from app.services.email_service import get_email_service
    from app.services.offer_letter_service import generate_offer_letter_pdf, generate_offer_letter_doc

    supabase = get_supabase_admin_client()
    email_service = get_email_service()

    # Validate that the candidate was formally accepted
    app_result = supabase.table("job_applications").select(
        "final_status"
    ).eq("candidate_id", request.candidate_id).eq("job_id", request.job_id).execute()

    if not app_result.data:
        raise HTTPException(
            status_code=404,
            detail="No job application found for this candidate and job."
        )

    final_status = app_result.data[0].get("final_status")
    if final_status == "rejected":
        raise HTTPException(
            status_code=400,
            detail="Cannot send an offer letter to a rejected candidate."
        )

    if not request.ctc or not request.ctc.strip():
        raise HTTPException(
            status_code=400,
            detail="CTC (Cost to Company) is required to send an offer letter."
        )

    if not request.company_name:
        raise HTTPException(
            status_code=400,
            detail="Company name is required to send an offer letter."
        )

    # Get candidate details
    candidate_result = supabase.table("candidates").select(
        "id, email, full_name"
    ).eq("id", request.candidate_id).single().execute()

    if not candidate_result.data:
        raise HTTPException(status_code=404, detail="Candidate not found")

    candidate = candidate_result.data

    # Get job details for title
    job_result = supabase.table("job_descriptions").select("title").eq("id", request.job_id).execute()
    if not job_result.data:
        raise HTTPException(status_code=404, detail="Job not found")

    job_title = job_result.data[0]["title"]
    company_name = request.company_name or "Our Company"

    try:
        if request.document_format == "doc":
            attachment_bytes = generate_offer_letter_doc(
                candidate_name=candidate["full_name"],
                candidate_email=candidate["email"],
                job_title=job_title,
                company_name=company_name,
                ctc=request.ctc,
                time_period_years=request.time_period_years,
                time_period_months=request.time_period_months,
                start_date=request.start_date,
                reporting_manager=request.reporting_manager,
                location=request.location,
            )
            attachment_filename = f"Offer_Letter_{candidate['full_name'].replace(' ', '_')}.doc"
            attachment_content_type = "application/msword"
        else:
            attachment_bytes = generate_offer_letter_pdf(
                candidate_name=candidate["full_name"],
                candidate_email=candidate["email"],
                job_title=job_title,
                company_name=company_name,
                ctc=request.ctc,
                time_period_years=request.time_period_years,
                time_period_months=request.time_period_months,
                start_date=request.start_date,
                reporting_manager=request.reporting_manager,
                location=request.location,
            )
            attachment_filename = f"Offer_Letter_{candidate['full_name'].replace(' ', '_')}.pdf"
            attachment_content_type = "application/pdf"

        # Generate secure acceptance token
        from jose import jwt
        from datetime import timedelta

        settings = get_settings()
        secret = settings.supabase_service_key
        if not secret:
            raise HTTPException(status_code=500, detail="Offer token signing secret is not configured")
        payload = {
            "candidate_id": candidate["id"],
            "job_id": request.job_id,
            "jti": str(uuid.uuid4()),
            "exp": datetime.utcnow() + timedelta(days=7)
        }
        token = jwt.encode(payload, secret, algorithm="HS256")

        # Link goes to the frontend SPA acceptance page (not a backend HTML route)
        base_url = str(settings.frontend_url).rstrip("/")
        acceptance_link = f"{base_url}/offer-acceptance?token={token}"

        # Send the email with attachment and the acceptance link
        await email_service.send_offer_letter_email(
            to=candidate["email"],
            candidate_name=candidate["full_name"],
            job_title=job_title,
            company_name=company_name,
            attachment_bytes=attachment_bytes,
            attachment_filename=attachment_filename,
            attachment_content_type=attachment_content_type,
            acceptance_link=acceptance_link,
        )

        # Update the application status to offer_sent
        existing_notes_result = supabase.table("job_applications").select(
            "notes"
        ).eq("candidate_id", request.candidate_id).eq("job_id", request.job_id).single().execute()
        existing_notes = (existing_notes_result.data or {}).get("notes") or ""
        offer_snapshot_note = (
            f"\n[Offer Letter Snapshot]\n"
            f"Company Name: {company_name}\n"
            f"CTC: {request.ctc}\n"
            f"Contract Years: {request.time_period_years if request.time_period_years is not None else ''}\n"
            f"Contract Months: {request.time_period_months if request.time_period_months is not None else ''}\n"
            f"Start Date: {request.start_date or ''}\n"
            f"Reporting Manager: {request.reporting_manager or ''}\n"
            f"Location: {request.location or ''}\n"
            f"Attachment Format: {request.document_format.upper()}\n"
        )
        supabase.table("job_applications").update({
            "final_status": "offer_sent",
            "notes": (existing_notes + offer_snapshot_note).strip(),
        }).eq("candidate_id", request.candidate_id).eq("job_id", request.job_id).execute()

        return SendOfferLetterResponse(
            success=True,
            message=f"Offer letter sent successfully to {candidate['email']}"
        )

    except Exception as e:
        print(f"Failed to send offer letter to {candidate['email']}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send offer letter: {str(e)}"
        )


@router.get("/offer-details")
async def get_offer_details(token: str):
    """
    Return offer letter details as JSON for the frontend acceptance page.
    The token identifies candidate and job; details are fetched from persisted snapshot.
    """
    from jose import jwt, JWTError
    settings = get_settings()
    secret = settings.supabase_service_key
    if not secret:
        raise HTTPException(status_code=500, detail="Offer token signing secret is not configured")

    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired offer link")

    candidate_id = payload.get("candidate_id")
    job_id = payload.get("job_id")
    if not candidate_id or not job_id:
        raise HTTPException(status_code=400, detail="Invalid token payload")

    supabase = get_supabase_admin_client()
    app_result = supabase.table("job_applications").select(
        "final_status, offer_signature_name, offer_accepted_at, offer_acceptance_ip"
    ).eq("candidate_id", candidate_id).eq("job_id", job_id).execute()

    already_accepted = (
        app_result.data and
        app_result.data[0].get("final_status") in ("accepted", "offer_accepted")
    )

    candidate_result = supabase.table("candidates").select("full_name, email").eq("id", candidate_id).single().execute()
    job_result = supabase.table("job_descriptions").select("title").eq("id", job_id).single().execute()
    if not candidate_result.data or not job_result.data:
        raise HTTPException(status_code=404, detail="Offer details not found")

    notes = (supabase.table("job_applications").select("notes").eq("candidate_id", candidate_id).eq("job_id", job_id).single().execute().data or {}).get("notes") or ""

    def extract_detail(prefix: str) -> Optional[str]:
        for line in notes.splitlines():
            if line.startswith(prefix):
                return line.replace(prefix, "", 1).strip() or None
        return None

    contract_years = extract_detail("Contract Years:")
    contract_months = extract_detail("Contract Months:")

    return {
        "candidate_id": candidate_id,
        "job_id": job_id,
        "candidate_name": candidate_result.data.get("full_name"),
        "candidate_email": candidate_result.data.get("email"),
        "job_title": job_result.data.get("title"),
        "company_name": extract_detail("Company Name:") or "Our Company",
        "ctc": extract_detail("CTC:") or "As per offer letter attachment",
        "time_period_years": int(contract_years) if contract_years else None,
        "time_period_months": int(contract_months) if contract_months else None,
        "start_date": extract_detail("Start Date:"),
        "reporting_manager": extract_detail("Reporting Manager:"),
        "location": extract_detail("Location:"),
        "accepted_signature_name": app_result.data[0].get("offer_signature_name") if app_result.data else None,
        "accepted_at": app_result.data[0].get("offer_accepted_at") if app_result.data else None,
        "accepted_ip": app_result.data[0].get("offer_acceptance_ip") if app_result.data else None,
        "already_accepted": already_accepted,
    }


@router.get("/accept-offer", response_class=HTMLResponse)
async def accept_offer_redirect(request: Request, token: str):
    """
    Legacy redirect: when candidate clicks the email button, redirect them
    to the frontend acceptance page which fetches offer details and handles signature.
    """
    from app.config import get_settings
    settings = get_settings()
    base_url = str(settings.frontend_url).rstrip("/")
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=f"{base_url}/offer-acceptance?token={token}")


class SubmitAcceptanceRequest(BaseModel):
    token: str
    full_name_signature: str  # Candidate's typed full name as digital signature


@router.post("/submit-offer-acceptance")
async def submit_offer_acceptance(request: Request, body: SubmitAcceptanceRequest):
    """
    Called by the frontend OfferAcceptancePage when the candidate confirms acceptance
    with their digital signature (typed full name).
    """
    from jose import jwt, JWTError
    settings = get_settings()
    secret = settings.supabase_service_key
    if not secret:
        raise HTTPException(status_code=500, detail="Offer token signing secret is not configured")

    try:
        payload = jwt.decode(body.token, secret, algorithms=["HS256"])
        candidate_id = payload.get("candidate_id")
        job_id = payload.get("job_id")
        if not candidate_id or not job_id:
            raise JWTError("Missing fields")
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired acceptance link")

    if not body.full_name_signature or not body.full_name_signature.strip():
        raise HTTPException(status_code=400, detail="Full name signature is required to accept the offer")

    supabase = get_supabase_admin_client()

    app_result = supabase.table("job_applications").select(
        "final_status, notes, offer_signature_name, offer_accepted_at"
    ).eq("candidate_id", candidate_id).eq("job_id", job_id).execute()

    if not app_result.data:
        raise HTTPException(status_code=404, detail="Job application not found")

    app_data = app_result.data[0]
    if app_data.get("final_status") == "offer_accepted":
        return {"success": True, "message": "Offer already accepted", "already_accepted": True}
    if app_data.get("final_status") not in ("offer_sent", "accepted"):
        raise HTTPException(status_code=400, detail="Offer is not currently open for acceptance")

    # Audit trail
    client_ip = request.client.host if request.client else "Unknown IP"
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    existing_notes = app_data.get("notes") or ""
    metadata_note = (
        f"\n[Digital Offer Acceptance]\n"
        f"Accepted at: {timestamp}\n"
        f"IP Address: {client_ip}\n"
        f"Digital Signature: {body.full_name_signature.strip()}\n"
    )
    new_notes = (existing_notes + metadata_note).strip()

    supabase.table("job_applications").update({
        "final_status": "offer_accepted",
        "notes": new_notes,
        "offer_signature_name": body.full_name_signature.strip(),
        "offer_accepted_at": datetime.utcnow().isoformat(),
        "offer_acceptance_ip": client_ip,
    }).eq("candidate_id", candidate_id).eq("job_id", job_id).execute()

    return {
        "success": True,
        "message": "Offer accepted successfully. Welcome aboard!",
        "already_accepted": False,
    }



def _row_to_candidate(row: dict, job_id: str = None) -> Candidate:
    """Convert database row to Candidate model."""
    parsed_data = None
    if row.get("resume_parsed_data"):
        try:
            parsed_data = ResumeData(**row["resume_parsed_data"])
        except Exception:
            pass
    
    return Candidate(
        id=row["id"],
        user_id=row.get("user_id"),
        email=row["email"],
        full_name=row["full_name"],
        phone=row.get("phone"),
        resume_url=row.get("resume_url"),
        resume_text=row.get("resume_text"),
        resume_parsed_data=parsed_data,
        portfolio_url=row.get("portfolio_url"),
        github_url=row.get("github_url"),
        consent_given=row.get("consent_given", False),
        consent_timestamp=row.get("consent_timestamp"),
        job_id=job_id,
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at")
    )
