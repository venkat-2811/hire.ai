-- Migration 013: Billing Usage History
-- Run this in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.billing_usage_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recruiter_id UUID NOT NULL,
    candidate_id UUID NULL REFERENCES public.candidates(id) ON DELETE SET NULL,
    job_id UUID NULL REFERENCES public.job_descriptions(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    points_used NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Note: We do not add strict foreign keys to profiles table because 
-- profiles might be managed via auth.users and may not be in public schema in all setups,
-- but recruiter_id matches user_id.

CREATE INDEX IF NOT EXISTS idx_billing_usage_history_recruiter ON public.billing_usage_history(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_billing_usage_history_created_at ON public.billing_usage_history(created_at DESC);
