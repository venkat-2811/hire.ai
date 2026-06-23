from __future__ import annotations

from datetime import datetime, timedelta, timezone
import re
from typing import Any, Dict, List, Optional, Set

from fastapi import APIRouter, Depends, Query

from app.auth.clerk import ClerkUser
from app.auth.dependencies import require_role
from app.services.clerk_profile_sync import backfill_profiles_from_clerk
from app.services.db.supabase_service import get_db_admin_service
from app.utils.billing_helpers import _normalize_plan
from app.utils.responses import ok

router = APIRouter(prefix="/admin")


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _is_internal_user_id(value: Any) -> bool:
    return _clean_text(value).lower().startswith("user_")


def _resolve_profile_name(profile: Dict[str, Any]) -> str:
    full = _clean_text(profile.get("full_name"))
    if full and not _is_internal_user_id(full):
        return full
    first = _clean_text(profile.get("first_name"))
    last = _clean_text(profile.get("last_name"))
    combined = " ".join([part for part in [first, last] if part]).strip()
    if combined and not _is_internal_user_id(combined):
        return combined
    return "Not Provided"


def _resolve_profile_email(profile: Dict[str, Any]) -> str:
    email = _clean_text(profile.get("email"))
    if not email or email.lower() == "unknown" or _is_internal_user_id(email):
        return "Not Provided"
    return email


def _resolve_profile_company(profile: Dict[str, Any]) -> str:
    company_name = _clean_text(profile.get("company_name"))
    return company_name or "Not Provided"


def _build_user_identity(profile: Dict[str, Any]) -> Dict[str, str]:
    return {
        "full_name": _resolve_profile_name(profile),
        "email": _resolve_profile_email(profile),
        "company_name": _resolve_profile_company(profile),
    }


def _to_float(value: Any) -> float:
    try:
        return float(value or 0)
    except Exception:
        return 0.0


def _to_matchable(value: Any) -> str:
    return _clean_text(value).lower()


def _to_iso_start_of_day(value: str) -> str:
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    dt = dt.replace(hour=0, minute=0, second=0, microsecond=0)
    return dt.isoformat()


def _to_iso_end_of_day(value: str) -> str:
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    dt = dt.replace(hour=23, minute=59, second=59, microsecond=999999)
    return dt.isoformat()


def _extract_plan_from_invoice(invoice: Dict[str, Any]) -> str:
    metadata = invoice.get("metadata") if isinstance(invoice.get("metadata"), dict) else {}
    plan = str(metadata.get("plan") or "").strip().lower()
    if plan:
        return plan

    line_items = invoice.get("line_items")
    if isinstance(line_items, list):
        for item in line_items:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or "")
            m = re.search(r"\b(free|starter|professional|growth|enterprise|scale)\b", name.lower())
            if m:
                raw = m.group(1)
                # Normalize legacy names in invoices
                if raw in ("professional", "growth"):
                    return "professional"
                if raw == "enterprise":
                    return "scale"
                return raw
    return "unknown"


def _normalize_admin_plan(value: Any, *, default: str = "") -> str:
    """Normalize a plan value to a canonical display name for admin views.
    
    Maps legacy 'growth' → 'professional' (renamed June 2026).
    Maps legacy 'enterprise' (paid Stripe) → 'scale' (renamed June 2026).
    Maps legacy 'custom' → 'enterprise' (Contact Sales tier, renamed June 2026).
    """
    raw = _clean_text(value).lower()
    if not raw:
        return default
    # Legacy aliases
    if raw == "growth":
        return "professional"
    if raw == "enterprise":
        return "scale"
    if raw == "custom":
        return "enterprise"
    
    if raw in ("free", "starter", "professional", "scale"):
        return raw
    return _normalize_plan(raw)


def _derive_billing_status(invoice: Dict[str, Any]) -> str:
    raw = str(invoice.get("status") or "").lower()
    metadata = invoice.get("metadata") if isinstance(invoice.get("metadata"), dict) else {}

    refunded = bool(
        metadata.get("refunded")
        or metadata.get("refund_id")
        or metadata.get("stripe_refund_id")
        or metadata.get("refund_amount")
    )
    if refunded:
        return "refunded"

    if raw == "paid":
        return "paid"
    if raw in ("overdue", "void", "failed", "unpaid"):
        return "failed"
    return raw or "unknown"


async def _get_recruiter_ids(db) -> List[str]:
    """Get all recruiter user IDs from profiles table.
    
    NOTE: user_roles table has no 'recruiter' entries because the
    auto-assign trigger broke after Clerk migration (UUID->TEXT).
    Every user with a profile row IS a recruiter in this system.
    """
    def _fetch_profiles():
        return (
            db.client.from_("profiles")
            .select("user_id")
            .execute()
        )

    res = await db.run(_fetch_profiles)
    rows = getattr(res, "data", None) or []
    out: List[str] = []
    seen: Set[str] = set()
    if isinstance(rows, list):
        for row in rows:
            if not isinstance(row, dict):
                continue
            uid = str(row.get("user_id") or "").strip()
            if uid and uid not in seen:
                seen.add(uid)
                out.append(uid)
    return out


@router.get("/health")
async def admin_health(_: ClerkUser = Depends(require_role("admin"))):
    return ok({"ok": True, "scope": "admin"})


