"""
Contact form endpoint for handling public contact inquiries.
"""
import re
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.services.email_service import EmailService
from app.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/contact", tags=["contact"])


class ContactRequest(BaseModel):
    """Contact form request schema."""
    fullName: str = Field(..., min_length=1, max_length=255)
    companyName: Optional[str] = Field(None, max_length=255)
    email: str = Field(..., max_length=255)
    phone: Optional[str] = Field(None, max_length=20)
    subject: Optional[str] = Field(None, max_length=255)
    message: str = Field(..., min_length=10, max_length=5000)

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        """Validate email format."""
        if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', v):
            raise ValueError('Invalid email address')
        return v.lower().strip()

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        """Validate phone format (if provided)."""
        if v and not re.match(r'^[\d+\-\s()]{6,20}$', v.strip()):
            raise ValueError('Invalid phone number format')
        return v.strip() if v else None

    @field_validator('fullName')
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        """Validate full name."""
        if not re.match(r'^[a-zA-Z\s\-\'\.]+$', v.strip()):
            raise ValueError('Name contains invalid characters')
        return v.strip()


class ContactResponse(BaseModel):
    """Contact form response."""
    status: str
    message: str
    id: Optional[str] = None


@router.post("", response_model=ContactResponse)
async def submit_contact(request: ContactRequest) -> ContactResponse:
    """
    Handle contact form submission.
    
    - Validates input
    - Sends email to contact address
    - Returns success response
    """
    try:
        settings = get_settings()
        email_service = EmailService()
        
        # Recipient email address
        recipient_email = "vamsi@bvitsolutions.com"
        
        # Build email content
        subject = f"New Contact Inquiry: {request.subject or 'General Inquiry'}"
        
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a2e; margin-bottom: 20px;">New Contact Inquiry</h2>
            
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <p style="margin: 8px 0;"><strong>From:</strong> {request.fullName}</p>
                <p style="margin: 8px 0;"><strong>Email:</strong> <a href="mailto:{request.email}">{request.email}</a></p>
                {f'<p style="margin: 8px 0;"><strong>Company:</strong> {request.companyName}</p>' if request.companyName else ''}
                {f'<p style="margin: 8px 0;"><strong>Phone:</strong> {request.phone}</p>' if request.phone else ''}
                {f'<p style="margin: 8px 0;"><strong>Subject:</strong> {request.subject}</p>' if request.subject else ''}
            </div>
            
            <div style="margin-bottom: 20px;">
                <h3 style="color: #333; margin-top: 0;">Message:</h3>
                <p style="white-space: pre-wrap; line-height: 1.6; color: #555;">{request.message}</p>
            </div>
            
            <div style="border-top: 1px solid #ddd; padding-top: 15px; font-size: 12px; color: #999;">
                <p>This is an automated message from your contact form. Please reply directly to the email address above.</p>
            </div>
        </div>
        """
        
        # Send email
        await email_service.send_email(
            to=recipient_email,
            subject=subject,
            html=html_content,
            reply_to=request.email,
        )
        
        logger.info(
            "[contact] inquiry submitted: %s (%s) - %s",
            request.fullName,
            request.email,
            request.subject or "General Inquiry",
        )
        
        return ContactResponse(
            status="success",
            message="Thank you for your inquiry. We'll get back to you soon.",
        )
        
    except ValueError as e:
        logger.warning("[contact] validation error: %s", str(e))
        raise HTTPException(status_code=400, detail=str(e))
    
    except Exception as e:
        logger.error("[contact] failed to send inquiry: %s", str(e))
        raise HTTPException(
            status_code=500,
            detail="Failed to submit your inquiry. Please try again later.",
        )
