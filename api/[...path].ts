import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Groq from 'groq-sdk';
import * as jose from 'jose';
import crypto from 'node:crypto';
import Busboy from 'busboy';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

// ============== INLINE: Supabase ==============
let _supabaseAdmin: SupabaseClient | null = null;
function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      const m: string[] = [];
      if (!url) m.push('SUPABASE_URL');
      if (!key) m.push('SUPABASE_SERVICE_KEY');
      throw new Error(`Missing env vars: ${m.join(', ')}. Set in Vercel project settings.`);
    }
    _supabaseAdmin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  }
  return _supabaseAdmin;
}

// ============== INLINE: Clerk ==============
interface ClerkUser { id: string; sessionId: string; azp: string; email?: string | null; }
let _jwks: jose.JWTVerifyGetKey | null = null;
let _jwksTime = 0;
async function getJWKS(): Promise<jose.JWTVerifyGetKey> {
  if (_jwks && Date.now() - _jwksTime < 3600000) return _jwks;
  const url = process.env.CLERK_JWKS_URL;
  if (!url) throw new Error('CLERK_JWKS_URL not configured');
  _jwks = jose.createRemoteJWKSet(new URL(url));
  _jwksTime = Date.now();
  return _jwks;
}
async function verifyClerkToken(req: VercelRequest): Promise<ClerkUser> {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) throw new Error('Missing authorization header');
  const jwks = await getJWKS();
  const { payload } = await jose.jwtVerify(h.substring(7), jwks, { issuer: process.env.CLERK_ISSUER });
  const email = (payload.email as string) || (payload.email_address as string) || (payload.primary_email_address as string) || null;
  return { id: payload.sub as string, sessionId: payload.sid as string, azp: payload.azp as string, email };
}
async function getOptionalUser(req: VercelRequest): Promise<ClerkUser | null> {
  try { return await verifyClerkToken(req); } catch { return null; }
}

// ============== INLINE: multipart + resume parsing ==============
async function parseMultipartSingleFile(
  req: VercelRequest,
  fieldName: string,
): Promise<{ filename: string; mimeType: string; buffer: Buffer } | null> {
  return await new Promise((resolve, reject) => {
    try {
      const bb = Busboy({ headers: req.headers as Record<string, string> });
      let done = false;

      let out: { filename: string; mimeType: string; buffer: Buffer } | null = null;

      bb.on('file', (name: string, file: NodeJS.ReadableStream, info: { filename: string; mimeType: string }) => {
        if (name !== fieldName) {
          file.resume();
          return;
        }

        const chunks: Buffer[] = [];
        file.on('data', (d: Buffer) => chunks.push(Buffer.from(d)));
        file.on('limit', () => {
          // If limits are set (we don't currently), treat it as error
        });
        file.on('end', () => {
          out = {
            filename: info.filename || 'resume',
            mimeType: info.mimeType || 'application/octet-stream',
            buffer: Buffer.concat(chunks),
          };
        });
      });

      bb.on('error', (err: Error) => {
        if (done) return;
        done = true;
        reject(err);
      });

      bb.on('finish', () => {
        if (done) return;
        done = true;
        resolve(out);
      });

      req.pipe(bb);
    } catch (e) {
      reject(e);
    }
  });
}

async function extractResumeText(fileBuffer: Buffer, filename: string): Promise<string> {
  const lower = (filename || '').toLowerCase();

  // pdf
  if (lower.endsWith('.pdf')) {
    const parsed = await pdfParse(fileBuffer);
    return String(parsed.text || '');
  }

  // docx
  if (lower.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return String(result.value || '');
  }

  // doc: not reliably parseable without heavier tooling; fail fast
  if (lower.endsWith('.doc')) {
    throw new Error('Unsupported resume format .doc. Please upload PDF or DOCX.');
  }

  throw new Error('Unsupported resume format. Please upload PDF or DOCX.');
}

function mapAssessmentDifficulty(difficulty: string): { label: string; guidance: string } {
  const d = String(difficulty || '').toLowerCase();

  if (d === 'easy') {
    return {
      label: 'Medium-to-Hard',
      guidance: 'Target difficulty: medium-to-hard. Avoid trivial questions. Include real-world pitfalls and at least a few advanced edge cases.'
    };
  }

  if (d === 'medium') {
    return {
      label: 'Very Hard',
      guidance: 'Target difficulty: very hard. Include advanced concepts, tricky edge cases, and tradeoffs. Questions should require deep reasoning.'
    };
  }

  if (d === 'hard') {
    return {
      label: 'FAANG-Level (Very, Very Hard)',
      guidance: 'Target difficulty: very, very hard (FAANG-level). Expect senior-level depth, nuanced constraints, and multiple failure modes. Prioritize high-signal questions.'
    };
  }

  return {
    label: 'Very Hard',
    guidance: 'Target difficulty: very hard. Include advanced concepts, tricky edge cases, and tradeoffs. Questions should require deep reasoning.'
  };
}

// ============== INLINE: AssemblyAI ==============
async function transcribeWithAssemblyAI(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) throw new Error('ASSEMBLYAI_API_KEY is not configured in Vercel environment variables.');

  // 1. Upload audio
  const uploadResp = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: { authorization: apiKey, 'content-type': 'application/octet-stream' },
    body: audioBuffer as unknown as any,
  });
  if (!uploadResp.ok) {
    const errText = await uploadResp.text();
    throw new Error(`AssemblyAI upload failed (${uploadResp.status}): ${errText}`);
  }
  const { upload_url } = await uploadResp.json() as { upload_url: string };
  if (!upload_url) throw new Error('AssemblyAI upload failed: missing upload_url');

  // 2. Create transcript
  const transcriptResp = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: { authorization: apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ audio_url: upload_url, speech_models: ['universal-3-pro', 'universal-2'], language_detection: true }),
  });
  if (!transcriptResp.ok) {
    const errText = await transcriptResp.text();
    throw new Error(`AssemblyAI transcript create failed (${transcriptResp.status}): ${errText}`);
  }
  const { id: transcriptId } = await transcriptResp.json() as { id: string };
  if (!transcriptId) throw new Error('AssemblyAI transcript create failed: missing id');

  // 3. Poll until complete (max 120s)
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const pollResp = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
      headers: { authorization: apiKey },
    });
    if (!pollResp.ok) {
      const errText = await pollResp.text();
      throw new Error(`AssemblyAI poll failed (${pollResp.status}): ${errText}`);
    }
    const pollData = await pollResp.json() as { status: string; text?: string; error?: string };
    if (pollData.status === 'completed') return pollData.text || '';
    if (pollData.status === 'error') throw new Error(`AssemblyAI transcription error: ${pollData.error}`);
  }
  throw new Error('AssemblyAI transcription timed out after 120 seconds');
}

// ============== INLINE: Groq ==============
let _groq: Groq | null = null;
function getGroqClient(): Groq {
  if (!_groq) {
    const k = process.env.GROQ_API_KEY;
    if (!k) throw new Error('GROQ_API_KEY not configured');
    _groq = new Groq({ apiKey: k });
  }
  return _groq;
}
async function generateText(prompt: string, opts: { temperature?: number; maxTokens?: number } = {}): Promise<string> {
  const client = getGroqClient();
  const completion = await client.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: prompt }],
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 2048,
  });
  return completion.choices[0]?.message?.content || '';
}
async function generateJSON<T>(prompt: string): Promise<T> {
  const client = getGroqClient();
  // Use Groq's native JSON mode for reliable JSON output
  const completion = await client.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: 'You are a helpful assistant that ONLY responds with valid JSON. No markdown, no code blocks, no explanation - just the JSON object or array.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 8192,
    response_format: { type: 'json_object' },
  });
  const text = (completion.choices[0]?.message?.content || '').trim();
  if (!text) throw new Error('Empty AI response');
  try { return JSON.parse(text) as T; }
  catch (e) {
    // Fallback: try to extract JSON from response
    let jsonStr = text;
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();
    const arrayMatch = jsonStr.match(/\[\s*\{[\s\S]*\}\s*\]/);
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (arrayMatch) jsonStr = arrayMatch[0];
    else if (objectMatch && !jsonStr.startsWith('[')) jsonStr = objectMatch[0];
    try { return JSON.parse(jsonStr) as T; }
    catch (e2) {
      console.error('JSON parse error. Raw text:', text.slice(0, 500));
      throw new Error('Failed to parse AI response as JSON');
    }
  }
}

// ============== INLINE: Email ==============
async function sendEmail(to: string, subject: string, html: string) {
  const k = process.env.RESEND_API_KEY;
  if (!k) { console.warn('RESEND_API_KEY missing, skipping email'); return; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev', to, subject, html }),
  });
  if (!r.ok) throw new Error(`Email failed: ${await r.text()}`);
}
async function sendApplicationReceived(to: string, name: string, job: string) {
  await sendEmail(to, `Application Received - ${job}`,
    `<h2>Thank you, ${name}!</h2><p>We received your application for <strong>${job}</strong>.</p><p>We'll review and get back to you soon.</p>`);
}
async function sendAssessmentInvite(to: string, name: string, job: string, link: string, deadline: string) {
  await sendEmail(to, `Assessment Invitation - ${job}`,
    `<h2>Congratulations, ${name}!</h2><p>You've been shortlisted for <strong>${job}</strong>.</p><p><a href="${link}" style="background:#4F46E5;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Start Assessment</a></p><p><strong>Deadline:</strong> ${deadline}</p>`);
}
async function sendInterviewInvite(to: string, name: string, job: string, link: string, time?: string) {
  await sendEmail(to, `AI Interview Invitation - ${job}`,
    `<h2>Great news, ${name}!</h2><p>You've been invited to an AI interview for <strong>${job}</strong>.</p><p><a href="${link}" style="background:#4F46E5;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Start Interview</a></p>${time ? `<p><strong>Scheduled:</strong> ${time}</p>` : ''}`);
}

async function sendAcceptanceEmail(to: string, name: string, job: string) {
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
  await sendEmail(to, `Congratulations! You've been selected — ${job}`, html);
}

async function sendRejectionEmail(to: string, name: string, job: string) {
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
  await sendEmail(to, `Update on your application — ${job}`, html);
}

// ============== Helpers ==============
function uuidv4(): string { return crypto.randomUUID(); }

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function ok(res: VercelResponse, body: unknown, status = 200) {
  return res.status(status).json(body);
}

function badRequest(res: VercelResponse, message: string) {
  return res.status(400).json({ error: message });
}

function notFound(res: VercelResponse, message = 'Not found') {
  return res.status(404).json({ error: message });
}

function methodNotAllowed(res: VercelResponse) {
  return res.status(405).json({ error: 'Method not allowed' });
}

async function requireAuth(req: VercelRequest, res: VercelResponse) {
  try {
    return await verifyClerkToken(req);
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
}

// ============== Plan Limits ==============
const PLAN_LIMITS: Record<string, { max_jobs: number; max_assessments: number; max_interviews: number; price: number; label: string }> = {
  free: { max_jobs: 2, max_assessments: 10, max_interviews: 10, price: 0, label: 'Free' },
  pro: { max_jobs: 15, max_assessments: 999999, max_interviews: 999999, price: 5000, label: 'Pro' },       // price in paise (₹50 = 5000)
  premium: { max_jobs: 999999, max_assessments: 999999, max_interviews: 999999, price: 7500, label: 'Premium' }, // ₹75 = 7500
};

function getPlanLimits(plan: string) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
}

async function getUserProfile(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
  return data;
}

// ============== Razorpay Helpers ==============
function getRazorpayAuth(): string {
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  return 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
}

