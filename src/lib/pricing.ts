/**
 * pricing.ts — Single source of truth for all pricing plans.
 *
 * Used by PricingPage, BillingPage, and backend billing helpers.
 * Never hardcode prices, plan IDs, or currency symbols anywhere else.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlanId =
  | 'free'
  | 'starter'
  | 'professional'
  | 'enterprise';

export type LegacyPlanAlias = 'growth' | 'scale';

export type Currency = 'USD' | 'INR';

export interface PricingPlan {
  id: PlanId;
  name: string;
  priceUSD: number | null;
  priceINR: number | null;
  candidates: number | null;
  validity: string;
  tagline: string;
  features: string[];
  highlighted?: boolean;
}

// ─── Country Detection ────────────────────────────────────────────────────────

/** Countries that get INR pricing */
export const INDIA_COUNTRY_CODE = 'IN';

/** Storage keys for caching detected country */
const COUNTRY_CACHE_KEY = 'rekshift_detected_country';
const COUNTRY_CACHE_TS_KEY = 'rekshift_detected_country_ts';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function getCachedCountry(): { country: string; source: string } | null {
  try {
    const cached = sessionStorage.getItem(COUNTRY_CACHE_KEY) || localStorage.getItem(COUNTRY_CACHE_KEY);
    const ts = sessionStorage.getItem(COUNTRY_CACHE_TS_KEY) || localStorage.getItem(COUNTRY_CACHE_TS_KEY);
    if (cached && ts && Date.now() - parseInt(ts, 10) < CACHE_TTL_MS) {
      return { country: cached, source: 'cache' };
    }
  } catch {}
  return null;
}

/**
 * Detect user country using a 4-tier priority:
 * 1. Cache (instant, with timestamp)
 * 2. IP geolocation via ipapi.co
 * 3. Browser timezone/locale fallback
 *
 * @returns object with country code and detection source
 */
