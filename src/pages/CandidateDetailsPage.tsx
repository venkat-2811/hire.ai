import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  Loader2,
  Mail,
  Phone,
  Globe,
  Github,
  FileText,
  Calendar,
  CheckCircle,
  XCircle,
  Code,
  MessageSquare,
  ClipboardList,
  ExternalLink,
  Shield,
  MapPin,
  User,
  Briefcase,
  Database,
} from 'lucide-react';
import { useCandidate, useCandidateScreenings } from '@/hooks/useCandidates';
import { useProfile } from '@/hooks/useProfile';
import { candidatesApi, type AssessmentDetails, type InterviewDetails, type ManualInterviewDetails } from '@/lib/api';
import { ScoreBadge } from '@/components/ui/score-badge';
import { PDFExportService } from '@/lib/pdf-export';
import { Download, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { EditCandidateModal } from '@/components/ui/EditCandidateModal';
import ReactMarkdown from 'react-markdown';

const safeRender = (val: any): string => {
  if (val == null) return '';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
};

const asArray = <T,>(v: any): T[] => (Array.isArray(v) ? (v as T[]) : []);

const getAssessmentContent = (assessmentDetails: any): any => {
  if (!assessmentDetails) return {};
  const pd = assessmentDetails?.proctoring_data;
  if (pd && typeof pd === 'object') {
    const ac = (pd as any)?.assessment_content;
    if (ac && typeof ac === 'object') return ac;
  }
  return {};
};

export default function CandidateDetailsPage() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get('job_id') || undefined;
  const initialTab = searchParams.get('tab') || undefined;
  const { loading: authLoading } = useRequireAuth();
  const { data: candidate, isLoading, error: candidateError, refetch } = useCandidate(candidateId || '');

  const { data: profile } = useProfile();
  const { data: screenings } = useCandidateScreenings(candidateId || '');
  const screening = jobId
    ? (screenings || []).find((s: any) => s.job_id === jobId)
    : (screenings || [])[0] || null;

  const [assessmentDetails, setAssessmentDetails] = useState<AssessmentDetails | null>(null);
  const [interviewDetails, setInterviewDetails] = useState<InterviewDetails | null>(null);
  const [manualInterviewDetails, setManualInterviewDetails] = useState<ManualInterviewDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const [manualScore, setManualScore] = useState<string>('');
  const [manualFeedback, setManualFeedback] = useState<string>('');
  const [manualNotes, setManualNotes] = useState<string>('');

  const pd = assessmentDetails?.proctoring_data;
  const sqlChallenges = asArray<any>(pd?.assessment_content?.sql_challenges);
  const sqlSubs = asArray<any>(pd?.sql_submissions);
  const hasSql = sqlChallenges.length > 0 || sqlSubs.length > 0 || assessmentDetails?.sql_score != null;

  const [evaluationTab, setEvaluationTab] = useState<string>(() => {
    if (initialTab === 'manual') return 'manual';
    if (initialTab === 'interview') return 'interview';
    return 'assessment';
  });

  const handleDownloadReport = () => {
    if (candidate) {
      PDFExportService.generateCandidateReport(
        candidate as any,
        assessmentDetails,
        interviewDetails,
        screening,
        manualInterviewDetails,
        profile as any
      );
    }
  };

  useEffect(() => {
    if (!candidateId) return;
    setLoadingDetails(true);
    Promise.all([
      candidatesApi.getAssessmentDetails(candidateId, jobId).catch(() => null),
      candidatesApi.getInterviewDetails(candidateId, jobId).catch(() => null),
      jobId ? candidatesApi.getManualInterview(candidateId, jobId).catch(() => null) : Promise.resolve(null),
    ]).then(([assessment, interview, manualInterview]) => {
      setAssessmentDetails(assessment);
      setInterviewDetails(interview);
      setManualInterviewDetails(manualInterview);

      if (manualInterview) {
        setManualScore(manualInterview.manual_interview_score != null ? String(manualInterview.manual_interview_score) : '');
        // Use feedback field (backend normalises both feedback and notes)
        setManualFeedback(manualInterview.manual_interview_feedback || manualInterview.manual_interview_notes || '');
        setManualNotes(manualInterview.manual_interview_notes || '');
      } else {
        setManualScore('');
        setManualFeedback('');
        setManualNotes('');
      }
    }).finally(() => setLoadingDetails(false));
  }, [candidateId, jobId]);

  useEffect(() => {
    if (initialTab === 'manual' || initialTab === 'interview' || initialTab === 'assessment' || initialTab === 'sql-assessment') {
      setEvaluationTab(initialTab);
    }
  }, [initialTab]);

  const saveManualInterview = async () => {
    if (!candidateId || !jobId) {
      toast.error('job_id is required to save manual interview details');
      return;
    }

    const scoreValue = manualScore.trim() === '' ? null : Number(manualScore);
    if (scoreValue != null && (!Number.isFinite(scoreValue) || scoreValue < 0 || scoreValue > 100)) {
      toast.error('Score must be a number between 0 and 100');
      return;
    }

    setSavingManual(true);
    try {
      const updated = await candidatesApi.updateManualInterview(candidateId, jobId, {
        interview_mode: 'manual',
        manual_interview_score: scoreValue,
        manual_interview_feedback: manualFeedback || null,
        manual_interview_notes: manualNotes || null,
      });
      setManualInterviewDetails(updated);
      toast.success('Manual interview saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save manual interview');
    } finally {
      setSavingManual(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (candidateError || !candidate) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8">
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <p className="text-muted-foreground">
                {candidateError
                  ? `Error loading candidate: ${candidateError instanceof Error ? candidateError.message : 'Unknown error'}`
                  : 'Candidate not found'}
              </p>
              <div className="flex items-center justify-center gap-3">
                {candidateError && (
                  <Button variant="outline" onClick={() => refetch()}>
                    Retry
                  </Button>
                )}
                <Button asChild>
                  <Link to="/candidates">Back to the Candidates</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(jobId ? `/candidates?job_id=${encodeURIComponent(jobId)}` : '/candidates')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <motion.h1
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl lg:text-3xl font-bold"
              >
                {safeRender(candidate.full_name)}
              </motion.h1>
              <p className="text-muted-foreground">{safeRender(candidate.email)}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto mt-2 sm:mt-0">
            {candidate.applied_at && (
              <Button variant="outline" onClick={() => setEditModalOpen(true)} className="w-full sm:w-auto">
                <Pencil className="mr-2 h-4 w-4" />
                Edit Details
              </Button>
            )}
            <Button variant="outline" onClick={handleDownloadReport} className="w-full sm:w-auto">
              <Download className="mr-2 h-4 w-4" />
              Download Candidate Report
            </Button>
          </div>
        </div>

        {/* Candidate Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <span>{safeRender(candidate.email)}</span>
                </div>
                {candidate.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <span>{safeRender(candidate.phone)}</span>
                  </div>
                )}
                {candidate.location && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <span>{safeRender(candidate.location)}</span>
                  </div>
                )}
                {candidate.mainSkillset && (
                  <div className="flex items-center gap-3">
                    <Briefcase className="h-5 w-5 text-muted-foreground" />
                    <span>{safeRender(candidate.mainSkillset)}</span>
                  </div>
                )}
                {candidate.vendorName && (
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <span>Provided by: {safeRender(candidate.vendorName)}</span>
                  </div>
                )}
                {candidate.portfolio_url && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <a href={candidate.portfolio_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {safeRender(candidate.portfolio_url)}
                    </a>
                  </div>
                )}
                {candidate.github_url && (
                  <div className="flex items-center gap-3">
                    <Github className="h-5 w-5 text-muted-foreground" />
                    <a href={candidate.github_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {safeRender(candidate.github_url)}
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Resume Link */}
            {(candidate.resume_url || candidate.resume_text) && (
              <Card>
                <CardHeader>
                  <CardTitle>Resume</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-4">
                    {candidate.resume_parsed_data && typeof candidate.resume_parsed_data === 'object' ? (
                      <>
                        {Array.isArray((candidate.resume_parsed_data as any).skills) && (
                          <div>
                            <div className="text-xs text-muted-foreground mb-2">Skills</div>
                            <div className="flex flex-wrap gap-2">
                              {asArray<string>((candidate.resume_parsed_data as any).skills).map((s, i) => (
                                <Badge key={i} variant="outline" className="text-xs">{safeRender(s)}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {typeof (candidate.resume_parsed_data as any).summary === 'string' && (candidate.resume_parsed_data as any).summary.trim() && (
                          <div>
                            <div className="text-xs text-muted-foreground">Resume Summary</div>
                            <div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                              {safeRender((candidate.resume_parsed_data as any).summary)}
                            </div>
                          </div>
                        )}

                        {Array.isArray((candidate.resume_parsed_data as any).experience) && (
                          <div>
                            <div className="text-xs text-muted-foreground mb-2">Experience</div>
                            <div className="space-y-3">
                              {asArray<any>((candidate.resume_parsed_data as any).experience).map((e, i) => (
                                <div key={i} className="rounded-md border p-3">
                                  <div className="font-medium text-sm">{safeRender(e?.title) || 'Role'}</div>
                                  <div className="text-xs text-muted-foreground">{safeRender(e?.company)}{e?.duration ? ` • ${safeRender(e.duration)}` : ''}</div>
                                  {e?.description && (
                                    <div className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{safeRender(e.description)}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {Array.isArray((candidate.resume_parsed_data as any).education) && (
                          <div>
                            <div className="text-xs text-muted-foreground mb-2">Education</div>
                            <div className="space-y-3">
                              {asArray<any>((candidate.resume_parsed_data as any).education).map((ed, i) => (
                                <div key={i} className="rounded-md border p-3">
                                  <div className="font-medium text-sm">{safeRender(ed?.degree) || 'Degree'}</div>
                                  <div className="text-xs text-muted-foreground">{safeRender(ed?.institution)}{ed?.year ? ` • ${safeRender(ed.year)}` : ''}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {Array.isArray((candidate.resume_parsed_data as any).projects) && (
                          <div>
                            <div className="text-xs text-muted-foreground mb-2">Projects</div>
                            <div className="space-y-3">
                              {asArray<any>((candidate.resume_parsed_data as any).projects).map((p, i) => (
                                <div key={i} className="rounded-md border p-3">
                                  <div className="font-medium text-sm">{safeRender(p?.name || p?.title) || 'Project'}</div>
                                  {p?.description && (
                                    <div className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{safeRender(p.description)}</div>
                                  )}
                                  {Array.isArray(p?.technologies) && p.technologies.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {p.technologies.map((t: any, ti: number) => (
                                        <Badge key={ti} variant="outline" className="text-xs">{safeRender(t)}</Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {typeof (candidate.resume_parsed_data as any).extracted_text === 'string' && (candidate.resume_parsed_data as any).extracted_text.trim() && (
                          <div>
                            <div className="text-xs text-muted-foreground">Extracted Text</div>
                            <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg overflow-auto max-h-96 mt-2">
                              {safeRender((candidate.resume_parsed_data as any).extracted_text)}
                            </pre>
                          </div>
                        )}

                        {((candidate.resume_parsed_data as any).sections && typeof (candidate.resume_parsed_data as any).sections === 'object') && (
                          <div>
                            <div className="text-xs text-muted-foreground">Parsed Sections</div>
                            <pre className="whitespace-pre-wrap text-xs bg-muted p-4 rounded-lg overflow-auto max-h-96 mt-2">
                              {JSON.stringify((candidate.resume_parsed_data as any).sections, null, 2)}
                            </pre>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No parsed resume details available.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Raw Resume Text */}
            {candidate.resume_text && !candidate.resume_url && (
              <Card>
                <CardHeader>
                  <CardTitle>Resume Text</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg overflow-auto max-h-96">
                    {typeof candidate.resume_text === 'object'
                      ? JSON.stringify(candidate.resume_text, null, 2)
                      : String(candidate.resume_text)}
                  </pre>
                </CardContent>
              </Card>
            )}

            {/* Assessment & Interview Details */}
            {(assessmentDetails || interviewDetails || manualInterviewDetails) && (
              <Card>
                <CardHeader>
                  <CardTitle>Evaluation Details</CardTitle>
                  <CardDescription>Technical assessment and interview results</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs
                    value={evaluationTab}
                    onValueChange={setEvaluationTab}
                    defaultValue={assessmentDetails ? 'assessment' : (manualInterviewDetails ? 'manual' : 'interview')}
                  >
                    <TabsList className="mb-4">
                      {assessmentDetails && (
                        <TabsTrigger value="assessment">
                          <ClipboardList className="mr-2 h-4 w-4" />
                          Assessment
                        </TabsTrigger>
                      )}
                      {interviewDetails && (
                        <TabsTrigger value="interview">
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Interview
                        </TabsTrigger>
                      )}
                      <TabsTrigger value="manual">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Manual Interview
                      </TabsTrigger>
                    </TabsList>

                    {/* Assessment Tab */}
                    {assessmentDetails && (
                      <TabsContent value="assessment" className="space-y-6">
                        {/* Scores Summary */}
                        <div className={`grid gap-4 ${hasSql ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
                          <div className="text-center p-4 bg-muted/50 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">MCQ Score</p>
                            {assessmentDetails.mcq_score != null ? (
                              <ScoreBadge score={assessmentDetails.mcq_score} size="lg" />
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                          <div className="text-center p-4 bg-muted/50 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">Coding Score</p>
                            {assessmentDetails.coding_score != null ? (
                              <ScoreBadge score={assessmentDetails.coding_score} size="lg" />
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                          {hasSql && (
                            <div className="text-center p-4 bg-muted/50 rounded-lg">
                              <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
                                <Database className="h-3.5 w-3.5 text-muted-foreground" />
                                SQL Score
                              </p>
                              {assessmentDetails.sql_score != null ? (
                                <ScoreBadge score={assessmentDetails.sql_score} size="lg" />
                              ) : (
                                <ScoreBadge score={0} size="lg" />
                              )}
                            </div>
                          )}
                          <div className="text-center p-4 bg-muted/50 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">Total Score</p>
                            {assessmentDetails.total_score != null ? (
                              <ScoreBadge score={assessmentDetails.total_score} size="lg" />
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </div>

                        {/* MCQ Results */}
                        {(() => {
                          const content = getAssessmentContent(assessmentDetails);
                          const questions = asArray<any>(assessmentDetails.mcq_questions).length > 0
                            ? asArray<any>(assessmentDetails.mcq_questions)
                            : asArray<any>((content as any)?.mcq_questions);
                          const subs = asArray<any>(assessmentDetails.mcq_submissions);
                          if (questions.length === 0 && subs.length === 0) return null;

                          const subMap = new Map<string, any>();
                          subs.forEach((s: any) => {
                            const qid = s?.question_id != null ? String(s.question_id) : '';
                            if (qid) subMap.set(qid, s);
                          });

                          const correctCount = subs.filter((s: any) => s?.is_correct).length;

                          return (
                            <div>
                              <h4 className="font-semibold text-sm mb-3">MCQ Results ({correctCount}/{questions.length} correct)</h4>
                              <div className="space-y-2 max-h-64 overflow-auto">
                                {questions.map((q: any, idx: number) => {
                                  const qid = q?.id != null ? String(q.id) : String(idx);
                                  const sub = subMap.get(qid);
                                  const attempted = !!sub;
                                  const isCorrect = !!sub?.is_correct;
                                  return (
                                    <div
                                      key={qid}
                                      className={`p-3 rounded-lg border ${attempted ? (isCorrect ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5') : 'border-border bg-muted/20'}`}
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1">
                                          <p className="text-sm font-medium">{safeRender(q?.question || q?.text || q?.question_text) || `Question ${idx + 1}`}</p>
                                          {!attempted ? (
                                            <p className="text-xs text-muted-foreground mt-1">Status: Not Attempted</p>
                                          ) : (
                                            <p className="text-xs text-muted-foreground mt-1">
                                              Your answer: {Array.isArray(sub?.options) ? sub.options[sub.selected_index] : 'N/A'}
                                              {!isCorrect && (
                                                <span className="ml-2 text-success">Correct: {Array.isArray(sub?.options) ? sub.options[sub.correct_index] : 'N/A'}</span>
                                              )}
                                            </p>
                                          )}
                                        </div>
                                        {attempted ? (
                                          isCorrect ? (
                                            <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
                                          ) : (
                                            <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                                          )
                                        ) : (
                                          <Badge variant="secondary" className="text-xs">Not Attempted</Badge>
                                        )}
                                      </div>
                                      {attempted && (
                                        <div className="flex gap-2 mt-2">
                                          <Badge variant="outline" className="text-xs">{safeRender(sub?.difficulty)}</Badge>
                                          <Badge variant="outline" className="text-xs">{safeRender(sub?.topic)}</Badge>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Coding Results */}
                        {(() => {
                          const content = getAssessmentContent(assessmentDetails);
                          const challenges = asArray<any>(assessmentDetails.coding_challenges).length > 0
                            ? asArray<any>(assessmentDetails.coding_challenges)
                            : asArray<any>((content as any)?.coding_challenges);
                          const subs = asArray<any>(assessmentDetails.coding_submissions);

                          if (challenges.length === 0 && subs.length === 0) return null;

                          const subMap = new Map<string, any>();
                          subs.forEach((s: any) => {
                            const cid = s?.challenge_id != null ? String(s.challenge_id) : '';
                            if (cid) subMap.set(cid, s);
                          });

                          return (
                            <div>
                              <h4 className="font-semibold text-sm mb-3">Coding Challenges</h4>
                              <div className="space-y-4">
                                {challenges.map((ch: any, idx: number) => {
                                  const cid = ch?.id != null ? String(ch.id) : String(idx);
                                  const sub = subMap.get(cid);
                                  const attempted = !!sub;
                                  return (
                                    <div key={cid} className="p-4 rounded-lg border">
                                      <div className="flex items-center justify-between mb-2 gap-3">
                                        <h5 className="font-medium">{safeRender(ch?.title) || `Challenge ${idx + 1}`}</h5>
                                        {attempted ? (
                                          <Badge variant={(sub?.score_percentage ?? 0) >= 70 ? 'default' : 'secondary'}>
                                            {safeRender(sub?.passed_count)}/{safeRender(sub?.total_tests)} tests passed
                                          </Badge>
                                        ) : (
                                          <Badge variant="secondary">Not Attempted</Badge>
                                        )}
                                      </div>

                                      <pre className="text-xs bg-muted p-3 rounded max-h-40 overflow-auto mb-3 whitespace-pre-wrap">
                                        {attempted ? (typeof sub?.code === 'object' ? JSON.stringify(sub.code, null, 2) : String(sub?.code || '')) : ''}
                                      </pre>

                                      {!attempted ? (
                                        <div className="text-xs text-muted-foreground">Status: Not Attempted</div>
                                      ) : (
                                        <div className="space-y-1">
                                          {Array.isArray(sub?.test_results) && sub.test_results.map((tr: any, ti: number) => (
                                            <div key={ti} className={`flex items-center gap-2 text-xs ${tr?.passed ? 'text-success' : 'text-destructive'}`}>
                                              {tr?.passed ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                              <span>Input: {safeRender(tr?.input)} → Expected: {safeRender(tr?.expected_output)}, Got: {safeRender(tr?.actual_output) || 'Error'}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Apex Fill-in-the-Blanks Results */}
                        {Array.isArray((assessmentDetails.proctoring_data as any)?.assessment_content?.apex_blanks) && (
                          (assessmentDetails.proctoring_data as any).assessment_content.apex_blanks.length > 0
                        ) && (
                          <div>
                            <h4 className="font-semibold text-sm mb-3">Apex Fill-in-the-Blanks</h4>
                            <div className="space-y-3">
                              {(((assessmentDetails.proctoring_data as any)?.assessment_content?.apex_blanks) as any[]).map((q: any, idx: number) => {
                                const qid = String(q?.id || idx);
                                // Backend stores at apex_blanks_submission (dict: qid → {blank_id → answer})
                                // and apex_blanks_results (array of {question_id, score, max_score, feedback, per_blank[]})
                                const allSubmissions = (assessmentDetails.proctoring_data as any)?.apex_blanks_submission || {};
                                const allResults: any[] = (assessmentDetails.proctoring_data as any)?.apex_blanks_results || [];
                                const qSub: Record<string, string> = allSubmissions?.[qid] || {};
                                const qResult = Array.isArray(allResults) ? allResults.find((r: any) => String(r?.question_id) === qid) : null;
                                const blanks: any[] = Array.isArray(q?.blanks) ? q.blanks : [];
                                // Build per-blank display: show all blanks, not just the first one
                                const blankAnswers = blanks.length > 0
                                  ? blanks.map((b: any) => ({ blankId: String(b?.blank_id || ''), answer: qSub[String(b?.blank_id || '')] || '' }))
                                  : Object.entries(qSub).map(([blankId, answer]) => ({ blankId, answer: String(answer) }));
                                const hasAnyAnswer = blankAnswers.some((b) => b.answer.trim().length > 0);

                                return (
                                  <div key={qid} className="p-4 rounded-lg border">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex-1">
                                        <div className="font-medium text-sm">{safeRender(q?.title) || `Apex Question ${idx + 1}`}</div>
                                        {q?.instructions && (
                                          <div className="text-xs text-muted-foreground mt-1">{safeRender(q.instructions)}</div>
                                        )}
                                      </div>
                                      {qResult ? (
                                        <Badge variant="outline" className="text-xs">
                                          {safeRender(qResult.score)} / {safeRender(qResult.max_score)}
                                        </Badge>
                                      ) : !hasAnyAnswer ? (
                                        <Badge variant="secondary" className="text-xs">Not Attempted</Badge>
                                      ) : null}
                                    </div>

                                    <div className="mt-3 text-sm space-y-2">
                                      <div className="text-xs text-muted-foreground">Candidate Responses</div>
                                      {hasAnyAnswer ? blankAnswers.map((b) => (
                                        <div key={b.blankId} className="rounded-md bg-muted p-2 text-sm">
                                          <span className="text-xs text-muted-foreground mr-2">{b.blankId}:</span>
                                          <span className="whitespace-pre-wrap">{b.answer || <span className="text-muted-foreground">(empty)</span>}</span>
                                        </div>
                                      )) : (
                                        <div className="rounded-md bg-muted p-2 text-sm text-muted-foreground">(No answer submitted)</div>
                                      )}
                                    </div>

                                    {qResult?.feedback && (
                                      <div className="mt-3 text-sm">
                                        <div className="text-xs text-muted-foreground">Evaluation Feedback</div>
                                        <div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                                          {safeRender(qResult.feedback)}
                                        </div>
                                      </div>
                                    )}

                                    {Array.isArray(qResult?.per_blank) && qResult.per_blank.length > 0 && (
                                      <div className="mt-3 space-y-1">
                                        {qResult.per_blank.map((pb: any, pbi: number) => (
                                          <div key={pbi} className={`flex items-start gap-2 text-xs ${pb?.correct ? 'text-success' : 'text-destructive'}`}>
                                            <CheckCircle className={`h-3 w-3 mt-0.5 flex-shrink-0 ${pb?.correct ? '' : 'hidden'}`} />
                                            <XCircle className={`h-3 w-3 mt-0.5 flex-shrink-0 ${pb?.correct ? 'hidden' : ''}`} />
                                            <span><span className="font-medium">{pb?.blank_id}</span>: got "{safeRender(pb?.received)}" — expected "{safeRender(pb?.expected)}"</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* SQL Responses */}
                        {(() => {
                          const pd = assessmentDetails.proctoring_data as any;
                          const sqlChallenges: any[] = pd?.assessment_content?.sql_challenges || [];
                          const sqlSubs: any[] = pd?.sql_submissions || [];
                          if (sqlChallenges.length === 0 && sqlSubs.length === 0) return null;

                          const subMap = new Map<string, any>();
                          sqlSubs.forEach((s: any) => {
                            const cid = s?.challenge_id != null ? String(s.challenge_id) : '';
                            if (cid) subMap.set(cid, s);
                          });

                          const displayList: any[] = sqlChallenges.length > 0 ? sqlChallenges : sqlSubs.map((s: any) => ({ id: s?.challenge_id, title: 'SQL Challenge', description: '' }));

                          return (
                            <div>
                              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                <Database className="h-4 w-4 text-indigo-600" />
                                SQL Responses
                              </h4>
                              <div className="space-y-4">
                                {displayList.map((ch: any, idx: number) => {
                                  const cid = ch?.id != null ? String(ch.id) : String(idx);
                                  const sub = subMap.get(cid) || (sqlChallenges.length === 0 ? sqlSubs[idx] : undefined);
                                  const attempted = !!sub;
                                  const score = sub?.score_percentage ?? null;
                                  const testResults: any[] = sub?.test_results || [];
                                  const firstResult = testResults[0];
                                  const meta = ch?.metadata || {};
                                  const dbSchema = meta?.db_schema || '';
                                  const sampleData = meta?.sample_data || '';
                                  const expectedQuery = meta?.expected_query || '';

                                  return (
                                    <div key={cid} className="p-5 rounded-lg border bg-card shadow-sm space-y-4">
                                      {/* Header */}
                                      <div className="flex items-center justify-between border-b pb-3 gap-3">
                                        <h5 className="font-semibold text-sm text-foreground">
                                          {safeRender(ch?.title) || `SQL Challenge ${idx + 1}`}
                                        </h5>
                                        {attempted ? (
                                          <Badge variant={score != null && score >= 70 ? 'default' : 'secondary'} className="font-semibold">
                                            {score != null ? `${Math.round(score)}%` : 'Submitted'}
                                          </Badge>
                                        ) : (
                                          <Badge variant="secondary">Not Attempted</Badge>
                                        )}
                                      </div>

                                      {/* Description */}
                                      {ch?.description && (
                                        <div className="space-y-1.5">
                                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Problem Statement</p>
                                          <div className="max-h-48 overflow-y-auto rounded-md border border-muted/30 bg-muted/10 p-3">
                                            <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] text-foreground/90 leading-relaxed prose-p:text-[13px] prose-p:leading-relaxed prose-li:text-[13px] prose-li:leading-relaxed">
                                              <ReactMarkdown>{safeRender(ch.description)}</ReactMarkdown>
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {/* Collapsible DB reference panel */}
                                      {(dbSchema || sampleData || expectedQuery) && (
                                        <details className="group border rounded bg-muted/20 overflow-hidden">
                                          <summary className="flex items-center justify-between p-2.5 text-xs font-medium cursor-pointer hover:bg-muted/40 select-none list-none">
                                            <span className="text-muted-foreground">View Database Details &amp; Reference Query</span>
                                            <span className="text-muted-foreground group-open:rotate-180 transition-transform duration-200">▼</span>
                                          </summary>
                                          <div className="p-3 border-t bg-muted/10 space-y-3">
                                            {dbSchema && (
                                              <div>
                                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Database Schema</p>
                                                <pre className="text-xs bg-muted p-2 rounded max-h-36 overflow-auto whitespace-pre font-mono text-muted-foreground leading-relaxed">{dbSchema}</pre>
                                              </div>
                                            )}
                                            {sampleData && (
                                              <div>
                                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Sample Data</p>
                                                <pre className="text-xs bg-muted p-2 rounded max-h-36 overflow-auto whitespace-pre font-mono text-muted-foreground leading-relaxed">{sampleData}</pre>
                                              </div>
                                            )}
                                            {expectedQuery && (
                                              <div>
                                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Expected / Reference Query</p>
                                                <pre className="text-xs bg-muted p-2 rounded max-h-36 overflow-auto whitespace-pre font-mono text-indigo-900 dark:text-indigo-200 leading-relaxed">{expectedQuery}</pre>
                                              </div>
                                            )}
                                          </div>
                                        </details>
                                      )}

                                      {/* Candidate answer & result */}
                                      {attempted ? (
                                        <div className="space-y-3">
                                          <div>
                                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Candidate's SQL Query</p>
                                            <pre className="text-xs bg-slate-950 text-slate-100 p-3 rounded font-mono whitespace-pre-wrap max-h-48 overflow-auto leading-relaxed border border-slate-800">
                                              {typeof sub?.code === 'string' && sub.code.trim()
                                                ? sub.code
                                                : '(no query submitted)'}
                                            </pre>
                                          </div>

                                          {firstResult && (
                                            <div className="space-y-2">
                                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Evaluation Result</p>
                                              <div className="flex items-center gap-2">
                                                {firstResult?.passed ? (
                                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400">
                                                    <CheckCircle className="h-3 w-3" />
                                                    Passed / Accepted
                                                  </span>
                                                ) : (
                                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400">
                                                    <XCircle className="h-3 w-3" />
                                                    {firstResult?.status || 'Wrong Answer'}
                                                  </span>
                                                )}
                                                {firstResult?.time_used != null && (
                                                  <span className="text-[10px] font-mono text-muted-foreground">
                                                    Time: {Number(firstResult.time_used).toFixed(3)}s
                                                  </span>
                                                )}
                                              </div>
                                              {firstResult?.stdout && (
                                                <div className="space-y-1">
                                                  <p className="text-[9px] font-semibold text-muted-foreground uppercase">Query Output</p>
                                                  <pre className="text-xs bg-muted/60 p-2 rounded max-h-32 overflow-auto whitespace-pre font-mono leading-relaxed border">{firstResult.stdout}</pre>
                                                </div>
                                              )}
                                              {(firstResult?.error || sub?.runtime_error) && (
                                                <div className={`p-2.5 rounded text-xs font-mono whitespace-pre-wrap border leading-relaxed ${
                                                  firstResult?.passed
                                                    ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border-green-100 dark:border-green-900/10'
                                                    : 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border-red-100 dark:border-red-900/10'
                                                }`}>
                                                  {safeRender(firstResult?.error || sub.runtime_error).replace(/Your query/g, "Candidate's query")}
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="text-xs text-muted-foreground italic bg-muted/10 p-2 rounded text-center">
                                          Status: Not Attempted
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </TabsContent>
                    )}

                    {/* Interview Tab */}
                    {interviewDetails && (
                      <TabsContent value="interview" className="space-y-6">
                        {/* Interview Mode */}
                        <div className="p-4 rounded-lg bg-muted/50">
                          <p className="text-sm font-medium mb-1">Interview Mode</p>
                          <Badge variant="outline">
                            {manualInterviewDetails?.interview_mode === 'manual' ? 'Manual Interview' : 'AI Interview'}
                          </Badge>
                        </div>

                        {/* Recommendation */}
                        {typeof interviewDetails.final_evaluation?.recommendation === 'string' && (
                          <div className="p-4 rounded-lg bg-muted/50">
                            <p className="text-sm font-medium mb-1">Recommendation</p>
                            {(() => {
                              const rec = interviewDetails.final_evaluation.recommendation.toLowerCase();
                              const isHire = rec === 'hire' || rec === 'strong_hire';
                              const isMaybe = rec === 'maybe';
                              return (
                                <Badge variant={isHire ? 'default' : isMaybe ? 'outline' : 'destructive'}>
                                  {interviewDetails.final_evaluation.recommendation.replace(/_/g, ' ').toUpperCase()}
                                </Badge>
                              );
                            })()}
                          </div>
                        )}

                        {/* Strengths & Areas to Improve */}
                        {interviewDetails.final_evaluation && (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h5 className="font-medium text-sm mb-2 text-success">Strengths</h5>
                              <ul className="space-y-1">
                                {Array.isArray(interviewDetails.final_evaluation.strengths) ? interviewDetails.final_evaluation.strengths.map((s, i) => (
                                  <li key={i} className="text-sm flex items-start gap-2">
                                    <CheckCircle className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                                    {typeof s === 'string' ? s : JSON.stringify(s)}
                                  </li>
                                )) : (
                                  <li className="text-sm text-muted-foreground">{typeof interviewDetails.final_evaluation.strengths === 'string' ? interviewDetails.final_evaluation.strengths : 'None noted'}</li>
                                )}
                              </ul>
                            </div>
                            <div>
                              <h5 className="font-medium text-sm mb-2 text-destructive">Areas to Improve</h5>
                              <ul className="space-y-1">
                                {(() => {
                                  const items = (interviewDetails.final_evaluation as any).areas_for_improvement
                                    || (interviewDetails.final_evaluation as any).weaknesses;
                                  return Array.isArray(items) ? items.map((w: any, i: number) => (
                                    <li key={i} className="text-sm flex items-start gap-2">
                                      <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                                      {typeof w === 'string' ? w : JSON.stringify(w)}
                                    </li>
                                  )) : (
                                    <li className="text-sm text-muted-foreground">{typeof items === 'string' ? items : 'None noted'}</li>
                                  );
                                })()}
                              </ul>
                            </div>
                          </div>
                        )}

                        {/* Q&A */}
                        {Array.isArray(interviewDetails.questions) && interviewDetails.questions.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-sm mb-3">
                              Interview Q&A
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                ({interviewDetails.questions.length} questions,{' '}
                                {Array.isArray(interviewDetails.responses) ? interviewDetails.responses.filter(r => typeof r.transcript === 'string' && r.transcript.trim().length > 0).length : 0} answered)
                              </span>
                            </h4>
                            <div className="space-y-4 max-h-[600px] overflow-auto pr-1">
                              {interviewDetails.questions.map((q, idx) => {
                                const response = Array.isArray(interviewDetails.responses)
                                  ? interviewDetails.responses.find(r => r.question_index === idx)
                                  : undefined;
                                const transcript = response
                                  ? (typeof response.transcript === 'object'
                                      ? JSON.stringify(response.transcript)
                                      : String(response.transcript ?? ''))
                                  : null;
                                const hasTranscript = transcript !== null && transcript.trim().length > 0;
                                const wasAttempted = response !== undefined;
                                const durSecs = response?.audio_duration_seconds;

                                return (
                                  <div key={idx} className="p-4 rounded-lg border">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                      <div className="flex items-start gap-2 flex-1">
                                        <Badge variant="outline" className="text-xs shrink-0 mt-0.5">{safeRender(q.question_type)}</Badge>
                                        <p className="text-sm font-medium">{safeRender(q.question_text)}</p>
                                      </div>
                                      <span className="text-xs text-muted-foreground shrink-0">Q{idx + 1}</span>
                                    </div>
                                    {hasTranscript ? (
                                      <div className="bg-muted/50 p-3 rounded text-sm">
                                        <div className="flex items-center justify-between mb-1">
                                          <p className="text-muted-foreground text-xs">Candidate's Answer:</p>
                                          {typeof durSecs === 'number' && durSecs > 0 && (
                                            <span className="text-xs text-muted-foreground">{durSecs.toFixed(0)}s recorded</span>
                                          )}
                                        </div>
                                        <p className="whitespace-pre-wrap">{transcript}</p>
                                      </div>
                                    ) : wasAttempted ? (
                                      <div className="bg-muted/30 p-3 rounded text-sm flex items-center gap-2">
                                        <span className="text-muted-foreground italic text-xs">No speech detected</span>
                                        {typeof durSecs === 'number' && durSecs > 0 && (
                                          <span className="text-xs text-muted-foreground">({durSecs.toFixed(0)}s recorded)</span>
                                        )}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-muted-foreground italic">Not attempted</p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Detailed Feedback */}
                        {interviewDetails.final_evaluation?.detailed_feedback && (
                          <div>
                            <h4 className="font-semibold text-sm mb-2">Detailed Feedback</h4>
                            <p className="text-sm bg-muted/50 p-4 rounded-lg">
                              {typeof interviewDetails.final_evaluation.detailed_feedback === 'object' ? JSON.stringify(interviewDetails.final_evaluation.detailed_feedback, null, 2) : interviewDetails.final_evaluation.detailed_feedback}
                            </p>
                          </div>
                        )}
                      </TabsContent>
                    )}

                    {/* Manual Interview Tab */}
                    <TabsContent value="manual" className="space-y-4">
                      {!jobId ? (
                        <div className="text-sm text-muted-foreground">Select a job (job_id) to enter manual interview details.</div>
                      ) : (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="manualScore">Score (0-100)</Label>
                            <Input
                              id="manualScore"
                              type="number"
                              min={0}
                              max={100}
                              value={manualScore}
                              onChange={(e) => setManualScore(e.target.value)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="manualFeedback">Feedback</Label>
                            <Textarea
                              id="manualFeedback"
                              value={manualFeedback}
                              onChange={(e) => setManualFeedback(e.target.value)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="manualNotes">Notes</Label>
                            <Textarea
                              id="manualNotes"
                              value={manualNotes}
                              onChange={(e) => setManualNotes(e.target.value)}
                            />
                          </div>

                          <Button onClick={saveManualInterview} disabled={savingManual}>
                            {savingManual ? 'Saving...' : 'Save Manual Interview'}
                          </Button>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            {/* Status */}
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Resume</p>
                    <Badge variant={candidate.resume_parsed_data ? 'default' : 'secondary'}>
                      {candidate.resume_parsed_data ? 'Parsed' : 'Not Parsed'}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Applied</p>
                    <p className="font-medium">{(candidate.applied_at || candidate.created_at) ? new Date(candidate.applied_at || candidate.created_at).toLocaleDateString() : 'N/A'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Consent</p>
                  <Badge variant={candidate.consent_given ? 'default' : 'destructive'}>
                    {candidate.consent_given ? 'Given' : 'Not Given'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* ATS Screening Scores */}
            {screening && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Resume Score
                  </CardTitle>
                  <CardDescription>ATS screening analysis</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Overall Score</p>
                    <div className="flex justify-center">
                      <ScoreBadge score={screening.overall_score} size="lg" />
                    </div>
                    {screening.shortlisted && (
                      <Badge className="mt-2" variant="default">Shortlisted</Badge>
                    )}
                    {screening.shortlisted === false && (
                      <Badge className="mt-2" variant="secondary">Not Shortlisted</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {typeof screening.skill_relevance_score === 'number' && (
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Skills</p>
                        <div className="flex justify-center">
                          <ScoreBadge score={screening.skill_relevance_score} size="sm" />
                        </div>
                      </div>
                    )}
                    {typeof screening.experience_score === 'number' && (
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Experience</p>
                        <div className="flex justify-center">
                          <ScoreBadge score={screening.experience_score} size="sm" />
                        </div>
                      </div>
                    )}
                    {typeof screening.education_score === 'number' && (
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Education</p>
                        <div className="flex justify-center">
                          <ScoreBadge score={screening.education_score} size="sm" />
                        </div>
                      </div>
                    )}
                    {typeof screening.credibility_score === 'number' && (
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Credibility</p>
                        <div className="flex justify-center">
                          <ScoreBadge score={screening.credibility_score} size="sm" />
                        </div>
                      </div>
                    )}
                  </div>
                  {(() => {
                    const whatsGood = screening.detailed_analysis?.whats_good?.length 
                      ? screening.detailed_analysis.whats_good 
                      : (screening.reason_codes || []).filter((r: any) => r.type?.toLowerCase() === 'positive').map((r: any) => r.description);

                    const whatLacks = screening.detailed_analysis?.what_lacks?.length 
                      ? screening.detailed_analysis.what_lacks 
                      : (screening.reason_codes || []).filter((r: any) => r.type?.toLowerCase() === 'negative').map((r: any) => r.description);

                    const hasNewFields = whatsGood.length > 0 || whatLacks.length > 0;

                    if (hasNewFields) {
                      return (
                        <div className="space-y-4">
                          {whatsGood.length > 0 && (
                            <div className="text-sm text-muted-foreground bg-success/5 border border-success/20 p-4 rounded-lg">
                              <p className="font-medium text-success mb-2 flex items-center gap-2">
                                <CheckCircle className="h-4 w-4" /> What's Good
                              </p>
                              <ul className="space-y-1.5 list-disc pl-5">
                                {whatsGood.map((item: string, i: number) => (
                                  <li key={i}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className="text-sm text-muted-foreground bg-destructive/5 border border-destructive/20 p-4 rounded-lg">
                            <p className="font-medium text-destructive mb-2 flex items-center gap-2">
                              <XCircle className="h-4 w-4" /> What Lacks
                            </p>
                            {whatLacks.length > 0 ? (
                              <ul className="space-y-1.5 list-disc pl-5">
                                {whatLacks.map((item: string, i: number) => (
                                  <li key={i}>{item}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-muted-foreground italic">No significant gaps detected for this role.</p>
                            )}
                          </div>
                        </div>
                      );
                    }

                    if (screening.shortlist_reason) {
                      return (
                        <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                          <p className="font-medium text-foreground mb-1">Reason</p>
                          {screening.shortlist_reason}
                        </div>
                      );
                    }

                    return null;
                  })()}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Edit Candidate Modal */}
      <EditCandidateModal
        candidate={candidate as any}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onUpdated={() => refetch()}
      />
    </DashboardLayout>
  );
}
