import asyncio
import logging
import uuid
import re
import os
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from email.utils import formatdate, formataddr
from typing import Optional, List, Dict, Any, Tuple
from enum import IntEnum

import aiosmtplib

from app.config import get_settings

logger = logging.getLogger(__name__)

class Priority(IntEnum):
    CRITICAL = 0
    HIGH = 1
    NORMAL = 2

class EmailJob:
    def __init__(
        self,
        priority: Priority,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        max_attempts: int = 3,
    ):
        self.priority = priority
        self.enqueued_at = datetime.now(timezone.utc).timestamp()
        self.job_id = str(uuid.uuid4())
        self.to_email = to_email
        self.subject = subject
        self.html_body = html_body
        self.text_body = text_body or re.sub(r'<[^>]+>', '', html_body).strip()[:2000]
        self.attachments = attachments or []
        self.attempts = 0
        self.max_attempts = max_attempts

    def __lt__(self, other):
        if not isinstance(other, EmailJob):
            return NotImplemented
        # Primary sort: Priority (lower number = higher priority)
        # Secondary sort: enqueued_at (FIFO)
        return (self.priority, self.enqueued_at) < (other.priority, other.enqueued_at)


class SMTPConfig:
    def __init__(self):
        settings = get_settings()
        self.host = settings.smtp_host
        self.port = int(settings.smtp_port or 0)
        self.user = settings.smtp_user
        self.password = settings.smtp_password
        self.from_email = settings.smtp_from_email or settings.smtp_user
        self.use_ssl = settings.smtp_use_ssl

    def get_security_settings(self) -> Tuple[bool, bool]:
        if self.port == 465:
            return True, False
        if self.port in (587, 25):
            return False, True
        return (self.use_ssl, not self.use_ssl)


class SMTPWorker:
    def __init__(self, queue: asyncio.PriorityQueue, config: SMTPConfig, worker_id: int):
        self.queue = queue
        self.config = config
        self.worker_id = worker_id
        self.smtp: Optional[aiosmtplib.SMTP] = None
        self._running = False

    async def _ensure_connected(self):
        if self.smtp and self.smtp.is_connected:
            return

        use_tls, start_tls = self.config.get_security_settings()
        self.smtp = aiosmtplib.SMTP(
            hostname=self.config.host,
            port=self.config.port,
            use_tls=use_tls,
            start_tls=start_tls,
            timeout=30,
        )
        
        await self.smtp.connect()
        await self.smtp.login(self.config.user, self.config.password)
        logger.info(f"[email_worker_{self.worker_id}] connected to SMTP server")

    def _build_message(self, job: EmailJob) -> MIMEMultipart:
        has_attachments = len(job.attachments) > 0
        
        msg = MIMEMultipart("mixed" if has_attachments else "alternative")
        msg["From"] = formataddr(("Rekshift", self.config.from_email))
        msg["To"] = job.to_email
        msg["Subject"] = job.subject
        msg["Date"] = formatdate(localtime=True)
        msg["Message-ID"] = f"<{uuid.uuid4().hex}@rekshift.com>"
        msg["MIME-Version"] = "1.0"
        msg["X-Mailer"] = "Rekshift/1.0"

        if has_attachments:
            body_part = MIMEMultipart("alternative")
            body_part.attach(MIMEText(job.text_body, "plain", "utf-8"))
            body_part.attach(MIMEText(job.html_body, "html", "utf-8"))
            msg.attach(body_part)
            
            for att in job.attachments:
                filename = att.get("filename", "attachment")
                data = att.get("data", b"")
                mime = att.get("mime", "application/octet-stream")
                maintype, _, subtype = mime.partition("/")
                attachment_part = MIMEBase(maintype or "application", subtype or "octet-stream")
                attachment_part.set_payload(data)
                encoders.encode_base64(attachment_part)
                attachment_part.add_header("Content-Disposition", "attachment", filename=filename)
                msg.attach(attachment_part)
        else:
            msg.attach(MIMEText(job.text_body, "plain", "utf-8"))
            msg.attach(MIMEText(job.html_body, "html", "utf-8"))
            
        return msg

    async def _send(self, job: EmailJob):
        try:
            await self._ensure_connected()
        except Exception as e:
            logger.error(f"[email_worker_{self.worker_id}] failed to connect: {str(e)}")
            raise

        msg = self._build_message(job)
        
        try:
            await self.smtp.send_message(msg)
            logger.info(f"[email_worker_{self.worker_id}] Sent email to {job.to_email} (job={job.job_id})")
        except aiosmtplib.SMTPServerDisconnected:
            logger.warning(f"[email_worker_{self.worker_id}] Disconnected. Reconnecting and retrying once.")
            await self._ensure_connected()
            await self.smtp.send_message(msg)
            logger.info(f"[email_worker_{self.worker_id}] Sent email to {job.to_email} on retry (job={job.job_id})")

    async def run(self):
        self._running = True
        logger.info(f"[email_worker_{self.worker_id}] Worker started")
        
        while self._running:
            try:
                job = await self.queue.get()
            except asyncio.CancelledError:
                break
                
            job.attempts += 1
            
            try:
                await self._send(job)
            except Exception as e:
                logger.error(f"[email_worker_{self.worker_id}] Failed to send job {job.job_id}: {str(e)}")
                
                if job.attempts < job.max_attempts:
                    backoff = 2 ** job.attempts  # 2, 4, 8...
                    logger.info(f"[email_worker_{self.worker_id}] Re-enqueuing job {job.job_id} in {backoff}s")
                    async def re_enqueue():
                        await asyncio.sleep(backoff)
                        await self.queue.put(job)
                    asyncio.create_task(re_enqueue())
                else:
                    logger.error(f"[email_worker_{self.worker_id}] Job {job.job_id} exceeded max attempts. Dead-lettering.")
                    with open("dead_letter.log", "a") as f:
                        f.write(f"[{datetime.now(timezone.utc).isoformat()}] Failed to send email to {job.to_email}. Subject: {job.subject}. Error: {str(e)}\n")
            finally:
                self.queue.task_done()
                
        if self.smtp and self.smtp.is_connected:
            self.smtp.close()
        logger.info(f"[email_worker_{self.worker_id}] Worker stopped")