async function createRazorpayOrder(amount: number, currency: string, receipt: string, notes: Record<string, string>) {
  const resp = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: getRazorpayAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, currency, receipt, notes }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Razorpay order creation failed: ${err}`);
  }
  return resp.json();
}

function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string): boolean {
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', keySecret).update(body).digest('hex');
  return expected === signature;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    return await routeRequest(req, res);
  } catch (err: any) {
    console.error('Unhandled API error:', err);
    return res.status(500).json({
      error: err.message || 'Internal server error',
      hint: 'Check Vercel function logs and environment variables.',
    });
  }
}

async function routeRequest(req: VercelRequest, res: VercelResponse) {
  // Parse path segments from URL (most reliable method)
  // req.url will be something like "/api/apply/job/123" or "/api/[...path]?path=apply&path=job&path=123"
  const urlPath = (req.url || '').split('?')[0].replace(/^\/api\//, '').replace(/^\[\.\.\.path\]/, '').replace(/\/$/, '');
  let segments: string[] = urlPath ? urlPath.split('/').filter(Boolean) : [];

  // If segments are empty, try query.path (Vercel catch-all populates this)
  if (segments.length === 0) {
    const pathParam = req.query.path;
    if (pathParam) {
      if (Array.isArray(pathParam)) {
        segments = pathParam;
      } else if (typeof pathParam === 'string') {
        // Could be "apply/job/123" or just "apply"
        segments = pathParam.split('/').filter(Boolean);
      }
    }
  }

  // /api/health
  if (segments.length === 1 && segments[0] === 'health') {
    if (req.method !== 'GET') return methodNotAllowed(res);

    // Check env vars availability
    const envStatus = {
      SUPABASE_URL: !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
      SUPABASE_SERVICE_KEY: !!(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
      CLERK_JWKS_URL: !!process.env.CLERK_JWKS_URL,
      CLERK_ISSUER: !!process.env.CLERK_ISSUER,
      GROQ_API_KEY: !!process.env.GROQ_API_KEY,
      RESEND_API_KEY: !!process.env.RESEND_API_KEY,
      FRONTEND_URL: !!process.env.FRONTEND_URL,
      HACKEREARTH_CLIENT_SECRET: !!process.env.HACKEREARTH_CLIENT_SECRET,
    };

    return ok(res, {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      env: envStatus,
    });
  }

  const supabase = getSupabaseAdmin();

  // /api/profile (authenticated)
  if (segments[0] === 'profile') {
    const user = await requireAuth(req, res);
    if (!user) return;

    // GET /api/profile
    if (req.method === 'GET' && segments.length === 1) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) return res.status(500).json({ error: error.message });
      if (!profile) {
        // Best-effort create minimal profile
        const { data: created, error: createErr } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            email: user.email || (req.headers['x-user-email'] as string) || 'unknown',
            full_name: null,
            avatar_url: null,
            onboarding_completed: false,
          })
          .select()
          .single();
        if (createErr) return res.status(500).json({ error: createErr.message });
        return ok(res, created);
      }

      return ok(res, profile);
    }

    // PATCH /api/profile
    if (req.method === 'PATCH' && segments.length === 1) {
      const body = req.body || {};
      const update: Record<string, any> = {
        organization_email: body.organization_email ?? body.organizationEmail ?? null,
        company_name: body.company_name ?? body.companyName ?? null,
        company_website: body.company_website ?? body.companyWebsite ?? null,
        company_size: body.company_size ?? body.companySize ?? null,
        industry: body.industry ?? null,
        headquarters_location: body.headquarters_location ?? body.headquartersLocation ?? null,
        hiring_regions: body.hiring_regions ?? body.hiringRegions ?? null,
        hiring_roles: body.hiring_roles ?? body.hiringRoles ?? null,
        preferred_timezone: body.preferred_timezone ?? body.preferredTimezone ?? null,
        contact_phone: body.contact_phone ?? body.contactPhone ?? null,
        onboarding_completed: body.onboarding_completed ?? body.onboardingCompleted ?? undefined,
        onboarding_completed_at: (body.onboarding_completed ?? body.onboardingCompleted) ? new Date().toISOString() : undefined,
        updated_at: new Date().toISOString(),
      };

      // Remove undefined keys
      Object.keys(update).forEach((k) => update[k] === undefined && delete update[k]);

      // Upsert profile row
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!existing) {
        const { data: created, error: createErr } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            email: body.email || user.email || (req.headers['x-user-email'] as string) || 'unknown',
            full_name: body.full_name ?? body.fullName ?? null,
            avatar_url: body.avatar_url ?? body.avatarUrl ?? null,
            ...update,
          })
          .select()
          .single();
        if (createErr) return res.status(500).json({ error: createErr.message });
        return ok(res, created);
      }

      const { data: updated, error: upErr } = await supabase
        .from('profiles')
        .update(update)
        .eq('user_id', user.id)
        .select()
        .single();

      if (upErr) return res.status(500).json({ error: upErr.message });
      return ok(res, updated);
    }

    return methodNotAllowed(res);
  }

  // /api/subscription
  if (segments[0] === 'subscription') {
    const user = await requireAuth(req, res);
    if (!user) return;

    // GET /api/subscription
    if (req.method === 'GET' && segments.length === 1) {
      const profile = await getUserProfile(supabase, user.id);
      if (!profile) return res.status(404).json({ error: 'Profile not found' });

      const plan = profile.subscription_plan || 'free';
      const limits = getPlanLimits(plan);

      return ok(res, {
        plan,
        status: profile.subscription_status || 'active',
        subscription_id: profile.subscription_id,
        plan_selected_at: profile.plan_selected_at,
        limits,
        usage: {
          jobs_count: profile.jobs_count || 0,
          assessments_count: profile.assessments_count || 0,
          interviews_count: profile.interviews_count || 0,
        },
      });
    }

    // POST /api/subscription/create-order
    if (req.method === 'POST' && segments.length === 2 && segments[1] === 'create-order') {
      const { plan } = req.body || {};
      if (!plan || !PLAN_LIMITS[plan]) return badRequest(res, 'Invalid plan');
      if (plan === 'free') return badRequest(res, 'Free plan does not require payment');

      const limits = getPlanLimits(plan);
      const receipt = `sub_${user.id.slice(0, 8)}_${Date.now()}`;

      try {
        const order = await createRazorpayOrder(limits.price, 'INR', receipt, {
          plan,
          user_id: user.id,
        });

        return ok(res, {
          order_id: order.id,
          amount: order.amount,
          currency: order.currency,
          key_id: process.env.RAZORPAY_KEY_ID,
          plan,
        });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    }

    // POST /api/subscription/verify
    if (req.method === 'POST' && segments.length === 2 && segments[1] === 'verify') {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body || {};

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !plan) {
        return badRequest(res, 'Missing payment verification fields');
      }

      const isValid = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
      if (!isValid) {
        return res.status(400).json({ error: 'Payment verification failed — invalid signature' });
      }

      // Activate the plan
      const { data: updated, error: upErr } = await supabase
        .from('profiles')
        .update({
          subscription_plan: plan,
          subscription_id: razorpay_order_id,
          razorpay_payment_id: razorpay_payment_id,
          subscription_status: 'active',
          plan_selected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (upErr) return res.status(500).json({ error: upErr.message });

      return ok(res, {
        success: true,
        plan,
        message: `${getPlanLimits(plan).label} plan activated successfully!`,
        profile: updated,
      });
    }

    // POST /api/subscription/select-free
    if (req.method === 'POST' && segments.length === 2 && segments[1] === 'select-free') {
      const { data: updated, error: upErr } = await supabase
        .from('profiles')
        .update({
          subscription_plan: 'free',
          subscription_status: 'active',
          plan_selected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (upErr) return res.status(500).json({ error: upErr.message });
      return ok(res, { success: true, plan: 'free', profile: updated });
    }

    return methodNotAllowed(res);
  }

  // /api/usage
  if (segments[0] === 'usage' && segments.length === 1) {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (req.method !== 'GET') return methodNotAllowed(res);

    const profile = await getUserProfile(supabase, user.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const plan = profile.subscription_plan || 'free';
    const limits = getPlanLimits(plan);

    return ok(res, {
      plan,
      plan_label: limits.label,
      usage: {
        jobs: { used: profile.jobs_count || 0, limit: limits.max_jobs, label: 'Job Roles' },
        assessments: { used: profile.assessments_count || 0, limit: limits.max_assessments, label: 'Technical Assessments' },
        interviews: { used: profile.interviews_count || 0, limit: limits.max_interviews, label: 'Interviews' },
      },
    });
  }

  // /api/dsa-problems - DSA Problem Bank Management
  if (segments[0] === 'dsa-problems') {
    if (segments.length === 1) {
      if (req.method === 'GET') {
        const user = await requireAuth(req, res);
        if (!user) return;

        const { difficulty, category, is_active } = req.query;
        let q = supabase.from('dsa_problems').select('id, slug, title, difficulty, category, tags, points, is_active, created_at');
        if (difficulty) q = q.eq('difficulty', difficulty);
        if (category) q = q.ilike('category', `%${category}%`);
        if (is_active !== 'false') q = q.eq('is_active', true);
        const { data, error } = await q.order('difficulty').order('category');
        if (error) return res.status(500).json({ error: error.message });
        return ok(res, data);
      }

      if (req.method === 'POST') {
        const user = await requireAuth(req, res);
        if (!user) return;

        const body = req.body;
        if (!body.slug || !body.title || !body.difficulty || !body.category || !body.description) {
          return badRequest(res, 'slug, title, difficulty, category, and description are required');
        }

        const { data, error } = await supabase.from('dsa_problems').insert({
          slug: body.slug,
          title: body.title,
          difficulty: body.difficulty,
          category: body.category,
          tags: body.tags || [],
          description: body.description,
          constraints: body.constraints || '',
          examples: body.examples || [],
          starter_code: body.starter_code || {},
          solution_wrappers: body.solution_wrappers || {},
          test_cases: body.test_cases || [],
          points: body.points || 100,
          time_limit_seconds: body.time_limit_seconds || 5,
          memory_limit_kb: body.memory_limit_kb || 262144,
        }).select().single();

        if (error) return res.status(500).json({ error: error.message });
        return ok(res, data, 201);
      }

      return methodNotAllowed(res);
    }

    if (segments.length === 2) {
      const problemId = segments[1];

      if (req.method === 'GET') {
        const user = await requireAuth(req, res);
        if (!user) return;

        const { data, error } = await supabase.from('dsa_problems').select('*').eq('id', problemId).single();
        if (error || !data) return notFound(res, 'Problem not found');
        return ok(res, data);
      }

      if (req.method === 'PATCH') {
        const user = await requireAuth(req, res);
        if (!user) return;

        const { data, error } = await supabase.from('dsa_problems')
          .update({ ...req.body, updated_at: new Date().toISOString() })
          .eq('id', problemId)
          .select().single();
        if (error) return res.status(500).json({ error: error.message });
        if (!data) return notFound(res, 'Problem not found');
        return ok(res, data);
      }

      if (req.method === 'DELETE') {
        const user = await requireAuth(req, res);
        if (!user) return;

        const { error } = await supabase.from('dsa_problems').update({ is_active: false }).eq('id', problemId);
        if (error) return res.status(500).json({ error: error.message });
        return ok(res, { success: true, message: 'Problem archived' });
      }

      return methodNotAllowed(res);
    }

    return notFound(res);
  }

  // /api/jobs and /api/jobs/:id
  if (segments[0] === 'jobs') {
    if (segments.length === 1) {
      if (req.method === 'GET') {
        const user = await requireAuth(req, res);
        if (!user) return;

        const { role, level, is_active } = req.query;
        let q = supabase.from('job_descriptions').select('*').eq('created_by', user.id);
        if (role) q = q.ilike('role', `%${role}%`);
        if (level) q = q.eq('level', level);
        if (is_active !== 'false') q = q.eq('is_active', true);
        const { data, error } = await q.order('created_at', { ascending: false });
        if (error) return res.status(500).json({ error: error.message });
        return ok(res, data);
      }

      if (req.method === 'POST') {
        const user = await requireAuth(req, res);
        if (!user) return;

        // ---- Usage Limit Check ----
        const profile = await getUserProfile(supabase, user.id);
        if (profile) {
          const plan = profile.subscription_plan || 'free';
          const limits = getPlanLimits(plan);
          const currentJobs = profile.jobs_count || 0;
          if (currentJobs >= limits.max_jobs) {
            return res.status(403).json({
              error: 'limit_exceeded',
              message: `You have reached the maximum of ${limits.max_jobs} job roles on the ${limits.label} plan. Please upgrade to create more.`,
              resource: 'jobs',
              current: currentJobs,
              limit: limits.max_jobs,
              plan,
            });
          }
        }

        const body = req.body;
        const jobData: Record<string, any> = {
          title: body.title,
          role: body.role,
          level: body.level,
          description: body.description,
          must_have_skills: body.must_have_skills || [],
          good_to_have_skills: body.good_to_have_skills || [],
          min_experience_years: body.min_experience_years || 0,
          is_active: true,
          created_by: user.id,
        };

        // Pre-generate interview question pool for this job (15 questions)
        try {
          const pool = await generateInterviewQuestionPool({
            title: body.title,
            role: body.role,
            level: body.level,
            must_have_skills: body.must_have_skills || [],
            description: body.description || '',
          });
          if (pool && pool.length > 0) {
            jobData.interview_question_pool = pool;
          }
        } catch (poolErr: any) {
          console.error('Failed to generate interview question pool (non-blocking):', poolErr.message);
        }

        const { data, error } = await supabase
          .from('job_descriptions')
          .insert(jobData)
          .select()
          .single();

        if (error) return res.status(500).json({ error: error.message });

        // Increment usage counter
        if (profile) {
          await supabase.from('profiles').update({
            jobs_count: (profile.jobs_count || 0) + 1,
            updated_at: new Date().toISOString(),
          }).eq('user_id', user.id);
        }

        return ok(res, data, 201);
      }

      return methodNotAllowed(res);
    }

    if (segments.length === 2) {
      const jobId = segments[1];

      if (req.method === 'GET') {
        const { data, error } = await supabase
          .from('job_descriptions')
          .select('*')
          .eq('id', jobId)
          .single();

        if (error || !data) return notFound(res, 'Job not found');
        return ok(res, data);
      }

      if (req.method === 'PATCH') {
        const user = await requireAuth(req, res);
        if (!user) return;

        const { data, error } = await supabase
          .from('job_descriptions')
          .update(req.body)
          .eq('id', jobId)
          .eq('created_by', user.id)
          .select()
          .single();

        if (error) return res.status(500).json({ error: error.message });
        if (!data) return notFound(res, 'Job not found');
        return ok(res, data);
      }

      if (req.method === 'DELETE') {
        const user = await requireAuth(req, res);
        if (!user) return;

        const { data, error } = await supabase
          .from('job_descriptions')
          .update({ is_active: false })
          .eq('id', jobId)
          .eq('created_by', user.id)
          .select()
          .single();

        if (error) return res.status(500).json({ error: error.message });
        if (!data) return notFound(res, 'Job not found');
        return ok(res, { success: true, message: 'Job archived successfully' });
      }

      return methodNotAllowed(res);
    }

    // POST /api/jobs/:jobId/regenerate-questions
    if (segments.length === 3 && segments[2] === 'regenerate-questions' && req.method === 'POST') {
      const user = await requireAuth(req, res);
      if (!user) return;

      const jobId = segments[1];
      const { data: job, error } = await supabase
        .from('job_descriptions')
        .select('*')
        .eq('id', jobId)
        .eq('created_by', user.id)
        .single();

      if (error || !job) return notFound(res, 'Job not found');

      try {
        const pool = await generateInterviewQuestionPool({
          title: job.title,
          role: job.role,
          level: job.level,
          must_have_skills: job.must_have_skills || [],
          description: job.description || '',
        });

        if (!pool.length) {
          return res.status(500).json({ error: 'Failed to generate questions. Please try again.' });
        }

        await supabase.from('job_descriptions').update({
          interview_question_pool: pool,
        }).eq('id', jobId);

        return ok(res, { success: true, questions_generated: pool.length, pool });
      } catch (e: any) {
        return res.status(500).json({ error: e.message || 'Failed to generate question pool' });
      }
    }

    return notFound(res);
  }

  // /api/candidates and /api/candidates/:id
  if (segments[0] === 'candidates') {
    if (segments.length === 1) {
      if (req.method === 'GET') {
        const user = await requireAuth(req, res);
        if (!user) return;

        const limit = parseInt((req.query.limit as string) || '50');
        const offset = parseInt((req.query.offset as string) || '0');
        const jobIdFilter = req.query.job_id as string | undefined;

        // Get this user's job IDs to scope candidates
        const { data: userJobs } = await supabase
          .from('job_descriptions')
          .select('id')
          .eq('created_by', user.id);

        const userJobIds = (userJobs || []).map((j: any) => j.id);
        if (userJobIds.length === 0) return ok(res, []);

        // Get candidate IDs who applied to this user's jobs
        let appQuery = supabase
          .from('job_applications')
          .select('candidate_id, job_id, status, applied_at')
          .in('job_id', userJobIds);

        if (jobIdFilter) appQuery = appQuery.eq('job_id', jobIdFilter);

        const { data: applications } = await appQuery
          .order('applied_at', { ascending: false })
          .limit(limit);

        const candidateIds = [...new Set((applications || []).map((a: any) => a.candidate_id))];
        if (candidateIds.length === 0) return ok(res, []);

        const { data, error } = await supabase
          .from('candidates')
          .select('id, full_name, email, phone, created_at, updated_at, consent_given, resume_url, resume_parsed_data')
          .in('id', candidateIds)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) return res.status(500).json({ error: error.message });

        // Build a map of candidate_id -> list of job_ids
        const jobMap: Record<string, string[]> = {};
        for (const app of (applications || [])) {
          const cid = app.candidate_id;
          if (!jobMap[cid]) jobMap[cid] = [];
          if (!jobMap[cid].includes(app.job_id)) {
            jobMap[cid].push(app.job_id);
          }
        }

        // Return one entry per (candidate, job) pair for proper job-based grouping
        const result: any[] = [];
        for (const c of (data || [])) {
          const appliedJobs = jobMap[c.id] || [];
          for (const jid of appliedJobs) {
            result.push({ ...c, job_id: jid });
          }
        }

        return ok(res, result);
      }

      if (req.method === 'POST') {
        const user = await requireAuth(req, res);
        if (!user) return;

        // JSON-only candidate creation
        const body = req.body || {};
        if (!body.full_name || !body.email) return badRequest(res, 'full_name and email are required');

        // Optional: ensure provided job belongs to current user
        const jobId = body.job_id ? String(body.job_id) : null;
        if (jobId) {
          const { data: job } = await supabase
            .from('job_descriptions')
            .select('id')
            .eq('id', jobId)
            .eq('created_by', user.id)
            .single();
          if (!job) return badRequest(res, 'Invalid job_id');
        }

        // Check if candidate with same email already exists
        const { data: existingCandidates } = await supabase
          .from('candidates')
          .select('*')
          .eq('email', body.email)
          .limit(1);

        let candidateRow: any;

        if (existingCandidates && existingCandidates.length > 0) {
          // Reuse existing candidate, update their info
          const existingId = existingCandidates[0].id;
          const updateData: Record<string, any> = {
            full_name: body.full_name,
            phone: body.phone || null,
            portfolio_url: body.portfolio_url || null,
            github_url: body.github_url || null,
            consent_given: !!body.consent_given,
            consent_timestamp: body.consent_given ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          };

          await supabase
            .from('candidates')
            .update(updateData)
            .eq('id', existingId);

          const { data: updated } = await supabase
            .from('candidates')
            .select('*')
            .eq('id', existingId)
            .single();

          candidateRow = updated || existingCandidates[0];
        } else {
          // Create new candidate
          const candidateData = {
            full_name: body.full_name,
            email: body.email,
            phone: body.phone || null,
            portfolio_url: body.portfolio_url || null,
            github_url: body.github_url || null,
            consent_given: !!body.consent_given,
            consent_timestamp: body.consent_given ? new Date().toISOString() : null,
            resume_url: body.resume_url || null,
            resume_text: body.resume_text || null,
            resume_parsed_data: body.resume_parsed_data || null,
          };

          const { data, error } = await supabase
            .from('candidates')
            .insert(candidateData)
            .select()
            .single();

          if (error) return res.status(500).json({ error: error.message });
          candidateRow = data;
        }

        // Create application mapping so user-scoped candidate lists include this candidate
        if (jobId) {
          // Check if already applied to this job
          const { data: existingApp } = await supabase
            .from('job_applications')
            .select('id')
            .eq('candidate_id', candidateRow.id)
            .eq('job_id', jobId)
            .limit(1);

          if (existingApp && existingApp.length > 0) {
            return badRequest(res, 'This candidate has already applied to this job');
          }

          const { error: appError } = await supabase
            .from('job_applications')
            .insert({
              job_id: jobId,
              candidate_id: candidateRow.id,
              status: 'applied',
              applied_at: new Date().toISOString(),
              screening_status: 'pending',
            });
          if (appError) {
            return res.status(500).json({ error: appError.message });
          }
        }

        return ok(res, { ...candidateRow, job_id: jobId }, 201);
      }

      return methodNotAllowed(res);
    }

    // POST /api/candidates/send-acceptance
    // NOTE: Must be handled before /api/candidates/:id route
    if (req.method === 'POST' && segments.length === 2 && segments[1] === 'send-acceptance') {
      const user = await requireAuth(req, res);
      if (!user) return;

      const { candidate_ids, job_id } = req.body as { candidate_ids?: string[]; job_id?: string };
      if (!candidate_ids?.length || !job_id) return badRequest(res, 'candidate_ids and job_id are required');

      const { data: job } = await supabase.from('job_descriptions').select('id, title').eq('id', job_id).eq('created_by', user.id).single();
      if (!job) return notFound(res, 'Job not found or access denied');

      const { data: candidates } = await supabase.from('candidates').select('id, email, full_name').in('id', candidate_ids);
      if (!candidates?.length) return notFound(res, 'No candidates found');

      let emailsSent = 0;
      const errorMessages: string[] = [];

      for (const c of candidates) {
        try {
          await sendAcceptanceEmail(c.email, c.full_name, job.title);
          emailsSent++;
        } catch (e: any) {
          errorMessages.push(`${c.full_name}: ${e.message}`);
        }
      }

      return ok(res, { success: emailsSent > 0, emails_sent: emailsSent, error_messages: errorMessages });
    }

    // POST /api/candidates/send-rejection
    // NOTE: Must be handled before /api/candidates/:id route
    if (req.method === 'POST' && segments.length === 2 && segments[1] === 'send-rejection') {
      const user = await requireAuth(req, res);
      if (!user) return;

      const { candidate_ids, job_id } = req.body as { candidate_ids?: string[]; job_id?: string };
      if (!candidate_ids?.length || !job_id) return badRequest(res, 'candidate_ids and job_id are required');

      const { data: job } = await supabase.from('job_descriptions').select('id, title').eq('id', job_id).eq('created_by', user.id).single();
      if (!job) return notFound(res, 'Job not found or access denied');

      const { data: candidates } = await supabase.from('candidates').select('id, email, full_name').in('id', candidate_ids);
      if (!candidates?.length) return notFound(res, 'No candidates found');

      let emailsSent = 0;
      const errorMessages: string[] = [];

      for (const c of candidates) {
        try {
          await sendRejectionEmail(c.email, c.full_name, job.title);
          emailsSent++;
        } catch (e: any) {
          errorMessages.push(`${c.full_name}: ${e.message}`);
        }
      }

      return ok(res, { success: emailsSent > 0, emails_sent: emailsSent, error_messages: errorMessages });
    }

    if (segments.length === 2) {
      const candidateId = segments[1];

      if (req.method === 'GET') {
        const user = await requireAuth(req, res);
        if (!user) return;

        const { data, error } = await supabase
          .from('candidates')
          .select('*')
          .eq('id', candidateId)
          .single();

        if (error || !data) return notFound(res, 'Candidate not found');
        return ok(res, data);
      }

      if (req.method === 'PATCH') {
        const user = await requireAuth(req, res);
        if (!user) return;

        const { data, error } = await supabase
          .from('candidates')
          .update(req.body)
          .eq('id', candidateId)
          .select()
          .single();

        if (error) return res.status(500).json({ error: error.message });
        if (!data) return notFound(res, 'Candidate not found');
        return ok(res, data);
      }

      if (req.method === 'DELETE') {
        const user = await requireAuth(req, res);
        if (!user) return;

        const { error } = await supabase.from('candidates').delete().eq('id', candidateId);
        if (error) return res.status(500).json({ error: error.message });
        return ok(res, { success: true, message: 'Candidate deleted successfully' });
      }

      return methodNotAllowed(res);
    }

    if (segments.length === 3 && segments[2] === 'parsed-resume') {
      const user = await requireAuth(req, res);
      if (!user) return;

      const candidateId = segments[1];
      if (req.method !== 'GET') return methodNotAllowed(res);

      const { data, error } = await supabase
        .from('candidates')
        .select('resume_parsed_data')
        .eq('id', candidateId)
        .single();

      if (error || !data) return notFound(res, 'Candidate not found');
      return ok(res, data.resume_parsed_data || null);
    }

    // POST /api/candidates/:id/upload-resume
    if (segments.length === 3 && segments[2] === 'upload-resume') {
      const user = await requireAuth(req, res);
      if (!user) return;

      const candidateId = segments[1];
      if (req.method !== 'POST') return methodNotAllowed(res);

      // Verify candidate exists
      const { data: existing, error: existErr } = await supabase
        .from('candidates')
        .select('id')
        .eq('id', candidateId)
        .single();
      if (existErr || !existing) return notFound(res, 'Candidate not found');

      try {
        const uploaded = await parseMultipartSingleFile(req, 'resume');
        if (!uploaded) return badRequest(res, 'Missing resume file');

        const resumeTextRaw = await extractResumeText(uploaded.buffer, uploaded.filename);
        const resumeText = String(resumeTextRaw)
          .replace(/\x00/g, '')
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
          .slice(0, 50000);

        // Parse with AI into structured JSON
        let resumeParsedData: any = null;
        try {
          const prompt = `You are an expert resume parser.

