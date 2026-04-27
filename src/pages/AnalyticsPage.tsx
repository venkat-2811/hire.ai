import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRequireAuth } from '@/hooks/useAuth';
import { useCandidateAnalytics, useHiringTrends } from '@/hooks/useAnalytics';
import { Loader2 } from 'lucide-react';
import { useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartContainer, ChartLegendContent, ChartTooltipContent } from '@/components/ui/chart';

export default function AnalyticsPage() {
  const { loading: authLoading } = useRequireAuth();
  const { data: candidates, isLoading: candidatesLoading } = useCandidateAnalytics();
  const { data: trends, isLoading: trendsLoading } = useHiringTrends(30);

  const trendSeries = useMemo(() => {
    return (trends?.trends || []).map((t) => ({
      date: t.date,
      screenings: t.screenings,
      shortlisted: t.shortlisted,
      interviews_completed: t.interviews_completed,
      average_score: t.average_score,
    }));
  }, [trends]);

  const isLoading = authLoading || candidatesLoading || trendsLoading;

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

        <Card>
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
