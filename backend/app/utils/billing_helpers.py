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

async def get_candidate_count_after_deployment(db, recruiter_id: str) -> float:
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
            return float(consumed)
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


# ── Fractional billing increments ─────────────────────────────────────────────
# Each action contributes a partial amount toward a candidate's full 1.0 slot:
#   +0.50  candidate added
#   +0.50  assessment OR interview sent (sending either or both only counts once
#          towards the evaluation phase — the first to be sent charges 0.50,
#          and no additional charge is levied for the second action)
#   ─────
#   1.00   total for a fully-processed candidate
_BILLING_ADD_COST        = 0.50
_BILLING_ASSESSMENT_COST = 0.50
_BILLING_INTERVIEW_COST  = 0.50


async def _consume_slot(
    db, 
    recruiter_id: str, 
    amount: float, 
    action_label: str,
    candidate_id: Optional[str] = None,
    job_id: Optional[str] = None
) -> Optional[str]:
    """Atomically increment candidates_consumed by `amount`.

    Checks the plan limit first, then does a direct atomic increment using
    a PostgreSQL stored procedure to avoid Python closure variable-capture bugs.
    Returns an error message string on failure, or None on success.
    """
    # Step 1: Fetch profile to do the limit check
    def _fetch():
        return (
            db.client.from_("profiles")
            .select("subscription_plan, candidates_consumed")
            .eq("user_id", recruiter_id)
            .maybe_single()
            .execute()
        )

    try:
        p_res = await db.run(_fetch)
        profile = getattr(p_res, "data", None) or {}

        plan = _normalize_plan(profile.get("subscription_plan"))
        plan_config = BILLING_PLAN_CONFIG.get(plan, BILLING_PLAN_CONFIG["free"])
        plan_limit = plan_config.get("candidates")

        current_consumed = float(profile.get("candidates_consumed") or 0)

        # Enterprise plan has custom/unlimited limits
        if plan_limit is not None and current_consumed >= plan_limit:
            return "You have reached your plan limit. Please choose a subscription plan to continue assessing additional candidates."

        new_value = round(current_consumed + amount, 2)

        # Step 2: Perform a direct atomic update.
        # Freeze captured values as default args to avoid Python late-binding closure bug.
        def _update(_nv=new_value, _uid=recruiter_id):
            return (
                db.client.from_("profiles")
                .update({"candidates_consumed": _nv})
                .eq("user_id", _uid)
                .execute()
            )

        update_res = await db.run(_update)
        updated_data = getattr(update_res, "data", [])

        if updated_data:
            logger.info(
                "[billing_helpers] %s recruiter=%s +%.2f → %.2f",
                action_label, recruiter_id, amount, new_value,
            )
            
            # Log usage history
            def _log_usage(_r=recruiter_id, _c=candidate_id, _j=job_id, _a=action_label, _p=amount):
                return (
                    db.client.from_("billing_usage_history")
                    .insert({
                        "recruiter_id": _r,
                        "candidate_id": _c,
                        "job_id": _j,
                        "action_type": _a,
                        "points_used": _p
                    })
                    .execute()
                )
            try:
                await db.run(_log_usage)
            except Exception as e:
                logger.error("[billing_helpers] Failed to log usage history: %s", e)

            return None  # Successfully consumed

        # If update returned empty, profile may not exist — create it
        logger.warning("[billing_helpers] _consume_slot: update returned empty for user=%s", recruiter_id)
        return None  # Non-fatal — candidate was already added

    except Exception as exc:
        logger.error("[billing_helpers] Error in _consume_slot(%s): %s", action_label, exc)
        return "Failed to validate candidate limit. Please try again."


async def consume_candidate_slot(
    db, 
    recruiter_id: str, 
    candidate_id: Optional[str] = None, 
    job_id: Optional[str] = None
) -> Optional[str]:
    """Consume exactly +0.50 for adding a candidate."""
    return await _consume_slot(db, recruiter_id, _BILLING_ADD_COST, "candidate added", candidate_id, job_id)


