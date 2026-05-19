/**
 * AI Interview Page with automatic timed recording and camera proctoring.
 * Questions advance automatically with server-side transcription.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Shield,
  Maximize,
  Mic,
  Video,
  VideoOff,
  Clock3,
  Camera,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
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
import { aiInterviewApi } from '@/lib/api';

interface InterviewData {
  session_id: string;
  candidate_name: string;
  job_title: string;
  total_questions: number;
  estimated_duration_minutes: number;
}

interface InterviewQuestion {
  index: number;
  question_text: string;
  question_type: string;
  expected_duration_seconds: number;
}

const DEFAULT_QUESTION_WINDOW_SECONDS = 60;

interface InterviewEvaluationResult {
  overall_score: number;
  technical_score: number;
  communication_score: number;
  confidence_score: number;
  recommendation: string;
  strengths: string[];
  areas_for_improvement: string[];
  detailed_feedback: string;
}

export default function AIInterviewPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  // Interview state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interviewData, setInterviewData] = useState<InterviewData | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<InterviewQuestion | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isTerminated, setIsTerminated] = useState(false);
  const [finalEvaluation, setFinalEvaluation] = useState<InterviewEvaluationResult | null>(null);

  // Media state
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isQuestionReadComplete, setIsQuestionReadComplete] = useState(false);
  const [questionDurationSeconds, setQuestionDurationSeconds] = useState(DEFAULT_QUESTION_WINDOW_SECONDS);
  const [questionTimeLeftSeconds, setQuestionTimeLeftSeconds] = useState(DEFAULT_QUESTION_WINDOW_SECONDS);
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false);

  // Proctoring state
  const [showReadyScreen, setShowReadyScreen] = useState(true);
  const [showPermissionDialog, setShowPermissionDialog] = useState(true);
  const [headsetConfirmed, setHeadsetConfirmed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const [violationThreshold, setViolationThreshold] = useState(3);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');

  // Face detection state
  const noFaceCountRef = useRef(0);
  const MAX_NO_FACE_VIOLATIONS = 3;

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const questionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const stopRecordingResolverRef = useRef<((blob: Blob | null) => void) | null>(null);

  // Speech synthesis - speak the question
  const speakQuestion = useCallback((text: string, onComplete?: () => void) => {
    if (!('speechSynthesis' in window)) {
      setIsSpeaking(false);
      onComplete?.();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      onComplete?.();
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      onComplete?.();
    };

    synthRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, []);

  const queueServerTranscription = useCallback(async (
    questionIndex: number,
    audioDurationSeconds: number,
    blob: Blob | null,
  ) => {
    if (!interviewData || !blob || blob.size === 0) return;

    try {
      const arrayBuffer = await blob.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8.byteLength; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      const audio_base64 = btoa(binary);

      await aiInterviewApi.transcribeStore(interviewData.session_id, {
        question_index: questionIndex,
        audio_base64,
        mime_type: blob.type || 'audio/webm',
        audio_duration_seconds: audioDurationSeconds,
      });
    } catch (error) {
      console.error('Background transcription upload failed', error);
    }
  }, [interviewData]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    if (questionTimerRef.current) {
      clearInterval(questionTimerRef.current);
      questionTimerRef.current = null;
    }
    setIsRecording(false);

    const recorder = mediaRecorderRef.current;
    if (!recorder) return null;

    return new Promise<Blob | null>((resolve) => {
      stopRecordingResolverRef.current = resolve;
      try {
        try {
          recorder.requestData();
        } catch {
          // ignore
        }
        if (recorder.state !== 'inactive') {
          recorder.stop();
          return;
        }
      } catch {
        // ignore
      }
      mediaRecorderRef.current = null;
      resolve(new Blob(recordedChunksRef.current, { type: 'audio/webm' }));
    });
  }, []);

  const startRecording = useCallback(() => {
    if (!micEnabled) {
      toast.error('Microphone is not enabled. Please allow microphone access.');
      return;
    }

    if (!mediaStreamRef.current) {
      toast.error('Microphone stream is not ready. Please re-enable permissions.');
      return;
    }

    const stream = mediaStreamRef.current;
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks || audioTracks.length === 0) {
      toast.error('No microphone track available. Please check your device settings.');
      return;
    }

    recordedChunksRef.current = [];

    try {
      const audioOnlyStream = new MediaStream(audioTracks);
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const recorder = mimeType ? new MediaRecorder(audioOnlyStream, { mimeType }) : new MediaRecorder(audioOnlyStream);
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType || 'audio/webm' });
        const resolver = stopRecordingResolverRef.current;
        stopRecordingResolverRef.current = null;
        mediaRecorderRef.current = null;
        resolver?.(blob.size > 0 ? blob : null);
      };
      recorder.start(250);
      mediaRecorderRef.current = recorder;
    } catch {
      toast.error('Unable to start audio recording. Please check microphone permissions and try again.');
      return;
    }

    setIsRecording(true);
  }, [micEnabled]);

  // Load current question (with optional adaptive mode for follow-up questions)
  const loadCurrentQuestion = useCallback(async (nextIndex?: number) => {
    if (!interviewData) return;

    try {
      // For follow-up questions (index > 0), call adapt-question to get context-aware question
      let data: any;
      if (typeof nextIndex === 'number' && nextIndex > 0) {
        try {
          data = await aiInterviewApi.adaptQuestion(interviewData.session_id, nextIndex);
          if (data?.adaptive) console.log('[AIInterviewPage] Adaptive question generated for index', nextIndex);
        } catch {
          // fall through to standard question endpoint
        }
      }

      if (!data) {
        data = await aiInterviewApi.question(interviewData.session_id);
      }

      if (data.completed) {
        setIsCompleted(true);
        return;
      }

      setIsQuestionReadComplete(false);
      setCurrentQuestion(data);

      // Speak the question after a short delay
      setTimeout(() => {
        speakQuestion(data.question_text, () => setIsQuestionReadComplete(true));
      }, 1000);
    } catch (e) {
      toast.error('Failed to load question');
    }
  }, [interviewData, speakQuestion]);

  const advanceAfterTimeout = useCallback(async (question: InterviewQuestion, audioDurationSeconds: number, recordedBlob: Blob | null) => {
    if (!interviewData) return;

    try {
      const data = await aiInterviewApi.submitResponse(interviewData.session_id, {
        question_index: question.index,
        transcript: '',
        audio_duration_seconds: audioDurationSeconds,
        confidence: 0.9,
      });

      if (data.is_last_question) {
        // CRITICAL: await transcription before evaluating — empty transcripts cause "No responses" evaluation
        await queueServerTranscription(question.index, audioDurationSeconds, recordedBlob);
        const evalData = await aiInterviewApi.complete(interviewData.session_id);
        setFinalEvaluation(evalData);
        setIsCompleted(true);
      } else {
        // Non-last questions: fire-and-forget transcription while advancing
        void queueServerTranscription(question.index, audioDurationSeconds, recordedBlob);
        // Pass the next index so adapt-question can generate a context-aware follow-up
        const nextIndex = (question.index ?? 0) + 1;
        await loadCurrentQuestion(nextIndex);
      }
    } catch (e) {
      toast.error('Failed to continue interview automatically. Please refresh and try again.');
    }
  }, [interviewData, loadCurrentQuestion, queueServerTranscription]);

  const handleNextQuestion = useCallback(async () => {
    if (!currentQuestion || isAutoAdvancing) return;

    setIsAutoAdvancing(true);
    const audioCapturedSeconds = Math.max(0, questionDurationSeconds - questionTimeLeftSeconds);
    const recordedBlob = await stopRecording();
    await advanceAfterTimeout(currentQuestion, audioCapturedSeconds, recordedBlob);
    setIsAutoAdvancing(false);
  }, [currentQuestion, isAutoAdvancing, questionDurationSeconds, questionTimeLeftSeconds, stopRecording, advanceAfterTimeout]);

  // Camera setup
  const setupCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
        audio: true,
      });

      mediaStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setCameraEnabled(true);
      setMicEnabled(true);
      return true;
    } catch (e) {
      toast.error('Failed to access camera/microphone. Please grant permissions.');
      return false;
    }
  }, []);

  // Fullscreen
  const enterFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } catch (e) {
      toast.error('Failed to enter fullscreen');
    }
  }, []);

  // Face detection handler
  const handleNoFace = useCallback(() => {
    noFaceCountRef.current += 1;
    const count = noFaceCountRef.current;
    console.warn(`[FaceDetection] No face detected (${count}/${MAX_NO_FACE_VIOLATIONS})`);

    if (count >= MAX_NO_FACE_VIOLATIONS) {
      setIsTerminated(true);
      setWarningMessage('Interview terminated: face not visible 3 times.');
      setShowWarning(true);
      if (interviewData) {
        aiInterviewApi.proctoring(interviewData.session_id, {
          event_type: 'face_not_detected',
          timestamp: new Date().toISOString(),
          details: { violation_count: count, auto_terminated: true },
        }).catch(() => {});
      }
    } else {
      toast.error(
        `Face not visible! Warning ${count}/${MAX_NO_FACE_VIOLATIONS}. Your interview will be terminated if this happens again.`,
        { duration: 5000 },
      );
      setWarningCount((prev) => Math.max(prev, count));
      if (interviewData) {
        aiInterviewApi.proctoring(interviewData.session_id, {
          event_type: 'face_not_detected',
          timestamp: new Date().toISOString(),
          details: { violation_count: count },
        }).catch(() => {});
      }
    }
  }, [interviewData]);

  // Face detection hook
  const { ready: faceDetectorReady, faceVisible } = useFaceDetection(videoRef, {
    intervalMs: 2000,
    onNoFace: handleNoFace,
    enabled: cameraEnabled && !isTerminated && !isCompleted && !showReadyScreen,
  });

  // Report proctoring event
  const reportProctoringEvent = useCallback(async (eventType: string, details?: object) => {
    if (!interviewData) return;

    try {
      const data = await aiInterviewApi.proctoring(interviewData.session_id, {
        event_type: eventType,
        timestamp: new Date().toISOString(),
        details,
      });

      if (data.terminated) {
        setIsTerminated(true);
      } else if (data.warning) {
        setWarningCount(data.violations);
        if (typeof data.threshold === 'number') {
          setViolationThreshold(data.threshold);
        }
        const threshold = (typeof data.threshold === 'number') ? data.threshold : violationThreshold;
        const remaining = Math.max(0, threshold - data.violations);
        setWarningMessage(`Proctoring warning: ${eventType.replace(/_/g, ' ')}. ${remaining} warnings remaining.`);
        setShowWarning(true);
      }
    } catch (e) {
      console.error('Failed to report proctoring event:', e);
    }
  }, [interviewData, violationThreshold]);

  // STRICT PROCTORING: Fullscreen exit = immediate termination
  const handleFullscreenChange = useCallback(() => {
    const isFs = !!document.fullscreenElement;
    setIsFullscreen(isFs);
    if (!isFs && !showReadyScreen && !isTerminated && !isCompleted) {
      // Immediate termination for fullscreen exit
      setIsTerminated(true);
      setWarningMessage('Interview terminated: You exited fullscreen mode. This is a strict proctoring violation.');
      setShowWarning(true);
      reportProctoringEvent('fullscreen_exit');
    }
  }, [showReadyScreen, isTerminated, isCompleted, reportProctoringEvent]);

  // STRICT PROCTORING: Tab switch = immediate termination
  const handleVisibilityChange = useCallback(() => {
    if (document.hidden && !isTerminated && !isCompleted && !showReadyScreen) {
      setIsTerminated(true);
      setWarningMessage('Interview terminated: You switched tabs or minimized the window. This is a strict proctoring violation.');
      setShowWarning(true);
      reportProctoringEvent('tab_switch');
    }
  }, [isTerminated, isCompleted, showReadyScreen, reportProctoringEvent]);

  // STRICT PROCTORING: Window blur = immediate termination
  const handleWindowBlur = useCallback(() => {
    if (!showReadyScreen && !isTerminated && !isCompleted) {
      setIsTerminated(true);
      setWarningMessage('Interview terminated: You clicked outside the interview window. This is a strict proctoring violation.');
      setShowWarning(true);
      reportProctoringEvent('window_blur');
    }
  }, [showReadyScreen, isTerminated, isCompleted, reportProctoringEvent]);

  // Proctoring listeners
  useEffect(() => {
    if (!interviewData || isTerminated || isCompleted || showReadyScreen) return;

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [interviewData, isTerminated, isCompleted, showReadyScreen, handleFullscreenChange, handleVisibilityChange, handleWindowBlur]);

  // Ensure video stream stays attached after transitioning out of setup screen
  useEffect(() => {
    if (showReadyScreen) return;
    if (!videoRef.current) return;
    if (!mediaStreamRef.current) return;

    videoRef.current.srcObject = mediaStreamRef.current;
    videoRef.current.onloadedmetadata = () => {
      const p = videoRef.current?.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          // ignore
        });
      }
    };
  }, [showReadyScreen]);

  // Automatically start recording and countdown whenever a question appears.
  useEffect(() => {
    if (!currentQuestion || !isQuestionReadComplete || showReadyScreen || isTerminated || isCompleted || isAutoAdvancing) return;

    const questionWindowSeconds = DEFAULT_QUESTION_WINDOW_SECONDS;
    setQuestionDurationSeconds(questionWindowSeconds);
    setQuestionTimeLeftSeconds(questionWindowSeconds);

    startRecording();

    if (questionTimerRef.current) {
      clearInterval(questionTimerRef.current);
    }

    questionTimerRef.current = setInterval(() => {
      setQuestionTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          if (questionTimerRef.current) {
            clearInterval(questionTimerRef.current);
            questionTimerRef.current = null;
          }

          setIsAutoAdvancing(true);
          void (async () => {
            const recordedBlob = await stopRecording();
            await advanceAfterTimeout(currentQuestion, questionWindowSeconds, recordedBlob);
            setIsAutoAdvancing(false);
          })();

          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (questionTimerRef.current) {
        clearInterval(questionTimerRef.current);
        questionTimerRef.current = null;
      }
    };
  }, [
    currentQuestion,
    isQuestionReadComplete,
    showReadyScreen,
    isTerminated,
    isCompleted,
    isAutoAdvancing,
    startRecording,
    stopRecording,
    advanceAfterTimeout,
  ]);

  // Load interview data
  useEffect(() => {
    async function loadInterview() {
      if (!token) return;

      const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      try {
        let data: any = null;
        let lastError = 'Failed to load interview';

        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            data = await aiInterviewApi.start(token);
            break;
          } catch (e) {
            lastError = e instanceof Error ? e.message : 'Failed to load interview';
            if (attempt < 3) {
              await delay(500 * attempt);
            }
          }
        }

        if (!data) {
          setError(lastError);
          return;
        }
        // Validate that we have questions
        if (!data.total_questions || data.total_questions === 0) {
          setError('Interview questions are not available. Please contact the hiring team.');
          return;
        }
        setInterviewData(data);
      } catch (e) {
        setError('Failed to load interview. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    loadInterview();
  }, [token]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (questionTimerRef.current) {
        clearInterval(questionTimerRef.current);
      }
      if (mediaRecorderRef.current) {
        try {
          if (mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
        } catch {
          // ignore cleanup errors
        }
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  // Start interview after setup
  const handleStartInterview = async () => {
    await enterFullscreen();
    setShowReadyScreen(false);
    await loadCurrentQuestion();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading interview...</p>
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
            <CardTitle>Interview Unavailable</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Terminated state
  if (isTerminated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Interview Terminated</CardTitle>
            <CardDescription>
              Your interview has been terminated due to multiple proctoring violations.
              Please contact the hiring team for further instructions.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Completed state
  if (isCompleted) {
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
              <CardTitle className="text-2xl">Interview Completed!</CardTitle>
              <CardDescription className="text-base">
                Thank you for completing the AI interview for {interviewData?.job_title}.
                Your responses have been recorded and will be evaluated.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                The hiring team will review your interview and contact you regarding the next steps.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Permission request gate
  if (showPermissionDialog) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-2xl w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Permissions Required</CardTitle>
            <CardDescription className="text-base">
              This interview requires camera and microphone access for proctoring and speech recognition.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                <Video className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold mb-1">Camera Access</h3>
                  <p className="text-sm text-muted-foreground">
                    Required for AI-powered face detection and proctoring to ensure interview integrity.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                <Mic className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold mb-1">Microphone Access</h3>
                  <p className="text-sm text-muted-foreground">
                    Required to record your verbal responses to interview questions using speech recognition.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="text-sm font-medium text-destructive mb-3">
                By clicking "Allow & Continue", you agree to grant these permissions for the duration of the interview.
              </p>
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="headset"
                  checked={headsetConfirmed}
                  onCheckedChange={(checked) => setHeadsetConfirmed(checked === true)}
                />
                <label htmlFor="headset" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-destructive">
                  I confirm that I am using a headset (built-in microphones are STRICTLY NOT ALLOWED).
                </label>
              </div>
            </div>

            <Button className="w-full" size="lg" disabled={!headsetConfirmed} onClick={async () => {
              const cameraOk = await setupCamera();
              if (cameraOk) {
                setShowPermissionDialog(false);
              }
            }}>
              Allow & Continue
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Ready screen gate
  if (showReadyScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-2xl w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Clock3 className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-4xl">Are you ready to go?</CardTitle>
            <CardDescription className="text-base">
              {interviewData?.job_title} · {interviewData?.total_questions} questions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-destructive">⚠️ STRICT PROCTORING - READ CAREFULLY:</h3>
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <XCircle className="h-5 w-5 mt-0.5 text-destructive flex-shrink-0" />
                    <span className="font-medium">Exiting fullscreen = <span className="text-destructive">IMMEDIATE TERMINATION</span></span>
                  </li>
                  <li className="flex items-start gap-3">
                    <XCircle className="h-5 w-5 mt-0.5 text-destructive flex-shrink-0" />
                    <span className="font-medium">Switching tabs = <span className="text-destructive">IMMEDIATE TERMINATION</span></span>
                  </li>
                  <li className="flex items-start gap-3">
                    <XCircle className="h-5 w-5 mt-0.5 text-destructive flex-shrink-0" />
                    <span className="font-medium">Clicking outside window = <span className="text-destructive">IMMEDIATE TERMINATION</span></span>
                  </li>
                  <li className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 mt-0.5 text-warning flex-shrink-0" />
                    <span className="font-medium">Face not visible 3 times = <span className="text-destructive">TERMINATION</span></span>
                  </li>
                </ul>
              </div>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-3">
                  <Camera className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
                  <span>Your camera will be on throughout the interview for AI face detection</span>
                </li>
                <li className="flex items-start gap-3">
                  <Mic className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
                  <span>Recording starts automatically the moment each question appears</span>
                </li>
                <li className="flex items-start gap-3">
                  <Maximize className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
                  <span>Fullscreen mode is <strong>mandatory</strong> throughout the entire interview</span>
                </li>
              </ul>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm font-medium">Interview Details:</p>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                <p>Questions: {interviewData?.total_questions}</p>
                <p>Time per question: 01:00</p>
                <p>Estimated Duration: {interviewData?.estimated_duration_minutes} minutes</p>
              </div>
            </div>

            <Button className="w-full" size="lg" onClick={handleStartInterview}>
              Yes, I'm ready
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Interview in progress
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

      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold">AI Interview</span>
            <Badge variant="outline">{interviewData?.job_title}</Badge>
          </div>

          <div className="flex items-center gap-4">
            {warningCount > 0 && (
              <Badge variant="destructive">
                <AlertTriangle className="mr-1 h-3 w-3" />
                {warningCount}/{violationThreshold} Violations
              </Badge>
            )}

            <Badge variant={cameraEnabled ? 'default' : 'destructive'}>
              {cameraEnabled ? <Video className="h-3 w-3" /> : <VideoOff className="h-3 w-3" />}
            </Badge>

            <Badge variant={micEnabled ? 'default' : 'destructive'}>
              <Mic className="h-3 w-3" />
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Question {(currentQuestion?.index || 0) + 1} of {interviewData?.total_questions}</span>
              <Badge variant="outline">{currentQuestion?.question_type}</Badge>
            </div>
            <Progress
              value={((currentQuestion?.index || 0) + 1) / (interviewData?.total_questions || 1) * 100}
              className="h-2"
            />
          </div>

          <Card className="min-h-[56vh]">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-2xl">Current Question</CardTitle>
                <div className="flex items-center gap-3 rounded-full border border-primary/20 bg-gradient-to-r from-primary/10 via-amber-100/40 to-destructive/10 px-4 py-2 shadow-sm">
                  <Clock3 className="h-4 w-4 text-primary" />
                  <span className="text-lg font-semibold tabular-nums tracking-wider">{formatTime(questionTimeLeftSeconds)}</span>
                </div>
              </div>
              <Progress
                value={(questionTimeLeftSeconds / Math.max(questionDurationSeconds, 1)) * 100}
                className="h-2 [&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:via-amber-500 [&>div]:to-red-500"
              />
              <CardDescription>
                Timer starts after the question is read aloud. Click Next when done, or it auto-advances at 00:00.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-full flex flex-col justify-center gap-6">
              <p className="text-2xl md:text-3xl leading-relaxed font-medium">
                {currentQuestion?.question_text}
              </p>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Badge variant={isRecording ? 'destructive' : 'secondary'}>
                  {isRecording
                    ? 'Recording automatically'
                    : isAutoAdvancing
                      ? 'Saving response'
                      : isSpeaking
                        ? 'Reading question'
                        : 'Preparing'}
                </Badge>
                {isSpeaking && <Badge variant="secondary">Reading question aloud</Badge>}
                {isAutoAdvancing && <Badge variant="outline">Moving to next question...</Badge>}
              </div>

              <div>
                <Button onClick={handleNextQuestion} disabled={isAutoAdvancing || !isQuestionReadComplete || !isRecording}>
                  {currentQuestion && currentQuestion.index >= (interviewData?.total_questions || 1) - 1 ? 'Submit' : 'Next'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Proctoring Camera</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative aspect-video max-w-sm bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
                {!cameraEnabled && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted">
                    <VideoOff className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  {!cameraEnabled ? (
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
                {noFaceCountRef.current > 0 && (
                  <div className="absolute bottom-2 left-2">
                    <Badge variant="destructive" className="text-xs">
                      <EyeOff className="mr-1 h-3 w-3" />
                      Face {noFaceCountRef.current}/{MAX_NO_FACE_VIOLATIONS}
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
