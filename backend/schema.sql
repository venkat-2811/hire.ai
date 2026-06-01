-- Schema for talent-scout-ai backend
-- Generated from backend code expectations (Supabase tables used by routers)

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================
-- job_descriptions
-- =========================
create table if not exists public.job_descriptions (
  id uuid primary key default gen_random_uuid(),
  created_by uuid null,
  title text not null,
  role text not null,
  level text not null,
  description text not null,
  must_have_skills text[] not null default '{}'::text[],
  good_to_have_skills text[] not null default '{}'::text[],
  min_experience_years int not null default 0,
  include_sql_assessment boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz null
);

drop trigger if exists trg_job_descriptions_updated_at on public.job_descriptions;
create trigger trg_job_descriptions_updated_at
before update on public.job_descriptions
for each row execute function public.set_updated_at();

create index if not exists idx_job_descriptions_created_at on public.job_descriptions(created_at desc);
create index if not exists idx_job_descriptions_is_active on public.job_descriptions(is_active);


-- =========================
-- candidates
-- =========================
create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,

  email text not null,
  full_name text not null,
  phone text null,
  portfolio_url text null,
  github_url text null,

  consent_given boolean not null default false,
  consent_timestamp timestamptz null,

  resume_url text null,
  resume_text text null,
  resume_parsed_data jsonb null,

  created_at timestamptz not null default now(),
  updated_at timestamptz null
);

drop trigger if exists trg_candidates_updated_at on public.candidates;
create trigger trg_candidates_updated_at
before update on public.candidates
for each row execute function public.set_updated_at();

create unique index if not exists uq_candidates_email on public.candidates(lower(email));
create index if not exists idx_candidates_created_at on public.candidates(created_at desc);


-- =========================
-- ats_screenings
-- =========================
create table if not exists public.ats_screenings (
  id uuid primary key default gen_random_uuid(),

  candidate_id uuid not null references public.candidates(id) on delete cascade,
  job_id uuid not null references public.job_descriptions(id) on delete cascade,

  overall_score int not null,
  skill_relevance_score int null,
  experience_score int null,
  education_score int null,
  credibility_score int null,

  shortlisted boolean not null default false,
  shortlist_reason text null,

  reason_codes jsonb not null default '[]'::jsonb,
  detailed_analysis jsonb null,

  screened_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz null
);

drop trigger if exists trg_ats_screenings_updated_at on public.ats_screenings;
create trigger trg_ats_screenings_updated_at
before update on public.ats_screenings
for each row execute function public.set_updated_at();

create index if not exists idx_ats_screenings_candidate on public.ats_screenings(candidate_id);
create index if not exists idx_ats_screenings_job on public.ats_screenings(job_id);
create index if not exists idx_ats_screenings_screened_at on public.ats_screenings(screened_at desc);
create unique index if not exists uq_ats_screenings_candidate_job
on public.ats_screenings(candidate_id, job_id);


-- =========================
-- interview_sessions
-- =========================
create table if not exists public.interview_sessions (
  id uuid primary key default gen_random_uuid(),

  candidate_id uuid not null references public.candidates(id) on delete cascade,
  job_id uuid not null references public.job_descriptions(id) on delete cascade,
  screening_id uuid null references public.ats_screenings(id) on delete set null,

  status text not null default 'pending',

  scheduled_at timestamptz null,
  started_at timestamptz null,
  completed_at timestamptz null,

  question_seed text null,

  proctoring_data jsonb not null default '{}'::jsonb,
  integrity_score int null,

  created_at timestamptz not null default now(),
  updated_at timestamptz null
);

drop trigger if exists trg_interview_sessions_updated_at on public.interview_sessions;
create trigger trg_interview_sessions_updated_at
before update on public.interview_sessions
for each row execute function public.set_updated_at();

create index if not exists idx_interview_sessions_candidate on public.interview_sessions(candidate_id);
create index if not exists idx_interview_sessions_job on public.interview_sessions(job_id);
create index if not exists idx_interview_sessions_status on public.interview_sessions(status);
create index if not exists idx_interview_sessions_created_at on public.interview_sessions(created_at desc);


-- =========================
-- interview_questions
-- =========================
create table if not exists public.interview_questions (
  id uuid primary key default gen_random_uuid(),

  session_id uuid not null references public.interview_sessions(id) on delete cascade,

  question_type text not null,
  question_text text not null,
  expected_answer text null,

  difficulty_level int not null,
  max_score int not null default 10,
  time_limit_seconds int null,
  order_index int not null default 0,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists idx_interview_questions_session on public.interview_questions(session_id);
create index if not exists idx_interview_questions_session_order on public.interview_questions(session_id, order_index);


-- =========================
-- candidate_responses
-- =========================
create table if not exists public.candidate_responses (
  id uuid primary key default gen_random_uuid(),

  question_id uuid not null references public.interview_questions(id) on delete cascade,
  session_id uuid not null references public.interview_sessions(id) on delete cascade,

  response_text text null,
  response_code text null,
  time_taken_seconds int null,

  ai_score int null,
  ai_feedback text null,

  manual_score int null,
  manual_feedback text null,

  submitted_at timestamptz not null default now()
);

create index if not exists idx_candidate_responses_session on public.candidate_responses(session_id);
create index if not exists idx_candidate_responses_question on public.candidate_responses(question_id);


-- =========================
-- practical_assessments
-- =========================
create table if not exists public.practical_assessments (
  id uuid primary key default gen_random_uuid(),

  session_id uuid not null references public.interview_sessions(id) on delete cascade,

  role text not null,
  task_title text not null,
  task_description text not null,

  starter_code text null,
  expected_output text null,

  evaluation_criteria jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  time_limit_minutes int not null default 30,
  order_index int not null default 0,

  created_at timestamptz not null default now()
);

create index if not exists idx_practical_assessments_session on public.practical_assessments(session_id);
create index if not exists idx_practical_assessments_session_order on public.practical_assessments(session_id, order_index);


-- =========================
-- practical_submissions
-- =========================
create table if not exists public.practical_submissions (
  id uuid primary key default gen_random_uuid(),

  assessment_id uuid not null references public.practical_assessments(id) on delete cascade,
  session_id uuid not null references public.interview_sessions(id) on delete cascade,

  submitted_code text null,
  submitted_answer text null,
  execution_result text null,

  ai_evaluation jsonb null,
  metadata jsonb not null default '{}'::jsonb,
  score int null,
  feedback text null,

  time_taken_seconds int null,
  submitted_at timestamptz not null default now()
);

create index if not exists idx_practical_submissions_session on public.practical_submissions(session_id);
create index if not exists idx_practical_submissions_assessment on public.practical_submissions(assessment_id);


-- =========================
-- interview_evaluations
-- =========================
create table if not exists public.interview_evaluations (
  id uuid primary key default gen_random_uuid(),

  session_id uuid not null references public.interview_sessions(id) on delete cascade,

  technical_score int null,
  problem_solving_score int null,
  communication_score int null,
  integrity_score int null,
  role_fit_index int null,
  overall_score int null,

  recommendation text null,

  strengths text[] not null default '{}'::text[],
  weaknesses text[] not null default '{}'::text[],

  detailed_feedback text null,
  evaluator_notes text null,

  evaluated_at timestamptz not null default now()
);

create unique index if not exists uq_interview_evaluations_session on public.interview_evaluations(session_id);
create index if not exists idx_interview_evaluations_evaluated_at on public.interview_evaluations(evaluated_at desc);
