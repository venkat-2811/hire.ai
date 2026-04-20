import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRequireAuth } from '@/hooks/useAuth';
import { useCandidateAnalytics, useDashboardStats, useHiringTrends } from '@/hooks/useAnalytics';
import { Loader2 } from 'lucide-react';
import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Funnel,
  FunnelChart,
  LabelList,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartContainer, ChartLegendContent, ChartTooltipContent } from '@/components/ui/chart';

export default function AnalyticsPage() {
  const { loading: authLoading } = useRequireAuth();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: candidates, isLoading: candidatesLoading } = useCandidateAnalytics();
  const { data: trends, isLoading: trendsLoading } = useHiringTrends(30);

  const recommendationData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of candidates || []) {
      const key = row.recommendation || 'unknown';
      counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [candidates]);

  const interviewStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of candidates || []) {
      const key = row.interview_status || 'not_started';
      counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }, [candidates]);

  const scoreDistributionData = useMemo(() => {
    const bucketLabels = ['0-20', '21-40', '41-60', '61-80', '81-100'];
    const buckets = bucketLabels.map((label) => ({ bucket: label, ats: 0, overall: 0 }));

    const bucketIndex = (score: number) => {
      if (score <= 20) return 0;
      if (score <= 40) return 1;
      if (score <= 60) return 2;
      if (score <= 80) return 3;
      return 4;
    };

    for (const row of candidates || []) {
      if (typeof row.ats_score === 'number') {
        buckets[bucketIndex(row.ats_score)].ats += 1;
      }
      if (typeof row.overall_score === 'number') {
        buckets[bucketIndex(row.overall_score)].overall += 1;
      }
    }

    return buckets;
  }, [candidates]);

  const funnelData = useMemo(() => {
    const total = (candidates || []).length;
    const withAts = (candidates || []).filter((c) => typeof c.ats_score === 'number').length;
    const withAssessment = (candidates || []).filter((c) => typeof c.technical_score === 'number').length;
    const withInterview = (candidates || []).filter((c) => typeof c.overall_score === 'number').length;
    const strongOrHire = (candidates || []).filter((c) => c.recommendation === 'strong_hire' || c.recommendation === 'hire').length;

    return [
      { name: 'Applied', value: total },
      { name: 'ATS Screened', value: withAts },
      { name: 'Assessment Scored', value: withAssessment },
      { name: 'Interview Scored', value: withInterview },
      { name: 'Hire / Strong Hire', value: strongOrHire },
    ];
  }, [candidates]);

  const trendSeries = useMemo(() => {
    return (trends?.trends || []).map((t) => ({
      date: t.date,
      screenings: t.screenings,
      shortlisted: t.shortlisted,
      interviews_completed: t.interviews_completed,
      average_score: t.average_score,
    }));
  }, [trends]);

  const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#64748b'];

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
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Pipeline Trends (30 days)</CardTitle>
              <CardDescription>Volume + score quality over time</CardDescription>
            </CardHeader>
            <CardContent>
              {(trendSeries || []).length === 0 ? (
                <div className="text-sm text-muted-foreground">No trend data yet.</div>
              ) : (
                <ChartContainer
                  config={{
                    screenings: { label: 'Screenings', color: 'hsl(var(--chart-1))' },
                    shortlisted: { label: 'Shortlisted', color: 'hsl(var(--chart-2))' },
                    interviews_completed: { label: 'Interviews Completed', color: 'hsl(var(--chart-3))' },
                    average_score: { label: 'Avg Score', color: 'hsl(var(--chart-4))' },
                  }}
                  className="h-[320px]"
                >
                  <ComposedChart data={trendSeries} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis yAxisId="left" tickLine={false} axisLine={false} />
                    <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Legend content={<ChartLegendContent />} />
                    <Bar yAxisId="left" dataKey="screenings" stackId="a" fill="var(--color-screenings)" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="left" dataKey="shortlisted" stackId="a" fill="var(--color-shortlisted)" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="left" dataKey="interviews_completed" stackId="a" fill="var(--color-interviews_completed)" radius={[4, 4, 0, 0]} />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="average_score"
                      stroke="var(--color-average_score)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Hiring Funnel</CardTitle>
              <CardDescription>Conversion through each stage</CardDescription>
            </CardHeader>
            <CardContent>
              {(funnelData || []).every((s) => s.value === 0) ? (
                <div className="text-sm text-muted-foreground">No candidate data yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <FunnelChart>
                    <Tooltip />
                    <Funnel dataKey="value" data={funnelData} isAnimationActive={false}>
                      <LabelList position="right" dataKey="name" fill="hsl(var(--foreground))" />
                      <LabelList position="inside" dataKey="value" fill="#fff" />
                    </Funnel>
                  </FunnelChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Recommendation Mix</CardTitle>
              <CardDescription>Decision distribution from interview evaluations</CardDescription>
            </CardHeader>
            <CardContent>
              {recommendationData.length === 0 ? (
                <div className="text-sm text-muted-foreground">No recommendations yet.</div>
              ) : (
                <ChartContainer
                  config={Object.fromEntries(
                    recommendationData.map((r, idx) => [r.name, { label: r.name, color: PIE_COLORS[idx % PIE_COLORS.length] }]),
                  )}
                  className="h-[320px]"
                >
                  <PieChart>
                    <Tooltip content={<ChartTooltipContent nameKey="name" />} />
                    <Legend content={<ChartLegendContent nameKey="name" />} />
                    <Pie data={recommendationData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={110}>
                      {recommendationData.map((entry, index) => (
                        <Cell key={`cell-${entry.name}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Interview Status Breakdown</CardTitle>
              <CardDescription>Operational view of interview progress</CardDescription>
            </CardHeader>
            <CardContent>
              {interviewStatusData.length === 0 ? (
                <div className="text-sm text-muted-foreground">No interview sessions yet.</div>
              ) : (
                <ChartContainer
                  config={{
                    count: { label: 'Candidates', color: 'hsl(var(--chart-1))' },
                  }}
                  className="h-[320px]"
                >
                  <BarChart data={interviewStatusData} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="status" tickLine={false} axisLine={false} interval={0} height={60} />
                    <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<ChartTooltipContent nameKey="status" />} />
                    <Bar dataKey="count" fill="var(--color-count)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Score Distributions</CardTitle>
            <CardDescription>Quality distribution across ATS and final interview scores</CardDescription>
          </CardHeader>
          <CardContent>
            {(candidates || []).length === 0 ? (
              <div className="text-sm text-muted-foreground">No scoring data yet.</div>
            ) : (
              <ChartContainer
                config={{
                  ats: { label: 'ATS', color: 'hsl(var(--chart-2))' },
                  overall: { label: 'Final Interview', color: 'hsl(var(--chart-4))' },
                }}
                className="h-[320px]"
              >
                <BarChart data={scoreDistributionData} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="bucket" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Legend content={<ChartLegendContent />} />
                  <Bar dataKey="ats" fill="var(--color-ats)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="overall" fill="var(--color-overall)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

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
      </div>
    </DashboardLayout>
  );
}
