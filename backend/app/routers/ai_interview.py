"""
AI Interview endpoints for speech-based interviews with camera proctoring.
The AI asks questions via text-to-speech and evaluates verbal responses.
"""
from fastapi import APIRouter, HTTPException, Depends, File, UploadFile, Form
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
import uuid
import secrets

from app.database.supabase_client import get_supabase_admin_client
from app.services.email_service import get_email_service
from app.services.openai_client import get_openai_service
from app.services.assemblyai_service import get_assemblyai_service
from app.auth import get_current_user, get_optional_user, ClerkUser
from app.config import get_settings

router = APIRouter(prefix="/ai-interview", tags=["ai-interview"])


@router.get("/health/assemblyai")
async def assemblyai_health():
    """Health check for AssemblyAI configuration."""
    try:
        svc = get_assemblyai_service()
        # Try to get the API key to verify it's configured
        api_key = svc._get_api_key()
        configured = bool(api_key)
    except Exception:
        configured = False
    return {"configured": configured}


class InterviewInviteRequest(BaseModel):
    candidate_ids: List[str]
    job_id: str
    scheduled_time: Optional[str] = None
    question_count: Optional[int] = 8
    difficulty: Optional[str] = 'medium'


class InterviewInviteResponse(BaseModel):
    success: bool
    invites_sent: int
    failed: List[str]


class AIInterviewSession(BaseModel):
    id: str
    candidate_id: str
    job_id: str
    token: str
    status: str
    current_question_index: int
    questions: List[dict]
    responses: List[dict]
    proctoring_data: dict
    started_at: Optional[str]
    completed_at: Optional[str]


class StartInterviewResponse(BaseModel):
    session_id: str
    candidate_name: str
    job_title: str
    total_questions: int
    estimated_duration_minutes: int


class InterviewQuestion(BaseModel):
    index: int
    question_text: str
    question_type: str  # technical, behavioral, situational
    expected_duration_seconds: int


class SpeechResponse(BaseModel):
    question_index: int
    transcript: str
    audio_duration_seconds: float
    confidence: float


class CameraProctoringEvent(BaseModel):
    event_type: str  # face_not_detected, multiple_faces, looking_away, audio_anomaly
    timestamp: str
    details: Optional[dict] = None


class InterviewEvaluationResult(BaseModel):
    overall_score: float
    technical_score: float
    communication_score: float
    confidence_score: float
    recommendation: str
    strengths: List[str]
    areas_for_improvement: List[str]
    detailed_feedback: str


@router.post("/invite", response_model=InterviewInviteResponse)
async def send_interview_invites(
    request: InterviewInviteRequest,
    user: ClerkUser = Depends(get_current_user),
):
    """Send AI interview invitations to candidates who passed assessment."""
    supabase = get_supabase_admin_client()
    settings = get_settings()
    email_service = get_email_service()
    
    # Debug: Print received parameters
    print(f"Received interview invite request:")
    print(f"  - Job ID: {request.job_id}")
    print(f"  - Candidate IDs: {request.candidate_ids}")
    print(f"  - Question Count: {request.question_count}")
    print(f"  - Difficulty: {request.difficulty}")
    print(f"  - Scheduled Time: {request.scheduled_time}")
    
    # Verify job exists
    job_result = supabase.table("job_descriptions").select("id, title, role, level").eq("id", request.job_id).execute()
    if not job_result.data:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = job_result.data[0]
    print(f"Job details: {job}")
    
    # Get candidate details
    candidates_result = supabase.table("candidates").select(
        "id, email, full_name, resume_parsed_data"
    ).in_("id", request.candidate_ids).execute()
    
    if not candidates_result.data:
        raise HTTPException(status_code=404, detail="No candidates found")
    
    invites_sent = 0
    failed = []
    openai = get_openai_service()
    
    for candidate in candidates_result.data:
        try:
            print(f"Processing candidate: {candidate['full_name']} ({candidate['id']})")
            
            # Generate unique interview token
            token = secrets.token_urlsafe(32)
            
            # Generate interview questions using AI
            questions = await generate_interview_questions(
                openai, job, candidate.get("resume_parsed_data"), request.question_count, request.difficulty
            )
            
            print(f"Generated {len(questions)} questions for candidate {candidate['id']}")
            
            # Create AI interview session
            session_data = {
                "id": str(uuid.uuid4()),
                "candidate_id": candidate["id"],
                "job_id": request.job_id,
                "token": token,
                "status": "pending",
                "current_question_index": 0,
                "questions": questions,
                "responses": [],
                "proctoring_data": {
                    "face_detection_failures": 0,
                    "looking_away_count": 0,
                    "audio_anomalies": 0,
                    "warnings": [],
                    "camera_enabled": False,
                    "microphone_enabled": False,
                },
                "created_at": datetime.utcnow().isoformat(),
            }
            
            supabase.table("ai_interview_sessions").insert(session_data).execute()
            
            # Generate interview link
            interview_link = f"{settings.frontend_url}/ai-interview/{token}"
            
            # Send email
            await email_service.send_interview_invite(
                to=candidate["email"],
                candidate_name=candidate["full_name"],
                job_title=job["title"],
                interview_link=interview_link,
                scheduled_time=request.scheduled_time,
            )
            
            invites_sent += 1
            
        except Exception as e:
            print(f"Failed to send interview invite to {candidate['email']}: {e}")
            failed.append(candidate["id"])
    
    return InterviewInviteResponse(
        success=invites_sent > 0,
        invites_sent=invites_sent,
        failed=failed,
    )