Parse the following resume and return ONLY valid JSON in this exact format:
{
  "skills": ["skill1"],
  "experience": [{"title":"","company":"","duration":"","description":""}],
  "education": [{"degree":"","institution":"","year":""}],
  "summary": "",
  "total_experience_years": 0,
  "certifications": ["cert1"]
}

RESUME TEXT:
${resumeText.slice(0, 8000)}
`;
          resumeParsedData = await generateJSON<any>(prompt);
        } catch {
          resumeParsedData = null;
        }

        const { data: updated, error: upErr } = await supabase
          .from('candidates')
          .update({
            resume_text: resumeText,
            resume_parsed_data: resumeParsedData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', candidateId)
          .select()
          .single();
        if (upErr) return res.status(500).json({ error: upErr.message });

        return ok(res, updated);
      } catch (e: any) {
        return res.status(400).json({ error: e?.message || 'Failed to upload/parse resume' });
      }
    }

    // GET /api/candidates/:id/assessment-details?job_id=xxx
    if (segments.length === 3 && segments[2] === 'assessment-details') {
      const user = await requireAuth(req, res);
      if (!user) return;

      const candidateId = segments[1];
      const jobIdFilter = req.query.job_id as string | undefined;
      if (req.method !== 'GET') return methodNotAllowed(res);

      // Get assessment sessions for this candidate, scoped by job if provided
      let q = supabase
        .from('assessment_sessions')
        .select('*')
        .eq('candidate_id', candidateId);
      if (jobIdFilter) q = q.eq('job_id', jobIdFilter);
      const { data: sessions } = await q.order('created_at', { ascending: false });

      if (!sessions?.length) return ok(res, null);

      // Return the most recent completed session
      const completedSession = sessions.find((s: any) => s.status === 'completed') || sessions[0];

      return ok(res, {
        session_id: completedSession.id,
        job_id: completedSession.job_id,
        status: completedSession.status,
        mcq_score: completedSession.mcq_score,
        coding_score: completedSession.coding_score,
        total_score: completedSession.total_score,
        mcq_submissions: completedSession.mcq_submissions || [],
        coding_submissions: completedSession.coding_submissions || [],
        mcq_questions: completedSession.mcq_questions || [],
        coding_challenges: completedSession.coding_challenges || [],
        proctoring_data: completedSession.proctoring_data || {},
        started_at: completedSession.started_at,
        completed_at: completedSession.completed_at,
      });
    }

    // GET /api/candidates/:id/interview-details?job_id=xxx
    if (segments.length === 3 && segments[2] === 'interview-details') {
      const user = await requireAuth(req, res);
      if (!user) return;

      const candidateId = segments[1];
      const jobIdFilter = req.query.job_id as string | undefined;
      if (req.method !== 'GET') return methodNotAllowed(res);

      // Get AI interview sessions for this candidate, scoped by job if provided
      let q = supabase
        .from('ai_interview_sessions')
        .select('*')
        .eq('candidate_id', candidateId);
      if (jobIdFilter) q = q.eq('job_id', jobIdFilter);
      const { data: sessions } = await q.order('created_at', { ascending: false });

      if (!sessions?.length) return ok(res, null);

      // Return the most recent completed session
      const completedSession = sessions.find((s: any) => s.status === 'completed') || sessions[0];

      return ok(res, {
        session_id: completedSession.id,
        job_id: completedSession.job_id,
        status: completedSession.status,
        questions: completedSession.questions || [],
        responses: completedSession.responses || [],
        final_evaluation: completedSession.final_evaluation || null,
        proctoring_data: completedSession.proctoring_data || {},
        started_at: completedSession.started_at,
        completed_at: completedSession.completed_at,
      });
    }

    return notFound(res);
  }

  // /api/screening/*
  if (segments[0] === 'screening') {
    // POST /api/screening/run
    if (segments.length === 2 && segments[1] === 'run') {
      const user = await requireAuth(req, res);
      if (!user) return;
      if (req.method !== 'POST') return methodNotAllowed(res);

      const { candidate_id, job_id } = req.body;
      if (!candidate_id || !job_id) return badRequest(res, 'candidate_id and job_id required');

      const { data: candidate } = await supabase
        .from('candidates')
        .select('*')
        .eq('id', candidate_id)
        .single();

      if (!candidate) return notFound(res, 'Candidate not found');
      if (!candidate.resume_parsed_data) return badRequest(res, 'Resume not parsed');

      const { data: job } = await supabase
        .from('job_descriptions')
        .select('*')
        .eq('id', job_id)
        .eq('created_by', user.id)
        .single();

      if (!job) return notFound(res, 'Job not found');

      const prompt = `
Analyze this candidate's resume against the job requirements and provide ATS screening scores.

Job: ${job.title} (${job.role}, ${job.level})
Required Skills: ${(job.must_have_skills || []).join(', ')}
Nice-to-have Skills: ${(job.good_to_have_skills || []).join(', ')}
Min Experience: ${job.min_experience_years} years

Candidate Resume JSON:
${JSON.stringify(candidate.resume_parsed_data)}

