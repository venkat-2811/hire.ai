-- Add stored questions/challenges and configuration fields to assessment sessions
ALTER TABLE assessment_sessions
    ADD COLUMN IF NOT EXISTS mcq_questions JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS coding_challenges JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS mcq_question_count INTEGER DEFAULT 20,
    ADD COLUMN IF NOT EXISTS coding_challenge_count INTEGER DEFAULT 2,
    ADD COLUMN IF NOT EXISTS total_time_minutes INTEGER DEFAULT 90;
