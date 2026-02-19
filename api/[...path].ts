import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Groq from 'groq-sdk';
import * as jose from 'jose';
import crypto from 'node:crypto';

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
interface ClerkUser { id: string; sessionId: string; azp: string; }
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
  return { id: payload.sub as string, sessionId: payload.sid as string, azp: payload.azp as string };
}
async function getOptionalUser(req: VercelRequest): Promise<ClerkUser | null> {
  try { return await verifyClerkToken(req); } catch { return null; }
}

// ============== INLINE: AssemblyAI ==============
async function transcribeWithAssemblyAI(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) throw new Error('ASSEMBLYAI_API_KEY is not configured in Vercel environment variables.');

  // 1. Upload audio
  const uploadResp = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: { authorization: apiKey, 'content-type': 'application/octet-stream' },
    body: audioBuffer,
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
    body: JSON.stringify({ audio_url: upload_url, language_code: 'en_us' }),
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
    };

    return ok(res, {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      env: envStatus,
    });
  }

  const supabase = getSupabaseAdmin();

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

        const { data, error } = await supabase
          .from('job_descriptions')
          .insert(jobData)
          .select()
          .single();

        if (error) return res.status(500).json({ error: error.message });
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
          .select('*')
          .in('id', candidateIds)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) return res.status(500).json({ error: error.message });
        return ok(res, data);
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

        // Create application mapping so user-scoped candidate lists include this candidate
        if (jobId) {
          const { error: appError } = await supabase
            .from('job_applications')
            .insert({
              job_id: jobId,
              candidate_id: data.id,
              status: 'applied',
              applied_at: new Date().toISOString(),
              screening_status: 'pending',
            });
          if (appError) {
            return res.status(500).json({ error: appError.message });
          }
        }

        return ok(res, data, 201);
      }

      return methodNotAllowed(res);
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

    // GET /api/candidates/:id/assessment-details
    if (segments.length === 3 && segments[2] === 'assessment-details') {
      const user = await requireAuth(req, res);
      if (!user) return;

      const candidateId = segments[1];
      if (req.method !== 'GET') return methodNotAllowed(res);

      // Get assessment sessions for this candidate
      const { data: sessions } = await supabase
        .from('assessment_sessions')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('created_at', { ascending: false });

      if (!sessions?.length) return ok(res, null);

      // Return the most recent completed session
      const completedSession = sessions.find((s: any) => s.status === 'completed') || sessions[0];

      return ok(res, {
        session_id: completedSession.id,
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

    // GET /api/candidates/:id/interview-details
    if (segments.length === 3 && segments[2] === 'interview-details') {
      const user = await requireAuth(req, res);
      if (!user) return;

      const candidateId = segments[1];
      if (req.method !== 'GET') return methodNotAllowed(res);

      // Get AI interview sessions for this candidate
      const { data: sessions } = await supabase
        .from('ai_interview_sessions')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('created_at', { ascending: false });

      if (!sessions?.length) return ok(res, null);

      // Return the most recent completed session
      const completedSession = sessions.find((s: any) => s.status === 'completed') || sessions[0];

      return ok(res, {
        session_id: completedSession.id,
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

      const { count: activeJobs } = await supabase
        .from('job_descriptions')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', user.id)
        .eq('is_active', true);

      let totalCandidates = 0;
      let pendingInterviews = 0;
      let averageScore = 0;
      let shortlistRate = 0;
      let completedToday = 0;

      if (userJobIds.length > 0) {
        const { count: candCount } = await supabase
          .from('job_applications')
          .select('candidate_id', { count: 'exact', head: true })
          .in('job_id', userJobIds);
        totalCandidates = candCount || 0;

        try {
          const { count: pendCount } = await supabase
            .from('ai_interview_sessions')
            .select('id', { count: 'exact', head: true })
            .in('job_id', userJobIds)
            .eq('status', 'pending');
          pendingInterviews = pendCount || 0;
        } catch { /* table may not exist */ }

        const { data: scores } = await supabase
          .from('ats_screenings')
          .select('overall_score, shortlisted')
          .in('job_id', userJobIds);
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

        // Completed today
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        try {
          const { count: todayCount } = await supabase
            .from('ai_interview_sessions')
            .select('id', { count: 'exact', head: true })
            .in('job_id', userJobIds)
            .eq('status', 'completed')
            .gte('completed_at', todayStart.toISOString());
          completedToday = todayCount || 0;
        } catch { /* table may not exist */ }
      }

      return ok(res, {
        total_candidates: totalCandidates,
        total_candidates_change: 0,
        active_jobs: activeJobs || 0,
        active_jobs_change: 0,
        pending_interviews: pendingInterviews,
        pending_interviews_change: 0,
        completed_today: completedToday,
        completed_today_change: 0,
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

  // /api/apply/* (public)
  if (segments[0] === 'apply') {
    // GET /api/apply/job/:jobId
    if (req.method === 'GET' && segments.length === 3 && segments[1] === 'job') {
      const jobId = segments[2];

      // First check if job exists at all (for debugging)
      const { data: anyJob, error: anyError } = await supabase
        .from('job_descriptions')
        .select('id, title, is_active')
        .eq('id', jobId)
        .maybeSingle();

      if (anyError) {
        console.error('Apply job fetch error:', anyError);
        return res.status(500).json({ error: anyError.message, code: anyError.code, details: anyError.details });
      }

      if (!anyJob) {
        return notFound(res, 'Job not found - ID does not exist in database');
      }

      if (!anyJob.is_active) {
        return res.status(410).json({ error: 'This job is no longer accepting applications', job_title: anyJob.title });
      }

      // Job exists and is active, fetch full details
      const { data, error } = await supabase
        .from('job_descriptions')
        .select('id, title, role, level, description, must_have_skills, good_to_have_skills, min_experience_years')
        .eq('id', jobId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        return res.status(500).json({ error: error.message, code: error.code, details: error.details });
      }
      if (!data) return notFound(res, 'Job not found or no longer accepting applications');
      return ok(res, data);
    }

    // POST /api/apply/submit
    if (req.method === 'POST' && segments.length === 2 && segments[1] === 'submit') {
      const body = req.body;
      const jobId = body.job_id;
      const fullName = body.full_name;
      const email = body.email;

      if (!body.consent_given) return badRequest(res, 'Consent is required');
      if (!jobId || !fullName || !email) return badRequest(res, 'job_id, full_name, email required');

      const { data: job, error: jobError } = await supabase
        .from('job_descriptions')
        .select('id, title, is_active')
        .eq('id', jobId)
        .eq('is_active', true)
        .maybeSingle();

      if (jobError) return res.status(500).json({ error: jobError.message, step: 'fetch_job' });
      if (!job) return notFound(res, 'Job not found or no longer accepting applications');

      // Sanitize and parse resume text (optional)
      let resumeText: string | null = null;
      let resumeParsedData: any = null;
      let autoScreenResult: any = null;
      if (body.resume_text) {
        // Sanitize: remove null bytes and invalid Unicode escape sequences
        resumeText = String(body.resume_text)
          .replace(/\x00/g, '')
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
          .slice(0, 50000);

        // Fetch full job for combined parse+screen
        const { data: fullJob } = await supabase
          .from('job_descriptions')
          .select('*')
          .eq('id', jobId)
          .single();

        try {
          // Combined: parse resume AND screen against job in ONE AI call
          const combinedPrompt = `You are an ATS system. Parse this resume and score it against the job.

RESUME TEXT:
${resumeText.slice(0, 6000)}

JOB: ${fullJob?.title || job.title} (${fullJob?.role || 'N/A'}, ${fullJob?.level || 'N/A'})
Required Skills: ${(fullJob?.must_have_skills || []).join(', ')}
Nice-to-have: ${(fullJob?.good_to_have_skills || []).join(', ')}
Min Experience: ${fullJob?.min_experience_years || 0} years

Return JSON with BOTH parsed resume and screening scores:
{
  "parsed_resume": {
    "skills": ["skill1", "skill2"],
    "experience": [{"title": "Job Title", "company": "Company", "duration": "2 years", "description": "Brief desc"}],
    "education": [{"degree": "Degree", "institution": "School", "year": "2020"}],
    "summary": "Brief professional summary",
    "total_experience_years": 3,
    "certifications": ["cert1"]
  },
  "screening": {
    "overall_score": 75,
    "skill_relevance_score": 80,
    "experience_score": 70,
    "education_score": 60,
    "credibility_score": 75,
    "shortlisted": true,
    "shortlist_reason": "Strong skill match",
    "reason_codes": [{"code": "SKILL_MATCH", "type": "positive", "description": "Has required skills", "impact": 10}]
  }
}`;
          const combined = await generateJSON<any>(combinedPrompt);
          console.log('Combined AI result keys:', Object.keys(combined));

          // Extract parsed resume - handle various response shapes
          if (combined.parsed_resume) {
            resumeParsedData = combined.parsed_resume;
          } else if (combined.skills) {
            // AI returned flat resume without nesting
            resumeParsedData = combined;
          } else {
            resumeParsedData = { skills: [], experience: [], education: [], summary: '', total_experience_years: 0, certifications: [] };
          }

          // Extract screening - handle various response shapes
          if (combined.screening) {
            autoScreenResult = combined.screening;
          } else if (combined.overall_score != null) {
            // AI returned flat screening without nesting
            autoScreenResult = combined;
          }

          // Ensure parsed_resume has required fields
          if (!resumeParsedData.skills) {
            resumeParsedData = { skills: [], experience: [], education: [], summary: '', total_experience_years: 0, certifications: [] };
          }
        } catch (parseErr: any) {
          console.error('Resume parse+screen failed:', parseErr.message);
          resumeParsedData = { skills: [], experience: [], education: [], summary: resumeText?.slice(0, 200) || '', total_experience_years: 0, certifications: [] };
        }
      }

      // Check for existing candidate
      const { data: existingCandidate } = await supabase
        .from('candidates')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      let candidateId: string;
      if (existingCandidate) {
        candidateId = existingCandidate.id;
        const { error: updateError } = await supabase.from('candidates').update({
          full_name: fullName,
          phone: body.phone || null,
          portfolio_url: body.portfolio_url || null,
          github_url: body.github_url || null,
          consent_given: true,
          consent_timestamp: new Date().toISOString(),
          resume_text: resumeText,
          resume_parsed_data: resumeParsedData,
        }).eq('id', candidateId);
        if (updateError) return res.status(500).json({ error: updateError.message, step: 'update_candidate' });
      } else {
        candidateId = uuidv4();
        const { error: insertError } = await supabase.from('candidates').insert({
          id: candidateId,
          full_name: fullName,
          email,
          phone: body.phone || null,
          portfolio_url: body.portfolio_url || null,
          github_url: body.github_url || null,
          consent_given: true,
          consent_timestamp: new Date().toISOString(),
          resume_text: resumeText,
          resume_parsed_data: resumeParsedData,
        });
        if (insertError) return res.status(500).json({ error: insertError.message, step: 'insert_candidate' });
      }

      // Create job application
      const applicationId = uuidv4();
      const { error: appError } = await supabase.from('job_applications').insert({
        id: applicationId,
        candidate_id: candidateId,
        job_id: jobId,
        status: 'applied',
        applied_at: new Date().toISOString(),
      });
      if (appError) {
        // If duplicate application, that's okay
        if (appError.code === '23505') {
          return ok(res, {
            job_id: jobId,
            candidate_id: candidateId,
            status: 'already_applied',
            message: `You have already applied for ${job.title}.`,
          });
        }
        return res.status(500).json({ error: appError.message, step: 'insert_application' });
      }

      // Send confirmation email (non-blocking)
      try {
        await sendApplicationReceived(email, fullName, job.title);
      } catch (emailErr: any) {
        console.error('Failed to send application email:', emailErr);
      }

      // Save ATS screening from combined result (already computed above)
      let atsScore: number | null = null;
      if (autoScreenResult && autoScreenResult.overall_score != null) {
        try {
          atsScore = autoScreenResult.overall_score;
          const screeningData = {
            candidate_id: candidateId,
            job_id: jobId,
            overall_score: autoScreenResult.overall_score,
            skill_relevance_score: autoScreenResult.skill_relevance_score ?? null,
            experience_score: autoScreenResult.experience_score ?? null,
            education_score: autoScreenResult.education_score ?? null,
            credibility_score: autoScreenResult.credibility_score ?? null,
            shortlisted: !!autoScreenResult.shortlisted,
            shortlist_reason: autoScreenResult.shortlist_reason ?? null,
            reason_codes: autoScreenResult.reason_codes ?? [],
            screened_at: new Date().toISOString(),
          };

          // Upsert screening
          const { data: existingScreen } = await supabase
            .from('ats_screenings')
            .select('id')
            .eq('candidate_id', candidateId)
            .eq('job_id', jobId)
            .maybeSingle();

          if (existingScreen) {
            await supabase.from('ats_screenings').update(screeningData).eq('id', existingScreen.id);
          } else {
            await supabase.from('ats_screenings').insert(screeningData);
          }

          // Update application status based on screening
          const newStatus = autoScreenResult.shortlisted ? 'screened' : 'rejected';
          await supabase.from('job_applications').update({
            status: newStatus,
            screening_status: autoScreenResult.shortlisted ? 'shortlisted' : 'rejected',
            updated_at: new Date().toISOString(),
          }).eq('id', applicationId);
        } catch (screenErr: any) {
          console.error('Screening save failed (non-blocking):', screenErr.message);
        }
      }

      return ok(res, {
        id: applicationId,
        job_id: jobId,
        candidate_id: candidateId,
        status: 'applied',
        ats_score: atsScore,
        message: `Application submitted successfully for ${job.title}.`,
      });
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
        mcq_count: session.mcq_question_count || 20,
        coding_count: session.coding_challenge_count || 2,
        total_time_minutes: session.total_time_minutes || 90,
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
        .select('id, status, job_id, mcq_questions, mcq_question_count')
        .eq('id', sessionId)
        .single();

      if (error || !session) return notFound(res, 'Session not found');
      if (session.status !== 'in_progress') return badRequest(res, 'Assessment not in progress');

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
      const prompt = `Generate exactly ${count} multiple choice questions for a ${job.level} ${job.role} position.
Skills to test: ${(job.must_have_skills || []).join(', ') || 'general programming'}.

Return a JSON object with a "questions" array. Each question object must have:
- "id": unique string like "q1", "q2", etc.
- "question": the question text
- "options": array of exactly 4 answer choices as strings
- "correct_index": integer 0-3 indicating correct answer
- "difficulty": "easy", "medium", or "hard"
- "topic": the skill/topic being tested
- "points": 5 for easy, 10 for medium, 15 for hard

Example:
{"questions":[{"id":"q1","question":"What is...?","options":["A","B","C","D"],"correct_index":0,"difficulty":"medium","topic":"JavaScript","points":10}]}`;

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
          difficulty: String(q?.difficulty || 'medium'),
          topic: String(q?.topic || 'General'),
          points: typeof q?.points === 'number' ? q.points : 5,
        }))
        .filter((q: any) => q.question && q.options.length === 4);

      console.log('MCQ questions generated:', questions.length);

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
    if (req.method === 'GET' && segments.length === 3 && segments[2] === 'coding') {
      const sessionId = segments[1];
      const { data: session } = await supabase
        .from('assessment_sessions')
        .select('id, status, job_id, coding_challenges, coding_challenge_count')
        .eq('id', sessionId)
        .single();

      if (!session) return notFound(res, 'Session not found');
      if (session.status !== 'in_progress') return badRequest(res, 'Assessment not in progress');

      const stored = session.coding_challenges || [];
      if (stored.length) return ok(res, stored);

      const { data: job } = await supabase.from('job_descriptions').select('*').eq('id', session.job_id).single();
      if (!job) return notFound(res, 'Job not found');

      const count = session.coding_challenge_count || 2;
      const prompt = `Generate exactly ${count} coding challenges for a ${job.level} ${job.role} position.
Skills: ${(job.must_have_skills || []).join(', ') || 'general programming'}.

Return a JSON object with a "challenges" array. Each challenge object must have:
- "id": unique string like "c1", "c2"
- "title": short challenge title
- "description": detailed problem description with examples
- "starter_code": Python code template to start with
- "test_cases": array of {"input":"...","expected_output":"..."} with at least 3 test cases
- "difficulty": "easy", "medium", or "hard"
- "time_limit_minutes": 15 for easy, 25 for medium, 35 for hard
- "points": 25 for easy, 50 for medium, 75 for hard

Example:
{"challenges":[{"id":"c1","title":"Two Sum","description":"Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.","starter_code":"def two_sum(nums, target):\\n    # Your code here\\n    pass","test_cases":[{"input":"[2,7,11,15], 9","expected_output":"[0,1]"},{"input":"[3,2,4], 6","expected_output":"[1,2]"},{"input":"[3,3], 6","expected_output":"[0,1]"}],"difficulty":"medium","time_limit_minutes":25,"points":50}]}`;

      let generated: any;
      try {
        generated = await generateJSON<any>(prompt);
        console.log('Coding challenge generation result keys:', Object.keys(generated || {}));
      } catch (genErr: any) {
        console.error('Coding challenge generation failed:', genErr.message);
        return res.status(500).json({ error: 'AI failed to generate coding challenges. Please try again.' });
      }

      const challengesRaw = Array.isArray(generated)
        ? generated
        : Array.isArray(generated?.challenges)
          ? generated.challenges
          : [];
      const challenges = challengesRaw
        .map((c: any, idx: number) => ({
          id: String(c?.id || `c${idx + 1}`),
          title: String(c?.title || ''),
          description: String(c?.description || ''),
          starter_code: String(c?.starter_code || 'def solution():\n    pass'),
          test_cases: Array.isArray(c?.test_cases) ? c.test_cases : [],
          difficulty: String(c?.difficulty || 'medium'),
          time_limit_minutes: typeof c?.time_limit_minutes === 'number' ? c.time_limit_minutes : 25,
          points: typeof c?.points === 'number' ? c.points : 50,
        }))
        .filter((c: any) => c.title && c.description);

      console.log('Coding challenges generated:', challenges.length);

      if (!challenges.length) {
        return res.status(500).json({ error: 'AI returned no valid coding challenges. Please try again.' });
      }

      await supabase.from('assessment_sessions').update({
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

    // POST /api/assessments/:sessionId/coding/submit
    if (req.method === 'POST' && segments.length === 4 && segments[2] === 'coding' && segments[3] === 'submit') {
      const sessionId = segments[1];
      const submission = req.body;
      const { challenge_id, code, language = 'python' } = submission;

      const { data: session } = await supabase.from('assessment_sessions').select('*').eq('id', sessionId).single();
      if (!session || session.status !== 'in_progress') return badRequest(res, 'Invalid session');

      // Find the challenge to get test cases
      const challenges: any[] = session.coding_challenges || [];
      const challenge = challenges.find((c: any) => c.id === challenge_id);
      if (!challenge) return badRequest(res, 'Challenge not found');

      const testCases = challenge.test_cases || [];
      const results: any[] = [];
      let passedCount = 0;

      // Execute code against each test case using Piston API
      for (const tc of testCases) {
        try {
          // Wrap user code with test case execution
          const wrappedCode = `${code}\n\n# Test execution\nimport json\ntry:\n    result = solution(${tc.input})\n    print(json.dumps(result))\nexcept Exception as e:\n    print(f"ERROR: {e}")`;

          const pistonResp = await fetch('https://emkc.org/api/v2/piston/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              language: 'python',
              version: '3.10',
              files: [{ content: wrappedCode }],
              stdin: '',
              args: [],
              compile_timeout: 10000,
              run_timeout: 5000,
            }),
          });

          const pistonResult = await pistonResp.json();
          const stdout = (pistonResult.run?.stdout || '').trim();
          const stderr = pistonResult.run?.stderr || '';
          const exitCode = pistonResult.run?.code || 0;

          const expectedOutput = String(tc.expected_output).trim();
          const passed = stdout === expectedOutput && exitCode === 0 && !stderr;

          if (passed) passedCount++;

          results.push({
            input: tc.input,
            expected: expectedOutput,
            actual: stdout,
            passed,
            error: stderr || null,
          });
        } catch (execErr: any) {
          results.push({
            input: tc.input,
            expected: tc.expected_output,
            actual: null,
            passed: false,
            error: execErr.message,
          });
        }
      }

      const totalTests = testCases.length || 1;
      const scorePercentage = (passedCount / totalTests) * 100;
      const pointsEarned = Math.round((passedCount / totalTests) * (challenge.points || 50));

      // Store submission with results
      const submissionRecord = {
        challenge_id,
        code,
        language,
        test_results: results,
        passed_count: passedCount,
        total_tests: totalTests,
        score_percentage: scorePercentage,
        points_earned: pointsEarned,
        max_points: challenge.points || 50,
        submitted_at: new Date().toISOString(),
      };

      const existing = session.coding_submissions || [];
      // Replace if same challenge already submitted
      const existingIdx = existing.findIndex((s: any) => s.challenge_id === challenge_id);
      if (existingIdx >= 0) {
        existing[existingIdx] = submissionRecord;
      } else {
        existing.push(submissionRecord);
      }

      // Calculate total coding score
      let totalCodingPoints = 0;
      let earnedCodingPoints = 0;
      for (const sub of existing) {
        totalCodingPoints += sub.max_points || 50;
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
        test_results: results,
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

      const { data: job } = await supabase.from('job_descriptions').select('id, title').eq('id', jobId).eq('created_by', user.id).single();
      if (!job) return notFound(res, 'Job not found');

      const { data: candidates } = await supabase.from('candidates').select('id, email, full_name').in('id', candidateIds);
      if (!candidates?.length) return notFound(res, 'No candidates found');

      const deadline = new Date(Date.now() + Number(deadlineHours) * 60 * 60 * 1000);
      const frontendUrl = process.env.FRONTEND_URL || 'https://hire-ai-sandy.vercel.app';

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
            mcq_question_count: body.mcq_question_count || 20,
            coding_challenge_count: body.coding_challenge_count || 2,
            total_time_minutes: body.total_time_minutes || 90,
            proctoring_data: { tab_switches: 0, fullscreen_exits: 0, copy_paste_attempts: 0, warnings: [], terminated: false },
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
        .select('id, title, role, level, must_have_skills')
        .eq('id', job_id)
        .eq('created_by', user.id)
        .single();

      if (!job) return notFound(res, 'Job not found');

      const { data: candidates } = await supabase
        .from('candidates')
        .select('id, email, full_name, resume_parsed_data')
        .in('id', candidate_ids);

      if (!candidates?.length) return notFound(res, 'No candidates found');

      const frontendUrl = process.env.FRONTEND_URL || 'https://hire-ai-sandy.vercel.app';
      let invitesSent = 0;
      const failed: string[] = [];

      for (const c of candidates) {
        try {
          const token = crypto.randomBytes(32).toString('base64url');

          const questions = await generateInterviewQuestions(job);

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
