from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Query
import re

from app.api.v2.deps import require_user
from app.auth.clerk import ClerkUser
from app.services.db.supabase_service import get_db_admin_service
from app.utils.responses import api_error, ok

router = APIRouter(prefix="/dsa-problems")


def _derive_function_name_and_mode(
    starter_code: Any,
    solution_wrappers: Any,
    preferred_language: Optional[str] = None,
):
    lang_candidates = []
    if preferred_language:
        lang_candidates.append(str(preferred_language))
        lang_candidates.append(str(preferred_language).lower())

    if isinstance(starter_code, dict):
        lang_candidates.extend([str(k) for k in starter_code.keys()])
    if isinstance(solution_wrappers, dict):
        lang_candidates.extend([str(k) for k in solution_wrappers.keys()])

    seen = set()
    ordered_langs = []
    for l in lang_candidates:
        if l and l not in seen:
            seen.add(l)
            ordered_langs.append(l)

    def _get_code_for_lang(lang: str) -> str:
        if isinstance(starter_code, dict):
            v = starter_code.get(lang) or starter_code.get(lang.lower())
            if isinstance(v, str) and v.strip():
                return v
        if isinstance(solution_wrappers, dict):
            v = solution_wrappers.get(lang) or solution_wrappers.get(lang.lower())
            if isinstance(v, str) and v.strip():
                return v
        return ""

    for lang in ordered_langs:
        code = _get_code_for_lang(lang)
        if not code:
            continue

        if lang in ("python", "python3"):
            if re.search(r"\bclass\s+Solution\b", code):
                m = re.search(r"\bclass\s+Solution\b[\s\S]*?\n\s+def\s+(\w+)\s*\(", code)
                if m:
                    return m.group(1), "class", "Solution"
            m = re.search(r"\bdef\s+(\w+)\s*\(", code)
            if m:
                return m.group(1), "function", None

        if lang == "typescript":
            if re.search(r"\bclass\s+Solution\b", code):
                m = re.search(r"\bclass\s+Solution\b[\s\S]*?\n\s*(\w+)\s*\(", code)
                if m:
                    return m.group(1), "class", "Solution"
            m = re.search(r"\bfunction\s+(\w+)\s*\(", code)
            if m:
                return m.group(1), "function", None
            m = re.search(r"\b(?:const|let|var)\s+(\w+)\s*=\s*(?:function\s*)?\(", code)
            if m:
                return m.group(1), "function", None

        if lang == "java":
            if re.search(r"\bclass\s+Solution\b", code):
                m = re.search(r"\bclass\s+Solution\b[\s\S]*?\b(?:public|private|protected)?\s*\w+[\w\[\]<>]*\s+(\w+)\s*\(", code)
                if m:
                    return m.group(1), "class", "Solution"

        if lang == "cpp":
            if re.search(r"\bclass\s+Solution\b", code):
                m = re.search(r"\bclass\s+Solution\b[\s\S]*?\b(\w+)\s*\(", code)
                if m:
                    return m.group(1), "class", "Solution"

    return None, None, None


def _derive_parameter_schema_from_test_cases(test_cases: Any) -> list:
    if not isinstance(test_cases, list) or not test_cases:
        return []
    for tc in test_cases:
        if not isinstance(tc, dict):
            continue
        raw_input = tc.get("input")
        if isinstance(raw_input, dict) and raw_input:
            return [{"name": str(k)} for k in raw_input.keys()]
    return []


