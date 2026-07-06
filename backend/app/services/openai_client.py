import json
import logging
import os
import re
import time
from typing import Optional, Dict, Any, List
from openai import AsyncOpenAI
from app.config import get_settings
from app.core.llm_semaphore import llm_semaphore_context
from app.prompts import (
    STRICT_JSON_INSTRUCTION,
    get_analyze_resume_prompt,
    get_screen_candidate_prompt,
    get_interview_questions_general_prompt,
    get_evaluate_response_prompt,
    get_generate_practical_assessment_prompt,
    get_evaluate_practical_submission_prompt
)

logger = logging.getLogger(__name__)

# Timeout in seconds applied exclusively to the OpenAI HTTP call itself.
# This is independent of how long the job waited in the semaphore queue.
#
# Default: 180s — covers the worst-case MCQ generation:
#   max_tokens=16384 (100 questions), gpt-4.1-mini at ~80–120 tok/s → 120–150s
# Override via LLM_API_CALL_TIMEOUT_SECONDS.
_LLM_API_CALL_TIMEOUT = float(os.getenv("LLM_API_CALL_TIMEOUT_SECONDS", "180"))

# How long a job may wait in the semaphore queue before being abandoned.
#
# Not unlimited because during an extended OpenAI outage, jobs would queue
# indefinitely and cause a thundering herd on recovery. 600s gives any
# queued job a realistic window (10 batches × ~45s avg per slot cycle)
# while ensuring stale requests eventually shed cleanly.
# Override via LLM_SEMAPHORE_WAIT_TIMEOUT_SECONDS.
_LLM_SEMAPHORE_WAIT_TIMEOUT = float(os.getenv("LLM_SEMAPHORE_WAIT_TIMEOUT_SECONDS", "600"))


class OpenAIService:
    """Centralized OpenAI API client for all AI operations.
    
    Internally uses OpenAI with model gpt-4.1-mini.
    """
    
    def __init__(self):
        settings = get_settings()
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is not set")
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)
        self._model_name = "gpt-4.1-mini"

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

        t0 = time.perf_counter()
        try:
            async with llm_semaphore_context(wait_timeout=_LLM_SEMAPHORE_WAIT_TIMEOUT):
                response = await self.client.chat.completions.create(
                    model=self._model_name,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    timeout=_LLM_API_CALL_TIMEOUT,
                )
            text = response.choices[0].message.content
            if text and text.strip():
                logger.debug(
                    "[openai] generate_text ok duration_ms=%.0f max_tokens=%s",
                    (time.perf_counter() - t0) * 1000,
                    max_tokens,
                )
                return text.strip()
            raise RuntimeError("OpenAI returned empty response")
        except Exception as e:
            logger.error(
                "[openai] generate_text_error duration_ms=%.0f error_type=%s error=%s",
                (time.perf_counter() - t0) * 1000,
                type(e).__name__,
                str(e),
            )
            raise
    
    async def extract_text_from_images(self, base64_images: List[str]) -> str:
        """Extract text from a list of base64 encoded images using Vision."""
        messages = [
            {"role": "system", "content": "You are an expert OCR system. Extract all text from the provided images exactly as written. Do not add conversational filler. Maintain structural formatting where possible."}
        ]
        
        content = [{"type": "text", "text": "Please transcribe the text from these document pages."}]
        for b64 in base64_images:
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{b64}"}
            })
            
        messages.append({"role": "user", "content": content})
        
        t0 = time.perf_counter()
        try:
            async with llm_semaphore_context(wait_timeout=_LLM_SEMAPHORE_WAIT_TIMEOUT):
                response = await self.client.chat.completions.create(
                    model="gpt-4o-mini",  # Vision-capable model required
                    messages=messages,
                    temperature=0.1,
                    max_tokens=4000,
                    timeout=_LLM_API_CALL_TIMEOUT,
                )
            text = response.choices[0].message.content
            logger.debug(
                "[openai] vision_ocr ok duration_ms=%.0f",
                (time.perf_counter() - t0) * 1000,
            )
            return text.strip() if text else ""
        except Exception as e:
            logger.error(
                "[openai] vision_ocr_error duration_ms=%.0f error_type=%s error=%s",
                (time.perf_counter() - t0) * 1000,
                type(e).__name__,
                str(e),
            )
            return ""
    
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

        t0 = time.perf_counter()
        try:
            async with llm_semaphore_context(wait_timeout=_LLM_SEMAPHORE_WAIT_TIMEOUT):
                response = await self.client.chat.completions.create(
                    model=self._model_name,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    response_format={"type": "json_object"},
                    timeout=_LLM_API_CALL_TIMEOUT,
                )
            text = response.choices[0].message.content

            if not text:
                return {}

            parsed = json.loads(text.strip())
            logger.debug(
                "[openai] generate_json ok duration_ms=%.0f max_tokens=%s",
                (time.perf_counter() - t0) * 1000,
                max_tokens,
            )
            return parsed
        except Exception as e:
            logger.error(
                "[openai] generate_json_error duration_ms=%.0f error_type=%s error=%s raise_on_error=%s",
                (time.perf_counter() - t0) * 1000,
                type(e).__name__,
                str(e),
                raise_on_error,
            )
            if raise_on_error:
                raise RuntimeError(f"Failed to parse OpenAI JSON response: {e}")
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
