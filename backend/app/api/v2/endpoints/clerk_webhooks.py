"""
Clerk webhook handler for session lifecycle and user profile tracking.

Listens for events from Clerk and maintains:
- user_login_events: append-only event log (session.created events only)
- user_sessions:     stateful session tracker (active / closed)
- profiles:          recruiter profile table — synced on user.created / user.updated

Handled events:
- user.created     → upsert profiles row with first_name, last_name, full_name, email
- user.updated     → update profiles row with changed name/email fields
- session.created  → insert active session + log event + update last_login_at
- session.ended    → mark session ended + log event
- session.removed  → mark session removed + log event
- session.revoked  → mark session revoked + log event

Security:
- Webhook signature verification via CLERK_WEBHOOK_SECRET is MANDATORY.
- If CLERK_WEBHOOK_SECRET is not configured, the handler refuses all events
  (fail closed). It does NOT skip verification.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Request

from app.config import get_settings
from app.services.db.supabase_service import get_db_admin_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/clerk")

# Session event types we handle
_SESSION_CLOSE_EVENTS = frozenset({"session.ended", "session.removed", "session.revoked"})
_ALL_SESSION_EVENTS = frozenset({"session.created"}) | _SESSION_CLOSE_EVENTS

# User event types we handle
_USER_EVENTS = frozenset({"user.created", "user.updated"})


def _get_webhook_secret() -> str:
    settings = get_settings()
    return (settings.clerk_webhook_secret or "").strip()


def _verify_svix_signature(
    payload_bytes: bytes,
    headers: Dict[str, str],
    secret: str,
) -> bool:
    """Verify Clerk webhook signature (Svix format).

    Clerk uses Svix for webhook delivery. The signature format is:
    - svix-id: unique message ID
    - svix-timestamp: unix timestamp
    - svix-signature: comma-separated list of "v1,<base64-signature>" values

    The signed content is: "{svix-id}.{svix-timestamp}.{payload_body}"
    The secret is base64-encoded with a "whsec_" prefix.
    """
    import base64
    import time

    msg_id = headers.get("svix-id") or headers.get("webhook-id") or ""
    timestamp_str = headers.get("svix-timestamp") or headers.get("webhook-timestamp") or ""
    signature_header = headers.get("svix-signature") or headers.get("webhook-signature") or ""

    if not msg_id or not timestamp_str or not signature_header:
        logger.warning("[clerk_webhook] Missing svix headers: id=%s ts=%s sig=%s",
                       bool(msg_id), bool(timestamp_str), bool(signature_header))
        return False

    # Reject timestamps older than 5 minutes (replay protection)
    try:
        ts = int(timestamp_str)
        if abs(time.time() - ts) > 300:
            logger.warning("[clerk_webhook] Timestamp too old or too far in future: %s", timestamp_str)
            return False
    except (ValueError, TypeError):
        logger.warning("[clerk_webhook] Invalid timestamp: %s", timestamp_str)
        return False

    # Decode the secret (strip "whsec_" prefix, base64-decode)
    try:
        secret_bytes: bytes
        if secret.startswith("whsec_"):
            secret_bytes = base64.b64decode(secret[6:])
        else:
            secret_bytes = base64.b64decode(secret)
    except Exception as exc:
        logger.error("[clerk_webhook] Failed to decode webhook secret: %s", exc)
        return False

    # Compute expected signature
    signed_content = f"{msg_id}.{timestamp_str}.".encode() + payload_bytes
    expected_sig = base64.b64encode(
        hmac.new(secret_bytes, signed_content, hashlib.sha256).digest()
    ).decode()

    # Check against all provided signatures (comma-separated, each prefixed with version)
    for sig_entry in signature_header.split(" "):
        parts = sig_entry.split(",", 1)
        if len(parts) == 2 and parts[0] == "v1":
            if hmac.compare_digest(parts[1], expected_sig):
                return True

    logger.warning("[clerk_webhook] Signature mismatch")
    return False


@router.post("/webhook")
async def clerk_webhook(request: Request):
    """Handle Clerk webhook events.

    Processes user and session lifecycle events:
    - user.created / user.updated: Sync profile data (name, email) into profiles table
    - session.created: Opens a new session, logs login event, updates last_login_at
    - session.ended / session.removed / session.revoked: Closes the session

    Fails closed: if CLERK_WEBHOOK_SECRET is not configured, rejects all events.
    """
    # ── 1. Fail closed if secret is not configured ──────────────────────────
    webhook_secret = _get_webhook_secret()
    if not webhook_secret:
        logger.error(
            "[clerk_webhook] CLERK_WEBHOOK_SECRET is not configured. "
            "Rejecting event (fail closed). Configure the secret before using this endpoint."
        )
        raise HTTPException(
            status_code=503,
            detail="Webhook handler is not configured. CLERK_WEBHOOK_SECRET is required.",
        )

    # ── 2. Read raw body ────────────────────────────────────────────────────
    try:
        payload_bytes = await request.body()
    except Exception as exc:
        logger.error("[clerk_webhook] Failed to read request body: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid request body")

    # ── 3. Verify signature ─────────────────────────────────────────────────
    headers = {k.lower(): v for k, v in request.headers.items()}
    if not _verify_svix_signature(payload_bytes, headers, webhook_secret):
        logger.warning("[clerk_webhook] Invalid webhook signature. Rejecting event.")
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    # ── 4. Parse payload ────────────────────────────────────────────────────
    try:
        event = json.loads(payload_bytes)
    except (json.JSONDecodeError, ValueError) as exc:
        logger.error("[clerk_webhook] Invalid JSON payload: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type = event.get("type", "")
    logger.info("[clerk_webhook] Received event: %s", event_type)

    # ── 5. Route by event type ──────────────────────────────────────────────
    if event_type in _USER_EVENTS:
        await _handle_user_event(event_type, event)
    elif event_type in _ALL_SESSION_EVENTS:
        await _handle_session_event(event_type, event, request)
    else:
        logger.info("[clerk_webhook] Ignoring unhandled event type: %s", event_type)

    return {"received": True}


def _extract_user_profile(data: Dict[str, Any]) -> Dict[str, Any]:
    """Extract profile fields from a Clerk user object (user.created / user.updated payload)."""
    first_name = str(data.get("first_name") or "").strip() or None
    last_name = str(data.get("last_name") or "").strip() or None

    # Compute full_name from parts (never leave it null if we have either part)
    if first_name or last_name:
        full_name = " ".join(filter(None, [first_name, last_name]))
    else:
        full_name = None

    # Primary email: find the email address that matches primary_email_address_id
    primary_email_id = data.get("primary_email_address_id")
    email_addresses = data.get("email_addresses") or []
    email: Optional[str] = None
    for addr in email_addresses:
        if isinstance(addr, dict):
            if primary_email_id and addr.get("id") == primary_email_id:
                email = addr.get("email_address")
                break
    # Fallback: first available address
    if not email and email_addresses:
        first_addr = email_addresses[0]
        if isinstance(first_addr, dict):
            email = first_addr.get("email_address")

    return {
        "first_name": first_name,
        "last_name": last_name,
        "full_name": full_name,
        "email": email,
    }


async def _handle_user_event(event_type: str, event: Dict[str, Any]):
    """Handle user.created and user.updated Clerk events.

    Upserts the profiles row so that first_name, last_name, full_name, and email
    are always populated from Clerk's authoritative source.
    """
    data = event.get("data", {})
    clerk_user_id = str(data.get("id") or "").strip()

    if not clerk_user_id:
        logger.warning("[clerk_webhook] %s missing user id, skipping", event_type)
        return

    profile_fields = _extract_user_profile(data)
    now = datetime.now(timezone.utc).isoformat()

    db = get_db_admin_service()

    # ── Check if profile already exists ─────────────────────────────────────
    def _fetch_existing():
        return (
            db.client.from_("profiles")
            .select("id, full_name, first_name, last_name, email")
            .eq("user_id", clerk_user_id)
            .maybe_single()
            .execute()
        )

    try:
        existing_res = await db.run(_fetch_existing)
        existing = getattr(existing_res, "data", None)
    except Exception as exc:
        logger.error("[clerk_webhook] Failed to fetch profile for user=%s: %s", clerk_user_id, exc)
        existing = None

    if isinstance(existing, dict):
        # UPDATE — only overwrite name fields if we have actual values from Clerk
        update_payload: Dict[str, Any] = {"updated_at": now}
        if profile_fields["first_name"] is not None:
            update_payload["first_name"] = profile_fields["first_name"]
        if profile_fields["last_name"] is not None:
            update_payload["last_name"] = profile_fields["last_name"]
        if profile_fields["full_name"] is not None:
            update_payload["full_name"] = profile_fields["full_name"]
        # Always sync email from Clerk if available (Clerk is the source of truth)
        if profile_fields["email"]:
            update_payload["email"] = profile_fields["email"]

        def _update_profile():
            return (
                db.client.from_("profiles")
                .update(update_payload)
                .eq("user_id", clerk_user_id)
                .execute()
            )

        try:
            await db.run(_update_profile)
            logger.info(
                "[clerk_webhook] %s — updated profile user=%s full_name=%s email=%s",
                event_type, clerk_user_id, profile_fields["full_name"], profile_fields["email"],
            )
        except Exception as exc:
            logger.error("[clerk_webhook] Failed to update profile for user=%s: %s", clerk_user_id, exc)
    else:
        # INSERT — create the profile row with all available data
        insert_payload: Dict[str, Any] = {
            "user_id": clerk_user_id,
            "first_name": profile_fields["first_name"],
            "last_name": profile_fields["last_name"],
            "full_name": profile_fields["full_name"],
            "email": profile_fields["email"] or "unknown",
            "onboarding_completed": False,
            "created_at": now,
            "updated_at": now,
        }

        def _insert_profile():
            return (
                db.client.from_("profiles")
                .insert(insert_payload)
                .execute()
            )

        try:
            await db.run(_insert_profile)
            logger.info(
                "[clerk_webhook] %s — created profile user=%s full_name=%s email=%s",
                event_type, clerk_user_id, profile_fields["full_name"], profile_fields["email"],
            )
        except Exception as exc:
            logger.warning(
                "[clerk_webhook] Failed to insert profile for user=%s (may already exist): %s",
                clerk_user_id, exc,
            )


async def _handle_session_event(
    event_type: str,
    event: Dict[str, Any],
    request: Request,
):
    """Handle any session lifecycle event.

    session.created  → insert into user_sessions (active) + log to user_login_events + update last_login_at
    session.ended    → update user_sessions status → ended   + log
    session.removed  → update user_sessions status → removed + log
    session.revoked  → update user_sessions status → revoked + log
    """
    data = event.get("data", {})

    user_id = str(data.get("user_id") or "").strip()
    # Clerk session ID: data.id for the session object
    clerk_session_id = str(data.get("id") or "").strip()

    if not user_id:
        logger.warning("[clerk_webhook] %s missing user_id, skipping", event_type)
        return

    if not clerk_session_id:
        logger.warning("[clerk_webhook] %s missing session id (data.id), skipping", event_type)
        return

    # Extract optional metadata from request headers (best-effort)
    ip_address: Optional[str] = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or request.headers.get("x-real-ip")
        or (request.client.host if request.client else None)
    )
    user_agent: Optional[str] = request.headers.get("user-agent")

    db = get_db_admin_service()

    # ── Always append to the event log ──────────────────────────────────────
    try:
        await db.insert("user_login_events", [{
            "user_id": user_id,
            "event_type": event_type,
            "clerk_session_id": clerk_session_id,
            "ip_address": ip_address,
            "user_agent": user_agent,
        }])
    except Exception as exc:
        logger.error("[clerk_webhook] Failed to insert login event: %s", exc)

    # ── Update stateful session table ───────────────────────────────────────
    if event_type == "session.created":
        # Insert new active session
        try:
            await db.insert("user_sessions", [{
                "clerk_session_id": clerk_session_id,
                "user_id": user_id,
                "status": "active",
            }])
            logger.info("[clerk_webhook] Opened session %s for user=%s", clerk_session_id, user_id)
        except Exception as exc:
            # Duplicate session ID = idempotent, not an error
            logger.warning("[clerk_webhook] Failed to insert session (may be duplicate): %s", exc)

        # Update last_login_at on the profile so the admin knows when the user last logged in
        try:
            now_iso = datetime.now(timezone.utc).isoformat()

            def _update_last_login():
                return (
                    db.client.from_("profiles")
                    .update({"last_login_at": now_iso, "updated_at": now_iso})
                    .eq("user_id", user_id)
                    .execute()
                )

            await db.run(_update_last_login)
            logger.info("[clerk_webhook] Updated last_login_at for user=%s", user_id)
        except Exception as exc:
            logger.warning("[clerk_webhook] Failed to update last_login_at for user=%s: %s", user_id, exc)

    elif event_type in _SESSION_CLOSE_EVENTS:
        # Derive the terminal status from the event type: "session.ended" → "ended"
        terminal_status = event_type.split(".", 1)[1]  # ended | removed | revoked
        try:
            await db.update(
                "user_sessions",
                {"status": terminal_status, "ended_at": "now()"},
                filters={"clerk_session_id": clerk_session_id},
            )
            logger.info(
                "[clerk_webhook] Closed session %s → %s for user=%s",
                clerk_session_id, terminal_status, user_id,
            )
        except Exception as exc:
            logger.error("[clerk_webhook] Failed to update session %s: %s", clerk_session_id, exc)
