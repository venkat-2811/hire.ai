-- RUN THIS IN SUPABASE SQL EDITOR
-- Migration: Per-Tenant Candidate Overrides
-- File: 20260615_candidate_overrides.sql

ALTER TABLE public.job_applications
    ADD COLUMN IF NOT EXISTS candidate_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Index for fast look-up when merging overrides
CREATE INDEX IF NOT EXISTS idx_job_applications_candidate_overrides
    ON public.job_applications USING gin(candidate_overrides)
    WHERE candidate_overrides != '{}'::jsonb;

SELECT 'candidate_overrides column added successfully' AS status;
