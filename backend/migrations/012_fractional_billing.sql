-- Migration 012: Fractional Billing — alter candidates_consumed to NUMERIC
-- Run this in the Supabase SQL editor.
-- Safe to run multiple times (uses IF EXISTS / type check).
--
-- Previously candidates_consumed was an INTEGER (incremented by 1 per candidate added).
-- With fractional billing, each action contributes a partial amount:
--   +0.25  when a candidate is added
--   +0.50  when an assessment is sent to that candidate
--   +0.25  when an interview is sent to that candidate
--   ─────
--   1.00   total for a fully-processed candidate
--
-- The plan limit (e.g. 50 for Starter) is still compared as a whole number against
-- the sum of all fractional charges, so the quota math stays identical.

-- Step 1: Change column type from INTEGER to NUMERIC(10, 2)
-- The USING clause converts existing integer values to numeric transparently.
ALTER TABLE public.profiles
  ALTER COLUMN candidates_consumed TYPE NUMERIC(10, 2)
    USING candidates_consumed::NUMERIC(10, 2);

-- Step 2: Ensure the default is 0 (not NULL)
ALTER TABLE public.profiles
  ALTER COLUMN candidates_consumed SET DEFAULT 0;

-- Step 3: Backfill any NULLs to 0 (safety net for pre-migration rows)
UPDATE public.profiles
SET candidates_consumed = 0
WHERE candidates_consumed IS NULL;
