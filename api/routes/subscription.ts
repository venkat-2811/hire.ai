/**
 * Subscription route handler.
 * GET /api/subscription — get current subscription
 * POST /api/subscription/create-order — create Stripe checkout session
 * POST /api/subscription/verify — verify payment and activate plan
 * POST /api/subscription/select-free — select free plan
 * POST /api/subscription/cancel — cancel subscription
 * Extracted verbatim from api/[...path].ts — lines 1508-1664.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../_lib/supabase';
import { ok, badRequest, methodNotAllowed, requireAuth } from '../_lib/helpers';
import {
  getUserProfile, normalizeBillingPlan, BILLING_PLAN_CONFIG,
  createStripeCheckoutSession, getStripeCheckoutSession,
} from '../_lib/billing-utils';

export default async function handleSubscription(req: VercelRequest, res: VercelResponse, segments: string[]) {
  const supabase = getSupabaseAdmin();
  const user = await requireAuth(req, res);
  if (!user) return;

  // GET /api/subscription
  if (req.method === 'GET' && segments.length === 1) {
    const profile = await getUserProfile(supabase, user.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const plan = profile.subscription_plan || 'free';

    return ok(res, {
      plan,
      status: profile.subscription_status || 'active',
      subscription_id: profile.subscription_id,
      plan_selected_at: profile.plan_selected_at,
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
    if (!plan) return badRequest(res, 'Invalid plan');
    if (plan === 'free') return badRequest(res, 'Free plan does not require payment');

    const cfg = BILLING_PLAN_CONFIG[normalizeBillingPlan(plan)];

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
        cfg.monthly_deposit,
        plan.charAt(0).toUpperCase() + plan.slice(1),
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
        message: `${plan.charAt(0).toUpperCase() + plan.slice(1)} plan activated successfully!`,
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

  // POST /api/subscription/cancel
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
