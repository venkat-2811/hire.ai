from typing import Dict, Any

def get_technical_questions_prompt(
    role: str, level: str, description: str, must_have: str, good_to_have: str, 
    min_diff: int, max_diff: int, seed: str, previous_q_text: str, 
    candidate_skills: str, experience_years: float, num_questions: int
) -> tuple[str, str]:
    
    system_prompt = f"""You are an expert technical interviewer creating advanced interview questions.
Your role is to generate thoughtful, scenario-based questions that assess deep technical understanding."""
    
    user_prompt = f"""Generate {num_questions} unique technical interview questions for a {role} position at {level} level.

CONTEXT:
- Role: {role}
- Level: {level}
- Experience Required: {description[:800]}
- Must-Have Skills: {must_have}
- Preferred Skills: {good_to_have}
- Candidate Background: {candidate_skills} ( {experience_years} years experience)
- Difficulty Range: {min_diff}-{max_diff} (scale 1-5)
- Uniqueness Seed: {seed}

QUESTION REQUIREMENTS:
1. SCENARIO-BASED: Present realistic technical scenarios, not abstract questions
2. CONCEPTUAL FOCUS: Test understanding, reasoning, and problem-solving approaches
3. VERBAL-FRIENDLY: Questions answerable in 2-5 minutes verbally
4. DIFFICULTY PROGRESSION: Mix difficulty levels appropriately
5. UNIQUE CONTENT: Use seed {seed} to ensure originality
6. PRACTICAL RELEVANCE: Focus on real-world challenges in this role
7. NO CODE REQUIREMENTS: Emphasize concepts over syntax

Return JSON:
{{
    "questions": [
        {{
            "question_text": "Scenario-based technical question",
            "difficulty_level": 3,
            "expected_answer": "Key points for comprehensive answer",
            "time_limit_seconds": 180,
            "focus_area": "Technical domain being assessed"
        }}
    ]
}}"""
    
    return system_prompt, user_prompt


def get_behavioral_questions_prompt(
    role: str, level: str, experience_context: str, seed: str, num_questions: int
) -> tuple[str, str]:
    
    system_prompt = f"""You are an expert behavioral interviewer specializing in professional assessment.
Your role is to create insightful behavioral questions that evaluate soft skills and cultural fit."""
    
    user_prompt = f"""Generate {num_questions} behavioral interview questions for a {role} position at {level} level.

CONTEXT:
- Role: {role}
- Level: {level}
- Candidate Experience: {experience_context}
- Uniqueness Seed: {seed}

BEHAVIORAL QUESTION REQUIREMENTS:
1. SITUATIONAL FOCUS: Present realistic work scenarios
2. STAR METHOD: Questions should elicit Situation, Task, Action, Result responses
3. COMPETENCY ASSESSMENT: Evaluate key professional competencies
4. ROLE RELEVANCE: Tailor scenarios to {role} responsibilities
5. EXPERIENCE LEVEL: Match questions to {level} seniority
6. OPEN-ENDED: Encourage detailed, thoughtful responses
7. CULTURAL FIT: Assess alignment with modern workplace practices

Return JSON:
{{
    "questions": [
        {{
            "question_text": "Describe a situation where you had to...",
            "competency": "Leadership|Teamwork|Problem-solving|Communication",
            "difficulty_level": 3,
            "time_limit_seconds": 300,
            "focus_area": "Professional competency being assessed"
        }}
    ]
}}"""
    
    return system_prompt, user_prompt


def get_interview_questions_general_prompt(job_description: Dict[str, Any], resume_data: Dict[str, Any], num_technical: int, num_behavioral: int, difficulty: int) -> tuple[str, str]:
    system_instruction = """You are an expert interview conductor creating comprehensive assessment questions.
Your role is to generate balanced, relevant questions for fair candidate evaluation."""
    
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
- Technical Questions: {num_technical}
- Behavioral Questions: {num_behavioral}
- Target Difficulty: {difficulty}/5
- Focus: Conceptual understanding, not code syntax
- Format: Discussion-based, verbal-friendly

QUESTION STANDARDS:
1. RELEVANCE: Align with job requirements and candidate background
2. FAIRNESS: Accessible questions appropriate for experience level
3. COMPREHENSIVE: Cover key technical and behavioral competencies
4. UNIQUENESS: Original questions not found elsewhere
5. CLARITY: Clear, unambiguous questions

Return JSON:
{{
    "questions": [
        {{
            "question_text": "Comprehensive interview question",
            "question_type": "technical|behavioral",
            "difficulty_level": 3,
            "expected_answer": "Key assessment criteria",
            "time_limit_seconds": 180,
            "focus_area": "Domain being evaluated"
        }}
    ]
}}"""
    
    return system_instruction, user_prompt
