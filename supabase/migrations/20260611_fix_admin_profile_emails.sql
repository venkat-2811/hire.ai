-- =====================================================
-- Migration: Fix admin profiles — all three admin accounts
-- RekShift Admin Access System
-- =====================================================
-- Fixes profiles where email='unknown' (stored before JWT email fix).
-- Targets admin accounts directly by confirmed Clerk user_id.
-- Safe to run multiple times (idempotent).
-- =====================================================

-- 1. mrangakrishna@gmail.com  (Clerk user_id: user_39pzPSlCnNtQdxV5H9ByKm9Ofsk)
UPDATE public.profiles
  SET role = 'admin', email = 'mrangakrishna@gmail.com'
  WHERE user_id = 'user_39pzPSlCnNtQdxV5H9ByKm9Ofsk';

-- 2. sarma@bvitsolutions.com  (Clerk user_id: user_3DvWIyhFOmEDopxWyYKMl6jfn0z)
UPDATE public.profiles
  SET role = 'admin', email = 'sarma@bvitsolutions.com'
  WHERE user_id = 'user_3DvWIyhFOmEDopxWyYKMl6jfn0z';

-- 3. venkatakarthiksai.s@gmail.com  (Clerk user_id: user_39Cf5b4IZwNuZPprjPxJuiw7kpe)
UPDATE public.profiles
  SET role = 'admin', email = 'venkatakarthiksai.s@gmail.com'
  WHERE user_id = 'user_39Cf5b4IZwNuZPprjPxJuiw7kpe';

-- 4. Belt-and-suspenders: email-based update for any correctly stored emails
UPDATE public.profiles
  SET role = 'admin'
  WHERE LOWER(email) IN (
    'sarma@bvitsolutions.com',
    'venkatakarthiksai.s@gmail.com',
    'mrangakrishna@gmail.com'
  )
  AND role != 'admin';

-- 5. Verify — run this SELECT to confirm all three are admin
SELECT user_id, email, role
  FROM public.profiles
  WHERE user_id IN (
    'user_39pzPSlCnNtQdxV5H9ByKm9Ofsk',
    'user_3DvWIyhFOmEDopxWyYKMl6jfn0z',
    'user_39Cf5b4IZwNuZPprjPxJuiw7kpe'
  )
  OR role = 'admin';
