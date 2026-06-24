"""
Resume Optimization API Endpoints
===================================
POST   /resume-optimization/candidates/{candidate_id}/optimize
GET    /resume-optimization/candidates/{candidate_id}/history
GET    /resume-optimization/{optimization_id}
POST   /resume-optimization/{optimization_id}/finalize
GET    /resume-optimization/{optimization_id}/download/pdf
GET    /resume-optimization/{optimization_id}/download/docx

Source of truth: candidates.resume_text (raw text extracted from the
uploaded PDF/DOCX). The structured resume_parsed_data is NEVER used
for optimization — it is a display-only representation.
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from fastapi.responses import Response

from app.api.v2.deps import require_user
from app.auth.clerk import ClerkUser
from app.services.db.supabase_service import get_db_admin_service
from app.utils.responses import ok, api_error

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/resume-optimization")


# ---------------------------------------------------------------------------
# POST /resume-optimization/candidates/{candidate_id}/optimize
# ---------------------------------------------------------------------------
@router.post("/candidates/{candidate_id}/optimize")
async def optimize_resume(
    candidate_id: str,
    payload: Dict[str, Any],
    user: ClerkUser = Depends(require_user),
):
    """
    Run AI resume optimization for a candidate against a specific job.

    Source of truth: candidates.resume_text (the raw text extracted from
    the candidate's uploaded PDF/DOCX file). This is the same content used
    for ATS screening.

    Body:
        job_id: str
        screening_data: dict  (ats_screenings row for gap context — optional)
    """
    job_id = payload.get("job_id")
    if not job_id:
        return api_error(message="job_id is required", status_code=400)

    db = get_db_admin_service()

    # Tenant guard
    from app.utils.tenant_guards import verify_candidate_belongs_to_user
    if not await verify_candidate_belongs_to_user(db, candidate_id, user.id):
        return api_error(message="Candidate not found", status_code=404)

    # Fetch candidate — we need resume_text (the original) and resume_url
    def _fetch_candidate():
        return (
            db.client.from_("candidates")
            .select("id, full_name, resume_text, resume_url")
            .eq("id", candidate_id)
            .maybe_single()
            .execute()
        )

    cand_res = await db.run(_fetch_candidate)
    candidate = getattr(cand_res, "data", None)
    if not isinstance(candidate, dict) or not candidate.get("id"):
        return api_error(message="Candidate not found", status_code=404)

    # resume_text is the original resume content — the same source used for screening
    resume_text = (candidate.get("resume_text") or "").strip()
    if not resume_text:
        return api_error(
            message=(
                "Original resume text is not available for this candidate. "
                "Please ensure the resume has been uploaded and processed first."
            ),
            status_code=400,
        )

    # Fetch job (must belong to this recruiter)
    def _fetch_job():
        return (
            db.client.from_("job_descriptions")
            .select("id, title, role, level, description, must_have_skills, good_to_have_skills")
            .eq("id", job_id)
            .eq("created_by", user.id)
            .maybe_single()
            .execute()
        )

    job_res = await db.run(_fetch_job)
    job = getattr(job_res, "data", None)
    if not isinstance(job, dict) or not job.get("id"):
        return api_error(message="Job not found", status_code=404)

    # Use screening data passed in payload or fetch from DB
    screening_data = payload.get("screening_data") or {}
    if not screening_data:
        def _fetch_screening():
            return (
                db.client.from_("ats_screenings")
                .select("*")
                .eq("candidate_id", candidate_id)
                .eq("job_id", job_id)
                .maybe_single()
                .execute()
            )
        sc_res = await db.run(_fetch_screening)
        screening_data = getattr(sc_res, "data", None) or {}

    # Run AI optimization on the original resume_text
    from app.services.resume_optimizer import get_resume_optimizer
    optimizer = get_resume_optimizer()

    try:
        result = await optimizer.optimize(
            resume_text=resume_text,
            job=job,
            screening_analysis=screening_data,
        )
    except RuntimeError as exc:
        return api_error(message=str(exc), status_code=502)

    # Persist draft optimization record
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "id": str(uuid.uuid4()),
        "candidate_id": candidate_id,
        "job_id": job_id,
        "recruiter_id": user.id,
        "status": "draft",
        "before_score": result.get("before_score", 0),
        "after_score": result.get("after_score", 0),
        "optimization_summary": result.get("optimization_summary", ""),
        # Store the ORIGINAL resume text verbatim — never changes
        "original_resume_text": resume_text,
        # AI-generated optimized text (all changes applied)
        "optimized_text": result.get("optimized_text", resume_text),
        "changes": json.dumps(result.get("changes", [])),
        "accepted_change_ids": json.dumps([]),
        "rejected_change_ids": json.dumps([]),
        "gap_cautions": json.dumps(result.get("gap_cautions", [])),
        "created_at": now,
        "updated_at": now,
    }

    def _insert_opt():
        return db.client.from_("candidate_resume_optimizations").insert(record).execute()

    try:
        ins_res = await db.run(_insert_opt)
        saved = getattr(ins_res, "data", None)
        saved_row = saved[0] if isinstance(saved, list) and saved else record
    except Exception as exc:
        logger.warning("[resume_optimization] Failed to persist draft: %s", exc)
        saved_row = record

    # Deserialize for response
    saved_row["changes"] = result.get("changes", [])
    saved_row["accepted_change_ids"] = []
    saved_row["rejected_change_ids"] = []
    saved_row["gap_cautions"] = result.get("gap_cautions", [])

    return ok({
        **saved_row,
        "candidate_name": candidate.get("full_name", ""),
        "job_title": job.get("title", ""),
        "resume_url": candidate.get("resume_url"),  # Original file URL
    })


# ---------------------------------------------------------------------------
# GET /resume-optimization/candidates/{candidate_id}/history
# ---------------------------------------------------------------------------
@router.get("/candidates/{candidate_id}/history")
async def get_optimization_history(
    candidate_id: str,
    job_id: Optional[str] = None,
    user: ClerkUser = Depends(require_user),
):
    """Retrieve past optimization records for a candidate (optionally filtered by job)."""
    db = get_db_admin_service()

    from app.utils.tenant_guards import verify_candidate_belongs_to_user
    if not await verify_candidate_belongs_to_user(db, candidate_id, user.id):
        return api_error(message="Candidate not found", status_code=404)

    def _fetch_history():
        q = (
            db.client.from_("candidate_resume_optimizations")
            .select(
                "id, candidate_id, job_id, status, before_score, after_score, "
                "optimization_summary, accepted_change_ids, rejected_change_ids, gap_cautions, "
                "created_at, updated_at, finalized_at"
            )
            .eq("candidate_id", candidate_id)
            .eq("recruiter_id", user.id)
            .order("created_at", desc=True)
        )
        if job_id:
            q = q.eq("job_id", job_id)
        return q.execute()

    res = await db.run(_fetch_history)
    rows = getattr(res, "data", None) or []

    for row in rows:
        for col in ("accepted_change_ids", "rejected_change_ids", "gap_cautions"):
            val = row.get(col)
            if isinstance(val, str):
                try:
                    row[col] = json.loads(val)
                except Exception:
                    row[col] = []

    return ok(rows)


# ---------------------------------------------------------------------------
# GET /resume-optimization/{optimization_id}
# ---------------------------------------------------------------------------
@router.get("/{optimization_id}")
async def get_optimization(
    optimization_id: str,
    user: ClerkUser = Depends(require_user),
):
    """Retrieve a single optimization record with full changes."""
    db = get_db_admin_service()

    def _fetch():
        return (
            db.client.from_("candidate_resume_optimizations")
            .select("*")
            .eq("id", optimization_id)
            .eq("recruiter_id", user.id)
            .maybe_single()
            .execute()
        )

    res = await db.run(_fetch)
    row = getattr(res, "data", None)
    if not isinstance(row, dict):
        return api_error(message="Optimization record not found", status_code=404)

    for col in ("changes", "accepted_change_ids", "rejected_change_ids", "gap_cautions"):
        val = row.get(col)
        if isinstance(val, str):
            try:
                row[col] = json.loads(val)
            except Exception:
                row[col] = [] if col != "changes" else []

    return ok(row)


# ---------------------------------------------------------------------------
# POST /resume-optimization/{optimization_id}/finalize
# ---------------------------------------------------------------------------
@router.post("/{optimization_id}/finalize")
async def finalize_optimization(
    optimization_id: str,
    payload: Dict[str, Any],
    user: ClerkUser = Depends(require_user),
):
    """
    Save recruiter decisions and build the final text with only accepted changes.

    Body:
        accepted_change_ids: list[str]
        rejected_change_ids: list[str]
    """
    db = get_db_admin_service()

    def _fetch_opt():
        return (
            db.client.from_("candidate_resume_optimizations")
            .select("id, original_resume_text, changes")
            .eq("id", optimization_id)
            .eq("recruiter_id", user.id)
            .maybe_single()
            .execute()
        )

    res = await db.run(_fetch_opt)
    opt_row = getattr(res, "data", None)
    if not isinstance(opt_row, dict):
        return api_error(message="Optimization record not found", status_code=404)

    accepted_ids: List[str] = payload.get("accepted_change_ids") or []
    rejected_ids: List[str] = payload.get("rejected_change_ids") or []

    # Rebuild final text from original using ONLY accepted changes
    original_text = opt_row.get("original_resume_text") or ""
    changes_raw = opt_row.get("changes") or []
    if isinstance(changes_raw, str):
        try:
            changes_raw = json.loads(changes_raw)
        except Exception:
            changes_raw = []

    from app.services.resume_optimizer import ResumeOptimizerService
    final_text = ResumeOptimizerService.apply_accepted_changes(original_text, changes_raw, accepted_ids)

    now = datetime.now(timezone.utc).isoformat()

    def _update_opt():
        return (
            db.client.from_("candidate_resume_optimizations")
            .update({
                "status": "finalized",
                "accepted_change_ids": json.dumps(accepted_ids),
                "rejected_change_ids": json.dumps(rejected_ids),
                "final_resume_text": final_text,
                "finalized_at": now,
                "updated_at": now,
            })
            .eq("id", optimization_id)
            .execute()
        )

    await db.run(_update_opt)
    return ok({"success": True, "optimization_id": optimization_id, "status": "finalized"})


# ---------------------------------------------------------------------------
# GET /resume-optimization/{optimization_id}/download/pdf
# ---------------------------------------------------------------------------
@router.get("/{optimization_id}/download/pdf")
async def download_pdf(
    optimization_id: str,
    version: str = "optimized",   # "optimized" | "original"
    user: ClerkUser = Depends(require_user),
):
    """Download the optimized or original resume as a PDF."""
    db = get_db_admin_service()

    opt_row, candidate_name, job_title, _ = await _fetch_opt_meta(db, optimization_id, user.id)
    if not opt_row:
        return api_error(message="Optimization record not found", status_code=404)

    resume_text = _pick_text_version(opt_row, version)
    if not resume_text:
        return api_error(message="Resume text not available for this version", status_code=404)

    from app.services.resume_optimizer import get_resume_optimizer
    pdf_bytes = get_resume_optimizer().generate_pdf(resume_text, candidate_name, job_title)

    safe_name = candidate_name.replace(" ", "_")
    suffix = "original" if version == "original" else "optimized"
    filename = f"resume_{suffix}_{safe_name}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# GET /resume-optimization/{optimization_id}/download/docx
# ---------------------------------------------------------------------------
@router.get("/{optimization_id}/download/docx")
async def download_docx(
    optimization_id: str,
    version: str = "optimized",   # "optimized" | "original"
    user: ClerkUser = Depends(require_user),
):
    """Download the optimized or original resume as a DOCX."""
    db = get_db_admin_service()

    opt_row, candidate_name, job_title, resume_url = await _fetch_opt_meta(db, optimization_id, user.id)
    if not opt_row:
        return api_error(message="Optimization record not found", status_code=404)

    resume_text = _pick_text_version(opt_row, version)
    if not resume_text:
        return api_error(message="Resume text not available for this version", status_code=404)

    changes_raw = opt_row.get("changes") or []
    if isinstance(changes_raw, str):
        try:
            changes_raw = json.loads(changes_raw)
        except Exception:
            changes_raw = []

    accepted_ids = opt_row.get("accepted_change_ids") or []
    if isinstance(accepted_ids, str):
        try:
            accepted_ids = json.loads(accepted_ids)
        except Exception:
            accepted_ids = []

    from app.services.resume_optimizer import get_resume_optimizer
    # Using await since generate_docx is now async
    docx_bytes = await get_resume_optimizer().generate_docx(
        resume_text=resume_text,
        candidate_name=candidate_name,
        job_title=job_title,
        resume_url=resume_url,
        changes=changes_raw,
        accepted_ids=accepted_ids
    )

    safe_name = candidate_name.replace(" ", "_")
    suffix = "original" if version == "original" else "optimized"
    filename = f"resume_{suffix}_{safe_name}.docx"
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# POST /resume-optimization/{optimization_id}/deploy
# ---------------------------------------------------------------------------
@router.post("/{optimization_id}/deploy")
async def deploy_optimization(
    optimization_id: str,
    user: ClerkUser = Depends(require_user),
):
    """
    Accept the final optimized resume, permanently replacing the candidate's original resume
    text and generating a new PDF/DOCX to replace their resume_url in storage.
    """
    db = get_db_admin_service()

    opt_row, candidate_name, job_title, original_url = await _fetch_opt_meta(db, optimization_id, user.id)
    if not opt_row:
        return api_error(message="Optimization record not found", status_code=404)

    final_text = opt_row.get("final_resume_text")
    if not final_text:
        return api_error(message="Resume optimization is not finalized yet.", status_code=400)
    
    candidate_id = opt_row.get("candidate_id")

    from app.services.resume_optimizer import get_resume_optimizer
    # Generate the new DOCX file bytes
    changes_raw = opt_row.get("changes") or []
    if isinstance(changes_raw, str):
        try:
            changes_raw = json.loads(changes_raw)
        except Exception:
            changes_raw = []
    
    accepted_ids = opt_row.get("accepted_change_ids") or []
    if isinstance(accepted_ids, str):
        try:
            accepted_ids = json.loads(accepted_ids)
        except Exception:
            accepted_ids = []

    docx_bytes = await get_resume_optimizer().generate_docx(
        resume_text=opt_row.get("original_resume_text") or "",
        candidate_name=candidate_name,
        job_title=job_title,
        resume_url=original_url,
        changes=changes_raw,
        accepted_ids=accepted_ids
    )

    # Upload to Supabase Storage
    import uuid
    object_path = f"{candidate_id}/{uuid.uuid4().hex}_optimized.docx"
    resume_url = ""
    try:
        from app.config import get_settings
        settings = get_settings()

        def _ensure_bucket():
            try:
                db.client.storage.create_bucket("resumes", options={"public": True})
            except Exception:
                try:
                    db.client.storage.update_bucket("resumes", options={"public": True})
                except Exception:
                    pass

        await db.run(_ensure_bucket)

        def _upload_storage():
            return db.client.storage.from_("resumes").upload(
                object_path,
                docx_bytes,
                {"content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
            )

        await db.run(_upload_storage)
        supabase_url = settings.supabase_url.rstrip("/")
        resume_url = f"{supabase_url}/storage/v1/object/public/resumes/{object_path}"
    except Exception as e:
        return api_error(message=f"Failed to upload new resume to storage: {e}", status_code=500)

    # Update candidate record
    def _update_cand():
        return (
            db.client.from_("candidates")
            .update({
                "resume_text": final_text,
                "resume_url": resume_url
            })
            .eq("id", candidate_id)
            .execute()
        )
    
    await db.run(_update_cand)

    return ok({"success": True, "url": resume_url})


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _fetch_opt_meta(db, optimization_id: str, recruiter_id: str):
    """Fetch the optimization record + candidate name + job title + resume_url."""

    def _fetch_opt():
        return (
            db.client.from_("candidate_resume_optimizations")
            .select("id, candidate_id, job_id, original_resume_text, optimized_text, final_resume_text, status, changes, accepted_change_ids")
            .eq("id", optimization_id)
            .eq("recruiter_id", recruiter_id)
            .maybe_single()
            .execute()
        )

    opt_res = await db.run(_fetch_opt)
    opt_row = getattr(opt_res, "data", None)
    if not isinstance(opt_row, dict):
        return None, "", "", ""

    def _fetch_cand():
        return (
            db.client.from_("candidates")
            .select("full_name, resume_url")
            .eq("id", opt_row.get("candidate_id", ""))
            .maybe_single()
            .execute()
        )

    def _fetch_job():
        return (
            db.client.from_("job_descriptions")
            .select("title")
            .eq("id", opt_row.get("job_id", ""))
            .maybe_single()
            .execute()
        )

    cand_res = await db.run(_fetch_cand)
    job_res = await db.run(_fetch_job)
    cand_data = getattr(cand_res, "data", None) or {}
    candidate_name = cand_data.get("full_name", "Candidate")
    resume_url = cand_data.get("resume_url", "")
    job_title = (getattr(job_res, "data", None) or {}).get("title", "")
    return opt_row, candidate_name, job_title, resume_url


def _pick_text_version(opt_row: dict, version: str) -> str:
    """Return the correct resume text string for the requested version."""
    if version == "original":
        return opt_row.get("original_resume_text") or ""

    # "optimized" = use final (approved-only) text if finalized, else full optimized_text
    final = opt_row.get("final_resume_text")
    if final:
        return final
    return opt_row.get("optimized_text") or opt_row.get("original_resume_text") or ""
