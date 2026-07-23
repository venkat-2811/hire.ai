"""
email_templates.py — HTML email templates for company approval flows.

All templates return (subject: str, html: str, text: str).
Uses the existing EmailService (SMTP via aiosmtplib).
"""
from __future__ import annotations

from typing import Optional


# ── Brand constants ───────────────────────────────────────────────────────────
BRAND_COLOR = "#1a1a2e"
ACCENT_COLOR = "#6366f1"
SUCCESS_COLOR = "#10b981"
DANGER_COLOR = "#ef4444"
LOGO_TEXT = "Rekshift"
SUPPORT_EMAIL = "admin@rekshift.com"


def _base_wrapper(content: str, *, preheader: str = "") -> str:
    """Wrap content in a consistent brand email shell."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Rekshift</title>
<style>
  body {{ margin:0; padding:0; background:#f4f4f7; font-family: 'Segoe UI', Arial, sans-serif; color:#1a1a2e; }}
  .wrapper {{ max-width:600px; margin:0 auto; padding:32px 16px; }}
  .card {{ background:#ffffff; border-radius:12px; padding:40px 36px; box-shadow:0 4px 24px rgba(0,0,0,0.08); }}
  .header {{ text-align:center; margin-bottom:32px; }}
  .logo {{ font-size:24px; font-weight:800; color:{ACCENT_COLOR}; letter-spacing:-0.5px; }}
  .divider {{ border:none; border-top:1px solid #e5e7eb; margin:24px 0; }}
  .btn {{ display:inline-block; padding:14px 32px; border-radius:8px; font-weight:700; font-size:14px; text-decoration:none; letter-spacing:0.3px; margin:8px 4px; }}
  .btn-approve {{ background:{SUCCESS_COLOR}; color:#ffffff; }}
  .btn-reject {{ background:{DANGER_COLOR}; color:#ffffff; }}
  .btn-primary {{ background:{ACCENT_COLOR}; color:#ffffff; }}
  .meta {{ font-size:12px; color:#6b7280; margin-top:24px; text-align:center; }}
  .stat-row {{ display:flex; gap:16px; margin:16px 0; flex-wrap:wrap; }}
  .stat {{ background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:12px 16px; flex:1; min-width:100px; text-align:center; }}
  .stat-val {{ font-size:22px; font-weight:800; color:{ACCENT_COLOR}; }}
  .stat-lbl {{ font-size:11px; color:#6b7280; margin-top:2px; text-transform:uppercase; letter-spacing:0.5px; }}
  .notice {{ background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:16px; margin:20px 0; font-size:13px; color:#166534; }}
  .warning {{ background:#fff7ed; border:1px solid #fed7aa; border-radius:8px; padding:16px; margin:20px 0; font-size:13px; color:#9a3412; }}
</style>
</head>
<body>
<div style="display:none;font-size:1px;color:#f4f4f7;max-height:0;overflow:hidden;">{preheader}</div>
<div class="wrapper">
  <div class="card">
    <div class="header">
      <div class="logo">{LOGO_TEXT}</div>
    </div>
    {content}
    <hr class="divider" />
    <div class="meta">
      This email was sent by Rekshift &middot; <a href="mailto:{SUPPORT_EMAIL}" style="color:{ACCENT_COLOR};">{SUPPORT_EMAIL}</a><br/>
      &copy; 2026 Rekshift. All rights reserved.
    </div>
  </div>
</div>
</body>
</html>"""


# ── Template 1: Join Request to Company Owner ─────────────────────────────────