@router.get("/start/{token}", response_model=StartInterviewResponse)
async def start_ai_interview(token: str):
    """Start an AI interview session."""
    supabase = get_supabase_admin_client()
    
    # Find session by token
    result = supabase.table("ai_interview_sessions").select(
        "*, candidates(full_name, email), job_descriptions(title, role, level)"
    ).eq("token", token).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Interview not found or link expired")
    
    session = result.data[0]
    
    if session["status"] in ["completed", "terminated"]:
        raise HTTPException(status_code=400, detail="Interview already completed or terminated")
    
    # Update status to in_progress if pending
    if session["status"] == "pending":
        supabase.table("ai_interview_sessions").update({
            "status": "in_progress",
            "started_at": datetime.utcnow().isoformat(),
        }).eq("id", session["id"]).execute()
    
    return StartInterviewResponse(
        session_id=session["id"],
        candidate_name=session["candidates"]["full_name"],
        job_title=session["job_descriptions"]["title"],
        total_questions=len(session["questions"]),
        estimated_duration_minutes=len(session["questions"]) * 3,  # ~3 min per question
    )


@router.get("/{session_id}/question")
async def get_current_question(session_id: str):
    """Get the current question for the interview."""
    supabase = get_supabase_admin_client()
    
    session = supabase.table("ai_interview_sessions").select("*").eq("id", session_id).execute()
    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session_data = session.data[0]
    
    if session_data["status"] != "in_progress":
        raise HTTPException(status_code=400, detail="Interview not in progress")
    
    current_index = session_data["current_question_index"]
    questions = session_data["questions"]
    
    if current_index >= len(questions):
        return {"completed": True, "message": "All questions answered"}
    
    question = questions[current_index]
    
    return InterviewQuestion(
        index=current_index,
        question_text=question["text"],
        question_type=question["type"],
        expected_duration_seconds=question.get("duration", 120),
    )


