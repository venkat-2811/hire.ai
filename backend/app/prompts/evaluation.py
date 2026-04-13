from typing import Dict, Any

def get_evaluate_response_prompt(question: str, question_type: str, expected_answer: str, candidate_response: str) -> tuple[str, str]:
    system_instruction = """You are an expert interview evaluator with advanced analytical capabilities.
Your role is to provide fair, constructive, and detailed feedback."""
    
    user_prompt = f"""Evaluate this interview response with precision and insight.

QUESTION DETAILS:
- Type: {question_type}
- Question: {question}
- Expected Answer: {expected_answer}

CANDIDATE RESPONSE:
{candidate_response}

EVALUATION CRITERIA:
1. RELEVANCE: How well does response address the question?
2. ACCURACY: Technical correctness and factual accuracy
3. COMPLETENESS: Thoroughness of the answer
4. COMMUNICATION: Clarity and articulation
5. CONFIDENCE: Level of confidence demonstrated

SCORING GUIDELINES:
- Score: 1-10 scale
- Max Score: 10 points
- Provide specific feedback
- Identify strengths and improvements

Return JSON:
{{
    "score": 7,
    "max_score": 10,
    "feedback": "Comprehensive evaluation feedback",
    "strengths": ["specific strength 1", "specific strength 2"],
    "improvements": ["specific improvement 1", "specific improvement 2"],
    "technical_accuracy": 0.8,
    "communication_score": 0.75,
    "completeness": 0.7
}}"""
    
    return system_instruction, user_prompt


def get_evaluate_practical_submission_prompt(assessment: Dict[str, Any], submission: str) -> tuple[str, str]:
    system_instruction = """You are an expert code reviewer with advanced evaluation capabilities.
Your role is to provide thorough, fair, and constructive assessment."""
    
    user_prompt = f"""Evaluate this practical assessment submission with precision.

ASSESSMENT DETAILS:
- Title: {assessment.get('title', 'N/A')}
- Description: {assessment.get('description', 'N/A')}
- Requirements: {assessment.get('requirements', [])}
- Evaluation Criteria: {assessment.get('evaluation_criteria', [])}

CANDIDATE SUBMISSION:
{submission}

EVALUATION STANDARDS:
1. FUNCTIONALITY: Does code work correctly?
2. CODE QUALITY: Structure, naming, documentation
3. EFFICIENCY: Performance and optimization
4. BEST PRACTICES: Industry standards and patterns
5. REQUIREMENTS COMPLIANCE: Meets specified criteria

SCORING CRITERIA:
- Overall Score: 0-100 scale
- Individual Criteria: Each with specific weight
- Detailed Feedback: Specific, actionable comments
- Strengths: Positive aspects to highlight
- Improvements: Areas for development

Return JSON:
{{
    "overall_score": 75,
    "max_score": 100,
    "criteria_scores": [
        {{"criterion": "Code Quality", "score": 20, "max": 25, "feedback": "Good structure"}}
    ],
    "detailed_feedback": "Comprehensive evaluation comments",
    "strengths": ["strength1", "strength2"],
    "improvements": ["improvement1", "improvement2"]
}}"""
    
    return system_instruction, user_prompt

def get_evaluate_practical_task_submission_prompt(role: str, criteria_text: str, task_title: str, task_description: str, submitted_content: str, time_taken: str, time_limit: int) -> tuple[str, str]:
    system_instruction = """You are an expert evaluator for {role} practical assessments.
Your role is to provide thorough, fair, and constructive evaluation."""
    
    user_prompt = f"""Evaluate this practical task submission with precision.

TASK DETAILS:
- Title: {task_title}
- Description: {task_description}
- Time Limit: {time_limit} minutes
- Time Taken: {time_taken}
- Role: {role}

EVALUATION CRITERIA:
{criteria_text}

CANDIDATE SUBMISSION:
{submitted_content}
```

Time taken: {time_taken} seconds
Time limit: {time_limit} minutes"""
    return system_instruction, user_prompt


def get_evaluate_technical_response_prompt(question_text: str, expected_answer: str, candidate_response: str, time_taken: str, max_score: int) -> tuple[str, str]:
    system_instruction = """You are an expert technical interviewer evaluating candidate responses.
Your role is to provide precise, fair, and constructive feedback."""
    
    user_prompt = f"""Evaluate this technical response:

QUESTION DETAILS:
- Question: {question_text}
- Expected Answer: {expected_answer}
- Time Allowed: {max_score} minutes
- Time Taken: {time_taken}

CANDIDATE RESPONSE:
{candidate_response}

SCORING RUBRIC:
- 90-100: Exceptional, demonstrates expert-level knowledge
- 75-89: Strong, covers key points with good depth
- 60-74: Adequate, covers basics but lacks depth
- 40-59: Partial, some understanding but significant gaps
- 0-39: Insufficient, major gaps or incorrect information

Return JSON:
{{
    "score": 7,
    "max_score": {max_score},
    "feedback": "Detailed evaluation feedback",
    "strengths": ["specific strength 1", "specific strength 2"],
    "improvements": ["specific improvement 1", "specific improvement 2"],
    "technical_accuracy": 0.8,
    "communication_score": 0.75,
    "completeness": 0.7
}}"""
    
    return system_instruction, user_prompt


def get_evaluate_behavioral_response_prompt(question_text: str, competency: str, candidate_response: str) -> tuple[str, str]:
    system_instruction = """You are an expert behavioral interviewer using STAR evaluation methodology.
Your role is to provide structured, fair feedback."""
    
    user_prompt = f"""Evaluate this behavioral response using STAR method.

QUESTION DETAILS:
- Question: {question_text}
- Target Competency: {competency}

CANDIDATE RESPONSE:
{candidate_response}

EVALUATION CRITERIA:
1. SITUATION: Did they provide specific context?
2. TASK: Did they explain their responsibility clearly?
3. ACTION: Did they describe specific actions taken?
4. RESULT: Did they share measurable outcomes?
5. COMMUNICATION: Clarity and structure of response
6. RELEVANCE: Alignment with target competency

SCORING GUIDELINES:
- Score: 1-10 scale
- Provide specific feedback
- Identify STAR components present
- Highlight strengths and improvement areas

Return JSON:
{{
    "score": 7,
    "max_score": 10,
    "feedback": "STAR-based evaluation feedback",
    "strengths": ["specific strength 1", "specific strength 2"],
    "improvements": ["specific improvement 1", "specific improvement 2"],
    "communication_score": 0.75,
    "completeness": 0.7,
    "star_components": {{
        "situation": "present|missing|partial",
        "task": "present|missing|partial",
        "action": "present|missing|partial",
        "result": "present|missing|partial"
    }}
}}"""
    
    return system_instruction, user_prompt


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
