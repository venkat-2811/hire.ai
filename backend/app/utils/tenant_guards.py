"""
tenant_guards.py
================
Reusable async helpers that enforce multi-tenant data isolation at the
application layer.

Because the backend uses Supabase's service-role (admin) client, Postgres
Row-Level-Security policies are bypassed. All tenant scoping MUST be
enforced here in the Python service layer.

The isolation boundary is the ``job_applications`` table:
    candidate → job_applications → job_descriptions.created_by == user.id

A recruiter may only access a candidate if that candidate has at least one
``job_applications`` row whose linked ``job_descriptions.created_by`` matches
the authenticated user's Clerk ID.
"""
from __future__ import annotations

import logging
from typing import List, Optional

logger = logging.getLogger(__name__)


async def get_user_job_ids(db, user_id: str) -> List[str]:
    """Return all job_description IDs created by *user_id*.

    Returns an empty list if the user has no jobs.
    """
    def _fetch():
        # IMPORTANT: We MUST include soft-deleted jobs (is_deleted=true) here 
        # so that candidates belonging to deleted jobs (Unassigned Candidates) 
        # still pass tenant isolation checks.
        return (
            db.client.from_("job_descriptions")
            .select("id")
            .eq("created_by", user_id)
            .execute()
        )

    try:
        res = await db.run(_fetch)
        rows = getattr(res, "data", None) or []
        return [r["id"] for r in rows if isinstance(r, dict) and r.get("id")]
    except Exception as exc:
        logger.error(
            "[tenant_guards.get_user_job_ids] error user_id=%s error=%s",
            user_id, exc,
        )
        return []


async def verify_job_belongs_to_user(db, job_id: str, user_id: str) -> bool:
    """Return True if *job_id* was created by *user_id*, False otherwise."""
    def _fetch():
        return (
            db.client.from_("job_descriptions")
            .select("id")
            .eq("id", job_id)
            .eq("created_by", user_id)
            .maybe_single()
            .execute()
        )

    try:
        res = await db.run(_fetch)
        data = getattr(res, "data", None)
        return isinstance(data, dict) and bool(data.get("id"))
    except Exception as exc:
        logger.error(
            "[tenant_guards.verify_job_belongs_to_user] error job_id=%s user_id=%s error=%s",
            job_id, user_id, exc,
        )
        return False


async def verify_candidate_belongs_to_user(
    db,
    candidate_id: str,
    user_id: str,
    job_id: Optional[str] = None,
) -> bool:
    """Return True if *candidate_id* has at least one application to a job
    owned by *user_id*.

    If *job_id* is provided, additionally verifies that the specific
    (candidate_id, job_id) pair exists and that job belongs to *user_id*.

    This is the primary tenant isolation gate for candidate endpoints.
    """
    user_job_ids = await get_user_job_ids(db, user_id)
    if not user_job_ids:
        return False

    if job_id:
        # Specific job requested — check that the job belongs to the user first
        if job_id not in user_job_ids:
            return False
        # Then verify the candidate has an application to that job
        def _check_specific():
            return (
                db.client.from_("job_applications")
                .select("id")
                .eq("candidate_id", candidate_id)
                .eq("job_id", job_id)
                .maybe_single()
                .execute()
            )
        try:
            res = await db.run(_check_specific)
            data = getattr(res, "data", None)
            return isinstance(data, dict) and bool(data.get("id"))
        except Exception as exc:
            logger.error(
                "[tenant_guards.verify_candidate_belongs_to_user] specific check error "
                "candidate_id=%s job_id=%s user_id=%s error=%s",
                candidate_id, job_id, user_id, exc,
            )
            return False

    # General check — any application to any of the user's jobs
    def _check_any():
        return (
            db.client.from_("job_applications")
            .select("id")
            .eq("candidate_id", candidate_id)
            .in_("job_id", user_job_ids)
            .limit(1)
            .execute()
        )

    try:
        res = await db.run(_check_any)
        rows = getattr(res, "data", None) or []
        return isinstance(rows, list) and len(rows) > 0
    except Exception as exc:
        logger.error(
            "[tenant_guards.verify_candidate_belongs_to_user] general check error "
            "candidate_id=%s user_id=%s error=%s",
            candidate_id, user_id, exc,
        )
        return False
