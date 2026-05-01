/**
 * Billing plan configuration, wallet access checks, Stripe helpers,
 * and subscription management utilities.
 * Extracted verbatim from api/[...path].ts — lines 974-1352.
 */
import { type SupabaseClient } from '@supabase/supabase-js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type BillingPlan = 'free' | 'pro' | 'premium';
export type BillingStatus = 'active' | 'paused' | 'overdue' | 'cancel_at_period_end';
export type BillableFeature =
  | 'create_job'
  | 'resume_parse'
  | 'candidate_scoring'
  | 'assessment_invite'
  | 'ai_interview_invite'
  | 'regenerate_interview_questions'
  | 'assessment_mcq_generation';

// ── Plan config ───────────────────────────────────────────────────────────────

export const BILLING_PLAN_CONFIG: Record<BillingPlan, {
  monthly_deposit: number;
  free_caps: Partial<Record<BillableFeature, number>>;
  overage_cap: number | null;
}> = {
  free: {
    monthly_deposit: 0,
    free_caps: {
      create_job: 10,
      resume_parse: 30,
      candidate_scoring: 60,
      assessment_invite: 25,
      ai_interview_invite: 25,
      regenerate_interview_questions: 20,
      assessment_mcq_generation: 40,
    },
    overage_cap: 0,
  },
  pro: {
    monthly_deposit: 36.13,
    free_caps: {},
    overage_cap: 180.72,
  },
  premium: {
    monthly_deposit: 96.37,
    free_caps: {},
    overage_cap: null,
  },
};

export const FEATURE_COSTS: Record<BillableFeature, number> = {
  create_job: 0.18,
  resume_parse: 0.1,
  candidate_scoring: 0.14,
  assessment_invite: 0.12,
  ai_interview_invite: 0.3,
  regenerate_interview_questions: 0.06,
  assessment_mcq_generation: 0.24,
};

// ── Normalization helpers ─────────────────────────────────────────────────────

export function normalizeBillingPlan(rawPlan: string | null | undefined): BillingPlan {
  const p = String(rawPlan || 'free').toLowerCase();
  if (p.startsWith('pro')) return 'pro';
  if (p.startsWith('premium')) return 'premium';
  return 'free';
}

/** Clamp any arbitrary profile status string to one of the four allowed values
 *  so the subscriptions table CHECK constraint is never violated. */
export function normalizeBillingStatus(rawStatus: string | null | undefined): BillingStatus {
  const s = String(rawStatus || 'active').toLowerCase();
  if (s === 'paused') return 'paused';
  if (s === 'overdue') return 'overdue';
  if (s === 'cancel_at_period_end' || s === 'cancelled' || s === 'canceled') return 'cancel_at_period_end';
  return 'active'; // default — covers null, '', 'trialing', 'inactive', etc.
}

// ── Profile & Subscription access ─────────────────────────────────────────────

export async function getUserProfile(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
  return data;
}

