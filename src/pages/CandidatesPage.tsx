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
  Copy,
  Check,
  Link2,
  UserPlus,
  Code,
  ThumbsUp,
  ThumbsDown,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ScoreBadge } from '@/components/ui/score-badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { RoleBadge } from '@/components/ui/role-badge';
import { Badge } from '@/components/ui/badge';
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
import { useCandidates, useDeleteCandidate, useUnassignedCandidates, useBulkDeleteCandidates } from '@/hooks/useCandidates';
import { useCreateInterview, useStartInterview, useInterviews } from '@/hooks/useInterviews';
import { useJobs } from '@/hooks/useJobs';
import { useCandidateAnalytics } from '@/hooks/useAnalytics';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { assessmentsApi } from '@/lib/api';
import { aiInterviewApi } from '@/lib/api';
import { candidatesWorkflowApi, candidatesApi, analyticsApi, type CandidateAnalytics } from '@/lib/api';
import { EditCandidateModal } from '@/components/ui/EditCandidateModal';
import { Pencil } from 'lucide-react';
import { HireRecommendation } from '@/types/database';
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

type SortField = 'name' | 'date' | 'score' | 'average';
type SortOrder = 'asc' | 'desc';

const CANDIDATES_JOB_KEY = 'candidates_selected_job_id';

