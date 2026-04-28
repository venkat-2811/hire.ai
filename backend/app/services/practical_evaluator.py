from typing import Optional, List, Dict, Any
import uuid
from app.models.schemas import (
    PracticalAssessment, PracticalSubmission, PracticalAssessmentCreate,
    AIEvaluation, CriteriaScore, EvaluationCriterion, JobDescription
)
from app.models.enums import RoleLevel
from app.services.openai_client import get_groq_service
from app.prompts import (
    get_generate_tasks_with_ai_prompt,
    get_evaluate_practical_task_submission_prompt
)


class PracticalEvaluatorService:
    """
    Service for generating and evaluating practical/hands-on assessments.
    Role-specific tasks with auto-evaluation.
    """
    
    def __init__(self):
        self.groq = get_groq_service()
        
        # Role-specific practical task templates
        self.task_templates = {
            "salesforce_developer": [
                {
                    "title": "Apex Trigger Handler",
                    "description": """Write an Apex trigger handler for the Account object that:
1. Prevents deletion of Accounts with related Opportunities
2. Updates a custom field 'Last_Modified_By_Trigger__c' on update
3. Follows best practices for bulkification

Provide the trigger and handler class code.""",
                    "starter_code": """// Trigger
trigger AccountTrigger on Account (before delete, after update) {
    // Your code here
}

// Handler Class
public class AccountTriggerHandler {
    // Your code here
}""",
                    "criteria": [
                        {"name": "Bulkification", "description": "Handles bulk operations correctly", "max_points": 25},
                        {"name": "Logic Correctness", "description": "Implements required functionality", "max_points": 30},
                        {"name": "Best Practices", "description": "Follows Apex best practices", "max_points": 25},
                        {"name": "Code Quality", "description": "Clean, readable, well-structured code", "max_points": 20}
                    ],
                    "time_limit": 30
                },
                {
                    "title": "LWC Data Table Component",
                    "description": """Create a Lightning Web Component that:
1. Displays a list of Contacts in a data table
2. Allows inline editing of Phone and Email fields
3. Has a search/filter functionality
4. Shows a loading spinner while fetching data

Provide the HTML, JS, and any Apex controller needed.""",
                    "starter_code": """// contactList.html
<template>
    <!-- Your HTML here -->
</template>

// contactList.js
import { LightningElement } from 'lwc';
export default class ContactList extends LightningElement {
    // Your code here
}""",
                    "criteria": [
                        {"name": "Functionality", "description": "All features work correctly", "max_points": 30},
                        {"name": "LWC Best Practices", "description": "Proper use of decorators, lifecycle", "max_points": 25},
                        {"name": "Error Handling", "description": "Handles errors gracefully", "max_points": 20},
                        {"name": "UI/UX", "description": "Clean, user-friendly interface", "max_points": 25}
                    ],
                    "time_limit": 45
                }
            ],
            "qa_engineer": [
                {
                    "title": "Test Case Design",
                    "description": """Design comprehensive test cases for a Login functionality with:
- Email and password fields
- "Remember Me" checkbox
- "Forgot Password" link
- Social login options (Google, Facebook)
- Rate limiting (max 5 attempts)

Include positive, negative, boundary, and security test cases.
Format: Test ID | Description | Steps | Expected Result | Priority""",
                    "starter_code": """| Test ID | Description | Steps | Expected Result | Priority |
|---------|-------------|-------|-----------------|----------|
| TC001   | Valid login | ... | ... | High |""",
                    "criteria": [
                        {"name": "Coverage", "description": "Covers all functionality aspects", "max_points": 30},
                        {"name": "Edge Cases", "description": "Includes boundary and negative tests", "max_points": 25},
                        {"name": "Security Tests", "description": "Includes security considerations", "max_points": 25},
                        {"name": "Clarity", "description": "Clear, reproducible steps", "max_points": 20}
                    ],
                    "time_limit": 25
                },
                {
                    "title": "Selenium Automation Script",
                    "description": """Write a Selenium automation script (Python or Java) that:
1. Navigates to a shopping cart page
2. Adds an item to cart
3. Verifies cart count updates
4. Proceeds to checkout
5. Validates form field requirements

Use Page Object Model pattern.""",
                    "starter_code": """# Python with Selenium
from selenium import webdriver
from selenium.webdriver.common.by import By

class CartPage:
    # Your Page Object here
    pass

class TestShoppingCart:
    # Your test methods here
    pass""",
                    "criteria": [
                        {"name": "POM Implementation", "description": "Proper Page Object Model", "max_points": 25},
                        {"name": "Test Coverage", "description": "Tests all required scenarios", "max_points": 30},
                        {"name": "Assertions", "description": "Meaningful assertions and validations", "max_points": 25},
                        {"name": "Code Quality", "description": "Clean, maintainable code", "max_points": 20}
                    ],
                    "time_limit": 35
                }
            ],
            "business_analyst": [
                {
                    "title": "User Story Writing",
                    "description": """Based on this requirement, write detailed user stories:

"The company wants to implement a customer loyalty program where customers earn points for purchases, can redeem points for discounts, and receive tier-based benefits (Bronze, Silver, Gold)."

Write at least 5 user stories following INVEST criteria.
Include acceptance criteria for each story.""",
                    "starter_code": """## User Story 1
**As a** [user type]
**I want** [goal]
**So that** [benefit]

### Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2""",
                    "criteria": [
                        {"name": "INVEST Compliance", "description": "Stories follow INVEST criteria", "max_points": 25},
                        {"name": "Completeness", "description": "Covers key functionality", "max_points": 25},
                        {"name": "Acceptance Criteria", "description": "Clear, testable criteria", "max_points": 30},
                        {"name": "Business Value", "description": "Clearly articulates value", "max_points": 20}
                    ],
                    "time_limit": 25
                },
                {
                    "title": "Gap Analysis",
                    "description": """Perform a gap analysis for this scenario:

Current State: Manual order processing via email and phone, Excel-based inventory tracking, no customer portal.

Desired State: Automated e-commerce platform with real-time inventory, customer self-service portal, and integrated CRM.

Identify gaps, prioritize them, and recommend solutions.""",
                    "starter_code": """## Gap Analysis

### Current State Summary
...

### Desired State Summary
...

### Identified Gaps
| Gap ID | Area | Current | Desired | Priority | Recommendation |
|--------|------|---------|---------|----------|----------------|""",
                    "criteria": [
                        {"name": "Gap Identification", "description": "Identifies all major gaps", "max_points": 30},
                        {"name": "Prioritization", "description": "Logical priority assignment", "max_points": 25},
                        {"name": "Recommendations", "description": "Practical, actionable solutions", "max_points": 25},
                        {"name": "Analysis Depth", "description": "Thorough analysis", "max_points": 20}
                    ],
                    "time_limit": 30
                }
            ]
        }
    
    async def get_practical_tasks(
        self,
        job: JobDescription,
        session_id: str
    ) -> List[PracticalAssessment]:
        """Get practical assessment tasks for a role (async, dynamic)."""
        
        # 1. Try to generate with AI
        try:
            return await self._generate_tasks_with_ai(job, session_id)
        except Exception as e:
            # 2. Fallback to generic if AI fails
            print(f"Error generating practical tasks: {e}")
            return self._get_fallback_tasks(job.role, session_id)

    async def _generate_tasks_with_ai(self, job: JobDescription, session_id: str) -> List[PracticalAssessment]:
        system_prompt, user_prompt = get_generate_tasks_with_ai_prompt(
            role=job.role,
            level=job.level.value,
            description=job.description,
            skills=", ".join(job.must_have_skills)
        )

        result = await self.groq.generate_json(
            prompt=user_prompt,
            system_instruction=system_prompt,
            temperature=0.7
        )
        
        assessments = []
        for i, task in enumerate(result.get("tasks", [])):
            criteria = [
                EvaluationCriterion(**c) for c in task.get("criteria", [])
            ]
            assessments.append(PracticalAssessment(
                id=str(uuid.uuid4()),
                session_id=session_id,
                role=job.role,
                task_title=task.get("title", "Practical Task"),
                task_description=task.get("description", ""),
                starter_code=task.get("starter_code", ""),
                evaluation_criteria=criteria,
                time_limit_minutes=task.get("time_limit", 30),
                order_index=i
            ))
        
        return assessments

    def _get_fallback_tasks(self, role: str, session_id: str) -> List[PracticalAssessment]:
        """Fallback tasks if AI generation fails."""
        # Generic coding task
        coding_task = PracticalAssessment(
            id=str(uuid.uuid4()),
            session_id=session_id,
            role=role,
            task_title="Coding Challenge",
            task_description="Write a function to process a list of data entries and return validated results. Handle edge cases.",
            starter_code="def process_data(data):\n    # Your code here\n    pass",
            evaluation_criteria=[
                EvaluationCriterion(name="Correctness", description="Function works as expected", max_points=40),
                EvaluationCriterion(name="Code Quality", description="Clean and readable code", max_points=30),
                EvaluationCriterion(name="Edge Cases", description="Handles empty/invalid input", max_points=30)
            ],
            time_limit_minutes=30,
            order_index=0
        )
        
        # Generic design task
        design_task = PracticalAssessment(
            id=str(uuid.uuid4()),
            session_id=session_id,
            role=role,
            task_title="System/Process Design",
            task_description="Describe how you would design a system or process to handle high-volume requests for this role's context.",
            starter_code="## Design Proposal\n\n1. Overview\n2. Key Components\n3. Challenges & Solutions",
            evaluation_criteria=[
                EvaluationCriterion(name="Feasibility", description="Solution is realistic", max_points=40),
                EvaluationCriterion(name="Completeness", description="Covers all aspects", max_points=30),
                EvaluationCriterion(name="Clarity", description="Clear explanation", max_points=30)
            ],
            time_limit_minutes=30,
            order_index=1
        )
        
        return [coding_task, design_task]
    
    async def evaluate_submission(
        self,
        assessment: PracticalAssessment,
        submission: PracticalSubmission
    ) -> AIEvaluation:
        """Evaluate a practical assessment submission using AI."""
        
        submitted_content = submission.submitted_code or submission.submitted_answer or ""
        
        if not submitted_content.strip():
            return AIEvaluation(
                criteria_scores=[
                    CriteriaScore(
                        criterion=c.name,
                        score=0,
                        max_score=c.max_points,
                        feedback="No submission provided."
                    ) for c in assessment.evaluation_criteria
                ],
                overall_assessment="No submission was provided for evaluation.",
                suggestions=["Please provide a complete solution."]
            )
        
        criteria_text = "\n".join([
            f"- {c.name} ({c.max_points} points): {c.description}"
            for c in assessment.evaluation_criteria
        ])
        
        system_prompt, user_prompt = get_evaluate_practical_task_submission_prompt(
            role=submission.assessment.role,
            task_description=submission.assessment.task_description,
            candidate_submission=submission.submission_content,
            criteria=criteria_text
        )

        try:
            result = await self.groq.generate_json(
                prompt=user_prompt,
                system_instruction=system_prompt,
                temperature=0.3
            )
            
            criteria_scores = []
            for cs in result.get("criteria_scores", []):
                criteria_scores.append(CriteriaScore(
                    criterion=cs.get("criterion", ""),
                    score=min(cs.get("max_score", 25), max(0, cs.get("score", 0))),
                    max_score=cs.get("max_score", 25),
                    feedback=cs.get("feedback", "")
                ))
            
            return AIEvaluation(
                criteria_scores=criteria_scores,
                overall_assessment=result.get("overall_assessment", ""),
                suggestions=result.get("suggestions", [])
            )
            
        except Exception as e:
            return AIEvaluation(
                criteria_scores=[],
                overall_assessment="Automated evaluation encountered an error. Manual review required.",
                suggestions=[]
            )
    
    def calculate_practical_score(self, evaluation: AIEvaluation) -> int:
        """Calculate overall score from criteria scores."""
        if not evaluation.criteria_scores:
            return 0
        
        total_score = sum(cs.score for cs in evaluation.criteria_scores)
        total_max = sum(cs.max_score for cs in evaluation.criteria_scores)
        
        if total_max == 0:
            return 0
        
        return int((total_score / total_max) * 100)


_practical_evaluator: Optional[PracticalEvaluatorService] = None


def get_practical_evaluator() -> PracticalEvaluatorService:
    global _practical_evaluator
    if _practical_evaluator is None:
        _practical_evaluator = PracticalEvaluatorService()
    return _practical_evaluator
