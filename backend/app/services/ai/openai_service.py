from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional

from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.services.openai_client import OpenAIService


class OpenAIWrapper:
    """Foundation wrapper around existing OpenAIService.

    Keeps current behavior intact while providing a stable abstraction
    for future endpoint migrations.
    """

    def __init__(self, client: OpenAIService):
        self._client = client

    @property
    def model_name(self) -> str:
        return getattr(self._client, "model_name", "")

    @retry(
        reraise=True,
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=6),
        retry=retry_if_exception_type(Exception),
    )
    async def generate_text(
        self,
        prompt: str,
        *,
        system_instruction: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        timeout_s: int = 25,
    ) -> str:
        return await asyncio.wait_for(
            self._client.generate_text(
                prompt=prompt,
                system_instruction=system_instruction,
                temperature=temperature,
                max_tokens=max_tokens,
            ),
            timeout=timeout_s,
        )

    @retry(
        reraise=True,
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=6),
        retry=retry_if_exception_type(Exception),
    )
    async def generate_json(
        self,
        prompt: str,
        *,
        system_instruction: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 4096,
        timeout_s: int = 25,
    ) -> Dict[str, Any]:
        return await asyncio.wait_for(
            self._client.generate_json(
                prompt=prompt,
                system_instruction=system_instruction,
                temperature=temperature,
                max_tokens=max_tokens,
                raise_on_error=True,
            ),
            timeout=timeout_s,
        )