class EmailQueueManager:
    def __init__(self, workers: int = 3):
        self.num_workers = workers
        self.queue = asyncio.PriorityQueue()
        self.workers: List[asyncio.Task] = []
        self.config = SMTPConfig()

    async def start(self):
        if self.workers:
            return
            
        for i in range(self.num_workers):
            worker = SMTPWorker(self.queue, self.config, i)
            task = asyncio.create_task(worker.run())
            self.workers.append(task)
        logger.info(f"[EmailQueueManager] Started {self.num_workers} workers")

    async def stop(self):
        logger.info("[EmailQueueManager] Stopping...")
        try:
            # Wait up to 30s for the queue to finish processing
            await asyncio.wait_for(self.queue.join(), timeout=30.0)
        except asyncio.TimeoutError:
            logger.warning("[EmailQueueManager] Queue did not empty within 30s timeout")
            
        for task in self.workers:
            task.cancel()
            
        await asyncio.gather(*self.workers, return_exceptions=True)
        self.workers = []
        logger.info("[EmailQueueManager] Stopped")

    @property
    def queue_size(self) -> int:
        return self.queue.qsize()

    async def enqueue(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        priority: Priority = Priority.NORMAL,
        max_attempts: int = 3
    ) -> str:
        if not self.config.user or not self.config.password:
            raise RuntimeError("SMTP_USER and SMTP_PASSWORD are not configured")

        if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", to_email):
            raise RuntimeError(f"Invalid recipient email: {to_email}")

        job = EmailJob(
            priority=priority,
            to_email=to_email,
            subject=subject,
            html_body=html_body,
            text_body=text_body,
            attachments=attachments,
            max_attempts=max_attempts
        )
        await self.queue.put(job)
        return job.job_id
        
    # --- TEMPLATE HELPERS ----------------------------------------------------
    
    def build_application_received(self, candidate_name: str, job_title: str) -> Tuple[str, Optional[str], str]:
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
        return html, None, subject
        
    def build_assessment_invite(self, candidate_name: str, job_title: str, assessment_link: str, deadline: Optional[str] = None) -> Tuple[str, Optional[str], str]:
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
        return html, None, subject
        
    def build_interview_invite(self, candidate_name: str, job_title: str, interview_link: str, scheduled_time: Optional[str] = None) -> Tuple[str, Optional[str], str]:
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
        return html, None, subject
        
    def build_acceptance_email(self, candidate_name: str, job_title: str) -> Tuple[str, Optional[str], str]:
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
        return html, None, subject

    def build_rejection_email(self, candidate_name: str, job_title: str) -> Tuple[str, Optional[str], str]:
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
        return html, None, subject
        
    def build_offer_letter_email(self, candidate_name: str, job_title: str, company_name: str, acceptance_link: str) -> Tuple[str, Optional[str], str]:
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
        return html, None, subject


email_queue = EmailQueueManager(workers=int(os.getenv("EMAIL_WORKERS", "3")))
