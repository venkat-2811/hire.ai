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
  UserX,
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
import { useCandidates, useDeleteCandidate, useUnassignedCandidates } from '@/hooks/useCandidates';
import { useCreateInterview, useStartInterview, useInterviews } from '@/hooks/useInterviews';
import { useJobs } from '@/hooks/useJobs';
import { useCandidateAnalytics } from '@/hooks/useAnalytics';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { assessmentsApi } from '@/lib/api';
import { aiInterviewApi } from '@/lib/api';
import { candidatesWorkflowApi, candidatesApi } from '@/lib/api';
import { EditCandidateModal } from '@/components/ui/EditCandidateModal';
import { Pencil } from 'lucide-react';
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
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string>('');

  const [activeTab, setActiveTab] = useState<'active' | 'unassigned'>('active');

  const { data: candidates, isLoading: candidatesLoading, refetch: refetchCandidates } = useCandidates();
  const { data: unassignedCandidates, isLoading: unassignedLoading } = useUnassignedCandidates();
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
  const [includeSql, setIncludeSql] = useState(false);
  const [sqlCount, setSqlCount] = useState(1);
  // Apex (Salesforce) section — only shown when job.include_apex_assessment = true
  const [includeApex, setIncludeApex] = useState(false);
  const [apexCount, setApexCount] = useState(3);
  const [totalTimeMinutes, setTotalTimeMinutes] = useState<number | ''>('');
  const [interviewQuestionCount, setInterviewQuestionCount] = useState(5);
  const [interviewDifficulty, setInterviewDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [interviewMode, setInterviewMode] = useState<'ai' | 'manual'>('ai');
  const [interviewTimeLimit, setInterviewTimeLimit] = useState<number | undefined>(undefined);
  // Focus Areas state
  const [assessmentFocusAreas, setAssessmentFocusAreas] = useState('');
  const [assessmentStrictFocus, setAssessmentStrictFocus] = useState(false);
  const [interviewFocusAreas, setInterviewFocusAreas] = useState('');
  const [interviewStrictFocus, setInterviewStrictFocus] = useState(false);
  const [manualScore, setManualScore] = useState<string>('');
  const [manualFeedback, setManualFeedback] = useState<string>('');
  const [manualNotes, setManualNotes] = useState<string>('');

  // Deadline defaults to 48 hours from now, rounded UP to the next 10-minute interval.
  // e.g. 01:13 → 48h later at 01:20 | 01:51 → 48h later at 02:00
  const getDefault48hDeadline = () => {
    const d = new Date(Date.now() + 48 * 3600000);
    const minutes = d.getMinutes();
    const remainder = minutes % 10;
    if (remainder !== 0) {
      d.setMinutes(minutes + (10 - remainder));
    }
    d.setSeconds(0);
    d.setMilliseconds(0);
    // Format as YYYY-MM-DDTHH:MM for datetime-local input
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const [assessmentDeadline, setAssessmentDeadline] = useState(getDefault48hDeadline);
  const [interviewDeadline, setInterviewDeadline] = useState(getDefault48hDeadline);

  // Strict minute enforcer — even if the browser allows typing a non-10 multiple, snap it
  const handleStrictDeadlineChange = (val: string, setter: (value: string) => void) => {
    if (!val) {
      setter(val);
      return;
    }
    const d = new Date(val);
    if (isNaN(d.getTime())) {
      setter(val);
      return;
    }
    const m = d.getMinutes();
    const remainder = m % 10;
    if (remainder !== 0) {
      // Round to nearest 10
      d.setMinutes(m + (remainder >= 5 ? 10 - remainder : -remainder));
    }
    d.setSeconds(0);
    d.setMilliseconds(0);
    const pad = (n: number) => String(n).padStart(2, '0');
    setter(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
  };

  // Delete Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [candidateToDelete, setCandidateToDelete] = useState<{ id: string; jobId: string } | null>(null);

  // Edit Candidate State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [candidateToEdit, setCandidateToEdit] = useState<any | null>(null);

  const activeJobs = useMemo(() => (jobs || []).filter(j => j.is_active), [jobs]);
  const allJobs = useMemo(() => jobs || [], [jobs]);
  const selectedJob = useMemo(() => allJobs.find((j) => j.id === selectedJobId) || null, [allJobs, selectedJobId]);

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
            comparison = (a.ats_score || 0) - (b.ats_score || 0);
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

    const isSalesforce = selectedJob?.is_salesforce_job || selectedJob?.include_apex_assessment;

    if (!includeMcq && (isSalesforce ? !includeApex : !includeCoding) && !includeSql) {
      toast.error('Please enable at least one section (MCQ, Coding, SQL, or Apex)');
      return;
    }

    if (!assessmentDeadline) {
      toast.error('Please select a deadline for the assessment');
      return;
    }

    if (includeMcq && mcqCount < 1) {
      toast.error('QUESTIONS SHOULD BE EQUAL TO OR GREATER THAN 1');
      return;
    }
    
    if (!isSalesforce && includeCoding && codingCount < 1) {
      toast.error('QUESTIONS SHOULD BE EQUAL TO OR GREATER THAN 1');
      return;
    }
    
    if (includeSql && sqlCount < 1) {
      toast.error('QUESTIONS SHOULD BE EQUAL TO OR GREATER THAN 1');
      return;
    }

    const deadlineDate = new Date(assessmentDeadline);
    if (deadlineDate <= new Date()) {
      toast.error('Deadline must be in the future');
      return;
    }

    setSendingInvites(true);
    try {
      const data = await assessmentsApi.invite({
        candidate_ids: Array.from(selectedIds).map(id => id.split('_')[0]),
        job_id: selectedJobId,
        deadline: deadlineDate.toISOString(),
        mcq_question_count: includeMcq ? mcqCount : 0,
        coding_challenge_count: (!isSalesforce && includeCoding) ? codingCount : 0,
        difficulty: assessmentDifficulty,
        include_mcq: includeMcq,
        include_coding: isSalesforce ? false : includeCoding,
        include_sql: includeSql,
        sql_question_count: includeSql ? sqlCount : 0,
        include_apex: isSalesforce ? includeApex : false,
        apex_question_count: (isSalesforce && includeApex) ? apexCount : 0,
        total_time_minutes: totalTimeMinutes || undefined,
        focus_areas: assessmentFocusAreas.trim() || undefined,
        strict_focus: assessmentStrictFocus || undefined,
      });
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
    setInterviewMode('ai');
    setStartJobId(selectedJobId);
    setInterviewDialogOpen(true);
  };

  const handleBulkManualInterview = () => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one candidate');
      return;
    }
    if (!selectedJobId) {
      toast.error('Please select a job');
      return;
    }
    setStartJobId(selectedJobId);
    setInterviewMode('manual');
    setInterviewDialogOpen(true);
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
      if (interviewMode === 'manual') {
        if (!manualScore || manualScore.trim() === '') {
          toast.error('Score is required for manual interview');
          setSendingInvites(false);
          return;
        }
        const scoreVal = Number(manualScore);
        if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > 100) {
          toast.error('Score must be a number between 0 and 100');
          setSendingInvites(false);
          return;
        }

        const candidateIds = Array.from(selectedIds).map(id => id.split('_')[0]);
        await Promise.all(
          candidateIds.map(candidateId =>
            candidatesApi.updateManualInterview(candidateId, selectedJobId, {
              interview_mode: 'manual',
              manual_interview_score: scoreVal,
              manual_interview_feedback: manualFeedback || null,
              manual_interview_notes: manualNotes || null,
            })
          )
        );
        toast.success(`Manual interview evaluation saved for ${candidateIds.length} candidate(s)`);
        setManualScore('');
        setManualFeedback('');
        setManualNotes('');
      } else {
        // AI interview flow
        if (!interviewDeadline) {
          toast.error('Please select a deadline for the interview');
          setSendingInvites(false);
          return;
        }
        const deadlineDate = new Date(interviewDeadline);
        if (deadlineDate <= new Date()) {
          toast.error('Deadline must be in the future');
          setSendingInvites(false);
          return;
        }

        const data = await aiInterviewApi.invite({
          candidate_ids: Array.from(selectedIds).map(id => id.split('_')[0]),
          job_id: selectedJobId,
          question_count: interviewQuestionCount,
          difficulty: interviewDifficulty,
          deadline: deadlineDate.toISOString(),
          focus_areas: interviewFocusAreas.trim() || undefined,
          strict_focus: interviewStrictFocus || undefined,
        });
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
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Tab switcher */}
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setActiveTab('active')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === 'active'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:text-foreground'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                Active
              </button>
              <button
                onClick={() => setActiveTab('unassigned')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors border-l border-border ${
                  activeTab === 'unassigned'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:text-foreground'
                }`}
              >
                <UserX className="h-3.5 w-3.5" />
                Unassigned
                {(unassignedCandidates?.length ?? 0) > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400">
                    {unassignedCandidates!.length}
                  </span>
                )}
              </button>
            </div>
            <Button asChild className="w-full sm:w-auto">
              <Link to="/candidates/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Candidate
              </Link>
            </Button>
          </div>
        </div>

        {activeTab === 'active' && (
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
        )}

        {/* Filters */}
        {activeTab === 'active' && (
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
        )}

        {/* Bulk Actions */}
        {activeTab === 'active' && selectedIds.size > 0 && (
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
        {activeTab === 'active' && (
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
                                  const score = candidateAnalytics?.assessment_score;
                                  if (status === 'completed' && typeof score === 'number') {
                                    return (
                                      <div className="flex items-center gap-2">
                                        <ScoreBadge score={score} />
                                        <StatusBadge status={status} />
                                      </div>
                                    );
                                  }
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
                                  const score = candidateAnalytics?.interview_score;
                                  if (status === 'completed' && typeof score === 'number') {
                                    return (
                                      <div className="flex items-center gap-2">
                                        <ScoreBadge score={score} />
                                        <StatusBadge status={status} />
                                      </div>
                                    );
                                  }
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
                                    {(candidate as any).applied_at && (
                                      <DropdownMenuItem onClick={() => {
                                        setCandidateToEdit(candidate);
                                        setEditModalOpen(true);
                                      }}>
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Edit Details
                                      </DropdownMenuItem>
                                    )}
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
                                      setInterviewMode('ai');
                                      setInterviewDialogOpen(true);
                                    }}>
                                      <Play className="mr-2 h-4 w-4" />
                                      Send AI Interview
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => {
                                      setSelectedIds(new Set([`${candidate.id}_${jobId}`]));
                                      setStartJobId(jobId);
                                      setInterviewMode('manual');
                                      setInterviewDialogOpen(true);
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
        )}

        {/* ── Unassigned Candidates ─────────────────────────────── */}
        {activeTab === 'unassigned' && (
          <div className="space-y-4">
            {unassignedLoading ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3" />
                  Loading unassigned candidates…
                </CardContent>
              </Card>
            ) : !unassignedCandidates || unassignedCandidates.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <UserX className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
                  <p className="text-muted-foreground font-medium">No unassigned candidates</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Candidates from deleted jobs will appear here with their full history preserved.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/10 rounded-lg">
                      <UserX className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Unassigned Candidates</CardTitle>
                      <CardDescription>
                        {unassignedCandidates.length} candidate(s) from deleted jobs — all assessment data preserved
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Candidate</TableHead>
                        <TableHead>Previous Role</TableHead>
                        <TableHead>Resume ATS Score</TableHead>
                        <TableHead>Applied</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unassignedCandidates.map((candidate: any, index: number) => (
                        <motion.tr
                          key={`${candidate.id}_${candidate.job_id}`}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.04 }}
                          className="group"
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                                <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                                  {candidate.full_name.split(' ').map((n: string) => n[0]).join('')}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium">{candidate.full_name}</p>
                                <p className="text-sm text-muted-foreground">{candidate.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">
                                {candidate.previous_job_title || 'Unknown Job'}
                              </span>
                              {candidate.previous_job_role && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                                  {candidate.previous_job_role}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {typeof candidate.ats_score === 'number' ? (
                              <ScoreBadge score={candidate.ats_score} />
                            ) : (
                              <span className="text-xs text-muted-foreground">Not screened</span>
                            )}
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
                                  <Link to={`/candidates/${candidate.id}${candidate.job_id ? `?job_id=${candidate.job_id}` : ''}`}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Details
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => {
                                    setCandidateToDelete({ id: candidate.id, jobId: candidate.job_id });
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
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <Dialog open={assessmentDialogOpen} onOpenChange={setAssessmentDialogOpen}>
          <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Send Assessment Invites</DialogTitle>
              <DialogDescription>
                Send technical assessment invitations to {selectedIds.size} selected candidate(s).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Include Technical MCQs</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={includeMcq}
                      onCheckedChange={(v) => setIncludeMcq(!!v)}
                    />
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
                {(selectedJob?.is_salesforce_job || selectedJob?.include_apex_assessment) ? (
                  <div className="space-y-2">
                    <Label>Include Apex Fill-in-the-Blanks</Label>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={includeApex}
                        onCheckedChange={(v) => setIncludeApex(!!v)}
                      />
                      <span className="text-sm text-muted-foreground">Enable Apex section</span>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={apexCount}
                      onChange={(e) => setApexCount(Math.max(1, Number(e.target.value) || 1))}
                      disabled={!includeApex}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Include Coding Challenges (DSA)</Label>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={includeCoding}
                        onCheckedChange={(v) => setIncludeCoding(!!v)}
                      />
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
                )}

                <div className="space-y-2">
                  <Label>Include SQL Assessment</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={includeSql}
                      onCheckedChange={(v) => setIncludeSql(!!v)}
                    />
                    <span className="text-sm text-muted-foreground">Enable SQL section</span>
                  </div>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    value={sqlCount}
                    onChange={(e) => setSqlCount(Math.max(0, Number(e.target.value) || 0))}
                    disabled={!includeSql}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
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
                    placeholder="Auto-calculate"
                    value={totalTimeMinutes}
                    onChange={(e) => setTotalTimeMinutes(e.target.value ? Number(e.target.value) : '')}
                  />
                  <div className="text-[10px] text-muted-foreground leading-tight">
                    Leave empty to auto-calculate:
                    <br />
                    • Easy: 1m/MCQ + 15m/Code
                    <br />
                    • Med: 1.5m/MCQ + 20m/Code
                    <br />
                    • Hard: 2m/MCQ + 30m/Code
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Deadline (Required)</Label>
                  <Input
                    type="datetime-local"
                    required
                    step={600}
                    value={assessmentDeadline}
                    onChange={(e) => handleStrictDeadlineChange(e.target.value, setAssessmentDeadline)}
                    min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                  />
                  <div className="text-[10px] text-muted-foreground leading-tight">
                   Default: 48h from now. The link will expire after this deadline.
                    Candidates who miss it get 0.
                  </div>
                </div>
              </div>

              {/* Focus Areas — Assessment */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  Question Focus Areas
                  <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
                </Label>
                <textarea
                  id="assessment-focus-areas"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                  maxLength={1000}
                  placeholder={`e.g. FastAPI, REST APIs, JWT Authentication\ne.g. React Hooks, State Management, Redux\ne.g. AWS Lambda, API Gateway, DynamoDB`}
                  value={assessmentFocusAreas}
                  onChange={(e) => setAssessmentFocusAreas(e.target.value)}
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Questions will be primarily generated around these topics.</p>
                  <span className="text-xs text-muted-foreground">{assessmentFocusAreas.length}/1000</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Checkbox
                    id="assessment-strict-focus"
                    checked={assessmentStrictFocus}
                    onCheckedChange={(v) => setAssessmentStrictFocus(!!v)}
                  />
                  <label htmlFor="assessment-strict-focus" className="text-sm cursor-pointer select-none">
                    Strictly Prioritize Focus Areas
                    <span className="ml-1.5 text-xs text-muted-foreground">(80%+ questions from focus areas)</span>
                  </label>
                </div>
              </div>

              <div className="text-sm text-muted-foreground mt-4">
                Candidates will receive an email with a link and the deadline clearly displayed.
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
          <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Send Interview Invites</DialogTitle>
              <DialogDescription>
                {interviewMode === 'ai' 
                  ? `Send AI interview invitations to ${selectedIds.size} selected candidate(s).`
                  : `Set manual interview mode for ${selectedIds.size} selected candidate(s).`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: Basic Settings */}
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
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Questions (Max: 30)</Label>
                          <Input
                            type="number"
                            min={1}
                            max={30}
                            value={interviewQuestionCount}
                            onChange={(e) => setInterviewQuestionCount(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                          />
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
                      </div>

                      <div className="space-y-2">
                        <Label>Interview Time Limit (Minutes)</Label>
                        <Input
                          type="number"
                          min={5}
                          max={180}
                          step={5}
                          value={interviewTimeLimit || ''}
                          onChange={(e) => setInterviewTimeLimit(e.target.value ? Number(e.target.value) : undefined)}
                          placeholder="Calculated automatically if empty"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Default is 2 minutes per question.
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Right Column: Customizations & Deadline */}
                <div className="space-y-4">
                  {interviewMode === 'ai' ? (
                    <>
                      {/* Focus Areas — Interview */}
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1.5">
                          Question Focus Areas
                          <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
                        </Label>
                        <textarea
                          id="interview-focus-areas"
                          className="flex min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                          maxLength={1000}
                          placeholder={`e.g. FastAPI, REST APIs, JWT Authentication\ne.g. React Hooks, State Management, Redux`}
                          value={interviewFocusAreas}
                          onChange={(e) => setInterviewFocusAreas(e.target.value)}
                        />
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>Focus questions around these topics.</span>
                          <span>{interviewFocusAreas.length}/1000</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Checkbox
                            id="interview-strict-focus"
                            checked={interviewStrictFocus}
                            onCheckedChange={(v) => setInterviewStrictFocus(!!v)}
                          />
                          <label htmlFor="interview-strict-focus" className="text-xs cursor-pointer select-none font-medium leading-none">
                            Strictly Prioritize Focus Areas
                          </label>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Deadline (Required)</Label>
                        <Input
                          type="datetime-local"
                          required
                          step={600}
                          value={interviewDeadline}
                          onChange={(e) => handleStrictDeadlineChange(e.target.value, setInterviewDeadline)}
                          min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                        />
                        <p className="text-[11px] text-muted-foreground leading-tight">
                          Default is 48 hours. The link will expire after this deadline.
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Overall Score (0-100) *</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={manualScore}
                          onChange={(e) => setManualScore(e.target.value)}
                          placeholder="e.g. 85"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Detailed Feedback</Label>
                        <textarea
                          className="flex min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                          placeholder="Enter candidate evaluation feedback..."
                          value={manualFeedback}
                          onChange={(e) => setManualFeedback(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Internal Notes</Label>
                        <textarea
                          className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                          placeholder="Private notes (optional)..."
                          value={manualNotes}
                          onChange={(e) => setManualNotes(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setInterviewDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={sendInterviewInvites} disabled={!selectedJobId || sendingInvites}>
                {sendingInvites ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                ) : (
                  interviewMode === 'ai' 
                    ? <><Play className="mr-2 h-4 w-4" />Send Invites</>
                    : <><CheckSquare className="mr-2 h-4 w-4" />Save Evaluation</>
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
              <AlertDialogTitle>Permanently Delete Candidate?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>This action <strong className="text-foreground">cannot be undone</strong>. All data for this candidate will be permanently removed, including:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Assessment sessions, scores &amp; responses</li>
                    <li>AI &amp; manual interview records &amp; evaluations</li>
                    <li>ATS screening results &amp; recommendations</li>
                    <li>All job application mappings &amp; statuses</li>
                  </ul>
                  <p>If this candidate is re-onboarded for the same role, they will be treated as a completely fresh candidate with no prior history.</p>
                </div>
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
                Delete Permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit Candidate Modal */}
        <EditCandidateModal
          candidate={candidateToEdit}
          open={editModalOpen}
          onOpenChange={(open) => {
            setEditModalOpen(open);
            if (!open) setCandidateToEdit(null);
          }}
          onUpdated={() => { void refetchCandidates(); }}
        />
      </div>
    </DashboardLayout>
  );
}
