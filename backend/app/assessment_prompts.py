import json
from typing import Dict, Any, List, Optional

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
    role: str, level: str, description: str, must_have_skills: str, good_to_have_skills: str, count: int, difficulty: str = "medium"
) -> tuple[str, str]:
    
    difficulty_instructions = {
        "easy": "Target medium-level questions. Maintain moderate complexity and clear logic, avoiding overly basic questions. Use limited edge cases.",
        "medium": "Target slightly more challenging questions. Increase depth and include edge cases. Include scenario-based or real-world problem questions.",
        "hard": "Target high-quality, advanced questions with strong complexity. Require deeper problem-solving and optimization. Use rigorous scenario-driven challenges."
    }

    instruction = difficulty_instructions.get(difficulty.lower(), difficulty_instructions["medium"])
    
    system_prompt = f"""You are creating a multiple-choice technical assessment for a {role} position at {level} level.

Job Description: {description[:800]}
Must-Have Skills: {must_have_skills}
Good-to-Have Skills: {good_to_have_skills}

Difficulty Target: {difficulty.upper()}
{instruction}

Generate {count} multiple-choice questions that:
- Test practical knowledge of the required skills
- Adhere strictly to the requested {difficulty.upper()} difficulty guidelines
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
    role: str, level: str, description: str, must_have_skills: str, count: int, difficulty: str = "medium"
) -> tuple[str, str]:
    
    difficulty_instructions = {
        "easy": "Generate medium-level coding problems with moderate complexity and clear logic. Limit edge cases.",
        "medium": "Generate slightly more challenging scenario-based or real-world logic problems with edge cases.",
        "hard": "Generate high-quality, advanced coding problems requiring deep reasoning, edge case handling, and optimization. Use sophisticated scenarios."
    }

    instruction = difficulty_instructions.get(difficulty.lower(), difficulty_instructions["medium"])
    
    system_prompt = f"""You are creating coding challenges for a {role} position at {level} level.

Job Description: {description[:800]}
Key Skills: {must_have_skills}

Difficulty Target: {difficulty.upper()}
{instruction}

Generate {count} coding challenges that:
- Test practical coding ability relevant to this role
- Adhere strictly to the {difficulty.upper()} difficulty target guidelines provided
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

def get_generate_tasks_with_ai_prompt(role: str, level: str, description: str, skills: str) -> tuple[str, str]:
    system_prompt = f"""You are an expert technical interviewer creating a practical assessment for a {role} position.
Level: {level}
Job Description: {description[:500]}
Skills: {skills}

Create 2 practical tasks that can be done in a browser-based coding environment or text editor.
1. A Coding Task (Algorithm/Function/Script)
2. A Design/Scenario Task (System Design/Test Case/process flow)

For each task provide:
- Title
- Clear Description
- Starter Code (or template)
- Evaluation Criteria (rubric)

Return JSON format:
{{
    "tasks": [
        {{
            "title": "Title",
            "description": "Full markdown description",
            "starter_code": "code...",
            "time_limit": 30,
            "criteria": [
                {{"name": "Criteria 1", "description": "desc", "max_points": 25}}
            ]
        }}
    ]
}}"""
    user_prompt = "Generate 2 practical assessments."
    return system_prompt, user_prompt


def get_evaluate_practical_task_submission_prompt(role: str, criteria_text: str, task_title: str, task_description: str, submitted_content: str, time_taken: str, time_limit: int) -> tuple[str, str]:
    system_prompt = f"""You are an expert evaluator for {role} practical assessments.

Evaluate the submission against these criteria:
{criteria_text}

Be fair but thorough. Provide specific, actionable feedback.

Return JSON:
{{
    "criteria_scores": [
        {{
            "criterion": "Criterion Name",
            "score": 20,
            "max_score": 25,
            "feedback": "Specific feedback for this criterion"
        }}
    ],
    "overall_assessment": "Summary of the submission quality",
    "suggestions": ["Suggestion 1", "Suggestion 2"]
}}"""

    user_prompt = f"""Evaluate this submission:

Task: {task_title}
Description: {task_description}

Submission:
```
{submitted_content}
```

Time taken: {time_taken} seconds
Time limit: {time_limit} minutes"""
    return system_prompt, user_prompt


def get_evaluate_technical_response_prompt(question_text: str, expected_answer: str, candidate_response: str, time_taken: str, max_score: int) -> tuple[str, str]:
    system_prompt = """You are an expert technical interviewer evaluating a candidate's response.
Provide a fair, detailed evaluation based on:
1. Technical accuracy
2. Depth of understanding
3. Practical application
4. Communication clarity

Return JSON:
{
    "score": 75,
    "feedback": "Detailed feedback on the response",
    "strengths": ["Strength 1", "Strength 2"],
    "improvements": ["Area for improvement 1", "Area for improvement 2"]
}

Score guidelines:
- 90-100: Exceptional, demonstrates expert-level knowledge
- 75-89: Strong, covers key points with good depth
- 60-74: Adequate, covers basics but lacks depth
- 40-59: Partial, some understanding but significant gaps
- 0-39: Insufficient, major gaps or incorrect information"""

    user_prompt = f"""Evaluate this technical response:

Question: {question_text}

Expected Answer Points: {expected_answer}

Candidate's Response:
{candidate_response}

Time taken: {time_taken} seconds
Max score: {max_score}"""
    return system_prompt, user_prompt


def get_evaluate_behavioral_response_prompt(question_text: str, competency: str, candidate_response: str) -> tuple[str, str]:
    system_prompt = """You are an expert behavioral interviewer evaluating responses using the STAR method.

Evaluate based on:
1. Situation: Did they describe a specific context?
2. Task: Did they explain their responsibility?
3. Action: Did they detail specific actions THEY took?
4. Result: Did they share measurable outcomes?

Also assess:
- Relevance to the question
- Communication clarity
- Self-awareness and reflection

Return JSON:
{
    "score": 75,
    "feedback": "Detailed feedback",
    "strengths": ["Strength 1"],
    "improvements": ["Improvement 1"],
    "star_analysis": {
        "situation": true,
        "task": true,
        "action": true,
        "result": false
    }
}"""

    user_prompt = f"""Evaluate this behavioral response:

Question: {question_text}

Competency being assessed: {competency}

Candidate's Response:
{candidate_response}"""
    return system_prompt, user_prompt


def get_calculate_communication_score_prompt(all_text: str) -> tuple[str, str]:
    system_prompt = """Analyze the communication quality of these interview responses.
Consider:
- Clarity and coherence
- Professional language
- Structure and organization
- Conciseness vs verbosity

Return JSON: {"score": 75, "notes": "Brief assessment"}"""
    
    user_prompt = f"Responses:\n{all_text}"
    return system_prompt, user_prompt
