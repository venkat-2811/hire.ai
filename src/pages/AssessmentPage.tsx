/**
 * Assessment Page with strict proctoring environment.
 * Candidates complete MCQ and coding challenges here.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Editor from '@monaco-editor/react';
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Code,
  FileQuestion,
  Loader2,
  Shield,
  Maximize,
  AlertCircle,
  Camera,
  Mic,
  Eye,
  EyeOff,
  Play,
  Send,
  CheckCircle2,
  XCircle as XCircleIcon,
} from 'lucide-react';
import { useFaceDetection } from '@/hooks/useFaceDetection';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const API_BASE_URL = '/api';

interface MCQQuestion {
  id: string;
  question: string;
  options: string[];
  difficulty: string;
  topic: string;
  points: number;
}

interface TestCase {
  id: string;
  input: string;
  expected_output: string;
}

interface TestResult {
  test_case_id: string;
  passed: boolean;
  input: string;
  expected_output: string;
  actual_output: string | null;
  status: string; // AC, WA, TLE, MLE, RE, CE, ERROR
  time_used: string | null;
  memory_used: string | null;
  error?: string | null;
}

interface CodingChallenge {
  id: string;
  slug: string;
  title: string;
  description: string;
  constraints: string;
  examples: Array<{ input: string; output: string; explanation?: string }>;
  starter_code: Record<string, string>; // { python3: "...", javascript: "...", java: "...", cpp: "..." }
  test_cases: TestCase[];
  points: number;
  time_limit_seconds: number;
  supported_languages: string[];
}

interface AssessmentData {
  session_id: string;
  candidate_name: string;
  job_title: string;
  mcq_count: number;
  coding_count: number;
  total_time_minutes: number;
  deadline: string;
}

export default function AssessmentPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  // Assessment state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assessmentData, setAssessmentData] = useState<AssessmentData | null>(null);
  const [mcqQuestions, setMcqQuestions] = useState<MCQQuestion[]>([]);
  const [codingChallenges, setCodingChallenges] = useState<CodingChallenge[]>([]);
  const hasCoding = codingChallenges.length > 0;
  const [currentTab, setCurrentTab] = useState<'mcq' | 'coding'>('mcq');
  const [currentMcqIndex, setCurrentMcqIndex] = useState(0);
  const [currentCodingIndex, setCurrentCodingIndex] = useState(0);
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, number>>({});
  const [codingSolutions, setCodingSolutions] = useState<Record<string, string>>({});
  const [codingResults, setCodingResults] = useState<Record<string, { results: TestResult[]; passed: number; total: number; score: number; hidden_passed?: number; hidden_total?: number; performance?: { avg_time_ms?: string | null; max_time_ms?: string | null; avg_memory_kb?: number | null; max_memory_kb?: number | null } }>>({});
  const [runningCode, setRunningCode] = useState<string | null>(null);
  const [submittingCode, setSubmittingCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [finalScores, setFinalScores] = useState<{ mcq_score?: number; coding_score?: number | null; total_score?: number } | null>(null);
  const [codingLanguages, setCodingLanguages] = useState<Record<string, string>>({});
  const [problemTab, setProblemTab] = useState<'description' | 'submissions'>('description');

  // Proctoring state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(true);
  const [warningCount, setWarningCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [terminated, setTerminated] = useState(false);

  // Webcam & face detection state
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const noFaceCountRef = useRef(0);
  const MAX_NO_FACE_VIOLATIONS = 3;

  // Timer
  const [timeRemaining, setTimeRemaining] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Webcam initialization ──
  const startCamera = useCallback(async () => {
    // If stream already exists from the permission prompt, just re-attach
    if (mediaStreamRef.current) {
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStreamRef.current;
        videoRef.current.play().catch(() => { });
      }
      setCameraReady(true);
      setCameraError(null);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 320, height: 240 },
        audio: true,
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => { });
      }
      setCameraReady(true);
      setCameraError(null);
    } catch (err: any) {
      console.error('[Camera] Failed to start:', err);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access for proctoring.'
          : 'Could not access camera/microphone.',
      );
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  // Start camera when assessment loads and fullscreen is entered
  useEffect(() => {
    if (assessmentData && !showFullscreenPrompt && !terminated && !completed) {
      startCamera();
    }
    return () => stopCamera();
  }, [assessmentData, showFullscreenPrompt, terminated, completed, startCamera, stopCamera]);

  // Re-attach stream to video element if ref becomes available
  useEffect(() => {
    if (videoRef.current && mediaStreamRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = mediaStreamRef.current;
      videoRef.current.play().catch(() => { });
    }
  });

  // ── Face detection via MediaPipe ──
  const handleNoFace = useCallback(() => {
    noFaceCountRef.current += 1;
    const count = noFaceCountRef.current;
    console.warn(`[FaceDetection] No face detected (${count}/${MAX_NO_FACE_VIOLATIONS})`);

    if (count >= MAX_NO_FACE_VIOLATIONS) {
      setTerminated(true);
      setWarningMessage('Assessment terminated: face not visible 3 times.');
      setShowWarning(true);
      // Also report to backend
      if (assessmentData) {
        fetch(`${API_BASE_URL}/assessments/${assessmentData.session_id}/proctoring`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_type: 'face_not_detected',
            timestamp: new Date().toISOString(),
            details: { violation_count: count, auto_terminated: true },
          }),
        }).catch(() => { });
      }
    } else {
      toast.error(
        `Face not visible! Warning ${count}/${MAX_NO_FACE_VIOLATIONS}. Your exam will be terminated if this happens again.`,
        { duration: 5000 },
      );
      setWarningCount((prev) => Math.max(prev, count));
      // Report to backend
      if (assessmentData) {
        fetch(`${API_BASE_URL}/assessments/${assessmentData.session_id}/proctoring`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_type: 'face_not_detected',
            timestamp: new Date().toISOString(),
            details: { violation_count: count },
          }),
        }).catch(() => { });
      }
    }
  }, [assessmentData]);

  const { ready: faceDetectorReady, faceVisible } = useFaceDetection(videoRef, {
    intervalMs: 2000,
    onNoFace: handleNoFace,
    enabled: cameraReady && !terminated && !completed && !showFullscreenPrompt,
  });

  // Report proctoring event to backend
  const reportProctoringEvent = useCallback(async (eventType: string, details?: object) => {
    if (!assessmentData) return;

    try {
      const response = await fetch(`${API_BASE_URL}/assessments/${assessmentData.session_id}/proctoring`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: eventType,
          timestamp: new Date().toISOString(),
          details,
        }),
      });

      const data = await response.json();

      if (data.terminated) {
        setTerminated(true);
        setWarningMessage('Assessment terminated due to multiple violations.');
        setShowWarning(true);
      } else if (data.warning) {
        setWarningCount(3 - data.violations_remaining);
        setWarningMessage(data.message);
        setShowWarning(true);
      }
    } catch (e) {
      console.error('Failed to report proctoring event:', e);
    }
  }, [assessmentData]);

  // Fullscreen handling
  const enterFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
      setShowFullscreenPrompt(false);
    } catch (e) {
      toast.error('Failed to enter fullscreen mode');
    }
  }, []);

  // STRICT PROCTORING: Fullscreen exit = immediate termination
  const handleFullscreenChange = useCallback(() => {
    const isFs = !!document.fullscreenElement;
    setIsFullscreen(isFs);
    if (!isFs && !showFullscreenPrompt && !terminated && !completed) {
      // Immediate termination for fullscreen exit
      setTerminated(true);
      setWarningMessage('Assessment terminated: You exited fullscreen mode. This is a strict proctoring violation.');
      setShowWarning(true);
      reportProctoringEvent('fullscreen_exit');
    }
  }, [showFullscreenPrompt, terminated, completed, reportProctoringEvent]);

  // STRICT PROCTORING: Tab switch = immediate termination
  const handleVisibilityChange = useCallback(() => {
    if (document.hidden && !terminated && !completed && !showFullscreenPrompt) {
      setTerminated(true);
      setWarningMessage('Assessment terminated: You switched tabs or minimized the window. This is a strict proctoring violation.');
      setShowWarning(true);
      reportProctoringEvent('tab_switch');
    }
  }, [terminated, completed, showFullscreenPrompt, reportProctoringEvent]);

  // STRICT PROCTORING: Window blur = immediate termination
  const handleBlur = useCallback(() => {
    if (!terminated && !completed && !showFullscreenPrompt) {
      setTerminated(true);
      setWarningMessage('Assessment terminated: You clicked outside the assessment window. This is a strict proctoring violation.');
      setShowWarning(true);
      reportProctoringEvent('window_blur');
    }
  }, [terminated, completed, showFullscreenPrompt, reportProctoringEvent]);

  const handleCopyPaste = useCallback((e: ClipboardEvent) => {
    e.preventDefault();
    reportProctoringEvent('copy_paste');
    toast.error('Copy/paste is disabled during the assessment. This violation has been recorded.');
  }, [reportProctoringEvent]);

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
    reportProctoringEvent('right_click');
    toast.error('Right-click is disabled during the assessment. This violation has been recorded.');
  }, [reportProctoringEvent]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Disable common shortcuts and DevTools
    if (
      (e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'x')) ||
      (e.metaKey && (e.key === 'c' || e.key === 'v' || e.key === 'x')) ||
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
      (e.ctrlKey && e.key === 'u') // View source
    ) {
      e.preventDefault();
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey)) {
        reportProctoringEvent('devtools_open');
        toast.error('Developer tools are disabled during the assessment. This violation has been recorded.');
      } else {
        reportProctoringEvent('copy_paste');
        toast.error('This keyboard shortcut is disabled during the assessment.');
      }
    }
  }, [reportProctoringEvent]);

  // Proctoring event listeners
  useEffect(() => {
    if (!assessmentData || terminated || completed) return;

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('paste', handleCopyPaste);
    document.addEventListener('cut', handleCopyPaste);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
      document.removeEventListener('cut', handleCopyPaste);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [assessmentData, terminated, completed, showFullscreenPrompt, handleFullscreenChange, reportProctoringEvent]);


  // Timer
  useEffect(() => {
    if (timeRemaining <= 0 || terminated || completed) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          handleSubmitAssessment();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeRemaining, terminated, completed]);

  // Load assessment data
  useEffect(() => {
    async function loadAssessment() {
      if (!token) return;

      try {
        // Start assessment
        const startResponse = await fetch(`${API_BASE_URL}/assessments/start/${token}`);
        if (!startResponse.ok) {
          const error = await startResponse.json().catch(() => ({}));
          setError(error.error || error.detail || 'Failed to load assessment');
          return;
        }
        const data = await startResponse.json();
        setAssessmentData(data);
        setTimeRemaining(data.total_time_minutes * 60);

        // Load MCQ questions
        const mcqResponse = await fetch(`${API_BASE_URL}/assessments/${data.session_id}/mcq`);
        if (!mcqResponse.ok) {
          const error = await mcqResponse.json().catch(() => ({}));
          setError(error.error || error.detail || 'Failed to load MCQ questions');
          return;
        }
        const mcqData = await mcqResponse.json();
        const mcqList = Array.isArray(mcqData)
          ? mcqData
          : Array.isArray(mcqData?.questions)
            ? mcqData.questions
            : [];
        setMcqQuestions(mcqList);

        // Load coding challenges
        const codingResponse = await fetch(`${API_BASE_URL}/assessments/${data.session_id}/coding`);
        if (!codingResponse.ok) {
          const error = await codingResponse.json().catch(() => ({}));
          setError(error.error || error.detail || 'Failed to load coding challenges');
          return;
        }
        const codingData = await codingResponse.json();
        const codingList = Array.isArray(codingData)
          ? codingData
          : Array.isArray(codingData?.challenges)
            ? codingData.challenges
            : [];
        setCodingChallenges(codingList);

        const hasMcq = mcqList.length > 0;
        const hasCoding = codingList.length > 0;
        if (!hasMcq && !hasCoding) {
          setError('No assessment sections were generated. Please refresh or contact the hiring team.');
          return;
        }

        if (hasMcq && !hasCoding) {
          setCurrentTab('mcq');
        } else if (!hasMcq && hasCoding) {
          setCurrentTab('coding');
        }

        // Initialize solutions with starter code and default language per challenge
        if (hasCoding) {
          const initialSolutions: Record<string, string> = {};
          const initialLanguages: Record<string, string> = {};
          codingList.forEach((c: CodingChallenge) => {
            const defaultLang = c.supported_languages?.includes('python3') ? 'python3' : (c.supported_languages?.[0] || 'python3');
            initialLanguages[c.id] = defaultLang;
            initialSolutions[c.id] = c.starter_code?.[defaultLang] || '';
          });
          setCodingSolutions(initialSolutions);
          setCodingLanguages(initialLanguages);
        }
      } catch (e) {
        setError('Failed to load assessment. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    loadAssessment();
  }, [token]);

  const handleMcqAnswer = (questionId: string, optionIndex: number) => {
    setMcqAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleCodingSolution = (challengeId: string, code: string) => {
    setCodingSolutions((prev) => ({ ...prev, [challengeId]: code }));
  };

  const runCode = async (challengeId: string) => {
    if (!assessmentData || runningCode) return;

    const code = codingSolutions[challengeId];
    if (!code) {
      toast.error('Please write some code first');
      return;
    }

    setRunningCode(challengeId);

    try {
      const response = await fetch(`${API_BASE_URL}/assessments/${assessmentData.session_id}/coding/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge_id: challengeId,
          code,
          language: codingLanguages[challengeId] || 'python3',
        }),
      });

      if (response.status === 429) {
        toast.error('Rate limit exceeded. Please wait before running again.');
        return;
      }

      const data = await response.json();

      if (data.compilation_error) {
        toast.error(`Compilation Error: ${data.compilation_error}`);
        setCodingResults((prev) => ({
          ...prev,
          [challengeId]: {
            ...prev[challengeId],
            results: data.results || [],
            passed: 0,
            total: data.total || 0,
            score: 0,
          },
        }));
        return;
      }

      setCodingResults((prev) => ({
        ...prev,
        [challengeId]: {
          results: data.results || [],
          passed: data.passed || 0,
          total: data.total || 0,
          score: data.score_percentage || 0,
        },
      }));

      if (data.passed === data.total && data.total > 0) {
        toast.success(`All ${data.total} test cases passed!`);
      } else {
        toast.info(`${data.passed}/${data.total} test cases passed`);
      }
    } catch (e) {
      toast.error('Failed to run code. Please try again.');
    } finally {
      setRunningCode(null);
    }
  };

  const submitCodingSolution = async (challengeId: string) => {
    if (!assessmentData || submittingCode) return;

    const code = codingSolutions[challengeId];
    if (!code) {
      toast.error('Please write some code first');
      return;
    }

    setSubmittingCode(challengeId);

    try {
      const response = await fetch(`${API_BASE_URL}/assessments/${assessmentData.session_id}/coding/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge_id: challengeId,
          code,
          language: codingLanguages[challengeId] || 'python3',
        }),
      });

      if (response.status === 429) {
        toast.error('Rate limit exceeded. Maximum 5 submissions per minute.');
        return;
      }

      const data = await response.json();

      setCodingResults((prev) => ({
        ...prev,
        [challengeId]: {
          results: data.test_results || [],
          passed: data.passed_count || 0,
          total: data.total_tests || 0,
          score: data.score_percentage || 0,
          hidden_passed: data.hidden_tests_passed,
          hidden_total: data.hidden_tests_total,
          performance: data.performance,
        },
      }));

      const totalPassed = (data.passed_count || 0);
      const totalTests = (data.total_tests || 0);
      if (totalPassed === totalTests && totalTests > 0) {
        toast.success(`All ${totalTests} test cases passed! Score: ${data.score_percentage?.toFixed(1)}%`);
      } else {
        toast.info(`${totalPassed}/${totalTests} passed (${data.hidden_tests_passed || 0}/${data.hidden_tests_total || 0} hidden). Score: ${data.score_percentage?.toFixed(1)}%`);
      }
    } catch (e) {
      toast.error('Failed to submit solution. Please try again.');
    } finally {
      setSubmittingCode(null);
    }
  };

  const resetCode = (challengeId: string) => {
    const lang = codingLanguages[challengeId] || 'python3';
    const challenge = codingChallenges.find(c => c.id === challengeId);
    if (challenge) {
      setCodingSolutions(prev => ({ ...prev, [challengeId]: challenge.starter_code?.[lang] || '' }));
      toast.info('Code reset to starter template');
    }
  };

  const handleSubmitAssessment = async () => {
    if (!assessmentData || submitting) return;

    setSubmitting(true);

    try {
      // Submit MCQ answers (if MCQ section exists)
      if (mcqQuestions.length > 0) {
        const mcqSubmissions = Object.entries(mcqAnswers).map(([questionId, selectedIndex]) => ({
          question_id: questionId,
          selected_index: selectedIndex,
          time_taken_seconds: 0, // TODO: Track per-question time
        }));

        await fetch(`${API_BASE_URL}/assessments/${assessmentData.session_id}/mcq/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mcqSubmissions),
        });
      }

      // Submit coding solutions (if coding section exists)
      if (codingChallenges.length > 0) {
        for (const [challengeId, code] of Object.entries(codingSolutions)) {
          await fetch(`${API_BASE_URL}/assessments/${assessmentData.session_id}/coding/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              challenge_id: challengeId,
              code,
              language: 'python',
              time_taken_seconds: 0,
            }),
          });
        }
      }

      // Complete assessment
      const completeResp = await fetch(`${API_BASE_URL}/assessments/${assessmentData.session_id}/complete`, {
        method: 'POST',
      });

      const completeData = await completeResp.json().catch(() => ({}));
      if (completeResp.ok) {
        setFinalScores({
          mcq_score: typeof completeData.mcq_score === 'number' ? completeData.mcq_score : undefined,
          coding_score: typeof completeData.coding_score === 'number' || completeData.coding_score === null ? completeData.coding_score : undefined,
          total_score: typeof completeData.total_score === 'number' ? completeData.total_score : undefined,
        });
      }

      setCompleted(true);
      stopCamera();

      // Exit fullscreen
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
    } catch (e) {
      toast.error('Failed to submit assessment');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading assessment...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Assessment Unavailable</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" onClick={() => navigate('/')}>
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Terminated state
  if (terminated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Assessment Terminated</CardTitle>
            <CardDescription>
              Your assessment has been terminated due to multiple proctoring violations.
              Please contact the hiring team for further instructions.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Completed state
  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
              <CardTitle className="text-2xl">Assessment Completed!</CardTitle>
              <CardDescription className="text-base">
                Thank you for completing the technical assessment. Your responses have been
                submitted for evaluation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                The hiring team will review your results and contact you regarding the next steps.
                You may now close this window.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Fullscreen prompt with camera/mic permission check
  if (showFullscreenPrompt) {
    const handleRequestPermissions = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 320, height: 240 },
          audio: true,
        });
        // Store stream temporarily so startCamera can reuse it
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => { });
        }
        setCameraReady(true);
        setCameraError(null);
      } catch (err: any) {
        setCameraError(
          err.name === 'NotAllowedError'
            ? 'Camera/Microphone permission denied. Please allow access in your browser settings and try again.'
            : 'Could not access camera/microphone. Please check your device.',
        );
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Proctored Assessment</CardTitle>
            <CardDescription className="text-base">
              {assessmentData?.job_title} - Technical Assessment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-destructive">⚠️ STRICT PROCTORING - READ CAREFULLY:</h3>
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 mt-0.5 text-destructive" />
                    <span className="font-medium">Exiting fullscreen = <span className="text-destructive">IMMEDIATE TERMINATION</span></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 mt-0.5 text-destructive" />
                    <span className="font-medium">Switching tabs = <span className="text-destructive">IMMEDIATE TERMINATION</span></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 mt-0.5 text-destructive" />
                    <span className="font-medium">Clicking outside window = <span className="text-destructive">IMMEDIATE TERMINATION</span></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 text-warning" />
                    <span className="font-medium">Face not visible 3 times = <span className="text-destructive">TERMINATION</span></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 text-warning" />
                    <span className="font-medium">Copy/paste, right-click, DevTools (3 total) = <span className="text-destructive">TERMINATION</span></span>
                  </li>
                </ul>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Camera className="h-4 w-4 mt-0.5 text-primary" />
                  <span>Your webcam will be active for AI face detection proctoring</span>
                </li>
                <li className="flex items-start gap-2">
                  <Eye className="h-4 w-4 mt-0.5 text-primary" />
                  <span>Keep your face visible at all times — AI monitors your presence</span>
                </li>
                <li className="flex items-start gap-2">
                  <Maximize className="h-4 w-4 mt-0.5 text-primary" />
                  <span>Fullscreen mode is <strong>mandatory</strong> throughout the entire assessment</span>
                </li>
                <li className="flex items-start gap-2">
                  <Clock className="h-4 w-4 mt-0.5 text-primary" />
                  <span>You have <strong>{assessmentData?.total_time_minutes} minutes</strong> to complete</span>
                </li>
              </ul>
            </div>

            {/* Camera & Mic Permission Section */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold">Step 1: Grant Camera & Microphone Access</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  {cameraReady ? (
                    <Badge className="bg-success/90 text-success-foreground text-xs">
                      <CheckCircle className="mr-1 h-3 w-3" /> Camera Ready
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">Not Connected</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Mic className="h-4 w-4" />
                  {cameraReady ? (
                    <Badge className="bg-success/90 text-success-foreground text-xs">
                      <CheckCircle className="mr-1 h-3 w-3" /> Mic Ready
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">Not Connected</Badge>
                  )}
                </div>
              </div>
              {!cameraReady && (
                <Button variant="outline" size="sm" onClick={handleRequestPermissions}>
                  <Camera className="mr-2 h-4 w-4" />
                  Grant Camera & Microphone Access
                </Button>
              )}
              {cameraError && (
                <div className="text-sm text-destructive bg-destructive/10 rounded p-2">
                  {cameraError}
                  <Button variant="link" size="sm" className="ml-2 h-auto p-0" onClick={handleRequestPermissions}>
                    Retry
                  </Button>
                </div>
              )}
              {/* Hidden video element for preview */}
              {cameraReady && (
                <div className="rounded-lg overflow-hidden border" style={{ width: 160, height: 120 }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                </div>
              )}
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm">
                <strong>Step 2: Start Assessment</strong>
              </p>
              <div className="flex gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <FileQuestion className="h-4 w-4" />
                  <span className="text-sm">{assessmentData?.mcq_count} MCQ Questions</span>
                </div>
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  <span className="text-sm">{assessmentData?.coding_count} Coding Challenges</span>
                </div>
              </div>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={enterFullscreen}
              disabled={!cameraReady}
            >
              <Maximize className="mr-2 h-4 w-4" />
              {cameraReady ? 'Enter Fullscreen & Start' : 'Grant Permissions First'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentMcq = mcqQuestions[currentMcqIndex];
  const currentCoding = codingChallenges[currentCodingIndex];
  const mcqProgress = mcqQuestions.length === 0 ? 0 : (Object.keys(mcqAnswers).length / mcqQuestions.length) * 100;
  const codingProgress = codingChallenges.length === 0 ? 0 : (Object.keys(codingSolutions).filter(k => {
    const challenge = codingChallenges.find(c => c.id === k);
    const lang = codingLanguages[k] || 'python3';
    return challenge && codingSolutions[k] !== (challenge.starter_code?.[lang] || '');
  }).length / codingChallenges.length) * 100;
  const hasMcq = mcqQuestions.length > 0;
  const activeTab = hasMcq ? (hasCoding ? currentTab : 'mcq') : 'coding';

  return (
    <div className="min-h-screen bg-background select-none">
      {/* Warning Dialog */}
      <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" />
              Proctoring Warning
            </AlertDialogTitle>
            <AlertDialogDescription>{warningMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
              setShowWarning(false);
              if (!isFullscreen) enterFullscreen();
            }}>
              I Understand
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Floating webcam feed (bottom-right corner) */}
      <div className="fixed bottom-4 right-4 z-[60]">
        <div className="relative rounded-lg overflow-hidden border-2 border-border shadow-lg bg-black" style={{ width: 200, height: 150 }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover mirror"
            style={{ transform: 'scaleX(-1)' }}
          />
          {/* Face detection status overlay */}
          <div className="absolute top-1 left-1">
            {!cameraReady ? (
              <Badge variant="outline" className="bg-background/80 text-xs">
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Camera...
              </Badge>
            ) : !faceDetectorReady ? (
              <Badge variant="outline" className="bg-background/80 text-xs">
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Loading AI...
              </Badge>
            ) : faceVisible ? (
              <Badge className="bg-success/90 text-success-foreground text-xs">
                <Eye className="mr-1 h-3 w-3" />
                Face OK
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-xs animate-pulse">
                <EyeOff className="mr-1 h-3 w-3" />
                No Face!
              </Badge>
            )}
          </div>
          {/* Mic indicator */}
          <div className="absolute bottom-1 right-1">
            <Badge variant="outline" className="bg-background/80 text-xs">
              <Mic className="h-3 w-3 text-success" />
            </Badge>
          </div>
        </div>
        {cameraError && (
          <div className="mt-1 bg-destructive/90 text-destructive-foreground text-xs rounded px-2 py-1 max-w-[200px]">
            {cameraError}
          </div>
        )}
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <span className="font-semibold">Proctored Assessment</span>
            </div>
            <Badge variant="outline">{assessmentData?.job_title}</Badge>
          </div>

          <div className="flex items-center gap-4">
            {/* Face detection warning indicator */}
            {noFaceCountRef.current > 0 && (
              <Badge variant="destructive">
                <EyeOff className="mr-1 h-3 w-3" />
                Face {noFaceCountRef.current}/{MAX_NO_FACE_VIOLATIONS}
              </Badge>
            )}

            {/* Warning indicator */}
            {warningCount > 0 && (
              <Badge variant="destructive">
                <AlertTriangle className="mr-1 h-3 w-3" />
                {warningCount}/3 Warnings
              </Badge>
            )}

            {/* Timer */}
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${timeRemaining < 300 ? 'bg-destructive/10 text-destructive' : 'bg-muted'
              }`}>
              <Clock className="h-4 w-4" />
              <span className="font-mono font-semibold">{formatTime(timeRemaining)}</span>
            </div>

            <Button onClick={handleSubmitAssessment} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Assessment'
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={(v) => setCurrentTab(v as 'mcq' | 'coding')}>
          {hasMcq && hasCoding && (
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-6">
              <TabsTrigger value="mcq" className="flex items-center gap-2">
                <FileQuestion className="h-4 w-4" />
                MCQ ({Object.keys(mcqAnswers).length}/{mcqQuestions.length})
              </TabsTrigger>
              <TabsTrigger value="coding" className="flex items-center gap-2">
                <Code className="h-4 w-4" />
                Coding ({currentCodingIndex + 1}/{codingChallenges.length})
              </TabsTrigger>
            </TabsList>
          )}

          {/* MCQ Section */}
          {hasMcq && (
            <TabsContent value="mcq">
              <div className="max-w-3xl mx-auto space-y-6">
                <Progress value={mcqProgress} className="h-2" />

                {currentMcq && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">
                          Question {currentMcqIndex + 1} of {mcqQuestions.length}
                        </CardTitle>
                        <Badge variant="outline">{currentMcq.points} pts</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <p className="text-base">{currentMcq.question}</p>

                      <RadioGroup
                        value={mcqAnswers[currentMcq.id]?.toString()}
                        onValueChange={(v) => handleMcqAnswer(currentMcq.id, parseInt(v))}
                      >
                        {currentMcq.options.map((option, index) => (
                          <div
                            key={index}
                            className={`flex items-center space-x-3 p-4 rounded-lg border cursor-pointer transition-colors ${mcqAnswers[currentMcq.id] === index
                              ? 'border-primary bg-primary/5'
                              : 'hover:bg-muted/50'
                              }`}
                            onClick={() => handleMcqAnswer(currentMcq.id, index)}
                          >
                            <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                            <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                              {option}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>

                      <div className="flex justify-between pt-4">
                        <Button
                          variant="outline"
                          onClick={() => setCurrentMcqIndex((prev) => Math.max(0, prev - 1))}
                          disabled={currentMcqIndex === 0}
                        >
                          Previous
                        </Button>
                        {currentMcqIndex === mcqQuestions.length - 1 && hasCoding ? (
                          <Button
                            onClick={() => setCurrentTab('coding')}
                          >
                            Next Section →
                          </Button>
                        ) : (
                          <Button
                            onClick={() => setCurrentMcqIndex((prev) => Math.min(mcqQuestions.length - 1, prev + 1))}
                            disabled={currentMcqIndex === mcqQuestions.length - 1}
                          >
                            Next
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Question Navigator */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Question Navigator</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {mcqQuestions.map((q, index) => (
                        <Button
                          key={q.id}
                          variant={mcqAnswers[q.id] !== undefined ? 'default' : 'outline'}
                          size="sm"
                          className={`w-10 h-10 ${currentMcqIndex === index ? 'ring-2 ring-primary' : ''}`}
                          onClick={() => setCurrentMcqIndex(index)}
                        >
                          {index + 1}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}

          {/* Coding Section — LeetCode-style */}
          {hasCoding && (
            <TabsContent value="coding">
              <div className="max-w-7xl mx-auto space-y-4">
                {/* Problem Navigator Chips */}
                <div className="flex items-center gap-2 flex-wrap">
                  {codingChallenges.map((c, idx) => {
                    const result = codingResults[c.id];
                    const isActive = currentCodingIndex === idx;
                    const isAccepted = result && result.passed === result.total && result.total > 0;
                    const hasResult = !!result;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setCurrentCodingIndex(idx)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                          isActive ? 'ring-2 ring-primary border-primary bg-primary/10' :
                          isAccepted ? 'border-green-500/50 bg-green-500/10 text-green-600' :
                          hasResult ? 'border-orange-500/50 bg-orange-500/10 text-orange-600' :
                          'border-border bg-card hover:bg-muted/50'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          {isAccepted && <CheckCircle2 className="h-3 w-3" />}
                          {hasResult && !isAccepted && <AlertCircle className="h-3 w-3" />}
                          Q{idx + 1}: {c.title}
                          <span className="text-[10px] opacity-70">({c.points}pts)</span>
                        </span>
                      </button>
                    );
                  })}
                  <div className="ml-auto">
                    <Progress value={codingProgress} className="h-1.5 w-32" />
                  </div>
                </div>

                {currentCoding && (
                  <div className="grid lg:grid-cols-2 gap-4" style={{ minHeight: '70vh' }}>
                    {/* LEFT: Problem Description Panel */}
                    <div className="flex flex-col border rounded-lg overflow-hidden bg-card">
                      {/* Problem Header */}
                      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm">{currentCoding.title}</h3>
                          <Badge variant="outline" className="text-[10px]">{currentCoding.points} pts</Badge>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setProblemTab('description')}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${problemTab === 'description' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                          >
                            Description
                          </button>
                          <button
                            onClick={() => setProblemTab('submissions')}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${problemTab === 'submissions' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                          >
                            Results {codingResults[currentCoding.id] ? `(${codingResults[currentCoding.id].passed}/${codingResults[currentCoding.id].total})` : ''}
                          </button>
                        </div>
                      </div>

                      {/* Problem Content */}
                      <div className="flex-1 overflow-auto p-4 space-y-4">
                        {problemTab === 'description' ? (
                          <>
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <p className="whitespace-pre-wrap text-sm leading-relaxed">{currentCoding.description}</p>
                            </div>

                            {currentCoding.examples && currentCoding.examples.length > 0 && (
                              <div className="space-y-3">
                                {currentCoding.examples.map((ex, idx) => (
                                  <div key={idx} className="rounded-lg border bg-muted/20 overflow-hidden">
                                    <div className="px-3 py-1.5 bg-muted/40 border-b text-xs font-semibold text-muted-foreground">Example {idx + 1}</div>
                                    <div className="p-3 text-xs font-mono space-y-1">
                                      <div><span className="text-emerald-500 font-semibold">Input: </span>{ex.input}</div>
                                      <div><span className="text-blue-500 font-semibold">Output: </span>{ex.output}</div>
                                      {ex.explanation && (
                                        <div className="text-muted-foreground font-sans pt-1 border-t mt-2"><span className="font-semibold">Explanation: </span>{ex.explanation}</div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {currentCoding.constraints && (
                              <div className="rounded-lg border bg-muted/20 overflow-hidden">
                                <div className="px-3 py-1.5 bg-muted/40 border-b text-xs font-semibold text-muted-foreground">Constraints</div>
                                <div className="p-3 text-xs font-mono whitespace-pre-wrap text-muted-foreground">{currentCoding.constraints}</div>
                              </div>
                            )}

                            {currentCoding.test_cases && currentCoding.test_cases.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">Sample Test Cases</h4>
                                {currentCoding.test_cases.map((tc, idx) => (
                                  <div key={tc.id || idx} className="bg-muted/30 rounded-lg p-2.5 text-xs font-mono border">
                                    <div><span className="text-muted-foreground">Input:</span> {tc.input}</div>
                                    <div><span className="text-muted-foreground">Expected:</span> {tc.expected_output}</div>
                                  </div>
                                ))}
                                <p className="text-[10px] text-muted-foreground italic">Hidden test cases will be evaluated on submission.</p>
                              </div>
                            )}
                          </>
                        ) : (
                          /* Submissions/Results Tab */
                          codingResults[currentCoding.id] ? (
                            <div className="space-y-3">
                              {/* Verdict Banner */}
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`rounded-lg p-4 border ${
                                  codingResults[currentCoding.id].passed === codingResults[currentCoding.id].total && codingResults[currentCoding.id].total > 0
                                    ? 'bg-green-500/10 border-green-500/30'
                                    : 'bg-red-500/10 border-red-500/30'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {codingResults[currentCoding.id].passed === codingResults[currentCoding.id].total && codingResults[currentCoding.id].total > 0 ? (
                                      <CheckCircle className="h-5 w-5 text-green-500" />
                                    ) : (
                                      <XCircle className="h-5 w-5 text-red-500" />
                                    )}
                                    <span className="font-bold text-sm">
                                      {codingResults[currentCoding.id].passed === codingResults[currentCoding.id].total && codingResults[currentCoding.id].total > 0 ? 'Accepted' : 'Not Accepted'}
                                    </span>
                                  </div>
                                  <span className="text-2xl font-bold">{codingResults[currentCoding.id].score.toFixed(0)}%</span>
                                </div>
                                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                  <span>{codingResults[currentCoding.id].passed}/{codingResults[currentCoding.id].total} tests passed</span>
                                  {codingResults[currentCoding.id].hidden_total != null && codingResults[currentCoding.id].hidden_total! > 0 && (
                                    <span>({codingResults[currentCoding.id].hidden_passed}/{codingResults[currentCoding.id].hidden_total} hidden)</span>
                                  )}
                                  {codingResults[currentCoding.id].performance?.avg_time_ms && (
                                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {codingResults[currentCoding.id].performance?.avg_time_ms}ms avg</span>
                                  )}
                                  {codingResults[currentCoding.id].performance?.avg_memory_kb && (
                                    <span>{codingResults[currentCoding.id].performance?.avg_memory_kb}KB avg</span>
                                  )}
                                </div>
                              </motion.div>

                              {/* Individual Test Results */}
                              <div className="space-y-1.5">
                                {codingResults[currentCoding.id].results.map((result, idx) => (
                                  <motion.div
                                    key={result.test_case_id || idx}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className={`p-2.5 rounded-lg text-xs font-mono border ${
                                      result.passed ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        {result.passed ? (
                                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                        ) : (
                                          <XCircleIcon className="h-3.5 w-3.5 text-red-500" />
                                        )}
                                        <span className="font-semibold font-sans">Test {idx + 1}</span>
                                        <Badge
                                          variant="outline"
                                          className={`text-[10px] px-1.5 py-0 ${
                                            result.status === 'AC' ? 'border-green-500/50 text-green-600' :
                                            result.status === 'WA' ? 'border-red-500/50 text-red-600' :
                                            result.status === 'TLE' ? 'border-yellow-500/50 text-yellow-600' :
                                            result.status === 'MLE' ? 'border-purple-500/50 text-purple-600' :
                                            result.status === 'CE' ? 'border-orange-500/50 text-orange-600' :
                                            'border-red-500/50 text-red-600'
                                          }`}
                                        >
                                          {result.status}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-sans">
                                        {result.time_used && <span>{(parseFloat(result.time_used) * 1000).toFixed(0)} ms</span>}
                                        {result.memory_used && <span>{result.memory_used} KB</span>}
                                      </div>
                                    </div>
                                    {!result.passed && (
                                      <div className="mt-1.5 pt-1.5 border-t border-dashed text-muted-foreground space-y-0.5">
                                        <div><span className="text-muted-foreground/70">Input:</span> {result.input}</div>
                                        <div><span className="text-muted-foreground/70">Expected:</span> {result.expected_output}</div>
                                        <div className="text-red-400">
                                          {result.error ? result.error : `Got: ${result.actual_output}`}
                                        </div>
                                      </div>
                                    )}
                                  </motion.div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm">
                              <Code className="h-8 w-8 mb-2 opacity-40" />
                              <p>No results yet. Run or submit your code.</p>
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    {/* RIGHT: Code Editor Panel */}
                    <div className="flex flex-col border rounded-lg overflow-hidden bg-card">
                      {/* Editor Toolbar */}
                      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                        <div className="flex items-center gap-2">
                          <Select
                            value={codingLanguages[currentCoding.id] || 'python3'}
                            onValueChange={(lang) => {
                              setCodingLanguages(prev => ({ ...prev, [currentCoding.id]: lang }));
                              const currentCode = codingSolutions[currentCoding.id] || '';
                              const oldLang = codingLanguages[currentCoding.id] || 'python3';
                              const oldStarter = currentCoding.starter_code?.[oldLang] || '';
                              if (!currentCode || currentCode === oldStarter) {
                                setCodingSolutions(prev => ({ ...prev, [currentCoding.id]: currentCoding.starter_code?.[lang] || '' }));
                              }
                            }}
                          >
                            <SelectTrigger className="w-[140px] h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(currentCoding.supported_languages || []).map((lang) => (
                                <SelectItem key={lang} value={lang}>
                                  {{ python3: 'Python 3', javascript: 'JavaScript', java: 'Java', cpp: 'C++', typescript: 'TypeScript', csharp: 'C#', go: 'Go', rust: 'Rust', kotlin: 'Kotlin', ruby: 'Ruby' }[lang] || lang}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground" onClick={() => resetCode(currentCoding.id)}>
                            Reset
                          </Button>
                        </div>
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => runCode(currentCoding.id)}
                            disabled={runningCode === currentCoding.id || submittingCode === currentCoding.id}
                          >
                            {runningCode === currentCoding.id ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <Play className="mr-1 h-3 w-3" />
                            )}
                            Run
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => submitCodingSolution(currentCoding.id)}
                            disabled={runningCode === currentCoding.id || submittingCode === currentCoding.id}
                          >
                            {submittingCode === currentCoding.id ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <Send className="mr-1 h-3 w-3" />
                            )}
                            Submit
                          </Button>
                        </div>
                      </div>

                      {/* Monaco Editor */}
                      <div className="flex-1" style={{ minHeight: 400 }}>
                        <Editor
                          height="100%"
                          language={{ python3: 'python', javascript: 'javascript', java: 'java', cpp: 'cpp', typescript: 'typescript', csharp: 'csharp', go: 'go', rust: 'rust', kotlin: 'kotlin', ruby: 'ruby' }[codingLanguages[currentCoding.id] || 'python3'] || 'python'}
                          theme="vs-dark"
                          value={codingSolutions[currentCoding.id] || ''}
                          onChange={(value) => handleCodingSolution(currentCoding.id, value || '')}
                          options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            lineNumbers: 'on',
                            automaticLayout: true,
                            scrollBeyondLastLine: false,
                            wordWrap: 'on',
                            tabSize: 4,
                            padding: { top: 8 },
                            renderLineHighlight: 'gutter',
                            bracketPairColorization: { enabled: true },
                            suggestOnTriggerCharacters: true,
                          }}
                        />
                      </div>

                      {/* Quick Result Bar (when running/submitting) */}
                      <AnimatePresence>
                        {(runningCode === currentCoding.id || submittingCode === currentCoding.id) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t bg-muted/50 px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground"
                          >
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {submittingCode ? 'Evaluating against all test cases...' : 'Running public test cases...'}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Compact Result Summary Bar */}
                      {codingResults[currentCoding.id] && !runningCode && !submittingCode && (
                        <div
                          className={`border-t px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors ${
                            codingResults[currentCoding.id].passed === codingResults[currentCoding.id].total && codingResults[currentCoding.id].total > 0
                              ? 'bg-green-500/5' : 'bg-red-500/5'
                          }`}
                          onClick={() => setProblemTab('submissions')}
                        >
                          <div className="flex items-center gap-2 text-xs">
                            {codingResults[currentCoding.id].passed === codingResults[currentCoding.id].total && codingResults[currentCoding.id].total > 0 ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <XCircleIcon className="h-3.5 w-3.5 text-red-500" />
                            )}
                            <span className="font-medium">
                              {codingResults[currentCoding.id].passed}/{codingResults[currentCoding.id].total} passed
                            </span>
                            {codingResults[currentCoding.id].performance?.avg_time_ms && (
                              <span className="text-muted-foreground">• {codingResults[currentCoding.id].performance?.avg_time_ms}ms</span>
                            )}
                          </div>
                          <span className="text-xs font-bold">{codingResults[currentCoding.id].score.toFixed(0)}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentCodingIndex((prev) => Math.max(0, prev - 1))}
                    disabled={currentCodingIndex === 0}
                  >
                    Previous Challenge
                  </Button>
                  {currentCodingIndex === codingChallenges.length - 1 ? (
                    <Button
                      onClick={handleSubmitAssessment}
                      disabled={submitting}
                      className="bg-success hover:bg-success/90"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Submit Assessment
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setCurrentCodingIndex((prev) => Math.min(codingChallenges.length - 1, prev + 1))}
                      disabled={currentCodingIndex === codingChallenges.length - 1}
                    >
                      Next Challenge
                    </Button>
                  )}
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}