async def _has_evaluation_charge(db, recruiter_id: str, candidate_id: Optional[str]) -> bool:
    """Return True if the recruiter has already been billed the evaluation phase
    (+0.50) for this candidate — i.e., an 'assessment sent' or 'interview sent'
    entry already exists in billing_usage_history.
    """
    if not candidate_id:
        return False

    def _check(_r=recruiter_id, _c=candidate_id):
        return (
            db.client.from_("billing_usage_history")
            .select("id")
            .eq("recruiter_id", _r)
            .eq("candidate_id", _c)
            .in_("action_type", ["assessment sent", "interview sent"])
            .limit(1)
            .execute()
        )

    try:
        res = await db.run(_check)
        rows = getattr(res, "data", None) or []
        return len(rows) > 0
    except Exception as exc:
        logger.warning("[billing_helpers] _has_evaluation_charge check failed: %s", exc)
        return False


async def _log_zero_charge_event(
    db,
    recruiter_id: str,
    action_label: str,
    candidate_id: Optional[str],
    job_id: Optional[str],
) -> None:
    """Insert a history row with 0 points so the action is visible even when skipped."""
    def _insert(_r=recruiter_id, _c=candidate_id, _j=job_id, _a=action_label):
        return (
            db.client.from_("billing_usage_history")
            .insert({
                "recruiter_id": _r,
                "candidate_id": _c,
                "job_id": _j,
                "action_type": _a,
                "points_used": 0.00,
            })
            .execute()
        )
    try:
        await db.run(_insert)
    except Exception as exc:
        logger.warning("[billing_helpers] _log_zero_charge_event failed: %s", exc)


async def consume_assessment_slot(
    db,
    recruiter_id: str,
    candidate_id: Optional[str] = None,
    job_id: Optional[str] = None
) -> Optional[str]:
    """Consume +0.50 for the evaluation phase (assessment sent).

    If an evaluation charge already exists for this candidate, logs a 0-point
    history entry so the action remains visible, then returns None (no counter change).
    """
    if await _has_evaluation_charge(db, recruiter_id, candidate_id):
        logger.info(
            "[billing_helpers] assessment sent: evaluation phase already billed for "
            "recruiter=%s candidate=%s — logging 0-point entry",
            recruiter_id, candidate_id,
        )
        await _log_zero_charge_event(db, recruiter_id, "assessment sent", candidate_id, job_id)
        return None
    return await _consume_slot(db, recruiter_id, _BILLING_ASSESSMENT_COST, "assessment sent", candidate_id, job_id)


async def consume_interview_slot(
    db,
    recruiter_id: str,
    candidate_id: Optional[str] = None,
    job_id: Optional[str] = None
) -> Optional[str]:
    """Consume +0.50 for the evaluation phase (interview sent).

    If an evaluation charge already exists for this candidate, logs a 0-point
    history entry so the action remains visible, then returns None (no counter change).
    """
    if await _has_evaluation_charge(db, recruiter_id, candidate_id):
        logger.info(
            "[billing_helpers] interview sent: evaluation phase already billed for "
            "recruiter=%s candidate=%s — logging 0-point entry",
            recruiter_id, candidate_id,
        )
        await _log_zero_charge_event(db, recruiter_id, "interview sent", candidate_id, job_id)
        return None
    return await _consume_slot(db, recruiter_id, _BILLING_INTERVIEW_COST, "interview sent", candidate_id, job_id)

