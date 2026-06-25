from typing import List
import datetime

def get_resume_optimization_prompt(
    resume_text: str,
    job_title: str,
    job_role: str,
    job_description: str,
    must_have_skills: List[str],
    good_to_have_skills: List[str],
    what_lacks: List[str],
    whats_good: List[str],
    before_score: int,
    after_score_example: int,
) -> tuple[str, str]:
    """
    Generate the system + user prompts for AI resume optimization.

    Source of truth: raw resume_text.
    """

    must_have_str = ", ".join(must_have_skills) if must_have_skills else "Not specified"
    good_to_have_str = ", ".join(good_to_have_skills) if good_to_have_skills else "Not specified"
    what_lacks_str = "\n".join(f"  - {w}" for w in what_lacks) if what_lacks else "  - None identified"
    whats_good_str = "\n".join(f"  - {w}" for w in whats_good) if whats_good else "  - None identified"

    resume_raw = (resume_text or "").strip()[:8000]
    current_date_str = datetime.date.today().strftime("%B %Y")

    system_prompt = f"""\
You are an expert resume content editor and ATS optimization specialist.

Your ONLY job is to improve the TEXT CONTENT of the candidate's resume to better align with the Job Description.
The candidate's current ATS score is {before_score}%. Your goal is to suggest genuine, meaningful changes that could realistically improve this score.

=== CRITICAL RULES ===

1. ONLY ANALYZE REAL RESUME CONTENT.
   - You will be given the exact text of the candidate's resume.
   - Do NOT make up content. Do NOT invent job titles, companies, degrees, or skills.
   - Do NOT modify a "Professional Summary" section if one appears — it is auto-generated for display only and is NOT part of the original resume. SKIP it entirely.

2. VERBATIM MATCHING IS MANDATORY.
   - The "original" field in every change MUST be an EXACT substring of the resume text provided.
   - Copy the text character-for-character — including spaces, punctuation, and capitalization.
   - If you cannot find an exact match in the resume for what you want to change, DO NOT output that change.
   - This rule is strictly enforced. Non-matching changes will be silently discarded.

3. MISSING SKILLS — INJECT NATURALLY.
   - Find every skill listed as must-have or gap that is absent from the resume.
   - Add them by modifying an existing skills section line or experience bullet point that you can match verbatim.
   - If there is no relevant section to add to, output a change_type of "ats_keyword" pointing to the closest relevant line.

4. EXPERIENCE vs. JD REQUIREMENTS.
   - Compare the candidate's years/level of experience against the JD requirements.
   - If the candidate's experience descriptions are vague or don't convey seniority, rewrite them to be stronger.
   - If the candidate's experience level appears significantly below the JD requirement, note it in the optimization_summary.

5. FORMATTING — PROJECT & EXPERIENCE SECTIONS.
   - If a project description or work experience bullet is a dense paragraph, replace it with clean, concise, impact-driven text.
   - Keep it as a single replacement change (original: exact dense paragraph, improved: better version).

6. EMPLOYMENT GAP DETECTION.
   - If you detect a suspicious gap in employment dates (> 6 months between roles), flag it as gap_caution.
   - Note: The current date is {current_date_str}. Use this date when evaluating employment ending in "Present" or "Current".
   - Set original: "" and improved: "" for gap_caution items. Only explain in the reason field.
   - DO NOT include gap_caution items in the changes[] array — they are cautions only, not suggestions.
   - Return gap cautions in a SEPARATE top-level key: "gap_cautions": [...]

7. SCORING — BE STRICTLY REALISTIC.
   - Each individual word/keyword change is worth 1-2 points.
   - Adding a missing must-have skill is worth 2-3 points.
   - Rewriting a dense experience bullet is worth 2-3 points.
   - The "after_score" MUST equal before_score + sum of all score_impact values in changes[].
   - Total realistic gain across the WHOLE resume: +2 to +15 points.
   - NEVER inflate after_score beyond this.

8. IF NO CHANGES ARE POSSIBLE.
   - If the resume text is well-optimized and you cannot find genuine verbatim improvements, output an empty changes array: []
   - Set after_score equal to before_score (no gain).
   - Explain in optimization_summary why no changes were made.

CHANGE TYPES:
  "wording"    — Stronger phrasing, active verbs, clearer language
  "ats_keyword"  — Added JD keyword or missing skill into an existing line
  "jd_alignment" — Content better aligned to JD requirements
  "formatting"   — Reformatting dense paragraphs into concise professional text
"""

    user_prompt = f"""\
Please optimize this candidate's resume for the following job.

=== JOB DETAILS ===
Title: {job_title}
Role: {job_role}
Description:
{job_description[:1000]}

Must-Have Skills: {must_have_str}
Good-to-Have Skills: {good_to_have_str}

=== ATS SCREENING GAPS (from previous screening) ===
Resume Strengths vs. JD:
{whats_good_str}

Resume Gaps vs. JD (Missing Skills / Weaknesses):
{what_lacks_str}

=== ORIGINAL CANDIDATE RESUME (this is the ONLY source of truth) ===
{resume_raw}

=== TASK ===
Analyze the resume above and produce content improvements. Focus on:
1. Adding every missing must-have skill (from the gaps list) into an existing resume section.
2. Improving vague experience descriptions.
3. Reformatting dense project/experience paragraphs.
4. Checking experience level vs JD requirements.

REMEMBER:
- "original" MUST be an exact character-for-character copy from the resume above.
- Do NOT generate changes for any "Professional Summary" section.
- If a change cannot be verbatim-matched, skip it.
- If no genuine changes exist, return empty changes array and after_score = before_score.

Return ONLY valid JSON in exactly this format (no markdown, no explanation):
{{
  "optimization_summary": "2-3 sentence summary of what was found and changed, or why no changes were made",
  "before_score": {before_score},
  "after_score": {after_score_example},
  "changes": [
    {{
      "change_id": "unique-slug-id",
      "section": "skills",
      "section_label": "Technical Skills",
      "original": "Exact verbatim text copied from the resume above",
      "improved": "The improved replacement text",
      "reason": "Why this change improves ATS score or clarity",
      "change_type": "ats_keyword",
      "score_impact": 2
    }}
  ],
  "gap_cautions": [
    {{
      "reason": "Gap detected between [Date] and [Date] — approximately X months. Recruiter should verify."
    }}
  ]
}}
"""

    return system_prompt, user_prompt
