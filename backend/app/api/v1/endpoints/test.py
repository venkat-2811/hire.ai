from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.api.v1.deps import require_user
from app.auth.clerk import ClerkUser
from app.utils.responses import success_response

router = APIRouter(prefix="/test")


@router.get("/public")
async def public():
    return success_response({"ok": True, "auth": "not_required"})


@router.get("/protected")
async def protected(user: ClerkUser = Depends(require_user)):
    return success_response({"ok": True, "auth": "required", "user_id": user.id, "email": user.email})


@router.get("/whoami")
async def whoami(request: Request):
    # Middleware-attached context (optional)
    u = getattr(request.state, "user", None)
    if u is None:
        return success_response({"authenticated": False})
    return success_response({"authenticated": True, "user_id": u.id, "email": u.email})
