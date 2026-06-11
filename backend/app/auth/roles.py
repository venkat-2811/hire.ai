from __future__ import annotations

from enum import StrEnum
from typing import FrozenSet


class UserRole(StrEnum):
    """
    RBAC roles for RekShift platform users.

    Admin role is completely independent of Stripe subscriptions.
    Admins bypass ALL usage limits, plan restrictions, and billing checks.
    """
    recruiter = "recruiter"
    admin = "admin"


# ---------------------------------------------------------------------------
# Hardcoded admin emails — these are ALWAYS treated as admins regardless of
# what is stored in the database or Clerk metadata.
#
# This set is the last line of defense: even if the DB or Clerk metadata is
# corrupted or missing, these addresses retain admin access.
#
# To add admins without a code change, use the ADMIN_EMAILS env var instead.
# ---------------------------------------------------------------------------
HARDCODED_ADMIN_EMAILS: FrozenSet[str] = frozenset({
    "sarma@bvitsolutions.com",
    "venkatakarthiksai.s@gmail.com",
    "mrangakrishna@gmail.com",
})


# ---------------------------------------------------------------------------
# Hardcoded admin Clerk user_ids — a secondary, ID-based admin check.
#
# This exists because Clerk JWTs only contain `sub` (user_id) by default.
# The email is NOT in the JWT. When the profile's email column is wrong
# (e.g. "unknown" due to being created before JWT email-resolution was added),
# the email-based check fails. The user_id check is always reliable since
# `sub` is always present in the JWT.
#
# How to find a user_id: check uvicorn logs for:
#   GET /rest/v1/profiles?select=...&user_id=eq.<USER_ID>
# ---------------------------------------------------------------------------
HARDCODED_ADMIN_USER_IDS: FrozenSet[str] = frozenset({
    "user_39pzPSlCnNtQdxV5H9ByKm9Ofsk",  # mrangakrishna@gmail.com
    "user_3DvWIyhFOmEDopxWyYKMl6jfn0z",  # sarma@bvitsolutions.com
    "user_39Cf5b4IZwNuZPprjPxJuiw7kpe",  # venkatakarthiksai.s@gmail.com
})


def get_admin_emails() -> FrozenSet[str]:
    """
    Returns the full set of admin emails.

    Merges hardcoded emails with any configured via the ADMIN_EMAILS
    environment variable (comma-separated).
    """
    try:
        from app.config import get_settings
        settings = get_settings()
        env_emails_raw = getattr(settings, "admin_emails", "") or ""
        env_emails = frozenset(
            e.strip().lower()
            for e in env_emails_raw.split(",")
            if e.strip()
        )
        return HARDCODED_ADMIN_EMAILS | env_emails
    except Exception:
        return HARDCODED_ADMIN_EMAILS


def is_admin_email(email: str) -> bool:
    """
    Returns True if the given email belongs to a platform admin.
    Comparison is case-insensitive.
    """
    if not email:
        return False
    return email.strip().lower() in get_admin_emails()


def is_admin_user_id(user_id: str) -> bool:
    """
    Returns True if the given Clerk user_id belongs to a platform admin.
    This is a fallback for when email-based detection fails (e.g. profile
    email column stores 'unknown' because it was set before JWT email fix).
    """
    if not user_id:
        return False
    return user_id.strip() in HARDCODED_ADMIN_USER_IDS
