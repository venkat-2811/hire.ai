import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth } from '@/hooks/useAuth';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import {
  adminApi,
  type AdminBillingTransaction,
  type AdminRecruiterCandidateCount,
  type AdminLoginEvent,
  type AdminCandidateEntry,
} from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Loader2,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  EyeOff,
  Users,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Clock,
  UserCheck,
} from 'lucide-react';

const REQUIRED_TRANSACTION_STATUSES = ['paid', 'failed', 'refunded'] as const;
const PLAN_FILTERS = ['free', 'starter', 'growth', 'scale', 'enterprise'] as const;
const REFRESH_INTERVAL_MS = 30_000;
const CANDIDATES_PAGE_SIZE = 25;

// ── Helpers ────────────────────────────────────────────────────────────────

function DeltaIndicator({ current, previous, label }: { current: number; previous: number; label?: string }) {
  if (previous === 0 && current === 0) return null;
  const diff = current - previous;
  const pct = previous > 0 ? Math.round((diff / previous) * 100) : diff > 0 ? 100 : 0;

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium ml-2">
      {diff > 0 ? (
        <TrendingUp className="h-3 w-3 text-emerald-500" />
      ) : diff < 0 ? (
        <TrendingDown className="h-3 w-3 text-red-400" />
      ) : (
        <Minus className="h-3 w-3 text-muted-foreground" />
      )}
      <span className={diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-red-400' : 'text-muted-foreground'}>
        {diff > 0 ? '+' : ''}{diff}{previous > 0 ? ` (${pct > 0 ? '+' : ''}${pct}%)` : ''}
      </span>
      {label && <span className="text-muted-foreground">{label}</span>}
    </span>
  );
}

/** Masks a string for PII display, e.g. "john@acme.com" → "j•••@a•••.com" */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '•••••';
  const domParts = domain.split('.');
  const maskedLocal = local.length > 1 ? local[0] + '•••' : '•';
  const maskedDomain = domParts[0].length > 1 ? domParts[0][0] + '•••' : '•';
  return `${maskedLocal}@${maskedDomain}.${domParts.slice(1).join('.')}`;
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return '•••••';
  return '•••••' + phone.slice(-4);
}

