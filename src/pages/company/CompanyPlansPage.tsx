import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Users, CreditCard, Check, Mail, Crown } from 'lucide-react';
import { companyApi, type CompanyPlan } from '@/lib/api';
import { useUser } from '@clerk/clerk-react';
import { useCountryDetection } from '@/hooks/useCountryDetection';
import { formatPrice, type Currency } from '@/lib/pricing';
import { toast } from 'sonner';

const PLAN_COLORS = [
  { border: 'border-indigo-500/30', bg: 'bg-indigo-500/5', accent: 'text-indigo-400', btn: 'bg-indigo-600 hover:bg-indigo-500' },
  { border: 'border-violet-500/30', bg: 'bg-violet-500/5', accent: 'text-violet-400', btn: 'bg-violet-600 hover:bg-violet-500', popular: true },
  { border: 'border-purple-500/30', bg: 'bg-purple-500/5', accent: 'text-purple-400', btn: 'bg-purple-700 hover:bg-purple-600' },
  { border: 'border-pink-500/30', bg: 'bg-pink-500/5', accent: 'text-pink-400', btn: 'bg-pink-700 hover:bg-pink-600' },
];

export default function CompanyPlansPage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { currency: detectedCurrency, isIndia } = useCountryDetection({ profileCountry: null, explicitCountry: null });
  const currency: Currency = detectedCurrency;

  const plansQuery = useQuery({
    queryKey: ['company-plans'],
    queryFn: () => companyApi.plans(),
    staleTime: 300_000,
  });

  const plans = plansQuery.data?.plans ?? [];

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-2">
            <Building2 className="h-3.5 w-3.5" />
            Company Plans
          </div>
          <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight">
            Hire Together, At Scale
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm lg:text-base">
            One company plan, multiple recruiter seats. Each seat gets its own credit allocation.
            Built for teams who recruit together.
          </p>
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { icon: <Users className="h-5 w-5" />, label: 'Recruiter Seats', desc: 'Each recruiter gets their own login and credit pool' },
            { icon: <CreditCard className="h-5 w-5" />, label: 'Credit Allocation', desc: '100 credits per seat, allocated on join approval' },
            { icon: <Mail className="h-5 w-5" />, label: 'Email Approvals', desc: 'One-click approve/reject directly from email inbox' },
          ].map(f => (
            <div key={f.label} className="space-y-2">
              <div className="h-10 w-10 rounded-xl bg-muted/40 flex items-center justify-center mx-auto text-indigo-400">
                {f.icon}
              </div>
              <div className="text-sm font-semibold">{f.label}</div>
              <div className="text-xs text-muted-foreground">{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Plan Cards */}
        {plansQuery.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {plans.map((plan, idx) => {
              const style = PLAN_COLORS[idx % PLAN_COLORS.length];
              const price = isIndia ? plan.price_inr : plan.price_usd;
              const features = Array.isArray(plan.features) ? plan.features : [];

              return (
                <Card
                  key={plan.id}
                  className={`relative overflow-hidden border ${style.border} ${style.bg} transition-all hover:scale-[1.01] hover:shadow-lg`}
                >
                  {style.popular && (
                    <div className="absolute top-3 right-3">
                      <Badge className="bg-violet-600 text-white text-xs">
                        <Crown className="h-2.5 w-2.5 mr-1" />Popular
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <CardTitle className={`text-lg font-extrabold ${style.accent}`}>{plan.name}</CardTitle>
                    <div className="flex items-end gap-2 mt-1">
                      <span className="text-3xl font-black">
                        {price > 0 ? formatPrice(price, currency) : 'Custom'}
                      </span>
                      {price > 0 && <span className="text-muted-foreground text-sm mb-1">/ {plan.validity}</span>}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-background/40 rounded-lg p-2.5 text-center">
                        <div className={`text-xl font-extrabold ${style.accent}`}>{plan.recruiter_seats}</div>
                        <div className="text-xs text-muted-foreground">Seats</div>
                      </div>
                      <div className="bg-background/40 rounded-lg p-2.5 text-center">
                        <div className={`text-xl font-extrabold ${style.accent}`}>{plan.total_credits}</div>
                        <div className="text-xs text-muted-foreground">Total Credits</div>
                      </div>
                    </div>
                    <ul className="space-y-1.5">
                      {features.map((f, fi) => (
                        <li key={fi} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Check className={`h-3.5 w-3.5 flex-shrink-0 ${style.accent}`} />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className={`w-full text-white font-bold ${style.btn}`}
                      onClick={() => {
                        const subject = encodeURIComponent(`[Rekshift] Company Plan Enquiry — ${plan.name}`);
                        const body = encodeURIComponent(
                          `Hi Rekshift Team,\n\nI'm interested in the ${plan.name} (${plan.recruiter_seats} seats, ${plan.total_credits} credits).\n\nMy name: ${user?.fullName ?? ''}\nEmail: ${user?.primaryEmailAddress?.emailAddress ?? ''}\n\nPlease get in touch.\n\nThanks`
                        );
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

        <p className="text-center text-xs text-muted-foreground">
          All plans are manually provisioned by our team. Contact us and we'll get you set up within 24 hours.
        </p>
      </div>
    </DashboardLayout>
  );
}
