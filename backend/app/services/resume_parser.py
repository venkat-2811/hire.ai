import os
import re
from typing import Optional, Tuple
from io import BytesIO
import pdfplumber
from docx import Document
from app.models.schemas import ResumeData, ExperienceItem, EducationItem, ContactInfo
from app.services.openai_client import get_openai_service


class ResumeParserService:
    """Service for parsing resumes using AI-powered semantic extraction."""
    
    def __init__(self):
        self.openai = get_openai_service()
    
    async def parse_resume(self, file_content: bytes, filename: str) -> Tuple[str, ResumeData]:
        """
        Parse a resume file and extract structured data.
        Returns tuple of (raw_text, parsed_data).
        """
        # Extract text from file
        raw_text = await self._extract_text(file_content, filename)
        
        # Use AI to parse the resume semantically
        parsed_data = await self._ai_parse_resume(raw_text)
        
        return raw_text, parsed_data
    
    async def _extract_text(self, file_content: bytes, filename: str) -> str:
        """Extract text from PDF or DOCX file."""
        ext = os.path.splitext(filename)[1].lower()
        
        if ext == '.pdf':
            return self._extract_from_pdf(file_content)
        elif ext in ['.docx', '.doc']:
            return self._extract_from_docx(file_content)
        else:
            raise ValueError(f"Unsupported file format: {ext}")
    
    def _extract_from_pdf(self, file_content: bytes) -> str:
        """Extract text from PDF using pdfplumber."""
        text_parts = []
        with pdfplumber.open(BytesIO(file_content)) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    text_parts.append(text)
        return "\n".join(text_parts)
    
    def _extract_from_docx(self, file_content: bytes) -> str:
        """Extract text from DOCX file."""
        doc = Document(BytesIO(file_content))
        text_parts = []
        for paragraph in doc.paragraphs:
            if paragraph.text.strip():
                text_parts.append(paragraph.text)
        return "\n".join(text_parts)
    
    async def _ai_parse_resume(self, resume_text: str) -> ResumeData:
        """Use AI to semantically parse resume content."""

        try:
            result = await self.openai.analyze_resume(resume_text[:8000])
            
            # Parse experience items
            experience = []
            for exp in result.get("experience", []):
                experience.append(ExperienceItem(
                    title=exp.get("title", ""),
                    company=exp.get("company", ""),
                    duration=exp.get("duration", ""),
                    description=exp.get("description", ""),
                    start_date=exp.get("start_date"),
                    end_date=exp.get("end_date")
                ))
            
            # Parse education items
            education = []
            for edu in result.get("education", []):
                education.append(EducationItem(
                    degree=edu.get("degree", ""),
                    institution=edu.get("institution", ""),
                    year=edu.get("year", "")
                ))
            
            # Parse contact info
            contact_data = result.get("contact", {})
            contact = ContactInfo(
                email=contact_data.get("email"),
                phone=contact_data.get("phone"),
                linkedin=contact_data.get("linkedin")
            )
            
            return ResumeData(
                skills=result.get("skills", []),
                experience=experience,
                education=education,
                summary=result.get("summary") or "",
                contact=contact,
                total_experience_years=float(result.get("total_experience_years", 0)),
                certifications=result.get("certifications", [])
            )
            
        except Exception as e:
            # Return empty data on parsing failure
            return ResumeData()


_resume_parser: Optional[ResumeParserService] = None


def get_resume_parser() -> ResumeParserService:
    global _resume_parser
    if _resume_parser is None:
        _resume_parser = ResumeParserService()
    return _resume_parser
