import json
from typing import Dict, Any, List, Optional

# ==========================================
# RESUME & ATS SCREENING PROMPTS
# ==========================================

def get_analyze_resume_prompt(resume_text: str) -> tuple[str, str]:
    system_instruction = """You are an expert resume parser and analyzer.
Extract structured information from resumes accurately."""
    
    user_prompt = f"""Analyze the following resume and extract information in this exact JSON format:
{{
    "skills": ["skill1", "skill2", ...],
    "experience": [
        {{
            "title": "Job Title",
            "company": "Company Name",
            "duration": "Duration string",
            "description": "Brief description",
            "start_date": "YYYY-MM or null",
            "end_date": "YYYY-MM or null"
        }}
    ],
    "education": [
        {{
            "degree": "Degree Name",
            "institution": "Institution Name",
            "year": "Graduation Year"
        }}
    ],
    "summary": "Brief professional summary",
    "contact": {{
        "email": "email or null",
        "phone": "phone or null",
        "linkedin": "linkedin url or null"
    }},
    "total_experience_years": 0.0,
    "certifications": ["cert1", "cert2", ...]
}}

Resume:
{resume_text}
"""
    return system_instruction, user_prompt


def get_screen_candidate_prompt(job_description: Dict[str, Any], resume_data: Dict[str, Any]) -> tuple[str, str]:
    system_instruction = """You are an expert ATS (Applicant Tracking System) that screens candidates.
Provide detailed, fair, and explainable screening results."""
    
    user_prompt = f"""Screen this candidate against the job requirements.

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
    "shortlist_reason": "Reason for decision",
    "reason_codes": [
        {{
            "code": "SKILL_MATCH",
            "type": "positive",
            "description": "Has required Python skills",
            "impact": 15
        }}
    ],
    "detailed_analysis": {{
        "skill_match": [
            {{
                "skill": "Python",
                "found": true,
                "relevance": "must_have",
                "evidence": "5 years experience mentioned",
                "confidence": 0.9
            }}
        ],
        "experience_analysis": "Analysis of work experience",
        "education_analysis": "Analysis of education",
        "career_gap_analysis": "Any gaps identified",
        "credibility_flags": []
    }}
}}
"""
    return system_instruction, user_prompt


# ==========================================
