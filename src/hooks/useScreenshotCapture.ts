/**
 * useScreenshotCapture
 *
 * Manages screen-sharing permission, periodic screenshot capture,
 * and upload to Supabase Storage.
 *
 * Strategy:
 * - ONE file per session stored at: session-screenshots/{type}/{sessionId}/latest.jpg
 * - Every new capture overwrites the previous — no history kept.
 * - Captures: initial (on start) + every 5 minutes + final (before completion).
 * - If screen-share is denied, the session continues normally — no errors thrown.
 */

import { useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ScreenshotPermission = 'idle' | 'granted' | 'denied';
export type SessionType = 'assessment' | 'ai_interview';

const SCREENSHOT_BUCKET = 'session-screenshots';
const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const JPEG_QUALITY = 0.65;

export function useScreenshotCapture() {
  const screenStreamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const sessionTypeRef = useRef<SessionType | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [permission, setPermission] = useState<ScreenshotPermission>('idle');

  // Request screen-sharing permission from the candidate
  const requestScreenShare = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { 
          width: 1280, 
          height: 720, 
          frameRate: 1,
          displaySurface: "monitor"
        },
        audio: false,
      });

      // Strict check for entire screen (monitor)
      const track = stream.getVideoTracks()[0];
      const settings = track?.getSettings();
      if (settings && settings.displaySurface && settings.displaySurface !== "monitor") {
        stream.getTracks().forEach((t: any) => t.stop());
        alert("Proctoring requires you to share your ENTIRE SCREEN, not just a window or tab. Please try again.");
        setPermission('denied');
        return false;
      }

      screenStreamRef.current = stream;

      // If user stops sharing via browser UI, mark as denied
      track?.addEventListener('ended', () => {
        screenStreamRef.current = null;
        setPermission('denied');
      });

      setPermission('granted');
      return true;
    } catch {
      // User denied or browser doesn't support it — fail silently
      setPermission('denied');
      return false;
    }
  }, []);

  // Capture a single frame and upload to Supabase Storage
  const captureAndUpload = useCallback(async (sessionId: string, type: SessionType) => {
    const stream = screenStreamRef.current;
    if (!stream || !stream.active) return;

    const track = stream.getVideoTracks()[0];
    if (!track || track.readyState !== 'live') return;

    try {
      // Create ImageCapture to grab a frame from the screen stream
      const ImageCaptureAPI = (window as any).ImageCapture;
      if (!ImageCaptureAPI) {
        // Fallback: draw onto canvas via a video element
        await captureViaVideoElement(sessionId, type, stream);
        return;
      }

      const imageCapture = new ImageCaptureAPI(track);
      const bitmap = await imageCapture.grabFrame();

      // Get or create canvas
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      const canvas = canvasRef.current;
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();

      await uploadCanvas(canvas, sessionId, type);
    } catch (err) {
      console.warn('[Screenshot] Capture failed, trying fallback:', err);
      try {
        await captureViaVideoElement(sessionId, type, stream);
      } catch (fallbackErr) {
        console.warn('[Screenshot] Fallback also failed:', fallbackErr);
      }
    }
  }, []);

  // Fallback: render stream to a <video>, then draw to canvas
  const captureViaVideoElement = useCallback(async (
    sessionId: string,
    type: SessionType,
    stream: MediaStream,
  ) => {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();

    await new Promise<void>((resolve) => {
      video.onloadeddata = () => resolve();
      setTimeout(resolve, 1500); // Safety timeout
    });

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    video.pause();
    video.srcObject = null;

    await uploadCanvas(canvas, sessionId, type);
  }, []);

  const uploadCanvas = useCallback(async (
    canvas: HTMLCanvasElement,
    sessionId: string,
    type: SessionType,
  ) => {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    );
    if (!blob) return;

    const formData = new FormData();
    formData.append('file', blob, 'latest.jpg');

    const endpoint = type === 'assessment' 
      ? `/api/v2/assessments/${sessionId}/screenshot`
      : `/api/v2/ai-interview/${sessionId}/screenshot`;

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}${endpoint}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        console.warn('[Screenshot] Upload failed with status:', response.status);
      } else {
        console.log(`[Screenshot] Uploaded at ${new Date().toISOString()}`);
      }
    } catch (err: any) {
      console.warn('[Screenshot] Upload failed:', err.message);
    }
  }, []);

  // Start periodic captures (initial + every 5 min)
  const startPeriodicCapture = useCallback((sessionId: string, type: SessionType) => {
    sessionIdRef.current = sessionId;
    sessionTypeRef.current = type;

    // Stop any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Capture immediately on start
    void captureAndUpload(sessionId, type);

    // Then every 5 minutes
    intervalRef.current = setInterval(() => {
      void captureAndUpload(sessionId, type);
    }, INTERVAL_MS);
  }, [captureAndUpload]);

  // Capture a final screenshot then stop everything
  const captureFinalAndStop = useCallback(async () => {
    // Stop interval first so no new captures fire
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const sessionId = sessionIdRef.current;
    const type = sessionTypeRef.current;

    if (sessionId && type) {
      // Final screenshot before completion
      await captureAndUpload(sessionId, type);
    }

    // Stop the screen-share stream
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    canvasRef.current = null;
    sessionIdRef.current = null;
    sessionTypeRef.current = null;
  }, [captureAndUpload]);

  // Stop without a final capture (e.g., on termination)
  const stopCapture = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    canvasRef.current = null;
    sessionIdRef.current = null;
    sessionTypeRef.current = null;
  }, []);

  return {
    permission,
    requestScreenShare,
    startPeriodicCapture,
    captureFinalAndStop,
    stopCapture,
  };
}
