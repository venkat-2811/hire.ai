import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { billingApi, type BillingInvoice } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Receipt, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const formatCurrency = (amount: number, currency: string) => {
  if (amount === 0) return currency === 'INR' ? '₹0' : '$0';
  return currency === 'INR'
    ? `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
    : `$${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};

export default function InvoicesHistoryPage() {
  const invoicesQuery = useQuery({
    queryKey: ['billing-invoices'],
    queryFn: () => billingApi.invoices(),
  });

  const invoices = (invoicesQuery.data || []) as BillingInvoice[];

  if (invoicesQuery.isLoading) {
    return (
      <DashboardLayout>
        <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-medium animate-pulse">Loading invoice history...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link to="/billing">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Full Invoice History</h1>
            <p className="text-sm text-muted-foreground mt-1">View all your completed Stripe invoice transactions.</p>
          </div>
        </div>

        <Card className="border-border shadow-md">
          <CardHeader className="border-b pb-4">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Receipt className="h-5 w-5 text-primary" /> All Invoices
            </CardTitle>
            <CardDescription>Complete subscription billing records.</CardDescription>
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
                      const currency = String(invoice.metadata?.currency || 'USD').toUpperCase();
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
