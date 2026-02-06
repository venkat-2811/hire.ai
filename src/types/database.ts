// Custom type definitions for the hiring platform
// These extend the auto-generated Supabase types

export type JobRole = string;
export type RoleLevel = 'intern' | 'junior' | 'mid' | 'senior';
export type InterviewStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type AssessmentType = 'technical' | 'practical' | 'behavioral';
export type HireRecommendation = 'strong_hire' | 'hire' | 'borderline' | 'no_hire';
export type AppRole = 'admin' | 'recruiter' | 'interviewer' | 'candidate';

export interface JobDescription {
  id: string;
  created_by: string | null;
  title: string;
  role: JobRole;
  level: RoleLevel;
  description: string;
  must_have_skills: string[];
  good_to_have_skills: string[];
  min_experience_years: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Candidate {
  id: string;
  user_id: string | null;
  email: string;
  full_name: string;
  phone: string | null;
  resume_url: string | null;
  resume_text: string | null;
  resume_parsed_data: ResumeData | null;
  portfolio_url: string | null;
  github_url: string | null;
  consent_given: boolean;
  consent_timestamp: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResumeData {
  skills: string[];
  experience: ExperienceItem[];
  education: EducationItem[];
  summary: string;
  contact: {
    email?: string;
    phone?: string;
    linkedin?: string;
  };
}

export interface ExperienceItem {
  title: string;
  company: string;
  duration: string;
  description: string;
  start_date?: string;
  end_date?: string;
}

export interface EducationItem {
  degree: string;
  institution: string;
  year: string;
}

export interface ATSScreening {
  id: string;
  candidate_id: string;
  job_id: string;
  overall_score: number;
  skill_relevance_score: number | null;
  experience_score: number | null;
  education_score: number | null;
  credibility_score: number | null;
  shortlisted: boolean;
  shortlist_reason: string | null;
  reason_codes: ReasonCode[];
  detailed_analysis: DetailedAnalysis | null;
  screened_at: string;
}

export interface ReasonCode {
  code: string;
  type: 'positive' | 'negative' | 'neutral';
  description: string;
  impact: number;
}

export interface DetailedAnalysis {
  skill_match: SkillMatch[];
  experience_analysis: string;
  education_analysis: string;
  career_gap_analysis: string;
  credibility_flags: string[];
}

export interface SkillMatch {
  skill: string;
  found: boolean;
  relevance: 'must_have' | 'good_to_have';
  evidence?: string;
}

export interface InterviewSession {
  id: string;
  candidate_id: string;
  job_id: string;
  screening_id: string | null;
  status: InterviewStatus;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  question_seed: string | null;
  proctoring_data: ProctoringData;
  integrity_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProctoringData {
  tabSwitches: number;
  copyPasteCount: number;
  fullscreenExits: number;
  warnings: string[];
}

export interface InterviewQuestion {
  id: string;
  session_id: string;
  question_type: AssessmentType;
  question_text: string;
  expected_answer: string | null;
  difficulty_level: number;
  max_score: number;
  time_limit_seconds: number | null;
  order_index: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CandidateResponse {
  id: string;
  question_id: string;
  session_id: string;
  response_text: string | null;
  response_code: string | null;
  time_taken_seconds: number | null;
  ai_score: number | null;
  ai_feedback: string | null;
  manual_score: number | null;
  manual_feedback: string | null;
  submitted_at: string;
}

export interface InterviewEvaluation {
  id: string;
  session_id: string;
  technical_score: number | null;
  problem_solving_score: number | null;
  communication_score: number | null;
  integrity_score: number | null;
  role_fit_index: number | null;
  overall_score: number | null;
  recommendation: HireRecommendation | null;
  strengths: string[];
  weaknesses: string[];
  detailed_feedback: string | null;
  evaluator_notes: string | null;
  evaluated_at: string;
}

export interface PracticalAssessment {
  id: string;
  session_id: string;
  role: JobRole;
  task_title: string;
  task_description: string;
  starter_code: string | null;
  expected_output: string | null;
  evaluation_criteria: EvaluationCriterion[];
  time_limit_minutes: number;
  order_index: number;
  created_at: string;
}

export interface EvaluationCriterion {
  name: string;
  description: string;
  max_points: number;
}

export interface PracticalSubmission {
  id: string;
  assessment_id: string;
  session_id: string;
  submitted_code: string | null;
  submitted_answer: string | null;
  execution_result: string | null;
  ai_evaluation: AIEvaluation | null;
  score: number | null;
  feedback: string | null;
  time_taken_seconds: number | null;
  submitted_at: string;
}

export interface AIEvaluation {
  criteria_scores: CriteriaScore[];
  overall_assessment: string;
  suggestions: string[];
}

export interface CriteriaScore {
  criterion: string;
  score: number;
  max_score: number;
  feedback: string;
}

// Dashboard Statistics
export interface DashboardStats {
  totalCandidates: number;
  activeJobs: number;
  pendingInterviews: number;
  completedToday: number;
  averageScore: number;
  shortlistRate: number;
}

export interface CandidateAnalytics {
  candidate_id: string;
  candidate_name: string;
  job_title: string;
  ats_score: number;
  assessment_score: number | null;
  interview_score: number | null;
  interview_status: InterviewStatus;
  technical_score: number | null;
  overall_score: number | null;
  recommendation: HireRecommendation | null;
}


// Role-specific configurations
export const ROLE_CONFIG: Record<JobRole, {
  label: string;
  color: string;
  icon: string;
  practicalTypes: string[];
}> = {
  salesforce_developer: {
    label: 'Salesforce Developer',
    color: 'role-salesforce',
    icon: '⚡',
    practicalTypes: ['Apex Logic', 'LWC Components', 'Debugging', 'Integration'],
  },
  qa_engineer: {
    label: 'QA Engineer',
    color: 'role-qa',
    icon: '🔍',
    practicalTypes: ['Test Cases', 'Automation', 'API Testing', 'Bug Analysis'],
  },
  business_analyst: {
    label: 'Business Analyst',
    color: 'role-ba',
    icon: '📊',
    practicalTypes: ['Requirements', 'User Stories', 'Gap Analysis', 'Process Mapping'],
  },
};

export const LEVEL_CONFIG: Record<RoleLevel, {
  label: string;
  experienceRange: string;
}> = {
  intern: { label: 'Intern', experienceRange: '0 years' },
  junior: { label: 'Junior', experienceRange: '0-2 years' },
  mid: { label: 'Mid-Level', experienceRange: '2-5 years' },
  senior: { label: 'Senior', experienceRange: '5+ years' },
};
