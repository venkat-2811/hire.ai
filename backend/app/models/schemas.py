from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from .enums import (
    RoleLevel, InterviewStatus, AssessmentType,
    HireRecommendation, ReasonCodeType, SkillRelevance
)


# ============== Base Models ==============

class TimestampMixin(BaseModel):
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ============== Job Description ==============

class JobDescriptionCreate(BaseModel):
    title: str
    role: str
    level: RoleLevel
    description: str
    must_have_skills: List[str] = Field(default_factory=list)
    good_to_have_skills: List[str] = Field(default_factory=list)
    min_experience_years: int = 0


class JobDescriptionUpdate(BaseModel):
    title: Optional[str] = None
    role: Optional[str] = None
    level: Optional[RoleLevel] = None
    description: Optional[str] = None
    must_have_skills: Optional[List[str]] = None
    good_to_have_skills: Optional[List[str]] = None
    min_experience_years: Optional[int] = None
    is_active: Optional[bool] = None


class JobDescription(JobDescriptionCreate, TimestampMixin):
    id: str
    created_by: Optional[str] = None
    is_active: bool = True


# ============== Resume Parsing ==============

class ExperienceItem(BaseModel):
    title: str
    company: str
    duration: str
    description: str = ""
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class EducationItem(BaseModel):
    degree: str
    institution: str
    year: str


class ContactInfo(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin: Optional[str] = None


class ResumeData(BaseModel):
    skills: List[str] = Field(default_factory=list)
    experience: List[ExperienceItem] = Field(default_factory=list)
    education: List[EducationItem] = Field(default_factory=list)
    summary: str = ""
    contact: ContactInfo = Field(default_factory=ContactInfo)
    total_experience_years: float = 0.0
    certifications: List[str] = Field(default_factory=list)


# ============== Candidate ==============

class CandidateCreate(BaseModel):
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    portfolio_url: Optional[str] = None
    github_url: Optional[str] = None
    consent_given: bool = False
    job_id: Optional[str] = None


class CandidateUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    portfolio_url: Optional[str] = None
    github_url: Optional[str] = None


class Candidate(CandidateCreate, TimestampMixin):
    id: str
    user_id: Optional[str] = None
    resume_url: Optional[str] = None
    resume_text: Optional[str] = None
    resume_parsed_data: Optional[ResumeData] = None
    consent_timestamp: Optional[datetime] = None
    job_id: Optional[str] = None


# ============== ATS Screening ==============

class ReasonCode(BaseModel):
    code: str
    type: ReasonCodeType
    description: str
    impact: int = Field(ge=-100, le=100)


class SkillMatch(BaseModel):
    skill: str
    found: bool
    relevance: SkillRelevance
    evidence: Optional[str] = None
    confidence: float = Field(ge=0, le=1, default=0.0)


class DetailedAnalysis(BaseModel):
    skill_match: List[SkillMatch] = Field(default_factory=list)
    experience_analysis: str = ""
    education_analysis: str = ""
    career_gap_analysis: str = ""
    credibility_flags: List[str] = Field(default_factory=list)


class ATSScreeningResult(BaseModel):
    id: str
    candidate_id: str
    job_id: str
    overall_score: int = Field(ge=0, le=100)
    skill_relevance_score: Optional[int] = Field(None, ge=0, le=100)
    experience_score: Optional[int] = Field(None, ge=0, le=100)
    education_score: Optional[int] = Field(None, ge=0, le=100)
    credibility_score: Optional[int] = Field(None, ge=0, le=100)
    shortlisted: bool = False
    shortlist_reason: Optional[str] = None
    reason_codes: List[ReasonCode] = Field(default_factory=list)
    detailed_analysis: Optional[DetailedAnalysis] = None
    screened_at: Optional[datetime] = None


class ATSScreeningRequest(BaseModel):
    candidate_id: str
    job_id: str


# ============== Interview Questions ==============

class InterviewQuestionGenerated(BaseModel):
    question_text: str
    question_type: AssessmentType
    difficulty_level: int = Field(ge=1, le=5)
    expected_answer: Optional[str] = None
    time_limit_seconds: Optional[int] = None
    max_score: int = 10
    metadata: Dict[str, Any] = Field(default_factory=dict)


class InterviewQuestion(InterviewQuestionGenerated):
    id: str
    session_id: str
    order_index: int
    created_at: Optional[datetime] = None


class QuestionGenerationRequest(BaseModel):
    session_id: str
    job_id: str
    candidate_id: str
    num_technical: int = 5
    num_behavioral: int = 3
    difficulty_preference: Optional[int] = None


# ============== Interview Session ==============

class ProctoringData(BaseModel):
    tab_switches: int = 0
    copy_paste_count: int = 0
    fullscreen_exits: int = 0
    warnings: List[str] = Field(default_factory=list)


class InterviewSessionCreate(BaseModel):
    candidate_id: str
    job_id: str
    screening_id: Optional[str] = None
    scheduled_at: Optional[datetime] = None


class InterviewSession(InterviewSessionCreate, TimestampMixin):
    id: str
    status: InterviewStatus = InterviewStatus.PENDING
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    question_seed: Optional[str] = None
    proctoring_data: ProctoringData = Field(default_factory=ProctoringData)
    integrity_score: Optional[int] = None


class InterviewSessionUpdate(BaseModel):
    status: Optional[InterviewStatus] = None
    proctoring_data: Optional[ProctoringData] = None
    integrity_score: Optional[int] = None


# ============== Candidate Response ==============

class CandidateResponseCreate(BaseModel):
    question_id: str
    session_id: str
    response_text: Optional[str] = None
    response_code: Optional[str] = None
    time_taken_seconds: Optional[int] = None


class CandidateResponse(CandidateResponseCreate):
    id: str
    ai_score: Optional[int] = Field(None, ge=0, le=100)
    ai_feedback: Optional[str] = None
    manual_score: Optional[int] = Field(None, ge=0, le=100)
    manual_feedback: Optional[str] = None
    submitted_at: Optional[datetime] = None


class ResponseEvaluationResult(BaseModel):
    score: int = Field(ge=0, le=100)
    feedback: str
    strengths: List[str] = Field(default_factory=list)
    improvements: List[str] = Field(default_factory=list)


# ============== Interview Evaluation ==============

class InterviewEvaluation(BaseModel):
    id: str
    session_id: str
    technical_score: Optional[int] = Field(None, ge=0, le=100)
    problem_solving_score: Optional[int] = Field(None, ge=0, le=100)
    communication_score: Optional[int] = Field(None, ge=0, le=100)
    integrity_score: Optional[int] = Field(None, ge=0, le=100)
    role_fit_index: Optional[int] = Field(None, ge=0, le=100)
    overall_score: Optional[int] = Field(None, ge=0, le=100)
    recommendation: Optional[HireRecommendation] = None
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)
    detailed_feedback: Optional[str] = None
    evaluator_notes: Optional[str] = None
    evaluated_at: Optional[datetime] = None


