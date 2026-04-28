import json
import re
from typing import Optional, Dict, Any, List
import httpx
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


class GroqService:
    """Centralized Groq API client for all AI operations."""
    
    def __init__(self):
        settings = get_settings()
        if not settings.groq_api_key:
            raise RuntimeError("GROQ_API_KEY is not set")
        self.api_key = settings.groq_api_key
        self.base_url = "https://api.groq.com/openai/v1/chat/completions"
        self._model_name = "llama-3.1-8b-instant"

    @property
    def model_name(self) -> str:
        return self._model_name

    async def _chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float,
        max_tokens: int,
        require_json: bool = False,
        retries: int = 2,
        timeout_seconds: float = 20.0,
    ) -> str:
        """Call Groq chat completions API with retries and timeout."""
        last_error: Optional[Exception] = None

        for attempt in range(retries + 1):
            try:
                payload: Dict[str, Any] = {
                    "model": self._model_name,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                }
                if require_json:
                    payload["response_format"] = {"type": "json_object"}

                async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                    response = await client.post(
                        self.base_url,
                        headers={
                            "Authorization": f"Bearer {self.api_key}",
                            "Content-Type": "application/json",
                        },
                        json=payload,
                    )
                    response.raise_for_status()

                data = response.json()
                text = ((data.get("choices") or [{}])[0].get("message") or {}).get("content")
                text = (text or "").strip()
                if not text:
                    raise RuntimeError("Groq returned empty response")
                return text
            except Exception as e:
                last_error = e
                if attempt >= retries:
                    break

        raise RuntimeError(f"Groq API error: {last_error}")

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
            return await self._chat_completion(
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                require_json=False,
            )
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
        json_instruction = STRICT_JSON_INSTRUCTION
        full_system = f"{system_instruction}\n\n{json_instruction}" if system_instruction else json_instruction

        messages: List[Dict[str, str]] = []
        if full_system:
            messages.append({"role": "system", "content": full_system})
        messages.append({"role": "user", "content": prompt})

        try:
            text = await self._chat_completion(
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                require_json=True,
            )

            if not text:
                return {}

            try:
                return json.loads(text.strip())
            except Exception:
                # Extract JSON from fenced code / noisy response
                json_match = re.search(r"```json\s*([\s\S]*?)\s*```", text) or re.search(r"```\s*([\s\S]*?)\s*```", text)
                if json_match:
                    text = json_match.group(1).strip()

                array_match = re.search(r"\[\s*\{[\s\S]*\}\s*\]", text)
                object_match = re.search(r"\{[\s\S]*\}", text)
                if array_match:
                    text = array_match.group(0)
                elif object_match:
                    text = object_match.group(0)

                return json.loads(text.strip())
        except Exception as e:
            if raise_on_error:
                raise RuntimeError(f"Failed to parse Groq JSON response: {e}")
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
_groq_service: Optional[GroqService] = None


def get_groq_service() -> GroqService:
    """Get or create Groq service instance."""
    global _groq_service
    if _groq_service is None:
        _groq_service = GroqService()
    return _groq_service
