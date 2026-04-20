"""
Email service using Resend API for sending transactional emails.
"""
import httpx
import base64
from typing import Optional, List
from app.config import get_settings


class EmailService:
    """Service for sending emails via Resend API."""
    
    BASE_URL = "https://api.resend.com"
    
    def __init__(self):
        settings = get_settings()
        self.api_key = settings.resend_api_key
        self.from_email = settings.resend_from_email
        
    async def send_email(
        self,
        to: str | List[str],
        subject: str,
        html: str,
        text: Optional[str] = None,
        reply_to: Optional[str] = None,
    ) -> dict:
        """Send an email using Resend API."""
        if not self.api_key:
            raise RuntimeError("RESEND_API_KEY is not configured")
        
        recipients = [to] if isinstance(to, str) else to
        
        payload = {
            "from": self.from_email,
            "to": recipients,
            "subject": subject,
            "html": html,
        }
        
        if text:
            payload["text"] = text
        if reply_to:
            payload["reply_to"] = reply_to
            
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.BASE_URL}/emails",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=30.0,
            )
            
            if response.status_code >= 400:
                raise RuntimeError(f"Resend API error: {response.status_code} - {response.text}")
            
            return response.json()
    
    async def send_application_received(self, to: str, candidate_name: str, job_title: str) -> dict:
        """Send application received confirmation email."""
        subject = f"Application Received - {job_title}"
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a1a2e;">Application Received</h2>
            <p>Dear {candidate_name},</p>
            <p>Thank you for applying to the <strong>{job_title}</strong> position.</p>
            <p>We have received your application and our team will review it shortly. 
            We will contact you soon regarding the next steps in our hiring process.</p>
            <p>Best regards,<br>The Hiring Team</p>
        </div>
        """
        return await self.send_email(to, subject, html)
    
    async def send_assessment_invite(
        self,
        to: str,
        candidate_name: str,
        job_title: str,
        assessment_link: str,
        deadline: Optional[str] = None,
    ) -> dict:
        """Send technical assessment invitation email."""
        subject = f"Technical Assessment Invitation - {job_title}"
        deadline_text = f"<p><strong>Deadline:</strong> {deadline}</p>" if deadline else ""
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a1a2e;">Technical Assessment Invitation</h2>
            <p>Dear {candidate_name},</p>
            <p>Congratulations! You have been shortlisted for the <strong>{job_title}</strong> position.</p>
            <p>We would like to invite you to complete a technical assessment as the next step in our hiring process.</p>
            {deadline_text}
            <p><strong>Important Instructions:</strong></p>
            <ul>
                <li>The assessment must be completed in one sitting</li>
                <li>Ensure you have a stable internet connection</li>
                <li>The assessment includes MCQ and hands-on coding sections</li>
                <li>Full-screen mode is required throughout the assessment</li>
                <li>Tab switching or leaving the assessment window will end your session</li>
            </ul>
            <p style="margin: 30px 0;">
                <a href="{assessment_link}" 
                   style="background-color: #6366f1; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 6px; display: inline-block;">
                    Start Assessment
                </a>
            </p>
            <p>Best of luck!</p>
            <p>Best regards,<br>The Hiring Team</p>
        </div>
        """
        return await self.send_email(to, subject, html)
    
    async def send_interview_invite(
        self,
        to: str,
        candidate_name: str,
        job_title: str,
        interview_link: str,
        scheduled_time: Optional[str] = None,
    ) -> dict:
        """Send AI interview invitation email."""
        subject = f"Interview Invitation - {job_title}"
        time_text = f"<p><strong>Scheduled Time:</strong> {scheduled_time}</p>" if scheduled_time else ""
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a1a2e;">Interview Invitation</h2>
            <p>Dear {candidate_name},</p>
            <p>Congratulations on completing the technical assessment for the <strong>{job_title}</strong> position!</p>
            <p>We are pleased to invite you to the next stage: an AI-powered interview.</p>
            {time_text}
            <p><strong>Important Instructions:</strong></p>
            <ul>
                <li>Ensure you have a working webcam and microphone</li>
                <li>Find a quiet, well-lit environment</li>
                <li>The interview will be conducted entirely by AI</li>
                <li>Questions will be asked via speech, and you will respond verbally</li>
                <li>Your camera will be monitored throughout the interview</li>
                <li>Full-screen mode is required</li>
            </ul>
            <p style="margin: 30px 0;">
                <a href="{interview_link}" 
                   style="background-color: #6366f1; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 6px; display: inline-block;">
                    Start Interview
                </a>
            </p>
            <p>Best of luck!</p>
            <p>Best regards,<br>The Hiring Team</p>
        </div>
        """
        return await self.send_email(to, subject, html)
    
    async def send_acceptance_email(
        self,
        to: str,
        candidate_name: str,
        job_title: str,
    ) -> dict:
        """Send candidate acceptance/offer email."""
        subject = f"Congratulations! You've Been Selected - {job_title}"
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a1a2e;">🎉 Congratulations!</h2>
            <p>Dear {candidate_name},</p>
            <p>We are thrilled to inform you that you have been selected for the 
            <strong>{job_title}</strong> position!</p>
            <p>Your performance throughout the hiring process has been exceptional, 
            and we believe you will be a valuable addition to our team.</p>
            <p>Our HR team will reach out to you shortly with the offer details and next steps.</p>
            <p>Welcome aboard!</p>
            <p>Best regards,<br>The Hiring Team</p>
        </div>
        """
        return await self.send_email(to, subject, html)
    
    async def send_rejection_email(
        self,
        to: str,
        candidate_name: str,
        job_title: str,
    ) -> dict:
        """Send candidate rejection email."""
        subject = f"Application Update - {job_title}"
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a1a2e;">Application Update</h2>
            <p>Dear {candidate_name},</p>
            <p>Thank you for your interest in the <strong>{job_title}</strong> position 
            and for taking the time to go through our hiring process.</p>
            <p>After careful consideration, we have decided to move forward with other candidates 
            whose qualifications more closely match our current needs.</p>
            <p>We encourage you to apply for future openings that match your skills and experience.</p>
            <p>We wish you the best in your career endeavors.</p>
            <p>Best regards,<br>The Hiring Team</p>
        </div>
        """
        return await self.send_email(to, subject, html)

    async def send_email_with_attachment(
        self,
        to: str | List[str],
        subject: str,
        html: str,
        attachment_content: bytes,
        attachment_filename: str,
        attachment_content_type: str = "application/pdf",
        text: Optional[str] = None,
    ) -> dict:
        """Send an email with a single file attachment using Resend API."""
        if not self.api_key:
            raise RuntimeError("RESEND_API_KEY is not configured")

        recipients = [to] if isinstance(to, str) else to

        payload = {
            "from": self.from_email,
            "to": recipients,
            "subject": subject,
            "html": html,
            "attachments": [
                {
                    "filename": attachment_filename,
                    "content": base64.b64encode(attachment_content).decode("utf-8"),
                    "content_type": attachment_content_type,
                }
            ],
        }

        if text:
            payload["text"] = text

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.BASE_URL}/emails",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=60.0,
            )

            if response.status_code >= 400:
                raise RuntimeError(f"Resend API error: {response.status_code} - {response.text}")

            return response.json()

    async def send_offer_letter_email(
        self,
        to: str,
        candidate_name: str,
        job_title: str,
        company_name: str,
        pdf_bytes: bytes,
        acceptance_link: str,
    ) -> dict:
        """Send formal offer letter email with PDF attachment and acceptance link."""
        subject = f"Formal Offer Letter – {job_title} at {company_name}"
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; border-radius: 8px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 32px 40px;">
                <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">{company_name}</h1>
                <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0 0; font-size: 14px;">Talent Acquisition Team</p>
            </div>
            <div style="padding: 32px 40px;">
                <h2 style="color: #1a1a2e; margin-top: 0;">🎉 Congratulations, {candidate_name}!</h2>
                <p style="color: #444; line-height: 1.6;">
                    We are delighted to extend a formal offer of employment to you for the position of
                    <strong>{job_title}</strong> at <strong>{company_name}</strong>.
                </p>
                <p style="color: #444; line-height: 1.6;">
                    Please find your <strong>Offer Letter</strong> attached to this email as a PDF document.
                    It contains all the details of your employment, including your compensation, start date,
                    reporting structure, and key policies.
                </p>
                <div style="background: #f0f4ff; border-left: 4px solid #6366f1; padding: 16px 20px; border-radius: 4px; margin: 24px 0;">
                    <p style="margin: 0; color: #4f46e5; font-weight: 600;">📋 Next Steps</p>
                    <ul style="margin: 10px 0 0 0; padding-left: 18px; color: #444; line-height: 1.8;">
                        <li>Review the attached offer letter carefully</li>
                        <li>Click the button below to formally accept the offer</li>
                        <li>Our HR team will follow up with onboarding details</li>
                    </ul>
                </div>
                <div style="text-align: center; margin: 32px 0;">
                    <a href="{acceptance_link}" style="background: #4f46e5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">Accept Offer Letter</a>
                </div>
                <p style="color: #444; line-height: 1.6;">
                    If you have any questions or need clarification on any aspect of the offer,
                    please do not hesitate to reach out to us.
                </p>
                <p style="color: #444;">
                    We look forward to welcoming you to the team!
                </p>
                <p style="color: #444; margin-bottom: 0;">
                    Warm regards,<br/>
                    <strong>Talent Acquisition Team</strong><br/>
                    {company_name}
                </p>
            </div>
            <div style="background: #f0f0f0; padding: 16px 40px; text-align: center;">
                <p style="color: #888; font-size: 12px; margin: 0;">
                    This is a confidential communication. If you received this in error, please notify us immediately.
                </p>
            </div>
        </div>
        """
        filename = f"Offer_Letter_{candidate_name.replace(' ', '_')}.pdf"
        return await self.send_email_with_attachment(
            to=to,
            subject=subject,
            html=html,
            attachment_content=pdf_bytes,
            attachment_filename=filename,
            attachment_content_type="application/pdf",
        )


_email_service: Optional[EmailService] = None


def get_email_service() -> EmailService:
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service
