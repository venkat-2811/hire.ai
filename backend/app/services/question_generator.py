from typing import Optional, List, Dict, Any
import hashlib
import uuid
from datetime import datetime
from app.models.schemas import (
    ResumeData, JobDescription, InterviewQuestionGenerated, InterviewQuestion
)
from app.models.enums import RoleLevel, AssessmentType
from app.services.gemini_client import get_gemini_service


class QuestionGeneratorService:
    """
    AI-powered interview question generator.
    Generates role-specific, resume-aware, JD-driven questions with adaptive difficulty.
    """
    
    def __init__(self):
        self.gemini = get_gemini_service()
        
        
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
        
        candidate_skills = ", ".join(resume_data.skills[:15])
        must_have_skills = ", ".join(job.must_have_skills)
        good_to_have_skills = ", ".join(job.good_to_have_skills)
        
        previous_q_text = ""
        if previous_questions:
            previous_q_text = f"\n\nDO NOT generate questions similar to these (already asked to other candidates):\n" + \
                             "\n".join([f"- {q}" for q in previous_questions[:20]])
        
        system_prompt = f"""You are an expert technical interviewer for {job.role.replace('_', ' ')} positions.
Generate unique, challenging technical interview questions based strictly on the Job Description and Skills provided.

Role: {job.role.replace('_', ' ')}
Level: {job.level.value}
Job Description Summary: {job.description[:800]}
Must-Have Skills: {must_have_skills}
Good-to-Have Skills: {good_to_have_skills}

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

Role: {job.role.replace('_', ' ')}
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
    
    async def generate_mcq_questions(
        self,
        job: JobDescription,
        count: int = 20
    ) -> List[dict]:
        """Generate MCQ questions for technical assessment based on job description."""
        
        must_have_skills = ", ".join(job.must_have_skills)
        good_to_have_skills = ", ".join(job.good_to_have_skills)
        
        system_prompt = f"""You are creating a multiple-choice technical assessment for a {job.role} position at {job.level} level.

Job Description: {job.description[:800]}
Must-Have Skills: {must_have_skills}
Good-to-Have Skills: {good_to_have_skills}

Generate {count} multiple-choice questions that:
- Test practical knowledge of the required skills
- Bias toward hard difficulty with advanced concepts, edge cases, and tradeoffs
- Have 4 options each with exactly ONE correct answer
- Use plausible distractors that reflect common pitfalls
- Are specific to this role and level
- Cover a variety of topics from the job description

Return a JSON object:
{{
    "questions": [
        {{
            "question": "Question text here",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct_index": 0,
            "difficulty": "easy|medium|hard",
            "topic": "Topic name",
            "points": 5
        }}
    ]
}}"""

        try:
            result = await self.gemini.generate_json(
                prompt=f"Generate {count} MCQ questions for this {job.role} position.",
                system_instruction=system_prompt,
                temperature=0.7,
                max_tokens=8192,
                raise_on_error=True,
            )
            
            questions = []
            for q in result.get("questions", [])[:count]:
                options = q.get("options", [])
                if not isinstance(options, list):
                    options = []
                options = [str(o) for o in options][:4]
                if len(options) != 4:
                    continue

                correct_index = q.get("correct_index", 0)
                try:
                    correct_index = int(correct_index)
                except Exception:
                    correct_index = 0
                if correct_index < 0 or correct_index > 3:
                    correct_index = 0

                questions.append({
                    "id": str(uuid.uuid4()),
                    "question": q.get("question", ""),
                    "options": options,
                    "correct_index": correct_index,
                    "difficulty": q.get("difficulty", "medium"),
                    "topic": q.get("topic", "General"),
                    "points": q.get("points", 5),
                })
            
            if not questions:
                raise RuntimeError("Groq returned no valid MCQ questions")

            return questions
            
        except Exception as e:
            print(f"Error generating MCQ questions: {e}")
            # Return generic fallback questions
            return self._get_fallback_mcq_questions(count)
    
    async def generate_coding_challenges(
        self,
        job: JobDescription,
        count: int = 2
    ) -> List[dict]:
        """Generate coding challenges for practical assessment."""
        
        must_have_skills = ", ".join(job.must_have_skills)
        
        system_prompt = f"""You are creating coding challenges for a {job.role} position at {job.level} level.

