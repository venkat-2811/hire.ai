-- Add manual interview evaluation fields to job_applications

ALTER TABLE public.job_applications
ADD COLUMN IF NOT EXISTS interview_mode TEXT NOT NULL DEFAULT 'ai',
ADD COLUMN IF NOT EXISTS manual_interview_score NUMERIC,
ADD COLUMN IF NOT EXISTS manual_interview_feedback TEXT,
ADD COLUMN IF NOT EXISTS manual_interview_notes TEXT,
ADD COLUMN IF NOT EXISTS manual_interview_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS manual_interview_entered_by TEXT;

CREATE INDEX IF NOT EXISTS idx_job_applications_interview_mode ON public.job_applications(interview_mode);
