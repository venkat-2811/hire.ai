-- Add structured offer acceptance audit fields to job_applications
ALTER TABLE public.job_applications
ADD COLUMN IF NOT EXISTS offer_signature_name TEXT,
ADD COLUMN IF NOT EXISTS offer_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS offer_acceptance_ip TEXT;

CREATE INDEX IF NOT EXISTS idx_job_applications_offer_accepted_at
  ON public.job_applications(offer_accepted_at);
