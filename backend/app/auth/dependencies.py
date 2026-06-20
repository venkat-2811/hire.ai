from __future__ import annotations

from typing import Optional

from fastapi import Depends

from app.auth.clerk import ClerkUser, get_current_user, require_role as _require_role, require_any_role


def require_user(user: ClerkUser = Depends(get_current_user)) -> ClerkUser:
    return user


def require_role(role: str):
    return _require_role(role)


def require_roles(*allowed_roles: str):
    return require_any_role(*allowed_roles)
