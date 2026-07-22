"""
audit_helpers.py — Shared helper for writing immutable audit log entries.

Called by every state-changing endpoint. Never update/delete rows from audit_logs.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from fastapi import Request

logger = logging.getLogger(__name__)


async def write_audit_log(
    db,
    *,
    actor_id: str,
    action: str,
    actor_role: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    company_id: Optional[str] = None,
    before_state: Optional[Dict[str, Any]] = None,
    after_state: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> None:
    """
    Write one immutable audit log row. Never raises — errors are logged only.

    action format:   <entity>.<verb>
    Examples:        company.create  member.approve  member.reject
                     credit.consume  credit.allocate plan.change
                     member.remove   company.suspend job.post
                     candidate.add   assessment.send interview.send
    """
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

    if request is not None:
        try:
            forwarded = request.headers.get("x-forwarded-for", "")
            ip_address = (forwarded.split(",")[0].strip() if forwarded else None) or str(request.client.host if request.client else "")
            user_agent = request.headers.get("user-agent", "")[:512]
        except Exception:
            pass

    row: Dict[str, Any] = {
        "actor_id": actor_id,
        "actor_role": actor_role or "recruiter",
        "action": action,
        "target_type": target_type,
        "target_id": str(target_id) if target_id else None,
        "company_id": str(company_id) if company_id else None,
        "before_state": before_state or {},
        "after_state": after_state or {},
        "ip_address": ip_address,
        "user_agent": user_agent,
    }

    try:
        def _insert():
            return db.client.from_("audit_logs").insert(row).execute()

        await db.run(_insert)
    except Exception as exc:
        logger.error("[audit_log] Failed to write audit entry action=%s actor=%s: %s", action, actor_id, exc)