Return JSON:
{
  "overall_score": 0-100,
  "skill_relevance_score": 0-100,
  "experience_score": 0-100,
  "education_score": 0-100,
  "credibility_score": 0-100,
  "shortlisted": true/false,
  "shortlist_reason": "...",
  "reason_codes": [{"code":"SKILL_MATCH","type":"positive","description":"...","impact":10}]
}`;

      const result = await generateJSON<any>(prompt);
      const screeningData = {
        candidate_id,
        job_id,
        overall_score: result.overall_score,
        skill_relevance_score: result.skill_relevance_score ?? null,
        experience_score: result.experience_score ?? null,
        education_score: result.education_score ?? null,
        credibility_score: result.credibility_score ?? null,
        shortlisted: !!result.shortlisted,
        shortlist_reason: result.shortlist_reason ?? null,
        reason_codes: result.reason_codes ?? [],
        screened_at: new Date().toISOString(),
      };

      const { data: existing } = await supabase
        .from('ats_screenings')
        .select('id')
        .eq('candidate_id', candidate_id)
        .eq('job_id', job_id)
        .single();

      const saved = existing
        ? await supabase.from('ats_screenings').update(screeningData).eq('id', existing.id).select().single()
        : await supabase.from('ats_screenings').insert(screeningData).select().single();

      if (saved.error) return res.status(500).json({ error: saved.error.message });
      return ok(res, saved.data);
    }

    // GET /api/screening/candidate/:candidateId
    if (segments.length === 3 && segments[1] === 'candidate') {
      const user = await requireAuth(req, res);
      if (!user) return;
      if (req.method !== 'GET') return methodNotAllowed(res);

      const candidateId = segments[2];
      const { data, error } = await supabase
        .from('ats_screenings')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('screened_at', { ascending: false });

      if (error) return res.status(500).json({ error: error.message });
      return ok(res, data);
    }

    // GET /api/screening/job/:jobId
    if (segments.length === 3 && segments[1] === 'job') {
      const user = await requireAuth(req, res);
      if (!user) return;
      if (req.method !== 'GET') return methodNotAllowed(res);

      const jobId = segments[2];
      const shortlistedOnly = req.query.shortlisted_only === 'true';
      const minScore = req.query.min_score ? parseInt(req.query.min_score as string) : null;

      let q = supabase.from('ats_screenings').select('*').eq('job_id', jobId);
      if (shortlistedOnly) q = q.eq('shortlisted', true);
      if (minScore !== null && !Number.isNaN(minScore)) q = q.gte('overall_score', minScore);

      const { data, error } = await q.order('overall_score', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return ok(res, data);
    }

    // GET /api/screening/:id
    if (segments.length === 2) {
      const user = await requireAuth(req, res);
      if (!user) return;
      if (req.method !== 'GET') return methodNotAllowed(res);

      const id = segments[1];
      const { data, error } = await supabase.from('ats_screenings').select('*').eq('id', id).single();
      if (error || !data) return notFound(res, 'Screening not found');
      return ok(res, data);
    }

    return notFound(res);
  }

  // /api/analytics/*
  if (segments[0] === 'analytics') {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (req.method !== 'GET') return methodNotAllowed(res);

    // GET /api/analytics/dashboard
    if (segments.length === 2 && segments[1] === 'dashboard') {
      // Scope everything to this user's jobs
      const { data: userJobs } = await supabase
        .from('job_descriptions')
        .select('id')
        .eq('created_by', user.id);
      const userJobIds = (userJobs || []).map((j: any) => j.id);

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString();

      const [activeJobsRes, activeJobsLastWeekRes] = await Promise.all([
        supabase
          .from('job_descriptions')
          .select('id', { count: 'exact', head: true })
          .eq('created_by', user.id)
          .eq('is_active', true),
        supabase
          .from('job_descriptions')
          .select('id', { count: 'exact', head: true })
          .eq('created_by', user.id)
          .eq('is_active', true)
          .lt('created_at', weekAgoStr)
          .then(res => res)
          .catch(() => ({ count: 0 }))
      ]);

      const activeJobs = activeJobsRes.count || 0;
      const activeJobsLastWeek = activeJobsLastWeekRes.count || 0;
      const active_jobs_change = activeJobsLastWeek === 0 ? (activeJobs > 0 ? 100 : 0) : Math.round(((activeJobs - activeJobsLastWeek) / activeJobsLastWeek) * 100);

      let totalCandidates = 0;
      let total_candidates_change = 0;
      let pendingInterviews = 0;
      let pending_interviews_change = 0;
      let averageScore = 0;
      let shortlistRate = 0;
      let completedToday = 0;
      let completed_today_change = 0;

      if (userJobIds.length > 0) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);

        // Run independent queries concurrently
        const [
          candCountRes,
          candCountLastWeekRes,
          pendCountResWrapper,
          scoresRes,
          todayCountResWrapper,
          yesterdayCountResWrapper
        ] = await Promise.all([
          supabase
            .from('job_applications')
            .select('candidate_id', { count: 'exact', head: true })
            .in('job_id', userJobIds),

          supabase
            .from('job_applications')
            .select('candidate_id', { count: 'exact', head: true })
            .in('job_id', userJobIds)
            .lt('applied_at', weekAgoStr)
            .then(res => res)
            .catch(() => ({ count: 0 })),

          // Handle potential missing tables gracefully
          supabase
            .from('ai_interview_sessions')
            .select('id', { count: 'exact', head: true })
            .in('job_id', userJobIds)
            .eq('status', 'pending')
            .then(res => res)
            .catch(() => ({ count: 0 })),

          supabase
            .from('ats_screenings')
            .select('overall_score, shortlisted')
            .in('job_id', userJobIds),

          supabase
            .from('ai_interview_sessions')
            .select('id', { count: 'exact', head: true })
            .in('job_id', userJobIds)
            .eq('status', 'completed')
            .gte('completed_at', todayStart.toISOString())
            .then(res => res)
            .catch(() => ({ count: 0 })),

          supabase
            .from('ai_interview_sessions')
            .select('id', { count: 'exact', head: true })
            .in('job_id', userJobIds)
            .eq('status', 'completed')
            .gte('completed_at', yesterdayStart.toISOString())
            .lt('completed_at', todayStart.toISOString())
            .then(res => res)
            .catch(() => ({ count: 0 }))
        ]);

        totalCandidates = candCountRes.count || 0;
        const candLastWeek = candCountLastWeekRes.count || 0;
        total_candidates_change = candLastWeek === 0 ? (totalCandidates > 0 ? 100 : 0) : Math.round(((totalCandidates - candLastWeek) / candLastWeek) * 100);

        pendingInterviews = pendCountResWrapper.count || 0;
        pending_interviews_change = 0; // Approximated without deep history

        completedToday = todayCountResWrapper.count || 0;
        const completedYesterday = yesterdayCountResWrapper.count || 0;
        completed_today_change = completedYesterday === 0 ? (completedToday > 0 ? 100 : 0) : Math.round(((completedToday - completedYesterday) / completedYesterday) * 100);

        const scores = scoresRes.data;
        const validScores = (scores || [])
          .map((s: any) => s.overall_score)
          .filter((s: unknown): s is number => typeof s === 'number');

        averageScore = validScores.length
          ? Math.round(validScores.reduce((a: number, b: number) => a + b, 0) / validScores.length)
          : 0;

        const shortlistedCount = (scores || []).filter((s: any) => s.shortlisted).length;
        shortlistRate = validScores.length > 0
          ? Math.round((shortlistedCount / validScores.length) * 100)
          : 0;
      }

      return ok(res, {
        total_candidates: totalCandidates,
        total_candidates_change,
        active_jobs: activeJobs || 0,
        active_jobs_change,
        pending_interviews: pendingInterviews,
        pending_interviews_change,
        completed_today: completedToday,
        completed_today_change,
        average_score: averageScore,
        shortlist_rate: shortlistRate,
      });
    }

    // GET /api/analytics/candidates
    if (segments.length === 2 && segments[1] === 'candidates') {
      const jobId = (req.query.job_id as string) || null;
      const limit = parseInt((req.query.limit as string) || '50');

      // Scope to user's jobs
      const { data: userJobs } = await supabase
        .from('job_descriptions')
        .select('id, title')
        .eq('created_by', user.id);
      const userJobIds = (userJobs || []).map((j: any) => j.id);
      const jobTitleMap: Record<string, string> = {};
      for (const j of userJobs || []) jobTitleMap[j.id] = j.title;

      if (userJobIds.length === 0) return ok(res, []);

      // Validate that requested jobId belongs to this user
      if (jobId && !userJobIds.includes(jobId)) return ok(res, []);

      // Get applications scoped to user's jobs
      let appQuery = supabase
        .from('job_applications')
        .select('candidate_id, job_id, status, applied_at')
        .in('job_id', jobId ? [jobId] : userJobIds)
        .order('applied_at', { ascending: false })
        .limit(limit);

      const { data: applications } = await appQuery;
      const applicationsMap: Record<string, any> = {};
      for (const app of applications || []) {
        applicationsMap[app.candidate_id] = app;
      }

      const candidateIds = [...new Set((applications || []).map((a: any) => a.candidate_id))];
      if (candidateIds.length === 0) return ok(res, []);

      // Fetch candidates
      const { data: candidates, error } = await supabase
        .from('candidates')
        .select('id, full_name, email, created_at')
        .in('id', candidateIds);
      if (error) return res.status(500).json({ error: error.message });
      if (!candidates?.length) return ok(res, []);

      const effectiveJobIds = jobId ? [jobId] : userJobIds;

      // Fetch ATS screenings
      const screeningsMap: Record<string, any> = {};
      const { data: screenings } = await supabase
        .from('ats_screenings')
        .select('candidate_id, overall_score, job_id, shortlisted')
        .in('candidate_id', candidateIds)
        .in('job_id', effectiveJobIds);
      for (const s of screenings || []) {
        screeningsMap[s.candidate_id] = s;
      }

      // Fetch assessment sessions
      const assessmentsMap: Record<string, any> = {};
      try {
        const { data: assessments } = await supabase
          .from('assessment_sessions')
          .select('candidate_id, total_score, status, job_id, completed_at')
          .in('candidate_id', candidateIds)
          .in('job_id', effectiveJobIds);
        for (const a of assessments || []) {
          assessmentsMap[a.candidate_id] = a;
        }
      } catch { /* table may not exist */ }

      // Fetch AI interview sessions
      const interviewsMap: Record<string, any> = {};
      try {
        const { data: interviews } = await supabase
          .from('ai_interview_sessions')
          .select('candidate_id, status, job_id, completed_at, final_evaluation')
          .in('candidate_id', candidateIds)
          .in('job_id', effectiveJobIds);
        for (const i of interviews || []) {
          interviewsMap[i.candidate_id] = i;
        }
      } catch { /* table may not exist */ }

      const analytics = candidates.map((row: any) => {
        const application = applicationsMap[row.id];
        const screening = screeningsMap[row.id];
        const assessment = assessmentsMap[row.id];
        const interview = interviewsMap[row.id];
        const finalEval = interview?.final_evaluation || {};
        const appliedJobId = application?.job_id || jobId;

        return {
          candidate_id: row.id,
          candidate_name: row.full_name,
          candidate_email: row.email,
          job_title: appliedJobId ? (jobTitleMap[appliedJobId] || 'N/A') : 'N/A',
          job_id: appliedJobId,
          application_status: application?.status || 'applied',
          ats_score: screening?.overall_score ?? null,
          shortlisted: screening?.shortlisted ?? null,
          assessment_score: assessment?.total_score ?? null,
          assessment_status: assessment?.status ?? null,
          interview_status: interview?.status ?? null,
          interview_score: finalEval.overall_score ?? null,
          technical_score: finalEval.technical_score ?? null,
          overall_score: finalEval.overall_score ?? null,
          recommendation: finalEval.recommendation ?? null,
        };
      });

      return ok(res, analytics);
    }

    return notFound(res);
  }

  // /api/assessments/*
  if (segments[0] === 'assessments') {
    // GET /api/assessments/start/:token (public)
    if (req.method === 'GET' && segments.length === 3 && segments[1] === 'start') {
      const token = segments[2];
      const { data: session, error } = await supabase
        .from('assessment_sessions')
        .select('*, candidates(full_name, email), job_descriptions(title, role, level)')
        .eq('token', token)
        .single();

      if (error || !session) return notFound(res, 'Assessment not found or link expired');
      if (['completed', 'terminated'].includes(session.status)) return badRequest(res, 'Assessment already completed or terminated');

      const deadline = new Date(session.deadline);
      if (new Date() > deadline) {
        await supabase.from('assessment_sessions').update({ status: 'expired' }).eq('id', session.id);
        return badRequest(res, 'Assessment deadline has passed');
      }

      if (session.status === 'pending') {
        await supabase.from('assessment_sessions').update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
        }).eq('id', session.id);
      }

      return ok(res, {
        session_id: session.id,
        candidate_name: session.candidates?.full_name,
        job_title: session.job_descriptions?.title,
        mcq_count: session.mcq_question_count ?? 20,
        coding_count: session.coding_challenge_count ?? 2,
        total_time_minutes: session.total_time_minutes ?? 90,
        deadline: session.deadline,
      });
    }

    // Everything else requires auth (manager)
    if (!(req.method === 'GET' && segments.length === 3 && segments[1] === 'start')) {
      // candidate assessment endpoints are public but session_id based; keeping them public for now
    }

    // GET /api/assessments/:sessionId/mcq
    if (req.method === 'GET' && segments.length === 3 && segments[2] === 'mcq') {
      const sessionId = segments[1];
      const { data: session, error } = await supabase
        .from('assessment_sessions')
        .select('id, status, job_id, mcq_questions, mcq_question_count, proctoring_data')
        .eq('id', sessionId)
        .single();

      if (error || !session) return notFound(res, 'Session not found');
      if (session.status !== 'in_progress') return badRequest(res, 'Assessment not in progress');

      const assessmentConfig = session.proctoring_data?.assessment_config || {};
      if (assessmentConfig.include_mcq === false || (session.mcq_question_count || 0) === 0) {
        return ok(res, []);
      }

      const stored = session.mcq_questions || [];
      if (stored.length) {
        return ok(res, stored.map((q: any) => ({
          id: q.id,
          question: q.question,
          options: q.options || [],
          difficulty: q.difficulty,
          topic: q.topic,
          points: q.points ?? 5,
        })));
      }

      const { data: job } = await supabase.from('job_descriptions').select('*').eq('id', session.job_id).single();
      if (!job) return notFound(res, 'Job not found');

      const count = session.mcq_question_count || 20;
      const difficulty = assessmentConfig.difficulty || 'medium';
      const mapped = mapAssessmentDifficulty(difficulty);
      
      const mustHaveSkills = (job.must_have_skills || []).join(', ') || 'general programming';
      const goodToHaveSkills = (job.good_to_have_skills || []).join(', ');
      const jobDescription = job.description || '';
      
      const prompt = `Generate exactly ${count} multiple choice questions for a ${job.level} ${job.role} position.

Job Description: ${jobDescription}

Must-Have Skills to test: ${mustHaveSkills}
${goodToHaveSkills ? `Good-to-Have Skills to include: ${goodToHaveSkills}` : ''}

Selected difficulty (user): ${difficulty}.
Effective difficulty (system): ${mapped.label}.
${mapped.guidance}

IMPORTANT: Generate questions that are directly relevant to the job description and required skills.
Each question should test practical knowledge of the must-have skills and good-to-have skills.

## QUESTION STYLE RULES:
- Prefer scenario-based questions ("What happens when...", "Given this code snippet, what is the output?", "Which approach is best for...") over simple definition questions.
- Include questions that test trade-offs, debugging, best practices, and edge cases.
- Vary question types: some code output prediction, some "which is correct", some "what is the best approach", some "what is wrong with this code".

## OPTION RULES (CRITICAL - FOLLOW STRICTLY):
1. NEVER generate options that are permutations or rearrangements of the same sentence. For example, if the question is about the difference between X and Y, do NOT create 4 options that all say "X does ___ while Y does ___" with swapped descriptions. This is the #1 thing to avoid.
2. Each option MUST be structurally different - they should start with different words and use different sentence structures.
3. Options should be concise (1-2 lines max). Avoid long paragraph-style options.
4. The 4 options should follow this pattern:
   - One clearly correct answer
   - One plausible distractor that contains a common misconception
   - One distractor that is partially correct but missing a key detail
   - One distractor that sounds technical but is incorrect