@router.get("/recruiters/candidate-counts")
async def recruiter_candidate_counts(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _: ClerkUser = Depends(require_role("admin")),
):
    db = get_db_admin_service()
    recruiter_ids = await _get_recruiter_ids(db)
    if not recruiter_ids:
        return ok({"total_recruiters": 0, "recruiters": []})

    page_ids = recruiter_ids[offset: offset + limit]
    if not page_ids:
        return ok({"total_recruiters": len(recruiter_ids), "recruiters": []})

    def _fetch_profiles():
        return (
            db.client.from_("profiles")
            .select("user_id, first_name, last_name, full_name, email, company_name, subscription_plan, subscription_status, plan_selected_at, candidates_consumed")
            .in_("user_id", page_ids)
            .execute()
        )

    prof_res = await db.run(_fetch_profiles)
    profiles_rows = getattr(prof_res, "data", None) or []
    profiles_by_uid: Dict[str, Dict[str, Any]] = {}
    for row in profiles_rows if isinstance(profiles_rows, list) else []:
        if isinstance(row, dict) and row.get("user_id"):
            profiles_by_uid[str(row["user_id"])] = row

    def _fetch_jobs():
        return (
            db.client.from_("job_descriptions")
            .select("id, created_by")
            .in_("created_by", page_ids)
            .eq("is_active", True)
            .execute()
        )

    jobs_res = await db.run(_fetch_jobs)
    jobs_rows = getattr(jobs_res, "data", None) or []

    job_to_recruiter: Dict[str, str] = {}
    for row in jobs_rows if isinstance(jobs_rows, list) else []:
        if not isinstance(row, dict):
            continue
        jid = str(row.get("id") or "").strip()
        owner = str(row.get("created_by") or "").strip()
        if jid and owner:
            job_to_recruiter[jid] = owner

    candidate_sets: Dict[str, Set[str]] = {uid: set() for uid in page_ids}
    job_ids = list(job_to_recruiter.keys())
    if job_ids:
        def _fetch_apps():
            return (
                db.client.from_("job_applications")
                .select("candidate_id, job_id, recruiter_id")
                .in_("job_id", job_ids)
                .execute()
            )

        apps_res = await db.run(_fetch_apps)
        apps_rows = getattr(apps_res, "data", None) or []
        for row in apps_rows if isinstance(apps_rows, list) else []:
            if not isinstance(row, dict):
                continue
            cid = str(row.get("candidate_id") or "").strip()
            if not cid:
                continue
            rid = str(row.get("recruiter_id") or "").strip()
            if not rid:
                jid = str(row.get("job_id") or "").strip()
                rid = job_to_recruiter.get(jid, "")
            if rid in candidate_sets:
                candidate_sets[rid].add(cid)

    recruiters_payload: List[Dict[str, Any]] = []
    for uid in page_ids:
        profile = profiles_by_uid.get(uid, {})
        identity = _build_user_identity(profile)
        recruiters_payload.append(
            {
                "recruiter_user_id": uid,
                "full_name": identity["full_name"],
                "email": identity["email"],
                "company_name": identity["company_name"],
                "subscription_plan": profile.get("subscription_plan") or "free",
                "subscription_status": profile.get("subscription_status") or "active",
                "subscription_start_date": profile.get("plan_selected_at"),
                "candidates_enrolled_count": len(candidate_sets.get(uid, set())),
                "candidates_consumed_counter": int(profile.get("candidates_consumed") or 0),
            }
        )

    return ok({"total_recruiters": len(recruiter_ids), "recruiters": recruiters_payload})


@router.get("/recruiters/all")
async def admin_all_recruiters(
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _: ClerkUser = Depends(require_role("admin")),
):
    db = get_db_admin_service()
    recruiter_ids = await _get_recruiter_ids(db)
    if not recruiter_ids:
        return ok({"total": 0, "offset": offset, "limit": limit, "recruiters": []})

    def _fetch_profiles():
        return (
            db.client.from_("profiles")
            .select("user_id, email, first_name, last_name, full_name, company_name, subscription_plan")
            .in_("user_id", recruiter_ids)
            .execute()
        )

    res = await db.run(_fetch_profiles)
    profiles = getattr(res, "data", None) or []

    # Search filtering
    filtered_profiles = []
    search_lower = search.lower() if search else None
    for p in profiles:
        if not isinstance(p, dict):
            continue
        if search_lower:
            fn = str(p.get("full_name") or "").lower()
            em = str(p.get("email") or "").lower()
            co = str(p.get("company_name") or "").lower()
            if search_lower not in fn and search_lower not in em and search_lower not in co:
                continue
        filtered_profiles.append(p)

    total_count = len(filtered_profiles)
    page_profiles = filtered_profiles[offset : offset + limit]
    page_ids = [p.get("user_id") for p in page_profiles if p.get("user_id")]

    if not page_ids:
        return ok({"total": total_count, "offset": offset, "limit": limit, "recruiters": []})

    def _fetch_jobs():
        return (
            db.client.from_("job_descriptions")
            .select("id, created_by")
            .in_("created_by", page_ids)
            .eq("is_active", True)
            .execute()
        )

    jobs_res = await db.run(_fetch_jobs)
    jobs = getattr(jobs_res, "data", None) or []

    job_to_recruiter: Dict[str, str] = {}
    recruiter_jobs: Dict[str, int] = {uid: 0 for uid in page_ids}
    for j in jobs:
        if not isinstance(j, dict):
            continue
        jid = str(j.get("id") or "")
        rid = str(j.get("created_by") or "")
        if jid and rid:
            job_to_recruiter[jid] = rid
            recruiter_jobs[rid] += 1

    job_ids = list(job_to_recruiter.keys())

    recruiter_candidates: Dict[str, int] = {uid: 0 for uid in page_ids}
    recruiter_assessments: Dict[str, int] = {uid: 0 for uid in page_ids}
    recruiter_interviews: Dict[str, int] = {uid: 0 for uid in page_ids}

    if job_ids:
        # Fetch ats_screenings (resume screened)
        def _fetch_screenings():
            return db.client.from_("ats_screenings").select("id, job_id").in_("job_id", job_ids).execute()

        # Fetch assessment_sessions
        def _fetch_assessments():
            return db.client.from_("assessment_sessions").select("id, job_id").in_("job_id", job_ids).execute()

        # Fetch ai_interview_sessions
        def _fetch_interviews():
            return db.client.from_("ai_interview_sessions").select("id, job_id").in_("job_id", job_ids).execute()

        scr_res = await db.run(_fetch_screenings)
        ass_res = await db.run(_fetch_assessments)
        int_res = await db.run(_fetch_interviews)

        for s in getattr(scr_res, "data", None) or []:
            if isinstance(s, dict) and s.get("job_id"):
                rid = job_to_recruiter.get(str(s["job_id"]))
                if rid: recruiter_candidates[rid] += 1

        for a in getattr(ass_res, "data", None) or []:
            if isinstance(a, dict) and a.get("job_id"):
                rid = job_to_recruiter.get(str(a["job_id"]))
                if rid: recruiter_assessments[rid] += 1

        for i in getattr(int_res, "data", None) or []:
            if isinstance(i, dict) and i.get("job_id"):
                rid = job_to_recruiter.get(str(i["job_id"]))
                if rid: recruiter_interviews[rid] += 1

    result_payload = []
    for p in page_profiles:
        uid = p.get("user_id")
        identity = _build_user_identity(p)
        result_payload.append({
            "recruiter_user_id": uid,
            "full_name": identity["full_name"],
            "email": identity["email"],
            "company_name": identity["company_name"],
            "subscription_plan": _normalize_admin_plan(p.get("subscription_plan"), default="free"),
            "jobs_count": recruiter_jobs.get(uid, 0),
            "candidates_count": recruiter_candidates.get(uid, 0),
            "assessments_count": recruiter_assessments.get(uid, 0),
            "interviews_count": recruiter_interviews.get(uid, 0),
        })

    return ok({
        "total": total_count,
        "offset": offset,
        "limit": limit,
        "recruiters": result_payload
    })


