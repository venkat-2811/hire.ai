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
  Play, 
  MoreHorizontal,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Loader2,
  Plus,
  Calendar,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { StatusBadge } from '@/components/ui/status-badge';
import { ScoreBadge } from '@/components/ui/score-badge';
import { RoleBadge } from '@/components/ui/role-badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import type { JobRole, InterviewStatus } from '@/types/database';
import { useInterviews, useStartInterview } from '@/hooks/useInterviews';

export default function InterviewsPage() {
  const { loading: authLoading } = useRequireAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const { data: interviews, isLoading: interviewsLoading } = useInterviews();
  const startInterview = useStartInterview();

  const filteredInterviews = (interviews || []).filter(
    (i) => i.candidate_id?.toLowerCase().includes(searchQuery.toLowerCase()) || 
           i.job_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStartInterview = (sessionId: string) => {
    startInterview.mutate(sessionId, {
      onSuccess: () => {
        navigate(`/interviews/${sessionId}`);
      }
    });
  };

  if (authLoading || interviewsLoading) {
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
          {filteredInterviews.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="py-12 text-center text-muted-foreground">
                <p>No interviews found.</p>
                <p className="text-sm mt-2">Create an interview session from a candidate profile.</p>
              </CardContent>
            </Card>
          ) : (
            filteredInterviews.map((interview, index) => (
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
                            {interview.id.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-semibold">Session #{interview.id.slice(0, 8)}</h3>
                          <p className="text-sm text-muted-foreground">
                            Candidate: {interview.candidate_id?.slice(0, 8)}...
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={interview.status as InterviewStatus} />
                    </div>

                    <div className="mt-4 pt-4 border-t flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        {interview.scheduled_at && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {new Date(interview.scheduled_at).toLocaleDateString()}
                          </div>
                        )}
                        {interview.integrity_score !== null && interview.integrity_score !== undefined && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Integrity:</span>
                            <ScoreBadge score={interview.integrity_score} size="sm" />
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {interview.status === 'pending' && (
                          <Button size="sm" onClick={() => handleStartInterview(interview.id)}>
                            <Play className="mr-2 h-3 w-3" />
                            Start
                          </Button>
                        )}
                        {interview.status === 'in_progress' && (
                          <Button size="sm" variant="outline" onClick={() => navigate(`/interviews/${interview.id}`)}>
                            <Eye className="mr-2 h-3 w-3" />
                            Continue
                          </Button>
                        )}
                        {interview.status === 'completed' && (
                          <Button size="sm" variant="outline" onClick={() => navigate(`/interviews/${interview.id}`)}>
                            <Eye className="mr-2 h-3 w-3" />
                            Review
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
