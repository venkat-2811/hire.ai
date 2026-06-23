import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowRight, Check, Sparkles, Zap, Crown, TrendingUp, Globe } from 'lucide-react';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { useUser } from '@clerk/clerk-react';
import { subscriptionApi } from '@/lib/api';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useCountryDetection } from '@/hooks/useCountryDetection';
import { formatPrice, getPlansForCurrency, type Currency, type PlanId } from '@/lib/pricing';

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];

const TIMEZONES = [
  'UTC', 'Asia/Kolkata', 'America/New_York', 'America/Los_Angeles',
  'Europe/London', 'Europe/Berlin', 'Asia/Singapore', 'Australia/Sydney',
];

const COUNTRY_OPTIONS = [
  { code: 'IN', label: 'India' },
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'CA', label: 'Canada' },
  { code: 'AU', label: 'Australia' },
  { code: 'SG', label: 'Singapore' },
  { code: 'AE', label: 'United Arab Emirates' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'NL', label: 'Netherlands' },
];

const PLAN_UI_META: Record<PlanId, { icon: typeof Sparkles; gradient: string; cardBg: string; cta: string; popular?: boolean }> = {
  free: {
    icon: Sparkles,
    gradient: 'from-slate-500 to-slate-600',
    cardBg: 'bg-slate-500/5 border-slate-500/20',
    cta: 'Start Free',
  },
  starter: {
    icon: Zap,
    gradient: 'from-blue-500 to-cyan-500',
    cardBg: 'bg-blue-500/5 border-blue-500/20',
    cta: 'Choose Starter',
    popular: true,
  },
  professional: {
    icon: TrendingUp,
    gradient: 'from-purple-500 to-pink-500',
    cardBg: 'bg-purple-500/5 border-purple-500/30',
    cta: 'Choose Growth',
  },
  scale: {
    icon: Crown,
    gradient: 'from-amber-500 to-orange-500',
    cardBg: 'bg-amber-500/5 border-amber-500/30',
    cta: 'Choose Scale',
  },
  enterprise: {
    icon: Globe,
    gradient: 'from-violet-600 to-purple-700',
    cardBg: 'bg-violet-500/5 border-violet-500/40',
    cta: 'Contact Sales',
  },
};

