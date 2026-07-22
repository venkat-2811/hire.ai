import json
import uuid
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

from app.models.schemas import (
    ResumeData, JobDescription, ATSScreeningResult, ReasonCode,
    DetailedAnalysis
)
from app.models.enums import ReasonCodeType
from app.services.ai.factory import get_ai


class ATSScreeningService:
    """
    ATS Resume Screening Service with Explainable AI.
    Performs semantic resume analysis against job requirements using LLMs.
    """
    
    def __init__(self):
        self.ai = get_ai()
    
    async def screen_candidate(
        self,
        resume_data: ResumeData,
        resume_text: str,
        job: JobDescription
    ) -> ATSScreeningResult:
        """
        Perform comprehensive ATS screening with explainable AI using a direct prompt.
        """
        
        # Serialize resume data efficiently
        resume_json = json.dumps(resume_data.model_dump(exclude_none=True))[:6000]
        
        prompt = f"""
Analyze this candidate's resume against the job requirements and provide ATS screening scores.

Job: {job.title} ({job.role}, {job.level})
Required Skills: {', '.join(job.must_have_skills or [])}
Nice-to-have Skills: {', '.join(job.good_to_have_skills or [])}
Min Experience: {job.min_experience_years or 0} years

Candidate Resume JSON:
{resume_json}

Return JSON:
{{
  "overall_score": 0-100,
  "skill_relevance_score": 0-100,
  "experience_score": 0-100,
  "education_score": 0-100,
  "credibility_score": 0-100,
  "shortlisted": true/false,
  "shortlist_reason": "...",
  "reason_codes": [{{"code":"SKILL_MATCH","type":"positive","description":"...","impact":10}}],
  "detailed_analysis": {{
    "whats_good": [
      "Highlight strengths and matching qualifications",
      "Relevant skills, technologies, experience, projects, education, certifications aligned with JD"
    ],
    "what_lacks": [
      "Highlight missing or weak areas relative to the JD",
      "Missing skills, technologies, certifications, or experience requirements"
    ]
  }}
}}""".strip()

        try:
            screening_result = await self.ai.generate_json(prompt, temperature=0.1, max_tokens=1200, timeout_s=20)
        except Exception as e:
            raise RuntimeError(f"Failed to run ATS screening: {str(e)}")

        # Parse reason_codes
        rc_list = []
        for rc in screening_result.get("reason_codes", []):
            try:
                rc_type_str = str(rc.get("type", "positive")).lower()
                rc_type = ReasonCodeType.POSITIVE if rc_type_str == "positive" else ReasonCodeType.NEGATIVE
                rc_list.append(ReasonCode(
                    code=str(rc.get("code", "")),
                    type=rc_type,
                    description=str(rc.get("description", "")),
                    impact=int(rc.get("impact", 0))
                ))
            except Exception:
                pass

        # Parse detailed_analysis
        da_dict = screening_result.get("detailed_analysis") or {}
        da_obj = DetailedAnalysis(
            whats_good=da_dict.get("whats_good", []),
            what_lacks=da_dict.get("what_lacks", []),
            skill_match=[],
            experience_analysis="",
            education_analysis="",
            career_gap_analysis="",
            credibility_flags=[]
        )

        return ATSScreeningResult(
            id=str(uuid.uuid4()),
            candidate_id="placeholder",  # caller will override
            job_id=str(job.id),
            overall_score=int(screening_result.get("overall_score", 0)),
            skill_relevance_score=int(screening_result.get("skill_relevance_score", 0)),
            experience_score=int(screening_result.get("experience_score", 0)),
            education_score=int(screening_result.get("education_score", 0)),
            credibility_score=int(screening_result.get("credibility_score", 0)),
            shortlisted=bool(screening_result.get("shortlisted", False)),
            shortlist_reason=str(screening_result.get("shortlist_reason", "")),
            reason_codes=rc_list,
            detailed_analysis=da_obj,
            screened_at=datetime.now(timezone.utc)
        )


_ats_service: Optional[ATSScreeningService] = None

def get_ats_screening_service() -> ATSScreeningService:
    global _ats_service
    if _ats_service is None:
        _ats_service = ATSScreeningService()
    return _ats_service