5. Vary option lengths - not all options should be the same length.
6. Randomize the position of the correct answer across questions (don't always put it first).

## EXAMPLE OF GOOD OPTIONS (for a SQL question about indexes):
Question: "What is the primary benefit of adding an index on a frequently queried column?"
Good options:
- "It speeds up SELECT queries by allowing the database to locate rows without a full table scan" (correct)
- "It reduces the overall storage size of the table" (plausible misconception)
- "It guarantees that all values in the column are unique" (confuses index with unique constraint)
- "It automatically caches the column data in application memory" (sounds technical but wrong)

## EXAMPLE OF BAD OPTIONS (DO NOT DO THIS):
- "A JOIN combines rows from tables based on a related column, while a UNION combines result-sets of SELECT statements"
- "A JOIN combines result-sets of SELECT statements, while a UNION combines rows from tables based on a related column"
- "A JOIN is used to combine rows based on a column, while a UNION combines result-sets"
- "A JOIN combines result-sets, while a UNION combines rows based on a column"
These are bad because they are all permutations of the same sentence. NEVER do this.

Return JSON with this exact structure:
{
  "questions": [
    {
      "id": "q1",
      "question": "What happens when you call Thread.sleep(0) in Java?",
      "options": [
        "The current thread yields its remaining time slice to other threads of equal priority",
        "The JVM throws an IllegalArgumentException for invalid sleep duration",
        "The thread is permanently suspended until notify() is called",
        "Nothing happens — the method returns immediately with no effect"
      ],
      "correct_index": 0,
      "difficulty": "${mapped.label}",
      "topic": "Java Concurrency",
      "points": 5
    }
  ]
}

CRITICAL: The "options" array MUST contain 4 complete, meaningful answer choices - NOT just "A", "B", "C", "D".
Each option must start with a different word/phrase and be structurally unique.
Only return valid JSON, no additional text.`;

      let generated: any;
      try {
        generated = await generateJSON<any>(prompt);
        console.log('MCQ generation result keys:', Object.keys(generated || {}));
      } catch (genErr: any) {
        console.error('MCQ generation failed:', genErr.message);
        return res.status(500).json({ error: 'AI failed to generate questions. Please try again.' });
      }

      const questionsRaw = Array.isArray(generated)
        ? generated
        : Array.isArray(generated?.questions)
          ? generated.questions
          : [];
      const questions = questionsRaw
        .map((q: any, idx: number) => ({
          id: String(q?.id || `q${idx + 1}`),
          question: String(q?.question || ''),
          options: Array.isArray(q?.options) ? q.options.map((o: any) => String(o)).slice(0, 4) : [],
          correct_index: typeof q?.correct_index === 'number' ? q.correct_index : 0,
          difficulty: String(q?.difficulty || mapped.label),
          topic: String(q?.topic || 'General'),
          points: typeof q?.points === 'number' ? q.points : 5,
        }))
        .filter((q: any) => q.question && q.options.length === 4);

      if (!questions.length) {
        return res.status(500).json({ error: 'AI returned no valid questions. Please try again.' });
      }

      await supabase.from('assessment_sessions').update({
        mcq_questions: questions,
        updated_at: new Date().toISOString(),
      }).eq('id', sessionId);

      return ok(res, questions.map((q: any) => ({
        id: q.id,
        question: q.question,
        options: q.options,
        difficulty: q.difficulty,
        topic: q.topic,
        points: q.points,
      })));
    }

    // GET /api/assessments/:sessionId/coding
    // Serves DSA problems from the problem bank (not AI-generated)
    if (req.method === 'GET' && segments.length === 3 && segments[2] === 'coding') {
      const sessionId = segments[1];
      const { data: session, error } = await supabase
        .from('assessment_sessions')
        .select('id, status, coding_challenges, coding_challenge_count, coding_problem_ids, proctoring_data')
        .eq('id', sessionId)
        .single();

      if (error || !session) return notFound(res, 'Session not found');
      if (session.status !== 'in_progress') return badRequest(res, 'Assessment not in progress');

      const assessmentConfig = session.proctoring_data?.assessment_config || {};
      if (assessmentConfig.include_coding === false || (session.coding_challenge_count || 0) === 0) {
        return ok(res, []);
      }

      // Return cached challenges if already assigned
      const storedChallenges = session.coding_challenges || [];
      if (storedChallenges.length) return ok(res, storedChallenges);

      // Select problems from DSA bank based on difficulty
      const count = session.coding_challenge_count || 2;
      const difficulty = assessmentConfig.difficulty || 'medium';

      // Difficulty mapping: easy → 1 easy + 1 easy, medium → 1 easy + 1 medium, hard → 1 medium + 1 hard
      let difficultyDistribution: string[];
      if (difficulty === 'easy') {
        difficultyDistribution = Array(count).fill('easy');
      } else if (difficulty === 'hard') {
        difficultyDistribution = count >= 2
          ? ['medium', ...Array(count - 1).fill('hard')]
          : ['hard'];
      } else {
        // medium (default)
        difficultyDistribution = count >= 2
          ? ['easy', ...Array(count - 1).fill('medium')]
          : ['medium'];
      }

      // Fetch candidate problems per difficulty level
      const selectedProblems: any[] = [];
      for (const diff of difficultyDistribution) {
        const { data: problems } = await supabase
          .from('dsa_problems')
          .select('*')
          .eq('difficulty', diff)
          .eq('is_active', true)
          .limit(20);

        if (problems && problems.length > 0) {
          // Exclude already selected problems
          const available = problems.filter((p: any) => !selectedProblems.some(s => s.id === p.id));
          if (available.length > 0) {
            const pick = available[Math.floor(Math.random() * available.length)];
            selectedProblems.push(pick);
          }
        }
      }

      if (!selectedProblems.length) {
        return res.status(500).json({ error: 'No DSA problems available in the problem bank. Please contact the administrator.' });
      }

      // Build candidate-facing challenge objects (hide private/edge test cases, hide solution wrappers)
      const challenges = selectedProblems.map((p: any) => {
        const publicTests = (p.test_cases || []).filter((tc: any) => tc.visibility === 'public');
        return {
          id: p.id,
          slug: p.slug,
          title: p.title,
          description: p.description,
          constraints: p.constraints || '',
          examples: p.examples || [],
          starter_code: p.starter_code || {},
          test_cases: publicTests.map((tc: any) => ({ id: tc.id, input: tc.input, expected_output: tc.expected_output })),
          points: p.points,
          time_limit_seconds: p.time_limit_seconds,
          supported_languages: Object.keys(p.starter_code || {}),
        };
      });

      // Store problem IDs and candidate-facing challenges in session
      await supabase.from('assessment_sessions').update({
        coding_problem_ids: selectedProblems.map((p: any) => p.id),
        coding_challenges: challenges,
        updated_at: new Date().toISOString(),
      }).eq('id', sessionId);

      return ok(res, challenges);
    }

    // POST /api/assessments/:sessionId/mcq/submit
    if (req.method === 'POST' && segments.length === 4 && segments[2] === 'mcq' && segments[3] === 'submit') {
      const sessionId = segments[1];
      const submissions = req.body as any[];

      const { data: session } = await supabase.from('assessment_sessions').select('*').eq('id', sessionId).single();
      if (!session || session.status !== 'in_progress') return badRequest(res, 'Invalid session');

      const stored: any[] = session.mcq_questions || [];
      if (!stored.length) return badRequest(res, 'Questions not found for this session');

      const questionMap = new Map<string, any>(stored.map((q: any) => [q.id, q] as const));

      // Difficulty weights: easy=1, medium=2, hard=3
      const difficultyWeight: Record<string, number> = { easy: 1, medium: 2, hard: 3 };

      let totalWeightedPoints = 0;
      let scoredWeightedPoints = 0;
      let correctCount = 0;
      let totalCount = 0;

      // Build detailed results for storage
      const detailedResults: any[] = [];

      for (const s of submissions) {
        const q = questionMap.get(s.question_id);
        if (!q) continue;

        totalCount++;
        const basePoints = q.points ?? 5;
        const weight = difficultyWeight[q.difficulty] || 2;
        const weightedPoints = basePoints * weight;
        totalWeightedPoints += weightedPoints;

        const isCorrect = s.selected_index === q.correct_index;
        if (isCorrect) {
          scoredWeightedPoints += weightedPoints;
          correctCount++;
        }

        detailedResults.push({
          question_id: q.id,
          question: q.question,
          options: q.options,
          selected_index: s.selected_index,
          correct_index: q.correct_index,
          is_correct: isCorrect,
          difficulty: q.difficulty,
          topic: q.topic,
          points_possible: weightedPoints,
          points_earned: isCorrect ? weightedPoints : 0,
        });
      }

      const percentage = totalWeightedPoints > 0 ? (scoredWeightedPoints / totalWeightedPoints) * 100 : 0;

      await supabase.from('assessment_sessions').update({
        mcq_submissions: detailedResults,
        mcq_score: percentage,
      }).eq('id', sessionId);

      return ok(res, {
        success: true,
        score: percentage,
        correct_count: correctCount,
        total_count: totalCount,
        weighted_points_earned: scoredWeightedPoints,
        weighted_points_possible: totalWeightedPoints,
      });
    }

    // POST /api/assessments/:sessionId/coding/run (run against public test cases only - LeetCode style)
    if (req.method === 'POST' && segments.length === 4 && segments[2] === 'coding' && segments[3] === 'run') {
      const sessionId = segments[1];
      const { challenge_id, code, language = 'python3' } = req.body;

      if (!checkRateLimit(`run:${sessionId}`, 10)) {
        return res.status(429).json({ error: 'Rate limit exceeded. Maximum 10 runs per minute.' });
      }

      const { data: session } = await supabase.from('assessment_sessions').select('*').eq('id', sessionId).single();
      if (!session || session.status !== 'in_progress') return badRequest(res, 'Invalid session');

      // Fetch the full problem from DSA bank (with all test cases + solution wrappers)
      const { data: problem } = await supabase.from('dsa_problems').select('*').eq('id', challenge_id).single();
      if (!problem) return badRequest(res, 'Problem not found');

      const allTestCases: any[] = problem.test_cases || [];
      // Run mode: only execute against public test cases
      const publicTests = allTestCases.filter((tc: any) => tc.visibility === 'public');
      if (!publicTests.length) {
        return ok(res, { success: false, error: 'No public test cases available', results: [], passed: 0, total: 0, score_percentage: 0 });
      }

      const langKey = mapLanguageKey(language);
      const wrapperTemplate = (problem.solution_wrappers || {})[langKey];
      if (!wrapperTemplate) {
        return badRequest(res, `Language '${language}' is not supported for this problem. Supported: ${Object.keys(problem.starter_code || {}).join(', ')}`);
      }

      const results = await executeTestCasesViaHackerEarth(code, wrapperTemplate, langKey, publicTests, problem.time_limit_seconds, problem.memory_limit_kb);

      const passedCount = results.filter((r: any) => r.passed).length;
      const compilationError = results.find((r: any) => r.status === 'CE')?.error || null;

      return ok(res, {
        success: !compilationError,
        compilation_error: compilationError,
        results: results.map((r: any) => ({
          test_case_id: r.test_case_id,
          input: r.input,
          expected_output: r.expected_output,
          actual_output: r.actual_output,
          passed: r.passed,
          status: r.status,
          time_used: r.time_used,
          memory_used: r.memory_used,
          error: r.error,
        })),
        passed: passedCount,
        total: publicTests.length,
        score_percentage: publicTests.length > 0 ? (passedCount / publicTests.length) * 100 : 0,
      });
    }

    // POST /api/assessments/:sessionId/coding/submit (run against ALL test cases and store results)
    if (req.method === 'POST' && segments.length === 4 && segments[2] === 'coding' && segments[3] === 'submit') {
      const sessionId = segments[1];
      const { challenge_id, code, language = 'python3' } = req.body;

      if (!checkRateLimit(`submit:${sessionId}`, 5)) {
        return res.status(429).json({ error: 'Rate limit exceeded. Maximum 5 submissions per minute.' });
      }

      const { data: session } = await supabase.from('assessment_sessions').select('*').eq('id', sessionId).single();
      if (!session || session.status !== 'in_progress') return badRequest(res, 'Invalid session');

      // Fetch the full problem from DSA bank
      const { data: problem } = await supabase.from('dsa_problems').select('*').eq('id', challenge_id).single();
      if (!problem) return badRequest(res, 'Problem not found');

      const allTestCases: any[] = problem.test_cases || [];
      const langKey = mapLanguageKey(language);
      const wrapperTemplate = (problem.solution_wrappers || {})[langKey];
      if (!wrapperTemplate) {
        return badRequest(res, `Language '${language}' is not supported for this problem.`);
      }

      // Submit mode: execute against ALL test cases (public + private + edge)
      const results = await executeTestCasesViaHackerEarth(code, wrapperTemplate, langKey, allTestCases, problem.time_limit_seconds, problem.memory_limit_kb);

      const passedCount = results.filter((r: any) => r.passed).length;
      const totalTests = allTestCases.length || 1;
      const scorePercentage = (passedCount / totalTests) * 100;
      const pointsEarned = Math.round((passedCount / totalTests) * (problem.points || 100));

      // Separate results by visibility for reporting
      const publicResults = results.filter((r: any) => r.visibility === 'public');
      const privateResults = results.filter((r: any) => r.visibility === 'private');
      const edgeResults = results.filter((r: any) => r.visibility === 'edge');

      // Calculate time/memory performance stats
      const executionTimes = results.filter((r: any) => r.time_used).map((r: any) => parseFloat(r.time_used));
      const memoryUsages = results.filter((r: any) => r.memory_used).map((r: any) => parseInt(r.memory_used));

      const submissionRecord = {
        challenge_id,
        problem_slug: problem.slug,
        code,
        language: langKey,
        test_results: results.map((r: any) => ({
          test_case_id: r.test_case_id,
          visibility: r.visibility,
          passed: r.passed,
          status: r.status,
          time_used: r.time_used,
          memory_used: r.memory_used,
          // Only include input/output for public tests in stored results
          ...(r.visibility === 'public' ? { input: r.input, expected_output: r.expected_output, actual_output: r.actual_output } : {}),
        })),
        summary: {
          public_passed: publicResults.filter((r: any) => r.passed).length,
          public_total: publicResults.length,
          private_passed: privateResults.filter((r: any) => r.passed).length,
          private_total: privateResults.length,
          edge_passed: edgeResults.filter((r: any) => r.passed).length,
          edge_total: edgeResults.length,
        },
        performance: {
          avg_time_ms: executionTimes.length > 0 ? (executionTimes.reduce((a: number, b: number) => a + b, 0) / executionTimes.length * 1000).toFixed(2) : null,
          max_time_ms: executionTimes.length > 0 ? (Math.max(...executionTimes) * 1000).toFixed(2) : null,
          avg_memory_kb: memoryUsages.length > 0 ? Math.round(memoryUsages.reduce((a: number, b: number) => a + b, 0) / memoryUsages.length) : null,
          max_memory_kb: memoryUsages.length > 0 ? Math.max(...memoryUsages) : null,
        },
        passed_count: passedCount,
        total_tests: totalTests,
        score_percentage: scorePercentage,
        points_earned: pointsEarned,
        max_points: problem.points || 100,
        submitted_at: new Date().toISOString(),
      };

      const existing = session.coding_submissions || [];
      const existingIdx = existing.findIndex((s: any) => s.challenge_id === challenge_id);
      if (existingIdx >= 0) {
        existing[existingIdx] = submissionRecord;
      } else {
        existing.push(submissionRecord);
      }

      // Calculate total coding score across all challenges
      let totalCodingPoints = 0;
      let earnedCodingPoints = 0;
      for (const sub of existing) {
        totalCodingPoints += sub.max_points || 100;
        earnedCodingPoints += sub.points_earned || 0;
      }
      const codingScore = totalCodingPoints > 0 ? (earnedCodingPoints / totalCodingPoints) * 100 : 0;

      await supabase.from('assessment_sessions').update({
        coding_submissions: existing,
        coding_score: codingScore,
      }).eq('id', sessionId);

      return ok(res, {
        success: true,
        challenge_id,
        passed_count: passedCount,
        total_tests: totalTests,
        score_percentage: scorePercentage,
        points_earned: pointsEarned,
        summary: submissionRecord.summary,
        performance: submissionRecord.performance,
        // Only send public test results to candidate
        test_results: publicResults.map((r: any) => ({
          test_case_id: r.test_case_id,
          input: r.input,
          expected_output: r.expected_output,
          actual_output: r.actual_output,
          passed: r.passed,
          status: r.status,
          time_used: r.time_used,
          memory_used: r.memory_used,
        })),
        hidden_tests_passed: (submissionRecord.summary.private_passed + submissionRecord.summary.edge_passed),
        hidden_tests_total: (submissionRecord.summary.private_total + submissionRecord.summary.edge_total),
      });
    }

    // POST /api/assessments/:sessionId/proctoring
    if (req.method === 'POST' && segments.length === 3 && segments[2] === 'proctoring') {
      const sessionId = segments[1];
      const event = req.body;

      const { data: session } = await supabase.from('assessment_sessions').select('*').eq('id', sessionId).single();
      if (!session) return notFound(res, 'Session not found');

      const proctoring = session.proctoring_data || {};

      // Update counters
      if (event.event_type === 'tab_switch') proctoring.tab_switches = (proctoring.tab_switches || 0) + 1;
      else if (event.event_type === 'fullscreen_exit') proctoring.fullscreen_exits = (proctoring.fullscreen_exits || 0) + 1;
      else if (event.event_type === 'window_blur') proctoring.window_blurs = (proctoring.window_blurs || 0) + 1;
      else if (event.event_type === 'copy_paste') proctoring.copy_paste_attempts = (proctoring.copy_paste_attempts || 0) + 1;
      else if (event.event_type === 'right_click') proctoring.right_click_attempts = (proctoring.right_click_attempts || 0) + 1;
      else if (event.event_type === 'face_not_detected') proctoring.face_detection_failures = (proctoring.face_detection_failures || 0) + 1;
      else if (event.event_type === 'devtools_open') proctoring.devtools_attempts = (proctoring.devtools_attempts || 0) + 1;

      const isCritical = ['tab_switch', 'fullscreen_exit', 'window_blur'].includes(event.event_type);
      const warnings = proctoring.warnings || [];
      warnings.push({ type: event.event_type, timestamp: event.timestamp, details: event.details, severity: isCritical ? 'critical' : 'warning' });
      proctoring.warnings = warnings;

      // STRICT: immediate termination for critical events
      let shouldTerminate = false;
      let terminationReason = '';

      if (isCritical) {
        shouldTerminate = true;
        terminationReason = `Assessment terminated: ${event.event_type.replace(/_/g, ' ')} detected. This is a strict proctoring violation.`;
      } else if ((proctoring.face_detection_failures || 0) >= 3) {
        shouldTerminate = true;
        terminationReason = 'Assessment terminated: Face not visible 3 times.';
      } else {
        const minorViolations = (proctoring.copy_paste_attempts || 0) + (proctoring.right_click_attempts || 0) + (proctoring.devtools_attempts || 0);
        if (minorViolations >= 3) {
          shouldTerminate = true;
          terminationReason = 'Assessment terminated: Too many proctoring violations.';
        }
      }

      if (shouldTerminate) {
        proctoring.terminated = true;
        proctoring.termination_reason = terminationReason;
        await supabase.from('assessment_sessions').update({
          proctoring_data: proctoring,
          status: 'terminated',
          completed_at: new Date().toISOString(),
        }).eq('id', sessionId);
        return ok(res, { warning: false, terminated: true, message: terminationReason, violations_remaining: 0 });
      }

      const minorViolations = (proctoring.copy_paste_attempts || 0) + (proctoring.right_click_attempts || 0) + (proctoring.devtools_attempts || 0);
      await supabase.from('assessment_sessions').update({ proctoring_data: proctoring }).eq('id', sessionId);
      return ok(res, {
        warning: true,
        terminated: false,
        violations_remaining: Math.max(0, 3 - minorViolations),
        message: 'Warning: Proctoring violation recorded. Repeated violations will terminate your assessment.',
        event_type: event.event_type,
      });
    }

    // POST /api/assessments/:sessionId/complete
    if (req.method === 'POST' && segments.length === 3 && segments[2] === 'complete') {
      const sessionId = segments[1];

      const { data: session } = await supabase.from('assessment_sessions').select('*').eq('id', sessionId).single();
      if (!session) return notFound(res, 'Session not found');
      if (session.status !== 'in_progress') return badRequest(res, 'Assessment not in progress');

      const mcqScore = session.mcq_score;
      const codingScore = session.coding_score;
      const mcqVal = mcqScore != null ? Number(mcqScore) : 0;
      const codingVal = codingScore != null ? Number(codingScore) : 0;

      const totalScore = codingScore == null ? mcqVal : mcqScore == null ? codingVal : (mcqVal + codingVal) / 2;

      await supabase.from('assessment_sessions').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        mcq_score: mcqVal,
        coding_score: codingScore == null ? null : codingVal,
        total_score: totalScore,
      }).eq('id', sessionId);

      return ok(res, { success: true, mcq_score: mcqVal, coding_score: codingScore == null ? null : codingVal, total_score: totalScore });
    }

    // POST /api/assessments/invite (manager)
    if (req.method === 'POST' && segments.length === 2 && segments[1] === 'invite') {
      const user = await requireAuth(req, res);
      if (!user) return;

      const body = req.body;
      const candidateIds = body.candidate_ids as string[];
      const jobId = body.job_id as string;
      const deadlineHours = body.deadline_hours ?? 72;
      const includeMcq = body.include_mcq !== false;
      const includeCoding = body.include_coding !== false;
      const difficulty = (body.difficulty as string) || 'medium';
      const mcqCount = includeMcq ? Number(body.mcq_question_count ?? 20) : 0;
      const codingCount = includeCoding ? Number(body.coding_challenge_count ?? 2) : 0;

      const { data: job } = await supabase.from('job_descriptions').select('id, title').eq('id', jobId).eq('created_by', user.id).single();
      if (!job) return notFound(res, 'Job not found');

      const { data: candidates } = await supabase.from('candidates').select('id, email, full_name').in('id', candidateIds);
      if (!candidates?.length) return notFound(res, 'No candidates found');

      const deadline = new Date(Date.now() + Number(deadlineHours) * 60 * 60 * 1000);
      const hostHeader = req.headers['x-forwarded-host'] || req.headers.host;
      const isLocalhost = String(hostHeader).includes('localhost');
      const protocol = req.headers['x-forwarded-proto'] ? String(req.headers['x-forwarded-proto']).split(',')[0] : (isLocalhost ? 'http' : 'https');
      const dynamicUrl = hostHeader ? `${protocol}://${hostHeader}` : 'https://hire-ai-sandy.vercel.app';
      
      let frontendUrl = process.env.FRONTEND_URL;
      if (!frontendUrl || frontendUrl === 'http://localhost:8080' || frontendUrl.includes('hire-ai-sandy')) {
        frontendUrl = dynamicUrl;
      }

      // Auto-calculate time based on questions and difficulty if not provided
      let totalTimeMinutes = body.total_time_minutes;
      if (!totalTimeMinutes) {
        // MCQ time per question based on difficulty
        const mcqTimePerQuestion = difficulty === 'easy' ? 1 : difficulty === 'hard' ? 2 : 1.5;
        // Coding time per challenge based on difficulty
        const codingTimePerChallenge = difficulty === 'easy' ? 15 : difficulty === 'hard' ? 30 : 20;
        
        totalTimeMinutes = Math.ceil(
          (mcqCount * mcqTimePerQuestion) + (codingCount * codingTimePerChallenge)
        );
        
        // Ensure minimum time of 15 minutes
        totalTimeMinutes = Math.max(15, totalTimeMinutes);
      }

      let invitesSent = 0;
      const failed: string[] = [];

      for (const c of candidates) {
        try {
          const token = crypto.randomBytes(32).toString('base64url');
          await supabase.from('assessment_sessions').insert({
            id: uuidv4(),
            candidate_id: c.id,
            job_id: jobId,
            token,
            status: 'pending',
            deadline: deadline.toISOString(),
            mcq_question_count: mcqCount,
            coding_challenge_count: codingCount,
            total_time_minutes: totalTimeMinutes,
            proctoring_data: {
              tab_switches: 0,
              fullscreen_exits: 0,
              copy_paste_attempts: 0,
              warnings: [],
              terminated: false,
              assessment_config: {
                include_mcq: includeMcq,
                include_coding: includeCoding,
                difficulty,
              },
            },
            created_at: new Date().toISOString(),
          });

          await sendAssessmentInvite(c.email, c.full_name, job.title, `${frontendUrl}/assessment/${token}`, deadline.toLocaleString());
          invitesSent += 1;
        } catch {
          failed.push(c.id);
        }
      }

      return ok(res, { success: invitesSent > 0, invites_sent: invitesSent, failed });
    }

    return notFound(res);
  }

  // /api/ai-interview/*
  if (segments[0] === 'ai-interview') {
    // GET /api/ai-interview/start/:token
    if (req.method === 'GET' && segments.length === 3 && segments[1] === 'start') {
      const token = segments[2];
      const { data: session, error } = await supabase
        .from('ai_interview_sessions')
        .select('*, candidates(full_name, email), job_descriptions(title, role, level)')
        .eq('token', token)
        .single();

      if (error || !session) return notFound(res, 'Interview not found or link expired');
      if (['completed', 'terminated'].includes(session.status)) return badRequest(res, 'Interview already completed or terminated');

      if (session.status === 'pending') {
        await supabase.from('ai_interview_sessions').update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
        }).eq('id', session.id);
      }

      return ok(res, {
        session_id: session.id,
        candidate_name: session.candidates?.full_name,
        job_title: session.job_descriptions?.title,
        total_questions: (session.questions || []).length,
        estimated_duration_minutes: ((session.questions || []).length || 5) * 3,
      });
    }

    // GET /api/ai-interview/:sessionId/question
    if (req.method === 'GET' && segments.length === 3 && segments[2] === 'question') {
      const sessionId = segments[1];
      const { data: session } = await supabase.from('ai_interview_sessions').select('*').eq('id', sessionId).single();
      if (!session) return notFound(res, 'Session not found');
      if (session.status !== 'in_progress') return badRequest(res, 'Interview not in progress');

      const idx = session.current_question_index || 0;
      const questions = session.questions || [];
      if (idx >= questions.length) return ok(res, { completed: true, message: 'All questions answered' });
      const q = questions[idx];

      return ok(res, {
        index: idx,
        question_text: q.text,
        question_type: q.type,
        expected_duration_seconds: q.duration ?? 120,
      });
    }

    // POST /api/ai-interview/:sessionId/transcribe
    // Accepts JSON body: { audio_base64: string, mime_type?: string }
    if (req.method === 'POST' && segments.length === 3 && segments[2] === 'transcribe') {
      const sessionId = segments[1];

      const { data: session } = await supabase
        .from('ai_interview_sessions')
        .select('id, status')
        .eq('id', sessionId)
        .single();

      if (!session) return notFound(res, 'Session not found');
      if (!['in_progress', 'completed'].includes(session.status)) {
        return badRequest(res, 'Interview not in progress');
      }

      const body = req.body as { audio_base64?: string; mime_type?: string };
      if (!body?.audio_base64) {
        return badRequest(res, 'Missing audio_base64 in request body.');
      }

      let audioBuffer: Buffer;
      try {
        audioBuffer = Buffer.from(body.audio_base64, 'base64');
      } catch {
        return badRequest(res, 'Invalid base64 audio data.');
      }

      if (audioBuffer.length === 0) {
        return badRequest(res, 'Empty audio data received.');
      }

      try {
        const transcript = await transcribeWithAssemblyAI(audioBuffer, body.mime_type || 'audio/webm');
        return ok(res, { transcript });
      } catch (e: any) {
        console.error('Transcription error:', e.message);
        if (e.message.includes('ASSEMBLYAI_API_KEY')) {
          return res.status(503).json({ error: e.message });
        }
        return res.status(500).json({ error: `Transcription failed: ${e.message}` });
      }
    }

    // POST /api/ai-interview/:sessionId/response
    if (req.method === 'POST' && segments.length === 3 && segments[2] === 'response') {
      const sessionId = segments[1];
      const body = req.body;

      const { data: session } = await supabase.from('ai_interview_sessions').select('*').eq('id', sessionId).single();
      if (!session) return notFound(res, 'Session not found');

      const responses = session.responses || [];
      responses.push({
        question_index: body.question_index,
        transcript: body.transcript,
        audio_duration_seconds: body.audio_duration_seconds,
        confidence: body.confidence,
        submitted_at: new Date().toISOString(),
      });

      const nextIndex = (session.current_question_index || 0) + 1;
      const isLast = nextIndex >= (session.questions || []).length;

      await supabase.from('ai_interview_sessions').update({
        responses,
        current_question_index: nextIndex,
        updated_at: new Date().toISOString(),
      }).eq('id', sessionId);

      return ok(res, { success: true, is_last_question: isLast });
    }

    // POST /api/ai-interview/:sessionId/proctoring
    if (req.method === 'POST' && segments.length === 3 && segments[2] === 'proctoring') {
      const sessionId = segments[1];
      const event = req.body;

      const { data: session } = await supabase.from('ai_interview_sessions').select('*').eq('id', sessionId).single();
      if (!session) return notFound(res, 'Session not found');

      const proctoring = session.proctoring_data || {};

      // Update counters
      if (event.event_type === 'tab_switch') proctoring.tab_switches = (proctoring.tab_switches || 0) + 1;
      else if (event.event_type === 'fullscreen_exit') proctoring.fullscreen_exits = (proctoring.fullscreen_exits || 0) + 1;
      else if (event.event_type === 'window_blur') proctoring.window_blurs = (proctoring.window_blurs || 0) + 1;
      else if (event.event_type === 'face_not_detected') proctoring.face_detection_failures = (proctoring.face_detection_failures || 0) + 1;
      else if (event.event_type === 'copy_paste') proctoring.copy_paste_attempts = (proctoring.copy_paste_attempts || 0) + 1;
      else if (event.event_type === 'devtools_open') proctoring.devtools_attempts = (proctoring.devtools_attempts || 0) + 1;

      const warnings = proctoring.warnings || [];
      const isCritical = ['tab_switch', 'fullscreen_exit', 'window_blur'].includes(event.event_type);
      warnings.push({ type: event.event_type, timestamp: event.timestamp, details: event.details, severity: isCritical ? 'critical' : 'warning' });
      proctoring.warnings = warnings;

      // STRICT: immediate termination for critical events
      let shouldTerminate = false;
      let terminationReason = '';

      if (isCritical) {
        shouldTerminate = true;
        terminationReason = `Interview terminated: ${event.event_type.replace(/_/g, ' ')} detected. This is a strict proctoring violation.`;
      } else if ((proctoring.face_detection_failures || 0) >= 3) {
        shouldTerminate = true;
        terminationReason = 'Interview terminated: Face not visible 3 times.';
      } else {
        const minorViolations = (proctoring.copy_paste_attempts || 0) + (proctoring.devtools_attempts || 0);
        if (minorViolations >= 3) {
          shouldTerminate = true;
          terminationReason = 'Interview terminated: Too many proctoring violations.';
        }
      }

      if (shouldTerminate) {
        proctoring.terminated = true;
        proctoring.termination_reason = terminationReason;
        await supabase.from('ai_interview_sessions').update({
          proctoring_data: proctoring,
          status: 'terminated',
          completed_at: new Date().toISOString(),
        }).eq('id', sessionId);
        return ok(res, { terminated: true, message: terminationReason });
      }

      await supabase.from('ai_interview_sessions').update({ proctoring_data: proctoring }).eq('id', sessionId);
      return ok(res, { success: true, terminated: false, warning: true, message: 'Proctoring violation recorded.' });
    }

    // POST /api/ai-interview/:sessionId/complete
    if (req.method === 'POST' && segments.length === 3 && segments[2] === 'complete') {
      const sessionId = segments[1];
      const { data: session } = await supabase
        .from('ai_interview_sessions')
        .select('*, candidates(full_name), job_descriptions(title, role, level, must_have_skills)')
        .eq('id', sessionId)
        .single();
      if (!session) return notFound(res, 'Session not found');

      // AI-powered evaluation based on actual responses
      let finalEvaluation: any;
      const questions = session.questions || [];
      const responses = session.responses || [];

      try {
        const qaPairs = questions.map((q: any, i: number) => {
          const resp = responses.find((r: any) => r.question_index === i);
          return `Q${i + 1} (${q.type}): ${q.text}\nA${i + 1}: ${resp?.transcript || '[No response]'}`;
        }).join('\n\n');

        const evalPrompt = `Evaluate this AI interview for a ${session.job_descriptions?.level} ${session.job_descriptions?.role} position (${session.job_descriptions?.title}).
Required skills: ${(session.job_descriptions?.must_have_skills || []).join(', ')}

Interview Q&A:
${qaPairs}

Evaluate and return JSON:
{
  "overall_score": 0-100,
  "technical_score": 0-100,
  "communication_score": 0-100,
  "confidence_score": 0-100,
  "recommendation": "strong_hire" or "hire" or "maybe" or "no_hire",
  "strengths": ["strength1", "strength2"],
  "areas_for_improvement": ["area1", "area2"],
  "detailed_feedback": "2-3 sentence summary of candidate performance"
}`;
        finalEvaluation = await generateJSON<any>(evalPrompt);
      } catch {
        // Fallback if AI evaluation fails
        const answeredCount = responses.filter((r: any) => r.transcript && r.transcript.trim()).length;
        const completionRate = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;
        finalEvaluation = {
          overall_score: Math.round(completionRate * 0.7),
          technical_score: Math.round(completionRate * 0.6),
          communication_score: Math.round(completionRate * 0.8),
          confidence_score: Math.round(completionRate * 0.7),
          recommendation: completionRate >= 70 ? 'maybe' : 'no_hire',
          strengths: answeredCount > 0 ? ['Completed interview responses'] : [],
          areas_for_improvement: ['Could not perform AI evaluation - scores are approximate'],
          detailed_feedback: `Candidate answered ${answeredCount} of ${questions.length} questions.`,
        };
      }

      await supabase.from('ai_interview_sessions').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        final_evaluation: finalEvaluation,
      }).eq('id', sessionId);

      return ok(res, finalEvaluation);
    }

    // POST /api/ai-interview/invite (manager)
    if (req.method === 'POST' && segments.length === 2 && segments[1] === 'invite') {
      const user = await requireAuth(req, res);
      if (!user) return;

      const { candidate_ids, job_id, scheduled_time } = req.body;

      const { data: job } = await supabase
        .from('job_descriptions')
        .select('id, title, role, level, must_have_skills, interview_question_pool')
        .eq('id', job_id)
        .eq('created_by', user.id)
        .single();

      if (!job) return notFound(res, 'Job not found');

      // If no question pool exists yet, generate one and store it
      let questionPool: any[] = job.interview_question_pool || [];
      if (!questionPool.length) {
        try {
          questionPool = await generateInterviewQuestionPool({
            title: job.title,
            role: job.role,
            level: job.level,
            must_have_skills: job.must_have_skills || [],
            description: '',
          });
          if (questionPool.length) {
            await supabase.from('job_descriptions').update({
              interview_question_pool: questionPool,
            }).eq('id', job_id);
          }
        } catch {
          // Fall back to old method if pool generation fails
          questionPool = [];
        }
      }

      const { data: candidates } = await supabase
        .from('candidates')
        .select('id, email, full_name, resume_parsed_data')
        .in('id', candidate_ids);

      if (!candidates?.length) return notFound(res, 'No candidates found');

      const hostHeader = req.headers['x-forwarded-host'] || req.headers.host;
      const isLocalhost = String(hostHeader).includes('localhost');
      const protocol = req.headers['x-forwarded-proto'] ? String(req.headers['x-forwarded-proto']).split(',')[0] : (isLocalhost ? 'http' : 'https');
      const dynamicUrl = hostHeader ? `${protocol}://${hostHeader}` : 'https://hire-ai-sandy.vercel.app';
      
      let frontendUrl = process.env.FRONTEND_URL;
      if (!frontendUrl || frontendUrl === 'http://localhost:8080' || frontendUrl.includes('hire-ai-sandy')) {
        frontendUrl = dynamicUrl;
      }
      let invitesSent = 0;
      const failed: string[] = [];

      for (const c of candidates) {
        try {
          const token = crypto.randomBytes(32).toString('base64url');

          // Randomly select 5 questions from pool for each candidate
          let questions: any[];
          if (questionPool.length >= 5) {
            const shuffled = [...questionPool].sort(() => Math.random() - 0.5);
            questions = shuffled.slice(0, 5);
          } else if (questionPool.length > 0) {
            questions = [...questionPool].sort(() => Math.random() - 0.5);
          } else {
            // Fallback: generate questions on the fly (legacy behavior)
            questions = await generateInterviewQuestions(job);
          }

          await supabase.from('ai_interview_sessions').insert({
            id: uuidv4(),
            candidate_id: c.id,
            job_id,
            token,
            status: 'pending',
            current_question_index: 0,
            questions,
            responses: [],
            proctoring_data: { warnings: [], camera_enabled: false, microphone_enabled: false },
            created_at: new Date().toISOString(),
          });

          await sendInterviewInvite(c.email, c.full_name, job.title, `${frontendUrl}/ai-interview/${token}`, scheduled_time);
          invitesSent += 1;
        } catch {
          failed.push(c.id);
        }
      }

      return ok(res, { success: invitesSent > 0, invites_sent: invitesSent, failed });
    }

    return notFound(res);
  }

  // /api/interviews (minimal: list/create)
  if (segments[0] === 'interviews') {
    const user = await requireAuth(req, res);
    if (!user) return;

    if (segments.length === 1) {
      if (req.method === 'GET') {
        const { status, candidate_id, job_id } = req.query;
        const limit = parseInt((req.query.limit as string) || '50');

        let q = supabase.from('interview_sessions').select('*');
        if (status) q = q.eq('status', status);
        if (candidate_id) q = q.eq('candidate_id', candidate_id);
        if (job_id) q = q.eq('job_id', job_id);

        const { data, error } = await q.order('created_at', { ascending: false }).limit(limit);
        if (error) return res.status(500).json({ error: error.message });
        return ok(res, data);
      }

      if (req.method === 'POST') {
        const body = req.body;
        const sessionData = {
          candidate_id: body.candidate_id,
          job_id: body.job_id,
          screening_id: body.screening_id || null,
          scheduled_at: body.scheduled_at || null,
          status: 'pending',
          question_seed: `${body.candidate_id}-${body.job_id}-${Date.now()}`,
          proctoring_data: { tab_switches: 0, copy_paste_count: 0, fullscreen_exits: 0, warnings: [] },
        };

        const { data, error } = await supabase.from('interview_sessions').insert(sessionData).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return ok(res, data, 201);
      }

      return methodNotAllowed(res);
    }

    return notFound(res);
  }

  // /api/apply/* (public - no auth required)
  if (segments[0] === 'apply') {
    // GET /api/apply/job/:jobId - Public job details
    if (segments.length === 3 && segments[1] === 'job') {
      if (req.method !== 'GET') return methodNotAllowed(res);

      const jobId = segments[2];
      const { data: job, error } = await supabase
        .from('job_descriptions')
        .select('id, title, role, level, description, must_have_skills, good_to_have_skills, min_experience_years, is_active')
        .eq('id', jobId)
        .eq('is_active', true)
        .single();

      if (error || !job) return notFound(res, 'Job not found or no longer accepting applications');
      return ok(res, job);
    }

    // POST /api/apply/submit - Submit job application (multipart form)
    if (segments.length === 2 && segments[1] === 'submit') {
      if (req.method !== 'POST') return methodNotAllowed(res);

      // Parse multipart form data
      const fields: Record<string, string> = {};
      let resumeFile: { filename: string; mimeType: string; buffer: Buffer } | null = null;

      await new Promise<void>((resolve, reject) => {
        const ct = req.headers['content-type'] || '';
        if (!ct.includes('multipart/form-data')) {
          // JSON body fallback
          const body = req.body || {};
          Object.entries(body).forEach(([k, v]) => { fields[k] = String(v); });
          resolve();
          return;
        }

        const bb = Busboy({ headers: req.headers as any });
        bb.on('field', (name: string, val: string) => { fields[name] = val; });
        bb.on('file', (name: string, file: any, info: any) => {
          if (name === 'resume') {
            const chunks: Buffer[] = [];
            file.on('data', (d: Buffer) => chunks.push(Buffer.from(d)));
            file.on('end', () => {
              resumeFile = {
                filename: info.filename || 'resume.pdf',
                mimeType: info.mimeType || 'application/octet-stream',
                buffer: Buffer.concat(chunks),
              };
            });
          } else {
            file.resume();
          }
        });
        bb.on('finish', () => resolve());
        bb.on('error', (err: Error) => reject(err));
        req.pipe(bb);
      });

      const jobId = fields.job_id;
      const fullName = fields.full_name;
      const email = fields.email;
      const phone = fields.phone || null;
      const portfolioUrl = fields.portfolio_url || null;
      const githubUrl = fields.github_url || null;
      const consentGiven = fields.consent_given === 'true';

      if (!jobId || !fullName || !email) {
        return badRequest(res, 'job_id, full_name, and email are required');
      }

      if (!consentGiven) {
        return badRequest(res, 'Consent is required to submit application');
      }

      // Verify job exists and is active
      const { data: job } = await supabase
        .from('job_descriptions')
        .select('*')
        .eq('id', jobId)
        .eq('is_active', true)
        .single();

      if (!job) return notFound(res, 'Job not found or no longer accepting applications');

      // Check if candidate already exists
      const { data: existingCandidates } = await supabase
        .from('candidates')
        .select('id')
        .eq('email', email)
        .limit(1);

      let candidateId: string;

      if (existingCandidates && existingCandidates.length > 0) {
        candidateId = existingCandidates[0].id;

        // Check if already applied to this job
        const { data: existingApp } = await supabase
          .from('job_applications')
          .select('id')
          .eq('candidate_id', candidateId)
          .eq('job_id', jobId)
          .limit(1);

        if (existingApp && existingApp.length > 0) {
          return badRequest(res, 'You have already applied to this job');
        }

        // Update candidate info
        await supabase
          .from('candidates')
          .update({
            full_name: fullName,
            phone,
            portfolio_url: portfolioUrl,
            github_url: githubUrl,
            consent_given: consentGiven,
            consent_timestamp: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', candidateId);
      } else {
        // Create new candidate
        const candidateData: Record<string, any> = {
          full_name: fullName,
          email,
          phone,
          portfolio_url: portfolioUrl,
          github_url: githubUrl,
          consent_given: consentGiven,
          consent_timestamp: new Date().toISOString(),
        };

        const { data: newCandidate, error: createErr } = await supabase
          .from('candidates')
          .insert(candidateData)
          .select()
          .single();

        if (createErr || !newCandidate) {
          return res.status(500).json({ error: createErr?.message || 'Failed to create candidate' });
        }
        candidateId = newCandidate.id;
      }

      // Handle resume upload
      let resumeParsedData: any = null;
      let resumeText = '';
      if (resumeFile) {
        try {
          const rawText = await extractResumeText(resumeFile.buffer, resumeFile.filename);
          resumeText = String(rawText)
            .replace(/\x00/g, '')
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
            .slice(0, 50000);

          // Parse with AI
          try {
            const prompt = `You are an expert resume parser.\n\nParse the following resume and return ONLY valid JSON in this exact format:\n{\n  "skills": ["skill1"],\n  "experience": [{"title":"","company":"","duration":"","description":""}],\n  "education": [{"degree":"","institution":"","year":""}],\n  "summary": "",\n  "total_experience_years": 0,\n  "certifications": ["cert1"]\n}\n\nRESUME TEXT:\n${resumeText.slice(0, 8000)}`;
            resumeParsedData = await generateJSON<any>(prompt);
          } catch {
            resumeParsedData = null;
          }

          // Update candidate with resume data
          await supabase
            .from('candidates')
            .update({
              resume_text: resumeText,
              resume_parsed_data: resumeParsedData,
              updated_at: new Date().toISOString(),
            })
            .eq('id', candidateId);
        } catch (e: any) {
          console.error('Resume parsing error during apply:', e?.message);
        }
      }

      // Create job application
      const applicationId = uuidv4();
      const { error: appError } = await supabase
        .from('job_applications')
        .insert({
          id: applicationId,
          candidate_id: candidateId,
          job_id: jobId,
          status: 'applied',
          applied_at: new Date().toISOString(),
        });

      if (appError) {
        return res.status(500).json({ error: appError.message });
      }

      // Run ATS screening if resume was parsed
      if (resumeParsedData) {
        try {
          const prompt = `Analyze this candidate's resume against the job requirements and provide ATS screening scores.\n\nJob: ${job.title} (${job.role}, ${job.level})\nRequired Skills: ${(job.must_have_skills || []).join(', ')}\nNice-to-have Skills: ${(job.good_to_have_skills || []).join(', ')}\nMin Experience: ${job.min_experience_years} years\n\nCandidate Resume JSON:\n${JSON.stringify(resumeParsedData)}\n\nReturn JSON:\n{\n  "overall_score": 0-100,\n  "skill_relevance_score": 0-100,\n  "experience_score": 0-100,\n  "education_score": 0-100,\n  "credibility_score": 0-100,\n  "shortlisted": true/false,\n  "shortlist_reason": "...",\n  "reason_codes": [{"code":"SKILL_MATCH","type":"positive","description":"...","impact":10}]\n}`;
          const screeningResult = await generateJSON<any>(prompt);

          await supabase.from('ats_screenings').insert({
            candidate_id: candidateId,
            job_id: jobId,
            overall_score: screeningResult.overall_score,
            skill_relevance_score: screeningResult.skill_relevance_score ?? null,
            experience_score: screeningResult.experience_score ?? null,
            education_score: screeningResult.education_score ?? null,
            credibility_score: screeningResult.credibility_score ?? null,
            shortlisted: !!screeningResult.shortlisted,
            shortlist_reason: screeningResult.shortlist_reason ?? null,
            reason_codes: screeningResult.reason_codes ?? [],
            screened_at: new Date().toISOString(),
          });
        } catch (e: any) {
          console.error('ATS screening error during apply:', e?.message);
        }
      }

      // Send confirmation email
      try {
        await sendApplicationReceived(email, fullName, job.title);
      } catch (e: any) {
        console.error('Failed to send confirmation email:', e?.message);
      }

      return ok(res, {
        id: applicationId,
        job_id: jobId,
        candidate_id: candidateId,
        status: 'applied',
        message: `Application submitted successfully for ${job.title}. Check your email for confirmation.`,
      }, 201);
    }

    return notFound(res);
  }

  return notFound(res);
}


async function generateInterviewQuestions(job: { title: string; role: string; level: string; must_have_skills?: string[] }) {
  try {
    const prompt = `Generate 5 interview questions for ${job.level} ${job.role} (${job.title}). Skills: ${(job.must_have_skills || []).join(', ') || 'General'}. Return JSON array: [{"text":"Question","type":"technical|behavioral|situational","duration":120}]`;
    const questions = await generateJSON<any[]>(prompt);
    return questions.slice(0, 5);
  } catch {
    return [
      { text: `Tell me about your experience relevant to the ${job.role} role.`, type: 'behavioral', duration: 120 },
      { text: 'Describe a challenging project you worked on and how you overcame obstacles.', type: 'behavioral', duration: 120 },
      { text: `What technical skills do you bring to this ${job.title} position?`, type: 'technical', duration: 120 },
      { text: 'How do you approach problem-solving when facing unfamiliar challenges?', type: 'situational', duration: 120 },
      { text: 'Where do you see yourself in 5 years and how does this role fit into your career goals?', type: 'behavioral', duration: 120 },
    ];
  }
}

// ============== HackerEarth Code Execution Engine (Production-Grade) ==============

const HACKEREARTH_LANG_MAP: Record<string, string> = {
  python3: 'PYTHON3', javascript: 'JAVASCRIPT_NODE', java: 'JAVA14', cpp: 'CPP17',
  c: 'C', csharp: 'CSHARP', go: 'GO', ruby: 'RUBY', rust: 'RUST',
  typescript: 'TYPESCRIPT', kotlin: 'KOTLIN', swift: 'SWIFT',
};

const MONACO_LANG_MAP: Record<string, string> = {
  python3: 'python', javascript: 'javascript', java: 'java', cpp: 'cpp',
  c: 'c', csharp: 'csharp', go: 'go', ruby: 'ruby', rust: 'rust',
  typescript: 'typescript', kotlin: 'kotlin', swift: 'swift',
};

const LANG_DISPLAY_NAMES: Record<string, string> = {
  python3: 'Python 3', javascript: 'JavaScript', java: 'Java', cpp: 'C++',
  c: 'C', csharp: 'C#', go: 'Go', ruby: 'Ruby', rust: 'Rust',
  typescript: 'TypeScript', kotlin: 'Kotlin', swift: 'Swift',
};

function mapLanguageKey(lang: string): string {
  const n = lang.toLowerCase().replace(/[^a-z0-9+#]/g, '');
  if (n.includes('python') || n === 'py') return 'python3';
  if (n.includes('javascript') || n === 'js' || n === 'node') return 'javascript';
  if (n.includes('java') && !n.includes('script')) return 'java';
  if (n.includes('cpp') || n.includes('c++') || n === 'c17' || n === 'cpp17') return 'cpp';
  if (n.includes('typescript') || n === 'ts') return 'typescript';
  if (n.includes('csharp') || n === 'c#' || n === 'cs') return 'csharp';
  if (n === 'go' || n === 'golang') return 'go';
  if (n === 'ruby' || n === 'rb') return 'ruby';
  if (n === 'rust' || n === 'rs') return 'rust';
  if (n === 'kotlin' || n === 'kt') return 'kotlin';
  if (n === 'swift') return 'swift';
  return n || 'python3';
}

// Normalize output for strict comparison (handles trailing whitespace, newlines)
function normalizeOutput(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/\r\n/g, '\n').trim().replace(/\n+$/, '');
}

type TCInput = { id: string; input: string; expected_output: string; visibility?: string; time_limit_ms?: number; memory_limit_kb?: number };
type TCResult = {
  test_case_id: string; input: string; expected_output: string;
  actual_output: string | null; passed: boolean; status: string;
  time_used: string | null; memory_used: string | null;
  visibility: string; error: string | null;
};

// Rate-limiting: track recent submissions per session
const _submissionTimestamps: Record<string, number[]> = {};
function checkRateLimit(sessionId: string, maxPerMinute: number = 10): boolean {
  const now = Date.now();
  const cutoff = now - 60000;
  const stamps = (_submissionTimestamps[sessionId] || []).filter(t => t > cutoff);
  stamps.push(now);
  _submissionTimestamps[sessionId] = stamps;
  return stamps.length <= maxPerMinute;
}

// Poll HackerEarth for a single submission result
async function pollHEResult(pollUrl: string, secret: string, maxMs: number = 30000): Promise<any> {
  const start = Date.now();
  const intervals = [500, 1000, 1500, 2000, 2000, 3000, 3000, 4000, 5000, 5000];
  for (let i = 0; Date.now() - start < maxMs; i++) {
    const wait = intervals[Math.min(i, intervals.length - 1)];
    await new Promise(r => setTimeout(r, wait));
    try {
      const resp = await fetch(pollUrl, { headers: { 'client-secret': secret } });
      const data = await resp.json();
      const code = data.request_status?.code;
      if (code === 'REQUEST_COMPLETED' || code === 'REQUEST_FAILED') return data;
    } catch { /* retry */ }
  }
  return null;
}

// Fetch output from S3 URL returned by HackerEarth
async function fetchHEOutput(url: string | undefined): Promise<string | null> {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return null;
  try {
    const resp = await fetch(url);
    return normalizeOutput(await resp.text());
  } catch { return null; }
}

async function executeTestCasesViaHackerEarth(
  userCode: string, wrapperTemplate: string, langKey: string,
  testCases: TCInput[], defaultTimeLimitSec: number, defaultMemoryLimitKb: number,
): Promise<TCResult[]> {
  const secret = process.env.HACKEREARTH_CLIENT_SECRET;
  const heLang = HACKEREARTH_LANG_MAP[langKey];
  if (!secret || !heLang) {
    return executeTestCasesViaPiston(userCode, wrapperTemplate, langKey, testCases, defaultTimeLimitSec);
  }

  const fullSource = `${userCode}\n\n${wrapperTemplate}`;
  const results: TCResult[] = [];

  // Phase 1: Submit first test case to check for compilation errors
  const firstTC = testCases[0];
  const firstResult = await submitAndEvalSingleHE(fullSource, firstTC, heLang, secret, defaultTimeLimitSec, defaultMemoryLimitKb);
  results.push(firstResult);

  // Early termination: if CE, mark all remaining as CE (compilation is same for all)
  if (firstResult.status === 'CE') {
    for (let i = 1; i < testCases.length; i++) {
      results.push({
        test_case_id: testCases[i].id, input: testCases[i].input,
        expected_output: testCases[i].expected_output, actual_output: null,
        passed: false, status: 'CE', time_used: null, memory_used: null,
        visibility: testCases[i].visibility || 'public', error: firstResult.error,
      });
    }
    return results;
  }

  // Phase 2: Submit remaining test cases in parallel batches of 3
  const remaining = testCases.slice(1);
  const BATCH_SIZE = 3;
  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    const batch = remaining.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(tc => submitAndEvalSingleHE(fullSource, tc, heLang, secret, defaultTimeLimitSec, defaultMemoryLimitKb))
    );
    results.push(...batchResults);
  }

  return results;
}

