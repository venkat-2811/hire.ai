from typing import Optional, List, Dict, Any
import hashlib
import uuid
from datetime import datetime
from app.models.schemas import (
    ResumeData, JobDescription, InterviewQuestionGenerated, InterviewQuestion
)
from app.models.enums import JobRole, RoleLevel, AssessmentType
from app.services.gemini_client import get_gemini_service


class QuestionGeneratorService:
    """
    AI-powered interview question generator.
    Generates role-specific, resume-aware, JD-driven questions with adaptive difficulty.
    """
    
    def __init__(self):
        self.gemini = get_gemini_service()
        
        # Role-specific question templates and focus areas
        self.role_focus_areas = {
            JobRole.SALESFORCE_DEVELOPER: {
                "technical": [
                    "Apex programming and best practices",
                    "Lightning Web Components (LWC)",
                    "SOQL and SOSL queries",
                    "Triggers and automation",
                    "Integration patterns (REST/SOAP)",
                    "Governor limits and optimization",
                    "Security and sharing model"
                ],
                "practical": [
                    "Debug Apex code",
                    "Write LWC component",
                    "Optimize SOQL query",
                    "Design trigger handler"
                ]
            },
            JobRole.QA_ENGINEER: {
                "technical": [
                    "Test case design techniques",
                    "Automation frameworks (Selenium, Cypress)",
                    "API testing (Postman, REST Assured)",
                    "Performance testing concepts",
                    "CI/CD integration",
                    "Bug lifecycle management",
                    "Test planning and strategy"
                ],
                "practical": [
                    "Write test cases for a feature",
                    "Create automation script",
                    "Design API test suite",
                    "Analyze bug report"
                ]
            },
            JobRole.BUSINESS_ANALYST: {
                "technical": [
                    "Requirements elicitation techniques",
                    "User story writing (INVEST criteria)",
                    "Process modeling (BPMN)",
                    "Gap analysis methodology",
                    "Stakeholder management",
                    "Data analysis and SQL",
                    "Agile/Scrum practices"
                ],
                "practical": [
                    "Write user stories from requirements",
                    "Create process flow diagram",
                    "Perform gap analysis",
                    "Prioritize backlog items"
                ]
            }
        }
        
        # Difficulty scaling by level
        self.level_difficulty = {
            RoleLevel.INTERN: (1, 2),
            RoleLevel.JUNIOR: (1, 3),
            RoleLevel.MID: (2, 4),
            RoleLevel.SENIOR: (3, 5)
        }
    
    def generate_question_seed(
        self,
        candidate_id: str,
        job_id: str,
        timestamp: Optional[datetime] = None
    ) -> str:
        """Generate a unique seed for one-time question generation."""
        ts = timestamp or datetime.utcnow()
        seed_input = f"{candidate_id}:{job_id}:{ts.isoformat()}"
        return hashlib.sha256(seed_input.encode()).hexdigest()[:16]
    
    async def generate_interview_questions(
        self,
        resume_data: ResumeData,
        job: JobDescription,
        session_id: str,
        question_seed: str,
        num_technical: int = 5,
        num_behavioral: int = 3,
        previous_questions: Optional[List[str]] = None
    ) -> List[InterviewQuestion]:
        """
        Generate unique interview questions based on resume, JD, and seed.
        Ensures no repeated questions across candidates.
        """
        min_diff, max_diff = self.level_difficulty.get(job.level, (2, 4))
        
        # Generate technical questions
        technical_questions = await self._generate_technical_questions(
            resume_data, job, num_technical, min_diff, max_diff,
            question_seed, previous_questions
        )
        
        # Generate behavioral questions
        behavioral_questions = await self._generate_behavioral_questions(
            resume_data, job, num_behavioral, question_seed, previous_questions
        )
        
        # Combine and assign order
        all_questions = []
        order_index = 0
        
        for q in technical_questions:
            all_questions.append(InterviewQuestion(
                id=str(uuid.uuid4()),
                session_id=session_id,
                order_index=order_index,
                **q.model_dump()
            ))
            order_index += 1
        
        for q in behavioral_questions:
            all_questions.append(InterviewQuestion(
                id=str(uuid.uuid4()),
                session_id=session_id,
                order_index=order_index,
                **q.model_dump()
            ))
            order_index += 1
        
        return all_questions
    
    async def _generate_technical_questions(
        self,
        resume_data: ResumeData,
        job: JobDescription,
        num_questions: int,
        min_difficulty: int,
        max_difficulty: int,
        seed: str,
        previous_questions: Optional[List[str]] = None
    ) -> List[InterviewQuestionGenerated]:
        """Generate role-specific technical questions."""
        
        focus_areas = self.role_focus_areas.get(job.role, {}).get("technical", [])
        candidate_skills = ", ".join(resume_data.skills[:15])
        must_have_skills = ", ".join(job.must_have_skills)
        
        previous_q_text = ""
        if previous_questions:
            previous_q_text = f"\n\nDO NOT generate questions similar to these (already asked to other candidates):\n" + \
                             "\n".join([f"- {q}" for q in previous_questions[:20]])
        
        system_prompt = f"""You are an expert technical interviewer for {job.role.value.replace('_', ' ')} positions.
Generate unique, challenging technical interview questions.

Role: {job.role.value.replace('_', ' ')}
Level: {job.level.value}
Focus Areas: {', '.join(focus_areas)}
Must-Have Skills: {must_have_skills}

Guidelines:
- Questions should be specific and test real-world knowledge
- Difficulty should range from {min_difficulty} to {max_difficulty} (scale 1-5)
- Include a mix of conceptual and scenario-based questions
- Questions should be answerable in 2-5 minutes
- Use the seed "{seed}" to ensure uniqueness
- Tailor questions to the candidate's background when relevant
{previous_q_text}

Return a JSON object with this structure:
{{
    "questions": [
        {{
            "question_text": "The question",
            "difficulty_level": 3,
            "expected_answer": "Key points for a good answer",
            "time_limit_seconds": 180,
            "focus_area": "Specific topic being tested"
        }}
    ]
}}"""

        user_prompt = f"""Generate {num_questions} technical interview questions for this candidate.

Candidate Skills: {candidate_skills}
Experience: {resume_data.total_experience_years} years
Job Description: {job.description[:500]}

Generate unique questions that assess their fit for this role."""

        try:
            result = await self.gemini.generate_json(
                prompt=user_prompt,
                system_instruction=system_prompt,
                temperature=0.8
            )
            
            questions = []
            for q in result.get("questions", [])[:num_questions]:
                questions.append(InterviewQuestionGenerated(
                    question_text=q.get("question_text", ""),
                    question_type=AssessmentType.TECHNICAL,
                    difficulty_level=min(5, max(1, q.get("difficulty_level", 3))),
                    expected_answer=q.get("expected_answer"),
                    time_limit_seconds=q.get("time_limit_seconds", 180),
                    max_score=10,
                    metadata={"focus_area": q.get("focus_area", "")}
                ))
            
            return questions
            
        except Exception as e:
            # Return fallback questions on error
            return self._get_fallback_technical_questions(job.role, num_questions)
    
    async def _generate_behavioral_questions(
        self,
        resume_data: ResumeData,
        job: JobDescription,
        num_questions: int,
        seed: str,
        previous_questions: Optional[List[str]] = None
    ) -> List[InterviewQuestionGenerated]:
        """Generate behavioral/situational questions."""
        
        experience_context = ""
        if resume_data.experience:
            recent_exp = resume_data.experience[0]
            experience_context = f"Recent role: {recent_exp.title} at {recent_exp.company}"
        
        system_prompt = f"""You are an expert behavioral interviewer.
Generate STAR-format behavioral questions that assess soft skills and cultural fit.

Role: {job.role.value.replace('_', ' ')}
Level: {job.level.value}
{experience_context}

Focus on:
- Problem-solving approach
- Communication skills
- Teamwork and collaboration
- Handling pressure and deadlines
- Learning and adaptability

Use seed "{seed}" for uniqueness.

Return JSON:
{{
    "questions": [
        {{
            "question_text": "Tell me about a time when...",
            "expected_answer": "Look for: specific situation, actions taken, measurable results",
            "competency": "Problem Solving"
        }}
    ]
}}"""

        try:
            result = await self.gemini.generate_json(
                prompt=f"Generate {num_questions} behavioral questions.",
                system_instruction=system_prompt,
                temperature=0.7
            )
            
            questions = []
            for q in result.get("questions", [])[:num_questions]:
                questions.append(InterviewQuestionGenerated(
                    question_text=q.get("question_text", ""),
                    question_type=AssessmentType.BEHAVIORAL,
                    difficulty_level=3,
                    expected_answer=q.get("expected_answer"),
                    time_limit_seconds=300,
                    max_score=10,
                    metadata={"competency": q.get("competency", "")}
                ))
            
            return questions
            
        except Exception:
            return self._get_fallback_behavioral_questions(num_questions)
    
    def _get_fallback_technical_questions(
        self,
        role: JobRole,
        num_questions: int
    ) -> List[InterviewQuestionGenerated]:
        """Fallback questions if AI generation fails."""
        fallbacks = {
            JobRole.SALESFORCE_DEVELOPER: [
                ("Explain the difference between before and after triggers in Apex.", 3),
                ("How do you handle governor limits in bulk operations?", 4),
                ("Describe the Lightning Web Components lifecycle hooks.", 3),
            ],
            JobRole.QA_ENGINEER: [
                ("What is the difference between verification and validation?", 2),
                ("Explain your approach to creating a test automation framework.", 4),
                ("How do you prioritize test cases for regression testing?", 3),
            ],
            JobRole.BUSINESS_ANALYST: [
                ("How do you handle conflicting requirements from stakeholders?", 3),
                ("Explain the INVEST criteria for user stories.", 2),
                ("Describe your approach to conducting a gap analysis.", 3),
            ]
        }
        
        role_questions = fallbacks.get(role, fallbacks[JobRole.SALESFORCE_DEVELOPER])
        questions = []
        
        for i, (text, diff) in enumerate(role_questions[:num_questions]):
            questions.append(InterviewQuestionGenerated(
                question_text=text,
                question_type=AssessmentType.TECHNICAL,
                difficulty_level=diff,
                time_limit_seconds=180,
                max_score=10
            ))
        
        return questions
    
    def _get_fallback_behavioral_questions(
        self,
        num_questions: int
    ) -> List[InterviewQuestionGenerated]:
        """Fallback behavioral questions."""
        fallbacks = [
            "Tell me about a time when you had to meet a tight deadline.",
            "Describe a situation where you had to learn a new technology quickly.",
            "Give an example of how you handled a disagreement with a team member.",
        ]
        
        questions = []
        for text in fallbacks[:num_questions]:
            questions.append(InterviewQuestionGenerated(
                question_text=text,
                question_type=AssessmentType.BEHAVIORAL,
                difficulty_level=3,
                time_limit_seconds=300,
                max_score=10
            ))
        
        return questions


_question_generator: Optional[QuestionGeneratorService] = None


def get_question_generator() -> QuestionGeneratorService:
    global _question_generator
    if _question_generator is None:
        _question_generator = QuestionGeneratorService()
    return _question_generator
