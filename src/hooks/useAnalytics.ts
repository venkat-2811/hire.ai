import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api';

export function useDashboardStats() {
  return useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: () => analyticsApi.getDashboard(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useCandidateAnalytics(params?: { job_id?: string; status?: string; recommendation?: string }) {
  return useQuery({
    queryKey: ['analytics', 'candidates', params],
    queryFn: () => analyticsApi.getCandidates(params),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });
}

export function useJobAnalytics(jobId: string) {
  return useQuery({
    queryKey: ['analytics', 'job', jobId],
    queryFn: () => analyticsApi.getJobSummary(jobId),
    enabled: !!jobId,
  });
}

export function useHiringTrends(days: number = 30) {
  return useQuery({
    queryKey: ['analytics', 'trends', days],
    queryFn: () => analyticsApi.getTrends(days),
  });
}
