import { useQuery } from '@tanstack/react-query';
import { adminApi, type AdminLoginEvent } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, UserCheck, Clock } from 'lucide-react';
import { DeltaIndicator, PIICell } from './components/AdminHelpers';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const REFRESH_INTERVAL_MS = 60_000;

export default function AdminOperationalPage() {
  const activityQuery = useQuery({
    queryKey: ['admin-activity-summary'],
    queryFn: () => adminApi.activitySummary(),
    retry: false,
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const recentLoginsQuery = useQuery({
    queryKey: ['admin-recent-logins'],
    queryFn: () => adminApi.recentLogins(50),
    retry: false,
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const activity = activityQuery.data;
  const recentLogins = recentLoginsQuery.data?.logins ?? [];

  return (
    <div className="space-y-6">
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
            <p className="text-xs text-muted-foreground">Active in last 15 minutes</p>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Logins Today
              </CardDescription>
              <Button variant="ghost" size="sm" asChild className="h-6 px-2 text-xs">
                <Link to="/admin/logins-today">View All</Link>
              </Button>
            </div>
            <CardTitle className="text-2xl mt-1">
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
            <CardTitle className="text-2xl inline-flex items-center mt-1">
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
            <p className="text-xs text-muted-foreground">Login events, last 7 days</p>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Snapshot</CardDescription>
            <CardTitle className="text-sm mt-1">
              {activity?.generated_at ? new Date(activity.generated_at).toLocaleString() : '—'}
            </CardTitle>
            <p className="text-xs text-muted-foreground">Auto-refreshes every 1 min</p>
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
            Up to 50 recent login events. Name and email are sourced from recruiter profiles.
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
            <div className="max-h-[480px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Login Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(recentLogins as AdminLoginEvent[]).map((login) => (
                    <TableRow key={login.id}>
                      <TableCell className="font-medium text-sm">
                        {login.full_name || login.first_name || 'Not Provided'}
                      </TableCell>
                      <TableCell className="text-sm">
                        <PIICell value={login.email === 'Not Provided' ? null : login.email} type="email" />
                        {(!login.email || login.email === 'Not Provided') && (
                          <span className="text-xs text-muted-foreground italic">Not Provided</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {login.company_name === 'Not Provided' ? (
                          <span className="italic">Not Provided</span>
                        ) : (
                          login.company_name || <span className="italic">Not Provided</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(login.logged_in_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
