import { useState, useEffect, useRef } from 'react';
import { useAuth } from './useAuth';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

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

      if (data.status === 'completed') {
        setIsPolling(false);
        options?.onComplete?.(data.result as T);
      } else if (data.status === 'failed') {
        setIsPolling(false);
        options?.onError?.(data.error || 'Job failed');
      } else {
        // still pending/processing
        retryCount.current += 1;
        if (retryCount.current >= maxRetries) {
          setIsPolling(false);
          options?.onError?.('Polling timeout exceeded');
        } else {
          timerRef.current = window.setTimeout(fetchJobStatus, pollingInterval);
        }
      }
    } catch (err: any) {
      console.error('Job polling error:', err);
      retryCount.current += 1;
      if (retryCount.current >= maxRetries) {
        setIsPolling(false);
        options?.onError?.('Polling timeout exceeded');
      } else {
        timerRef.current = window.setTimeout(fetchJobStatus, pollingInterval);
      }
    }
  };

  useEffect(() => {
    if (jobId) {
      setIsPolling(true);
      retryCount.current = 0;
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
