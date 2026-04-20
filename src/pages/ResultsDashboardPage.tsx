/**
 * Results Dashboard for Hiring Managers.
 * View aggregated assessment scores (Resume, Technical, Interview) for candidates.
 * Includes gated "Send Offer Letter" flow — only accessible after acceptance email is sent.
 */
import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth, useRequireAuth } from '@/hooks/useAuth';
import { useJobs } from '@/hooks/useJobs';
import { analyticsApi, type CandidateAnalytics, type JobDescription } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  TooltipProvider,
} from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  Trophy,
  Users,
  TrendingUp,
  Mail,
  ThumbsUp,
  ThumbsDown,
  BarChart3,
  Filter,
  ArrowUpDown,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { HireRecommendation } from '@/types/database';
import { ScoreBadge } from '@/components/ui/score-badge';
import { PDFExportService } from '@/lib/pdf-export';
import { useProfile } from '@/hooks/useProfile';
import { Download } from 'lucide-react';

const API_BASE_URL = '/api';

type SortField = 'name' | 'ats_score' | 'assessment_score' | 'interview_score' | 'total_score';
type SortOrder = 'asc' | 'desc';

export default function ResultsDashboardPage() {
  const { loading: authLoading } = useRequireAuth();
  const { getToken } = useAuth();
  const { data: jobs, isLoading: jobsLoading } = useJobs();
  const { data: profile } = useProfile();

  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [candidates, setCandidates] = useState<CandidateAnalytics[]>([]);
  const [globalCandidates, setGlobalCandidates] = useState<CandidateAnalytics[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [loadingGlobalResults, setLoadingGlobalResults] = useState(false);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());

  // Track which candidates have had acceptance emails sent (keyed by candidate_id)
  // We also seed from server-side final_status === 'accepted' | 'offer_sent'
  const [acceptedCandidateIds, setAcceptedCandidateIds] = useState<Set<string>>(new Set());
  const [offerSentIds, setOfferSentIds] = useState<Set<string>>(new Set());

  // Filtering & Sorting State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('total_score');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [minScore, setMinScore] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Dialog States
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [sendingEmails, setSendingEmails] = useState(false);

  useEffect(() => {
    async function loadGlobalResults() {
      setLoadingGlobalResults(true);
      try {
        const data = await analyticsApi.getCandidates();
        setGlobalCandidates(data);
      } catch (e) {
        console.error('Error loading candidates', e);
        toast.error('Failed to load candidate data');
      } finally {
        setLoadingGlobalResults(false);
      }
    }

    loadGlobalResults();
  }, []);

  // Load results when job is selected
  useEffect(() => {
    if (!selectedJobId) {
      setCandidates([]);
      setAcceptedCandidateIds(new Set());
      setOfferSentIds(new Set());
      return;
    }

    async function loadResults() {
      setLoadingResults(true);
      try {
        const data = await analyticsApi.getCandidates({ job_id: selectedJobId });
        setCandidates(data);

        // Seed accepted/offer_sent status from server data
        const accepted = new Set<string>();
        const offerSent = new Set<string>();
        data.forEach((c) => {
          if (c.final_status === 'accepted' || c.final_status === 'offer_sent') {
            accepted.add(c.candidate_id);
          }
          if (c.final_status === 'offer_sent') {
            offerSent.add(c.candidate_id);
          }
        });
        setAcceptedCandidateIds(accepted);
        setOfferSentIds(offerSent);
      } catch (e) {
        console.error('Error loading candidates', e);
        toast.error('Failed to load candidate data');
      } finally {
        setLoadingResults(false);
      }
    }

    loadResults();
  }, [selectedJobId]);

  const handleDownloadReport = () => {
    const job = jobs?.find((j) => j.id === selectedJobId);
    if (job && processedCandidates.length > 0) {
      PDFExportService.generateJobReport(
        job as JobDescription,
        processedCandidates as any,
        profile as any
      );
    } else {
      toast.error('No candidate data available to export.');
    }
  };

  // Derived state for filtered & sorted candidates
  const processedCandidates = useMemo(() => {
    let result = [...candidates];

    // 1. Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) => c.candidate_name.toLowerCase().includes(q));
    }

    // 2. Filter by Score
    if (minScore > 0) {
      result = result.filter((c) => {
        const scores = [c.ats_score, c.assessment_score, c.interview_score].filter(
          (s) => s !== null
        ) as number[];
        if (scores.length === 0) return false;
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        return avg >= minScore;
      });
    }

    // 3. Status Filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'recommended') {
        result = result.filter(
          (c) => c.recommendation === 'strong_hire' || c.recommendation === 'hire'
        );
      } else {
        result = result.filter((c) => c.interview_status === statusFilter);
      }
    }

    // 4. Sort
    result.sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;

      switch (sortField) {
        case 'name':
          valA = a.candidate_name;
          valB = b.candidate_name;
          break;
        case 'ats_score':
          valA = a.ats_score || 0;
          valB = b.ats_score || 0;
          break;
        case 'assessment_score':
          valA = a.assessment_score || 0;
          valB = b.assessment_score || 0;
          break;
        case 'interview_score':
          valA = a.interview_score || 0;
          valB = b.interview_score || 0;
          break;
        case 'total_score': {
          const scoresA = [a.ats_score, a.assessment_score, a.interview_score].filter(
            (s) => s !== null
          ) as number[];
          valA = scoresA.length
            ? Math.round(scoresA.reduce((sum, s) => sum + s, 0) / scoresA.length)
            : 0;
          const scoresB = [b.ats_score, b.assessment_score, b.interview_score].filter(
            (s) => s !== null
          ) as number[];
          valB = scoresB.length
            ? Math.round(scoresB.reduce((sum, s) => sum + s, 0) / scoresB.length)
            : 0;
          break;
        }
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [candidates, searchQuery, sortField, sortOrder, minScore, statusFilter]);

  const toggleSelectCandidate = (candidateId: string) => {
    const newSet = new Set(selectedCandidates);
    if (newSet.has(candidateId)) {
      newSet.delete(candidateId);
    } else {
      newSet.add(candidateId);
    }
    setSelectedCandidates(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedCandidates.size === processedCandidates.length) {
      setSelectedCandidates(new Set());
    } else {
      setSelectedCandidates(new Set(processedCandidates.map((c) => c.candidate_id)));
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const sendAcceptanceEmails = async () => {
    if (selectedCandidates.size === 0) return;
    if (!selectedJobId) {
      toast.error('Please select a job first');
      return;
    }

    setSendingEmails(true);
    try {
      const token = await getToken();
      const candidateIds = Array.from(selectedCandidates);
      const response = await fetch(`${API_BASE_URL}/candidates/send-acceptance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          candidate_ids: candidateIds,
          job_id: selectedJobId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        const msg = data?.error || data?.detail || 'Failed to send acceptance emails';
        toast.error(msg);
        return;
      }

      if (data?.error_messages?.length) {
        toast.error(`Some emails failed: ${data.error_messages[0]}`);
      } else {
        toast.success(`Acceptance emails sent to ${data.emails_sent} candidate(s)`);

        // Mark all successfully emailed candidates as accepted  → unlock Offer Letter button
        const newAccepted = new Set(acceptedCandidateIds);
        candidateIds.forEach((id) => newAccepted.add(id));
        setAcceptedCandidateIds(newAccepted);
      }
      setAcceptDialogOpen(false);
      setSelectedCandidates(new Set());
    } catch (e) {
      toast.error('Failed to send acceptance emails');
    } finally {
      setSendingEmails(false);
    }
  };

  const sendRejectionEmails = async () => {
    if (selectedCandidates.size === 0) return;
    if (!selectedJobId) {
      toast.error('Please select a job first');
      return;
    }

    setSendingEmails(true);
    try {
      const token = await getToken();
      const candidateIds = Array.from(selectedCandidates);
      const response = await fetch(`${API_BASE_URL}/candidates/send-rejection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          candidate_ids: candidateIds,
          job_id: selectedJobId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        const msg = data?.error || data?.detail || 'Failed to send rejection emails';
        toast.error(msg);
        return;
      }

      if (data?.error_messages?.length) {
        toast.error(`Some emails failed: ${data.error_messages[0]}`);
      } else {
        toast.success('Rejection emails sent');
      }

      setRejectDialogOpen(false);
      setSelectedCandidates(new Set());
    } catch (e) {
      toast.error('Failed to send rejection emails');
    } finally {
      setSendingEmails(false);
    }
  };

  // ─── Render Helpers ───────────────────────────────────────────────────────

  const getRecommendationBadge = (recommendation: string | null) => {
    if (!recommendation) return <Badge variant="outline">Pending</Badge>;
    const normalized = recommendation as HireRecommendation;
    switch (normalized) {
      case 'strong_hire':
        return <Badge className="bg-success text-success-foreground">Strong Hire</Badge>;
      case 'hire':
        return <Badge className="bg-info text-info-foreground">Hire</Badge>;
      case 'borderline':
        return <Badge variant="secondary">Borderline</Badge>;
      case 'maybe':
        return <Badge variant="secondary">Maybe</Badge>;
      case 'no_hire':
        return <Badge variant="destructive">No Hire</Badge>;
      default:
        return <Badge variant="outline">{recommendation}</Badge>;
    }
  };

  // Stats
  const avgTotalScore = useMemo(() => {
    if (!processedCandidates.length) return 0;
    let sum = 0;
    let count = 0;
    processedCandidates.forEach((c) => {
      const scores = [c.ats_score, c.assessment_score, c.interview_score].filter(
        (s) => s !== null
      ) as number[];
      if (scores.length) {
        sum += scores.reduce((a, b) => a + b, 0) / scores.length;
        count++;
      }
    });
    return count ? sum / count : 0;
  }, [processedCandidates]);

  const globalTotalCandidates = useMemo(() => {
    const s = new Set<string>();
    globalCandidates.forEach((c) => {
      if (c.candidate_id) s.add(c.candidate_id);
    });
    return s.size;
  }, [globalCandidates]);

  const globalAvgTotalScore = useMemo(() => {
    if (!globalCandidates.length) return 0;
    let sum = 0;
    let count = 0;
    globalCandidates.forEach((c) => {
      const scores = [c.ats_score, c.assessment_score, c.interview_score].filter(
        (s) => s !== null
      ) as number[];
      if (scores.length) {
        sum += scores.reduce((a, b) => a + b, 0) / scores.length;
        count++;
      }
    });
    return count ? sum / count : 0;
  }, [globalCandidates]);

  const globalHiresCount = useMemo(() => {
    return globalCandidates.filter(
      (c) => c.final_status === 'accepted' || c.final_status === 'offer_sent'
    ).length;
  }, [globalCandidates]);

  const globalRejectionsCount = useMemo(() => {
    return globalCandidates.filter((c) => c.final_status === 'rejected').length;
  }, [globalCandidates]);

  if (authLoading || jobsLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <TooltipProvider>
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
                Results Dashboard
              </motion.h1>
              <p className="text-muted-foreground mt-1">
                Unified view of candidate performance across all hiring stages
              </p>
            </div>

            <Select value={selectedJobId} onValueChange={setSelectedJobId}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select a job to view results" />
              </SelectTrigger>
              <SelectContent>
                {jobs?.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!selectedJobId ? (
            loadingGlobalResults ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <BarChart3 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{jobs?.length || 0}</p>
                          <p className="text-xs text-muted-foreground">Total Number of Jobs</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{globalTotalCandidates}</p>
                          <p className="text-xs text-muted-foreground">Total Number of Candidates</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-info/10 rounded-lg">
                          <TrendingUp className="h-5 w-5 text-info" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{globalAvgTotalScore.toFixed(0)}%</p>
                          <p className="text-xs text-muted-foreground">Avg Overall Score</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-success/10 rounded-lg">
                          <ThumbsUp className="h-5 w-5 text-success" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{globalHiresCount}</p>
                          <p className="text-xs text-muted-foreground">Total Number of Hires</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-destructive/10 rounded-lg">
                          <ThumbsDown className="h-5 w-5 text-destructive" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{globalRejectionsCount}</p>
                          <p className="text-xs text-muted-foreground">Total Number of Rejections</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardContent className="py-12 text-center">
                    <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Select a job to view job-wise results</p>
                  </CardContent>
                </Card>
              </>
            )
          ) : loadingResults ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <BarChart3 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">1</p>
                        <p className="text-xs text-muted-foreground">Total Number of Jobs</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{candidates.length}</p>
                        <p className="text-xs text-muted-foreground">Total Number of Candidates</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-info/10 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-info" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{avgTotalScore.toFixed(0)}%</p>
                        <p className="text-xs text-muted-foreground">Avg Overall Score</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-success/10 rounded-lg">
                        <ThumbsUp className="h-5 w-5 text-success" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {
                            processedCandidates.filter(
                              (c) => c.final_status === 'accepted' || c.final_status === 'offer_sent'
                            ).length
                          }
                        </p>
                        <p className="text-xs text-muted-foreground">Total Number of Hires</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-destructive/10 rounded-lg">
                        <ThumbsDown className="h-5 w-5 text-destructive" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {processedCandidates.filter((c) => c.final_status === 'rejected').length}
                        </p>
                        <p className="text-xs text-muted-foreground">Total Number of Rejections</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Filters & Actions */}
              <Card>
                <CardContent className="py-4">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                      <div className="relative w-full sm:w-1/3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search candidates..."
                          className="pl-10"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowFilters(!showFilters)}
                        >
                          <Filter className="mr-2 h-4 w-4" />
                          Filters
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDownloadReport}
                          disabled={!selectedJobId || processedCandidates.length === 0}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Export PDF
                        </Button>
                        {selectedCandidates.size > 0 && (
                          <>
                            <Button size="sm" onClick={() => setAcceptDialogOpen(true)}>
                              <ThumbsUp className="mr-2 h-4 w-4" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setRejectDialogOpen(true)}
                            >
                              <ThumbsDown className="mr-2 h-4 w-4" />
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {showFilters && (
                      <div className="flex flex-wrap gap-4 pt-4 border-t items-center">
                        <div className="space-y-1">
                          <Label className="text-xs">Min Score (%)</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            className="w-[100px]"
                            value={minScore}
                            onChange={(e) => setMinScore(Number(e.target.value))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Recommendation</Label>
                          <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[150px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All</SelectItem>
                              <SelectItem value="recommended">Recommended (Hire+)</SelectItem>
                              <SelectItem value="completed">Interview Completed</SelectItem>
                              <SelectItem value="pending">Pending</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Unified Table */}
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={
                              processedCandidates.length > 0 &&
                              selectedCandidates.size === processedCandidates.length
                            }
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        <TableHead>
                          <Button variant="ghost" size="sm" onClick={() => handleSort('name')}>
                            Candidate <ArrowUpDown className="ml-2 h-3 w-3" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort('ats_score')}
                          >
                            Resume Score <ArrowUpDown className="ml-2 h-3 w-3" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort('assessment_score')}
                          >
                            Tech. Assessment <ArrowUpDown className="ml-2 h-3 w-3" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort('interview_score')}
                          >
                            Interview Score <ArrowUpDown className="ml-2 h-3 w-3" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort('total_score')}
                          >
                            Total Avg <ArrowUpDown className="ml-2 h-3 w-3" />
                          </Button>
                        </TableHead>
                        <TableHead>Recommendation</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processedCandidates.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-center py-8 text-muted-foreground"
                          >
                            No candidates found matching filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        processedCandidates.map((candidate) => {
                          const isAccepted = acceptedCandidateIds.has(candidate.candidate_id);
                          const isOfferSent = offerSentIds.has(candidate.candidate_id);

                          return (
                            <TableRow
                              key={candidate.candidate_id}
                              className={
                                selectedCandidates.has(candidate.candidate_id)
                                  ? 'bg-primary/5'
                                  : ''
                              }
                            >
                              <TableCell>
                                <Checkbox
                                  checked={selectedCandidates.has(candidate.candidate_id)}
                                  onCheckedChange={() =>
                                    toggleSelectCandidate(candidate.candidate_id)
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium">{candidate.candidate_name}</p>
                                    {isAccepted && !isOfferSent && (
                                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] py-0 px-1.5">
                                        Accepted
                                      </Badge>
                                    )}
                                    {isOfferSent && (
                                      <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-[10px] py-0 px-1.5">
                                        Offer Sent ✓
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                                    {candidate.job_title}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>
                                {typeof candidate.ats_score === 'number' ? (
                                  <ScoreBadge score={candidate.ats_score} />
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {typeof candidate.assessment_score === 'number' ? (
                                  <ScoreBadge score={candidate.assessment_score} />
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {typeof candidate.interview_score === 'number' ? (
                                  <ScoreBadge score={candidate.interview_score} />
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  const scores = [
                                    candidate.ats_score,
                                    candidate.assessment_score,
                                    candidate.interview_score,
                                  ].filter((s) => s !== null) as number[];
                                  const avg = scores.length
                                    ? scores.reduce((a, b) => a + b, 0) / scores.length
                                    : 0;
                                  return scores.length ? (
                                    <ScoreBadge score={Math.round(avg)} />
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  );
                                })()}
                              </TableCell>
                              <TableCell>
                                {getRecommendationBadge(candidate.recommendation)}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* ─── Acceptance Dialog ─────────────────────────────────────────── */}
              <Dialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Send Acceptance Emails</DialogTitle>
                    <DialogDescription>
                      Send acceptance emails to <strong>{selectedCandidates.size}</strong> selected
                      candidate(s). Once sent, the{' '}
                      <span className="text-indigo-600 font-medium">Send Offer Letter</span> button
                      will become available for each accepted candidate.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAcceptDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={sendAcceptanceEmails} disabled={sendingEmails}>
                      {sendingEmails ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Mail className="mr-2 h-4 w-4" />
                      )}
                      Send Acceptance Emails
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* ─── Rejection Dialog ──────────────────────────────────────────── */}
              <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Send Rejection Emails</DialogTitle>
                    <DialogDescription>
                      Send rejection emails to{' '}
                      <strong>{selectedCandidates.size}</strong> selected candidate(s). This will
                      also remove them from the active pipeline.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={sendRejectionEmails}
                      disabled={sendingEmails}
                    >
                      {sendingEmails ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Mail className="mr-2 h-4 w-4" />
                      )}
                      Send Rejection
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Offer letter functionality temporarily disabled. */}
            </>
          )}
        </div>
      </DashboardLayout>
    </TooltipProvider>
  );
}
