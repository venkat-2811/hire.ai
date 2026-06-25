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
  Loader2,
  Trophy,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ScoreBadge } from '@/components/ui/score-badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { RoleBadge } from '@/components/ui/role-badge';
import { useDashboardStats, useCandidateAnalytics, useHiringTrends } from '@/hooks/useAnalytics';
import { useCandidates } from '@/hooks/useCandidates';
import { useInterviews } from '@/hooks/useInterviews';
import { useJobs } from '@/hooks/useJobs';
import type { JobRole, InterviewStatus } from '@/types/database';
import { AnalyticsCharts } from '@/components/dashboard/AnalyticsCharts';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const quickActions = [
  { name: 'Add New Job', href: '/jobs/new', icon: Plus, description: 'Create a job posting' },
  { name: 'Screen Resume', href: '/candidates', icon: FileText, description: 'View & screen candidates' },
  { name: 'View Results', href: '/results', icon: Trophy, description: 'Scores & recommendations' },
];

export default function DashboardPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: candidates, isLoading: candidatesLoading } = useCandidates({ limit: 5 });
  const { data: interviews, isLoading: interviewsLoading } = useInterviews({ status: 'completed' });
  const { data: candidatesAnalytics, isLoading: analyticsLoading } = useCandidateAnalytics();
  const { data: trendsData, isLoading: trendsLoading } = useHiringTrends(30);
  const { data: jobs, isLoading: jobsLoading } = useJobs();

  const hasJobs = jobs && jobs.length > 0;
  const isLoading = authLoading || statsLoading || analyticsLoading || trendsLoading || jobsLoading;

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
      value: candidatesAnalytics?.filter(c => c.final_status === 'accepted' || c.final_status === 'offer_sent').length.toString() || '0',
      change: '',
      icon: CheckCircle,
      color: 'text-success bg-success/10'
    },
    {
      name: 'Rejected',
      value: candidatesAnalytics?.filter(c => c.final_status === 'rejected').length.toString() || '0',
      change: '',
      icon: XCircle,
      color: 'text-destructive bg-destructive/10'
    },
    {
      name: 'In Process',
      value: candidatesAnalytics?.filter(c => !c.final_status || c.final_status === 'in-progress' || c.final_status === 'applied').length.toString() || stats?.pending_interviews?.toString() || '0',
      change: '',
      icon: Clock,
      color: 'text-warning bg-warning/10'
    },
  ];

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl lg:text-3xl font-bold text-foreground min-h-[36px] flex items-center"
            >
              {jobsLoading ? (
                <span className="inline-block w-48 h-8 bg-muted animate-pulse rounded-md" />
              ) : !hasJobs ? (
                'Welcome to Rekshift! 🎉'
              ) : (
                'Welcome back! 👋'
              )}
            </motion.h1>
            <div className="text-muted-foreground mt-1 min-h-[20px] flex items-center">
              {jobsLoading ? (
                <span className="inline-block w-64 h-4 bg-muted animate-pulse rounded-md" />
              ) : !hasJobs ? (
                "Let's get started by creating your first job posting."
              ) : (
                'See how your hiring pipeline is performing today.'
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-3 w-full lg:w-auto mt-2 lg:mt-0">
            <Button variant="outline" asChild className="flex-1 sm:flex-none border-foreground/80 dark:border-foreground/80 hover:bg-accent">
              <Link to="/jobs/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Job
              </Link>
            </Button>
            <Button
              className="flex-1 sm:flex-none"
              asChild={!!hasJobs}
              onClick={(e) => {
                if (!hasJobs && !jobsLoading) {
                  toast.error("Please create a job first before adding candidates.");
                }
              }}
            >
              {hasJobs ? (
                <Link to="/candidates/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Candidate
                </Link>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Candidate
                </>
              )}
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
                      {stat.change && (
                        <p className="text-sm mt-1 opacity-0 select-none">
                          &nbsp;
                        </p>
                      )}
                      {!stat.change && (
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
            {!hasJobs && !jobsLoading ? (
              <Card className="h-full min-h-[300px] flex items-center justify-center border-dashed border-2">
                <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
                  <p className="font-semibold text-foreground text-lg">No Jobs are created yet.</p>
                  <Button asChild className="w-48 font-semibold shadow-sm border-2 border-foreground/20 hover:border-foreground/50 transition-colors">
                    <Link to="/jobs/new">
                      <Plus className="mr-2 h-4 w-4" />
                      CREATE JOB
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
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
                  {candidatesLoading || jobsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : candidates && candidates.length > 0 ? (
                    <div className="space-y-4 mt-4">
                      {candidates.slice(0, 4).map((candidate) => (
                        <div
                          key={candidate.job_id ? `${candidate.id}-${candidate.job_id}` : candidate.id}
                          className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 flex-shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-medium text-primary">
                                {candidate.full_name.split(' ').map(n => n[0]).join('')}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{candidate.full_name}</p>
                              <p className="text-sm text-muted-foreground truncate">{candidate.email}</p>
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
                    <div className="text-center py-10 text-muted-foreground flex flex-col items-center justify-center space-y-4">
                      <p className="font-semibold text-foreground text-lg">No Candidates are added to the job yet</p>
                      <Button asChild className="w-48 font-semibold shadow-sm border-2 border-foreground/20 hover:border-foreground/50 transition-colors">
                        <Link to="/candidates/new">
                          <Plus className="mr-2 h-4 w-4" />
                          Add Candidate
                        </Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
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
                    className="flex items-center gap-4 p-4 rounded-lg bg-card border border-primary/20 hover:border-primary hover:shadow-md hover:bg-primary/[0.02] transition-all group shadow-sm"
                  >
                    <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <action.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground group-hover:text-primary transition-colors">{action.name}</p>
                      <p className="text-sm text-muted-foreground">{action.description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </Link>
                ))}
              </CardContent>
            </Card>


          </motion.div>
        </div>

      </div>
    </DashboardLayout>
  );
}