// Submit a single test case to HackerEarth and evaluate
async function submitAndEvalSingleHE(
  source: string, tc: TCInput, heLang: string, secret: string,
  defaultTimeLimitSec: number, defaultMemoryLimitKb: number,
): Promise<TCResult> {
  const vis = tc.visibility || 'public';
  const timeLimitSec = tc.time_limit_ms ? Math.ceil(tc.time_limit_ms / 1000) : defaultTimeLimitSec;
  const memLimitKb = tc.memory_limit_kb || defaultMemoryLimitKb;

  try {
    const submitResp = await fetch('https://api.hackerearth.com/v4/partner/code-evaluation/submissions/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'client-secret': secret },
      body: JSON.stringify({
        lang: heLang, source, input: tc.input,
        time_limit: Math.min(timeLimitSec, 5),
        memory_limit: Math.min(memLimitKb, 262144),
      }),
    });
    const submitData = await submitResp.json();

    if (!submitData.he_id || !submitData.status_update_url) {
      return { test_case_id: tc.id, input: tc.input, expected_output: tc.expected_output,
        actual_output: null, passed: false, status: 'REQUEST_FAILED',
        time_used: null, memory_used: null, visibility: vis,
        error: submitData.errors?.message || submitData.request_status?.message || 'Submission failed' };
    }

    const result = await pollHEResult(submitData.status_update_url, secret, 30000);
    if (!result) {
      return { test_case_id: tc.id, input: tc.input, expected_output: tc.expected_output,
        actual_output: null, passed: false, status: 'TIMEOUT',
        time_used: null, memory_used: null, visibility: vis,
        error: 'Execution timed out (30s)' };
    }

    const runStatus = result.result?.run_status || {};
    const compileStatus = result.result?.compile_status || '';
    const status = runStatus.status || 'NA';

    // Compilation error
    if (compileStatus && compileStatus !== 'OK') {
      return { test_case_id: tc.id, input: tc.input, expected_output: tc.expected_output,
        actual_output: null, passed: false, status: 'CE',
        time_used: null, memory_used: null, visibility: vis,
        error: `Compilation Error: ${compileStatus}` };
    }

    const actualOutput = await fetchHEOutput(runStatus.output);

    // Runtime error / TLE / MLE
    if (status !== 'AC') {
      const errorMap: Record<string, string> = {
        'TLE': 'Time Limit Exceeded', 'MLE': 'Memory Limit Exceeded',
        'RE': `Runtime Error: ${runStatus.status_detail || ''}`.trim(),
        'NZEC': `Non-Zero Exit Code: ${runStatus.status_detail || ''}`.trim(),
        'SI': 'Signal Error', 'OTHER': runStatus.status_detail || 'Unknown Error',
      };
      return { test_case_id: tc.id, input: tc.input, expected_output: tc.expected_output,
        actual_output: actualOutput, passed: false, status: status === 'NZEC' ? 'RE' : status,
        time_used: runStatus.time_used || null, memory_used: runStatus.memory_used || null,
        visibility: vis, error: errorMap[status] || `Execution error: ${status}` };
    }

    // Strict output comparison
    const expected = normalizeOutput(tc.expected_output);
    const actual = normalizeOutput(actualOutput);
    const passed = actual === expected;

    return { test_case_id: tc.id, input: tc.input, expected_output: tc.expected_output,
      actual_output: actual, passed, status: passed ? 'AC' : 'WA',
      time_used: runStatus.time_used || null, memory_used: runStatus.memory_used || null,
      visibility: vis, error: passed ? null : 'Wrong Answer' };

  } catch (err: any) {
    return { test_case_id: tc.id, input: tc.input, expected_output: tc.expected_output,
      actual_output: null, passed: false, status: 'ERROR',
      time_used: null, memory_used: null, visibility: vis,
      error: err.message || 'Execution failed' };
  }
}

