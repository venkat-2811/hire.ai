/**
 * Interviews route handler.
 * GET  /api/interviews — list interview sessions
 * POST /api/interviews — create interview session
 * Extracted verbatim from api/[...path].ts — lines 5433-5474.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../_lib/supabase';
import { ok, methodNotAllowed, requireAuth } from '../_lib/helpers';

export default async function handleInterviews(req: VercelRequest, res: VercelResponse, segments: string[]) {
  const supabase = getSupabaseAdmin();
  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.method === 'GET' && segments.length === 1) {
    const { data, error } = await supabase
      .from('interview_sessions')
      .select('*, candidates(full_name, email), jobs(title, role)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return ok(res, data || []);
  }

  if (req.method === 'POST' && segments.length === 1) {
    const body = req.body || {};
    const { data, error } = await supabase
      .from('interview_sessions')
      .insert({
        user_id: user.id,
        candidate_id: body.candidate_id,
        job_id: body.job_id,
        status: 'pending',
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return ok(res, data, 201);
  }

  return methodNotAllowed(res);
}
