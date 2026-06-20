"""Admin endpoint auth matrix runner.

Usage (PowerShell):
  $env:ADMIN_JWT = "<admin_jwt>"
  $env:RECRUITER_JWT = "<recruiter_jwt>"
  python backend/admin_auth_matrix.py

Optional:
  $env:API_BASE = "http://127.0.0.1:8000"
"""

from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass
from typing import Dict, List, Optional
from urllib import error, parse, request


API_BASE = os.getenv("API_BASE", "http://127.0.0.1:8000").rstrip("/")


@dataclass
class Case:
    name: str
    path: str
    expected_admin: int
    expected_recruiter: int


CASES: List[Case] = [
    Case("health", "/api/v2/admin/health", 200, 403),
    Case("overview", "/api/v2/admin/overview", 200, 403),
    Case("recruiter_counts", "/api/v2/admin/recruiters/candidate-counts?limit=5&offset=0", 200, 403),
    Case("plan_counts", "/api/v2/admin/subscriptions/plan-counts", 200, 403),
    Case("billing_transactions", "/api/v2/admin/billing/transactions?limit=5&offset=0", 200, 403),
]


def call(path: str, token: Optional[str]) -> Dict[str, object]:
    url = f"{API_BASE}{path}"
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = request.Request(url=url, method="GET", headers=headers)
    try:
        with request.urlopen(req, timeout=20) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return {"status": resp.getcode(), "body": body[:800]}
    except error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        return {"status": e.code, "body": body[:800]}
    except Exception as e:
        return {"status": None, "body": f"request_error: {e}"}


def main() -> int:
    admin_jwt = os.getenv("ADMIN_JWT", "").strip()
    recruiter_jwt = os.getenv("RECRUITER_JWT", "").strip()

    if not admin_jwt or not recruiter_jwt:
        print("Missing required env vars ADMIN_JWT and/or RECRUITER_JWT", file=sys.stderr)
        return 2

    rows: List[Dict[str, object]] = []
    all_ok = True

    for case in CASES:
        admin_res = call(case.path, admin_jwt)
        rec_res = call(case.path, recruiter_jwt)

        admin_ok = admin_res["status"] == case.expected_admin
        rec_ok = rec_res["status"] == case.expected_recruiter
        all_ok = all_ok and admin_ok and rec_ok

        rows.append(
            {
                "case": case.name,
                "path": case.path,
                "admin": {
                    "expected": case.expected_admin,
                    "actual": admin_res["status"],
                    "ok": admin_ok,
                    "body_preview": admin_res["body"],
                },
                "recruiter": {
                    "expected": case.expected_recruiter,
                    "actual": rec_res["status"],
                    "ok": rec_ok,
                    "body_preview": rec_res["body"],
                },
            }
        )

    print(json.dumps({"api_base": API_BASE, "results": rows, "all_ok": all_ok}, indent=2))
    return 0 if all_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
