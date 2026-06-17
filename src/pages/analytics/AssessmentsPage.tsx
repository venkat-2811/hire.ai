import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Activity, Briefcase } from 'lucide-react';
import type { AnalyticsOutletContext } from './shared';
import { avg, getCandidateStatus } from './shared';

function ScoreBar({
  label, value, max = 100, color, count,
}: {
  label: string; value: number; max?: number; color: string; count: number;
}) {
  const pctVal = Math.round((value / max) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{count} scored</span>
          <span className="text-sm font-bold">{value}%</span>
        </div>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pctVal}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
        />
      </div>
    </div>
  );
}

export default function AssessmentsPage() {
  const { data, candidatesLoading } = useOutletContext<AnalyticsOutletContext>();

  const assessmentPerf = useMemo(() => {
    const withAts = data.filter((c) => c.ats_score !== null);
    const withAssess = data.filter((c) => c.assessment_score !== null);
    const withInterview = data.filter((c) => c.interview_score !== null);
    const withTechnical = data.filter((c) => c.technical_score !== null);
    const withOverall = data.filter((c) => c.overall_score !== null);

    return [
      { label: 'Resume / ATS Score', value: avg(withAts.map((c) => c.ats_score)), count: withAts.length, color: '#6366f1' },
      { label: 'Technical Assessment', value: avg(withAssess.map((c) => c.assessment_score)), count: withAssess.length, color: '#8b5cf6' },
      { label: 'Interview Score', value: avg(withInterview.map((c) => c.interview_score)), count: withInterview.length, color: '#f97316' },
      { label: 'Technical Score', value: avg(withTechnical.map((c) => c.technical_score)), count: withTechnical.length, color: '#ec4899' },
      { label: 'Overall Score', value: avg(withOverall.map((c) => c.overall_score)), count: withOverall.length, color: '#22c55e' },
    ];
  }, [data]);

  const roleBreakdown = useMemo(() => {
    const roleMap = new Map<string, { title: string; jobId?: string; total: number; selected: number; rejected: number; inProcess: number }>();
    for (const c of data) {
      const key = c.job_id ?? c.job_title;
      if (!roleMap.has(key)) {
        roleMap.set(key, { title: c.job_title, jobId: c.job_id, total: 0, selected: 0, rejected: 0, inProcess: 0 });
      }
      const entry = roleMap.get(key)!;
      entry.total++;
      const status = getCandidateStatus(c);
      if (status === 'selected') entry.selected++;
      else if (status === 'rejected') entry.rejected++;
      else entry.inProcess++;
    }
    return Array.from(roleMap.values()).sort((a, b) => b.total - a.total);
  }, [data]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Assessment Performance</CardTitle>
              <CardDescription>Average scores across all evaluation stages</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {candidatesLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
              <Activity className="h-8 w-8 opacity-25" />
              <p className="text-sm">No scores yet.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {assessmentPerf
                .filter((p) => p.count > 0)
                .map((perf, i) => (
                  <motion.div
                    key={perf.label}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                  >
                    <ScoreBar label={perf.label} value={perf.value} count={perf.count} color={perf.color} />
                  </motion.div>
                ))}
              {assessmentPerf.every((p) => p.count === 0) && (
                <p className="text-sm text-muted-foreground text-center py-8">No scored assessments yet.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Role-wise Breakdown</CardTitle>
              <CardDescription>Applications and outcomes per job role</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {candidatesLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : roleBreakdown.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
              <Briefcase className="h-8 w-8 opacity-25" />
              <p className="text-sm">No data yet.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {roleBreakdown.map((role, i) => (
                <motion.div
                  key={role.title + i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="rounded-lg border bg-muted/20 p-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-semibold text-sm leading-tight">{role.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{role.total} total</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <p className="text-lg font-bold text-success">{role.selected}</p>
                      <p className="text-[10px] text-muted-foreground">Selected</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-destructive">{role.rejected}</p>
                      <p className="text-[10px] text-muted-foreground">Rejected</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{role.inProcess}</p>
                      <p className="text-[10px] text-muted-foreground">In Process</p>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden flex">
                    {role.selected > 0 && <div className="h-full bg-success" style={{ width: `${(role.selected / role.total) * 100}%` }} />}
                    {role.inProcess > 0 && <div className="h-full bg-amber-500" style={{ width: `${(role.inProcess / role.total) * 100}%` }} />}
                    {role.rejected > 0 && <div className="h-full bg-destructive" style={{ width: `${(role.rejected / role.total) * 100}%` }} />}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
