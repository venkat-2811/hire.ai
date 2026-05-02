import { useState, useEffect, useRef } from 'react';
import { useAuth } from './useAuth';

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface JobState<T = any> {
  id: string;
  type: string;
  status: JobStatus;
  progress?: number;
  result?: T;
  error?: string;
  created_at: string;
}

interface UseJobPollingOptions<T> {
  onComplete?: (result: T) => void;
  onError?: (error: string) => void;
  pollingInterval?: number; // ms
  maxRetries?: number;
}

export function useJobPolling<T = any>(jobId: string | null, options?: UseJobPollingOptions<T>) {
  const [job, setJob] = useState<JobState<T> | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const { getToken } = useAuth();
  
  const pollingInterval = options?.pollingInterval || 3000;
  const maxRetries = options?.maxRetries || 100; // ~5 mins at 3s interval
  const retryCount = useRef(0);
  const timerRef = useRef<number | null>(null);
  const queuedSinceRef = useRef<number | null>(null);
  const lastStatusRef = useRef<JobStatus | null>(null);

  const fetchJobStatus = async () => {
    if (!jobId) return;

    try {
      const token = await getToken();
      const res = await fetch(`/api/job-status/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!res.ok) throw new Error('Failed to fetch job status');
      
      const data: JobState<T> = await res.json();
      setJob(data);
      console.log(`[useJobPolling] Job ${jobId} status: ${data.status}`);

      if (lastStatusRef.current !== data.status) {
        lastStatusRef.current = data.status;
        if (data.status !== 'queued') queuedSinceRef.current = null;
      }

      if (data.status === 'queued' && queuedSinceRef.current === null) {
        queuedSinceRef.current = Date.now();
      }

      if (data.status === 'completed') {
        setIsPolling(false);
        options?.onComplete?.(data.result as T);
      } else if (data.status === 'failed') {
        setIsPolling(false);
        options?.onError?.(data.error || 'Job failed during execution');
      } else {
        // still queued/processing
        retryCount.current += 1;
        
        // Timeout early if it's stuck in "queued" state and never picked up by worker
        const queuedForMs = queuedSinceRef.current ? Date.now() - queuedSinceRef.current : 0;
        const isQueuedAndStuck = data.status === 'queued' && queuedForMs >= 120000;
        
        if (isQueuedAndStuck) {
          console.error(`[useJobPolling] Job ${jobId} timed out while queued. Worker failed to start.`);
          setIsPolling(false);
          options?.onError?.('Background worker failed to start processing (Timeout)');
        } else if (retryCount.current >= maxRetries) {
          console.error(`[useJobPolling] Job ${jobId} exceeded max retries while processing.`);
          setIsPolling(false);
          options?.onError?.('Job processing timeout exceeded');
        } else {
          timerRef.current = window.setTimeout(fetchJobStatus, pollingInterval);
        }
      }
    } catch (err: any) {
      console.error('[useJobPolling] Fetch error:', err);
      retryCount.current += 1;
      if (retryCount.current >= maxRetries) {
        setIsPolling(false);
        options?.onError?.('Network error: Polling timeout exceeded');
      } else {
        timerRef.current = window.setTimeout(fetchJobStatus, pollingInterval);
      }
    }
  };

  useEffect(() => {
    if (jobId) {
      setIsPolling(true);
      retryCount.current = 0;
      queuedSinceRef.current = null;
      lastStatusRef.current = null;
      fetchJobStatus();
    } else {
      setIsPolling(false);
      setJob(null);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [jobId]);

  return { job, isPolling };
}