# ============== Practical Assessment ==============

class EvaluationCriterion(BaseModel):
    name: str
    description: str
    max_points: int


class PracticalAssessmentCreate(BaseModel):
    session_id: str
    role: str
    task_title: str
    task_description: str
    starter_code: Optional[str] = None
    expected_output: Optional[str] = None
    evaluation_criteria: List[EvaluationCriterion] = Field(default_factory=list)
    time_limit_minutes: int = 30


class PracticalAssessment(PracticalAssessmentCreate):
    id: str
    order_index: int
    created_at: Optional[datetime] = None


class CriteriaScore(BaseModel):
    criterion: str
    score: int
    max_score: int
    feedback: str


class AIEvaluation(BaseModel):
    criteria_scores: List[CriteriaScore] = Field(default_factory=list)
    overall_assessment: str = ""
    suggestions: List[str] = Field(default_factory=list)


class PracticalSubmissionCreate(BaseModel):
    assessment_id: str
    session_id: str
    submitted_code: Optional[str] = None
    submitted_answer: Optional[str] = None
    time_taken_seconds: Optional[int] = None


class PracticalSubmission(PracticalSubmissionCreate):
    id: str
    execution_result: Optional[str] = None
    ai_evaluation: Optional[AIEvaluation] = None
    score: Optional[int] = Field(None, ge=0, le=100)
    feedback: Optional[str] = None
    submitted_at: Optional[datetime] = None


# ============== Dashboard & Analytics ==============

class DashboardStats(BaseModel):
    total_candidates: int = 0
    total_candidates_change: int = 0
    active_jobs: int = 0
    active_jobs_change: int = 0
    pending_interviews: int = 0
    pending_interviews_change: int = 0
    completed_today: int = 0
    completed_today_change: int = 0
    average_score: float = 0.0
    shortlist_rate: float = 0.0


class CandidateAnalytics(BaseModel):
    candidate_id: str
    candidate_name: str
    job_title: str
    ats_score: float
    assessment_score: Optional[float] = None
    interview_score: Optional[float] = None
    interview_status: InterviewStatus
    technical_score: Optional[float] = None  # from interview
    overall_score: Optional[float] = None    # from interview
    recommendation: Optional[HireRecommendation] = None
    shortlisted: Optional[bool] = None
    final_status: Optional[str] = None  # from job_applications (accepted, offer_sent, etc.)


# ============== API Responses ==============

class APIResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None


class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    page_size: int
    total_pages: int
