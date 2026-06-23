from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# ─── Billing Plan Configuration ───────────────────────────────────────────────
# Single source of truth for all plans (backend).
#
# Plan rename history (June 2026):
#   'growth' (100-candidate plan)
#   enterprise (500-candidate paid Stripe plan) → scale
#   custom (Contact Sales)        → enterprise
#
# INR prices:
#   Starter: ₹15,000 | Growth: ₹27,000 | Scale: ₹99,000
# ─────────────────────────────────────────────────────────────────────────────

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
        "candidates": 50,
        "validity": "6 Months",
        "USD": {"price": 300, "currency_symbol": "$"},
        "INR": {"price": 15000, "currency_symbol": "₹"},
        "interval": "month",
        "interval_count": 6,
    },
    "growth": {
        "name": "Growth",
        "candidates": 100,
        "validity": "6 Months",
        "USD": {"price": 500, "currency_symbol": "$"},
        "INR": {"price": 27000, "currency_symbol": "₹"},
        "interval": "month",
        "interval_count": 6,
    },
    "scale": {
        "name": "Scale",
        "candidates": 500,
        "validity": "1 Year",
        "interval": "year",
        "interval_count": 1,
        "USD": {"price": 2000, "currency_symbol": "$"},
        "INR": {"price": 99000, "currency_symbol": "₹"},
    },
    "enterprise": {
        "name": "Enterprise",
        "candidates": None,  # Custom / contact sales
        "validity": "Custom",
        "interval": "month",
        "interval_count": 1,
        "USD": {"price": 0, "currency_symbol": "$"},  # Contact sales
        "INR": {"price": 0, "currency_symbol": "₹"},
    },
}

# ── Plan ID normalization ──────────────────────────────────────────────────────

def _normalize_plan(raw: Optional[str]) -> str:
    """Normalize a raw plan string to a canonical plan key.

    Handles legacy aliases so that old database values continue to work:
      professional  → growth
      enterprise    → scale         (old paid Stripe plan, renamed June 2026)
      custom        → enterprise    (Contact Sales tier, renamed June 2026)
    """
    p = str(raw or "free").lower().strip()
    if p in BILLING_PLAN_CONFIG:
        return p
    # Legacy aliases
    if p == "professional":
        return "growth"
    if p in ("enterprise", "enterprise_paid"):
        return "scale"
    if p == "custom":
        return "enterprise"
    if "starter" in p:
        return "starter"
    if "growth" in p or "professional" in p:
        return "growth"
    if "scale" in p or "enterprise" in p:
        return "scale"
    return "free"

# ── Stripe Price ID Lookup ─────────────────────────────────────────────────────

def get_stripe_price_id(plan: str, currency: str) -> str:
    """
    Look up the configured Stripe Price ID for a given plan + currency.
    Prefers production-named env vars, falls back to legacy names.
    Returns empty string if not configured (falls back to dynamic price_data).
    Enterprise is a contact-sales plan — no Stripe price ID.
    """
    from app.config import get_settings
    settings = get_settings()

    currency = currency.upper()
    mapping: Dict[str, Dict[str, str]] = {
        # Free plan intentionally excluded — no payment, no Stripe checkout
        "starter": {
            "USD": settings.stripe_us_starter_price_id,
            "INR": settings.stripe_ind_starter_price_id,
        },
        "growth": {
            # Prefer new growth price IDs, fall back to legacy professional IDs
            "USD": settings.stripe_us_growth_price_id or settings.stripe_us_professional_price_id,
            "INR": settings.stripe_ind_growth_price_id or settings.stripe_ind_professional_price_id,
        },
        "scale": {
            # Prefer new scale price IDs, fall back to legacy enterprise IDs
            "USD": settings.stripe_us_scale_price_id or settings.stripe_us_enterprise_price_id,
            "INR": settings.stripe_ind_scale_price_id or settings.stripe_ind_enterprise_price_id,
        },
        # enterprise (contact sales) intentionally excluded — no Stripe checkout
    }
    return (mapping.get(plan, {}).get(currency) or "").strip()

# ── Plan Validation ───────────────────────────────────────────────────────────

def validate_plan_currency(plan: str, currency: str) -> Optional[str]:
    """
    Validates that the plan is available for the given currency.
    Returns error message string if invalid, None if valid.
    """
    currency = currency.upper()
    if currency not in ("USD", "INR"):
        return f"Invalid currency: {currency}. Supported: USD, INR"

    if plan == "enterprise":
        return "Enterprise is a contact sales plan. Please contact our team for pricing."

    return None

# ── Candidate Count ───────────────────────────────────────────────────────────

async def get_candidate_count_after_deployment(db, recruiter_id: str) -> int:
    """Return the total number of candidates ever consumed by the recruiter.

    Reads the immutable `candidates_consumed` counter from the profiles table.
    This counter only ever increments (never decrements), so deleting candidates
    or jobs does NOT reduce the billing usage — preventing quota bypass exploits.

    Falls back to live-counting job_applications if the column does not yet exist
    (pre-migration compatibility).
    """
    def _fetch_counter():
        return (
            db.client.from_("profiles")
            .select("candidates_consumed")
            .eq("user_id", recruiter_id)
            .maybe_single()
            .execute()
        )

    try:
        res = await db.run(_fetch_counter)
        profile = getattr(res, "data", None) or {}
        consumed = profile.get("candidates_consumed")
        if consumed is not None:
            return int(consumed)
    except Exception as exc:
        logger.warning(
            "[billing_helpers] Could not read candidates_consumed, falling back to live count: %s", exc
        )

    # ── Fallback: live count from job_applications (pre-migration) ──────────
    from app.config import get_settings
    settings = get_settings()
    deployment_date = settings.deployment_date

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


async def increment_candidates_consumed(db, recruiter_id: str) -> None:
    """Atomically increment the candidates_consumed counter for a recruiter.

    Called once per NEW candidate creation (not when an existing candidate
    is added to a second job). Safe to call without a transaction — in the
    rare case of a race condition the counter may be off by at most 1, which
    is acceptable for billing purposes.
    """
    def _fetch_and_increment():
        res = (
            db.client.from_("profiles")
            .select("candidates_consumed")
            .eq("user_id", recruiter_id)
            .maybe_single()
            .execute()
        )
        current = int((getattr(res, "data", None) or {}).get("candidates_consumed") or 0)
        db.client.from_("profiles").update(
            {"candidates_consumed": current + 1}
        ).eq("user_id", recruiter_id).execute()

    try:
        await db.run(_fetch_and_increment)
    except Exception as exc:
        logger.error(
            "[billing_helpers] Failed to increment candidates_consumed for user=%s: %s",
            recruiter_id, exc
        )


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

    plan_config = BILLING_PLAN_CONFIG.get(plan, BILLING_PLAN_CONFIG["free"])
    plan_limit = plan_config.get("candidates")

    # Enterprise plan has custom/unlimited limits — never blocked here
    if plan_limit is None:
        return None

    count = await get_candidate_count_after_deployment(db, recruiter_id)

    if count >= plan_limit:
        return "You have reached your plan limit. Please choose a subscription plan to continue assessing additional candidates."
    return None
