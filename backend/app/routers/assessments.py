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
from app.services.code_executor import get_code_executor
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
    time_taken_seconds: Optional[int] = 0


class CodeRunRequest(BaseModel):
    challenge_id: str
    code: str
    language: str = "python"


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
            
            # Calculate dynamic time limit based on question counts if not explicitly set
            mcq_count_val = request.mcq_question_count or 20
            coding_count_val = request.coding_challenge_count or 2
            if request.total_time_minutes:
                calculated_time = request.total_time_minutes
            else:
                # ~1.5 min per MCQ + ~20 min per coding challenge
                calculated_time = int(mcq_count_val * 1.5 + coding_count_val * 20)
                # Minimum 15 minutes, maximum 180 minutes
                calculated_time = max(15, min(180, calculated_time))

            # Create assessment session
            session_data = {
                "id": str(uuid.uuid4()),
                "candidate_id": candidate["id"],
                "job_id": request.job_id,
                "token": token,
                "status": "pending",
                "deadline": deadline.isoformat(),
                "mcq_question_count": mcq_count_val,
                "coding_challenge_count": coding_count_val,
                "total_time_minutes": calculated_time,
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


@router.post("/{session_id}/coding/run")
async def run_code_against_tests(
    session_id: str,
    request: CodeRunRequest,
):
    """Run code against test cases and return results (without submitting)."""
    supabase = get_supabase_admin_client()
    executor = get_code_executor()
    
    # Verify session
    session = supabase.table("assessment_sessions").select("*").eq("id", session_id).execute()
    if not session.data or session.data[0]["status"] != "in_progress":
        raise HTTPException(status_code=400, detail="Invalid session")
    
    session_data = session.data[0]
    
    # Find the challenge
    challenges = session_data.get("coding_challenges", []) or []
    challenge = None
    for c in challenges:
        if c.get("id") == request.challenge_id:
            challenge = c
            break
    
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    test_cases = challenge.get("test_cases", [])
    if not test_cases:
        return {
            "success": False,
            "error": "No test cases available for this challenge",
            "results": [],
            "passed": 0,
            "total": 0,
            "score_percentage": 0,
        }
    
    # Execute code against test cases
    result = executor.execute_python(request.code, test_cases)
    
    # Normalize results to match frontend TestResult interface
    normalized_results = []
    for idx, tr in enumerate(result.test_results):
        # Determine status code
        if tr.passed:
            status = "AC"
        elif tr.error and "Time limit" in tr.error:
            status = "TLE"
        elif tr.error and "Runtime error" in tr.error:
            status = "RE"
        elif result.compilation_error:
            status = "CE"
        else:
            status = "WA"
        
        # Format input for display
        input_display = tr.input_data
        if isinstance(input_display, dict):
            input_display = ", ".join(f"{k}={v}" for k, v in input_display.items())
        
        normalized_results.append({
            "test_case_id": test_cases[idx].get("id", f"tc_{idx+1}") if idx < len(test_cases) else f"tc_{idx+1}",
            "passed": tr.passed,
            "input": str(input_display),
            "expected_output": str(tr.expected) if tr.expected is not None else "",
            "actual_output": str(tr.actual) if tr.actual is not None else None,
            "status": status,
            "time_used": None,
            "memory_used": None,
            "error": tr.error,
        })
    
    return {
        "success": result.success,
        "compilation_error": result.compilation_error,
        "runtime_error": result.runtime_error,
        "results": normalized_results,
        "passed": result.passed_count,
        "total": result.total_count,
        "score_percentage": result.score_percentage,
    }


@router.post("/{session_id}/coding/submit")
async def submit_coding_solution(
    session_id: str,
    submission: CodingSubmission,
):
    """Submit a coding solution for evaluation."""
    supabase = get_supabase_admin_client()
    executor = get_code_executor()
    
    # Verify session
    session = supabase.table("assessment_sessions").select("*").eq("id", session_id).execute()
    if not session.data or session.data[0]["status"] != "in_progress":
        raise HTTPException(status_code=400, detail="Invalid session")
    
    session_data = session.data[0]
    
    # Find the challenge
    challenges = session_data.get("coding_challenges", []) or []
    challenge = None
    for c in challenges:
        if c.get("id") == submission.challenge_id:
            challenge = c
            break
    
    # Run code against test cases
    score_percentage = 0
    test_results = []
    
    compilation_error = None
    if challenge:
        test_cases = challenge.get("test_cases", [])
        if test_cases:
            result = executor.execute_python(submission.code, test_cases)
            score_percentage = result.score_percentage
            compilation_error = result.compilation_error
            
            # Normalize results to match frontend TestResult interface
            for idx, tr in enumerate(result.test_results):
                if tr.passed:
                    status = "AC"
                elif tr.error and "Time limit" in tr.error:
                    status = "TLE"
                elif tr.error and "Runtime error" in tr.error:
                    status = "RE"
                elif result.compilation_error:
                    status = "CE"
                else:
                    status = "WA"
                
                input_display = tr.input_data
                if isinstance(input_display, dict):
                    input_display = ", ".join(f"{k}={v}" for k, v in input_display.items())
                
                test_results.append({
                    "test_case_id": test_cases[idx].get("id", f"tc_{idx+1}") if idx < len(test_cases) else f"tc_{idx+1}",
                    "passed": tr.passed,
                    "input": str(input_display),
                    "expected_output": str(tr.expected) if tr.expected is not None else "",
                    "actual_output": str(tr.actual) if tr.actual is not None else None,
                    "status": status,
                    "time_used": None,
                    "memory_used": None,
                    "error": tr.error,
                })
    
    # Store submission with results
    existing_submissions = session_data.get("coding_submissions", []) or []
    
    # Update or add submission for this challenge
    submission_data = {
        **submission.model_dump(),
        "score_percentage": score_percentage,
        "test_results": test_results,
        "submitted_at": datetime.utcnow().isoformat(),
    }
    
    # Replace existing submission for same challenge or add new
    updated = False
    for i, sub in enumerate(existing_submissions):
        if sub.get("challenge_id") == submission.challenge_id:
            existing_submissions[i] = submission_data
            updated = True
            break
    
    if not updated:
        existing_submissions.append(submission_data)
    
    # Calculate overall coding score
    total_score = 0
    for sub in existing_submissions:
        total_score += sub.get("score_percentage", 0)
    
    avg_coding_score = total_score / len(existing_submissions) if existing_submissions else 0
    
    supabase.table("assessment_sessions").update({
        "coding_submissions": existing_submissions,
        "coding_score": avg_coding_score,
    }).eq("id", session_id).execute()
    
    passed_count = len([r for r in test_results if r.get("passed")])
    total_count = len(test_results)
    
    return {
        "success": True,
        "compilation_error": compilation_error,
        "score_percentage": score_percentage,
        "passed_count": passed_count,
        "total_tests": total_count,
        "test_results": test_results,
        "message": "Solution submitted and evaluated",
    }


@router.post("/{session_id}/proctoring")
async def report_proctoring_event(
    session_id: str,
    event: ProctoringEvent,
):
    """Report a proctoring violation event with strict enforcement."""
    supabase = get_supabase_admin_client()
    
    # Get current session
    session = supabase.table("assessment_sessions").select("*").eq("id", session_id).execute()
    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session_data = session.data[0]
    proctoring_data = session_data.get("proctoring_data", {})
    
    # STRICT: Immediate termination events
    IMMEDIATE_TERMINATION_EVENTS = {"tab_switch", "fullscreen_exit", "window_blur"}
    
    # Update counters based on event type
    if event.event_type == "tab_switch":
        proctoring_data["tab_switches"] = proctoring_data.get("tab_switches", 0) + 1
    elif event.event_type == "fullscreen_exit":
        proctoring_data["fullscreen_exits"] = proctoring_data.get("fullscreen_exits", 0) + 1
    elif event.event_type == "copy_paste":
        proctoring_data["copy_paste_attempts"] = proctoring_data.get("copy_paste_attempts", 0) + 1
    elif event.event_type == "right_click":
        proctoring_data["right_click_attempts"] = proctoring_data.get("right_click_attempts", 0) + 1
    elif event.event_type == "window_blur":
        proctoring_data["window_blurs"] = proctoring_data.get("window_blurs", 0) + 1
    elif event.event_type == "face_not_detected":
        proctoring_data["face_detection_failures"] = proctoring_data.get("face_detection_failures", 0) + 1
    elif event.event_type == "devtools_open":
        proctoring_data["devtools_attempts"] = proctoring_data.get("devtools_attempts", 0) + 1
    
    # Add to warnings log with severity
    warnings = proctoring_data.get("warnings", [])
    severity = "critical" if event.event_type in IMMEDIATE_TERMINATION_EVENTS else "warning"
    warnings.append({
        "type": event.event_type,
        "timestamp": event.timestamp,
        "details": event.details,
        "severity": severity,
    })
    proctoring_data["warnings"] = warnings
    
    # STRICT PROCTORING RULES:
    # 1. Tab switch or fullscreen exit = immediate termination (first offense)
    # 2. Window blur = immediate termination (first offense)
    # 3. Face not detected 3 times = termination
    # 4. Copy/paste, right-click, devtools = warning, 3 total = termination
    
    should_terminate = False
    termination_reason = ""
    
    # Immediate termination for critical violations
    if event.event_type in IMMEDIATE_TERMINATION_EVENTS:
        should_terminate = True
        termination_reason = f"Assessment terminated: {event.event_type.replace('_', ' ')} detected. This is a strict proctoring violation."
    
    # Face detection failures (3 strikes)
    elif proctoring_data.get("face_detection_failures", 0) >= 3:
        should_terminate = True
        termination_reason = "Assessment terminated: Face not visible 3 times."
    
    # Accumulated minor violations (3 total)
    else:
        minor_violations = (
            proctoring_data.get("copy_paste_attempts", 0) +
            proctoring_data.get("right_click_attempts", 0) +
            proctoring_data.get("devtools_attempts", 0)
        )
        if minor_violations >= 3:
            should_terminate = True
            termination_reason = "Assessment terminated: Too many proctoring violations."
    
    if should_terminate:
        proctoring_data["terminated"] = True
        proctoring_data["termination_reason"] = termination_reason
        supabase.table("assessment_sessions").update({
            "proctoring_data": proctoring_data,
            "status": "terminated",
            "completed_at": datetime.utcnow().isoformat(),
        }).eq("id", session_id).execute()
        
        return {
            "warning": False,
            "terminated": True,
            "message": termination_reason,
            "violations_remaining": 0,
        }
    
    # Calculate remaining violations for minor offenses
    minor_violations = (
        proctoring_data.get("copy_paste_attempts", 0) +
        proctoring_data.get("right_click_attempts", 0) +
        proctoring_data.get("devtools_attempts", 0)
    )
    face_violations = proctoring_data.get("face_detection_failures", 0)
    
    supabase.table("assessment_sessions").update({
        "proctoring_data": proctoring_data,
    }).eq("id", session_id).execute()
    
    return {
        "warning": True,
        "terminated": False,
        "violations_remaining": min(3 - minor_violations, 3 - face_violations),
        "message": f"Warning: Proctoring violation recorded. Repeated violations will terminate your assessment.",
        "event_type": event.event_type,
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
