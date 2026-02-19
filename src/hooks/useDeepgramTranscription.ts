/**
 * Custom hook for real-time speech-to-text transcription using Deepgram.
 * Connects to Deepgram's WebSocket API for live transcription while speaking.
 */
import { useRef, useCallback, useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface UseDeepgramTranscriptionOptions {
  /** Called when interim (partial) transcript is received */
  onInterimTranscript?: (text: string) => void;
  /** Called when final transcript is received */
  onFinalTranscript?: (text: string) => void;
  /** Called when an error occurs */
  onError?: (error: string) => void;
  /** Language code (default: en) */
  language?: string;
}

interface DeepgramTranscriptionState {
  isConnected: boolean;
  isListening: boolean;
  interimTranscript: string;
  finalTranscript: string;
  error: string | null;
}

export function useDeepgramTranscription(options: UseDeepgramTranscriptionOptions = {}) {
  const {
    onInterimTranscript,
    onFinalTranscript,
    onError,
    language = 'en',
  } = options;

  const [state, setState] = useState<DeepgramTranscriptionState>({
    isConnected: false,
    isListening: false,
    interimTranscript: '',
    finalTranscript: '',
    error: null,
  });

  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fullTranscriptRef = useRef<string>('');

  // Stable callback refs
  const onInterimRef = useRef(onInterimTranscript);
  onInterimRef.current = onInterimTranscript;
  const onFinalRef = useRef(onFinalTranscript);
  onFinalRef.current = onFinalTranscript;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const cleanup = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isConnected: false,
      isListening: false,
    }));
  }, []);

  const startListening = useCallback(async () => {
    try {
      // Reset state
      setState(prev => ({
        ...prev,
        error: null,
        interimTranscript: '',
        finalTranscript: '',
      }));
      fullTranscriptRef.current = '';

      // Get Deepgram token from backend
      const tokenResponse = await fetch(`${API_BASE_URL}/ai-interview/deepgram/token`);
      if (!tokenResponse.ok) {
        const error = await tokenResponse.json();
        throw new Error(error.detail || 'Failed to get Deepgram token');
      }
      const { token } = await tokenResponse.json();

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      // Connect to Deepgram WebSocket
      const wsUrl = `wss://api.deepgram.com/v1/listen?model=nova-3&language=${language}&smart_format=true&interim_results=true&utterance_end_ms=1000&vad_events=true&encoding=linear16&sample_rate=16000`;
      
      const socket = new WebSocket(wsUrl, ['token', token]);
      socketRef.current = socket;

      socket.onopen = () => {
        setState(prev => ({ ...prev, isConnected: true, isListening: true }));
        
        // Start MediaRecorder to capture audio
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus',
        });
        mediaRecorderRef.current = mediaRecorder;

        // Use AudioContext to get raw PCM data for Deepgram
        const audioContext = new AudioContext({ sampleRate: 16000 });
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);

        source.connect(processor);
        processor.connect(audioContext.destination);

        processor.onaudioprocess = (e) => {
          if (socket.readyState === WebSocket.OPEN) {
            const inputData = e.inputBuffer.getChannelData(0);
            // Convert float32 to int16
            const int16Data = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              const s = Math.max(-1, Math.min(1, inputData[i]));
              int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            socket.send(int16Data.buffer);
          }
        };

        mediaRecorder.start(250);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'Results') {
            const transcript = data.channel?.alternatives?.[0]?.transcript || '';
            const isFinal = data.is_final;

            if (transcript) {
              if (isFinal) {
                // Append to full transcript
                fullTranscriptRef.current += (fullTranscriptRef.current ? ' ' : '') + transcript;
                setState(prev => ({
                  ...prev,
                  finalTranscript: fullTranscriptRef.current,
                  interimTranscript: '',
                }));
                onFinalRef.current?.(fullTranscriptRef.current);
              } else {
                // Update interim transcript
                setState(prev => ({
                  ...prev,
                  interimTranscript: transcript,
                }));
                onInterimRef.current?.(transcript);
              }
            }
          }
        } catch (e) {
          console.error('Error parsing Deepgram message:', e);
        }
      };

      socket.onerror = (error) => {
        console.error('Deepgram WebSocket error:', error);
        const errorMsg = 'Connection error with speech recognition';
        setState(prev => ({ ...prev, error: errorMsg }));
        onErrorRef.current?.(errorMsg);
        cleanup();
      };

      socket.onclose = () => {
        setState(prev => ({ ...prev, isConnected: false, isListening: false }));
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to start transcription';
      setState(prev => ({ ...prev, error: errorMsg }));
      onErrorRef.current?.(errorMsg);
      cleanup();
    }
  }, [language, cleanup]);

  const stopListening = useCallback(() => {
    // Send close message to Deepgram
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'CloseStream' }));
    }
    cleanup();
    
    // Return the final transcript
    return fullTranscriptRef.current;
  }, [cleanup]);

  const resetTranscript = useCallback(() => {
    fullTranscriptRef.current = '';
    setState(prev => ({
      ...prev,
      interimTranscript: '',
      finalTranscript: '',
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    ...state,
    startListening,
    stopListening,
    resetTranscript,
    getFullTranscript: () => fullTranscriptRef.current,
  };
}
