-- =====================================================
-- Migration: Credit-Based Billing System
-- =====================================================

-- 1. RESET BILLING DATA
TRUNCATE TABLE public.usage_events CASCADE;
TRUNCATE TABLE public.subscriptions CASCADE;

-- 2. UPDATE PROFILES TO USE 'none' INSTEAD OF 'free'
UPDATE public.profiles
SET subscription_plan = 'none'
WHERE subscription_plan = 'free';

-- 3. UPDATE PROFILES CONSTRAINT TO ALLOW 'none'
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS valid_subscription_plan;
ALTER TABLE public.profiles
  ADD CONSTRAINT valid_subscription_plan CHECK (subscription_plan IN ('none', 'pro', 'premium'));

-- 4. DROP OLD COLUMNS (billing cycle, overage, deposit)
ALTER TABLE public.subscriptions
  DROP COLUMN IF EXISTS billing_cycle_start,
  DROP COLUMN IF EXISTS billing_cycle_end,
  DROP COLUMN IF EXISTS deposit_amount,
  DROP COLUMN IF EXISTS overage_amount,
  DROP COLUMN IF EXISTS overage_cap,
  DROP COLUMN IF EXISTS warning_80_sent_at,
  DROP COLUMN IF EXISTS paused_at,
  DROP COLUMN IF EXISTS resumed_at;

-- 5. UPDATE PLAN CONSTRAINT (allow 'none' for no plan selected)
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_plan_check CHECK (plan IN ('none', 'pro', 'premium'));

-- 6. UPDATE STATUS CONSTRAINT (simplify to active/paused)
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check CHECK (status IN ('active', 'paused'));

-- 7. ADD CREDIT_AMOUNT COLUMN TO TRACK INITIAL CREDIT PURCHASE
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS credit_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

-- 8. UPDATE DEFAULT VALUES
ALTER TABLE public.subscriptions
  ALTER COLUMN plan SET DEFAULT 'none',
  ALTER COLUMN wallet_balance SET DEFAULT 0,
  ALTER COLUMN credit_amount SET DEFAULT 0;

-- 9. REMOVE INVOICES TABLE (no longer needed for credit-based system)
DROP TABLE IF EXISTS public.invoices CASCADE;

-- 10. UPDATE METADATA DEFAULT TO INCLUDE PLAN INFO
ALTER TABLE public.subscriptions
  ALTER COLUMN metadata SET DEFAULT '{"plan_type": "credit"}'::jsonb;
