from typing import Dict, Any, List


def get_mcq_generation_prompt(
    role: str, level: str, description: str, must_have_skills: str, good_to_have_skills: str, count: int, difficulty: str = "medium",
    focus_areas: str = "", strict_focus: bool = False
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

    focus_pct = "80%" if strict_focus else "60%"
    focus_block = (
        f"""

=== RECRUITER FOCUS AREAS (HIGH PRIORITY) ===
The recruiter has specified the following topics to be prioritized:
{focus_areas}

- At least {focus_pct} of the {count} questions MUST directly evaluate the recruiter-specified focus area technologies.
- The remaining questions may cover related technologies, architecture concepts, or JD requirements.
- Avoid generating unrelated or overly generic questions when Focus Areas are provided.
- Questions still must be scenario-based and match the {difficulty.upper()} difficulty level."""
        if focus_areas.strip() else ""
    )

    focus_user_note = (
        f"\n\nIMPORTANT: The recruiter has specified focus areas: {focus_areas}. "
        f"Ensure at least {focus_pct} of your questions directly test these topics."
        if focus_areas.strip() else ""
    )

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

=== STRICT MCQ QUALITY RULES ===

RULE 1 — SCENARIO-BASED ONLY:
Every question MUST present a realistic work scenario or problem. NEVER ask "What is X?" or simple definition questions.
Use formats like: "A developer notices...", "Your team needs to...", "Given this error...", "When configuring..."

RULE 2 — STRICT NO-REPETITION (QUALITY CONTROL):
There must be NO duplicate or near-duplicate questions within the same assessment. This includes avoiding questions that test the same underlying concept, reasoning pattern, or scenario with only different technologies or wording (e.g., two questions both asking how to optimize retrieval latency or debug similar workflows). Each question should assess a completely distinct concept or skill.

RULE 3 — EXACTLY 4 OPTIONS (A/B/C/D):
Every question must have EXACTLY 4 options in the options array. No more, no less.

RULE 4 — RANDOMIZE CORRECT ANSWER POSITION (CRITICAL):
The correct_index values across all {count} questions MUST be distributed across 0, 1, 2, and 3.
Do NOT put the correct answer always at the same index. Aim for roughly equal distribution:
- ~25% of questions: correct_index = 0
- ~25% of questions: correct_index = 1
- ~25% of questions: correct_index = 2
- ~25% of questions: correct_index = 3

RULE 5 — PLAUSIBLE DISTRACTORS:
All 3 wrong options MUST be technically plausible and represent real misconceptions developers make.
NEVER use obviously wrong "dummy" answers like "None of the above" or clearly unrelated options.
Distractor pattern per question:
- One answer: represents a common misconception about this topic
- One answer: is partially correct but missing a key detail
- One answer: sounds technically sophisticated but is fundamentally wrong

RULE 6 — UNIQUE OPTIONS:
Each option must start with a different word/phrase and use different sentence structures.
Options must NOT be reworded versions of each other or simple rearrangements.

RULE 7 — SKILL COVERAGE:
Distribute questions evenly across ALL listed skills. Do not cluster multiple questions on the same skill.
Required skills to cover: {must_have_skills}
Preferred skills to cover: {good_to_have_skills}

RULE 8 — SINGLE CORRECT ANSWER:
There must be exactly one unambiguously correct answer. The correct answer must be definitively right, not just "more correct" than others.{focus_block}

Return valid JSON with EXACTLY {count} questions:
{{
    "questions": [
        {{
            "question": "Detailed scenario-based question text",
            "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
            "correct_index": 2,
            "difficulty": "easy|medium|hard",
            "topic": "Specific skill/technology area",
            "points": 5,
            "explanation": "Why the correct answer at correct_index is right and why each distractor is wrong"
        }}
    ]
}}"""

    user_prompt = f"""Generate exactly {count} high-quality, scenario-based MCQ questions for a {role} position at {level} level.

MUST FOLLOW:
1. {difficulty.upper()} difficulty: {guidelines['complexity']}
2. Cover ALL skills evenly: {must_have_skills} | {good_to_have_skills}
3. Every question = unique concept, unique scenario — zero repetition
4. RANDOMIZE correct_index across 0, 1, 2, 3 — do NOT always put the correct answer at index 0 or 1
5. ALL 4 options must be plausible and realistic — no dummy answers
6. Every question must be scenario-based (real work situation), never a simple definition
7. The options array must contain EXACTLY 4 strings per question{focus_user_note}

Focus on real-world situations this professional encounters in their daily work."""

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

    system_prompt = f"""You are an expert technical interviewer creating unique coding challenges for a {role} position at {level} level.

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
1. REAL-WORLD RELEVANCE: Problems must reflect actual work scenarios a {role} would face
2. UNIQUE PROBLEMS: Each challenge must test a completely different algorithm or concept — no repetition
3. CLEAR REQUIREMENTS: Unambiguous problem statements with concrete input/output examples
4. MULTIPLE SOLUTION APPROACHES: Allow different valid solution strategies (e.g., iterative vs recursive)
5. COMPREHENSIVE TEST CASES: Include normal cases, edge cases, and boundary cases
6. FAIR DIFFICULTY: Appropriate complexity for {level} level
7. CLEAN STARTER CODE: Provide helpful function signature but never reveal the solution approach

STRUCTURE REQUIREMENTS:
- Generate exactly {count} coding challenges
- Each challenge solvable in {guidelines['time']}
- At least 3 diverse test cases per challenge (normal + 2 edge cases)
- Input must be a JSON object with named parameters matching the starter code
- Expected output must be the direct return value

Return valid JSON:
{{
    "challenges": [
        {{
            "title": "Challenge Title",
            "description": "Detailed problem description with at least one example",
            "starter_code": "def solution(param1, param2):\\n    # Your code here\\n    pass",
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

    user_prompt = f"""Generate {count} high-quality, unique coding challenges for a {role} position at {level} level.

Requirements:
- Target {difficulty.upper()} difficulty: {guidelines['complexity']}
- Focus areas: {guidelines['focus']}
- Time per challenge: approximately {guidelines['time']}
- Cover different skills from: {must_have_skills}
- Each challenge must test a DIFFERENT concept — no repeated problem patterns
- Include at least 3 test cases per challenge (1 normal, 2 edge cases)
- Provide a clean function signature as starter code

Challenges must be practical and directly relevant to real {role} work."""

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


def get_sql_challenges_prompt(
    role: str, level: str, description: str, count: int, difficulty: str = "medium"
) -> tuple[str, str]:
    
    difficulty_guidelines = {
        "easy": {
            "complexity": "Basic SELECT, WHERE, GROUP BY, and simple JOINs",
        },
        "medium": {
            "complexity": "Multiple JOINs, Subqueries, Aggregate functions with HAVING, Date functions",
        },
        "hard": {
            "complexity": "Window functions, CTEs, Self JOINs, complex Subqueries and aggregations",
        }
    }

    guidelines = difficulty_guidelines.get(difficulty.lower(), difficulty_guidelines["medium"])

    system_prompt = f"""You are an expert Database Engineer creating LeetCode-style SQL assessment challenges.

JOB CONTEXT:
- Role: {role}
- Level: {level}
- Description: {description[:1000]}
- Target Difficulty: {difficulty.upper()} ({guidelines['complexity']})
- Challenge Count: {count}

CHALLENGE QUALITY STANDARDS:
1. LEETCODE STYLE: Each challenge must have a clear problem statement, a defined table schema, sample data, and an expected output.
2. ISOLATED ENVIRONMENT: The SQL will be run in an SQLite in-memory database that simulates MySQL.
3. VALID SQL: Ensure the schema setup (CREATE TABLE) and sample data (INSERT INTO) are valid SQLite syntax. Use standard SQL types (INTEGER, TEXT, DATE, DATETIME, BOOLEAN, FLOAT).
4. VERIFIABLE: The expected query MUST return the exact expected output when run against the sample data.

STRUCTURE REQUIREMENTS:
Generate exactly {count} SQL challenges in the following JSON format. For the description, use detailed markdown containing: Problem Statement, Database Schema, Table Definitions, Sample Data, Expected Output, Constraints, and Difficulty Level.
{{
    "challenges": [
        {{
            "title": "Problem Title",
            "description": "Full markdown description containing **Problem Statement**, **Database Schema**, **Table Definitions**, **Sample Data**, **Expected Output**, **Constraints**, and **Difficulty Level**.",
            "db_schema": "CREATE TABLE employees (id INTEGER, name TEXT, salary INTEGER, department_id INTEGER); CREATE TABLE departments (id INTEGER, name TEXT);",
            "sample_data": "INSERT INTO departments VALUES (1, 'IT'), (2, 'Sales'); INSERT INTO employees VALUES (1, 'Alice', 90000, 1), (2, 'Bob', 80000, 2);",
            "expected_query": "SELECT d.name AS Department, e.name AS Employee, e.salary AS Salary FROM employees e JOIN departments d ON e.department_id = d.id WHERE e.salary > 85000;",
            "starter_code": "SELECT * FROM employees;",
            "difficulty": "easy|medium|hard",
            "time_limit_minutes": 20,
            "points": 25
        }}
    ]
}}"""

    user_prompt = f"Generate {count} unique {difficulty.upper()} SQL challenges suitable for a {level} {role}."
    
    return system_prompt, user_prompt

