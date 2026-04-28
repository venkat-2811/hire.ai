-- =====================================================
-- Migration: Add Subscription Model & Reset User Data
-- =====================================================

-- 1. RESET ALL USER DATA (irreversible)
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'interview_evaluations', 'practical_submissions', 'practical_assessments',
    'candidate_responses', 'interview_questions', 'interview_sessions',
    'ai_interview_sessions', 'assessment_sessions', 'ats_screenings',
    'ats_screening_results', 'job_applications', 'candidates',
    'job_descriptions', 'profiles'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
      EXECUTE 'TRUNCATE TABLE public.' || quote_ident(tbl) || ' CASCADE';
    END IF;
  END LOOP;
END $$;

-- 2. ADD SUBSCRIPTION & USAGE COLUMNS TO PROFILES
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_plan text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS subscription_id text,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS plan_selected_at timestamptz,
  ADD COLUMN IF NOT EXISTS jobs_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assessments_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interviews_count integer NOT NULL DEFAULT 0;

-- 3. ADD CHECK CONSTRAINT FOR VALID PLANS
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS valid_subscription_plan;
ALTER TABLE profiles
  ADD CONSTRAINT valid_subscription_plan CHECK (subscription_plan IN ('none', 'pro', 'premium'));
