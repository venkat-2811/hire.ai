import google.generativeai as genai
import asyncio
import json
from typing import Optional, Dict, Any, List
from app.config import get_settings


class GeminiService:
    """Centralized Gemini API client for all AI operations."""
    
    def __init__(self):
        settings = get_settings()
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not set")
        genai.configure(api_key=settings.gemini_api_key)

        # Some API keys/regions only expose a subset of models under the v1beta API.
        # We'll start with a preferred model, but fall back automatically if it isn't available.
        self._model_candidates = [
            "gemini-1.5-flash",
            "gemini-1.5-flash-latest",
            "gemini-1.5-pro",
            "gemini-1.0-pro",
            "gemini-pro",
            "gemini-2.5-flash",
        ]
        self._model_name = self._model_candidates[0]
        self.model = genai.GenerativeModel(self._model_name)

    @property
    def model_name(self) -> str:
        return self._model_name

    def _set_model(self, model_name: str) -> None:
        self._model_name = model_name
        self.model = genai.GenerativeModel(model_name)

    def _unique_model_list(self) -> List[str]:
        ordered: List[str] = []
        for name in [self._model_name, *self._model_candidates]:
            if name and name not in ordered:
                ordered.append(name)
        return ordered

    def _should_try_fallback(self, err: Exception) -> bool:
        msg = str(err)
        return (
            "is not found" in msg
            or "not supported for generateContent" in msg
            or "404" in msg
        )

    def _get_generate_content_models_sync(self) -> List[str]:
        models = []
        for m in genai.list_models():
            # supported_generation_methods can be missing depending on client version
            methods = getattr(m, "supported_generation_methods", None) or []
            if "generateContent" in methods:
                # m.name is typically like: models/gemini-1.0-pro
                models.append(getattr(m, "name", ""))
        return [m for m in models if m]

    def _generate_content_sync(
        self,
        full_prompt: str,
        temperature: float,
        max_tokens: int,
    ):
        return self.model.generate_content(
            full_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=temperature,
                max_output_tokens=max_tokens,
            ),
        )

    def _extract_text_from_response(self, response: Any) -> str:
        def _get(obj: Any, key: str, default: Any = None) -> Any:
            if isinstance(obj, dict):
                return obj.get(key, default)
            return getattr(obj, key, default)

        # The google-generativeai SDK provides response.text, but it can raise if
        # no valid text Part was returned. Extract parts defensively.
        parts_text: List[str] = []

        candidates = _get(response, "candidates", None) or []
        for c in candidates:
            content = _get(c, "content", None)
            parts = _get(content, "parts", None) or []
            for p in parts:
                txt = _get(p, "text", None)
                if txt:
                    parts_text.append(txt)

        if parts_text:
            return "".join(parts_text).strip()

        # Fall back to the quick accessor only if it doesn't throw.
        try:
            txt = _get(response, "text", None)
            if isinstance(txt, str) and txt.strip():
                return txt.strip()
        except Exception:
            pass

        return ""

    def _response_finish_reason(self, response: Any) -> Optional[Any]:
        candidates = getattr(response, "candidates", None) or []
        if not candidates:
            return None
        c0 = candidates[0]
        if isinstance(c0, dict):
            return c0.get("finish_reason")
        return getattr(c0, "finish_reason", None)

    def _prompt_feedback_block_reason(self, response: Any) -> Optional[Any]:
        pf = getattr(response, "prompt_feedback", None)
        if pf is None:
            return None
        if isinstance(pf, dict):
            return pf.get("block_reason")
        return getattr(pf, "block_reason", None)
    
    async def generate_text(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096
    ) -> str:
        """Generate text completion using Gemini."""
        # Combine system instruction with prompt if provided
        full_prompt = prompt
        if system_instruction:
            full_prompt = f"{system_instruction}\n\n{prompt}"

        last_error: Optional[Exception] = None
        tried_dynamic = False

        for candidate in self._unique_model_list():
            if candidate != self._model_name:
                self._set_model(candidate)

            try:
                response = await asyncio.to_thread(
                    self._generate_content_sync,
                    full_prompt,
                    temperature,
                    max_tokens,
                )
                extracted = self._extract_text_from_response(response)
                if extracted:
                    return extracted

                finish_reason = self._response_finish_reason(response)
                block_reason = self._prompt_feedback_block_reason(response)
                raise RuntimeError(
                    f"Gemini returned empty response (finish_reason={finish_reason}, block_reason={block_reason})"
                )
            except Exception as e:
                last_error = e
                if not self._should_try_fallback(e):
                    print(f"Gemini API error: {e}")
                    raise

        # If the common model names don't work, dynamically discover available models.
        if last_error and self._should_try_fallback(last_error) and not tried_dynamic:
            tried_dynamic = True
            try:
                dynamic_models = await asyncio.to_thread(self._get_generate_content_models_sync)
            except Exception as e:
                dynamic_models = []
                last_error = e

            for model_name in dynamic_models:
                try:
                    # list_models returns names like "models/gemini-1.0-pro"; try both forms.
                    for candidate_name in [model_name, model_name.replace("models/", "", 1)]:
                        if not candidate_name:
                            continue
                        self._set_model(candidate_name)
                        response = await asyncio.to_thread(
                            self._generate_content_sync,
                            full_prompt,
                            temperature,
                            max_tokens,
                        )
                        extracted = self._extract_text_from_response(response)
                        if extracted:
                            return extracted

                        finish_reason = self._response_finish_reason(response)
                        block_reason = self._prompt_feedback_block_reason(response)
                        raise RuntimeError(
                            f"Gemini returned empty response (finish_reason={finish_reason}, block_reason={block_reason})"
                        )
                except Exception as e:
                    last_error = e
                    if not self._should_try_fallback(e):
                        print(f"Gemini API error: {e}")
                        raise

        print(f"Gemini API error: {last_error}")
        raise last_error or RuntimeError("Gemini API error")
    
    async def generate_json(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        temperature: float = 0.3
    ) -> Dict[str, Any]:
        """Generate and parse JSON response from Gemini."""
        json_instruction = """
You must respond with valid JSON only. No markdown, no code blocks, no explanation.
Just the raw JSON object.
"""
        full_system = f"{system_instruction}\n\n{json_instruction}" if system_instruction else json_instruction
        
        response_text = await self.generate_text(
            prompt=prompt,
            system_instruction=full_system,
            temperature=temperature
        )
        
        # Clean up response - remove markdown code blocks if present
        cleaned = response_text.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            print(f"JSON parse error: {e}")
            print(f"Response was: {response_text[:500]}")
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
    """Get or create Gemini service instance."""
    global _gemini_service
    if _gemini_service is None:
        _gemini_service = GeminiService()
    return _gemini_service
