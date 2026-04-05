import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Zap, Crown, Loader2, CheckCircle2 } from 'lucide-react';
import { subscriptionApi } from '@/lib/api';
import { toast } from 'sonner';

interface UpgradePromptProps {
  open: boolean;
  onClose: () => void;
  resource: string;
  current: number;
  limit: number;
  plan: string;
}

const PLANS = [
  {
    id: 'pro',
    name: 'Pro',
    price: '$10',
    period: '/month',
    icon: Zap,
    color: 'from-blue-500 to-cyan-500',
    features: ['Up to 15 job roles', '100+ technical assessments', '100+ interviews', 'Priority support'],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$15',
    period: '/month',
    icon: Crown,
    color: 'from-purple-500 to-pink-500',
    features: ['50+ job roles (unlimited)', 'Unlimited assessments', 'Unlimited interviews', 'Dedicated support'],
    popular: true,
  },
];

export function UpgradePrompt({ open, onClose, resource, current, limit, plan }: UpgradePromptProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [planForBilling, setPlanForBilling] = useState<'pro' | 'premium' | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly' | null>(null);

  const handleUpgrade = async () => {
    if (!planForBilling || !billingCycle) return;
    setLoading(planForBilling);
    try {
      const session = await subscriptionApi.createOrder(planForBilling, billingCycle);
      // Redirect to Stripe Checkout
      window.location.href = session.url;
    } catch (err: any) {
      toast.error(err.message || 'Failed to create payment session');
    } finally {
      setLoading(null);
    }
  };

  const openBillingSelector = (targetPlan: 'pro' | 'premium') => {
    setPlanForBilling(targetPlan);
    setBillingCycle(null);
  };

  const closeBillingSelector = () => {
    setPlanForBilling(null);
    setBillingCycle(null);
  };

  const cycleOptions = planForBilling === 'premium'
    ? [
      { id: 'monthly' as const, title: 'Monthly', priceText: '$15 / month', helper: 'Billed monthly' },
      { id: 'yearly' as const, title: 'Yearly', priceText: '$150 / year', helper: 'Save ~17%' },
    ]
    : [
      { id: 'monthly' as const, title: 'Monthly', priceText: '$10 / month', helper: 'Billed monthly' },
      { id: 'yearly' as const, title: 'Yearly', priceText: '$100 / year', helper: 'Save ~17%' },
    ];

  return (
    <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Upgrade Your Plan
          </DialogTitle>
          <DialogDescription>
            You've used <span className="font-semibold text-foreground">{current}/{limit}</span>{' '}
            {resource} on the <Badge variant="secondary" className="text-xs">{plan}</Badge> plan.
            Upgrade to unlock more.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 mt-4">
          {PLANS.map((p) => (
            <div
              key={p.id}
              className={`relative rounded-xl border p-4 transition-all hover:shadow-md ${
                p.popular ? 'border-purple-500/50 bg-purple-500/5' : 'border-border'
              }`}
            >
              {p.popular && (
                <Badge className="absolute -top-2 right-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px]">
                  POPULAR
                </Badge>
              )}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg bg-gradient-to-br ${p.color}`}>
                      <p.icon className="h-4 w-4 text-white" />
                    </div>
                    <h3 className="font-semibold">{p.name}</h3>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {p.features.map((f) => (
                      <li key={f} className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <span className="text-green-500">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold">{p.price}</div>
                  <div className="text-xs text-muted-foreground">{p.period}</div>
                  <Button
                    size="sm"
                    className="mt-2"
                    disabled={loading !== null}
                    onClick={() => openBillingSelector(p.id as 'pro' | 'premium')}
                  >
                    {loading === p.id ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : null}
                    Choose Billing
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={!!planForBilling} onOpenChange={(next) => { if (!next) closeBillingSelector(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose billing cycle</DialogTitle>
          <DialogDescription>
            Select your billing cycle for the {planForBilling === 'premium' ? 'Premium' : 'Pro'} plan.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {cycleOptions.map((option) => {
            const isSelected = billingCycle === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setBillingCycle(option.id)}
                className={`w-full rounded-xl border p-4 text-left transition-all ${isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/40'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{option.title} — {option.priceText}</p>
                    <p className="text-xs text-muted-foreground mt-1">{option.helper}</p>
                  </div>
                  {isSelected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </div>
              </button>
            );
          })}
        </div>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={closeBillingSelector}>
            Cancel
          </button>
          {billingCycle && (
            <Button onClick={handleUpgrade} disabled={loading !== null}>
              {loading === planForBilling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Continue
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
