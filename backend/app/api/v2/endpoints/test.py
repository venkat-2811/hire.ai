from __future__ import annotations

from fastapi import APIRouter, UploadFile, File

from app.services.ai.factory import get_ai
from app.services.db.supabase_service import get_db_admin_service
from app.services.resume_parser import get_resume_parser
from app.utils.responses import ok, api_error

router = APIRouter(prefix="/test")


@router.get("/openai")
async def test_openai():
    ai = get_ai()
    try:
        text = await ai.generate_text("Return the string 'ok'", temperature=0.0, max_tokens=10, timeout_s=15)
        return ok({"success": True, "result": text})
    except Exception as e:
        return api_error(message=f"OpenAI test failed: {e}", status_code=502)


@router.get("/supabase")
async def test_supabase():
    db = get_db_admin_service()
    try:
        # lightweight request: list tables isn't available; just do a select on a known table if present
        # We'll probe 'job_descriptions' which exists in the app.
        rows = await db.select("job_descriptions", columns="id", limit=1)
        return ok({"success": True, "rows": rows})
    except Exception as e:
        return api_error(message=f"Supabase test failed: {e}", status_code=502)


@router.post("/resume-parser")
async def test_resume_parser(resume: UploadFile = File(...)):
    try:
        content = await resume.read()
        parser = get_resume_parser()
        raw_text, parsed = await parser.parse_resume(content, resume.filename)
        return ok({"success": True, "raw_text_preview": (raw_text or "")[:200], "parsed": parsed.model_dump()})
    except Exception as e:
        return api_error(message=f"Resume parser failed: {e}", status_code=400)
