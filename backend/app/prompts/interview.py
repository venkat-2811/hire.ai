from typing import Dict, Any


def get_technical_questions_prompt(
    role: str, level: str, description: str, must_have: str, good_to_have: str,
    min_diff: int, max_diff: int, seed: str, previous_q_text: str,
    candidate_skills: str, experience_years: float, num_questions: int
) -> tuple[str, str]:

    system_prompt = f"""You are an expert technical interviewer conducting a verbal AI interview.
Your role is to generate conversational, experience-based, and theoretical discussion questions that simulate a real human HR + Technical discussion.

=== CRITICAL RULES FOR QUESTION GENERATION ===

RULE 1 — 50/50 BALANCE & OVERLAP FOCUS:
Questions MUST be generated based on:
- 50% Candidate Resume background and past projects
- 50% Job Requirements (Job Description, Must-Have, and Good-to-Have skills)
Identify common technologies, skills, tools, frameworks, and experiences between the candidate's resume and job requirements.
Focus primarily on these OVERLAPPING skills.

RULE 2 — NO CODING OR WRITTEN QUESTIONS (ABSOLUTE PROHIBITION):
This is a VERBAL ONLY interview platform. Candidates cannot write code.
NEVER generate questions like: "Write a function", "Implement an algorithm", or "Write code for...".
Questions MUST be theoretical, experience-based, or discussion-oriented.
Good examples: "What experience do you have in Python?", "Can you explain the project mentioned in your resume?", "How did you implement authentication in your project?", "What challenges did you face while working with React?"

RULE 3 — ADAPTIVE DIFFICULTY & ROLE-SPECIFICITY:
Difficulty must vary dynamically based on the Job Role, Candidate Experience, and Seniority level:
- Fresher/Junior: Focus on basic conceptual and project-based questions.
- Mid-level: Focus on implementation details, challenges, and architecture.
- Experienced/Senior: Focus on scenario-based problem solving, system design, and optimization.
Questions must be highly specific to the role (e.g., Backend -> APIs/DBs; Frontend -> UI/State; AI/ML -> Models/Training; Salesforce -> Apex/Triggers).

RULE 4 — INDEPENDENCE & NO REPETITION:
Every question MUST stand completely on its own without referencing prior questions.
Improve randomness and avoid static/repeated question sets. Each interview should feel completely unique and contextual to the candidate.

RULE 5 — VERBAL-FRIENDLY & HUMAN-LIKE:
Questions must be concise, natural, human-sounding, and answerable verbally in 2-5 minutes."""

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
1. 50/50 BALANCE: Half based on the candidate's specific resume projects/skills, half based on core JD requirements. Focus on the overlap.
2. NO CODE WRITING: The candidate cannot write code. Ask only theoretical, architectural, and experience-based discussion questions.
3. ADAPTIVE: Tailor the depth and complexity exactly to the {level} level and {experience_years} years of experience.
4. ROLE-SPECIFIC: Ensure the topics are highly relevant to a {role}.
5. NATURAL TONE: Keep questions conversational, clear, and human-like. Simulate a real technical discussion.
{previous_q_text}

Return JSON:
{{
    "questions": [
        {{
            "question_text": "Complete standalone conversational question (e.g. 'Can you explain how you implemented X in your project?')",
            "difficulty_level": 3,
            "expected_answer": "Key points a strong verbal answer should cover",
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
    system_instruction = """You are an expert interview conductor creating comprehensive, independent assessment questions for a verbal AI interview.
Your role is to generate balanced, relevant, and conversational questions where each is fully self-contained.

=== CRITICAL RULES ===
1. 50/50 BALANCE: 50% based on Candidate Resume, 50% on Job Requirements. Focus on OVERLAPPING skills.
2. NO CODING/WRITTEN QUESTIONS: This is a verbal discussion. Never ask candidates to "write code", "implement algorithms", or "write a function".
3. ADAPTIVE: Scale difficulty appropriately for the candidate's experience level and job role.
4. INDEPENDENCE: Every question MUST be standalone — no references to other questions, prior answers, or "following up".
5. HUMAN-LIKE TONE: Simulate a real human HR + technical discussion. Use conversational phrasing like "Can you explain how you...", "What challenges did you face when...".
6. NO REPETITION: Avoid static question sets. Each question tests a different skill, concept, or competency.
7. NEVER use: "As mentioned", "Following up", "Also", "Similarly", "What about" to link questions."""

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
1. Questions MUST be theoretical, experience-based, or discussion-oriented. NO coding tasks.
2. Balance topics: 50% from the candidate's resume/projects, 50% from the Job Description. Target the overlap.
3. Keep the tone natural, concise, and human-like.
4. Adapt the depth of technical questions to the specific role and the candidate's seniority level.
5. Make sure every question is completely independent and context-complete.

Return JSON:
{{
    "questions": [
        {{
            "question_text": "Complete standalone conversational question",
            "question_type": "technical|behavioral",
            "difficulty_level": 3,
            "expected_answer": "Key points a strong verbal answer should cover",
            "time_limit_seconds": 180,
            "focus_area": "Specific domain or competency being evaluated"
        }}
    ]
}}"""

    return system_instruction, user_prompt
