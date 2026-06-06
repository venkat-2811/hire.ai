import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { billingApi, subscriptionApi, type BillingInvoice, type BillingPlanId } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Loader2, Wallet, Receipt, AlertTriangle, Check, Globe,
  Calendar, ShieldCheck, RefreshCw, Phone, FlaskConical,
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { useCountryDetection } from '@/hooks/useCountryDetection';
import {
  PRODUCTION_PLANS,
  TEST_PLANS,
  shouldShowTestPlans,
  formatPrice,
  getPlanPrice,
  type PricingPlan,
  type Currency,
} from '@/lib/pricing';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert from our shared PricingPlan format to the BillingPage display shape */
interface PlanDetail {
  id: string;
  name: string;
  priceUSD: number;
  priceINR: number;
  candidates: number | null;
  validity: string;
  tagline: string;
  features: string[];
  isEnterprise?: boolean;
  isTestPlan?: boolean;
}

function toPlanDetail(p: PricingPlan): PlanDetail {
  return {
    id: p.id,
    name: p.name,
    priceUSD: p.priceUSD ?? 0,
    priceINR: p.priceINR ?? 0,
    candidates: p.candidates,
    validity: p.validity,
    tagline: p.tagline,
    features: p.features,
    isEnterprise: p.isEnterprise,
    isTestPlan: p.isTestPlan,
  };
}

// Visible plans for billing page (production + optionally test plans)
function getVisiblePlans(): PlanDetail[] {
  const plans = PRODUCTION_PLANS.map(toPlanDetail);
  if (shouldShowTestPlans()) {
    plans.push(...TEST_PLANS.map(toPlanDetail));
  }
  return plans;
}

const VISIBLE_PLANS = getVisiblePlans();

