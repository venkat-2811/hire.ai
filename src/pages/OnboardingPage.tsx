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
import { JoinCompanySection } from '@/components/company/JoinCompanySection';

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];

const TIMEZONES = [
  'UTC',
  'Asia/Kolkata',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'America/Toronto',
  'America/Vancouver',
  'Australia/Sydney',
  'Asia/Singapore',
  'Asia/Dubai',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/Amsterdam',
  'Europe/Dublin',
  'Pacific/Auckland',
  'Africa/Johannesburg',
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
  { code: 'IE', label: 'Ireland' },
  { code: 'NZ', label: 'New Zealand' },
  { code: 'ZA', label: 'South Africa' },
  { code: 'OTHER', label: 'Other' },
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
  growth: {
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
    organization_email: profile?.organization_email ?? user?.primaryEmailAddress?.emailAddress ?? '',
    company_name: profile?.company_name ?? '',
    company_website: profile?.company_website ?? '',
    company_size: profile?.company_size ?? '',
    industry: profile?.industry ?? '',
    headquarters_location: profile?.headquarters_location ?? '',
    hiring_regions: profile?.hiring_regions ?? '',
    hiring_roles: profile?.hiring_roles ?? '',
    preferred_timezone: profile?.preferred_timezone ?? '',
    country: profile?.country ?? '',
    contact_phone: profile?.contact_phone ?? '',
  }), [profile, user?.firstName, user?.lastName]);

  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { country, currency: detectedCurrency, isLoading: geoLoading, isIndia } = useCountryDetection({
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
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleStep1Submit = async () => {
    const newErrors: Record<string, string> = {};
    if (!form.organization_email.trim()) {
      newErrors.organization_email = 'Organization Email is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.organization_email.trim())) {
        newErrors.organization_email = 'Please enter a valid organization email address (e.g., user@company.com)';
      }
    }
    if (!form.company_name.trim()) {
      newErrors.company_name = 'Company Name is required';
    }
    if (needsName) {
      if (!form.first_name.trim()) newErrors.first_name = 'First Name is required';
      if (!form.last_name.trim()) newErrors.last_name = 'Last Name is required';
    }
    if (!form.country?.trim()) {
      newErrors.country = 'Country is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Please fix the highlighted errors');
      const firstErrorKey = Object.keys(newErrors)[0];
      const idMap: Record<string, string> = {
        organization_email: 'orgEmail',
        company_name: 'companyName',
        first_name: 'firstName',
        last_name: 'lastName'
      };
      const elementId = idMap[firstErrorKey];
      if (elementId) {
        const element = document.getElementById(elementId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.focus();
        }
      }
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
      <div className={`mx-auto w-full transition-all duration-500 ease-in-out ${step === 1 ? 'max-w-4xl p-6 lg:p-8' : 'max-w-[1400px] p-4 lg:px-6 lg:py-4'}`}>
        <div className={`flex items-center gap-3 ${step === 1 ? 'mb-8' : 'mb-4 justify-center'}`}>
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step > 1 ? 'bg-primary text-white' : step === 1 ? 'bg-primary/10 border-2 border-primary text-primary' : 'bg-muted text-muted-foreground'
              }`}>
              {step > 1 ? <Check className="h-4 w-4" /> : '1'}
            </div>
            <span className="text-sm font-medium">Company Setup</span>
          </div>
          <div className="h-px w-8 bg-border" />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === 2 ? 'bg-primary/10 border-2 border-primary text-primary' : 'bg-muted text-muted-foreground'
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
                <p className="text-muted-foreground mt-1">Join your team or tell us about your company to personalize hiring workflows.</p>
              </div>

              <div className="mb-8">
                <JoinCompanySection
                  onContinue={() => setStep(2)}
                  onJoinedCompany={() => {
                    // User has joined a company — their billing is company-managed.
                    // Save the profile (step 1 data) and redirect to dashboard.
                    updateProfile.mutate(
                      {
                        organization_email: form.organization_email.trim() || null,
                        company_name: form.company_name.trim() || null,
                        first_name: form.first_name.trim() || null,
                        last_name: form.last_name.trim() || null,
                        country: form.country || null,
                        onboarding_completed: true,
                      } as Record<string, unknown>,
                      { onSuccess: () => navigate('/dashboard', { replace: true }) },
                    );
                  }}
                />
              </div>
              
              <div className="flex items-center gap-4 mb-8">
                <div className="h-px bg-border flex-1" />
                <span className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Or create your own workspace</span>
                <div className="h-px bg-border flex-1" />
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
                        <Label htmlFor="firstName" className={errors.first_name ? "text-red-500" : ""}>Your First Name *</Label>
                        <Input id="firstName" className={errors.first_name ? "border-red-500 focus-visible:ring-red-500" : ""} placeholder="John" value={form.first_name} onChange={(e) => onChange('first_name', e.target.value)} />
                        {errors.first_name && <p className="text-xs text-red-500">{errors.first_name}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName" className={errors.last_name ? "text-red-500" : ""}>Your Last Name *</Label>
                        <Input id="lastName" className={errors.last_name ? "border-red-500 focus-visible:ring-red-500" : ""} placeholder="Doe" value={form.last_name} onChange={(e) => onChange('last_name', e.target.value)} />
                        {errors.last_name && <p className="text-xs text-red-500">{errors.last_name}</p>}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="orgEmail" className={errors.organization_email ? "text-red-500" : ""}>Organization Email *</Label>
                      <Input
                        id="orgEmail"
                        className={`${errors.organization_email ? "border-red-500 focus-visible:ring-red-500" : ""} ${user?.primaryEmailAddress?.emailAddress ? "bg-muted/50 cursor-not-allowed opacity-80" : ""}`}
                        type="email"
                        placeholder="you@company.com"
                        value={form.organization_email}
                        onChange={(e) => onChange('organization_email', e.target.value)}
                        readOnly={!!user?.primaryEmailAddress?.emailAddress}
                        disabled={!!user?.primaryEmailAddress?.emailAddress}
                      />
                      {user?.primaryEmailAddress?.emailAddress && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                          Locked to your account email
                        </p>
                      )}
                      {errors.organization_email && <p className="text-xs text-red-500">{errors.organization_email}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyName" className={errors.company_name ? "text-red-500" : ""}>Company Name *</Label>
                      <Input id="companyName" className={errors.company_name ? "border-red-500 focus-visible:ring-red-500" : ""} placeholder="Your Company" value={form.company_name} onChange={(e) => onChange('company_name', e.target.value)} />
                      {errors.company_name && <p className="text-xs text-red-500">{errors.company_name}</p>}
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
                      <Label className={errors.country ? "text-red-500" : ""}>Country *</Label>
                      <Select value={form.country} onValueChange={(v) => onChange('country', v)}>
                        <SelectTrigger className={errors.country ? "border-red-500 focus:ring-red-500" : ""}><SelectValue placeholder="Select country" /></SelectTrigger>
                        <SelectContent>
                          {COUNTRY_OPTIONS.map((c) => (<SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      {errors.country && <p className="text-xs text-red-500">{errors.country}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hq">Headquarters (City / State)</Label>
                      <Input id="hq" placeholder={isIndia ? "e.g. Bengaluru, Karnataka" : "e.g. San Francisco, CA"} value={form.headquarters_location} onChange={(e) => onChange('headquarters_location', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Contact Phone</Label>
                      <Input id="phone" placeholder={isIndia ? "+91 98765 43210" : "+1 (555) 000-0000"} value={form.contact_phone} onChange={(e) => onChange('contact_phone', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Preferred Timezone</Label>
                      <Select value={form.preferred_timezone || undefined} onValueChange={(v) => onChange('preferred_timezone', v)}>
                        <SelectTrigger><SelectValue placeholder="Select Your Timezone" /></SelectTrigger>
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
                    <Textarea id="regions" placeholder={isIndia ? "e.g. India, APAC, Remote Worldwide..." : "e.g. US, Canada, Remote Worldwide..."} value={form.hiring_regions} onChange={(e) => onChange('hiring_regions', e.target.value)} />
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={handleStep1Submit} disabled={updateProfile.isPending}>
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
              <div className="mb-4 lg:mb-5 text-center">
                <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight">Choose Your Plan</h1>
                <p className="text-muted-foreground mt-1.5 text-sm lg:text-base max-w-xl mx-auto">Select an onboard plan to active candidate assessment capacities.</p>
                <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-muted-foreground font-semibold bg-muted/50 w-fit mx-auto px-3 py-1 rounded-full border border-border/50 shadow-sm">
                  <Globe className="h-3.5 w-3.5" />
                  <span>Currency Auto-Detected: <span className="text-primary font-bold">{detectedCurrency}</span></span>
                </div>
              </div>

              {geoLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 lg:gap-5 items-stretch h-full">
                  {onboardingPlans.map((plan) => (
                    <div key={plan.id} className="min-h-[420px] rounded-[24px] bg-muted/30 animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 lg:gap-5 items-stretch relative z-10">
                  {onboardingPlans.map((plan) => {
                    const price = detectedCurrency === 'INR' ? plan.priceINR : plan.priceUSD;

                    return (
                      <motion.div
                        key={plan.id}
                        whileHover={{ y: -4, scale: 1.01 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className={`relative flex flex-col rounded-[24px] border p-5 transition-all cursor-pointer bg-card overflow-visible group ${selectedPlan === plan.id
                          ? 'border-primary ring-1 ring-primary shadow-xl shadow-primary/10'
                          : `border-border/60 hover:border-border hover:shadow-lg ${plan.cardBg}`
                          } ${plan.popular ? 'border-purple-500/50 shadow-lg shadow-purple-500/10' : ''}`}
                        onClick={() => !processingPlan && setSelectedPlan(plan.id)}
                      >
                        {/* Subtle background glow for popular plan */}
                        {plan.popular && (
                          <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 to-transparent pointer-events-none rounded-[22px]" />
                        )}

                        {plan.popular && (
                          <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] uppercase tracking-wider font-bold py-0.5 px-3 rounded-full border-none shadow-md whitespace-nowrap z-10">
                            Most Popular
                          </Badge>
                        )}

                        <div className="text-center mb-4 relative z-10">
                          <div className={`mx-auto w-10 h-10 rounded-xl bg-gradient-to-br ${plan.gradient} mb-3 flex items-center justify-center shadow-inner`}>
                            <plan.icon className="h-5 w-5 text-white" />
                          </div>
                          <h3 className="text-[15px] font-bold text-foreground/90 uppercase tracking-wide">{plan.name}</h3>
                          <div className="mt-1.5 flex items-baseline justify-center gap-1 h-[36px]">
                            {plan.isContactPlan ? (
                              <span className="text-xl lg:text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-purple-700">Contact Sales</span>
                            ) : (
                              <>
                                <span className="text-2xl lg:text-3xl font-extrabold tracking-tight">{formatCurrency(price ?? 0, detectedCurrency)}</span>
                                <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">/ {plan.validity}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <ul className="space-y-2.5 mb-5 flex-grow relative z-10">
                          {plan.features.map((f, idx) => (
                            <li key={idx} className="flex items-start gap-2.5 text-[12px] leading-tight">
                              <div className={`mt-[2px] rounded-full p-[2px] shrink-0 ${f.highlight ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                                <Check className="h-[10px] w-[10px]" strokeWidth={3} />
                              </div>
                              <span className={f.highlight ? 'font-semibold text-foreground' : 'text-muted-foreground'}>{f.text}</span>
                            </li>
                          ))}
                        </ul>

                        <div className="mt-auto relative z-10 pt-2">
                          <Button
                            className={`w-full rounded-xl h-9 text-sm font-semibold transition-all shadow-sm ${plan.popular
                              ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0'
                              : ''
                              }`}
                            variant={plan.popular || plan.id === 'enterprise' ? 'default' : 'outline'}
                            disabled={processingPlan}
                            style={plan.id === 'enterprise' ? { background: 'linear-gradient(135deg, #7c3aed, #9333ea)', color: 'white', border: 'none' } : undefined}
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
                                : `${plan.cta} — ${formatCurrency(price ?? 0, detectedCurrency)}`}
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              <div className="mt-5 lg:mt-7 flex justify-center">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={processingPlan}
                  className="bg-card text-center w-56 rounded-lg h-9 relative text-foreground text-xs font-medium border border-border/80 group overflow-hidden flex items-center justify-center shadow-sm hover:shadow-md hover:border-border transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="bg-muted rounded-md h-[calc(100%-4px)] w-8 absolute left-[2px] top-[2px] group-hover:w-[calc(100%-4px)] group-hover:bg-neutral-800 z-10 duration-500 ease-in-out" />
                  <svg
                    width="14px"
                    height="14px"
                    viewBox="0 0 1024 1024"
                    xmlns="http://www.w3.org/2000/svg"
                    className="absolute left-[11px] top-[11px] group-hover:left-[calc(100%-25px)] text-neutral-950 group-hover:text-white transition-all duration-500 z-20"
                  >
                    <path fill="currentColor" d="M224 480h640a32 32 0 1 1 0 64H224a32 32 0 0 1 0-64z"></path>
                    <path fill="currentColor" d="m237.248 512 265.408 265.344a32 32 0 0 1-45.312 45.312l-288-288a32 32 0 0 1 0-45.312l288-288a32 32 0 1 1 45.312 45.312L237.248 512z"></path>
                  </svg>
                  <p className="translate-x-3 z-20 transition-colors duration-500 group-hover:text-white font-bold">Back to Company Setup</p>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
