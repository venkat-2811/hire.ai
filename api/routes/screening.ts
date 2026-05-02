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
import { inngest } from '../_lib/inngest';
import { createJob, updateJobStatus } from '../_lib/jobTracker';

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

    const trackerJobId = await createJob('screening_run', { candidate_id, job_id }, user.id);
    try {
      await inngest.send({
        name: 'screening/run',
        data: {
          job_id: trackerJobId,
          candidate_id,
          internal_job_id: job_id
        }
      });
    } catch (e: any) {
      const msg = e?.message || 'Failed to dispatch screening event';
      await updateJobStatus(trackerJobId, 'failed', null, msg);
      return res.status(500).json({ error: msg });
    }

    return ok(res, { job_id: trackerJobId, status: 'queued', message: 'Screening queued' }, 202);
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
