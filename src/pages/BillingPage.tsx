import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { billingApi, type BillingInvoice } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Wallet, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const PLAN_META = {
  pro: {
    label: 'Pro',
    credits: 36.13,
    tagline: 'Ideal for growing teams with recurring hiring needs.',
  },
  premium: {
    label: 'Premium',
    credits: 96.37,
    tagline: 'For high-volume hiring with the largest wallet coverage.',
  },
} as const;

const formatFeatureLabel = (feature: string) =>
  feature
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

export default function BillingPage() {
  const [topupAmount, setTopupAmount] = useState<number>(25);
  const [busy, setBusy] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const usageQuery = useQuery({
    queryKey: ['billing-usage'],
    queryFn: () => billingApi.usage(),
    refetchInterval: 60_000,
  });


  // Handle Stripe redirect-back (?checkout=success|cancelled&action=subscribe|topup|invoice_payment)
  useEffect(() => {
    const checkout = searchParams.get('checkout');
    const action = searchParams.get('action');
    if (!checkout) return;

    const actionLabel =
      action === 'subscribe' ? 'Plan purchase' :
      action === 'topup' ? 'Top-up' :
      'Payment';

    if (checkout === 'success') {
      toast.success(`${actionLabel} successful! Your account has been updated.`);
      // Refetch billing data so the UI reflects the new balance / plan
      usageQuery.refetch();
    } else if (checkout === 'cancelled') {
      toast.info(`${actionLabel} was cancelled. No charges were made.`);
    }

    // Remove query params from the URL so a page refresh doesn't re-trigger
    navigate('/billing', { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const usage = usageQuery.data;

  const availablePlans = useMemo(() => {
    if (!usage?.plan) return ['pro', 'premium'] as Array<'pro' | 'premium'>;
    if (usage.plan === 'none') return ['pro', 'premium'] as Array<'pro' | 'premium'>;
    if (usage.plan === 'pro') return ['premium'] as Array<'pro' | 'premium'>;
    if (usage.plan === 'premium') return [] as Array<'pro' | 'premium'>;
    return ['pro', 'premium'] as Array<'pro' | 'premium'>;
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
    if (usage.credit_amount <= 0) return 0;
    const consumed = Math.max(0, usage.credit_amount - usage.wallet_balance);
    return Math.min(100, Math.round((consumed / usage.credit_amount) * 100));
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

  const handleTopup = async () => {
    setBusy('topup');
    try {
      const res = await billingApi.topup(topupAmount);
      window.location.href = res.checkout_url;
    } catch (e: any) {
      toast.error(e.message || 'Failed to start top up checkout');
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
          <p className="text-sm text-muted-foreground mt-1">Manage credits and plan.</p>
        </div>

        {usage?.status === 'paused' && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium">Services are paused</p>
                  <p className="text-sm text-muted-foreground">Add credits to resume services.</p>
                </div>
              </div>
              <Button onClick={handleTopup} disabled={busy === 'topup'}>
                {busy === 'topup' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Pay Now
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" /> Credits</CardTitle>
            <CardDescription>
              Plan: <span className="uppercase font-medium">{usage?.plan === 'none' ? 'None' : usage?.plan}</span> | Status: <span className="font-medium">{usage?.status}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl border p-4 sm:p-5 bg-muted/20 space-y-3">
              <div className="flex items-end gap-2">
                <span className="text-3xl sm:text-4xl font-bold leading-none">${Number(usage?.wallet_balance || 0).toFixed(2)}</span>
                <span className="text-2xl text-muted-foreground leading-none"> credits available</span>
              </div>
              {usage?.credit_amount > 0 && (
                <>
                  <Progress value={consumedPercent} className="h-3" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Available balance</span>
                    <span>Consumed {consumedPercent}% of initial credits</span>
                  </div>
                </>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="topup">Top-up Amount ($)</Label>
                <Input id="topup" type="number" min={1} value={topupAmount} onChange={(e) => setTopupAmount(Number(e.target.value) || 0)} />
              </div>
              <div className="flex items-end">
                <Button className="w-full" onClick={handleTopup} disabled={busy === 'topup' || topupAmount <= 0}>
                  {busy === 'topup' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Add Funds
                </Button>
              </div>
            </div>

            {availablePlans.length > 0 && (
              <div className="pt-4 border-t space-y-4">
                <div>
                  <h3 className="font-semibold">Purchase Credits</h3>
                  <p className="text-sm text-muted-foreground">Choose a plan to add credits to your wallet. Services will stop when credits are exhausted.</p>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {availablePlans.map((planId) => {
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
                          <p className="text-2xl font-bold">${meta.credits.toFixed(2)}<span className="text-sm font-normal text-muted-foreground"> one-time</span></p>
                          <p className="text-xs text-muted-foreground">Credits added to wallet</p>
                        </div>

                        <div className="rounded-lg border bg-muted/20">
                          <div className="px-3 py-2 border-b text-xs font-medium">Metered Pricing</div>
                          <div className="px-3 py-2 space-y-2">
                            {featurePricingRows.length > 0 ? (
                              featurePricingRows.map((row) => (
                                <div key={row.feature} className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">{row.label}</span>
                                  <span className="font-medium">${row.unitCost.toFixed(2)} / unit</span>
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
                          Purchase {meta.label}
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
                    <span className="text-muted-foreground">{val.quantity} units | ${Number(val.total_cost || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No metered usage yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
