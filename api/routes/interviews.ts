/**
 * Interviews route handler.
 * GET  /api/interviews — list interview sessions
 * POST /api/interviews — create interview session
 * Extracted verbatim from api/[...path].ts — lines 5433-5474.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../_lib/supabase';
import { ok, methodNotAllowed, notFound, requireAuth } from '../_lib/helpers';

export default async function handleInterviews(req: VercelRequest, res: VercelResponse, segments: string[]) {
  const supabase = getSupabaseAdmin();
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
