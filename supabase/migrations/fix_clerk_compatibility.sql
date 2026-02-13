-- Fix schema for Clerk authentication compatibility
-- Clerk user IDs are strings like "user_abc123", not UUIDs
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- 1. Drop the foreign key constraint on job_descriptions.created_by (references auth.users)
ALTER TABLE public.job_descriptions DROP CONSTRAINT IF EXISTS job_descriptions_created_by_fkey;

-- 2. Change created_by from uuid to text
ALTER TABLE public.job_descriptions ALTER COLUMN created_by TYPE text USING created_by::text;

-- 3. Drop the foreign key constraint on candidates.user_id (references auth.users)
ALTER TABLE public.candidates DROP CONSTRAINT IF EXISTS candidates_user_id_fkey;

-- 4. Change user_id from uuid to text
ALTER TABLE public.candidates ALTER COLUMN user_id TYPE text USING user_id::text;

-- 5. Change role column from enum to text (so any role string can be stored)
ALTER TABLE public.job_descriptions ALTER COLUMN role TYPE text USING role::text;

-- 6. Change level column from enum to text (keeps same values but no enum restriction)
ALTER TABLE public.job_descriptions ALTER COLUMN level TYPE text USING level::text;

-- 7. Change role column in practical_assessments from enum to text
ALTER TABLE public.practical_assessments ALTER COLUMN role TYPE text USING role::text;

-- 8. Change status column in interview_sessions from enum to text (if it's still enum)
ALTER TABLE public.interview_sessions ALTER COLUMN status TYPE text USING status::text;

-- 9. Ensure must_have_skills and good_to_have_skills are JSONB (not text[])
-- Only run these if the columns are currently text[] type:
-- ALTER TABLE public.job_descriptions ALTER COLUMN must_have_skills TYPE jsonb USING to_jsonb(must_have_skills);
-- ALTER TABLE public.job_descriptions ALTER COLUMN good_to_have_skills TYPE jsonb USING to_jsonb(good_to_have_skills);

-- 10. Add RLS policy for service_role to bypass all restrictions on key tables
-- (The serverless functions use the service_role key)
DO $$
BEGIN
  -- job_descriptions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'job_descriptions' AND policyname = 'Service role has full access to job_descriptions') THEN
    CREATE POLICY "Service role has full access to job_descriptions" ON public.job_descriptions FOR ALL TO service_role USING (true);
  END IF;

  -- candidates
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'candidates' AND policyname = 'Service role has full access to candidates') THEN
    CREATE POLICY "Service role has full access to candidates" ON public.candidates FOR ALL TO service_role USING (true);
  END IF;

  -- ats_screenings
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ats_screenings' AND policyname = 'Service role has full access to ats_screenings') THEN
    CREATE POLICY "Service role has full access to ats_screenings" ON public.ats_screenings FOR ALL TO service_role USING (true);
  END IF;

  -- interview_sessions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'interview_sessions' AND policyname = 'Service role has full access to interview_sessions') THEN
    CREATE POLICY "Service role has full access to interview_sessions" ON public.interview_sessions FOR ALL TO service_role USING (true);
  END IF;

  -- interview_questions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'interview_questions' AND policyname = 'Service role has full access to interview_questions') THEN
    CREATE POLICY "Service role has full access to interview_questions" ON public.interview_questions FOR ALL TO service_role USING (true);
  END IF;

  -- candidate_responses
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'candidate_responses' AND policyname = 'Service role has full access to candidate_responses') THEN
    CREATE POLICY "Service role has full access to candidate_responses" ON public.candidate_responses FOR ALL TO service_role USING (true);
  END IF;

  -- interview_evaluations
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'interview_evaluations' AND policyname = 'Service role has full access to interview_evaluations') THEN
    CREATE POLICY "Service role has full access to interview_evaluations" ON public.interview_evaluations FOR ALL TO service_role USING (true);
  END IF;

  -- practical_assessments
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'practical_assessments' AND policyname = 'Service role has full access to practical_assessments') THEN
    CREATE POLICY "Service role has full access to practical_assessments" ON public.practical_assessments FOR ALL TO service_role USING (true);
  END IF;

  -- practical_submissions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'practical_submissions' AND policyname = 'Service role has full access to practical_submissions') THEN
    CREATE POLICY "Service role has full access to practical_submissions" ON public.practical_submissions FOR ALL TO service_role USING (true);
  END IF;

  -- job_applications
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'job_applications' AND policyname = 'Service role has full access to job_applications') THEN
    CREATE POLICY "Service role has full access to job_applications" ON public.job_applications FOR ALL TO service_role USING (true);
  END IF;
END $$;
