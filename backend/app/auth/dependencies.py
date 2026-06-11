from __future__ import annotations

from typing import Iterable, Optional

from fastapi import Depends, HTTPException

from app.auth.clerk import ClerkUser, get_current_user


def require_user(user: ClerkUser = Depends(get_current_user)) -> ClerkUser:
    """Dependency: require any authenticated user (admin or recruiter)."""
    return user


def require_admin(user: ClerkUser = Depends(get_current_user)) -> ClerkUser:
    """
    Dependency: require platform admin access.

    Returns the authenticated ClerkUser if they are an admin.
    Raises HTTP 403 if the user is not an admin.

    Use this dependency on any endpoint that should be restricted to
    platform administrators only (e.g., future Admin Dashboard endpoints).
    """
    if not user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Platform administrator access required.",
        )
    return user


def require_roles(*allowed_roles: str):
    """
    Dependency factory: require specific role(s).

    Admin users bypass all role checks — they are always allowed through.
    """
    async def _dep(user: ClerkUser = Depends(get_current_user)) -> ClerkUser:
        # Admins bypass all role restrictions
        if user.is_admin:
            return user
        role = (user.metadata or {}).get("role")
        if allowed_roles and role not in set(allowed_roles):
            raise HTTPException(status_code=403, detail="Forbidden")
        return user

    return _dep
