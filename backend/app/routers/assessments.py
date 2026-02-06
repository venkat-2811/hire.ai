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
import traceback

from app.database.supabase_client import get_supabase_admin_client
from app.services.email_service import get_email_service
from app.services.question_generator import get_question_generator
from app.auth import get_current_user, get_optional_user, ClerkUser
from app.config import get_settings
from app.models.schemas import JobDescription

router = APIRouter(prefix="/assessments", tags=["assessments"])

# In-memory cache for storing generated questions (session_id -> questions)
# TODO: Replace with Redis or database storage for production
_mcq_cache: dict = {}
_coding_cache: dict = {}


class AssessmentInviteRequest(BaseModel):
    candidate_ids: List[str]
    job_id: str
    deadline_hours: Optional[int] = 72  # Default 72 hours to complete
    mcq_question_count: Optional[int] = 20
    coding_challenge_count: Optional[int] = 2
    total_time_minutes: Optional[int] = 90


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
    failure_reasons: List[str] = []
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
                "mcq_question_count": request.mcq_question_count or 20,
                "coding_challenge_count": request.coding_challenge_count or 2,
                "total_time_minutes": request.total_time_minutes or 90,
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
            assessment_link = f"{settings.frontend_url}/assessment/{token}"
            
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
            traceback.print_exc()
            try:
                # Best-effort cleanup so we don't keep unusable links/sessions
                if 'session_data' in locals() and session_data.get('id'):
                    supabase.table("assessment_sessions").delete().eq("id", session_data["id"]).execute()
            except Exception as cleanup_err:
                print(f"Failed to cleanup assessment session for {candidate['email']}: {cleanup_err}")
            failed.append(candidate["id"])
            failure_reasons.append(str(e))

    if invites_sent == 0 and failed:
        first_error = failure_reasons[0] if failure_reasons else "Unknown error"
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send assessment invites. First error: {first_error}",
        )

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
    
    mcq_count = session.get("mcq_question_count") or 20
    coding_count = session.get("coding_challenge_count") or 2
    total_time_minutes = session.get("total_time_minutes") or 90

    return AssessmentStartResponse(
        session_id=session["id"],
        candidate_name=session["candidates"]["full_name"],
        job_title=session["job_descriptions"]["title"],
        mcq_count=mcq_count,
        coding_count=coding_count,
        total_time_minutes=total_time_minutes,
        deadline=session["deadline"],
    )


