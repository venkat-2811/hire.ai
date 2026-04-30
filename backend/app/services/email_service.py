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
        attachment_bytes: bytes,
        attachment_filename: str,
        attachment_content_type: str,
        acceptance_link: str,
    ) -> dict:
        """Send formal offer letter email with attachment and acceptance link."""
        subject = f"🎉 Congratulations! Your Offer Letter – {job_title} at {company_name}"
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; border-radius: 8px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 40px; text-align: center;">
                <h1 style="color: white; margin: 0 0 4px 0; font-size: 32px; font-weight: 800; letter-spacing: -0.5px;">{company_name}</h1>
                <p style="color: rgba(255,255,255,0.8); margin: 0; font-size: 13px; letter-spacing: 1px; text-transform: uppercase;">Talent Acquisition Team</p>
            </div>
            <div style="padding: 36px 40px;">
                <div style="text-align: center; margin-bottom: 28px;">
                    <div style="font-size: 52px; margin-bottom: 8px;">🎉</div>
                    <h2 style="color: #1a1a2e; margin: 0; font-size: 26px;">Congratulations, {candidate_name}!</h2>
                    <p style="color: #6b7280; margin: 8px 0 0 0; font-size: 15px;">You've been selected for an exciting opportunity.</p>
                </div>
                <p style="color: #374151; line-height: 1.7; font-size: 15px;">
                    We are thrilled to offer you the position of <strong>{job_title}</strong> at <strong>{company_name}</strong>.
                    Your performance throughout our hiring process has been truly impressive, and we cannot wait to have you on board.
                </p>
                <div style="background: #fef9ec; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px 20px; margin: 20px 0;">
                    <p style="margin: 0; color: #92400e; font-weight: 700; font-size: 14px;">📎 Your Offer Letter is Attached</p>
                    <p style="margin: 6px 0 0 0; color: #78350f; font-size: 13px; line-height: 1.5;">
                        Please open and review the attached offer letter carefully. It contains your compensation details,
                        start date, and all employment terms.
                    </p>
                </div>
                <div style="background: #f0f4ff; border-left: 4px solid #6366f1; padding: 16px 20px; border-radius: 4px; margin: 24px 0;">
                    <p style="margin: 0 0 8px 0; color: #4f46e5; font-weight: 700; font-size: 14px;">📋 To Accept Your Offer:</p>
                    <ol style="margin: 0; padding-left: 18px; color: #374151; line-height: 2; font-size: 14px;">
                        <li>Review the attached offer letter</li>
                        <li>Click the <strong>"Accept Offer"</strong> button below</li>
                        <li>Enter your full name as a digital signature</li>
                        <li>Click <strong>"Submit Acceptance"</strong> to confirm</li>
                    </ol>
                </div>
                <div style="text-align: center; margin: 36px 0 20px 0;">
                    <a href="{acceptance_link}" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 18px 48px; text-decoration: none; border-radius: 10px; font-weight: 800; font-size: 18px; display: inline-block; box-shadow: 0 6px 20px rgba(16,185,129,0.4); letter-spacing: 0.3px;">
                        ✅ Accept Offer
                    </a>
                </div>
                <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 4px 0 24px 0;">
                    This acceptance link expires in <strong>7 business days</strong>. Please respond promptly.
                </p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
                <p style="color: #6b7280; line-height: 1.6; font-size: 14px;">
                    If you have any questions about the offer, please don't hesitate to reach out to our HR team.
                    We're here to help make your transition as smooth as possible.
                </p>
                <p style="color: #374151; margin-bottom: 0;">
                    Warm regards,<br/>
                    <strong>Talent Acquisition Team</strong><br/>
                    <span style="color: #6b7280;">{company_name}</span>
                </p>
            </div>
            <div style="background: #f3f4f6; padding: 16px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                <p style="color: #9ca3af; font-size: 11px; margin: 0;">
                    This is a confidential communication intended solely for {candidate_name}.
                    If you received this in error, please notify us immediately.
                </p>
            </div>
        </div>
        """
        return await self.send_email_with_attachment(
            to=to,
            subject=subject,
            html=html,
            attachment_content=attachment_bytes,
            attachment_filename=attachment_filename,
            attachment_content_type=attachment_content_type,
        )


_email_service: Optional[EmailService] = None


def get_email_service() -> EmailService:
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service
