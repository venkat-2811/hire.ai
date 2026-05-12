from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel


class ErrorResponse(BaseModel):
    error: str
    message: str
    detail: Optional[Any] = None
