import json
from typing import Dict, Any, List, Optional

# ==========================================
# RESUME & ATS SCREENING PROMPTS
# ==========================================

def get_analyze_resume_prompt(resume_text: str) -> tuple[str, str]:
    system_instruction = """You are an expert resume parser and analyzer.
Extract structured information from resumes accurately."""
    
    user_prompt = f"""Analyze the following resume and extract information in this exact JSON format:
{{
    "skills": ["skill1", "skill2", ...],
    "experience": [
        {{
            "title": "Job Title",
            "company": "Company Name",
            "duration": "Duration string",
            "description": "Brief description",
            "start_date": "YYYY-MM or null",
            "end_date": "YYYY-MM or null"
        }}
    ],
    "education": [
        {{
            "degree": "Degree Name",
            "institution": "Institution Name",
            "year": "Graduation Year"
        }}
    ],
    "summary": "Brief professional summary",
    "contact": {{
        "email": "email or null",
        "phone": "phone or null",
        "linkedin": "linkedin url or null"
    }},
    "total_experience_years": 0.0,
    "certifications": ["cert1", "cert2", ...]
}}

Resume:
{resume_text}
"""
    return system_instruction, user_prompt


def get_screen_candidate_prompt(job_description: Dict[str, Any], resume_data: Dict[str, Any]) -> tuple[str, str]:
    system_instruction = """You are an expert ATS (Applicant Tracking System) that screens candidates.
Provide detailed, fair, and explainable screening results."""
    
    user_prompt = f"""Screen this candidate against the job requirements.

Job Requirements:
- Title: {job_description.get('title', 'N/A')}
- Role: {job_description.get('role', 'N/A')}
- Level: {job_description.get('level', 'N/A')}
- Description: {job_description.get('description', 'N/A')}
- Must Have Skills: {job_description.get('must_have_skills', [])}
- Good to Have Skills: {job_description.get('good_to_have_skills', [])}
- Min Experience: {job_description.get('min_experience_years', 0)} years

Candidate Resume Data:
{json.dumps(resume_data, indent=2)}

Provide screening results in this exact JSON format:
{{
    "overall_score": 75,
    "skill_relevance_score": 80,
    "experience_score": 70,
    "education_score": 75,
    "credibility_score": 85,
    "shortlisted": true,
    "shortlist_reason": "Reason for decision",
    "reason_codes": [
        {{
            "code": "SKILL_MATCH",
            "type": "positive",
            "description": "Has required Python skills",
            "impact": 15
        }}
    ],
    "detailed_analysis": {{
        "skill_match": [
            {{
                "skill": "Python",
                "found": true,
                "relevance": "must_have",
                "evidence": "5 years experience mentioned",
                "confidence": 0.9
            }}
        ],
        "experience_analysis": "Analysis of work experience",
        "education_analysis": "Analysis of education",
        "career_gap_analysis": "Any gaps identified",
        "credibility_flags": []
    }}
}}
"""
    return system_instruction, user_prompt


# ==========================================
# INTERVIEW QUESTION GENERATION PROMPTS
# ==========================================

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
- Questions should be specific and test real-world knowledge
- Difficulty should range from {min_diff} to {max_diff} (scale 1-5)
- Include a mix of conceptual and scenario-based questions
- Questions should be answerable in 2-5 minutes
- Use the seed "{seed}" to ensure uniqueness
- Tailor questions to the candidate's background when relevant
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
    system_instruction = """You are an expert technical interviewer.
Generate relevant, challenging, and fair interview questions."""
    
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


def get_evaluate_response_prompt(question: str, question_type: str, expected_answer: str, candidate_response: str) -> tuple[str, str]:
    system_instruction = """You are an expert interview evaluator.
Provide fair, detailed, and constructive feedback."""
    
    user_prompt = f"""Evaluate this interview response.

Question ({question_type}): {question}

Expected Answer Points: {expected_answer}

Candidate's Response: {candidate_response}

Provide evaluation in this JSON format:
{{
    "score": 7,
    "max_score": 10,
    "feedback": "Detailed feedback",
    "strengths": ["strength1", "strength2"],
    "improvements": ["area1", "area2"],
    "technical_accuracy": 0.8,
    "communication_score": 0.75,
    "completeness": 0.7
}}
"""
    return system_instruction, user_prompt


# ==========================================
# TECHNICAL ASSESSMENT GENERATION PROMPTS
# ==========================================