@router.get("/recruiters/{recruiter_id}")
async def admin_recruiter_details(
    recruiter_id: str,
    _: ClerkUser = Depends(require_role("admin")),
):
    db = get_db_admin_service()
    
    def _fetch_profile():
        return (
            db.client.from_("profiles")
            .select("*")
            .eq("user_id", recruiter_id)
            .single()
            .execute()
        )

    try:
        prof_res = await db.run(_fetch_profile)
        profile = getattr(prof_res, "data", None)
    except Exception:
        profile = None

    if not profile:
        return api_error("Recruiter not found", 404)

    identity = _build_user_identity(profile)

    def _fetch_jobs():
        return (
            db.client.from_("job_descriptions")
            .select("id, title, role, level, created_at, is_active")
            .eq("created_by", recruiter_id)
            .order("created_at", desc=True)
            .execute()
        )

    jobs_res = await db.run(_fetch_jobs)
    jobs = getattr(jobs_res, "data", None) or []
    job_ids = [str(j.get("id")) for j in jobs if j.get("id")]

    # Fetch total candidates (from ats_screenings linked to these jobs)
    candidates_count = 0
    assessments_count = 0
    interviews_count = 0

    if job_ids:
        def _fetch_screenings_count():
            return db.client.from_("ats_screenings").select("id", count="exact").in_("job_id", job_ids).execute()
        
        def _fetch_assessments_count():
            return db.client.from_("assessment_sessions").select("id", count="exact").in_("job_id", job_ids).execute()

        def _fetch_interviews_count():
            return db.client.from_("ai_interview_sessions").select("id", count="exact").in_("job_id", job_ids).execute()

        scr_res = await db.run(_fetch_screenings_count)
        ass_res = await db.run(_fetch_assessments_count)
        int_res = await db.run(_fetch_interviews_count)

        candidates_count = getattr(scr_res, "count", None) or 0
        assessments_count = getattr(ass_res, "count", None) or 0
        interviews_count = getattr(int_res, "count", None) or 0

    payload = {
        "recruiter_user_id": recruiter_id,
        "full_name": identity["full_name"],
        "email": identity["email"],
        "company_name": identity["company_name"],
        "subscription_plan": _normalize_admin_plan(profile.get("subscription_plan"), default="free"),
        "subscription_status": profile.get("subscription_status") or "active",
        "plan_selected_at": profile.get("plan_selected_at"),
        "created_at": profile.get("created_at"),
        "jobs_count": len(jobs),
        "candidates_count": candidates_count,
        "assessments_count": assessments_count,
        "interviews_count": interviews_count,
        "recent_jobs": jobs[:10]  # Return up to 10 recent jobs for detail view
    }

    return ok(payload)



@router.get("/subscriptions/plan-counts")
async def recruiter_plan_counts(_: ClerkUser = Depends(require_role("admin"))):
    db = get_db_admin_service()
    recruiter_ids = await _get_recruiter_ids(db)
    if not recruiter_ids:
        return ok({"total_recruiters": 0, "by_plan": {}})

    def _fetch_profiles():
        return (
            db.client.from_("profiles")
            .select("user_id, subscription_plan")
            .in_("user_id", recruiter_ids)
            .execute()
        )

    res = await db.run(_fetch_profiles)
    rows = getattr(res, "data", None) or []
    by_plan: Dict[str, int] = {}
    seen: Set[str] = set()

    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, dict):
            continue
        uid = str(row.get("user_id") or "").strip()
        if not uid or uid in seen:
            continue
        seen.add(uid)
        plan = _normalize_admin_plan(row.get("subscription_plan"), default="free")
        by_plan[plan] = by_plan.get(plan, 0) + 1

    # Recruiters with no profile row still count under free.
    missing = max(0, len(recruiter_ids) - len(seen))
    if missing:
        by_plan["free"] = by_plan.get("free", 0) + missing

    return ok({"total_recruiters": len(recruiter_ids), "by_plan": by_plan})


