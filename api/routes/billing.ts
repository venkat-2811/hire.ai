/**
 * Billing route handler.
 * POST /api/billing/webhook — Stripe webhook
 * POST /api/billing/subscribe — create subscription checkout
 * GET  /api/billing/usage — wallet + usage breakdown
 * POST /api/billing/topup — wallet topup
 * POST /api/billing/pay-invoice — pay pending invoice
 * GET  /api/billing/invoices — list invoices
 * Extracted verbatim from api/[...path].ts — lines 1688-1922.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../_lib/supabase';
import { ok, badRequest, notFound, methodNotAllowed, requireAuth } from '../_lib/helpers';
import {
  getUserProfile, getOrCreateSubscription, normalizeBillingPlan,
  BILLING_PLAN_CONFIG, FEATURE_COSTS, aggregateUsageByFeature,
  createStripeCheckoutSession,
} from '../_lib/billing-utils';

// Inline email sender for billing context (matches monolith signature)
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

export default async function handleBilling(req: VercelRequest, res: VercelResponse, segments: string[]) {
  const supabase = getSupabaseAdmin();

  // POST /api/billing/webhook (Stripe) — no auth required
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
        if (action === 'topup' || action === 'invoice_payment') {
          await supabase.from('subscriptions').update({
            wallet_balance: Number(sub.wallet_balance || 0) + amount,
            status: 'active',
            resumed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('id', sub.id);

          const profile = await getUserProfile(supabase, userId);
          if (profile?.email) {
            await sendEmail(
              profile.email,
              'Services restored',
              `<h2>Payment confirmed</h2><p>Your payment of <strong>$${amount.toFixed(2)}</strong> was successful and services have been restored.</p>`,
            );
          }

          if (action === 'invoice_payment' && metadata.invoice_id) {
            await supabase.from('invoices').update({
              status: 'paid',
              paid_at: new Date().toISOString(),
              payment_reference: obj.payment_intent || obj.id,
              updated_at: new Date().toISOString(),
            }).eq('id', metadata.invoice_id);
          }
        }

        if (action === 'subscribe') {
          const nextPlan = normalizeBillingPlan(metadata.plan as string);
          const cfg = BILLING_PLAN_CONFIG[nextPlan];
          const now = new Date();
          const cycleEnd = new Date(now);
          cycleEnd.setMonth(cycleEnd.getMonth() + 1);

          await supabase.from('subscriptions').update({
            plan: nextPlan,
            status: 'active',
            deposit_amount: amount || cfg.monthly_deposit,
            wallet_balance: amount || cfg.monthly_deposit,
            billing_cycle_start: now.toISOString(),
            billing_cycle_end: cycleEnd.toISOString(),
            paused_at: null,
            resumed_at: now.toISOString(),
            warning_80_sent_at: null,
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
    if (requestedPlan === 'free') {
      return badRequest(res, 'Use free plan selection endpoint for free tier');
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
      Math.round(cfg.monthly_deposit * 100),
      `${requestedPlan.toUpperCase()} Deposit`,
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
      deposit_amount: cfg.monthly_deposit,
    });
  }

  // GET /api/billing/usage
  if (segments.length === 2 && segments[1] === 'usage' && req.method === 'GET') {
    const subscription = await getOrCreateSubscription(supabase, user.id);
    const plan = normalizeBillingPlan(subscription.plan);
    const cfg = BILLING_PLAN_CONFIG[plan];
    const periodStart = subscription.billing_cycle_start || new Date(new Date().setDate(1)).toISOString();
    const periodEnd = subscription.billing_cycle_end || new Date().toISOString();
    const aggregated = await aggregateUsageByFeature(supabase, user.id, periodStart, periodEnd);

    return ok(res, {
      plan,
      status: subscription.status,
      wallet_balance: Number(subscription.wallet_balance || 0),
      deposit_amount: Number(subscription.deposit_amount || 0),
      overage_amount: Number(subscription.overage_amount || 0),
      overage_cap: subscription.overage_cap,
      billing_cycle_start: subscription.billing_cycle_start,
      billing_cycle_end: subscription.billing_cycle_end,
      limits: {
        free_caps: cfg.free_caps,
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

  // POST /api/billing/pay-invoice
  if (segments.length === 2 && segments[1] === 'pay-invoice' && req.method === 'POST') {
    const invoiceId = String(req.body?.invoice_id || '');
    if (!invoiceId) return badRequest(res, 'invoice_id is required');

    const { data: invoice } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('user_id', user.id)
      .single();

    if (!invoice) return notFound(res, 'Invoice not found');
    if (invoice.status === 'paid') return ok(res, { success: true, already_paid: true });

    const total = Number(invoice.total || 0);
    if (total <= 0) {
      return badRequest(res, 'Invoice total is invalid');
    }

    const hostHeader = req.headers['x-forwarded-host'] || req.headers.host;
    const isLocalhost = String(hostHeader).includes('localhost');
    const protocol = req.headers['x-forwarded-proto'] ? String(req.headers['x-forwarded-proto']).split(',')[0] : (isLocalhost ? 'http' : 'https');
    const dynamicUrl = hostHeader ? `${protocol}://${hostHeader}` : 'https://hire-ai-sandy.vercel.app';
    const frontendUrl = process.env.FRONTEND_URL || dynamicUrl;

    const session = await createStripeCheckoutSession(
      Math.round(total * 100),
      `Invoice ${invoiceId}`,
      'invoice_payment',
      `${frontendUrl}/billing?checkout=success&action=invoice_payment`,
      `${frontendUrl}/billing?checkout=cancelled&action=invoice_payment`,
      {
        action: 'invoice_payment',
        user_id: user.id,
        invoice_id: invoiceId,
      },
    );

    return ok(res, {
      success: true,
      session_id: session.id,
      checkout_url: session.url,
    });
  }

  // GET /api/billing/invoices
  if (segments.length === 2 && segments[1] === 'invoices' && req.method === 'GET') {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return ok(res, data || []);
  }

  return methodNotAllowed(res);
}
