import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft, 
  ArrowRight, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  Loader2,
  Play,
  Send,
  Code,
  MessageSquare,
  Award,
  Shield,
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { 
  useInterview, 
  useInterviewQuestions, 
  useSubmitResponse,
  usePracticalAssessments,
  useSubmitPractical,
  useUpdateProctoring,
  useCompleteInterview,
  useInterviewEvaluation
} from '@/hooks/useInterviews';
import { cn } from '@/lib/utils';

type InterviewPhase = 'questions' | 'practicals' | 'completed';

export default function InterviewSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { loading: authLoading } = useRequireAuth();

  const { data: session, isLoading: sessionLoading } = useInterview(sessionId || '');
  const { data: questions } = useInterviewQuestions(sessionId || '');
  const { data: practicals } = usePracticalAssessments(sessionId || '');
  const { data: evaluation } = useInterviewEvaluation(sessionId || '');
  
  const submitResponse = useSubmitResponse();
  const submitPractical = useSubmitPractical();
  const updateProctoring = useUpdateProctoring();
  const completeInterview = useCompleteInterview();

  const [phase, setPhase] = useState<InterviewPhase>('questions');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentPracticalIndex, setCurrentPracticalIndex] = useState(0);
  const [response, setResponse] = useState('');
  const [startTime, setStartTime] = useState<number>(Date.now());
  
  // Proctoring state
  const [tabSwitches, setTabSwitches] = useState(0);
  const [copyPasteCount, setCopyPasteCount] = useState(0);
  const [fullscreenExits, setFullscreenExits] = useState(0);

  // Proctoring: Tab switch detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && session?.status === 'in_progress') {
        setTabSwitches(prev => prev + 1);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [session?.status]);

  // Proctoring: Copy-paste detection
  useEffect(() => {
    const handleCopy = () => {
      if (session?.status === 'in_progress') {
        setCopyPasteCount(prev => prev + 1);
      }
    };

    const handlePaste = () => {
      if (session?.status === 'in_progress') {
        setCopyPasteCount(prev => prev + 1);
      }
    };

    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
    };
  }, [session?.status]);

  // Update proctoring data periodically
  useEffect(() => {
    if (!sessionId || session?.status !== 'in_progress') return;

    const interval = setInterval(() => {
      updateProctoring.mutate({
        sessionId,
        data: {
          tab_switches: tabSwitches,
          copy_paste_count: copyPasteCount,
          fullscreen_exits: fullscreenExits,
          warnings: []
        }
      });
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [sessionId, session?.status, tabSwitches, copyPasteCount, fullscreenExits]);

  const currentQuestion = questions?.[currentQuestionIndex];
  const currentPractical = practicals?.[currentPracticalIndex];
  const totalQuestions = questions?.length || 0;
  const totalPracticals = practicals?.length || 0;

  const handleSubmitResponse = async () => {
    if (!currentQuestion || !sessionId) return;

    const timeTaken = Math.floor((Date.now() - startTime) / 1000);

    submitResponse.mutate({
      sessionId,
      data: {
        question_id: currentQuestion.id,
        response_text: response,
        time_taken_seconds: timeTaken
      }
    }, {
      onSuccess: () => {
        if (currentQuestionIndex < totalQuestions - 1) {
          setCurrentQuestionIndex(prev => prev + 1);
          setResponse('');
          setStartTime(Date.now());
        } else {
          // Move to practicals
          setPhase('practicals');
          setResponse('');
          setStartTime(Date.now());
        }
      }
    });
  };

  const handleSubmitPractical = async () => {
    if (!currentPractical || !sessionId) return;

    const timeTaken = Math.floor((Date.now() - startTime) / 1000);

    submitPractical.mutate({
      sessionId,
      assessmentId: currentPractical.id,
      data: {
        submitted_code: response,
        time_taken_seconds: timeTaken
      }
    }, {
      onSuccess: () => {
        if (currentPracticalIndex < totalPracticals - 1) {
          setCurrentPracticalIndex(prev => prev + 1);
          setResponse('');
          setStartTime(Date.now());
        } else {
          // Complete interview
          handleCompleteInterview();
        }
      }
    });
  };

  const handleCompleteInterview = () => {
    if (!sessionId) return;
    
    completeInterview.mutate(sessionId, {
      onSuccess: () => {
        setPhase('completed');
      }
    });
  };

  if (authLoading || sessionLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!session) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <AlertTriangle className="h-12 w-12 text-warning" />
          <p className="text-lg">Interview session not found</p>
          <Button onClick={() => navigate('/interviews')}>Back to Interviews</Button>
        </div>
      </DashboardLayout>
    );
  }

  // Completed phase
  if (phase === 'completed' || session.status === 'completed') {
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card className="text-center">
              <CardContent className="py-12">
                <div className="flex flex-col items-center gap-6">
                  <div className="p-6 rounded-full bg-success/10">
                    <CheckCircle className="h-16 w-16 text-success" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Interview Completed!</h2>
                    <p className="text-muted-foreground mt-2">
                      Thank you for completing the interview. Your responses have been evaluated.
                    </p>
                  </div>

                  <Button onClick={() => navigate('/interviews')} className="mt-4">
                    Back to Interviews
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        {/* Header with proctoring indicators */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/interviews')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Interview Session</h1>
              <p className="text-sm text-muted-foreground">
                {phase === 'questions' ? 'Technical & Behavioral Questions' : 'Practical Assessment'}
              </p>
            </div>
          </div>

          {/* Proctoring indicators */}
          <div className="flex items-center gap-4">
            <div className={cn(
              "flex items-center gap-2 px-3 py-1 rounded-full text-sm",
              tabSwitches > 2 ? "bg-destructive/10 text-destructive" : "bg-muted"
            )}>
              <Shield className="h-4 w-4" />
              <span>Tab: {tabSwitches}</span>
            </div>
            <div className={cn(
              "flex items-center gap-2 px-3 py-1 rounded-full text-sm",
              copyPasteCount > 5 ? "bg-warning/10 text-warning" : "bg-muted"
            )}>
              <span>Copy: {copyPasteCount}</span>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span>
              {phase === 'questions' 
                ? `Question ${currentQuestionIndex + 1} of ${totalQuestions}`
                : `Practical ${currentPracticalIndex + 1} of ${totalPracticals}`
              }
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {Math.floor((Date.now() - startTime) / 1000)}s
            </span>
          </div>
          <Progress 
            value={
              phase === 'questions'
                ? ((currentQuestionIndex + 1) / totalQuestions) * 100
                : ((currentPracticalIndex + 1) / totalPracticals) * 100
            } 
          />
        </div>

        {/* Question/Practical Content */}
        <motion.div
          key={phase === 'questions' ? currentQuestionIndex : `p-${currentPracticalIndex}`}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                {phase === 'questions' ? (
                  currentQuestion?.question_type === 'technical' ? (
                    <Code className="h-5 w-5 text-info" />
                  ) : (
                    <MessageSquare className="h-5 w-5 text-accent" />
                  )
                ) : (
                  <Award className="h-5 w-5 text-warning" />
                )}
                <CardTitle className="text-lg">
                  {phase === 'questions' 
                    ? currentQuestion?.question_type.charAt(0).toUpperCase() + currentQuestion?.question_type.slice(1)
                    : currentPractical?.task_title
                  }
                </CardTitle>
                {phase === 'questions' && currentQuestion && (
                  <span className="ml-auto text-sm text-muted-foreground">
                    Difficulty: {currentQuestion.difficulty_level}/5
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-muted">
                <p className="whitespace-pre-wrap">
                  {phase === 'questions' 
                    ? currentQuestion?.question_text
                    : currentPractical?.task_description
                  }
                </p>
              </div>

              {phase === 'practicals' && currentPractical?.starter_code && !currentPractical?.metadata?.is_sql && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Starter Code:</p>
                  <pre className="p-4 rounded-lg bg-slate-900 text-slate-100 text-sm overflow-x-auto">
                    {currentPractical.starter_code}
                  </pre>
                </div>
              )}

              {phase === 'practicals' && currentPractical?.metadata?.is_sql && (
                <div className="space-y-4">
                  {currentPractical.metadata.db_schema && (
                    <div className="rounded-lg border bg-muted/20 overflow-hidden">
                      <div className="px-3 py-1.5 bg-muted/40 border-b text-xs font-semibold text-muted-foreground flex items-center gap-2">
                        <Code className="h-4 w-4" /> Database Schema
                      </div>
                      <pre className="p-3 text-xs font-mono whitespace-pre-wrap text-muted-foreground">{currentPractical.metadata.db_schema}</pre>
                    </div>
                  )}
                  {currentPractical.metadata.sample_data && (
                    <div className="rounded-lg border bg-muted/20 overflow-hidden">
                      <div className="px-3 py-1.5 bg-muted/40 border-b text-xs font-semibold text-muted-foreground">Sample Data</div>
                      <pre className="p-3 text-xs font-mono whitespace-pre-wrap text-muted-foreground overflow-auto max-h-48">{currentPractical.metadata.sample_data}</pre>
                    </div>
                  )}
                  {currentPractical.expected_output && (
                    <div className="rounded-lg border bg-muted/20 overflow-hidden">
                      <div className="px-3 py-1.5 bg-muted/40 border-b text-xs font-semibold text-muted-foreground">Expected Output Format</div>
                      <pre className="p-3 text-xs font-mono whitespace-pre-wrap text-muted-foreground">{currentPractical.expected_output}</pre>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium">{phase === 'practicals' && currentPractical?.metadata?.is_sql ? "Your SQL Query:" : "Your Response:"}</p>
                {phase === 'practicals' ? (
                  <div className="border rounded-md overflow-hidden" style={{ height: 400 }}>
                    <Editor
                      height="100%"
                      language={currentPractical?.metadata?.is_sql ? 'sql' : 'javascript'}
                      theme="vs-dark"
                      value={response}
                      onChange={(value) => setResponse(value || '')}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        lineNumbers: 'on',
                        wordWrap: 'on',
                      }}
                    />
                  </div>
                ) : (
                  <Textarea
                    placeholder="Type your answer here..."
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    rows={8}
                  />
                )}
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={phase === 'questions' ? handleSubmitResponse : handleSubmitPractical}
                  disabled={!response.trim() || submitResponse.isPending || submitPractical.isPending}
                >
                  {(submitResponse.isPending || submitPractical.isPending) ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Submit & Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
