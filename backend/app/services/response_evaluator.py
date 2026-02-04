from typing import Optional, List
from app.models.schemas import (
    InterviewQuestion, CandidateResponse, ResponseEvaluationResult
)
from app.models.enums import AssessmentType
from app.services.gemini_client import get_gemini_service


class ResponseEvaluatorService:
    """
    AI-powered response evaluation service.
    Evaluates candidate responses with detailed feedback.
    """
    
    def __init__(self):
        self.gemini = get_gemini_service()
    
    async def evaluate_response(
        self,
        question: InterviewQuestion,
        response: CandidateResponse
    ) -> ResponseEvaluationResult:
        """Evaluate a candidate's response to an interview question."""
        
        if question.question_type == AssessmentType.TECHNICAL:
            return await self._evaluate_technical_response(question, response)
        elif question.question_type == AssessmentType.BEHAVIORAL:
            return await self._evaluate_behavioral_response(question, response)
        else:
            return await self._evaluate_general_response(question, response)
    
    async def _evaluate_technical_response(
        self,
        question: InterviewQuestion,
        response: CandidateResponse
    ) -> ResponseEvaluationResult:
        """Evaluate technical question response."""
        
        response_text = response.response_text or response.response_code or ""
        
        if not response_text.strip():
            return ResponseEvaluationResult(
                score=0,
                feedback="No response provided.",
                strengths=[],
                improvements=["Candidate did not provide an answer."]
            )
        
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

Question: {question.question_text}

Expected Answer Points: {question.expected_answer or 'Not specified'}

Candidate's Response:
{response_text[:3000]}

Time taken: {response.time_taken_seconds or 'Unknown'} seconds
Max score: {question.max_score}"""

        try:
            result = await self.gemini.generate_json(
                prompt=user_prompt,
                system_instruction=system_prompt,
                temperature=0.3
            )
            
            return ResponseEvaluationResult(
                score=min(100, max(0, result.get("score", 50))),
                feedback=result.get("feedback", "Evaluation completed."),
                strengths=result.get("strengths", []),
                improvements=result.get("improvements", [])
            )
            
        except Exception:
            return ResponseEvaluationResult(
                score=50,
                feedback="Automated evaluation encountered an issue. Manual review recommended.",
                strengths=[],
                improvements=[]
            )
    
    async def _evaluate_behavioral_response(
        self,
        question: InterviewQuestion,
        response: CandidateResponse
    ) -> ResponseEvaluationResult:
        """Evaluate behavioral question response using STAR method."""
        
        response_text = response.response_text or ""
        
        if not response_text.strip():
            return ResponseEvaluationResult(
                score=0,
                feedback="No response provided.",
                strengths=[],
                improvements=["Candidate did not provide an answer."]
            )
        
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

Question: {question.question_text}

Competency being assessed: {question.metadata.get('competency', 'General')}

Candidate's Response:
{response_text[:3000]}"""

        try:
            result = await self.gemini.generate_json(
                prompt=user_prompt,
                system_instruction=system_prompt,
                temperature=0.3
            )
            
            return ResponseEvaluationResult(
                score=min(100, max(0, result.get("score", 50))),
                feedback=result.get("feedback", "Evaluation completed."),
                strengths=result.get("strengths", []),
                improvements=result.get("improvements", [])
            )
            
        except Exception:
            return ResponseEvaluationResult(
                score=50,
                feedback="Automated evaluation encountered an issue. Manual review recommended.",
                strengths=[],
                improvements=[]
            )
    
    async def _evaluate_general_response(
        self,
        question: InterviewQuestion,
        response: CandidateResponse
    ) -> ResponseEvaluationResult:
        """General response evaluation fallback."""
        
        response_text = response.response_text or response.response_code or ""
        
        if not response_text.strip():
            return ResponseEvaluationResult(
                score=0,
                feedback="No response provided.",
                strengths=[],
                improvements=["Candidate did not provide an answer."]
            )
        
        # Simple heuristic evaluation
        word_count = len(response_text.split())
        
        if word_count < 10:
            score = 30
            feedback = "Response is too brief to demonstrate understanding."
        elif word_count < 50:
            score = 50
            feedback = "Response covers some points but could be more detailed."
        elif word_count < 200:
            score = 70
            feedback = "Response is reasonably detailed."
        else:
            score = 80
            feedback = "Response is comprehensive."
        
        return ResponseEvaluationResult(
            score=score,
            feedback=feedback,
            strengths=[],
            improvements=[]
        )
    
    async def calculate_communication_score(
        self,
        responses: List[CandidateResponse]
    ) -> int:
        """Calculate overall communication score from all responses."""
        
        if not responses:
            return 50
        
        all_text = " ".join([
            r.response_text or r.response_code or ""
            for r in responses
        ])
        
        if len(all_text) < 100:
            return 40
        
        system_prompt = """Analyze the communication quality of these interview responses.
Consider:
- Clarity and coherence
- Professional language
- Structure and organization
- Conciseness vs verbosity

Return JSON: {"score": 75, "notes": "Brief assessment"}"""

        try:
            result = await self.gemini.generate_json(
                prompt=f"Responses:\n{all_text[:4000]}",
                system_instruction=system_prompt,
                temperature=0.3
            )
            return min(100, max(0, result.get("score", 50)))
        except Exception:
            return 60


_response_evaluator: Optional[ResponseEvaluatorService] = None


def get_response_evaluator() -> ResponseEvaluatorService:
    global _response_evaluator
    if _response_evaluator is None:
        _response_evaluator = ResponseEvaluatorService()
    return _response_evaluator
