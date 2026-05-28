"""Test SMTP email delivery from the server with proper headers."""
import asyncio
import os
import uuid
import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate, formataddr

# Parse .env
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

async def test():
    smtp_host = os.environ.get("SMTP_HOST", "smtp.hostinger.com")
    smtp_port = int(os.environ.get("SMTP_PORT", "465"))
    smtp_user = os.environ.get("SMTP_USER", "admin@rekshift.com")
    smtp_pass = os.environ.get("SMTP_PASSWORD", "")
    from_email = os.environ.get("SMTP_FROM_EMAIL", smtp_user)
    use_ssl = os.environ.get("SMTP_USE_SSL", "true").lower() == "true"

    print(f"SMTP: {smtp_host}:{smtp_port} user={smtp_user} ssl={use_ssl}")
    print(f"From: {from_email}")

    test_to = "venkatakarthiksai.s@gmail.com"

    # Build email with proper headers (matching the fixed email service)
    msg = MIMEMultipart("alternative")
    msg["From"] = formataddr(("Rekshift", from_email))
    msg["To"] = test_to
    msg["Subject"] = "[Rekshift] Interview Invite - Delivery Test"
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = f"<{uuid.uuid4().hex}@rekshift.com>"
    msg["MIME-Version"] = "1.0"
    msg["X-Mailer"] = "Rekshift/1.0"

    plain = "Hi, this is a test interview invite email from Rekshift to verify delivery."
    html = """
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a2e;">Interview Invitation</h2>
        <p>Dear Candidate,</p>
        <p>This is a <strong>test email</strong> to verify that Rekshift interview invite emails are being delivered correctly to your inbox.</p>
        <p>If you see this in your inbox (not spam), email delivery is working.</p>
        <p style="margin: 30px 0;">
            <a href="https://rekshift.com" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                Test Button
            </a>
        </p>
        <p>Best regards,<br>The Rekshift Team</p>
    </div>
    """
    msg.attach(MIMEText(plain, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        result = await aiosmtplib.send(
            msg,
            hostname=smtp_host,
            port=smtp_port,
            username=smtp_user,
            password=smtp_pass,
            use_tls=use_ssl,
            start_tls=not use_ssl,
            timeout=30,
        )
        print(f"SUCCESS: SMTP accepted. Queue ID: {result}")
        print(f"CHECK inbox at: {test_to}")
    except Exception as e:
        print(f"FAILED: {type(e).__name__}: {e}")

asyncio.run(test())