// ─────────────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const verifyingRef = useRef(false);

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelChecked, setCancelChecked] = useState(false);
  const [cancelConfirmText, setCancelConfirmText] = useState('');

  // Geo-based currency detection (no flicker — reads from cache first)
  const { country, currency, isLoading: geoLoading } = useCountryDetection();

  const usageQuery = useQuery({
    queryKey: ['billing-usage'],
    queryFn: () => billingApi.usage(),
    refetchInterval: 15_000,
  });

  const invoicesQuery = useQuery({
    queryKey: ['billing-invoices'],
    queryFn: () => billingApi.invoices(),
  });

  const usage = usageQuery.data;
  const invoices = (invoicesQuery.data || []) as BillingInvoice[];

  const activePlanId = usage?.plan || 'free';
  // Prefer currency from subscription record; fall back to geo-detected
  const activeCurrency: Currency = (
    usage?.currency === 'INR' ? 'INR'
    : usage?.currency === 'USD' ? 'USD'
    : currency
  );

  // Handle Stripe redirect-back
  useEffect(() => {
    const checkout = searchParams.get('checkout');
    const action = searchParams.get('action');
    const sessionId = searchParams.get('session_id');
    const plan = searchParams.get('plan');
    if (!checkout) return;

    navigate('/billing', { replace: true });

    if (checkout === 'cancelled') {
      toast.info('Checkout was cancelled. No charges were made.');
      return;
    }

    if (checkout === 'success') {
      if (action === 'subscribe' && sessionId && plan && !verifyingRef.current) {
        // Save to localStorage just in case verification is interrupted
        localStorage.setItem('last_checkout_session_id', sessionId);
        localStorage.setItem('last_checkout_plan', plan);

        verifyingRef.current = true;
        setBusy('verifying');
        billingApi.verifySession(sessionId, plan)
          .then(() => {
            toast.success('Subscription activated! Welcome to your new plan.');
            localStorage.removeItem('last_checkout_session_id');
            localStorage.removeItem('last_checkout_plan');
            void triggerRealtimeUpdates(false);
          })
          .catch((err: Error) => {
            toast.error(err.message || 'Subscription activation pending. Updating shortly.');
          })
          .finally(() => {
            verifyingRef.current = false;
            setBusy(null);
          });
      } else {
        toast.success('Payment successful! Your account is updated.');
        void triggerRealtimeUpdates(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const triggerRealtimeUpdates = async (isManual = false) => {
    if (isManual) {
      setBusy('refreshing');
    }
    try {
      if (isManual) {
        const savedSessionId = localStorage.getItem('last_checkout_session_id');
        const savedPlan = localStorage.getItem('last_checkout_plan');

        if (savedSessionId && savedPlan) {
          try {
            await billingApi.verifySession(savedSessionId, savedPlan);
            localStorage.removeItem('last_checkout_session_id');
            localStorage.removeItem('last_checkout_plan');
            toast.success('Subscription status verified and updated!');
          } catch (err: unknown) {
            console.warn('Failed to verify saved checkout session:', err);
          }
        }
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['billing-usage'] }),
        queryClient.invalidateQueries({ queryKey: ['layout-billing-usage'] }),
        queryClient.invalidateQueries({ queryKey: ['billing-invoices'] }),
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
        usageQuery.refetch(),
        invoicesQuery.refetch(),
      ]);

      if (isManual) {
        toast.success('Billing status refreshed.');
      }
    } catch (e: unknown) {
      if (isManual) {
        const err = e as Error;
        toast.error(err.message || 'Failed to refresh billing status');
      }
    } finally {
      if (isManual) {
        setBusy(null);
      }
    }
  };

  const handleSubscribe = async (planId: BillingPlanId) => {
    setBusy(`subscribe-${planId}`);
    try {
      const res = await billingApi.subscribe(planId, activeCurrency, country);
      if (res.session_id) {
        localStorage.setItem('last_checkout_session_id', res.session_id);
        localStorage.setItem('last_checkout_plan', planId);
      }
      window.location.href = res.checkout_url;
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err.message || 'Failed to initialize Stripe checkout');
    } finally {
      setBusy(null);
    }
  };

  const openCancelModal = () => {
    setCancelChecked(false);
    setCancelConfirmText('');
    setCancelModalOpen(true);
  };

  const handleCancelSubscription = async () => {
    setBusy('cancel');
    try {
      await subscriptionApi.cancel();
      toast.success('Your subscription has been cancelled successfully. Your account has been moved to the Free Plan.');
      setCancelModalOpen(false);
      void triggerRealtimeUpdates(false);
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err.message || 'Failed to cancel subscription');
    } finally {
      setBusy(null);
    }
  };

  const handleReactivate = async () => {
    setBusy('reactivate');
    try {
      toast.info('Please select one of our premium plans to subscribe and reactivate.');
    } finally {
      setBusy(null);
    }
  };

  const quotaPercent = useMemo(() => {
    if (!usage) return 0;
    const limit = usage.candidates_limit || 5;
    const count = usage.candidates_count || 0;
    return Math.min(100, Math.round((count / limit) * 100));
  }, [usage]);

  const activePlan = VISIBLE_PLANS.find(p => p.id === activePlanId);

  if (usageQuery.isLoading || busy === 'verifying') {
    return (
      <DashboardLayout>
        <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-medium animate-pulse">Syncing subscription with Stripe...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Billing &amp; Subscriptions</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage active plans, view usage limits, and Stripe payment transactions.
              {geoLoading && (
                <span className="ml-2 text-xs opacity-60">(Detecting your region...)</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-auto">
            {!geoLoading && (
              <Badge variant="outline" className="text-xs font-mono gap-1">
                <Globe className="h-3 w-3" />
                {country} · {activeCurrency}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void triggerRealtimeUpdates(true)}
              disabled={busy !== null}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${busy === 'refreshing' ? 'animate-spin' : ''}`} />
              {busy === 'refreshing' ? 'Refreshing...' : 'Refresh Status'}
            </Button>
          </div>
        </div>

        {/* 1. Active Plan Display */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 overflow-hidden border-2 border-primary/20 shadow-xl bg-gradient-to-br from-primary/5 via-card to-card relative">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <ShieldCheck className="h-32 w-32 text-primary" />
            </div>

            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <Badge className="px-3 py-1 font-bold text-xs uppercase bg-primary text-primary-foreground tracking-wider">
                  Active Plan
                </Badge>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Globe className="h-3.5 w-3.5" />
                  <span>Stripe Test Mode</span>
                </div>
              </div>
              <CardTitle className="text-3xl font-black mt-2 tracking-tight flex items-baseline gap-2">
                {activePlan?.name || 'Free'} Plan
              </CardTitle>
              <CardDescription className="text-sm font-medium mt-1">
                Status: <span className="uppercase text-primary font-bold">{usage?.status || 'Active'}</span>
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground block">Validity</span>
                  <span className="font-bold text-sm">{usage?.validity || '1 Month'}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground block">Renewal Date</span>
                  <span className="font-bold text-sm flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {usage?.billing_cycle_end ? new Date(usage.billing_cycle_end).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground block">Price</span>
                  <span className="font-bold text-sm">
                    {usage?.price !== undefined ? formatPrice(usage.price, activeCurrency) : formatPrice(0, activeCurrency)}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground block">Currency</span>
                  <span className="font-bold text-sm flex items-center gap-1">
                    <Badge variant="outline" className="text-xs font-mono">{activeCurrency}</Badge>
                  </span>
                </div>
              </div>

              {/* Candidate assessments progress */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex justify-between text-sm font-semibold">
                  <span className="flex items-center gap-2">Onboarded &amp; Assessed Candidates</span>
                  <span className="text-primary font-bold">{usage?.candidates_count || 0} / {usage?.candidates_limit || 5}</span>
                </div>
                <Progress value={quotaPercent} className="h-3.5 bg-muted rounded-full overflow-hidden" />
                <p className="text-xs text-muted-foreground">
                  Your candidate assessment limit resets at each subscription billing period.
                  Only new candidate activity initiated after May 29, 2026 contributes to the limit.
                </p>
              </div>

              {/* Action buttons */}
              {activePlanId !== 'free' && (
                <div className="flex gap-4 pt-4">
                  {usage?.status === 'cancel_at_period_end' ? (
                    <Button variant="outline" size="sm" onClick={handleReactivate} disabled={busy === 'reactivate'} className="border-primary/50 text-primary hover:bg-primary/5">
                      {busy === 'reactivate' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Reactivate Subscription
                    </Button>
                  ) : (
                    <Button variant="destructive" size="sm" onClick={openCancelModal} disabled={busy === 'cancel'}>
                      {busy === 'cancel' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Cancel Subscription
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Subscription Limits Sidebar */}
          <Card className="bg-card border-2 border-border shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Wallet className="h-5 w-5 text-primary" /> Subscription Limits</CardTitle>
              <CardDescription>Entitlements associated with the active plan.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Job Postings Limit</span>
                  <span className="font-semibold text-foreground flex items-center gap-1"><Check className="h-4 w-4 text-green-500" /> Unlimited</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Candidate Limits</span>
                  <span className="font-bold text-foreground">
                    {activePlanId === 'enterprise' ? 'Custom' : `${usage?.candidates_limit || 5} Candidates`}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">AI MCQ Generation</span>
                  <span className="font-semibold text-foreground flex items-center gap-1"><Check className="h-4 w-4 text-green-500" /> Fully Included</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">AI Adaptable Interview</span>
                  <span className="font-semibold text-foreground flex items-center gap-1"><Check className="h-4 w-4 text-green-500" /> Fully Included</span>
                </div>
              </div>

              {usage?.status === 'overdue' && (
                <div className="p-3 border border-amber-500/30 rounded-lg bg-amber-500/5 text-amber-600 text-xs flex gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>Payment is past due. Please subscribe to reactivate and avoid service disruption.</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 2. Upgrade / Plan Selection Section */}
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-extrabold tracking-tight">Available Subscription Plans</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Upgrade or downgrade your plan in real time via secure Stripe Checkout.
              {geoLoading
                ? ' Detecting your region...'
                : ` Showing ${activeCurrency === 'INR' ? 'India (INR ₹)' : 'International (USD $)'} pricing for your location.`
              }
            </p>
          </div>

          {geoLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-72 rounded-xl bg-muted/30 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
              {VISIBLE_PLANS.map((plan) => {
                const isActive = activePlanId === plan.id;
                const price = activeCurrency === 'INR' ? plan.priceINR : plan.priceUSD;

                const planIndex = VISIBLE_PLANS.findIndex(p => p.id === plan.id);
                const activePlanIndex = VISIBLE_PLANS.findIndex(p => p.id === activePlanId);
                const isDowngrade = !plan.isTestPlan && planIndex < activePlanIndex && planIndex > 0;

                let ctaLabel = 'Subscribe';
                if (isActive) ctaLabel = 'Active Plan';
                else if (activePlanId === 'free') ctaLabel = `Select ${plan.name}`;
                else ctaLabel = 'Upgrade';

                // Skip temp plans that don't match the current currency
                if (plan.isTestPlan) {
                  if (activeCurrency === 'INR' && plan.priceINR === 0) return null;
                  if (activeCurrency === 'USD' && plan.priceUSD === 0) return null;
                }

                return (
                  <Card
                    key={plan.id}
                    className={`flex flex-col transition-all duration-300 relative overflow-hidden ${
                      plan.isTestPlan
                        ? 'border-2 border-dashed border-yellow-500/40 bg-yellow-500/5 hover:shadow-md'
                        : isActive
                        ? 'border-primary ring-2 ring-primary/20 bg-gradient-to-b from-primary/5 via-card to-card shadow-lg scale-[1.02]'
                        : plan.isEnterprise
                        ? 'border-purple-500/30 bg-gradient-to-b from-purple-500/5 to-card hover:shadow-md'
                        : 'hover:shadow-md border-border hover:border-border/80'
                    }`}
                  >
                    {/* Test plan badge */}
                    {plan.isTestPlan && (
                      <div className="absolute top-0 left-0 right-0 bg-yellow-500/20 border-b border-yellow-500/30 px-3 py-1 flex items-center gap-1.5">
                        <FlaskConical className="h-3.5 w-3.5 text-yellow-600" />
                        <span className="text-xs font-semibold text-yellow-700">DEV / TEST ONLY</span>
                      </div>
                    )}

                    <CardHeader className={`pb-4 ${plan.isTestPlan ? 'pt-8' : ''}`}>
                      <div className="flex justify-between items-center">
                        <h3 className="text-xl font-bold tracking-tight">{plan.name}</h3>
                        {isActive && <Badge variant="default" className="text-[10px] tracking-wide uppercase px-2 py-0.5">Current</Badge>}
                        {plan.isEnterprise && !isActive && (
                          <Badge className="text-[10px] tracking-wide uppercase px-2 py-0.5 bg-purple-500/20 text-purple-600 border-purple-500/30">
                            Custom
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-xs min-h-[32px] mt-1.5">
                        {plan.isTestPlan ? 'Testing only — not visible in production' : plan.tagline}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="flex-grow space-y-6 flex flex-col justify-between">
                      <div>
                        {plan.isEnterprise ? (
                          <div className="mb-2">
                            <span className="text-3xl font-black text-purple-600">Contact Sales</span>
                          </div>
                        ) : (
                          <div className="flex items-baseline gap-1 mb-2">
                            <span className={`text-3xl font-black ${plan.isTestPlan ? 'text-yellow-700' : ''}`}>
                              {formatPrice(price, activeCurrency)}
                            </span>
                            <span className="text-xs text-muted-foreground font-semibold">/ {plan.validity}</span>
                          </div>
                        )}
                        <Badge
                          variant="secondary"
                          className={`font-semibold text-xs tracking-wider uppercase ${
                            plan.isTestPlan
                              ? 'bg-yellow-500/10 text-yellow-700'
                              : plan.isEnterprise
                              ? 'bg-purple-500/10 text-purple-600'
                              : 'bg-primary/10 text-primary'
                          }`}
                        >
                          {plan.candidates !== null ? `${plan.candidates} Candidates` : 'Custom Limit'}
                        </Badge>
                      </div>

                      <div className="space-y-3.5 border-t pt-4">
                        {plan.features.map((feature, i) => (
                          <div key={i} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                            <Check className={`h-4 w-4 flex-shrink-0 mt-0.5 ${
                              plan.isTestPlan ? 'text-yellow-600'
                              : plan.isEnterprise ? 'text-purple-500'
                              : 'text-primary'
                            }`} />
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-4 mt-auto">
                        {isActive ? (
                          <Button className="w-full font-bold uppercase text-xs tracking-wider" variant="outline" disabled>
                            Current Active Plan
                          </Button>
                        ) : plan.isEnterprise ? (
                          <Button
                            className="w-full font-bold uppercase text-xs tracking-wider bg-purple-600 hover:bg-purple-700 text-white border-0"
                            asChild
                          >
                            <Link to="/contact">
                              <Phone className="mr-2 h-3.5 w-3.5" />
                              Contact Sales
                            </Link>
                          </Button>
                        ) : isDowngrade ? null : (
                          <Button
                            className={`w-full font-bold uppercase text-xs tracking-wider ${
                              plan.isTestPlan
                                ? 'bg-yellow-500 hover:bg-yellow-600 text-white border-0'
                                : ''
                            }`}
                            variant={plan.isTestPlan ? 'default' : 'default'}
                            onClick={() => handleSubscribe(plan.id as BillingPlanId)}
                            disabled={busy !== null}
                          >
                            {busy === `subscribe-${plan.id}` && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {plan.isTestPlan ? '⚗ Test Checkout' : ctaLabel}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Invoice History */}
        <Card className="border-border shadow-md">
          <CardHeader className="border-b pb-4">
            <CardTitle className="flex items-center gap-2 text-xl"><Receipt className="h-5 w-5 text-primary" /> Invoice &amp; Subscription History</CardTitle>
            <CardDescription>View and download receipts for complete subscription billing records.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {invoices.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl border-border">
                <Receipt className="h-10 w-10 mx-auto opacity-20 mb-3" />
                <p className="text-sm font-medium">No completed Stripe invoice transactions found.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground font-semibold">
                        <th className="pb-3 text-left">Invoice ID</th>
                        <th className="pb-3 text-left">Period</th>
                        <th className="pb-3 text-left">Reference ID</th>
                        <th className="pb-3 text-left">Status</th>
                        <th className="pb-3 text-right">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.slice(0, 5).map((invoice) => {
                        const invCurrency = String(invoice.metadata?.currency || activeCurrency).toUpperCase() as Currency;
                        return (
                          <tr key={invoice.id} className="border-b hover:bg-muted/10 transition-colors">
                            <td className="py-4 font-semibold text-foreground">#{invoice.id.slice(0, 8).toUpperCase()}</td>
                            <td className="py-4 text-muted-foreground">
                              {new Date(invoice.period_start).toLocaleDateString()} - {new Date(invoice.period_end).toLocaleDateString()}
                            </td>
                            <td className="py-4 text-xs font-mono text-muted-foreground">{invoice.payment_reference || 'Stripe Sync'}</td>
                            <td className="py-4">
                              <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'} className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5">
                                {invoice.status}
                              </Badge>
                            </td>
                            <td className="py-4 text-right font-bold text-foreground">
                              {formatPrice(Number(invoice.total || 0), invCurrency)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {invoices.length > 5 && (
                  <div className="flex justify-center pt-2">
                    <Button variant="outline" asChild>
                      <Link to="/billing/history">View Full records</Link>
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cancellation Modal */}
      <Dialog open={cancelModalOpen} onOpenChange={(open) => !open && setCancelModalOpen(false)}>
        <DialogContent className="sm:max-w-[500px]" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl text-destructive">
              <AlertTriangle className="h-6 w-6" />
              Cancel Subscription
            </DialogTitle>
            <DialogDescription>
              Current Active Plan: <span className="font-bold text-foreground">{activePlan?.name || 'Starter'}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 text-sm">
            <p className="font-semibold text-foreground">By cancelling your subscription, you acknowledge and agree to the following:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
              <li>Your current subscription will be terminated immediately upon confirmation.</li>
              <li>Your account will be reverted to the Free Plan.</li>
              <li>Any unused portion of your subscription is non-refundable.</li>
              <li>Access to premium features associated with your current plan will be removed immediately after cancellation.</li>
              <li>Assessment limits, candidate limits, and premium functionality will be reset according to the Free Plan.</li>
              <li>Historical data, reports, and completed assessments will remain available unless otherwise restricted by the Free Plan.</li>
              <li>You may purchase a new subscription plan at any time in the future.</li>
            </ul>
            <p className="font-medium text-foreground">By proceeding, you confirm that you understand and accept these terms.</p>

            <div className="flex items-start space-x-2 pt-2 border-t mt-4">
              <Checkbox id="cancel-terms" checked={cancelChecked} onCheckedChange={(checked) => setCancelChecked(!!checked)} />
              <label htmlFor="cancel-terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mt-0.5 cursor-pointer">
                I have read and agree to the cancellation terms and conditions
              </label>
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-sm font-medium">
                To confirm, type <span className="font-bold font-mono bg-muted px-1 py-0.5 rounded text-destructive">{`Cancel ${activePlan?.name || 'Starter'} Plan`}</span> below:
              </label>
              <Input
                placeholder={`Cancel ${activePlan?.name || 'Starter'} Plan`}
                value={cancelConfirmText}
                onChange={(e) => setCancelConfirmText(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCancelModalOpen(false)} disabled={busy === 'cancel'}>
              Keep Subscription
            </Button>
            <Button
              variant="destructive"
              disabled={
                !cancelChecked ||
                cancelConfirmText.trim().toLowerCase() !== `cancel ${activePlan?.name?.toLowerCase() || 'starter'} plan` ||
                busy === 'cancel'
              }
              onClick={handleCancelSubscription}
            >
              {busy === 'cancel' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
