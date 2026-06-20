-- One-time controlled admin-role bootstrap for founder accounts.
--
-- This script:
--  1) Resolves founder user_id values from profiles.email (case-insensitive)
--  2) Grants admin role to those founders (idempotent)
--  3) Reports any non-founder admin holders (does NOT remove them)
--
-- IMPORTANT: Non-founder admin rows are intentionally not deleted here.
-- Review the reported rows and remove manually after confirmation.

-- -----------------------------------------------------------------------------
-- Preflight guards: require baseline auth schema objects.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.user_roles') IS NULL THEN
    RAISE EXCEPTION
      'Missing required table: public.user_roles. Run baseline migrations first (e.g. 20260202083138_48306fc1-e93f-4640-a7b0-ce6500c637e9.sql and any follow-up compatibility migrations).';
  END IF;

  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION
      'Missing required table: public.profiles. Run baseline profile migrations before this founder-admin migration.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email'
  ) THEN
    RAISE EXCEPTION
      'Missing required column: public.profiles.email';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id'
  ) THEN
    RAISE EXCEPTION
      'Missing required column: public.profiles.user_id';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- A) Founder email inputs
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE tmp_founder_emails (
  email TEXT PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO tmp_founder_emails (email)
VALUES
  ('venkatakarthiksai.s@gmail.com'),
  ('mrangakrishna@gmail.com'),
  ('sarma@bvitsolutions.com');

-- -----------------------------------------------------------------------------
-- B) BEFORE snapshot: current admin role holders
-- -----------------------------------------------------------------------------
SELECT
  ur.user_id,
  p.email,
  ur.created_at
FROM public.user_roles ur
LEFT JOIN public.profiles p ON p.user_id = ur.user_id
WHERE ur.role = 'admin'
ORDER BY ur.created_at, ur.user_id;

-- -----------------------------------------------------------------------------
-- C) Resolve each founder email -> exactly one user_id
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE tmp_founder_resolution AS
SELECT
  fe.email,
  ARRAY_REMOVE(ARRAY_AGG(DISTINCT p.user_id), NULL) AS matched_user_ids,
  COUNT(DISTINCT p.user_id) AS matched_user_count
FROM tmp_founder_emails fe
LEFT JOIN public.profiles p
  ON LOWER(p.email) = LOWER(fe.email)
GROUP BY fe.email;

-- Show resolution details for audit visibility.
SELECT
  email,
  matched_user_count,
  matched_user_ids
FROM tmp_founder_resolution
ORDER BY email;

DO $$
DECLARE
  bad_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM tmp_founder_resolution
  WHERE matched_user_count <> 1;

  IF bad_count > 0 THEN
    RAISE EXCEPTION
      'Founder email resolution failed. Each founder email must map to exactly 1 profiles.user_id. Check tmp_founder_resolution output.';
  END IF;
END $$;

CREATE TEMP TABLE tmp_founder_user_ids AS
SELECT
  email,
  (matched_user_ids[1])::text AS user_id
FROM tmp_founder_resolution
ORDER BY email;

SELECT * FROM tmp_founder_user_ids ORDER BY email;

-- -----------------------------------------------------------------------------
-- D) Ensure founder admin rows exist (idempotent)
-- -----------------------------------------------------------------------------
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'admin'
FROM tmp_founder_user_ids
ON CONFLICT (user_id, role) DO NOTHING;

-- -----------------------------------------------------------------------------
-- E) Report any non-founder admin holders (manual action required)
-- -----------------------------------------------------------------------------
SELECT
  ur.user_id,
  p.email,
  ur.created_at
FROM public.user_roles ur
LEFT JOIN public.profiles p ON p.user_id = ur.user_id
WHERE ur.role = 'admin'
  AND ur.user_id NOT IN (SELECT user_id FROM tmp_founder_user_ids)
ORDER BY ur.created_at, ur.user_id;

-- -----------------------------------------------------------------------------
-- F) AFTER snapshot: all admin holders (should include all founders)
-- -----------------------------------------------------------------------------
SELECT
  ur.user_id,
  p.email,
  ur.created_at
FROM public.user_roles ur
LEFT JOIN public.profiles p ON p.user_id = ur.user_id
WHERE ur.role = 'admin'
ORDER BY ur.created_at, ur.user_id;

-- -----------------------------------------------------------------------------
-- Optional manual cleanup query (review first; do NOT run blindly):
--
-- DELETE FROM public.user_roles
-- WHERE role = 'admin'
--   AND user_id NOT IN (SELECT user_id FROM tmp_founder_user_ids);
-- -----------------------------------------------------------------------------
