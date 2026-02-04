"""
Assessment endpoints for technical assessments (MCQ + Coding).
Handles assessment creation, invites, submissions, and proctoring.
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
import uuid
import secrets

from app.database.supabase_client import get_supabase_admin_client
from app.services.email_service import get_email_service
from app.auth import get_current_user, get_optional_user, ClerkUser
from app.config import get_settings

router = APIRouter(prefix="/assessments", tags=["assessments"])


class AssessmentInviteRequest(BaseModel):
    candidate_ids: List[str]
    job_id: str
    deadline_hours: Optional[int] = 72  # Default 72 hours to complete


class AssessmentInviteResponse(BaseModel):
    success: bool
    invites_sent: int
    failed: List[str]


class AssessmentSession(BaseModel):
    id: str
    candidate_id: str
    job_id: str
    token: str
    status: str  # pending, in_progress, completed, expired, terminated
    started_at: Optional[str]
    completed_at: Optional[str]
    deadline: str
    proctoring_data: dict
    mcq_score: Optional[float]
    coding_score: Optional[float]
    total_score: Optional[float]


class MCQQuestion(BaseModel):
    id: str
    question: str
    options: List[str]
    correct_index: int  # Only sent to backend, not to frontend
    difficulty: str  # easy, medium, hard
    topic: str
    points: int


class CodingChallenge(BaseModel):
    id: str
    title: str
    description: str
    starter_code: str
    test_cases: List[dict]
    difficulty: str
    time_limit_minutes: int
    points: int


class AssessmentStartResponse(BaseModel):
    session_id: str
    candidate_name: str
    job_title: str
    mcq_count: int
    coding_count: int
    total_time_minutes: int
    deadline: str


class MCQSubmission(BaseModel):
    question_id: str
    selected_index: int
    time_taken_seconds: int


class CodingSubmission(BaseModel):
    challenge_id: str
    code: str
    language: str
    time_taken_seconds: int


class ProctoringEvent(BaseModel):
    event_type: str  # tab_switch, fullscreen_exit, copy_paste, right_click, window_blur
    timestamp: str
    details: Optional[dict] = None


@router.post("/invite", response_model=AssessmentInviteResponse)
async def send_assessment_invites(
    request: AssessmentInviteRequest,
    user: ClerkUser = Depends(get_current_user),
):
    """Send assessment invitations to multiple candidates."""
    supabase = get_supabase_admin_client()
    settings = get_settings()
    email_service = get_email_service()
    
    # Verify job exists
    job_result = supabase.table("job_descriptions").select("id, title").eq("id", request.job_id).execute()
    if not job_result.data:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = job_result.data[0]
    
    # Get candidate details
    candidates_result = supabase.table("candidates").select(
        "id, email, full_name"
    ).in_("id", request.candidate_ids).execute()
    
    if not candidates_result.data:
        raise HTTPException(status_code=404, detail="No candidates found")
    
    invites_sent = 0
    failed = []
    deadline = datetime.utcnow() + timedelta(hours=request.deadline_hours)
    
    for candidate in candidates_result.data:
        try:
            # Generate unique assessment token
            token = secrets.token_urlsafe(32)
            
            # Create assessment session
            session_data = {
                "id": str(uuid.uuid4()),
                "candidate_id": candidate["id"],
                "job_id": request.job_id,
                "token": token,
                "status": "pending",
                "deadline": deadline.isoformat(),
                "proctoring_data": {
                    "tab_switches": 0,
                    "fullscreen_exits": 0,
                    "copy_paste_attempts": 0,
                    "warnings": [],
                    "terminated": False,
                },
                "created_at": datetime.utcnow().isoformat(),
            }
            
            supabase.table("assessment_sessions").insert(session_data).execute()
            
            # Generate assessment link
            frontend_url = settings.cors_origins[0] if settings.cors_origins else "http://localhost:5173"
            assessment_link = f"{frontend_url}/assessment/{token}"
            
            # Send email
            await email_service.send_assessment_invite(
                to=candidate["email"],
                candidate_name=candidate["full_name"],
                job_title=job["title"],
                assessment_link=assessment_link,
                deadline=deadline.strftime("%B %d, %Y at %I:%M %p UTC"),
            )
            
            invites_sent += 1
            
        except Exception as e:
            print(f"Failed to send invite to {candidate['email']}: {e}")
            failed.append(candidate["id"])
    
    return AssessmentInviteResponse(
        success=invites_sent > 0,
        invites_sent=invites_sent,
        failed=failed,
    )


@router.get("/start/{token}", response_model=AssessmentStartResponse)
async def start_assessment(token: str):
    """Start an assessment session using the unique token."""
    supabase = get_supabase_admin_client()
    
    # Find session by token
    result = supabase.table("assessment_sessions").select(
        "*, candidates(full_name, email), job_descriptions(title, role, level)"
    ).eq("token", token).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Assessment not found or link expired")
    
    session = result.data[0]
    
    # Check if already completed or terminated
    if session["status"] in ["completed", "terminated"]:
        raise HTTPException(status_code=400, detail="Assessment already completed or terminated")
    
    # Check deadline
    deadline = datetime.fromisoformat(session["deadline"].replace("Z", "+00:00"))
    if datetime.utcnow().replace(tzinfo=deadline.tzinfo) > deadline:
        supabase.table("assessment_sessions").update({"status": "expired"}).eq("id", session["id"]).execute()
        raise HTTPException(status_code=400, detail="Assessment deadline has passed")
    
    # Update status to in_progress if pending
    if session["status"] == "pending":
        supabase.table("assessment_sessions").update({
            "status": "in_progress",
            "started_at": datetime.utcnow().isoformat(),
        }).eq("id", session["id"]).execute()
    
    return AssessmentStartResponse(
        session_id=session["id"],
        candidate_name=session["candidates"]["full_name"],
        job_title=session["job_descriptions"]["title"],
        mcq_count=20,  # Will be dynamic based on job role
        coding_count=2,
        total_time_minutes=90,
        deadline=session["deadline"],
    )


@router.get("/{session_id}/mcq")
async def get_mcq_questions(session_id: str):
    """Get MCQ questions for an assessment session."""
    supabase = get_supabase_admin_client()
    
    # Verify session
    session = supabase.table("assessment_sessions").select(
        "id, status, job_descriptions(role, level)"
    ).eq("id", session_id).execute()
    
    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.data[0]["status"] not in ["in_progress"]:
        raise HTTPException(status_code=400, detail="Assessment not in progress")
    
    # Get or generate MCQ questions based on role
    role = session.data[0]["job_descriptions"]["role"]
    level = session.data[0]["job_descriptions"]["level"]
    
    # For now, return sample questions - will be replaced with AI-generated questions
    questions = generate_sample_mcq(role, level)
    
    # Return questions without correct answers
    return [{
        "id": q["id"],
        "question": q["question"],
        "options": q["options"],
        "difficulty": q["difficulty"],
        "topic": q["topic"],
        "points": q["points"],
    } for q in questions]


@router.get("/{session_id}/coding")
async def get_coding_challenges(session_id: str):
    """Get coding challenges for an assessment session."""
    supabase = get_supabase_admin_client()
    
    # Verify session
    session = supabase.table("assessment_sessions").select(
        "id, status, job_descriptions(role, level)"
    ).eq("id", session_id).execute()
    
    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.data[0]["status"] not in ["in_progress"]:
        raise HTTPException(status_code=400, detail="Assessment not in progress")
    
    role = session.data[0]["job_descriptions"]["role"]
    level = session.data[0]["job_descriptions"]["level"]
    
    # Return sample coding challenges
    challenges = generate_sample_coding_challenges(role, level)
    
    return challenges


@router.post("/{session_id}/mcq/submit")
async def submit_mcq_answers(
    session_id: str,
    submissions: List[MCQSubmission],
):
    """Submit MCQ answers for evaluation."""
    supabase = get_supabase_admin_client()
    
    # Verify session
    session = supabase.table("assessment_sessions").select("*").eq("id", session_id).execute()
    if not session.data or session.data[0]["status"] != "in_progress":
        raise HTTPException(status_code=400, detail="Invalid session")
    
    # Calculate score (simplified - will use stored correct answers)
    # For now, assume 50% correct as placeholder
    total_points = len(submissions) * 5
    score = total_points * 0.5  # Placeholder
    
    # Store submissions
    supabase.table("assessment_sessions").update({
        "mcq_submissions": [s.model_dump() for s in submissions],
        "mcq_score": score,
    }).eq("id", session_id).execute()
    
    return {"success": True, "score": score, "total": total_points}


@router.post("/{session_id}/coding/submit")
async def submit_coding_solution(
    session_id: str,
    submission: CodingSubmission,
):
    """Submit a coding solution for evaluation."""
    supabase = get_supabase_admin_client()
    
    # Verify session
    session = supabase.table("assessment_sessions").select("*").eq("id", session_id).execute()
    if not session.data or session.data[0]["status"] != "in_progress":
        raise HTTPException(status_code=400, detail="Invalid session")
    
    # TODO: Run code against test cases using a sandboxed executor
    # For now, return placeholder evaluation
    
    existing_submissions = session.data[0].get("coding_submissions", []) or []
    existing_submissions.append(submission.model_dump())
    
    supabase.table("assessment_sessions").update({
        "coding_submissions": existing_submissions,
    }).eq("id", session_id).execute()
    
    return {"success": True, "message": "Solution submitted for evaluation"}


@router.post("/{session_id}/proctoring")
async def report_proctoring_event(
    session_id: str,
    event: ProctoringEvent,
):
    """Report a proctoring violation event."""
    supabase = get_supabase_admin_client()
    
    # Get current session
    session = supabase.table("assessment_sessions").select("*").eq("id", session_id).execute()
    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")
    
    proctoring_data = session.data[0].get("proctoring_data", {})
    
    # Update counters based on event type
    if event.event_type == "tab_switch":
        proctoring_data["tab_switches"] = proctoring_data.get("tab_switches", 0) + 1
    elif event.event_type == "fullscreen_exit":
        proctoring_data["fullscreen_exits"] = proctoring_data.get("fullscreen_exits", 0) + 1
    elif event.event_type == "copy_paste":
        proctoring_data["copy_paste_attempts"] = proctoring_data.get("copy_paste_attempts", 0) + 1
    
    # Add to warnings log
    warnings = proctoring_data.get("warnings", [])
    warnings.append({
        "type": event.event_type,
        "timestamp": event.timestamp,
        "details": event.details,
    })
    proctoring_data["warnings"] = warnings
    
    # Check for termination threshold
    total_violations = (
        proctoring_data.get("tab_switches", 0) +
        proctoring_data.get("fullscreen_exits", 0)
    )
    
    should_terminate = total_violations >= 3
    
    if should_terminate:
        proctoring_data["terminated"] = True
        supabase.table("assessment_sessions").update({
            "proctoring_data": proctoring_data,
            "status": "terminated",
            "completed_at": datetime.utcnow().isoformat(),
        }).eq("id", session_id).execute()
        
        return {"warning": False, "terminated": True, "message": "Assessment terminated due to multiple violations"}
    
    supabase.table("assessment_sessions").update({
        "proctoring_data": proctoring_data,
    }).eq("id", session_id).execute()
    
    return {
        "warning": True,
        "terminated": False,
        "violations_remaining": 3 - total_violations,
        "message": f"Warning: {3 - total_violations} violations remaining before termination",
    }


@router.post("/{session_id}/complete")
async def complete_assessment(session_id: str):
    """Mark assessment as completed and calculate final score."""
    supabase = get_supabase_admin_client()
    
    session = supabase.table("assessment_sessions").select("*").eq("id", session_id).execute()
    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session_data = session.data[0]
    
    if session_data["status"] not in ["in_progress"]:
        raise HTTPException(status_code=400, detail="Assessment not in progress")
    
    # Calculate total score
    mcq_score = session_data.get("mcq_score", 0) or 0
    coding_score = session_data.get("coding_score", 0) or 0
    total_score = (mcq_score + coding_score) / 2  # Simple average for now
    
    supabase.table("assessment_sessions").update({
        "status": "completed",
        "completed_at": datetime.utcnow().isoformat(),
        "total_score": total_score,
    }).eq("id", session_id).execute()
    
    return {
        "success": True,
        "mcq_score": mcq_score,
        "coding_score": coding_score,
        "total_score": total_score,
    }


@router.get("/results/{job_id}")
async def get_assessment_results(
    job_id: str,
    user: ClerkUser = Depends(get_current_user),
):
    """Get all assessment results for a job (hiring manager view)."""
    supabase = get_supabase_admin_client()
    
    results = supabase.table("assessment_sessions").select(
        "*, candidates(id, full_name, email)"
    ).eq("job_id", job_id).order("total_score", desc=True).execute()
    
    return results.data or []


def generate_sample_mcq(role: str, level: str) -> List[dict]:
    """Generate sample MCQ questions based on role."""
    # This will be replaced with AI-generated questions
    base_questions = [
        {
            "id": str(uuid.uuid4()),
            "question": "What is the primary purpose of version control systems like Git?",
            "options": [
                "To compile code faster",
                "To track changes and collaborate on code",
                "To deploy applications",
                "To write documentation"
            ],
            "correct_index": 1,
            "difficulty": "easy",
            "topic": "Version Control",
            "points": 5,
        },
        {
            "id": str(uuid.uuid4()),
            "question": "Which data structure uses LIFO (Last In, First Out) principle?",
            "options": ["Queue", "Stack", "Array", "Linked List"],
            "correct_index": 1,
            "difficulty": "easy",
            "topic": "Data Structures",
            "points": 5,
        },
        {
            "id": str(uuid.uuid4()),
            "question": "What is the time complexity of binary search?",
            "options": ["O(n)", "O(log n)", "O(n²)", "O(1)"],
            "correct_index": 1,
            "difficulty": "medium",
            "topic": "Algorithms",
            "points": 10,
        },
    ]
    return base_questions


def generate_sample_coding_challenges(role: str, level: str) -> List[dict]:
    """Generate sample coding challenges based on role."""
    return [
        {
            "id": str(uuid.uuid4()),
            "title": "Two Sum",
            "description": "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
            "starter_code": "def two_sum(nums, target):\n    # Your code here\n    pass",
            "test_cases": [
                {"input": {"nums": [2, 7, 11, 15], "target": 9}, "expected": [0, 1]},
                {"input": {"nums": [3, 2, 4], "target": 6}, "expected": [1, 2]},
            ],
            "difficulty": "easy",
            "time_limit_minutes": 15,
            "points": 25,
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Valid Parentheses",
            "description": "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.",
            "starter_code": "def is_valid(s):\n    # Your code here\n    pass",
            "test_cases": [
                {"input": {"s": "()"}, "expected": True},
                {"input": {"s": "()[]{}"}, "expected": True},
                {"input": {"s": "(]"}, "expected": False},
            ],
            "difficulty": "medium",
            "time_limit_minutes": 20,
            "points": 35,
        },
    ]
