from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, Depends

from app.api.v2.deps import require_user
from app.auth.clerk import ClerkUser
from app.services.db.supabase_service import get_db_admin_service
from app.utils.responses import api_error, ok

router = APIRouter(prefix="/profile")


@router.get("")
async def get_profile(user: ClerkUser = Depends(require_user)):
    """Node-compatible: GET /api/profile

    Fetches or best-effort creates a profile row.
    """

    db = get_db_admin_service()

    def _fetch():
        return db.client.from_("profiles").select("*").eq("user_id", user.id).maybe_single().execute()

    res = await db.run(_fetch)
    if getattr(res, "error", None):
        return api_error(message="Failed to fetch profile", status_code=500)
    profile = getattr(res, "data", None)
    if isinstance(profile, dict):
        return ok(profile)

    # Create minimal profile
    email = str(getattr(user, "email", None) or "unknown")
    now = datetime.now(timezone.utc).isoformat()
    
    first = getattr(user, "raw", {}).get("first_name")
    last = getattr(user, "raw", {}).get("last_name")

    def _create():
        return (
            db.client.from_("profiles")
            .insert(
                {
                    "user_id": user.id,
                    "email": email,
                    "first_name": first,
                    "last_name": last,
                    "full_name": user.full_name,
                    "avatar_url": None,
                    "onboarding_completed": False,
                    "created_at": now,
                    "updated_at": now,
                }
            )
            .execute()
        )

    create_res = await db.run(_create)
    if getattr(create_res, "error", None):
        return api_error(message="Failed to create profile", status_code=500)

    # Separate fetch for SDK compatibility
    res = await db.run(_fetch)
    created = getattr(res, "data", None)
    if not isinstance(created, dict):
        return api_error(message="Failed to create profile", status_code=500)

    # Best-effort background sync if name differs (in case of JWT update)
    if created.get("full_name") != user.full_name and user.full_name:
        async def _sync_name():
            await db.run(lambda: db.client.from_("profiles").update({
                "first_name": first,
                "last_name": last,
                "full_name": user.full_name,
                "updated_at": now
            }).eq("user_id", user.id).execute())
        import asyncio
        asyncio.create_task(_sync_name())

    return ok(created)


@router.patch("")
async def update_profile(payload: Dict[str, Any], user: ClerkUser = Depends(require_user)):
    """Node-compatible: PATCH /api/profile

    Accepts snake_case or camelCase keys used by the existing frontend.
    """

    db = get_db_admin_service()

    def _get(*keys: str):
        for k in keys:
            if k in payload:
                return payload.get(k)
        return None

    now = datetime.now(timezone.utc).isoformat()

    update: Dict[str, Any] = {
        "organization_email": _get("organization_email", "organizationEmail"),
        "company_name": _get("company_name", "companyName"),
        "company_website": _get("company_website", "companyWebsite"),
        "company_size": _get("company_size", "companySize"),
        "industry": _get("industry"),
        "headquarters_location": _get("headquarters_location", "headquartersLocation"),
        "country": _get("country"),
        "hiring_regions": _get("hiring_regions", "hiringRegions"),
        "hiring_roles": _get("hiring_roles", "hiringRoles"),
        "preferred_timezone": _get("preferred_timezone", "preferredTimezone"),
        "contact_phone": _get("contact_phone", "contactPhone"),
        "updated_at": now,
    }
    
    first = _get("first_name", "firstName")
    last = _get("last_name", "lastName")
    full = _get("full_name", "fullName")
    if first is not None:
        update["first_name"] = first
    if last is not None:
        update["last_name"] = last
    if first is not None or last is not None:
        if full is None:
            f = str(first or "").strip()
            l = str(last or "").strip()
            full = f"{f} {l}".strip()
    if full is not None:
        update["full_name"] = full

    # boolean fields
    if "onboarding_completed" in payload or "onboardingCompleted" in payload:
        onboarding_completed = bool(payload.get("onboarding_completed", payload.get("onboardingCompleted")))
        update["onboarding_completed"] = onboarding_completed
        update["onboarding_completed_at"] = now if onboarding_completed else None

    def _fetch():
        return db.client.from_("profiles").select("*").eq("user_id", user.id).maybe_single().execute()

    # Only retain explicitly allowed keys in the update dict
    allowed_keys = {
        "organization_email",
        "company_name",
        "company_website",
        "company_size",
        "industry",
        "headquarters_location",
        "country",
        "hiring_regions",
        "hiring_roles",
        "preferred_timezone",
        "contact_phone",
        "first_name",
        "last_name",
        "full_name",
        "updated_at",
        "onboarding_completed",
        "onboarding_completed_at"
    }
    
    for k in list(update.keys()):
        if k not in allowed_keys:
            del update[k]

    # Upsert behavior
    def _fetch_existing():
        return db.client.from_("profiles").select("id").eq("user_id", user.id).maybe_single().execute()

    existing_res = await db.run(_fetch_existing)
    existing = getattr(existing_res, "data", None)

    if not isinstance(existing, dict):
        insert_row = {
            "user_id": user.id,
            "email": str(payload.get("email") or getattr(user, "email", None) or "unknown"),
            "full_name": payload.get("full_name", payload.get("fullName")),
            "avatar_url": payload.get("avatar_url", payload.get("avatarUrl")),
            "created_at": now,
            **{k: v for k, v in update.items() if v is not None or k in ("updated_at", "onboarding_completed", "onboarding_completed_at")},
        }

        def _insert():
            return db.client.from_("profiles").insert(insert_row).execute()

        ins_res = await db.run(_insert)
        if getattr(ins_res, "error", None):
            return api_error(message="Failed to create profile", status_code=500)
        # Separate fetch for SDK compatibility
        res = await db.run(_fetch)
        created = getattr(res, "data", None)
        if not isinstance(created, dict):
            return api_error(message="Failed to create profile", status_code=500)
        return ok(created)

    def _update():
        return (
            db.client.from_("profiles")
            .update({k: v for k, v in update.items() if v is not None or k in ("updated_at", "onboarding_completed", "onboarding_completed_at")})
            .eq("user_id", user.id)
            .execute()
        )

    up_res = await db.run(_update)
    if getattr(up_res, "error", None):
        return api_error(message="Failed to update profile", status_code=500)

    # Separate fetch for SDK compatibility
    res = await db.run(_fetch)
    updated = getattr(res, "data", None)
    if not isinstance(updated, dict):
        return api_error(message="Profile not found", status_code=404)

    return ok(updated)
