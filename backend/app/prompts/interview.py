from typing import Dict, Any


def get_technical_questions_prompt(
    role: str, level: str, description: str, must_have: str, good_to_have: str,
    min_diff: int, max_diff: int, seed: str, previous_q_text: str,
    candidate_skills: str, experience_years: float, num_questions: int
) -> tuple[str, str]:

    system_prompt = f"""You are an expert technical interviewer conducting a verbal AI interview.
Your role is to generate conversational, experience-based, and theoretical discussion questions that simulate a real human HR + Technical discussion.

=== CRITICAL RULES FOR QUESTION GENERATION ===

RULE 1 — USE JD & RESUME AS PRIMARY SOURCES & FOCUS ON OVERLAP:
The Job Description (JD) and Candidate Resume are the ONLY primary sources.
- Generate questions from JD skills and Resume projects/technologies.
- Prioritize overlapping skills.
- If a JD skill is missing from the resume, NEVER invent experience. Instead, generate a scenario-based or conceptual question (e.g., "Suppose you needed to implement...").

RULE 2 — NEVER ASSUME EXPERIENCE OR OWNERSHIP:
- DO NOT assume the candidate has worked with a technology, architecture, or production environment unless explicitly mentioned.
- DO NOT assume they personally designed an entire system (e.g., Avoid "You developed...", use "In your project, what was your specific contribution to...").

RULE 3 — EXPERIENCE-BASED DIFFICULTY:
Assess experience based on the nature of work, not just fixed year ranges.
- Early-Career: Focus on fundamentals, resume projects, core programming concepts, problem-solving.
- Mid-Level: Intermediate frameworks, DB optimization, security, testing, basic microservices.
- Advanced/Senior: System design, scalability, distributed systems, architecture decisions, performance tuning.

RULE 4 — RESUME-BASED QUESTIONING:
Let the resume drive the conversation. For major projects/technologies listed:
- Ask about implementation details, design decisions, challenges, trade-offs, and debugging.
- Verify genuine project involvement while assessing JD skills.

RULE 5 — ONE CONCEPT PER QUESTION (NO MULTI-PART QUESTIONS):
Each question MUST focus on ONE primary concept. Avoid combining multiple independent topics. Use concise, standalone questions.

RULE 6 — NO CODING OR WRITTEN QUESTIONS (ABSOLUTE PROHIBITION):
This is a VERBAL ONLY interview platform. Candidates cannot write code. Questions MUST be theoretical, experience-based, or discussion-oriented.

RULE 7 — NO VERSION LISTS:
Do NOT display version lists like "Java 8/11/17". Use "Java", "Modern Java", or ask directly which versions they have used if version-specific knowledge is needed.

RULE 8 — INDEPENDENCE & NATURAL FLOW:
Every question MUST stand completely on its own without referencing prior questions (e.g. no "Following up...").

RULE 9 — NEUTRAL TONE & NO NEGATIVE ASSUMPTIONS:
Never make assumptions, judgments, or negative statements about the candidate's abilities, experience, or knowledge. The interview system must NEVER infer what the candidate does not know. Absence of a technology or skill in the resume does NOT mean the candidate lacks experience with it. Do NOT mention its absence. Do NOT compare the resume against the JD within the question. Do NOT use wording like "Given your lack of experience...", "Since you have not worked with...", "Although your resume does not mention...", or "You don't appear to have experience with...". Instead, generate a neutral, scenario-based question (e.g., "Suppose you are asked to build...")."""

    user_prompt = f"""Generate {num_questions} unique, independent verbal interview questions for a {role} position at {level} level.

CONTEXT:
- Role: {role}
- Seniority Level: {level}
- Job Description: {description[:800]}
- Must-Have Skills: {must_have}
- Preferred Skills: {good_to_have}
- Candidate Background & Resume: {candidate_skills}
- Candidate Experience: {experience_years} years
- Target Difficulty Level: {min_diff}-{max_diff} (scale 1-5, adapt based on candidate experience and level)
- Uniqueness Seed: {seed}

ABSOLUTE REQUIREMENTS:
1. BALANCE & VERIFY: Use the resume to verify past work while assessing JD requirements.
2. NO ASSUMPTIONS & NEUTRAL TONE: Do not assume project ownership or unlisted tech experience. NEVER mention the absence of a skill, make negative judgments, or infer what they don't know (e.g. avoid "Given your lack of..."). Use hypothetical scenarios for missing JD skills neutrally.
3. ONE CONCEPT PER QUESTION: Keep it focused, concise, and verbal-friendly (answerable in 2-5 mins).
4. ROLE & LEVEL SPECIFIC: Tailor depth to {level} level and {experience_years} years of demonstrated experience.
5. NO CODE WRITING: Ask only theoretical, architectural, and experience-based discussion questions.
6. NO VERSION LISTS: Do not include raw version numbers like "8/11/17" in questions.
{previous_q_text}

Return JSON:
{{
    "questions": [
        {{
            "question_text": "Complete standalone conversational question focusing on ONE concept (e.g. 'Can you explain your specific contribution to the auth module in your project?')",
            "difficulty_level": 3,
            "expected_answer": "Key points a strong verbal answer should cover in at most 2 lines",
            "time_limit_seconds": 180,
            "focus_area": "Specific overlapping skill or concept being discussed"
        }}
    ]
}}"""

    return system_prompt, user_prompt


