import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Users, CheckCircle, XCircle, Clock, FileText, Activity, Percent, ChevronDown, Target } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import type { AnalyticsOutletContext, StatusTab } from './shared';
import { getCandidateStatus, avg, pct, STATUS_CONFIG } from './shared';

function FunnelStage({
  label, count, total, prevCount, color, widthPct, delay,
}: {
  label: string; count: number; total: number; prevCount: number | null; color: string; widthPct: number; delay: number;
}) {
  const conversionFromPrev = prevCount !== null && prevCount > 0 ? Math.round((count / prevCount) * 100) : null;
  const conversionFromTotal = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <motion.div
      className="flex items-center gap-3 group"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
    >
      <div className="flex-1 relative h-10 flex items-center">
        <div
          className="absolute left-0 top-0 h-full rounded-md transition-all duration-700 flex items-center px-3"
          style={{ width: `${widthPct}%`, backgroundColor: color, minWidth: count > 0 ? 56 : 0 }}
        >
          <span className="text-white text-sm font-bold whitespace-nowrap">{count}</span>
        </div>
        <div
          className="absolute left-0 top-0 h-full rounded-md bg-muted"
          style={{ width: '100%', zIndex: -1 }}
        />
      </div>
      <div className="w-52 flex items-center justify-between shrink-0">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{conversionFromTotal}%</span>
          {conversionFromPrev !== null && (
            <span className="text-muted-foreground opacity-60">↓{conversionFromPrev}%</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function DonutTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { name, value, fill } = payload[0].payload;
  return (
    <div className="bg-background border border-border rounded-lg px-3 py-2 shadow-lg text-sm">
      <div className="flex items-center gap-2">
        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: fill }} />
        <span className="font-medium">{name}</span>
        <span className="text-muted-foreground ml-auto pl-4 font-bold">{value}</span>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const { data, candidatesLoading } = useOutletContext<AnalyticsOutletContext>();
  const navigate = useNavigate();

  const kpis = useMemo(() => {
    const total = data.length;
    const selected = data.filter((c) => getCandidateStatus(c) === 'selected').length;
    const rejected = data.filter((c) => getCandidateStatus(c) === 'rejected').length;
    const inProcess = data.filter((c) => getCandidateStatus(c) === 'in_process').length;
    const avgAssessment = avg(data.map((c) => c.assessment_score));
    const withInterviewStatus = data.filter((c) => c.interview_status !== null);
    const interviewsCompleted = withInterviewStatus.filter(
      (c) => c.interview_status === 'completed' || c.interview_status === 'terminated'
    ).length;
    const interviewCompletionRate =
      withInterviewStatus.length > 0
        ? Math.round((interviewsCompleted / withInterviewStatus.length) * 100)
        : 0;
    const offerConversionRate = total > 0 ? Math.round((selected / total) * 100) : 0;

    return { total, inProcess, selected, rejected, avgAssessment, interviewCompletionRate, offerConversionRate };
  }, [data]);

  const funnelStages = useMemo(() => {
    const total = data.length;
    const atsScreened = data.filter((c) => c.ats_score !== null).length;
    const shortlisted = data.filter((c) => c.shortlisted === true).length;
    const assessmentStarted = data.filter((c) => c.assessment_status !== null).length;
    const assessmentCompleted = data.filter((c) => c.assessment_status === 'completed').length;
    const interviewCompleted = data.filter(
      (c) => c.interview_status === 'completed' || c.interview_status === 'terminated'
    ).length;
    const selected = data.filter((c) => getCandidateStatus(c) === 'selected').length;

    const stages = [
      { label: 'Applied', count: total, color: '#6366f1' },
      { label: 'ATS Screened', count: atsScreened, color: '#8b5cf6' },
      { label: 'Shortlisted', count: shortlisted, color: '#a855f7' },
      { label: 'Assessment Started', count: assessmentStarted, color: '#ec4899' },
      { label: 'Assessment Completed', count: assessmentCompleted, color: '#f43f5e' },
      { label: 'Interview Completed', count: interviewCompleted, color: '#f97316' },
      { label: 'Selected', count: selected, color: '#22c55e' },
    ];

    const maxCount = Math.max(total, 1);
    return stages.map((s, i) => ({
      ...s,
      widthPct: Math.max(Math.round((s.count / maxCount) * 100), s.count > 0 ? 5 : 0),
      prevCount: i === 0 ? null : stages[i - 1].count,
    }));
  }, [data]);

  const donutData = useMemo(() => {
    const selected = data.filter((c) => getCandidateStatus(c) === 'selected').length;
    const rejected = data.filter((c) => getCandidateStatus(c) === 'rejected').length;
    const inProcess = data.filter((c) => getCandidateStatus(c) === 'in_process').length;

    return [
      { name: 'Selected', value: selected, fill: STATUS_CONFIG.selected.color, tab: 'selected' as StatusTab },
      { name: 'Rejected', value: rejected, fill: STATUS_CONFIG.rejected.color, tab: 'rejected' as StatusTab },
      { name: 'In Process', value: inProcess, fill: STATUS_CONFIG.in_process.color, tab: 'in_process' as StatusTab },
    ].filter((d) => d.value > 0);
  }, [data]);

  const handleKpiClick = (tab: StatusTab) => {
    navigate(`/analytics/pipeline?status=${tab}`);
  };

  const kpiCards = [
    { label: 'Total Candidates', value: kpis.total, suffix: '', icon: Users, color: 'text-primary', bg: 'bg-primary/10', tab: null as StatusTab | null },
    { label: 'Active / In Process', value: kpis.inProcess, suffix: '', icon: Clock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', tab: 'in_process' as StatusTab },
    { label: 'Selected', value: kpis.selected, suffix: '', icon: CheckCircle, color: 'text-success', bg: 'bg-success/10', tab: 'selected' as StatusTab },
    { label: 'Rejected', value: kpis.rejected, suffix: '', icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10', tab: 'rejected' as StatusTab },
    { label: 'Avg Assessment Score', value: kpis.avgAssessment, suffix: '%', icon: FileText, color: 'text-info', bg: 'bg-info/10', tab: null },
    { label: 'Interview Completion', value: kpis.interviewCompletionRate, suffix: '%', icon: Activity, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/10', tab: null },
    { label: 'Offer Conversion Rate', value: kpis.offerConversionRate, suffix: '%', icon: Percent, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', tab: 'selected' as StatusTab },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      {candidatesLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-5 pb-4 space-y-3">
                <div className="h-9 w-9 rounded-lg bg-muted" />
                <div className="h-3 w-16 rounded bg-muted" />
                <div className="h-7 w-12 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {kpiCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card
                className={`h-full transition-all duration-200 ${
                  card.tab ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:translate-y-0' : ''
                }`}
                onClick={() => card.tab && handleKpiClick(card.tab)}
              >
                <CardContent className="pt-5 pb-4">
                  <div className="flex flex-col gap-3">
                    <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center`}>
                      <card.icon className={`h-5 w-5 ${card.color}`} />
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground font-medium leading-tight">
                        {card.label}
                      </p>
                      <p className="text-2xl font-bold mt-0.5 tabular-nums">
                        {card.value}{card.suffix}
                      </p>
                    </div>
                    {card.tab && (
                      <p className="text-[10px] text-muted-foreground/70 -mt-1">
                        Click to filter ↓
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Funnel */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ChevronDown className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Hiring Funnel</CardTitle>
                <CardDescription>Candidate journey from application to selection</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {candidatesLoading ? (
              <div className="flex items-center justify-center h-56">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : data.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-56 text-muted-foreground gap-2">
                <ChevronDown className="h-8 w-8 opacity-25" />
                <p className="text-sm">No candidate data yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-1">
                  <div className="flex-1">Stage</div>
                  <div className="w-52 flex justify-between pr-1">
                    <span>Stage Name</span>
                    <span>% Total / % Prev</span>
                  </div>
                </div>
                {funnelStages.map((stage, i) => (
                  <FunnelStage
                    key={stage.label}
                    label={stage.label}
                    count={stage.count}
                    total={data.length}
                    prevCount={stage.prevCount}
                    color={stage.color}
                    widthPct={stage.widthPct}
                    delay={i * 0.06}
                  />
                ))}
                <div className="pt-3 border-t mt-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Overall Hiring Conversion</span>
                  <span className="text-sm font-bold text-success">
                    {pct(funnelStages[funnelStages.length - 1].count, data.length)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Donut */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Status Distribution</CardTitle>
                <CardDescription>Candidate pool breakdown</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {candidatesLoading ? (
              <div className="flex items-center justify-center h-56">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : donutData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-56 text-muted-foreground gap-2">
                <Target className="h-8 w-8 opacity-25" />
                <p className="text-sm">No candidate data yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius="55%"
                        outerRadius="78%"
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                        onClick={(entry) => handleKpiClick((entry as any).tab as StatusTab)}
                        style={{ cursor: 'pointer' }}
                      >
                        {donutData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <RechartsTooltip content={<DonutTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {donutData.map((d) => (
                    <button
                      key={d.name}
                      onClick={() => handleKpiClick(d.tab)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left group"
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: d.fill }} />
                        <span className="text-sm font-medium group-hover:text-primary transition-colors">{d.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{d.value}</span>
                        <span className="text-xs text-muted-foreground">{pct(d.value, data.length)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
