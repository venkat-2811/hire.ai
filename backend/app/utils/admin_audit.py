from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.services.db.supabase_service import get_db_admin_service


async def log_admin_action(
    *,
    actor_user_id: str,
    action: str,
    target_user_id: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = None,
) -> None:
    """Persist an admin mutation audit record.

    NOTE: Use this only for mutating admin operations. Read-only admin endpoints
    intentionally do not emit audit log rows.
    """
    db = get_db_admin_service()
    now_iso = datetime.now(timezone.utc).isoformat()

    row = {
        "actor_user_id": actor_user_id,
        "action": action,
        "target_user_id": target_user_id,
        "payload": payload or {},
        "created_at": now_iso,
    }

    def _insert():
        return db.client.from_("admin_audit_log").insert(row).execute()

    await db.run(_insert)