def join_request_email(
    *,
    owner_name: str,
    recruiter_name: str,
    recruiter_email: str,
    company_name: str,
    approve_url: str,
    reject_url: str,
    dashboard_url: str,
) -> tuple[str, str, str]:
    subject = f"[Rekshift] {recruiter_name} wants to join {company_name}"
    preheader = f"{recruiter_name} has requested to join your company on Rekshift."

    content = f"""
<h2 style="margin:0 0 8px;font-size:22px;font-weight:800;">New Join Request 👋</h2>
<p style="color:#6b7280;margin:0 0 24px;font-size:15px;">Hi {owner_name}, someone wants to join your company on Rekshift.</p>

<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:20px;margin-bottom:24px;">
  <table style="width:100%;border-collapse:collapse;">
    <tr>
      <td style="padding:6px 0;font-size:13px;color:#6b7280;width:40%;">Recruiter Name</td>
      <td style="padding:6px 0;font-size:14px;font-weight:700;">{recruiter_name}</td>
    </tr>
    <tr>
      <td style="padding:6px 0;font-size:13px;color:#6b7280;">Email</td>
      <td style="padding:6px 0;font-size:14px;">{recruiter_email}</td>
    </tr>
    <tr>
      <td style="padding:6px 0;font-size:13px;color:#6b7280;">Requesting to join</td>
      <td style="padding:6px 0;font-size:14px;font-weight:700;color:{ACCENT_COLOR};">{company_name}</td>
    </tr>
  </table>
</div>

<p style="font-size:14px;color:#374151;margin-bottom:20px;">
  Click a button below to approve or reject this request. These links are valid for <strong>72 hours</strong>.
</p>

<div style="text-align:center;margin:24px 0;">
  <a href="{approve_url}" class="btn btn-approve" style="background:{SUCCESS_COLOR};color:#ffffff;display:inline-block;padding:14px 32px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;margin:8px 4px;">✅ Approve Request</a>
  <a href="{reject_url}" class="btn btn-reject" style="background:{DANGER_COLOR};color:#ffffff;display:inline-block;padding:14px 32px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;margin:8px 4px;">❌ Reject Request</a>
</div>

<p style="font-size:12px;color:#9ca3af;text-align:center;">
  You can also manage all requests from your
  <a href="{dashboard_url}" style="color:{ACCENT_COLOR};">Company Dashboard</a>.
</p>
"""
    text = (
        f"Hi {owner_name},\n\n"
        f"{recruiter_name} ({recruiter_email}) has requested to join {company_name} on Rekshift.\n\n"
        f"Approve: {approve_url}\n\n"
        f"Reject: {reject_url}\n\n"
        f"Links valid for 72 hours.\n\n"
        f"--- Rekshift Team"
    )
    return subject, _base_wrapper(content, preheader=preheader), text


# ── Template 2: Approval Confirmation to Recruiter ───────────────────────────

def approval_confirmation_email(
    *,
    recruiter_name: str,
    company_name: str,
    credits_allocated: int,
    seat_number: Optional[int] = None,
    dashboard_url: str,
) -> tuple[str, str, str]:
    subject = f"[Rekshift] You've been approved to join {company_name} 🎉"
    preheader = f"Your request to join {company_name} has been approved."

    seat_str = f"Seat #{seat_number}" if seat_number else "a recruiter seat"
    content = f"""
<h2 style="margin:0 0 8px;font-size:22px;font-weight:800;">Welcome to {company_name}! 🎉</h2>
<p style="color:#6b7280;margin:0 0 24px;font-size:15px;">Hi {recruiter_name}, your request to join has been approved.</p>

<div class="notice" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0;font-size:13px;color:#166534;">
  ✅ You have been assigned <strong>{seat_str}</strong> at <strong>{company_name}</strong>.
</div>

<div style="display:flex;gap:16px;margin:20px 0;flex-wrap:wrap;">
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;flex:1;min-width:100px;text-align:center;">
    <div style="font-size:28px;font-weight:800;color:{ACCENT_COLOR};">{credits_allocated}</div>
    <div style="font-size:11px;color:#6b7280;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px;">Credits Allocated</div>
  </div>
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;flex:1;min-width:100px;text-align:center;">
    <div style="font-size:28px;font-weight:800;color:{SUCCESS_COLOR};">{credits_allocated}</div>
    <div style="font-size:11px;color:#6b7280;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px;">Credits Available</div>
  </div>
</div>

<p style="font-size:14px;color:#374151;">
  You can now start adding candidates and running assessments using your allocated credits.
  Your company dashboard is ready.
</p>

<div style="text-align:center;margin:28px 0;">
  <a href="{dashboard_url}" style="background:{ACCENT_COLOR};color:#ffffff;display:inline-block;padding:14px 40px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;">Go to Dashboard →</a>
</div>
"""
    text = (
        f"Hi {recruiter_name},\n\n"
        f"You've been approved to join {company_name} on Rekshift.\n"
        f"Credits allocated: {credits_allocated}\n\n"
        f"Go to your dashboard: {dashboard_url}\n\n"
        f"--- Rekshift Team"
    )
    return subject, _base_wrapper(content, preheader=preheader), text


