/**
 * Offer letter PDF generation, JWT token signing/verification,
 * and offer-related email templates.
 * Extracted verbatim from api/[...path].ts — lines 668-936.
 */
import * as jose from 'jose';
import crypto from 'node:crypto';

// ── Email sender (internal) ───────────────────────────────────────────────────

async function sendEmailRaw(to: string, subject: string, html: string, attachments?: any[]) {
  const k = process.env.RESEND_API_KEY;
  if (!k) { console.warn('RESEND_API_KEY missing, skipping email'); return; }

  const payload: any = { from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev', to, subject, html };
  if (attachments) payload.attachments = attachments;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Email failed: ${await r.text()}`);
}

// ── Offer token management ────────────────────────────────────────────────────

function getOfferTokenSecret(): string {
  const secret =
    process.env.OFFER_TOKEN_SECRET ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('Offer token signing secret is not configured');
  return secret;
}

export async function signOfferToken(candidateId: string, jobId: string): Promise<string> {
  const secret = getOfferTokenSecret();
  const key = new TextEncoder().encode(secret);
  return await new jose.SignJWT({
    candidate_id: candidateId,
    job_id: jobId,
    jti: crypto.randomUUID(),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(key);
}

export async function verifyOfferToken(token: string): Promise<{ candidate_id: string; job_id: string }> {
  const secret = getOfferTokenSecret();
  const key = new TextEncoder().encode(secret);
  const { payload } = await jose.jwtVerify(token, key, { algorithms: ['HS256'] });
  const candidateId = String(payload.candidate_id || '');
  const jobId = String(payload.job_id || '');
  if (!candidateId || !jobId) {
    throw new Error('Invalid token payload');
  }
  return { candidate_id: candidateId, job_id: jobId };
}

// ── PDF generation ────────────────────────────────────────────────────────────

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

export function buildOfferLetterPdf(params: {
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  companyName: string;
  ctc: string;
  startDate?: string | null;
  reportingManager?: string | null;
  location?: string | null;
  contractYears?: number | null;
  contractMonths?: number | null;
}): Buffer {
  const lines: string[] = [
    params.companyName,
    'OFFER OF EMPLOYMENT',
    `Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
    '',
    `Dear ${params.candidateName},`,
    `We are delighted to offer you the position of ${params.jobTitle}.`,
    '',
    'Employment Details',
    `- Position: ${params.jobTitle}`,
    `- Employment Type: Full-Time, Permanent`,
    `- Annual CTC: ${params.ctc}`,
    `- Proposed Start Date: ${params.startDate || 'To be communicated'}`,
    `- Reporting Manager: ${params.reportingManager || 'To be communicated'}`,
    `- Location: ${params.location || 'As agreed'}`,
  ];

  if ((params.contractYears || 0) > 0 || (params.contractMonths || 0) > 0) {
    const duration: string[] = [];
    if ((params.contractYears || 0) > 0) duration.push(`${params.contractYears} year(s)`);
    if ((params.contractMonths || 0) > 0) duration.push(`${params.contractMonths} month(s)`);
    lines.push(`- Contract Duration: ${duration.join(' & ')}`);
  }

  lines.push(
    '',
    'Important Terms',
    '- This offer is contingent on successful background verification.',
    '- Please click the Accept Offer button in the email within 7 business days.',
    '- Your digital signature submission confirms formal acceptance.',
    '',
    `Confidential: Intended only for ${params.candidateName} (${params.candidateEmail}).`
  );

  const contentLines = lines.map((line, idx) => {
    const y = 800 - idx * 18;
    return `BT /F1 11 Tf 50 ${y} Td (${escapePdfText(line)}) Tj ET`;
  });

  const contentStream = contentLines.join('\n');
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${Buffer.byteLength(contentStream, 'utf8')} >> stream\n${contentStream}\nendstream endobj`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${obj}\n`;
  }
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, 'utf8');
}

// ── Email templates ───────────────────────────────────────────────────────────

