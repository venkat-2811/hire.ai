/**
 * pricing.ts — Single source of truth for all pricing plans.
 *
 * Used by PricingPage, BillingPage, OnboardingPage and backend billing helpers.
 * Never hardcode prices, plan IDs, or currency symbols anywhere else.
 *
 * Plan structure (as of June 2026):
 *   free       → Free (₹0 / $0, 5 candidates, 1 month)
 *   starter    → Starter (₹15,000 / $300, 50 candidates, 6 months)
 *   growth     → Growth (₹27,000 / $500, 100 candidates, 6 months)
 *   scale      → Scale (₹99,000 / $2,000, 500 candidates, 1 year)
 *   enterprise → Enterprise – Contact Sales (custom volume/pricing)
 *
 * Legacy aliases handled in normalizePlanId():
 *   'professional' → 'growth'
 *   old 'enterprise' before rename → now 'scale'
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlanId =
  | 'free'
  | 'starter'
  | 'growth'
  | 'enterprise'
  | 'custom';

export type Currency = 'USD' | 'INR';

export interface PricingPlan {
  id: PlanId;
  name: string;
  /** null = "Contact Sales" — no Stripe checkout */
  priceUSD: number | null;
  /** null = "Contact Sales" — no Stripe checkout */
  priceINR: number | null;
  /** null = custom */
  candidates: number | null;
  validity: string;
  tagline: string;
  features: string[];
  highlighted?: boolean;
  /** If true, clicking CTA goes to /contact instead of Stripe */
  isContactPlan?: boolean;
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
 * Detect user country using a multi-tier priority:
 * 1. Cache (instant, with timestamp)
 * 2. IP geolocation via ipapi.co
 * 3. Browser timezone/locale fallback
 */
export async function detectUserCountry(): Promise<{ country: string; source: string }> {
  const cached = getCachedCountry();
  if (cached) return cached;

  // IP geolocation via ipapi.co
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

  // Timezone-based fallback — works without network
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

/**
 * Normalize a raw plan string to a canonical PlanId.
 * Handles legacy aliases ('professional' → 'growth', old 'enterprise' stored
 * before the rename is kept as 'scale' when the value stored was the old enterprise).
 *
 * NOTE: Because the DB may still have 'professional' or 'enterprise' stored
 * for recruiters on the old plans, we map:
 *   professional → growth
 *   (The new enterprise is "Contact Sales" so DB values of 'enterprise'
 *    that were previously paid Stripe plans are treated as 'scale')
 */
export function normalizePlanId(raw?: string | null): PlanId {
  const p = String(raw || 'free').trim().toLowerCase();
  // Canonical new names
  if (p === 'growth') return 'growth';
  if (p === 'enterprise') return 'enterprise';
  if (p === 'custom') return 'custom';
  if (p === 'starter') return 'starter';
  // Legacy aliases
  if (p === 'professional') return 'growth';
  if (p === 'scale') return 'enterprise'; // If anyone used scale temporarily
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
    priceINR: 15000,
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
    priceINR: 27000,
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
    name: 'Scale',
    priceUSD: 2000,
    priceINR: 99000,
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
    id: 'custom',
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
    isContactPlan: true,
  },
];

/**
 * Get the plans to display based on currency.
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
  growth: 100,
  enterprise: 500,
  custom: 0, // Handled manually for custom enterprise deals
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
 * Returns null for enterprise (contact plan) or currency-unavailable plans.
 */
export function getPlanPrice(plan: PricingPlan, currency: Currency): number | null {
  if (currency === 'INR') return plan.priceINR;
  return plan.priceUSD;
}

// ─── Stripe Price ID Mapping (frontend env vars) ──────────────────────────────

/**
 * Returns the VITE_ env var name for a given plan+currency.
 * Price IDs are created in Stripe Dashboard and stored in .env.
 * Enterprise has no Stripe price (contact sales).
 */
export function getStripePriceEnvKey(planId: PlanId, currency: Currency): string {
  const map: Partial<Record<PlanId, Partial<Record<Currency, string>>>> = {
    // Free plan excluded — no Stripe product needed (no payment)
    starter:    { USD: 'VITE_STRIPE_US_STARTER_PRICE_ID',  INR: 'VITE_STRIPE_IND_STARTER_PRICE_ID' },
    growth:     { USD: 'VITE_STRIPE_US_GROWTH_PRICE_ID',   INR: 'VITE_STRIPE_IND_GROWTH_PRICE_ID' },
    enterprise: { USD: 'VITE_STRIPE_US_SCALE_PRICE_ID',    INR: 'VITE_STRIPE_IND_SCALE_PRICE_ID' },
    // custom is contact-sales only — no Stripe price ID
  };
  return map[planId]?.[currency] ?? '';
}
