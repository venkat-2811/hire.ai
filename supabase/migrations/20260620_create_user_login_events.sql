-- Migration: Create tables for tracking Clerk session lifecycle events.
--
-- user_login_events:  Append-only event log. One row per session event
--                     (created, ended, removed, revoked).
-- user_sessions:      Stateful session tracker. One row per Clerk session.
--                     status = 'active' until an ended/removed/revoked event
--                     closes it. "Active now" = user has ≥1 active session.
--
-- Data accuracy: both tables are populated going forward only — there is
-- no historical data to backfill.

-- ── 1. Append-only event log ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_login_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'session.created',
  clerk_session_id TEXT,
  logged_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_login_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_login_events'
      AND policyname = 'service_role_user_login_events'
  ) THEN
    CREATE POLICY service_role_user_login_events
      ON public.user_login_events FOR ALL TO service_role USING (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_login_events_user_id
  ON public.user_login_events (user_id);
CREATE INDEX IF NOT EXISTS idx_user_login_events_logged_in_at
  ON public.user_login_events (logged_in_at DESC);

-- ── 2. Stateful session tracker ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_session_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',   -- active | ended | removed | revoked
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_sessions'
      AND policyname = 'service_role_user_sessions'
  ) THEN
    CREATE POLICY service_role_user_sessions
      ON public.user_sessions FOR ALL TO service_role USING (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
  ON public.user_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_status
  ON public.user_sessions (status);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_status
  ON public.user_sessions (user_id, status);
