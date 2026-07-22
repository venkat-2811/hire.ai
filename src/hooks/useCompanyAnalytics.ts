import { useQuery } from '@tanstack/react-query';
import { companyApi, type ActivityEvent } from '@/lib/api';

export function useActivityFeed(companyId: string | null | undefined, options?: { limit?: number }) {
  return useQuery({
    queryKey: ['company-activity-feed', companyId, options?.limit],
    queryFn: () => companyApi.activityFeed(companyId!, { limit: options?.limit ?? 50 }),
    enabled: !!companyId,
    refetchInterval: 10_000, // Real-time polling every 10 seconds
    staleTime: 5_000,
    retry: false,
    select: (data) => data?.feed ?? [],
  });
}

export function useCompanyAnalytics(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ['company-analytics', companyId],
    queryFn: () => companyApi.analytics(companyId!),
    enabled: !!companyId,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });
}

export type { ActivityEvent };
