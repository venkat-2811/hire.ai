from __future__ import annotations

from typing import Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.core.logging import get_logger


logger = get_logger(__name__)


class AuthContextMiddleware(BaseHTTPMiddleware):
    """Auth context scaffolding.

    Does NOT enforce auth. It only prepares a place to attach decoded user info
    later (during migration) without changing existing endpoint behavior.
    """

    async def dispatch(self, request: Request, call_next):
        request.state.user = None  # type: ignore[attr-defined]
        response = await call_next(request)
        return response
