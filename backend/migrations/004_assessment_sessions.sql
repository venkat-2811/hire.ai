-- Assessment Sessions table for tracking technical assessments
CREATE TABLE IF NOT EXISTS assessment_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES job_descriptions(id) ON DELETE CASCADE,
    token VARCHAR(64) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    proctoring_data JSONB DEFAULT '{}',
    mcq_submissions JSONB DEFAULT '[]',
    coding_submissions JSONB DEFAULT '[]',
    mcq_score DECIMAL(5,2) DEFAULT NULL,
    coding_score DECIMAL(5,2) DEFAULT NULL,
    total_score DECIMAL(5,2) DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_token ON assessment_sessions(token);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_candidate ON assessment_sessions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_job ON assessment_sessions(job_id);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_status ON assessment_sessions(status);

-- Enable RLS
ALTER TABLE assessment_sessions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow service role full access" ON assessment_sessions
    FOR ALL TO service_role USING (true);

CREATE POLICY "Allow authenticated read" ON assessment_sessions
    FOR SELECT TO authenticated USING (true);
