import json
from typing import Dict, Any, List, Optional

# ==========================================
# RESUME & ATS SCREENING PROMPTS
# ==========================================

def get_analyze_resume_prompt(resume_text: str) -> tuple[str, str]:
    system_instruction = """You are an expert, meticulous resume data extraction engine.
Your sole purpose is to extract structured JSON data faithfully from the provided text WITHOUT any hallucinations or assumptions."""
    
    user_prompt = f"""Analyze the provided resume and extract information following these strict rules:

CRITICAL RULES:
1. No Hallucinations: If any information is missing or unclear in the resume, you MUST return `null` for that field. Do not guess, infer, or hallucinate missing data.
2. Skill Normalization: Deduplicate and normalize skills (e.g., combine "Python" and "python" into a single "Python"; standardize variations of frameworks/tools).
3. Date Formatting: Standardize all dates to exactly "YYYY-MM" format. If day or exact month is missing, estimate cautiously (e.g., "Jan 2020" -> "2020-01", "2021" -> "2021-01"). If a date cannot be determined or is labeled "Present", use `null` for end_date.
4. Total Experience: The `total_experience_years` field must be logically calculated by summing the total non-overlapping duration of extracted professional experience entries. Do not rely entirely on the candidate's stated summary. 
5. Explicit Statements Only: Extract only what is explicitly written. Never assume proficiency, education, or experience that is not explicitly stated.

JSON Format Requirements:
{{
    "skills": ["Normalized Skill 1", "Normalized Skill 2"],
    "experience": [
        {{
            "title": "Job Title",
            "company": "Company Name",
            "duration": "Duration string (e.g., Jan 2020 - Present) or null",
            "description": "Brief description or null",
            "start_date": "YYYY-MM or null",
            "end_date": "YYYY-MM or null"
        }}
    ],
    "education": [
        {{
            "degree": "Degree Name or null",
            "institution": "Institution Name or null",
            "year": "Graduation Year (YYYY) or null"
        }}
    ],
    "summary": "Brief professional summary or null",
    "contact": {{
        "email": "email string or null",
        "phone": "phone string or null",
        "linkedin": "linkedin url or null"
    }},
    "total_experience_years": 0.0,
    "certifications": ["cert1", "cert2"]
}}

Resume:
{resume_text}
"""
    return system_instruction, user_prompt


def get_screen_candidate_prompt(job_description: Dict[str, Any], resume_data: Dict[str, Any]) -> tuple[str, str]:
    system_instruction = """You are a strictly deterministic Applicant Tracking System (ATS).
Your core engine provides fair, evidence-based, explainable screening results devoid of hallucinations and subjectivity."""
    
    user_prompt = f"""Screen this candidate against the job requirements based strictly on the provided resume data. 

SCORING GUIDELINES (0-100 scale):
- 90-100: Exceptional match. Exceeds experience relevance, matches all must-have and most good-to-have skills precisely.
- 75-89: Strong match. Meets experience requirements well and accurately possesses all must-have skills.
- 60-74: Potential match. Might be slightly under experience criteria or missing 1-2 must-have skills, but exhibits strong potential.
- Below 60: Poor match. Unmistakably lacks crucial skills or significantly falls short of the duration/relevance of the required experience.

CRITICAL RULES:
1. Strict Skill Matching: All skills analyzed must have clear evidence backing them. Provide a `match_type` of either "exact" (skill is explicitly written) or "inferred" (strong contextual evidence of skill application without exact keyword). If there is no evidence, mark it as "missing".
2. Evaluation by Relevance: Experience evaluation MUST consider the actual relevance of the past roles to this specific job, prioritizing depth and relevance over pure cumulative duration.
3. Logical Shortlisting: To be shortlisted (`shortlisted: true`), the candidate MUST meet a minimum `overall_score` of 65 AND possess at least 70% of the must-have skills with explicit evidence.
4. No Assumptions: Do not invent missing details. Base the entire analysis truthfully on the provided resume JSON.

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
    "shortlist_reason": "Provide deterministic reasoning based heavily on scoring thresholds and must-have skill checks.",
    "reason_codes": [
        {{
            "code": "SKILL_MATCH",
            "type": "positive|negative",
            "description": "Specific evidence-based description",
            "impact": 15
        }}
    ],
    "detailed_analysis": {{
        "skill_match": [
            {{
                "skill": "Skill Name",
                "found": true,
                "match_type": "exact|inferred|missing",
                "relevance": "must_have|good_to_have",
                "evidence": "Quoted evidence from resume or null",
                "confidence": 0.9
            }}
        ],
        "experience_analysis": "Detailed review of both work duration AND specific relevance to the current role",
        "education_analysis": "Review of education matching",
        "career_gap_analysis": "Identification of any gaps or null if none",
        "credibility_flags": ["Strict anomaly list or empty array"]
    }}
}}
"""
    return system_instruction, user_prompt


# ==========================================
