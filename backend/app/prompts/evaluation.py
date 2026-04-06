from typing import Dict, Any

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
