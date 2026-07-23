-- 1. Add company_id to existing tables (safe, nullable)
ALTER TABLE job_descriptions ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- Create indices for the new company_id columns to prevent N+1 and full table scans
CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON job_descriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_candidates_company_id ON candidates(company_id);
-- Also index created_by for fast recruiter-scoped queries
CREATE INDEX IF NOT EXISTS idx_jobs_created_by ON job_descriptions(created_by);


-- 2. Create the credit_transactions ledger table
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,  -- Clerk user ID string
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_credit_tx_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_company_id ON credit_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_created_at ON credit_transactions(created_at DESC);


-- 3. Add missing index on company_members for fast membership lookups
CREATE INDEX IF NOT EXISTS idx_company_members_user_id ON company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_company_members_status ON company_members(status);
CREATE INDEX IF NOT EXISTS idx_company_members_company_id ON company_members(company_id);
