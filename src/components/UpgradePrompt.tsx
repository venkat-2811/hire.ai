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
import { Sparkles, Zap, Crown, Loader2 } from 'lucide-react';
import { subscriptionApi } from '@/lib/api';
import { toast } from 'sonner';

declare global {
  interface Window {
    Razorpay: any;
  }
}

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
    price: '₹50',
    period: '/month',
    icon: Zap,
    color: 'from-blue-500 to-cyan-500',
    features: ['Up to 15 job roles', '100+ technical assessments', '100+ interviews', 'Priority support'],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '₹75',
    period: '/month',
    icon: Crown,
    color: 'from-purple-500 to-pink-500',
    features: ['50+ job roles (unlimited)', 'Unlimited assessments', 'Unlimited interviews', 'Dedicated support'],
    popular: true,
  },
];

export function UpgradePrompt({ open, onClose, resource, current, limit, plan }: UpgradePromptProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleUpgrade = async (targetPlan: string) => {
    setLoading(targetPlan);
    try {
      const order = await subscriptionApi.createOrder(targetPlan);

      const options = {
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'Hire.AI',
        description: `${targetPlan === 'pro' ? 'Pro' : 'Premium'} Plan Subscription`,
        order_id: order.order_id,
        handler: async (response: any) => {
          try {
            await subscriptionApi.verify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan: targetPlan,
            });
            toast.success(`${targetPlan === 'pro' ? 'Pro' : 'Premium'} plan activated! 🎉`);
            onClose();
            window.location.reload();
          } catch {
            toast.error('Payment verification failed. Please contact support.');
          }
        },
        theme: { color: '#4F46E5' },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create payment order');
    } finally {
      setLoading(null);
    }
  };

  return (
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
                    onClick={() => handleUpgrade(p.id)}
                  >
                    {loading === p.id ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : null}
                    Upgrade
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
