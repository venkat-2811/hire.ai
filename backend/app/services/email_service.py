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
        subject = "Next Step in Your Application – Assessment Invitation"
        
        deadline_text = deadline if deadline else "Not specified"
        
        html = f"""
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb; padding: 40px 20px; color: #4b5563; line-height: 1.6;">
            <div style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <!-- Header -->
                <div style="background-color: #7c3aed; padding: 40px 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold;">Assessment Invitation!</h1>
                    <p style="color: #ddd6fe; margin: 10px 0 0 0; font-size: 14px;">Next Step in Your Application</p>
                </div>
                
                <!-- Body -->
                <div style="padding: 40px; color: #4b5563; font-size: 15px;">
                    <p style="margin-top: 0;">Dear <strong>{candidate_name}</strong>,</p>
                    
                    <p>Thank you for your interest in the position of <strong>{job_title}</strong> at Hire.AI.</p>
                    
                    <p>We are pleased to inform you that your application has been shortlisted for the next stage of our hiring process. As part of this, you are invited to complete an online assessment designed to evaluate your technical skills and problem-solving abilities.</p>
                    
                    <!-- Job Box styled like congratulations -->
                    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 15px; text-align: center; margin: 25px 0;">
                        <h3 style="margin: 0; color: #16a34a; font-size: 18px;">{job_title}</h3>
                    </div>
                    
                    <p style="margin: 5px 0;"><strong>Deadline:</strong> {deadline_text}</p>
                    <p style="margin: 5px 0;"><strong>Mode:</strong> Online Assessment</p>
                    
                    <p style="margin-top: 20px;">Please ensure that you complete the assessment before the deadline. We recommend attempting it in a distraction-free environment with a stable internet connection.</p>
                    
                    <div style="text-align: center; margin: 35px 0;">
                        <a href="{assessment_link}" style="background-color: #6366f1; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">Start Assessment</a>
                    </div>
                    
                    <p>This is an important step in our evaluation process, and we encourage you to give it your best effort.</p>
                    <p>If you face any issues or have questions, please feel free to reach out to our support team.</p>
                    <p>We wish you the very best and look forward to reviewing your performance.</p>
                    
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                    
                    <p style="margin-bottom: 0; font-size: 14px;">Thank you for your time and interest in Hire.AI.</p>
                </div>
            </div>
            
            <!-- Footer -->
            <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px; margin-top: 10px;">
                <p style="margin: 5px 0;">This email was sent by Hire.AI — Intelligent Hiring Platform</p>
                <p style="margin: 5px 0;">&copy; 2026 Hire.AI. All rights reserved.</p>
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
        subject = "Interview Invitation – Next Step in Your Application"
        
        # We can ignore scheduled_time if it's not explicitly in the user's template, or add it if provided.
        # Format the template text
        html = f"""
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb; padding: 40px 20px; color: #4b5563; line-height: 1.6;">
            <div style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <!-- Header -->
                <div style="background-color: #7c3aed; padding: 40px 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold;">Interview Invitation!</h1>
                    <p style="color: #ddd6fe; margin: 10px 0 0 0; font-size: 14px;">Next Step in Your Application</p>
                </div>
                
                <!-- Body -->
                <div style="padding: 40px; color: #4b5563; font-size: 15px;">
                    <p style="margin-top: 0;">Dear <strong>{candidate_name}</strong>,</p>
                    
                    <p>We are excited to inform you that you have successfully progressed to the next stage of our hiring process for the position of <strong>{job_title}</strong> at Hire.AI.</p>
                    
                    <p>Based on your profile and previous evaluation, we would like to invite you to participate in an AI-powered interview, where you will have the opportunity to showcase your skills, experience, and problem-solving approach.</p>
                    
                    <!-- Job Box styled like congratulations -->
                    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 15px; text-align: center; margin: 25px 0;">
                        <h3 style="margin: 0; color: #16a34a; font-size: 18px;">{job_title}</h3>
                    </div>
                    
                    <p style="margin: 5px 0;"><strong>Mode:</strong> AI Interview</p>
                    <p style="margin: 5px 0;"><strong>Platform:</strong> Online</p>
                    
                    <p style="margin-top: 20px;">Please ensure you are in a quiet environment with a stable internet connection before starting the interview. Once started, we recommend completing it in one sitting for the best experience.</p>
                    
                    <div style="text-align: center; margin: 35px 0;">
                        <a href="{interview_link}" style="background-color: #6366f1; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">Start Interview</a>
                    </div>
                    
                    <p>This step is a crucial part of our selection process, and we are excited to learn more about you.</p>
                    <p>If you have any questions or require assistance, feel free to contact our HR team.</p>
                    
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                    
                    <p style="margin-bottom: 0; font-size: 14px;">We look forward to your participation and wish you the best of luck!</p>
                </div>
            </div>
            
            <!-- Footer -->
            <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px; margin-top: 10px;">
                <p style="margin: 5px 0;">This email was sent by Hire.AI — Intelligent Hiring Platform</p>
                <p style="margin: 5px 0;">&copy; 2026 Hire.AI. All rights reserved.</p>
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
