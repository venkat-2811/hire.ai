-- AI Interview Sessions table for speech-based AI interviews
CREATE TABLE IF NOT EXISTS ai_interview_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES job_descriptions(id) ON DELETE CASCADE,
    token VARCHAR(64) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    current_question_index INTEGER DEFAULT 0,
    questions JSONB DEFAULT '[]',
    responses JSONB DEFAULT '[]',
    proctoring_data JSONB DEFAULT '{}',
    final_evaluation JSONB DEFAULT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_interview_sessions_token ON ai_interview_sessions(token);
CREATE INDEX IF NOT EXISTS idx_ai_interview_sessions_candidate ON ai_interview_sessions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_ai_interview_sessions_job ON ai_interview_sessions(job_id);
CREATE INDEX IF NOT EXISTS idx_ai_interview_sessions_status ON ai_interview_sessions(status);

-- Enable RLS
ALTER TABLE ai_interview_sessions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow service role full access" ON ai_interview_sessions
    FOR ALL TO service_role USING (true);

CREATE POLICY "Allow authenticated read" ON ai_interview_sessions
    FOR SELECT TO authenticated USING (true);
