-- ============================================================
-- LinkedIn Talent Discovery Tables
-- Run this in your Supabase SQL editor
-- ============================================================

-- Table: linkedin_searches
-- Stores each search session so history can be replayed
CREATE TABLE IF NOT EXISTS linkedin_searches (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          uuid        NOT NULL REFERENCES job_descriptions(id) ON DELETE CASCADE,
  recruiter_id    text        NOT NULL,
  filters         jsonb       NOT NULL DEFAULT '{}',
  candidate_count_requested  int  NOT NULL DEFAULT 10,
  profiles_retrieved         int  NOT NULL DEFAULT 0,
  candidates_contacted       int  NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS linkedin_searches_job_id_idx
  ON linkedin_searches(job_id);

CREATE INDEX IF NOT EXISTS linkedin_searches_recruiter_id_idx
  ON linkedin_searches(recruiter_id);

-- Table: linkedin_saved_candidates
-- Stores LinkedIn profiles saved during talent discovery
CREATE TABLE IF NOT EXISTS linkedin_saved_candidates (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              uuid        NOT NULL REFERENCES job_descriptions(id) ON DELETE CASCADE,
  recruiter_id        text        NOT NULL,
  search_id           uuid        REFERENCES linkedin_searches(id) ON DELETE SET NULL,
  linkedin_id         text,           -- Unipile provider_id
  public_identifier   text,           -- LinkedIn public identifier (e.g. "satyanadella")
  profile_data        jsonb       NOT NULL DEFAULT '{}',
  match_score         int         NOT NULL DEFAULT 0,
  ai_summary          text        NOT NULL DEFAULT '',
  notes               text        NOT NULL DEFAULT '',
  tags                text[]      NOT NULL DEFAULT '{}',
  status              text        NOT NULL DEFAULT 'saved'
                        CHECK (status IN ('saved', 'contacted', 'interested', 'archived')),
  contacted_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS linkedin_saved_candidates_job_id_idx
  ON linkedin_saved_candidates(job_id);

CREATE INDEX IF NOT EXISTS linkedin_saved_candidates_recruiter_id_idx
  ON linkedin_saved_candidates(recruiter_id);

CREATE INDEX IF NOT EXISTS linkedin_saved_candidates_status_idx
  ON linkedin_saved_candidates(status);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_linkedin_saved_candidates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS linkedin_saved_candidates_updated_at_trigger
  ON linkedin_saved_candidates;

CREATE TRIGGER linkedin_saved_candidates_updated_at_trigger
  BEFORE UPDATE ON linkedin_saved_candidates
  FOR EACH ROW
  EXECUTE FUNCTION update_linkedin_saved_candidates_updated_at();

-- Row-Level Security: recruiters can only access their own records
ALTER TABLE linkedin_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_saved_candidates ENABLE ROW LEVEL SECURITY;
