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
  AlertCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ScoreBadge } from '@/components/ui/score-badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { RoleBadge } from '@/components/ui/role-badge';

const stats = [
  { name: 'Total Candidates', value: '124', change: '+12%', icon: Users, color: 'text-info' },
  { name: 'Active Jobs', value: '8', change: '+2', icon: Briefcase, color: 'text-accent' },
  { name: 'Pending Interviews', value: '23', change: '-5', icon: Clock, color: 'text-warning' },
  { name: 'Completed Today', value: '7', change: '+3', icon: CheckCircle, color: 'text-success' },
];

const recentCandidates = [
  { id: '1', name: 'Sarah Johnson', role: 'salesforce_developer' as const, score: 87, status: 'completed' as const },
  { id: '2', name: 'Michael Chen', role: 'qa_engineer' as const, score: 72, status: 'in_progress' as const },
  { id: '3', name: 'Emily Davis', role: 'business_analyst' as const, score: 91, status: 'completed' as const },
  { id: '4', name: 'James Wilson', role: 'salesforce_developer' as const, score: 65, status: 'pending' as const },
];

const quickActions = [
  { name: 'Add New Job', href: '/jobs/new', icon: Plus, description: 'Create a job posting' },
  { name: 'Screen Resume', href: '/candidates/new', icon: FileText, description: 'Upload & analyze' },
  { name: 'View Reports', href: '/reports', icon: TrendingUp, description: 'Analytics dashboard' },
];

export default function DashboardPage() {
  const { user, loading } = useRequireAuth();

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

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
          {stats.map((stat, index) => (
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
                      <p className="text-3xl font-bold mt-1">{stat.value}</p>
                      <p className={`text-sm mt-1 ${stat.change.startsWith('+') ? 'text-success' : 'text-warning'}`}>
                        {stat.change} from last week
                      </p>
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
                <div className="space-y-4">
                  {recentCandidates.map((candidate) => (
                    <div
                      key={candidate.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">
                            {candidate.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{candidate.name}</p>
                          <RoleBadge role={candidate.role} size="sm" />
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <ScoreBadge score={candidate.score} />
                        <StatusBadge status={candidate.status} />
                      </div>
                    </div>
                  ))}
                </div>
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

            {/* AI Insights Card */}
            <Card className="mt-6 ai-glow border-accent/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-accent" />
                  AI Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Based on recent screenings, <strong>Salesforce Developer</strong> candidates 
                  show 23% higher success rates in Apex logic tasks compared to last month.
                </p>
                <Button variant="link" className="px-0 mt-2 text-accent">
                  View detailed analytics
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