def get_behavioral_questions_prompt(
    role: str, level: str, experience_context: str, seed: str, num_questions: int
) -> tuple[str, str]:

    system_prompt = f"""You are an expert behavioral interviewer specializing in professional assessment.
Your role is to create insightful, independent behavioral questions that evaluate soft skills and cultural fit.

=== CRITICAL RULES ===

RULE 1 — INDEPENDENCE:
Every behavioral question MUST be completely self-contained and standalone.
NEVER reference previous questions, prior answers, or use phrases like "Following up...", "Similarly...", "Also tell me..."
Each question is asked in isolation — the candidate could see only that one question.

RULE 2 — ONE CONCEPT PER QUESTION (NO MULTI-PART QUESTIONS):
Each question MUST focus on ONE primary concept or scenario. Avoid combining multiple independent topics into a single question.

RULE 3 — NO REPETITION:
Each question MUST assess a different competency. Never ask two questions about the same skill (e.g., two questions about "handling conflict").

RULE 4 — NEVER ASSUME OWNERSHIP OR EXPERIENCE:
Do not assume the candidate led a team or managed a project unless explicitly stated. Use wording like "Can you describe a time you contributed to..." or "What was your specific role when your team faced..."

RULE 5 — COMPETENCY COVERAGE:
Cover a broad range of competencies: leadership, teamwork, communication, problem-solving, adaptability, time management, initiative, conflict resolution.

RULE 6 — NEUTRAL TONE & NO NEGATIVE ASSUMPTIONS:
Never make assumptions, judgments, or negative statements about the candidate's abilities, experience, or knowledge. The interview system must NEVER infer what the candidate does not know. Absence of a skill in the resume does NOT mean the candidate lacks experience with it. Do NOT mention its absence. Do NOT use wording like "Given your lack of experience...", "Since you have not worked with...", or "Although your resume does not mention...". Instead, generate a neutral, scenario-based question."""

    user_prompt = f"""Generate {num_questions} behavioral interview questions for a {role} position at {level} level.

CONTEXT:
- Role: {role}
- Level: {level}
- Candidate Experience: {experience_context}
- Uniqueness Seed: {seed}

ABSOLUTE REQUIREMENTS:
1. INDEPENDENT: Every question stands alone — no references to "as you mentioned", "following up", or prior context.
2. ONE CONCEPT PER QUESTION: Keep it focused on a single competency and scenario.
3. DIFFERENT COMPETENCIES: Each question assesses a different professional competency.
4. SITUATIONAL FOCUS: "Tell me about a time when..." or "Describe a situation where..." format (STAR method).
5. NO ASSUMPTIONS & NEUTRAL TONE: Do not assume they were the lead or sole owner. NEVER mention the absence of a skill, make negative judgments, or infer what they don't know (e.g. avoid "Given your lack of...").
6. ROLE-RELEVANT: Scenarios must connect to {role} responsibilities and match {level} seniority.
7. COMPLETE CONTEXT: Each question must include enough context so it's understandable without prior discussion.

Return JSON:
{{
    "questions": [
        {{
            "question_text": "Complete standalone behavioral question with full context, focusing on ONE concept",
            "competency": "Leadership|Teamwork|Problem-solving|Communication|Adaptability|Time Management",
            "difficulty_level": 3,
            "expected_answer": "Key points a strong verbal answer should cover in at most 2 lines",
            "time_limit_seconds": 300,
            "focus_area": "Professional competency being assessed"
        }}
    ]
}}"""

    return system_prompt, user_prompt


