-- Add onboarding and company fields to profiles

-- Create profiles table if it doesn't exist (Clerk-compatible)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  organization_email TEXT,
  company_name TEXT,
  company_website TEXT,
  company_size TEXT,
  industry TEXT,
  headquarters_location TEXT,
  hiring_regions TEXT,
  hiring_roles TEXT,
  preferred_timezone TEXT,
  contact_phone TEXT,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  onboarding_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clerk user IDs are strings (e.g. user_abc123), so profiles.user_id must be text
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
ALTER TABLE public.profiles ALTER COLUMN user_id TYPE text USING user_id::text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization_email TEXT,
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS company_website TEXT,
  ADD COLUMN IF NOT EXISTS company_size TEXT,
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS headquarters_location TEXT,
  ADD COLUMN IF NOT EXISTS hiring_regions TEXT,
  ADD COLUMN IF NOT EXISTS hiring_roles TEXT,
  ADD COLUMN IF NOT EXISTS preferred_timezone TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Auto-update updated_at if the helper function exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    JOIN pg_namespace n ON n.oid = pg_proc.pronamespace
    WHERE pg_proc.proname = 'update_updated_at_column'
      AND n.nspname = 'public'
  ) THEN
    DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
    CREATE TRIGGER update_profiles_updated_at
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Ensure service role can access profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Service role has full access to profiles') THEN
    CREATE POLICY "Service role has full access to profiles" ON public.profiles FOR ALL TO service_role USING (true);
  END IF;
END $$;
