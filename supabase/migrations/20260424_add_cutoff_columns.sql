-- Migration: Add score cutoff columns to job_descriptions
-- These are used by the Results Dashboard to filter/sort candidates by performance thresholds.

DO $$
BEGIN
  -- resume_cutoff: minimum ATS/resume score to pass to next stage (0-100)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_descriptions' AND column_name = 'resume_cutoff'
  ) THEN
    ALTER TABLE job_descriptions ADD COLUMN resume_cutoff INTEGER NOT NULL DEFAULT 0;
    COMMENT ON COLUMN job_descriptions.resume_cutoff IS 'Minimum resume/ATS score (0-100) required to proceed';
  END IF;

  -- assessment_cutoff: minimum technical assessment score (0-100)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_descriptions' AND column_name = 'assessment_cutoff'
  ) THEN
    ALTER TABLE job_descriptions ADD COLUMN assessment_cutoff INTEGER NOT NULL DEFAULT 0;
    COMMENT ON COLUMN job_descriptions.assessment_cutoff IS 'Minimum assessment score (0-100) required to proceed';
  END IF;

  -- interview_cutoff: minimum AI interview score (0-100)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_descriptions' AND column_name = 'interview_cutoff'
  ) THEN
    ALTER TABLE job_descriptions ADD COLUMN interview_cutoff INTEGER NOT NULL DEFAULT 0;
    COMMENT ON COLUMN job_descriptions.interview_cutoff IS 'Minimum interview score (0-100) required to proceed';
  END IF;
END $$;
