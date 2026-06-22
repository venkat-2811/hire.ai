from __future__ import annotations

from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional

import httpx

from app.config import get_settings
from app.services.db.supabase_service import SupabaseService, get_db_admin_service

logger = logging.getLogger(__name__)

_CLERK_API_BASE = "https://api.clerk.com/v1"


def _clean(value: Any) -> str:
    return str(value or "").strip()


def _is_missing_name(value: Any) -> bool:
    v = _clean(value).lower()
    return not v or v == "not provided" or v.startswith("user_")


def _is_missing_email(value: Any) -> bool:
    v = _clean(value).lower()
    return not v or v == "unknown" or v == "not provided" or v.startswith("user_")


def _to_iso_from_unix_ms(value: Any) -> Optional[str]:
    try:
        if value is None:
            return None
        ts = int(value)
        if ts <= 0:
            return None
        return datetime.fromtimestamp(ts / 1000, tz=timezone.utc).isoformat()
    except Exception:
        return None


def _extract_email(user_obj: Dict[str, Any]) -> Optional[str]:
    primary_email_id = user_obj.get("primary_email_address_id")
    email_addresses = user_obj.get("email_addresses") or []

    for addr in email_addresses:
        if isinstance(addr, dict) and primary_email_id and addr.get("id") == primary_email_id:
            email = _clean(addr.get("email_address"))
            if email:
                return email

    for addr in email_addresses:
        if isinstance(addr, dict):
            email = _clean(addr.get("email_address"))
            if email:
                return email

    email = _clean(user_obj.get("email_address"))
    return email or None


def _extract_clerk_user_profile(user_obj: Dict[str, Any]) -> Dict[str, Any]:
    first_name = _clean(user_obj.get("first_name")) or None
    last_name = _clean(user_obj.get("last_name")) or None
    full_name = " ".join(part for part in [first_name, last_name] if part).strip() or None

    return {
        "user_id": _clean(user_obj.get("id")),
        "first_name": first_name,
        "last_name": last_name,
        "full_name": full_name,
        "email": _extract_email(user_obj),
        "last_login_at": _to_iso_from_unix_ms(user_obj.get("last_sign_in_at")),
    }


def _get_clerk_secret_key() -> str:
    settings = get_settings()
    return _clean(getattr(settings, "clerk_secret_key", ""))