export async function sendAcceptanceEmail(to: string, name: string, job: string) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offer Letter</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);padding:40px 48px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">Congratulations!</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:15px;">You have been selected</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:48px;">
          <p style="margin:0 0 20px;font-size:16px;color:#374151;">Dear <strong>${name}</strong>,</p>
          <p style="margin:0 0 20px;font-size:15px;color:#4B5563;line-height:1.7;">
            We are thrilled to inform you that after a thorough evaluation of your application, technical assessment, and interview performance, you have been <strong style="color:#059669;">selected</strong> for the position of:
          </p>
          <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:20px 24px;margin:0 0 28px;text-align:center;">
            <p style="margin:0;font-size:20px;font-weight:700;color:#065F46;">${job}</p>
          </div>
          <p style="margin:0 0 20px;font-size:15px;color:#4B5563;line-height:1.7;">
            Our HR team will be reaching out to you shortly with the formal offer letter, onboarding details, and next steps. Please keep an eye on your inbox.
          </p>
          <p style="margin:0 0 32px;font-size:15px;color:#4B5563;line-height:1.7;">
            We look forward to welcoming you to the team and are excited about the contributions you will bring.
          </p>
          <div style="border-top:1px solid #E5E7EB;padding-top:28px;">
            <p style="margin:0;font-size:14px;color:#6B7280;line-height:1.6;">
              If you have any questions in the meantime, please do not hesitate to reach out to our HR department.
            </p>
          </div>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#F9FAFB;padding:24px 48px;text-align:center;border-top:1px solid #E5E7EB;">
          <p style="margin:0;font-size:13px;color:#9CA3AF;">This email was sent by Hire.AI &mdash; Intelligent Hiring Platform</p>
          <p style="margin:4px 0 0;font-size:13px;color:#9CA3AF;">&copy; ${new Date().getFullYear()} Hire.AI. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  await sendEmailRaw(to, `Congratulations! You've been selected — ${job}`, html);
}

export async function sendRejectionEmail(to: string, name: string, job: string) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Application Update</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1F2937 0%,#374151 100%);padding:40px 48px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">Application Update</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.7);font-size:15px;">Regarding your application at Hire.AI</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:48px;">
          <p style="margin:0 0 20px;font-size:16px;color:#374151;">Dear <strong>${name}</strong>,</p>
          <p style="margin:0 0 20px;font-size:15px;color:#4B5563;line-height:1.7;">
            Thank you for taking the time to apply for the position of <strong>${job}</strong> and for the effort you invested throughout our hiring process.
          </p>
          <p style="margin:0 0 20px;font-size:15px;color:#4B5563;line-height:1.7;">
            After careful consideration of all candidates, we regret to inform you that we will not be moving forward with your application at this time. This was a highly competitive process, and the decision was not easy.
          </p>
          <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:8px;padding:20px 24px;margin:0 0 28px;">
            <p style="margin:0;font-size:14px;color:#92400E;line-height:1.6;">
              <strong>Please note:</strong> This decision does not reflect negatively on your skills or potential. We encourage you to continue pursuing opportunities that align with your experience and goals.
            </p>
          </div>
          <p style="margin:0 0 32px;font-size:15px;color:#4B5563;line-height:1.7;">
            We genuinely appreciate your interest in our organisation and wish you every success in your career journey ahead.
          </p>
          <div style="border-top:1px solid #E5E7EB;padding-top:28px;">
            <p style="margin:0;font-size:14px;color:#6B7280;line-height:1.6;">
              Thank you once again for your time and interest. We hope our paths cross again in the future.
            </p>
          </div>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#F9FAFB;padding:24px 48px;text-align:center;border-top:1px solid #E5E7EB;">
          <p style="margin:0;font-size:13px;color:#9CA3AF;">This email was sent by Hire.AI &mdash; Intelligent Hiring Platform</p>
          <p style="margin:4px 0 0;font-size:13px;color:#9CA3AF;">&copy; ${new Date().getFullYear()} Hire.AI. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  await sendEmailRaw(to, `Update on your application — ${job}`, html);
}

