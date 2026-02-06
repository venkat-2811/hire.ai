"""
Public job application endpoints.
Candidates can view jobs and submit applications without hiring manager auth.
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from typing import Optional
from pydantic import BaseModel, EmailStr
from datetime import datetime
import uuid
import os

from app.database.supabase_client import get_supabase_admin_client
from app.services.email_service import get_email_service
from app.services.resume_parser import get_resume_parser
from app.config import get_settings
from app.auth import get_optional_user, ClerkUser

router = APIRouter(prefix="/apply", tags=["applications"])


class PublicJobResponse(BaseModel):
    id: str
    title: str
    role: str
    level: str
    description: str
    must_have_skills: list[str]
    good_to_have_skills: list[str]
    min_experience_years: int


class ApplicationSubmission(BaseModel):
    job_id: str
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    portfolio_url: Optional[str] = None
    github_url: Optional[str] = None
    consent_given: bool


class ApplicationResponse(BaseModel):
    id: str
    job_id: str
    candidate_id: str
    status: str
    message: str


@router.get("/job/{job_id}", response_model=PublicJobResponse)
async def get_public_job(job_id: str):
    """Get public job details for application page. No auth required."""
    supabase = get_supabase_admin_client()
    
    result = supabase.table("job_descriptions").select(
        "id, title, role, level, description, must_have_skills, good_to_have_skills, min_experience_years, is_active"
    ).eq("id", job_id).eq("is_active", True).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Job not found or no longer accepting applications")
    
    job = result.data[0]
    return PublicJobResponse(**job)


@router.post("/submit", response_model=ApplicationResponse)
async def submit_application(
    job_id: str = Form(...),
    full_name: str = Form(...),
    email: str = Form(...),
    phone: Optional[str] = Form(None),
    portfolio_url: Optional[str] = Form(None),
    github_url: Optional[str] = Form(None),
    consent_given: bool = Form(...),
    resume: Optional[UploadFile] = File(None),
    user: Optional[ClerkUser] = Depends(get_optional_user),
):
    """Submit a job application. Candidates can optionally be logged in via Clerk."""
    if not consent_given:
        raise HTTPException(status_code=400, detail="Consent is required to submit application")
    
    supabase = get_supabase_admin_client()
    settings = get_settings()
    
    # Verify job exists and is active
    job_result = supabase.table("job_descriptions").select(
        "id, title, is_active"
    ).eq("id", job_id).eq("is_active", True).execute()
    
    if not job_result.data:
        raise HTTPException(status_code=404, detail="Job not found or no longer accepting applications")
    
    job = job_result.data[0]
    
    # Check if candidate already applied to this job
    existing = supabase.table("candidates").select("id").eq("email", email).execute()
    if existing.data:
        # Check if already applied to this job
        candidate_id = existing.data[0]["id"]
        existing_app = supabase.table("job_applications").select("id").eq(
            "candidate_id", candidate_id
        ).eq("job_id", job_id).execute()
        
        if existing_app.data:
            raise HTTPException(status_code=400, detail="You have already applied to this job")
    
    # Handle resume upload
    resume_url = None
    resume_parsed_data = None
    resume_text = ""
    
    if resume:
        file_ext = resume.filename.split(".")[-1] if resume.filename else "pdf"
        file_name = f"{uuid.uuid4()}.{file_ext}"
        file_path = os.path.join(settings.upload_dir, file_name)
        
        os.makedirs(settings.upload_dir, exist_ok=True)
        
        content = await resume.read()
        with open(file_path, "wb") as f:
            f.write(content)
        
        resume_url = f"./{settings.upload_dir}/{file_name}"
        
        # Parse resume
        try:
            parser = get_resume_parser()
            # parser.parse_resume expects (file_content: bytes, filename: str)
            resume_text, parsed = await parser.parse_resume(content, resume.filename)
            resume_parsed_data = parsed.model_dump() if parsed else None
        except Exception as e:
            print(f"Resume parsing error: {e}")
            import traceback
            traceback.print_exc()
    
    # Create or update candidate
    candidate_data = {
        "full_name": full_name,
        "email": email,
        "phone": phone,
        "portfolio_url": portfolio_url,
        "github_url": github_url,
        "consent_given": consent_given,
        "consent_timestamp": datetime.utcnow().isoformat(),
        "user_id": user.id if user else None,
    }
    
    if resume_url:
        candidate_data["resume_url"] = resume_url
    if resume_parsed_data:
        candidate_data["resume_parsed_data"] = resume_parsed_data
        candidate_data["resume_text"] = resume_text
    
    if existing.data:
        # Update existing candidate
        candidate_id = existing.data[0]["id"]
        supabase.table("candidates").update(candidate_data).eq("id", candidate_id).execute()
    else:
        # Create new candidate
        candidate_data["id"] = str(uuid.uuid4())
        result = supabase.table("candidates").insert(candidate_data).execute()
        candidate_id = result.data[0]["id"]
    
    # Create job application record
    application_data = {
        "id": str(uuid.uuid4()),
        "candidate_id": candidate_id,
        "job_id": job_id,
        "status": "applied",
        "applied_at": datetime.utcnow().isoformat(),
    }
    
    supabase.table("job_applications").insert(application_data).execute()

    # Trigger ATS Screening immediately
    if resume_parsed_data:
        try:
            from app.services.ats_screening import get_ats_screening_service
            from app.models.schemas import ResumeData, JobDescription
            
            screening_service = get_ats_screening_service()
            
            # Reconstruct models
            resume_data_model = ResumeData(**resume_parsed_data)
            
            job_model = JobDescription(
                id=job["id"],
                title=job["title"],
                # Handle cases where job might fail validation if schema mismatch, but usually safe here
                role=job.get("role", "custom"), 
                level=job.get("level", "mid"),
                description=job.get("description", ""),
                must_have_skills=job.get("must_have_skills", []),
                good_to_have_skills=job.get("good_to_have_skills", []),
                min_experience_years=job.get("min_experience_years", 0),
                is_active=job.get("is_active", True),
                created_at=job.get("created_at"), # Optional
                updated_at=job.get("updated_at")  # Optional
            )
            
            # Execute Screening
            result = await screening_service.screen_candidate(
                resume_data_model, 
                resume_text, 
                job_model
            )
            
            # Manually save result to DB (Service doesn't save it)
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
                "detailed_analysis": result.detailed_analysis.model_dump() if result.detailed_analysis else None
            }
            
            # Upsert screening result
            existing_screening = supabase.table("ats_screenings").select("id").eq(
                "candidate_id", candidate_id
            ).eq("job_id", job_id).execute()
            
            if existing_screening.data:
                supabase.table("ats_screenings").update(screening_data).eq(
                    "id", existing_screening.data[0]["id"]
                ).execute()
            else:
                supabase.table("ats_screenings").insert(screening_data).execute()
                
            print(f"ATS Screening saved for candidate {candidate_id} on job {job_id}")

        except Exception as e:
            print(f"Failed to run ATS screening for {candidate_id}: {e}")
            import traceback
            traceback.print_exc()
    else:
        print("Skipping ATS screening: No resume parsed data available")
    
    # Send confirmation email
    try:
        email_service = get_email_service()
        await email_service.send_application_received(
            to=email,
            candidate_name=full_name,
            job_title=job["title"],
        )
        print(f"Application confirmation email sent to {email}")
    except Exception as e:
        print(f"Failed to send confirmation email to {email}: {e}")
        import traceback
        traceback.print_exc()
    
    return ApplicationResponse(
        id=application_data["id"],
        job_id=job_id,
        candidate_id=candidate_id,
        status="applied",
        message=f"Application submitted successfully for {job['title']}. Check your email for confirmation.",
    )


@router.get("/job/{job_id}/candidates")
async def get_job_applicants(
    job_id: str,
    user: ClerkUser = Depends(get_optional_user),
):
    """Get all candidates who applied to a specific job. Requires hiring manager auth."""
    # For now, allow access if user is logged in (will add role check later)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    supabase = get_supabase_admin_client()
    
    # Get all applications for this job with candidate details
    result = supabase.table("job_applications").select(
        "*, candidates(*)"
    ).eq("job_id", job_id).order("applied_at", desc=True).execute()
    
    return result.data or []
