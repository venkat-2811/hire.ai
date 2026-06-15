-- Migration to add sql_score to assessment_sessions
ALTER TABLE public.assessment_sessions ADD COLUMN IF NOT EXISTS sql_score NUMERIC DEFAULT NULL;