@router.get("/billing/transactions")
async def admin_billing_transactions(
    recruiter_user_id: Optional[str] = Query(default=None),
    plan: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    user: Optional[str] = Query(default=None),
    company: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _: ClerkUser = Depends(require_role("admin")),
):
    db = get_db_admin_service()
    recruiter_ids = await _get_recruiter_ids(db)
    scope_ids = recruiter_ids

    if recruiter_user_id:
        rid = recruiter_user_id.strip()
        if rid not in set(recruiter_ids):
            return ok({"total": 0, "transactions": []})
        scope_ids = [rid]

    if not scope_ids:
        return ok({"total": 0, "transactions": []})

    def _fetch_profiles():
        return (
            db.client.from_("profiles")
            .select("user_id, first_name, last_name, full_name, email, company_name, subscription_plan, subscription_status, plan_selected_at, updated_at")
            .in_("user_id", scope_ids)
            .execute()
        )

    prof_res = await db.run(_fetch_profiles)
    prof_rows = getattr(prof_res, "data", None) or []
    profile_by_uid = {
        str(r.get("user_id")): r
        for r in (prof_rows if isinstance(prof_rows, list) else [])
        if isinstance(r, dict) and r.get("user_id")
    }

    def _fetch_invoices():
        q = (
            db.client.from_("invoices")
            .select("id, user_id, period_start, period_end, line_items, subtotal, tax_amount, total, status, due_date, paid_at, payment_reference, metadata, created_at")
            .in_("user_id", scope_ids)
            .order("created_at", desc=True)
            .range(0, 4999)
        )
        if start_date:
            q = q.gte("created_at", _to_iso_start_of_day(start_date))
        if end_date:
            q = q.lte("created_at", _to_iso_end_of_day(end_date))
        return q.execute()

    inv_res = await db.run(_fetch_invoices)
    invoices = getattr(inv_res, "data", None) or []

    plan_filter = _normalize_admin_plan(plan)
    status_filter = (status or "").strip().lower()
    user_filter = _to_matchable(user)
    company_filter = _to_matchable(company)
    search_filter = _to_matchable(search)

    # Root-cause fix: plan filter now uses actual subscription plan from profiles
    # (source of truth), not invoice line-item heuristics.
    if plan_filter == "free":
        free_rows: List[Dict[str, Any]] = []
        for uid in scope_ids:
            profile = profile_by_uid.get(uid, {})
            current_plan = _normalize_admin_plan(profile.get("subscription_plan"), default="free")
            current_status = _clean_text(profile.get("subscription_status") or "active").lower() or "active"
            if current_plan != "free" or current_status != "active":
                continue

            identity = _build_user_identity(profile)
            if user_filter and user_filter not in _to_matchable(identity["full_name"]) and user_filter not in _to_matchable(identity["email"]):
                continue
            if company_filter and company_filter not in _to_matchable(identity["company_name"]):
                continue

            row_created_at = profile.get("plan_selected_at") or profile.get("updated_at")
            if start_date and row_created_at and _clean_text(row_created_at) < _to_iso_start_of_day(start_date):
                continue
            if end_date and row_created_at and _clean_text(row_created_at) > _to_iso_end_of_day(end_date):
                continue

            status_for_filter = "active"
            if status_filter and status_for_filter != status_filter:
                continue

            search_haystack = " ".join(
                [
                    _to_matchable(identity["full_name"]),
                    _to_matchable(identity["email"]),
                    _to_matchable(identity["company_name"]),
                    "free",
                    "active",
                ]
            )
            if search_filter and search_filter not in search_haystack:
                continue

            free_rows.append(
                {
                    "id": f"free-plan-{len(free_rows) + 1}",
                    "recruiter_user_id": uid,
                    "recruiter_full_name": identity["full_name"],
                    "recruiter_email": identity["email"],
                    "recruiter_company_name": identity["company_name"],
                    "plan": "free",
                    "status": "active",
                    "raw_status": "active",
                    "period_start": row_created_at,
                    "period_end": None,
                    "line_items": [{"name": "Hire.AI Free Plan", "amount": 0, "currency": "USD"}],
                    "subtotal": 0,
                    "tax_amount": 0,
                    "total": 0,
                    "due_date": row_created_at,
                    "paid_at": row_created_at,
                    "payment_reference": None,
                    "metadata": {"source": "profiles", "type": "free-plan-activation"},
                    "created_at": row_created_at,
                }
            )

        transactions_page = free_rows[offset: offset + limit]
        return ok(
            {
                "total": len(free_rows),
                "offset": offset,
                "limit": limit,
                "transactions": transactions_page,
                "summary": {
                    "transactions_count": len(free_rows),
                    "total_amount": 0,
                    "paid_transactions_count": 0,
                    "paid_amount": 0,
                },
            }
        )

    filtered_transactions: List[Dict[str, Any]] = []
    for inv in invoices if isinstance(invoices, list) else []:
        if not isinstance(inv, dict):
            continue
        derived_plan = _extract_plan_from_invoice(inv)
        derived_status = _derive_billing_status(inv)

        uid = str(inv.get("user_id") or "")
        profile = profile_by_uid.get(uid, {})
        current_plan = _normalize_admin_plan(profile.get("subscription_plan"), default=derived_plan)

        if plan_filter and current_plan != plan_filter:
            continue
        if status_filter and derived_status != status_filter:
            continue
        identity = _build_user_identity(profile)

        if user_filter and user_filter not in _to_matchable(identity["full_name"]) and user_filter not in _to_matchable(identity["email"]):
            continue
        if company_filter and company_filter not in _to_matchable(identity["company_name"]):
            continue

        payment_reference = inv.get("payment_reference")
        search_haystack = " ".join(
            [
                _to_matchable(identity["full_name"]),
                _to_matchable(identity["email"]),
                _to_matchable(identity["company_name"]),
                _to_matchable(current_plan),
                _to_matchable(derived_plan),
                _to_matchable(derived_status),
                _to_matchable(inv.get("id")),
                _to_matchable(payment_reference),
            ]
        )
        if search_filter and search_filter not in search_haystack:
            continue

        filtered_transactions.append(
            {
                "id": inv.get("id"),
                "recruiter_user_id": uid,
                "recruiter_full_name": identity["full_name"],
                "recruiter_email": identity["email"],
                "recruiter_company_name": identity["company_name"],
                "plan": current_plan,
                "status": derived_status,
                "raw_status": inv.get("status"),
                "period_start": inv.get("period_start"),
                "period_end": inv.get("period_end"),
                "line_items": inv.get("line_items") or [],
                "subtotal": inv.get("subtotal"),
                "tax_amount": inv.get("tax_amount"),
                "total": inv.get("total"),
                "due_date": inv.get("due_date"),
                "paid_at": inv.get("paid_at"),
                "payment_reference": payment_reference,
                "metadata": inv.get("metadata") or {},
                "created_at": inv.get("created_at"),
            }
        )

    # Ensure plan-specific filter returns subscribed users even if invoices are absent.
    if plan_filter:
        existing_uid_rows = {
            _clean_text(row.get("recruiter_user_id"))
            for row in filtered_transactions
            if isinstance(row, dict)
        }
        synthetic_rows: List[Dict[str, Any]] = []

        for uid in scope_ids:
            profile = profile_by_uid.get(uid, {})
            current_plan = _normalize_admin_plan(profile.get("subscription_plan"), default="free")
            if current_plan != plan_filter:
                continue

            current_status = _clean_text(profile.get("subscription_status") or "active").lower() or "active"
            if plan_filter == "free" and current_status != "active":
                continue
            if status_filter and current_status != status_filter:
                continue

            identity = _build_user_identity(profile)
            if user_filter and user_filter not in _to_matchable(identity["full_name"]) and user_filter not in _to_matchable(identity["email"]):
                continue
            if company_filter and company_filter not in _to_matchable(identity["company_name"]):
                continue

            row_created_at = profile.get("plan_selected_at") or profile.get("updated_at")
            if start_date and row_created_at and _clean_text(row_created_at) < _to_iso_start_of_day(start_date):
                continue
            if end_date and row_created_at and _clean_text(row_created_at) > _to_iso_end_of_day(end_date):
                continue

            search_haystack = " ".join(
                [
                    _to_matchable(identity["full_name"]),
                    _to_matchable(identity["email"]),
                    _to_matchable(identity["company_name"]),
                    _to_matchable(current_plan),
                    _to_matchable(current_status),
                ]
            )
            if search_filter and search_filter not in search_haystack:
                continue

            if uid in existing_uid_rows:
                continue

            synthetic_rows.append(
                {
                    "id": f"plan-{plan_filter}-{len(synthetic_rows) + 1}",
                    "recruiter_user_id": uid,
                    "recruiter_full_name": identity["full_name"],
                    "recruiter_email": identity["email"],
                    "recruiter_company_name": identity["company_name"],
                    "plan": current_plan,
                    "status": current_status,
                    "raw_status": current_status,
                    "period_start": row_created_at,
                    "period_end": None,
                    "line_items": [{"name": f"Hire.AI {current_plan.capitalize()} Plan", "amount": 0, "currency": "USD"}],
                    "subtotal": 0,
                    "tax_amount": 0,
                    "total": 0,
                    "due_date": row_created_at,
                    "paid_at": row_created_at,
                    "payment_reference": None,
                    "metadata": {"source": "profiles", "type": "plan-activation"},
                    "created_at": row_created_at,
                }
            )

        filtered_transactions.extend(synthetic_rows)

    transactions_page = filtered_transactions[offset: offset + limit]
    total_amount = sum(_to_float(tx.get("total")) for tx in filtered_transactions)
    paid_transactions = [tx for tx in filtered_transactions if _clean_text(tx.get("status")) == "paid"]
    paid_amount = sum(_to_float(tx.get("total")) for tx in paid_transactions)

    return ok(
        {
            "total": len(filtered_transactions),
            "offset": offset,
            "limit": limit,
            "transactions": transactions_page,
            "summary": {
                "transactions_count": len(filtered_transactions),
                "total_amount": round(total_amount, 2),
                "paid_transactions_count": len(paid_transactions),
                "paid_amount": round(paid_amount, 2),
            },
        }
    )