// Fallback: Piston API execution (when HackerEarth is not configured)
async function executeTestCasesViaPiston(
  userCode: string, wrapperTemplate: string, langKey: string,
  testCases: TCInput[], defaultTimeLimitSec: number,
): Promise<TCResult[]> {
  const pistonLangMap: Record<string, { language: string; version: string }> = {
    python3: { language: 'python', version: '3.10' },
    javascript: { language: 'javascript', version: '18.15' },
    java: { language: 'java', version: '15.0' },
    cpp: { language: 'c++', version: '10.2' },
    typescript: { language: 'typescript', version: '5.0' },
  };

  const pistonLang = pistonLangMap[langKey] || pistonLangMap.python3;
  const fullSource = `${userCode}\n\n${wrapperTemplate}`;
  const results: TCResult[] = [];

  // Run first test case to check compilation
  const firstResult = await runSinglePiston(fullSource, testCases[0], pistonLang, defaultTimeLimitSec);
  results.push(firstResult);

  if (firstResult.status === 'CE') {
    for (let i = 1; i < testCases.length; i++) {
      results.push({
        test_case_id: testCases[i].id, input: testCases[i].input,
        expected_output: testCases[i].expected_output, actual_output: null,
        passed: false, status: 'CE', time_used: null, memory_used: null,
        visibility: testCases[i].visibility || 'public', error: firstResult.error,
      });
    }
    return results;
  }

  // Run remaining sequentially (Piston free tier is rate-limited)
  for (let i = 1; i < testCases.length; i++) {
    results.push(await runSinglePiston(fullSource, testCases[i], pistonLang, defaultTimeLimitSec));
  }
  return results;
}

