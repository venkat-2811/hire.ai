-- 1. Add company_id to existing tables
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- Create indices for the new company_id columns to prevent N+1 and full table scans
CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_candidates_company_id ON candidates(company_id);
CREATE INDEX IF NOT EXISTS idx_assessments_company_id ON assessments(company_id);
CREATE INDEX IF NOT EXISTS idx_interviews_company_id ON interviews(company_id);


-- 2. Create the credit_transactions ledger table
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE, -- NULL means individual transaction
    action_type TEXT NOT NULL, -- e.g., 'candidate_added', 'assessment_sent', 'baseline_sync'
    amount NUMERIC(10, 2) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_credit_tx_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_company_id ON credit_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_action ON credit_transactions(action_type);


-- 3. Create RPC for atomic credit deduction
-- This function will insert a ledger row and update the appropriate aggregate in a single transaction
CREATE OR REPLACE FUNCTION deduct_credit_atomic(
    p_user_id TEXT,
    p_company_id UUID, -- If provided, deducts from company. If NULL, deducts from individual profile.
    p_action_type TEXT,
    p_amount NUMERIC,
    p_metadata JSONB,
    p_member_id UUID DEFAULT NULL -- Only required if p_company_id is provided, to update the member's consumed slot
) RETURNS BOOLEAN AS $$
DECLARE
    v_allocated NUMERIC;
    v_consumed NUMERIC;
    v_limit NUMERIC;
    v_prof_count NUMERIC;
BEGIN
    -- 1. Insert Ledger Transaction
    INSERT INTO credit_transactions (user_id, company_id, action_type, amount, metadata)
    VALUES (p_user_id, p_company_id, p_action_type, p_amount, p_metadata);

    -- 2. Update Aggregates
    IF p_company_id IS NOT NULL AND p_member_id IS NOT NULL THEN
        -- Verify limits and update company_members
        SELECT credits_allocated, credits_consumed INTO v_allocated, v_consumed
        FROM company_members
        WHERE id = p_member_id FOR UPDATE;

        IF v_consumed + p_amount > v_allocated THEN
            RAISE EXCEPTION 'Company member credit limit exceeded.';
        END IF;

        UPDATE company_members 
        SET credits_consumed = credits_consumed + p_amount,
            updated_at = timezone('utc'::text, now())
        WHERE id = p_member_id;

        -- Update company_credits pool
        UPDATE company_credits
        SET total_consumed = total_consumed + p_amount,
            updated_at = timezone('utc'::text, now())
        WHERE company_id = p_company_id;
        
    ELSE
        -- Individual profile update
        SELECT candidates_limit, candidates_count INTO v_limit, v_prof_count
        FROM profiles
        WHERE user_id = p_user_id FOR UPDATE;

        IF v_prof_count + p_amount > COALESCE(v_limit, 999999999) THEN
            RAISE EXCEPTION 'Individual credit limit exceeded.';
        END IF;

        UPDATE profiles
        SET candidates_count = candidates_count + p_amount
        WHERE user_id = p_user_id;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
