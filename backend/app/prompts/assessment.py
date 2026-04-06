from typing import Dict, Any, List

def get_mcq_generation_prompt(
    role: str, level: str, description: str, must_have_skills: str, good_to_have_skills: str, count: int, difficulty: str = "medium"
) -> tuple[str, str]:
    
    difficulty_instructions = {
        "easy": "Target foundational concepts and practical application. Focus on core knowledge, common scenarios, and fundamental problem-solving. Exclude overly trivial syntax queries; use simple but realistic scenario-based questions.",
        "medium": "Target intermediate scenario-based problem-solving. Require analysis of specific technical situations, debugging, or choosing the best approach among viable alternatives.",
        "hard": "Target advanced, complex scenarios requiring architectural reasoning, performance optimization, or deep system-level debugging. Distractors must represent highly plausible but suboptimal approaches."
    }

    instruction = difficulty_instructions.get(difficulty.lower(), difficulty_instructions["medium"])
    
    system_prompt = f"""You are an expert technical assessor creating a multiple-choice assessment for a {role} position at the {level} level.

Job Description: {description[:800]}
Must-Have Skills: {must_have_skills}
Good-to-Have Skills: {good_to_have_skills}

Difficulty Target: {difficulty.upper()}
{instruction}

CRITICAL RULES FOR QUESTION GENERATION:
1. Scenario-Based: Do NOT ask simple definitions (e.g., "What is X?"). Instead, frame questions as real-world scenarios or problems to solve.
2. Balanced Skill Coverage: Distribute the questions evenly across the listed Must-Have and Good-to-Have skills.
3. Plausible Distractors: Options must be challenging and highly plausible. Distractors should represent typical mistakes.
4. Distinct Options: Ensure answer choices are clearly distinct.
5. Single Correct Answer: There must be exactly ONE unambiguously correct option.
6. Detailed Explanations: You MUST provide a clear explanation for each question, detailing why the correct answer is the best choice and why the distractors are incorrect.

Return a JSON object:
{{
    "questions": [
        {{
            "question": "Scenario-based question text here",
            "options": ["Distinct Option A", "Distinct Option B", "Distinct Option C", "Distinct Option D"],
            "correct_index": 0,
            "difficulty": "easy|medium|hard",
            "topic": "Specific skill or topic",
            "points": 5,
            "explanation": "Detailed explanation of why the correct option is right and the distractors are wrong."
        }}
    ]
}}"""

    user_prompt = f"Generate {count} scenario-based MCQ questions for this {role} position following the critical rules."
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
}}"""
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
