from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from app.models.schemas import (
    JobDescription, JobDescriptionCreate, JobDescriptionUpdate, APIResponse
)
from app.models.enums import RoleLevel
from app.database import get_supabase_client, get_supabase_admin_client
from app.auth import get_current_user, ClerkUser

router = APIRouter(prefix="/jobs", tags=["Jobs"])


@router.get("", response_model=List[JobDescription])
async def list_jobs(
    role: Optional[str] = None,
    level: Optional[RoleLevel] = None,
    is_active: Optional[bool] = True,
    user: ClerkUser = Depends(get_current_user),
):
    """List all job descriptions with optional filters."""
    supabase = get_supabase_client()
    
    query = supabase.table("job_descriptions").select("*")
    
    # HR user isolation: only show jobs created by this user
    query = query.eq("created_by", user.id)
    
    if role:
        query = query.ilike("role", f"%{role}%")
    if level:
        query = query.eq("level", level.value)
    if is_active is not None:
        query = query.eq("is_active", is_active)
    
    query = query.order("created_at", desc=True)
    
    try:
        result = query.execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Supabase query failed: {e}")

    if getattr(result, "error", None):
        raise HTTPException(status_code=500, detail=str(result.error))
    
    jobs = []
    for row in result.data:
        jobs.append(JobDescription(
            id=row["id"],
            created_by=row.get("created_by"),
            title=row["title"],
            role=row["role"],
            level=row["level"],
            description=row["description"],
            must_have_skills=row.get("must_have_skills", []),
            good_to_have_skills=row.get("good_to_have_skills", []),
            min_experience_years=row.get("min_experience_years", 0),
            is_active=row.get("is_active", True),
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at")
        ))
    
    return jobs


@router.get("/{job_id}", response_model=JobDescription)
async def get_job(job_id: str):
    """Get a specific job description."""
    supabase = get_supabase_client()
    
    try:
        result = supabase.table("job_descriptions").select("*").eq("id", job_id).single().execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Supabase query failed: {e}")

    if getattr(result, "error", None):
        raise HTTPException(status_code=500, detail=str(result.error))
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Job not found")
    
    row = result.data
    return JobDescription(
        id=row["id"],
        created_by=row.get("created_by"),
        title=row["title"],
        role=row["role"],
        level=row["level"],
        description=row["description"],
        must_have_skills=row.get("must_have_skills", []),
        good_to_have_skills=row.get("good_to_have_skills", []),
        min_experience_years=row.get("min_experience_years", 0),
        is_active=row.get("is_active", True),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at")
    )


@router.post("", response_model=JobDescription)
async def create_job(job: JobDescriptionCreate, user: ClerkUser = Depends(get_current_user)):
    """Create a new job description."""
    supabase = get_supabase_admin_client()
    
    data = {
        "title": job.title,
        "role": job.role,
        "level": job.level.value,
        "description": job.description,
        "must_have_skills": job.must_have_skills,
        "good_to_have_skills": job.good_to_have_skills,
        "min_experience_years": job.min_experience_years,
        "is_active": True,
        "created_by": user.id,
    }
    
    result = supabase.table("job_descriptions").insert(data).execute()

    if getattr(result, "error", None):
        raise HTTPException(status_code=500, detail=str(result.error))
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create job")
    
    row = result.data[0]
    return JobDescription(
        id=row["id"],
        created_by=row.get("created_by"),
        title=row["title"],
        role=row["role"],
        level=row["level"],
        description=row["description"],
        must_have_skills=row.get("must_have_skills", []),
        good_to_have_skills=row.get("good_to_have_skills", []),
        min_experience_years=row.get("min_experience_years", 0),
        is_active=row.get("is_active", True),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at")
    )


@router.patch("/{job_id}", response_model=JobDescription)
async def update_job(job_id: str, job: JobDescriptionUpdate, user: ClerkUser = Depends(get_current_user)):
    """Update a job description."""
    supabase = get_supabase_admin_client()
    
    update_data = job.model_dump(exclude_unset=True)
    
    # Convert enums to values
    if "role" in update_data and update_data["role"]:
        update_data["role"] = update_data["role"]
    if "level" in update_data and update_data["level"]:
        update_data["level"] = update_data["level"].value
    
    # Verify ownership
    result = supabase.table("job_descriptions").update(update_data).eq("id", job_id).eq("created_by", user.id).execute()

    if getattr(result, "error", None):
        raise HTTPException(status_code=500, detail=str(result.error))
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Job not found")
    
    row = result.data[0]
    return JobDescription(
        id=row["id"],
        created_by=row.get("created_by"),
        title=row["title"],
        role=row["role"],
        level=row["level"],
        description=row["description"],
        must_have_skills=row.get("must_have_skills", []),
        good_to_have_skills=row.get("good_to_have_skills", []),
        min_experience_years=row.get("min_experience_years", 0),
        is_active=row.get("is_active", True),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at")
    )


@router.delete("/{job_id}", response_model=APIResponse)
async def delete_job(job_id: str, user: ClerkUser = Depends(get_current_user)):
    """Archive a job (soft delete)."""
    supabase = get_supabase_admin_client()
    
    # Verify ownership
    result = supabase.table("job_descriptions").update({"is_active": False}).eq("id", job_id).eq("created_by", user.id).execute()

    if getattr(result, "error", None):
        raise HTTPException(status_code=500, detail=str(result.error))
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return APIResponse(success=True, message="Job archived successfully")
