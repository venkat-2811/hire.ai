import { useState } from 'react';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Filter,
  Calendar,
  Play,
  Eye,
  Clock,
} from 'lucide-react';
import { ScoreBadge } from '@/components/ui/score-badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { RoleBadge } from '@/components/ui/role-badge';
import type { JobRole, InterviewStatus } from '@/types/database';

interface InterviewRow {
  id: string;
  candidateName: string;
  role: JobRole;
  status: InterviewStatus;
  scheduledAt: string | null;
  overallScore: number | null;
  integrityScore: number | null;
}

const mockInterviews: InterviewRow[] = [
  { id: '1', candidateName: 'Sarah Johnson', role: 'salesforce_developer', status: 'completed', scheduledAt: '2024-01-15T10:00:00', overallScore: 87, integrityScore: 95 },
  { id: '2', candidateName: 'Michael Chen', role: 'qa_engineer', status: 'in_progress', scheduledAt: '2024-01-16T14:00:00', overallScore: null, integrityScore: 88 },
  { id: '3', candidateName: 'Emily Davis', role: 'business_analyst', status: 'completed', scheduledAt: '2024-01-14T09:00:00', overallScore: 91, integrityScore: 100 },
  { id: '4', candidateName: 'James Wilson', role: 'salesforce_developer', status: 'pending', scheduledAt: '2024-01-17T11:00:00', overallScore: null, integrityScore: null },
  { id: '5', candidateName: 'Lisa Anderson', role: 'qa_engineer', status: 'pending', scheduledAt: null, overallScore: null, integrityScore: null },
];

export default function InterviewsPage() {
  const { loading } = useRequireAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [interviews] = useState<InterviewRow[]>(mockInterviews);

  const filteredInterviews = interviews.filter(
    (i) => i.candidateName.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <motion.h1 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl lg:text-3xl font-bold"
            >
              Interviews
            </motion.h1>
            <p className="text-muted-foreground mt-1">
              Track and manage candidate interviews
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search interviews..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Filter by Status
          </Button>
          <Button variant="outline">
            <Calendar className="mr-2 h-4 w-4" />
            Date Range
          </Button>
        </div>

        {/* Interview Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredInterviews.map((interview, index) => (
            <motion.div
              key={interview.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-lg font-medium text-primary">
                          {interview.candidateName.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold">{interview.candidateName}</h3>
                        <RoleBadge role={interview.role} size="sm" />
                      </div>
                    </div>
                    <StatusBadge status={interview.status} />
                  </div>

                  <div className="mt-4 pt-4 border-t flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      {interview.scheduledAt && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          {new Date(interview.scheduledAt).toLocaleDateString()} at{' '}
                          {new Date(interview.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                      {interview.overallScore !== null && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Score:</span>
                          <ScoreBadge score={interview.overallScore} size="sm" />
                        </div>
                      )}
                      {interview.integrityScore !== null && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Integrity:</span>
                          <span className={`text-sm font-medium ${
                            interview.integrityScore >= 90 ? 'text-success' : 
                            interview.integrityScore >= 70 ? 'text-warning' : 'text-destructive'
                          }`}>
                            {interview.integrityScore}%
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {interview.status === 'pending' && (
                        <Button size="sm">
                          <Play className="mr-2 h-3 w-3" />
                          Start
                        </Button>
                      )}
                      {interview.status === 'in_progress' && (
                        <Button size="sm" variant="outline">
                          <Eye className="mr-2 h-3 w-3" />
                          Monitor
                        </Button>
                      )}
                      {interview.status === 'completed' && (
                        <Button size="sm" variant="outline">
                          <Eye className="mr-2 h-3 w-3" />
                          Review
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
