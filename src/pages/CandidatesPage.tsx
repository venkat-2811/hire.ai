import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  Filter,
  Plus,
  MoreHorizontal,
  ArrowUpDown,
  Eye,
  Play,
  FileText,
  Loader2,
  Sparkles,
  Mail,
  MessageSquare,
  Trash2,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  Users,
  Shield,
  Briefcase,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ScoreBadge } from '@/components/ui/score-badge';
import { StatusBadge } from '@/components/ui/status-badge';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { JobRole, InterviewStatus } from '@/types/database';
import { useCandidates, useDeleteCandidate } from '@/hooks/useCandidates';
import { useCreateInterview, useStartInterview, useInterviews } from '@/hooks/useInterviews';
import { useJobs } from '@/hooks/useJobs';
import { useCandidateAnalytics } from '@/hooks/useAnalytics';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type SortField = 'name' | 'date' | 'score';
type SortOrder = 'asc' | 'desc';

export default function CandidatesPage() {
  const { loading: authLoading } = useRequireAuth();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string>('');

  const { data: candidates, isLoading: candidatesLoading } = useCandidates();
  const deleteCandidate = useDeleteCandidate();
  const createInterview = useCreateInterview();
  const startInterview = useStartInterview();
  const { data: jobs, isLoading: jobsLoading } = useJobs();
  const { data: interviews } = useInterviews();
  const { data: analytics } = useCandidateAnalytics();

  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [startCandidateId, setStartCandidateId] = useState<string | null>(null);
  const [startJobId, setStartJobId] = useState<string>('');
  const [assessmentDialogOpen, setAssessmentDialogOpen] = useState(false);
  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [mcqCount, setMcqCount] = useState(20);
  const [codingCount, setCodingCount] = useState(2);
  const [assessmentDifficulty, setAssessmentDifficulty] = useState<'easy' | 'medium' | 'hard'>('hard');
  const [includeMcq, setIncludeMcq] = useState(true);
  const [includeCoding, setIncludeCoding] = useState(true);
  const [totalTimeMinutes, setTotalTimeMinutes] = useState<number | ''>('');
  const [interviewQuestionCount, setInterviewQuestionCount] = useState(5);
  const [interviewDifficulty, setInterviewDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [interviewMode, setInterviewMode] = useState<'ai' | 'manual'>('ai');
  const [assessmentDeadline, setAssessmentDeadline] = useState('');
  const [interviewDeadline, setInterviewDeadline] = useState('');

  // Delete Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [candidateToDelete, setCandidateToDelete] = useState<{ id: string; jobId: string } | null>(null);

  const activeJobs = useMemo(() => (jobs || []).filter(j => j.is_active), [jobs]);
  const allJobs = useMemo(() => jobs || [], [jobs]);

  useEffect(() => {
    if (!selectedJobId) {
      const defaultJobId = activeJobs[0]?.id || allJobs[0]?.id;
      if (defaultJobId) setSelectedJobId(defaultJobId);
    }
  }, [activeJobs, allJobs, selectedJobId]);

  // Group candidates by job
  const candidatesByJob = useMemo(() => {
    const result = candidates || [];

    if (!selectedJobId) return {};

    // Apply search filter
    let filtered = result;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.full_name.toLowerCase().includes(query) ||
          c.email.toLowerCase().includes(query)
      );
    }

    // Group by job
    const grouped: Record<string, any[]> = {};

    filtered.forEach(candidate => {
      const jobId = (candidate as any).job_id;
      if (!jobId) return; // Skip candidates without job assignments
      if (jobId !== selectedJobId) return;
      if (!grouped[jobId]) {
        grouped[jobId] = [];
      }
      grouped[jobId].push(candidate);
    });

    // Sort within each group
    Object.keys(grouped).forEach(jobId => {
      grouped[jobId] = grouped[jobId].sort((a, b) => {
        let comparison = 0;
        switch (sortField) {
          case 'name':
            comparison = a.full_name.localeCompare(b.full_name);
            break;
          case 'date':
            comparison = new Date((a as any).applied_at || a.created_at).getTime() - new Date((b as any).applied_at || b.created_at).getTime();
            break;
          case 'score':
            comparison = 0; // Will implement when we have scores
            break;
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
    });

    return grouped;
  }, [candidates, searchQuery, sortField, sortOrder, selectedJobId]);

  // Get job title by ID
  const getJobTitle = (jobId: string) => {
    const job = allJobs.find(j => j.id === jobId);
    if (!job) return 'Unknown Job';
    return job.is_active ? job.title : `${job.title} (Archived)`;
  };

  const toggleSelectAll = () => {
    if (!selectedJobId) return;
    const jobCandidates = candidatesByJob[selectedJobId] || [];
    const allCandidates = jobCandidates.map(c => `${c.id}_${selectedJobId}`);
    if (selectedIds.size === allCandidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allCandidates));
    }
  };

  const toggleSelect = (id: string, jobId: string) => {
    const key = `${id}_${jobId}`;
    const newSet = new Set(selectedIds);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setSelectedIds(newSet);
  };

  const handleBulkAssessment = () => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one of the candidate');
      return;
    }
    if (!selectedJobId) {
      toast.error('Please select a job');
      return;
    }
    setStartJobId(selectedJobId);
    setAssessmentDialogOpen(true);
  };

  const sendAssessmentInvites = async () => {
    if (!selectedJobId) {
      toast.error('Please select a job');
      return;
    }

    if (!includeMcq && !includeCoding) {
      toast.error('Please enable at least one section (MCQ or Coding)');
      return;
    }

    if (!assessmentDeadline) {
      toast.error('Please select a deadline for the assessment');
      return;
    }

    setSendingInvites(true);
    try {
      const token = await getToken();
      const response = await fetch(`/api/assessments/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          candidate_ids: Array.from(selectedIds).map(id => id.split('_')[0]),
          job_id: selectedJobId,
          deadline: assessmentDeadline,
          mcq_question_count: includeMcq ? mcqCount : 0,
          coding_challenge_count: includeCoding ? codingCount : 0,
          difficulty: assessmentDifficulty,
          include_mcq: includeMcq,
          include_coding: includeCoding,
          total_time_minutes: totalTimeMinutes || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || error.detail || 'Failed to send invites');
      }

      const data = await response.json();
      toast.success(`Assessment invites sent to ${data.invites_sent} candidate(s)`);
      setAssessmentDialogOpen(false);
      setSelectedIds(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send assessment invites');
    } finally {
      setSendingInvites(false);
    }
  };

  const handleBulkInterview = () => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one candidate');
      return;
    }
    if (!selectedJobId) {
      toast.error('Please select a job');
      return;
    }
    setStartJobId(selectedJobId);
    setInterviewDialogOpen(true);
  };

  const handleBulkManualInterview = () => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one candidate');
      return;
    }

    if (selectedIds.size > 1) {
      toast.error('Please select only one candidate to enter manual interview details');
      return;
    }

    const onlyId = Array.from(selectedIds)[0];
    const [candidateId, jobId] = onlyId.split('_');
    if (!candidateId || !jobId) {
      toast.error('Missing candidate or job context');
      return;
    }

    navigate(`/candidates/${candidateId}?job_id=${encodeURIComponent(jobId)}&tab=manual`);
  };

  const sendInterviewInvites = async () => {
    if (!selectedJobId) {
      toast.error('Please select a job');
      return;
    }

    if (interviewMode === 'ai' && (interviewQuestionCount < 1 || interviewQuestionCount > 30)) {
      toast.error('Question count must be between 1 and 30');
      return;
    }

    setSendingInvites(true);
    try {
      const token = await getToken();
      
      if (interviewMode === 'manual') {
        // For manual interviews, set interview_mode to 'manual' in job_applications
        const response = await fetch(`/api/candidates/bulk-update-interview-mode`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            candidate_ids: Array.from(selectedIds).map(id => id.split('_')[0]),
            job_id: selectedJobId,
            interview_mode: 'manual',
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || error.detail || 'Failed to set manual interview mode');
        }

        const data = await response.json();
        toast.success(`Manual interview mode set for ${data.updated_count} candidate(s). You can now enter scores in the candidate details page.`);
      } else {
        // AI interview flow (existing)
        if (!interviewDeadline) {
          toast.error('Please select a deadline for the interview');
          return;
        }
        const response = await fetch(`/api/ai-interview/invite`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            candidate_ids: Array.from(selectedIds).map(id => id.split('_')[0]),
            job_id: selectedJobId,
            question_count: interviewQuestionCount,
            difficulty: interviewDifficulty,
            deadline: interviewDeadline,
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || error.detail || 'Failed to send invites');
        }

        const data = await response.json();
        toast.success(`Interview invites are sent to ${data.invites_sent} candidate(s)`);
      }
      
      setInterviewDialogOpen(false);
      setSelectedIds(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send interview invites');
    } finally {
      setSendingInvites(false);
    }
  };

  const handleStartInterview = (candidateId: string) => {
    setStartCandidateId(candidateId);
    setStartJobId(selectedJobId || activeJobs[0]?.id || '');
    setStartDialogOpen(true);
  };

  const handleCreateAndStart = () => {
    if (!startCandidateId || !startJobId) return;

    createInterview.mutate(
      { candidate_id: startCandidateId, job_id: startJobId },
      {
        onSuccess: (session) => {
          startInterview.mutate(session.id, {
            onSuccess: () => {
              setStartDialogOpen(false);
              setStartCandidateId(null);
              navigate(`/interviews/${session.id}`);
            },
            onError: () => {
              setStartDialogOpen(false);
              setStartCandidateId(null);
              navigate('/interviews');
            },
          });
        },
      }
    );
  };

  if (authLoading || candidatesLoading) {
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl lg:text-3xl font-bold"
            >
              Candidates
            </motion.h1>
            <p className="text-muted-foreground mt-1">
              Manage and review all candidate applications
            </p>
          </div>
          <Button asChild className="w-full sm:w-auto mt-2 sm:mt-0">
            <Link to="/candidates/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Candidate
            </Link>
          </Button>
        </div>

        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="text-sm font-medium w-full sm:w-auto">Job</div>
              <Select value={selectedJobId} onValueChange={(v) => {
                setSelectedJobId(v);
                setSelectedIds(new Set());
                setStartJobId(v);
              }}>
                <SelectTrigger className="w-full sm:w-[320px]" disabled={jobsLoading || allJobs.length === 0}>
                  <SelectValue placeholder={jobsLoading ? 'Loading jobs...' : 'Select a job'} />
                </SelectTrigger>
                <SelectContent>
                  {allJobs.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                <div className="relative w-full sm:flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search candidates..."
                    className="pl-10 w-full"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="mr-2 h-4 w-4" />
                  Filters
                </Button>
              </div>

              {showFilters && (
                <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Label>Sort by:</Label>
                    <Select value={sortField} onValueChange={(v: SortField) => setSortField(v)}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="date">Date Applied</SelectItem>
                        <SelectItem value="score">Score</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    >
                      <ArrowUpDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                <span className="text-sm font-medium w-full sm:w-auto mb-2 sm:mb-0">
                  {selectedIds.size} candidate(s) selected
                </span>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <Button size="sm" className="flex-1 sm:flex-none" onClick={handleBulkAssessment}>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Assessment
                  </Button>
                  <Button size="sm" variant="secondary" className="flex-1 sm:flex-none" onClick={handleBulkInterview}>
                    <Play className="mr-2 h-4 w-4" />
                    Send AI Interview
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={handleBulkManualInterview}>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Manual Interview
                  </Button>
                  <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => setSelectedIds(new Set())}>
                    Clear Selection
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Grouped Candidates by Job */}
        <div className="space-y-4">
          {Object.entries(candidatesByJob).map(([jobId, jobCandidates]) => (
            <Collapsible key={jobId} defaultOpen className="w-full">
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Briefcase className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{getJobTitle(jobId)}</CardTitle>
                          <CardDescription>{jobCandidates.length} candidate(s)</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={jobCandidates.length > 0 && jobCandidates.every(c => selectedIds.has(`${c.id}_${jobId}`))}
                          onCheckedChange={(checked) => {
                            const newSet = new Set(selectedIds);
                            if (checked) {
                              // Select all candidates in this job
                              jobCandidates.forEach(c => newSet.add(`${c.id}_${jobId}`));
                            } else {
                              // Deselect all candidates in this job
                              jobCandidates.forEach(c => newSet.delete(`${c.id}_${jobId}`));
                            }
                            setSelectedIds(newSet);
                          }}
                        />
                        <ChevronDown className="h-4 w-4" />
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={jobCandidates.length > 0 && jobCandidates.every(c => selectedIds.has(`${c.id}_${jobId}`))}
                              onCheckedChange={(checked) => {
                                const newSet = new Set(selectedIds);
                                if (checked) {
                                  // Select all candidates in this job
                                  jobCandidates.forEach(c => newSet.add(`${c.id}_${jobId}`));
                                } else {
                                  // Deselect all candidates in this job
                                  jobCandidates.forEach(c => newSet.delete(`${c.id}_${jobId}`));
                                }
                                setSelectedIds(newSet);
                              }}
                            />
                          </TableHead>
                          <TableHead>Candidate</TableHead>
                          <TableHead>Resume ATS Score</TableHead>
                          <TableHead>Assessment</TableHead>
                          <TableHead>Interview</TableHead>
                          <TableHead>Applied</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {jobCandidates.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              No candidates in this job group.
                            </TableCell>
                          </TableRow>
                        ) : (
                          jobCandidates.map((candidate, index) => (
                            <motion.tr
                              key={candidate.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className={`group ${selectedIds.has(`${candidate.id}_${jobId}`) ? 'bg-primary/5' : ''}`}
                            >
                              <TableCell>
                                <Checkbox
                                  checked={selectedIds.has(`${candidate.id}_${jobId}`)}
                                  onCheckedChange={() => toggleSelect(candidate.id, jobId)}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-3">
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
                              </TableCell>
                              <TableCell>
                                {typeof (candidate as any).ats_score === 'number' ? (
                                  <div className="flex items-center gap-2">
                                    <ScoreBadge score={(candidate as any).ats_score} />
                                    {(candidate as any).shortlisted && (
                                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-success/10 text-success font-medium">
                                        Shortlisted
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Not screened</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  const candidateAnalytics = analytics?.find(a => a.candidate_id === candidate.id && a.job_id === jobId);
                                  const rawStatus = candidateAnalytics?.assessment_status;
                                  const status = rawStatus === 'completed' || rawStatus === 'terminated'
                                    ? 'completed'
                                    : rawStatus === 'in_progress'
                                      ? 'in_progress'
                                      : 'pending';
                                  return <StatusBadge status={status} />;
                                })()}
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  const candidateAnalytics = analytics?.find(a => a.candidate_id === candidate.id && a.job_id === jobId);
                                  const rawStatus = candidateAnalytics?.interview_status;
                                  const status = rawStatus === 'completed' || rawStatus === 'terminated'
                                    ? 'completed'
                                    : rawStatus === 'in_progress'
                                      ? 'in_progress'
                                      : 'pending';
                                  return <StatusBadge status={status} />;
                                })()}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {candidate.applied_at
                                  ? new Date(candidate.applied_at).toLocaleDateString()
                                  : new Date(candidate.created_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem asChild>
                                      <Link to={`/candidates/${candidate.id}${jobId ? `?job_id=${jobId}` : ''}`}>
                                        <Eye className="mr-2 h-4 w-4" />
                                        View Details
                                      </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => {
                                      setSelectedIds(new Set([`${candidate.id}_${jobId}`]));
                                      setStartJobId(jobId);
                                      setAssessmentDialogOpen(true);
                                    }}>
                                      <FileText className="mr-2 h-4 w-4" />
                                      Send Assessment
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => {
                                      setSelectedIds(new Set([`${candidate.id}_${jobId}`]));
                                      setStartJobId(jobId);
                                      setInterviewDialogOpen(true);
                                    }}>
                                      <Play className="mr-2 h-4 w-4" />
                                      Send AI Interview
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => {
                                      navigate(`/candidates/${candidate.id}?job_id=${encodeURIComponent(jobId)}&tab=manual`);
                                    }}>
                                      <MessageSquare className="mr-2 h-4 w-4" />
                                      Manual Interview
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => {
                                        setCandidateToDelete({ id: candidate.id, jobId });
                                        setDeleteDialogOpen(true);
                                      }}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </motion.tr>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>

        {/* Assessment Invite Dialog */}
        <Dialog open={assessmentDialogOpen} onOpenChange={setAssessmentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Assessment Invites</DialogTitle>
              <DialogDescription>
                Send technical assessment invitations to {selectedIds.size} selected candidate(s).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Include Technical MCQs</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={includeMcq} onCheckedChange={(v) => setIncludeMcq(!!v)} />
                    <span className="text-sm text-muted-foreground">Enable MCQ section</span>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    value={mcqCount}
                    onChange={(e) => setMcqCount(Math.max(0, Number(e.target.value) || 0))}
                    disabled={!includeMcq}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Include Coding Challenges</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={includeCoding} onCheckedChange={(v) => setIncludeCoding(!!v)} />
                    <span className="text-sm text-muted-foreground">Enable coding section</span>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    value={codingCount}
                    onChange={(e) => setCodingCount(Math.max(0, Number(e.target.value) || 0))}
                    disabled={!includeCoding}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Overall Difficulty</Label>
                <Select value={assessmentDifficulty} onValueChange={(v: 'easy' | 'medium' | 'hard') => setAssessmentDifficulty(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Time Limit (Minutes)</Label>
                <Input
                  type="number"
                  min={15}
                  max={300}
                  placeholder="Auto-calculate based on questions and difficulty"
                  value={totalTimeMinutes}
                  onChange={(e) => setTotalTimeMinutes(e.target.value ? Number(e.target.value) : '')}
                />
                <div className="text-xs text-muted-foreground">
                  Leave empty to auto-calculate based on difficulty:
                  <br />
                  • Easy: 1 min/MCQ + 15 min/Coding
                  <br />
                  • Medium: 1.5 min/MCQ + 20 min/Coding
                  <br />
                  • Hard: 2 min/MCQ + 30 min/Coding
                </div>
              </div>

              <div className="space-y-2">
                <Label>Deadline (Required)</Label>
                <Input
                  type="datetime-local"
                  required
                  value={assessmentDeadline}
                  onChange={(e) => setAssessmentDeadline(e.target.value)}
                  min={new Date(Date.now() + 3600000).toISOString().slice(0, 16)}
                />
                <div className="text-xs text-muted-foreground">
                  Select the date and time when this assessment will expire.
                  Candidates will not be able to access the assessment after this deadline.
                </div>
              </div>

              <div className="text-sm text-muted-foreground mt-4">
                Candidates will receive an email with a link to complete the technical assessment.
                You can configure question counts, difficulty, and time limits for this invite.
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAssessmentDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={sendAssessmentInvites} disabled={!selectedJobId || sendingInvites}>
                {sendingInvites ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
                ) : (
                  <><Mail className="mr-2 h-4 w-4" />Send Invites</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Interview Invite Dialog */}
        <Dialog open={interviewDialogOpen} onOpenChange={setInterviewDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Interview Invites</DialogTitle>
              <DialogDescription>
                {interviewMode === 'ai' 
                  ? `Send AI interview invitations to ${selectedIds.size} selected candidate(s).`
                  : `Set manual interview mode for ${selectedIds.size} selected candidate(s).`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Interview Mode</Label>
                <Select value={interviewMode} onValueChange={(v: 'ai' | 'manual') => setInterviewMode(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ai">AI Interview (Automated)</SelectItem>
                    <SelectItem value="manual">Manual Interview (Outside Platform)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {interviewMode === 'ai' 
                    ? 'Candidates will complete an AI-powered interview with speech recognition and camera proctoring.'
                    : 'You will conduct interviews outside the platform and manually enter scores later.'}
                </p>
              </div>

              {interviewMode === 'ai' && (
                <>
                  <div className="space-y-2">
                    <Label>Number of Questions (Max: 30)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={interviewQuestionCount}
                      onChange={(e) => setInterviewQuestionCount(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Candidates will answer {interviewQuestionCount} question{interviewQuestionCount !== 1 ? 's' : ''} in the interview.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Difficulty Level</Label>
                    <Select value={interviewDifficulty} onValueChange={(v: 'easy' | 'medium' | 'hard') => setInterviewDifficulty(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Deadline (Required)</Label>
                    <Input
                      type="datetime-local"
                      required
                      value={interviewDeadline}
                      onChange={(e) => setInterviewDeadline(e.target.value)}
                      min={new Date(Date.now() + 3600000).toISOString().slice(0, 16)}
                    />
                    <div className="text-xs text-muted-foreground">
                      Select the date and time when this interview will expire.
                      Candidates will not be able to access the interview after this deadline.
                    </div>
                  </div>
                </>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setInterviewDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={sendInterviewInvites} disabled={!selectedJobId || sendingInvites}>
                {sendingInvites ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
                ) : (
                  interviewMode === 'ai' 
                    ? <><Play className="mr-2 h-4 w-4" />Send Invites</>
                    : <><CheckSquare className="mr-2 h-4 w-4" />Set Manual Mode</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={startDialogOpen} onOpenChange={setStartDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Interview Session</DialogTitle>
              <DialogDescription>Start an interview session for the selected candidate.</DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button
                type="button"
                onClick={handleCreateAndStart}
                disabled={!startCandidateId || !startJobId || createInterview.isPending || startInterview.isPending}
              >
                {(createInterview.isPending || startInterview.isPending) ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  'Start Interview'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the candidate
                and remove their data from our servers, including any assessment or interview records.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setCandidateToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (candidateToDelete) {
                    deleteCandidate.mutate({ id: candidateToDelete.id, jobId: candidateToDelete.jobId });
                    setCandidateToDelete(null);
                  }
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
