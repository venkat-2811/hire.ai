from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import HTTPException


class AppError(Exception):
    """Base application exception for service-layer errors."""

    def __init__(
        self,
        message: str,
        *,
        code: str = "app_error",
        status_code: int = 400,
        extra: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.extra = extra or {}


def to_http_exception(err: AppError) -> HTTPException:
    return HTTPException(
        status_code=err.status_code,
        detail={
            "error": err.code,
            "message": err.message,
            **(err.extra or {}),
        },
    )
