from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.db.supabase_service import get_db_admin_service

LEGACY_TO_CANONICAL = {
    "growth": "professional",
    "scale": "enterprise",
}
TEMP_PLANS = {"tempusa1", "tempusa2", "tempind1", "tempind2"}


def _clean(value: Any) -> str:
    return str(value or "").strip().lower()


def _extract_invoice_plan(row: Dict[str, Any]) -> str:
    metadata = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
    p = _clean(metadata.get("plan"))
    if p:
        return p
    line_items = row.get("line_items")
    if isinstance(line_items, list):
        for item in line_items:
            if isinstance(item, dict):
                name = _clean(item.get("name"))
                for plan in ("tempusa1", "tempusa2", "tempind1", "tempind2", "growth", "scale", "professional", "enterprise", "starter", "free"):
                    if plan in name:
                        return plan
    return ""


async def run_cleanup(apply_changes: bool = False) -> Dict[str, Any]:
    db = get_db_admin_service()
    now_iso = datetime.now(timezone.utc).isoformat()

    def _fetch_profiles():
        return db.client.from_("profiles").select("user_id, subscription_plan, subscription_status, updated_at").execute()

    def _fetch_subscriptions():
        return db.client.from_("subscriptions").select("id, user_id, plan, status, metadata, updated_at").execute()

    def _fetch_invoices():
        return db.client.from_("invoices").select("id, user_id, metadata, line_items, payment_reference, created_at").execute()

    prof_rows = (getattr(await db.run(_fetch_profiles), "data", None) or [])
    sub_rows = (getattr(await db.run(_fetch_subscriptions), "data", None) or [])
    inv_rows = (getattr(await db.run(_fetch_invoices), "data", None) or [])

    profile_updates: List[Dict[str, Any]] = []
    subscription_updates: List[Dict[str, Any]] = []
    invoice_delete_ids: List[str] = []

    for row in prof_rows if isinstance(prof_rows, list) else []:
        if not isinstance(row, dict):
            continue
        user_id = str(row.get("user_id") or "").strip()
        plan = _clean(row.get("subscription_plan"))
        if not user_id or not plan:
            continue

        if plan in LEGACY_TO_CANONICAL:
            profile_updates.append({"user_id": user_id, "subscription_plan": LEGACY_TO_CANONICAL[plan]})
        elif plan in TEMP_PLANS:
            profile_updates.append({"user_id": user_id, "subscription_plan": "free", "subscription_status": "active"})

    for row in sub_rows if isinstance(sub_rows, list) else []:
        if not isinstance(row, dict):
            continue
        sub_id = str(row.get("id") or "").strip()
        plan = _clean(row.get("plan"))
        if not sub_id or not plan:
            continue

        if plan in LEGACY_TO_CANONICAL:
            subscription_updates.append({"id": sub_id, "plan": LEGACY_TO_CANONICAL[plan]})
        elif plan in TEMP_PLANS:
            subscription_updates.append(
                {
                    "id": sub_id,
                    "plan": "free",
                    "status": "active",
                    "deposit_amount": 0,
                    "wallet_balance": 0,
                }
            )

    for row in inv_rows if isinstance(inv_rows, list) else []:
        if not isinstance(row, dict):
            continue
        inv_id = str(row.get("id") or "").strip()
        if not inv_id:
            continue
        plan = _extract_invoice_plan(row)
        if plan in TEMP_PLANS:
            invoice_delete_ids.append(inv_id)

    applied = {
        "profile_updates": 0,
        "subscription_updates": 0,
        "invoice_deletes": 0,
    }
    errors: List[str] = []

    if apply_changes:
        # ── Step 0: Attempt to update the DB check constraint ────────────
        # The old constraint may only allow legacy plan names (growth/scale).
        # We need it to accept production names (professional/enterprise).
        try:
            def _update_constraint():
                db.client.rpc("exec_sql", {
                    "query": (
                        "ALTER TABLE profiles DROP CONSTRAINT IF EXISTS valid_subscription_plan; "
                        "ALTER TABLE profiles ADD CONSTRAINT valid_subscription_plan "
                        "CHECK (subscription_plan IN ('free', 'starter', 'professional', 'enterprise'));"
                    )
                }).execute()

            await db.run(_update_constraint)
        except Exception as exc:
            # If we can't alter the constraint (no RPC, no permission), proceed anyway.
            # Individual updates may fail and will be caught below.
            errors.append(f"constraint_update: {exc}")

        # ── Step 1: Update profiles ──────────────────────────────────────
        for update in profile_updates:
            uid = update["user_id"]
            payload = {k: v for k, v in update.items() if k != "user_id"}
            payload["updated_at"] = now_iso
            try:
                def _update_profile(uid=uid, values=payload):
                    return db.client.from_("profiles").update(values).eq("user_id", uid).execute()

                await db.run(_update_profile)
                applied["profile_updates"] += 1
            except Exception as exc:
                errors.append(f"profile:{uid}: {exc}")

        # ── Step 2: Update subscriptions ─────────────────────────────────
        for update in subscription_updates:
            sid = update["id"]
            payload = {k: v for k, v in update.items() if k != "id"}
            payload["updated_at"] = now_iso
            try:
                def _update_sub(sid=sid, values=payload):
                    return db.client.from_("subscriptions").update(values).eq("id", sid).execute()

                await db.run(_update_sub)
                applied["subscription_updates"] += 1
            except Exception as exc:
                errors.append(f"subscription:{sid}: {exc}")

        # ── Step 3: Delete temp invoices ─────────────────────────────────
        if invoice_delete_ids:
            try:
                def _delete_invoices():
                    return db.client.from_("invoices").delete().in_("id", invoice_delete_ids).execute()

                await db.run(_delete_invoices)
                applied["invoice_deletes"] = len(invoice_delete_ids)
            except Exception as exc:
                errors.append(f"invoices: {exc}")

    return {
        "dry_run": not apply_changes,
        "detected": {
            "profile_updates": len(profile_updates),
            "subscription_updates": len(subscription_updates),
            "invoice_deletes": len(invoice_delete_ids),
        },
        "applied": applied,
        "errors": errors if errors else None,
        "sample": {
            "profile_updates": profile_updates[:10],
            "subscription_updates": subscription_updates[:10],
            "invoice_delete_ids": invoice_delete_ids[:20],
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Cleanup legacy pricing plans and temp billing records")
    parser.add_argument("--apply", action="store_true", help="Apply cleanup changes. Default is dry-run.")
    args = parser.parse_args()

    result = asyncio.run(run_cleanup(apply_changes=bool(args.apply)))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
