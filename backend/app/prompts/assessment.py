from typing import Dict, Any, List

def get_mcq_generation_prompt(
    role: str, level: str, description: str, must_have_skills: str, good_to_have_skills: str, count: int, difficulty: str = "medium"
) -> tuple[str, str]:
    
    difficulty_guidelines = {
        "easy": {
            "complexity": "Foundational concepts and basic practical application",
            "focus": "Core knowledge, common scenarios, fundamental problem-solving",
            "examples": "Basic definitions, simple scenarios, straightforward applications"
        },
        "medium": {
            "complexity": "Intermediate scenario-based problem-solving",
            "focus": "Analysis of specific technical situations, debugging, choosing best approaches",
            "examples": "Troubleshooting, optimization, comparing alternatives, integration challenges"
        },
        "hard": {
            "complexity": "Advanced complex scenarios requiring deep expertise",
            "focus": "Architectural reasoning, performance optimization, system-level debugging",
            "examples": "Large-scale design, advanced optimization, complex trade-offs, edge cases"
        }
    }
    
    guidelines = difficulty_guidelines.get(difficulty.lower(), difficulty_guidelines["medium"])
    
    system_prompt = f"""You are an expert technical assessment designer creating high-quality multiple-choice questions for a {role} position at the {level} level.

JOB CONTEXT:
- Role: {role}
- Level: {level}
- Description: {description[:1000]}
- Required Skills: {must_have_skills}
- Preferred Skills: {good_to_have_skills}
- Target Difficulty: {difficulty.upper()}
- Question Count: {count}

DIFFICULTY GUIDELINES:
{guidelines['complexity']}
Focus: {guidelines['focus']}
Examples: {guidelines['examples']}

QUESTION QUALITY STANDARDS:
1. SCENARIO-BASED: Every question must present a realistic scenario or problem, not simple definitions
2. UNIQUE CONCEPTS: Each question must test a different concept/skill - no repetition
3. CHALLENGING DISTRACTORS: Wrong answers must be plausible and represent common misconceptions
4. CLEAR CORRECTNESS: Only one unambiguously correct answer
5. SKILL COVERAGE: Distribute questions across all required and preferred skills
6. ROLE RELEVANCE: Questions should reflect actual tasks and challenges in this role

STRUCTURE REQUIREMENTS:
- Generate exactly {count} questions (unless fewer are possible for unique concepts)
- Each question must have exactly 4 distinct options (A, B, C, D)
- Options must be unique, not reworded versions of each other
- Include topic tags for categorization
- Assign appropriate point values (5-10 based on complexity)

Return valid JSON:
{{
    "questions": [
        {{
            "question": "Detailed scenario-based question text",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct_index": 0,
            "difficulty": "easy|medium|hard",
            "topic": "Specific skill/technology area",
            "points": 5,
            "explanation": "Why correct answer is right and others are wrong"
        }}
    ]
}}"""

    user_prompt = f"""Generate {count} high-quality, scenario-based MCQ questions for a {role} position at {level} level.

Requirements:
- Follow {difficulty.upper()} difficulty standards
- Cover skills: {must_have_skills} and {good_to_have_skills}
- Each question must be unique and scenario-based
- Provide challenging but fair distractors
- Ensure only one clearly correct answer

Focus on real-world situations this professional would encounter."""
    
    return system_prompt, user_prompt


def get_coding_challenges_prompt(
    role: str, level: str, description: str, must_have_skills: str, count: int, difficulty: str = "medium"
) -> tuple[str, str]:
    
    difficulty_guidelines = {
        "easy": {
            "complexity": "Fundamental coding problems with clear logic",
            "focus": "Basic algorithms, data structures, simple implementations",
            "time": "15-20 minutes per challenge"
        },
        "medium": {
            "complexity": "Intermediate problems with edge cases and optimization",
            "focus": "Problem-solving, multiple approaches, efficiency considerations",
            "time": "20-30 minutes per challenge"
        },
        "hard": {
            "complexity": "Advanced challenges requiring deep reasoning",
            "focus": "Complex algorithms, optimization, advanced data structures",
            "time": "30-45 minutes per challenge"
        }
    }
    
    guidelines = difficulty_guidelines.get(difficulty.lower(), difficulty_guidelines["medium"])
    
    system_prompt = f"""You are an expert technical interviewer creating coding challenges for a {role} position at {level} level.

JOB CONTEXT:
- Role: {role}
- Level: {level}
- Description: {description[:1000]}
- Key Skills: {must_have_skills}
- Challenge Count: {count}
- Target Difficulty: {difficulty.upper()}

DIFFICULTY GUIDELINES:
Complexity: {guidelines['complexity']}
Focus: {guidelines['focus']}
Expected Time: {guidelines['time']}

CHALLENGE QUALITY STANDARDS:
1. REAL-WORLD RELEVANCE: Problems should reflect actual work scenarios
2. CLEAR REQUIREMENTS: Unambiguous problem statements with examples
3. MULTIPLE APPROACHES: Allow different valid solution approaches
4. COMPREHENSIVE TESTING: Include diverse test cases (normal, edge, boundary)
5. FAIR DIFFICULTY: Appropriate for the specified level
6. PROPER STARTER CODE: Helpful but not solution-revealing

STRUCTURE REQUIREMENTS:
- Generate exactly {count} coding challenges
- Each challenge must be solvable in {guidelines['time']}
- Include at least 3 diverse test cases
- Input must be JSON object with parameter names
- Expected must be the direct return value
- Provide language-agnostic starter code

Return valid JSON:
{{
    "challenges": [
        {{
            "title": "Challenge Title",
            "description": "Detailed problem description with examples",
            "starter_code": "def solution(param1, param2):\n    # Your code here\n    pass",
            "test_cases": [
                {{"input": {{"param1": "value", "param2": "value"}}, "expected": "result"}},
                {{"input": {{"param1": "edge_case"}}, "expected": "result2"}}
            ],
            "difficulty": "easy|medium|hard",
            "time_limit_minutes": 20,
            "points": 25
        }}
    ]
}}"""

    user_prompt = f"""Generate {count} high-quality coding challenges for a {role} position at {level} level.

Requirements:
- Target {difficulty.upper()} difficulty ({guidelines['complexity']})
- Focus on: {guidelines['focus']}
- Each challenge should take approximately {guidelines['time']}
- Cover skills: {must_have_skills}
- Include comprehensive test cases
- Provide helpful starter code

Challenges should be practical and relevant to real-world work."""
    
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
