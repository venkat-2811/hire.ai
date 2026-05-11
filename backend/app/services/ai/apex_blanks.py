from __future__ import annotations

from typing import Any, Dict, List

from app.services.ai.factory import get_ai


async def generate_apex_fill_in_the_blanks(
    *,
    job: Dict[str, Any],
    count: int,
    difficulty: str,
) -> List[Dict[str, Any]]:
    ai = get_ai()

    prompt = (
        "You are an expert Salesforce Apex interviewer."
        " Create Apex fill-in-the-blanks questions for a candidate assessment.\n\n"
        "JOB CONTEXT JSON:\n"
        f"{job}\n\n"
        "REQUIREMENTS:\n"
        f"- Generate exactly {count} questions.\n"
        f"- Difficulty: {difficulty}.\n"
        "- Each question must include a realistic Apex code snippet with blanks removed.\n"
        "- CRITICAL: Replace each missing part in the code with the EXACT token ___ (three underscores).\n"
        "- The code field MUST contain ___ for every blank, in the same order as the blanks array.\n"
        "- Example code: 'List<Account> accs = [___ Id, Name FROM ___ LIMIT ___];'\n"
        "- Each blank must have a unique id (BLANK_1, BLANK_2, ...) in order of appearance in the code.\n"
        "- placeholder must be a short descriptive hint (e.g. 'SOQL keyword', 'object name', 'integer limit').\n"
        "- Provide expected answers for each blank.\n"
        "- Include points per question (5-15).\n\n"
        "OUTPUT JSON ONLY in this shape:\n"
        "{\n"
        '  "questions": [\n'
        "    {\n"
        '      "id": "q1",\n'
        '      "title": "SOQL Query",\n'
        '      "prompt": "Complete the SOQL query to fetch accounts.",\n'
        '      "code": "List<Account> accs = [___ Id FROM ___ LIMIT ___];",\n'
        '      "blanks": [\n'
        '        {"blank_id": "BLANK_1", "placeholder": "SOQL keyword", "expected": "SELECT"},\n'
        '        {"blank_id": "BLANK_2", "placeholder": "object name", "expected": "Account"},\n'
        '        {"blank_id": "BLANK_3", "placeholder": "integer limit", "expected": "100"}\n'
        "      ],\n"
        '      "points": 10\n'
        "    }\n"
        "  ]\n"
        "}"
    )

    generated = await ai.generate_json(prompt, temperature=0.4, max_tokens=6000, timeout_s=45)
    questions = generated.get("questions") if isinstance(generated, dict) else None
    if not isinstance(questions, list):
        return []
    result = []
    for q in questions:
        if not isinstance(q, dict):
            continue
        # Normalize field names to match frontend interface
        if "code_with_blanks" not in q and "code" in q:
            q["code_with_blanks"] = q["code"]
        if "instructions" not in q and "prompt" in q:
            q["instructions"] = q["prompt"]
        if "instructions" not in q and "title" in q:
            q["instructions"] = q["title"]
        if "code_with_blanks" not in q:
            q["code_with_blanks"] = ""
        # Normalize blank guidance field
        for blank in q.get("blanks", []):
            if isinstance(blank, dict) and "guidance" not in blank:
                blank["guidance"] = blank.get("hint") or blank.get("notes") or ""
        result.append(q)
    return result


async def evaluate_apex_fill_in_the_blanks(
    *,
    questions: List[Dict[str, Any]],
    submissions: Dict[str, Dict[str, str]],
) -> Dict[str, Any]:
    """Port of Node.js evaluateApexFillInTheBlanks() logic.

    Input:
    - questions: list of apex blanks questions stored in session.proctoring_data.assessment_content.apex_blanks
    - submissions: question_id -> blank_id -> answer

    Output:
    - { results: [...], total_score: number, max_score: number }
    """

    max_score = sum(float(q.get("points") or 0) for q in (questions or []))

    prompt = (
        "You are a strict Apex syntax evaluator.\n"
        "Evaluate the candidate's answers for Apex fill-in-the-blanks questions.\n\n"
        "RULES:\n"
        "- Grade each blank as correct/incorrect.\n"
        "- Correctness requires exact syntax (case-sensitive) unless Apex is case-insensitive for that token (e.g., keywords). Use reasonable judgment but be strict.\n"
        "- If minor whitespace differences only, consider correct.\n"
        "- Provide constructive feedback.\n"
        "- Score each question between 0 and its points.\n\n"
        "INPUT JSON:\n"
        f"{ {'questions': questions, 'submissions': submissions} }\n\n"
        "OUTPUT JSON ONLY:\n"
        "{\n"
        '  "results": [\n'
        "    {\n"
        '      "question_id": "...",\n'
        '      "score": 0,\n'
        '      "max_score": 10,\n'
        '      "feedback": "...",\n'
        '      "per_blank": [\n'
        '        {"blank_id": "BLANK_1", "correct": true, "expected": "...", "received": "...", "notes": "..."}\n'
        "      ]\n"
        "    }\n"
        "  ]\n"
        "}\n"
    )

    ai = get_ai()
    judged = await ai.generate_json(prompt, temperature=0.2, max_tokens=4000, timeout_s=60)

    results = judged.get("results") if isinstance(judged, dict) else None
    if not isinstance(results, list):
        results = []

    total_score = 0.0
    for r in results:
        if isinstance(r, dict):
            try:
                total_score += float(r.get("score") or 0)
            except Exception:
                pass

    return {
        "results": results,
        "total_score": total_score,
        "max_score": max_score,
    }
