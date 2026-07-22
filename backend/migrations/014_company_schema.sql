-- ============================================================
-- Migration 014: Company-Based Pricing & Organisation Layer
-- Run this in Supabase SQL Editor (once, idempotent with IF NOT EXISTS)
-- ============================================================

-- ── 1. Company Plan Templates ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_plans (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  recruiter_seats  int  NOT NULL,
  credits_per_seat int  NOT NULL DEFAULT 100,
  total_credits    int  GENERATED ALWAYS AS (recruiter_seats * credits_per_seat) STORED,
  price_usd        numeric(10,2) DEFAULT 0,
  price_inr        numeric(10,2) DEFAULT 0,
  validity         text DEFAULT '1 Year',
  features         jsonb DEFAULT '[]',
  stripe_price_id_usd text DEFAULT '',
  stripe_price_id_inr text DEFAULT '',
  is_active        boolean DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Companies ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.companies (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  owner_user_id  text NOT NULL,
  plan_id        uuid REFERENCES public.company_plans(id),
  seats_total    int NOT NULL DEFAULT 0,
  seats_used     int NOT NULL DEFAULT 0,
  status         text NOT NULL DEFAULT 'active',
  domain         text,
  logo_url       text,
  metadata       jsonb NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_name ON public.companies(lower(name));
CREATE INDEX IF NOT EXISTS idx_companies_owner ON public.companies(owner_user_id);

-- ── 3. Company Members ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_members (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id             text NOT NULL,
  role                text NOT NULL DEFAULT 'recruiter',
  status              text NOT NULL DEFAULT 'pending',
  credits_allocated   int NOT NULL DEFAULT 0,
  credits_consumed    numeric(10,2) NOT NULL DEFAULT 0,
  candidates_added    int NOT NULL DEFAULT 0,
  assessments_sent    int NOT NULL DEFAULT 0,
  interviews_sent     int NOT NULL DEFAULT 0,
  hires               int NOT NULL DEFAULT 0,
  jobs_posted         int NOT NULL DEFAULT 0,
  joined_at           timestamptz,
  removed_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_company_members_company ON public.company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_user    ON public.company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_company_members_status  ON public.company_members(company_id, status);

-- ── 4. Company Credits (Aggregate Pool) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_credits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  total_allocated int NOT NULL DEFAULT 0,
  total_consumed  numeric(10,2) NOT NULL DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

-- ── 5. Company Activity Feed ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_activity_feed (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id      text NOT NULL,
  action_type  text NOT NULL,
  entity_type  text,
  entity_id    text,
  description  text NOT NULL,
  metadata     jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_company ON public.company_activity_feed(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_user    ON public.company_activity_feed(user_id, created_at DESC);

-- ── 6. Audit Logs (Immutable) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     text NOT NULL,
  actor_role   text,
  action       text NOT NULL,
  target_type  text,
  target_id    text,
  company_id   uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  before_state jsonb NOT NULL DEFAULT '{}',
  after_state  jsonb NOT NULL DEFAULT '{}',
  ip_address   text,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor   ON public.audit_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_company ON public.audit_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action  ON public.audit_logs(action, created_at DESC);

-- ── 7. Company Subscription History ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_subscription_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id         uuid REFERENCES public.company_plans(id),
  action          text NOT NULL,
  seats_before    int,
  seats_after     int,
  credits_before  int,
  credits_after   int,
  price_paid_usd  numeric(10,2),
  price_paid_inr  numeric(10,2),
  currency        text DEFAULT 'USD',
  activated_by    text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_history_company ON public.company_subscription_history(company_id, created_at DESC);

-- ── Seed Default Company Plans (idempotent) ────────────────────────────────────
INSERT INTO public.company_plans (name, recruiter_seats, credits_per_seat, price_usd, price_inr, features)
SELECT * FROM (VALUES
  ('5 Recruiter Plan',  5,  100, 1200.00, 60000.00,  '["5 Recruiter Seats","500 Total Credits","Email Approvals","Company Dashboard","Audit Logs"]'::jsonb),
  ('10 Recruiter Plan', 10, 100, 2200.00, 110000.00, '["10 Recruiter Seats","1000 Total Credits","Email Approvals","Company Dashboard","Audit Logs","Activity Feed"]'::jsonb),
  ('15 Recruiter Plan', 15, 100, 3000.00, 150000.00, '["15 Recruiter Seats","1500 Total Credits","Email Approvals","Company Dashboard","Audit Logs","Activity Feed","Advanced Analytics"]'::jsonb),
  ('20 Recruiter Plan', 20, 100, 3800.00, 190000.00, '["20 Recruiter Seats","2000 Total Credits","Email Approvals","Company Dashboard","Audit Logs","Activity Feed","Advanced Analytics","Priority Support"]'::jsonb)
) AS v(name, recruiter_seats, credits_per_seat, price_usd, price_inr, features)
WHERE NOT EXISTS (SELECT 1 FROM public.company_plans WHERE company_plans.name = v.name);