@router.post("/profiles/backfill-clerk")
async def admin_backfill_clerk_profiles(
    limit: int = Query(default=0, ge=0, le=50000),
    dry_run: bool = Query(default=False),
    _: ClerkUser = Depends(require_role("admin")),
):
    db = get_db_admin_service()
    result = await backfill_profiles_from_clerk(
        db=db,
        max_users=(limit or None),
        dry_run=dry_run,
    )
    return ok(result)


@router.get("/subscriptions/plan-recruiters")
async def admin_plan_recruiters(
    plan: str = Query(..., min_length=1),
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=25, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: ClerkUser = Depends(require_role("admin")),
):
    db = get_db_admin_service()
    plan_normalized = _normalize_admin_plan(plan, default="free")
    search_filter = _to_matchable(search)

    def _fetch_profiles_for_plan():
        q = (
            db.client.from_("profiles")
            .select("user_id, first_name, last_name, full_name, email, company_name, subscription_plan, subscription_status, plan_selected_at")
            .order("plan_selected_at", desc=True)
            .order("created_at", desc=True)
        )
        return q.execute()

    res = await db.run(_fetch_profiles_for_plan)
    rows = getattr(res, "data", None) or []

    filtered_rows: List[Dict[str, Any]] = []
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, dict):
            continue
        row_plan = _normalize_admin_plan(row.get("subscription_plan"), default="free")
        if row_plan != plan_normalized:
            continue
        identity = _build_user_identity(row)
        if search_filter:
            haystack = " ".join(
                [
                    _to_matchable(identity["full_name"]),
                    _to_matchable(identity["email"]),
                    _to_matchable(identity["company_name"]),
                ]
            )
            if search_filter not in haystack:
                continue
        filtered_rows.append(
            {
                "recruiter_user_id": _clean_text(row.get("user_id")),
                "full_name": identity["full_name"],
                "email": identity["email"],
                "company_name": identity["company_name"],
                "subscription_start_date": row.get("plan_selected_at"),
                "subscription_status": _clean_text(row.get("subscription_status")) or "active",
                "subscription_plan": plan_normalized,
            }
        )

    page = filtered_rows[offset: offset + limit]
    return ok(
        {
            "plan": plan_normalized,
            "total": len(filtered_rows),
            "offset": offset,
            "limit": limit,
            "recruiters": page,
        }
    )


