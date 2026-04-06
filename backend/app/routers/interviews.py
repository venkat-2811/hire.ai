from fastapi import APIRouter, HTTPException
from typing import List, Optional
from datetime import datetime
import uuid
from app.models.schemas import (
    InterviewSession, InterviewSessionCreate, InterviewSessionUpdate,
    InterviewQuestion, QuestionGenerationRequest, CandidateResponse,
    CandidateResponseCreate, ResponseEvaluationResult, InterviewEvaluation,
    PracticalAssessment, PracticalSubmission, PracticalSubmissionCreate,
    ProctoringData, APIResponse, ResumeData, JobDescription
)
from app.models.enums import InterviewStatus, HireRecommendation
from app.database import get_supabase_client
from app.database.supabase_client import get_supabase_admin_client
from app.services.question_generator import get_question_generator
from app.services.response_evaluator import get_response_evaluator
from app.services.practical_evaluator import get_practical_evaluator

router = APIRouter(prefix="/interviews", tags=["Interviews"])


@router.get("", response_model=List[InterviewSession])
async def list_interviews(
    status: Optional[InterviewStatus] = None,
    candidate_id: Optional[str] = None,
    job_id: Optional[str] = None,
    limit: int = 50
):
    """List interview sessions with optional filters."""
    supabase = get_supabase_client()
    
    # Fetch standard interview sessions
    query = supabase.table("interview_sessions").select("*")
    if status:
        query = query.eq("status", status.value)
    if candidate_id:
        query = query.eq("candidate_id", candidate_id)
    if job_id:
        query = query.eq("job_id", job_id)
    
    result = query.order("created_at", desc=True).limit(limit).execute()
    
    sessions = []
    for row in result.data:
        sessions.append(_row_to_session(row))

    # Fetch AI interview sessions
    admin_supabase = get_supabase_admin_client()
    query_ai = admin_supabase.table("ai_interview_sessions").select("*")
    if candidate_id:
        query_ai = query_ai.eq("candidate_id", candidate_id)
    if job_id:
        query_ai = query_ai.eq("job_id", job_id)
        
    result_ai = query_ai.order("created_at", desc=True).limit(limit).execute()
    
    for row in result_ai.data:
        proctoring = row.get("proctoring_data", {})
        
        # User requested logic: if score is present, make it completed. 
        # If score is empty, make it pending.
        final_eval = row.get("final_evaluation")
        if final_eval and isinstance(final_eval, dict) and final_eval.get("overall_score") is not None:
            mapped_status = InterviewStatus.COMPLETED
        else:
            mapped_status = InterviewStatus.PENDING
            
        # Optional: if client requested a specific status, filter here since we dynamically overrode it
        if status and mapped_status != status:
            continue
        
        sessions.append(InterviewSession(
            id=row["id"],
            candidate_id=row["candidate_id"],
            job_id=row["job_id"],
            screening_id=None,
            status=mapped_status,
            scheduled_at=None,
            started_at=row.get("started_at"),
            completed_at=row.get("completed_at"),
            question_seed=None,
            proctoring_data=ProctoringData(
                tab_switches=proctoring.get("tab_switches", 0),
                copy_paste_count=0,
                fullscreen_exits=proctoring.get("fullscreen_exits", 0)
            ),
            integrity_score=None,
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at", row.get("created_at"))
        ))
    
    # Sort merged sessions by created_at descending
    sessions.sort(key=lambda s: s.created_at or "", reverse=True)
    return sessions[:limit]


@router.get("/{session_id}", response_model=InterviewSession)
async def get_interview(session_id: str):
    """Get a specific interview session."""
    supabase = get_supabase_client()
    
    result = supabase.table("interview_sessions").select("*").eq(
        "id", session_id
    ).single().execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Interview session not found")
    
    return _row_to_session(result.data)


@router.post("", response_model=InterviewSession)
async def create_interview(session: InterviewSessionCreate):
    """Create a new interview session."""
    supabase = get_supabase_client()
    
    # Generate unique question seed
    question_generator = get_question_generator()
    question_seed = question_generator.generate_question_seed(
        session.candidate_id, session.job_id
    )
    
    data = {
        "candidate_id": session.candidate_id,
        "job_id": session.job_id,
        "screening_id": session.screening_id,
        "scheduled_at": session.scheduled_at.isoformat() if session.scheduled_at else None,
        "status": InterviewStatus.PENDING.value,
        "question_seed": question_seed,
        "proctoring_data": {"tabSwitches": 0, "copyPasteCount": 0, "fullscreenExits": 0}
    }
    
    result = supabase.table("interview_sessions").insert(data).execute()
    
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create interview session")
    
    return _row_to_session(result.data[0])


