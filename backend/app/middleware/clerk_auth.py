from __future__ import annotations

from typing import Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.auth.clerk import ClerkUser, verify_clerk_token
from app.core.logging import get_logger


logger = get_logger(__name__)


class ClerkAuthMiddleware(BaseHTTPMiddleware):
    """Attach Clerk user context to request.state.user if an Authorization token is present.

    - Does NOT enforce authentication.
    - Safe for parallel backend operation.
    """

    async def dispatch(self, request: Request, call_next):
        request.state.user = None  # type: ignore[attr-defined]

        auth = request.headers.get("authorization") or request.headers.get("Authorization")
        if auth and auth.lower().startswith("bearer "):
            token = auth.split(" ", 1)[1].strip()
            if token:
                try:
                    payload = verify_clerk_token(token)
                    request.state.user = ClerkUser(payload)  # type: ignore[attr-defined]
                except Exception as e:
                    # Do not fail request here; dependencies will enforce auth where needed.
                    logger.debug("clerk_auth_middleware_token_invalid", extra={"error": str(e)})

        return await call_next(request)