async def refund_candidate_slot(db, recruiter_id: str) -> None:
    """Atomically decrement candidates_consumed by 0.50 (reverses a candidate-add charge)."""
    def _fetch():
        return (
            db.client.from_("profiles")
            .select("candidates_consumed")
            .eq("user_id", recruiter_id)
            .maybe_single()
            .execute()
        )

    try:
        p_res = await db.run(_fetch)
        profile = getattr(p_res, "data", None) or {}
        current_consumed = profile.get("candidates_consumed")

        if current_consumed is None or float(current_consumed) <= 0:
            return  # Nothing to refund

        new_value = round(max(0.0, float(current_consumed) - _BILLING_ADD_COST), 2)

        # Freeze captured values as default args to avoid Python late-binding closure bug.
        def _update(_nv=new_value, _uid=recruiter_id):
            return (
                db.client.from_("profiles")
                .update({"candidates_consumed": _nv})
                .eq("user_id", _uid)
                .execute()
            )

        update_res = await db.run(_update)
        updated_data = getattr(update_res, "data", [])

        if updated_data:
            logger.info(
                "[billing_helpers] refund_candidate_slot recruiter=%s -0.50 → %.2f",
                recruiter_id, new_value,
            )
    except Exception as exc:
        logger.error("[billing_helpers] Error in refund_candidate_slot: %s", exc)


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


# ── Company-Aware Credit Helpers ──────────────────────────────────────────────
# These extend the existing individual plan logic.
# If a user is an active company member, company seat credits take priority.

async def _get_active_company_membership(db, user_id: str) -> Optional[Dict[str, Any]]:
    """Return active company_members row for user, or None."""
    def _f():
        return (
            db.client.from_("company_members")
            .select("*, companies(id, name, status)")
            .eq("user_id", user_id)
            .eq("status", "active")
            .maybe_single()
            .execute()
        )
    try:
        res = await db.run(_f)
        data = getattr(res, "data", None)
        return data if isinstance(data, dict) else None
    except Exception:
        return None


async def get_effective_credit_limit(db, user_id: str) -> Optional[int]:
    """
    Returns the effective candidate credit limit for a user.
    Priority: company seat allocation > individual plan limit.
    Returns None for unlimited (enterprise plan with no company).
    """
    membership = await _get_active_company_membership(db, user_id)
    if membership:
        return int(membership.get("credits_allocated") or 0)
    # Fall back to individual plan
    def _f():
        return db.client.from_("profiles").select("subscription_plan").eq("user_id", user_id).maybe_single().execute()
    try:
        res = await db.run(_f)
        profile = getattr(res, "data", None) or {}
        plan = _normalize_plan(profile.get("subscription_plan"))
        plan_config = BILLING_PLAN_CONFIG.get(plan, BILLING_PLAN_CONFIG["free"])
        return plan_config.get("candidates")  # None = unlimited (enterprise)
    except Exception:
        return BILLING_PLAN_CONFIG["free"]["candidates"]


async def get_effective_credits_consumed(db, user_id: str) -> float:
    """Return credits consumed for a user — from company seat or individual profile."""
    membership = await _get_active_company_membership(db, user_id)
    if membership:
        return float(membership.get("credits_consumed") or 0)
    return await get_candidate_count_after_deployment(db, user_id)


