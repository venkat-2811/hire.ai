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
import type { JobRole, InterviewStatus } from '@/types/database';
import { AnalyticsCharts } from '@/components/dashboard/AnalyticsCharts';

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

  const isLoading = authLoading || statsLoading || analyticsLoading || trendsLoading;

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
              Welcome back! 👋
            </motion.h1>
            <p className="text-muted-foreground mt-1">
              Here's what's happening with your hiring pipeline today.
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
            >
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.name}</p>
                      <p className="text-3xl font-bold mt-1">
                        {statsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stat.value}
                      </p>
                      {stat.change && (
                        <p className={`text-sm mt-1 ${stat.change.startsWith('+') ? 'text-success' : 'text-warning'}`}>
                          {stat.change} from last week
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
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
