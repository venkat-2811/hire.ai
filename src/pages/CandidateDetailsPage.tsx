import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
} from 'lucide-react';
import { useCandidate } from '@/hooks/useCandidates';
import { candidatesApi, type AssessmentDetails, type InterviewDetails } from '@/lib/api';
import { ScoreBadge } from '@/components/ui/score-badge';

export default function CandidateDetailsPage() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const navigate = useNavigate();
  const { loading: authLoading } = useRequireAuth();
  const { data: candidate, isLoading } = useCandidate(candidateId || '');

  const [assessmentDetails, setAssessmentDetails] = useState<AssessmentDetails | null>(null);
  const [interviewDetails, setInterviewDetails] = useState<InterviewDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (!candidateId) return;
    setLoadingDetails(true);
    Promise.all([
      candidatesApi.getAssessmentDetails(candidateId).catch(() => null),
      candidatesApi.getInterviewDetails(candidateId).catch(() => null),
    ]).then(([assessment, interview]) => {
      setAssessmentDetails(assessment);
      setInterviewDetails(interview);
    }).finally(() => setLoadingDetails(false));
  }, [candidateId]);

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!candidate) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Candidate not found</p>
              <Button asChild className="mt-4">
                <Link to="/candidates">Back to Candidates</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
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
              {candidate.full_name}
            </motion.h1>
            <p className="text-muted-foreground">{candidate.email}</p>
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
                  <span>{candidate.email}</span>
                </div>
                {candidate.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <span>{candidate.phone}</span>
                  </div>
                )}
                {candidate.portfolio_url && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <a href={candidate.portfolio_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {candidate.portfolio_url}
                    </a>
                  </div>
                )}
                {candidate.github_url && (
                  <div className="flex items-center gap-3">
                    <Github className="h-5 w-5 text-muted-foreground" />
                    <a href={candidate.github_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {candidate.github_url}
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
                      Open uploaded resume
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
                  <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg max-h-96 overflow-auto">
                    {candidate.resume_text}
                  </pre>
                </CardContent>
              </Card>
            )}

            {/* Assessment & Interview Details */}
            {(assessmentDetails || interviewDetails) && (
              <Card>
                <CardHeader>
                  <CardTitle>Evaluation Details</CardTitle>
                  <CardDescription>Technical assessment and AI interview results</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue={assessmentDetails ? 'assessment' : 'interview'}>
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
                        {assessmentDetails.mcq_submissions?.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-sm mb-3">MCQ Results ({assessmentDetails.mcq_submissions.filter(s => s.is_correct).length}/{assessmentDetails.mcq_submissions.length} correct)</h4>
                            <div className="space-y-2 max-h-64 overflow-auto">
                              {assessmentDetails.mcq_submissions.map((sub, idx) => (
                                <div key={idx} className={`p-3 rounded-lg border ${sub.is_correct ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'}`}>
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1">
                                      <p className="text-sm font-medium">{sub.question}</p>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Your answer: {sub.options?.[sub.selected_index] || 'N/A'}
                                        {!sub.is_correct && (
                                          <span className="ml-2 text-success">Correct: {sub.options?.[sub.correct_index]}</span>
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
                                    <Badge variant="outline" className="text-xs">{sub.difficulty}</Badge>
                                    <Badge variant="outline" className="text-xs">{sub.topic}</Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Coding Results */}
                        {assessmentDetails.coding_submissions?.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-sm mb-3">Coding Challenges</h4>
                            <div className="space-y-4">
                              {assessmentDetails.coding_submissions.map((sub, idx) => {
                                const challenge = assessmentDetails.coding_challenges?.find(c => c.id === sub.challenge_id);
                                return (
                                  <div key={idx} className="p-4 rounded-lg border">
                                    <div className="flex items-center justify-between mb-2">
                                      <h5 className="font-medium">{challenge?.title || `Challenge ${idx + 1}`}</h5>
                                      <Badge variant={sub.score_percentage >= 70 ? 'default' : 'secondary'}>
                                        {sub.passed_count}/{sub.total_tests} tests passed
                                      </Badge>
                                    </div>
                                    <pre className="text-xs bg-muted p-3 rounded max-h-40 overflow-auto mb-3">
                                      {sub.code}
                                    </pre>
                                    <div className="space-y-1">
                                      {sub.test_results?.map((tr, ti) => (
                                        <div key={ti} className={`flex items-center gap-2 text-xs ${tr.passed ? 'text-success' : 'text-destructive'}`}>
                                          {tr.passed ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                          <span>Input: {tr.input} → Expected: {tr.expected}, Got: {tr.actual || 'Error'}</span>
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
                        {/* Evaluation Summary */}
                        {interviewDetails.final_evaluation && (
                          <div className="grid grid-cols-3 gap-4">
                            <div className="text-center p-4 bg-muted/50 rounded-lg">
                              <p className="text-xs text-muted-foreground mb-1">Overall Score</p>
                              <ScoreBadge score={interviewDetails.final_evaluation.overall_score} size="lg" />
                            </div>
                            <div className="text-center p-4 bg-muted/50 rounded-lg">
                              <p className="text-xs text-muted-foreground mb-1">Technical</p>
                              <ScoreBadge score={interviewDetails.final_evaluation.technical_score} size="lg" />
                            </div>
                            <div className="text-center p-4 bg-muted/50 rounded-lg">
                              <p className="text-xs text-muted-foreground mb-1">Communication</p>
                              <ScoreBadge score={interviewDetails.final_evaluation.communication_score} size="lg" />
                            </div>
                          </div>
                        )}

                        {/* Recommendation */}
                        {interviewDetails.final_evaluation?.recommendation && (
                          <div className="p-4 rounded-lg bg-muted/50">
                            <p className="text-sm font-medium mb-1">Recommendation</p>
                            <Badge variant={interviewDetails.final_evaluation.recommendation.includes('hire') ? 'default' : 'secondary'}>
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
                                {interviewDetails.final_evaluation.strengths?.map((s, i) => (
                                  <li key={i} className="text-sm flex items-start gap-2">
                                    <CheckCircle className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                                    {s}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <h5 className="font-medium text-sm mb-2 text-destructive">Areas to Improve</h5>
                              <ul className="space-y-1">
                                {interviewDetails.final_evaluation.weaknesses?.map((w, i) => (
                                  <li key={i} className="text-sm flex items-start gap-2">
                                    <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                                    {w}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}

                        {/* Q&A */}
                        {interviewDetails.questions?.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-sm mb-3">Interview Q&A</h4>
                            <div className="space-y-4 max-h-96 overflow-auto">
                              {interviewDetails.questions.map((q, idx) => {
                                const response = interviewDetails.responses?.find(r => r.question_index === idx);
                                return (
                                  <div key={idx} className="p-4 rounded-lg border">
                                    <div className="flex items-start gap-2 mb-2">
                                      <Badge variant="outline" className="text-xs">{q.question_type}</Badge>
                                      <p className="text-sm font-medium">{q.question_text}</p>
                                    </div>
                                    {response ? (
                                      <div className="bg-muted/50 p-3 rounded text-sm">
                                        <p className="text-muted-foreground text-xs mb-1">Candidate's Answer:</p>
                                        <p>{response.transcript}</p>
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
                              {interviewDetails.final_evaluation.detailed_feedback}
                            </p>
                          </div>
                        )}
                      </TabsContent>
                    )}
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
                    <p className="font-medium">{new Date(candidate.created_at).toLocaleDateString()}</p>
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
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
