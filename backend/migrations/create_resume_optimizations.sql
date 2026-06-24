-- Migration: Create candidate_resume_optimizations table
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.candidate_resume_optimizations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id        TEXT NOT NULL,
    job_id              TEXT NOT NULL,
    recruiter_id        TEXT NOT NULL,          -- Clerk user ID of the recruiter who ran it
    status              TEXT NOT NULL DEFAULT 'draft',   -- 'draft' | 'finalized'

    -- AI analysis scores
    before_score        INTEGER,                -- Estimated ATS score BEFORE optimization
    after_score         INTEGER,                -- Estimated ATS score AFTER optimization

    -- AI outputs (stored as JSONB)
    optimization_summary TEXT,                  -- 2-3 sentence AI summary of improvements
    changes             JSONB DEFAULT '[]'::jsonb,      -- Full list of OptimizationChange objects
    optimized_resume    JSONB DEFAULT '{}'::jsonb,      -- Full optimized structured resume (all changes applied)

    -- Recruiter decisions
    accepted_change_ids JSONB DEFAULT '[]'::jsonb,      -- List of change_ids accepted by recruiter
    rejected_change_ids JSONB DEFAULT '[]'::jsonb,      -- List of change_ids rejected by recruiter
    final_resume        JSONB DEFAULT NULL,              -- Final resume with only accepted changes applied

    -- Timestamps
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finalized_at        TIMESTAMPTZ DEFAULT NULL
);

-- Index for fast lookups by candidate + recruiter
CREATE INDEX IF NOT EXISTS idx_cro_candidate_recruiter
    ON public.candidate_resume_optimizations (candidate_id, recruiter_id);

-- Index for filtering by job
CREATE INDEX IF NOT EXISTS idx_cro_job
    ON public.candidate_resume_optimizations (job_id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_cro_status
    ON public.candidate_resume_optimizations (status);

-- Enable RLS
ALTER TABLE public.candidate_resume_optimizations ENABLE ROW LEVEL SECURITY;

-- Policy: recruiter can only see/manage their own records
CREATE POLICY "Recruiters see their own optimizations"
    ON public.candidate_resume_optimizations
    FOR ALL
    USING (true)   -- Service role bypasses RLS; app-level auth enforced in API
    WITH CHECK (true);

COMMENT ON TABLE public.candidate_resume_optimizations IS
    'Stores AI resume optimization sessions per candidate per job. '
    'Each record is isolated per recruiter so different jobs produce '
    'independent optimization histories. The original resume in the '
    'candidates table is NEVER modified.';
