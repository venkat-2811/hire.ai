from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# Single source of truth pricing plan metadata mirroring landing page
BILLING_PLAN_CONFIG: Dict[str, Dict[str, Any]] = {
    "free": {
        "name": "Free",
        "candidates": 5,
        "validity": "1 Month",
        "USD": {"price": 0, "currency_symbol": "$"},
        "INR": {"price": 0, "currency_symbol": "₹"},
        "interval": "month",
        "interval_count": 1,
    },
    "starter": {
        "name": "Starter",
        "candidates": 100,
        "validity": "6 Months",
        "USD": {"price": 300, "currency_symbol": "$"},
        "INR": {"price": 27000, "currency_symbol": "₹"},
        "interval": "month",
        "interval_count": 6,
    },
    "growth": {
        "name": "Growth",
        "candidates": 500,
        "validity": "1 Year",
        "USD": {"price": 1100, "currency_symbol": "$"},
        "INR": {"price": 99000, "currency_symbol": "₹"},
        "interval": "year",
        "interval_count": 1,
    },
    "enterprise": {
        "name": "Enterprise",
        "candidates": 1000,
        "validity": "1 Year",
        "USD": {"price": 1800, "currency_symbol": "$"},
        "INR": {"price": 162000, "currency_symbol": "₹"},
        "interval": "year",
        "interval_count": 1,
    },
}

def _normalize_plan(raw: Optional[str]) -> str:
    p = str(raw or "free").lower().strip()
    if "starter" in p:
        return "starter"
    if "growth" in p:
        return "growth"
    if "enterprise" in p:
        return "enterprise"
    return "free"

async def get_candidate_count_after_deployment(db, recruiter_id: str) -> int:
    """Count unique candidates onboarded/assessed by the recruiter after deployment date."""
    from app.config import get_settings
    settings = get_settings()
    
    # We parse and format the deployment date ISO string
    deployment_date = settings.deployment_date
    
    # 1. Fetch all job description IDs created by the recruiter
    def _fetch_jobs():
        return (
            db.client.from_("job_descriptions")
            .select("id")
            .eq("created_by", recruiter_id)
            .execute()
        )
    
    jobs_res = await db.run(_fetch_jobs)
    jobs = getattr(jobs_res, "data", None) or []
    job_ids = [j["id"] for j in jobs if isinstance(j, dict) and j.get("id")]
    if not job_ids:
        return 0
        
    # 2. Fetch distinct candidate IDs in job_applications for those jobs created >= deployment_date
    def _fetch_application_cids():
        return (
            db.client.from_("job_applications")
            .select("candidate_id")
            .in_("job_id", job_ids)
            .gte("created_at", deployment_date)
            .execute()
        )
    
    cids_res = await db.run(_fetch_application_cids)
    rows = getattr(cids_res, "data", None) or []
    unique_cids = {r["candidate_id"] for r in rows if isinstance(r, dict) and r.get("candidate_id")}
    return len(unique_cids)

async def check_candidate_limit(db, recruiter_id: str) -> Optional[str]:
    """Check if recruiter has reached their plan limit.
    
    Returns error message string if limit reached, else None.
    """
    def _fetch_profile():
        return (
            db.client.from_("profiles")
            .select("subscription_plan")
            .eq("user_id", recruiter_id)
            .maybe_single()
            .execute()
        )
        
    p_res = await db.run(_fetch_profile)
    profile = getattr(p_res, "data", None) or {}
    plan = _normalize_plan(profile.get("subscription_plan"))
    
    plan_limit = BILLING_PLAN_CONFIG.get(plan, BILLING_PLAN_CONFIG["free"])["candidates"]
    count = await get_candidate_count_after_deployment(db, recruiter_id)
    
    if count >= plan_limit:
        return "You have reached your plan limit. Please choose a subscription plan to continue assessing additional candidates."
    return None
