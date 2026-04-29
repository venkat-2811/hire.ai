from typing import Dict, Any


def get_technical_questions_prompt(
    role: str, level: str, description: str, must_have: str, good_to_have: str,
    min_diff: int, max_diff: int, seed: str, previous_q_text: str,
    candidate_skills: str, experience_years: float, num_questions: int
) -> tuple[str, str]:

    system_prompt = f"""You are an expert technical interviewer creating advanced, independent interview questions.
Your role is to generate thoughtful, scenario-based questions that assess deep technical understanding.

=== CRITICAL RULES FOR INTERVIEW QUESTIONS ===

RULE 1 — INDEPENDENCE (MOST IMPORTANT):
Every question MUST stand completely on its own. Questions must NEVER:
- Reference or build upon a previous question ("Following up on that...", "Similarly to what we discussed...")
- Assume the candidate has answered a prior question
- Be a follow-up, clarification, or extension of another question
- Use phrases like "Also...", "Additionally...", "What about...", "Now tell me about..."
Each question is asked in isolation. A candidate could answer question 5 without ever seeing questions 1-4.

RULE 2 — NO REPETITION:
Each question MUST cover a different skill, concept, or scenario. Never ask two questions about the same topic.

RULE 3 — BROAD SKILL COVERAGE:
Distribute questions across ALL skills mentioned: {must_have} and {good_to_have}
Do NOT cluster multiple questions on the same technology or concept.

RULE 4 — STANDALONE SCENARIOS:
Each question must provide its own complete context (role, situation, constraints) within the question text itself.
Never rely on prior context being established.

RULE 5 — VERBAL-FRIENDLY:
Questions must be answerable verbally in 2-5 minutes. Focus on reasoning, approaches, and trade-offs — not code syntax."""

    user_prompt = f"""Generate {num_questions} unique, independent technical interview questions for a {role} position at {level} level.

CONTEXT:
- Role: {role}
- Level: {level}
- Job Description: {description[:800]}
- Must-Have Skills: {must_have}
- Preferred Skills: {good_to_have}
- Candidate Background: {candidate_skills} ({experience_years} years experience)
- Difficulty Range: {min_diff}-{max_diff} (scale 1-5)
- Uniqueness Seed: {seed}

ABSOLUTE REQUIREMENTS:
1. INDEPENDENT: Every question is self-contained — no references to "previous questions", "as mentioned", or "following up"
2. UNIQUE TOPICS: Each question covers a different skill/concept — no repetition across the {num_questions} questions
3. SCENARIO-BASED: Present realistic technical scenarios, not abstract "explain X" questions
4. VERBAL-FRIENDLY: Answerable in 2-5 minutes verbally, no code writing required
5. BROAD COVERAGE: Spread evenly across must-have skills: {must_have} AND preferred skills: {good_to_have}
6. PRACTICAL: Focus on real-world challenges a {role} would face at {level} level
7. NO CODE REQUIREMENTS: Emphasize concepts, reasoning, and problem-solving approaches over syntax
{previous_q_text}

Return JSON:
{{
    "questions": [
        {{
            "question_text": "Complete standalone scenario-based technical question with full context",
            "difficulty_level": 3,
            "expected_answer": "Key points a strong answer should cover",
            "time_limit_seconds": 180,
            "focus_area": "Specific technical domain being assessed"
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

RULE 2 — NO REPETITION:
Each question MUST assess a different competency. Never ask two questions about the same skill (e.g., two questions about "handling conflict").

RULE 3 — COMPETENCY COVERAGE:
Cover a broad range of competencies: leadership, teamwork, communication, problem-solving, adaptability, time management, initiative, conflict resolution.
Do NOT cluster on one competency."""

    user_prompt = f"""Generate {num_questions} behavioral interview questions for a {role} position at {level} level.

CONTEXT:
- Role: {role}
- Level: {level}
- Candidate Experience: {experience_context}
- Uniqueness Seed: {seed}

ABSOLUTE REQUIREMENTS:
1. INDEPENDENT: Every question stands alone — no references to "as you mentioned", "following up", or prior context
2. DIFFERENT COMPETENCIES: Each question assesses a different professional competency — no repetition
3. SITUATIONAL FOCUS: "Tell me about a time when..." or "Describe a situation where..." format (STAR method)
4. ROLE-RELEVANT: Scenarios must connect to {role} responsibilities
5. LEVEL-APPROPRIATE: Match question complexity to {level} seniority
6. OPEN-ENDED: Encourage detailed, specific responses with measurable outcomes
7. COMPLETE CONTEXT: Each question must include enough context so it's understandable without any prior discussion

Return JSON:
{{
    "questions": [
        {{
            "question_text": "Complete standalone behavioral question with full context",
            "competency": "Leadership|Teamwork|Problem-solving|Communication|Adaptability|Time Management",
            "difficulty_level": 3,
            "time_limit_seconds": 300,
            "focus_area": "Professional competency being assessed"
        }}
    ]
}}"""

    return system_prompt, user_prompt


def get_interview_questions_general_prompt(job_description: Dict[str, Any], resume_data: Dict[str, Any], num_technical: int, num_behavioral: int, difficulty: int) -> tuple[str, str]:
    import json
    system_instruction = """You are an expert interview conductor creating comprehensive, independent assessment questions.
Your role is to generate balanced, relevant questions where each question is fully self-contained.

=== CRITICAL RULES ===
1. INDEPENDENCE: Every question MUST be standalone — no references to other questions, prior answers, or "following up"
2. NO REPETITION: Each question tests a different skill, concept, or competency
3. COMPLETE CONTEXT: Each question provides all necessary context within itself
4. NEVER use: "As mentioned", "Following up", "Also", "Similarly", "What about" to link questions"""

    user_prompt = f"""Generate interview questions for this candidate and role.

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
- Technical Questions: {num_technical} — each covering a DIFFERENT skill from the must-have and preferred skills list
- Behavioral Questions: {num_behavioral} — each assessing a DIFFERENT professional competency
- Target Difficulty: {difficulty}/5
- Format: Discussion-based, verbal-friendly (no code writing)

ABSOLUTE RULES:
1. Each question MUST be completely independent and self-contained
2. No two questions can cover the same skill, concept, or competency
3. Spread technical questions evenly across all listed must-have and preferred skills
4. Behavioral questions must each target a different competency (leadership, teamwork, communication, etc.)
5. NEVER reference previous questions or use connective phrases between questions
6. Every question must include enough context to be understood in isolation

Return JSON:
{{
    "questions": [
        {{
            "question_text": "Complete standalone question with all necessary context",
            "question_type": "technical|behavioral",
            "difficulty_level": 3,
            "expected_answer": "Key points a strong answer should cover",
            "time_limit_seconds": 180,
            "focus_area": "Specific domain or competency being evaluated"
        }}
    ]
}}"""

    return system_instruction, user_prompt
