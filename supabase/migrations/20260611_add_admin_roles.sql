-- =====================================================
-- Migration: Add role column to profiles for RBAC
-- Admin Access System — RekShift
-- =====================================================
-- This migration adds a `role` column to the profiles table.
-- Admin status is kept COMPLETELY SEPARATE from Stripe subscriptions.
-- Admins do NOT get fake subscription records, billing records, or plan overrides.
-- =====================================================

-- 1. Add the role column (default 'recruiter' for all existing users)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'recruiter';

-- 2. Add a CHECK constraint to enforce valid roles
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('recruiter', 'admin'));

-- 3. Create an index for fast role-based lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 4. Seed the three hardcoded admin accounts by email.
--    These UPDATE statements are safe to run multiple times (idempotent).
--    They ONLY update the role column — no subscription fields are touched.
UPDATE public.profiles
  SET role = 'admin'
  WHERE LOWER(email) IN (
    'sarma@bvitsolutions.com',
    'venkatakarthiksai.s@gmail.com',
    'mrangakrishna@gmail.com'
  );

-- 5. Add a comment for documentation
COMMENT ON COLUMN public.profiles.role IS
  'RBAC role: recruiter (default) or admin. '
  'Admin role is completely independent of Stripe subscriptions. '
  'Admins bypass ALL usage limits and subscription checks.';
