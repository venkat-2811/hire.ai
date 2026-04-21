import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { billingApi, type BillingInvoice } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Wallet, Receipt, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function BillingPage() {
  const [topupAmount, setTopupAmount] = useState<number>(25);
  const [busy, setBusy] = useState<string | null>(null);

  const usageQuery = useQuery({
    queryKey: ['billing-usage'],
    queryFn: () => billingApi.usage(),
    refetchInterval: 60_000,
  });

  const invoicesQuery = useQuery({
    queryKey: ['billing-invoices'],
    queryFn: () => billingApi.invoices(),
  });

  const usage = usageQuery.data;
  const invoices = (invoicesQuery.data || []) as BillingInvoice[];

  const consumedPercent = useMemo(() => {
    if (!usage) return 0;
    if (usage.deposit_amount <= 0) return 0;
    const consumed = Math.max(0, usage.deposit_amount - usage.wallet_balance);
    return Math.min(100, Math.round((consumed / usage.deposit_amount) * 100));
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

  const handlePayInvoice = async (invoiceId: string) => {
    setBusy(`invoice-${invoiceId}`);
    try {
      const res = await billingApi.payInvoice(invoiceId);
      if (res.already_paid) {
        toast.success('Invoice is already paid');
        return;
      }
      if (res.checkout_url) {
        window.location.href = res.checkout_url;
        return;
      }
      toast.success('Invoice paid successfully');
      await Promise.all([usageQuery.refetch(), invoicesQuery.refetch()]);
    } catch (e: any) {
      toast.error(e.message || 'Failed to pay invoice');
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
          <p className="text-sm text-muted-foreground mt-1">Manage wallet, plan and invoices.</p>
        </div>

        {usage?.status === 'paused' && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium">Services are paused</p>
                  <p className="text-sm text-muted-foreground">Pay pending invoices or add wallet balance to resume services.</p>
                </div>
              </div>
              <Button onClick={handleTopup} disabled={busy === 'topup'}>
                {busy === 'topup' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Pay Now
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" /> Wallet</CardTitle>
              <CardDescription>
                Plan: <span className="uppercase font-medium">{usage?.plan}</span> | Status: <span className="font-medium">{usage?.status}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span>Wallet Balance</span>
                <span className="font-semibold">${Number(usage?.wallet_balance || 0).toFixed(2)}</span>
              </div>
              <Progress value={consumedPercent} />
              <div className="text-xs text-muted-foreground">
                Deposit: ${Number(usage?.deposit_amount || 0).toFixed(2)} | Consumed: {consumedPercent}%
              </div>

              <div className="grid sm:grid-cols-2 gap-3 pt-2">
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upgrade</CardTitle>
              <CardDescription>Choose a plan with higher limits and wallet coverage.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" variant="outline" onClick={() => handleSubscribe('pro')} disabled={busy === 'subscribe-pro'}>
                {busy === 'subscribe-pro' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Upgrade to Pro ($36.13)
              </Button>
              <Button className="w-full" onClick={() => handleSubscribe('premium')} disabled={busy === 'subscribe-premium'}>
                {busy === 'subscribe-premium' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Upgrade to Premium ($96.37)
              </Button>
            </CardContent>
          </Card>
        </div>

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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> Invoice History</CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices found.</p>
            ) : (
              <div className="space-y-2">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between border rounded-md px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">Invoice #{invoice.id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">Due {new Date(invoice.due_date).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>{invoice.status}</Badge>
                      <span className="text-sm font-medium">${Number(invoice.total || 0).toFixed(2)}</span>
                      {invoice.status !== 'paid' && (
                        <Button size="sm" onClick={() => handlePayInvoice(invoice.id)} disabled={busy === `invoice-${invoice.id}`}>
                          {busy === `invoice-${invoice.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Pay'}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
