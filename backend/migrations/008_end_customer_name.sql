-- Add end_customer and end_customer_name columns to job_descriptions
ALTER TABLE public.job_descriptions
  ADD COLUMN IF NOT EXISTS end_customer text NULL,
  ADD COLUMN IF NOT EXISTS end_customer_name text NULL;
