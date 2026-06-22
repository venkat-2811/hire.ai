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
  getCachedCountry,
  getCurrencyForCountry,
  isIndiaCountry,
  resolvePricingCountry,
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

export interface CountryDetectionOptions {
  explicitCountry?: string | null;
  billingCountry?: string | null;
  profileCountry?: string | null;
}

// Read synchronously from storage to avoid any flicker on re-renders
function getStoredCountry(): { country: string; source: string } | null {
  return getCachedCountry();
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
 * @param options - Optional country sources with explicit > billing > profile priority
 */
export function useCountryDetection(options?: CountryDetectionOptions): CountryDetectionResult {
  // Synchronously resolve initial state to prevent flicker
  const storedCountry = getStoredCountry();

  const explicitCountry = options?.explicitCountry || null;
  const billingCountry = options?.billingCountry || null;
  const profileCountry = options?.profileCountry || null;

  const resolveInitial = (): { country: string; isLoading: boolean; source: string } => {
    const resolved = resolvePricingCountry({
      explicitCountry,
      billingCountry,
      profileCountry,
    });
    if (resolved && resolved.length === 2 && (explicitCountry || billingCountry || profileCountry)) {
      return { country: resolved, isLoading: false, source: 'priority' };
    }
    // Cached country — instant, no loading state needed
    if (storedCountry && storedCountry.country.length === 2) {
      return { country: storedCountry.country.toUpperCase(), isLoading: false, source: storedCountry.source };
    }
    // Nothing cached — need async detection
    return { country: 'US', isLoading: true, source: 'pending' };
  };

  const initial = resolveInitial();
  const [country, setCountry] = useState<string>(initial.country);
  const [isLoading, setIsLoading] = useState<boolean>(initial.isLoading);
  const detectionRan = useRef(false);

  useEffect(() => {
    const resolved = resolvePricingCountry({
      explicitCountry,
      billingCountry,
      profileCountry,
    });
    if (resolved && resolved.length === 2 && (explicitCountry || billingCountry || profileCountry)) {
      const code = resolved.toUpperCase();
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
      .then(({ country: detected, source }) => {
        if (!cancelled) {
          const code = detected.toUpperCase();
          console.log(`[GeoPricing] Detected ${code} via ${source}`);
          setCountry(code);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn(`[GeoPricing] Error detecting country, fallback to US:`, err);
          // Graceful fallback to US on any error
          setCountry('US');
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explicitCountry, billingCountry, profileCountry]);

  return {
    country,
    currency: getCurrencyForCountry(country),
    isIndia: isIndiaCountry(country),
    isLoading,
  };
}