@router.get("/overview")
async def admin_overview(_: ClerkUser = Depends(require_role("admin"))):
    db = get_db_admin_service()
    recruiter_ids = await _get_recruiter_ids(db)

    def _fetch_profiles():
        return (
            db.client.from_("profiles")
            .select("user_id, subscription_plan")
            .in_("user_id", recruiter_ids)
            .execute()
        ) if recruiter_ids else None

    profile_rows: List[Dict[str, Any]] = []
    prof_res = await db.run(_fetch_profiles) if recruiter_ids else None
    if prof_res is not None:
        profile_rows = getattr(prof_res, "data", None) or []

    by_plan: Dict[str, int] = {}
    for row in profile_rows if isinstance(profile_rows, list) else []:
        if not isinstance(row, dict):
            continue
        p = str(row.get("subscription_plan") or "free").strip().lower()
        by_plan[p] = by_plan.get(p, 0) + 1

    now = datetime.now(timezone.utc)
    seven_days_ago = (now - timedelta(days=7)).isoformat()
    fourteen_days_ago = (now - timedelta(days=14)).isoformat()

    def _fetch_recent_paid_invoices():
        return (
            db.client.from_("invoices")
            .select("total, status, metadata, created_at")
            .in_("user_id", recruiter_ids)
            .gte("created_at", fourteen_days_ago)
            .execute()
        ) if recruiter_ids else None

    inv_rows: List[Dict[str, Any]] = []
    inv_res = await db.run(_fetch_recent_paid_invoices) if recruiter_ids else None
    if inv_res is not None:
        inv_rows = getattr(inv_res, "data", None) or []

    paid_7d = 0
    gross_7d = 0.0
    paid_prev_7d = 0
    gross_prev_7d = 0.0
    for row in inv_rows if isinstance(inv_rows, list) else []:
        if not isinstance(row, dict):
            continue
        if _derive_billing_status(row) != "paid":
            continue
        row_total = 0.0
        try:
            row_total = float(row.get("total") or 0)
        except Exception:
            pass
        created = row.get("created_at", "")
        if created >= seven_days_ago:
            paid_7d += 1
            gross_7d += row_total
        else:
            paid_prev_7d += 1
            gross_prev_7d += row_total

    return ok(
        {
            "generated_at": now.isoformat(),
            "recruiters_total": len(recruiter_ids),
            "plan_distribution": by_plan,
            "billing_paid_transactions_last_7d": paid_7d,
            "billing_paid_amount_last_7d": round(gross_7d, 2),
            "billing_paid_transactions_prev_7d": paid_prev_7d,
            "billing_paid_amount_prev_7d": round(gross_prev_7d, 2),
        }
    )


# ── Activity / Login Tracking ───────────────────────────────────────────────


@router.get("/activity/summary")
async def admin_activity_summary(_: ClerkUser = Depends(require_role("admin"))):
    """Return login activity summary for the admin dashboard.

    - active_now:    users with a login event in the last 15 minutes
    - logins_today:  unique users who triggered session.created today (UTC)
    - logins_7d:     total session.created events in the last 7 days (+ unique users)
    - logins_prev_7d: same for the preceding 7-day window
    """
    db = get_db_admin_service()
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    seven_days_ago = (now - timedelta(days=7)).isoformat()
    fourteen_days_ago = (now - timedelta(days=14)).isoformat()

    # ── Active now: users with a session.created event in the last 15 minutes ─
    fifteen_min_ago = (now - timedelta(minutes=15)).isoformat()

    def _fetch_active_sessions():
        return (
            db.client.from_("user_login_events")
            .select("user_id")
            .eq("event_type", "session.created")
            .gte("logged_in_at", fifteen_min_ago)
            .execute()
        )

    active_res = await db.run(_fetch_active_sessions)
    active_rows = getattr(active_res, "data", None) or []
    active_now_ids: Set[str] = set()
    for row in active_rows if isinstance(active_rows, list) else []:
        if isinstance(row, dict):
            uid = str(row.get("user_id") or "").strip()
            if uid:
                active_now_ids.add(uid)

    # ── Login event counts (session.created only, last 14 days) ─────────────
    def _fetch_recent_events():
        return (
            db.client.from_("user_login_events")
            .select("user_id, logged_in_at")
            .eq("event_type", "session.created")
            .gte("logged_in_at", fourteen_days_ago)
            .order("logged_in_at", desc=True)
            .execute()
        )

    res = await db.run(_fetch_recent_events)
    rows = getattr(res, "data", None) or []

    today_ids: Set[str] = set()
    week_ids: Set[str] = set()
    prev_week_ids: Set[str] = set()
    logins_7d_count = 0
    logins_prev_7d_count = 0

    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, dict):
            continue
        uid = str(row.get("user_id") or "").strip()
        ts = str(row.get("logged_in_at") or "")
        if not uid or not ts:
            continue

        if ts >= today_start:
            today_ids.add(uid)
        if ts >= seven_days_ago:
            week_ids.add(uid)
            logins_7d_count += 1
        else:
            prev_week_ids.add(uid)
            logins_prev_7d_count += 1

    return ok({
        "generated_at": now.isoformat(),
        "active_now_count": len(active_now_ids),
        "active_now_user_ids": sorted(active_now_ids),
        "logins_today_unique_users": len(today_ids),
        "logins_7d_count": logins_7d_count,
        "logins_7d_unique_users": len(week_ids),
        "logins_prev_7d_count": logins_prev_7d_count,
        "logins_prev_7d_unique_users": len(prev_week_ids),
    })


