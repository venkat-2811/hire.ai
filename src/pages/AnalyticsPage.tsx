import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRequireAuth } from '@/hooks/useAuth';
import { useCandidateAnalytics, useDashboardStats, useHiringTrends } from '@/hooks/useAnalytics';
import { Loader2 } from 'lucide-react';

export default function AnalyticsPage() {
  const { loading: authLoading } = useRequireAuth();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: candidates, isLoading: candidatesLoading } = useCandidateAnalytics();
  const { data: trends, isLoading: trendsLoading } = useHiringTrends(30);

  const isLoading = authLoading || statsLoading || candidatesLoading || trendsLoading;

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
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground mt-1">Overview of your hiring pipeline performance</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Candidates</CardDescription>
              <CardTitle className="text-2xl">{stats?.total_candidates ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Jobs</CardDescription>
              <CardTitle className="text-2xl">{stats?.active_jobs ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Interviews</CardDescription>
              <CardTitle className="text-2xl">{stats?.pending_interviews ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Average Score</CardDescription>
              <CardTitle className="text-2xl">{stats?.average_score ?? 0}%</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Candidate Analytics</CardTitle>
            <CardDescription>Latest ATS and interview outcomes by candidate</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead className="text-right">ATS</TableHead>
                  <TableHead>Interview</TableHead>
                  <TableHead>Recommendation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(candidates || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No analytics yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  (candidates || []).slice(0, 25).map((row) => (
                    <TableRow key={row.candidate_id}>
                      <TableCell className="font-medium">{row.candidate_name}</TableCell>
                      <TableCell>{row.job_title}</TableCell>
                      <TableCell className="text-right">{row.ats_score}%</TableCell>
                      <TableCell>{row.interview_status}</TableCell>
                      <TableCell>{row.recommendation ?? '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>30-day Trends</CardTitle>
            <CardDescription>Daily screening/interview volume and average score</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {(trends?.trends || []).length === 0
                ? 'No trend data yet.'
                : `Data points: ${trends?.trends.length}`}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
