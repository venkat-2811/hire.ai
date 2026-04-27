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
} from 'lucide-react';
import { useCandidate, useCandidateScreenings } from '@/hooks/useCandidates';
import { useProfile } from '@/hooks/useProfile';
import { candidatesApi, type AssessmentDetails, type InterviewDetails, type ManualInterviewDetails } from '@/lib/api';
import { ScoreBadge } from '@/components/ui/score-badge';
import { PDFExportService } from '@/lib/pdf-export';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

const safeRender = (val: any): string => {
  if (val == null) return '';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
};

export default function CandidateDetailsPage() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get('job_id') || undefined;
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

  const [manualScore, setManualScore] = useState<string>('');
  const [manualFeedback, setManualFeedback] = useState<string>('');
  const [manualNotes, setManualNotes] = useState<string>('');

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
        setManualFeedback(manualInterview.manual_interview_feedback || '');
        setManualNotes(manualInterview.manual_interview_notes || '');
      } else {
        setManualScore('');
        setManualFeedback('');
        setManualNotes('');
      }
    }).finally(() => setLoadingDetails(false));
  }, [candidateId, jobId]);

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
            <Button variant="ghost" size="icon" onClick={() => navigate('/candidates')}>
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
          <Button variant="outline" onClick={handleDownloadReport} className="w-full sm:w-auto mt-2 sm:mt-0">
            <Download className="mr-2 h-4 w-4" />
            Download Candidate Report
          </Button>
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
                  {candidate.resume_url ? (
                    <a
                      href={candidate.resume_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Open uploaded Resume
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Uploaded resume is noted, but no file URL is available yet.
                    </p>
                  )}
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
                  <Tabs defaultValue={assessmentDetails ? 'assessment' : (manualInterviewDetails ? 'manual' : 'interview')}>
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
                        <div className="grid grid-cols-3 gap-4">
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
                        {Array.isArray(assessmentDetails.mcq_submissions) && assessmentDetails.mcq_submissions.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-sm mb-3">MCQ Results ({assessmentDetails.mcq_submissions.filter(s => s.is_correct).length}/{assessmentDetails.mcq_submissions.length} correct)</h4>
                            <div className="space-y-2 max-h-64 overflow-auto">
                              {assessmentDetails.mcq_submissions.map((sub, idx) => (
                                <div key={idx} className={`p-3 rounded-lg border ${sub.is_correct ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'}`}>
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1">
                                      <p className="text-sm font-medium">{typeof sub.question === 'object' ? JSON.stringify(sub.question) : sub.question}</p>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Your answer: {Array.isArray(sub.options) ? sub.options[sub.selected_index] : 'N/A'}
                                        {!sub.is_correct && (
                                          <span className="ml-2 text-success">Correct: {Array.isArray(sub.options) ? sub.options[sub.correct_index] : 'N/A'}</span>
                                        )}
                                      </p>
                                    </div>
                                    {sub.is_correct ? (
                                      <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
                                    ) : (
                                      <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                                    )}
                                  </div>
                                  <div className="flex gap-2 mt-2">
                                    <Badge variant="outline" className="text-xs">{safeRender(sub.difficulty)}</Badge>
                                    <Badge variant="outline" className="text-xs">{safeRender(sub.topic)}</Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Coding Results */}
                        {Array.isArray(assessmentDetails.coding_submissions) && assessmentDetails.coding_submissions.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-sm mb-3">Coding Challenges</h4>
                            <div className="space-y-4">
                              {assessmentDetails.coding_submissions.map((sub, idx) => {
                                const challenge = Array.isArray(assessmentDetails.coding_challenges) ? assessmentDetails.coding_challenges.find(c => c.id === sub.challenge_id) : undefined;
                                return (
                                  <div key={idx} className="p-4 rounded-lg border">
                                    <div className="flex items-center justify-between mb-2">
                                      <h5 className="font-medium">{safeRender(challenge?.title) || `Challenge ${idx + 1}`}</h5>
                                      <Badge variant={sub.score_percentage >= 70 ? 'default' : 'secondary'}>
                                        {sub.passed_count}/{sub.total_tests} tests passed
                                      </Badge>
                                    </div>
                                    <pre className="text-xs bg-muted p-3 rounded max-h-40 overflow-auto mb-3 whitespace-pre-wrap">
                                      {typeof sub.code === 'object' ? JSON.stringify(sub.code, null, 2) : sub.code}
                                    </pre>
                                    <div className="space-y-1">
                                      {Array.isArray(sub.test_results) && sub.test_results.map((tr, ti) => (
                                        <div key={ti} className={`flex items-center gap-2 text-xs ${tr.passed ? 'text-success' : 'text-destructive'}`}>
                                          {tr.passed ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                          <span>Input: {safeRender(tr.input)} → Expected: {safeRender(tr.expected_output)}, Got: {safeRender(tr.actual_output) || 'Error'}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </TabsContent>
                    )}

                    {/* Interview Tab */}
                    {interviewDetails && (
                      <TabsContent value="interview" className="space-y-6">
                        {/* Recommendation */}
                        {typeof interviewDetails.final_evaluation?.recommendation === 'string' && (
                          <div className="p-4 rounded-lg bg-muted/50">
                            <p className="text-sm font-medium mb-1">Recommendation</p>
                            <Badge variant={interviewDetails.final_evaluation.recommendation.toLowerCase().includes('hire') ? 'default' : 'secondary'}>
                              {interviewDetails.final_evaluation.recommendation.replace(/_/g, ' ').toUpperCase()}
                            </Badge>
                          </div>
                        )}

                        {/* Strengths & Weaknesses */}
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
                                {Array.isArray(interviewDetails.final_evaluation.weaknesses) ? interviewDetails.final_evaluation.weaknesses.map((w, i) => (
                                  <li key={i} className="text-sm flex items-start gap-2">
                                    <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                                    {typeof w === 'string' ? w : JSON.stringify(w)}
                                  </li>
                                )) : (
                                  <li className="text-sm text-muted-foreground">{typeof interviewDetails.final_evaluation.weaknesses === 'string' ? interviewDetails.final_evaluation.weaknesses : 'None noted'}</li>
                                )}
                              </ul>
                            </div>
                          </div>
                        )}

                        {/* Q&A */}
                        {Array.isArray(interviewDetails.questions) && interviewDetails.questions.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-sm mb-3">Interview Q&A</h4>
                            <div className="space-y-4 max-h-96 overflow-auto">
                              {interviewDetails.questions.map((q, idx) => {
                                const response = Array.isArray(interviewDetails.responses) ? interviewDetails.responses.find(r => r.question_index === idx) : undefined;
                                return (
                                  <div key={idx} className="p-4 rounded-lg border">
                                    <div className="flex items-start gap-2 mb-2">
                                      <Badge variant="outline" className="text-xs">{safeRender(q.question_type)}</Badge>
                                      <p className="text-sm font-medium">{safeRender(q.question_text)}</p>
                                    </div>
                                    {response ? (
                                      <div className="bg-muted/50 p-3 rounded text-sm">
                                        <p className="text-muted-foreground text-xs mb-1">Candidate's Answer:</p>
                                        <p>{typeof response.transcript === 'object' ? JSON.stringify(response.transcript) : response.transcript}</p>
                                      </div>
                                    ) : (
                                      <p className="text-sm text-muted-foreground italic">No response recorded</p>
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
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Overall Score</p>
                    <ScoreBadge score={screening.overall_score} size="lg" />
                    {screening.shortlisted && (
                      <Badge className="mt-2" variant="default">Shortlisted</Badge>
                    )}
                    {screening.shortlisted === false && (
                      <Badge className="mt-2" variant="secondary">Not Shortlisted</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {typeof screening.skill_relevance_score === 'number' && (
                      <div className="text-center p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Skills</p>
                        <ScoreBadge score={screening.skill_relevance_score} size="sm" />
                      </div>
                    )}
                    {typeof screening.experience_score === 'number' && (
                      <div className="text-center p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Experience</p>
                        <ScoreBadge score={screening.experience_score} size="sm" />
                      </div>
                    )}
                    {typeof screening.education_score === 'number' && (
                      <div className="text-center p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Education</p>
                        <ScoreBadge score={screening.education_score} size="sm" />
                      </div>
                    )}
                    {typeof screening.credibility_score === 'number' && (
                      <div className="text-center p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Credibility</p>
                        <ScoreBadge score={screening.credibility_score} size="sm" />
                      </div>
                    )}
                  </div>
                  {screening.shortlist_reason && (
                    <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                      <p className="font-medium text-foreground mb-1">Reason</p>
                      {screening.shortlist_reason}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
