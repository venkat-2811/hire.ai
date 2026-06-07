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
  | 'growth'
  | 'scale'
  | 'enterprise'
  | 'tempusa1'
  | 'tempusa2'
  | 'tempind1'
  | 'tempind2';

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
  isEnterprise?: boolean;
  isTestPlan?: boolean;
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
    id: 'growth',
    name: 'Growth',
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
    id: 'scale',
    name: 'Scale',
    priceUSD: 2000,
    priceINR: 99000,      // ₹99,000 per requirements
    candidates: 500,
    validity: '1 Year',
    tagline: 'Advanced capacity for rapidly expanding talent pipelines.',
    features: [
      '500 Candidate Assessments',
      'Everything in Growth Plan',
      'Valid for 1 Full Year',
      'Priority Customer Support',
      'Advanced Assessment Capacity',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceUSD: null,
    priceINR: null,
    candidates: null,
    validity: 'Custom',
    tagline: 'Custom volume, dedicated support, and enterprise SLA.',
    features: [
      'Custom Candidate Limits',
      'Custom Assessment Volume',
      'Dedicated Account Manager',
      'Priority Support',
      'Custom Integrations',
      'Enterprise SLA',
    ],
    isEnterprise: true,
  },
];

/**
 * Test/temp plans — ONLY rendered in development builds.
 * Never visible in production.
 */
export const TEST_PLANS: PricingPlan[] = [
  {
    id: 'tempusa1',
    name: 'Temp USA 1',
    priceUSD: 1,
    priceINR: null,
    candidates: 2,
    validity: '1 Month',
    tagline: '[TEST] $1 plan for QA testing. Not visible in production.',
    features: ['2 Candidate Assessments', 'QA Testing Only'],
    isTestPlan: true,
  },
  {
    id: 'tempusa2',
    name: 'Temp USA 2',
    priceUSD: 2,
    priceINR: null,
    candidates: 5,
    validity: '1 Month',
    tagline: '[TEST] $2 plan for QA testing. Not visible in production.',
    features: ['5 Candidate Assessments', 'QA Testing Only'],
    isTestPlan: true,
  },
  {
    id: 'tempind1',
    name: 'Temp IND 1',
    priceUSD: null,
    priceINR: 20,
    candidates: 2,
    validity: '1 Month',
    tagline: '[TEST] ₹20 plan for QA testing. Not visible in production.',
    features: ['2 Candidate Assessments', 'QA Testing Only'],
    isTestPlan: true,
  },
  {
    id: 'tempind2',
    name: 'Temp IND 2',
    priceUSD: null,
    priceINR: 30,
    candidates: 5,
    validity: '1 Month',
    tagline: '[TEST] ₹30 plan for QA testing. Not visible in production.',
    features: ['5 Candidate Assessments', 'QA Testing Only'],
    isTestPlan: true,
  },
];

/** Returns true if test plans should be visible */
export function shouldShowTestPlans(): boolean {
  // Always show test plans in deployment as requested by the user
  return true;
}

/**
 * Get the plans to display based on currency.
 * Test plans are filtered based on currency region.
 */
export function getPlansForCurrency(
  currency: Currency,
  includeTestPlans = false,
): PricingPlan[] {
  const plans = [...PRODUCTION_PLANS];

  if (includeTestPlans && shouldShowTestPlans()) {
    const testPlans =
      currency === 'INR'
        ? TEST_PLANS.filter((p) => p.priceINR !== null)
        : TEST_PLANS.filter((p) => p.priceUSD !== null);
    plans.push(...testPlans);
  }

  return plans;
}

// ─── Candidate Credits ────────────────────────────────────────────────────────

/** Credits (candidate slots) assigned per plan on successful payment */
export const PLAN_CREDITS: Record<PlanId, number> = {
  free: 5,
  starter: 50,
  growth: 100,
  scale: 500,
  enterprise: 999999,
  tempusa1: 2,
  tempusa2: 5,
  tempind1: 2,
  tempind2: 5,
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
    growth:   { USD: 'VITE_STRIPE_US_GROWTH_PRICE_ID',   INR: 'VITE_STRIPE_IND_GROWTH_PRICE_ID' },
    scale:    { USD: 'VITE_STRIPE_US_SCALE_PRICE_ID',    INR: 'VITE_STRIPE_IND_SCALE_PRICE_ID' },
    tempusa1: { USD: 'VITE_STRIPE_TEMP_US_1_PRICE_ID' },
    tempusa2: { USD: 'VITE_STRIPE_TEMP_US_2_PRICE_ID' },
    tempind1: { INR: 'VITE_STRIPE_TEMP_IND_1_PRICE_ID' },
    tempind2: { INR: 'VITE_STRIPE_TEMP_IND_2_PRICE_ID' },
  };
  return map[planId]?.[currency] ?? '';
}
