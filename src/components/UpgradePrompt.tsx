import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Zap, Crown, Loader2, ArrowLeft } from 'lucide-react';
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
    cycleOptions: [
      { id: 'pro', label: 'Monthly — $10 / month' },
      { id: 'pro_yearly', label: 'Yearly — $100 / year', suffix: '(save ~17%)' },
    ]
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
    cycleOptions: [
      { id: 'premium', label: 'Monthly — $15 / month' },
      { id: 'premium_yearly', label: 'Yearly — $150 / year', suffix: '(save ~17%)' },
    ]
  },
];

export function UpgradePrompt({ open, onClose, resource, current, limit, plan }: UpgradePromptProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [selectedPlanBase, setSelectedPlanBase] = useState<typeof PLANS[0] | null>(null);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSelectedPlanBase(null);
      setSelectedCycleId(null);
      onClose();
    }
  };

  const handleContinueData = async () => {
    if (!selectedCycleId) return;
    setLoading(selectedCycleId);
    try {
      const session = await subscriptionApi.createOrder(selectedCycleId);
      window.location.href = session.url;
    } catch (err: any) {
      toast.error(err.message || 'Failed to create payment session');
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {!selectedPlanBase ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Upgrade Your Plan
              </DialogTitle>
              <DialogDescription>
                You've used <span className="font-semibold text-foreground">{current}/{limit > 900000 ? '∞' : limit}</span>{' '}
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
                        onClick={() => setSelectedPlanBase(p)}
                      >
                        Choose Plan
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-center">
              <Button variant="link" onClick={() => handleOpenChange(false)} className="text-muted-foreground text-sm">Cancel</Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="-ml-2 h-8 w-8" onClick={() => { setSelectedPlanBase(null); setSelectedCycleId(null); }}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                Choose Billing Cycle
              </DialogTitle>
              <DialogDescription>
                Select your billing cycle for the <span className="font-semibold text-foreground">{selectedPlanBase.name}</span> plan.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 mt-4">
              {selectedPlanBase.cycleOptions.map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => setSelectedCycleId(opt.id)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedCycleId === opt.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{opt.label}</span>
                    {opt.suffix && (
                      <Badge variant="secondary" className="text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400">
                        {opt.suffix}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-3">
              {selectedCycleId && (
                <Button className="w-full" disabled={loading !== null} onClick={handleContinueData}>
                  {loading !== null ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Continue to Checkout
                </Button>
              )}
              <Button variant="outline" className="w-full" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
