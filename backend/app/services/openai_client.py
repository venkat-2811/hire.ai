import json
import re
from typing import Optional, Dict, Any, List
from openai import AsyncOpenAI
from app.config import get_settings
from app.prompts import (
    STRICT_JSON_INSTRUCTION,
    get_analyze_resume_prompt,
    get_screen_candidate_prompt,
    get_interview_questions_general_prompt,
    get_evaluate_response_prompt,
    get_generate_practical_assessment_prompt,
    get_evaluate_practical_submission_prompt
)


class OpenAIService:
    """Centralized OpenAI API client for all AI operations.
    
    Internally uses OpenAI with model gpt-4.1-mini-2025-04-14.
    """
    
    def __init__(self):
        settings = get_settings()
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is not set")
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)
        self._model_name = "gpt-4.1-mini-2025-04-14"

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
        """Generate text completion using OpenAI."""
        messages: List[Dict[str, str]] = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        try:
            response = await self.client.chat.completions.create(
                model=self._model_name,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            text = response.choices[0].message.content
            if text and text.strip():
                return text.strip()
            raise RuntimeError("OpenAI returned empty response")
        except Exception as e:
            print(f"OpenAI API error: {e}")
            raise
    
    async def generate_json(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 4096,
        raise_on_error: bool = False,
    ) -> Dict[str, Any]:
        """Generate and parse JSON response from OpenAI."""
        json_instruction = STRICT_JSON_INSTRUCTION
        full_system = f"{system_instruction}\n\n{json_instruction}" if system_instruction else json_instruction

        messages: List[Dict[str, str]] = []
        if full_system:
            messages.append({"role": "system", "content": full_system})
        messages.append({"role": "user", "content": prompt})

        try:
            response = await self.client.chat.completions.create(
                model=self._model_name,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                response_format={"type": "json_object"}
            )
            text = response.choices[0].message.content
            
            if not text:
                return {}
            
            return json.loads(text.strip())
        except Exception as e:
            if raise_on_error:
                raise RuntimeError(f"Failed to parse OpenAI JSON response: {e}")
            print(f"JSON api or parse error: {e}")
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
_openai_service: Optional[OpenAIService] = None


def get_openai_service() -> OpenAIService:
    """Get or create OpenAI service instance."""
    global _openai_service
    if _openai_service is None:
        _openai_service = OpenAIService()
    return _openai_service