@router.post("/{session_id}/start", response_model=InterviewSession)
async def start_interview(session_id: str):
    """Start an interview session and generate questions."""
    supabase = get_supabase_client()
    
    # Get session
    session_result = supabase.table("interview_sessions").select("*").eq(
        "id", session_id
    ).single().execute()
    
    if not session_result.data:
        raise HTTPException(status_code=404, detail="Interview session not found")
    
    session = session_result.data
    
    if session["status"] != InterviewStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Interview already started or completed")
    
    # Get candidate and job data
    candidate_result = supabase.table("candidates").select("*").eq(
        "id", session["candidate_id"]
    ).single().execute()
    
    job_result = supabase.table("job_descriptions").select("*").eq(
        "id", session["job_id"]
    ).single().execute()
    
    if not candidate_result.data or not job_result.data:
        raise HTTPException(status_code=404, detail="Candidate or job not found")
    
    candidate = candidate_result.data
    job_row = job_result.data
    
    # Parse data
    resume_data = ResumeData(**candidate["resume_parsed_data"]) if candidate.get("resume_parsed_data") else ResumeData()
    job = JobDescription(
        id=job_row["id"],
        title=job_row["title"],
        role=job_row["role"],
        level=job_row["level"],
        description=job_row["description"],
        must_have_skills=job_row.get("must_have_skills", []),
        good_to_have_skills=job_row.get("good_to_have_skills", []),
        min_experience_years=job_row.get("min_experience_years", 0)
    )
    
    # Get previously asked questions to avoid repetition
    prev_questions_result = supabase.table("interview_questions").select(
        "question_text"
    ).neq("session_id", session_id).limit(100).execute()
    
    previous_questions = [q["question_text"] for q in prev_questions_result.data]
    
    # Generate questions
    question_generator = get_question_generator()
    questions = await question_generator.generate_interview_questions(
        resume_data=resume_data,
        job=job,
        session_id=session_id,
        question_seed=session["question_seed"],
        previous_questions=previous_questions
    )
    
    # Save questions to database
    for q in questions:
        q_data = {
            "id": q.id,
            "session_id": session_id,
            "question_type": q.question_type.value,
            "question_text": q.question_text,
            "expected_answer": q.expected_answer,
            "difficulty_level": q.difficulty_level,
            "max_score": q.max_score,
            "time_limit_seconds": q.time_limit_seconds,
            "order_index": q.order_index,
            "metadata": q.metadata
        }
        supabase.table("interview_questions").insert(q_data).execute()
    
    # Generate practical assessments
    practical_evaluator = get_practical_evaluator()
    practicals = await practical_evaluator.get_practical_tasks(
        job, session_id
    )
    
    for p in practicals:
        p_data = {
            "id": p.id,
            "session_id": session_id,
            "role": p.role,
            "task_title": p.task_title,
            "task_description": p.task_description,
            "starter_code": p.starter_code,
            "expected_output": p.expected_output,
            "evaluation_criteria": [c.model_dump() for c in p.evaluation_criteria],
            "time_limit_minutes": p.time_limit_minutes,
            "order_index": p.order_index
        }
        supabase.table("practical_assessments").insert(p_data).execute()
    
    # Update session status
    update_data = {
        "status": InterviewStatus.IN_PROGRESS.value,
        "started_at": datetime.utcnow().isoformat()
    }
    
    result = supabase.table("interview_sessions").update(update_data).eq(
        "id", session_id
    ).execute()
    
    return _row_to_session(result.data[0])


@router.get("/{session_id}/questions", response_model=List[InterviewQuestion])
async def get_interview_questions(session_id: str):
    """Get all questions for an interview session."""
    supabase = get_supabase_client()
    
    result = supabase.table("interview_questions").select("*").eq(
        "session_id", session_id
    ).order("order_index").execute()
    
    questions = []
    for row in result.data:
        questions.append(_row_to_question(row))
    
    return questions