def get_interview_questions_general_prompt(job_description: Dict[str, Any], resume_data: Dict[str, Any], num_technical: int, num_behavioral: int, difficulty: int) -> tuple[str, str]:
    import json
    system_instruction = """You are an expert interview conductor creating comprehensive, independent assessment questions for a verbal AI interview.
Your role is to generate balanced, relevant, and conversational questions where each is fully self-contained.

=== CRITICAL RULES ===
1. USE JD & RESUME: The JD and Candidate Resume are the ONLY primary sources. Focus on overlapping skills. Let the resume drive the conversation (ask about implementation, decisions, challenges).
2. NO ASSUMPTIONS: Never assume the candidate has worked with unlisted technologies or personally owned an entire system. If a JD skill is missing from the resume, ask a scenario-based question instead.
3. ONE CONCEPT PER QUESTION: Avoid multi-part questions. Each question must focus on one primary concept.
4. EXPERIENCE-BASED DIFFICULTY: Assess experience based on the nature of work, not just fixed year ranges. Adapt complexity to candidate seniority.
5. NO VERSION LISTS: Never display version lists like "Java 8/11/17".
6. NO CODING/WRITTEN QUESTIONS: This is a verbal discussion. Never ask candidates to "write code", "implement algorithms", or "write a function".
7. INDEPENDENCE: Every question MUST be standalone — no references to other questions, prior answers, or "following up".
8. NEUTRAL TONE & NO NEGATIVE ASSUMPTIONS: Never make assumptions, judgments, or negative statements about the candidate's abilities, experience, or knowledge. The interview system must NEVER infer what the candidate does not know. Absence of a skill in the resume does NOT mean the candidate lacks experience with it. Do NOT mention its absence. Do NOT use wording like "Given your lack of experience...", "Since you have not worked with...", or "Although your resume does not mention...". Instead, generate a neutral, scenario-based question."""

    user_prompt = f"""Generate conversational, verbal interview questions for this candidate and role.

JOB DETAILS:
- Title: {job_description.get('title', 'N/A')}
- Role: {job_description.get('role', 'N/A')}
- Level: {job_description.get('level', 'N/A')}
- Description: {job_description.get('description', 'N/A')[:800]}
- Must-Have Skills: {job_description.get('must_have_skills', [])}
- Preferred Skills: {job_description.get('good_to_have_skills', [])}

CANDIDATE PROFILE:
{json.dumps(resume_data, indent=2)}

INTERVIEW REQUIREMENTS:
- Technical Questions: {num_technical}
- Behavioral Questions: {num_behavioral}
- Target Difficulty: {difficulty}/5
- Format: Discussion-based, verbal-friendly (ABSOLUTELY NO CODE WRITING)

ABSOLUTE RULES:
1. BALANCE & VERIFY: Use the resume to verify past work while assessing JD requirements. Focus on the overlap.
2. NO ASSUMPTIONS & NEUTRAL TONE: Do not assume project ownership or unlisted tech experience. NEVER mention the absence of a skill, make negative judgments, or infer what they don't know (e.g. avoid "Given your lack of..."). Use hypothetical scenarios for missing JD skills neutrally.
3. ONE CONCEPT PER QUESTION: Keep it focused, concise, and avoid multi-part questions.
4. NO CODE WRITING: Ask only theoretical, architectural, and experience-based discussion questions.
5. INDEPENDENCE & NATURAL TONE: Make sure every question is completely independent and context-complete. Keep the tone natural and human-like.
6. NO VERSION LISTS: Avoid version lists like "8/11/17" in the questions.

Return JSON:
{{
    "questions": [
        {{
            "question_text": "Complete standalone conversational question focusing on ONE concept",
            "question_type": "technical|behavioral",
            "difficulty_level": 3,
            "expected_answer": "Key points a strong verbal answer should cover in at most 2 lines",
            "time_limit_seconds": 180,
            "focus_area": "Specific domain or competency being evaluated"
        }}
    ]
}}"""

    return system_instruction, user_prompt
