import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { billingApi, subscriptionApi, type BillingInvoice } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, Wallet, Receipt, AlertTriangle, Check, Globe, Calendar, ShieldCheck, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

// Geolocation-based currency detection
const asianTimezones = ['Asia/Kolkata', 'Asia/Karachi', 'Asia/Dhaka', 'Asia/Colombo', 'Asia/Kathmandu', 'Asia/Kabul'];
const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const isAsiaRegion = asianTimezones.includes(userTimezone) || userTimezone === 'Asia/Kolkata';
const detectedCurrency = isAsiaRegion ? 'INR' : 'USD';

interface PlanDetail {
  id: 'free' | 'starter' | 'growth' | 'enterprise';
  name: string;
  priceUSD: number;
  priceINR: number;
  candidates: number;
  validity: string;
  tagline: string;
  features: string[];
}

const AVAILABLE_PLANS: PlanDetail[] = [
  {
    id: 'free',
    name: 'Free',
    priceUSD: 0,
    priceINR: 0,
    candidates: 5,
    validity: '1 Month',
    tagline: 'Get started and test AI assessments risk-free.',
    features: [
      '5 Candidate Assessments',
      'End-to-End Assessment Workflows',
      'Resume Parsing & AI MCQ Generation',
      'Adaptive AI Interview Sessions',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    priceUSD: 300,
    priceINR: 27000,
    candidates: 100,
    validity: '6 Months',
    tagline: 'Perfect for growing teams with steady recruitment needs.',
    features: [
      '100 Candidate Assessments',
      'Everything in Free Plan',
      'Valid for 6 Full Months',
      'Priority Customer Support',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    priceUSD: 1100,
    priceINR: 99000,
    candidates: 500,
    validity: '1 Year',
    tagline: 'Ideal for rapidly expanding firms with large talent pipelines.',
    features: [
      '500 Candidate Assessments',
      'Everything in Starter Plan',
      'Valid for 1 Full Year',
      'Priority Customer Support',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceUSD: 1800,
    priceINR: 162000,
    candidates: 1000,
    validity: '1 Year',
    tagline: 'Ultimate assessment capacity for scale operations.',
    features: [
      '1,000 Candidate Assessments',
      'Everything in Growth Plan',
      'Valid for 1 Full Year',
      '24/7 Dedicated Support',
    ],
  },
];

const formatCurrency = (amount: number, currency: string) => {
  if (amount === 0) return currency === 'INR' ? '₹0' : '$0';
  return currency === 'INR'
    ? `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
    : `$${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};

export default function BillingPage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const verifyingRef = useRef(false);

  const usageQuery = useQuery({
    queryKey: ['billing-usage'],
    queryFn: () => billingApi.usage(),
    refetchInterval: 15_000, // Refetch every 15s to capture webhook updates quickly
  });

  const invoicesQuery = useQuery({
    queryKey: ['billing-invoices'],
    queryFn: () => billingApi.invoices(),
  });

  const usage = usageQuery.data;
  const invoices = (invoicesQuery.data || []) as BillingInvoice[];

  const activePlanId = usage?.plan || 'free';
  const activeCurrency = usage?.currency || detectedCurrency;

  // Handle Stripe redirect-back
  useEffect(() => {
    const checkout = searchParams.get('checkout');
    const action = searchParams.get('action');
    const sessionId = searchParams.get('session_id');
    const plan = searchParams.get('plan');
    if (!checkout) return;

    // Clean URL immediately
    navigate('/billing', { replace: true });

    if (checkout === 'cancelled') {
      toast.info('Checkout was cancelled. No charges were made.');
      return;
    }

    if (checkout === 'success') {
      if (action === 'subscribe' && sessionId && plan && !verifyingRef.current) {
        verifyingRef.current = true;
        setBusy('verifying');
        billingApi.verifySession(sessionId, plan)
          .then(() => {
            toast.success('Subscription activated! Welcome to your new plan.');
            void triggerRealtimeUpdates();
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
        void triggerRealtimeUpdates();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const triggerRealtimeUpdates = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['billing-usage'] }),
      queryClient.invalidateQueries({ queryKey: ['layout-billing-usage'] }),
      queryClient.invalidateQueries({ queryKey: ['billing-invoices'] }),
      queryClient.invalidateQueries({ queryKey: ['profile'] }),
      usageQuery.refetch(),
      invoicesQuery.refetch(),
    ]);
  };

  const handleSubscribe = async (plan: 'starter' | 'growth' | 'enterprise') => {
    setBusy(`subscribe-${plan}`);
    try {
      const res = await billingApi.subscribe(plan, activeCurrency);
      window.location.href = res.checkout_url;
    } catch (e: any) {
      toast.error(e.message || 'Failed to initialize Stripe checkout');
    } finally {
      setBusy(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will continue to have access to your plan until the end of the current billing cycle.')) {
      return;
    }
    setBusy('cancel');
    try {
      await subscriptionApi.cancel();
      toast.success('Subscription cancelled. Access remains active until the end of your billing cycle.');
      void triggerRealtimeUpdates();
    } catch (e: any) {
      toast.error(e.message || 'Failed to cancel subscription');
    } finally {
      setBusy(null);
    }
  };

  const handleReactivate = async () => {
    setBusy('reactivate');
    try {
      // Re-checkout or upgrade to starter/growth/enterprise reactivates subscription
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
            <h1 className="text-3xl font-extrabold tracking-tight">Billing & Subscriptions</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage active plans, view usage limits, and Stripe payment transactions.</p>
          </div>
          <Button variant="outline" size="sm" onClick={triggerRealtimeUpdates} className="self-start sm:self-auto gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh Status
          </Button>
        </div>

        {/* 1. Prominent Active Plan Display */}
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
                {AVAILABLE_PLANS.find(p => p.id === activePlanId)?.name || 'Free'} Plan
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
                  <span className="font-bold text-sm">{formatCurrency(usage?.price || 0, activeCurrency)}</span>
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
                  <span className="flex items-center gap-2">Onboarded & Assessed Candidates</span>
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
                    <Button variant="destructive" size="sm" onClick={handleCancelSubscription} disabled={busy === 'cancel'}>
                      {busy === 'cancel' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Cancel Subscription
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Billing Status Sidebar Card */}
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
                  <span className="font-bold text-foreground">{usage?.candidates_limit || 5} Candidates</span>
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
            <p className="text-sm text-muted-foreground mt-1">Upgrade or downgrade your plan in real time via secure Stripe Checkout redirection.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {AVAILABLE_PLANS.map((plan) => {
              const isActive = activePlanId === plan.id;
              const isFree = plan.id === 'free';
              const price = activeCurrency === 'INR' ? plan.priceINR : plan.priceUSD;
              
              // Downgrade vs Upgrade label helper
              let ctaLabel = 'Subscribe';
              if (isActive) ctaLabel = 'Active Plan';
              else if (plan.id === 'free') ctaLabel = 'Downgrade to Free';
              else if (activePlanId === 'free') ctaLabel = `Select ${plan.name}`;
              else if (
                (activePlanId === 'starter' && (plan.id === 'growth' || plan.id === 'enterprise')) ||
                (activePlanId === 'growth' && plan.id === 'enterprise')
              ) {
                ctaLabel = 'Upgrade';
              } else {
                ctaLabel = 'Downgrade';
              }

              return (
                <Card 
                  key={plan.id} 
                  className={`flex flex-col transition-all duration-300 relative overflow-hidden ${
                    isActive 
                      ? 'border-primary ring-2 ring-primary/20 bg-gradient-to-b from-primary/5 via-card to-card shadow-lg scale-102' 
                      : 'hover:shadow-md border-border hover:border-border/80'
                  }`}
                >
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xl font-bold tracking-tight">{plan.name}</h3>
                      {isActive && <Badge variant="default" className="text-[10px] tracking-wide uppercase px-2 py-0.5">Current</Badge>}
                    </div>
                    <CardDescription className="text-xs min-h-[32px] mt-1.5">{plan.tagline}</CardDescription>
                  </CardHeader>

                  <CardContent className="flex-grow space-y-6 flex flex-col justify-between">
                    <div>
                      <div className="flex items-baseline gap-1 mb-2">
                        <span className="text-3xl font-black">{formatCurrency(price, activeCurrency)}</span>
                        <span className="text-xs text-muted-foreground font-semibold"> / {plan.validity}</span>
                      </div>
                      <Badge variant="secondary" className="font-semibold text-xs tracking-wider uppercase bg-primary/10 text-primary">
                        {plan.candidates} Candidates
                      </Badge>
                    </div>

                    <div className="space-y-3.5 border-t pt-4">
                      {plan.features.map((feature, i) => (
                        <div key={i} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                          <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-4 mt-auto">
                      {isActive ? (
                        <Button className="w-full font-bold uppercase text-xs tracking-wider" variant="outline" disabled>
                          Current Active Plan
                        </Button>
                      ) : isFree ? (
                        <Button 
                          className="w-full font-bold uppercase text-xs tracking-wider" 
                          variant="outline" 
                          onClick={async () => {
                            if (confirm('Downgrading to Free will restrict candidate assessing once you exceed 5 candidate limits. Continue?')) {
                              setBusy('select-free');
                              try {
                                await subscriptionApi.selectFree();
                                toast.success('Reverted successfully to Free tier.');
                                void triggerRealtimeUpdates();
                              } catch (e: any) {
                                toast.error(e.message || 'Failed to select Free plan');
                              } finally {
                                setBusy(null);
                              }
                            }
                          }}
                          disabled={busy !== null}
                        >
                          {busy === 'select-free' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Downgrade to Free
                        </Button>
                      ) : (
                        <Button 
                          className="w-full font-bold uppercase text-xs tracking-wider" 
                          variant={isActive ? 'outline' : 'default'}
                          onClick={() => handleSubscribe(plan.id as any)}
                          disabled={busy !== null}
                        >
                          {busy === `subscribe-${plan.id}` && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {ctaLabel}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* 3. Invoice History */}
        <Card className="border-border shadow-md">
          <CardHeader className="border-b pb-4">
            <CardTitle className="flex items-center gap-2 text-xl"><Receipt className="h-5 w-5 text-primary" /> Invoice & Subscription History</CardTitle>
            <CardDescription>View and download receipts for complete subscription billing records.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {invoices.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl border-border">
                <Receipt className="h-10 w-10 mx-auto opacity-20 mb-3" />
                <p className="text-sm font-medium">No completed Stripe invoice transactions found.</p>
              </div>
            ) : (
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
                    {invoices.map((invoice) => {
                      const currency = String(invoice.metadata?.currency || activeCurrency).toUpperCase();
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
                            {formatCurrency(Number(invoice.total || 0), currency)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
