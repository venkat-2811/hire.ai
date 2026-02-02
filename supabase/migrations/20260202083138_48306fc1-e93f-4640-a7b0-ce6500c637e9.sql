-- AI Interview & Hiring Platform Database Schema

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ENUM Types
CREATE TYPE public.job_role AS ENUM ('salesforce_developer', 'qa_engineer', 'business_analyst');
CREATE TYPE public.role_level AS ENUM ('intern', 'junior', 'mid', 'senior');
CREATE TYPE public.interview_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.assessment_type AS ENUM ('technical', 'practical', 'behavioral');
CREATE TYPE public.hire_recommendation AS ENUM ('strong_hire', 'hire', 'borderline', 'no_hire');

-- User Roles Table (for admin/recruiter access)
CREATE TYPE public.app_role AS ENUM ('admin', 'recruiter', 'interviewer', 'candidate');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'candidate',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security Definer Function for Role Checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Profiles Table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Job Descriptions Table
CREATE TABLE public.job_descriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  role job_role NOT NULL,
  level role_level NOT NULL,
  description TEXT NOT NULL,
  must_have_skills JSONB NOT NULL DEFAULT '[]',
  good_to_have_skills JSONB NOT NULL DEFAULT '[]',
  min_experience_years INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.job_descriptions ENABLE ROW LEVEL SECURITY;

-- Candidates Table
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  resume_url TEXT,
  resume_text TEXT,
  resume_parsed_data JSONB,
  portfolio_url TEXT,
  github_url TEXT,
  consent_given BOOLEAN NOT NULL DEFAULT false,
  consent_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

-- ATS Screening Results
CREATE TABLE public.ats_screenings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE NOT NULL,
  job_id UUID REFERENCES public.job_descriptions(id) ON DELETE CASCADE NOT NULL,
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  skill_relevance_score INTEGER CHECK (skill_relevance_score >= 0 AND skill_relevance_score <= 100),
  experience_score INTEGER CHECK (experience_score >= 0 AND experience_score <= 100),
  education_score INTEGER CHECK (education_score >= 0 AND education_score <= 100),
  credibility_score INTEGER CHECK (credibility_score >= 0 AND credibility_score <= 100),
  shortlisted BOOLEAN NOT NULL DEFAULT false,
  shortlist_reason TEXT,
  reason_codes JSONB NOT NULL DEFAULT '[]',
  detailed_analysis JSONB,
  screened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, job_id)
);

ALTER TABLE public.ats_screenings ENABLE ROW LEVEL SECURITY;

-- Interview Sessions
CREATE TABLE public.interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE NOT NULL,
  job_id UUID REFERENCES public.job_descriptions(id) ON DELETE CASCADE NOT NULL,
  screening_id UUID REFERENCES public.ats_screenings(id) ON DELETE SET NULL,
  status interview_status NOT NULL DEFAULT 'pending',
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  question_seed TEXT,
  proctoring_data JSONB DEFAULT '{"tabSwitches": 0, "copyPasteCount": 0, "fullscreenExits": 0}',
  integrity_score INTEGER CHECK (integrity_score >= 0 AND integrity_score <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;

-- Interview Questions
CREATE TABLE public.interview_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.interview_sessions(id) ON DELETE CASCADE NOT NULL,
  question_type assessment_type NOT NULL,
  question_text TEXT NOT NULL,
  expected_answer TEXT,
  difficulty_level INTEGER NOT NULL CHECK (difficulty_level >= 1 AND difficulty_level <= 5),
  max_score INTEGER NOT NULL DEFAULT 10,
  time_limit_seconds INTEGER,
  order_index INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.interview_questions ENABLE ROW LEVEL SECURITY;

-- Candidate Responses
CREATE TABLE public.candidate_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES public.interview_questions(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.interview_sessions(id) ON DELETE CASCADE NOT NULL,
  response_text TEXT,
  response_code TEXT,
  time_taken_seconds INTEGER,
  ai_score INTEGER CHECK (ai_score >= 0 AND ai_score <= 100),
  ai_feedback TEXT,
  manual_score INTEGER CHECK (manual_score >= 0 AND manual_score <= 100),
  manual_feedback TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.candidate_responses ENABLE ROW LEVEL SECURITY;

-- Interview Evaluations (Final Results)
CREATE TABLE public.interview_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.interview_sessions(id) ON DELETE CASCADE NOT NULL UNIQUE,
  technical_score INTEGER CHECK (technical_score >= 0 AND technical_score <= 100),
  problem_solving_score INTEGER CHECK (problem_solving_score >= 0 AND problem_solving_score <= 100),
  communication_score INTEGER CHECK (communication_score >= 0 AND communication_score <= 100),
  integrity_score INTEGER CHECK (integrity_score >= 0 AND integrity_score <= 100),
  role_fit_index INTEGER CHECK (role_fit_index >= 0 AND role_fit_index <= 100),
  overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
  recommendation hire_recommendation,
  strengths JSONB DEFAULT '[]',
  weaknesses JSONB DEFAULT '[]',
  detailed_feedback TEXT,
  evaluator_notes TEXT,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.interview_evaluations ENABLE ROW LEVEL SECURITY;

-- Practical Assessments (Role-specific tasks)
CREATE TABLE public.practical_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.interview_sessions(id) ON DELETE CASCADE NOT NULL,
  role job_role NOT NULL,
  task_title TEXT NOT NULL,
  task_description TEXT NOT NULL,
  starter_code TEXT,
  expected_output TEXT,
  evaluation_criteria JSONB NOT NULL DEFAULT '[]',
  time_limit_minutes INTEGER NOT NULL DEFAULT 30,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.practical_assessments ENABLE ROW LEVEL SECURITY;

-- Practical Assessment Submissions
CREATE TABLE public.practical_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID REFERENCES public.practical_assessments(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.interview_sessions(id) ON DELETE CASCADE NOT NULL,
  submitted_code TEXT,
  submitted_answer TEXT,
  execution_result TEXT,
  ai_evaluation JSONB,
  score INTEGER CHECK (score >= 0 AND score <= 100),
  feedback TEXT,
  time_taken_seconds INTEGER,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.practical_submissions ENABLE ROW LEVEL SECURITY;

-- Updated_at Trigger Function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_job_descriptions_updated_at BEFORE UPDATE ON public.job_descriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_candidates_updated_at BEFORE UPDATE ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_interview_sessions_updated_at BEFORE UPDATE ON public.interview_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- User Roles Policies
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Job Descriptions Policies
CREATE POLICY "Job descriptions are viewable by authenticated users"
  ON public.job_descriptions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Recruiters and admins can manage job descriptions"
  ON public.job_descriptions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'recruiter'));

-- Candidates Policies
CREATE POLICY "Candidates can view own data"
  ON public.candidates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Recruiters can view all candidates"
  ON public.candidates FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'recruiter'));