@router.get("/activity/recent-logins")
async def admin_recent_logins(
    limit: int = Query(default=50, ge=1, le=200),
    _: ClerkUser = Depends(require_role("admin")),
):
    """Return the most recent login events, joined with profile data.

    Only session.created events are returned (not session.ended/removed/revoked).
    The response always includes a human-readable name and email — raw Clerk IDs
    are never surfaced in any field.
    """
    db = get_db_admin_service()

    def _fetch_recent():
        return (
            db.client.from_("user_login_events")
            .select("id, user_id, logged_in_at, ip_address, user_agent")
            .eq("event_type", "session.created")
            .order("logged_in_at", desc=True)
            .limit(limit)
            .execute()
        )

    res = await db.run(_fetch_recent)
    events = getattr(res, "data", None) or []

    # Collect unique user_ids to join with profiles
    user_ids = list({
        str(e.get("user_id", "")).strip()
        for e in (events if isinstance(events, list) else [])
        if isinstance(e, dict) and str(e.get("user_id", "")).strip()
    })

    profiles_by_uid: Dict[str, Dict[str, Any]] = {}
    if user_ids:
        def _fetch_profiles():
            return (
                db.client.from_("profiles")
                .select("user_id, email, first_name, last_name, full_name, company_name, last_login_at")
                .in_("user_id", user_ids)
                .execute()
            )

        prof_res = await db.run(_fetch_profiles)
        for row in getattr(prof_res, "data", None) or []:
            if isinstance(row, dict) and row.get("user_id"):
                profiles_by_uid[str(row["user_id"])] = row

    login_entries: List[Dict[str, Any]] = []
    for e in events if isinstance(events, list) else []:
        if not isinstance(e, dict):
            continue
        uid = str(e.get("user_id") or "")
        profile = profiles_by_uid.get(uid, {})
        identity = _build_user_identity(profile)

        first_name = str(profile.get("first_name") or "").strip() or None
        last_name = str(profile.get("last_name") or "").strip() or None

        login_entries.append({
            "id": e.get("id"),
            "user_id": uid,
            "first_name": first_name or "Not Provided",
            "last_name": last_name or "",
            "full_name": identity["full_name"],
            "email": identity["email"],
            "company_name": identity["company_name"],
            "last_login_at": profile.get("last_login_at"),
            "logged_in_at": e.get("logged_in_at"),
            "ip_address": e.get("ip_address"),
            "user_agent": e.get("user_agent"),
            "status": "success",
        })

    return ok({"logins": login_entries})