export async function getOrCreateSubscription(supabase: SupabaseClient, userId: string) {
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) return existing;

  const profile = await getUserProfile(supabase, userId);
  const plan = normalizeBillingPlan(profile?.subscription_plan);
  const cfg = BILLING_PLAN_CONFIG[plan];
  const now = new Date();
  const cycleEnd = new Date(now);
  cycleEnd.setMonth(cycleEnd.getMonth() + 1);

  // Normalize status so it always satisfies the DB CHECK constraint
  const status = normalizeBillingStatus(profile?.subscription_status);

  const { data: created, error } = await supabase
    .from('subscriptions')
    .insert({
      user_id: userId,
      plan,
      status,
      deposit_amount: cfg.monthly_deposit,
      wallet_balance: cfg.monthly_deposit,
      billing_cycle_start: now.toISOString(),
      billing_cycle_end: cycleEnd.toISOString(),
      overage_amount: 0,
      overage_cap: cfg.overage_cap,
      metadata: { source: 'auto-bootstrap' },
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return created;
}

// ── Usage aggregation ─────────────────────────────────────────────────────────

export async function aggregateUsageByFeature(
  supabase: SupabaseClient,
  userId: string,
  fromIso: string,
  toIso: string,
) {
  const { data } = await supabase
    .from('usage_events')
    .select('feature_type, quantity, unit_cost, total_cost, created_at')
    .eq('user_id', userId)
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
    .order('created_at', { ascending: false });

  const byFeature: Record<string, { quantity: number; total_cost: number }> = {};
  let totalCost = 0;
  for (const ev of (data || [])) {
    const f = String(ev.feature_type);
    if (!byFeature[f]) byFeature[f] = { quantity: 0, total_cost: 0 };
    byFeature[f].quantity += Number(ev.quantity || 1);
    byFeature[f].total_cost += Number(ev.total_cost || 0);
    totalCost += Number(ev.total_cost || 0);
  }

  return { byFeature, totalCost };
}

// ── Invoice creation ──────────────────────────────────────────────────────────

export async function createInvoiceForOverage(
  supabase: SupabaseClient,
  userId: string,
  amount: number,
  lineItems: any[],
) {
  if (amount <= 0) return null;

  const { data: existingPending } = await supabase
    .from('invoices')
    .select('id, total')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingPending) {
    await supabase
      .from('invoices')
      .update({
        total: Number(existingPending.total || 0) + amount,
        subtotal: Number(existingPending.total || 0) + amount,
        line_items: lineItems,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingPending.id);
    return existingPending.id;
  }

  const now = new Date();
  const due = new Date(now);
  due.setDate(due.getDate() + 7);

  const { data: created, error } = await supabase
    .from('invoices')
    .insert({
      user_id: userId,
      period_start: now.toISOString(),
      period_end: now.toISOString(),
      line_items: lineItems,
      subtotal: amount,
      tax_amount: 0,
      total: amount,
      status: 'pending',
      due_date: due.toISOString(),
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return created?.id || null;
}

// ── Billing emails ────────────────────────────────────────────────────────────

async function sendBillingEmail(to: string, subject: string, html: string) {
  const k = process.env.RESEND_API_KEY;
  if (!k) { console.warn('RESEND_API_KEY missing, skipping email'); return; }

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev', to, subject, html }),
  });
  if (!r.ok) throw new Error(`Email failed: ${await r.text()}`);
}

export async function sendBillingWarningEmail(userEmail: string, plan: BillingPlan, walletBalance: number) {
  if (!userEmail) return;
  await sendBillingEmail(
    userEmail,
    'Your HireAI wallet is running low',
    `<h2>Wallet usage alert</h2><p>Your ${plan.toUpperCase()} wallet balance is now <strong>$${walletBalance.toFixed(2)}</strong>.</p><p>Top up now to avoid service interruptions.</p>`,
  );
}

export async function sendBillingPausedEmail(userEmail: string) {
  if (!userEmail) return;
  await sendBillingEmail(
    userEmail,
    'Services paused — pay now to resume',
    `<h2>Services paused</h2><p>Your HireAI wallet is exhausted. New job posting and AI generation features are paused.</p><p>Please add funds or pay pending invoices to resume service.</p>`,
  );
}

// ── Plan access check ─────────────────────────────────────────────────────────

export async function checkPlanAccess(
  supabase: SupabaseClient,
  userId: string,
  feature: BillableFeature,
  options?: { quantity?: number; jobId?: string; candidateId?: string; metadata?: Record<string, any> },
) {
  const quantity = Math.max(1, Number(options?.quantity || 1));
  const profile = await getUserProfile(supabase, userId);
  const subscription = await getOrCreateSubscription(supabase, userId);
  const plan = normalizeBillingPlan(subscription.plan || profile?.subscription_plan);
  const cfg = BILLING_PLAN_CONFIG[plan];

  if (subscription.status === 'paused' || subscription.status === 'overdue') {
    return {
      allowed: false,
      status: 402,
      error: 'billing_paused',
      message: 'Your account is paused due to insufficient wallet balance. Please pay invoice/top up to continue.',
      plan,
      wallet_balance: Number(subscription.wallet_balance || 0),
    };
  }

  // No plan-based hard limits - rely on wallet model only

  const unitCost = FEATURE_COSTS[feature] ?? 0;
  const totalCost = unitCost * quantity;
  const currentWallet = Number(subscription.wallet_balance || 0);
  const newWallet = currentWallet - totalCost;

  await supabase.from('usage_events').insert({
    user_id: userId,
    feature_type: feature,
    unit_cost: unitCost,
    quantity,
    total_cost: totalCost,
    job_id: options?.jobId || null,
    candidate_id: options?.candidateId || null,
    metadata: options?.metadata || {},
  });

  const updatePayload: Record<string, any> = {
    wallet_balance: Math.max(0, newWallet),
    updated_at: new Date().toISOString(),
  };

  const startBalance = cfg.monthly_deposit || Number(subscription.deposit_amount || 0) || 1;
  const consumedRatio = 1 - (Math.max(0, newWallet) / startBalance);

  if (consumedRatio >= 0.8 && !subscription.warning_80_sent_at) {
    updatePayload.warning_80_sent_at = new Date().toISOString();
    if (profile?.email) {
      sendBillingWarningEmail(profile.email, plan, Math.max(0, newWallet)).catch(() => null);
    }
  }

  if (newWallet <= 0) {
    const overage = Math.abs(newWallet);
    updatePayload.status = 'paused';
    updatePayload.paused_at = new Date().toISOString();
    updatePayload.overage_amount = Number(subscription.overage_amount || 0) + overage;

    const invoiceId = await createInvoiceForOverage(
      supabase,
      userId,
      overage,
      [
        {
          feature,
          quantity,
          unit_cost: unitCost,
          total: totalCost,
          overage_component: overage,
          at: new Date().toISOString(),
        },
      ],
    );

    if (profile?.email) {
      sendBillingPausedEmail(profile.email).catch(() => null);
      sendBillingEmail(
        profile.email,
        'Invoice generated for usage overage',
        `<h2>Invoice generated</h2><p>Your account exceeded wallet balance and invoice <strong>${invoiceId || ''}</strong> has been generated.</p><p>Please complete payment to resume all services.</p>`,
      ).catch(() => null);
    }
  }

  await supabase.from('subscriptions').update(updatePayload).eq('id', subscription.id);

  if (newWallet <= 0) {
    return {
      allowed: false,
      status: 402,
      error: 'billing_paused',
      message: 'Wallet exhausted. Services are paused. Please top up or pay invoice to resume.',
      plan,
      wallet_balance: 0,
      charged: totalCost,
    };
  }

  return {
    allowed: true,
    plan,
    wallet_balance: Math.max(0, newWallet),
    charged: totalCost,
  };
}

// ── Stripe helpers ────────────────────────────────────────────────────────────

export function getStripeSecretKey(): string {
  return process.env.STRIPE_SECRET_KEY || '';
}

export async function createStripeCheckoutSession(
  amount: number,
  planLabel: string,
  planId: string,
  successUrl: string,
  cancelUrl: string,
  metadata?: Record<string, string>,
) {
  const payload = new URLSearchParams({
    'mode': 'payment',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][product_data][name]': `Hire.AI ${planLabel}`,
    'line_items[0][price_data][unit_amount]': String(amount),
    'line_items[0][quantity]': '1',
    'success_url': successUrl,
    'cancel_url': cancelUrl,
    'metadata[plan]': planId,
  });

  if (metadata) {
    Object.entries(metadata).forEach(([key, value]) => {
      payload.append(`metadata[${key}]`, String(value));
    });
  }

  const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getStripeSecretKey()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: payload.toString(),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Stripe checkout session creation failed: ${err}`);
  }
  return resp.json() as Promise<{ id: string; url: string }>;
}

export async function getStripeCheckoutSession(sessionId: string) {
  const resp = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: {
      Authorization: `Bearer ${getStripeSecretKey()}`,
    },
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Stripe session retrieval failed: ${err}`);
  }
  return resp.json() as Promise<{ id: string; payment_status: string; payment_intent: string | null; metadata: Record<string, string> }>;
}
