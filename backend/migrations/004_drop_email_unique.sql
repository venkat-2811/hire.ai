-- Drop the unique constraint on candidates.email to allow
-- the same person (email) to apply to multiple jobs.
-- Uniqueness is enforced at the job_applications level via UNIQUE(candidate_id, job_id).

DROP INDEX IF EXISTS uq_candidates_email;
