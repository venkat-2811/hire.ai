/**
 * Usage route handler.
 * GET /api/usage — get usage stats
 * Extracted verbatim from api/[...path].ts — lines 1666-1686.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../_lib/supabase';
import { ok, methodNotAllowed, requireAuth } from '../_lib/helpers';
import { getUserProfile } from '../_lib/billing-utils';

export default async function handleUsage(req: VercelRequest, res: VercelResponse, segments: string[]) {
  const supabase = getSupabaseAdmin();
  const user = await requireAuth(req, res);
  if (!user) return;
  if (req.method !== 'GET') return methodNotAllowed(res);

  const profile = await getUserProfile(supabase, user.id);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });

  const plan = profile.subscription_plan || 'free';

  return ok(res, {
    plan,
    plan_label: plan.charAt(0).toUpperCase() + plan.slice(1),
    usage: {
      jobs: { used: profile.jobs_count || 0, limit: 999999, label: 'Job Roles' },
      assessments: { used: profile.assessments_count || 0, limit: 999999, label: 'Technical Assessments' },
      interviews: { used: profile.interviews_count || 0, limit: 999999, label: 'Interviews' },
    },
  });
}
