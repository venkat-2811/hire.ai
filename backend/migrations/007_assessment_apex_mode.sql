-- Add Phase-1 Apex mode flag for Salesforce assessments
-- This flag enables LLM-only Apex evaluation (no real execution).

ALTER TABLE assessment_sessions
ADD COLUMN IF NOT EXISTS is_apex_mode BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_assessment_sessions_is_apex_mode
  ON assessment_sessions(is_apex_mode);

