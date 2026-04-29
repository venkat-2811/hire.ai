from typing import Optional, List, Dict, Any
import hashlib
import uuid
import random
from datetime import datetime
from app.models.schemas import (
    ResumeData, JobDescription, InterviewQuestionGenerated, InterviewQuestion
)
from app.models.enums import RoleLevel, AssessmentType
from app.services.openai_client import get_openai_service
from app.prompts import (
    get_technical_questions_prompt,
    get_behavioral_questions_prompt,
    get_mcq_generation_prompt,
    get_coding_challenges_prompt
)


class QuestionGeneratorService:
    """
    AI-powered interview question generator.
    Generates role-specific, resume-aware, JD-driven questions with adaptive difficulty.
    """
    
    def __init__(self):
        self.openai = get_openai_service()
        
        
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
        
        system_prompt, user_prompt = get_technical_questions_prompt(
            role=job.role.replace('_', ' '),
            level=job.level.value,
            description=job.description,
            must_have=must_have_skills,
            good_to_have=good_to_have_skills,
            min_diff=min_difficulty,
            max_diff=max_difficulty,
            seed=seed,
            previous_q_text=previous_q_text,
            candidate_skills=candidate_skills,
            experience_years=resume_data.total_experience_years,
            num_questions=num_questions
        )

        try:
            result = await self.openai.generate_json(
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
        
        system_prompt, user_prompt = get_behavioral_questions_prompt(
            role=job.role.replace('_', ' '),
            level=job.level.value,
            experience_context=experience_context,
            seed=seed,
            num_questions=num_questions
        )

        try:
            result = await self.openai.generate_json(
                prompt=user_prompt,
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
        count: int = 20,
        difficulty: str = "medium"
    ) -> List[dict]:
        """Generate MCQ questions for technical assessment based on job description.
        
        Supports 1-100 questions with quality validation and difficulty adherence.
        """
        
        # Validate count parameter
        if count < 1:
            count = 1
        elif count > 100:
            count = 100
            
        must_have_skills = ", ".join(job.must_have_skills)
        good_to_have_skills = ", ".join(job.good_to_have_skills)
        
        # Adjust token limit based on question count
        max_tokens = min(16384, 4096 + (count * 150))
        
        system_prompt, user_prompt = get_mcq_generation_prompt(
            role=job.role,
            level=job.level,
            description=job.description,
            must_have_skills=must_have_skills,
            good_to_have_skills=good_to_have_skills,
            count=count,
            difficulty=difficulty
        )

        try:
            result = await self.openai.generate_json(
                prompt=user_prompt,
                system_instruction=system_prompt,
                temperature=0.85,
                max_tokens=max_tokens,
                raise_on_error=True
            )

            questions = []
            seen_topics: set = set()  # topic-fingerprint deduplication
            generated_questions = result.get("questions", [])

            for q in generated_questions:
                if len(questions) >= count:
                    break
                question_data = self._validate_and_format_question(q, difficulty)
                if not question_data:
                    continue
                # Near-duplicate topic check
                fingerprint = self._topic_fingerprint(question_data['question'])
                if fingerprint and fingerprint in seen_topics:
                    continue
                seen_topics.add(fingerprint)
                questions.append(question_data)

            if len(questions) != count:
                raise RuntimeError(
                    f"Failed to generate required MCQ count: generated {len(questions)}, requested {count}"
                )

            print(f"Successfully generated {len(questions)} MCQ questions out of {count} requested")
            return questions

        except Exception as e:
            print(f"Error generating MCQ questions: {e}")
            raise RuntimeError("MCQ generation failed") from e
    
    def _topic_fingerprint(self, text: str) -> str:
        """Extract a normalised topic key for near-duplicate detection."""
        stop_words = {
            'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
            'should', 'may', 'might', 'must', 'can', 'to', 'of', 'in', 'for',
            'on', 'with', 'at', 'by', 'from', 'as', 'into', 'about', 'your',
            'this', 'that', 'which', 'what', 'when', 'where', 'how', 'why',
            'if', 'or', 'and', 'but', 'not', 'no', 'so', 'than', 'then',
            'its', 'it', 'you',
        }
        import re
        words = re.sub(r'[^a-z0-9\s]', ' ', text.lower()).split()
        keywords = [w for w in words if len(w) > 2 and w not in stop_words][:8]
        return ' '.join(keywords)

    def _validate_and_format_question(self, question_data: dict, target_difficulty: str) -> dict:
        """Validate, format, and shuffle options for a single MCQ question.

        The correct answer is identified by label (A/B/C/D) when the LLM provides
        'correct_answer_label', falling back to 'correct_index' otherwise.
        Options are then shuffled randomly so the correct answer is not always at
        index 0 (the LLM's default bias).
        """
        try:
            # Validate and deduplicate options
            options = question_data.get("options", [])
            if not isinstance(options, list) or len(options) != 4:
                return None

            formatted_options = []
            seen_options: set = set()
            for opt in options[:4]:
                opt_str = str(opt).strip()
                if opt_str and opt_str not in seen_options:
                    formatted_options.append(opt_str)
                    seen_options.add(opt_str)

            if len(formatted_options) != 4:
                return None

            # ── Resolve the correct answer ───────────────────────────────
            label_map = {'A': 0, 'B': 1, 'C': 2, 'D': 3}
            label = str(question_data.get('correct_answer_label', '')).strip().upper()
            if label in label_map:
                correct_index = label_map[label]
            else:
                try:
                    correct_index = int(question_data.get('correct_index', 0))
                    if correct_index < 0 or correct_index > 3:
                        correct_index = 0
                except (ValueError, TypeError):
                    correct_index = 0

            # ── Programmatic shuffle — the ONLY reliable way to randomise positions ──
            # LLMs have a strong bias toward placing the correct answer at index 0.
            correct_answer = formatted_options[correct_index]
            random.shuffle(formatted_options)
            correct_index = formatted_options.index(correct_answer)

            # Validate question text
            question_text = question_data.get("question", "").strip()
            if not question_text or len(question_text) < 10:
                return None

            # Validate difficulty
            difficulty = question_data.get("difficulty", target_difficulty)
            if difficulty not in ["easy", "medium", "hard"]:
                difficulty = target_difficulty

            # Validate points
            points = question_data.get("points", 5)
            try:
                points = int(points)
                if points < 1 or points > 20:
                    points = 5
            except (ValueError, TypeError):
                points = 5

            return {
                "id": str(uuid.uuid4()),
                "question": question_text,
                "options": formatted_options,
                "correct_index": correct_index,
                "difficulty": difficulty,
                "topic": question_data.get("topic", "General"),
                "points": points,
            }

        except Exception as e:
            print(f"Question validation failed: {e}")
            return None
    
    async def generate_coding_challenges(
        self,
        job: JobDescription,
        count: int = 2,
        difficulty: str = "medium"
    ) -> List[dict]:
        """Generate coding challenges for practical assessment."""
        
        must_have_skills = ", ".join(job.must_have_skills)
        
        system_prompt, user_prompt = get_coding_challenges_prompt(
            role=job.role,
            level=job.level,
            description=job.description,
            must_have_skills=must_have_skills,
            count=count,
            difficulty=difficulty
        )

        try:
            result = await self.openai.generate_json(
                prompt=user_prompt,
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
                raise RuntimeError("OpenAI returned no coding challenges")

            return challenges
            
        except Exception as e:
            print(f"Error generating coding challenges: {e}")
            return self._get_fallback_coding_challenges(count)
    
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
