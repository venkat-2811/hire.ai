from groq import Groq
import asyncio
import json
import re
from typing import Optional, Dict, Any, List
from app.config import get_settings
from app.prompts import (
    get_analyze_resume_prompt,
    get_screen_candidate_prompt
)
from app.assessment_prompts import (
    get_interview_questions_general_prompt,
    get_evaluate_response_prompt,
    get_generate_practical_assessment_prompt,
    get_evaluate_practical_submission_prompt
)


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
        system_instruction, prompt = get_analyze_resume_prompt(resume_text)
        return await self.generate_json(prompt, system_instruction)
    
    async def screen_candidate(
        self,
        resume_data: Dict[str, Any],
        job_description: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Screen candidate against job requirements."""
        system_instruction, prompt = get_screen_candidate_prompt(job_description, resume_data)
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
        system_instruction, prompt = get_interview_questions_general_prompt(job_description, resume_data, num_technical, num_behavioral, difficulty)
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
        system_instruction, prompt = get_evaluate_response_prompt(question, question_type, expected_answer, candidate_response)
        return await self.generate_json(prompt, system_instruction)
    
    async def generate_practical_assessment(
        self,
        job_role: str,
        level: str,
        skills: List[str]
    ) -> Dict[str, Any]:
        """Generate a practical coding/design assessment."""
        system_instruction, prompt = get_generate_practical_assessment_prompt(job_role, level, skills)
        return await self.generate_json(prompt, system_instruction)
    
    async def evaluate_practical_submission(
        self,
        assessment: Dict[str, Any],
        submission: str
    ) -> Dict[str, Any]:
        """Evaluate a practical assessment submission."""
        system_instruction, prompt = get_evaluate_practical_submission_prompt(assessment, submission)
        return await self.generate_json(prompt, system_instruction)


# Singleton instance
_gemini_service: Optional[GeminiService] = None


def get_gemini_service() -> GeminiService:
    """Get or create Groq service instance."""
    global _gemini_service
    if _gemini_service is None:
        _gemini_service = GeminiService()
    return _gemini_service
