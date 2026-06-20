-- Bootstrap missing user_roles table for partially initialized environments.
-- Safe to run multiple times.

DO $$
BEGIN
  IF to_regclass('public.user_roles') IS NOT NULL THEN
    RAISE NOTICE 'public.user_roles already exists; nothing to bootstrap.';
    RETURN;
  END IF;

  -- Create app_role enum only if missing.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'app_role'
  ) THEN
    EXECUTE 'CREATE TYPE public.app_role AS ENUM (''admin'', ''recruiter'', ''interviewer'', ''candidate'')';
  END IF;

  -- Clerk user IDs are strings; use TEXT for user_id.
  EXECUTE '
    CREATE TABLE public.user_roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      role public.app_role NOT NULL DEFAULT ''candidate'',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, role)
    )
  ';

  EXECUTE 'ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY';

  -- Minimal policies aligned with existing auth model.
  EXECUTE '
    CREATE POLICY "Users can view own roles"
    ON public.user_roles FOR SELECT
    USING (auth.uid()::text = user_id)
  ';

  EXECUTE '
    CREATE POLICY "Admins can manage all roles"
    ON public.user_roles FOR ALL
    TO authenticated
    USING (auth.uid()::text IN (
      SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = ''admin''
    ))
  ';

  -- Service role policy for backend/admin client consistency.
  EXECUTE '
    CREATE POLICY "Service role has full access to user_roles"
    ON public.user_roles FOR ALL
    TO service_role
    USING (true)
  ';

  RAISE NOTICE 'Bootstrapped public.user_roles successfully.';
END $$;
