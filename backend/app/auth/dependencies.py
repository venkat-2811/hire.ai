from __future__ import annotations

from typing import Iterable, Optional

from fastapi import Depends, HTTPException

from app.auth.clerk import ClerkUser, get_current_user


def require_user(user: ClerkUser = Depends(get_current_user)) -> ClerkUser:
    return user


def require_roles(*allowed_roles: str):
    async def _dep(user: ClerkUser = Depends(get_current_user)) -> ClerkUser:
        role = (user.metadata or {}).get("role")
        if allowed_roles and role not in set(allowed_roles):
            raise HTTPException(status_code=403, detail="Forbidden")
        return user

    return _dep