Job Description: {job.description[:800]}
Key Skills: {must_have_skills}

Generate {count} coding challenges that:
- Test practical coding ability relevant to this role
- Are on the harder end of the level with nuanced edge cases
- Are solvable in 20-35 minutes each
- Include clear problem descriptions
- Provide starter code templates
- STRICT REQUIREMENT: You MUST provide a `test_cases` array with at least 3 diverse test cases (including edge cases).
- `input` must be a JSON object mapping Python argument names to values.
- `expected` must be the expected direct return value.
- Emphasize advanced reasoning within {job.level}

Return JSON:
{{
    "challenges": [
        {{
            "title": "Challenge Title",
            "description": "Detailed problem description with examples",
            "starter_code": "def solution(arg1):\\n    pass",
            "test_cases": [
                {{"input": {{"arg1": "value"}}, "expected": "result"}},
                {{"input": {{"arg1": "edge_case"}}, "expected": "result2"}}
            ],
            "difficulty": "easy|medium|hard",
            "time_limit_minutes": 15,
            "points": 25
        }}
    ]
}}"""

        try:
            result = await self.gemini.generate_json(
                prompt=f"Generate {count} coding challenges for {job.role}.",
                system_instruction=system_prompt,
                temperature=0.7,
                max_tokens=8192,
                raise_on_error=True,
            )
            
            challenges = []
            for c in result.get("challenges", [])[:count]:
                test_cases = c.get("test_cases", [])
                if not isinstance(test_cases, list):
                    test_cases = []
                challenges.append({
                    "id": str(uuid.uuid4()),
                    "title": c.get("title", ""),
                    "description": c.get("description", ""),
                    "starter_code": c.get("starter_code", ""),
                    "test_cases": test_cases,
                    "difficulty": c.get("difficulty", "medium"),
                    "time_limit_minutes": c.get("time_limit_minutes", 20),
                    "points": c.get("points", 25),
                })
            
            if not challenges:
                raise RuntimeError("Groq returned no coding challenges")

            return challenges
            
        except Exception as e:
            print(f"Error generating coding challenges: {e}")
            return self._get_fallback_coding_challenges(count)
    
    def _get_fallback_mcq_questions(self, count: int) -> List[dict]:
        """Fallback MCQ questions if AI generation fails."""
        fallbacks = [
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
        
        # Repeat to reach count
        result = []
        while len(result) < count:
            for q in fallbacks:
                if len(result) >= count:
                    break
                result.append(q.copy())
        
        return result[:count]
    
    def _get_fallback_coding_challenges(self, count: int) -> List[dict]:
        """Fallback coding challenges if AI generation fails."""
        fallbacks = [
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
        
        return fallbacks[:count]
    
    def _get_fallback_technical_questions(
        self,
        role: str,
        num_questions: int
    ) -> List[InterviewQuestionGenerated]:
        """Fallback questions if AI generation fails."""
        # Since we don't have hardcoded roles anymore, we return generic technical questions 
        # that fit most software/business roles, or we could try to infer from role string, 
        # but for safety we use broad categories.
        
        generic_fallbacks = [
            ("Describe a challenging technical problem you solved recently.", 3),
            ("How do you stay updated with the latest trends in your field?", 2),
            ("Explain a complex concept to someone without a technical background.", 3),
            ("How do you ensure quality in your work?", 3),
            ("Describe your workflow when starting a new project.", 2)
        ]
        
        # Try to give slightly more specific fallbacks if standard roles match strings
        role_lower = role.lower()
        if "salesforce" in role_lower:
             generic_fallbacks = [
                ("Explain the difference between before and after triggers in Apex.", 3),
                ("How do you handle governor limits?", 4),
                ("Describe the LWC lifecycle.", 3),
            ]
        elif "qa" in role_lower or "test" in role_lower:
             generic_fallbacks = [
                ("Difference between verification and validation?", 2),
                ("How do you prioritize test cases?", 3),
                ("Explain your bug reporting process.", 3),
            ]
        
        role_questions = generic_fallbacks
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
