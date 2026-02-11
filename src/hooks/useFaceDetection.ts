/**
 * Custom hook for real-time face detection using MediaPipe Tasks Vision.
 * Runs entirely in the browser — no server needed.
 */
import { useRef, useCallback, useEffect, useState } from 'react';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

interface UseFaceDetectionOptions {
  /** How often to run detection (ms). Default 1000. */
  intervalMs?: number;
  /** Called when no face is detected in a frame. */
  onNoFace?: () => void;
  /** Called when a face is detected in a frame. */
  onFaceDetected?: () => void;
  /** Whether detection is active. */
  enabled?: boolean;
}

export function useFaceDetection(
  videoRef: React.RefObject<HTMLVideoElement>,
  options: UseFaceDetectionOptions = {},
) {
  const {
    intervalMs = 1000,
    onNoFace,
    onFaceDetected,
    enabled = true,
  } = options;

  const detectorRef = useRef<FaceDetector | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [ready, setReady] = useState(false);
  const [faceVisible, setFaceVisible] = useState(true);

  // Stable callback refs to avoid re-creating the interval
  const onNoFaceRef = useRef(onNoFace);
  onNoFaceRef.current = onNoFace;
  const onFaceDetectedRef = useRef(onFaceDetected);
  onFaceDetectedRef.current = onFaceDetected;

  // Initialize the detector once
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
        );
        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
            delegate: 'GPU',
          },
          runningMode: 'IMAGE',
          minDetectionConfidence: 0.5,
        });
        if (!cancelled) {
          detectorRef.current = detector;
          setReady(true);
        }
      } catch (err) {
        console.error('[FaceDetection] Failed to initialize:', err);
      }
    }

    init();

    return () => {
      cancelled = true;
      if (detectorRef.current) {
        detectorRef.current.close();
        detectorRef.current = null;
      }
    };
  }, []);

  // Run detection on an interval
  const detect = useCallback(() => {
    const video = videoRef.current;
    const detector = detectorRef.current;
    if (!video || !detector || video.readyState < 2) return;

    try {
      const result = detector.detect(video);
      const hasFace = result.detections.length > 0;
      setFaceVisible(hasFace);

      if (hasFace) {
        onFaceDetectedRef.current?.();
      } else {
        onNoFaceRef.current?.();
      }
    } catch {
      // Detection can fail transiently — ignore
    }
  }, [videoRef]);

  useEffect(() => {
    if (!enabled || !ready) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(detect, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, ready, detect, intervalMs]);

  return { ready, faceVisible };
}
