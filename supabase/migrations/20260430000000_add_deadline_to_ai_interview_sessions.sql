-- Add deadline column to ai_interview_sessions (if missing)
ALTER TABLE public.ai_interview_sessions
ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ;
