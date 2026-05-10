from __future__ import annotations

from typing import Optional

from fastapi import Depends

from app.auth.clerk import ClerkUser, get_current_user, get_optional_user


def require_user(user: ClerkUser = Depends(get_current_user)) -> ClerkUser:
    return user


def optional_user(user: Optional[ClerkUser] = Depends(get_optional_user)) -> Optional[ClerkUser]:
    return user