@router.get("/{session_id}/mcq")
async def get_mcq_questions(session_id: str):
    """Get MCQ questions for an assessment session."""
    supabase = get_supabase_admin_client()
    
    # Verify session
    session = supabase.table("assessment_sessions").select(
        "id, status, job_id, job_descriptions(role, level)"
    ).eq("id", session_id).execute()
    
    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.data[0]["status"] not in ["in_progress"]:
        raise HTTPException(status_code=400, detail="Assessment not in progress")
    
    # If already generated for this session, return stored questions
    session_row = supabase.table("assessment_sessions").select(
        "id, mcq_questions, mcq_question_count"
    ).eq("id", session_id).single().execute()

    stored_questions = (session_row.data or {}).get("mcq_questions") or []
    if stored_questions:
        return [
            {
                "id": q.get("id"),
                "question": q.get("question"),
                "options": q.get("options", []),
                "difficulty": q.get("difficulty"),
                "topic": q.get("topic"),
                "points": q.get("points", 5),
            }
            for q in stored_questions
        ]

    # Otherwise, generate and persist
    job_result = supabase.table("job_descriptions").select("*").eq(
        "id", session.data[0]["job_id"]
    ).single().execute()

    if not job_result.data:
        raise HTTPException(status_code=404, detail="Job not found")

    job_data = job_result.data
    job = JobDescription(
        id=job_data["id"],
        title=job_data["title"],
        role=job_data["role"],
        level=job_data["level"],
        description=job_data["description"],
        must_have_skills=job_data.get("must_have_skills", []),
        good_to_have_skills=job_data.get("good_to_have_skills", []),
        min_experience_years=job_data.get("min_experience_years", 0),
        is_active=job_data.get("is_active", True),
    )

    mcq_count = (session_row.data or {}).get("mcq_question_count") or 20
    question_generator = get_question_generator()
    questions = await question_generator.generate_mcq_questions(job, count=mcq_count)

    supabase.table("assessment_sessions").update({
        "mcq_questions": questions,
        "updated_at": datetime.utcnow().isoformat(),
    }).eq("id", session_id).execute()
    
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
        "id, status, job_id, job_descriptions(role, level)"
    ).eq("id", session_id).execute()
    
    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.data[0]["status"] not in ["in_progress"]:
        raise HTTPException(status_code=400, detail="Assessment not in progress")
    
    # If already generated for this session, return stored challenges
    session_row = supabase.table("assessment_sessions").select(
        "id, coding_challenges, coding_challenge_count"
    ).eq("id", session_id).single().execute()

    stored_challenges = (session_row.data or {}).get("coding_challenges") or []
    if stored_challenges:
        return stored_challenges

    # Otherwise, generate and persist
    job_result = supabase.table("job_descriptions").select("*").eq(
        "id", session.data[0]["job_id"]
    ).single().execute()

    if not job_result.data:
        raise HTTPException(status_code=404, detail="Job not found")

    job_data = job_result.data
    job = JobDescription(
        id=job_data["id"],
        title=job_data["title"],
        role=job_data["role"],
        level=job_data["level"],
        description=job_data["description"],
        must_have_skills=job_data.get("must_have_skills", []),
        good_to_have_skills=job_data.get("good_to_have_skills", []),
        min_experience_years=job_data.get("min_experience_years", 0),
        is_active=job_data.get("is_active", True),
    )

    coding_count = (session_row.data or {}).get("coding_challenge_count") or 2
    question_generator = get_question_generator()
    challenges = await question_generator.generate_coding_challenges(job, count=coding_count)

    supabase.table("assessment_sessions").update({
        "coding_challenges": challenges,
        "updated_at": datetime.utcnow().isoformat(),
    }).eq("id", session_id).execute()

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
    
    session_data = session.data[0]
    
    # Retrieve stored questions from DB
    stored_questions = session_data.get("mcq_questions") or []
    
    if not stored_questions:
        raise HTTPException(status_code=400, detail="Questions not found for this session.")
    
    # Calculate actual score by comparing answers
    correct_count = 0
    total_points = 0
    
    # Create a map of question_id -> correct_index
    question_map = {q["id"]: q for q in stored_questions}
    
    for submission in submissions:
        question = question_map.get(submission.question_id)
        if question:
            total_points += question.get("points", 5)
            if submission.selected_index == question.get("correct_index"):
                correct_count += question.get("points", 5)
    
    score = correct_count if total_points > 0 else 0
    percentage = (score / total_points * 100) if total_points > 0 else 0
    
    # Store submissions
    supabase.table("assessment_sessions").update({
        "mcq_submissions": [s.model_dump() for s in submissions],
        "mcq_score": percentage,
    }).eq("id", session_id).execute()
    
    return {"success": True, "score": percentage, "total": total_points, "correct_points": score}


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
    mcq_score = session_data.get("mcq_score")
    coding_score = session_data.get("coding_score")

    mcq_score_value = float(mcq_score) if mcq_score is not None else 0.0
    coding_score_value = float(coding_score) if coding_score is not None else 0.0

    # If coding_score isn't implemented yet (None), don't penalize candidates by averaging with 0.
    if coding_score is None:
        total_score = mcq_score_value
    elif mcq_score is None:
        total_score = coding_score_value
    else:
        total_score = (mcq_score_value + coding_score_value) / 2
    
    supabase.table("assessment_sessions").update({
        "status": "completed",
        "completed_at": datetime.utcnow().isoformat(),
        "mcq_score": mcq_score_value,
        "coding_score": coding_score_value if coding_score is not None else None,
        "total_score": total_score,
    }).eq("id", session_id).execute()
    
    return {
        "success": True,
        "mcq_score": mcq_score_value,
        "coding_score": coding_score_value if coding_score is not None else None,
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
