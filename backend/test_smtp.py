"""Test SMTP email delivery from the server."""
import asyncio
import os
import aiosmtplib
from email.mime.text import MIMEText

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

    # Send to a test address
    test_to = "venkatakarthiksai.s@gmail.com"
    msg = MIMEText("Test email from rekshift.com server - checking if emails are being delivered correctly.", "plain", "utf-8")
    msg["From"] = from_email
    msg["To"] = test_to
    msg["Subject"] = "[Rekshift] Email Delivery Test"

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
        print(f"SUCCESS: SMTP accepted the email. Response: {result}")
    except Exception as e:
        print(f"FAILED: {type(e).__name__}: {e}")

asyncio.run(test())
