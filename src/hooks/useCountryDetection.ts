/**
 * useCountryDetection.ts
 *
 * React hook that detects the user's country for geo-based pricing.
 * Implements a no-flicker strategy:
 * - Reads from sessionStorage/localStorage synchronously first (instant render)
 * - Falls back to async IP detection if no cache exists
 * - Renders pricing only after detection resolves
 */

import { useState, useEffect, useRef } from 'react';
import {
  detectUserCountry,
  getCurrencyForCountry,
  isIndiaCountry,
  type Currency,
} from '@/lib/pricing';

export interface CountryDetectionResult {
  /** ISO 3166-1 alpha-2 country code, e.g. 'IN', 'US' */
  country: string;
  /** 'INR' for India, 'USD' for all other countries */
  currency: Currency;
  /** True if user is in India */
  isIndia: boolean;
  /** True while detection is in progress (first render only, if no cache) */
  isLoading: boolean;
}

// Read synchronously from storage to avoid any flicker on re-renders
function getStoredCountry(): string | null {
  try {
    return (
      sessionStorage.getItem('rekshift_detected_country') ||
      localStorage.getItem('rekshift_detected_country') ||
      null
    );
  } catch {
    return null;
  }
}

/**
 * Hook for geo-based country/currency detection.
 *
 * Priority order:
 * 1. Cached result from sessionStorage/localStorage (synchronous, instant)
 * 2. User profile country (if provided as `profileCountry` argument)
 * 3. Async IP geolocation via ipapi.co
 * 4. Timezone-based fallback
 *
 * @param profileCountry - Optional: user's saved country from their profile
 */
export function useCountryDetection(profileCountry?: string | null): CountryDetectionResult {
  // Synchronously resolve initial state to prevent flicker
  const storedCountry = getStoredCountry();

  const resolveInitial = (): { country: string; isLoading: boolean } => {
    // Profile country takes highest priority (user explicitly set this)
    if (profileCountry && profileCountry.length === 2) {
      return { country: profileCountry.toUpperCase(), isLoading: false };
    }
    // Cached country — instant, no loading state needed
    if (storedCountry && storedCountry.length === 2) {
      return { country: storedCountry.toUpperCase(), isLoading: false };
    }
    // Nothing cached — need async detection
    return { country: 'US', isLoading: true };
  };

  const initial = resolveInitial();
  const [country, setCountry] = useState<string>(initial.country);
  const [isLoading, setIsLoading] = useState<boolean>(initial.isLoading);
  const detectionRan = useRef(false);

  useEffect(() => {
    // If profile country is set, it overrides everything — no async needed
    if (profileCountry && profileCountry.length === 2) {
      const code = profileCountry.toUpperCase();
      setCountry(code);
      setIsLoading(false);
      return;
    }

    // Already resolved synchronously from cache — skip async
    if (!initial.isLoading) return;

    // Prevent double-detection in React StrictMode
    if (detectionRan.current) return;
    detectionRan.current = true;

    let cancelled = false;

    detectUserCountry()
      .then((detected) => {
        if (!cancelled) {
          setCountry(detected.toUpperCase());
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          // Graceful fallback to US on any error
          setCountry('US');
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileCountry]);

  return {
    country,
    currency: getCurrencyForCountry(country),
    isIndia: isIndiaCountry(country),
    isLoading,
  };
}
