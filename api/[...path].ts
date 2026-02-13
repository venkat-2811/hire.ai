import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
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

// ============== INLINE: Gemini ==============
let _gemini: GenerativeModel | null = null;
function getGeminiModel(): GenerativeModel {
  if (!_gemini) {
    const k = process.env.GEMINI_API_KEY;
    if (!k) throw new Error('GEMINI_API_KEY not configured');
    _gemini = new GoogleGenerativeAI(k).getGenerativeModel({ model: 'gemini-1.5-flash' });
  }
  return _gemini;
}
async function generateText(prompt: string, opts: { temperature?: number; maxTokens?: number } = {}): Promise<string> {
  const r = await getGeminiModel().generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: opts.temperature ?? 0.7, maxOutputTokens: opts.maxTokens ?? 2048 },
  });
  return r.response.text();
}
async function generateJSON<T>(prompt: string): Promise<T> {
  const text = await generateText(prompt, { temperature: 0.3 });
  const m = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/) || [null, text];
  try { return JSON.parse((m[1] || text).trim()) as T; }
  catch { throw new Error('Failed to parse AI response as JSON'); }
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
  const pathParam = (req.query.path ?? []) as string[] | string;
  const segments = Array.isArray(pathParam) ? pathParam : [pathParam];

  // /api/health
  if (segments.length === 1 && segments[0] === 'health') {
    if (req.method !== 'GET') return methodNotAllowed(res);

    // Check env vars availability
    const envStatus = {
      SUPABASE_URL: !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
      SUPABASE_SERVICE_KEY: !!(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
      CLERK_JWKS_URL: !!process.env.CLERK_JWKS_URL,
      CLERK_ISSUER: !!process.env.CLERK_ISSUER,
      GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
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
        const { role, level, is_active } = req.query;
        let q = supabase.from('job_descriptions').select('*');
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
        const jobData = {
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

        const { data, error } = await supabase
          .from('candidates')
          .select('*')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) return res.status(500).json({ error: error.message });
        return ok(res, data);
      }

      if (req.method === 'POST') {
        const user = await requireAuth(req, res);
        if (!user) return;

        // For now: accept JSON-only candidate creation (resume upload via Storage can be added later)
        const body = req.body;
        const candidateData = {
          full_name: body.full_name,
          email: body.email,
          phone: body.phone || null,
          portfolio_url: body.portfolio_url || null,
          github_url: body.github_url || null,
          consent_given: !!body.consent_given,
          consent_timestamp: body.consent_given ? new Date().toISOString() : null,
          user_id: body.user_id || null,
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
      const { count: totalCandidates } = await supabase
        .from('candidates')
        .select('id', { count: 'exact', head: true });

      const { count: activeJobs } = await supabase
        .from('job_descriptions')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);

      const { count: pendingInterviews } = await supabase
        .from('interview_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

      const { data: scores } = await supabase.from('ats_screenings').select('overall_score');
      const validScores = (scores || [])
        .map((s: any) => s.overall_score)
        .filter((s: unknown): s is number => typeof s === 'number');

      const averageScore = validScores.length
        ? Math.round(validScores.reduce((a: number, b: number) => a + b, 0) / validScores.length)
        : 0;

      const { count: shortlistedCount } = await supabase
        .from('ats_screenings')
        .select('id', { count: 'exact', head: true })
        .eq('shortlisted', true);

      const shortlistRate = validScores.length > 0
        ? Math.round(((shortlistedCount || 0) / validScores.length) * 100)
        : 0;

      return ok(res, {
        total_candidates: totalCandidates || 0,
        total_candidates_change: 0,
        active_jobs: activeJobs || 0,
        active_jobs_change: 0,
        pending_interviews: pendingInterviews || 0,
        pending_interviews_change: 0,
        completed_today: 0,
        completed_today_change: 0,
        average_score: averageScore,
        shortlist_rate: shortlistRate,
      });
    }

    // GET /api/analytics/candidates
    if (segments.length === 2 && segments[1] === 'candidates') {
      const jobId = (req.query.job_id as string) || null;
      const limit = parseInt((req.query.limit as string) || '50');

      const { data: candidates, error } = await supabase
        .from('candidates')
        .select(
          `
          id, full_name,
          ats_screenings(overall_score, job_id, job_descriptions(title)),
          assessment_sessions(total_score, status, job_id, completed_at),
          ai_interview_sessions(status, job_id, completed_at, final_evaluation)
        `
        )
        .limit(limit);

      if (error) return res.status(500).json({ error: error.message });

      const analytics = (candidates || []).map((row: any) => {
        const screenings = row.ats_screenings || [];
        const assessments = row.assessment_sessions || [];
        const aiSessions = row.ai_interview_sessions || [];

        const latestScreening = jobId
          ? screenings.find((s: any) => s.job_id === jobId) || screenings[0]
          : screenings[0];

        const latestAiSession = jobId
          ? aiSessions.find((s: any) => s.job_id === jobId) || aiSessions[0]
          : aiSessions[0];

        const finalEval = latestAiSession?.final_evaluation || {};

        return {
          candidate_id: row.id,
          candidate_name: row.full_name,
          job_title: latestScreening?.job_descriptions?.title || 'N/A',
          ats_score: latestScreening?.overall_score || 0,
          interview_status: latestAiSession?.status || 'pending',
          technical_score: finalEval.technical_score || null,
          overall_score: finalEval.overall_score || null,
          recommendation: finalEval.recommendation || null,
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
      const { data, error } = await supabase
        .from('job_descriptions')
        .select('id, title, role, level, description, must_have_skills, good_to_have_skills, min_experience_years')
        .eq('id', jobId)
        .eq('is_active', true)
        .single();

      if (error || !data) return notFound(res, 'Job not found or no longer accepting applications');
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

      const { data: job } = await supabase
        .from('job_descriptions')
        .select('id, title, is_active')
        .eq('id', jobId)
        .eq('is_active', true)
        .single();

      if (!job) return notFound(res, 'Job not found');

      // Parse resume text (optional)
      let resumeParsedData: any = null;
      if (body.resume_text) {
        try {
          resumeParsedData = await generateJSON<any>(`Parse resume into JSON: ${String(body.resume_text).slice(0, 5000)}`);
        } catch {
          resumeParsedData = null;
        }
      }

      const user = await getOptionalUser(req);

      const { data: existingCandidate } = await supabase
        .from('candidates')
        .select('id')
        .eq('email', email)
        .single();

      let candidateId: string;
      if (existingCandidate) {
        candidateId = existingCandidate.id;
        await supabase.from('candidates').update({
          full_name: fullName,
          phone: body.phone || null,
          portfolio_url: body.portfolio_url || null,
          github_url: body.github_url || null,
          consent_given: true,
          consent_timestamp: new Date().toISOString(),
          user_id: user?.id || null,
          resume_text: body.resume_text || null,
          resume_parsed_data: resumeParsedData,
        }).eq('id', candidateId);
      } else {
        candidateId = uuidv4();
        await supabase.from('candidates').insert({
          id: candidateId,
          full_name: fullName,
          email,
          phone: body.phone || null,
          portfolio_url: body.portfolio_url || null,
          github_url: body.github_url || null,
          consent_given: true,
          consent_timestamp: new Date().toISOString(),
          user_id: user?.id || null,
          resume_text: body.resume_text || null,
          resume_parsed_data: resumeParsedData,
        });
      }

      const applicationId = uuidv4();
      await supabase.from('job_applications').insert({
        id: applicationId,
        candidate_id: candidateId,
        job_id: jobId,
        status: 'applied',
        applied_at: new Date().toISOString(),
      });

      try {
        await sendApplicationReceived(email, fullName, job.title);
      } catch {
        // ignore
      }

      return ok(res, {
        id: applicationId,
        job_id: jobId,
        candidate_id: candidateId,
        status: 'applied',
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
      const prompt = `Generate ${count} MCQ questions for role ${job.role}, level ${job.level}. Return JSON array with fields: id, question, options (4), correct_index, difficulty, topic, points.`;
      const questions = await generateJSON<any[]>(prompt);

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
      const prompt = `Generate ${count} coding challenges for role ${job.role}, level ${job.level}. Return JSON array with id,title,description,starter_code,test_cases,difficulty,time_limit_minutes,points.`;
      const challenges = await generateJSON<any[]>(prompt);

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
      let totalPoints = 0;
      let scoredPoints = 0;

      for (const s of submissions) {
        const q = questionMap.get(s.question_id);
        if (!q) continue;
        const pts = q.points ?? 5;
        totalPoints += pts;
        if (s.selected_index === q.correct_index) scoredPoints += pts;
      }

      const percentage = totalPoints > 0 ? (scoredPoints / totalPoints) * 100 : 0;

      await supabase.from('assessment_sessions').update({
        mcq_submissions: submissions,
        mcq_score: percentage,
      }).eq('id', sessionId);

      return ok(res, { success: true, score: percentage, total: totalPoints, correct_points: scoredPoints });
    }

    // POST /api/assessments/:sessionId/coding/submit
    if (req.method === 'POST' && segments.length === 4 && segments[2] === 'coding' && segments[3] === 'submit') {
      const sessionId = segments[1];
      const submission = req.body;

      const { data: session } = await supabase.from('assessment_sessions').select('*').eq('id', sessionId).single();
      if (!session || session.status !== 'in_progress') return badRequest(res, 'Invalid session');

      const existing = session.coding_submissions || [];
      existing.push(submission);

      await supabase.from('assessment_sessions').update({ coding_submissions: existing }).eq('id', sessionId);
      return ok(res, { success: true, message: 'Solution submitted for evaluation' });
    }

    // POST /api/assessments/:sessionId/proctoring
    if (req.method === 'POST' && segments.length === 3 && segments[2] === 'proctoring') {
      const sessionId = segments[1];
      const event = req.body;

      const { data: session } = await supabase.from('assessment_sessions').select('*').eq('id', sessionId).single();
      if (!session) return notFound(res, 'Session not found');

      const proctoring = session.proctoring_data || {};
      if (event.event_type === 'tab_switch') proctoring.tab_switches = (proctoring.tab_switches || 0) + 1;
      if (event.event_type === 'fullscreen_exit') proctoring.fullscreen_exits = (proctoring.fullscreen_exits || 0) + 1;
      if (event.event_type === 'copy_paste') proctoring.copy_paste_attempts = (proctoring.copy_paste_attempts || 0) + 1;

      const warnings = proctoring.warnings || [];
      warnings.push({ type: event.event_type, timestamp: event.timestamp, details: event.details });
      proctoring.warnings = warnings;

      const totalViolations = (proctoring.tab_switches || 0) + (proctoring.fullscreen_exits || 0);
      const shouldTerminate = totalViolations >= 3;

      if (shouldTerminate) {
        proctoring.terminated = true;
        await supabase.from('assessment_sessions').update({
          proctoring_data: proctoring,
          status: 'terminated',
          completed_at: new Date().toISOString(),
        }).eq('id', sessionId);

        return ok(res, { warning: false, terminated: true, message: 'Assessment terminated due to multiple violations' });
      }

      await supabase.from('assessment_sessions').update({ proctoring_data: proctoring }).eq('id', sessionId);
      return ok(res, {
        warning: true,
        terminated: false,
        violations_remaining: 3 - totalViolations,
        message: `Warning: ${3 - totalViolations} violations remaining before termination`,
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

      const { data: job } = await supabase.from('job_descriptions').select('id, title').eq('id', jobId).single();
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
      const warnings = proctoring.warnings || [];
      warnings.push({ type: event.event_type, timestamp: event.timestamp, details: event.details });
      proctoring.warnings = warnings;

      await supabase.from('ai_interview_sessions').update({ proctoring_data: proctoring }).eq('id', sessionId);
      return ok(res, { success: true });
    }

    // POST /api/ai-interview/:sessionId/complete
    if (req.method === 'POST' && segments.length === 3 && segments[2] === 'complete') {
      const sessionId = segments[1];
      const { data: session } = await supabase.from('ai_interview_sessions').select('*').eq('id', sessionId).single();
      if (!session) return notFound(res, 'Session not found');

      // Minimal placeholder evaluation
      const finalEvaluation = {
        overall_score: 70,
        technical_score: 70,
        communication_score: 70,
        confidence_score: 70,
        recommendation: 'hire',
        strengths: ['Good communication'],
        areas_for_improvement: ['More depth on technicals'],
        detailed_feedback: 'Automated evaluation placeholder.',
      };

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
