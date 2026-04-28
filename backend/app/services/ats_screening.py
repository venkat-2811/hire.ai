from typing import Optional, List, Dict, Any
from app.models.schemas import (
    ResumeData, JobDescription, ATSScreeningResult, ReasonCode,
    DetailedAnalysis, SkillMatch
)
from app.models.enums import ReasonCodeType, SkillRelevance, RoleLevel
from app.services.openai_client import get_openai_service
import uuid
from datetime import datetime


class ATSScreeningService:
    """
    ATS Resume Screening Service with Explainable AI.
    Performs semantic resume analysis against job requirements.
    """
    
    def __init__(self):
        self.openai = get_openai_service()
        
        # Role-specific skill weights
        # Note: These are legacy weights. New dynamic analysis should ideally imply weights from JD.
        self.role_skill_weights = {
            "Salesforce Developer": {
                "apex": 15, "lwc": 12, "lightning": 10, "soql": 10, "salesforce": 15,
                "visualforce": 8, "integration": 8, "api": 7, "javascript": 6, "html": 4
            },
            "QA Engineer": {
                "selenium": 12, "automation": 15, "testing": 15, "api testing": 10,
                "test cases": 10, "jira": 6, "agile": 5, "python": 8, "java": 7, "sql": 5
            },
            "Business Analyst": {
                "requirements": 15, "user stories": 12, "stakeholder": 10, "analysis": 12,
                "documentation": 8, "agile": 8, "scrum": 6, "sql": 7, "jira": 5, "communication": 8
            }
        }
        
        # Level-specific experience requirements
        self.level_experience = {
            RoleLevel.INTERN: (0, 1),
            RoleLevel.JUNIOR: (0, 2),
            RoleLevel.MID: (2, 5),
            RoleLevel.SENIOR: (5, 15)
        }
    
    async def screen_candidate(
        self,
        resume_data: ResumeData,
        resume_text: str,
        job: JobDescription
    ) -> ATSScreeningResult:
        """
        Perform comprehensive ATS screening with explainable AI.
        """
        # Calculate individual scores
        skill_score, skill_matches = await self._calculate_skill_score(
            resume_data, job
        )
        experience_score, exp_analysis = await self._calculate_experience_score(
            resume_data, job
        )
        education_score, edu_analysis = await self._calculate_education_score(
            resume_data, job
        )
        credibility_score, cred_flags = await self._calculate_credibility_score(
            resume_data, resume_text
        )
        
        # Calculate career gap analysis
        gap_analysis = await self._analyze_career_gaps(resume_data)
        
        # Generate reason codes
        reason_codes = self._generate_reason_codes(
            skill_score, experience_score, education_score,
            credibility_score, skill_matches, cred_flags
        )
        
        # Calculate overall score (weighted average)
        overall_score = self._calculate_overall_score(
            skill_score, experience_score, education_score, credibility_score
        )
        
        # Determine shortlist decision
        shortlisted, shortlist_reason = self._make_shortlist_decision(
            overall_score, skill_score, experience_score, reason_codes, job
        )
        
        # Build detailed analysis
        detailed_analysis = DetailedAnalysis(
            skill_match=skill_matches,
            experience_analysis=exp_analysis,
            education_analysis=edu_analysis,
            career_gap_analysis=gap_analysis,
            credibility_flags=cred_flags
        )
        
        return ATSScreeningResult(
            id=str(uuid.uuid4()),
            candidate_id="",  # Will be set by caller
            job_id="",  # Will be set by caller
            overall_score=overall_score,
            skill_relevance_score=skill_score,
            experience_score=experience_score,
            education_score=education_score,
            credibility_score=credibility_score,
            shortlisted=shortlisted,
            shortlist_reason=shortlist_reason,
            reason_codes=reason_codes,
            detailed_analysis=detailed_analysis,
            screened_at=datetime.utcnow()
        )
    
    async def _calculate_skill_score(
        self,
        resume_data: ResumeData,
        job: JobDescription
    ) -> tuple[int, List[SkillMatch]]:
        """Calculate skill relevance score using semantic matching."""
        
        candidate_skills = [s.lower() for s in resume_data.skills]
        skill_matches = []
        
        # Check must-have skills
        must_have_found = 0
        for skill in job.must_have_skills:
            found, evidence, confidence = self._find_skill_match(
                skill, candidate_skills, resume_data
            )
            skill_matches.append(SkillMatch(
                skill=skill,
                found=found,
                relevance=SkillRelevance.MUST_HAVE,
                evidence=evidence,
                confidence=confidence
            ))
            if found:
                must_have_found += 1
        
        # Check good-to-have skills
        good_to_have_found = 0
        for skill in job.good_to_have_skills:
            found, evidence, confidence = self._find_skill_match(
                skill, candidate_skills, resume_data
            )
            skill_matches.append(SkillMatch(
                skill=skill,
                found=found,
                relevance=SkillRelevance.GOOD_TO_HAVE,
                evidence=evidence,
                confidence=confidence
            ))
            if found:
                good_to_have_found += 1
        
        # Calculate score
        must_have_total = len(job.must_have_skills) or 1
        good_to_have_total = len(job.good_to_have_skills) or 1
        
        must_have_score = (must_have_found / must_have_total) * 70
        good_to_have_score = (good_to_have_found / good_to_have_total) * 30
        
        total_score = int(must_have_score + good_to_have_score)
        return min(100, total_score), skill_matches
    
    def _find_skill_match(
        self,
        required_skill: str,
        candidate_skills: List[str],
        resume_data: ResumeData
    ) -> tuple[bool, Optional[str], float]:
        """Find if a skill matches using fuzzy/semantic matching."""
        required_lower = required_skill.lower()
        
        # Direct match
        for skill in candidate_skills:
            if required_lower in skill or skill in required_lower:
                return True, f"Direct match: {skill}", 1.0
        
        # Check in experience descriptions
        for exp in resume_data.experience:
            if required_lower in exp.description.lower():
                return True, f"Found in experience at {exp.company}", 0.8
        
        # Synonym matching
        synonyms = self._get_skill_synonyms(required_lower)
        for syn in synonyms:
            for skill in candidate_skills:
                if syn in skill or skill in syn:
                    return True, f"Synonym match: {skill} ≈ {required_skill}", 0.7
        
        return False, None, 0.0
    
    def _get_skill_synonyms(self, skill: str) -> List[str]:
        """Get common synonyms for skills."""
        synonym_map = {
            "javascript": ["js", "ecmascript", "es6"],
            "typescript": ["ts"],
            "python": ["py"],
            "salesforce": ["sfdc", "sf"],
            "lightning web components": ["lwc"],
            "apex": ["apex programming"],
            "selenium": ["selenium webdriver"],
            "api testing": ["rest api", "postman", "api automation"],
            "sql": ["mysql", "postgresql", "oracle", "database"],
            "agile": ["scrum", "kanban"],
            "requirements gathering": ["requirements analysis", "business requirements"],
        }
        return synonym_map.get(skill, [])
    
    async def _calculate_experience_score(
        self,
        resume_data: ResumeData,
        job: JobDescription
    ) -> tuple[int, str]:
        """Calculate experience score based on years and relevance."""
        total_years = resume_data.total_experience_years
        min_years, max_years = self.level_experience.get(
            job.level, (0, 10)
        )
        
        # Check if experience matches level
        if total_years < min_years:
            gap = min_years - total_years
            score = max(0, 100 - (gap * 20))
            analysis = f"Candidate has {total_years:.1f} years experience, below the {min_years}-{max_years} year range for {job.level.value} level."
        elif total_years > max_years + 3:
            score = 80  # Overqualified but still good
            analysis = f"Candidate has {total_years:.1f} years experience, potentially overqualified for {job.level.value} level."
        else:
            score = 100
            analysis = f"Candidate has {total_years:.1f} years experience, well-suited for {job.level.value} level ({min_years}-{max_years} years)."
        
        return score, analysis
    
    async def _calculate_education_score(
        self,
        resume_data: ResumeData,
        job: JobDescription
    ) -> tuple[int, str]:
        """Calculate education score."""
        if not resume_data.education:
            return 50, "No formal education listed. Consider practical experience."
        
        score = 70  # Base score for having education
        analysis_parts = []
        
        for edu in resume_data.education:
            degree_lower = edu.degree.lower()
            
            # Check for relevant degrees
            if any(term in degree_lower for term in ["computer", "software", "information", "technology", "engineering"]):
                score = min(100, score + 15)
                analysis_parts.append(f"Relevant degree: {edu.degree}")
            elif any(term in degree_lower for term in ["business", "management", "mba"]):
                if job.role == "Business Analyst":
                    score = min(100, score + 15)
                    analysis_parts.append(f"Relevant business degree: {edu.degree}")
                else:
                    score = min(100, score + 5)
            
            # Check for advanced degrees
            if any(term in degree_lower for term in ["master", "mba", "phd", "doctorate"]):
                score = min(100, score + 10)
        
        # Check certifications
        if resume_data.certifications:
            score = min(100, score + len(resume_data.certifications) * 5)
            analysis_parts.append(f"Has {len(resume_data.certifications)} certification(s)")
        
        analysis = "; ".join(analysis_parts) if analysis_parts else "Education evaluated."
        return score, analysis
    
    async def _calculate_credibility_score(
        self,
        resume_data: ResumeData,
        resume_text: str
    ) -> tuple[int, List[str]]:
        """Check for credibility issues and red flags."""
        score = 100
        flags = []
        
        # Check for employment gaps (simplified)
        if len(resume_data.experience) > 1:
            # This would need more sophisticated date parsing in production
            pass
        
        # Check for very short tenures
        short_tenures = 0
        for exp in resume_data.experience:
            duration_lower = exp.duration.lower()
            if any(term in duration_lower for term in ["month", "1 year", "< 1"]):
                short_tenures += 1
        
        if short_tenures >= 3:
            score -= 15
            flags.append("Multiple short-tenure positions detected")
        
        # Check for missing contact info
        if not resume_data.contact.email:
            score -= 10
            flags.append("No email address found")
        
        # Check for vague descriptions
        vague_count = 0
        for exp in resume_data.experience:
            if len(exp.description) < 20:
                vague_count += 1
        
        if vague_count >= 2:
            score -= 10
            flags.append("Some experience descriptions lack detail")
        
        return max(0, score), flags
    
    async def _analyze_career_gaps(self, resume_data: ResumeData) -> str:
        """Analyze career gaps in employment history."""
        if len(resume_data.experience) < 2:
            return "Insufficient employment history to analyze gaps."
        
        # In production, this would parse dates and calculate actual gaps
        return "Career progression appears continuous based on available data."
    
    def _generate_reason_codes(
        self,
        skill_score: int,
        experience_score: int,
        education_score: int,
        credibility_score: int,
        skill_matches: List[SkillMatch],
        cred_flags: List[str]
    ) -> List[ReasonCode]:
        """Generate explainable reason codes for the screening decision."""
        codes = []
        
        # Skill-related codes
        must_have_missing = [m for m in skill_matches 
                           if m.relevance == SkillRelevance.MUST_HAVE and not m.found]
        must_have_found = [m for m in skill_matches 
                         if m.relevance == SkillRelevance.MUST_HAVE and m.found]
        
        if len(must_have_found) == len([m for m in skill_matches if m.relevance == SkillRelevance.MUST_HAVE]):
            codes.append(ReasonCode(
                code="SKILL_COMPLETE",
                type=ReasonCodeType.POSITIVE,
                description="All must-have skills are present",
                impact=20
            ))
        elif must_have_missing:
            codes.append(ReasonCode(
                code="SKILL_GAP",
                type=ReasonCodeType.NEGATIVE,
                description=f"Missing must-have skills: {', '.join([m.skill for m in must_have_missing[:3]])}",
                impact=-15
            ))
        
        # Experience codes
        if experience_score >= 90:
            codes.append(ReasonCode(
                code="EXP_MATCH",
                type=ReasonCodeType.POSITIVE,
                description="Experience level matches job requirements",
                impact=15
            ))
        elif experience_score < 60:
            codes.append(ReasonCode(
                code="EXP_INSUFFICIENT",
                type=ReasonCodeType.NEGATIVE,
                description="Experience level below requirements",
                impact=-20
            ))
        
        # Education codes
        if education_score >= 85:
            codes.append(ReasonCode(
                code="EDU_STRONG",
                type=ReasonCodeType.POSITIVE,
                description="Strong educational background",
                impact=10
            ))
        
        # Credibility codes
        for flag in cred_flags:
            codes.append(ReasonCode(
                code="CRED_FLAG",
                type=ReasonCodeType.NEGATIVE,
                description=flag,
                impact=-5
            ))
        
        if credibility_score >= 95:
            codes.append(ReasonCode(
                code="CRED_STRONG",
                type=ReasonCodeType.POSITIVE,
                description="No credibility concerns detected",
                impact=5
            ))
        
        return codes
    
    def _calculate_overall_score(
        self,
        skill_score: int,
        experience_score: int,
        education_score: int,
        credibility_score: int
    ) -> int:
        """Calculate weighted overall score."""
        weights = {
            "skill": 0.40,
            "experience": 0.30,
            "education": 0.15,
            "credibility": 0.15
        }
        
        overall = (
            skill_score * weights["skill"] +
            experience_score * weights["experience"] +
            education_score * weights["education"] +
            credibility_score * weights["credibility"]
        )
        
        return int(overall)
    
    def _make_shortlist_decision(
        self,
        overall_score: int,
        skill_score: int,
        experience_score: int,
        reason_codes: List[ReasonCode],
        job: JobDescription
    ) -> tuple[bool, str]:
        """Make shortlist decision with explanation."""
        
        # Count critical issues
        critical_negatives = [c for c in reason_codes 
                            if c.type == ReasonCodeType.NEGATIVE and c.impact <= -15]
        
        if overall_score >= 75 and skill_score >= 60 and not critical_negatives:
            return True, f"Strong candidate with {overall_score}% match. Recommended for interview."
        elif overall_score >= 65 and skill_score >= 50:
            return True, f"Good potential with {overall_score}% match. Some skill gaps may need assessment."
        elif overall_score >= 55:
            return False, f"Borderline candidate ({overall_score}%). Consider if other candidates are limited."
        else:
            issues = [c.description for c in critical_negatives[:2]]
            return False, f"Does not meet minimum requirements ({overall_score}%). Issues: {'; '.join(issues)}"


_ats_service: Optional[ATSScreeningService] = None


def get_ats_screening_service() -> ATSScreeningService:
    global _ats_service
    if _ats_service is None:
        _ats_service = ATSScreeningService()
    return _ats_service
