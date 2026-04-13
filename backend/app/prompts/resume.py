import json
from typing import Dict, Any
from .base import NO_HALLUCINATIONS_RULE

def get_analyze_resume_prompt(resume_text: str) -> tuple[str, str]:
    system_instruction = """You are an expert resume analysis AI with advanced natural language processing capabilities.
Your task is to extract comprehensive, accurate structured data from resumes while maintaining data integrity."""
    
    user_prompt = f"""Analyze the following resume and extract structured information with high precision.

RESUME TEXT:
{resume_text}

ANALYSIS REQUIREMENTS:
1. ACCURACY FIRST: Only extract information that is explicitly stated in the resume
2. SKILL NORMALIZATION: Standardize skill names (e.g., "Python", "python" → "Python")
3. EXPERIENCE CALCULATION: Calculate total years from actual work periods, not stated totals
4. DATE STANDARDIZATION: Convert all dates to YYYY-MM format, use null for uncertain dates
5. EDUCATION EXTRACTION: Identify degrees, institutions, and graduation years
6. CONTACT INFORMATION: Extract email, phone, and professional social links
7. NO HALLUCINATIONS: Never invent skills, experiences, or qualifications

Return valid JSON:
{{
    "skills": ["skill1", "skill2", "skill3"],
    "experience": [
        {{
            "title": "Job Title",
            "company": "Company Name",
            "duration": "Jan 2020 - Present",
            "description": "Role description with key achievements",
            "start_date": "2020-01",
            "end_date": null
        }}
    ],
    "education": [
        {{
            "degree": "Degree Name",
            "institution": "Institution Name",
            "year": "2020"
        }}
    ],
    "summary": "Professional summary or null",
    "contact": {{
        "email": "email@example.com",
        "phone": "+1234567890",
        "linkedin": "linkedin.com/in/username"
    }},
    "total_experience_years": 5.5,
    "certifications": ["cert1", "cert2"]
}}"""
    
    return system_instruction, user_prompt


def get_screen_candidate_prompt(job_description: Dict[str, Any], resume_data: Dict[str, Any]) -> tuple[str, str]:
    system_instruction = """You are an intelligent applicant evaluation system with advanced analytical capabilities.
Your purpose is to provide fair, evidence-based candidate screening with transparent scoring."""
    
    user_prompt = f"""Evaluate this candidate against job requirements using evidence-based analysis.

JOB REQUIREMENTS:
- Title: {job_description.get('title', 'N/A')}
- Role: {job_description.get('role', 'N/A')}
- Level: {job_description.get('level', 'N/A')}
- Must-Have Skills: {job_description.get('must_have_skills', [])}
- Good-to-Have Skills: {job_description.get('good_to_have_skills', [])}
- Min Experience: {job_description.get('min_experience_years', 0)} years

CANDIDATE DATA:
{json.dumps(resume_data, indent=2)}

EVALUATION CRITERIA:
1. SKILL ASSESSMENT: Match candidate skills with job requirements
2. EXPERIENCE RELEVANCE: Evaluate work history relevance to target role
3. EDUCATION ALIGNMENT: Assess educational background match
4. OVERALL FIT: Comprehensive evaluation of candidate suitability

SCORING SCALE (0-100):
- 90-100: Exceptional candidate
- 80-89: Strong candidate
- 70-79: Good candidate
- 60-69: Average candidate
- Below 60: Below requirements

SCREENING REQUIREMENTS:
- Provide specific evidence for each assessment
- Use consistent scoring methodology
- Include clear shortlist recommendation
- Support decisions with concrete data points

Return JSON:
{{
    "overall_score": 75,
    "skill_relevance_score": 80,
    "experience_score": 70,
    "education_score": 75,
    "credibility_score": 85,
    "shortlisted": true,
    "shortlist_reason": "Evidence-based recommendation with clear rationale",
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
                "evidence": "Quoted evidence from resume",
                "confidence": 0.9
            }}
        ],
        "experience_analysis": "Detailed relevance evaluation of work history",
        "education_analysis": "Educational background assessment",
        "career_gap_analysis": "Gap identification or none",
        "credibility_flags": ["Specific issues or empty array"]
    }}
}}"""
    
    return system_instruction, user_prompt
