"""
Email service using Resend API for sending transactional emails.
"""
import httpx
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
        deadline_html = f"""
                <div style="background-color: #f8fafc; border-left: 4px solid #6366f1; padding: 15px 20px; margin-bottom: 30px; border-radius: 4px;">
                    <p style="margin: 0; font-size: 15px;"><strong>Deadline:</strong> {deadline}</p>
                </div>""" if deadline else ""
        
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="background-color: #2a323c; padding: 40px 20px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Technical Assessment</h1>
                <p style="color: #94a3b8; margin: 10px 0 0 0; font-size: 16px;">Regarding your application at Hire.AI</p>
            </div>
            <div style="padding: 40px 30px; color: #334155; line-height: 1.6;">
                <p style="font-size: 16px; margin-bottom: 20px;">Dear <strong>{candidate_name}</strong>,</p>
                <p style="font-size: 16px; margin-bottom: 20px;">Congratulations! You have been shortlisted for the <strong>{job_title}</strong> position and we would like to invite you to complete a technical assessment.</p>
                
                {deadline_html}
                
                <div style="border: 1px solid #fed7aa; border-radius: 8px; padding: 20px; margin-bottom: 30px; background-color: #fffaf5;">
                    <p style="margin: 0 0 10px 0; color: #9a3412;"><strong>Please note:</strong></p>
                    <ul style="margin: 0; padding-left: 20px; color: #9a3412; font-size: 14px;">
                        <li style="margin-bottom: 8px;">The assessment must be completed in one sitting.</li>
                        <li style="margin-bottom: 8px;">Ensure you have a stable internet connection.</li>
                        <li style="margin-bottom: 8px;">Full-screen mode is required throughout the assessment.</li>
                        <li>Tab switching or exiting full-screen will automatically terminate your session.</li>
                    </ul>
                </div>
                
                <div style="text-align: center; margin: 40px 0;">
                    <a href="{assessment_link}" style="background-color: #2563eb; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">Start Assessment</a>
                </div>
                
                <p style="font-size: 16px; margin-bottom: 10px;">Best of luck!</p>
                <p style="font-size: 16px; color: #64748b; margin: 0;">Best regards,<br>The Hiring Team</p>
            </div>
            <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 14px;">
                <p style="margin: 0;">If you're having trouble clicking the button, copy and paste this link into your browser:</p>
                <p style="margin: 10px 0 0 0;"><a href="{assessment_link}" style="color: #2563eb; word-break: break-all;">{assessment_link}</a></p>
            </div>
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
        time_html = f"""
                <div style="background-color: #f8fafc; border-left: 4px solid #6366f1; padding: 15px 20px; margin-bottom: 30px; border-radius: 4px;">
                    <p style="margin: 0; font-size: 15px;"><strong>Scheduled Time:</strong> {scheduled_time}</p>
                </div>""" if scheduled_time else ""
        
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="background-color: #2a323c; padding: 40px 20px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Interview Invitation</h1>
                <p style="color: #94a3b8; margin: 10px 0 0 0; font-size: 16px;">Regarding your application at Hire.AI</p>
            </div>
            <div style="padding: 40px 30px; color: #334155; line-height: 1.6;">
                <p style="font-size: 16px; margin-bottom: 20px;">Dear <strong>{candidate_name}</strong>,</p>
                <p style="font-size: 16px; margin-bottom: 20px;">Congratulations on successfully completing the technical assessment! We are pleased to invite you to the next stage for the <strong>{job_title}</strong> position: an AI-powered interview.</p>
                
                {time_html}
                
                <div style="border: 1px solid #fed7aa; border-radius: 8px; padding: 20px; margin-bottom: 30px; background-color: #fffaf5;">
                    <p style="margin: 0 0 10px 0; color: #9a3412;"><strong>Please note:</strong></p>
                    <ul style="margin: 0; padding-left: 20px; color: #9a3412; font-size: 14px;">
                        <li style="margin-bottom: 8px;">Ensure you have a working webcam and microphone in a quiet, well-lit environment.</li>
                        <li style="margin-bottom: 8px;">The interview will be conducted entirely by an AI agent.</li>
                        <li style="margin-bottom: 8px;">Questions will be asked via speech, and you will respond verbally.</li>
                        <li style="margin-bottom: 8px;">Your camera will be monitored continuously.</li>
                        <li>Full-screen mode is mandatory for the duration of the interview.</li>
                    </ul>
                </div>
                
                <div style="text-align: center; margin: 40px 0;">
                    <a href="{interview_link}" style="background-color: #2563eb; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">Join Interview</a>
                </div>
                
                <p style="font-size: 16px; margin-bottom: 10px;">Best of luck!</p>
                <p style="font-size: 16px; color: #64748b; margin: 0;">Best regards,<br>The Hiring Team</p>
            </div>
            <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 14px;">
                <p style="margin: 0;">If you're having trouble clicking the button, copy and paste this link into your browser:</p>
                <p style="margin: 10px 0 0 0;"><a href="{interview_link}" style="color: #2563eb; word-break: break-all;">{interview_link}</a></p>
            </div>
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


_email_service: Optional[EmailService] = None


def get_email_service() -> EmailService:
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service
