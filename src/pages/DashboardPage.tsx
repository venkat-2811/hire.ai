import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  Briefcase,
  FileText,
  TrendingUp,
  ArrowRight,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ScoreBadge } from '@/components/ui/score-badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { RoleBadge } from '@/components/ui/role-badge';
import { useDashboardStats, useCandidateAnalytics, useHiringTrends } from '@/hooks/useAnalytics';
import { useCandidates } from '@/hooks/useCandidates';
import { useInterviews } from '@/hooks/useInterviews';
import { useUsage } from '@/hooks/useUsage';
import type { JobRole, InterviewStatus } from '@/types/database';
import { AnalyticsCharts } from '@/components/dashboard/AnalyticsCharts';
import { Progress } from '@/components/ui/progress';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { Label } from '@/components/ui/label';
import { useState } from 'react';

const quickActions = [
  { name: 'Add New Job', href: '/jobs/new', icon: Plus, description: 'Create a job posting' },
  { name: 'Screen Resume', href: '/candidates', icon: FileText, description: 'View & screen candidates' },
  { name: 'View Results', href: '/results', icon: TrendingUp, description: 'Scores & recommendations' },
];

export default function DashboardPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: candidates, isLoading: candidatesLoading } = useCandidates({ limit: 5 });
  const { data: interviews, isLoading: interviewsLoading } = useInterviews({ status: 'completed' });
  const { data: candidatesAnalytics, isLoading: analyticsLoading } = useCandidateAnalytics();
  const { data: trendsData, isLoading: trendsLoading } = useHiringTrends(30);
  const { data: usageData, isLoading: usageLoading } = useUsage();

  const [showUpgrade, setShowUpgrade] = useState(false);

  const isLoading = authLoading || statsLoading || analyticsLoading || trendsLoading || usageLoading;

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  const formatChange = (n?: number) => {
    const value = typeof n === 'number' ? n : 0;
    const sign = value > 0 ? '+' : '';
    return `${sign}${value}`;
  };

  const dashboardStats = [
    {
      name: 'Total Applicants',
      value: stats?.total_candidates?.toString() || '0',
      change: formatChange(stats?.total_candidates_change),
      icon: Users,
      color: 'text-info'
    },
    {
      name: 'Selected',
      value: candidatesAnalytics?.filter(c => c.recommendation?.includes('hire') && !c.recommendation?.includes('no_hire')).length.toString() || '0',
      change: '',
      icon: CheckCircle,
      color: 'text-success bg-success/10'
    },
    {
      name: 'Rejected',
      value: candidatesAnalytics?.filter(c => c.recommendation?.includes('no_hire')).length.toString() || '0',
      change: '',
      icon: XCircle,
      color: 'text-destructive bg-destructive/10'
    },
    {
      name: 'In Process',
      value: candidatesAnalytics?.filter(c => !c.recommendation).length.toString() || stats?.pending_interviews?.toString() || '0',
      change: '',
      icon: Clock,
      color: 'text-warning bg-warning/10'
    },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl lg:text-3xl font-bold text-foreground"
            >
              Welcome back!! 👋
            </motion.h1>
            <p className="text-muted-foreground mt-1">
              See how your hiring pipeline is performing today.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link to="/candidates">
                View All Candidates
              </Link>
            </Button>
            <Button asChild>
              <Link to="/candidates/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Candidate
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {dashboardStats.map((stat, index) => (
            <motion.div
              key={stat.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="h-full"
            >
              <Card className="hover:shadow-md transition-shadow h-full">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.name}</p>
                      <p className="text-3xl font-bold mt-1">
                        {statsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stat.value}
                      </p>
                      {stat.change ? (
                        <p className={`text-sm mt-1 ${stat.change.startsWith('+') ? 'text-success' : 'text-warning'}`}>
                          {stat.change} from last week
                        </p>
                      ) : (
                        <p className="text-sm mt-1 opacity-0 select-none">
                          &nbsp;
                        </p>
                      )}
                    </div>
                    <div className={`p-3 rounded-xl bg-muted ${stat.color}`}>
                      <stat.icon className="h-6 w-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>



        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Candidates */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-2"
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Recent Candidates</CardTitle>
                  <CardDescription>Latest screening results</CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/candidates">
                    View all <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {candidatesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : candidates && candidates.length > 0 ? (
                  <div className="space-y-4">
                    {candidates.slice(0, 4).map((candidate) => (
                      <div
                        key={candidate.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-medium text-primary">
                              {candidate.full_name.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{candidate.full_name}</p>
                            <p className="text-sm text-muted-foreground">{candidate.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {(() => {
                            const analytics = candidatesAnalytics?.find(a => a.candidate_id === candidate.id);
                            if (!analytics) return null;
                            const score = analytics.overall_score;
                            if (score === null || score === undefined) return <span className="text-sm text-muted-foreground">No score yet</span>;
                            return <ScoreBadge score={score} />;
                          })()}
                          <span className="text-sm text-muted-foreground">
                            {new Date(candidate.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No candidates yet. <Link to="/candidates/new" className="text-primary hover:underline">Add your first candidate</Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="space-y-6"
          >
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common tasks at your fingertips</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {quickActions.map((action) => (
                  <Link
                    key={action.name}
                    to={action.href}
                    className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
                  >
                    <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <action.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{action.name}</p>
                      <p className="text-sm text-muted-foreground">{action.description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                  </Link>
                ))}
              </CardContent>
            </Card>

            {/* Usage & Subscription */}
            <Card>
              <CardHeader className="flex flex-row flex-wrap justify-between items-start gap-2">
                <div>
                  <CardTitle>Usage & Subscription</CardTitle>
                  <CardDescription>
                    Current plan: <span className="font-semibold text-foreground">{usageData?.plan_label || 'Loading...'}</span>
                  </CardDescription>
                </div>
                {(usageData?.plan === 'free' || usageData?.plan === 'pro') && (
                  <Button variant="outline" size="sm" onClick={() => setShowUpgrade(true)}>
                    Upgrade Plan
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-5">
                {usageLoading ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    {Object.values(usageData?.usage || {}).map((item) => {
                      const percent = Math.min(100, Math.round((item.used / item.limit) * 100));
                      const isHigh = percent >= 80;
                      return (
                        <div key={item.label} className="space-y-1.5">
                          <div className="flex justify-between items-end">
                            <Label className="text-xs text-muted-foreground">{item.label}</Label>
                            <span className="text-xs font-medium">
                              {item.used} / {item.limit > 900000 ? '∞' : item.limit}
                            </span>
                          </div>
                          <Progress
                            value={percent}
                            className={`h-2 ${isHigh ? '[&>div]:bg-destructive' : ''}`}
                          />
                        </div>
                      );
                    })}
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {usageData && (
          <UpgradePrompt
            open={showUpgrade}
            onClose={() => setShowUpgrade(false)}
            resource="plan features"
            current={usageData.usage.jobs.used}
            limit={usageData.usage.jobs.limit}
            plan={usageData.plan_label}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