# ── Template 3: Rejection to Recruiter ───────────────────────────────────────

def rejection_email(
    *,
    recruiter_name: str,
    company_name: str,
    dashboard_url: str,
) -> tuple[str, str, str]:
    subject = f"[Rekshift] Update on your request to join {company_name}"
    preheader = f"Your request to join {company_name} was not approved."

    content = f"""
<h2 style="margin:0 0 8px;font-size:22px;font-weight:800;">Request Update</h2>
<p style="color:#6b7280;margin:0 0 24px;font-size:15px;">Hi {recruiter_name}, we have an update on your join request.</p>

<div class="warning" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin:20px 0;font-size:14px;color:#9a3412;">
  Your request to join <strong>{company_name}</strong> was not approved at this time.
</div>

<p style="font-size:14px;color:#374151;">
  If you believe this was an error, please reach out directly to the company owner or
  contact our support team at <a href="mailto:{SUPPORT_EMAIL}" style="color:{ACCENT_COLOR};">{SUPPORT_EMAIL}</a>.
</p>
<p style="font-size:14px;color:#374151;">
  You can continue using Rekshift independently with your own plan.
</p>

<div style="text-align:center;margin:28px 0;">
  <a href="{dashboard_url}" style="background:{ACCENT_COLOR};color:#ffffff;display:inline-block;padding:14px 40px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;">Go to Dashboard</a>
</div>
"""
    text = (
        f"Hi {recruiter_name},\n\n"
        f"Your request to join {company_name} was not approved at this time.\n\n"
        f"Contact support: {SUPPORT_EMAIL}\n\n"
        f"--- Rekshift Team"
    )
    return subject, _base_wrapper(content, preheader=preheader), text


# ── Template 4: Invite Recruiter to Company ──────────────────────────────────

def invite_recruiter_email(
    *,
    company_name: str,
    signup_url: str,
) -> tuple[str, str, str]:
    subject = f"[Rekshift] You've been invited to join {company_name}"
    preheader = f"You have been invited to join {company_name} on Rekshift."

    content = f"""
<h2 style="margin:0 0 8px;font-size:22px;font-weight:800;">You're Invited! 💌</h2>
<p style="color:#6b7280;margin:0 0 24px;font-size:15px;">You have been invited to join <strong>{company_name}</strong> on Rekshift.</p>

<div class="notice" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0;font-size:14px;color:#166534;">
  To accept this invitation, please sign up or log in, and search for <strong>{company_name}</strong> during onboarding or from your dashboard to request to join.
</div>

<div style="text-align:center;margin:28px 0;">
  <a href="{signup_url}" style="background:{ACCENT_COLOR};color:#ffffff;display:inline-block;padding:14px 40px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;">Sign Up / Log In →</a>
</div>

<p style="font-size:12px;color:#9ca3af;text-align:center;">
  If you believe this was sent in error, you can safely ignore this email.
</p>
"""
    text = (
        f"Hi,\n\n"
        f"You have been invited to join {company_name} on Rekshift.\n\n"
        f"Please sign up or log in, and search for {company_name} to request to join.\n\n"
        f"Sign Up / Log In: {signup_url}\n\n"
        f"--- Rekshift Team"
    )
    return subject, _base_wrapper(content, preheader=preheader), text

