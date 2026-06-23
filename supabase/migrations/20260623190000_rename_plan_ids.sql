-- =====================================================
-- Migration: Rename plan IDs to new canonical names (June 2026)
--
-- Renames:
--   'professional' → 'growth'         (100-candidate Growth plan)
--   'enterprise'   → 'scale'          (500-candidate Scale plan, paid Stripe)
--   'custom'       → 'enterprise'     (Contact Sales tier, no Stripe)
--
-- Legacy values (tempusa1/2, tempind1/2) are also remapped.
-- =====================================================

-- ─── Step 1: Temporarily drop all plan constraints ───────────────────────────

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS valid_subscription_plan;

-- ─── Step 2: Rename plan values in subscriptions table ───────────────────────

-- 'enterprise' (old paid Scale plan) → 'scale'
UPDATE public.subscriptions
  SET plan = 'scale'
  WHERE plan = 'enterprise';

-- 'professional' (old ID) → 'growth'
UPDATE public.subscriptions
  SET plan = 'growth'
  WHERE plan = 'professional';

-- 'custom' (old Contact Sales tier) → 'enterprise'
UPDATE public.subscriptions
  SET plan = 'enterprise'
  WHERE plan = 'custom';

-- Temp/test plan IDs → normalise to canonical names
UPDATE public.subscriptions
  SET plan = 'growth'
  WHERE plan IN ('tempusa2', 'tempind2');

UPDATE public.subscriptions
  SET plan = 'scale'
  WHERE plan IN ('tempusa1', 'tempind1');

-- ─── Step 3: Rename plan values in profiles table ────────────────────────────

-- 'enterprise' (old paid Scale plan) → 'scale'
UPDATE public.profiles
  SET subscription_plan = 'scale'
  WHERE subscription_plan = 'enterprise';

-- 'professional' (old ID) → 'growth'
UPDATE public.profiles
  SET subscription_plan = 'growth'
  WHERE subscription_plan = 'professional';

-- 'custom' (old Contact Sales tier) → 'enterprise'
UPDATE public.profiles
  SET subscription_plan = 'enterprise'
  WHERE subscription_plan = 'custom';

-- ─── Step 4: Add updated CHECK constraints ───────────────────────────────────

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_plan_check CHECK (
    plan IN (
      'free',
      'starter',
      'growth',
      'scale',
      'enterprise'
    )
  );

ALTER TABLE public.profiles
  ADD CONSTRAINT valid_subscription_plan CHECK (
    subscription_plan IN (
      'free',
      'starter',
      'growth',
      'scale',
      'enterprise'
    )
  );
