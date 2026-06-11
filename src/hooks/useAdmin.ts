/**
 * useAdmin — Admin detection hook for RekShift.
 *
 * Reads admin status from the backend subscription endpoint.
 * The backend is the authoritative source for admin status — this hook
 * is a UI convenience layer only and MUST NOT be used as the sole
 * access control mechanism.
 *
 * Usage:
 *   const { isAdmin, loading } = useAdmin();
 *   if (isAdmin) { // hide paywalls, show unlimited usage }
 */
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { subscriptionApi } from '@/lib/api';

// ---------------------------------------------------------------------------
// Hardcoded admin emails for instant UI-level detection.
// This avoids a loading flash for admins on initial render.
// NOTE: Backend is still authoritative — this is defense-in-depth only.
// ---------------------------------------------------------------------------
const ADMIN_EMAILS_FRONTEND: ReadonlySet<string> = new Set([
  'sarma@bvitsolutions.com',
  'venkatakarthiksai.s@gmail.com',
  'mrangakrishna@gmail.com',
]);

/**
 * Quick synchronous check — returns true if the email is in the hardcoded
 * admin set. Use this for instant UI rendering before the API response.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS_FRONTEND.has(email.toLowerCase().trim());
}

interface UseAdminResult {
  /** True if the current user is a platform administrator. Backend-verified. */
  isAdmin: boolean;
  /** True while the admin status is being fetched from the backend. */
  loading: boolean;
}

/**
 * Hook that returns whether the currently authenticated user is a platform admin.
 *
 * Two-phase detection:
 * 1. Immediate: checks email against the hardcoded frontend set (no API call).
 * 2. Confirmed: verifies via GET /api/v2/subscription (is_admin field).
 *
 * The hook resolves to the backend-confirmed value once loaded.
 * Admins will never see paywalls or plan limit errors.
 */
export function useAdmin(): UseAdminResult {
  const { user, loading: authLoading } = useAuth();

  // Phase 1: immediate email-based detection (avoids UI flash for admins)
  const immediateAdmin = isAdminEmail(user?.email);

  const [isAdmin, setIsAdmin] = useState<boolean>(immediateAdmin);
  const [loading, setLoading] = useState<boolean>(!immediateAdmin);

  useEffect(() => {
    // If already identified as admin from email, no API call needed
    if (immediateAdmin) {
      setIsAdmin(true);
      setLoading(false);
      return;
    }

    if (authLoading || !user) {
      setLoading(authLoading);
      return;
    }

    // Phase 2: confirm via backend API
    let cancelled = false;
    setLoading(true);

    subscriptionApi
      .get()
      .then((data) => {
        if (!cancelled) {
          // Backend is authoritative
          setIsAdmin(Boolean((data as any)?.is_admin));
        }
      })
      .catch(() => {
        // If API fails, fall back to email check only
        if (!cancelled) {
          setIsAdmin(immediateAdmin);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.email, authLoading, immediateAdmin]);

  return { isAdmin, loading };
}
