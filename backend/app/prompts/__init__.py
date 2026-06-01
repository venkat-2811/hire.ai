from .base import NO_HALLUCINATIONS_RULE, STRICT_JSON_INSTRUCTION
from .resume import get_analyze_resume_prompt, get_screen_candidate_prompt
from .assessment import (
    get_mcq_generation_prompt,
    get_coding_challenges_prompt,
    get_generate_practical_assessment_prompt,
    get_generate_tasks_with_ai_prompt,
    get_sql_challenges_prompt
)
from .interview import (
    get_technical_questions_prompt,
    get_behavioral_questions_prompt,
    get_interview_questions_general_prompt
)
from .evaluation import (
    get_evaluate_response_prompt,
    get_evaluate_practical_submission_prompt,
    get_evaluate_practical_task_submission_prompt,
    get_evaluate_technical_response_prompt,
    get_evaluate_behavioral_response_prompt,
    get_calculate_communication_score_prompt
)

__all__ = [
    "NO_HALLUCINATIONS_RULE",
    "STRICT_JSON_INSTRUCTION",
    "get_analyze_resume_prompt",
    "get_screen_candidate_prompt",
    "get_mcq_generation_prompt",
    "get_coding_challenges_prompt",
    "get_generate_practical_assessment_prompt",
    "get_generate_tasks_with_ai_prompt",
    "get_sql_challenges_prompt",
    "get_technical_questions_prompt",
    "get_behavioral_questions_prompt",
    "get_interview_questions_general_prompt",
    "get_evaluate_response_prompt",
    "get_evaluate_practical_submission_prompt",
    "get_evaluate_practical_task_submission_prompt",
    "get_evaluate_technical_response_prompt",
    "get_evaluate_behavioral_response_prompt",
    "get_calculate_communication_score_prompt",
]