async def consume_company_member_slot(
    db,
    user_id: str,
    amount: float,
    action_label: str,
    candidate_id: Optional[str] = None,
    job_id: Optional[str] = None,
    activity_description: Optional[str] = None,
) -> Optional[str]:
    """
    Company-aware slot consumption.
    If user is an active company member: deducts from company_members.credits_consumed
    and company_credits.total_consumed, writes activity feed entry.
    Otherwise: falls through to the standard individual _consume_slot.
    Returns error string or None on success.
    """
    membership = await _get_active_company_membership(db, user_id)
    if not membership:
        # Individual plan — use existing logic
        return await _consume_slot(db, user_id, amount, action_label, candidate_id, job_id)

    company_id = membership.get("company_id") or (membership.get("companies") or {}).get("id")
    member_id = membership.get("id")
    credits_allocated = int(membership.get("credits_allocated") or 0)
    credits_consumed = float(membership.get("credits_consumed") or 0)

    if credits_consumed + amount > credits_allocated:
        return "You have reached your company seat credit limit. Please ask your company owner to allocate more credits."

    new_consumed = round(credits_consumed + amount, 2)
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()

    counter_col = None
    action_norm = action_label.lower()
    if action_norm in ("candidate added", "candidate_added"):
        counter_col = "candidates_added"
    elif action_norm in ("assessment sent", "assessment_sent"):
        counter_col = "assessments_sent"
    elif action_norm in ("interview sent", "interview_sent"):
        counter_col = "interviews_sent"
    elif action_norm in ("job posted", "job_posted"):
        counter_col = "jobs_posted"
    elif action_norm in ("hire marked", "hire_marked"):
        counter_col = "hires"

    update_dict = {"credits_consumed": new_consumed, "updated_at": now}
    if counter_col:
        update_dict[counter_col] = int(membership.get(counter_col) or 0) + 1

    # Update member credits_consumed and counter
    def _update_member(_mid=member_id, _ud=update_dict):
        return db.client.from_("company_members").update(_ud).eq("id", _mid).execute()
    await db.run(_update_member)

    # Update company credit pool
    if company_id:
        def _update_company(_c=company_id, _a=amount):
            return db.client.from_("company_credits").update({
                "total_consumed": db.client.rpc("increment_company_credits_consumed", {"p_company_id": _c, "p_amount": _a}),
                "updated_at": now,
            }).eq("company_id", _c).execute()
        # Direct increment approach — simpler with fetch + update
        try:
            def _fetch_pool(_c=company_id):
                return db.client.from_("company_credits").select("total_consumed").eq("company_id", _c).maybe_single().execute()
            pool_res = await db.run(_fetch_pool)
            pool = getattr(pool_res, "data", None) or {}
            new_pool_consumed = round(float(pool.get("total_consumed") or 0) + amount, 2)

            def _update_pool(_c=company_id, _nv=new_pool_consumed):
                return db.client.from_("company_credits").update({"total_consumed": _nv, "updated_at": now}).eq("company_id", _c).execute()
            await db.run(_update_pool)
        except Exception as exc:
            logger.warning("[billing] company_credits pool update failed: %s", exc)

    # Also log to billing_usage_history for consistency
    def _log(_r=user_id, _c=candidate_id, _j=job_id, _a=action_label, _p=amount):
        return db.client.from_("billing_usage_history").insert({
            "recruiter_id": _r,
            "candidate_id": _c,
            "job_id": _j,
            "action_type": _a,
            "points_used": _p,
        }).execute()
    try:
        await db.run(_log)
    except Exception as exc:
        logger.warning("[billing] usage_history log failed for company member: %s", exc)

    if company_id and action_norm in ("candidate added", "candidate_added", "assessment sent", "assessment_sent", "interview sent", "interview_sent", "job posted", "job_posted", "hire marked", "hire_marked"):
        feed_action = action_norm.replace(" ", "_")
        desc = activity_description
        if not desc:
            if feed_action == "candidate_added": desc = "Added a new candidate"
            elif feed_action == "assessment_sent": desc = "Sent an assessment"
            elif feed_action == "interview_sent": desc = "Sent an AI interview"
            elif feed_action == "job_posted": desc = "Posted a new job"
            elif feed_action == "hire_marked": desc = "Marked a candidate as hired"
            else: desc = f"Performed {action_label}"
            
        def _log_activity():
            return db.client.from_("company_activity_feed").insert({
                "company_id": company_id,
                "user_id": user_id,
                "action_type": feed_action,
                "description": desc,
                "metadata": {"job_id": job_id, "candidate_id": candidate_id}
            }).execute()
        try:
            await db.run(_log_activity)
        except Exception as exc:
            logger.warning("[billing] activity feed log failed: %s", exc)

    logger.info("[billing] company_member %s +%.2f → %.2f (company=%s)", user_id, amount, new_consumed, company_id)
    return None  # Success