export async function sendOfferLetterEmail(
  to: string,
  candidateName: string,
  jobTitle: string,
  companyName: string,
  pdfBase64: string,
  acceptanceLink: string
) {
  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; border-radius: 8px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 32px 40px;">
          <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">${companyName}</h1>
          <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0 0; font-size: 14px;">Talent Acquisition Team</p>
      </div>
      <div style="padding: 32px 40px;">
          <h2 style="color: #1a1a2e; margin-top: 0;">🎉 Congratulations, ${candidateName}!</h2>
          <p style="color: #444; line-height: 1.6;">
              We are delighted to extend a formal offer of employment to you for the position of
              <strong>${jobTitle}</strong> at <strong>${companyName}</strong>.
          </p>
          <p style="color: #444; line-height: 1.6;">
              Please find your <strong>Offer Letter</strong> attached to this email as a PDF document.
          </p>
          <div style="background: #f0f4ff; border-left: 4px solid #6366f1; padding: 16px 20px; border-radius: 4px; margin: 24px 0;">
              <p style="margin: 0; color: #4f46e5; font-weight: 600;">📋 Next Steps</p>
              <ul style="margin: 10px 0 0 0; padding-left: 18px; color: #444; line-height: 1.8;">
                  <li>Review the attached offer letter carefully</li>
                  <li>Click the <strong>Accept Offer</strong> button below</li>
                  <li>Enter your full legal name as your digital signature</li>
              </ul>
          </div>
          <div style="text-align: center; margin: 28px 0;">
              <a href="${acceptanceLink}" style="background:#10b981;color:white;padding:14px 26px;text-decoration:none;border-radius:8px;font-size:16px;font-weight:700;display:inline-block;">
                  Accept Offer
              </a>
          </div>
          <p style="color:#6b7280; font-size: 12px; line-height:1.5; margin-top: 8px;">
              This secure link expires in 7 business days.
          </p>
          <p style="color: #444; margin-bottom: 0;">
              Warm regards,<br/>
              <strong>Talent Acquisition Team</strong><br/>
              ${companyName}
          </p>
      </div>
  </div>`;

  const attachments = [
    {
      filename: `Offer_Letter_${candidateName.replace(/\s+/g, '_')}.pdf`,
      content: pdfBase64,
      content_type: 'application/pdf',
    }
  ];

  await sendEmailRaw(to, `Formal Offer Letter – ${jobTitle} at ${companyName}`, html, attachments);
}

export async function sendAssessmentInvite(to: string, name: string, job: string, link: string, deadline: string) {
  const html = `<!DOCTYPE html><html><body>
    <h2>Technical Assessment Invitation</h2>
    <p>Dear ${name},</p>
    <p>You have been invited to take a technical assessment for the position of <strong>${job}</strong>.</p>
    <p>Please complete the assessment before: <strong>${deadline}</strong></p>
    <p><a href="${link}" style="padding:10px 20px;background:#4F46E5;color:white;text-decoration:none;border-radius:5px;">Start Assessment</a></p>
    <p>Good luck!</p>
  </body></html>`;
  await sendEmailRaw(to, `Technical Assessment Invitation — ${job}`, html);
}

export async function sendInterviewInvite(to: string, name: string, job: string, link: string, time: string) {
  const html = `<!DOCTYPE html><html><body>
    <h2>AI Interview Invitation</h2>
    <p>Dear ${name},</p>
    <p>You have been invited to an AI-guided interview for the position of <strong>${job}</strong>.</p>
    ${time ? `<p>Scheduled for: <strong>${time}</strong></p>` : ''}
    <p><a href="${link}" style="padding:10px 20px;background:#4F46E5;color:white;text-decoration:none;border-radius:5px;">Join Interview</a></p>
    <p>Best regards,</p>
  </body></html>`;
  await sendEmailRaw(to, `AI Interview Invitation — ${job}`, html);
}

export async function sendApplicationReceived(to: string, name: string, job: string) {
  const html = `<!DOCTYPE html><html><body>
    <h2>Application Received</h2>
    <p>Dear ${name},</p>
    <p>We have successfully received your application for the position of <strong>${job}</strong>.</p>
    <p>Our team will review your profile and get back to you soon.</p>
    <p>Thank you for your interest!</p>
  </body></html>`;
  await sendEmailRaw(to, `Application Received — ${job}`, html);
}