@router.post("/{session_id}/transcribe")
async def transcribe_interview_audio(
    session_id: str,
    audio: UploadFile = File(...),
    language_code: str = Form("en_us"),
):
    """Transcribe an interview audio clip using AssemblyAI."""
    supabase = get_supabase_admin_client()
    assembly = get_assemblyai_service()

    session = supabase.table("ai_interview_sessions").select("id, status").eq("id", session_id).execute()
    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    session_data = session.data[0]
    if session_data.get("status") not in ["in_progress", "completed"]:
        raise HTTPException(status_code=400, detail="Interview not in progress")

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio upload")

    try:
        transcript = await assembly.transcribe(audio_bytes, language_code=language_code)
    except RuntimeError as e:
        # Most common: ASSEMBLYAI_API_KEY missing
        if "ASSEMBLYAI_API_KEY" in str(e):
            raise HTTPException(status_code=503, detail=str(e))
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    except TimeoutError:
        raise HTTPException(status_code=504, detail="Transcription timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

    return {"transcript": transcript}


@router.post("/{session_id}/response")
async def submit_speech_response(
    session_id: str,
    response: SpeechResponse,
):
    """Submit a speech response for evaluation."""
    supabase = get_supabase_admin_client()
    openai = get_openai_service()
    
    session = supabase.table("ai_interview_sessions").select("*").eq("id", session_id).execute()
    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session_data = session.data[0]
    
    if session_data["status"] != "in_progress":
        raise HTTPException(status_code=400, detail="Interview not in progress")
    
    # Get the question that was answered
    questions = session_data["questions"]
    if response.question_index >= len(questions):
        raise HTTPException(status_code=400, detail="Invalid question index")
    
    question = questions[response.question_index]
    
    # Evaluate response using AI
    evaluation = await evaluate_speech_response(openai, question, response.transcript)
    
    # Store response with evaluation
    responses = session_data.get("responses", []) or []
    responses.append({
        "question_index": response.question_index,
        "transcript": response.transcript,
        "audio_duration": response.audio_duration_seconds,
        "confidence": response.confidence,
        "evaluation": evaluation,
        "submitted_at": datetime.utcnow().isoformat(),
    })
    
    # Move to next question
    next_index = response.question_index + 1
    
    supabase.table("ai_interview_sessions").update({
        "responses": responses,
        "current_question_index": next_index,
    }).eq("id", session_id).execute()
    
    return {
        "success": True,
        "evaluation_preview": {
            "score": evaluation.get("score", 0),
            "feedback_hint": evaluation.get("brief_feedback", "Response recorded"),
        },
        "next_question_index": next_index if next_index < len(questions) else None,
        "is_last_question": next_index >= len(questions),
    }


@router.post("/{session_id}/proctoring")
async def report_camera_proctoring_event(
    session_id: str,
    event: CameraProctoringEvent,
):
    """Report a camera proctoring event."""
    supabase = get_supabase_admin_client()
    
    session = supabase.table("ai_interview_sessions").select("*").eq("id", session_id).execute()
    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")
    
    proctoring_data = session.data[0].get("proctoring_data", {})
    
    # Update counters
    if event.event_type == "face_not_detected":
        proctoring_data["face_detection_failures"] = proctoring_data.get("face_detection_failures", 0) + 1
    elif event.event_type == "multiple_faces":
        proctoring_data["multiple_faces_detected"] = proctoring_data.get("multiple_faces_detected", 0) + 1
    elif event.event_type == "looking_away":
        proctoring_data["looking_away_count"] = proctoring_data.get("looking_away_count", 0) + 1
    elif event.event_type == "audio_anomaly":
        proctoring_data["audio_anomalies"] = proctoring_data.get("audio_anomalies", 0) + 1
    elif event.event_type == "fullscreen_exit":
        proctoring_data["fullscreen_exits"] = proctoring_data.get("fullscreen_exits", 0) + 1
    elif event.event_type == "tab_switch":
        proctoring_data["tab_switches"] = proctoring_data.get("tab_switches", 0) + 1
    elif event.event_type == "window_blur":
        proctoring_data["window_blurs"] = proctoring_data.get("window_blurs", 0) + 1
    
    # Log warning
    warnings = proctoring_data.get("warnings", [])
    warnings.append({
        "type": event.event_type,
        "timestamp": event.timestamp,
        "details": event.details,
    })
    proctoring_data["warnings"] = warnings

    # Strict violations that terminate immediately
    if event.event_type in {"fullscreen_exit", "tab_switch"}:
        supabase.table("ai_interview_sessions").update({
            "proctoring_data": proctoring_data,
            "status": "terminated",
            "completed_at": datetime.utcnow().isoformat(),
        }).eq("id", session_id).execute()

        return {"warning": False, "terminated": True, "violations": 999, "threshold": 0}
    
    # Stricter thresholds for interviews
    threshold = 2
    total_violations = (
        proctoring_data.get("face_detection_failures", 0) +
        proctoring_data.get("looking_away_count", 0) +
        proctoring_data.get("multiple_faces_detected", 0) +
        proctoring_data.get("audio_anomalies", 0) +
        proctoring_data.get("fullscreen_exits", 0) +
        proctoring_data.get("tab_switches", 0) +
        proctoring_data.get("window_blurs", 0)
    )
    
    should_warn = total_violations >= 1
    should_terminate = total_violations >= threshold
    
    if should_terminate:
        supabase.table("ai_interview_sessions").update({
            "proctoring_data": proctoring_data,
            "status": "terminated",
            "completed_at": datetime.utcnow().isoformat(),
        }).eq("id", session_id).execute()
        
        return {"warning": False, "terminated": True, "violations": total_violations, "threshold": threshold}
    
    supabase.table("ai_interview_sessions").update({
        "proctoring_data": proctoring_data,
    }).eq("id", session_id).execute()
    
    return {
        "warning": should_warn,
        "terminated": False,
        "violations": total_violations,
        "threshold": threshold,
    }


@router.post("/{session_id}/complete")
async def complete_ai_interview(session_id: str):
    """Complete the AI interview and generate final evaluation."""
    supabase = get_supabase_admin_client()
    openai = get_openai_service()
    
    session = supabase.table("ai_interview_sessions").select(
        "*, job_descriptions(title, role, level)"
    ).eq("id", session_id).execute()
    
    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session_data = session.data[0]
    
    if session_data["status"] not in ["in_progress"]:
        raise HTTPException(status_code=400, detail="Interview not in progress")
    
    # Generate comprehensive evaluation
    evaluation = await generate_final_evaluation(
        openai,
        session_data["questions"],
        session_data["responses"],
        session_data["job_descriptions"],
        session_data["proctoring_data"],
    )
    
    supabase.table("ai_interview_sessions").update({
        "status": "completed",
        "completed_at": datetime.utcnow().isoformat(),
        "final_evaluation": evaluation,
    }).eq("id", session_id).execute()
    
    return InterviewEvaluationResult(**evaluation)


@router.get("/results/{job_id}")
async def get_interview_results(
    job_id: str,
    user: ClerkUser = Depends(get_current_user),
):
    """Get all AI interview results for a job (hiring manager view)."""
    supabase = get_supabase_admin_client()
    
    results = supabase.table("ai_interview_sessions").select(
        "*, candidates(id, full_name, email)"
    ).eq("job_id", job_id).eq("status", "completed").order("completed_at", desc=True).execute()
    
    return results.data or []


async def generate_interview_questions(openai, job: dict, resume_data: Optional[dict], question_count: int = 8, difficulty: str = 'medium') -> List[dict]:
    """Generate personalized interview questions using AI."""
    role = job.get("role", "developer")
    level = job.get("level", "mid")
    title = job.get("title", "Software Developer")
    
    # Adjust question distribution based on count and difficulty
    total_questions = min(max(1, question_count), 30)  # Ensure between 1 and 30
    
    if difficulty == 'easy':
        technical_ratio = 0.25  # 25% technical
        behavioral_ratio = 0.35  # 35% behavioral
        situational_ratio = 0.30  # 30% situational
        motivational_ratio = 0.10  # 10% motivational
    elif difficulty == 'hard':
        technical_ratio = 0.50  # 50% technical
        behavioral_ratio = 0.20  # 20% behavioral
        situational_ratio = 0.25  # 25% situational
        motivational_ratio = 0.05  # 5% motivational
    else:  # medium
        technical_ratio = 0.375  # 37.5% technical
        behavioral_ratio = 0.25  # 25% behavioral
        situational_ratio = 0.25  # 25% situational
        motivational_ratio = 0.125  # 12.5% motivational
    
    technical_count = max(1, int(total_questions * technical_ratio))
    behavioral_count = max(1, int(total_questions * behavioral_ratio))
    situational_count = max(1, int(total_questions * situational_ratio))
    motivational_count = max(1, int(total_questions * motivational_ratio))
    
    # Adjust for rounding errors
    current_total = technical_count + behavioral_count + situational_count + motivational_count
    if current_total < total_questions:
        # Add remaining questions to technical for hard difficulty, behavioral for easy, situational for medium
        remaining = total_questions - current_total
        if difficulty == 'hard':
            technical_count += remaining
        elif difficulty == 'easy':
            behavioral_count += remaining
        else:
            situational_count += remaining
    elif current_total > total_questions:
        # Remove excess questions from motivational first, then situational, then behavioral
        excess = current_total - total_questions
        removal_order = ['motivational', 'situational', 'behavioral', 'technical']
        counts = {'motivational': motivational_count, 'situational': situational_count, 
                 'behavioral': behavioral_count, 'technical': technical_count}
        
        for q_type in removal_order:
            if excess <= 0:
                break
            if counts[q_type] > 1:  # Keep at least 1 of each type if possible
                can_remove = min(counts[q_type] - 1, excess)
                counts[q_type] -= can_remove
                excess -= can_remove
        
        motivational_count = counts['motivational']
        situational_count = counts['situational']
        behavioral_count = counts['behavioral']
        technical_count = counts['technical']
    
    # Ensure we have exactly the right number of questions
    final_total = technical_count + behavioral_count + situational_count + motivational_count
    if final_total != total_questions:
        # Final adjustment - add or remove from the most appropriate type
        diff = total_questions - final_total
        if diff > 0:
            # Need to add questions
            if difficulty == 'hard':
                technical_count += diff
            elif difficulty == 'easy':
                behavioral_count += diff
            else:
                situational_count += diff
        else:
            # Need to remove questions
            diff = abs(diff)
            if difficulty == 'hard' and technical_count > diff:
                technical_count -= diff
            elif difficulty == 'easy' and behavioral_count > diff:
                behavioral_count -= diff
            elif situational_count > diff:
                situational_count -= diff
            elif behavioral_count > diff:
                behavioral_count -= diff
            else:
                technical_count = max(1, technical_count - diff)
    
    difficulty_descriptors = {
        'easy': 'fundamental concepts and basic understanding',
        'medium': 'intermediate concepts and practical experience',
        'hard': 'advanced concepts and complex problem-solving'
    }
    
    descriptor = difficulty_descriptors.get(difficulty, 'intermediate concepts and practical experience')
    
    prompt = f"""Generate {total_questions} interview questions for a {level} {title} position at {difficulty} difficulty level.
    
Include a mix of:
- {technical_count} Technical questions specific to {role} (focus on {descriptor})
- {behavioral_count} Behavioral questions (STAR format expected)
- {situational_count} Situational/problem-solving questions
- {motivational_count} Question about career goals and motivation

CRITICAL REQUIREMENT: This is an audio-based interview where candidates respond verbally. ALL questions MUST be purely conceptual and discussion-based. Do NOT ask for code, implementations, or syntax-heavy answers. Focus on assessing understanding, reasoning, approaches, trade-offs, and real-world thinking (e.g., 'How would you approach...', 'Explain how...', 'What are the trade-offs...').

Difficulty level {difficulty} means: {descriptor}

{"Consider the candidate's background: " + str(resume_data)[:500] if resume_data else ""}

Return as JSON array with format:
[{{"text": "question text", "type": "technical|behavioral|situational|motivational", "duration": 120, "key_points": ["point1", "point2"]}}]
"""
    
    try:
        print(f"Generating {total_questions} questions with difficulty: {difficulty}")
        print(f"Question distribution: Technical={technical_count}, Behavioral={behavioral_count}, Situational={situational_count}, Motivational={motivational_count}")
        
        result = await openai.generate_json(prompt)
        print(f"AI generation result: {result}")
        
        questions = []
        if isinstance(result, list):
            questions = result
        elif isinstance(result, dict) and "questions" in result:
            questions = result["questions"]
        
        print(f"Generated {len(questions)} questions from AI")
        
        # Validate we got the right number of questions
        if len(questions) != total_questions:
            print(f"Expected {total_questions} questions but got {len(questions)}. Adjusting...")
            
            # If we got fewer questions, pad with generic questions
            if len(questions) < total_questions:
                generic_questions = [
                    {"text": "Tell me about yourself and your experience.", "type": "behavioral", "duration": 120},
                    {"text": "What interests you about this role?", "type": "behavioral", "duration": 90},
                    {"text": "Describe a challenging project you worked on.", "type": "situational", "duration": 150},
                    {"text": "How do you approach problem-solving?", "type": "situational", "duration": 120},
                    {"text": "What are your technical strengths?", "type": "technical", "duration": 120},
                    {"text": "Where do you see yourself in 5 years?", "type": "behavioral", "duration": 90},
                    {"text": "What motivates you in your work?", "type": "motivational", "duration": 90},
                    {"text": "Describe your experience with teamwork.", "type": "behavioral", "duration": 120},
                    {"text": "How do you handle tight deadlines?", "type": "situational", "duration": 120},
                    {"text": "What technical skills are you currently developing?", "type": "technical", "duration": 120},
                ]
                
                # Add generic questions to reach the desired count
                while len(questions) < total_questions:
                    generic_q = generic_questions[len(questions) % len(generic_questions)].copy()
                    # Adjust type distribution based on difficulty
                    if difficulty == 'hard' and len(questions) < technical_count:
                        generic_q["type"] = "technical"
                    elif difficulty == 'easy' and len(questions) < behavioral_count:
                        generic_q["type"] = "behavioral"
                    questions.append(generic_q)
            
            # If we got too many questions, truncate
            elif len(questions) > total_questions:
                questions = questions[:total_questions]
        
        print(f"Final question count: {len(questions)}")
        return questions
        
    except Exception as e:
        print(f"Failed to generate questions: {e}")
        print(f"Using fallback to generate exactly {total_questions} questions")
        
        # Generate fallback questions that match the exact count and difficulty distribution
        fallback_questions = []
        
        # Expanded question pools for each type with difficulty-appropriate content
        technical_questions = [
            {"text": "What are your technical strengths?", "type": "technical", "duration": 120},
            {"text": "What technical skills are you currently developing?", "type": "technical", "duration": 120},
            {"text": "How do you stay updated with the latest technology trends?", "type": "technical", "duration": 120},
            {"text": "Describe your experience with version control systems.", "type": "technical", "duration": 120},
            {"text": "What programming languages are you most comfortable with?", "type": "technical", "duration": 120},
            {"text": "How do you approach debugging complex technical issues?", "type": "technical", "duration": 150},
            {"text": "What's your experience with testing and quality assurance?", "type": "technical", "duration": 120},
            {"text": "How do you ensure code quality and maintainability?", "type": "technical", "duration": 120},
        ]
        
        behavioral_questions = [
            {"text": "Tell me about yourself and your experience.", "type": "behavioral", "duration": 120},
            {"text": "What interests you about this role?", "type": "behavioral", "duration": 90},
            {"text": "Where do you see yourself in 5 years?", "type": "behavioral", "duration": 90},
            {"text": "What motivates you in your work?", "type": "motivational", "duration": 90},
            {"text": "Describe your experience with teamwork.", "type": "behavioral", "duration": 120},
            {"text": "How do you handle constructive feedback?", "type": "behavioral", "duration": 120},
            {"text": "Tell me about a time you had to learn something new quickly.", "type": "behavioral", "duration": 120},
            {"text": "How do you prioritize your work when dealing with multiple tasks?", "type": "behavioral", "duration": 120},
        ]
        
        situational_questions = [
            {"text": "Describe a challenging project you worked on.", "type": "situational", "duration": 150},
            {"text": "How do you approach problem-solving?", "type": "situational", "duration": 120},
            {"text": "How do you handle tight deadlines?", "type": "situational", "duration": 120},
            {"text": "Tell me about a time you had to deal with a difficult team member.", "type": "situational", "duration": 150},
            {"text": "How would you handle a situation where you disagree with your manager?", "type": "situational", "duration": 120},
            {"text": "Describe a time you had to make a decision with incomplete information.", "type": "situational", "duration": 150},
        ]
        
        motivational_questions = [
            {"text": "What motivates you in your work?", "type": "motivational", "duration": 90},
            {"text": "Why are you interested in this company/role?", "type": "motivational", "duration": 90},
            {"text": "What are your long-term career goals?", "type": "motivational", "duration": 90},
            {"text": "What kind of work environment do you thrive in?", "type": "motivational", "duration": 90},
        ]
        
        # Create questions according to the calculated distribution
        question_index = 0
        
        # Add technical questions
        for i in range(technical_count):
            q = technical_questions[i % len(technical_questions)].copy()
            # Adjust difficulty for technical questions
            if difficulty == 'hard':
                q["duration"] = 150
            elif difficulty == 'easy':
                q["duration"] = 90
            fallback_questions.append(q)
            question_index += 1
        
        # Add behavioral questions
        for i in range(behavioral_count):
            q = behavioral_questions[i % len(behavioral_questions)].copy()
            fallback_questions.append(q)
            question_index += 1
        
        # Add situational questions
        for i in range(situational_count):
            q = situational_questions[i % len(situational_questions)].copy()
            # Adjust difficulty for situational questions
            if difficulty == 'hard':
                q["duration"] = 180
            elif difficulty == 'easy':
                q["duration"] = 90
            fallback_questions.append(q)
            question_index += 1
        
        # Add motivational questions
        for i in range(motivational_count):
            q = motivational_questions[i % len(motivational_questions)].copy()
            fallback_questions.append(q)
            question_index += 1
        
        # Shuffle questions to mix them up, but keep the first few for consistency
        if len(fallback_questions) > 3:
            import random
            first_three = fallback_questions[:3]
            remaining = fallback_questions[3:]
            random.shuffle(remaining)
            fallback_questions = first_three + remaining
        
        return fallback_questions


async def evaluate_speech_response(openai, question: dict, transcript: str) -> dict:
    """Evaluate a single speech response using AI."""
    prompt = f"""Evaluate this interview response:

Question: {question.get('text', '')}
Question Type: {question.get('type', 'general')}
Candidate's Response: {transcript}

Evaluate on:
1. Relevance to the question (0-10)
2. Clarity and communication (0-10)
3. Technical accuracy (if applicable) (0-10)
4. Depth of answer (0-10)

Return JSON: {{"score": 0-100, "relevance": 0-10, "clarity": 0-10, "technical": 0-10, "depth": 0-10, "brief_feedback": "one sentence", "key_observations": ["obs1", "obs2"]}}
"""
    
    try:
        result = await openai.generate_json(prompt)
        return result
    except Exception:
        return {
            "score": 50,
            "relevance": 5,
            "clarity": 5,
            "technical": 5,
            "depth": 5,
            "brief_feedback": "Response recorded for review",
            "key_observations": [],
        }


async def generate_final_evaluation(
    openai,
    questions: List[dict],
    responses: List[dict],
    job: dict,
    proctoring_data: dict,
) -> dict:
    """Generate comprehensive final evaluation."""
    
    # Calculate average scores from individual evaluations
    total_score = 0
    technical_scores = []
    communication_scores = []
    
    for resp in responses:
        eval_data = resp.get("evaluation", {})
        total_score += eval_data.get("score", 50)
        if eval_data.get("technical"):
            technical_scores.append(eval_data["technical"])
        if eval_data.get("clarity"):
            communication_scores.append(eval_data["clarity"])
    
    avg_score = total_score / len(responses) if responses else 0
    avg_technical = sum(technical_scores) / len(technical_scores) if technical_scores else 5
    avg_communication = sum(communication_scores) / len(communication_scores) if communication_scores else 5
    
    # Adjust for proctoring issues
    proctoring_penalty = min(20, (
        proctoring_data.get("face_detection_failures", 0) * 2 +
        proctoring_data.get("looking_away_count", 0)
    ))
    
    final_score = max(0, avg_score - proctoring_penalty)
    
    # Determine recommendation
    if final_score >= 80:
        recommendation = "strong_hire"
    elif final_score >= 65:
        recommendation = "hire"
    elif final_score >= 50:
        recommendation = "borderline"
    else:
        recommendation = "no_hire"
    
    # Generate detailed feedback using AI
    prompt = f"""Based on this interview data, provide a professional evaluation summary:

Job: {job.get('title', 'Position')} ({job.get('level', 'mid')} level)
Overall Score: {final_score}/100
Technical Score: {avg_technical * 10}/100
Communication Score: {avg_communication * 10}/100
Proctoring Issues: {proctoring_data.get('warnings', [])}

Responses Summary:
{[{"q": q.get("text", "")[:50], "score": r.get("evaluation", {}).get("score", 0)} for q, r in zip(questions, responses)]}

Provide:
1. 3-4 key strengths
2. 2-3 areas for improvement
3. A 2-3 sentence detailed feedback summary

Return JSON: {{"strengths": ["str1", "str2"], "areas_for_improvement": ["area1", "area2"], "detailed_feedback": "summary"}}
"""
    
    try:
        ai_feedback = await openai.generate_json(prompt)
    except Exception:
        ai_feedback = {
            "strengths": ["Completed the interview", "Provided responses to all questions"],
            "areas_for_improvement": ["Could provide more detailed answers"],
            "detailed_feedback": "The candidate completed the interview process.",
        }
    
    return {
        "overall_score": round(final_score, 1),
        "technical_score": round(avg_technical * 10, 1),
        "communication_score": round(avg_communication * 10, 1),
        "confidence_score": round(100 - proctoring_penalty, 1),
        "recommendation": recommendation,
        "strengths": ai_feedback.get("strengths", []),
        "areas_for_improvement": ai_feedback.get("areas_for_improvement", []),
        "detailed_feedback": ai_feedback.get("detailed_feedback", ""),
    }
