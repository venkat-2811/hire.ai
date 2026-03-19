-- Add interview_question_pool column to job_descriptions
-- This stores a pre-generated pool of interview questions per job
-- so candidates get randomized subsets instead of the same questions

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'job_descriptions'
      AND column_name = 'interview_question_pool'
  ) THEN
    ALTER TABLE public.job_descriptions
      ADD COLUMN interview_question_pool jsonb DEFAULT NULL;
  END IF;
END $$;
