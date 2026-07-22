import { useProfile } from '@/hooks/useProfile';

const USA_CA_KEYWORDS = [
  'united states', 'usa', 'us', 'u.s.', 'u.s.a.',
  'canada', 'ca', 'canadian',
];

function isUsaOrCanadaLocation(location: string | null | undefined): boolean {
  if (!location) return false;
  const lower = location.toLowerCase().trim();
  return USA_CA_KEYWORDS.some((kw) => lower === kw || lower.includes(kw));
}

/**
 * Detects whether the recruiter's profile location is in the USA or Canada.
 * Uses the stored profile `country` or `headquarters_location` field.
 * No browser geolocation is used.
 */
export function useRecruiterLocation() {
  const { data: profile, isLoading } = useProfile();

  if (isLoading) {
    return { isUsaOrCanada: false, status: 'loading' as const };
  }

  const locationToCheck = profile?.country || profile?.headquarters_location;
  const isUsaOrCanada = isUsaOrCanadaLocation(locationToCheck);

  return { isUsaOrCanada, status: 'allowed' as const };
}
