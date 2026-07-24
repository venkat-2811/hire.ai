import { useQuery } from '@tanstack/react-query';
import { companyApi } from '@/lib/api';

export type CompanyRole = 'owner' | 'recruiter' | null;
export type CompanyMemberStatus = 'active' | 'pending' | 'none';

export function useCompany() {
  const query = useQuery({
    queryKey: ['company-my'],
    queryFn: () => companyApi.my(),
    retry: false,
    staleTime: 15_000,
    refetchInterval: 15_000,
  });

  const data = query.data;
  const company = data?.company ?? null;
  const membership = data?.membership ?? null;
  const status = data?.status ?? 'none';
  const role: CompanyRole = (data?.role as CompanyRole) ?? null;
  const isOwner = role === 'owner';
  const isMember = status === 'active';

  const credits = data?.credits ?? { allocated: 0, consumed: 0, remaining: 0 };
  const companyCredits = data?.company_credits ?? { total_allocated: 0, total_consumed: 0 };

  return {
    company,
    membership,
    role,
    isOwner,
    isMember,
    status,
    credits,
    companyCredits,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