export async function detectUserCountry(): Promise<{ country: string; source: string }> {
  const cached = getCachedCountry();
  if (cached) return cached;

  // 3. IP geolocation via ipapi.co
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const resp = await fetch('https://ipapi.co/json/', {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (resp.ok) {
      const data = await resp.json();
      const country = String(data?.country_code || '').toUpperCase();
      if (country && country.length === 2) {
        _cacheCountry(country);
        return { country, source: 'api' };
      }
    }
  } catch {
    // Silently fall through to timezone fallback
  }

  // 4. Timezone-based fallback — works without network
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const country = _countryFromTimezone(tz);
  _cacheCountry(country);
  return { country, source: 'timezone_fallback' };
}

function _cacheCountry(country: string): void {
  try {
    const ts = Date.now().toString();
    sessionStorage.setItem(COUNTRY_CACHE_KEY, country);
    sessionStorage.setItem(COUNTRY_CACHE_TS_KEY, ts);
    localStorage.setItem(COUNTRY_CACHE_KEY, country);
    localStorage.setItem(COUNTRY_CACHE_TS_KEY, ts);
  } catch {
    // Ignore storage errors
  }
}

function _countryFromTimezone(tz: string): string {
  // India-specific timezones
  if (tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta') return 'IN';
  // Other South Asian timezones that currently map to INR
  const inrTimezones = [
    'Asia/Karachi', 'Asia/Dhaka', 'Asia/Colombo',
    'Asia/Kathmandu', 'Asia/Kabul',
  ];
  if (inrTimezones.includes(tz)) return 'IN';
  return 'US';
}

/** Returns true if the detected country should see INR pricing */
export function isIndiaCountry(country: string): boolean {
  return country.toUpperCase() === INDIA_COUNTRY_CODE;
}

/** Returns the currency for a given country code */
export function getCurrencyForCountry(country: string): Currency {
  return isIndiaCountry(country) ? 'INR' : 'USD';
}

function _normalizeCountryCode(raw?: string | null): string {
  const c = String(raw || '').trim().toUpperCase();
  return c.length === 2 ? c : '';
}

export function resolvePricingCountry(options?: {
  explicitCountry?: string | null;
  billingCountry?: string | null;
  profileCountry?: string | null;
  fallbackCountry?: string | null;
}): string {
  const explicit = _normalizeCountryCode(options?.explicitCountry);
  if (explicit) return explicit;

  const billing = _normalizeCountryCode(options?.billingCountry);
  if (billing) return billing;

  const profile = _normalizeCountryCode(options?.profileCountry);
  if (profile) return profile;

  return _normalizeCountryCode(options?.fallbackCountry) || 'US';
}

export function normalizePlanId(raw?: string | null): PlanId {
  const p = String(raw || 'free').trim().toLowerCase();
  if (p === 'growth' || p === 'professional') return 'professional';
  if (p === 'scale' || p === 'enterprise') return 'enterprise';
  if (p === 'starter') return 'starter';
  return 'free';
}

// ─── Plans ────────────────────────────────────────────────────────────────────

/** Core production plans (always visible) */
export const PRODUCTION_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    priceUSD: 0,
    priceINR: 0,
    candidates: 5,
    validity: '1 Month',
    tagline: 'Get started and test AI assessments risk-free.',
    features: [
      '5 Candidate Assessments',
      'End-to-End Assessment Workflows',
      'Resume Parsing & AI MCQ Generation',
      'Adaptive AI Interview Sessions',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    priceUSD: 300,
    priceINR: 15000,      // ₹15,000 per requirements
    candidates: 50,
    validity: '6 Months',
    tagline: 'Perfect for small teams starting with AI-powered hiring.',
    features: [
      '50 Candidate Assessments',
      'Everything in Free Plan',
      'Valid for 6 Full Months',
      'Priority Customer Support',
    ],
    highlighted: true,
  },
  {
    id: 'professional',
    name: 'Professional',
    priceUSD: 500,
    priceINR: 27000,      // ₹27,000 per requirements
    candidates: 100,
    validity: '6 Months',
    tagline: 'Ideal for growing teams with steady recruitment needs.',
    features: [
      '100 Candidate Assessments',
      'Everything in Starter Plan',
      'Valid for 6 Full Months',
      'Priority Customer Support',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceUSD: 2000,
    priceINR: 99000,      // ₹99,000 per requirements
    candidates: 500,
    validity: '1 Year',
    tagline: 'Advanced capacity for rapidly expanding talent pipelines.',
    features: [
      '500 Candidate Assessments',
      'Everything in Professional Plan',
      'Valid for 1 Full Year',
      'Priority Customer Support',
      'Advanced Assessment Capacity',
    ],
  },
];

/**
 * Get the plans to display based on currency.
 * Test plans are filtered based on currency region.
 */
export function getPlansForCurrency(
  _currency: Currency,
): PricingPlan[] {
  return [...PRODUCTION_PLANS];
}

// ─── Candidate Credits ────────────────────────────────────────────────────────

/** Credits (candidate slots) assigned per plan on successful payment */
export const PLAN_CREDITS: Record<PlanId, number> = {
  free: 5,
  starter: 50,
  professional: 100,
  enterprise: 500,
};

// ─── Formatting ───────────────────────────────────────────────────────────────

/**
 * Format a monetary amount using Intl.NumberFormat.
 * Always uses the correct locale and symbol for the currency.
 */
export function formatPrice(amount: number, currency: Currency): string {
  if (amount === 0) return currency === 'INR' ? '₹0' : '$0';

  if (currency === 'INR') {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Get the display price for a plan in the given currency.
 * Returns null for enterprise or currency-unavailable test plans.
 */
export function getPlanPrice(plan: PricingPlan, currency: Currency): number | null {
  if (currency === 'INR') return plan.priceINR;
  return plan.priceUSD;
}

// ─── Stripe Price ID Mapping (frontend env vars) ──────────────────────────────

/**
 * Returns the VITE_ env var name for a given plan+currency.
 * Price IDs are created in Stripe Dashboard and stored in .env.
 */
export function getStripePriceEnvKey(planId: PlanId, currency: Currency): string {
  const map: Partial<Record<PlanId, Partial<Record<Currency, string>>>> = {
    // Free plan excluded — no Stripe product needed (no payment)
    starter:  { USD: 'VITE_STRIPE_US_STARTER_PRICE_ID',  INR: 'VITE_STRIPE_IND_STARTER_PRICE_ID' },
    professional: { USD: 'VITE_STRIPE_US_PROFESSIONAL_PRICE_ID', INR: 'VITE_STRIPE_IND_PROFESSIONAL_PRICE_ID' },
    enterprise:   { USD: 'VITE_STRIPE_US_ENTERPRISE_PRICE_ID',   INR: 'VITE_STRIPE_IND_ENTERPRISE_PRICE_ID' },
  };
  return map[planId]?.[currency] ?? '';
}
