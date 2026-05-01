/**
 * Profile route handler.
 * GET /api/profile — fetch or create profile
 * PATCH /api/profile — update profile
 * Extracted verbatim from api/[...path].ts — lines 1414-1506.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../_lib/supabase';
import { ok, methodNotAllowed, requireAuth } from '../_lib/helpers';

export default async function handleProfile(req: VercelRequest, res: VercelResponse, segments: string[]) {
  const supabase = getSupabaseAdmin();
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