export default function CandidatesPage() {
  const { loading: authLoading } = useRequireAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRecommendation, setFilterRecommendation] = useState<string>('all');
  const [selectedJobId, setSelectedJobId] = useState<string>(
    () => sessionStorage.getItem(CANDIDATES_JOB_KEY) || ''
  );

  // Persist the selected job ID so it survives navigation (e.g. back from candidate details)
  const handleJobChange = (jobId: string) => {
    sessionStorage.setItem(CANDIDATES_JOB_KEY, jobId);
    setSelectedJobId(jobId);
  };

  const [activeTab, setActiveTab] = useState<'active' | 'unassigned'>('active');

  const { data: candidates, isLoading: candidatesLoading, refetch: refetchCandidates } = useCandidates();
  const { data: unassignedCandidates, isLoading: unassignedLoading } = useUnassignedCandidates();
  const deleteCandidate = useDeleteCandidate();
  const bulkDeleteCandidates = useBulkDeleteCandidates();
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

  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  // ── Results / Stats state ─────────────────────────────────────────────────
  const [globalCandidates, setGlobalCandidates] = useState<CandidateAnalytics[]>([]);
  const [loadingGlobalResults, setLoadingGlobalResults] = useState(false);
  const [acceptedCandidateIds, setAcceptedCandidateIds] = useState<Set<string>>(new Set());
  const [rejectedCandidateIds, setRejectedCandidateIds] = useState<Set<string>>(new Set());
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  const [sendingAcceptReject, setSendingAcceptReject] = useState(false);

  // Load global candidates once for summary stats
  useEffect(() => {
    async function loadGlobalResults() {
      setLoadingGlobalResults(true);
      try {
        const data = await analyticsApi.getCandidates();
        setGlobalCandidates(data);
      } catch (e) {
        console.error('Error loading global candidates', e);
      } finally {
        setLoadingGlobalResults(false);
      }
    }
    loadGlobalResults();
  }, []);

  // Seed accepted/rejected from analytics when analytics data loads
  useEffect(() => {
    if (!analytics) return;
    const accepted = new Set<string>();
    const rejected = new Set<string>();
    analytics.forEach((c) => {
      if (c.final_status === 'accepted' || c.final_status === 'offer_sent' || c.final_status === 'offer_accepted') {
        accepted.add(`${c.candidate_id}_${c.job_id}`);
      } else if (c.final_status === 'rejected') {
        rejected.add(`${c.candidate_id}_${c.job_id}`);
      }
    });
    setAcceptedCandidateIds(accepted);
    setRejectedCandidateIds(rejected);
  }, [analytics]);

  // Stats derived from global candidates
  const globalTotalCandidates = useMemo(() => {
    const s = new Set<string>();
    globalCandidates.forEach((c) => { if (c.candidate_id) s.add(c.candidate_id); });
    return s.size;
  }, [globalCandidates]);

  const globalAvgTotalScore = useMemo(() => {
    if (!globalCandidates.length) return 0;
    let sum = 0; let count = 0;
    globalCandidates.forEach((c) => {
      const scores = [c.ats_score, c.assessment_score, c.interview_score].filter((s) => s !== null) as number[];
      if (scores.length) { sum += scores.reduce((a, b) => a + b, 0) / scores.length; count++; }
    });
    return count ? sum / count : 0;
  }, [globalCandidates]);

  const globalHiresCount = useMemo(() =>
    globalCandidates.filter((c) => c.final_status === 'accepted' || c.final_status === 'offer_sent' || c.final_status === 'offer_accepted').length,
    [globalCandidates]);

  const globalRejectionsCount = useMemo(() =>
    globalCandidates.filter((c) => c.final_status === 'rejected').length,
    [globalCandidates]);

  // Recommendation badge renderer
  const getRecommendationBadge = (recommendation: string | null | undefined) => {
    if (!recommendation) return <Badge variant="outline" className="w-fit whitespace-nowrap">Pending</Badge>;
    const normalized = recommendation as HireRecommendation;
    switch (normalized) {
      case 'strong_hire': return <Badge className="bg-success text-success-foreground w-fit whitespace-nowrap">Strong Hire</Badge>;
      case 'hire': return <Badge className="bg-info text-info-foreground w-fit whitespace-nowrap">Hire</Badge>;
      case 'borderline': return <Badge variant="secondary" className="w-fit whitespace-nowrap">Borderline</Badge>;
      case 'maybe': return <Badge variant="secondary" className="w-fit whitespace-nowrap">Maybe</Badge>;
      case 'no_hire': return <Badge variant="destructive" className="w-fit whitespace-nowrap">No Hire</Badge>;
      default: return <Badge variant="outline" className="w-fit whitespace-nowrap">{recommendation}</Badge>;
    }
  };

  // Check if any selected candidate has an incomplete evaluation
  const hasIncompleteEvaluation = useMemo(() => {
    return Array.from(selectedIds).some(key => {
      const candidateId = key.split('_')[0];
      const c = analytics?.find(a => a.candidate_id === candidateId);
      if (!c) return false;
      return typeof c.assessment_score !== 'number' || typeof c.interview_score !== 'number';
    });
  }, [selectedIds, analytics]);

  // Accept handler
  const sendAcceptanceEmails = async (sendEmail: boolean) => {
    if (selectedIds.size === 0) return;
    if (!selectedJobId) { toast.error('Please select a job first'); return; }
    setSendingAcceptReject(true);
    try {
      const candidateIds = Array.from(selectedIds).map(id => id.split('_')[0]);
      const data = await candidatesWorkflowApi.sendAcceptance({
        candidate_ids: candidateIds,
        job_id: selectedJobId,
        send_email: sendEmail,
      });
      if (data?.error_messages?.length) {
        toast.error(`Some updates failed: ${data.error_messages[0]}`);
      } else {
        if (sendEmail) {
          toast.success(`Acceptance emails sent to ${data.emails_sent} candidate(s)`);
        } else {
          toast.success(`Shortlisted status updated for ${(data as any).statuses_updated ?? candidateIds.length} candidate(s) (no email sent)`);
        }
        const newAccepted = new Set(acceptedCandidateIds);
        candidateIds.forEach((id) => newAccepted.add(`${id}_${selectedJobId}`));
        setAcceptedCandidateIds(newAccepted);
        // Remove from rejected if previously rejected
        const newRejected = new Set(rejectedCandidateIds);
        candidateIds.forEach((id) => newRejected.delete(`${id}_${selectedJobId}`));
        setRejectedCandidateIds(newRejected);
      }
      setAcceptDialogOpen(false);
      setSelectedIds(new Set());
    } catch (e) {
      toast.error('Failed to update candidate status');
    } finally {
      setSendingAcceptReject(false);
    }
  };

  // Reject handler
  const sendRejectionEmails = async (sendEmail: boolean) => {
    if (selectedIds.size === 0) return;
    if (!selectedJobId) { toast.error('Please select a job first'); return; }
    setSendingAcceptReject(true);
    try {
      const candidateIds = Array.from(selectedIds).map(id => id.split('_')[0]);
      const data = await candidatesWorkflowApi.sendRejection({
        candidate_ids: candidateIds,
        job_id: selectedJobId,
        send_email: sendEmail,
      });
      if (data?.error_messages?.length) {
        toast.error(`Some updates failed: ${data.error_messages[0]}`);
      } else {
        if (sendEmail) {
          toast.success('Rejection emails sent');
        } else {
          toast.success(`Rejected status updated for ${(data as any).statuses_updated ?? candidateIds.length} candidate(s) (no email sent)`);
        }
        const newRejected = new Set(rejectedCandidateIds);
        candidateIds.forEach((id) => newRejected.add(`${id}_${selectedJobId}`));
        setRejectedCandidateIds(newRejected);
        // Remove from accepted if previously accepted
        const newAccepted = new Set(acceptedCandidateIds);
        candidateIds.forEach((id) => newAccepted.delete(`${id}_${selectedJobId}`));
        setAcceptedCandidateIds(newAccepted);
      }
      setRejectDialogOpen(false);
      setSelectedIds(new Set());
    } catch (e) {
      toast.error('Failed to update candidate status');
    } finally {
      setSendingAcceptReject(false);
    }
  };

  const hasCandidates = useMemo(() => {
    if (!selectedJobId || !candidates) return false;
    return candidates.some(c => (c as any).job_id === selectedJobId);
  }, [candidates, selectedJobId]);

  const copyJobLink = async (jobId: string) => {
    const link = `${window.location.origin}/apply/${jobId}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLinkId(jobId);
      toast.success('Application link copied to clipboard!');
      setTimeout(() => setCopiedLinkId(null), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const activeJobs = useMemo(() => (jobs || []).filter(j => j.is_active), [jobs]);
  const allJobs = useMemo(() => jobs || [], [jobs]);
  const selectedJob = useMemo(() => allJobs.find((j) => j.id === selectedJobId) || null, [allJobs, selectedJobId]);

  useEffect(() => {
    if (!jobs || jobs.length === 0) return;

    // Only consider active (non-deleted, non-archived) jobs
    const onlyActiveJobs = jobs.filter(j => j.is_active);
    if (onlyActiveJobs.length === 0) return;

    // Check if the currently selected job is still active
    const currentJobStillActive = onlyActiveJobs.some(j => j.id === selectedJobId);

    if (!selectedJobId || !currentJobStillActive) {
      // Pick the most recently created active job
      const latestJob = [...onlyActiveJobs].sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      })[0];

      if (latestJob) {
        sessionStorage.setItem(CANDIDATES_JOB_KEY, latestJob.id);
        setSelectedJobId(latestJob.id);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs]);

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

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter((candidate) => {
        const ca = analytics?.find(a => a.candidate_id === candidate.id && a.job_id === selectedJobId);
        const isAccepted = acceptedCandidateIds.has(`${candidate.id}_${selectedJobId}`);
        const isRejected = rejectedCandidateIds.has(`${candidate.id}_${selectedJobId}`);
        const isOfferAccepted = ca?.final_status === 'offer_accepted';
        const isHired = isAccepted || isOfferAccepted;
        
        if (filterStatus === 'accepted') return isHired;
        if (filterStatus === 'rejected') return isRejected;
        if (filterStatus === 'in_progress') return ca?.assessment_status === 'in_progress' || ca?.interview_status === 'in_progress';
        if (filterStatus === 'pending') return (!ca?.assessment_status || ca?.assessment_status === 'pending') && (!ca?.interview_status || ca?.interview_status === 'pending') && !isHired && !isRejected;
        return true;
      });
    }

    // Apply recommendation filter
    if (filterRecommendation !== 'all') {
      filtered = filtered.filter((candidate) => {
        const ca = analytics?.find(a => a.candidate_id === candidate.id && a.job_id === selectedJobId);
        const rec = ca?.recommendation?.toLowerCase();
        
        if (filterRecommendation === 'hire') return rec === 'hire';
        if (filterRecommendation === 'strong_hire') return rec === 'strong_hire';
        if (filterRecommendation === 'no_hire') return rec === 'no_hire';
        if (filterRecommendation === 'pending') return rec === 'pending' || !rec;
        return true;
      });
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
          case 'average': {
            const getAvg = (c: any) => {
              const ca = analytics?.find(an => an.candidate_id === c.id && an.job_id === jobId);
              const ats = c.ats_score;
              const ass = ca?.assessment_score;
              const int = ca?.interview_score;
              const scs = [ats, ass, int].filter(s => typeof s === 'number') as number[];
              if (scs.length === 0) return -1;
              return scs.reduce((acc, val) => acc + val, 0) / scs.length;
            };
            comparison = getAvg(a) - getAvg(b);
            break;
          }
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
    });

    return grouped;
  }, [candidates, searchQuery, sortField, sortOrder, selectedJobId, analytics, filterStatus, filterRecommendation, acceptedCandidateIds, rejectedCandidateIds]);

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

  const handleActionForJob = (e: React.MouseEvent, jobId: string, action: 'assessment' | 'ai-interview' | 'manual-interview' | 'accept' | 'reject') => {
    e.stopPropagation();
    
    let currentSelectedIds = selectedIds;
    const jobSelectedIds = Array.from(selectedIds).filter(id => id.endsWith(`_${jobId}`));
    if (jobSelectedIds.length !== selectedIds.size) {
      currentSelectedIds = new Set(jobSelectedIds);
      setSelectedIds(currentSelectedIds);
    }
    
    if (currentSelectedIds.size === 0) return;
    
    if (jobId !== selectedJobId) {
      setSelectedJobId(jobId);
    }
    
    if (action === 'assessment') {
      setStartJobId(jobId);
      setAssessmentDialogOpen(true);
    } else if (action === 'ai-interview') {
      setStartJobId(jobId);
      setInterviewMode('ai');
      setInterviewDialogOpen(true);
    } else if (action === 'manual-interview') {
      setStartJobId(jobId);
      setInterviewMode('manual');
      setInterviewDialogOpen(true);
    } else if (action === 'accept') {
      setAcceptDialogOpen(true);
    } else if (action === 'reject') {
      setRejectDialogOpen(true);
    }
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
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${activeTab === 'active'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:text-foreground'
                  }`}
              >
                <Users className="h-3.5 w-3.5" />
                Active
              </button>
              <button
                onClick={() => setActiveTab('unassigned')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors border-l border-border ${activeTab === 'unassigned'
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

        {/* ── Stats Dashboard (from Results) ───────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
          <Card className="h-[88px]">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium leading-tight whitespace-nowrap">Total Jobs</p>
                  <p className="text-2xl font-bold leading-tight tabular-nums mt-1">{jobs?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="h-[88px]">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium leading-tight whitespace-nowrap">Total Candidates</p>
                  <p className="text-2xl font-bold leading-tight tabular-nums mt-1">
                    {loadingGlobalResults ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      globalTotalCandidates
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="h-[88px]">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-info/10 rounded-lg flex items-center justify-center shrink-0">
                  <TrendingUp className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium leading-tight whitespace-nowrap">Avg Overall Score</p>
                  <p className="text-2xl font-bold leading-tight tabular-nums mt-1">
                    {loadingGlobalResults ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      `${globalAvgTotalScore.toFixed(0)}%`
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 h-[88px]"
            onClick={() => navigate('/analytics/pipeline?status=selected')}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center shrink-0">
                    <ThumbsUp className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium leading-tight whitespace-nowrap">Total Hires</p>
                    <p className="text-2xl font-bold leading-tight tabular-nums mt-1">
                      {loadingGlobalResults ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        globalHiresCount
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center text-[10px] text-muted-foreground/70 bg-muted/40 px-1.5 py-1 rounded whitespace-nowrap group-hover:text-foreground/80 transition-colors">
                  View <ChevronRight className="h-3 w-3 ml-0.5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 h-[88px]"
            onClick={() => navigate('/analytics/pipeline?status=rejected')}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-destructive/10 rounded-lg flex items-center justify-center shrink-0">
                    <ThumbsDown className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium leading-tight whitespace-nowrap">Total Rejections</p>
                    <p className="text-2xl font-bold leading-tight tabular-nums mt-1">
                      {loadingGlobalResults ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        globalRejectionsCount
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center text-[10px] text-muted-foreground/70 bg-muted/40 px-1.5 py-1 rounded whitespace-nowrap group-hover:text-foreground/80 transition-colors">
                  View <ChevronRight className="h-3 w-3 ml-0.5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Unified Search, Job, and Filters Toolbar */}
        {activeTab === 'active' && activeJobs.length > 0 && (

          <div className="flex flex-col gap-4 mb-2">
            {/* Single Toolbar Row */}
            <div className="flex flex-col md:flex-row items-center gap-4">
              {/* Search Bar (Left, ~35-40% width) */}
              {hasCandidates ? (
                <div className="relative w-full md:w-[40%]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search candidates..."
                    className="pl-10 w-full border-slate-400 dark:border-slate-800 shadow-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              ) : (
                <div className="hidden md:block md:w-[40%]" />
              )}

              {/* Job Dropdown and Filters */}
              <div className="flex items-center gap-3 w-full md:w-auto md:flex-1">
                <div className="text-sm font-medium whitespace-nowrap text-muted-foreground">JOB:</div>
                <Select value={selectedJobId} onValueChange={(v) => {
                  handleJobChange(v);
                  setSelectedIds(new Set());
                  setStartJobId(v);
                }}>
                  <SelectTrigger className="w-full md:w-[240px] font-medium border-slate-400 dark:border-slate-800 shadow-sm" disabled={jobsLoading || activeJobs.length === 0}>
                    <SelectValue placeholder={jobsLoading ? 'Loading jobs...' : 'Select a job'} />
                  </SelectTrigger>
                  <SelectContent>
                    {activeJobs.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {hasCandidates && (
                  <Button
                    variant={showFilters ? "secondary" : "outline"}
                    size="icon"
                    className="w-10 shrink-0 border-slate-400 dark:border-slate-800 shadow-sm hover:bg-primary hover:text-primary-foreground transition-colors duration-200"
                    onClick={() => setShowFilters(!showFilters)}
                    title="Filters"
                  >
                    <Filter className="h-4 w-4" />
                  </Button>
                )}

                  <Button
                    variant="outline"
                    size="icon"
                    className="w-10 shrink-0 border-slate-400 dark:border-slate-800 shadow-sm hover:bg-primary hover:text-primary-foreground transition-colors duration-200 md:ml-auto"
                    onClick={() => {
                      refetchCandidates();
                      toast.success('Candidates refreshed');
                    }}
                    title="Refresh candidates"
                  >
                    <RefreshCw className={`h-4 w-4 ${candidatesLoading ? 'animate-spin' : ''}`} />
                  </Button>
              </div>
            </div>

            {/* Filters Panel (collapsible) */}
            {showFilters && hasCandidates && (
              <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-border/60">
                <div className="flex items-center gap-2">
                  <Label>Sort by:</Label>
                  <Select value={sortField} onValueChange={(v: SortField) => setSortField(v)}>
                    <SelectTrigger className="w-[140px] border-slate-400 dark:border-slate-800 shadow-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="date">Date Applied</SelectItem>
                      <SelectItem value="score">Score</SelectItem>
                      <SelectItem value="average">Total Average</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="border-slate-400 dark:border-slate-800 shadow-sm"
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  >
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Label>Status:</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[140px] border-slate-400 dark:border-slate-800 shadow-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="accepted">Accepted</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="in_progress">In-Progress</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label>Recommendation:</Label>
                  <Select value={filterRecommendation} onValueChange={setFilterRecommendation}>
                    <SelectTrigger className="w-[140px] border-slate-400 dark:border-slate-800 shadow-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="hire">Hire</SelectItem>
                      <SelectItem value="strong_hire">Strong Hire</SelectItem>
                      <SelectItem value="no_hire">No Hire</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bulk Actions (Removed, now inline in job header) */}
        {/* Grouped Candidates by Job */}
        {activeTab === 'active' && (
          <div className="space-y-4">
            {activeJobs.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="text-center py-10 px-6 glass-card rounded-2xl border border-border/80 shadow-md flex flex-col items-center justify-center max-w-4xl mx-auto mt-6 space-y-6"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-tr from-primary/25 to-info/25 rounded-2xl blur-lg animate-float opacity-75 animate-pulse" />
                  <div className="relative p-3.5 bg-gradient-to-tr from-primary/10 to-info/10 border border-primary/20 rounded-2xl animate-float">
                    <Briefcase className="h-9 w-9 text-primary" />
                  </div>
                </div>

                <div className="space-y-1.5 max-w-xl">
                  <h3 className="text-2xl font-bold text-gradient">
                    No Job Positions Created Yet
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-xl mx-auto">
                    To start onboarding and screening candidates, you first need to establish a job description to map all assessment and interview records.
                  </p>
                </div>

                {/* Step-by-Step recruitment flow (Slightly larger horizontal grid) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full pt-1">
                  <div className="flex items-center gap-3.5 p-3.5 bg-muted/40 rounded-xl border border-border/60 text-left">
                    <div className="p-2 px-3 bg-primary/10 rounded-lg shrink-0 text-sm font-bold text-primary">
                      1
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-semibold text-foreground leading-none">Define Job Description</h4>
                      <p className="text-xs text-muted-foreground leading-normal mt-1">Specify role details and technology criteria.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3.5 p-3.5 bg-muted/40 rounded-xl border border-border/60 text-left">
                    <div className="p-2 px-3 bg-primary/10 rounded-lg shrink-0 text-sm font-bold text-primary">
                      2
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-semibold text-foreground leading-none">Onboard Candidates</h4>
                      <p className="text-xs text-muted-foreground leading-normal mt-1">Invite candidates directly or share the apply page.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3.5 p-3.5 bg-muted/40 rounded-xl border border-border/60 text-left">
                    <div className="p-2 px-3 bg-primary/10 rounded-lg shrink-0 text-sm font-bold text-primary">
                      3
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-semibold text-foreground leading-none">Configure Challenges</h4>
                      <p className="text-xs text-muted-foreground leading-normal mt-1">Set up tests, coding challenges, and AI interviews.</p>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => navigate('/jobs/new')}
                  className="w-48 font-semibold shadow-md bg-gradient-to-r from-primary to-primary/95 hover:from-primary/95 hover:to-primary text-primary-foreground transform hover:scale-[1.01] active:scale-[0.99] transition-all duration-150 h-11 rounded-lg"
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Create Job Position
                </Button>
              </motion.div>
            ) : !hasCandidates ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="text-center py-14 px-8 glass-card rounded-2xl border border-border/80 shadow-md flex flex-col items-center justify-center max-w-4xl mx-auto mt-6 space-y-7"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-tr from-primary/25 to-info/25 rounded-2xl blur-lg animate-float opacity-75 animate-pulse" />
                  <div className="relative p-4 bg-gradient-to-tr from-primary/10 to-info/10 border border-primary/20 rounded-2xl animate-float">
                    <Users className="h-10 w-10 text-primary" />
                  </div>
                </div>

                <div className="space-y-1.5 max-w-xl">
                  <h3 className="text-2xl font-bold text-gradient">
                    No Candidates Onboarded Yet
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-xl mx-auto">
                    There are no candidates assigned to the position <strong className="text-foreground">"{selectedJob?.title || 'this job'}"</strong> yet. Get started by utilizing the methods below.
                  </p>
                </div>

                {/* Quick Actions Shortcuts (Slightly larger horizontal flex items with custom SVGs and high contrast hover buttons) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full pt-1">
                  <div className="flex items-center gap-4 p-4.5 md:p-5 bg-muted/40 rounded-xl border border-border/60 hover:border-border transition-all duration-150 text-left w-full">
                    <div className="p-2.5 bg-primary/10 rounded-lg shrink-0">
                      <svg className="h-6 w-6 text-primary" width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M19 10V4M16 7H22M16 21V19.8C16 18.1198 16 17.2798 15.673 16.638C15.3854 16.0735 14.9265 15.6146 14.362 15.327C13.7202 15 12.8802 15 11.2 15H6.8C5.11984 15 4.27976 15 3.63803 15.327C3.07354 15.6146 2.6146 16.0735 2.32698 16.638C2 17.2798 2 18.1198 2 19.8V21M12.5 7.5C12.5 9.433 10.933 11 9 11C7.067 11 5.5 9.433 5.5 7.5C5.5 5.567 7.067 4 9 4C10.933 4 12.5 5.567 12.5 7.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    </div>
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <h4 className="text-[14px] font-semibold text-foreground leading-none">Add Candidate</h4>
                      <p className="text-[12px] text-muted-foreground leading-normal mt-1">
                        Enter details manually and upload resumes.
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm" className="shrink-0 h-10 px-4 border-slate-400 dark:border-slate-800 shadow-sm bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-200 text-sm font-semibold rounded-lg cursor-pointer">
                      <Link to="/candidates/new">
                        <Plus className="mr-1 h-3.5 w-3.5" /> Add
                      </Link>
                    </Button>
                  </div>

                  <div className="flex items-center gap-4 p-4.5 md:p-5 bg-muted/40 rounded-xl border border-border/60 hover:border-border transition-all duration-150 text-left w-full">
                    <div className="p-2.5 bg-primary/10 rounded-lg shrink-0">
                      <svg className="h-6 w-6 text-primary" width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 17H7C4.23858 17 2 14.7614 2 12C2 9.23858 4.23858 7 7 7H9M15 17H17C19.7614 17 22 14.7614 22 12C22 9.23858 19.7614 7 17 7H15M7 12L17 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    </div>
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <h4 className="text-[14px] font-semibold text-foreground leading-none">Copy Application Link</h4>
                      <p className="text-[12px] text-muted-foreground leading-normal mt-1">
                        Share a public page where candidates can apply.
                      </p>
                    </div>
                    <Button
                      onClick={() => selectedJobId && copyJobLink(selectedJobId)}
                      variant="outline"
                      size="sm"
                      className="shrink-0 h-10 px-4 border-slate-400 dark:border-slate-800 shadow-sm bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-200 text-sm font-semibold rounded-lg cursor-pointer"
                    >
                      {copiedLinkId === selectedJobId ? (
                        <><Check className="mr-1 h-3.5 w-3.5 text-success" /> Copied</>
                      ) : (
                        <><Copy className="mr-1 h-3.5 w-3.5" /> Copy Link</>
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>
            ) : Object.entries(candidatesByJob).length === 0 ? (
              <div className="text-center py-16 bg-card rounded-2xl border border-border/80 shadow-sm flex flex-col items-center justify-center space-y-3 max-w-xl mx-auto mt-8">
                <Search className="h-10 w-10 text-muted-foreground/60" />
                <div className="space-y-1 text-center">
                  <h3 className="text-lg font-bold text-foreground">No matching candidates</h3>
                  <p className="text-sm text-muted-foreground">Adjust your search terms or filters to find other candidates.</p>
                </div>
              </div>
            ) : (
              Object.entries(candidatesByJob).map(([jobId, jobCandidates]) => (
                <Collapsible key={jobId} defaultOpen className="w-full">
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                              <Briefcase className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex flex-col gap-0.5 mt-0.5">
                              <CardTitle className="text-lg">{getJobTitle(jobId)}</CardTitle>
                              <div className="flex items-center gap-2">
                                <CardDescription className="text-[11px] whitespace-nowrap text-muted-foreground/80">
                                  {jobCandidates.length} candidate{jobCandidates.length === 1 ? '' : 's'}
                                </CardDescription>
                                {(() => {
                                  const selectedCount = jobCandidates.filter(c => selectedIds.has(`${c.id}_${jobId}`)).length;
                                  if (selectedCount > 0) {
                                    return (
                                      <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground/40 text-[10px]">•</span>
                                        <span className="text-primary text-[10px] font-semibold bg-primary/10 px-1.5 py-0.5 rounded-sm">{selectedCount} selected</span>
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 ml-auto">
                            {(() => {
                              const selectedInJobCount = jobCandidates.filter(c => selectedIds.has(`${c.id}_${jobId}`)).length;
                              if (selectedInJobCount === 0) return null;
                              return (
                                <div className="mr-2">
                                  <div className="flex items-center gap-2">
                                    <Button variant="outline" className="h-10 px-5 text-sm font-semibold bg-background border-slate-400 dark:border-slate-800 shadow-sm hover:bg-primary hover:text-primary-foreground transition-all duration-200" onClick={(e) => handleActionForJob(e, jobId, 'assessment')}>
                                      <Mail className="mr-2 h-[18px] w-[18px]" />
                                      Send Assessment
                                    </Button>
                                    <Button variant="outline" className="h-10 px-5 text-sm font-semibold bg-background border-slate-400 dark:border-slate-800 shadow-sm hover:bg-primary hover:text-primary-foreground transition-all duration-200" onClick={(e) => handleActionForJob(e, jobId, 'ai-interview')}>
                                      <Play className="mr-2 h-[18px] w-[18px]" />
                                      Send AI Interview
                                    </Button>
                                    <Button variant="outline" className="h-10 px-5 text-sm font-semibold bg-background border-slate-400 dark:border-slate-800 shadow-sm hover:bg-primary hover:text-primary-foreground transition-all duration-200" onClick={(e) => handleActionForJob(e, jobId, 'manual-interview')}>
                                      <MessageSquare className="mr-2 h-[18px] w-[18px]" />
                                      Manual Interview
                                    </Button>
                                    <Button variant="outline" className="h-10 px-4 text-sm font-medium bg-success/10 text-success border-success/20 hover:bg-success/20 hover:text-success shadow-sm" onClick={(e) => handleActionForJob(e, jobId, 'accept')}>
                                      <ThumbsUp className="mr-2 h-[18px] w-[18px]" />
                                      Accept
                                    </Button>
                                    <Button variant="outline" className="h-10 px-4 text-sm font-medium bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20 hover:text-destructive shadow-sm" onClick={(e) => handleActionForJob(e, jobId, 'reject')}>
                                      <ThumbsDown className="mr-2 h-[18px] w-[18px]" />
                                      Reject
                                    </Button>
                                    {/* 
                                    <Button variant="ghost" className="h-9 px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" onClick={(e) => { 
                                      e.stopPropagation(); 
                                      const newSet = new Set(selectedIds);
                                      jobCandidates.forEach(c => newSet.delete(`${c.id}_${jobId}`));
                                      setSelectedIds(newSet);
                                    }}>
                                      Clear Selection
                                    </Button>
                                    */}
                                  </div>
                                </div>
                              );
                            })()}
                            <Checkbox
                              checked={jobCandidates.length > 0 && jobCandidates.every(c => selectedIds.has(`${c.id}_${jobId}`))}
                              onClick={(e) => e.stopPropagation()}
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
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
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
                                  checked={selectedIds.size === jobCandidates.length && jobCandidates.every(c => selectedIds.has(`${c.id}_${jobId}`))}
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
                              <TableHead className="whitespace-nowrap">Resume ATS</TableHead>
                              <TableHead>Assessment</TableHead>
                              <TableHead>Interview</TableHead>
                              <TableHead 
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => {
                                  if (sortField === 'average') {
                                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                  } else {
                                    setSortField('average');
                                    setSortOrder('desc');
                                  }
                                }}
                              >
                                <div className="flex items-center gap-1.5 whitespace-nowrap">
                                  Total Average
                                  <ArrowUpDown className={`h-3.5 w-3.5 ${sortField === 'average' ? 'text-primary' : 'text-muted-foreground/60'}`} />
                                </div>
                              </TableHead>
                              <TableHead>AI Result</TableHead>
                              <TableHead>Applied</TableHead>
                              <TableHead className="w-12"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {jobCandidates.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
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
                                  className={`group border-b border-border/60 ${selectedIds.has(`${candidate.id}_${jobId}`) ? 'bg-primary/5' : ''}`}
                                >
                                  <TableCell>
                                    <Checkbox
                                      checked={selectedIds.has(`${candidate.id}_${jobId}`)}
                                      onCheckedChange={() => toggleSelect(candidate.id, jobId)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-3">
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <p className="font-medium">{candidate.full_name}</p>
                                          {(() => {
                                            const ca = analytics?.find(a => a.candidate_id === candidate.id && a.job_id === jobId);
                                            const isAccepted = acceptedCandidateIds.has(`${candidate.id}_${jobId}`);
                                            const isRejected = rejectedCandidateIds.has(`${candidate.id}_${jobId}`);
                                            const isOfferAccepted = ca?.final_status === 'offer_accepted';
                                            if (isOfferAccepted) return <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white border-emerald-700 text-[10px] py-0 px-1.5 w-fit leading-tight h-5">Offer Accepted</Badge>;
                                            if (isAccepted) return <Badge className="bg-emerald-100 hover:bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] py-0 px-1.5 w-fit leading-tight h-5 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/30 dark:text-emerald-400">Accepted</Badge>;
                                            if (isRejected) return <Badge className="bg-destructive/10 hover:bg-destructive/10 text-destructive border-destructive/20 text-[10px] py-0 px-1.5 w-fit leading-tight h-5">Rejected</Badge>;
                                            return null;
                                          })()}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground">{candidate.email}</p>
                                      </div>
                                    </div>
                                  </TableCell>
                                  {/* Resume ATS Score */}
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
                                  {/* Assessment */}
                                  <TableCell>
                                    {(() => {
                                      const ca = analytics?.find(a => a.candidate_id === candidate.id && a.job_id === jobId);
                                      const rawStatus = ca?.assessment_status;
                                      const status = rawStatus === 'completed' || rawStatus === 'terminated'
                                        ? 'completed'
                                        : rawStatus === 'in_progress' ? 'in_progress' : 'pending';
                                      const score = ca?.assessment_score;
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
                                  {/* Interview */}
                                  <TableCell>
                                    {(() => {
                                      const ca = analytics?.find(a => a.candidate_id === candidate.id && a.job_id === jobId);
                                      const rawStatus = ca?.interview_status;
                                      const status = rawStatus === 'completed' || rawStatus === 'terminated'
                                        ? 'completed'
                                        : rawStatus === 'in_progress' ? 'in_progress' : 'pending';
                                      const score = ca?.interview_score;
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
                                  {/* Total Average */}
                                  <TableCell>
                                    {(() => {
                                      const ca = analytics?.find(a => a.candidate_id === candidate.id && a.job_id === jobId);
                                      const atsScore = (candidate as any).ats_score;
                                      const assessmentScore = ca?.assessment_score;
                                      const interviewScore = ca?.interview_score;

                                      const scores = [atsScore, assessmentScore, interviewScore].filter(s => typeof s === 'number') as number[];
                                      if (scores.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
                                      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                                      return <ScoreBadge score={avg} />;
                                    })()}
                                  </TableCell>
                                  {/* Recommendation */}
                                  <TableCell>
                                    {(() => {
                                      const ca = analytics?.find(a => a.candidate_id === candidate.id && a.job_id === jobId);
                                      return (
                                        <div className="flex flex-col gap-1">
                                          {getRecommendationBadge(ca?.recommendation)}
                                        </div>
                                      );
                                    })()}
                                  </TableCell>
                                  {/* Applied */}
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
              ))
            )}
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
        {/* ── Accept Dialog (from Results) ─────────────────────────────── */}
        <Dialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Shortlist Candidate(s)</DialogTitle>
              <DialogDescription>
                Update status for <strong>{selectedIds.size}</strong> selected candidate(s) to <strong>Selected / Shortlisted</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-3">
              {hasIncompleteEvaluation && (
                <div className="p-4 bg-amber-50 border-2 border-amber-400 rounded-md flex gap-3 text-sm text-amber-900 items-start shadow-sm dark:bg-amber-950/30 dark:border-amber-600 dark:text-amber-200">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="font-bold text-amber-800 dark:text-amber-300">Incomplete Evaluation Detected</span>
                    <span className="text-amber-800 break-words dark:text-amber-200">One or more selected candidates have not completed their Technical Assessment or Interview. Are you sure you want to proceed?</span>
                  </div>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Choose whether to also notify the candidate(s) via email.
              </p>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setAcceptDialogOpen(false)} disabled={sendingAcceptReject}>
                Cancel
              </Button>
              <Button
                variant="secondary"
                className="bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 hover:border-primary/30"
                onClick={() => sendAcceptanceEmails(false)}
                disabled={sendingAcceptReject}
                id="acceptance-status-only-btn"
              >
                {sendingAcceptReject ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Update Status Only
              </Button>
              <Button
                onClick={() => sendAcceptanceEmails(true)}
                disabled={sendingAcceptReject}
                id="acceptance-send-email-btn"
              >
                {sendingAcceptReject ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                Update Status + Send Email
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Reject Dialog (from Results) ─────────────────────────────── */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Reject Candidate(s)</DialogTitle>
              <DialogDescription>
                Update status for <strong>{selectedIds.size}</strong> selected candidate(s) to <strong>Rejected</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-3">
              {hasIncompleteEvaluation && (
                <div className="p-4 bg-amber-50 border-2 border-amber-400 rounded-md flex gap-3 text-sm text-amber-900 items-start shadow-sm dark:bg-amber-950/30 dark:border-amber-600 dark:text-amber-200">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="font-bold text-amber-800 dark:text-amber-300">Incomplete Evaluation Detected</span>
                    <span className="text-amber-800 break-words dark:text-amber-200">One or more selected candidates have not completed their Technical Assessment or Interview. Are you sure you want to proceed?</span>
                  </div>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Choose whether to also notify the candidate(s) via email. This will remove them from the active pipeline.
              </p>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)} disabled={sendingAcceptReject}>
                Cancel
              </Button>
              <Button
                variant="secondary"
                className="bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 hover:border-primary/30"
                onClick={() => sendRejectionEmails(false)}
                disabled={sendingAcceptReject}
                id="rejection-status-only-btn"
              >
                {sendingAcceptReject ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Update Status Only
              </Button>
              <Button
                variant="destructive"
                onClick={() => sendRejectionEmails(true)}
                disabled={sendingAcceptReject}
                id="rejection-send-email-btn"
              >
                {sendingAcceptReject ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                Update Status + Send Email
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}
