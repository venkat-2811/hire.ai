-- Migration to add sql_score to assessment_sessions
ALTER TABLE assessment_sessions ADD COLUMN IF NOT EXISTS sql_score DECIMAL(5,2) DEFAULT NULL;
