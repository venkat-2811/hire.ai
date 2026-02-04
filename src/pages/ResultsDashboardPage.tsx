/**
 * Results Dashboard for Hiring Managers.
 * View assessment and interview results, send acceptance/rejection emails.
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth } from '@/hooks/useAuth';
import { useJobs } from '@/hooks/useJobs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Loader2,
  Trophy,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Mail,
  ThumbsUp,
  ThumbsDown,
  Eye,
  BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface AssessmentResult {
  id: string;
  candidate_id: string;
  status: string;
  mcq_score: number | null;
  coding_score: number | null;
  total_score: number | null;
  proctoring_data: {
    tab_switches: number;
    fullscreen_exits: number;
    warnings: any[];
  };
  completed_at: string | null;
  candidates: {
    id: string;
    full_name: string;
    email: string;
  };
}

interface InterviewResult {
  id: string;
  candidate_id: string;
  status: string;
  final_evaluation: {
    overall_score: number;
    technical_score: number;
    communication_score: number;
    confidence_score: number;
    recommendation: string;
    strengths: string[];
    areas_for_improvement: string[];
    detailed_feedback: string;
  } | null;
  completed_at: string | null;
  candidates: {
    id: string;
    full_name: string;
    email: string;
  };
}

export default function ResultsDashboardPage() {
  const { loading: authLoading } = useRequireAuth();
  const { data: jobs, isLoading: jobsLoading } = useJobs();

  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [assessmentResults, setAssessmentResults] = useState<AssessmentResult[]>([]);
  const [interviewResults, setInterviewResults] = useState<InterviewResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<InterviewResult | null>(null);

  // Load results when job is selected
  useEffect(() => {
    if (!selectedJobId) {
      setAssessmentResults([]);
      setInterviewResults([]);
      return;
    }

    async function loadResults() {
      setLoadingResults(true);
      try {
        // Load assessment results
        const assessmentRes = await fetch(`${API_BASE_URL}/assessments/results/${selectedJobId}`);
        if (assessmentRes.ok) {
          const data = await assessmentRes.json();
          setAssessmentResults(data);
        }

        // Load interview results
        const interviewRes = await fetch(`${API_BASE_URL}/ai-interview/results/${selectedJobId}`);
        if (interviewRes.ok) {
          const data = await interviewRes.json();
          setInterviewResults(data);
        }
      } catch (e) {
        toast.error('Failed to load results');
      } finally {
        setLoadingResults(false);
      }
    }

    loadResults();
  }, [selectedJobId]);

  const toggleSelectCandidate = (candidateId: string) => {
    const newSet = new Set(selectedCandidates);
    if (newSet.has(candidateId)) {
      newSet.delete(candidateId);
    } else {
      newSet.add(candidateId);
    }
    setSelectedCandidates(newSet);
  };

  const sendAcceptanceEmails = async () => {
    if (selectedCandidates.size === 0) return;

    setSendingEmails(true);
    try {
      const candidateIds = Array.from(selectedCandidates);

      const response = await fetch(`${API_BASE_URL}/candidates/send-acceptance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_ids: candidateIds,
          job_id: selectedJobId,
        }),
      });

      const data = await response.json();
      toast.success(`Acceptance emails sent to ${data.emails_sent} candidate(s)`);
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

    setSendingEmails(true);
    try {
      const candidateIds = Array.from(selectedCandidates);

      const response = await fetch(`${API_BASE_URL}/candidates/send-rejection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_ids: candidateIds,
          job_id: selectedJobId,
        }),
      });

      const data = await response.json();
      toast.success(`Rejection emails sent to ${data.emails_sent} candidate(s)`);
      
      // Auto-delete rejected candidates from the database
      await fetch(`${API_BASE_URL}/candidates/bulk-delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(candidateIds),
      });
      
      // Refresh results
      setInterviewResults(prev => prev.filter(r => !candidateIds.includes(r.candidate_id)));
      setAssessmentResults(prev => prev.filter(r => !candidateIds.includes(r.candidate_id)));
      
      setRejectDialogOpen(false);
      setSelectedCandidates(new Set());
    } catch (e) {
      toast.error('Failed to send rejection emails');
    } finally {
      setSendingEmails(false);
    }
  };

  const viewDetails = (result: InterviewResult) => {
    setSelectedResult(result);
    setDetailDialogOpen(true);
  };

  const getRecommendationBadge = (recommendation: string) => {
    switch (recommendation) {
      case 'strong_hire':
        return <Badge className="bg-success text-success-foreground">Strong Hire</Badge>;
      case 'hire':
        return <Badge className="bg-info text-info-foreground">Hire</Badge>;
      case 'borderline':
        return <Badge variant="secondary">Borderline</Badge>;
      case 'no_hire':
        return <Badge variant="destructive">No Hire</Badge>;
      default:
        return <Badge variant="outline">{recommendation}</Badge>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-info';
    if (score >= 40) return 'text-warning';
    return 'text-destructive';
  };

  // Stats calculations
  const completedAssessments = assessmentResults.filter(r => r.status === 'completed').length;
  const completedInterviews = interviewResults.filter(r => r.status === 'completed').length;
  const avgAssessmentScore = assessmentResults.length > 0
    ? assessmentResults.reduce((sum, r) => sum + (r.total_score || 0), 0) / assessmentResults.length
    : 0;
  const avgInterviewScore = interviewResults.length > 0
    ? interviewResults.reduce((sum, r) => sum + (r.final_evaluation?.overall_score || 0), 0) / interviewResults.length
    : 0;
  const strongHires = interviewResults.filter(r => r.final_evaluation?.recommendation === 'strong_hire').length;

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
              View assessment and interview results, manage candidate outcomes
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
          <Card>
            <CardContent className="py-12 text-center">
              <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Select a job to view results</p>
            </CardContent>
          </Card>
        ) : loadingResults ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{assessmentResults.length}</p>
                      <p className="text-xs text-muted-foreground">Total Assessments</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-success/10 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{completedInterviews}</p>
                      <p className="text-xs text-muted-foreground">Completed Interviews</p>
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
                      <p className="text-2xl font-bold">{avgAssessmentScore.toFixed(0)}%</p>
                      <p className="text-xs text-muted-foreground">Avg Assessment Score</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-warning/10 rounded-lg">
                      <BarChart3 className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{avgInterviewScore.toFixed(0)}%</p>
                      <p className="text-xs text-muted-foreground">Avg Interview Score</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-success/10 rounded-lg">
                      <Trophy className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{strongHires}</p>
                      <p className="text-xs text-muted-foreground">Strong Hire Recommendations</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Bulk Actions */}
            {selectedCandidates.size > 0 && (
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">
                      {selectedCandidates.size} candidate(s) selected
                    </span>
                    <Button size="sm" onClick={() => setAcceptDialogOpen(true)}>
                      <ThumbsUp className="mr-2 h-4 w-4" />
                      Send Acceptance
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setRejectDialogOpen(true)}>
                      <ThumbsDown className="mr-2 h-4 w-4" />
                      Send Rejection
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setSelectedCandidates(new Set())}>
                      Clear Selection
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Results Tabs */}
            <Tabs defaultValue="interviews" className="space-y-4">
              <TabsList>
                <TabsTrigger value="interviews">
                  Interview Results ({interviewResults.length})
                </TabsTrigger>
                <TabsTrigger value="assessments">
                  Assessment Results ({assessmentResults.length})
                </TabsTrigger>
              </TabsList>

              {/* Interview Results */}
              <TabsContent value="interviews">
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Candidate</TableHead>
                          <TableHead>Overall Score</TableHead>
                          <TableHead>Technical</TableHead>
                          <TableHead>Communication</TableHead>
                          <TableHead>Recommendation</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {interviewResults.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                              No interview results yet
                            </TableCell>
                          </TableRow>
                        ) : (
                          interviewResults.map((result) => (
                            <TableRow key={result.id} className={selectedCandidates.has(result.candidate_id) ? 'bg-primary/5' : ''}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedCandidates.has(result.candidate_id)}
                                  onCheckedChange={() => toggleSelectCandidate(result.candidate_id)}
                                />
                              </TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{result.candidates.full_name}</p>
                                  <p className="text-sm text-muted-foreground">{result.candidates.email}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className={`text-lg font-bold ${getScoreColor(result.final_evaluation?.overall_score || 0)}`}>
                                  {result.final_evaluation?.overall_score?.toFixed(0) || '-'}%
                                </span>
                              </TableCell>
                              <TableCell>
                                {result.final_evaluation?.technical_score?.toFixed(0) || '-'}%
                              </TableCell>
                              <TableCell>
                                {result.final_evaluation?.communication_score?.toFixed(0) || '-'}%
                              </TableCell>
                              <TableCell>
                                {result.final_evaluation?.recommendation
                                  ? getRecommendationBadge(result.final_evaluation.recommendation)
                                  : <Badge variant="outline">Pending</Badge>
                                }
                              </TableCell>
                              <TableCell>
                                <Badge variant={result.status === 'completed' ? 'default' : 'secondary'}>
                                  {result.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => viewDetails(result)}
                                  disabled={!result.final_evaluation}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Assessment Results */}
              <TabsContent value="assessments">
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Candidate</TableHead>
                          <TableHead>MCQ Score</TableHead>
                          <TableHead>Coding Score</TableHead>
                          <TableHead>Total Score</TableHead>
                          <TableHead>Proctoring</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assessmentResults.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              No assessment results yet
                            </TableCell>
                          </TableRow>
                        ) : (
                          assessmentResults.map((result) => (
                            <TableRow key={result.id} className={selectedCandidates.has(result.candidate_id) ? 'bg-primary/5' : ''}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedCandidates.has(result.candidate_id)}
                                  onCheckedChange={() => toggleSelectCandidate(result.candidate_id)}
                                />
                              </TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{result.candidates.full_name}</p>
                                  <p className="text-sm text-muted-foreground">{result.candidates.email}</p>
                                </div>
                              </TableCell>
                              <TableCell>{result.mcq_score?.toFixed(0) || '-'}%</TableCell>
                              <TableCell>{result.coding_score?.toFixed(0) || '-'}%</TableCell>
                              <TableCell>
                                <span className={`font-bold ${getScoreColor(result.total_score || 0)}`}>
                                  {result.total_score?.toFixed(0) || '-'}%
                                </span>
                              </TableCell>
                              <TableCell>
                                {result.proctoring_data?.warnings?.length > 0 ? (
                                  <Badge variant="destructive">
                                    {result.proctoring_data.warnings.length} warnings
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">Clean</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant={result.status === 'completed' ? 'default' : 'secondary'}>
                                  {result.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* Acceptance Dialog */}
        <Dialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Acceptance Emails</DialogTitle>
              <DialogDescription>
                Send acceptance/offer emails to {selectedCandidates.size} selected candidate(s).
                They will be notified that they have been selected for the position.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAcceptDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={sendAcceptanceEmails} disabled={sendingEmails}>
                {sendingEmails ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
                ) : (
                  <><Mail className="mr-2 h-4 w-4" />Send Acceptance Emails</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rejection Dialog */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Rejection Emails</DialogTitle>
              <DialogDescription>
                Send rejection emails to {selectedCandidates.size} selected candidate(s).
                They will be notified that they were not selected for the position.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={sendRejectionEmails} disabled={sendingEmails}>
                {sendingEmails ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
                ) : (
                  <><Mail className="mr-2 h-4 w-4" />Send Rejection Emails</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail Dialog */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Interview Evaluation Details</DialogTitle>
              <DialogDescription>
                {selectedResult?.candidates.full_name} - Detailed evaluation
              </DialogDescription>
            </DialogHeader>

            {selectedResult?.final_evaluation && (
              <div className="space-y-6">
                {/* Scores */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Overall Score</p>
                    <p className={`text-3xl font-bold ${getScoreColor(selectedResult.final_evaluation.overall_score)}`}>
                      {selectedResult.final_evaluation.overall_score.toFixed(0)}%
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Recommendation</p>
                    {getRecommendationBadge(selectedResult.final_evaluation.recommendation)}
                  </div>
                </div>

                {/* Score Breakdown */}
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Technical</span>
                    <span>{selectedResult.final_evaluation.technical_score.toFixed(0)}%</span>
                  </div>
                  <Progress value={selectedResult.final_evaluation.technical_score} className="h-2" />

                  <div className="flex justify-between text-sm">
                    <span>Communication</span>
                    <span>{selectedResult.final_evaluation.communication_score.toFixed(0)}%</span>
                  </div>
                  <Progress value={selectedResult.final_evaluation.communication_score} className="h-2" />

                  <div className="flex justify-between text-sm">
                    <span>Confidence</span>
                    <span>{selectedResult.final_evaluation.confidence_score.toFixed(0)}%</span>
                  </div>
                  <Progress value={selectedResult.final_evaluation.confidence_score} className="h-2" />
                </div>

                {/* Strengths & Improvements */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2 text-success">Strengths</h4>
                    <ul className="space-y-1 text-sm">
                      {selectedResult.final_evaluation.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2 text-warning">Areas for Improvement</h4>
                    <ul className="space-y-1 text-sm">
                      {selectedResult.final_evaluation.areas_for_improvement.map((a, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Clock className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                          {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Detailed Feedback */}
                <div>
                  <h4 className="font-semibold mb-2">Detailed Feedback</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedResult.final_evaluation.detailed_feedback}
                  </p>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
