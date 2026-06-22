from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.clerk_profile_sync import backfill_profiles_from_clerk
from app.services.db.supabase_service import get_db_admin_service


async def _run(limit: int, dry_run: bool) -> None:
    db = get_db_admin_service()
    result = await backfill_profiles_from_clerk(
        db=db,
        max_users=(limit or None),
        dry_run=dry_run,
    )
    print(json.dumps(result, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill legacy profile name/email fields from Clerk")
    parser.add_argument("--limit", type=int, default=0, help="Max Clerk users to scan (0 = all)")
    parser.add_argument("--dry-run", action="store_true", help="Preview updates without writing to database")
    args = parser.parse_args()

    asyncio.run(_run(limit=max(0, args.limit), dry_run=bool(args.dry_run)))


if __name__ == "__main__":
    main()