def get_mcq_generation_prompt(
    role: str, level: str, description: str, must_have_skills: str, good_to_have_skills: str, count: int
) -> tuple[str, str]:
    
    system_prompt = f"""You are creating a multiple-choice technical assessment for a {role} position at {level} level.

Job Description: {description[:800]}
Must-Have Skills: {must_have_skills}
Good-to-Have Skills: {good_to_have_skills}

Generate {count} multiple-choice questions that:
- Test practical knowledge of the required skills
- Bias toward hard difficulty with advanced concepts, edge cases, and tradeoffs
- Have 4 options each with exactly ONE correct answer
- Use plausible distractors that reflect common pitfalls
- Are specific to this role and level
- Cover a variety of topics from the job description

Return a JSON object:
{{
    "questions": [
        {{
            "question": "Question text here",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct_index": 0,
            "difficulty": "easy|medium|hard",
            "topic": "Topic name",
            "points": 5
        }}
    ]
}}"""

    user_prompt = f"Generate {count} MCQ questions for this {role} position."
    return system_prompt, user_prompt


def get_coding_challenges_prompt(
    role: str, level: str, description: str, must_have_skills: str, count: int
) -> tuple[str, str]:
    
    system_prompt = f"""You are creating coding challenges for a {role} position at {level} level.

Job Description: {description[:800]}
Key Skills: {must_have_skills}

Generate {count} coding challenges that:
- Test practical coding ability relevant to this role
- Are on the harder end of the level with nuanced edge cases
- Are solvable in 20-35 minutes each
- Include clear problem descriptions
- Provide starter code templates
- STRICT REQUIREMENT: You MUST provide a `test_cases` array with at least 3 diverse test cases (including edge cases).
- `input` must be a JSON object mapping Python argument names to values.
- `expected` must be the expected direct return value.
- Emphasize advanced reasoning within {level}

Return JSON:
{{
    "challenges": [
        {{
            "title": "Challenge Title",
            "description": "Detailed problem description with examples",
            "starter_code": "def solution(arg1):\\n    pass",
            "test_cases": [
                {{"input": {{"arg1": "value"}}, "expected": "result"}},
                {{"input": {{"arg1": "edge_case"}}, "expected": "result2"}}
            ],
            "difficulty": "easy|medium|hard",
            "time_limit_minutes": 15,
            "points": 25
        }}
    ]
}}"""

    user_prompt = f"Generate {count} coding challenges for {role}."
    return system_prompt, user_prompt


def get_generate_practical_assessment_prompt(job_role: str, level: str, skills: List[str]) -> tuple[str, str]:
    system_instruction = """You are an expert at creating practical technical assessments.
Create realistic, fair, and skill-appropriate challenges."""
    
    user_prompt = f"""Create a practical assessment for:
- Role: {job_role}
- Level: {level}
- Key Skills: {skills}

Return in this JSON format:
{{
    "title": "Assessment Title",
    "description": "Detailed problem description",
    "requirements": ["req1", "req2"],
    "time_limit_minutes": 60,
    "evaluation_criteria": [
        {{"criterion": "Code Quality", "weight": 25}},
        {{"criterion": "Correctness", "weight": 35}},
        {{"criterion": "Efficiency", "weight": 20}},
        {{"criterion": "Best Practices", "weight": 20}}
    ],
    "starter_code": "# Optional starter code",
    "test_cases": ["Test case 1", "Test case 2"]
}}
"""
    return system_instruction, user_prompt


def get_evaluate_practical_submission_prompt(assessment: Dict[str, Any], submission: str) -> tuple[str, str]:
    system_instruction = """You are an expert code reviewer and evaluator.
Provide thorough, fair, and constructive evaluation."""
    
    user_prompt = f"""Evaluate this practical assessment submission.

Assessment:
- Title: {assessment.get('title', 'N/A')}
- Description: {assessment.get('description', 'N/A')}
- Requirements: {assessment.get('requirements', [])}
- Evaluation Criteria: {assessment.get('evaluation_criteria', [])}

Candidate's Submission:
{submission}

Provide evaluation in this JSON format:
{{
    "overall_score": 75,
    "max_score": 100,
    "criteria_scores": [
        {{"criterion": "Code Quality", "score": 20, "max": 25, "feedback": "Good structure"}},
        {{"criterion": "Correctness", "score": 30, "max": 35, "feedback": "Mostly correct"}}
    ],
    "strengths": ["strength1", "strength2"],
    "improvements": ["improvement1", "improvement2"],
    "detailed_feedback": "Overall detailed feedback",
    "code_quality_notes": "Notes on code quality",
    "would_pass": true
}}
"""
    return system_instruction, user_prompt
