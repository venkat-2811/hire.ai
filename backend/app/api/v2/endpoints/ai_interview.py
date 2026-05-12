from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends
from pydantic import BaseModel, Field

from app.api.v2.deps import require_user
from app.auth.clerk import ClerkUser
from app.config import get_settings
from app.services.assemblyai_service import get_assemblyai_service
from app.services.db.supabase_service import get_db_admin_service
from app.services.email_service import get_email_service
from app.services.openai_client import get_openai_service
from app.utils.responses import api_error, ok

router = APIRouter(prefix="/ai-interview")

# Placeholder: will be implemented next (start/question/adapt-question/response/proctoring/complete/invite)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_iso_dt(value: Any) -> datetime:
    if value is None:
        raise ValueError("missing datetime")
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def _normalize_questions(raw: Any) -> List[Dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    out: List[Dict[str, Any]] = []
    for q in raw:
        if not isinstance(q, dict):
            continue
        text = q.get("text") or q.get("question_text") or q.get("question")
        qtype = q.get("type") or q.get("question_type") or "technical"
        duration = q.get("duration") or q.get("expected_duration_seconds") or 120
        try:
            duration_i = int(duration)
        except Exception:
            duration_i = 120
        if not isinstance(text, str) or not text.strip():
            continue
        out.append({"text": text.strip(), "type": str(qtype), "duration": duration_i})
    return out


def get_fallback_questions(question_count: int, role: str = "developer") -> List[dict]:
    """Generate fallback questions that respect the requested count and are purely verbal."""
    base_questions = [
        {"text": "Tell me about yourself and your experience.", "type": "behavioral", "duration": 120},
        {"text": "What interests you about this role?", "type": "behavioral", "duration": 90},
        {"text": "Describe a challenging project you worked on.", "type": "situational", "duration": 150},
        {"text": "How do you approach problem-solving?", "type": "situational", "duration": 120},
        {"text": "What are your technical strengths?", "type": "technical", "duration": 120},
        {"text": "Where do you see yourself in 5 years?", "type": "behavioral", "duration": 90},
        {"text": "How do you handle tight deadlines?", "type": "situational", "duration": 120},
        {"text": "Explain your experience with team collaboration.", "type": "behavioral", "duration": 120},
        {"text": "How do you stay updated with technology trends?", "type": "technical", "duration": 120},
        {"text": "Describe a time you had to learn a new technology quickly.", "type": "situational", "duration": 150},
        {"text": "What motivates you in your work?", "type": "behavioral", "duration": 90},
        {"text": "How do you handle constructive feedback?", "type": "behavioral", "duration": 120},
        {"text": "Explain your approach to debugging complex issues.", "type": "technical", "duration": 150},
        {"text": "How do you ensure code quality in your work?", "type": "technical", "duration": 120},
        {"text": "Describe your ideal work environment.", "type": "behavioral", "duration": 120},
        {"text": "How do you prioritize tasks when everything seems urgent?", "type": "situational", "duration": 150},
        {"text": "What do you consider your greatest professional achievement?", "type": "behavioral", "duration": 150},
        {"text": "How do you handle disagreements with team members?", "type": "situational", "duration": 120},
        {"text": "Explain your experience with system design principles.", "type": "technical", "duration": 150},
        {"text": "How do you approach technical documentation?", "type": "technical", "duration": 120},
    ]
    
    # Return exactly the requested number of questions
    return base_questions[:question_count]


async def generate_interview_questions(openai, job: dict, resume_data: Optional[dict], question_count: int = 5, difficulty: str = 'medium') -> List[dict]:
    """Generate personalized interview questions using AI."""
    role = job.get("role", "developer")
    level = job.get("level", "mid")
    title = job.get("title", "Software Developer")
    
    # Calculate question distribution based on count
    technical_count = max(1, int(question_count * 0.4))
    behavioral_count = max(1, int(question_count * 0.3))
    situational_count = max(1, int(question_count * 0.2))
    motivation_count = question_count - technical_count - behavioral_count - situational_count
    
    # Adjust difficulty descriptions
    difficulty_descriptions = {
        'easy': 'fundamental concepts, basic scenarios, and straightforward questions suitable for junior candidates',
        'medium': 'intermediate concepts, practical scenarios, and balanced questions suitable for mid-level candidates',
        'hard': 'advanced concepts, complex scenarios, and challenging questions suitable for senior candidates'
    }
    difficulty_desc = difficulty_descriptions.get(difficulty, difficulty_descriptions['medium'])
    
    session_seed = uuid.uuid4().hex[:8]
    
    prompt = f"""Generate EXACTLY {question_count} highly dynamic, completely unique, and independent interview questions for a {level} {title} position.

SESSION SEED (Force Randomization): {session_seed}
USE THIS SEED to ensure the phrasing, topic order, and interview flow are entirely different from any previous generations.

DIFFICULTY: {difficulty_desc}

DISTRIBUTION:
- {technical_count} Technical discussion questions specific to {role}
- {behavioral_count} Behavioral questions
- {situational_count} Situational/problem-solving questions
- {motivation_count} Question about career goals/motivation

CANDIDATE CONTEXT (Crucial for Contextualizing Questions):
{str(resume_data)[:1000] if resume_data else "No specific resume data provided. Ask role-specific domain questions."}

CRITICAL RULES FOR QUESTION SELECTION & FLOW (MUST FOLLOW STRICTLY):
1. ZERO GENERIC OPENINGS: NEVER start with "Walk me through your experience", "Tell me about your background", or "Mention your technical experience". Dive directly into a highly contextual, resume-driven, or role-specific question (e.g., "I see you used React in your last project, what state management approach did you choose?").
2. INTELLIGENT PRIORITIZATION:
   - Fresher/Intern: Focus on projects, core concepts, and learning experiences.
   - Experienced: Focus on production issues, architecture, scaling, and deployment.
   - Strong Projects: Ask about implementation details, logic challenges, and why certain tech was used.
3. ROLE-SPECIFIC NATURAL STYLES (Emulate these):
   - Python: "What was the most challenging logic you implemented in your Python backend?"
   - Salesforce: "Can you explain a complex Apex trigger or flow you built recently?"
   - AWS: "How did you manage infrastructure or deployment in your last project?"
4. PURELY INDEPENDENT: Every question MUST stand completely alone. 
5. NO CORRECTIVE FOLLOW-UPS: NEVER assume the candidate missed information. DO NOT use phrases like "Since you didn't mention...", "Following up on...", or "You didn't explain...".
6. VERBAL ONLY: No coding, syntax, or algorithm implementation tasks.
7. MAXIMUM DIVERSITY: Randomize question structures, openings, and topic order across the {question_count} questions.

Return as JSON array with EXACTLY {question_count} questions:
[{{"text": "Completely standalone, contextual, natural question text", "type": "technical|behavioral|situational", "duration": 120, "key_points": ["point1", "point2"]}}]
"""
    
    try:
        result = await openai.generate_json(prompt)
        
        if isinstance(result, list):
            questions = result
        elif isinstance(result, dict) and "questions" in result:
            questions = result["questions"]
        else:
            questions = []
        
        # Validate that we got the correct number of questions
        if len(questions) != question_count:
            if len(questions) > question_count:
                # Truncate if we got too many
                questions = questions[:question_count]
            elif len(questions) < question_count:
                # If we got too few, pad with fallback questions
                fallback = get_fallback_questions(question_count - len(questions), role)
                questions = questions + fallback
        
        # Final validation - ensure we have exactly the requested count
        if len(questions) != question_count:
            return get_fallback_questions(question_count, role)
        
        return questions
    except Exception as e:
        # Fallback questions that respect the count
        return get_fallback_questions(question_count, role)


class InterviewInviteRequest(BaseModel):
    candidate_ids: List[str] = Field(default_factory=list)
    job_id: str
    scheduled_time: Optional[str] = None
    question_count: Optional[int] = 5
    difficulty: Optional[str] = "medium"
    deadline: Optional[str] = None


@router.post("/invite")
async def invite_ai_interviews(
    body: InterviewInviteRequest,
    user: ClerkUser = Depends(require_user),
):
    db = get_db_admin_service()
    email_service = get_email_service()
    openai = get_openai_service()
    settings = get_settings()

    if not body.job_id:
        return api_error(message="Missing job_id", status_code=400)
    if not isinstance(body.candidate_ids, list) or len(body.candidate_ids) == 0:
        return api_error(message="No candidates selected", status_code=400)

    # Deadline: prefer explicit datetime from body.deadline, fallback to 72h
    try:
        if body.deadline:
            deadline_dt = _parse_iso_dt(body.deadline)
            if deadline_dt <= datetime.now(timezone.utc):
                return api_error(message="Deadline must be in the future", status_code=400)
        else:
            deadline_dt = datetime.now(timezone.utc) + timedelta(hours=72)
    except Exception:
        return api_error(message="Invalid deadline date/time format", status_code=400)

    def _fetch_job():
        return (
            db.client.from_("job_descriptions")
            .select("id, title, role, level, must_have_skills, description")
            .eq("id", body.job_id)
            .eq("created_by", user.id)
            .single()
            .execute()
        )

    job_res = await db.run(_fetch_job)
    job = getattr(job_res, "data", None)
    if not isinstance(job, dict):
        return api_error(message="Job not found", status_code=404)

    def _fetch_candidates():
        return (
            db.client.from_("candidates")
            .select("id, email, full_name, resume_parsed_data")
            .in_("id", body.candidate_ids)
            .execute()
        )

    cand_res = await db.run(_fetch_candidates)
    candidates = getattr(cand_res, "data", None) or []
    if not isinstance(candidates, list) or len(candidates) == 0:
        return api_error(message="No candidates found", status_code=404)

    requested_count = max(1, min(30, int(body.question_count or 5)))
    difficulty = (body.difficulty or "medium").strip().lower()

    invites_sent = 0
    failed: List[str] = []
    failed_reasons: Dict[str, str] = {}

    for c in candidates:
        cid = c.get("id") if isinstance(c, dict) else None
        if not cid:
            continue
        token = secrets.token_urlsafe(32)
        session_id = str(uuid.uuid4())

        try:
            questions_raw = await generate_interview_questions(
                openai,
                job,
                c.get("resume_parsed_data") if isinstance(c, dict) else None,
                requested_count,
                difficulty,
            )
            questions = _normalize_questions(questions_raw)
            if len(questions) == 0:
                raise ValueError("No interview questions generated")

            resume = c.get("resume_parsed_data") if isinstance(c, dict) else None
            resume = resume if isinstance(resume, dict) else {}
            resume_insights = {
                "skills": resume.get("skills")[:15]
                if isinstance(resume.get("skills"), list)
                else [],
                "experience_summary": "; ".join(
                    [
                        f"{(e or {}).get('title', '')} at {(e or {}).get('company', '')}".strip()
                        for e in (resume.get("experience") or [])[:3]
                        if isinstance(e, dict)
                    ]
                )
                if isinstance(resume.get("experience"), list)
                else (str(resume.get("experience"))[:300] if isinstance(resume.get("experience"), str) else ""),
                "education_summary": "; ".join(
                    [
                        f"{(e or {}).get('degree', '')} from {(e or {}).get('institution', '')}".strip()
                        for e in (resume.get("education") or [])[:2]
                        if isinstance(e, dict)
                    ]
                )
                if isinstance(resume.get("education"), list)
                else (str(resume.get("education"))[:200] if isinstance(resume.get("education"), str) else ""),
            }

            proctoring_data = {
                "warnings": [],
                "camera_enabled": False,
                "microphone_enabled": False,
                "resume_insights": resume_insights,
                "invite_delivery": {"status": "pending", "attempted_at": _utc_now_iso()},
            }

            insert_row = {
                "id": session_id,
                "candidate_id": cid,
                "job_id": body.job_id,
                "token": token,
                "status": "pending",
                "deadline": deadline_dt.isoformat(),
                "current_question_index": 0,
                "questions": questions,
                "responses": [],
                "proctoring_data": proctoring_data,
                "created_at": _utc_now_iso(),
            }

            await db.run(lambda: db.client.from_("ai_interview_sessions").insert(insert_row).execute())

            # Email is non-blocking infra
            try:
                interview_link = f"{str(settings.frontend_url).rstrip('/')}/ai-interview/{token}"
                recipient_email = str(c.get("email") or "").strip()
                if not recipient_email:
                    raise RuntimeError("Candidate email is missing")
                await email_service.send_interview_invite(
                    to=recipient_email,
                    candidate_name=str(c.get("full_name") or "Candidate"),
                    job_title=str(job.get("title") or ""),
                    interview_link=interview_link,
                    scheduled_time=body.scheduled_time,
                )
                proctoring_data["invite_delivery"] = {"status": "sent", "sent_at": _utc_now_iso()}
            except Exception as e:
                proctoring_data["invite_delivery"] = {"status": "failed", "failed_at": _utc_now_iso(), "error": str(e)}

            await db.run(
                lambda: db.client.from_("ai_interview_sessions")
                .update({"proctoring_data": proctoring_data, "updated_at": _utc_now_iso()})
                .eq("id", session_id)
                .execute()
            )

            invites_sent += 1
        except Exception as e:
            failed.append(str(cid))
            failed_reasons[str(cid)] = str(e)

    return ok(
        {
            "success": invites_sent > 0,
            "invites_sent": invites_sent,
            "failed": failed,
            "failed_reasons": failed_reasons,
        }
    )


@router.get("/start/{token}")
async def start_interview(token: str):
    db = get_db_admin_service()

    token = token.strip()

    def _fetch():
        return (
            db.client.from_("ai_interview_sessions")
            .select("*, candidates(full_name, email), job_descriptions(title, role, level)")
            .eq("token", token)
            .single()
            .execute()
        )

    res = await db.run(_fetch)
    session = getattr(res, "data", None)
    if not isinstance(session, dict):
        return api_error(message="Interview not found or link expired", status_code=404)

    if session.get("status") in ("completed", "terminated"):
        return api_error(message="Interview already completed or terminated", status_code=400)

    try:
        deadline_dt = _parse_iso_dt(session.get("deadline"))
        if datetime.now(timezone.utc) > deadline_dt.astimezone(timezone.utc):
            await db.update(
                "ai_interview_sessions",
                {
                    "status": "expired",
                    "integrity_score": 0,
                    "completed_at": _utc_now_iso(),
                },
                filters={"id": session["id"]},
            )
            await db.update(
                "job_applications",
                {"interview_status": "expired", "manual_interview_score": 0},
                filters={"candidate_id": session.get("candidate_id"), "job_id": session.get("job_id")},
            )
            return api_error(message="Interview deadline has passed", status_code=400)
    except Exception:
        return api_error(message="Interview session misconfigured (invalid deadline)", status_code=500)

    questions = _normalize_questions(session.get("questions"))
    if len(questions) == 0:
        return api_error(
            message="Interview questions are not available yet. Please contact the hiring team.",
            status_code=400,
        )

    if session.get("status") == "pending":
        await db.update(
            "ai_interview_sessions",
            {"status": "in_progress", "started_at": _utc_now_iso()},
            filters={"id": session["id"]},
        )

    cand = session.get("candidates") or {}
    job = session.get("job_descriptions") or {}
    return ok(
        {
            "session_id": session.get("id"),
            "candidate_name": cand.get("full_name"),
            "job_title": job.get("title"),
            "total_questions": len(questions),
            "estimated_duration_minutes": (len(questions) or 5) * 3,
        }
    )


@router.get("/{session_id}/question")
async def get_current_question(session_id: str):
    db = get_db_admin_service()
    sessions = await db.select(
        "ai_interview_sessions",
        columns="id,status,current_question_index,questions",
        filters={"id": session_id},
        limit=1,
    )
    session = sessions[0] if sessions else None
    if not session:
        return api_error(message="Session not found", status_code=404)
    if session.get("status") != "in_progress":
        return api_error(message="Interview not in progress", status_code=400)

    idx = int(session.get("current_question_index") or 0)
    questions = _normalize_questions(session.get("questions"))
    if idx >= len(questions):
        return ok({"completed": True, "message": "All questions answered"})

    q = questions[idx]
    return ok(
        {
            "index": idx,
            "question_text": q.get("text"),
            "question_type": q.get("type"),
            "expected_duration_seconds": q.get("duration") or 120,
        }
    )


class AdaptQuestionRequest(BaseModel):
    next_index: Optional[int] = None


@router.post("/{session_id}/adapt-question")
async def adapt_question(session_id: str, body: AdaptQuestionRequest):
    db = get_db_admin_service()
    ai = get_openai_service()

    def _fetch():
        return (
            db.client.from_("ai_interview_sessions")
            .select("*, job_descriptions(title, role, level, must_have_skills, description)")
            .eq("id", session_id)
            .single()
            .execute()
        )

    res = await db.run(_fetch)
    session = getattr(res, "data", None)
    if not isinstance(session, dict):
        return api_error(message="Session not found", status_code=404)
    if session.get("status") != "in_progress":
        return api_error(message="Interview not in progress", status_code=400)

    questions = _normalize_questions(session.get("questions"))
    responses = session.get("responses") if isinstance(session.get("responses"), list) else []
    idx = body.next_index if isinstance(body.next_index, int) else int(session.get("current_question_index") or 0)
    if idx >= len(questions):
        return ok({"completed": True})

    if not responses:
        q = questions[idx]
        return ok(
            {
                "index": idx,
                "question_text": q.get("text"),
                "question_type": q.get("type"),
                "expected_duration_seconds": q.get("duration") or 120,
                "adaptive": False,
            }
        )

    job = session.get("job_descriptions") or {}
    resume_insights = (session.get("proctoring_data") or {}).get("resume_insights") or {}

    prior_pairs: List[str] = []
    for r in sorted(
        [rr for rr in responses if isinstance(rr, dict) and isinstance(rr.get("question_index"), int)],
        key=lambda x: int(x.get("question_index")),
    )[-3:]:
        qi = int(r.get("question_index"))
        if qi < 0 or qi >= len(questions):
            continue
        qq = questions[qi]
        prior_pairs.append(f"Q ({qq.get('type')}): {qq.get('text')}\nA: {r.get('transcript') or '[No response provided]'}")
    prior_qa = "\n\n".join(prior_pairs)

    next_pre = questions[idx]
    skills = ", ".join(job.get("must_have_skills") or []) if isinstance(job.get("must_have_skills"), list) else "General"
    cand_skills = ", ".join(resume_insights.get("skills") or []) if isinstance(resume_insights.get("skills"), list) else ""

    prompt = (
        f"You are an expert technical interviewer conducting a live {job.get('level')} {job.get('role')} interview for {job.get('title')}.\n\n"
        f"Required Skills: {skills}\n"
        f"{('Candidate Skills: ' + cand_skills) if cand_skills else ''}\n"
        f"{('Candidate Experience: ' + str(resume_insights.get('experience_summary'))) if resume_insights.get('experience_summary') else ''}\n\n"
        f"## Interview Progress So Far (last {min(len(prior_pairs), 3)} Q&A pairs):\n{prior_qa}\n\n"
        f"## Pre-planned next question (question {idx + 1} of {len(questions)}):\n\"{next_pre.get('text')}\" (type: {next_pre.get('type')})\n\n"
        "## Your Task:\n"
        "Based on the candidate's answers above, generate a BETTER adaptive follow-up question for the next question.\n"
        "Return ONLY this JSON:\n"
        '{"text": "<the adaptive question>", "type": "technical|behavioral|situational", "duration": <seconds 90-180>}'
    )

    adapted: Optional[Dict[str, Any]] = None
    try:
        adapted = await ai.generate_json(prompt)
    except Exception:
        adapted = None

    if isinstance(adapted, dict) and adapted.get("text"):
        updated = list(questions)
        updated[idx] = {
            "text": str(adapted.get("text")),
            "type": str(adapted.get("type") or next_pre.get("type") or "technical"),
            "duration": int(adapted.get("duration") or next_pre.get("duration") or 120),
        }
        await db.run(
            lambda: db.client.from_("ai_interview_sessions")
            .update({"questions": updated, "updated_at": _utc_now_iso()})
            .eq("id", session_id)
            .execute()
        )
        return ok(
            {
                "index": idx,
                "question_text": updated[idx]["text"],
                "question_type": updated[idx]["type"],
                "expected_duration_seconds": updated[idx]["duration"],
                "adaptive": True,
            }
        )

    return ok(
        {
            "index": idx,
            "question_text": next_pre.get("text"),
            "question_type": next_pre.get("type"),
            "expected_duration_seconds": next_pre.get("duration") or 120,
            "adaptive": False,
        }
    )


class TranscribeStoreRequest(BaseModel):
    question_index: int
    audio_base64: str
    mime_type: Optional[str] = "audio/webm"
    audio_duration_seconds: Optional[float] = 0


@router.post("/{session_id}/transcribe-store")
async def transcribe_store(session_id: str, body: TranscribeStoreRequest):
    db = get_db_admin_service()
    assembly = get_assemblyai_service()

    sessions = await db.select(
        "ai_interview_sessions",
        columns="id,status,responses",
        filters={"id": session_id},
        limit=1,
    )
    session = sessions[0] if sessions else None
    if not session:
        return api_error(message="Session not found", status_code=404)
    if session.get("status") not in ("in_progress", "completed"):
        return api_error(message="Interview not in progress", status_code=400)

    if body.question_index < 0:
        return api_error(message="Missing or invalid question_index.", status_code=400)

    try:
        audio_bytes = base64.b64decode(body.audio_base64)
    except Exception:
        return api_error(message="Invalid base64 audio data.", status_code=400)
    if not audio_bytes:
        return api_error(message="Empty audio data received.", status_code=400)

    try:
        transcript = await assembly.transcribe(audio_bytes)
    except RuntimeError as e:
        if "ASSEMBLYAI_API_KEY" in str(e):
            return api_error(message=str(e), status_code=503)
        return api_error(message=f"Transcription failed: {str(e)}", status_code=500)
    except TimeoutError:
        return api_error(message="Transcription timed out", status_code=504)
    except Exception as e:
        return api_error(message=f"Transcription failed: {str(e)}", status_code=500)

    responses = session.get("responses") if isinstance(session.get("responses"), list) else []
    responses = list(responses)
    existing_idx = next(
        (i for i, r in enumerate(responses) if isinstance(r, dict) and int(r.get("question_index") or -1) == body.question_index),
        -1,
    )
    existing = responses[existing_idx] if existing_idx >= 0 and isinstance(responses[existing_idx], dict) else {}
    updated = {
        **existing,
        "question_index": body.question_index,
        "transcript": transcript,
        "audio_duration_seconds": float(body.audio_duration_seconds or existing.get("audio_duration_seconds") or 0),
        "confidence": float(existing.get("confidence") or 0.9),
        "transcribed_at": _utc_now_iso(),
        "submitted_at": existing.get("submitted_at") or _utc_now_iso(),
    }
    if existing_idx >= 0:
        responses[existing_idx] = updated
    else:
        responses.append(updated)

    await db.update(
        "ai_interview_sessions",
        {"responses": responses, "updated_at": _utc_now_iso()},
        filters={"id": session_id},
    )

    return ok({"success": True, "question_index": body.question_index, "transcript_length": len(transcript)})


@router.post("/{session_id}/response")
async def submit_response(session_id: str, body: Dict[str, Any] = Body(...)):
    db = get_db_admin_service()
    sessions = await db.select(
        "ai_interview_sessions",
        columns="id,status,current_question_index,questions,responses",
        filters={"id": session_id},
        limit=1,
    )
    session = sessions[0] if sessions else None
    if not session:
        return api_error(message="Session not found", status_code=404)
    if session.get("status") != "in_progress":
        return api_error(message="Interview not in progress", status_code=400)

    q_index = body.get("question_index")
    if not isinstance(q_index, int):
        try:
            q_index = int(q_index)
        except Exception:
            return api_error(message="Invalid question_index", status_code=400)

    responses = session.get("responses") if isinstance(session.get("responses"), list) else []
    responses = list(responses)
    existing_idx = next(
        (i for i, r in enumerate(responses) if isinstance(r, dict) and int(r.get("question_index") or -1) == q_index),
        -1,
    )
    payload = {
        "question_index": q_index,
        "transcript": body.get("transcript") if isinstance(body.get("transcript"), str) else "",
        "audio_duration_seconds": body.get("audio_duration_seconds"),
        "confidence": body.get("confidence"),
        "submitted_at": _utc_now_iso(),
    }
    if existing_idx >= 0 and isinstance(responses[existing_idx], dict):
        responses[existing_idx] = {**responses[existing_idx], **payload}
    else:
        responses.append(payload)

    next_index = int(session.get("current_question_index") or 0) + 1
    questions = _normalize_questions(session.get("questions"))
    is_last = next_index >= len(questions)

    await db.update(
        "ai_interview_sessions",
        {"responses": responses, "current_question_index": next_index, "updated_at": _utc_now_iso()},
        filters={"id": session_id},
    )

    return ok({"success": True, "is_last_question": is_last})


@router.post("/{session_id}/proctoring")
async def proctoring(session_id: str, event: Dict[str, Any] = Body(...)):
    db = get_db_admin_service()
    sessions = await db.select(
        "ai_interview_sessions",
        columns="id,proctoring_data,status",
        filters={"id": session_id},
        limit=1,
    )
    session = sessions[0] if sessions else None
    if not session:
        return api_error(message="Session not found", status_code=404)

    proctoring_data = session.get("proctoring_data") if isinstance(session.get("proctoring_data"), dict) else {}

    et = event.get("event_type")
    if et == "tab_switch":
        proctoring_data["tab_switches"] = int(proctoring_data.get("tab_switches") or 0) + 1
    elif et == "fullscreen_exit":
        proctoring_data["fullscreen_exits"] = int(proctoring_data.get("fullscreen_exits") or 0) + 1
    elif et == "window_blur":
        proctoring_data["window_blurs"] = int(proctoring_data.get("window_blurs") or 0) + 1
    elif et == "face_not_detected":
        proctoring_data["face_detection_failures"] = int(proctoring_data.get("face_detection_failures") or 0) + 1
    elif et == "copy_paste":
        proctoring_data["copy_paste_attempts"] = int(proctoring_data.get("copy_paste_attempts") or 0) + 1
    elif et == "devtools_open":
        proctoring_data["devtools_attempts"] = int(proctoring_data.get("devtools_attempts") or 0) + 1

    warnings = proctoring_data.get("warnings")
    if not isinstance(warnings, list):
        warnings = []
    is_critical = et in ("tab_switch", "fullscreen_exit", "window_blur")
    warnings.append(
        {
            "type": et,
            "timestamp": event.get("timestamp") or _utc_now_iso(),
            "details": event.get("details"),
            "severity": "critical" if is_critical else "warning",
        }
    )
    proctoring_data["warnings"] = warnings

    should_terminate = False
    termination_reason = ""
    if is_critical:
        should_terminate = True
        termination_reason = f"Interview terminated: {str(et).replace('_', ' ')} detected. This is a strict proctoring violation."
    elif int(proctoring_data.get("face_detection_failures") or 0) >= 3:
        should_terminate = True
        termination_reason = "Interview terminated: Face not visible 3 times."
    else:
        minor = int(proctoring_data.get("copy_paste_attempts") or 0) + int(proctoring_data.get("devtools_attempts") or 0)
        if minor >= 3:
            should_terminate = True
            termination_reason = "Interview terminated: Too many proctoring violations."

    if should_terminate:
        proctoring_data["terminated"] = True
        proctoring_data["termination_reason"] = termination_reason
        terminated_eval = {
            "overall_score": 0,
            "technical_score": 0,
            "communication_score": 0,
            "confidence_score": 0,
            "recommendation": "no_hire",
            "strengths": [],
            "areas_for_improvement": ["Interview terminated due to proctoring violations."],
            "detailed_feedback": termination_reason,
        }
        await db.update(
            "ai_interview_sessions",
            {
                "proctoring_data": proctoring_data,
                "status": "terminated",
                "completed_at": _utc_now_iso(),
                "final_evaluation": terminated_eval,
            },
            filters={"id": session_id},
        )
        violations = len(warnings) if isinstance(warnings, list) else 0
        threshold = 3
        return ok({"terminated": True, "message": termination_reason, "violations": violations, "threshold": threshold})

    await db.update(
        "ai_interview_sessions",
        {"proctoring_data": proctoring_data, "updated_at": _utc_now_iso()},
        filters={"id": session_id},
    )
    violations = len(warnings) if isinstance(warnings, list) else 0
    threshold = 3
    return ok({"success": True, "terminated": False, "warning": True, "message": "Proctoring violation recorded.", "violations": violations, "threshold": threshold})


@router.post("/{session_id}/complete")
async def complete(session_id: str):
    db = get_db_admin_service()
    ai = get_openai_service()

    def _fetch():
        return (
            db.client.from_("ai_interview_sessions")
            .select("*, candidates(full_name), job_descriptions(title, role, level, must_have_skills)")
            .eq("id", session_id)
            .single()
            .execute()
        )

    res = await db.run(_fetch)
    session = getattr(res, "data", None)
    if not isinstance(session, dict):
        return api_error(message="Session not found", status_code=404)

    questions = _normalize_questions(session.get("questions"))
    responses = session.get("responses") if isinstance(session.get("responses"), list) else []

    qa_pairs: List[str] = []
    for i, q in enumerate(questions):
        resp = None
        for r in responses:
            if isinstance(r, dict) and int(r.get("question_index") or -1) == i:
                resp = r
                break
        qa_pairs.append(f"Q{i + 1} ({q.get('type')}): {q.get('text')}\nA{i + 1}: {(resp or {}).get('transcript') or '[No response]'}")
    qa_text = "\n\n".join(qa_pairs)

    job = session.get("job_descriptions") or {}
    skills = ", ".join(job.get("must_have_skills") or []) if isinstance(job.get("must_have_skills"), list) else ""

    prompt = (
        f"Evaluate this AI interview for a {job.get('level')} {job.get('role')} position ({job.get('title')}).\n"
        f"Required skills: {skills}\n\n"
        f"Interview Q&A:\n{qa_text}\n\n"
        "Evaluate and return JSON:\n"
        "{\n"
        '  "overall_score": 0-100,\n'
        '  "technical_score": 0-100,\n'
        '  "communication_score": 0-100,\n'
        '  "confidence_score": 0-100,\n'
        '  "recommendation": "strong_hire" or "hire" or "maybe" or "no_hire",\n'
        '  "strengths": ["strength1", "strength2"],\n'
        '  "areas_for_improvement": ["area1", "area2"],\n'
        '  "detailed_feedback": "2-3 sentence summary of candidate performance"\n'
        "}"
    )

    final_eval: Dict[str, Any]
    try:
        final_eval = await ai.generate_json(prompt)
        if not isinstance(final_eval, dict) or "overall_score" not in final_eval:
            raise ValueError("invalid evaluation")
    except Exception:
        answered = len([r for r in responses if isinstance(r, dict) and isinstance(r.get("transcript"), str) and r.get("transcript").strip()])
        completion = (answered / len(questions)) * 100 if questions else 0
        final_eval = {
            "overall_score": round(completion * 0.7),
            "technical_score": round(completion * 0.6),
            "communication_score": round(completion * 0.8),
            "confidence_score": round(completion * 0.7),
            "recommendation": "maybe" if completion >= 70 else "no_hire",
            "strengths": ["Completed interview responses"] if answered > 0 else [],
            "areas_for_improvement": ["Could not perform AI evaluation - scores are approximate"],
            "detailed_feedback": f"Candidate answered {answered} of {len(questions)} questions.",
        }

    await db.update(
        "ai_interview_sessions",
        {"status": "completed", "completed_at": _utc_now_iso(), "final_evaluation": final_eval},
        filters={"id": session_id},
    )

    return ok(final_eval)
