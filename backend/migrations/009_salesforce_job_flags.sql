-- Migration 009: Add recruiter-controlled Salesforce assessment flags to job_descriptions
-- These replace the automatic Salesforce detection logic.
-- is_salesforce_job:      Recruiter marks the job as Salesforce-related at creation time.
-- include_apex_assessment: Recruiter opts-in to Apex fill-in-the-blanks questions.
--                          Can only be TRUE when is_salesforce_job is TRUE (enforced by constraint).
--
-- Existing jobs default to FALSE / FALSE (backward-compatible, standard DSA flow).

ALTER TABLE job_descriptions
  ADD COLUMN IF NOT EXISTS is_salesforce_job        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS include_apex_assessment  BOOLEAN NOT NULL DEFAULT FALSE;

-- Enforce: include_apex_assessment can only be TRUE when is_salesforce_job is TRUE.
ALTER TABLE job_descriptions
  DROP CONSTRAINT IF EXISTS chk_apex_requires_salesforce;

ALTER TABLE job_descriptions
  ADD CONSTRAINT chk_apex_requires_salesforce
    CHECK (include_apex_assessment = FALSE OR is_salesforce_job = TRUE);

CREATE INDEX IF NOT EXISTS idx_job_descriptions_is_salesforce_job
  ON job_descriptions(is_salesforce_job);

CREATE INDEX IF NOT EXISTS idx_job_descriptions_include_apex
  ON job_descriptions(include_apex_assessment);