@router.post("/{session_id}/responses", response_model=CandidateResponse)
async def submit_response(session_id: str, response: CandidateResponseCreate):
    """Submit a response to an interview question."""
    supabase = get_supabase_client()
    
    # Verify session is in progress
    session_result = supabase.table("interview_sessions").select("status").eq(
        "id", session_id
    ).single().execute()
    
    if not session_result.data:
        raise HTTPException(status_code=404, detail="Interview session not found")
    
    if session_result.data["status"] != InterviewStatus.IN_PROGRESS.value:
        raise HTTPException(status_code=400, detail="Interview is not in progress")
    
    # Get question
    question_result = supabase.table("interview_questions").select("*").eq(
        "id", response.question_id
    ).single().execute()
    
    if not question_result.data:
        raise HTTPException(status_code=404, detail="Question not found")
    
    question = _row_to_question(question_result.data)
    
    # Create response record
    response_id = str(uuid.uuid4())
    response_data = {
        "id": response_id,
        "question_id": response.question_id,
        "session_id": session_id,
        "response_text": response.response_text,
        "response_code": response.response_code,
        "time_taken_seconds": response.time_taken_seconds
    }
    
    supabase.table("candidate_responses").insert(response_data).execute()
    
    # Evaluate response with AI
    evaluator = get_response_evaluator()
    candidate_response = CandidateResponse(
        id=response_id,
        **response.model_dump()
    )
    
    evaluation = await evaluator.evaluate_response(question, candidate_response)
    
    # Update response with evaluation
    update_data = {
        "ai_score": evaluation.score,
        "ai_feedback": evaluation.feedback
    }
    
    result = supabase.table("candidate_responses").update(update_data).eq(
        "id", response_id
    ).execute()
    
    row = result.data[0]
    return CandidateResponse(
        id=row["id"],
        question_id=row["question_id"],
        session_id=row["session_id"],
        response_text=row.get("response_text"),
        response_code=row.get("response_code"),
        time_taken_seconds=row.get("time_taken_seconds"),
        ai_score=row.get("ai_score"),
        ai_feedback=row.get("ai_feedback"),
        submitted_at=row.get("submitted_at")
    )


@router.get("/{session_id}/practicals", response_model=List[PracticalAssessment])
async def get_practical_assessments(session_id: str):
    """Get practical assessments for an interview session."""
    supabase = get_supabase_client()
    
    result = supabase.table("practical_assessments").select("*").eq(
        "session_id", session_id
    ).order("order_index").execute()
    
    assessments = []
    for row in result.data:
        assessments.append(_row_to_practical(row))
    
    return assessments


@router.post("/{session_id}/practicals/{assessment_id}/submit", response_model=PracticalSubmission)
async def submit_practical(
    session_id: str,
    assessment_id: str,
    submission: PracticalSubmissionCreate
):
    """Submit a practical assessment solution."""
    supabase = get_supabase_client()
    
    # Get assessment
    assessment_result = supabase.table("practical_assessments").select("*").eq(
        "id", assessment_id
    ).single().execute()
    
    if not assessment_result.data:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    assessment = _row_to_practical(assessment_result.data)
    
    # Create submission
    submission_id = str(uuid.uuid4())
    submission_data = {
        "id": submission_id,
        "assessment_id": assessment_id,
        "session_id": session_id,
        "submitted_code": submission.submitted_code,
        "submitted_answer": submission.submitted_answer,
        "time_taken_seconds": submission.time_taken_seconds
    }
    
    supabase.table("practical_submissions").insert(submission_data).execute()
    
    # Evaluate with AI
    evaluator = get_practical_evaluator()
    practical_submission = PracticalSubmission(
        id=submission_id,
        **submission.model_dump()
    )
    
    ai_evaluation = await evaluator.evaluate_submission(assessment, practical_submission)
    score = evaluator.calculate_practical_score(ai_evaluation)
    
    # Update submission with evaluation
    update_data = {
        "ai_evaluation": ai_evaluation.model_dump(),
        "score": score,
        "feedback": ai_evaluation.overall_assessment
    }
    
    result = supabase.table("practical_submissions").update(update_data).eq(
        "id", submission_id
    ).execute()
    
    row = result.data[0]
    return _row_to_submission(row)


