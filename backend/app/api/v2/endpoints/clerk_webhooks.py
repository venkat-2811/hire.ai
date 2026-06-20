"""
Clerk webhook handler for session lifecycle tracking.

Listens for session lifecycle events from Clerk and maintains:
- user_login_events: append-only event log (all events)
- user_sessions:     stateful session tracker (active / closed)

Handled events:
- session.created  → insert active session + log event
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
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Request

from app.config import get_settings
from app.services.db.supabase_service import get_db_admin_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/clerk")

# Session event types we handle
_SESSION_CLOSE_EVENTS = frozenset({"session.ended", "session.removed", "session.revoked"})
_ALL_SESSION_EVENTS = frozenset({"session.created"}) | _SESSION_CLOSE_EVENTS


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

    Processes session lifecycle events:
    - session.created: Opens a new session, logs login event
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
    if event_type in _ALL_SESSION_EVENTS:
        await _handle_session_event(event_type, event, request)
    else:
        logger.info("[clerk_webhook] Ignoring unhandled event type: %s", event_type)

    return {"received": True}


async def _handle_session_event(
    event_type: str,
    event: Dict[str, Any],
    request: Request,
):
    """Handle any session lifecycle event.

    session.created  → insert into user_sessions (active) + log to user_login_events
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
