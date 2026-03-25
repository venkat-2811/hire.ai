import { useQuery } from '@tanstack/react-query';
import { usageApi, type UsageInfo } from '@/lib/api';
import { useAuth } from '@clerk/clerk-react';

export function useUsage() {
  const { isLoaded, isSignedIn } = useAuth();

  return useQuery<UsageInfo>({
    queryKey: ['usage'],
    queryFn: () => usageApi.get(),
    enabled: isLoaded && isSignedIn,
    staleTime: 60 * 1000, // 1 minute
  });
}