def _validate_and_enrich_problem_row(row: Dict[str, Any], preferred_language: Optional[str] = None):
    starter_code = row.get("starter_code")
    solution_wrappers = row.get("solution_wrappers")
    test_cases = row.get("test_cases")

    if not isinstance(solution_wrappers, dict):
        solution_wrappers = {}
        row["solution_wrappers"] = solution_wrappers

    meta = solution_wrappers.get("__meta")
    if not isinstance(meta, dict):
        meta = {}
        solution_wrappers["__meta"] = meta

    function_name = row.get("function_name") or row.get("method_name")
    execution_mode = meta.get("execution_mode")
    class_name = meta.get("class_name")

    if not function_name or not execution_mode:
        derived_fn, derived_mode, derived_class = _derive_function_name_and_mode(
            starter_code=starter_code,
            solution_wrappers=solution_wrappers,
            preferred_language=preferred_language,
        )
        function_name = function_name or derived_fn
        execution_mode = execution_mode or derived_mode
        class_name = class_name or derived_class

    parameter_schema = meta.get("parameter_schema")
    if not isinstance(parameter_schema, list) or not parameter_schema:
        parameter_schema = _derive_parameter_schema_from_test_cases(test_cases)

    row["function_name"] = function_name
    meta["execution_mode"] = execution_mode
    if class_name:
        meta["class_name"] = class_name
    meta["parameter_schema"] = parameter_schema

    required_fields = ("function_name", "execution_mode", "parameter_schema", "test_cases")
    missing = []
    for f in required_fields:
        v = row.get(f)
        if f == "parameter_schema":
            v = meta.get("parameter_schema")
            if not isinstance(v, list) or not v:
                missing.append(f)
            continue
        if f == "execution_mode":
            v = meta.get("execution_mode")
            if not v:
                missing.append(f)
            continue
        if f == "test_cases":
            if not isinstance(v, list) or not v:
                missing.append(f)
            continue
        if not v:
            missing.append(f)
    return missing


@router.get("")
async def list_problems(
    difficulty: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    is_active: Optional[str] = Query(None),
    user: ClerkUser = Depends(require_user),
):
    """Node-compatible: GET /api/dsa-problems"""
    db = get_db_admin_service()
    exclude_inactive = is_active != "false"

    def _fetch():
        q = db.client.from_("dsa_problems").select(
            "id, slug, title, difficulty, category, tags, points, is_active, created_at"
        )
        if difficulty:
            q = q.eq("difficulty", difficulty)
        if category:
            q = q.ilike("category", f"%{category}%")
        if exclude_inactive:
            q = q.eq("is_active", True)
        return q.order("difficulty").order("category").execute()

    res = await db.run(_fetch)
    data = getattr(res, "data", None) or []
    return ok(data)


@router.post("")
async def create_problem(
    payload: Dict[str, Any],
    user: ClerkUser = Depends(require_user),
):
    """Node-compatible: POST /api/dsa-problems"""
    required = ("slug", "title", "difficulty", "category", "description")
    missing = [f for f in required if not payload.get(f)]
    if missing:
        return api_error(message=f"Missing required fields: {', '.join(missing)}", status_code=400)

    db = get_db_admin_service()
    row = {
        "slug": payload["slug"],
        "title": payload["title"],
        "difficulty": payload["difficulty"],
        "category": payload["category"],
        "tags": payload.get("tags") or [],
        "description": payload["description"],
        "constraints": payload.get("constraints") or "",
        "examples": payload.get("examples") or [],
        "starter_code": payload.get("starter_code") or {},
        "solution_wrappers": payload.get("solution_wrappers") or {},
        "test_cases": payload.get("test_cases") or [],
        "points": payload.get("points") or 100,
        "time_limit_seconds": payload.get("time_limit_seconds") or 5,
        "memory_limit_kb": payload.get("memory_limit_kb") or 262144,
        "function_name": payload.get("function_name") or payload.get("method_name"),
    }

    # Merge provided execution metadata into solution_wrappers.__meta (no DB schema changes)
    if not isinstance(row.get("solution_wrappers"), dict):
        row["solution_wrappers"] = {}
    sw = row["solution_wrappers"]
    meta = sw.get("__meta") if isinstance(sw.get("__meta"), dict) else {}
    if payload.get("execution_mode"):
        meta["execution_mode"] = payload.get("execution_mode")
    if payload.get("class_name"):
        meta["class_name"] = payload.get("class_name")
    if isinstance(payload.get("parameter_schema"), list) and payload.get("parameter_schema"):
        meta["parameter_schema"] = payload.get("parameter_schema")
    sw["__meta"] = meta

    missing_exec = _validate_and_enrich_problem_row(row)
    if missing_exec:
        return api_error(
            message=f"Challenge missing required execution metadata: {', '.join(missing_exec)}",
            status_code=400,
        )

    def _insert():
        return db.client.from_("dsa_problems").insert(row).execute()

    res = await db.run(_insert)
    data = getattr(res, "data", None)
    created = data[0] if isinstance(data, list) and data else None
    if not isinstance(created, dict):
        return api_error(message="Failed to create problem", status_code=500)
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=201, content=created)


