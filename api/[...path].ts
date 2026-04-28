import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as jose from 'jose';
import crypto from 'node:crypto';
import Busboy from 'busboy';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

/**
 * AI Interview STT Route (server-side transcription)
 * POST /api/ai-interview/:sessionId/transcribe-store
 * Request JSON: {
 *   question_index: number,
 *   audio_base64: string,
 *   mime_type?: string,
 *   audio_duration_seconds?: number
 * }
 * Response JSON: { success: true, question_index: number, transcript_length: number }
 */

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

async function generateAssessmentMcqsForJob(opts: {
  job: {
    title?: string;
    role?: string;
    level?: string;
    description?: string;
    must_have_skills?: string[];
    good_to_have_skills?: string[];
  };
  mcqCount: number;
  difficulty: string;
}): Promise<any[]> {
  const { job, mcqCount, difficulty } = opts;
  if (mcqCount < 1) return [];

  const mapped = mapAssessmentDifficulty(difficulty);
  const mustHaveSkills = (job.must_have_skills || []).join(', ') || 'general programming';
  const goodToHaveSkills = (job.good_to_have_skills || []).join(', ');
  const normalizeQuestions = (raw: any[], defaultDifficulty: string): any[] => {
    return raw
      .map((q: any, i: number) => ({
        id: String(q?.id || `q${i + 1}`),
        question: String(q?.question || '').trim(),
        options: Array.isArray(q?.options) ? q.options.map((o: any) => String(o).trim()).slice(0, 4) : [],
        correct_index: typeof q?.correct_index === 'number' ? q.correct_index : 0,
        difficulty: String(q?.difficulty || defaultDifficulty),
        topic: String(q?.topic || 'General'),
        points: typeof q?.points === 'number' ? q.points : 5,
        explanation: String(q?.explanation || ''),
      }))
      .filter((q: any) => q.question && q.options.length === 4);
  };

  const buildPrompt = (batchCount: number, excludedQuestions: string[]): string => `You are an expert technical assessment designer. Generate exactly ${batchCount} high-quality multiple-choice questions for a ${job.level} ${job.role} assessment.

Job Title: ${job.title}
Job Description: ${(job.description || '').slice(0, 600)}
Required Skills: ${mustHaveSkills}
${goodToHaveSkills ? `Nice-to-Have Skills: ${goodToHaveSkills}` : ''}
Difficulty Level: ${mapped.label} - ${mapped.guidance}

QUESTION RULES:
- Prefer real-world scenario-based questions over pure definitions.
- Cover required skills evenly.
- Mix question types: code output prediction, best-practice selection, error identification, architecture choices.
- Vary the correct answer position (correct_index).
${excludedQuestions.length ? `- DO NOT repeat or paraphrase these already generated questions:\n${excludedQuestions.map((q, idx) => `${idx + 1}. ${q}`).join('\n')}` : ''}

OPTION RULES (CRITICAL):
- Each of the 4 options MUST start with different words and use different sentence structures.
- NEVER create permutation-style options.
- Distractor pattern: 1 plausible misconception, 1 partially correct, 1 technically-sounding but wrong.

Return ONLY this JSON structure:
{
  "questions": [
    {
      "id": "q1",
      "question": "<scenario-based question text>",
      "options": ["<option A>", "<option B>", "<option C>", "<option D>"],
      "correct_index": 0,
      "difficulty": "${mapped.label}",
      "topic": "<skill topic>",
      "points": 5,
      "explanation": "<1-2 sentence explanation of why the correct answer is right>"
    }
  ]
}`;

  const generateBatch = async (batchCount: number, excludedQuestions: string[]): Promise<any[]> => {
    const prompt = buildPrompt(batchCount, excludedQuestions);
    const maxTokens = Math.min(12000, 900 + (batchCount * 260));
    const generated = await Promise.race<any>([
      generateJSON<any>(prompt, { maxTokens }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('MCQ generation timed out')), 18000)),
    ]);
    const raw = Array.isArray(generated)
      ? generated
      : (Array.isArray(generated?.questions) ? generated.questions : []);
    return normalizeQuestions(raw, difficulty);
  };

  const questions: any[] = [];
  const seen = new Set<string>();
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts && questions.length < mcqCount; attempt += 1) {
    const remaining = mcqCount - questions.length;
    const chunkSize = remaining > 12 ? 6 : 5;
    const chunks: number[] = [];
    for (let left = remaining; left > 0; left -= chunkSize) {
      chunks.push(Math.min(chunkSize, left));
    }

    const excluded = questions.map((q: any) => q.question).slice(-20);
    const batchResults = await Promise.allSettled(chunks.map((c) => generateBatch(c, excluded)));

    for (const result of batchResults) {
      if (result.status !== 'fulfilled') continue;
      for (const q of result.value) {
        const key = String(q.question || '').toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        questions.push({ ...q, id: `q${questions.length + 1}` });
        if (questions.length === mcqCount) break;
      }
      if (questions.length === mcqCount) break;
    }
  }

  if (questions.length !== mcqCount) {
    throw new Error(`MCQ generation returned ${questions.length} questions; expected ${mcqCount}`);
  }

  return questions;
}

function normalizeBaseUrl(u: string): string {
  return String(u || '').trim().replace(/\/+$/, '');
}

