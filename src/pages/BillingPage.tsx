import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { billingApi, subscriptionApi, companyApi, type BillingInvoice, type BillingPlanId, type CompanyPlan } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Loader2, Wallet, Receipt, AlertTriangle, Check,
  ShieldCheck, RefreshCw, Phone, Users, Zap, Activity, Building2, Crown, Mail, CreditCard, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { useCountryDetection } from '@/hooks/useCountryDetection';
import { useProfile } from '@/hooks/useProfile';
import { useCompany } from '@/hooks/useCompany';
import {
  PRODUCTION_PLANS,
  formatPrice,
  normalizePlanId,
  type PricingPlan,
  type Currency,
} from '@/lib/pricing';
import SpotlightCard from '@/components/ui/spotlight-card';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert from our shared PricingPlan format to the BillingPage display shape */
interface PlanDetail {
  id: string;
  name: string;
  priceUSD: number | null;
  priceINR: number | null;
  candidates: number | null;
  validity: string;
  tagline: string;
  features: string[];
}

function toPlanDetail(p: PricingPlan): PlanDetail {
  return {
    id: p.id,
    name: p.name,
    priceUSD: p.priceUSD,
    priceINR: p.priceINR,
    candidates: p.candidates,
    validity: p.validity,
    tagline: p.tagline,
    features: p.features,
  };
}

// Visible plans for billing page (production plans only)
function getVisiblePlans(): PlanDetail[] {
  return PRODUCTION_PLANS.map(toPlanDetail);
}

const VISIBLE_PLANS = getVisiblePlans();

// ── Company Plans Sub-Section ─────────────────────────────────────────────────
const COMPANY_PLAN_COLORS = [
  { border: 'border-indigo-500/30', bg: 'bg-indigo-500/5', accent: 'text-indigo-400', btn: 'bg-indigo-600 hover:bg-indigo-500' },
  { border: 'border-violet-500/30', bg: 'bg-violet-500/5', accent: 'text-violet-400', btn: 'bg-violet-600 hover:bg-violet-500', popular: true },
  { border: 'border-purple-500/30', bg: 'bg-purple-500/5', accent: 'text-purple-400', btn: 'bg-purple-700 hover:bg-purple-600' },
  { border: 'border-pink-500/30', bg: 'bg-pink-500/5', accent: 'text-pink-400', btn: 'bg-pink-700 hover:bg-pink-600' },
];

