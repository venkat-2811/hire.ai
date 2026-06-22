export interface AdminProfileIdentityLike {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  company_name?: string | null;
}

const INTERNAL_ID_PREFIX = 'user_';

const normalize = (value?: string | null): string => (value ?? '').trim();

export const isInternalUserIdLike = (value?: string | null): boolean => {
  const v = normalize(value).toLowerCase();
  return !!v && v.startsWith(INTERNAL_ID_PREFIX);
};

export const getAdminDisplayName = (profile: AdminProfileIdentityLike): string => {
  const full = normalize(profile.full_name);
  if (full && !isInternalUserIdLike(full)) return full;

  const first = normalize(profile.first_name);
  const last = normalize(profile.last_name);
  const combined = `${first} ${last}`.trim();
  if (combined && !isInternalUserIdLike(combined)) return combined;

  return 'Not Provided';
};

export const getAdminDisplayEmail = (email?: string | null): string => {
  const normalized = normalize(email);
  if (!normalized) return 'Not Provided';
  if (normalized.toLowerCase() === 'unknown') return 'Not Provided';
  if (isInternalUserIdLike(normalized)) return 'Not Provided';
  return normalized;
};

export const getAdminDisplayCompany = (companyName?: string | null): string => {
  const normalized = normalize(companyName);
  return normalized || 'Not Provided';
};
