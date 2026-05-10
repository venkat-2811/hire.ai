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
        "- Each question must include a code snippet with blanks.\n"
        "- Each blank must have a unique id (e.g., BLANK_1, BLANK_2).\n"
        "- Provide expected answers for each blank.\n"
        "- Include points per question (5-15).\n\n"
        "OUTPUT JSON ONLY in this shape:\n"
        "{\n"
        '  "questions": [\n'
        "    {\n"
        '      "id": "...",\n'
        '      "title": "...",\n'
        '      "prompt": "...",\n'
        '      "code": "...",\n'
        '      "blanks": [\n'
        '        {"blank_id": "BLANK_1", "placeholder": "___", "expected": "..."}\n'
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
    return [q for q in questions if isinstance(q, dict)]


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
    judged = await ai.generate_json(prompt, temperature=0.2, max_tokens=4000, timeout_s=25)

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
