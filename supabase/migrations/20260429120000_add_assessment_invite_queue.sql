-- Create table for tracking async assessment invite processing
CREATE TABLE IF NOT EXISTS public.assessment_invite_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  job_id UUID REFERENCES public.job_descriptions(id) ON DELETE CASCADE NOT NULL,
  candidate_ids JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  error_message TEXT,
  deadline_hours INTEGER DEFAULT 72,
  include_mcq BOOLEAN DEFAULT true,
  include_coding BOOLEAN DEFAULT true,
  mcq_question_count INTEGER DEFAULT 20,
  coding_challenge_count INTEGER DEFAULT 2,
  difficulty TEXT DEFAULT 'medium',
  total_time_minutes INTEGER,
  invites_sent INTEGER DEFAULT 0,
  failed_candidates JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_assessment_invite_queue_user_id ON public.assessment_invite_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_assessment_invite_queue_status ON public.assessment_invite_queue(status);
CREATE INDEX IF NOT EXISTS idx_assessment_invite_queue_created_at ON public.assessment_invite_queue(created_at DESC);

-- Enable RLS
ALTER TABLE public.assessment_invite_queue ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own invite queue entries
CREATE POLICY "Users can view own assessment invite queue"
  ON public.assessment_invite_queue
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own invite queue entries
CREATE POLICY "Users can insert own assessment invite queue"
  ON public.assessment_invite_queue
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Service role can update all entries (for background worker)
CREATE POLICY "Service role can update assessment invite queue"
  ON public.assessment_invite_queue
  FOR UPDATE
  USING (auth.role() = 'service_role');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_assessment_invite_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER assessment_invite_queue_updated_at
  BEFORE UPDATE ON public.assessment_invite_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_assessment_invite_queue_updated_at();
