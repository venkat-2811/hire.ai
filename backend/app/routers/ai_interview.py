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
from app.services.gemini_client import get_gemini_service
from app.services.assemblyai_service import get_assemblyai_service
from app.auth import get_current_user, get_optional_user, ClerkUser
from app.config import get_settings

router = APIRouter(prefix="/ai-interview", tags=["ai-interview"])


@router.get("/health/assemblyai")
async def assemblyai_health():
    """Health check for AssemblyAI configuration."""
    try:
        svc = get_assemblyai_service()
        configured = bool(getattr(svc, "api_key", ""))
    except Exception:
        configured = False
    return {"configured": configured}


class InterviewInviteRequest(BaseModel):
    candidate_ids: List[str]
    job_id: str
    scheduled_time: Optional[str] = None


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
    
    # Verify job exists
    job_result = supabase.table("job_descriptions").select("id, title, role, level").eq("id", request.job_id).execute()
    if not job_result.data:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = job_result.data[0]
    
    # Get candidate details
    candidates_result = supabase.table("candidates").select(
        "id, email, full_name, resume_parsed_data"
    ).in_("id", request.candidate_ids).execute()
    
    if not candidates_result.data:
        raise HTTPException(status_code=404, detail="No candidates found")
    
    invites_sent = 0
    failed = []
    gemini = get_gemini_service()
    
    for candidate in candidates_result.data:
        try:
            # Generate unique interview token
            token = secrets.token_urlsafe(32)
            
            # Generate interview questions using AI
            questions = await generate_interview_questions(
                gemini, job, candidate.get("resume_parsed_data")
            )
            
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
    gemini = get_gemini_service()
    
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
    evaluation = await evaluate_speech_response(gemini, question, response.transcript)
    
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
    gemini = get_gemini_service()
    
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
        gemini,
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


async def generate_interview_questions(gemini, job: dict, resume_data: Optional[dict]) -> List[dict]:
    """Generate personalized interview questions using AI."""
    role = job.get("role", "developer")
    level = job.get("level", "mid")
    title = job.get("title", "Software Developer")
    
    prompt = f"""Generate 8 interview questions for a {level} {title} position.
    
Include a mix of:
- 3 Technical questions specific to {role}
- 2 Behavioral questions (STAR format expected)
- 2 Situational/problem-solving questions
- 1 Question about career goals and motivation

{"Consider the candidate's background: " + str(resume_data)[:500] if resume_data else ""}

Return as JSON array with format:
[{{"text": "question text", "type": "technical|behavioral|situational", "duration": 120, "key_points": ["point1", "point2"]}}]
"""
    
    try:
        result = await gemini.generate_json(prompt)
        if isinstance(result, list):
            return result
        return result.get("questions", [])
    except Exception as e:
        print(f"Failed to generate questions: {e}")
        # Fallback questions
        return [
            {"text": "Tell me about yourself and your experience.", "type": "behavioral", "duration": 120},
            {"text": "What interests you about this role?", "type": "behavioral", "duration": 90},
            {"text": "Describe a challenging project you worked on.", "type": "situational", "duration": 150},
            {"text": "How do you approach problem-solving?", "type": "situational", "duration": 120},
            {"text": "What are your technical strengths?", "type": "technical", "duration": 120},
            {"text": "Where do you see yourself in 5 years?", "type": "behavioral", "duration": 90},
        ]


async def evaluate_speech_response(gemini, question: dict, transcript: str) -> dict:
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
        result = await gemini.generate_json(prompt)
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
    gemini,
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
        ai_feedback = await gemini.generate_json(prompt)
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
