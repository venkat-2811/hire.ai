-- Migration: Expand plan CHECK constraints to include 'scale' and temp/test plans
-- Fixes: 500 Internal Server Error when subscribing to 'scale' or temp plans
--        (tempusa1, tempusa2, tempind1, tempind2) because the old constraints
--        only allowed: 'free', 'starter', 'growth', 'enterprise'.

-- ── 1. subscriptions.plan ─────────────────────────────────────────────────────
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_plan_check CHECK (
    plan IN (
      'free',
      'starter',
      'growth',
      'scale',
      'enterprise',
      'tempusa1',
      'tempusa2',
      'tempind1',
      'tempind2'
    )
  );

-- ── 2. profiles.subscription_plan ────────────────────────────────────────────
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS valid_subscription_plan;

ALTER TABLE public.profiles
  ADD CONSTRAINT valid_subscription_plan CHECK (
    subscription_plan IN (
      'free',
      'starter',
      'growth',
      'scale',
      'enterprise',
      'tempusa1',
      'tempusa2',
      'tempind1',
      'tempind2'
    )
  );