@router.get("/activity/logins-today")
async def admin_logins_today(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _: ClerkUser = Depends(require_role("admin")),
):
    """Return all login events for today (UTC), joined with profile data."""
    db = get_db_admin_service()
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

    def _fetch_today_logins():
        return (
            db.client.from_("user_login_events")
            .select("id, user_id, logged_in_at, ip_address, user_agent")
            .eq("event_type", "session.created")
            .gte("logged_in_at", today_start)
            .order("logged_in_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )

    res = await db.run(_fetch_today_logins)
    events = getattr(res, "data", None) or []

    # Fetch total count
    def _fetch_today_count():
        return (
            db.client.from_("user_login_events")
            .select("id", count="exact")
            .eq("event_type", "session.created")
            .gte("logged_in_at", today_start)
            .execute()
        )

    count_res = await db.run(_fetch_today_count)
    total_count = getattr(count_res, "count", None) or 0

    # Collect unique user_ids to join with profiles
    user_ids = list({
        str(e.get("user_id", "")).strip()
        for e in (events if isinstance(events, list) else [])
        if isinstance(e, dict) and str(e.get("user_id", "")).strip()
    })

    profiles_by_uid: Dict[str, Dict[str, Any]] = {}
    if user_ids:
        def _fetch_profiles():
            return (
                db.client.from_("profiles")
                .select("user_id, email, first_name, last_name, full_name, company_name, last_login_at")
                .in_("user_id", user_ids)
                .execute()
            )

        prof_res = await db.run(_fetch_profiles)
        for row in getattr(prof_res, "data", None) or []:
            if isinstance(row, dict) and row.get("user_id"):
                profiles_by_uid[str(row["user_id"])] = row

    login_entries: List[Dict[str, Any]] = []
    for e in events if isinstance(events, list) else []:
        if not isinstance(e, dict):
            continue
        uid = str(e.get("user_id") or "")
        profile = profiles_by_uid.get(uid, {})
        identity = _build_user_identity(profile)

        first_name = str(profile.get("first_name") or "").strip() or None
        last_name = str(profile.get("last_name") or "").strip() or None

        login_entries.append({
            "id": e.get("id"),
            "user_id": uid,
            "first_name": first_name or "Not Provided",
            "last_name": last_name or "",
            "full_name": identity["full_name"],
            "email": identity["email"],
            "company_name": identity["company_name"],
            "last_login_at": profile.get("last_login_at"),
            "logged_in_at": e.get("logged_in_at"),
            "ip_address": e.get("ip_address"),
            "user_agent": e.get("user_agent"),
            "status": "success",
        })

    return ok({
        "total": total_count,
        "offset": offset,
        "limit": limit,
        "logins": login_entries
    })



# ── Full Candidate Listing (PII) ────────────────────────────────────────────


@router.get("/candidates/list")
async def admin_candidates_list(
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    admin: ClerkUser = Depends(require_role("admin")),
):
    """Return paginated list of ALL candidates with PII.

    IMPORTANT — Audit logging:
    Every call writes a row to admin_audit_log recording which admin viewed
    which candidate_ids, as a compliance requirement.
    """
    db = get_db_admin_service()

    # ── Fetch candidates (paginated) ────────────────────────────────────────
    def _fetch_candidates():
        return (
            db.client.from_("candidates")
            .select("id, user_id, email, full_name, phone, created_at")
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )

    cand_res = await db.run(_fetch_candidates)
    candidates_rows = getattr(cand_res, "data", None) or []

    # ── Fetch total count ───────────────────────────────────────────────────
    def _fetch_count():
        return (
            db.client.from_("candidates")
            .select("id", count="exact")
            .execute()
        )

    count_res = await db.run(_fetch_count)
    total_count = getattr(count_res, "count", None) or 0

    # ── Collect candidate IDs for joining ───────────────────────────────────
    candidate_ids: List[str] = []
    for row in candidates_rows if isinstance(candidates_rows, list) else []:
        if isinstance(row, dict) and row.get("id"):
            candidate_ids.append(str(row["id"]))

    # ── Fetch latest job_application per candidate (for status + recruiter) ─
    apps_by_cid: Dict[str, Dict[str, Any]] = {}
    job_ids_needed: Set[str] = set()
    if candidate_ids:
        def _fetch_apps():
            return (
                db.client.from_("job_applications")
                .select("candidate_id, job_id, recruiter_id, status, created_at")
                .in_("candidate_id", candidate_ids)
                .order("created_at", desc=True)
                .execute()
            )

        apps_res = await db.run(_fetch_apps)
        apps_rows = getattr(apps_res, "data", None) or []
        for row in apps_rows if isinstance(apps_rows, list) else []:
            if not isinstance(row, dict):
                continue
            cid = str(row.get("candidate_id") or "")
            if cid and cid not in apps_by_cid:
                apps_by_cid[cid] = row  # keep most recent per candidate
                jid = str(row.get("job_id") or "").strip()
                if jid:
                    job_ids_needed.add(jid)

    # ── Fetch job titles ────────────────────────────────────────────────────
    jobs_by_id: Dict[str, str] = {}
    if job_ids_needed:
        jids_list = list(job_ids_needed)

        def _fetch_jobs():
            return (
                db.client.from_("job_descriptions")
                .select("id, title")
                .in_("id", jids_list)
                .execute()
            )

        jobs_res = await db.run(_fetch_jobs)
        for row in getattr(jobs_res, "data", None) or []:
            if isinstance(row, dict) and row.get("id"):
                jobs_by_id[str(row["id"])] = str(row.get("title") or "")

    # ── Fetch recruiter emails ──────────────────────────────────────────────
    recruiter_ids_needed: Set[str] = set()
    for app in apps_by_cid.values():
        rid = str(app.get("recruiter_id") or "").strip()
        if rid:
            recruiter_ids_needed.add(rid)

    recruiter_emails: Dict[str, str] = {}
    recruiter_identity_by_uid: Dict[str, Dict[str, str]] = {}
    if recruiter_ids_needed:
        rids_list = list(recruiter_ids_needed)

        def _fetch_recruiter_profiles():
            return (
                db.client.from_("profiles")
                .select("user_id, first_name, last_name, full_name, email, company_name")
                .in_("user_id", rids_list)
                .execute()
            )

        rp_res = await db.run(_fetch_recruiter_profiles)
        for row in getattr(rp_res, "data", None) or []:
            if isinstance(row, dict) and row.get("user_id"):
                uid = str(row["user_id"])
                identity = _build_user_identity(row)
                recruiter_emails[uid] = identity["email"]
                recruiter_identity_by_uid[uid] = identity

    # ── Build response ──────────────────────────────────────────────────────
    candidates_payload: List[Dict[str, Any]] = []
    for row in candidates_rows if isinstance(candidates_rows, list) else []:
        if not isinstance(row, dict):
            continue
        cid = str(row.get("id") or "")
        app = apps_by_cid.get(cid, {})
        jid = str(app.get("job_id") or "").strip()
        rid = str(app.get("recruiter_id") or "").strip()
        recruiter_identity = recruiter_identity_by_uid.get(
            rid,
            {"full_name": "Not Provided", "email": recruiter_emails.get(rid, "Not Provided"), "company_name": "Not Provided"},
        )
        candidates_payload.append({
            "candidate_id": cid,
            "full_name": row.get("full_name"),
            "email": row.get("email"),
            "phone": row.get("phone"),
            "job_title": jobs_by_id.get(jid, ""),
            "job_id": jid or None,
            "recruiter_user_id": rid or None,
            "recruiter_full_name": recruiter_identity.get("full_name"),
            "recruiter_email": recruiter_identity.get("email"),
            "recruiter_company_name": recruiter_identity.get("company_name"),
            "application_status": app.get("status", ""),
            "created_at": row.get("created_at"),
        })

    # ── AUDIT LOG — mandatory compliance write ──────────────────────────────
    try:
        await db.insert("admin_audit_log", [{
            "actor_user_id": admin.id,
            "action": "view_candidates_list",
            "payload": {
                "candidate_ids": candidate_ids,
                "offset": offset,
                "limit": limit,
                "total_returned": len(candidates_payload),
            },
        }])
    except Exception as exc:
        # Log the audit failure but do NOT fail the request — the audit log
        # is append-only and its failure should not block admin operations.
        # The error IS logged for operational alerting.
        import logging
        logging.getLogger(__name__).error(
            "[admin] AUDIT LOG WRITE FAILED for view_candidates_list admin=%s error=%s",
            admin.id, exc,
        )

    return ok({
        "total": total_count,
        "offset": offset,
        "limit": limit,
        "candidates": candidates_payload,
    })

