import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { billingApi, type BillingInvoice } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, Wallet, Receipt, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

// ── Currency helpers ──────────────────────────────────────────────────────────
const USD_TO_INR = 83;
const isIndia = Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Kolkata';
const currencySymbol = isIndia ? '₹' : '$';
const fmtAmount = (usd: number) =>
  isIndia
    ? `₹${(usd * USD_TO_INR).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
    : `$${usd.toFixed(2)}`;

const PLAN_META = {
  pro: {
    label: 'Pro',
    monthly: 36.13,
    deposit: 36.13,
    tagline: 'Ideal for growing teams with recurring hiring needs.',
  },
  premium: {
    label: 'Premium',
    monthly: 96.37,
    deposit: 96.37,
    tagline: 'For high-volume hiring with the largest wallet coverage.',
  },
} as const;

const formatFeatureLabel = (feature: string) =>
  feature
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

export default function BillingPage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const verifyingRef = useRef(false);

  const usageQuery = useQuery({
    queryKey: ['billing-usage'],
    queryFn: () => billingApi.usage(),
    refetchInterval: 60_000,
  });

  const invoicesQuery = useQuery({
    queryKey: ['billing-invoices'],
    queryFn: () => billingApi.invoices(),
  });

  // Handle Stripe redirect-back (?checkout=success|cancelled&action=subscribe|topup|invoice_payment)
  useEffect(() => {
    const checkout = searchParams.get('checkout');
    const action = searchParams.get('action');
    const sessionId = searchParams.get('session_id');
    const plan = searchParams.get('plan');
    if (!checkout) return;

    const actionLabel =
      action === 'subscribe' ? 'Subscription' :
      action === 'topup' ? 'Top-up' :
      action === 'invoice_payment' ? 'Invoice payment' :
      'Payment';

    // Clean URL immediately to prevent re-triggering on refresh
    navigate('/billing', { replace: true });

    if (checkout === 'cancelled') {
      toast.info(`${actionLabel} was cancelled. No charges were made.`);
      return;
    }

    if (checkout === 'success') {
      // For subscribe actions with a session_id, verify directly with Stripe
      // to activate the plan without relying on webhooks
      if (action === 'subscribe' && sessionId && plan && !verifyingRef.current) {
        verifyingRef.current = true;
        billingApi.verifySession(sessionId, plan)
          .then(() => {
            toast.success('Subscription activated! Your plan has been upgraded.');
            // Invalidate all relevant queries so the new plan shows everywhere
            void queryClient.invalidateQueries({ queryKey: ['billing-usage'] });
            void queryClient.invalidateQueries({ queryKey: ['layout-billing-usage'] });
            void queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
            void queryClient.invalidateQueries({ queryKey: ['profile'] });
          })
          .catch((err: Error) => {
            toast.error(err.message || 'Plan activation failed. Contact support if charged.');
          })
          .finally(() => { verifyingRef.current = false; });
      } else {
        toast.success(`${actionLabel} successful! Your account has been updated.`);
        void usageQuery.refetch();
        void invoicesQuery.refetch();
        void queryClient.invalidateQueries({ queryKey: ['profile'] });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const usage = usageQuery.data;
  const invoices = (invoicesQuery.data || []) as BillingInvoice[];

  const upgradePlans = useMemo(() => {
    if (!usage?.plan) return [] as Array<'pro' | 'premium'>;
    if (usage.plan === 'free') return ['pro', 'premium'] as Array<'pro' | 'premium'>;
    if (usage.plan === 'pro') return ['premium'] as Array<'pro' | 'premium'>;
    return [] as Array<'pro' | 'premium'>;
  }, [usage?.plan]);

  const featurePricingRows = useMemo(() => {
    const costs = usage?.limits?.feature_costs || {};
    return Object.entries(costs)
      .map(([feature, unitCost]) => ({
        feature,
        label: formatFeatureLabel(feature),
        unitCost: Number(unitCost || 0),
      }))
      .sort((a, b) => b.unitCost - a.unitCost);
  }, [usage?.limits?.feature_costs]);

  const consumedPercent = useMemo(() => {
    if (!usage) return 0;
    if (usage.deposit_amount <= 0) return 0;
    const consumed = Math.max(0, usage.deposit_amount - usage.wallet_balance);
    return Math.min(100, Math.round((consumed / usage.deposit_amount) * 100));
  }, [usage]);

  const handleSubscribe = async (plan: 'pro' | 'premium') => {
    setBusy(`subscribe-${plan}`);
    try {
      const res = await billingApi.subscribe(plan);
      window.location.href = res.checkout_url;
    } catch (e: any) {
      toast.error(e.message || 'Failed to start checkout');
    } finally {
      setBusy(null);
    }
  };

  const handlePayInvoice = async (invoiceId: string) => {
    setBusy(`invoice-${invoiceId}`);
    try {
      const res = await billingApi.payInvoice(invoiceId);
      if (res.already_paid) {
        toast.success('Invoice is already paid');
        return;
      }
      if (res.checkout_url) {
        window.location.href = res.checkout_url;
        return;
      }
      toast.success('Invoice paid successfully');
      await Promise.all([usageQuery.refetch(), invoicesQuery.refetch()]);
    } catch (e: any) {
      toast.error(e.message || 'Failed to pay invoice');
    } finally {
      setBusy(null);
    }
  };

  if (usageQuery.isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Billing</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage wallet, plan and invoices.</p>
        </div>

        {usage?.status === 'paused' && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-medium">Services are paused</p>
                <p className="text-sm text-muted-foreground">Your wallet balance is exhausted. Upgrade your plan to resume AI features, or contact support.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" /> Wallet</CardTitle>
            <CardDescription>
              Plan: <span className="uppercase font-medium">{usage?.plan}</span> | Status: <span className="font-medium">{usage?.status}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl border p-4 sm:p-5 bg-muted/20 space-y-3">
              <div className="flex items-end gap-2">
                <span className="text-3xl sm:text-4xl font-bold leading-none">{fmtAmount(Number(usage?.wallet_balance || 0))}</span>
                <span className="text-2xl text-muted-foreground leading-none">/ {fmtAmount(Number(usage?.deposit_amount || 0))}</span>
              </div>
              <Progress value={consumedPercent} className="h-3" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Available balance</span>
                <span>Consumed {consumedPercent}% this cycle</span>
              </div>
            </div>

            {upgradePlans.length > 0 && (
              <div className="pt-4 border-t space-y-4">
                <div>
                  <h3 className="font-semibold">Upgrade</h3>
                  <p className="text-sm text-muted-foreground">Move to a higher plan for stronger wallet coverage and uninterrupted usage.</p>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {upgradePlans.map((planId) => {
                    const meta = PLAN_META[planId];
                    const isPremium = planId === 'premium';

                    return (
                      <div
                        key={planId}
                        className={`rounded-xl border p-4 space-y-4 ${isPremium ? 'border-primary/50 bg-primary/5' : 'bg-background'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold">{meta.label}</p>
                            <p className="text-sm text-muted-foreground">{meta.tagline}</p>
                          </div>
                          {isPremium && <Badge>Recommended</Badge>}
                        </div>

                        <div className="space-y-1">
                          <p className="text-2xl font-bold">{fmtAmount(meta.monthly)}<span className="text-sm font-normal text-muted-foreground"> / month</span></p>
                          <p className="text-xs text-muted-foreground">Monthly wallet deposit: {fmtAmount(meta.deposit)}</p>
                        </div>

                        <div className="rounded-lg border bg-muted/20">
                          <div className="px-3 py-2 border-b text-xs font-medium">Metered Pricing (from Usage Breakdown)</div>
                          <div className="px-3 py-2 space-y-2">
                            {featurePricingRows.length > 0 ? (
                              featurePricingRows.map((row) => (
                                <div key={row.feature} className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">{row.label}</span>
                                  <span className="font-medium">{fmtAmount(row.unitCost)} / unit</span>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-muted-foreground">Pricing details will appear once usage data is loaded.</p>
                            )}
                          </div>
                        </div>

                        <Button
                          className="w-full"
                          variant={isPremium ? 'default' : 'outline'}
                          onClick={() => handleSubscribe(planId)}
                          disabled={busy === `subscribe-${planId}`}
                        >
                          {busy === `subscribe-${planId}` ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Upgrade to {meta.label}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {usage && Object.keys(usage.usage_breakdown || {}).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(usage.usage_breakdown).map(([feature, val]) => (
                  <div key={feature} className="flex items-center justify-between text-sm border-b py-2">
                    <span>{feature}</span>
                    <span className="text-muted-foreground">{val.quantity} units | {fmtAmount(Number(val.total_cost || 0))}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No metered usage yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> Invoice History</CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices found.</p>
            ) : (
              <div className="space-y-2">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between border rounded-md px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">Invoice #{invoice.id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">Due {new Date(invoice.due_date).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>{invoice.status}</Badge>
                      <span className="text-sm font-medium">{fmtAmount(Number(invoice.total || 0))}</span>
                      {invoice.status !== 'paid' && (
                        <Button size="sm" onClick={() => handlePayInvoice(invoice.id)} disabled={busy === `invoice-${invoice.id}`}>
                          {busy === `invoice-${invoice.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Pay'}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