function resolveFrontendBaseUrl(req: VercelRequest): string {
  const hostHeader = req.headers['x-forwarded-host'] || req.headers.host;
  const isLocalhost = String(hostHeader || '').includes('localhost');
  const protocol = req.headers['x-forwarded-proto']
    ? String(req.headers['x-forwarded-proto']).split(',')[0]
    : (isLocalhost ? 'http' : 'https');
  const dynamicUrl = hostHeader ? `${protocol}://${hostHeader}` : 'https://hiretec.netlify.app';

  let frontendUrl = process.env.FRONTEND_URL;
  if (
    !frontendUrl ||
    frontendUrl === 'http://localhost:8080' ||
    frontendUrl === 'http://localhost:5173' ||
    frontendUrl.includes('hire-ai-sandy')
  ) {
    frontendUrl = dynamicUrl;
  }

  return normalizeBaseUrl(frontendUrl);
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

// ============== INLINE: OpenAI ==============
let _openai: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!_openai) {
    const k = process.env.OPENAI_API_KEY;
    if (!k) throw new Error('OPENAI_API_KEY not configured');
    _openai = new OpenAI({ apiKey: k });
  }
  return _openai;
}
async function generateText(prompt: string, opts: { temperature?: number; maxTokens?: number } = {}): Promise<string> {
  const client = getOpenAIClient();
  const completion = await client.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 2048,
  });
  return completion.choices[0]?.message?.content || '';
}
async function generateJSON<T>(prompt: string, opts?: { maxTokens?: number; temperature?: number }): Promise<T> {
  const client = getOpenAIClient();
  const completion = await client.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      { role: 'system', content: 'You are a helpful assistant that ONLY responds with valid JSON. No markdown, no code blocks, no explanation - just the JSON object or array.' },
      { role: 'user', content: prompt },
    ],
    temperature: opts?.temperature ?? 0.3,
    max_tokens: opts?.maxTokens ?? 8192,
    response_format: { type: 'json_object' },
  });
  const text = (completion.choices[0]?.message?.content || '').trim();
  if (!text) throw new Error('Empty AI response');
  try { return JSON.parse(text) as T; }
  catch (e) {
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
async function sendEmail(to: string, subject: string, html: string, attachments?: any[]) {
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

function getFrontendBaseUrl(req: any): string {
  const normalize = (u: string) => String(u || '').replace(/\/+$/, '');

  const explicit = normalize(process.env.FRONTEND_URL || '');
  if (explicit) return explicit;

  const origin = normalize((req.headers?.origin as string) || '');
  if (origin) return origin;

  const hostHeader = (req.headers['x-forwarded-host'] || req.headers.host) as string | undefined;
  const isLocalhost = String(hostHeader || '').includes('localhost');
  const protocol = req.headers['x-forwarded-proto']
    ? String(req.headers['x-forwarded-proto']).split(',')[0]
    : (isLocalhost ? 'http' : 'https');

  const dynamicUrl = hostHeader ? `${protocol}://${hostHeader}` : '';
  return normalize(dynamicUrl || 'https://hire-ai-sandy.vercel.app');
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

async function sendOfferLetterEmail(
  to: string,
  candidateName: string,
  jobTitle: string,
  companyName: string,
  pdfBase64: string
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
                  <li>If you accept, please reply to this email confirming your acceptance</li>
                  <li>Our HR team will follow up with onboarding details</li>
              </ul>
          </div>
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

  await sendEmail(to, `Formal Offer Letter – ${jobTitle} at ${companyName}`, html, attachments);
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
  free: { max_jobs: 10, max_assessments: 25, max_interviews: 25, price: 0, label: 'Free' },
  pro: { max_jobs: 1000, max_assessments: 999999, max_interviews: 999999, price: 3613, label: 'Pro (Monthly)' },
  pro_yearly: { max_jobs: 1000, max_assessments: 999999, max_interviews: 999999, price: 36133, label: 'Pro (Yearly)' },
  premium: { max_jobs: 999999, max_assessments: 999999, max_interviews: 999999, price: 9637, label: 'Premium (Monthly)' },
  premium_yearly: { max_jobs: 999999, max_assessments: 999999, max_interviews: 999999, price: 96373, label: 'Premium (Yearly)' },
};

function getPlanLimits(plan: string) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
}

type BillingPlan = 'none' | 'pro' | 'premium';
type BillingStatus = 'active' | 'paused';
type BillableFeature =
  | 'create_job'
  | 'resume_parse'
  | 'candidate_scoring'
  | 'assessment_invite'
  | 'ai_interview_invite'
  | 'regenerate_interview_questions'
  | 'assessment_mcq_generation';

const BILLING_PLAN_CONFIG: Record<BillingPlan, {
  credit_amount: number;
}> = {
  none: {
    credit_amount: 0,
  },
  pro: {
    credit_amount: 36.13,
  },
  premium: {
    credit_amount: 96.37,
  },
};

const FEATURE_COSTS: Record<BillableFeature, number> = {
  create_job: 0.18,
  resume_parse: 0.1,
  candidate_scoring: 0.14,
  assessment_invite: 0.12,
  ai_interview_invite: 0.3,
  regenerate_interview_questions: 0.06,
  assessment_mcq_generation: 0.24,
};

function normalizeBillingPlan(rawPlan: string | null | undefined): BillingPlan {
  const p = String(rawPlan || 'none').toLowerCase();
  if (p.startsWith('pro')) return 'pro';
  if (p.startsWith('premium')) return 'premium';
  return 'none';
}

/** Clamp any arbitrary profile status string to one of the two allowed values
 *  so the subscriptions table CHECK constraint is never violated. */
function normalizeBillingStatus(rawStatus: string | null | undefined): BillingStatus {
  const s = String(rawStatus || 'active').toLowerCase();
  if (s === 'paused') return 'paused';
  return 'active'; // default — covers null, '', 'trialing', 'inactive', etc.
}

async function getOrCreateSubscription(supabase: SupabaseClient, userId: string) {
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) return existing;

  const profile = await getUserProfile(supabase, userId);
  const plan = normalizeBillingPlan(profile?.subscription_plan);
  const cfg = BILLING_PLAN_CONFIG[plan];

  // Normalize status so it always satisfies the DB CHECK constraint
  const status = normalizeBillingStatus(profile?.subscription_status);

  const { data: created, error } = await supabase
    .from('subscriptions')
    .insert({
      user_id: userId,
      plan,
      status,
      credit_amount: cfg.credit_amount,
      wallet_balance: cfg.credit_amount,
      metadata: { source: 'auto-bootstrap' },
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return created;
}

async function aggregateUsageByFeature(
  supabase: SupabaseClient,
  userId: string,
  fromIso: string,
  toIso: string,
) {
  const { data } = await supabase
    .from('usage_events')
    .select('feature_type, quantity, unit_cost, total_cost, created_at')
    .eq('user_id', userId)
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
    .order('created_at', { ascending: false });

  const byFeature: Record<string, { quantity: number; total_cost: number }> = {};
  let totalCost = 0;
  for (const ev of (data || [])) {
    const f = String(ev.feature_type);
    if (!byFeature[f]) byFeature[f] = { quantity: 0, total_cost: 0 };
    byFeature[f].quantity += Number(ev.quantity || 1);
    byFeature[f].total_cost += Number(ev.total_cost || 0);
    totalCost += Number(ev.total_cost || 0);
  }

  return { byFeature, totalCost };
}

async function createInvoiceForOverage(
  supabase: SupabaseClient,
  userId: string,
  amount: number,
  lineItems: any[],
) {
  if (amount <= 0) return null;

  const { data: existingPending } = await supabase
    .from('invoices')
    .select('id, total')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingPending) {
    await supabase
      .from('invoices')
      .update({
        total: Number(existingPending.total || 0) + amount,
        subtotal: Number(existingPending.total || 0) + amount,
        line_items: lineItems,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingPending.id);
    return existingPending.id;
  }

  const now = new Date();
  const due = new Date(now);
  due.setDate(due.getDate() + 7);

  const { data: created, error } = await supabase
    .from('invoices')
    .insert({
      user_id: userId,
      period_start: now.toISOString(),
      period_end: now.toISOString(),
      line_items: lineItems,
      subtotal: amount,
      tax_amount: 0,
      total: amount,
      status: 'pending',
      due_date: due.toISOString(),
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return created?.id || null;
}

async function sendBillingWarningEmail(userEmail: string, plan: BillingPlan, walletBalance: number) {
  if (!userEmail) return;
  await sendEmail(
    userEmail,
    'Your HireAI wallet is running low',
    `<h2>Wallet usage alert</h2><p>Your ${plan.toUpperCase()} wallet balance is now <strong>$${walletBalance.toFixed(2)}</strong>.</p><p>Top up now to avoid service interruptions.</p>`,
  );
}

async function sendBillingPausedEmail(userEmail: string) {
  if (!userEmail) return;
  await sendEmail(
    userEmail,
    'Services paused — pay now to resume',
    `<h2>Services paused</h2><p>Your HireAI wallet is exhausted. New job posting and AI generation features are paused.</p><p>Please add funds or pay pending invoices to resume service.</p>`,
  );
}

async function checkPlanAccess(
  supabase: SupabaseClient,
  userId: string,
  feature: BillableFeature,
  options?: { quantity?: number; jobId?: string; candidateId?: string; metadata?: Record<string, any> },
) {
  const quantity = Math.max(1, Number(options?.quantity || 1));
  const profile = await getUserProfile(supabase, userId);
  const subscription = await getOrCreateSubscription(supabase, userId);
  const plan = normalizeBillingPlan(subscription.plan || profile?.subscription_plan);
  const cfg = BILLING_PLAN_CONFIG[plan];

  if (subscription.status === 'paused') {
    return {
      allowed: false,
      status: 402,
      error: 'billing_paused',
      message: 'Your account is paused due to insufficient credits. Please add credits to continue.',
      plan,
      wallet_balance: Number(subscription.wallet_balance || 0),
    };
  }

  const unitCost = FEATURE_COSTS[feature] ?? 0;
  const totalCost = unitCost * quantity;
  const currentWallet = Number(subscription.wallet_balance || 0);
  const newWallet = currentWallet - totalCost;

  // If no credits, block the request
  if (newWallet < 0) {
    return {
      allowed: false,
      status: 402,
      error: 'insufficient_credits',
      message: 'Insufficient credits. Please purchase a plan or add credits to continue.',
      plan,
      wallet_balance: currentWallet,
      required: totalCost,
    };
  }

  await supabase.from('usage_events').insert({
    user_id: userId,
    feature_type: feature,
    unit_cost: unitCost,
    quantity,
    total_cost: totalCost,
    job_id: options?.jobId || null,
    candidate_id: options?.candidateId || null,
    metadata: options?.metadata || {},
  });

  const updatePayload: Record<string, any> = {
    wallet_balance: newWallet,
    updated_at: new Date().toISOString(),
  };

  // Pause if wallet is exhausted
  if (newWallet <= 0) {
    updatePayload.status = 'paused';
    if (profile?.email) {
      sendBillingPausedEmail(profile.email).catch(() => null);
    }
  }

  await supabase.from('subscriptions').update(updatePayload).eq('id', subscription.id);

  if (newWallet <= 0) {
    return {
      allowed: false,
      status: 402,
      error: 'billing_paused',
      message: 'Credits exhausted. Services are paused. Please add credits to resume.',
      plan,
      wallet_balance: 0,
      charged: totalCost,
    };
  }

  return {
    allowed: true,
    plan,
    wallet_balance: newWallet,
    charged: totalCost,
  };
}

async function getUserProfile(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
  return data;
}

// ============== Stripe Helpers ==============
function getStripeSecretKey(): string {
  return process.env.STRIPE_SECRET_KEY || '';
}

async function createStripeCheckoutSession(
  amount: number,
  planLabel: string,
  planId: string,
  successUrl: string,
  cancelUrl: string,
  metadata?: Record<string, string>,
) {
  const payload = new URLSearchParams({
    'mode': 'payment',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][product_data][name]': `Hire.AI ${planLabel}`,
    'line_items[0][price_data][unit_amount]': String(amount),
    'line_items[0][quantity]': '1',
    'success_url': successUrl,
    'cancel_url': cancelUrl,
    'metadata[plan]': planId,
  });

  if (metadata) {
    Object.entries(metadata).forEach(([key, value]) => {
      payload.append(`metadata[${key}]`, String(value));
    });
  }

  const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getStripeSecretKey()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: payload.toString(),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Stripe checkout session creation failed: ${err}`);
  }
  return resp.json() as Promise<{ id: string; url: string }>;
}

async function getStripeCheckoutSession(sessionId: string) {
  const resp = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: {
      Authorization: `Bearer ${getStripeSecretKey()}`,
    },
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Stripe session retrieval failed: ${err}`);
  }
  return resp.json() as Promise<{ id: string; payment_status: string; payment_intent: string | null; metadata: Record<string, string> }>;
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
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
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
        .maybeSingle();

      if (upErr) return res.status(500).json({ error: upErr.message });
      if (!updated) return res.status(404).json({ error: 'Profile not found' });
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
      
      // Dynamically resolve frontend URL from request headers
      const hostHeader = req.headers['x-forwarded-host'] || req.headers.host;
      const isLocalhost = String(hostHeader).includes('localhost');
      const protocol = req.headers['x-forwarded-proto'] ? String(req.headers['x-forwarded-proto']).split(',')[0] : (isLocalhost ? 'http' : 'https');
      const dynamicUrl = hostHeader ? `${protocol}://${hostHeader}` : 'https://hire-ai-sandy.vercel.app';
      
      let frontendUrl = process.env.FRONTEND_URL;
      if (!frontendUrl || frontendUrl === 'http://localhost:5173' || frontendUrl === 'http://localhost:8080' || frontendUrl.includes('hire-ai-sandy')) {
        frontendUrl = dynamicUrl;
      }
      
      const successUrl = `${frontendUrl}/onboarding?session_id={CHECKOUT_SESSION_ID}&plan=${plan}`;
      const cancelUrl = `${frontendUrl}/onboarding?cancelled=true`;

      try {
        const session = await createStripeCheckoutSession(
          limits.price,
          limits.label,
          plan,
          successUrl,
          cancelUrl,
        );

        return ok(res, {
          session_id: session.id,
          url: session.url,
          plan,
        });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    }

    // POST /api/subscription/verify
    if (req.method === 'POST' && segments.length === 2 && segments[1] === 'verify') {
      const { session_id, plan } = req.body || {};

      if (!session_id || !plan) {
        return badRequest(res, 'Missing session_id or plan');
      }

      try {
        const session = await getStripeCheckoutSession(session_id);
        if (session.payment_status !== 'paid') {
          return res.status(400).json({ error: 'Payment not completed' });
        }

        // Activate the plan
        const { data: updated, error: upErr } = await supabase
          .from('profiles')
          .update({
            subscription_plan: plan,
            subscription_id: session_id,
            stripe_payment_id: session.payment_intent || session_id,
            subscription_status: 'active',
            plan_selected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .select()
          .maybeSingle();

        if (upErr) return res.status(500).json({ error: upErr.message });

        return ok(res, {
          success: true,
          plan,
          message: `${getPlanLimits(plan).label} plan activated successfully!`,
          profile: updated,
        });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
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
        .maybeSingle();

      if (upErr) return res.status(500).json({ error: upErr.message });
      return ok(res, { success: true, plan: 'free', profile: updated });
    }

    /**
     * Cancel Subscription
     * Method: POST
     * Path: /api/subscription/cancel
     * Request body: {}
     * Response shape: { success: boolean, message: string }
     */
    if (req.method === 'POST' && segments.length === 2 && segments[1] === 'cancel') {
      const profile = await getUserProfile(supabase, user.id);
      if (!profile || !profile.subscription_id) {
        return badRequest(res, 'No active subscription found');
      }

      // We mark it as 'cancel_at_period_end' in our database
      const { error: upErr } = await supabase
        .from('profiles')
        .update({
          subscription_status: 'cancel_at_period_end',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (upErr) return res.status(500).json({ error: upErr.message });
      return ok(res, {
        success: true,
        message: 'Subscription cancelled. Access continues until the end of the billing period.'
      });
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

  // /api/billing/*
  if (segments[0] === 'billing') {
    // POST /api/billing/webhook (Stripe)
    if (segments.length === 2 && segments[1] === 'webhook' && req.method === 'POST') {
      const event = req.body || {};
      const type = String(event?.type || '');
      const obj = event?.data?.object || {};
      if (type === 'checkout.session.completed') {
        const metadata = obj.metadata || {};
        const userId = metadata.user_id as string | undefined;
        const action = metadata.action as string | undefined;
        const amount = Number((obj.amount_total || 0) / 100);
        if (userId && amount > 0) {
          const sub = await getOrCreateSubscription(supabase, userId);
          if (action === 'topup') {
            await supabase.from('subscriptions').update({
              wallet_balance: Number(sub.wallet_balance || 0) + amount,
              credit_amount: Number(sub.credit_amount || 0) + amount,
              status: 'active',
              updated_at: new Date().toISOString(),
            }).eq('id', sub.id);

            const profile = await getUserProfile(supabase, userId);
            if (profile?.email) {
              await sendEmail(
                profile.email,
                'Credits added',
                `<h2>Payment confirmed</h2><p>Your payment of <strong>$${amount.toFixed(2)}</strong> was successful and credits have been added to your wallet.</p>`,
              );
            }
          }

          if (action === 'subscribe') {
            const nextPlan = normalizeBillingPlan(metadata.plan as string);
            const cfg = BILLING_PLAN_CONFIG[nextPlan];
            const now = new Date();

            // Add credits to existing wallet
            const currentBalance = Number(sub.wallet_balance || 0);
            const newBalance = currentBalance + (amount || cfg.credit_amount);
            const newCreditAmount = Number(sub.credit_amount || 0) + (amount || cfg.credit_amount);

            await supabase.from('subscriptions').update({
              plan: nextPlan,
              status: 'active',
              credit_amount: newCreditAmount,
              wallet_balance: newBalance,
              updated_at: now.toISOString(),
            }).eq('id', sub.id);

            await supabase.from('profiles').update({
              subscription_plan: nextPlan,
              subscription_status: 'active',
              subscription_id: obj.id,
              stripe_payment_id: obj.payment_intent || obj.id,
              plan_selected_at: now.toISOString(),
              updated_at: now.toISOString(),
            }).eq('user_id', userId);
          }
        }
      }
      return ok(res, { received: true });
    }

    const user = await requireAuth(req, res);
    if (!user) return;

    // POST /api/billing/subscribe
    if (segments.length === 2 && segments[1] === 'subscribe' && req.method === 'POST') {
      const requestedPlan = normalizeBillingPlan(req.body?.plan);
      if (requestedPlan === 'none') {
        return badRequest(res, 'Cannot subscribe to none plan');
      }

      const cfg = BILLING_PLAN_CONFIG[requestedPlan];
      const hostHeader = req.headers['x-forwarded-host'] || req.headers.host;
      const isLocalhost = String(hostHeader).includes('localhost');
      const protocol = req.headers['x-forwarded-proto'] ? String(req.headers['x-forwarded-proto']).split(',')[0] : (isLocalhost ? 'http' : 'https');
      const dynamicUrl = hostHeader ? `${protocol}://${hostHeader}` : 'https://hire-ai-sandy.vercel.app';
      const frontendUrl = process.env.FRONTEND_URL || dynamicUrl;
      const successUrl = `${frontendUrl}/billing?checkout=success&action=subscribe`;
      const cancelUrl = `${frontendUrl}/billing?checkout=cancelled&action=subscribe`;

      const session = await createStripeCheckoutSession(
        Math.round(cfg.credit_amount * 100),
        `${requestedPlan.toUpperCase()} Credits`,
        requestedPlan,
        successUrl,
        cancelUrl,
        {
          action: 'subscribe',
          user_id: user.id,
          plan: requestedPlan,
        },
      );

      return ok(res, {
        success: true,
        session_id: session.id,
        checkout_url: session.url,
        plan: requestedPlan,
        credit_amount: cfg.credit_amount,
      });
    }

    // GET /api/billing/usage
    if (segments.length === 2 && segments[1] === 'usage' && req.method === 'GET') {
      const subscription = await getOrCreateSubscription(supabase, user.id);
      const plan = normalizeBillingPlan(subscription.plan);
      const cfg = BILLING_PLAN_CONFIG[plan];
      
      // Get all usage (no time limit for credit-based system)
      const aggregated = await aggregateUsageByFeature(
        supabase, 
        user.id, 
        '1970-01-01T00:00:00.000Z', 
        new Date().toISOString()
      );

      return ok(res, {
        plan,
        status: subscription.status,
        wallet_balance: Number(subscription.wallet_balance || 0),
        credit_amount: Number(subscription.credit_amount || 0),
        limits: {
          feature_costs: FEATURE_COSTS,
        },
        usage_breakdown: aggregated.byFeature,
        usage_total_cost: aggregated.totalCost,
      });
    }

    // POST /api/billing/topup
    if (segments.length === 2 && segments[1] === 'topup' && req.method === 'POST') {
      const amount = Number(req.body?.amount || 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        return badRequest(res, 'Valid amount is required');
      }

      const hostHeader = req.headers['x-forwarded-host'] || req.headers.host;
      const isLocalhost = String(hostHeader).includes('localhost');
      const protocol = req.headers['x-forwarded-proto'] ? String(req.headers['x-forwarded-proto']).split(',')[0] : (isLocalhost ? 'http' : 'https');
      const dynamicUrl = hostHeader ? `${protocol}://${hostHeader}` : 'https://hire-ai-sandy.vercel.app';
      const frontendUrl = process.env.FRONTEND_URL || dynamicUrl;

      const session = await createStripeCheckoutSession(
        Math.round(amount * 100),
        'Wallet Top-up',
        'topup',
        `${frontendUrl}/billing?checkout=success&action=topup`,
        `${frontendUrl}/billing?checkout=cancelled&action=topup`,
        {
          action: 'topup',
          user_id: user.id,
          amount: String(amount),
        },
      );

      return ok(res, {
        success: true,
        session_id: session.id,
        checkout_url: session.url,
      });
    }


    return methodNotAllowed(res);
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
        if (is_active === 'false') q = q.eq('is_active', false);
        else q = q.eq('is_active', true);
        const { data, error } = await q.order('created_at', { ascending: false });
        if (error) return res.status(500).json({ error: error.message });
        return ok(res, data);
      }

      if (req.method === 'POST') {
        const user = await requireAuth(req, res);
        if (!user) return;

        const billingGate = await checkPlanAccess(supabase, user.id, 'create_job');
        if (!billingGate.allowed) {
          return res.status(billingGate.status || 402).json(billingGate);
        }

        // ---- Usage Limit Check ----
        const profile = await getUserProfile(supabase, user.id);
        if (profile) {
          const plan = profile.subscription_plan || 'free';
          const limits = getPlanLimits(plan);
          const currentJobs = profile.jobs_count || 0;
          if (currentJobs >= limits.max_jobs) {
            // Return plan-specific error messages
            let errorMessage: string;
            if (plan === 'free' || plan.startsWith('free')) {
              errorMessage = "You've reached the free plan limit for creating jobs.";
            } else if (plan === 'pro' || plan.startsWith('pro')) {
              errorMessage = "You've reached the pro plan limit for creating jobs.";
            } else {
              errorMessage = `You have reached the maximum of ${limits.max_jobs} job roles on the ${limits.label} plan. Please upgrade to create more.`;
            }
            return res.status(403).json({
              error: 'limit_exceeded',
              message: errorMessage,
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
          resume_cutoff: body.resume_cutoff ?? 35,
          assessment_cutoff: body.assessment_cutoff ?? 40,
          interview_cutoff: body.interview_cutoff ?? 40,
          location: body.location || null,
          endCustomer: body.endCustomer || null,
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

        // Allow only safe, known fields to be updated (prevents overwriting created_by, id, etc.)
        const body = req.body || {};
        const allowedFields: Record<string, any> = {};
        const safeKeys = [
          'title', 'role', 'level', 'description',
          'must_have_skills', 'good_to_have_skills', 'min_experience_years',
          'is_active', 'resume_cutoff', 'assessment_cutoff', 'interview_cutoff',
          'interview_question_pool', 'location', 'endCustomer'
        ];
        for (const key of safeKeys) {
          if (key in body) allowedFields[key] = body[key];
        }
        allowedFields.updated_at = new Date().toISOString();

        // First verify the job exists and belongs to this user
        const { data: existingJob } = await supabase
          .from('job_descriptions')
          .select('id')
          .eq('id', jobId)
          .eq('created_by', user.id)
          .maybeSingle();

        if (!existingJob) return notFound(res, 'Job not found or access denied');

        const { data, error } = await supabase
          .from('job_descriptions')
          .update(allowedFields)
          .eq('id', jobId)
          .eq('created_by', user.id)
          .select()
          .maybeSingle();

        if (error) return res.status(500).json({ error: error.message });
        if (!data) return notFound(res, 'Job not found or access denied');
        return ok(res, data);
      }

      if (req.method === 'DELETE') {
        const user = await requireAuth(req, res);
        if (!user) return;

        const permanent = req.query.permanent === 'true';

        if (permanent) {
          // Verify job belongs to user first
          const { data: job } = await supabase
            .from('job_descriptions')
            .select('id')
            .eq('id', jobId)
            .eq('created_by', user.id)
            .single();

          if (!job) return notFound(res, 'Job not found');

          try {
            // 1. Delete assessment sessions for this job
            await supabase.from('assessment_sessions').delete().eq('job_id', jobId);

            // 2. Delete interview sessions (and cascaded questions/responses/evaluations via DB FK)
            await supabase.from('interview_sessions').delete().eq('job_id', jobId);

            // 3. Delete ATS screenings for this job
            await supabase.from('ats_screenings').delete().eq('job_id', jobId);

            // 4. Delete job applications for this job
            await supabase.from('job_applications').delete().eq('job_id', jobId);

            // 5. Delete candidates that are only associated with this job (no other job applications)
            const { data: jobCandidates } = await supabase
              .from('candidates')
              .select('id, job_id')
              .eq('job_id', jobId);

            if (jobCandidates && jobCandidates.length > 0) {
              for (const candidate of jobCandidates) {
                // Check if candidate has applications to other jobs
                const { data: otherApps } = await supabase
                  .from('job_applications')
                  .select('id')
                  .eq('candidate_id', candidate.id)
                  .neq('job_id', jobId)
                  .limit(1);

                // Check if candidate is linked to other jobs via other tables
                const { data: otherAssessments } = await supabase
                  .from('assessment_sessions')
                  .select('id')
                  .eq('candidate_id', candidate.id)
                  .neq('job_id', jobId)
                  .limit(1);

                const { data: otherInterviews } = await supabase
                  .from('interview_sessions')
                  .select('id')
                  .eq('candidate_id', candidate.id)
                  .neq('job_id', jobId)
                  .limit(1);

                const hasOtherJobs = (otherApps && otherApps.length > 0) ||
                  (otherAssessments && otherAssessments.length > 0) ||
                  (otherInterviews && otherInterviews.length > 0);

                if (!hasOtherJobs) {
                  await supabase.from('candidates').delete().eq('id', candidate.id);
                }
              }
            }

            // 6. Finally delete the job itself
            const { error: delErr } = await supabase
              .from('job_descriptions')
              .delete()
              .eq('id', jobId)
              .eq('created_by', user.id);

            if (delErr) return res.status(500).json({ error: delErr.message });

            // Decrement usage counter
            const profile = await getUserProfile(supabase, user.id);
            if (profile && (profile.jobs_count || 0) > 0) {
              await supabase.from('profiles').update({
                jobs_count: (profile.jobs_count || 0) - 1,
                updated_at: new Date().toISOString(),
              }).eq('user_id', user.id);
            }

            return ok(res, { success: true, message: 'Job and all related data permanently deleted' });
          } catch (e: any) {
            return res.status(500).json({ error: `Failed to delete job: ${e.message}` });
          }
        } else {
          // Soft delete (archive)
          const { data, error } = await supabase
            .from('job_descriptions')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', jobId)
            .eq('created_by', user.id)
            .select()
            .maybeSingle();

          if (error) return res.status(500).json({ error: error.message });
          if (!data) return notFound(res, 'Job not found or access denied');
          return ok(res, { success: true, message: 'Job archived successfully' });
        }
      }

      return methodNotAllowed(res);
    }

    // POST /api/jobs/:jobId/regenerate-questions
    if (segments.length === 3 && segments[2] === 'regenerate-questions' && req.method === 'POST') {
      const user = await requireAuth(req, res);
      if (!user) return;

      const billingGate = await checkPlanAccess(supabase, user.id, 'regenerate_interview_questions');
      if (!billingGate.allowed) {
        return res.status(billingGate.status || 402).json(billingGate);
      }

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

        // Build a map of candidate_id -> list of job_ids + per (candidate, job) applied_at
        const jobMap: Record<string, string[]> = {};
        const appliedAtMap: Record<string, string | null> = {};
        for (const app of (applications || [])) {
          const cid = app.candidate_id;
          const jid = app.job_id;
          if (!cid || !jid) continue;
          if (!jobMap[cid]) jobMap[cid] = [];
          if (!jobMap[cid].includes(jid)) {
            jobMap[cid].push(jid);
          }
          const key = `${cid}:${jid}`;
          if (!(key in appliedAtMap)) {
            appliedAtMap[key] = app.applied_at ?? null;
          }
        }

        // Return one entry per (candidate, job) pair for proper job-based grouping
        const result: any[] = [];
        for (const c of (data || [])) {
          const appliedJobs = jobMap[c.id] || [];
          for (const jid of appliedJobs) {
            result.push({ ...c, job_id: jid, applied_at: appliedAtMap[`${c.id}:${jid}`] ?? null });
          }
        }

        // Enrich with ATS screening scores
        if (result.length > 0) {
          const { data: screenings } = await supabase
            .from('ats_screenings')
            .select('candidate_id, job_id, overall_score, skill_relevance_score, experience_score, education_score, credibility_score, shortlisted, shortlist_reason')
            .in('candidate_id', candidateIds);

          if (screenings && screenings.length > 0) {
            // Build map keyed by "candidateId:jobId"
            const screeningMap: Record<string, any> = {};
            for (const s of screenings) {
              screeningMap[`${s.candidate_id}:${s.job_id}`] = s;
            }

            for (const entry of result) {
              const screening = screeningMap[`${entry.id}:${entry.job_id}`];
              if (screening) {
                entry.ats_score = screening.overall_score;
                entry.skill_relevance_score = screening.skill_relevance_score;
                entry.experience_score = screening.experience_score;
                entry.education_score = screening.education_score;
                entry.credibility_score = screening.credibility_score;
                entry.shortlisted = screening.shortlisted;
                entry.shortlist_reason = screening.shortlist_reason;
              } else {
                entry.ats_score = null;
                entry.shortlisted = null;
              }
            }
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
            location: body.location !== undefined ? body.location : existingCandidates[0].location,
            vendorName: body.vendorName !== undefined ? body.vendorName : existingCandidates[0].vendorName,
            mainSkillset: body.mainSkillset !== undefined ? body.mainSkillset : existingCandidates[0].mainSkillset,
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
            location: body.location || null,
            vendorName: body.vendorName || null,
            mainSkillset: body.mainSkillset || null,
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

    // POST /api/candidates/send-offer-letter
    if (req.method === 'POST' && segments.length === 2 && segments[1] === 'send-offer-letter') {
      const user = await requireAuth(req, res);
      if (!user) return;

      // Offer letter flow is temporarily disabled.
      return res.status(503).json({ error: 'Offer letter functionality is temporarily disabled.' });
    }

    // POST /api/candidates/bulk-update-interview-mode
    // NOTE: Must be handled before /api/candidates/:id route
    if (req.method === 'POST' && segments.length === 2 && segments[1] === 'bulk-update-interview-mode') {
      const user = await requireAuth(req, res);
      if (!user) return;

      const { candidate_ids, job_id, interview_mode } = req.body as { candidate_ids?: string[]; job_id?: string; interview_mode?: string };
      if (!candidate_ids?.length || !job_id || !interview_mode) return badRequest(res, 'candidate_ids, job_id, and interview_mode are required');

      if (interview_mode !== 'ai' && interview_mode !== 'manual') {
        return badRequest(res, 'interview_mode must be either "ai" or "manual"');
      }

      const { data: job } = await supabase.from('job_descriptions').select('id').eq('id', job_id).eq('created_by', user.id).single();
      if (!job) return notFound(res, 'Job not found or access denied');

      let updatedCount = 0;
      const errorMessages: string[] = [];

      for (const candidateId of candidate_ids) {
        try {
          // Check if job_application exists
          const { data: existingApp } = await supabase
            .from('job_applications')
            .select('id')
            .eq('candidate_id', candidateId)
            .eq('job_id', job_id)
            .maybeSingle();

          if (existingApp) {
            // Update existing application
            const { error } = await supabase
              .from('job_applications')
              .update({ 
                interview_mode,
                updated_at: new Date().toISOString()
              })
              .eq('candidate_id', candidateId)
              .eq('job_id', job_id);
            
            if (!error) updatedCount++;
            else errorMessages.push(`Candidate ${candidateId}: ${error.message}`);
          } else {
            // Create new job_application with interview_mode
            const { error } = await supabase
              .from('job_applications')
              .insert({
                candidate_id: candidateId,
                job_id: job_id,
                interview_mode,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
            
            if (!error) updatedCount++;
            else errorMessages.push(`Candidate ${candidateId}: ${error.message}`);
          }
        } catch (e: any) {
          errorMessages.push(`Candidate ${candidateId}: ${e.message}`);
        }
      }

      return ok(res, { success: updatedCount > 0, updated_count: updatedCount, error_messages: errorMessages });
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

        // Verify the candidate exists before updating
        const { data: existingCandidate } = await supabase
          .from('candidates')
          .select('id')
          .eq('id', candidateId)
          .maybeSingle();

        if (!existingCandidate) return notFound(res, 'Candidate not found');

        const { data, error } = await supabase
          .from('candidates')
          .update({ ...req.body, updated_at: new Date().toISOString() })
          .eq('id', candidateId)
          .select()
          .maybeSingle();

        if (error) return res.status(500).json({ error: error.message });
        if (!data) return notFound(res, 'Candidate not found');
        return ok(res, data);
      }

      if (req.method === 'DELETE') {
        const user = await requireAuth(req, res);
        if (!user) return;

        const scopedJobId = typeof req.query.job_id === 'string' ? req.query.job_id : undefined;

        if (scopedJobId) {
          // Verify the requested job belongs to the current user.
          const { data: job } = await supabase
            .from('job_descriptions')
            .select('id')
            .eq('id', scopedJobId)
            .eq('created_by', user.id)
            .single();

          if (!job) return notFound(res, 'Job not found or access denied');

          // Remove job-scoped records first.
          await Promise.all([
            supabase.from('job_applications').delete().eq('candidate_id', candidateId).eq('job_id', scopedJobId),
            supabase.from('ats_screenings').delete().eq('candidate_id', candidateId).eq('job_id', scopedJobId),
            supabase.from('assessment_sessions').delete().eq('candidate_id', candidateId).eq('job_id', scopedJobId),
            supabase.from('interview_sessions').delete().eq('candidate_id', candidateId).eq('job_id', scopedJobId),
            supabase.from('ai_interview_sessions').delete().eq('candidate_id', candidateId).eq('job_id', scopedJobId),
          ]);

          // Keep candidate if still associated with any other jobs.
          const { count: remainingAppsCount, error: appCountErr } = await supabase
            .from('job_applications')
            .select('id', { count: 'exact', head: true })
            .eq('candidate_id', candidateId);

          if (appCountErr) return res.status(500).json({ error: appCountErr.message });

          if ((remainingAppsCount || 0) === 0) {
            const { error: deleteCandidateErr } = await supabase
              .from('candidates')
              .delete()
              .eq('id', candidateId);
            if (deleteCandidateErr) return res.status(500).json({ error: deleteCandidateErr.message });
            return ok(res, { success: true, message: 'Candidate removed from this job and deleted (no other job associations).' });
          }

          return ok(res, { success: true, message: 'Candidate removed from this job only.' });
        }

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

      const billingGate = await checkPlanAccess(supabase, user.id, 'resume_parse');
      if (!billingGate.allowed) {
        return res.status(billingGate.status || 402).json(billingGate);
      }

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
        } catch (err) {
          console.error('Resume AI parsing failed (will save raw text anyway):', err);
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

    // GET/PATCH /api/candidates/:id/manual-interview?job_id=xxx
    if (segments.length === 3 && segments[2] === 'manual-interview') {
      const user = await requireAuth(req, res);
      if (!user) return;

      const candidateId = segments[1];
      const jobId = req.query.job_id as string | undefined;
      if (!jobId) return badRequest(res, 'job_id is required');

      // Ensure job belongs to this user
      const { data: job } = await supabase
        .from('job_descriptions')
        .select('id')
        .eq('id', jobId)
        .eq('created_by', user.id)
        .maybeSingle();
      if (!job) return notFound(res, 'Job not found or access denied');

      if (req.method === 'GET') {
        const { data: app, error } = await supabase
          .from('job_applications')
          .select('candidate_id, job_id, interview_mode, manual_interview_score, manual_interview_feedback, manual_interview_notes, manual_interview_at, manual_interview_entered_by, interview_status, interview_completed_at')
          .eq('candidate_id', candidateId)
          .eq('job_id', jobId)
          .maybeSingle();
        if (error) return res.status(500).json({ error: error.message });
        if (!app) return ok(res, null);
        return ok(res, app);
      }

      if (req.method === 'PATCH') {
        const body = req.body || {};
        const allowed: Record<string, any> = {};

        if (typeof body.interview_mode === 'string') allowed.interview_mode = body.interview_mode;
        if (body.manual_interview_score !== undefined) allowed.manual_interview_score = body.manual_interview_score;
        if (body.manual_interview_feedback !== undefined) allowed.manual_interview_feedback = body.manual_interview_feedback;
        if (body.manual_interview_notes !== undefined) allowed.manual_interview_notes = body.manual_interview_notes;

        // If switching to manual, mark timestamps and status unless caller overrides.
        const mode = String(body.interview_mode || 'manual');
        if (mode === 'manual') {
          if (!('manual_interview_at' in body)) {
            allowed.manual_interview_at = new Date().toISOString();
          } else {
            allowed.manual_interview_at = body.manual_interview_at;
          }
          allowed.manual_interview_entered_by = user.id;
          if (body.interview_status !== undefined) allowed.interview_status = body.interview_status;
          else allowed.interview_status = 'completed';
          if (body.interview_completed_at !== undefined) allowed.interview_completed_at = body.interview_completed_at;
          else allowed.interview_completed_at = new Date().toISOString();
        }

        allowed.updated_at = new Date().toISOString();

        const { data: updated, error } = await supabase
          .from('job_applications')
          .update(allowed)
          .eq('candidate_id', candidateId)
          .eq('job_id', jobId)
          .select('candidate_id, job_id, interview_mode, manual_interview_score, manual_interview_feedback, manual_interview_notes, manual_interview_at, manual_interview_entered_by, interview_status, interview_completed_at')
          .maybeSingle();
        if (error) return res.status(500).json({ error: error.message });
        if (!updated) return notFound(res, 'Application not found');
        return ok(res, updated);
      }

      return methodNotAllowed(res);
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

      const billingGate = await checkPlanAccess(supabase, user.id, 'candidate_scoring');
      if (!billingGate.allowed) {
        return res.status(billingGate.status || 402).json(billingGate);
      }

      const { candidate_id, job_id } = req.body;
      if (!candidate_id || !job_id) return badRequest(res, `candidate_id (${candidate_id}) and job_id (${job_id}) are required`);

      const { data: candidate } = await supabase
        .from('candidates')
        .select('*')
        .eq('id', candidate_id)
        .single();

      if (!candidate) return notFound(res, `Candidate not found with ID: ${candidate_id}`);
      if (!candidate.resume_parsed_data) return badRequest(res, `Resume not parsed for candidate: ${candidate_id}. Please ensure the resume is uploaded and processed first.`);

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
        .maybeSingle();

      const saved = existing
        ? await supabase.from('ats_screenings').update(screeningData).eq('id', existing.id).select().maybeSingle()
        : await supabase.from('ats_screenings').insert(screeningData).select().maybeSingle();

      if (saved.error) return res.status(500).json({ error: saved.error.message });
      if (!saved.data) return res.status(500).json({ error: 'Failed to save screening result' });
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
            .lt('applied_at', weekAgoStr),

          // Handle potential missing tables gracefully
          supabase
            .from('ai_interview_sessions')
            .select('id', { count: 'exact', head: true })
            .in('job_id', userJobIds)
            .eq('status', 'pending'),

          supabase
            .from('ats_screenings')
            .select('overall_score, shortlisted')
            .in('job_id', userJobIds),

          supabase
            .from('ai_interview_sessions')
            .select('id', { count: 'exact', head: true })
            .in('job_id', userJobIds)
            .eq('status', 'completed')
            .gte('completed_at', todayStart.toISOString()),

          supabase
            .from('ai_interview_sessions')
            .select('id', { count: 'exact', head: true })
            .in('job_id', userJobIds)
            .eq('status', 'completed')
            .gte('completed_at', yesterdayStart.toISOString())
            .lt('completed_at', todayStart.toISOString())
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
        .select('candidate_id, job_id, status, final_status, applied_at, interview_mode, manual_interview_score, interview_status')
        .in('job_id', jobId ? [jobId] : userJobIds)
        .order('applied_at', { ascending: false })
        .limit(limit);

      const { data: applications } = await appQuery;
      const applicationsMap: Record<string, any> = {};
      const toMillis = (value?: string | null) => (value ? new Date(value).getTime() : 0);
      for (const app of applications || []) {
        const key = `${app.candidate_id}:${app.job_id}`;
        const existing = applicationsMap[key];
        if (!existing || toMillis(app.applied_at) > toMillis(existing.applied_at)) {
          applicationsMap[key] = app;
        }
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
      const candidateMap: Record<string, any> = {};
      for (const c of candidates) candidateMap[c.id] = c;

      const effectiveJobIds = jobId ? [jobId] : userJobIds;
      const makeKey = (candidateId: string, jobIdValue: string) => `${candidateId}:${jobIdValue}`;

      // Fetch ATS screenings
      const screeningsMap: Record<string, any> = {};
      const { data: screenings } = await supabase
        .from('ats_screenings')
        .select('candidate_id, overall_score, job_id, shortlisted, created_at')
        .in('candidate_id', candidateIds)
        .in('job_id', effectiveJobIds);
      for (const s of screenings || []) {
        if (!s?.candidate_id || !s?.job_id) continue;
        const key = makeKey(s.candidate_id, s.job_id);
        const existing = screeningsMap[key];
        if (!existing || toMillis(s.created_at) > toMillis(existing.created_at)) {
          screeningsMap[key] = s;
        }
      }

      // Fetch assessment sessions
      const assessmentsMap: Record<string, any> = {};
      try {
        const { data: assessments } = await supabase
          .from('assessment_sessions')
          .select('candidate_id, total_score, status, job_id, completed_at, updated_at, created_at')
          .in('candidate_id', candidateIds)
          .in('job_id', effectiveJobIds);
        for (const a of assessments || []) {
          if (!a?.candidate_id || !a?.job_id) continue;
          const key = makeKey(a.candidate_id, a.job_id);
          const existing = assessmentsMap[key];
          const aTs = toMillis(a.completed_at) || toMillis(a.updated_at) || toMillis(a.created_at);
          const eTs = existing
            ? (toMillis(existing.completed_at) || toMillis(existing.updated_at) || toMillis(existing.created_at))
            : 0;
          if (!existing || aTs >= eTs) {
            assessmentsMap[key] = a;
          }
        }
      } catch { /* table may not exist */ }

      // Fetch AI interview sessions
      const interviewsMap: Record<string, any> = {};
      try {
        const { data: interviews } = await supabase
          .from('ai_interview_sessions')
          .select('candidate_id, status, job_id, completed_at, updated_at, created_at, final_evaluation')
          .in('candidate_id', candidateIds)
          .in('job_id', effectiveJobIds);
        for (const i of interviews || []) {
          if (!i?.candidate_id || !i?.job_id) continue;
          const key = makeKey(i.candidate_id, i.job_id);
          const existing = interviewsMap[key];
          const iTs = toMillis(i.completed_at) || toMillis(i.updated_at) || toMillis(i.created_at);
          const eTs = existing
            ? (toMillis(existing.completed_at) || toMillis(existing.updated_at) || toMillis(existing.created_at))
            : 0;
          if (!existing || iTs >= eTs) {
            interviewsMap[key] = i;
          }
        }
      } catch { /* table may not exist */ }

      const analytics = Object.values(applicationsMap).map((application: any) => {
        const row = candidateMap[application.candidate_id];
        if (!row) return null;

        const key = makeKey(application.candidate_id, application.job_id);
        const screening = screeningsMap[key];
        const assessment = assessmentsMap[key];
        const interview = interviewsMap[key];
        const finalEval = interview?.final_evaluation || {};
        const appliedJobId = application?.job_id || jobId || null;
        const assessmentTerminated = assessment?.status === 'terminated';
        const interviewTerminated = interview?.status === 'terminated';
        const interviewMode = application?.interview_mode || 'ai';
        const manualInterviewScore = application?.manual_interview_score;
        const applicationInterviewStatus = application?.interview_status;

        // Use manual interview score if mode is 'manual', otherwise use AI interview score
        let interviewScore: number | null = null;
        let technicalScore: number | null = null;
        let overallScore: number | null = null;
        let recommendation: string | null = null;
        let interviewStatus: string | null = null;

        if (interviewMode === 'manual' && manualInterviewScore != null) {
          interviewScore = manualInterviewScore;
          technicalScore = manualInterviewScore; // Use same score for consistency
          overallScore = manualInterviewScore;
          // For manual interviews, derive recommendation from score
          if (manualInterviewScore >= 80) recommendation = 'strong_hire';
          else if (manualInterviewScore >= 60) recommendation = 'hire';
          else if (manualInterviewScore >= 40) recommendation = 'borderline';
          else recommendation = 'no_hire';
          // Use application interview_status for manual interviews
          interviewStatus = applicationInterviewStatus || 'completed';
        } else {
          // Use AI interview evaluation
          interviewScore = interviewTerminated ? 0 : (finalEval.overall_score ?? null);
          technicalScore = interviewTerminated ? 0 : (finalEval.technical_score ?? null);
          overallScore = interviewTerminated ? 0 : (finalEval.overall_score ?? null);
          recommendation = interviewTerminated ? 'no_hire' : (finalEval.recommendation ?? null);
          // Use AI interview session status for AI interviews
          interviewStatus = interview?.status ?? null;
        }

        return {
          candidate_id: row.id,
          candidate_name: row.full_name,
          candidate_email: row.email,
          job_title: appliedJobId ? (jobTitleMap[appliedJobId] || 'N/A') : 'N/A',
          job_id: appliedJobId,
          application_status: application?.status || 'applied',
          final_status: application?.final_status ?? null,
          ats_score: screening?.overall_score ?? null,
          shortlisted: screening?.shortlisted ?? null,
          assessment_score: assessmentTerminated ? 0 : (assessment?.total_score ?? null),
          assessment_status: assessment?.status ?? null,
          interview_status: interviewStatus,
          interview_mode: interviewMode,
          interview_score: interviewScore,
          technical_score: technicalScore,
          overall_score: overallScore,
          recommendation: recommendation,
        };
      }).filter(Boolean);

      return ok(res, analytics);
    }

    // GET /api/analytics/trends
    if (segments.length === 2 && segments[1] === 'trends') {
      const days = parseInt((req.query.days as string) || '30', 10);
      const safeDays = Number.isFinite(days) ? Math.min(365, Math.max(1, days)) : 30;
      const period_days = safeDays;

      const toDayKey = (value: string | Date) => {
        const d = typeof value === 'string' ? new Date(value) : value;
        return d.toISOString().split('T')[0];
      };

      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const start = new Date();
      start.setDate(start.getDate() - (safeDays - 1));
      start.setHours(0, 0, 0, 0);
      const startIso = start.toISOString();
      const endIso = end.toISOString();

      const { data: userJobs, error: jobsErr } = await supabase
        .from('job_descriptions')
        .select('id')
        .eq('created_by', user.id);
      if (jobsErr) return res.status(500).json({ error: jobsErr.message });
      const userJobIds = (userJobs || []).map((j: any) => j.id);

      const dayMap: Record<string, {
        date: string;
        screenings: number;
        shortlisted: number;
        interviews_started: number;
        interviews_completed: number;
        score_sum: number;
        score_count: number;
      }> = {};

      for (let i = 0; i < safeDays; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const k = toDayKey(d);
        dayMap[k] = {
          date: k,
          screenings: 0,
          shortlisted: 0,
          interviews_started: 0,
          interviews_completed: 0,
          score_sum: 0,
          score_count: 0,
        };
      }

      if (userJobIds.length === 0) {
        const trends = Object.values(dayMap).map((d) => ({
          date: d.date,
          screenings: 0,
          shortlisted: 0,
          interviews_started: 0,
          interviews_completed: 0,
          average_score: 0,
        }));
        return ok(res, { trends, period_days });
      }

      // ATS screenings (for screenings volume + average_score + shortlist count)
      const { data: screenings, error: screeningsErr } = await supabase
        .from('ats_screenings')
        .select('job_id, created_at, shortlisted, overall_score')
        .in('job_id', userJobIds)
        .gte('created_at', startIso)
        .lte('created_at', endIso);
      if (screeningsErr) return res.status(500).json({ error: screeningsErr.message });

      for (const s of screenings || []) {
        if (!s?.created_at) continue;
        const k = toDayKey(s.created_at);
        const bucket = dayMap[k];
        if (!bucket) continue;
        bucket.screenings += 1;
        if (s.shortlisted === true) bucket.shortlisted += 1;
        if (typeof s.overall_score === 'number') {
          bucket.score_sum += s.overall_score;
          bucket.score_count += 1;
        }
      }

      // AI interview sessions (started + completed)
      try {
        const { data: interviews, error: interviewsErr } = await supabase
          .from('ai_interview_sessions')
          .select('job_id, status, created_at, completed_at, updated_at')
          .in('job_id', userJobIds)
          .gte('created_at', startIso)
          .lte('created_at', endIso);
        if (interviewsErr) return res.status(500).json({ error: interviewsErr.message });

        for (const i of interviews || []) {
          if (i?.created_at) {
            const k = toDayKey(i.created_at);
            const bucket = dayMap[k];
            if (bucket) bucket.interviews_started += 1;
          }

          if (String(i?.status || '').toLowerCase() === 'completed') {
            const completedAt = i?.completed_at || i?.updated_at || null;
            if (completedAt) {
              const k = toDayKey(completedAt);
              const bucket = dayMap[k];
              if (bucket) bucket.interviews_completed += 1;
            }
          }
        }
      } catch { /* table may not exist */ }

      const trends = Object.values(dayMap).map((d) => ({
        date: d.date,
        screenings: d.screenings,
        shortlisted: d.shortlisted,
        interviews_started: d.interviews_started,
        interviews_completed: d.interviews_completed,
        average_score: d.score_count > 0 ? Math.round((d.score_sum / d.score_count) * 10) / 10 : 0,
      }));

      return ok(res, { trends, period_days });
    }

    return notFound(res);
  }

  // /api/assessments/*
  if (segments[0] === 'assessments') {
    // GET /api/assessments/start/:token (public)
    // KEY PERF FIX: This endpoint now generates + returns BOTH MCQ questions and coding
    // challenges in a single response, replacing 3 serial client round-trips with 1.
    if (req.method === 'GET' && segments.length === 3 && segments[1] === 'start') {
      try {
        const token = segments[2];
        const { data: session, error } = await supabase
          .from('assessment_sessions')
          .select('*, candidates(full_name, email), job_descriptions(title, role, level)')
          .eq('token', token)
          .single();

        if (error || !session) return notFound(res, 'Assessment not found or link expired');
        if (['completed', 'terminated'].includes(session.status)) return badRequest(res, 'Assessment already completed or terminated');

        if (!session.deadline) {
          return res.status(500).json({ error: 'Assessment session misconfigured (missing deadline)' });
        }

        const deadline = new Date(session.deadline);
        if (Number.isNaN(deadline.getTime())) {
          return res.status(500).json({ error: 'Assessment session misconfigured (invalid deadline)' });
        }

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

        const assessmentConfig = session.proctoring_data?.assessment_config || {};
        const mcqCount = session.mcq_question_count ?? 20;
        const codingCount = session.coding_challenge_count ?? 2;
        const difficulty = assessmentConfig.difficulty || session.difficulty || 'medium';
        const includeMcq = assessmentConfig.include_mcq !== false && mcqCount > 0;
        const includeCoding = assessmentConfig.include_coding !== false && codingCount > 0;

      // Retrieve pre-generated MCQ questions only
      const getMcqQuestions = async (): Promise<any[]> => {
        if (!includeMcq) {
          console.log('[getMcqQuestions] MCQ disabled or count=0');
          return [];
        }
        const storedMcq: any[] = session.mcq_questions || [];
        if (storedMcq.length !== mcqCount) {
          throw new Error(`MCQ question count mismatch for this session. Expected ${mcqCount}, found ${storedMcq.length}.`);
        }
        if (storedMcq.length > 0) {
          console.log('[getMcqQuestions] Returning cached MCQs:', storedMcq.length);
          return storedMcq;
        }
        throw new Error('MCQ questions are not available for this session. Please contact the recruiter.');
      };

      // Fetch coding challenges from DSA bank (or return cached)
      const getCodingChallenges = async (): Promise<any[]> => {
        if (!includeCoding) return [];
        const storedCoding: any[] = session.coding_challenges || [];
        if (storedCoding.length > 0) return storedCoding;

        let dist: string[];
        if (difficulty === 'easy') dist = Array(codingCount).fill('easy');
        else if (difficulty === 'hard') dist = codingCount >= 2 ? ['medium', ...Array(codingCount - 1).fill('hard')] : ['hard'];
        else dist = codingCount >= 2 ? ['easy', ...Array(codingCount - 1).fill('medium')] : ['medium'];

        try {
          const lookups = await Promise.all(dist.map(d =>
            supabase.from('dsa_problems').select('*').eq('difficulty', d).eq('is_active', true).limit(20)
          ));
          const selected: any[] = [];
          for (const { data: problems } of lookups) {
            if (problems?.length) {
              const avail = problems.filter((p: any) => !selected.some(s => s.id === p.id));
              if (avail.length) selected.push(avail[Math.floor(Math.random() * avail.length)]);
            }
          }
          if (!selected.length) return [];
          const challenges = selected.map((p: any) => {
            const pub = (p.test_cases || []).filter((tc: any) => tc.visibility === 'public');
            return {
              id: p.id, slug: p.slug, title: p.title, description: p.description,
              constraints: p.constraints || '', examples: p.examples || [],
              starter_code: p.starter_code || {},
              test_cases: pub.map((tc: any) => ({ id: tc.id, input: tc.input, expected_output: tc.expected_output })),
              points: p.points, time_limit_seconds: p.time_limit_seconds,
              supported_languages: Object.keys(p.starter_code || {}),
            };
          });
          supabase.from('assessment_sessions').update({
            coding_problem_ids: selected.map((p: any) => p.id),
            coding_challenges: challenges, updated_at: new Date().toISOString(),
          }).eq('id', session.id).then(() => {});
          return challenges;
        } catch (e) { console.error('[start] Coding fetch failed:', e); return []; }
      };

        // Run both in parallel — halves the wait time
        const [mcqQuestions, codingChallenges] = await Promise.all([getMcqQuestions(), getCodingChallenges()]);

        const safeMcq = mcqQuestions.map((q: any) => ({
          id: q.id, question: q.question, options: q.options,
          difficulty: q.difficulty, topic: q.topic, points: q.points,
        }));

        return ok(res, {
          session_id: session.id,
          candidate_name: session.candidates?.full_name,
          job_title: session.job_descriptions?.title,
          mcq_count: safeMcq.length,
          coding_count: codingChallenges.length,
          total_time_minutes: session.total_time_minutes ?? 90,
          deadline: session.deadline,
          mcq_questions: safeMcq,
          coding_challenges: codingChallenges,
        });
      } catch (e: any) {
        console.error('[assessments/start] failed', e?.message || e);
        return res.status(500).json({ error: 'Failed to start assessment' });
      }
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
        const expectedCount = session.mcq_question_count || 20;
        if (stored.length !== expectedCount) {
          return badRequest(res, `MCQ question count mismatch for this session. Expected ${expectedCount}, found ${stored.length}.`);
        }
        return ok(res, stored.map((q: any) => ({
          id: q.id,
          question: q.question,
          options: q.options || [],
          difficulty: q.difficulty,
          topic: q.topic,
          points: q.points ?? 5,
        })));
      }

      return badRequest(res, 'MCQ questions are not available for this session. Please ask the recruiter to resend the assessment.');
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
          explanation: q.explanation || '',
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
        results: detailedResults,
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
          stdout: r.stdout,
          stderr: r.stderr,
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
          ...(r.visibility === 'public' ? { input: r.input, expected_output: r.expected_output, actual_output: r.actual_output, stdout: r.stdout, stderr: r.stderr } : {}),
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
          stdout: r.stdout,
          stderr: r.stderr,
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
          mcq_score: 0,
          coding_score: 0,
          total_score: 0,
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

      const billingGate = await checkPlanAccess(supabase, user.id, 'assessment_invite', {
        quantity: Math.max(1, (candidateIds || []).length),
      });
      if (!billingGate.allowed) {
        return res.status(billingGate.status || 402).json(billingGate);
      }

      const { data: job } = await supabase
        .from('job_descriptions')
        .select('id, title, role, level, description, must_have_skills, good_to_have_skills')
        .eq('id', jobId)
        .eq('created_by', user.id)
        .single();
      if (!job) return notFound(res, 'Job not found');

      const { data: candidates } = await supabase.from('candidates').select('id, email, full_name').in('id', candidateIds);
      if (!candidates?.length) return notFound(res, 'No candidates found');

      const deadline = new Date(Date.now() + Number(deadlineHours) * 60 * 60 * 1000);
      const frontendUrl = normalizeBaseUrl(resolveFrontendBaseUrl(req));

      if (includeMcq && mcqCount < 1) {
        return badRequest(res, 'MCQ question count must be at least 1 when MCQ is enabled');
      }

      let preGeneratedMcqQuestions: any[] = [];
      if (includeMcq) {
        try {
          preGeneratedMcqQuestions = await generateAssessmentMcqsForJob({
            job,
            mcqCount,
            difficulty,
          });
        } catch (e: any) {
          console.error('[assessments/invite] MCQ generation failed:', e?.message || e);
          return res.status(502).json({
            error: 'Failed to generate MCQ questions for this assessment. Please retry Send Assessment.',
          });
        }
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
            mcq_questions: preGeneratedMcqQuestions,
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

          await sendAssessmentInvite(c.email, c.full_name, job.title, `${frontendUrl}/assessment/${encodeURIComponent(token)}`, deadline.toLocaleString());
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
      try {
        const token = decodeURIComponent(segments[2] || '').trim();
        console.log('[ai-interview/start] token:', token?.slice(0, 10) + '...');
        const { data: session, error } = await supabase
          .from('ai_interview_sessions')
          .select('*, candidates(full_name, email), job_descriptions(title, role, level)')
          .eq('token', token)
          .single();

        if (error) {
          console.error('[ai-interview/start] DB error:', error.message);
          return notFound(res, 'Interview not found or link expired');
        }
        if (!session) return notFound(res, 'Interview not found or link expired');
        if (['completed', 'terminated'].includes(session.status)) return badRequest(res, 'Interview already completed or terminated');

        const sessionQuestions = normalizeInterviewQuestions(session.questions);
        const questionCount = sessionQuestions.length;
        if (questionCount === 0) {
          return badRequest(res, 'Interview questions are not available yet. Please contact the hiring team.');
        }

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
          total_questions: questionCount,
          estimated_duration_minutes: (questionCount || 5) * 3,
        });
      } catch (e: any) {
        console.error('[ai-interview/start] failed:', e?.message || e);
        return res.status(500).json({ error: 'Failed to load interview session' });
      }
    }

    // GET /api/ai-interview/:sessionId/question
    if (req.method === 'GET' && segments.length === 3 && segments[2] === 'question') {
      const sessionId = segments[1];
      const { data: session } = await supabase.from('ai_interview_sessions').select('*').eq('id', sessionId).single();
      if (!session) return notFound(res, 'Session not found');
      if (session.status !== 'in_progress') return badRequest(res, 'Interview not in progress');

      const idx = session.current_question_index || 0;
      const questions = normalizeInterviewQuestions(session.questions);
      if (idx >= questions.length) return ok(res, { completed: true, message: 'All questions answered' });
      const q = questions[idx];

      return ok(res, {
        index: idx,
        question_text: q.text,
        question_type: q.type,
        expected_duration_seconds: q.duration ?? 120,
      });
    }

    // POST /api/ai-interview/:sessionId/adapt-question
    // Generates a context-aware adaptive follow-up question based on previous responses.
    // Body: { next_index: number }
    // Returns the question at next_index (replacing the pre-stored one if AI generates a better one).
    if (req.method === 'POST' && segments.length === 3 && segments[2] === 'adapt-question') {
      const sessionId = segments[1];
      const { next_index } = (req.body || {}) as { next_index?: number };

      const { data: session } = await supabase
        .from('ai_interview_sessions')
        .select('*, job_descriptions(title, role, level, must_have_skills, description)')
        .eq('id', sessionId)
        .single();

      if (!session) return notFound(res, 'Session not found');
      if (session.status !== 'in_progress') return badRequest(res, 'Interview not in progress');

      const questions = normalizeInterviewQuestions(session.questions);
      const responses: any[] = Array.isArray(session.responses) ? session.responses : [];
      const idx = typeof next_index === 'number' ? next_index : (session.current_question_index || 0);

      // If index is beyond question list or no prior responses, just return the pre-stored question
      if (responses.length === 0 || idx >= questions.length) {
        const q = questions[idx];
        if (!q) return ok(res, { completed: true });
        return ok(res, { index: idx, question_text: q.text, question_type: q.type, expected_duration_seconds: q.duration ?? 120, adaptive: false });
      }

      // Build context from prior Q&A pairs
      const job = session.job_descriptions || {};
      const resumeInsights = session.proctoring_data?.resume_insights || {};
      const priorQA = responses
        .filter((r: any) => typeof r?.question_index === 'number' && questions[r.question_index])
        .sort((a: any, b: any) => a.question_index - b.question_index)
        .slice(-3) // last 3 responses for context
        .map((r: any) => {
          const q = questions[r.question_index];
          return `Q (${q.type}): ${q.text}\nA: ${r.transcript || '[No response provided]'}`;
        })
        .join('\n\n');

      const nextPreStored = questions[idx];
      const skills = (job.must_have_skills || []).join(', ') || 'General';
      const candidateSkills = Array.isArray(resumeInsights.skills) ? resumeInsights.skills.join(', ') : '';

      const adaptPrompt = `You are an expert technical interviewer conducting a live ${job.level} ${job.role} interview for ${job.title}.

Required Skills: ${skills}
${candidateSkills ? `Candidate Skills: ${candidateSkills}` : ''}
${resumeInsights.experience_summary ? `Candidate Experience: ${resumeInsights.experience_summary}` : ''}

## Interview Progress So Far (last ${Math.min(responses.length, 3)} Q&A pairs):
${priorQA}

## Pre-planned next question (question ${idx + 1} of ${questions.length}):
"${nextPreStored?.text || ''}" (type: ${nextPreStored?.type || 'technical'})

## Your Task:
Based on the candidate's answers above, generate a BETTER adaptive follow-up question for question ${idx + 1}.
- If the candidate gave a strong answer, go deeper on that topic or a related advanced concept.
- If the candidate struggled, probe with a simpler or more supportive follow-up.
- If the answer revealed a gap in required skills, ask about it directly.
- Keep the question type (${nextPreStored?.type || 'technical'}) unless a behavioral/situational follow-up would reveal more.
- If the pre-planned question is already ideal given context, you may return it as-is.

Return ONLY this JSON:
{"text": "<the adaptive question>", "type": "technical|behavioral|situational", "duration": <seconds 90-180>}`;

      try {
        const adapted = await Promise.race<any>([
          generateJSON<any>(adaptPrompt, { temperature: 0.7, maxTokens: 512 }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('adapt timeout')), 8000)),
        ]);
        if (adapted?.text && adapted?.type) {
          // Replace the pre-stored question at this index with the adaptive one
          const updatedQuestions = [...questions];
          updatedQuestions[idx] = {
            text: String(adapted.text),
            type: String(adapted.type),
            duration: typeof adapted.duration === 'number' ? adapted.duration : 120,
          };
          await supabase.from('ai_interview_sessions')
            .update({ questions: updatedQuestions, updated_at: new Date().toISOString() })
            .eq('id', sessionId);
          return ok(res, { index: idx, question_text: adapted.text, question_type: adapted.type, expected_duration_seconds: adapted.duration ?? 120, adaptive: true });
        }
      } catch (e: any) {
        console.warn('[adapt-question] AI adaptation failed, using pre-stored:', e.message);
      }

      // Fallback to pre-stored question
      if (!nextPreStored) return ok(res, { completed: true });
      return ok(res, { index: idx, question_text: nextPreStored.text, question_type: nextPreStored.type, expected_duration_seconds: nextPreStored.duration ?? 120, adaptive: false });
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

    // POST /api/ai-interview/:sessionId/transcribe-store
    // Accepts JSON body: { question_index: number, audio_base64: string, mime_type?: string, audio_duration_seconds?: number }
    // Transcribes on server and stores transcript on the matching question response.
    if (req.method === 'POST' && segments.length === 3 && segments[2] === 'transcribe-store') {
      const sessionId = segments[1];
      const body = req.body as {
        question_index?: number;
        audio_base64?: string;
        mime_type?: string;
        audio_duration_seconds?: number;
      };

      const { data: session } = await supabase
        .from('ai_interview_sessions')
        .select('id, status, responses')
        .eq('id', sessionId)
        .single();

      if (!session) return notFound(res, 'Session not found');
      if (!['in_progress', 'completed'].includes(session.status)) {
        return badRequest(res, 'Interview not in progress');
      }

      if (typeof body?.question_index !== 'number' || body.question_index < 0) {
        return badRequest(res, 'Missing or invalid question_index.');
      }
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

        const responses: any[] = Array.isArray(session.responses) ? [...session.responses] : [];
        const existingIdx = responses.findIndex((r: any) => Number(r?.question_index) === body.question_index);
        const existing = existingIdx >= 0 ? responses[existingIdx] : {};

        const updatedResponse = {
          ...existing,
          question_index: body.question_index,
          transcript,
          audio_duration_seconds: typeof body.audio_duration_seconds === 'number'
            ? body.audio_duration_seconds
            : (existing?.audio_duration_seconds ?? 0),
          confidence: typeof existing?.confidence === 'number' ? existing.confidence : 0.9,
          transcribed_at: new Date().toISOString(),
          submitted_at: existing?.submitted_at || new Date().toISOString(),
        };

        if (existingIdx >= 0) {
          responses[existingIdx] = updatedResponse;
        } else {
          responses.push(updatedResponse);
        }

        await supabase
          .from('ai_interview_sessions')
          .update({ responses, updated_at: new Date().toISOString() })
          .eq('id', sessionId);

        return ok(res, {
          success: true,
          question_index: body.question_index,
          transcript_length: transcript.length,
        });
      } catch (e: any) {
        console.error('Transcription-store error:', e.message);
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

      const responses = Array.isArray(session.responses) ? [...session.responses] : [];
      const existingIdx = responses.findIndex((r: any) => Number(r?.question_index) === Number(body.question_index));
      const responsePayload = {
        question_index: body.question_index,
        transcript: typeof body.transcript === 'string' ? body.transcript : '',
        audio_duration_seconds: body.audio_duration_seconds,
        confidence: body.confidence,
        submitted_at: new Date().toISOString(),
      };

      if (existingIdx >= 0) {
        responses[existingIdx] = {
          ...responses[existingIdx],
          ...responsePayload,
        };
      } else {
        responses.push(responsePayload);
      }

      const nextIndex = (session.current_question_index || 0) + 1;
      const questionCount = normalizeInterviewQuestions(session.questions).length;
      const isLast = nextIndex >= questionCount;

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
        const terminatedEvaluation = {
          overall_score: 0,
          technical_score: 0,
          communication_score: 0,
          confidence_score: 0,
          recommendation: 'no_hire',
          strengths: [],
          areas_for_improvement: ['Interview terminated due to proctoring violations.'],
          detailed_feedback: terminationReason,
        };
        await supabase.from('ai_interview_sessions').update({
          proctoring_data: proctoring,
          status: 'terminated',
          completed_at: new Date().toISOString(),
          final_evaluation: terminatedEvaluation,
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
      const questions = normalizeInterviewQuestions(session.questions);
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
      const requestedCountRaw = req.body?.question_count;
      const requestedCount = Math.max(1, Math.min(30, Number(requestedCountRaw ?? 5) || 5));

      const billingGate = await checkPlanAccess(supabase, user.id, 'ai_interview_invite', {
        quantity: Math.max(1, (candidate_ids || []).length),
      });
      if (!billingGate.allowed) {
        return res.status(billingGate.status || 402).json(billingGate);
      }

      const { data: job } = await supabase
        .from('job_descriptions')
        .select('id, title, role, level, must_have_skills, description')
        .eq('id', job_id)
        .eq('created_by', user.id)
        .single();

      if (!job) return notFound(res, 'Job not found');

      const { data: candidates } = await supabase
        .from('candidates')
        .select('id, email, full_name, resume_parsed_data')
        .in('id', candidate_ids);

      if (!candidates?.length) return notFound(res, 'No candidates found');

      const frontendUrl = normalizeBaseUrl(resolveFrontendBaseUrl(req));
      let invitesSent = 0;
      const failed: string[] = [];
      const failed_reasons: Record<string, string> = {};

      for (const c of candidates) {
        try {
          if (!c.email) {
            throw new Error('Candidate email is missing');
          }

          const token = crypto.randomBytes(32).toString('base64url');
          const sessionId = uuidv4();

          // Generate personalized questions per candidate using their resume data (GPT-4.1-mini)
          console.log('[ai-interview/invite] Generating personalized questions for candidate:', c.id, 'with resume:', !!c.resume_parsed_data);
          const questions = await generateCandidateInterviewQuestions(
            { title: job.title, role: job.role, level: job.level, must_have_skills: job.must_have_skills || [], description: job.description || '' },
            { full_name: c.full_name, resume_parsed_data: c.resume_parsed_data },
            requestedCount
          );

          const normalizedQuestions = normalizeInterviewQuestions(questions);
          if (normalizedQuestions.length === 0) {
            throw new Error('No interview questions generated for candidate');
          }

          console.log('[ai-interview/invite] Generated', normalizedQuestions.length, 'questions for candidate:', c.id);

          // Build a lightweight resume_insights snapshot stored in the session for adaptive use
          const resume = c.resume_parsed_data || {};
          const resumeInsights = {
            skills: Array.isArray(resume.skills) ? resume.skills.slice(0, 15) : [],
            experience_summary: Array.isArray(resume.experience)
              ? resume.experience.slice(0, 3).map((e: any) => `${e.title || ''} at ${e.company || ''}`).join('; ')
              : (typeof resume.experience === 'string' ? resume.experience.slice(0, 300) : ''),
            education_summary: Array.isArray(resume.education)
              ? resume.education.slice(0, 2).map((e: any) => `${e.degree || ''} from ${e.institution || ''}`).join('; ')
              : (typeof resume.education === 'string' ? resume.education.slice(0, 200) : ''),
          };

          const { error: insertErr } = await supabase.from('ai_interview_sessions').insert({
            id: sessionId,
            candidate_id: c.id,
            job_id,
            token,
            status: 'pending',
            current_question_index: 0,
            questions: normalizedQuestions,
            responses: [],
            proctoring_data: { warnings: [], camera_enabled: false, microphone_enabled: false, resume_insights: resumeInsights },
            created_at: new Date().toISOString(),
          });
          if (insertErr) {
            throw new Error(`Failed to create interview session: ${insertErr.message}`);
          }

          try {
            await sendInterviewInvite(c.email, c.full_name, job.title, `${frontendUrl}/ai-interview/${encodeURIComponent(token)}`, scheduled_time);
          } catch (emailErr: any) {
            await supabase.from('ai_interview_sessions').delete().eq('id', sessionId);
            throw new Error(`Failed to send interview invite email: ${emailErr?.message || emailErr}`);
          }

          invitesSent += 1;
        } catch (err: any) {
          const reason = String(err?.message || err || 'Unknown error');
          console.error('[ai-interview/invite] Failed for candidate:', c.id, reason);
          failed.push(c.id);
          failed_reasons[c.id] = reason;
        }
      }

      return ok(res, { success: invitesSent > 0, invites_sent: invitesSent, failed, failed_reasons });
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
      const location = fields.location || null;
      const vendorName = fields.vendorName || null;
      const mainSkillset = fields.mainSkillset || null;
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
            location,
            vendorName,
            mainSkillset,
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
          location,
          vendorName,
          mainSkillset,
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
          const uploadedResume = resumeFile as { filename: string; mimeType: string; buffer: Buffer };
          const rawText = await extractResumeText(uploadedResume.buffer, uploadedResume.filename);
          resumeText = String(rawText)
            .replace(/\x00/g, '')
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
            .slice(0, 50000);

          // Parse with AI
          try {
            const prompt = `You are an expert resume parser.\n\nParse the following resume and return ONLY valid JSON in this exact format:\n{\n  "skills": ["skill1"],\n  "experience": [{"title":"","company":"","duration":"","description":""}],\n  "education": [{"degree":"","institution":"","year":""}],\n  "summary": "",\n  "total_experience_years": 0,\n  "certifications": ["cert1"]\n}\n\nRESUME TEXT:\n${resumeText.slice(0, 8000)}`;
            resumeParsedData = await generateJSON<any>(prompt);
          } catch (err: any) {
            console.error('Resume AI parsing failed during application (will save raw text anyway):', err?.message);
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


function normalizeInterviewQuestions(raw: any): { text: string; type: string; duration: number }[] {
  let parsed = raw;

  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed) && parsed && Array.isArray(parsed.questions)) {
    parsed = parsed.questions;
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((q: any) => q?.text && q?.type)
    .map((q: any) => ({
      text: String(q.text),
      type: String(q.type),
      duration: Number(q.duration) || 120,
    }));
}

async function generateInterviewQuestions(job: { title: string; role: string; level: string; must_have_skills?: string[] }) {
  try {
    const skills = (job.must_have_skills || []).join(', ') || 'General';
    const prompt = `You are an expert technical interviewer. Generate exactly 5 high-quality interview questions for a ${job.level} ${job.role} position (${job.title}).
Required skills: ${skills}.

Create a balanced mix:
- 2 technical questions testing specific skills and problem-solving
- 2 behavioral questions about past experiences (use STAR format cues)
- 1 situational question with a realistic work scenario

For each question, estimate a realistic answer duration.

Return JSON array ONLY:
[{"text": "<full question text>", "type": "technical|behavioral|situational", "duration": <seconds 90-180>}]`;
    const raw = await Promise.race<any>([
      generateJSON<any>(prompt),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
    ]);
    const valid = normalizeInterviewQuestions(raw).slice(0, 5);
    if (valid.length < 5) {
      throw new Error(`Generated only ${valid.length} interview questions`);
    }
    return valid;
  } catch {
    const fallback = [
      { text: `Walk me through your most relevant technical experience for the ${job.role} role, including specific technologies and what you built.`, type: 'technical', duration: 150 },
      { text: `Describe a situation where you had to solve a complex technical problem. What was your approach and what was the outcome?`, type: 'behavioral', duration: 150 },
      { text: `Tell me about a time you worked under pressure to deliver a project. How did you prioritize and what did you learn?`, type: 'behavioral', duration: 120 },
      { text: `If you discovered a critical bug in production 2 hours before a major product demo, what would you do?`, type: 'situational', duration: 120 },
      { text: `What specific technical skills do you bring to ${job.title} and what is an area you are actively working to improve?`, type: 'technical', duration: 120 },
    ];
    return normalizeInterviewQuestions(fallback).slice(0, 5);
  }
}

async function generateCandidateInterviewQuestions(
  job: { title: string; role: string; level: string; must_have_skills?: string[]; description?: string },
  candidate: { full_name?: string; resume_parsed_data?: any },
  count: number
): Promise<{ text: string; type: string; duration: number }[]> {
  const skills = (job.must_have_skills || []).join(', ') || 'General';
  const resume = candidate.resume_parsed_data || {};

  // Extract useful resume signals for context
  const candidateSkills = Array.isArray(resume.skills) ? resume.skills.slice(0, 12).join(', ') : '';
  const candidateExperience = Array.isArray(resume.experience)
    ? resume.experience.slice(0, 3).map((e: any) => `${e.title || e.role || ''} at ${e.company || ''} (${e.duration || ''})`).join('; ')
    : typeof resume.experience === 'string' ? resume.experience.slice(0, 400) : '';
  const candidateEducation = Array.isArray(resume.education)
    ? resume.education.slice(0, 2).map((e: any) => `${e.degree || ''} in ${e.field || e.major || ''} from ${e.institution || ''}`).join('; ')
    : typeof resume.education === 'string' ? resume.education.slice(0, 200) : '';
  const summary = typeof resume.summary === 'string' ? resume.summary.slice(0, 300) : '';

  const hasResume = candidateSkills || candidateExperience;
  const candidateName = candidate.full_name || 'the candidate';

  const prompt = `You are an expert technical interviewer. Generate exactly ${count} personalized interview questions for ${candidateName} applying for a ${job.level} ${job.role} position (${job.title}).

## JOB REQUIREMENTS
Required Skills: ${skills}
Job Context: ${(job.description || '').slice(0, 400)}

## CANDIDATE PROFILE
${candidateSkills ? `Skills on Resume: ${candidateSkills}` : ''}
${candidateExperience ? `Work Experience: ${candidateExperience}` : ''}
${candidateEducation ? `Education: ${candidateEducation}` : ''}
${summary ? `Profile Summary: ${summary}` : ''}

## PERSONALIZATION RULES:
1. Cross-reference the candidate's resume with job requirements.
2. Ask about specific technologies/projects mentioned in their resume if relevant to the role.
3. Probe gaps: if a required skill is absent from the resume, ask how they would handle it.
4. Ask about their MOST RECENT experience in context of the job's challenges.
5. ${hasResume ? 'Tailor questions to their background — do not ask generic questions they cannot answer based on their resume.' : 'Use the job requirements to craft role-specific questions.'}

## QUESTION MIX (for ${count} questions):
- ${Math.ceil(count * 0.4)} technical questions: probe skills, system design, or code/architecture decisions
- ${Math.ceil(count * 0.35)} behavioral questions: STAR-format, based on their actual experience
- ${Math.floor(count * 0.25)} situational questions: hypothetical but role-realistic scenarios

## FORMAT:
Return ONLY a JSON array:
[{"text": "<specific, personalized question>", "type": "technical|behavioral|situational", "duration": <seconds 90-180>}]`;

  try {
    const raw = await Promise.race<any>([
      generateJSON<any>(prompt, { maxTokens: Math.min(8192, 1024 + count * 200), temperature: 0.6 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Interview question generation timed out')), 20000)),
    ]);
    const questions = Array.isArray(raw) ? raw : (Array.isArray(raw?.questions) ? raw.questions : []);
    const valid = questions
      .filter((q: any) => q?.text && q?.type)
      .map((q: any) => ({ text: String(q.text), type: String(q.type), duration: Number(q.duration) || 120 }))
      .slice(0, count);
    if (valid.length >= Math.max(1, Math.floor(count * 0.6))) return valid;
    // If AI returned too few, fall back
    throw new Error(`Too few questions returned: ${valid.length}`);
  } catch (e: any) {
    console.error('[generateCandidateInterviewQuestions] failed, using fallback:', e.message);
    const fallbackFive = await generateInterviewQuestions(job);
    const safeFallback = normalizeInterviewQuestions(fallbackFive);
    if (!safeFallback.length) {
      return [];
    }

    const expanded: { text: string; type: string; duration: number }[] = [];
    while (expanded.length < count) {
      expanded.push(safeFallback[expanded.length % safeFallback.length]);
    }
    return expanded.slice(0, count);
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

function outputsEquivalent(expectedValue: string | null | undefined, actualValue: string | null | undefined): boolean {
  const expected = normalizeOutput(expectedValue);
  const actual = normalizeOutput(actualValue);
  if (actual === expected) return true;

  // Fallback: ignore all whitespace-only differences (e.g. array formatting like [1, 2, 3] vs [1,2,3]).
  const compact = (v: string) => v.replace(/\s+/g, '');
  return compact(actual) === compact(expected);
}

type TCInput = { id: string; input: string; expected_output: string; visibility?: string; time_limit_ms?: number; memory_limit_kb?: number };
type TCResult = {
  test_case_id: string; input: string; expected_output: string;
  actual_output: string | null; passed: boolean; status: string;
  time_used: string | null; memory_used: string | null;
  visibility: string; error: string | null;
  stdout?: string | null; stderr?: string | null;
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
        stdout: null, stderr: null,
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

    const stdoutRaw = await fetchHEOutput(runStatus.output);
    const stderrRaw = await fetchHEOutput(runStatus.stderr);

    // Runtime error / TLE / MLE
    if (status !== 'AC') {
      const errorMap: Record<string, string> = {
        'TLE': 'Time Limit Exceeded', 'MLE': 'Memory Limit Exceeded',
        'RE': `Runtime Error: ${runStatus.status_detail || ''}`.trim(),
        'NZEC': `Non-Zero Exit Code: ${runStatus.status_detail || ''}`.trim(),
        'SI': 'Signal Error', 'OTHER': runStatus.status_detail || 'Unknown Error',
      };
      return { test_case_id: tc.id, input: tc.input, expected_output: tc.expected_output,
        actual_output: stdoutRaw, passed: false, status: status === 'NZEC' ? 'RE' : status,
        time_used: runStatus.time_used || null, memory_used: runStatus.memory_used || null,
        visibility: vis, error: errorMap[status] || `Execution error: ${status}`,
        stdout: stdoutRaw, stderr: stderrRaw };
    }

    const actual = normalizeOutput(stdoutRaw);
    const passed = outputsEquivalent(tc.expected_output, stdoutRaw);

    return { test_case_id: tc.id, input: tc.input, expected_output: tc.expected_output,
      actual_output: actual, passed, status: passed ? 'AC' : 'WA',
      time_used: runStatus.time_used || null, memory_used: runStatus.memory_used || null,
      visibility: vis, error: passed ? null : 'Wrong Answer',
      stdout: stdoutRaw, stderr: stderrRaw };

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

    const passed = outputsEquivalent(tc.expected_output, stdout);
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
  const prompt = `You are an expert technical interviewer. Generate exactly 20 diverse, high-quality interview questions for a ${job.level} ${job.role} position (${job.title}).

Required Skills: ${skills}
${job.description ? `Job Context: ${job.description.slice(0, 500)}` : ''}

Create a balanced mix:
- 9 technical questions: probe specific skill depth, system design decisions, debugging, or code behavior
- 6 behavioral questions: STAR-format about past experiences, collaboration, and problem-solving
- 5 situational questions: realistic work scenarios the candidate would face in this role

Rules:
- Each question MUST test a different skill or competency area.
- Questions should be distinct, non-overlapping, and progress from foundational to advanced.
- Tailor all questions to the ${job.level} level expectations.
- Avoid generic questions. Make each one specific to the role and required skills.

Return ONLY a JSON array:
[{"text": "<full question text>", "type": "technical|behavioral|situational", "duration": <seconds 90-180>}]`;

  try {
    const raw = await Promise.race<any>([
      generateJSON<any>(prompt, { maxTokens: 8192, temperature: 0.6 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Pool generation timed out')), 20000)),
    ]);
    const questions = Array.isArray(raw) ? raw : Array.isArray(raw?.questions) ? raw.questions : [];
    return questions
      .filter((q: any) => q?.text && q?.type)
      .map((q: any) => ({
        text: String(q.text),
        type: String(q.type),
        duration: typeof q.duration === 'number' ? q.duration : 120,
      }))
      .slice(0, 20);
  } catch (e: any) {
    console.error('[generateInterviewQuestionPool] failed:', e.message);
    return [];
  }
}
