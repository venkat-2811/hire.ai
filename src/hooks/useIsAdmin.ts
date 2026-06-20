import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

/**
 * Hook that checks whether the current signed-in user has admin role.
 * It calls the admin health endpoint — if it returns 200, user is admin.
 * If it returns 403 (or any error), user is not admin.
 */
export function useIsAdmin() {
  const { isSignedIn } = useAuth();

  const { data: isAdmin, isLoading } = useQuery({
    queryKey: ['admin-role-check'],
    queryFn: async () => {
      try {
        await adminApi.health();
        return true;
      } catch {
        return false;
      }
    },
    enabled: isSignedIn,
    staleTime: 5 * 60 * 1000, // cache for 5 min
    retry: false,
  });

  return { isAdmin: !!isAdmin, isLoading };
}
