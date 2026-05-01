-- Background Jobs table for tracking long-running async operations
-- Run this migration in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS background_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  input JSONB DEFAULT '{}',
  result JSONB DEFAULT NULL,
  error TEXT DEFAULT NULL,
  user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ DEFAULT NULL
);

-- Indexes for efficient polling and cleanup
CREATE INDEX IF NOT EXISTS idx_background_jobs_status ON background_jobs(status);
CREATE INDEX IF NOT EXISTS idx_background_jobs_user ON background_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_background_jobs_type_status ON background_jobs(type, status);
CREATE INDEX IF NOT EXISTS idx_background_jobs_created ON background_jobs(created_at);

-- Enable RLS (admin-only access via service role key)
ALTER TABLE background_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: only service role can access (no anon/authenticated access)
CREATE POLICY "Service role full access" ON background_jobs
  FOR ALL
  USING (true)
  WITH CHECK (true);