@router.post("/{session_id}/proctoring", response_model=APIResponse)
async def update_proctoring_data(session_id: str, proctoring: ProctoringData):
    """Update proctoring data for a session."""
    supabase = get_supabase_client()
    
    proctoring_dict = {
        "tabSwitches": proctoring.tab_switches,
        "copyPasteCount": proctoring.copy_paste_count,
        "fullscreenExits": proctoring.fullscreen_exits
    }
    
    result = supabase.table("interview_sessions").update({
        "proctoring_data": proctoring_dict
    }).eq("id", session_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return APIResponse(success=True, message="Proctoring data updated")


@router.post("/{session_id}/complete", response_model=InterviewEvaluation)
async def complete_interview(session_id: str):
    """Complete an interview and generate final evaluation."""
    supabase = get_supabase_client()
    
    # Get session
    session_result = supabase.table("interview_sessions").select("*").eq(
        "id", session_id
    ).single().execute()
    
    if not session_result.data:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = session_result.data
    
    # Get all responses
    responses_result = supabase.table("candidate_responses").select("*").eq(
        "session_id", session_id
    ).execute()
    
    # Get practical submissions
    practicals_result = supabase.table("practical_submissions").select("*").eq(
        "session_id", session_id
    ).execute()
    
    # Calculate scores
    response_scores = [r["ai_score"] for r in responses_result.data if r.get("ai_score")]
    practical_scores = [p["score"] for p in practicals_result.data if p.get("score")]
    
    technical_score = int(sum(response_scores) / len(response_scores)) if response_scores else 50
    problem_solving_score = int(sum(practical_scores) / len(practical_scores)) if practical_scores else 50
    
    # Calculate communication score
    evaluator = get_response_evaluator()
    responses = [CandidateResponse(
        id=r["id"],
        question_id=r["question_id"],
        session_id=r["session_id"],
        response_text=r.get("response_text"),
        response_code=r.get("response_code")
    ) for r in responses_result.data]
    
    communication_score = await evaluator.calculate_communication_score(responses)
    
    # Calculate integrity score from proctoring
    proctoring = session.get("proctoring_data", {})
    tab_switches = proctoring.get("tabSwitches", 0)
    copy_paste = proctoring.get("copyPasteCount", 0)
    fullscreen_exits = proctoring.get("fullscreenExits", 0)
    
    integrity_score = max(0, 100 - (tab_switches * 5) - (copy_paste * 3) - (fullscreen_exits * 10))
    
    # Calculate overall and role fit
    overall_score = int(
        technical_score * 0.35 +
        problem_solving_score * 0.30 +
        communication_score * 0.20 +
        integrity_score * 0.15
    )
    
    role_fit_index = int((technical_score + problem_solving_score) / 2)
    
    # Determine recommendation
    if overall_score >= 85 and integrity_score >= 80:
        recommendation = HireRecommendation.STRONG_HIRE
    elif overall_score >= 70 and integrity_score >= 70:
        recommendation = HireRecommendation.HIRE
    elif overall_score >= 55:
        recommendation = HireRecommendation.BORDERLINE
    else:
        recommendation = HireRecommendation.NO_HIRE
    
    # Generate strengths and weaknesses
    strengths = []
    weaknesses = []
    
    if technical_score >= 75:
        strengths.append("Strong technical knowledge")
    elif technical_score < 50:
        weaknesses.append("Technical skills need improvement")
    
    if problem_solving_score >= 75:
        strengths.append("Excellent problem-solving abilities")
    elif problem_solving_score < 50:
        weaknesses.append("Problem-solving skills need development")
    
    if communication_score >= 75:
        strengths.append("Clear and effective communication")
    elif communication_score < 50:
        weaknesses.append("Communication could be improved")
    
    if integrity_score >= 90:
        strengths.append("High integrity throughout interview")
    elif integrity_score < 70:
        weaknesses.append("Integrity concerns during interview")
    
    # Create evaluation record
    evaluation_id = str(uuid.uuid4())
    evaluation_data = {
        "id": evaluation_id,
        "session_id": session_id,
        "technical_score": technical_score,
        "problem_solving_score": problem_solving_score,
        "communication_score": communication_score,
        "integrity_score": integrity_score,
        "role_fit_index": role_fit_index,
        "overall_score": overall_score,
        "recommendation": recommendation.value,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "detailed_feedback": f"Overall assessment: {recommendation.value.replace('_', ' ').title()}. "
                            f"Technical: {technical_score}%, Problem Solving: {problem_solving_score}%, "
                            f"Communication: {communication_score}%, Integrity: {integrity_score}%."
    }
    
    supabase.table("interview_evaluations").insert(evaluation_data).execute()
    
    # Update session status
    supabase.table("interview_sessions").update({
        "status": InterviewStatus.COMPLETED.value,
        "completed_at": datetime.utcnow().isoformat(),
        "integrity_score": integrity_score
    }).eq("id", session_id).execute()
    
    return InterviewEvaluation(
        id=evaluation_id,
        session_id=session_id,
        technical_score=technical_score,
        problem_solving_score=problem_solving_score,
        communication_score=communication_score,
        integrity_score=integrity_score,
        role_fit_index=role_fit_index,
        overall_score=overall_score,
        recommendation=recommendation,
        strengths=strengths,
        weaknesses=weaknesses,
        detailed_feedback=evaluation_data["detailed_feedback"],
        evaluated_at=datetime.utcnow()
    )


@router.get("/{session_id}/evaluation", response_model=InterviewEvaluation)
async def get_evaluation(session_id: str):
    """Get the final evaluation for an interview session."""
    supabase = get_supabase_client()
    
    result = supabase.table("interview_evaluations").select("*").eq(
        "session_id", session_id
    ).single().execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    
    row = result.data
    return InterviewEvaluation(
        id=row["id"],
        session_id=row["session_id"],
        technical_score=row.get("technical_score"),
        problem_solving_score=row.get("problem_solving_score"),
        communication_score=row.get("communication_score"),
        integrity_score=row.get("integrity_score"),
        role_fit_index=row.get("role_fit_index"),
        overall_score=row.get("overall_score"),
        recommendation=HireRecommendation(row["recommendation"]) if row.get("recommendation") else None,
        strengths=row.get("strengths", []),
        weaknesses=row.get("weaknesses", []),
        detailed_feedback=row.get("detailed_feedback"),
        evaluator_notes=row.get("evaluator_notes"),
        evaluated_at=row.get("evaluated_at")
    )


# Helper functions
def _row_to_session(row: dict) -> InterviewSession:
    proctoring = row.get("proctoring_data", {})
    return InterviewSession(
        id=row["id"],
        candidate_id=row["candidate_id"],
        job_id=row["job_id"],
        screening_id=row.get("screening_id"),
        status=InterviewStatus(row["status"]),
        scheduled_at=row.get("scheduled_at"),
        started_at=row.get("started_at"),
        completed_at=row.get("completed_at"),
        question_seed=row.get("question_seed"),
        proctoring_data=ProctoringData(
            tab_switches=proctoring.get("tabSwitches", 0),
            copy_paste_count=proctoring.get("copyPasteCount", 0),
            fullscreen_exits=proctoring.get("fullscreenExits", 0)
        ),
        integrity_score=row.get("integrity_score"),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at")
    )


def _row_to_question(row: dict) -> InterviewQuestion:
    from app.models.enums import AssessmentType
    return InterviewQuestion(
        id=row["id"],
        session_id=row["session_id"],
        question_type=AssessmentType(row["question_type"]),
        question_text=row["question_text"],
        expected_answer=row.get("expected_answer"),
        difficulty_level=row["difficulty_level"],
        max_score=row.get("max_score", 10),
        time_limit_seconds=row.get("time_limit_seconds"),
        order_index=row["order_index"],
        metadata=row.get("metadata", {}),
        created_at=row.get("created_at")
    )


def _row_to_practical(row: dict) -> PracticalAssessment:
    from app.models.schemas import EvaluationCriterion
    criteria = [EvaluationCriterion(**c) for c in row.get("evaluation_criteria", [])]
    return PracticalAssessment(
        id=row["id"],
        session_id=row["session_id"],
        role=row["role"],
        task_title=row["task_title"],
        task_description=row["task_description"],
        starter_code=row.get("starter_code"),
        expected_output=row.get("expected_output"),
        evaluation_criteria=criteria,
        time_limit_minutes=row.get("time_limit_minutes", 30),
        order_index=row["order_index"],
        created_at=row.get("created_at")
    )


def _row_to_submission(row: dict) -> PracticalSubmission:
    from app.models.schemas import AIEvaluation, CriteriaScore
    
    ai_eval = None
    if row.get("ai_evaluation"):
        ae = row["ai_evaluation"]
        criteria_scores = [CriteriaScore(**cs) for cs in ae.get("criteria_scores", [])]
        ai_eval = AIEvaluation(
            criteria_scores=criteria_scores,
            overall_assessment=ae.get("overall_assessment", ""),
            suggestions=ae.get("suggestions", [])
        )
    
    return PracticalSubmission(
        id=row["id"],
        assessment_id=row["assessment_id"],
        session_id=row["session_id"],
        submitted_code=row.get("submitted_code"),
        submitted_answer=row.get("submitted_answer"),
        execution_result=row.get("execution_result"),
        ai_evaluation=ai_eval,
        score=row.get("score"),
        feedback=row.get("feedback"),
        time_taken_seconds=row.get("time_taken_seconds"),
        submitted_at=row.get("submitted_at")
    )
