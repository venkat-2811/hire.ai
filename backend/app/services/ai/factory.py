from __future__ import annotations

from functools import lru_cache

from app.services.ai.openai_service import OpenAIWrapper
from app.services.openai_client import get_openai_service


@lru_cache(maxsize=1)
def get_ai() -> OpenAIWrapper:
    return OpenAIWrapper(get_openai_service())
