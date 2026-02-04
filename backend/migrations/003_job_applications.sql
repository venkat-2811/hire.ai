-- Job Applications table to track candidate applications to specific jobs
CREATE TABLE IF NOT EXISTS job_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES job_descriptions(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'applied',
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    screening_status VARCHAR(50) DEFAULT NULL,
    assessment_status VARCHAR(50) DEFAULT NULL,
    assessment_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    assessment_completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    interview_status VARCHAR(50) DEFAULT NULL,
    interview_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    interview_completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    final_status VARCHAR(50) DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(candidate_id, job_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_job_applications_job_id ON job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_candidate_id ON job_applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON job_applications(status);

-- Enable RLS
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read all applications
CREATE POLICY "Allow authenticated read access" ON job_applications
    FOR SELECT TO authenticated USING (true);

-- Policy for authenticated users to insert applications
CREATE POLICY "Allow authenticated insert access" ON job_applications
    FOR INSERT TO authenticated WITH CHECK (true);

-- Policy for authenticated users to update applications
CREATE POLICY "Allow authenticated update access" ON job_applications
    FOR UPDATE TO authenticated USING (true);

-- Policy for service role full access
CREATE POLICY "Allow service role full access" ON job_applications
    FOR ALL TO service_role USING (true);

-- Add application_link column to job_descriptions if not exists
ALTER TABLE job_descriptions 
ADD COLUMN IF NOT EXISTS application_link VARCHAR(255) DEFAULT NULL;
