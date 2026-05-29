/**
 * Assessment Page with strict proctoring environment.
 * Candidates complete MCQ and coding challenges here.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import React from 'react';
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
  Terminal,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { apiRequest, assessmentsRuntimeApi } from '@/lib/api';

interface MCQQuestion {
  id: string;
  question: string;
  options: string[];
  difficulty: string;
  topic: string;
  points: number;
  explanation?: string;
}

interface TestCase {
  id: string;
  input: string;
  expected_output: string;
}

interface TestResult {
  test_case_id: string;
  is_hidden?: boolean;
  passed: boolean;
  input: any;
  expected_output: any;
  actual_output: any;
  status: string; // AC, WA, TLE, MLE, RE, CE, ERROR
  time_used: string | null;
  memory_used: string | null;
  error?: string | null;
  stdout?: string | null;
  stderr?: string | null;
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

interface ApexBlankItem {
  blank_id: string;
  placeholder: string;
  guidance?: string;
}

interface ApexFillInBlankQuestion {
  id: string;
  title: string;
  instructions: string;
  code_with_blanks: string;
  blanks: ApexBlankItem[];
  points: number;
  topic: string;
  difficulty: string;
}

interface ApexBlanksEvaluationResult {
  question_id: string;
  score: number;
  max_score: number;
  feedback: string;
  per_blank: Array<{
    blank_id: string;
    correct: boolean;
    expected: string;
    received: string;
    notes?: string;
  }>;
}

interface AssessmentData {
  session_id: string;
  candidate_name: string;
  job_title: string;
  job_role?: string;
  assessment_mode?: 'dsa' | 'apex';
  is_apex_mode?: boolean;
  coding_environment_label?: string | null;
  mcq_count: number;
  coding_count: number;
  total_time_minutes: number;
  deadline: string;
  started_at?: string | null;
  // Eagerly bundled by the backend — eliminates separate /mcq and /coding fetches
  mcq_questions?: MCQQuestion[];
  coding_challenges?: CodingChallenge[];
  apex_blanks?: ApexFillInBlankQuestion[];
}

// ── React Error Boundary for Assessment Runtime ──
interface AssessmentErrorBoundaryProps {
  children: React.ReactNode;
}

interface AssessmentErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AssessmentErrorBoundary extends React.Component<AssessmentErrorBoundaryProps, AssessmentErrorBoundaryState> {
  constructor(props: AssessmentErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): AssessmentErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[AssessmentErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-zinc-950 p-6">
          <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-red-500 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Assessment Runtime Error
              </CardTitle>
              <CardDescription className="text-zinc-400">
                An unexpected error occurred. Your progress has been preserved.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-zinc-950 rounded p-3 border border-zinc-800">
                <p className="text-xs font-mono text-red-400 break-all">
                  {this.state.error?.message || 'Unknown error'}
                </p>
              </div>
              <Button
                onClick={() => window.location.reload()}
                className="w-full"
              >
                Refresh Assessment
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function AssessmentPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  // Assessment state
  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState<string>('Verifying your assessment link…');
  const [error, setError] = useState<string | null>(null);
  const [assessmentData, setAssessmentData] = useState<AssessmentData | null>(null);
  const [mcqQuestions, setMcqQuestions] = useState<MCQQuestion[]>([]);
  const [codingChallenges, setCodingChallenges] = useState<CodingChallenge[]>([]);
  const [apexBlanks, setApexBlanks] = useState<ApexFillInBlankQuestion[]>([]);
  const hasCoding = codingChallenges.length > 0;
  const hasApexBlanks = apexBlanks.length > 0;
  const [currentTab, setCurrentTab] = useState<'mcq' | 'coding' | 'apex_blanks'>('mcq');
  const [currentMcqIndex, setCurrentMcqIndex] = useState(0);
  const [currentCodingIndex, setCurrentCodingIndex] = useState(0);
  const [currentApexBlankIndex, setCurrentApexBlankIndex] = useState(0);
  
  // Reset to description tab when switching coding questions
  useEffect(() => {
    setProblemTab('description');
  }, [currentCodingIndex]);
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, number>>({});
  const [codingSolutions, setCodingSolutions] = useState<Record<string, string>>({});
  const [codingResults, setCodingResults] = useState<Record<string, { results: TestResult[]; passed: number; total: number; score: number; hidden_passed?: number; hidden_total?: number; compilation_error?: string; runtime_error?: string; apex_compiled?: boolean; apex_success?: boolean; apex_logs?: string; performance?: { avg_time_ms?: string | null; max_time_ms?: string | null; avg_memory_kb?: number | null; max_memory_kb?: number | null } }>>({});
  const [runningCode, setRunningCode] = useState<string | null>(null);
  const [submittingCode, setSubmittingCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [codingLanguages, setCodingLanguages] = useState<Record<string, string>>({});
  const [problemTab, setProblemTab] = useState<'description' | 'submissions'>('description');
  const [activeTestCaseTab, setActiveTestCaseTab] = useState(0);
  const [showSubmitConfirmation, setShowSubmitConfirmation] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const assessmentMode = assessmentData?.assessment_mode === 'apex' ? 'apex' : 'dsa';
  const isApexMode = assessmentMode === 'apex' || !!assessmentData?.is_apex_mode;

  const [apexBlankAnswers, setApexBlankAnswers] = useState<Record<string, Record<string, string>>>({});
  const [apexBlanksEvaluation, setApexBlanksEvaluation] = useState<{ results: ApexBlanksEvaluationResult[]; total_score: number; max_score: number } | null>(null);
  const [submittingApexBlanks, setSubmittingApexBlanks] = useState(false);

  const apexStarterTemplate = `// Apex Starter Template (Phase 1 - AI Evaluated)
public class CandidateSolution {
    public static void run() {
        // Write your Apex logic here
        System.debug('Hello from Apex');
    }
}
`;

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
  const autoSubmittedRef = useRef(false);

  const getTimerStorageKey = useCallback((sessionId: string) => {
    return `assessment_end_ts:${sessionId}`;
  }, []);

  const computeEndTsFromStartedAt = useCallback((startedAtIso: string, totalMinutes: number) => {
    const started = new Date(startedAtIso).getTime();
    if (Number.isNaN(started)) return null;
    const minutes = Number(totalMinutes) || 0;
    if (minutes <= 0) return null;
    return started + minutes * 60 * 1000;
  }, []);

  const bootstrapTimerFromStorage = useCallback((sessionId: string) => {
    try {
      const raw = localStorage.getItem(getTimerStorageKey(sessionId));
      if (!raw) return;
      const endTs = Number(raw);
      if (!Number.isFinite(endTs) || endTs <= 0) return;
      const remaining = Math.max(0, Math.floor((endTs - Date.now()) / 1000));
      setTimeRemaining(remaining);
    } catch {
      // ignore
    }
  }, [getTimerStorageKey]);

  // ── Safe Stringification Helpers for React Rendering ──
  const safeString = useCallback((value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }, []);

  const renderSafe = useCallback((value: any): React.ReactNode => {
    const maybeParseJsonString = (v: any): any => {
      if (typeof v !== 'string') return v;
      const s = v.trim();
      if (!s) return v;
      const looksJson =
        (s.startsWith('{') && s.endsWith('}')) ||
        (s.startsWith('[') && s.endsWith(']')) ||
        (s.startsWith('"') && s.endsWith('"'));
      if (!looksJson) return v;
      try {
        return JSON.parse(s);
      } catch {
        return v;
      }
    };

    const normalize = (v: any, depth = 0): any => {
      if (depth > 8) return v;
      if (typeof v === 'string') {
        let cur: any = v;
        for (let i = 0; i < 4; i++) {
          const parsed = maybeParseJsonString(cur);
          if (parsed === cur) break;
          cur = parsed;
        }
        return typeof cur === 'string' ? cur.trim() : normalize(cur, depth + 1);
      }
      if (v === null || typeof v === 'undefined') return null;
      if (Array.isArray(v)) return v.map((x) => normalize(x, depth + 1));
      if (typeof v === 'object') {
        const out: any = {};
        Object.keys(v)
          .sort()
          .forEach((k) => {
            out[k] = normalize(v[k], depth + 1);
          });
        return out;
      }
      return v;
    };

    const normalized = normalize(value);
    if (normalized !== null && typeof normalized === 'object') {
      try {
        return JSON.stringify(normalized);
      } catch {
        return safeString(normalized);
      }
    }
    if (typeof normalized === 'string') return normalized;
    return safeString(normalized);
  }, [safeString]);

  const safeNumber = useCallback((value: any): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }, []);

  // ── Assessment State Persistence & Recovery ──
  const getStorageKey = useCallback((sessionId: string, type: string) => {
    return `assessment_${type}:${sessionId}`;
  }, []);

  const saveStateToStorage = useCallback((sessionId: string) => {
    if (!sessionId) return;
    try {
      const state = {
        mcqAnswers,
        codingSolutions,
        codingLanguages,
        currentTab,
        currentMcqIndex,
        currentCodingIndex,
        currentApexBlankIndex,
        apexBlankAnswers,
        timestamp: Date.now(),
      };
      localStorage.setItem(getStorageKey(sessionId, 'state'), JSON.stringify(state));
    } catch (e) {
      console.error('[Persistence] Failed to save state:', e);
    }
  }, [mcqAnswers, codingSolutions, codingLanguages, currentTab, currentMcqIndex, currentCodingIndex, currentApexBlankIndex, apexBlankAnswers, getStorageKey]);

  const loadStateFromStorage = useCallback((sessionId: string) => {
    if (!sessionId) return null;
    try {
      const raw = localStorage.getItem(getStorageKey(sessionId, 'state'));
      if (!raw) return null;
      const state = JSON.parse(raw);
      // Validate state is recent (within 24 hours)
      const age = Date.now() - (state.timestamp || 0);
      if (age > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(getStorageKey(sessionId, 'state'));
        return null;
      }
      return state;
    } catch (e) {
      console.error('[Persistence] Failed to load state:', e);
      return null;
    }
  }, [getStorageKey]);

  const clearStateFromStorage = useCallback((sessionId: string) => {
    if (!sessionId) return;
    try {
      localStorage.removeItem(getStorageKey(sessionId, 'state'));
      localStorage.removeItem(getTimerStorageKey(sessionId));
    } catch (e) {
      console.error('[Persistence] Failed to clear state:', e);
    }
  }, [getStorageKey, getTimerStorageKey]);

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
      setWarningMessage('Assessment Terminated: face not visible 3 times.');
      setShowWarning(true);
      // Also report to backend
      if (assessmentData) {
        assessmentsRuntimeApi.proctoring(assessmentData.session_id, {
          event_type: 'face_not_detected',
          timestamp: new Date().toISOString(),
          details: { violation_count: count, auto_terminated: true },
        }).catch(() => { });
      }
    } else {
      setWarningCount((prev) => Math.max(prev, count));
      // Report to backend
      if (assessmentData) {
        assessmentsRuntimeApi.proctoring(assessmentData.session_id, {
          event_type: 'face_not_detected',
          timestamp: new Date().toISOString(),
          details: { violation_count: count },
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
      const data = await assessmentsRuntimeApi.proctoring(assessmentData.session_id, {
        event_type: eventType,
        timestamp: new Date().toISOString(),
        details,
      });

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
    // STRICT: ESC key = immediate termination
    if (e.key === 'Escape' && !terminated && !completed && !showFullscreenPrompt) {
      e.preventDefault();
      setTerminated(true);
      setWarningMessage('Assessment terminated: You pressed ESC. This is a strict proctoring violation.');
      setShowWarning(true);
      reportProctoringEvent('esc_key');
      return;
    }

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
  }, [terminated, completed, showFullscreenPrompt, reportProctoringEvent]);

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
          if (!autoSubmittedRef.current) {
            autoSubmittedRef.current = true;
            void forceSubmitAssessment('time_expired');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeRemaining, terminated, completed]);

  useEffect(() => {
    async function loadAssessment() {
      try {
        setLoading(true);
        setError(null);
        setLoadingStep('Loading your assessment…');

        if (!token) {
          setError('Invalid assessment link');
          return;
        }

        const data = await assessmentsRuntimeApi.start(token);
        setAssessmentData(data);

        const mcqList = Array.isArray(data.mcq_questions) ? data.mcq_questions : [];
        const codingList = Array.isArray(data.coding_challenges) ? data.coding_challenges : [];
        const apexBlankList = Array.isArray(data.apex_blanks) ? data.apex_blanks : [];

        setMcqQuestions(mcqList);
        setCodingChallenges(codingList);
        setApexBlanks(apexBlankList);

        const hasMcq = mcqList.length > 0;
        const hasCoding = codingList.length > 0;
        const hasApexBlanks = apexBlankList.length > 0;

        if (hasMcq && !hasCoding && !hasApexBlanks) {
          setCurrentTab('mcq');
        } else if (!hasMcq && hasCoding) {
          setCurrentTab('coding');
        } else if (!hasMcq && hasApexBlanks) {
          setCurrentTab('apex_blanks');
        }

        if (hasCoding) {
          const initialSolutions: Record<string, string> = {};
          const initialLanguages: Record<string, string> = {};
          codingList.forEach((c: CodingChallenge) => {
            const defaultLang = (data?.is_apex_mode || false)
              ? 'apex'
              : (c.supported_languages?.includes('python3') ? 'python3' : (c.supported_languages?.[0] || 'python3'));
            initialLanguages[c.id] = defaultLang;
            if (defaultLang === 'apex') {
              initialSolutions[c.id] = c.starter_code?.apex || apexStarterTemplate;
            } else {
              initialSolutions[c.id] = c.starter_code?.[defaultLang] || '';
            }
          });
          setCodingSolutions(initialSolutions);
          setCodingLanguages(initialLanguages);
        }

        if (hasApexBlanks) {
          const initialAnswers: Record<string, Record<string, string>> = {};
          apexBlankList.forEach((q: ApexFillInBlankQuestion) => {
            initialAnswers[q.id] = {};
            (q.blanks || []).forEach((b) => {
              initialAnswers[q.id][b.blank_id] = '';
            });
          });
          setApexBlankAnswers(initialAnswers);
        }

        // ── Recovery: Restore saved state from localStorage ──
        const savedState = loadStateFromStorage(data.session_id);
        if (savedState) {
          console.log('[Recovery] Restoring saved state:', savedState);
          // Restore MCQ answers
          if (savedState.mcqAnswers && Object.keys(savedState.mcqAnswers).length > 0) {
            setMcqAnswers(savedState.mcqAnswers);
          }
          // Restore coding solutions (merge with starter code)
          if (savedState.codingSolutions && Object.keys(savedState.codingSolutions).length > 0) {
            setCodingSolutions((prev) => ({ ...prev, ...savedState.codingSolutions }));
          }
          // Restore coding languages
          if (savedState.codingLanguages && Object.keys(savedState.codingLanguages).length > 0) {
            setCodingLanguages((prev) => ({ ...prev, ...savedState.codingLanguages }));
          }
          // Restore navigation state
          if (savedState.currentTab && (savedState.currentTab === 'mcq' || savedState.currentTab === 'coding' || savedState.currentTab === 'apex_blanks')) {
            setCurrentTab(savedState.currentTab);
          }
          if (savedState.currentMcqIndex !== undefined && savedState.currentMcqIndex >= 0 && savedState.currentMcqIndex < mcqList.length) {
            setCurrentMcqIndex(savedState.currentMcqIndex);
          }
          if (savedState.currentCodingIndex !== undefined && savedState.currentCodingIndex >= 0 && savedState.currentCodingIndex < codingList.length) {
            setCurrentCodingIndex(savedState.currentCodingIndex);
          }
          if (savedState.currentApexBlankIndex !== undefined && savedState.currentApexBlankIndex >= 0 && savedState.currentApexBlankIndex < apexBlankList.length) {
            setCurrentApexBlankIndex(savedState.currentApexBlankIndex);
          }
          // Restore apex blank answers
          if (savedState.apexBlankAnswers && Object.keys(savedState.apexBlankAnswers).length > 0) {
            setApexBlankAnswers((prev) => ({ ...prev, ...savedState.apexBlankAnswers }));
          }
        }

        setLoadingStep('Preparing your environment…');

        // Timer bootstrap:
        // - If assessment hasn't started yet (no started_at), keep timer at 0.
        // - If started_at exists (refresh or resumed), compute end_ts and resume countdown.
        const sessionId = String(data?.session_id || '');
        const startedAt = data?.started_at;
        const expiresAt = data?.expires_at;
        if (sessionId) {
          bootstrapTimerFromStorage(sessionId);
        }
        
        // If backend provides expires_at (authoritative), use it
        if (expiresAt) {
          try {
            const endTs = new Date(expiresAt).getTime();
            if (Number.isFinite(endTs) && endTs > 0) {
              localStorage.setItem(getTimerStorageKey(sessionId), String(endTs));
              const remaining = Math.max(0, Math.floor((endTs - Date.now()) / 1000));
              setTimeRemaining(remaining);
              console.log('[Timer] Bootstrapped from backend expires_at:', { expiresAt, endTs, remaining });
            }
          } catch (e) {
            console.error('[Timer] Failed to parse expires_at from backend:', expiresAt, e);
          }
        }
        // Fallback: compute from started_at if available
        else if (sessionId && startedAt) {
          const endTs = computeEndTsFromStartedAt(startedAt, Number(data?.total_time_minutes) || 0);
          if (endTs) {
            localStorage.setItem(getTimerStorageKey(sessionId), String(endTs));
            const remaining = Math.max(0, Math.floor((endTs - Date.now()) / 1000));
            setTimeRemaining(remaining);
            console.log('[Timer] Bootstrapped from started_at:', { startedAt, endTs, remaining });
          }
        } else {
          console.log('[Timer] Assessment not started yet, timer at 00:00');
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load assessment. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    loadAssessment();
  }, [token, computeEndTsFromStartedAt, getTimerStorageKey, loadStateFromStorage]);

  // ── Auto-save state to localStorage on changes ──
  useEffect(() => {
    if (assessmentData?.session_id && !completed && !terminated) {
      saveStateToStorage(assessmentData.session_id);
    }
  }, [mcqAnswers, codingSolutions, codingLanguages, currentTab, currentMcqIndex, currentCodingIndex, currentApexBlankIndex, apexBlankAnswers, assessmentData?.session_id, completed, terminated, saveStateToStorage]);

  // ── Clear localStorage on completion/termination ──
  useEffect(() => {
    if ((completed || terminated) && assessmentData?.session_id) {
      clearStateFromStorage(assessmentData.session_id);
    }
  }, [completed, terminated, assessmentData?.session_id, clearStateFromStorage]);

  const handleMcqAnswer = (questionId: string, optionIndex: number) => {
    if (optionIndex === -1) {
      setMcqAnswers((prev) => {
        const newAnswers = { ...prev };
        delete newAnswers[questionId];
        return newAnswers;
      });
    } else {
      setMcqAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
    }
  };

  const handleCodingSolution = (challengeId: string, code: string) => {
    setCodingSolutions((prev) => ({ ...prev, [challengeId]: code }));
  };

  const handleApexBlankChange = (questionId: string, blankId: string, value: string) => {
    setApexBlankAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        [blankId]: value,
      },
    }));
  };

  const submitApexBlanks = useCallback(async () => {
    if (!assessmentData || submittingApexBlanks) return;
    setSubmittingApexBlanks(true);
    try {
      const data = await assessmentsRuntimeApi.submitApexBlanks(assessmentData.session_id, apexBlankAnswers);

      setApexBlanksEvaluation(data);
      toast.success('Apex blanks submitted successfully');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to submit Apex blanks');
    } finally {
      setSubmittingApexBlanks(false);
    }
  }, [assessmentData, submittingApexBlanks, apexBlankAnswers]);

  const beginAssessment = useCallback(async () => {
    if (!assessmentData) return;
    try {
      const data = await assessmentsRuntimeApi.begin(assessmentData.session_id);

      const startedAtIso = data?.started_at || new Date().toISOString();
      const expiresAtIso = data?.expires_at;
      const minutes = Number(data?.time_limit_minutes) || Number(assessmentData?.total_time_minutes) || 0;
      
      // Prefer backend-provided expires_at (authoritative), fall back to computation
      let endTs: number | null = null;
      if (expiresAtIso) {
        try {
          endTs = new Date(expiresAtIso).getTime();
        } catch (e) {
          console.error('[Timer] Failed to parse expires_at from backend:', expiresAtIso, e);
        }
      }
      
      if (!endTs || !Number.isFinite(endTs)) {
        endTs = computeEndTsFromStartedAt(startedAtIso, minutes);
      }
      
      if (endTs) {
        localStorage.setItem(getTimerStorageKey(String(assessmentData.session_id)), String(endTs));
        const remaining = Math.max(0, Math.floor((endTs - Date.now()) / 1000));
        setTimeRemaining(remaining);
        console.log('[Timer] Started:', { startedAt: startedAtIso, expiresAt: expiresAtIso, endTs, remaining });
      } else {
        console.error('[Timer] Failed to compute end timestamp:', { startedAtIso, expiresAtIso, minutes });
        bootstrapTimerFromStorage(String(assessmentData.session_id));
      }
    } catch (e: any) {
      console.error('[Timer] Failed to begin assessment:', e);
      const errorMessage = e?.message || 'Failed to begin assessment';
      toast.error(errorMessage);
      // Try to bootstrap from storage as fallback
      bootstrapTimerFromStorage(String(assessmentData.session_id));
    }
  }, [assessmentData, bootstrapTimerFromStorage, computeEndTsFromStartedAt, getTimerStorageKey]);

  const runCode = async (challengeId: string) => {
    if (!assessmentData || runningCode) return;

    const code = codingSolutions[challengeId];
    if (!code) {
      toast.error('Please write some code first');
      return;
    }

    setRunningCode(challengeId);
    setActiveTestCaseTab(0);

    try {
      const selectedLanguage = isApexMode ? 'apex' : (codingLanguages[challengeId] || 'python3');

      const data = await assessmentsRuntimeApi.runCode(assessmentData.session_id, {
        challenge_id: challengeId,
        code,
        language: selectedLanguage,
      });

      console.log('[RunCode] execution_result_debug:', data);

      if (data.ai_evaluation && typeof data.ai_evaluation?.score === 'number') {
        const score = Number(data.ai_evaluation.score) || 0;
        setCodingResults((prev) => ({
          ...prev,
          [challengeId]: {
            results: [],
            passed: 0,
            total: data.total || 0,
            score,
            compilation_error: undefined,
            runtime_error: undefined,
            apex_logs: [
              data?.disclaimer ? `Disclaimer: ${data.disclaimer}` : null,
              `Verdict: ${data.ai_evaluation.verdict}`,
              '',
              data.ai_evaluation.feedback,
              Array.isArray(data.ai_evaluation.issues) && data.ai_evaluation.issues.length
                ? `\nIssues:\n- ${data.ai_evaluation.issues.join('\n- ')}`
                : '',
              Array.isArray(data.ai_evaluation.improvements) && data.ai_evaluation.improvements.length
                ? `\nImprovements:\n- ${data.ai_evaluation.improvements.join('\n- ')}`
                : '',
            ].filter(Boolean).join('\n'),
          },
        }));
        setProblemTab('submissions');
        toast.info(`AI evaluation complete. Score: ${score}%`);
        return;
      }

      if (data.compilation_error || data.runtime_error) {
        toast.error(`Execution Error`);
        setCodingResults((prev) => ({
          ...prev,
          [challengeId]: {
            ...prev[challengeId],
            results: data.results || [],
            passed: 0,
            total: data.total || 0,
            score: 0,
            compilation_error: safeString(data.compilation_error),
            runtime_error: safeString(data.runtime_error),
          },
        }));
        // Auto-switch to results tab to show the error
        setProblemTab('submissions');
        return;
      }

      setCodingResults((prev) => ({
        ...prev,
        [challengeId]: {
          results: data.results || [],
          passed: data.passed || 0,
          total: data.total || 0,
          score: safeNumber(data.score_percentage),
          compilation_error: undefined,
          runtime_error: undefined,
        },
      }));

      // Auto-switch to results tab to show output
      setProblemTab('submissions');

      if (data.passed === data.total && data.total > 0) {
        toast.success(`All ${data.total} test cases passed!`);
      } else {
        toast.info(`${data.passed}/${data.total} test cases passed`);
      }
    } catch (e: any) {
      const errorMessage = e?.message || 'Failed to run code. Please try again.';
      toast.error(errorMessage);
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
    setActiveTestCaseTab(0);

    try {
      const selectedLanguage = isApexMode ? 'apex' : (codingLanguages[challengeId] || 'python3');

      const data = await assessmentsRuntimeApi.submitCode(assessmentData.session_id, {
        challenge_id: challengeId,
        code,
        language: selectedLanguage,
      });

      if (data.ai_evaluation && typeof data.ai_evaluation?.score === 'number') {
        const score = Number(data.ai_evaluation.score) || 0;
        setCodingResults((prev) => ({
          ...prev,
          [challengeId]: {
            results: [],
            passed: 0,
            total: data.total_tests || 0,
            score,
            hidden_passed: 0,
            hidden_total: 0,
            compilation_error: undefined,
            runtime_error: undefined,
            apex_logs: [
              data?.disclaimer ? `Disclaimer: ${data.disclaimer}` : null,
              `Verdict: ${data.ai_evaluation.verdict}`,
              '',
              data.ai_evaluation.feedback,
              Array.isArray(data.ai_evaluation.issues) && data.ai_evaluation.issues.length
                ? `\nIssues:\n- ${data.ai_evaluation.issues.join('\n- ')}`
                : '',
              Array.isArray(data.ai_evaluation.improvements) && data.ai_evaluation.improvements.length
                ? `\nImprovements:\n- ${data.ai_evaluation.improvements.join('\n- ')}`
                : '',
            ].filter(Boolean).join('\n'),
          },
        }));
        setProblemTab('submissions');
        toast.success(`Submitted. AI score: ${score}%`);
        return;
      }

      if (data.compilation_error || data.runtime_error) {
        setCodingResults((prev) => ({
          ...prev,
          [challengeId]: {
            results: data.test_results || [],
            passed: 0,
            total: data.total_tests || 0,
            score: 0,
            compilation_error: safeString(data.compilation_error),
            runtime_error: safeString(data.runtime_error),
          },
        }));
        setProblemTab('submissions');
        toast.error('Execution Error — check the Results tab for details.');
        return;
      }

      setCodingResults((prev) => ({
        ...prev,
        [challengeId]: {
          results: data.test_results || [],
          passed: data.passed_count || 0,
          total: data.total_tests || 0,
          score: safeNumber(data.score_percentage),
          hidden_passed: data.hidden_tests_passed,
          hidden_total: data.hidden_tests_total,
          performance: undefined,
          compilation_error: undefined,
          runtime_error: undefined,
        },
      }));

      // Auto-switch to results tab
      setProblemTab('submissions');

      const totalPassed = (data.passed_count || 0);
      const totalTests = (data.total_tests || 0);
      if (totalPassed === totalTests && totalTests > 0) {
        toast.success(`All ${totalTests} test cases passed! Score: ${data.score_percentage?.toFixed(1)}%`);
      } else {
        toast.info(`${totalPassed}/${totalTests} passed. Score: ${data.score_percentage?.toFixed(1)}%`);
      }
    } catch (e: any) {
      const errorMessage = e?.message || 'Failed to submit solution. Please try again.';
      toast.error(errorMessage);
    } finally {
      setSubmittingCode(null);
    }
  };

  const resetCode = (challengeId: string) => {
    const lang = isApexMode ? 'apex' : (codingLanguages[challengeId] || 'python3');
    const challenge = codingChallenges.find(c => c.id === challengeId);
    if (challenge) {
      if (lang === 'apex') {
        setCodingSolutions(prev => ({ ...prev, [challengeId]: challenge.starter_code?.apex || apexStarterTemplate }));
      } else {
        setCodingSolutions(prev => ({ ...prev, [challengeId]: challenge.starter_code?.[lang] || '' }));
      }
      toast.info('Code reset to starter template');
    }
  };

  const handleSubmitAssessment = async () => {
    if (!assessmentData || submitting) return;

    // Show confirmation dialog first
    setShowSubmitConfirmation(true);
  };

  const forceSubmitAssessment = async (_reason: 'time_expired') => {
    if (!assessmentData || submitting) return;
    if (showSubmitConfirmation) setShowSubmitConfirmation(false);
    setSubmitting(true);

    try {
      if (mcqQuestions.length > 0) {
        const mcqSubmissions = Object.entries(mcqAnswers).map(([questionId, selectedIndex]) => ({
          question_id: questionId,
          selected_index: selectedIndex,
          time_taken_seconds: 0, // TODO: Track per-question time
        }));

        await assessmentsRuntimeApi.submitMcq(assessmentData.session_id, mcqSubmissions);
      }

      if (codingChallenges.length > 0) {
        for (const [challengeId, code] of Object.entries(codingSolutions)) {
          const challenge = codingChallenges.find((c) => c.id === challengeId);
          const lang = isApexMode ? 'apex' : (codingLanguages[challengeId] || 'python3');
          const starter = challenge?.starter_code?.[lang] || '';
          if (!code?.trim() || code === starter) continue;
          await assessmentsRuntimeApi.submitCode(assessmentData.session_id, {
            challenge_id: challengeId,
            code,
            language: lang,
            time_taken_seconds: 0,
          });
        }
      }

      if (apexBlanks.length > 0) {
        const data = await assessmentsRuntimeApi.submitApexBlanks(assessmentData.session_id, apexBlankAnswers);
        if (!data?.success) throw new Error('Failed to submit Apex blanks');
      }

      await assessmentsRuntimeApi.complete(assessmentData.session_id);

      setCompleted(true);
      stopCamera();
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
    } catch (e: any) {
      const errorMessage = e?.message || 'Failed to submit assessment';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmSubmitAssessment = async () => {
    if (!assessmentData || submitting) return;

    setShowSubmitConfirmation(false);
    setSubmitting(true);

    try {
      // Submit MCQ answers (if MCQ section exists)
      if (mcqQuestions.length > 0) {
        const mcqSubmissions = Object.entries(mcqAnswers).map(([questionId, selectedIndex]) => ({
          question_id: questionId,
          selected_index: selectedIndex,
          time_taken_seconds: 0, // TODO: Track per-question time
        }));

        await assessmentsRuntimeApi.submitMcq(assessmentData.session_id, mcqSubmissions);
      }

      // Submit coding solutions (if coding section exists)
      if (codingChallenges.length > 0) {
        for (const [challengeId, code] of Object.entries(codingSolutions)) {
          const challenge = codingChallenges.find((c) => c.id === challengeId);
          const lang = isApexMode ? 'apex' : (codingLanguages[challengeId] || 'python3');
          const starter = challenge?.starter_code?.[lang] || '';
          // Only submit if candidate actually changed starter code.
          if (!code?.trim() || code === starter) continue;
          await assessmentsRuntimeApi.codingSubmit(assessmentData.session_id, {
            challenge_id: challengeId,
            code,
            language: lang,
            time_taken_seconds: 0,
          });
        }
      }

      await assessmentsRuntimeApi.complete(assessmentData.session_id);

      setCompleted(true);
      stopCamera();

      // Exit fullscreen
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
    } catch (e: any) {
      const errorMessage = e?.message || 'Failed to submit assessment';
      toast.error(errorMessage);
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
        <div className="text-center space-y-6 max-w-sm w-full px-6">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Shield className="h-12 w-12 text-primary opacity-20" />
              <Loader2 className="h-12 w-12 animate-spin text-primary absolute inset-0" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Proctored Assessment</p>
              <p className="text-sm text-muted-foreground mt-1">{loadingStep}</p>
            </div>
          </div>
          {/* Step indicators */}
          <div className="flex items-center gap-2 justify-center">
            {['Verifying', 'Loading', 'Preparing'].map((step, i) => {
              const stepMsg = loadingStep.toLowerCase();
              const done = (i === 0 && !stepMsg.includes('verify')) ||
                           (i === 1 && stepMsg.includes('prepar')) ||
                           false;
              const active = (i === 0 && stepMsg.includes('verify')) ||
                             (i === 1 && stepMsg.includes('load')) ||
                             (i === 2 && stepMsg.includes('prepar'));
              return (
                <div key={step} className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full transition-colors ${
                    done ? 'bg-primary' : active ? 'bg-primary animate-pulse' : 'bg-muted'
                  }`} />
                  {i < 2 && <div className="h-px w-6 bg-muted" />}
                </div>
              );
            })}
          </div>
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
      <div className="min-h-screen bg-background p-4 flex flex-col items-center gap-6 py-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-2xl"
        >
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
              <CardTitle className="text-2xl">Assessment Submitted Successfully</CardTitle>
              <CardDescription className="text-base">
                Thank you for completing the technical assessment. Your responses have been submitted for evaluation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-center pt-2">
                The hiring team will review your results and contact you regarding next steps.
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
                  <span className="text-sm">{isApexMode ? `${apexBlanks.length} Apex Questions` : `${assessmentData?.coding_count} Coding Challenges`}</span>
                </div>
              </div>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={async () => {
                await beginAssessment();
                await enterFullscreen();
              }}
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
  const attemptedCodingCount = Object.keys(codingSolutions).filter((id) => {
    const challenge = codingChallenges.find((c) => c.id === id);
    const lang = codingLanguages[id] || 'python3';
    const starter = challenge?.starter_code?.[lang] || '';
    return !!challenge && (codingSolutions[id] || '').trim() !== '' && codingSolutions[id] !== starter;
  }).length;
  const codingProgress = codingChallenges.length === 0 ? 0 : (Object.keys(codingSolutions).filter(k => {
    const challenge = codingChallenges.find(c => c.id === k);
    const lang = codingLanguages[k] || 'python3';
    return challenge && codingSolutions[k] !== (challenge.starter_code?.[lang] || '');
  }).length / codingChallenges.length) * 100;
  const hasMcq = mcqQuestions.length > 0;
  const activeTab = hasMcq
    ? ((hasCoding || hasApexBlanks) ? currentTab : 'mcq')
    : (hasApexBlanks ? 'apex_blanks' : 'coding');

  return (
    <AssessmentErrorBoundary>
      <div className="min-h-screen bg-background select-none">
      {/* Submit Confirmation Dialog */}
      <AlertDialog open={showSubmitConfirmation} onOpenChange={setShowSubmitConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Submit Assessment
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base space-y-4">
              <p>Are you sure you want to submit your assessment? This action cannot be undone.</p>
              
              <div className="space-y-3 pt-2">
                <p className="font-semibold text-foreground">Your Progress:</p>
                
                {mcqQuestions.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>MCQ Questions:</span>
                      <span className="font-medium">
                        {Object.keys(mcqAnswers).length} / {mcqQuestions.length} answered
                      </span>
                    </div>
                    <Progress 
                      value={(Object.keys(mcqAnswers).length / mcqQuestions.length) * 100} 
                      className="h-2"
                    />
                  </div>
                )}
                
                {codingChallenges.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Coding Challenges:</span>
                      <span className="font-medium">
                        {attemptedCodingCount} / {codingChallenges.length} attempted
                      </span>
                    </div>
                    <Progress 
                      value={(attemptedCodingCount / codingChallenges.length) * 100} 
                      className="h-2"
                    />
                    
                    {Object.keys(codingResults).length > 0 && (
                      <div className="flex justify-between text-sm mt-1">
                        <span>Test Cases Passed:</span>
                        <span className="font-medium text-success">
                          {Object.values(codingResults).reduce((sum, r) => sum + r.passed, 0)} / {Object.values(codingResults).reduce((sum, r) => sum + r.total, 0)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {apexBlanks.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Apex Questions:</span>
                      <span className="font-medium">
                        {Object.entries(apexBlankAnswers || {}).filter(([, blanks]) => {
                          const first = Object.values(blanks || {})[0];
                          return typeof first === 'string' && first.trim().length > 0;
                        }).length} / {apexBlanks.length} answered
                      </span>
                    </div>
                    <Progress
                      value={(Object.entries(apexBlankAnswers || {}).filter(([, blanks]) => {
                        const first = Object.values(blanks || {})[0];
                        return typeof first === 'string' && first.trim().length > 0;
                      }).length / apexBlanks.length) * 100}
                      className="h-2"
                    />
                  </div>
                )}
                
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span>Time Remaining:</span>
                  <span className={`font-medium ${timeRemaining < 300 ? 'text-destructive' : ''}`}>
                    {formatTime(timeRemaining)}
                  </span>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitConfirmation(false)}>
              Cancel
            </Button>
            <Button onClick={confirmSubmitAssessment} className="bg-gray-700 hover:bg-gray-800">
              Confirm Submit
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Warning Dialog */}
      <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Proctoring Warning
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {warningMessage}
            </AlertDialogDescription>
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
              <span className="font-semibold hidden sm:inline">Proctored Assessment</span>
            </div>
            <Badge variant="outline" className="hidden md:inline-flex">{assessmentData?.job_title}</Badge>
          </div>

          <div className="flex items-center gap-4">
            <Dialog open={instructionsOpen} onOpenChange={setInstructionsOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  aria-label="Assessment Instructions"
                  title="Instructions"
                >
                  i
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Assessment Instructions</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 text-sm">
                  <div className="space-y-2">
                    <div className="font-semibold text-destructive">Strict Proctoring Rules</div>
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <XCircle className="h-4 w-4 mt-0.5 text-destructive" />
                        <span>Exiting fullscreen results in immediate termination.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <XCircle className="h-4 w-4 mt-0.5 text-destructive" />
                        <span>Switching tabs/minimizing the window results in immediate termination.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <XCircle className="h-4 w-4 mt-0.5 text-destructive" />
                        <span>Clicking outside the assessment window results in immediate termination.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5 text-warning" />
                        <span>Face not visible 3 times results in termination.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5 text-warning" />
                        <span>Copy/paste, right-click, or DevTools attempts are recorded.</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="font-semibold">General Guidelines</div>
                    <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <Camera className="h-4 w-4 mt-0.5 text-primary" />
                        <span>Keep your camera on and face visible throughout the assessment.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Clock className="h-4 w-4 mt-0.5 text-primary" />
                        <span>Timer is shown on the top bar. Submit before time runs out.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <FileQuestion className="h-4 w-4 mt-0.5 text-primary" />
                        <span>Complete MCQ and/or Coding sections as provided for this assessment.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

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

          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 relative">
        <div className="flex justify-end mb-4">
          <Button
            onClick={handleSubmitAssessment}
            disabled={submitting}
            size="lg"
            className="bg-gray-700 hover:bg-gray-800 text-white shadow-md text-base px-6 h-12"
            title="Submit Assessment"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="mr-2 h-5 w-5" />
                Submit Assessment
              </>
            )}
          </Button>
        </div>
        <Tabs value={activeTab} onValueChange={(v) => setCurrentTab(v as 'mcq' | 'coding' | 'apex_blanks')}>
          {hasMcq && (hasCoding || hasApexBlanks) && (
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-6">
              <TabsTrigger value="mcq" className="flex items-center gap-2">
                <FileQuestion className="h-4 w-4" />
                MCQ ({Object.keys(mcqAnswers).length}/{mcqQuestions.length})
              </TabsTrigger>
              {hasCoding ? (
                <TabsTrigger value="coding" className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Coding ({currentCodingIndex + 1}/{codingChallenges.length})
                </TabsTrigger>
              ) : (
                <TabsTrigger value="apex_blanks" className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Apex Syntax ({currentApexBlankIndex + 1}/{apexBlanks.length})
                </TabsTrigger>
              )}
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
                        key={`mcq-radio-${currentMcq.id}`}
                        value={mcqAnswers[currentMcq.id] !== undefined ? mcqAnswers[currentMcq.id].toString() : ''}
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
                            <RadioGroupItem value={index.toString()} id={`option-${currentMcq.id}-${index}`} />
                            <Label htmlFor={`option-${currentMcq.id}-${index}`} className="flex-1 cursor-pointer">
                              {option}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>

                      <div className="flex justify-between pt-4">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setCurrentMcqIndex((prev) => Math.max(0, prev - 1))}
                            disabled={currentMcqIndex === 0}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleMcqAnswer(currentMcq.id, -1)}
                            disabled={mcqAnswers[currentMcq.id] === undefined}
                          >
                            Clear Response
                          </Button>
                        </div>
                        {currentMcqIndex === mcqQuestions.length - 1 && hasCoding ? (
                          <Button
                            onClick={() => setCurrentTab('coding')}
                          >
                            Next Section →
                          </Button>
                        ) : currentMcqIndex === mcqQuestions.length - 1 && hasApexBlanks ? (
                          <Button
                            onClick={() => setCurrentTab('apex_blanks')}
                          >
                            Next Section →
                          </Button>
                        ) : currentMcqIndex < mcqQuestions.length - 1 ? (
                          <Button
                            onClick={() => setCurrentMcqIndex((prev) => prev + 1)}
                          >
                            Next
                          </Button>
                        ) : null}
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

          {/* Apex Fill-in-the-Blanks Section */}
          {hasApexBlanks && (
            <TabsContent value="apex_blanks">
              <div className="max-w-5xl mx-auto space-y-6">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="font-medium text-foreground">Apex Syntax Evaluation</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    This section evaluates Apex coding knowledge through syntax-based fill-in-the-blanks questions.
                  </div>
                </div>

                <Progress
                  value={((currentApexBlankIndex + 1) / Math.max(1, apexBlanks.length)) * 100}
                  className="h-2"
                />

                {apexBlanks[currentApexBlankIndex] && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">Question {currentApexBlankIndex + 1} of {apexBlanks.length}</CardTitle>
                        <Badge variant="outline">{apexBlanks[currentApexBlankIndex].points} pts</Badge>
                      </div>
                      <CardDescription>
                        {apexBlanks[currentApexBlankIndex].instructions}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="rounded-lg border border-zinc-700 bg-zinc-900 overflow-hidden">
                        <div className="px-3 py-1.5 bg-zinc-800 border-b border-zinc-700 text-xs font-semibold text-zinc-300">Code Snippet</div>
                        <pre className="p-3 text-xs font-mono text-zinc-100 whitespace-pre-wrap overflow-auto max-h-64 leading-relaxed">
                          {apexBlanks[currentApexBlankIndex].code_with_blanks.split('___').map((part, i, arr) => (
                            <span key={i}>
                              {part}
                              {i < arr.length - 1 && (
                                <span className="inline-flex items-center gap-0.5 mx-0.5 px-1.5 py-0.5 rounded bg-amber-400/20 border border-amber-400/50 text-amber-300 font-bold text-[10px] align-middle">
                                  <span className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-amber-400/30 text-[9px]">{i + 1}</span>
                                  ___
                                </span>
                              )}
                            </span>
                          ))}
                        </pre>
                      </div>
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold">Fill in the Blanks</Label>
                        {(apexBlanks[currentApexBlankIndex].blanks || []).map((blank, bi) => (
                          <div key={blank.blank_id} className="space-y-1">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary/20 text-primary text-[10px] font-bold">{bi + 1}</span>
                              {blank.placeholder}
                            </Label>
                            {blank.guidance && (
                              <p className="text-[11px] text-muted-foreground italic pl-6">{blank.guidance}</p>
                            )}
                            <input
                              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                              placeholder={`Enter value for ${blank.placeholder}…`}
                              value={apexBlankAnswers?.[apexBlanks[currentApexBlankIndex].id]?.[blank.blank_id] || ''}
                              onChange={(e) =>
                                handleApexBlankChange(
                                  apexBlanks[currentApexBlankIndex].id,
                                  blank.blank_id,
                                  e.target.value
                                )
                              }
                            />
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            disabled={currentApexBlankIndex === 0}
                            onClick={() => setCurrentApexBlankIndex((i) => Math.max(0, i - 1))}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            disabled={currentApexBlankIndex >= apexBlanks.length - 1}
                            onClick={() => setCurrentApexBlankIndex((i) => Math.min(apexBlanks.length - 1, i + 1))}
                          >
                            Next
                          </Button>
                        </div>

                        <Button onClick={submitApexBlanks} disabled={submittingApexBlanks}>
                          {submittingApexBlanks ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</>
                          ) : (
                            <><Send className="mr-2 h-4 w-4" />Submit</>
                          )}
                        </Button>
                      </div>

                      {apexBlanksEvaluation && (
                        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
                          <p className="text-sm text-green-400 font-medium">Answers submitted successfully.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
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
                          Q{idx + 1}: {renderSafe(c.title)}
                          <span className="text-[10px] opacity-70">({renderSafe(c.points)}pts)</span>
                        </span>
                      </button>
                    );
                  })}
                  <div className="ml-auto">
                    <Progress value={codingProgress} className="h-1.5 w-32" />
                  </div>
                </div>

                {currentCoding && (
                  <div className="grid lg:grid-cols-2 gap-4 h-[74vh] min-h-[620px]">
                    {/* LEFT: Problem Description Panel */}
                    <div className="flex flex-col h-full min-h-0 border rounded-lg overflow-hidden bg-card">
                      {/* Problem Header */}
                      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm">{renderSafe(currentCoding.title)}</h3>
                          <Badge variant="outline" className="text-[10px]">{renderSafe(currentCoding.points)} pts</Badge>
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

                      <div className="flex-1 overflow-auto p-4 space-y-4">
                        {problemTab === 'description' ? (
                          <>
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <p className="whitespace-pre-wrap text-sm leading-relaxed">{renderSafe(currentCoding.description)}</p>
                            </div>

                            {currentCoding.examples && currentCoding.examples.length > 0 && (
                              <div className="space-y-3">
                                {currentCoding.examples.map((ex, idx) => (
                                  <div key={idx} className="rounded-lg border bg-muted/20 overflow-hidden">
                                    <div className="px-3 py-1.5 bg-muted/40 border-b text-xs font-semibold text-muted-foreground">Example {idx + 1}</div>
                                    <div className="p-3 text-xs font-mono space-y-1">
                                      <div><span className="text-muted-foreground">Input:</span> {renderSafe(ex.input)}</div>
                                      <div><span className="text-muted-foreground">Output:</span> {renderSafe(ex.output)}</div>
                                      {ex.explanation && (
                                        <div><span className="text-muted-foreground">Explanation:</span> {renderSafe(ex.explanation)}</div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {currentCoding.constraints && (
                              <div className="rounded-lg border bg-muted/20 overflow-hidden">
                                <div className="px-3 py-1.5 bg-muted/40 border-b text-xs font-semibold text-muted-foreground">Constraints</div>
                                <div className="p-3 text-xs font-mono whitespace-pre-wrap text-muted-foreground">{renderSafe(currentCoding.constraints)}</div>
                              </div>
                            )}

                            {currentCoding.test_cases && currentCoding.test_cases.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">Sample Test Cases</h4>
                                {currentCoding.test_cases.map((tc, idx) => (
                                  <div key={tc.id || idx} className="bg-muted/30 rounded-lg p-2.5 text-xs font-mono border">
                                    <div><span className="text-muted-foreground">Input:</span> {renderSafe(tc.input)}</div>
                                    <div><span className="text-muted-foreground">Expected:</span> {renderSafe(tc.expected_output)}</div>
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
                              {/* Compilation / Runtime Error Banner */}
                              {(codingResults[currentCoding.id].compilation_error || codingResults[currentCoding.id].runtime_error) && (
                                <motion.div
                                  initial={{ opacity: 0, y: -10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-4"
                                >
                                  <div className="flex items-center gap-2 mb-2">
                                    <AlertCircle className="h-5 w-5 text-orange-500" />
                                    <span className="font-bold text-sm text-orange-600">
                                      {codingResults[currentCoding.id].compilation_error ? 'Compilation Error' : 'Runtime Error'}
                                    </span>
                                  </div>
                                  <pre className="text-xs font-mono text-orange-300 whitespace-pre-wrap bg-black/30 rounded p-3 overflow-auto max-h-40">
                                    {renderSafe(codingResults[currentCoding.id].compilation_error || codingResults[currentCoding.id].runtime_error)}
                                  </pre>
                                </motion.div>
                              )}

                              {/* Verdict Banner */}
                              {!(codingResults[currentCoding.id].compilation_error || codingResults[currentCoding.id].runtime_error) && (
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
                                    <span className="text-2xl font-bold">{safeNumber(codingResults[currentCoding.id].score).toFixed(0)}%</span>
                                  </div>
                                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                    <span>{codingResults[currentCoding.id].passed}/{codingResults[currentCoding.id].total} tests passed</span>
                                    {codingResults[currentCoding.id].hidden_total != null && codingResults[currentCoding.id].hidden_total! > 0 && (
                                      <span>({codingResults[currentCoding.id].hidden_passed}/{codingResults[currentCoding.id].hidden_total} hidden)</span>
                                    )}
                                    {codingResults[currentCoding.id].performance?.avg_time_ms && (
                                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {safeString(codingResults[currentCoding.id].performance?.avg_time_ms)}ms avg</span>
                                    )}
                                    {codingResults[currentCoding.id].performance?.avg_memory_kb && (
                                      <span>{safeString(codingResults[currentCoding.id].performance?.avg_memory_kb)}KB avg</span>
                                    )}
                                  </div>
                                </motion.div>
                              )}

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
                                          {renderSafe(result.status)}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-sans">
                                        {result.time_used && <span>{safeNumber(result.time_used) ? (safeNumber(result.time_used) * 1000).toFixed(0) : '0'} ms</span>}
                                        {result.memory_used && <span>{renderSafe(result.memory_used)} KB</span>}
                                      </div>
                                    </div>
                                    <div className="mt-1.5 pt-1.5 border-t border-dashed text-muted-foreground space-y-0.5">
                                      {result.is_hidden ? (
                                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground italic">
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-700/50 text-zinc-400">🔒 Hidden test — input &amp; expected not shown</span>
                                        </div>
                                      ) : (
                                        <>
                                          <div><span className="text-muted-foreground/70">Input:</span> {renderSafe(result.input)}</div>
                                          <div><span className="text-muted-foreground/70">Expected:</span> {renderSafe(result.expected_output)}</div>
                                        </>
                                      )}
                                      <div className={result.passed ? 'text-green-400' : 'text-red-400'}>
                                        {result.error ? (
                                          <><span className="text-muted-foreground/70">Error:</span> {renderSafe(result.error)}</>
                                        ) : (
                                          <><span className="text-muted-foreground/70">Output:</span> {renderSafe(result.actual_output) || 'N/A'}</>
                                        )}
                                      </div>
                                      {result.stdout && (
                                        <div className="mt-1 pt-1 border-t border-dotted border-zinc-700">
                                          <span className="text-muted-foreground/70 text-[10px] uppercase">Stdout:</span>
                                          <pre className="text-[11px] font-mono text-zinc-100 whitespace-pre-wrap bg-black/30 rounded px-2 py-1 mt-0.5 max-h-20 overflow-auto">{renderSafe(result.stdout)}</pre>
                                        </div>
                                      )}
                                      {result.stderr && (
                                        <div className="mt-1 pt-1 border-t border-dotted border-zinc-700">
                                          <span className="text-muted-foreground/70 text-[10px] uppercase">Stderr:</span>
                                          <pre className="text-[11px] font-mono text-red-400/90 whitespace-pre-wrap bg-red-950/20 rounded px-2 py-1 mt-0.5 max-h-20 overflow-auto">{renderSafe(result.stderr)}</pre>
                                        </div>
                                      )}
                                    </div>
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
                    <div className="flex flex-col h-full min-h-0 border rounded-lg overflow-hidden bg-card">
                      {/* Editor Toolbar */}
                      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                        <div className="flex items-center gap-2">
                          {isApexMode ? (
                            <div className="flex flex-col leading-tight">
                              <div className="text-xs font-semibold">
                                {assessmentData?.coding_environment_label || 'Apex Coding Environment (AI-Evaluated - Phase 1)'}
                              </div>
                              <div
                                className="text-[10px] text-muted-foreground"
                                title="This coding test is evaluated using AI approximation and not actual Apex execution."
                              >
                                AI-Evaluated (Phase 1 - Approximate Validation, Not Real Execution)
                              </div>
                            </div>
                          ) : (
                            <Select
                              value={codingLanguages[currentCoding.id] || 'python3'}
                              onValueChange={(lang) => {
                                setCodingLanguages(prev => ({ ...prev, [currentCoding.id]: lang }));
                                setCodingSolutions(prev => ({ ...prev, [currentCoding.id]: currentCoding.starter_code?.[lang] || '' }));
                              }}
                            >
                              <SelectTrigger className="w-[140px] h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(currentCoding.supported_languages || []).map((lang) => (
                                  <SelectItem key={lang} value={lang}>
                                    {{ python3: 'Python 3', javascript: 'JavaScript', java: 'Java', cpp: 'C++', typescript: 'TypeScript', csharp: 'C#', go: 'Go', rust: 'Rust', kotlin: 'Kotlin', ruby: 'Ruby', apex: 'Apex' }[lang] || lang}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
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
                      <div className="flex-none border-b border-border" style={{ height: 350 }}>
                        <Editor
                          height="100%"
                          language={isApexMode ? 'java' : ({ python3: 'python', javascript: 'javascript', java: 'java', cpp: 'cpp', typescript: 'typescript', csharp: 'csharp', go: 'go', rust: 'rust', kotlin: 'kotlin', ruby: 'ruby', apex: 'apex' }[(codingLanguages[currentCoding.id] || 'python3')] || 'python')}
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

                      {/* User Output Panel — always shown once code has been run */}
                      {codingResults[currentCoding.id] && !runningCode && !submittingCode && (() => {
                        const result = codingResults[currentCoding.id];
                        const compilationError = result.compilation_error;
                        const results = result.results;

                        // Get the active test case
                        const activeIndex = activeTestCaseTab < results.length ? activeTestCaseTab : 0;
                        const activeResult = results[activeIndex];

                        const outputMatchesExpectedText = (() => {
                          if (!activeResult || !activeResult.stdout) return false;
                          const actual = activeResult.stdout.trim();
                          const expected = (activeResult.expected_output || "").trim();
                          return actual === expected;
                        })();

                        return (
                          <div className="flex flex-col flex-1 bg-zinc-950 overflow-hidden" style={{ minHeight: 250 }}>
                            {/* Header */}
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/80 border-b border-zinc-800 sticky top-0">
                              <Terminal className="h-3 w-3 text-zinc-400" />
                              <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">Testcase &gt;_ Test Result</span>
                            </div>

                            <div className="flex-1 overflow-auto p-3 space-y-3">
                              {/* ── Compilation Error ── */}
                              {compilationError && (
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-400 mb-1 flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" /> Compilation Error
                                  </p>
                                  <pre className="text-xs font-mono text-orange-300 whitespace-pre-wrap bg-orange-950/30 border border-orange-500/20 rounded px-2.5 py-2">
                                    {safeString(compilationError)}
                                  </pre>
                                </div>
                              )}

                              {!compilationError && result.apex_logs && (
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Apex Execution Logs</p>
                                  <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap bg-zinc-900 border border-zinc-800 rounded px-2.5 py-2 max-h-48 overflow-auto">
                                    {safeString(result.apex_logs)}
                                  </pre>
                                </div>
                              )}

                              {!compilationError && results.length > 0 && (
                                <>
                                  {/* Verdict & Runtime */}
                                  <div className="flex items-center gap-3">
                                    <span className={`text-lg font-bold ${result.passed === result.total ? 'text-green-500' : 'text-red-500'}`}>
                                      {result.passed === result.total ? 'Accepted' : 'Wrong Answer'}
                                    </span>
                                    {result.performance?.avg_time_ms && (
                                      <span className="text-xs text-zinc-400 font-medium tracking-tight">Runtime: {safeString(result.performance.avg_time_ms)} ms</span>
                                    )}
                                  </div>

                                  {/* Testcase Tabs */}
                                  <div className="flex flex-wrap gap-2 pt-1 pb-2">
                                    {results.map((r, idx) => (
                                      <button
                                        key={idx}
                                        onClick={() => setActiveTestCaseTab(idx)}
                                        className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                                          activeTestCaseTab === idx
                                            ? 'bg-zinc-800 text-zinc-100'
                                            : 'bg-zinc-900/40 text-zinc-400 hover:bg-zinc-800/60'
                                        }`}
                                      >
                                        <div className={`h-1.5 w-1.5 rounded-full ${r.status !== 'CE' && r.passed ? 'bg-green-500' : 'bg-red-500'}`} />
                                        Case {idx + 1}
                                      </button>
                                    ))}
                                  </div>

                                  {/* Active Testcase Details */}
                                  {activeResult && (
                                    <div className="space-y-3">
                                      <div>
                                        <p className="text-[10px] font-semibold text-zinc-500 mb-1">Input</p>
                                        <div className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2">
                                          <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap">
                                            {renderSafe(activeResult.input) || 'No input'}
                                          </pre>
                                        </div>
                                      </div>
                                      
                                      <div>
                                        <p className="text-[10px] font-semibold text-zinc-500 mb-1">Output</p>
                                        <div className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2">
                                          <pre className={`text-xs font-mono whitespace-pre-wrap ${(!activeResult.passed && !activeResult.stderr) ? 'text-red-400' : 'text-zinc-300'}`}>
                                            {renderSafe(activeResult.actual_output || activeResult.stdout)}
                                          </pre>
                                          {(!activeResult.actual_output && !activeResult.stdout && !activeResult.stderr) && (
                                            <span className="text-xs italic text-zinc-600">No output</span>
                                          )}
                                        </div>
                                      </div>

                                      <div>
                                        <p className="text-[10px] font-semibold text-zinc-500 mb-1">Expected</p>
                                        <div className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2">
                                          <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap">
                                            {renderSafe(activeResult.expected_output) || 'No expected output'}
                                          </pre>
                                        </div>
                                      </div>

                                      {activeResult.stderr && (
                                        <div>
                                          <p className="text-[10px] font-semibold text-red-500 mb-1 flex items-center gap-1.5">
                                            <XCircleIcon className="h-3 w-3" /> Runtime Error / Stderr
                                          </p>
                                          <pre className="text-xs font-mono text-red-400 bg-red-950/20 border border-red-500/20 rounded px-3 py-2 whitespace-pre-wrap">
                                            {safeString(activeResult.stderr)}
                                          </pre>
                                        </div>
                                      )}

                                      {outputMatchesExpectedText && (
                                        <div className="mt-1 flex items-center gap-1.5 bg-green-500/10 border border-green-500/30 rounded px-2.5 py-1.5 w-fit">
                                          <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                                          <span className="text-[10px] text-green-400 font-medium">
                                            Output matches expected — looks correct!
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </>
                              )}
                              
                              {!compilationError && results.length === 0 && (
                                <p className="text-xs text-zinc-500 italic">No output generated.</p>
                              )}
                            </div>
                          </div>
                        );
                      })()}
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
                  <Button
                    onClick={() => setCurrentCodingIndex((prev) => Math.min(codingChallenges.length - 1, prev + 1))}
                    disabled={currentCodingIndex === codingChallenges.length - 1}
                  >
                    Next Challenge
                  </Button>
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>

        {/* Submit Assessment Button - Always visible at the bottom */}

      </main>
    </div>
    </AssessmentErrorBoundary>
  );
}
