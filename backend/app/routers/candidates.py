from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import List, Optional
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
    """List all candidates with pagination."""
    supabase = get_supabase_client()
    
    result = supabase.table("candidates").select("*").order(
        "created_at", desc=True
    ).range(offset, offset + limit - 1).execute()
    
    # Lookup job_ids from job_applications for all candidates
    candidate_ids = [row["id"] for row in result.data]
    job_map = {}
    if candidate_ids:
        try:
            apps = supabase.table("job_applications").select(
                "candidate_id, job_id"
            ).in_("candidate_id", candidate_ids).order("applied_at", desc=True).execute()
            for app in (apps.data or []):
                # Use the most recent application's job_id
                if app["candidate_id"] not in job_map:
                    job_map[app["candidate_id"]] = app["job_id"]
        except Exception:
            pass  # job_applications table may not exist yet
    
    candidates = []
    for row in result.data:
        candidates.append(_row_to_candidate(row, job_id=job_map.get(row["id"])))
    
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
    full_name: str = Form(...),
    email: str = Form(...),
    phone: Optional[str] = Form(None),
    portfolio_url: Optional[str] = Form(None),
    github_url: Optional[str] = Form(None),
    consent_given: bool = Form(False),
    resume: Optional[UploadFile] = File(None)
):
    """Create a new candidate with optional resume upload."""
    supabase = get_supabase_client()
    settings = get_settings()
    
    resume_url = None
    resume_text = None
    resume_parsed_data = None
    
    # Process resume if uploaded
    if resume:
        # Validate file type
        allowed_types = [".pdf", ".doc", ".docx"]
        file_ext = os.path.splitext(resume.filename)[1].lower()
        if file_ext not in allowed_types:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}"
            )
        
        # Read file content
        file_content = await resume.read()
        
        # Save file locally
        file_id = str(uuid.uuid4())
        file_path = os.path.join(settings.upload_dir, f"{file_id}{file_ext}")
        os.makedirs(settings.upload_dir, exist_ok=True)
        
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        resume_url = file_path
        
        # Parse resume with AI
        try:
            parser = get_resume_parser()
            resume_text, parsed_data = await parser.parse_resume(file_content, resume.filename)
            resume_parsed_data = parsed_data.model_dump()
        except Exception as e:
            # Continue without parsing on error
            pass
    
    # Create candidate record
    data = {
        "full_name": full_name,
        "email": email,
        "phone": phone,
        "portfolio_url": portfolio_url,
        "github_url": github_url,
        "consent_given": consent_given,
        "consent_timestamp": datetime.utcnow().isoformat() if consent_given else None,
        "resume_url": resume_url,
        "resume_text": resume_text,
        "resume_parsed_data": resume_parsed_data
    }
    
    result = supabase.table("candidates").insert(data).execute()
    
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create candidate")
    
    return _row_to_candidate(result.data[0])


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
