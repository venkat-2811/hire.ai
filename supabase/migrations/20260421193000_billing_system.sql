-- =====================================================
-- Migration: Wallet-based Billing System
-- =====================================================

-- Subscription records (separate from lightweight profile subscription columns)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  deposit_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  wallet_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  billing_cycle_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  billing_cycle_end TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 month'),
  overage_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  overage_cap NUMERIC(12,2),
  warning_80_sent_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  resumed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_plan_check CHECK (plan IN ('free', 'pro', 'premium')),
  CONSTRAINT subscriptions_status_check CHECK (status IN ('active', 'paused', 'overdue', 'cancel_at_period_end')),
  CONSTRAINT subscriptions_wallet_non_negative_check CHECK (wallet_balance >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_status ON public.subscriptions(plan, status);

-- Metered usage events (append-only)
CREATE TABLE IF NOT EXISTS public.usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  feature_type TEXT NOT NULL,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  total_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  job_id UUID,
  candidate_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_user_time ON public.usage_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_feature_time ON public.usage_events(feature_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_job_id ON public.usage_events(job_id);

-- Invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  due_date TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  payment_reference TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT invoices_status_check CHECK (status IN ('pending', 'paid', 'overdue', 'void'))
);

CREATE INDEX IF NOT EXISTS idx_invoices_user_status ON public.invoices(user_id, status, due_date DESC);

-- RLS and service role policies
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  BEGIN
    DROP POLICY IF EXISTS service_role_subscriptions ON public.subscriptions;
    CREATE POLICY service_role_subscriptions ON public.subscriptions FOR ALL TO service_role USING (true);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DROP POLICY IF EXISTS service_role_usage_events ON public.usage_events;
    CREATE POLICY service_role_usage_events ON public.usage_events FOR ALL TO service_role USING (true);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DROP POLICY IF EXISTS service_role_invoices ON public.invoices;
    CREATE POLICY service_role_invoices ON public.invoices FOR ALL TO service_role USING (true);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_updated_at_billing()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_billing();

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON public.invoices;
CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_billing();
