-- Add question_count to ai_interview_sessions (if missing)

ALTER TABLE public.ai_interview_sessions
ADD COLUMN IF NOT EXISTS question_count INTEGER DEFAULT 10;
