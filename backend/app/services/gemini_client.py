from groq import Groq
import asyncio
import json
import re
from typing import Optional, Dict, Any, List
from app.config import get_settings


class GeminiService:
    """Centralized Groq API client for all AI operations.
    
    NOTE: Class name kept as GeminiService to avoid breaking imports across
    the codebase. Internally uses Groq with DeepSeek-R1-Distill-Llama-70b.
    """
    
    def __init__(self):
        settings = get_settings()
        if not settings.groq_api_key:
            raise RuntimeError("GROQ_API_KEY is not set")
        self.client = Groq(api_key=settings.groq_api_key)
        self._model_name = "DeepSeek-R1-Distill-Llama-70b"

    @property
    def model_name(self) -> str:
        return self._model_name

    async def generate_text(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096
    ) -> str:
        """Generate text completion using Groq."""
        messages: List[Dict[str, str]] = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        try:
            response = await asyncio.to_thread(
                self.client.chat.completions.create,
                model=self._model_name,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            text = response.choices[0].message.content
            if text and text.strip():
                return text.strip()
            raise RuntimeError("Groq returned empty response")
        except Exception as e:
            print(f"Groq API error: {e}")
            raise
    
    async def generate_json(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 4096,
        raise_on_error: bool = False,
    ) -> Dict[str, Any]:
        """Generate and parse JSON response from Groq."""
        json_instruction = """
You must respond with valid JSON only. No markdown, no code blocks, no explanation.
Just the raw JSON object.
"""
        full_system = f"{system_instruction}\n\n{json_instruction}" if system_instruction else json_instruction
        
        response_text = await self.generate_text(
            prompt=prompt,
            system_instruction=full_system,
            temperature=temperature,
            max_tokens=max_tokens
        )
        
        # Clean up response - remove markdown code blocks if present
        cleaned = response_text.strip()
        
        # Remove opening markdown blocks
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        
        # Remove closing markdown blocks  
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        
        cleaned = cleaned.strip()
        
        # Additional cleanup: remove any remaining backticks at start/end
        while cleaned.startswith("`"):
            cleaned = cleaned[1:]
        while cleaned.endswith("`"):
            cleaned = cleaned[:-1]
        
        cleaned = cleaned.strip()

        extracted_candidates: List[str] = []
        if cleaned:
            extracted_candidates.append(cleaned)

        first_obj = cleaned.find("{")
        last_obj = cleaned.rfind("}")
        if first_obj != -1 and last_obj != -1 and last_obj > first_obj:
            extracted_candidates.append(cleaned[first_obj : last_obj + 1])

        first_arr = cleaned.find("[")
        last_arr = cleaned.rfind("]")
        if first_arr != -1 and last_arr != -1 and last_arr > first_arr:
            extracted_candidates.append(cleaned[first_arr : last_arr + 1])

        seen = set()
        unique_candidates: List[str] = []
        for c in extracted_candidates:
            if c in seen:
                continue
            seen.add(c)
            unique_candidates.append(c)

        def _cleanup_json_like(text: str) -> str:
            t = text.strip()
            t = re.sub(r",\s*(\}|\])", r"\\1", t)
            return t.strip()
        
        last_error: Optional[Exception] = None
        for candidate in unique_candidates:
            try:
                return json.loads(_cleanup_json_like(candidate))
            except json.JSONDecodeError as e:
                last_error = e

        # If we couldn't parse anything, optionally raise to let callers fall back.
        if raise_on_error:
            raise RuntimeError(f"Failed to parse Groq JSON response: {last_error}")

        print(f"JSON parse error: {last_error}")
        print(f"Response was: {response_text}")
        # Return empty dict on parse failure
        return {}
    
    async def analyze_resume(self, resume_text: str) -> Dict[str, Any]:
        """Parse and analyze resume content."""
        system_instruction = """You are an expert resume parser and analyzer.
Extract structured information from resumes accurately."""
        
        prompt = f"""Analyze the following resume and extract information in this exact JSON format:
{{
    "skills": ["skill1", "skill2", ...],
    "experience": [
        {{
            "title": "Job Title",
            "company": "Company Name",
            "duration": "Duration string",
            "description": "Brief description",
            "start_date": "YYYY-MM or null",
            "end_date": "YYYY-MM or null"
        }}
    ],
    "education": [
        {{
            "degree": "Degree Name",
            "institution": "Institution Name",
            "year": "Graduation Year"
        }}
    ],
    "summary": "Brief professional summary",
    "contact": {{
        "email": "email or null",
        "phone": "phone or null",
        "linkedin": "linkedin url or null"
    }},
    "total_experience_years": 0.0,
    "certifications": ["cert1", "cert2", ...]
}}

Resume:
{resume_text}
"""
        return await self.generate_json(prompt, system_instruction)
    
    async def screen_candidate(
        self,
        resume_data: Dict[str, Any],
        job_description: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Screen candidate against job requirements."""
        system_instruction = """You are an expert ATS (Applicant Tracking System) that screens candidates.
Provide detailed, fair, and explainable screening results."""
        
        prompt = f"""Screen this candidate against the job requirements.

Job Requirements:
- Title: {job_description.get('title', 'N/A')}
- Role: {job_description.get('role', 'N/A')}
- Level: {job_description.get('level', 'N/A')}
- Description: {job_description.get('description', 'N/A')}
- Must Have Skills: {job_description.get('must_have_skills', [])}
- Good to Have Skills: {job_description.get('good_to_have_skills', [])}
- Min Experience: {job_description.get('min_experience_years', 0)} years

Candidate Resume Data:
{json.dumps(resume_data, indent=2)}

Provide screening results in this exact JSON format:
{{
    "overall_score": 75,
    "skill_relevance_score": 80,
    "experience_score": 70,
    "education_score": 75,
    "credibility_score": 85,
    "shortlisted": true,
    "shortlist_reason": "Reason for decision",
    "reason_codes": [
        {{
            "code": "SKILL_MATCH",
            "type": "positive",
            "description": "Has required Python skills",
            "impact": 15
        }}
    ],
    "detailed_analysis": {{
        "skill_match": [
            {{
                "skill": "Python",
                "found": true,
                "relevance": "must_have",
                "evidence": "5 years experience mentioned",
                "confidence": 0.9
            }}
        ],
        "experience_analysis": "Analysis of work experience",
        "education_analysis": "Analysis of education",
        "career_gap_analysis": "Any gaps identified",
        "credibility_flags": []
    }}
}}
"""
        return await self.generate_json(prompt, system_instruction)
    
    async def generate_interview_questions(
        self,
        job_description: Dict[str, Any],
        resume_data: Dict[str, Any],
        num_technical: int = 5,
        num_behavioral: int = 3,
        difficulty: int = 3
    ) -> List[Dict[str, Any]]:
        """Generate role-specific interview questions."""
        system_instruction = """You are an expert technical interviewer.
Generate relevant, challenging, and fair interview questions."""
        
        prompt = f"""Generate interview questions for this candidate and role.

Job:
- Title: {job_description.get('title', 'N/A')}
- Role: {job_description.get('role', 'N/A')}
- Level: {job_description.get('level', 'N/A')}
- Required Skills: {job_description.get('must_have_skills', [])}

Candidate Skills: {resume_data.get('skills', [])}
Experience Years: {resume_data.get('total_experience_years', 0)}

Generate {num_technical} technical questions and {num_behavioral} behavioral questions.
Difficulty level: {difficulty}/5

Return as JSON array:
[
    {{
        "question_text": "The question",
        "question_type": "technical",
        "difficulty_level": 3,
        "expected_answer": "Key points for ideal answer",
        "time_limit_seconds": 300,
        "max_score": 10,
        "metadata": {{"topic": "Python", "subtopic": "OOP"}}
    }}
]
"""
        result = await self.generate_json(prompt, system_instruction)
        if isinstance(result, list):
            return result
        return result.get("questions", [])
    
    async def evaluate_response(
        self,
        question: str,
        question_type: str,
        expected_answer: str,
        candidate_response: str
    ) -> Dict[str, Any]:
        """Evaluate candidate's response to a question."""
        system_instruction = """You are an expert interview evaluator.
Provide fair, detailed, and constructive feedback."""
        
        prompt = f"""Evaluate this interview response.

Question ({question_type}): {question}

Expected Answer Points: {expected_answer}

Candidate's Response: {candidate_response}

Provide evaluation in this JSON format:
{{
    "score": 7,
    "max_score": 10,
    "feedback": "Detailed feedback",
    "strengths": ["strength1", "strength2"],
    "improvements": ["area1", "area2"],
    "technical_accuracy": 0.8,
    "communication_score": 0.75,
    "completeness": 0.7
}}
"""
        return await self.generate_json(prompt, system_instruction)
    
    async def generate_practical_assessment(
        self,
        job_role: str,
        level: str,
        skills: List[str]
    ) -> Dict[str, Any]:
        """Generate a practical coding/design assessment."""
        system_instruction = """You are an expert at creating practical technical assessments.
Create realistic, fair, and skill-appropriate challenges."""
        
        prompt = f"""Create a practical assessment for:
- Role: {job_role}
- Level: {level}
- Key Skills: {skills}

Return in this JSON format:
{{
    "title": "Assessment Title",
    "description": "Detailed problem description",
    "requirements": ["req1", "req2"],
    "time_limit_minutes": 60,
    "evaluation_criteria": [
        {{"criterion": "Code Quality", "weight": 25}},
        {{"criterion": "Correctness", "weight": 35}},
        {{"criterion": "Efficiency", "weight": 20}},
        {{"criterion": "Best Practices", "weight": 20}}
    ],
    "starter_code": "# Optional starter code",
    "test_cases": ["Test case 1", "Test case 2"]
}}
"""
        return await self.generate_json(prompt, system_instruction)
    
    async def evaluate_practical_submission(
        self,
        assessment: Dict[str, Any],
        submission: str
    ) -> Dict[str, Any]:
        """Evaluate a practical assessment submission."""
        system_instruction = """You are an expert code reviewer and evaluator.
Provide thorough, fair, and constructive evaluation."""
        
        prompt = f"""Evaluate this practical assessment submission.

Assessment:
- Title: {assessment.get('title', 'N/A')}
- Description: {assessment.get('description', 'N/A')}
- Requirements: {assessment.get('requirements', [])}
- Evaluation Criteria: {assessment.get('evaluation_criteria', [])}

Candidate's Submission:
{submission}

Provide evaluation in this JSON format:
{{
    "overall_score": 75,
    "max_score": 100,
    "criteria_scores": [
        {{"criterion": "Code Quality", "score": 20, "max": 25, "feedback": "Good structure"}},
        {{"criterion": "Correctness", "score": 30, "max": 35, "feedback": "Mostly correct"}}
    ],
    "strengths": ["strength1", "strength2"],
    "improvements": ["improvement1", "improvement2"],
    "detailed_feedback": "Overall detailed feedback",
    "code_quality_notes": "Notes on code quality",
    "would_pass": true
}}
"""
        return await self.generate_json(prompt, system_instruction)


# Singleton instance
_gemini_service: Optional[GeminiService] = None


def get_gemini_service() -> GeminiService:
    """Get or create Groq service instance."""
    global _gemini_service
    if _gemini_service is None:
        _gemini_service = GeminiService()
    return _gemini_service