const formatCurrency = (amount: number, currency: Currency) => formatPrice(amount, currency);

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1); // 1 = company setup, 2 = plan selection
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [processingPlan, setProcessingPlan] = useState(false);
  const { user } = useUser();

  const needsName = !profile?.first_name && !profile?.last_name && !user?.firstName && !user?.lastName;

  const initial = useMemo(() => ({
    first_name: profile?.first_name ?? user?.firstName ?? '',
    last_name: profile?.last_name ?? user?.lastName ?? '',
    organization_email: profile?.organization_email ?? '',
    company_name: profile?.company_name ?? '',
    company_website: profile?.company_website ?? '',
    company_size: profile?.company_size ?? '',
    industry: profile?.industry ?? '',
    headquarters_location: profile?.headquarters_location ?? '',
    hiring_regions: profile?.hiring_regions ?? '',
    hiring_roles: profile?.hiring_roles ?? '',
    preferred_timezone: profile?.preferred_timezone ?? 'Asia/Kolkata',
    country: profile?.country ?? '',
    contact_phone: profile?.contact_phone ?? '',
  }), [profile]);

  const [form, setForm] = useState(initial);

  const { country, currency: detectedCurrency, isLoading: geoLoading } = useCountryDetection({
    explicitCountry: form.country,
    profileCountry: profile?.country,
  });

  const onboardingPlans = useMemo(() => {
    return getPlansForCurrency(detectedCurrency).map((plan) => {
      const meta = PLAN_UI_META[plan.id];
      return {
        ...plan,
        ...meta,
        features: plan.features.map((text, idx) => ({ text, highlight: idx === 0 })),
      };
    });
  }, [detectedCurrency]);

  useEffect(() => { setForm(initial); }, [initial]);

  useEffect(() => {
    if (profile?.onboarding_completed && profile?.company_name?.trim()) {
      navigate('/dashboard', { replace: true });
    }
  }, [profile?.onboarding_completed, profile?.company_name, navigate]);

  const verifyingRef = useRef(false);

  // Handle Stripe redirect back
  useEffect(() => {
    if (isLoading) return;

    const sessionId = searchParams.get('session_id');
    const plan = searchParams.get('plan');
    const cancelled = searchParams.get('cancelled');

    if (cancelled) {
      toast.error('Payment was cancelled.');
      window.history.replaceState({}, '', '/onboarding');
      return;
    }

    if (sessionId && plan && !verifyingRef.current) {
      verifyingRef.current = true;
      setStep(2);
      setProcessingPlan(true);
      setSelectedPlan(plan);

      // Clean URL immediately
      window.history.replaceState({}, '', '/onboarding');

      subscriptionApi.verify({ session_id: sessionId, plan })
        .then(() => {
          toast.success(`${plan.toUpperCase()} plan activated successfully! 🎉`);
          void queryClient.invalidateQueries({ queryKey: ['billing-usage'] });
          void queryClient.invalidateQueries({ queryKey: ['layout-billing-usage'] });
          void queryClient.invalidateQueries({ queryKey: ['profile'] });
          updateProfile.mutate(
            { onboarding_completed: true } as Record<string, unknown>,
            { onSuccess: () => navigate('/dashboard', { replace: true }) },
          );
        })
        .catch((err) => {
          console.error('Payment verification failed:', err);
          toast.error('Payment verification failed. Please try again.');
          setProcessingPlan(false);
          setSelectedPlan(null);
          verifyingRef.current = false;
        });
    }
  }, [searchParams, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const onChange = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleStep1Submit = async () => {
    if (!form.organization_email.trim()) return;
    if (!form.company_name.trim()) return;
    if (needsName && (!form.first_name.trim() || !form.last_name.trim())) {
      toast.error('First Name and Last Name are required');
      return;
    }

    if (needsName && user) {
      try {
        await user.update({
          firstName: form.first_name.trim(),
          lastName: form.last_name.trim(),
        });
      } catch (err) {
        console.error('Failed to update name in Clerk', err);
        // Continue anyway to sync with Supabase
      }
    }

    updateProfile.mutate(
      {
        first_name: form.first_name.trim() || null,
        last_name: form.last_name.trim() || null,
        organization_email: form.organization_email.trim(),
        company_name: form.company_name.trim(),
        company_website: form.company_website.trim() || null,
        company_size: form.company_size || null,
        industry: form.industry.trim() || null,
        headquarters_location: form.headquarters_location.trim() || null,
        hiring_regions: form.hiring_regions.trim() || null,
        hiring_roles: form.hiring_roles.trim() || null,
        preferred_timezone: form.preferred_timezone || null,
        country: form.country || null,
        contact_phone: form.contact_phone.trim() || null,
      },
      {
        onSuccess: () => {
          if (profile?.onboarding_completed) {
            navigate('/dashboard', { replace: true });
          } else {
            setStep(2);
          }
        },
      },
    );
  };

  const handlePlanSelect = async (planId: string) => {
    if (processingPlan) return;
    setSelectedPlan(planId);
    setProcessingPlan(true);

    try {
      if (planId === 'free') {
        await subscriptionApi.selectFree();
        updateProfile.mutate(
          { onboarding_completed: true } as Record<string, unknown>,
          { onSuccess: () => navigate('/dashboard', { replace: true }) },
        );
        return;
      }

      // Create Stripe Checkout session and redirect
      const session = await subscriptionApi.createOrder(planId, detectedCurrency, country);
      window.location.href = session.url;
    } catch (err: unknown) {
      const e = err as Error;
      toast.error(e.message || 'Failed to initialize subscription purchase.');
      setProcessingPlan(false);
      setSelectedPlan(null);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              step > 1 ? 'bg-primary text-white' : step === 1 ? 'bg-primary/10 border-2 border-primary text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {step > 1 ? <Check className="h-4 w-4" /> : '1'}
            </div>
            <span className="text-sm font-medium">Company Setup</span>
          </div>
          <div className="h-px w-8 bg-border" />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              step === 2 ? 'bg-primary/10 border-2 border-primary text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              2
            </div>
            <span className="text-sm font-medium">Choose Plan</span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="mb-6">
                <h1 className="text-2xl lg:text-3xl font-bold">Company Setup</h1>
                <p className="text-muted-foreground mt-1">Tell us a bit about your company so we can personalize hiring workflows.</p>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Organization Details</CardTitle>
                  <CardDescription>These details will appear in your profile and can be edited later.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {needsName && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2 pb-4 border-b">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">Your First Name *</Label>
                        <Input id="firstName" placeholder="John" value={form.first_name} onChange={(e) => onChange('first_name', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Your Last Name *</Label>
                        <Input id="lastName" placeholder="Doe" value={form.last_name} onChange={(e) => onChange('last_name', e.target.value)} />
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="orgEmail">Organization Email *</Label>
                      <Input id="orgEmail" type="email" placeholder="you@company.com" value={form.organization_email} onChange={(e) => onChange('organization_email', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Company Name *</Label>
                      <Input id="companyName" placeholder="Acme Inc" value={form.company_name} onChange={(e) => onChange('company_name', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="website">Company Website</Label>
                      <Input id="website" placeholder="https://company.com" value={form.company_website} onChange={(e) => onChange('company_website', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Company Size</Label>
                      <Select value={form.company_size} onValueChange={(v) => onChange('company_size', v)}>
                        <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
                        <SelectContent>
                          {COMPANY_SIZES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="industry">Industry</Label>
                      <Input id="industry" placeholder="SaaS, FinTech, Healthcare..." value={form.industry} onChange={(e) => onChange('industry', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Country</Label>
                      <Select value={form.country} onValueChange={(v) => onChange('country', v)}>
                        <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                        <SelectContent>
                          {COUNTRY_OPTIONS.map((c) => (<SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hq">Headquarters Location</Label>
                      <Input id="hq" placeholder="Bengaluru, India" value={form.headquarters_location} onChange={(e) => onChange('headquarters_location', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Contact Phone</Label>
                      <Input id="phone" placeholder="+91 9xxxx xxxxx" value={form.contact_phone} onChange={(e) => onChange('contact_phone', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Preferred Timezone</Label>
                      <Select value={form.preferred_timezone} onValueChange={(v) => onChange('preferred_timezone', v)}>
                        <SelectTrigger><SelectValue placeholder="Select timezone" /></SelectTrigger>
                        <SelectContent>
                          {TIMEZONES.map((tz) => (<SelectItem key={tz} value={tz}>{tz}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="hiringRoles">Hiring Roles (comma-separated)</Label>
                    <Textarea id="hiringRoles" placeholder="Frontend Engineer, Backend Engineer, Salesforce Developer..." value={form.hiring_roles} onChange={(e) => onChange('hiring_roles', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regions">Hiring Regions (comma-separated)</Label>
                    <Textarea id="regions" placeholder="India, US, Remote..." value={form.hiring_regions} onChange={(e) => onChange('hiring_regions', e.target.value)} />
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={handleStep1Submit} disabled={updateProfile.isPending || !form.organization_email.trim() || !form.company_name.trim() || (needsName && (!form.first_name.trim() || !form.last_name.trim()))}>
                      {updateProfile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <div className="mb-6 text-center">
                <h1 className="text-2xl lg:text-3xl font-bold">Choose Your Plan</h1>
                <p className="text-muted-foreground mt-1">Select an onboard plan to active candidate assessment capacities.</p>
                <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-muted-foreground font-semibold">
                  <Globe className="h-3.5 w-3.5" />
                  <span>Currency Auto-Detected: <span className="text-primary font-bold">{detectedCurrency}</span></span>
                </div>
              </div>

              {geoLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 lg:gap-7 items-stretch">
                  {onboardingPlans.map((plan) => (
                    <div key={plan.id} className="h-[520px] rounded-2xl bg-muted/30 animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 lg:gap-7 items-stretch">
                  {onboardingPlans.map((plan) => {
                    const price = detectedCurrency === 'INR' ? plan.priceINR : plan.priceUSD;

                    return (
                      <motion.div
                        key={plan.id}
                        whileHover={{ scale: 1.02 }}
                        className={`relative flex flex-col rounded-2xl border-2 p-6 transition-all cursor-pointer bg-card h-full min-h-[520px] ${
                          selectedPlan === plan.id
                            ? 'border-primary shadow-lg shadow-primary/10'
                            : plan.cardBg
                        } ${plan.popular ? 'ring-2 ring-purple-500/30' : ''}`}
                        onClick={() => !processingPlan && setSelectedPlan(plan.id)}
                      >
                        {plan.popular && (
                          <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] px-3">
                            MOST POPULAR
                          </Badge>
                        )}

                        <div className="text-center mb-4">
                          <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${plan.gradient} mb-3`}>
                            <plan.icon className="h-6 w-6 text-white" />
                          </div>
                          <h3 className="text-lg font-bold">{plan.name}</h3>
                          <div className="mt-1 flex items-baseline justify-center gap-1">
                            {plan.isContactPlan ? (
                              <span className="text-2xl font-extrabold text-purple-600">Contact Sales</span>
                            ) : (
                              <>
                                <span className="text-3xl font-extrabold">{formatCurrency(price ?? 0, detectedCurrency)}</span>
                                <span className="text-sm text-muted-foreground font-semibold">/ {plan.validity}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <ul className="space-y-2.5 mb-6 flex-grow">
                          {plan.features.map((f, idx) => (
                            <li key={idx} className="flex items-center gap-2 text-sm">
                              <Check className={`h-4 w-4 flex-shrink-0 ${f.highlight ? 'text-green-500' : 'text-muted-foreground'}`} />
                              <span className={f.highlight ? 'font-medium' : 'text-muted-foreground'}>{f.text}</span>
                            </li>
                          ))}
                        </ul>

                        <Button
                          className="w-full mt-auto font-bold"
                          variant={plan.popular || plan.id === 'scale' ? 'default' : plan.id === 'enterprise' ? 'default' : 'outline'}
                          disabled={processingPlan}
                          style={plan.id === 'enterprise' ? { background: 'linear-gradient(135deg, #7c3aed, #9333ea)' } : undefined}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (plan.isContactPlan) {
                              window.open('/contact', '_blank');
                            } else {
                              handlePlanSelect(plan.id);
                            }
                          }}
                        >
                          {processingPlan && selectedPlan === plan.id ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : null}
                          {plan.id === 'free'
                            ? plan.cta
                            : plan.isContactPlan
                            ? 'Contact Sales'
                            : `${plan.cta} — ${formatCurrency(price, detectedCurrency)}`}
                        </Button>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              <div className="mt-6 text-center">
                <Button variant="ghost" size="sm" onClick={() => setStep(1)} disabled={processingPlan}>
                  ← Back to Company Setup
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