async def _fetch_clerk_users(limit: int = 100, max_users: Optional[int] = None) -> List[Dict[str, Any]]:
    secret_key = _get_clerk_secret_key()
    if not secret_key:
        raise RuntimeError("CLERK_SECRET_KEY is required for profile backfill")

    users: List[Dict[str, Any]] = []
    offset = 0

    headers = {
        "Authorization": f"Bearer {secret_key}",
        "Accept": "application/json",
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        while True:
            resp = await client.get(
                f"{_CLERK_API_BASE}/users",
                headers=headers,
                params={"limit": limit, "offset": offset},
            )
            resp.raise_for_status()
            chunk = resp.json() or []
            if not isinstance(chunk, list) or not chunk:
                break

            for user_obj in chunk:
                if isinstance(user_obj, dict):
                    users.append(user_obj)
                    if max_users is not None and len(users) >= max_users:
                        return users

            if len(chunk) < limit:
                break
            offset += limit

    return users


async def fetch_clerk_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    user_id = _clean(user_id)
    if not user_id:
        return None

    secret_key = _get_clerk_secret_key()
    if not secret_key:
        return None

    headers = {
        "Authorization": f"Bearer {secret_key}",
        "Accept": "application/json",
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(f"{_CLERK_API_BASE}/users/{user_id}", headers=headers)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        payload = resp.json()
        return payload if isinstance(payload, dict) else None


def _build_partial_update_payload(existing_profile: Dict[str, Any], clerk_profile: Dict[str, Any], now_iso: str) -> Dict[str, Any]:
    update_payload: Dict[str, Any] = {"updated_at": now_iso}

    if _is_missing_name(existing_profile.get("first_name")) and clerk_profile.get("first_name"):
        update_payload["first_name"] = clerk_profile["first_name"]

    if _is_missing_name(existing_profile.get("last_name")) and clerk_profile.get("last_name"):
        update_payload["last_name"] = clerk_profile["last_name"]

    if _is_missing_name(existing_profile.get("full_name")) and clerk_profile.get("full_name"):
        update_payload["full_name"] = clerk_profile["full_name"]

    if _is_missing_email(existing_profile.get("email")) and clerk_profile.get("email"):
        update_payload["email"] = clerk_profile["email"]

    if not _clean(existing_profile.get("last_login_at")) and clerk_profile.get("last_login_at"):
        update_payload["last_login_at"] = clerk_profile["last_login_at"]

    if list(update_payload.keys()) == ["updated_at"]:
        return {}
    return update_payload


async def backfill_profiles_from_clerk(
    *,
    db: Optional[SupabaseService] = None,
    max_users: Optional[int] = None,
    dry_run: bool = False,
) -> Dict[str, Any]:
    service = db or get_db_admin_service()
    now_iso = datetime.now(timezone.utc).isoformat()

    clerk_users = await _fetch_clerk_users(max_users=max_users)

    def _fetch_profiles():
        return (
            service.client.from_("profiles")
            .select("id, user_id, first_name, last_name, full_name, email, last_login_at")
            .execute()
        )

    prof_res = await service.run(_fetch_profiles)
    profile_rows = getattr(prof_res, "data", None) or []

    profile_by_uid: Dict[str, Dict[str, Any]] = {}
    profile_by_email: Dict[str, Dict[str, Any]] = {}
    for row in profile_rows if isinstance(profile_rows, list) else []:
        if not isinstance(row, dict):
            continue
        uid = _clean(row.get("user_id"))
        email = _clean(row.get("email")).lower()
        if uid:
            profile_by_uid[uid] = row
        if email and email != "unknown":
            profile_by_email[email] = row

    scanned = 0
    updated = 0
    inserted = 0
    skipped = 0
    errors: List[str] = []

    for user_obj in clerk_users:
        scanned += 1
        clerk_profile = _extract_clerk_user_profile(user_obj)
        clerk_uid = _clean(clerk_profile.get("user_id"))
        clerk_email = _clean(clerk_profile.get("email")).lower()

        existing = profile_by_uid.get(clerk_uid)
        if not existing and clerk_email:
            existing = profile_by_email.get(clerk_email)

        try:
            if isinstance(existing, dict):
                update_payload = _build_partial_update_payload(existing, clerk_profile, now_iso)
                if not update_payload:
                    skipped += 1
                    continue

                if not dry_run:
                    target_uid = _clean(existing.get("user_id"))
                    if target_uid:
                        def _update_by_user_id():
                            return (
                                service.client.from_("profiles")
                                .update(update_payload)
                                .eq("user_id", target_uid)
                                .execute()
                            )
                        await service.run(_update_by_user_id)
                    else:
                        target_email = _clean(existing.get("email"))
                        def _update_by_email():
                            return (
                                service.client.from_("profiles")
                                .update(update_payload)
                                .eq("email", target_email)
                                .execute()
                            )
                        await service.run(_update_by_email)
                updated += 1
                continue

            insert_payload = {
                "user_id": clerk_uid,
                "first_name": clerk_profile.get("first_name"),
                "last_name": clerk_profile.get("last_name"),
                "full_name": clerk_profile.get("full_name"),
                "email": clerk_profile.get("email") or "unknown",
                "last_login_at": clerk_profile.get("last_login_at"),
                "onboarding_completed": False,
                "created_at": now_iso,
                "updated_at": now_iso,
            }

            if not dry_run:
                def _insert_profile():
                    return service.client.from_("profiles").insert(insert_payload).execute()
                await service.run(_insert_profile)
            inserted += 1
        except Exception as exc:
            errors.append(f"{clerk_uid or clerk_email or 'unknown'}: {exc}")

    return {
        "scanned_clerk_users": scanned,
        "updated_profiles": updated,
        "inserted_profiles": inserted,
        "skipped_profiles": skipped,
        "error_count": len(errors),
        "errors": errors[:20],
        "dry_run": dry_run,
    }


async def recover_profile_if_incomplete(user_id: str, *, db: Optional[SupabaseService] = None) -> bool:
    user_id = _clean(user_id)
    if not user_id:
        return False

    service = db or get_db_admin_service()

    def _fetch_profile():
        return (
            service.client.from_("profiles")
            .select("user_id, first_name, last_name, full_name, email, last_login_at")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )

    prof_res = await service.run(_fetch_profile)
    profile = getattr(prof_res, "data", None)
    if not isinstance(profile, dict):
        return False

    has_missing_identity = (
        _is_missing_name(profile.get("first_name"))
        or _is_missing_name(profile.get("last_name"))
        or _is_missing_name(profile.get("full_name"))
        or _is_missing_email(profile.get("email"))
    )

    if not has_missing_identity:
        return False

    clerk_user = await fetch_clerk_user_by_id(user_id)
    if not isinstance(clerk_user, dict):
        return False

    now_iso = datetime.now(timezone.utc).isoformat()
    clerk_profile = _extract_clerk_user_profile(clerk_user)
    update_payload = _build_partial_update_payload(profile, clerk_profile, now_iso)
    if not update_payload:
        return False

    def _update_profile():
        return (
            service.client.from_("profiles")
            .update(update_payload)
            .eq("user_id", user_id)
            .execute()
        )

    await service.run(_update_profile)
    logger.info("[clerk_profile_sync] Recovered missing profile identity fields for user=%s", user_id)
    return True
