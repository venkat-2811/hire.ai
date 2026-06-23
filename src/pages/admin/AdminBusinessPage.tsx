import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi, type AdminBillingTransaction } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { getAdminDisplayName, getAdminDisplayEmail, getAdminDisplayCompany } from '@/lib/adminIdentity';
import { DeltaIndicator } from './components/AdminHelpers';

const REFRESH_INTERVAL_MS = 60_000;
const REQUIRED_TRANSACTION_STATUSES = ['paid', 'failed', 'refunded'] as const;
const PLAN_FILTERS = ['free', 'starter', 'growth', 'enterprise'] as const;
const BILLING_PAGE_SIZE = 25;
const PLAN_RECRUITERS_PAGE_SIZE = 20;

export default function AdminBusinessPage() {
  const [recruiterFilter, setRecruiterFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [billingUserFilter, setBillingUserFilter] = useState('');
  const [billingCompanyFilter, setBillingCompanyFilter] = useState('');
  const [billingSearchFilter, setBillingSearchFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [billingOffset, setBillingOffset] = useState(0);

  const [planDetailsOpen, setPlanDetailsOpen] = useState(false);
  const [planDetailsPlan, setPlanDetailsPlan] = useState('');
  const [planDetailsSearch, setPlanDetailsSearch] = useState('');
  const [planDetailsOffset, setPlanDetailsOffset] = useState(0);

  const overviewQuery = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => adminApi.overview(),
    retry: false,
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const planCountsQuery = useQuery({
    queryKey: ['admin-plan-counts'],
    queryFn: () => adminApi.subscriptionPlanCounts(),
    retry: false,
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const recruitersQuery = useQuery({
    queryKey: ['admin-recruiter-counts'],
    queryFn: () => adminApi.recruiterCandidateCounts({ limit: 200, offset: 0 }),
    retry: false,
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const transactionsQuery = useQuery({
    queryKey: [
      'admin-billing-transactions',
      recruiterFilter,
      planFilter,
      statusFilter,
      billingUserFilter,
      billingCompanyFilter,
      billingSearchFilter,
      startDate,
      endDate,
      billingOffset,
    ],
    queryFn: () =>
      adminApi.billingTransactions({
        recruiter_user_id: recruiterFilter || undefined,
        plan: planFilter || undefined,
        status: statusFilter || undefined,
        user: billingUserFilter || undefined,
        company: billingCompanyFilter || undefined,
        search: billingSearchFilter || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        limit: BILLING_PAGE_SIZE,
        offset: billingOffset,
      }),
    retry: false,
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const planRecruitersQuery = useQuery({
    queryKey: ['admin-plan-recruiters', planDetailsPlan, planDetailsSearch, planDetailsOffset],
    queryFn: () =>
      adminApi.planRecruiters({
        plan: planDetailsPlan,
        search: planDetailsSearch || undefined,
        limit: PLAN_RECRUITERS_PAGE_SIZE,
        offset: planDetailsOffset,
      }),
    enabled: planDetailsOpen && !!planDetailsPlan,
    retry: false,
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const overview = overviewQuery.data;
  const recruiters = recruitersQuery.data?.recruiters ?? [];
  const transactions = transactionsQuery.data?.transactions ?? [];
  const transactionsTotal = transactionsQuery.data?.total ?? 0;
  const transactionsSummary = transactionsQuery.data?.summary;
  const planRecruiters = planRecruitersQuery.data?.recruiters ?? [];
  const planRecruitersTotal = planRecruitersQuery.data?.total ?? 0;

  const sortedPlanCounts = useMemo(() => {
    const byPlan = planCountsQuery.data?.by_plan ?? {};
    return Object.entries(byPlan).sort((a, b) => b[1] - a[1]);
  }, [planCountsQuery.data]);

  useEffect(() => {
    setBillingOffset(0);
  }, [
    recruiterFilter,
    planFilter,
    statusFilter,
    billingUserFilter,
    billingCompanyFilter,
    billingSearchFilter,
    startDate,
    endDate,
  ]);

  useEffect(() => {
    setPlanDetailsOffset(0);
  }, [planDetailsSearch, planDetailsPlan]);

  const openPlanDetails = (plan: string) => {
    setPlanDetailsPlan(plan);
    setPlanDetailsSearch('');
    setPlanDetailsOffset(0);
    setPlanDetailsOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Recruiters</CardDescription>
            <CardTitle className="text-2xl">{overview?.recruiters_total ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Paid Transactions (7d)</CardDescription>
            <CardTitle className="text-2xl inline-flex items-center">
              {overview?.billing_paid_transactions_last_7d ?? 0}
              {overview && (
                <DeltaIndicator
                  current={overview.billing_paid_transactions_last_7d}
                  previous={overview.billing_paid_transactions_prev_7d}
                  label="vs prev"
                />
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Revenue (7d)</CardDescription>
            <CardTitle className="text-2xl inline-flex items-center">
              {overview?.billing_paid_amount_last_7d ?? 0}
              {overview && (
                <DeltaIndicator
                  current={overview.billing_paid_amount_last_7d}
                  previous={overview.billing_paid_amount_prev_7d}
                  label="vs prev"
                />
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Snapshot Time</CardDescription>
            <CardTitle className="text-sm mt-1">
              {overview?.generated_at ? new Date(overview.generated_at).toLocaleString() : '—'}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Recruiters by Subscription Plan</CardTitle>
            <CardDescription>Distribution of recruiter accounts by current plan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {sortedPlanCounts.map(([plan, count]) => (
              <div key={plan} className="flex items-center justify-between border rounded-md px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium capitalize">{plan}</span>
                  <Badge>{count}</Badge>
                </div>
                <Button size="sm" variant="outline" onClick={() => openPlanDetails(plan)}>
                  View All
                </Button>
              </div>
            ))}
            {!sortedPlanCounts.length && <div className="text-sm text-muted-foreground">No plan data available.</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Billing Period Summary</CardTitle>
            <CardDescription>Current vs. previous 7-day billing window.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="border rounded-md p-3 text-center">
                <div className="text-xs text-muted-foreground mb-1">This Week</div>
                <div className="text-2xl font-bold">{overview?.billing_paid_transactions_last_7d ?? 0}</div>
                <div className="text-xs text-muted-foreground">transactions</div>
                <div className="text-sm font-semibold mt-1">{overview?.billing_paid_amount_last_7d ?? 0}</div>
                <div className="text-xs text-muted-foreground">revenue</div>
              </div>
              <div className="border rounded-md p-3 text-center">
                <div className="text-xs text-muted-foreground mb-1">Previous Week</div>
                <div className="text-2xl font-bold">{overview?.billing_paid_transactions_prev_7d ?? 0}</div>
                <div className="text-xs text-muted-foreground">transactions</div>
                <div className="text-sm font-semibold mt-1">{overview?.billing_paid_amount_prev_7d ?? 0}</div>
                <div className="text-xs text-muted-foreground">revenue</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Billing Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Billing Transactions</CardTitle>
          <CardDescription>
            Filters include recruiter, plan, date range, and status ({REQUIRED_TRANSACTION_STATUSES.join(', ')}).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={recruiterFilter}
              onChange={(e) => setRecruiterFilter(e.target.value)}
            >
              <option value="">All recruiters</option>
              {recruiters.map((r) => (
                <option key={r.recruiter_user_id} value={r.recruiter_user_id}>
                  {getAdminDisplayName(r)} • {getAdminDisplayEmail(r.email)}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
            >
              <option value="">All plans</option>
              {PLAN_FILTERS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              {REQUIRED_TRANSACTION_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <Input
              placeholder="User name/email"
              value={billingUserFilter}
              onChange={(e) => setBillingUserFilter(e.target.value)}
            />
            <Input
              placeholder="Company"
              value={billingCompanyFilter}
              onChange={(e) => setBillingCompanyFilter(e.target.value)}
            />
            <Input
              placeholder="Search invoice/ref/plan/status"
              value={billingSearchFilter}
              onChange={(e) => setBillingSearchFilter(e.target.value)}
            />
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            <Button
              variant="outline"
              onClick={() => {
                setRecruiterFilter('');
                setPlanFilter('');
                setStatusFilter('');
                setBillingUserFilter('');
                setBillingCompanyFilter('');
                setBillingSearchFilter('');
                setStartDate('');
                setEndDate('');
                setBillingOffset(0);
              }}
            >
              Reset
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Card className="border-dashed">
              <CardContent className="py-3">
                <div className="text-xs text-muted-foreground">Filtered Transactions</div>
                <div className="text-lg font-semibold">{transactionsSummary?.transactions_count ?? 0}</div>
              </CardContent>
            </Card>
            <Card className="border-dashed">
              <CardContent className="py-3">
                <div className="text-xs text-muted-foreground">Filtered Total Amount</div>
                <div className="text-lg font-semibold">{transactionsSummary?.total_amount ?? 0}</div>
              </CardContent>
            </Card>
            <Card className="border-dashed">
              <CardContent className="py-3">
                <div className="text-xs text-muted-foreground">Filtered Paid Transactions</div>
                <div className="text-lg font-semibold">{transactionsSummary?.paid_transactions_count ?? 0}</div>
              </CardContent>
            </Card>
            <Card className="border-dashed">
              <CardContent className="py-3">
                <div className="text-xs text-muted-foreground">Filtered Paid Amount</div>
                <div className="text-lg font-semibold">{transactionsSummary?.paid_amount ?? 0}</div>
              </CardContent>
            </Card>
          </div>

          {transactionsQuery.isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading transactions…
            </div>
          )}

          <div className="space-y-3 max-h-[420px] overflow-auto">
            {(transactions as AdminBillingTransaction[]).map((tx) => (
              <div key={tx.id} className="border rounded-md p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm">{getAdminDisplayName({ full_name: tx.recruiter_full_name })}</div>
                    <div className="text-xs text-muted-foreground">{getAdminDisplayEmail(tx.recruiter_email)}</div>
                    <div className="text-xs text-muted-foreground">{getAdminDisplayCompany(tx.recruiter_company_name)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">{tx.plan}</Badge>
                    <Badge className="capitalize">{tx.status}</Badge>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">Invoice: {tx.id}</div>
                <div className="text-xs text-muted-foreground">Created: {new Date(tx.created_at).toLocaleString()}</div>
                <div className="text-sm mt-2">Total: {tx.total}</div>
              </div>
            ))}
            {!transactions.length && !transactionsQuery.isLoading && (
              <div className="text-sm text-muted-foreground">No transactions match the selected filters.</div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-xs text-muted-foreground">
              Showing {transactionsTotal === 0 ? 0 : billingOffset + 1}–{Math.min(billingOffset + BILLING_PAGE_SIZE, transactionsTotal)} of {transactionsTotal}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={billingOffset === 0}
                onClick={() => setBillingOffset(Math.max(0, billingOffset - BILLING_PAGE_SIZE))}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={billingOffset + BILLING_PAGE_SIZE >= transactionsTotal}
                onClick={() => setBillingOffset(billingOffset + BILLING_PAGE_SIZE)}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={planDetailsOpen} onOpenChange={setPlanDetailsOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="capitalize">{planDetailsPlan} Plan Recruiters</DialogTitle>
            <DialogDescription>
              Recruiters currently subscribed to the {planDetailsPlan || 'selected'} plan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Input
                placeholder="Search name/email/company"
                value={planDetailsSearch}
                onChange={(e) => setPlanDetailsSearch(e.target.value)}
              />
              <Badge variant="outline">{planRecruitersTotal} recruiters</Badge>
            </div>

            {planRecruitersQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading recruiters…
              </div>
            ) : !planRecruiters.length ? (
              <div className="text-sm text-muted-foreground">No recruiters found for this plan.</div>
            ) : (
              <div className="overflow-auto max-h-[420px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Subscription Start</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {planRecruiters.map((item) => (
                      <TableRow key={`${item.recruiter_user_id}-${item.email}`}>
                        <TableCell className="font-medium">{getAdminDisplayName(item)}</TableCell>
                        <TableCell>{getAdminDisplayEmail(item.email)}</TableCell>
                        <TableCell>{getAdminDisplayCompany(item.company_name)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {item.subscription_start_date ? new Date(item.subscription_start_date).toLocaleDateString() : 'Not Provided'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{item.subscription_status || 'active'}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex items-center justify-between border-t pt-3">
              <div className="text-xs text-muted-foreground">
                Showing {planRecruitersTotal === 0 ? 0 : planDetailsOffset + 1}–{Math.min(planDetailsOffset + PLAN_RECRUITERS_PAGE_SIZE, planRecruitersTotal)} of {planRecruitersTotal}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={planDetailsOffset === 0}
                  onClick={() => setPlanDetailsOffset(Math.max(0, planDetailsOffset - PLAN_RECRUITERS_PAGE_SIZE))}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={planDetailsOffset + PLAN_RECRUITERS_PAGE_SIZE >= planRecruitersTotal}
                  onClick={() => setPlanDetailsOffset(planDetailsOffset + PLAN_RECRUITERS_PAGE_SIZE)}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
