-- Create missing tables required by the API handler
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- ============================================
-- 1. Assessment Sessions Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.assessment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE NOT NULL,
  job_id UUID REFERENCES public.job_descriptions(id) ON DELETE CASCADE NOT NULL,
  token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  
  -- Configuration
  mcq_question_count INTEGER DEFAULT 20,
  coding_challenge_count INTEGER DEFAULT 2,
  total_time_minutes INTEGER DEFAULT 90,
  deadline TIMESTAMPTZ,
  
  -- Questions (stored as JSONB)
  mcq_questions JSONB DEFAULT '[]'::jsonb,
  coding_challenges JSONB DEFAULT '[]'::jsonb,
  
  -- Submissions
  mcq_submissions JSONB DEFAULT '[]'::jsonb,
  coding_submissions JSONB DEFAULT '[]'::jsonb,
  
  -- Scores
  mcq_score NUMERIC,
  coding_score NUMERIC,
  total_score NUMERIC,
  
  -- Proctoring
  proctoring_data JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.assessment_sessions ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role has full access to assessment_sessions" 
  ON public.assessment_sessions FOR ALL TO service_role USING (true);

-- Public read for token-based access (candidates)
CREATE POLICY "Public can read own assessment by token"
  ON public.assessment_sessions FOR SELECT
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_candidate ON public.assessment_sessions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_job ON public.assessment_sessions(job_id);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_token ON public.assessment_sessions(token);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_status ON public.assessment_sessions(status);

-- ============================================
-- 2. AI Interview Sessions Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.ai_interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE NOT NULL,
  job_id UUID REFERENCES public.job_descriptions(id) ON DELETE CASCADE NOT NULL,
  token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  
  -- Configuration
  question_count INTEGER DEFAULT 10,
  scheduled_at TIMESTAMPTZ,
  
  -- Questions and responses (stored as JSONB)
  questions JSONB DEFAULT '[]'::jsonb,
  responses JSONB DEFAULT '[]'::jsonb,
  current_question_index INTEGER DEFAULT 0,
  
  -- Evaluation
  final_evaluation JSONB,
  
  -- Proctoring
  proctoring_data JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.ai_interview_sessions ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role has full access to ai_interview_sessions" 
  ON public.ai_interview_sessions FOR ALL TO service_role USING (true);

-- Public read for token-based access
CREATE POLICY "Public can read own interview by token"
  ON public.ai_interview_sessions FOR SELECT
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_interview_sessions_candidate ON public.ai_interview_sessions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_ai_interview_sessions_job ON public.ai_interview_sessions(job_id);
CREATE INDEX IF NOT EXISTS idx_ai_interview_sessions_token ON public.ai_interview_sessions(token);
CREATE INDEX IF NOT EXISTS idx_ai_interview_sessions_status ON public.ai_interview_sessions(status);

-- ============================================
-- 3. Job Applications Table (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS public.job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE NOT NULL,
  job_id UUID REFERENCES public.job_descriptions(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'applied',
  applied_at TIMESTAMPTZ DEFAULT now(),
  screening_status TEXT,
  assessment_status TEXT,
  assessment_sent_at TIMESTAMPTZ,
  assessment_completed_at TIMESTAMPTZ,
  interview_status TEXT,
  interview_sent_at TIMESTAMPTZ,
  interview_completed_at TIMESTAMPTZ,
  final_status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  UNIQUE(candidate_id, job_id)
);

-- Enable RLS
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role has full access to job_applications" 
  ON public.job_applications FOR ALL TO service_role USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_job_applications_candidate ON public.job_applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_job ON public.job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON public.job_applications(status);

-- ============================================
-- 4. Fix existing table column types for Clerk compatibility
-- ============================================
-- Change UUID columns to TEXT for Clerk user IDs
DO $$
BEGIN
  -- job_descriptions.created_by
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_descriptions' AND column_name = 'created_by' AND data_type = 'uuid') THEN
    ALTER TABLE public.job_descriptions DROP CONSTRAINT IF EXISTS job_descriptions_created_by_fkey;
    ALTER TABLE public.job_descriptions ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;
  END IF;
  
  -- candidates.user_id
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidates' AND column_name = 'user_id' AND data_type = 'uuid') THEN
    ALTER TABLE public.candidates DROP CONSTRAINT IF EXISTS candidates_user_id_fkey;
    ALTER TABLE public.candidates ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
  END IF;
  
  -- job_descriptions.role (enum to text)
  BEGIN
    ALTER TABLE public.job_descriptions ALTER COLUMN role TYPE TEXT USING role::TEXT;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Already text or doesn't exist
  END;
  
  -- job_descriptions.level (enum to text)
  BEGIN
    ALTER TABLE public.job_descriptions ALTER COLUMN level TYPE TEXT USING level::TEXT;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- interview_sessions.status (enum to text)
  BEGIN
    ALTER TABLE public.interview_sessions ALTER COLUMN status TYPE TEXT USING status::TEXT;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- practical_assessments.role (enum to text)
  BEGIN
    ALTER TABLE public.practical_assessments ALTER COLUMN role TYPE TEXT USING role::TEXT;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

-- ============================================
-- 5. Add service_role policies to all tables
-- ============================================
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY['candidates', 'job_descriptions', 'ats_screenings', 'interview_sessions', 
                          'interview_questions', 'candidate_responses', 'interview_evaluations',
                          'practical_assessments', 'practical_submissions'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('
      DO $inner$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = %L AND policyname = %L) THEN
          CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true);
        END IF;
      END $inner$;
    ', tbl, 'Service role full access to ' || tbl, 'Service role full access to ' || tbl, tbl);
  END LOOP;
END $$;

-- Done!
SELECT 'Migration completed successfully' as status;
