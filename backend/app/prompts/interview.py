from typing import Dict, Any

def get_technical_questions_prompt(
    role: str, level: str, description: str, must_have: str, good_to_have: str, 
    min_diff: int, max_diff: int, seed: str, previous_q_text: str, 
    candidate_skills: str, experience_years: float, num_questions: int
) -> tuple[str, str]:
    
    system_prompt = f"""You are an expert technical interviewer for {role} positions.
Generate unique, challenging technical interview questions based strictly on the Job Description and Skills provided.

Role: {role}
Level: {level}
Job Description Summary: {description[:800]}
Must-Have Skills: {must_have}
Good-to-Have Skills: {good_to_have}

Guidelines:
- Questions must be purely conceptual and discussion-based. Do NOT ask for code, implementations, or syntax-heavy answers.
- Focus on assessing understanding, reasoning, approaches, trade-offs, and real-world thinking.
- Questions should sound natural in a live audio interview and be answerable verbally (e.g., “How would you approach…”, “What are the trade-offs…”, “Explain how…”).
- Difficulty should range from {min_diff} to {max_diff} (scale 1-5).
- Questions should be answerable verbally in 2-5 minutes.
- Use the seed "{seed}" to ensure uniqueness.
- Tailor questions to the candidate's background when relevant.
{previous_q_text}

Return a JSON object with this structure:
{{
    "questions": [
        {{
            "question_text": "The question",
            "difficulty_level": 3,
            "expected_answer": "Key points for a good answer",
            "time_limit_seconds": 180,
            "focus_area": "Specific topic being tested"
        }}
    ]
}}"""

    user_prompt = f"""Generate {num_questions} technical interview questions for this candidate.

Candidate Skills: {candidate_skills}
Experience: {experience_years} years
Job Description: {description[:500]}

Generate unique questions that assess their fit for this role."""

    return system_prompt, user_prompt


def get_behavioral_questions_prompt(
    role: str, level: str, experience_context: str, seed: str, num_questions: int
) -> tuple[str, str]:
    
    system_prompt = f"""You are an expert behavioral interviewer.
Generate STAR-format behavioral questions that assess soft skills and cultural fit.

Role: {role}
Level: {level}
{experience_context}

Focus on:
- Problem-solving approach
- Communication skills
- Teamwork and collaboration
- Handling pressure and deadlines
- Learning and adaptability

Use seed "{seed}" for uniqueness.

Return JSON:
{{
    "questions": [
        {{
            "question_text": "Tell me about a time when...",
            "expected_answer": "Look for: specific situation, actions taken, measurable results",
            "competency": "Problem Solving"
        }}
    ]
}}"""

    user_prompt = f"Generate {num_questions} behavioral questions."
    return system_prompt, user_prompt


def get_interview_questions_general_prompt(job_description: Dict[str, Any], resume_data: Dict[str, Any], num_technical: int, num_behavioral: int, difficulty: int) -> tuple[str, str]:
    system_instruction = """You are an expert technical interviewer conducting an audio-based interview.
Generate relevant, challenging, and fair interview questions that are purely conceptual and discussion-based. Do NOT ask for code, implementations, or syntax-heavy answers."""
    
    user_prompt = f"""Generate interview questions for this candidate and role.

Job:
- Title: {job_description.get('title', 'N/A')}
- Role: {job_description.get('role', 'N/A')}
- Level: {job_description.get('level', 'N/A')}
- Required Skills: {job_description.get('must_have_skills', [])}

Candidate Skills: {resume_data.get('skills', [])}
Experience Years: {resume_data.get('total_experience_years', 0)}

Generate {num_technical} technical questions and {num_behavioral} behavioral questions.
Difficulty level: {difficulty}/5

CRITICAL REQUIREMENT:
Since these questions will be asked verbally in an audio-based interview, they must strictly be conceptual and discussion-based. Focus on assessing understanding, reasoning, approaches, trade-offs, and real-world thinking (e.g., 'How would you approach...', 'Explain how...', 'What are the trade-offs...'). Absolutely NO coding, implementations, or syntax-heavy queries.

Return as JSON array:
[
    {{
        "question_text": "The question",
        "question_type": "technical",
        "difficulty_level": 3,
        "expected_answer": "Key points for ideal answer",
        "time_limit_seconds": 300,
        "max_score": 10,
        "metadata": {{"topic": "Python", "subtopic": "OOP"}}
    }}
]
"""
    return system_instruction, user_prompt
