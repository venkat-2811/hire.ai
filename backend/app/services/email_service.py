"""
Email service using SMTP (aiosmtplib) for sending transactional emails.
Configured for Hostinger (smtp.hostinger.com:465 SSL) by default.
"""
import asyncio
import re
import logging
import uuid
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from email.utils import formatdate, formataddr
from typing import Optional, List

import aiosmtplib

from app.config import get_settings

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending emails via SMTP."""

    def __init__(self):
        settings = get_settings()
        self.smtp_host = settings.smtp_host
        self.smtp_port = settings.smtp_port
        self.smtp_user = settings.smtp_user
        self.smtp_password = settings.smtp_password
        self.from_email = settings.smtp_from_email or settings.smtp_user
        self.use_ssl = settings.smtp_use_ssl

    def _smtp_security(self) -> tuple[bool, bool]:
        """Return (use_tls, start_tls).

        Hostinger commonly uses:
        - 465: implicit TLS (use_tls=True, start_tls=False)
        - 587: STARTTLS (use_tls=False, start_tls=True)
        """
        port = int(self.smtp_port or 0)
        use_ssl = bool(self.use_ssl)

        # Auto-correct common misconfigs.
        if port == 465:
            return True, False
        if port in (587, 25):
            return False, True

        # Fallback to env flag.
        return (use_ssl, not use_ssl)

    async def send_email(
        self,
        to: str | List[str],
        subject: str,
        html: str,
        text: Optional[str] = None,
        reply_to: Optional[str] = None,
        from_name: str = "Rekshift",
    ) -> dict:
        """Send an email using SMTP."""
        if not self.smtp_user or not self.smtp_password:
            raise RuntimeError("SMTP_USER and SMTP_PASSWORD are not configured")

        recipients = [to] if isinstance(to, str) else list(to)
        recipients = [str(r).strip() for r in recipients if str(r).strip()]
        if not recipients:
            raise RuntimeError("Email recipient is missing")

        for r in recipients:
            if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", r):
                raise RuntimeError(f"Invalid recipient email: {r}")

        msg = MIMEMultipart("alternative")
        msg["From"] = formataddr((from_name, self.from_email))
        msg["To"] = ", ".join(recipients)
        msg["Subject"] = subject
        msg["Date"] = formatdate(localtime=True)
        msg["Message-ID"] = f"<{uuid.uuid4().hex}@rekshift.com>"
        msg["MIME-Version"] = "1.0"
        msg["X-Mailer"] = "Rekshift/1.0"
        if reply_to:
            msg["Reply-To"] = reply_to

        # Always include plain-text version for deliverability
        plain_text = text or re.sub(r'<[^>]+>', '', html).strip()[:2000]
        msg.attach(MIMEText(plain_text, "plain", "utf-8"))
        msg.attach(MIMEText(html, "html", "utf-8"))

        last_exception = None
        use_tls, start_tls = self._smtp_security()

        for attempt in range(1, 4):
            try:
                logger.info(
                    "[email] sending attempt=%s host=%s port=%s use_tls=%s start_tls=%s to=%s subject=%s",
                    str(attempt),
                    str(self.smtp_host),
                    str(self.smtp_port),
                    str(use_tls),
                    str(start_tls),
                    str(recipients),
                    str(subject),
                )
                await aiosmtplib.send(
                    msg,
                    hostname=self.smtp_host,
                    port=self.smtp_port,
                    username=self.smtp_user,
                    password=self.smtp_password,
                    use_tls=use_tls,
                    start_tls=start_tls,
                    timeout=30,
                )
                last_exception = None
                break
            except Exception as e:
                last_exception = e
                logger.error(
                    "[email] SMTP FAILED attempt=%s to=%s subject=%s err_type=%s error=%s",
                    str(attempt),
                    str(recipients),
                    str(subject),
                    type(e).__name__,
                    str(e),
                )
                if attempt < 3:
                    await asyncio.sleep(1.5 * attempt)

        if last_exception is not None:
            raise last_exception

        logger.info("[email] sent to=%s subject=%s", recipients, subject)
        return {"status": "sent", "to": recipients}
    
    async def send_application_received(self, to: str, candidate_name: str, job_title: str, company_name: str = "Our Company") -> dict:
        """Send application received confirmation email."""
        subject = f"Application Received – Thank You for Applying to {company_name}"
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333333; line-height: 1.6;">
            <p>Dear {candidate_name},</p>
            <p>Thank you for your interest in <strong>{company_name}</strong> and for applying for the <strong>{job_title}</strong> position.</p>
            <p>We are pleased to confirm that we have successfully received your application. Our hiring team will carefully review your qualifications and experience to evaluate your fit for the role.</p>
            <p>If your profile matches our current requirements, we will contact you regarding the next steps in the hiring process. We appreciate your patience while we complete our review.</p>
            <p>Thank you for considering {company_name} as the next step in your career. We wish you the very best and look forward to the opportunity to connect with you.</p>
            <br>
            <p>Best regards,<br><br><strong>{company_name}</strong><br>Hiring Team</p>
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
        from_name: str = "Rekshift",
    ) -> dict:
        """Send an email with a single file attachment using SMTP."""
        if not self.smtp_user or not self.smtp_password:
            raise RuntimeError("SMTP_USER and SMTP_PASSWORD are not configured")

        recipients = [to] if isinstance(to, str) else list(to)
        recipients = [str(r).strip() for r in recipients if str(r).strip()]
        if not recipients:
            raise RuntimeError("Email recipient is missing")

        for r in recipients:
            if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", r):
                raise RuntimeError(f"Invalid recipient email: {r}")

        msg = MIMEMultipart("mixed")
        msg["From"] = formataddr((from_name, self.from_email))
        msg["To"] = ", ".join(recipients)
        msg["Subject"] = subject
        msg["Date"] = formatdate(localtime=True)
        msg["Message-ID"] = f"<{uuid.uuid4().hex}@rekshift.com>"
        msg["MIME-Version"] = "1.0"

        body_part = MIMEMultipart("alternative")
        plain_text = text or re.sub(r'<[^>]+>', '', html).strip()[:2000]
        body_part.attach(MIMEText(plain_text, "plain", "utf-8"))
        body_part.attach(MIMEText(html, "html", "utf-8"))
        msg.attach(body_part)

        maintype, _, subtype = attachment_content_type.partition("/")
        attachment_part = MIMEBase(maintype or "application", subtype or "octet-stream")
        attachment_part.set_payload(attachment_content)
        encoders.encode_base64(attachment_part)
        attachment_part.add_header(
            "Content-Disposition", "attachment", filename=attachment_filename
        )
        msg.attach(attachment_part)

        last_exception = None
        use_tls, start_tls = self._smtp_security()

        for attempt in range(1, 4):
            try:
                logger.info(
                    "[email] sending_attachment attempt=%s host=%s port=%s use_tls=%s start_tls=%s to=%s subject=%s",
                    str(attempt),
                    str(self.smtp_host),
                    str(self.smtp_port),
                    str(use_tls),
                    str(start_tls),
                    str(recipients),
                    str(subject),
                )
                await aiosmtplib.send(
                    msg,
                    hostname=self.smtp_host,
                    port=self.smtp_port,
                    username=self.smtp_user,
                    password=self.smtp_password,
                    use_tls=use_tls,
                    start_tls=start_tls,
                    timeout=60,
                )
                last_exception = None
                break
            except Exception as e:
                last_exception = e
                logger.error(
                    "[email] SMTP FAILED (attachment) attempt=%s to=%s subject=%s err_type=%s error=%s",
                    str(attempt),
                    str(recipients),
                    str(subject),
                    type(e).__name__,
                    str(e),
                )
                if attempt < 3:
                    await asyncio.sleep(1.5 * attempt)

        if last_exception is not None:
            raise last_exception

        logger.info("[email] sent (with attachment) to=%s subject=%s", recipients, subject)
        return {"status": "sent", "to": recipients}

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
