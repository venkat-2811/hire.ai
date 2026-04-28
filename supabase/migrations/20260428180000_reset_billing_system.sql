-- =====================================================
-- Migration: Reset Billing System Data
-- =====================================================

-- 1. TRUNCATE ALL BILLING TABLES
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'usage_events',
    'invoices',
    'subscriptions'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
      EXECUTE 'TRUNCATE TABLE public.' || quote_ident(tbl) || ' CASCADE';
    END IF;
  END LOOP;
END $$;

-- 2. RESET PROFILE BILLING COLUMNS
UPDATE profiles
SET
  subscription_plan = 'free',
  subscription_id = NULL,
  razorpay_payment_id = NULL,
  subscription_status = 'active',
  plan_selected_at = NULL,
  jobs_count = 0,
  assessments_count = 0,
  interviews_count = 0
WHERE true;