CREATE POLICY "Candidates can insert own data"
  ON public.candidates FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'recruiter') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Candidates can update own data"
  ON public.candidates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Recruiters can manage candidates"
  ON public.candidates FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'recruiter'));

-- ATS Screenings Policies
CREATE POLICY "Recruiters can view all screenings"
  ON public.ats_screenings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'recruiter'));

CREATE POLICY "Recruiters can manage screenings"
  ON public.ats_screenings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'recruiter'));

-- Interview Sessions Policies
CREATE POLICY "Candidates can view own sessions"
  ON public.interview_sessions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.candidates c 
    WHERE c.id = candidate_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Recruiters can view all sessions"
  ON public.interview_sessions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'recruiter'));

CREATE POLICY "Recruiters can manage sessions"
  ON public.interview_sessions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'recruiter'));

-- Interview Questions Policies
CREATE POLICY "Candidates can view questions for own sessions"
  ON public.interview_questions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.interview_sessions s
    JOIN public.candidates c ON c.id = s.candidate_id
    WHERE s.id = session_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Recruiters can manage questions"
  ON public.interview_questions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'recruiter'));

-- Candidate Responses Policies
CREATE POLICY "Candidates can view own responses"
  ON public.candidate_responses FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.interview_sessions s
    JOIN public.candidates c ON c.id = s.candidate_id
    WHERE s.id = session_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Candidates can insert own responses"
  ON public.candidate_responses FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.interview_sessions s
    JOIN public.candidates c ON c.id = s.candidate_id
    WHERE s.id = session_id AND c.user_id = auth.uid() AND s.status = 'in_progress'
  ));

CREATE POLICY "Recruiters can manage responses"
  ON public.candidate_responses FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'recruiter'));

-- Interview Evaluations Policies
CREATE POLICY "Candidates can view own evaluations"
  ON public.interview_evaluations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.interview_sessions s
    JOIN public.candidates c ON c.id = s.candidate_id
    WHERE s.id = session_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Recruiters can manage evaluations"
  ON public.interview_evaluations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'recruiter'));

-- Practical Assessments Policies
CREATE POLICY "Candidates can view assessments for own sessions"
  ON public.practical_assessments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.interview_sessions s
    JOIN public.candidates c ON c.id = s.candidate_id
    WHERE s.id = session_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Recruiters can manage assessments"
  ON public.practical_assessments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'recruiter'));

-- Practical Submissions Policies
CREATE POLICY "Candidates can view own submissions"
  ON public.practical_submissions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.interview_sessions s
    JOIN public.candidates c ON c.id = s.candidate_id
    WHERE s.id = session_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Candidates can insert own submissions"
  ON public.practical_submissions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.interview_sessions s
    JOIN public.candidates c ON c.id = s.candidate_id
    WHERE s.id = session_id AND c.user_id = auth.uid() AND s.status = 'in_progress'
  ));

CREATE POLICY "Recruiters can manage submissions"
  ON public.practical_submissions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'recruiter'));

-- Create storage bucket for resumes
INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', false);

-- Storage policies for resumes
CREATE POLICY "Authenticated users can upload resumes"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'resumes');

CREATE POLICY "Users can view their own resumes"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Recruiters can view all resumes"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'resumes' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'recruiter')));

-- Create indexes for better performance
CREATE INDEX idx_candidates_email ON public.candidates(email);
CREATE INDEX idx_candidates_user_id ON public.candidates(user_id);
CREATE INDEX idx_interview_sessions_candidate_id ON public.interview_sessions(candidate_id);
CREATE INDEX idx_interview_sessions_job_id ON public.interview_sessions(job_id);
CREATE INDEX idx_interview_sessions_status ON public.interview_sessions(status);
CREATE INDEX idx_ats_screenings_candidate_id ON public.ats_screenings(candidate_id);
CREATE INDEX idx_ats_screenings_job_id ON public.ats_screenings(job_id);
CREATE INDEX idx_interview_questions_session_id ON public.interview_questions(session_id);
CREATE INDEX idx_candidate_responses_session_id ON public.candidate_responses(session_id);