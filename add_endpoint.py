import re

with open('backend/app/api/v2/endpoints/candidates.py', 'r', encoding='utf-8') as f:
    content = f.read()

new_endpoint = """
@router.post("/{candidate_id}/generate-expected-answers")
async def generate_missing_expected_answers(
    candidate_id: str,
    job_id: str,
    user: ClerkUser = Depends(require_user)
):
    \"\"\"Generate missing expected answers for a candidate's AI interview.\"\"\"
    db = get_db_admin_service()
    
    # Check access
    user_job_ids = await get_user_job_ids(db, user.id)
    if job_id not in user_job_ids:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Fetch interview session
    def _fetch():
        return (
            db.client.from_("ai_interview_sessions")
            .select("*")
            .eq("candidate_id", candidate_id)
            .eq("job_id", job_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
    res = await db.run(_fetch)
    data = getattr(res, "data", None) or []
    if not data:
        return {"status": "error", "message": "No interview session found"}

    session = data[0]
    questions = session.get("questions", [])
    if not isinstance(questions, list):
        return {"status": "error", "message": "Invalid questions format"}

    from app.core.llm import OpenAIClient
    from app.core.config import settings
    llm = OpenAIClient(api_key=settings.OPENAI_API_KEY)
    
    updated = False
    for q in questions:
        if not isinstance(q, dict): continue
        if not q.get("expected_answer") and not q.get("expected_response"):
            q_text = q.get("question_text") or q.get("text") or q.get("question")
            if q_text:
                prompt = f"Provide a brief, 2-line expected response for the following interview question: {q_text}"
                try:
                    resp = await llm.generate_text(
                        prompt=prompt,
                        system_instruction="You are an expert technical interviewer. Provide an ideal expected answer in at most 2 concise lines.",
                        temperature=0.7
                    )
                    q["expected_answer"] = resp
                    updated = True
                except Exception as e:
                    print(f"Error generating answer: {e}")
                    pass

    if updated:
        def _update():
            return (
                db.client.from_("ai_interview_sessions")
                .update({"questions": questions})
                .eq("id", session["id"])
                .execute()
            )
        await db.run(_update)

    return {"status": "success", "updated": updated, "questions": questions}

"""

if "generate_missing_expected_answers" not in content:
    content += "\n" + new_endpoint
    with open('backend/app/api/v2/endpoints/candidates.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Added generate-expected-answers endpoint.")
else:
    print("Endpoint already exists.")
