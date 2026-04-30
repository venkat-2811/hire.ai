-- Create offer_letters table to track offer letter status and acceptance
CREATE TABLE IF NOT EXISTS offer_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES job_descriptions(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  ctc TEXT,
  time_period_years INTEGER,
  time_period_months INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  signature_full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on token for quick lookups
CREATE INDEX IF NOT EXISTS idx_offer_letters_token ON offer_letters(token);
CREATE INDEX IF NOT EXISTS idx_offer_letters_candidate_id ON offer_letters(candidate_id);
CREATE INDEX IF NOT EXISTS idx_offer_letters_job_id ON offer_letters(job_id);
CREATE INDEX IF NOT EXISTS idx_offer_letters_status ON offer_letters(status);

-- Add comment
COMMENT ON TABLE offer_letters IS 'Stores offer letter details and acceptance status';
