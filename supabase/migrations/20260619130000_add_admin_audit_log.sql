-- Migration: Add admin audit log table for privileged admin mutations

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_user_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor_created
  ON public.admin_audit_log (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_created
  ON public.admin_audit_log (target_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action_created
  ON public.admin_audit_log (action, created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_audit_log'
      AND policyname = 'service_role_admin_audit_log'
  ) THEN
    CREATE POLICY service_role_admin_audit_log
      ON public.admin_audit_log
      FOR ALL
      TO service_role
      USING (true);
  END IF;
END $$;
