/**
 * Screening route handler.
 * POST /api/screening/run
 * GET  /api/screening/candidate/:candidateId
 * GET  /api/screening/job/:jobId
 * GET  /api/screening/:id
 * Extracted verbatim from api/[...path].ts — lines 3323-3460.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../_lib/supabase';
import { ok, badRequest, notFound, methodNotAllowed, requireAuth } from '../_lib/helpers';
import { generateJSON } from '../_lib/openai';
import { checkPlanAccess } from '../_lib/billing-utils';

export default async function handleScreening(req: VercelRequest, res: VercelResponse, segments: string[]) {
  const supabase = getSupabaseAdmin();

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

    // Run ATS screening directly with AI
    const resumeJson = JSON.stringify(candidate.resume_parsed_data).slice(0, 6000);
    const prompt = `
Analyze this candidate's resume against the job requirements and provide ATS screening scores.

Job: ${job.title} (${job.role}, ${job.level})
Required Skills: ${(job.must_have_skills || []).join(', ')}
Nice-to-have Skills: ${(job.good_to_have_skills || []).join(', ')}
Min Experience: ${job.min_experience_years} years

Candidate Resume JSON:
${resumeJson}

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

    let screeningResult: any;
    try {
      screeningResult = await generateJSON<any>(prompt, { timeoutMs: 20000, maxTokens: 1200, temperature: 0.1 });
    } catch (screenErr: any) {
      console.error('ATS screening AI failed:', screenErr?.message);
      return res.status(502).json({ error: 'Failed to run ATS screening. Please try again.' });
    }

    // Save screening result to database
    const dataToSave = {
      candidate_id: candidate_id,
      job_id: job_id,
      overall_score: screeningResult.overall_score,
      skill_relevance_score: screeningResult.skill_relevance_score ?? null,
      experience_score: screeningResult.experience_score ?? null,
      education_score: screeningResult.education_score ?? null,
      credibility_score: screeningResult.credibility_score ?? null,
      shortlisted: !!screeningResult.shortlisted,
      shortlist_reason: screeningResult.shortlist_reason ?? null,
      reason_codes: screeningResult.reason_codes ?? [],
      screened_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from('ats_screenings')
      .select('id')
      .eq('candidate_id', candidate_id)
      .eq('job_id', job_id)
      .maybeSingle();

    const saved = existing
      ? await supabase
          .from('ats_screenings')
          .update(dataToSave)
          .eq('id', existing.id)
          .select('*')
          .maybeSingle()
      : await supabase
          .from('ats_screenings')
          .insert(dataToSave)
          .select('*')
          .maybeSingle();

    if (saved.error) return res.status(500).json({ error: saved.error.message });

    return ok(res, { success: true, screeningData: saved.data });
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