@router.get("/{problem_id}")
async def get_problem(
    problem_id: str,
    user: ClerkUser = Depends(require_user),
):
    """Node-compatible: GET /api/dsa-problems/:id"""
    db = get_db_admin_service()

    def _fetch():
        return db.client.from_("dsa_problems").select("*").eq("id", problem_id).single().execute()

    res = await db.run(_fetch)
    data = getattr(res, "data", None)
    if not isinstance(data, dict):
        return api_error(message="Problem not found", status_code=404)
    return ok(data)


@router.patch("/{problem_id}")
async def update_problem(
    problem_id: str,
    payload: Dict[str, Any],
    user: ClerkUser = Depends(require_user),
):
    """Node-compatible: PATCH /api/dsa-problems/:id"""
    db = get_db_admin_service()
    now = datetime.now(timezone.utc).isoformat()

    def _fetch_existing():
        return db.client.from_("dsa_problems").select("*").eq("id", problem_id).single().execute()

    existing_res = await db.run(_fetch_existing)
    existing = getattr(existing_res, "data", None)
    if not isinstance(existing, dict):
        return api_error(message="Problem not found", status_code=404)

    update = {**existing, **payload, "updated_at": now}

    # Ensure execution metadata lives in solution_wrappers.__meta
    if not isinstance(update.get("solution_wrappers"), dict):
        update["solution_wrappers"] = {}
    sw = update["solution_wrappers"]
    meta = sw.get("__meta") if isinstance(sw.get("__meta"), dict) else {}
    if payload.get("execution_mode"):
        meta["execution_mode"] = payload.get("execution_mode")
    if payload.get("class_name"):
        meta["class_name"] = payload.get("class_name")
    if isinstance(payload.get("parameter_schema"), list) and payload.get("parameter_schema"):
        meta["parameter_schema"] = payload.get("parameter_schema")
    sw["__meta"] = meta
    missing_exec = _validate_and_enrich_problem_row(update)
    if missing_exec:
        return api_error(
            message=f"Challenge missing required execution metadata: {', '.join(missing_exec)}",
            status_code=400,
        )

    def _update():
        return (
            db.client.from_("dsa_problems")
            .update(update)
            .eq("id", problem_id)
            .execute()
        )

    up_res = await db.run(_update)
    if getattr(up_res, "error", None):
        return api_error(message="Problem not found", status_code=404)

    def _fetch():
        return db.client.from_("dsa_problems").select("*").eq("id", problem_id).single().execute()

    fetch_res = await db.run(_fetch)
    data = getattr(fetch_res, "data", None)
    if not isinstance(data, dict):
        return api_error(message="Problem not found", status_code=404)
    return ok(data)


@router.delete("/{problem_id}")
async def archive_problem(
    problem_id: str,
    user: ClerkUser = Depends(require_user),
):
    """Node-compatible: DELETE /api/dsa-problems/:id (soft delete)"""
    db = get_db_admin_service()

    def _update():
        return db.client.from_("dsa_problems").update({"is_active": False}).eq("id", problem_id).execute()

    await db.run(_update)
    return ok({"success": True, "message": "Problem archived"})