function CompanyPlansSection({
  isCompanyMember,
  companyName,
  navigate,
}: {
  isCompanyMember: boolean;
  companyName?: string;
  navigate: (path: string) => void;
}) {
  const { currency, isIndia } = useCountryDetection({ profileCountry: null, explicitCountry: null });

  const plansQuery = useQuery({
    queryKey: ['company-plans'],
    queryFn: () => companyApi.plans(),
    staleTime: 300_000,
  });

  const plans = (plansQuery.data?.plans ?? []) as CompanyPlan[];

  return (
    <div className="pt-6">
      <div className="mb-6 border-b border-border/50 pb-5">
        <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Building2 className="h-5 w-5 text-indigo-400" /> Team &amp; Company Plans
        </h2>
        <p className="text-sm text-muted-foreground mt-2 font-medium">
          {isCompanyMember
            ? `Your account is part of <strong>${companyName}</strong>. Below are the available company-tier plans.`
            : 'Recruiting with a team? Company plans include multiple recruiter seats with pooled credits, email-based seat approvals, and a shared analytics dashboard.'}
        </p>
      </div>

      {isCompanyMember && (
        <Card className="border-indigo-500/30 bg-indigo-500/5 mb-6">
          <CardContent className="flex items-center justify-between gap-4 pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-indigo-500/15 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-indigo-500">Company Billing Active</p>
                <p className="text-xs text-muted-foreground">Your credits and billing are managed by <strong>{companyName}</strong>.</p>
              </div>
            </div>
            <Button size="sm" onClick={() => navigate('/company/dashboard')} className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2">
              Company Dashboard <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Feature highlights */}
      <div className="grid grid-cols-3 gap-4 text-center mb-6">
        {[
          { icon: <Users className="h-5 w-5" />, label: 'Recruiter Seats', desc: 'Each recruiter gets their own login and credit pool' },
          { icon: <CreditCard className="h-5 w-5" />, label: 'Credit Allocation', desc: '100 credits per seat, allocated on join approval' },
          { icon: <Mail className="h-5 w-5" />, label: 'Email Approvals', desc: 'One-click approve/reject directly from email inbox' },
        ].map(f => (
          <div key={f.label} className="space-y-2">
            <div className="h-10 w-10 rounded-xl bg-muted/40 flex items-center justify-center mx-auto text-indigo-400">{f.icon}</div>
            <div className="text-sm font-semibold">{f.label}</div>
            <div className="text-xs text-muted-foreground">{f.desc}</div>
          </div>
        ))}
      </div>

      {plansQuery.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-64 rounded-2xl bg-muted/40 animate-pulse border border-border/30" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan, idx) => {
            const style = COMPANY_PLAN_COLORS[idx % COMPANY_PLAN_COLORS.length];
            const price = isIndia ? plan.price_inr : plan.price_usd;
            const features = Array.isArray(plan.features) ? plan.features : [];
            return (
              <Card key={plan.id} className={`relative overflow-hidden border ${style.border} ${style.bg} transition-all hover:scale-[1.01] hover:shadow-lg flex flex-col`}>
                {style.popular && (
                  <div className="absolute top-3 right-3">
                    <Badge className="bg-violet-600 text-white text-xs"><Crown className="h-2.5 w-2.5 mr-1" />Popular</Badge>
                  </div>
                )}
                <CardHeader className="pb-3">
                  <CardTitle className={`text-base font-extrabold ${style.accent}`}>{plan.name}</CardTitle>
                  <div className="flex items-end gap-2 mt-1">
                    <span className="text-2xl font-black">
                      {price > 0 ? formatPrice(price, currency) : 'Custom'}
                    </span>
                    {price > 0 && <span className="text-muted-foreground text-sm mb-1">/ {plan.validity}</span>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-background/40 rounded-lg p-2 text-center">
                        <div className={`text-lg font-extrabold ${style.accent}`}>{plan.recruiter_seats}</div>
                        <div className="text-xs text-muted-foreground">Seats</div>
                      </div>
                      <div className="bg-background/40 rounded-lg p-2 text-center">
                        <div className={`text-lg font-extrabold ${style.accent}`}>{plan.total_credits}</div>
                        <div className="text-xs text-muted-foreground">Credits</div>
                      </div>
                    </div>
                    <ul className="space-y-1.5">
                      {features.map((f, fi) => (
                        <li key={fi} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Check className={`h-3.5 w-3.5 flex-shrink-0 ${style.accent}`} />{f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Button
                    className={`w-full text-white font-bold mt-3 ${style.btn}`}
                    onClick={() => {
                      const subject = encodeURIComponent(`[Rekshift] Company Plan Enquiry — ${plan.name}`);
                      const body = encodeURIComponent(`Hi Rekshift Team,\n\nI'm interested in the ${plan.name} (${plan.recruiter_seats} seats, ${plan.total_credits} credits).\n\nPlease get in touch.\n\nThanks`);
                      window.open(`mailto:admin@rekshift.com?subject=${subject}&body=${body}`, '_blank');
                    }}
                  >
                    Contact Sales
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground mt-4">
        All company plans are provisioned by our team within 24 hours. <Link to="/contact" className="text-primary underline underline-offset-2">Contact us</Link> to get started.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [planTab, setPlanTab] = useState<'individual' | 'company'>('individual');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const verifyingRef = useRef(false);

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelChecked, setCancelChecked] = useState(false);
  const [cancelConfirmText, setCancelConfirmText] = useState('');

  const profileQuery = useProfile();
  const companyContext = useCompany();

  const usageQuery = useQuery({
    queryKey: ['billing-usage'],
    queryFn: () => billingApi.usage(),
    refetchInterval: 15_000,
  });

  const invoicesQuery = useQuery({
    queryKey: ['billing-invoices'],
    queryFn: () => billingApi.invoices(),
  });

  const usageHistoryQuery = useQuery({
    queryKey: ['billing-usage-history'],
    queryFn: () => billingApi.getUsageHistory(),
  });

  const usage = usageQuery.data;
  const profile = profileQuery.data;

  // Geo-based currency detection with priority:
  // billing country > stored profile country > geolocation fallback.
  const { country, currency, isLoading: geoLoading } = useCountryDetection({
    billingCountry: usage?.country ?? null,
    profileCountry: profile?.country ?? null,
  });
  const invoices = (invoicesQuery.data || []) as BillingInvoice[];
  const usageHistory = usageHistoryQuery.data || [];

  const activePlanId = normalizePlanId(usage?.plan);
  // STRICT REQUIREMENT: Geo-detected currency is the single source of truth.
  // Never default to the auto-bootstrapped backend currency (which defaults to USD).
  const activeCurrency: Currency = currency;

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
        queryClient.invalidateQueries({ queryKey: ['billing-usage-history'] }),
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
        usageQuery.refetch(),
        invoicesQuery.refetch(),
        usageHistoryQuery.refetch(),
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
      toast.success('Subscription scheduled for cancellation. You will retain full access until the end of your current billing period.');
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
      const res = await subscriptionApi.reactivate();
      toast.success(res.message || 'Subscription reactivated successfully!');
      void triggerRealtimeUpdates(false);
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err.message || 'Failed to reactivate subscription. Please subscribe to a new plan.');
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

  const getTierColors = (planId: string) => {
    switch (planId) {
      case 'free': return 'border-slate-200/80 bg-gradient-to-b from-slate-100/60 to-transparent hover:shadow-lg hover:border-slate-300 dark:border-slate-700/60 dark:from-slate-800/40';
      case 'starter': return 'border-blue-300/80 bg-gradient-to-b from-blue-100/60 to-transparent hover:shadow-lg hover:border-blue-400 dark:border-blue-800/60 dark:from-blue-900/30';
      case 'growth': return 'border-purple-300/80 bg-gradient-to-b from-purple-100/60 to-transparent hover:shadow-lg hover:border-purple-400 dark:border-purple-800/60 dark:from-purple-900/30';
      case 'scale': return 'border-emerald-300/80 bg-gradient-to-b from-emerald-100/60 to-transparent hover:shadow-lg hover:border-emerald-400 dark:border-emerald-800/60 dark:from-emerald-900/30';
      case 'enterprise': return 'border-indigo-500/20 bg-gradient-to-b from-indigo-500/5 to-transparent hover:shadow-lg hover:border-indigo-500/40';
      default: return 'border-border/60 bg-gradient-to-b from-muted/20 to-transparent hover:shadow-lg hover:border-border/80';
    }
  };

  if (usageQuery.isLoading || busy === 'verifying' || geoLoading || companyContext.isLoading) {
    return (
      <DashboardLayout>
        <div className="min-h-[80vh] flex flex-col items-center justify-center gap-5">
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
            <Loader2 className="h-10 w-10 animate-spin text-primary relative z-10" />
          </div>
          <p className="text-sm text-muted-foreground font-medium animate-pulse tracking-wide">
            {geoLoading ? 'Detecting your region for secure pricing...' : 'Syncing subscription securely...'}
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto pb-24">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border/50 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Billing &amp; Subscriptions</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-xl leading-relaxed">
              Manage your active plans, monitor usage limits, and view secure payment transactions.
              {geoLoading && (
                <span className="ml-2 text-xs font-medium text-primary/70 animate-pulse">(Detecting your region...)</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void triggerRealtimeUpdates(true)}
              disabled={busy !== null}
              className="gap-2 border-border/60 shadow-sm hover:bg-muted hover:text-foreground transition-all font-medium"
            >
              <RefreshCw className={`h-4 w-4 text-muted-foreground ${busy === 'refreshing' ? 'animate-spin text-primary' : ''}`} />
              {busy === 'refreshing' ? 'Refreshing...' : 'Refresh Status'}
            </Button>
          </div>
        </div>

        {/* Company Member Credits Card — shown when user is an active company member */}
        {companyContext.isMember && companyContext.company && (() => {
          const displayAllocated = companyContext.credits.allocated;
          const displayConsumed = companyContext.credits.consumed;
          const displayRemaining = Math.max(0, displayAllocated - displayConsumed);
          const pct = displayAllocated > 0 ? Math.min(100, (displayConsumed / displayAllocated) * 100) : 0;
          const label = 'My Seat Credits';
          const sublabel = 'Your personal allocation from the company pool';

          return (
            <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-6 w-6 text-indigo-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-extrabold text-foreground">{companyContext.company.name}</h2>
                    <Badge className="bg-indigo-500/15 text-indigo-400 border-indigo-500/30 text-xs capitalize">
                      {companyContext.role}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1 font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground mb-3">{sublabel}</p>
                  <div className="flex flex-wrap gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-black text-indigo-400">{displayAllocated}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Allocated</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-black text-rose-400">{displayConsumed.toFixed(1)}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Consumed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-black text-emerald-400">{displayRemaining.toFixed(1)}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Remaining</div>
                    </div>
                  </div>
                  {/* Credits progress bar */}
                  <div className="mt-3 w-48">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              {companyContext.isOwner && (
                <Button
                  className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2 flex-shrink-0"
                  onClick={() => navigate('/company/dashboard')}
                >
                  <Building2 className="h-4 w-4" />
                  Company Dashboard
                </Button>
              )}
            </div>
          );
        })()}


        {/* 1–3: Individual billing sections — hidden for company members */}
        {!companyContext.isMember && (<>

        {/* 1. Active Plan & Limits Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">

          {/* Active Plan Premium Card */}
          <SpotlightCard className="lg:col-span-2 overflow-hidden p-0 border-border/60 shadow-md relative bg-card transition-all group" spotlightColor="rgba(237, 154, 0, 0.15)">
            <CardHeader className="pb-2 relative z-10 pt-4 px-6">
              <div className="flex items-center justify-between gap-3 mb-1">
                <CardTitle className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
                  {activePlan?.name || 'Free'} Plan
                </CardTitle>

                {/* Status indicator */}
                <div className={`px-3 py-1.5 text-xs font-bold tracking-wide uppercase rounded-full border shadow-sm ${usage?.status === 'cancel_at_period_end' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'} flex items-center gap-2`}>
                  <div className={`h-2 w-2 rounded-full shadow-inner ${usage?.status === 'cancel_at_period_end' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  {usage?.status === 'cancel_at_period_end' ? 'Cancellation Scheduled' : (usage?.status || 'Active')}
                </div>
              </div>

              {usage?.status === 'cancel_at_period_end' && usage?.billing_cycle_end && (
                <div className="mt-2 flex items-start gap-2 text-sm bg-amber-500/5 border border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-xl px-3 py-2.5 shadow-sm">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-500" />
                  <span className="leading-relaxed font-medium text-sm">
                    Your subscription is scheduled to cancel. You retain full access until <strong className="font-bold underline decoration-amber-500/30 underline-offset-2">{new Date(usage.billing_cycle_end).toLocaleDateString()}</strong>. You will not be charged again.
                  </span>
                </div>
              )}
            </CardHeader>

            <CardContent className="space-y-4 px-6 pb-5 relative z-10">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1">
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Billing Cycle</span>
                  <span className="font-bold text-sm text-foreground">{usage?.validity || '1 Month'}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    {usage?.status === 'cancel_at_period_end' ? 'Expires On' : 'Renews On'}
                  </span>
                  <span className="font-bold text-sm text-foreground flex items-center gap-2">
                    {usage?.billing_cycle_end ? new Date(usage.billing_cycle_end).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Current Rate</span>
                  <span className="font-bold text-sm text-foreground">
                    {activePlan && activePlanId !== 'free'
                      ? formatPrice(activeCurrency === 'INR' ? (activePlan.priceINR ?? 0) : (activePlan.priceUSD ?? 0), activeCurrency)
                      : formatPrice(0, activeCurrency)}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Currency</span>
                  <span className="font-bold text-sm text-foreground flex items-center gap-1">
                    <Badge variant="outline" className="text-[10px] font-mono border-border/80 bg-background/50 shadow-sm py-0">{activeCurrency}</Badge>
                  </span>
                </div>
              </div>

              {/* Animated usage progress */}
              <div className="space-y-2.5 pt-4 border-t border-border/60">
                <div className="flex justify-between items-end">
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm text-foreground font-bold flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-primary" /> Candidate Usage Limit</span>
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Current Billing Period</span>
                  </span>
                  <div className="text-right">
                    <span className="text-xl font-black text-primary">
                      {(() => {
                        const count = usage?.candidates_count || 0;
                        return Number.isInteger(count) ? count : count.toFixed(2);
                      })()}
                    </span>
                    <span className="text-sm text-muted-foreground font-medium mx-1">/</span>
                    <span className="text-sm font-bold text-foreground">{usage?.candidates_limit || 5}</span>
                  </div>
                </div>
                <div className="relative h-2.5 bg-muted rounded-full overflow-hidden shadow-inner border border-border/40">
                  <div
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${quotaPercent}%` }}
                  />
                  {/* Subtle shine overlay */}
                  <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                </div>

                {/* Billing stage legend */}
                <div className="pt-2 pb-0.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Billing per candidate</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                      <span className="inline-flex items-center justify-center h-4 w-9 rounded-sm bg-primary/10 text-primary font-bold text-[10px] border border-primary/20">+0.50</span>
                      Added
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                      <span className="inline-flex items-center justify-center h-4 w-9 rounded-sm bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-[10px] border border-blue-500/20">+0.50</span>
                      Assessment / Interview sent
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                      <span className="inline-flex items-center justify-center h-4 w-9 rounded-sm bg-foreground/10 text-foreground font-bold text-[10px] border border-foreground/20">= 1.00</span>
                      Full slot
                    </span>
                  </div>

                </div>

                <p className="text-[11px] font-medium text-muted-foreground pt-0.5 flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/40 block" />
                  Assessment limits reset automatically at the start of your next billing cycle.
                </p>
              </div>

              {/* Action buttons */}
              {activePlanId !== 'free' && (
                <div className="flex gap-4 pt-4 border-t border-border/60">
                  {usage?.status === 'cancel_at_period_end' ? (
                    <Button variant="outline" size="sm" onClick={handleReactivate} disabled={busy === 'reactivate'} className="border-primary/30 text-primary hover:bg-primary/5 hover:text-primary font-bold tracking-wide transition-all shadow-sm">
                      {busy === 'reactivate' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Reactivate Subscription
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={openCancelModal} disabled={busy === 'cancel'} className="text-muted-foreground hover:text-destructive hover:border-destructive/30 hover:bg-destructive/5 font-medium transition-all">
                      {busy === 'cancel' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Cancel Subscription
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </SpotlightCard>

          {/* Subscription Limits Sidebar */}
          <SpotlightCard className="p-0 border-border/60 shadow-md flex flex-col h-full bg-card" spotlightColor="rgba(139, 92, 246, 0.15)">
            {/* Top accent line */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-400 via-slate-500 to-slate-400 opacity-30 dark:opacity-20" />
            <div className="pb-4 pt-6 px-6">
              <h3 className="flex items-center gap-3 text-lg font-bold text-foreground">
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <ShieldCheck className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                </div>
                Plan Entitlements
              </h3>
              <p className="text-xs font-medium text-muted-foreground mt-1.5">Included features for your active tier.</p>
            </div>
            <div className="flex-1 space-y-4 px-6 pb-6 relative z-10">
              <div className="flex items-center justify-between text-sm py-1 border-b border-border/40 pb-3">
                <span className="text-muted-foreground font-medium">Job Postings</span>
                <span className="font-bold text-foreground flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" /> Unlimited</span>
              </div>
              <div className="flex items-center justify-between text-sm py-1 border-b border-border/40 pb-3">
                <span className="text-muted-foreground font-medium">Candidate Invites</span>
                <span className="font-bold text-foreground">
                  {activePlanId === 'scale' || activePlanId === 'enterprise' ? (
                    activePlanId === 'enterprise' ? 'Custom Volume' : `${usage?.candidates_limit || 500} Credits Included`
                  ) : (
                    `${usage?.candidates_limit || 5} Credits Included`
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm py-1 border-b border-border/40 pb-3">
                <span className="text-muted-foreground font-medium">AI MCQ Engine</span>
                <span className="font-bold text-foreground flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" /> Full Access</span>
              </div>
              <div className="flex items-center justify-between text-sm py-1">
                <span className="text-muted-foreground font-medium">AI Interviews</span>
                <span className="font-bold text-foreground flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" /> Full Access</span>
              </div>

              {usage?.status === 'overdue' && (
                <div className="pt-2">
                  <div className="p-3 border border-red-500/30 rounded-xl bg-red-500/5 text-red-600 dark:text-red-400 text-xs flex gap-2.5 shadow-sm">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span className="font-medium leading-relaxed">Payment is past due. Please update your billing method to reactivate services.</span>
                  </div>
                </div>
              )}
            </div>
          </SpotlightCard>
        </div>

        {/* 2. Upgrade / Plan Selection Section */}
        <div className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5 mb-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" /> Subscription Tiers
              </h2>
              <p className="text-sm text-muted-foreground mt-1 font-medium">
                Choose an individual tier or an account-based team plan.
                {geoLoading
                  ? ' Detecting location...'
                  : ` Displaying ${activeCurrency === 'INR' ? 'India (INR ₹)' : 'International (USD $)'} pricing.`
                }
              </p>
            </div>

            {/* Segmented control toggle */}
            <div className="bg-muted/80 p-1.5 rounded-2xl flex items-center gap-1 border border-border/60 shadow-sm self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setPlanTab('individual')}
                className={`rounded-xl px-5 py-2 text-xs font-bold transition-all ${
                  planTab === 'individual'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Individual Plans
              </button>
              <button
                type="button"
                onClick={() => setPlanTab('company')}
                className={`rounded-xl px-5 py-2 text-xs font-bold transition-all flex items-center gap-2 ${
                  planTab === 'company'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                Company &amp; Team Plans
                <Badge className="bg-purple-500 text-white text-[9px] uppercase font-extrabold border-none px-1.5 py-0">5-20 Seats</Badge>
              </button>
            </div>
          </div>

          {planTab === 'company' ? (
            <CompanyPlansSection isCompanyMember={!!companyContext.company} companyName={companyContext.company?.name} navigate={navigate} />
          ) : geoLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-96 rounded-2xl bg-muted/40 animate-pulse border border-border/30" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 items-stretch">
              {VISIBLE_PLANS.map((plan) => {
                const isActive = activePlanId === plan.id;
                const price = activeCurrency === 'INR' ? plan.priceINR : plan.priceUSD;

                const planIndex = VISIBLE_PLANS.findIndex(p => p.id === plan.id);
                const activePlanIndex = VISIBLE_PLANS.findIndex(p => p.id === activePlanId);
                const isDowngrade = planIndex < activePlanIndex && planIndex > 0;

                let ctaLabel = 'Subscribe';
                if (isActive) ctaLabel = 'Active Plan';
                else if (activePlanId === 'free') ctaLabel = `Select ${plan.name}`;
                else ctaLabel = 'Upgrade Plan';

                return (
                  <Card
                    key={plan.id}
                    className={`flex flex-col relative transition-all duration-300 rounded-2xl ${getTierColors(plan.id)}`}
                  >
                    <CardHeader className="pb-5 pt-6 px-5">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-bold tracking-tight text-foreground">{plan.name}</h3>
                        {plan.id === 'enterprise' && !isActive && (
                          <Badge className="text-[9px] tracking-widest uppercase px-2 py-0.5 bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 shadow-sm">
                            Custom
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-xs min-h-[32px] mt-1 font-medium leading-relaxed">
                        {plan.tagline}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="flex-grow space-y-6 flex flex-col justify-between px-5 pb-6">
                      <div>
                        {plan.id === 'enterprise' ? (
                          <div className="mb-2">
                            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">Contact Sales</span>
                          </div>
                        ) : (
                          <div className="flex items-baseline gap-1 mb-2">
                            <span className="text-3xl font-black text-foreground tracking-tight">
                              {formatPrice(price ?? 0, activeCurrency)}
                            </span>
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">/ {plan.validity}</span>
                          </div>
                        )}
                        <Badge
                          variant="secondary"
                          className={`font-bold text-[10px] tracking-wider uppercase shadow-sm ${plan.id === 'enterprise'
                            ? 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20'
                            : 'bg-background border border-border/80'
                            }`}
                        >
                          <span className="text-primary font-bold">
                            {plan.candidates != null ? `${plan.candidates} Candidate Evaluation Credits` : 'Custom Limit'}
                          </span>
                        </Badge>
                      </div>

                      <div className="space-y-3.5 border-t border-border/50 pt-5">
                        {plan.features.map((feature, i) => (
                          <div key={i} className="flex items-start gap-2.5 text-xs text-muted-foreground font-medium">
                            <Check className={`h-3.5 w-3.5 flex-shrink-0 mt-0.5 ${plan.id === 'enterprise' ? 'text-indigo-500' : 'text-primary'}`} />
                            <span className="leading-snug">{feature}</span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-6 mt-auto">
                        {isActive ? (
                          <div className="w-full py-2.5 flex items-center justify-center gap-2 rounded-xl bg-primary/10 text-primary font-bold text-[11px] tracking-wider uppercase border border-primary/20 shadow-sm">
                            <Check className="h-3.5 w-3.5" /> Current Plan
                          </div>
                        ) : plan.id === 'enterprise' ? (
                          <Button
                            className="w-full font-bold uppercase text-[11px] tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg transition-all rounded-xl"
                            asChild
                          >
                            <Link to="/contact">
                              <Phone className="h-3.5 w-3.5 mr-2" />
                              Contact Sales
                            </Link>
                          </Button>
                        ) : isDowngrade ? null : (
                          <Button
                            className={`w-full font-bold uppercase text-[11px] tracking-wider shadow-md hover:shadow-lg transition-all rounded-xl ${activePlanId === 'free' ? 'bg-foreground text-background hover:bg-foreground/90' : ''
                              }`}
                            variant={activePlanId === 'free' ? "default" : "default"}
                            onClick={() => handleSubscribe(plan.id as BillingPlanId)}
                            disabled={busy !== null}
                          >
                            {busy === `subscribe-${plan.id}` && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                            {ctaLabel}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          <div className="mt-6 p-4 rounded-xl bg-muted/30 border border-border/50">
            <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              What are Candidate Evaluation Credits?
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              A <strong>Candidate Evaluation Credit</strong> represents a fully processed candidate. We use a fractional billing system: adding a candidate consumes <strong>0.50 credits</strong>, and sending them an assessment or interview consumes the remaining <strong>0.50 credits</strong> (you are only charged once for the evaluation phase per candidate). Unused credits do not roll over to the next billing cycle.
            </p>
          </div>
        </div>

        {/* 2.5 Usage History */}
        <div className="pt-6">
          <Card className="border border-border/60 shadow-md bg-card rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-border/50 pb-5 pt-6 px-6 bg-muted/20">
              <CardTitle className="flex items-center gap-2.5 text-lg font-bold text-foreground">
                <div className="p-1.5 rounded-md bg-background border border-border shadow-sm">
                  <Activity className="h-4 w-4 text-primary" />
                </div>
                Usage History
              </CardTitle>
              <CardDescription className="text-xs font-medium">Detailed breakdown of candidate evaluation credit usage and fractional billing points.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {usageHistory.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <p className="text-sm font-semibold text-foreground">No usage history yet</p>
                  <p className="text-xs text-muted-foreground mt-1">When you add candidates or send assessments, they will appear here.</p>
                </div>
              ) : (
                <div className="max-h-[400px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead className="sticky top-0 bg-muted border-b border-border/50 z-10">
                      <tr className="text-muted-foreground">
                        <th className="py-3 px-6 text-[11px] font-bold uppercase tracking-wider">Date & Time</th>
                        <th className="py-3 px-6 text-[11px] font-bold uppercase tracking-wider">Action</th>
                        <th className="py-3 px-6 text-[11px] font-bold uppercase tracking-wider">Candidate</th>
                        <th className="py-3 px-6 text-[11px] font-bold uppercase tracking-wider">Job Title</th>
                        <th className="py-3 px-6 text-[11px] font-bold uppercase tracking-wider text-right">Points Used</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {usageHistory.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-6 whitespace-nowrap text-muted-foreground font-medium text-xs">
                            {new Date(item.created_at).toLocaleString()}
                          </td>
                          <td className="py-3 px-6">
                            <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-widest shadow-sm">
                              {item.action_type}
                            </Badge>
                          </td>
                          <td className="py-3 px-6">
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground text-xs">{item.candidate_name || 'Unknown'}</span>
                              {item.candidate_email && <span className="text-[10px] text-muted-foreground">{item.candidate_email}</span>}
                            </div>
                          </td>
                          <td className="py-3 px-6 text-xs text-muted-foreground truncate max-w-[200px]" title={item.job_title || '-'}>
                            {item.job_title || '-'}
                          </td>
                          <td className="py-3 px-6 text-right font-bold font-mono text-xs text-primary">
                            +{Number(item.points_used).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 3. Invoice History */}
        <div className="pt-6">
          <Card className="border border-border/60 shadow-md bg-card rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-border/50 pb-5 pt-6 px-6 bg-muted/20">
              <CardTitle className="flex items-center gap-2.5 text-lg font-bold text-foreground">
                <div className="p-1.5 rounded-md bg-background border border-border shadow-sm">
                  <Receipt className="h-4 w-4 text-foreground/70" />
                </div>
                Billing History
              </CardTitle>
              <CardDescription className="text-xs font-medium">Download secure receipts for past transactions.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {invoices.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="h-16 w-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4 border border-border/50 shadow-sm">
                    <Receipt className="h-7 w-7 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">No billing history</p>
                  <p className="text-xs text-muted-foreground mt-1">You haven't made any payments yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border/50 text-muted-foreground bg-muted/10">
                        <th className="py-4 px-6 text-[11px] font-bold uppercase tracking-wider text-left">Invoice ID</th>
                        <th className="py-4 px-6 text-[11px] font-bold uppercase tracking-wider text-left">Billing Period</th>
                        <th className="py-4 px-6 text-[11px] font-bold uppercase tracking-wider text-left">Reference</th>
                        <th className="py-4 px-6 text-[11px] font-bold uppercase tracking-wider text-left">Status</th>
                        <th className="py-4 px-6 text-[11px] font-bold uppercase tracking-wider text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {invoices.slice(0, 5).map((invoice) => {
                        const invCurrency = String(invoice.metadata?.currency || activeCurrency).toUpperCase() as Currency;
                        return (
                          <tr key={invoice.id} className="hover:bg-muted/30 transition-colors group">
                            <td className="py-4 px-6 font-semibold text-foreground font-mono text-xs">#{invoice.id.slice(0, 8).toUpperCase()}</td>
                            <td className="py-4 px-6 text-muted-foreground font-medium text-xs">
                              {new Date(invoice.period_start).toLocaleDateString()} - {new Date(invoice.period_end).toLocaleDateString()}
                            </td>
                            <td className="py-4 px-6 text-xs font-mono text-muted-foreground/70">{invoice.payment_reference || 'Stripe Sync'}</td>
                            <td className="py-4 px-6">
                              <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'} className={`text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 shadow-sm ${invoice.status === 'paid' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20' : ''}`}>
                                {invoice.status}
                              </Badge>
                            </td>
                            <td className="py-4 px-6 text-right font-bold text-foreground">
                              {formatPrice(Number(invoice.total || 0), invCurrency)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {invoices.length > 5 && (
                    <div className="flex justify-center p-4 border-t border-border/40 bg-muted/5">
                      <Button variant="outline" size="sm" className="font-semibold text-xs rounded-xl shadow-sm hover:shadow transition-all" asChild>
                        <Link to="/billing/history">View all records</Link>
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        </>)}

        {/* Company / Team Plans Section — visible to ALL users */}
        <CompanyPlansSection isCompanyMember={!!companyContext.company} companyName={companyContext.company?.name} navigate={navigate} />

      </div>

      {/* Cancellation Modal */}
      <Dialog open={cancelModalOpen} onOpenChange={(open) => !open && setCancelModalOpen(false)}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl overflow-hidden p-0 border-border/60 shadow-2xl" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <div className="h-1.5 w-full bg-gradient-to-r from-red-500 to-rose-600" />
          <div className="px-5 pt-5 pb-1">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
                <div className="p-1.5 rounded-full bg-red-500/10 border border-red-500/20">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                </div>
                Cancel Subscription
              </DialogTitle>
              <DialogDescription className="pt-1 font-medium text-sm">
                Current Plan: <span className="font-bold text-foreground px-1.5 py-0.5 rounded-md bg-muted border border-border">{activePlan?.name || 'Starter'}</span>
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-5 py-3 text-sm bg-muted/20 border-y border-border/40">
            <p className="font-semibold text-foreground mb-2">By cancelling, you acknowledge the following:</p>
            <ul className="space-y-1 text-muted-foreground font-medium">
              <li className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-foreground/40 mt-1.5 shrink-0" />
                <span>Your subscription will continue until the end of your current billing period. You will NOT lose access immediately.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-foreground/40 mt-1.5 shrink-0" />
                <span>Your account defaults to the Free Plan after expiry.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-foreground/40 mt-1.5 shrink-0" />
                <span>Any unused portion of your subscription is non-refundable.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-foreground/40 mt-1.5 shrink-0" />
                <span>After expiry, assessment limits and premium functionality will reset to the Free Plan limits.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-foreground/40 mt-1.5 shrink-0" />
                <span>Historical data, reports, and completed assessments will remain available.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-foreground/40 mt-1.5 shrink-0" />
                <span>You may subscribe to a new plan at any time.</span>
              </li>
            </ul>

            <div className="flex items-start space-x-3 pt-3 mt-3 border-t border-border/50">
              <Checkbox id="cancel-terms" checked={cancelChecked} onCheckedChange={(checked) => setCancelChecked(!!checked)} className="mt-0.5 rounded-[4px]" />
              <label htmlFor="cancel-terms" className="text-sm font-semibold leading-snug cursor-pointer text-foreground">
                I understand and agree to the cancellation terms
              </label>
            </div>
          </div>

          <div className="px-5 py-3 bg-background">
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-foreground block">
                Type <span className="font-bold font-mono bg-red-500/10 text-red-600 border border-red-500/20 px-1.5 py-0.5 rounded mx-0.5">{`Cancel ${activePlan?.name || 'Starter'} Plan`}</span> to confirm (Case Sensitive):
              </label>
              <Input
                placeholder={`Cancel ${activePlan?.name || 'Starter'} Plan`}
                value={cancelConfirmText}
                onChange={(e) => setCancelConfirmText(e.target.value)}
                className="font-mono text-sm border-border/70 focus-visible:ring-red-500/20 focus-visible:border-red-500 rounded-xl"
              />
            </div>
          </div>

          <div className="px-5 py-3 bg-muted/30 border-t border-border/50 flex items-center justify-end gap-3 rounded-b-2xl">
            <Button variant="secondary" onClick={() => setCancelModalOpen(false)} disabled={busy === 'cancel'} className="font-semibold shadow-sm rounded-xl border border-border/50 hover:bg-secondary/80">
              Keep Plan
            </Button>
            <Button
              variant="destructive"
              disabled={
                !cancelChecked ||
                cancelConfirmText.trim() !== `Cancel ${activePlan?.name || 'Starter'} Plan` ||
                busy === 'cancel'
              }
              onClick={handleCancelSubscription}
              className="font-bold shadow-md rounded-xl"
            >
              {busy === 'cancel' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Cancellation
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
