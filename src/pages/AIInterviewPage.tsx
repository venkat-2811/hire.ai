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
} from 'lucide-react';
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

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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

  // Media state
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);

  // Proctoring state
  const [showSetupScreen, setShowSetupScreen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Speech recognition - listen to candidate
  const startRecording = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Speech recognition not supported in this browser');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        }
      }
      if (finalTranscript) {
        setTranscript((prev) => prev + finalTranscript);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'no-speech') {
        toast.error('Speech recognition error. Please try again.');
      }
    };

    recognition.onend = () => {
      if (isRecording) {
        recognition.start(); // Restart if still recording
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setTranscript('');
    setRecordingTime(0);

    // Start timer
    recordingTimerRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
  }, [isRecording]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
  }, []);

  // Submit response
  const submitResponse = useCallback(async () => {
    if (!interviewData || !currentQuestion || !transcript.trim()) {
      toast.error('Please provide a response before submitting');
      return;
    }

    stopRecording();

    try {
      const response = await fetch(`${API_BASE_URL}/ai-interview/${interviewData.session_id}/response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_index: currentQuestion.index,
          transcript: transcript.trim(),
          audio_duration_seconds: recordingTime,
          confidence: 0.9,
        }),
      });

      const data = await response.json();

      if (data.is_last_question) {
        // Complete the interview
        await fetch(`${API_BASE_URL}/ai-interview/${interviewData.session_id}/complete`, {
          method: 'POST',
        });
        setIsCompleted(true);
      } else {
        // Load next question
        await loadCurrentQuestion();
      }
    } catch (e) {
      toast.error('Failed to submit response');
    }
  }, [interviewData, currentQuestion, transcript, recordingTime, stopRecording]);

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
        setWarningMessage(`Proctoring warning: ${eventType.replace(/_/g, ' ')}. ${10 - data.violations} warnings remaining.`);
        setShowWarning(true);
      }
    } catch (e) {
      console.error('Failed to report proctoring event:', e);
    }
  }, [interviewData]);

  // Proctoring listeners
  useEffect(() => {
    if (!interviewData || isTerminated || isCompleted || showSetupScreen) return;

    const handleFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      if (!isFs) {
        reportProctoringEvent('fullscreen_exit');
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        reportProctoringEvent('tab_switch');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [interviewData, isTerminated, isCompleted, showSetupScreen, reportProctoringEvent]);

  // Load interview data
  useEffect(() => {
    async function loadInterview() {
      if (!token) return;

      try {
        const response = await fetch(`${API_BASE_URL}/ai-interview/start/${token}`);
        if (!response.ok) {
          const error = await response.json();
          setError(error.detail || 'Failed to load interview');
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
              <h3 className="font-semibold">Before you begin:</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-3">
                  <Camera className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
                  <span>Your camera will be on throughout the interview for proctoring</span>
                </li>
                <li className="flex items-start gap-3">
                  <Mic className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
                  <span>The AI will ask questions via speech - respond verbally</span>
                </li>
                <li className="flex items-start gap-3">
                  <Maximize className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
                  <span>Fullscreen mode is required throughout</span>
                </li>
                <li className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 mt-0.5 text-warning flex-shrink-0" />
                  <span>Looking away or leaving the screen will be recorded</span>
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
                {warningCount}/10 Warnings
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
                  />
                  {!cameraEnabled && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted">
                      <VideoOff className="h-12 w-12 text-muted-foreground" />
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
                  {transcript ? (
                    <p className="text-sm">{transcript}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Your response will appear here as you speak...
                    </p>
                  )}
                </div>

                {/* Recording Controls */}
                <div className="flex items-center justify-center gap-4">
                  {!isRecording ? (
                    <Button size="lg" onClick={startRecording} className="gap-2">
                      <Mic className="h-5 w-5" />
                      Start Recording
                    </Button>
                  ) : (
                    <Button size="lg" variant="destructive" onClick={stopRecording} className="gap-2">
                      <Square className="h-5 w-5" />
                      Stop Recording
                    </Button>
                  )}
                  
                  <Button
                    size="lg"
                    onClick={submitResponse}
                    disabled={!transcript.trim() || isRecording}
                    className="gap-2"
                  >
                    <SkipForward className="h-5 w-5" />
                    Submit & Next
                  </Button>
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
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}