async function runSinglePiston(
  source: string, tc: TCInput,
  lang: { language: string; version: string }, timeLimitSec: number,
): Promise<TCResult> {
  const vis = tc.visibility || 'public';
  try {
    const resp = await fetch('https://emkc.org/api/v2/piston/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: lang.language, version: lang.version,
        files: [{ content: source }], stdin: tc.input, args: [],
        compile_timeout: 10000, run_timeout: timeLimitSec * 1000,
      }),
    });
    const data = await resp.json();
    const stdout = normalizeOutput(data.run?.stdout);
    const stderr = (data.run?.stderr || '').slice(0, 2000);

    if (data.compile?.stderr) {
      return { test_case_id: tc.id, input: tc.input, expected_output: tc.expected_output,
        actual_output: null, passed: false, status: 'CE', time_used: null, memory_used: null,
        visibility: vis, error: `Compilation Error: ${data.compile.stderr.slice(0, 2000)}` };
    }
    if ((data.run?.code || 0) !== 0 && !stdout) {
      return { test_case_id: tc.id, input: tc.input, expected_output: tc.expected_output,
        actual_output: null, passed: false, status: 'RE', time_used: null, memory_used: null,
        visibility: vis, error: `Runtime Error: ${stderr}` };
    }

    const expected = normalizeOutput(tc.expected_output);
    const passed = stdout === expected;
    return { test_case_id: tc.id, input: tc.input, expected_output: tc.expected_output,
      actual_output: stdout, passed, status: passed ? 'AC' : 'WA',
      time_used: null, memory_used: null, visibility: vis,
      error: passed ? null : (stderr || 'Wrong Answer') };
  } catch (err: any) {
    return { test_case_id: tc.id, input: tc.input, expected_output: tc.expected_output,
      actual_output: null, passed: false, status: 'ERROR', time_used: null, memory_used: null,
      visibility: vis, error: err.message || 'Execution failed' };
  }
}

// ============== End HackerEarth Engine ==============

async function generateInterviewQuestionPool(job: { title: string; role: string; level: string; must_have_skills: string[]; description: string }) {
  const skills = job.must_have_skills.join(', ') || 'General';
  const prompt = `Generate exactly 15 diverse interview questions for a ${job.level} ${job.role} position (${job.title}).
Skills to assess: ${skills}.
${job.description ? `Job context: ${job.description.slice(0, 500)}` : ''}

Create a balanced mix:
- 7 technical questions testing specific skills and knowledge
- 4 behavioral questions about past experiences and teamwork
- 4 situational questions with hypothetical scenarios

Each question should be distinct and test a different aspect.
Vary difficulty from moderate to advanced for ${job.level} level.

Return JSON array: [{"text":"The question text","type":"technical|behavioral|situational","duration":120}]
Only return the JSON array.`;

  try {
    const raw = await generateJSON<any>(prompt);
    const questions = Array.isArray(raw) ? raw : Array.isArray(raw?.questions) ? raw.questions : [];
    return questions
      .filter((q: any) => q?.text && q?.type)
      .map((q: any) => ({
        text: String(q.text),
        type: String(q.type),
        duration: typeof q.duration === 'number' ? q.duration : 120,
      }))
      .slice(0, 15);
  } catch (e: any) {
    console.error('Failed to generate interview question pool:', e.message);
    return [];
  }
}
