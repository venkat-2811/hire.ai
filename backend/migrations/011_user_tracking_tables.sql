-- Migration 011: User Tracking Tables & Profile Name Fields
-- Run this in the Supabase SQL editor.
-- Safe to run multiple times (all statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

-- =========================
-- user_login_events
-- Append-only log of all Clerk session events.
-- user_id stores the Clerk user ID (text, e.g. "user_abc123").
-- =========================
create table if not exists public.user_login_events (
  id               uuid primary key default gen_random_uuid(),
  user_id          text not null,
  event_type       text not null default 'session.created',
  clerk_session_id text null,
  ip_address       text null,
  user_agent       text null,
  logged_in_at     timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create index if not exists idx_ule_user_id      on public.user_login_events(user_id);
create index if not exists idx_ule_logged_in_at on public.user_login_events(logged_in_at desc);
create index if not exists idx_ule_event_type   on public.user_login_events(event_type);


-- =========================
-- user_sessions
-- Stateful session tracker — one row per Clerk session.
-- =========================
create table if not exists public.user_sessions (
  id               uuid primary key default gen_random_uuid(),
  clerk_session_id text not null,
  user_id          text not null,
  status           text not null default 'active',
  started_at       timestamptz not null default now(),
  ended_at         timestamptz null,
  created_at       timestamptz not null default now()
);

create unique index if not exists uq_user_sessions_clerk_session
  on public.user_sessions(clerk_session_id);
create index if not exists idx_user_sessions_user_id on public.user_sessions(user_id);
create index if not exists idx_user_sessions_status  on public.user_sessions(status);


-- =========================
-- profiles — add missing name & login tracking columns
-- These columns will be populated by the clerk_webhooks.py handler
-- on user.created / user.updated events, and on session.created.
-- =========================
alter table public.profiles
  add column if not exists first_name    text null,
  add column if not exists last_name     text null,
  add column if not exists last_login_at timestamptz null;

-- Back-fill full_name from first_name + last_name where full_name is currently null
-- (safe no-op if first_name / last_name are also null)
update public.profiles
set full_name = trim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))
where full_name is null
  and (first_name is not null or last_name is not null);
