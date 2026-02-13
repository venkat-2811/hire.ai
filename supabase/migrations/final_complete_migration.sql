-- ============================================
-- COMPLETE FINAL MIGRATION FOR TALENT-SCOUT-AI
-- Run this ONCE in Supabase SQL Editor
-- ============================================

-- 1. Fix enum columns to TEXT for flexibility
DO $$
BEGIN
  -- interview_sessions.status
  BEGIN
    ALTER TABLE public.interview_sessions ALTER COLUMN status TYPE TEXT USING status::TEXT;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  -- job_descriptions.role
  BEGIN
    ALTER TABLE public.job_descriptions ALTER COLUMN role TYPE TEXT USING role::TEXT;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  -- job_descriptions.level
  BEGIN
    ALTER TABLE public.job_descriptions ALTER COLUMN level TYPE TEXT USING level::TEXT;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  -- practical_assessments.role
  BEGIN
    ALTER TABLE public.practical_assessments ALTER COLUMN role TYPE TEXT USING role::TEXT;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  -- interview_questions.question_type
  BEGIN
    ALTER TABLE public.interview_questions ALTER COLUMN question_type TYPE TEXT USING question_type::TEXT;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- 2. Fix UUID columns for Clerk compatibility (Clerk IDs are strings, not UUIDs)
DO $$
BEGIN
  -- job_descriptions.created_by
  ALTER TABLE public.job_descriptions DROP CONSTRAINT IF EXISTS job_descriptions_created_by_fkey;
  BEGIN
    ALTER TABLE public.job_descriptions ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  -- candidates.user_id
  ALTER TABLE public.candidates DROP CONSTRAINT IF EXISTS candidates_user_id_fkey;
  BEGIN
    ALTER TABLE public.candidates ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- 3. Ensure job_applications table exists
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
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

-- 4. Ensure assessment_sessions table exists
CREATE TABLE IF NOT EXISTS public.assessment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE NOT NULL,
  job_id UUID REFERENCES public.job_descriptions(id) ON DELETE CASCADE NOT NULL,
  token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  mcq_question_count INTEGER DEFAULT 20,
  coding_challenge_count INTEGER DEFAULT 2,
  total_time_minutes INTEGER DEFAULT 90,
  deadline TIMESTAMPTZ,
  mcq_questions JSONB DEFAULT '[]'::jsonb,
  coding_challenges JSONB DEFAULT '[]'::jsonb,
  mcq_submissions JSONB DEFAULT '[]'::jsonb,
  coding_submissions JSONB DEFAULT '[]'::jsonb,
  mcq_score NUMERIC,
  coding_score NUMERIC,
  total_score NUMERIC,
  proctoring_data JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);
ALTER TABLE public.assessment_sessions ENABLE ROW LEVEL SECURITY;

-- 5. Ensure ai_interview_sessions table exists
CREATE TABLE IF NOT EXISTS public.ai_interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE NOT NULL,
  job_id UUID REFERENCES public.job_descriptions(id) ON DELETE CASCADE NOT NULL,
  token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  question_count INTEGER DEFAULT 10,
  scheduled_at TIMESTAMPTZ,
  questions JSONB DEFAULT '[]'::jsonb,
  responses JSONB DEFAULT '[]'::jsonb,
  current_question_index INTEGER DEFAULT 0,
  final_evaluation JSONB,
  proctoring_data JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);
ALTER TABLE public.ai_interview_sessions ENABLE ROW LEVEL SECURITY;

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_applications_candidate ON public.job_applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_job ON public.job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_candidate ON public.assessment_sessions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_job ON public.assessment_sessions(job_id);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_token ON public.assessment_sessions(token);
CREATE INDEX IF NOT EXISTS idx_ai_interview_sessions_candidate ON public.ai_interview_sessions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_ai_interview_sessions_job ON public.ai_interview_sessions(job_id);
CREATE INDEX IF NOT EXISTS idx_ai_interview_sessions_token ON public.ai_interview_sessions(token);

-- 7. Add service_role policies for all tables (allows API to access everything)
DO $$
DECLARE
  tbl TEXT;
  policy_name TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'candidates', 'job_descriptions', 'ats_screenings', 'interview_sessions',
    'interview_questions', 'candidate_responses', 'interview_evaluations',
    'practical_assessments', 'practical_submissions', 'job_applications',
    'assessment_sessions', 'ai_interview_sessions'
  ]) LOOP
    policy_name := 'service_role_' || tbl;
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, tbl);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true)', policy_name, tbl);
    EXCEPTION WHEN OTHERS THEN
      -- Table might not exist, skip
      NULL;
    END;
  END LOOP;
END $$;

-- 8. Add public read policies for token-based access
DO $$
BEGIN
  BEGIN
    DROP POLICY IF EXISTS public_read_assessment ON public.assessment_sessions;
    CREATE POLICY public_read_assessment ON public.assessment_sessions FOR SELECT USING (true);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    DROP POLICY IF EXISTS public_read_interview ON public.ai_interview_sessions;
    CREATE POLICY public_read_interview ON public.ai_interview_sessions FOR SELECT USING (true);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    DROP POLICY IF EXISTS public_update_assessment ON public.assessment_sessions;
    CREATE POLICY public_update_assessment ON public.assessment_sessions FOR UPDATE USING (true);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    DROP POLICY IF EXISTS public_update_interview ON public.ai_interview_sessions;
    CREATE POLICY public_update_interview ON public.ai_interview_sessions FOR UPDATE USING (true);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- Done!
SELECT 'Migration completed successfully!' as status;