/** Click-to-reveal PII cell */
function PIICell({ value, type }: { value: string | null | undefined; type: 'email' | 'phone' }) {
  const [revealed, setRevealed] = useState(false);

  if (!value) return <span className="text-muted-foreground text-xs">—</span>;

  const masked = type === 'email' ? maskEmail(value) : maskPhone(value);

  return (
    <span className="inline-flex items-center gap-1.5 group">
      <span className={`font-mono text-xs ${!revealed ? 'text-muted-foreground' : 'text-amber-300'}`}>
        {revealed ? value : masked}
      </span>
      <button
        type="button"
        onClick={() => setRevealed(!revealed)}
        className="opacity-60 hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
        title={revealed ? 'Hide' : 'Reveal'}
      >
        {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      </button>
    </span>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const { loading: authLoading } = useRequireAuth();
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();

  // Billing filters (Business tab)
  const [recruiterFilter, setRecruiterFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Candidates pagination (People tab)
  const [candidatesOffset, setCandidatesOffset] = useState(0);

  useEffect(() => {
    if (!authLoading && !adminLoading && !isAdmin) {
      navigate('/dashboard', { replace: true });
    }
  }, [authLoading, adminLoading, isAdmin, navigate]);

  // ── Queries ──────────────────────────────────────────────────────────────

  const overviewQuery = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => adminApi.overview(),
    enabled: isAdmin,
    retry: false,
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const activityQuery = useQuery({
    queryKey: ['admin-activity-summary'],
    queryFn: () => adminApi.activitySummary(),
    enabled: isAdmin,
    retry: false,
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const recentLoginsQuery = useQuery({
    queryKey: ['admin-recent-logins'],
    queryFn: () => adminApi.recentLogins(50),
    enabled: isAdmin,
    retry: false,
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const recruitersQuery = useQuery({
    queryKey: ['admin-recruiter-counts'],
    queryFn: () => adminApi.recruiterCandidateCounts({ limit: 200, offset: 0 }),
    enabled: isAdmin,
    retry: false,
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const planCountsQuery = useQuery({
    queryKey: ['admin-plan-counts'],
    queryFn: () => adminApi.subscriptionPlanCounts(),
    enabled: isAdmin,
    retry: false,
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const transactionsQuery = useQuery({
    queryKey: ['admin-billing-transactions', recruiterFilter, planFilter, statusFilter, startDate, endDate],
    queryFn: () =>
      adminApi.billingTransactions({
        recruiter_user_id: recruiterFilter || undefined,
        plan: planFilter || undefined,
        status: statusFilter || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        limit: 200,
        offset: 0,
      }),
    enabled: isAdmin,
    retry: false,
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const candidatesQuery = useQuery({
    queryKey: ['admin-candidates-list', candidatesOffset],
    queryFn: () => adminApi.candidatesList({ limit: CANDIDATES_PAGE_SIZE, offset: candidatesOffset }),
    enabled: isAdmin,
    retry: false,
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const recruiters = recruitersQuery.data?.recruiters ?? [];
  const transactions = transactionsQuery.data?.transactions ?? [];
  const recentLogins = recentLoginsQuery.data?.logins ?? [];
  const candidates = candidatesQuery.data?.candidates ?? [];
  const candidatesTotal = candidatesQuery.data?.total ?? 0;

  const sortedPlanCounts = useMemo(() => {
    const byPlan = planCountsQuery.data?.by_plan ?? {};
    return Object.entries(byPlan).sort((a, b) => b[1] - a[1]);
  }, [planCountsQuery.data]);

  if (authLoading || adminLoading) {
    return (
      <DashboardLayout>
        <div className="p-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const overview = overviewQuery.data;
  const activity = activityQuery.data;

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Secure operational overview for founder accounts.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldAlert className="h-4 w-4" />
            <span>Restricted to 3 admin accounts</span>
          </div>
        </div>

        {/* Tabbed Sections */}
        <Tabs defaultValue="operational" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="operational" className="gap-2">
              <Activity className="h-4 w-4" />
              Operational
            </TabsTrigger>
            <TabsTrigger value="business" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Business
            </TabsTrigger>
            <TabsTrigger value="people" className="gap-2">
              <Users className="h-4 w-4" />
              People
            </TabsTrigger>
          </TabsList>

          {/* ═══════════════════ TAB 1: OPERATIONAL ═══════════════════ */}
          <TabsContent value="operational" className="space-y-6">
            {/* Activity Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5" />
                    Active Now
                  </CardDescription>
                  <CardTitle className="text-2xl">
                    {activityQuery.isLoading ? (
                      <Skeleton className="h-8 w-12" />
                    ) : (
                      activity?.active_now_count ?? 0
                    )}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Open session (no end event)</p>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Logins Today
                  </CardDescription>
                  <CardTitle className="text-2xl">
                    {activityQuery.isLoading ? (
                      <Skeleton className="h-8 w-12" />
                    ) : (
                      activity?.logins_today_unique_users ?? 0
                    )}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Unique users</p>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Logins This Week</CardDescription>
                  <CardTitle className="text-2xl inline-flex items-center">
                    {activityQuery.isLoading ? (
                      <Skeleton className="h-8 w-16" />
                    ) : (
                      <>
                        {activity?.logins_7d_count ?? 0}
                        {activity && (
                          <DeltaIndicator
                            current={activity.logins_7d_count}
                            previous={activity.logins_prev_7d_count}
                            label="vs prev"
                          />
                        )}
                      </>
                    )}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Total events (7d)</p>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Snapshot</CardDescription>
                  <CardTitle className="text-sm">
                    {activity?.generated_at ? new Date(activity.generated_at).toLocaleString() : '—'}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Auto-refreshes every 30s</p>
                </CardHeader>
              </Card>
            </div>

            {/* No-data notice for new deployment */}
            {!activityQuery.isLoading && (activity?.logins_7d_count ?? 0) === 0 && (
              <Card className="border-dashed border-amber-500/40 bg-amber-500/5">
                <CardContent className="py-4">
                  <p className="text-sm text-amber-400">
                    <strong>No login events recorded yet.</strong> Login tracking is new instrumentation —
                    data will accumulate after the Clerk <code>session.created</code> webhook is configured
                    and users begin signing in. There is no historical data to backfill.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Recent Logins Table */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Login Events</CardTitle>
                <CardDescription>
                  Last 50 login events from Clerk session.created webhook.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentLoginsQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : recentLogins.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No login events recorded yet.</div>
                ) : (
                  <div className="max-h-[420px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Time</TableHead>
                          <TableHead>IP</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(recentLogins as AdminLoginEvent[]).map((login) => (
                          <TableRow key={login.id}>
                            <TableCell className="text-sm">
                              {login.email || login.user_id}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {login.company_name || '—'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(login.logged_in_at).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-xs font-mono text-muted-foreground">
                              {login.ip_address || '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════════════ TAB 2: BUSINESS ═══════════════════ */}
          <TabsContent value="business" className="space-y-6">
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
                  <CardTitle className="text-sm">
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
                      <span className="font-medium capitalize">{plan}</span>
                      <Badge>{count}</Badge>
                    </div>
                  ))}
                  {!sortedPlanCounts.length && <div className="text-sm text-muted-foreground">No plan data available.</div>}
                </CardContent>
              </Card>

              {/* Placeholder for plan trend — uses existing data only */}
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
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                  <select
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                    value={recruiterFilter}
                    onChange={(e) => setRecruiterFilter(e.target.value)}
                  >
                    <option value="">All recruiters</option>
                    {recruiters.map((r) => (
                      <option key={r.recruiter_user_id} value={r.recruiter_user_id}>
                        {r.company_name || r.email || r.recruiter_user_id}
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
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  <Button
                    variant="outline"
                    onClick={() => {
                      setRecruiterFilter('');
                      setPlanFilter('');
                      setStatusFilter('');
                      setStartDate('');
                      setEndDate('');
                    }}
                  >
                    Reset
                  </Button>
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
                        <div className="font-semibold text-sm">{tx.recruiter_company_name || tx.recruiter_email || tx.user_id}</div>
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════════════ TAB 3: PEOPLE ═══════════════════ */}
          <TabsContent value="people" className="space-y-6">
            {/* Recruiter Candidate Enrollment — preserved from original */}
            <Card>
              <CardHeader>
                <CardTitle>Recruiter Candidate Enrollment</CardTitle>
                <CardDescription>Candidate count linked to each recruiter via jobs/applications.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 max-h-[420px] overflow-auto">
                {(recruiters as AdminRecruiterCandidateCount[]).map((r) => (
                  <div key={r.recruiter_user_id} className="border rounded-md p-3">
                    <div className="font-semibold text-sm">{r.company_name || r.email || r.recruiter_user_id}</div>
                    <div className="text-xs text-muted-foreground">{r.recruiter_user_id}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline">Enrolled: {r.candidates_enrolled_count}</Badge>
                      <Badge variant="outline">Consumed Counter: {r.candidates_consumed_counter}</Badge>
                      <Badge variant="outline">Plan: {r.subscription_plan || 'free'}</Badge>
                    </div>
                  </div>
                ))}
                {!recruiters.length && <div className="text-sm text-muted-foreground">No recruiter data available.</div>}
              </CardContent>
            </Card>

            {/* All Candidates — NEW, with click-to-reveal PII */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      All Candidates
                      <Badge variant="outline" className="text-amber-400 border-amber-400/40 text-xs font-normal">
                        PII — Access Logged
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Full candidate listing across all recruiters. Email and phone are masked by default —
                      click the eye icon to reveal. Every page view is audit-logged.
                    </CardDescription>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {candidatesTotal} total
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {candidatesQuery.isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : candidates.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No candidates found.</div>
                ) : (
                  <>
                    <div className="overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>
                              <span className="flex items-center gap-1">
                                Email
                                <EyeOff className="h-3 w-3 text-amber-400" />
                              </span>
                            </TableHead>
                            <TableHead>
                              <span className="flex items-center gap-1">
                                Phone
                                <EyeOff className="h-3 w-3 text-amber-400" />
                              </span>
                            </TableHead>
                            <TableHead>Job</TableHead>
                            <TableHead>Recruiter</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(candidates as AdminCandidateEntry[]).map((c) => (
                            <TableRow key={c.candidate_id}>
                              <TableCell className="font-medium text-sm">
                                {c.full_name}
                              </TableCell>
                              <TableCell>
                                <PIICell value={c.email} type="email" />
                              </TableCell>
                              <TableCell>
                                <PIICell value={c.phone} type="phone" />
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                                {c.job_title || '—'}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">
                                {c.recruiter_email || c.recruiter_user_id || '—'}
                              </TableCell>
                              <TableCell>
                                {c.application_status ? (
                                  <Badge variant="outline" className="capitalize text-xs">
                                    {c.application_status}
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                {new Date(c.created_at).toLocaleDateString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <div className="text-xs text-muted-foreground">
                        Showing {candidatesOffset + 1}–{Math.min(candidatesOffset + CANDIDATES_PAGE_SIZE, candidatesTotal)} of {candidatesTotal}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={candidatesOffset === 0}
                          onClick={() => setCandidatesOffset(Math.max(0, candidatesOffset - CANDIDATES_PAGE_SIZE))}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={candidatesOffset + CANDIDATES_PAGE_SIZE >= candidatesTotal}
                          onClick={() => setCandidatesOffset(candidatesOffset + CANDIDATES_PAGE_SIZE)}
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
