-- Migration 014: Add work_authorization and employment_type to candidates
-- These are optional fields for new candidates only.
-- Existing candidates remain unaffected (columns default to NULL).

ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS work_authorization text NULL;

ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS employment_type text NULL;

-- Optional: add comments for documentation
COMMENT ON COLUMN public.candidates.work_authorization IS
  'Candidate work authorization status (e.g. US Citizen, H1B, OPT, etc.)';

COMMENT ON COLUMN public.candidates.employment_type IS
  'Preferred or agreed employment type (e.g. Full Time, Contract, Part Time, etc.)';
