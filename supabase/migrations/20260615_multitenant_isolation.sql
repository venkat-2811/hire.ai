-- =============================================================================
-- Migration: Multi-Tenant Data Isolation (Defense-in-Depth)
-- Date: 2026-06-15
-- Purpose: Strengthen tenant isolation at the database level as a
--          defense-in-depth layer complementing application-level guards.
--
-- NOTE: The primary enforcement of tenant isolation is in the Python service
-- layer (tenant_guards.py and endpoint-level checks). The backend uses the
-- Supabase service_role key which bypasses RLS. These SQL changes add:
--   1. A recruiter_id column to job_applications for audit trails and
--      potential future RLS-based enforcement.
--   2. Fix the existing overly-permissive RLS policy on job_applications
--      that allowed any authenticated user to read all applications.
--   3. An index to make tenant-scoped queries faster.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add recruiter_id to job_applications for audit trail
-- ---------------------------------------------------------------------------
ALTER TABLE public.job_applications
    ADD COLUMN IF NOT EXISTS recruiter_id TEXT;

-- Backfill recruiter_id from the owning job_descriptions record
UPDATE public.job_applications ja
SET recruiter_id = jd.created_by
FROM public.job_descriptions jd
WHERE ja.job_id = jd.id
  AND ja.recruiter_id IS NULL;

-- Index for faster tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_job_applications_recruiter_id
    ON public.job_applications (recruiter_id);

-- ---------------------------------------------------------------------------
-- 2. Fix the overly-permissive RLS policy on job_applications
--    The previous policy allowed ANY authenticated user to SELECT all rows.
--    Replace it with a policy scoped to the owning recruiter.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.job_applications;
DROP POLICY IF EXISTS "Allow authenticated insert access" ON public.job_applications;
DROP POLICY IF EXISTS "Allow authenticated update access" ON public.job_applications;

-- Recruiters can only read applications for jobs they own
CREATE POLICY "Recruiters read own job applications"
    ON public.job_applications
    FOR SELECT
    TO authenticated
    USING (
        recruiter_id = auth.uid()::text
        OR EXISTS (
            SELECT 1 FROM public.job_descriptions jd
            WHERE jd.id = job_applications.job_id
              AND jd.created_by = auth.uid()::text
        )
    );

-- Recruiters can insert applications only for their own jobs
CREATE POLICY "Recruiters insert into own job applications"
    ON public.job_applications
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.job_descriptions jd
            WHERE jd.id = job_applications.job_id
              AND jd.created_by = auth.uid()::text
        )
    );

-- Recruiters can update only applications for their own jobs
CREATE POLICY "Recruiters update own job applications"
    ON public.job_applications
    FOR UPDATE
    TO authenticated
    USING (
        recruiter_id = auth.uid()::text
        OR EXISTS (
            SELECT 1 FROM public.job_descriptions jd
            WHERE jd.id = job_applications.job_id
              AND jd.created_by = auth.uid()::text
        )
    );

-- Service role retains full access (used by backend admin client)
-- This policy should already exist from create_missing_tables.sql but we
-- ensure it here idempotently.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'job_applications'
          AND policyname = 'Service role has full access to job_applications'
    ) THEN
        CREATE POLICY "Service role has full access to job_applications"
            ON public.job_applications
            FOR ALL
            TO service_role
            USING (true);
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Add a trigger to auto-populate recruiter_id on INSERT
--    so new records are always stamped with the owning recruiter.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_job_application_recruiter_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.recruiter_id IS NULL THEN
        SELECT jd.created_by INTO NEW.recruiter_id
        FROM public.job_descriptions jd
        WHERE jd.id = NEW.job_id
        LIMIT 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_job_application_recruiter_id ON public.job_applications;
CREATE TRIGGER trg_set_job_application_recruiter_id
    BEFORE INSERT ON public.job_applications
    FOR EACH ROW
    EXECUTE FUNCTION public.set_job_application_recruiter_id();

SELECT 'Multi-tenant isolation migration completed successfully' AS status;
