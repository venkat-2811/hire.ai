/**
 * AI Interview Page with speech recognition/synthesis and camera proctoring.
 * The AI asks questions via text-to-speech, candidate responds verbally.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  MicOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  Play,
  Square,
  SkipForward,
  Camera,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useFaceDetection } from '@/hooks/useFaceDetection';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const API_BASE_URL = '/api';

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
  const [transcript, setTranscript] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [hasRecordedAudio, setHasRecordedAudio] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [speechAvailable, setSpeechAvailable] = useState(true);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);

  // Proctoring state
  const [showSetupScreen, setShowSetupScreen] = useState(true);
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
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingWantedRef = useRef(false);
  const isRecordingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const recordedAudioBlobRef = useRef<Blob | null>(null);

  // Speech synthesis - speak the question
  const speakQuestion = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      synthRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const transcribeLatestRecording = useCallback(async () => {
    if (!interviewData) return null;
    const blobFromStop = recordedAudioBlobRef.current;
    const blobFromChunks = recordedChunksRef.current.length
      ? new Blob(recordedChunksRef.current, { type: 'audio/webm' })
      : null;
    const blob = (blobFromStop && blobFromStop.size > 0) ? blobFromStop : blobFromChunks;
    if (!blob || blob.size === 0) return null;

    setIsTranscribing(true);
    try {
      // Convert blob to base64 for Vercel serverless compatibility
      const arrayBuffer = await blob.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8.byteLength; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      const audio_base64 = btoa(binary);

      const resp = await fetch(`${API_BASE_URL}/ai-interview/${interviewData.session_id}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_base64,
          mime_type: blob.type || 'audio/webm',
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error || data?.detail || 'Failed to transcribe audio');
      }
      const text = (data?.transcript || '').toString();
      return text;
    } catch (e) {
      console.error('Transcription failed', e);
      const msg = e instanceof Error ? e.message : 'Failed to transcribe audio';
      toast.error(msg);
      return null;
    } finally {
      setIsTranscribing(false);
    }
  }, [interviewData]);

  const stopRecording = useCallback(async () => {
    recordingWantedRef.current = false;
    isRecordingRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current) {
      try {
        try {
          mediaRecorderRef.current.requestData();
        } catch {
          // ignore
        }
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {
        // ignore
      }
      mediaRecorderRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);

    // Auto-transcribe after stopping
    if (!manualMode && interviewData) {
      const transcribed = await transcribeLatestRecording();
      if (transcribed && transcribed.trim()) {
        setTranscript(transcribed.trim());
      } else {
        // fallback to live browser transcript if AssemblyAI is unavailable
        const fallback = (liveTranscript || '').trim();
        if (fallback) setTranscript(fallback);
      }
    }
  }, [manualMode, interviewData, transcribeLatestRecording, liveTranscript]);

  const startLiveTranscription = useCallback(() => {
    if (!(('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window))) {
      setSpeechAvailable(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let text = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      setLiveTranscript(text.trim());
    };

    recognition.onerror = () => {
      setSpeechAvailable(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setSpeechAvailable(true);
    } catch {
      setSpeechAvailable(false);
    }
  }, []);

  // Speech recognition - listen to candidate
  const startRecording = useCallback(() => {
    if (!micEnabled) {
      toast.error('Microphone is not enabled. Please allow microphone access.');
      setManualMode(true);
      return;
    }

    if (!mediaStreamRef.current) {
      toast.error('Microphone stream is not ready. Please re-enable permissions.');
      setManualMode(true);
      return;
    }

    const stream = mediaStreamRef.current;
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks || audioTracks.length === 0) {
      toast.error('No microphone track available. Please check your device settings.');
      setManualMode(true);
      return;
    }

    recordedChunksRef.current = [];
    recordedAudioBlobRef.current = null;
    setHasRecordedAudio(false);
    setLiveTranscript('');

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
          setHasRecordedAudio(true);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType || 'audio/webm' });
        recordedAudioBlobRef.current = blob;
        if (blob.size > 0) setHasRecordedAudio(true);
      };
      recorder.start(250);
      mediaRecorderRef.current = recorder;
    } catch {
      toast.error('Unable to start audio recording. You can type your answer instead.');
      setManualMode(true);
      return;
    }

    startLiveTranscription();

    recordingWantedRef.current = true;
    isRecordingRef.current = true;
    setSpeechAvailable(true);
    setSpeechError(null);
    setManualMode(false);
    setTranscript('');
    setRecordingTime(0);
    setIsRecording(true);

    // Start timer
    recordingTimerRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
  }, [micEnabled, stopRecording]);

  // Load current question
  const loadCurrentQuestion = useCallback(async () => {
    if (!interviewData) return;

    try {
      const response = await fetch(`${API_BASE_URL}/ai-interview/${interviewData.session_id}/question`);
      const data = await response.json();

      if (data.completed) {
        setIsCompleted(true);
        return;
      }

      setCurrentQuestion(data);
      setTranscript('');
      setRecordingTime(0);

      // Speak the question after a short delay
      setTimeout(() => {
        speakQuestion(data.question_text);
      }, 1000);
    } catch (e) {
      toast.error('Failed to load question');
    }
  }, [interviewData, speakQuestion]);

  // Submit response
  const submitResponse = useCallback(async () => {
    if (!interviewData || !currentQuestion) {
      toast.error('Interview session not ready');
      return;
    }

    if (isRecording) {
      toast.error('Stop recording before submitting');
      return;
    }

    const finalTranscript = transcript.trim();

    if (!finalTranscript) {
      toast.error('Please provide a response before submitting');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/ai-interview/${interviewData.session_id}/response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_index: currentQuestion.index,
          transcript: finalTranscript,
          audio_duration_seconds: recordingTime,
          confidence: 0.9,
        }),
      });

      const data = await response.json();

      if (data.is_last_question) {
        // Complete the interview
        const completeResp = await fetch(`${API_BASE_URL}/ai-interview/${interviewData.session_id}/complete`, {
          method: 'POST',
        });
        if (completeResp.ok) {
          const evalData = await completeResp.json();
          setFinalEvaluation(evalData);
        }
        setIsCompleted(true);
      } else {
        // Load next question
        await loadCurrentQuestion();
      }
    } catch (e) {
      toast.error('Failed to submit response');
    }
  }, [interviewData, currentQuestion, transcript, recordingTime, isRecording, loadCurrentQuestion]);

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
        fetch(`${API_BASE_URL}/ai-interview/${interviewData.session_id}/proctoring`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_type: 'face_not_detected',
            timestamp: new Date().toISOString(),
            details: { violation_count: count, auto_terminated: true },
          }),
        }).catch(() => {});
      }
    } else {
      toast.error(
        `Face not visible! Warning ${count}/${MAX_NO_FACE_VIOLATIONS}. Your interview will be terminated if this happens again.`,
        { duration: 5000 },
      );
      setWarningCount((prev) => Math.max(prev, count));
      if (interviewData) {
        fetch(`${API_BASE_URL}/ai-interview/${interviewData.session_id}/proctoring`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_type: 'face_not_detected',
            timestamp: new Date().toISOString(),
            details: { violation_count: count },
          }),
        }).catch(() => {});
      }
    }
  }, [interviewData]);

  // Face detection hook
  const { ready: faceDetectorReady, faceVisible } = useFaceDetection(videoRef, {
    intervalMs: 2000,
    onNoFace: handleNoFace,
    enabled: cameraEnabled && !isTerminated && !isCompleted && !showSetupScreen,
  });

  // Report proctoring event
  const reportProctoringEvent = useCallback(async (eventType: string, details?: object) => {
    if (!interviewData) return;

    try {
      const response = await fetch(`${API_BASE_URL}/ai-interview/${interviewData.session_id}/proctoring`, {
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
    if (!isFs && !showSetupScreen && !isTerminated && !isCompleted) {
      // Immediate termination for fullscreen exit
      setIsTerminated(true);
      setWarningMessage('Interview terminated: You exited fullscreen mode. This is a strict proctoring violation.');
      setShowWarning(true);
      reportProctoringEvent('fullscreen_exit');
    }
  }, [showSetupScreen, isTerminated, isCompleted, reportProctoringEvent]);

  // STRICT PROCTORING: Tab switch = immediate termination
  const handleVisibilityChange = useCallback(() => {
    if (document.hidden && !isTerminated && !isCompleted && !showSetupScreen) {
      setIsTerminated(true);
      setWarningMessage('Interview terminated: You switched tabs or minimized the window. This is a strict proctoring violation.');
      setShowWarning(true);
      reportProctoringEvent('tab_switch');
    }
  }, [isTerminated, isCompleted, showSetupScreen, reportProctoringEvent]);

  // STRICT PROCTORING: Window blur = immediate termination
  const handleWindowBlur = useCallback(() => {
    if (!showSetupScreen && !isTerminated && !isCompleted) {
      setIsTerminated(true);
      setWarningMessage('Interview terminated: You clicked outside the interview window. This is a strict proctoring violation.');
      setShowWarning(true);
      reportProctoringEvent('window_blur');
    }
  }, [showSetupScreen, isTerminated, isCompleted, reportProctoringEvent]);

  // Proctoring listeners
  useEffect(() => {
    if (!interviewData || isTerminated || isCompleted || showSetupScreen) return;

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [interviewData, isTerminated, isCompleted, showSetupScreen, handleFullscreenChange, reportProctoringEvent]);

  // Ensure video stream stays attached after transitioning out of setup screen
  useEffect(() => {
    if (showSetupScreen) return;
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
  }, [showSetupScreen]);

  // Load interview data
  useEffect(() => {
    async function loadInterview() {
      if (!token) return;

      try {
        const response = await fetch(`${API_BASE_URL}/ai-interview/start/${token}`);
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          setError(error.error || error.detail || 'Failed to load interview');
          return;
        }
        const data = await response.json();
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
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  // Start interview after setup
  const handleStartInterview = async () => {
    const cameraOk = await setupCamera();
    if (!cameraOk) return;

    await enterFullscreen();
    setShowSetupScreen(false);
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
              <Button onClick={() => navigate('/')}>Return Home</Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Setup screen
  if (showSetupScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Video className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">AI Interview</CardTitle>
            <CardDescription className="text-base">
              {interviewData?.job_title}
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
                  <span>The AI will ask questions via speech - respond verbally</span>
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
                <p>Estimated Duration: {interviewData?.estimated_duration_minutes} minutes</p>
              </div>
            </div>

            <Button className="w-full" size="lg" onClick={handleStartInterview}>
              <Video className="mr-2 h-4 w-4" />
              Enable Camera & Start Interview
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
              {micEnabled ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Video Feed */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Your Camera</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
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
                  {/* Face detection status overlay */}
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
                  {/* Face violation counter */}
                  {noFaceCountRef.current > 0 && (
                    <div className="absolute bottom-2 left-2">
                      <Badge variant="destructive" className="text-xs">
                        <EyeOff className="mr-1 h-3 w-3" />
                        Face {noFaceCountRef.current}/{MAX_NO_FACE_VIOLATIONS}
                      </Badge>
                    </div>
                  )}
                  {isRecording && (
                    <div className="absolute top-2 right-2 flex items-center gap-2 bg-destructive text-destructive-foreground px-2 py-1 rounded text-xs">
                      <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      REC {formatTime(recordingTime)}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Question & Response */}
          <div className="lg:col-span-2 space-y-6">
            {/* Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Question {(currentQuestion?.index || 0) + 1} of {interviewData?.total_questions}</span>
                <Badge variant="outline">{currentQuestion?.question_type}</Badge>
              </div>
              <Progress
                value={((currentQuestion?.index || 0) + 1) / (interviewData?.total_questions || 1) * 100}
                className="h-2"
              />
            </div>

            {/* Question Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Current Question</CardTitle>
                  {isSpeaking && (
                    <Badge variant="secondary" className="animate-pulse">
                      <Volume2 className="mr-1 h-3 w-3" />
                      Speaking...
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-lg">{currentQuestion?.question_text}</p>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => speakQuestion(currentQuestion?.question_text || '')}
                    disabled={isSpeaking}
                  >
                    <Volume2 className="mr-2 h-4 w-4" />
                    Repeat Question
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Response Area */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Response</CardTitle>
                <CardDescription>
                  Click "Start Recording" and speak your answer clearly
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Transcript Display */}
                <div className="min-h-[120px] p-4 bg-muted/50 rounded-lg">
                  {manualMode ? (
                    <Textarea
                      value={transcript}
                      onChange={(e) => setTranscript(e.target.value)}
                      placeholder={speechError || 'Type your response here...'}
                      className="min-h-[120px]"
                    />
                  ) : isRecording && liveTranscript ? (
                    <p className="text-sm">{liveTranscript}</p>
                  ) : isTranscribing ? (
                    <p className="text-sm text-muted-foreground italic">Transcribing audio...</p>
                  ) : transcript ? (
                    <p className="text-sm">{transcript}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Record your answer, then submit to generate a transcript.
                    </p>
                  )}
                </div>

                {/* Recording Controls */}
                <div className="flex items-center justify-center gap-4">
                  {isRecording ? (
                    <Button size="lg" variant="destructive" onClick={stopRecording} className="gap-2">
                      <Square className="h-5 w-5" />
                      Stop Recording
                    </Button>
                  ) : !transcript.trim() ? (
                    <Button size="lg" onClick={startRecording} className="gap-2" disabled={isTranscribing}>
                      <Mic className="h-5 w-5" />
                      Start Recording
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      onClick={submitResponse}
                      disabled={isTranscribing || !transcript.trim()}
                      className="gap-2"
                    >
                      <SkipForward className="h-5 w-5" />
                      Next
                    </Button>
                  )}
                </div>

                {isRecording && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
                    Recording: {formatTime(recordingTime)}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

// TypeScript declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event & { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new(): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}
