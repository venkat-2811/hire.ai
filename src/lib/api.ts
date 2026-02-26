/**
 * API Client for Talent Scout AI Backend
 * Uses Vercel serverless functions at /api/*
 */

const API_BASE_URL = '/api';

// Token getter function - will be set by ClerkAuthProvider
let getAuthToken: (() => Promise<string | null>) | null = null;

export function setAuthTokenGetter(getter: () => Promise<string | null>) {
  getAuthToken = getter;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  skipAuth?: boolean;
}

class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, skipAuth = false } = options;

  const authHeaders: Record<string, string> = {};
  if (!skipAuth && getAuthToken) {
    const token = await getAuthToken();
    if (token) {
      authHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...headers,
    },
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new APIError(response.status, error.error || error.detail || 'Request failed');
  }

  return response.json();
}

async function uploadFile<T>(endpoint: string, formData: FormData, skipAuth = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (!skipAuth && getAuthToken) {
    const token = await getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new APIError(response.status, error.detail || 'Upload failed');
  }

  return response.json();
}

// ============== Jobs API ==============

export interface JobDescription {
  id: string;
  created_by: string | null;
  title: string;
  role: 'salesforce_developer' | 'qa_engineer' | 'business_analyst';
  level: 'intern' | 'junior' | 'mid' | 'senior';
  description: string;
  must_have_skills: string[];
  good_to_have_skills: string[];
  min_experience_years: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CandidateCreatePayload {
  full_name: string;
  email: string;
  phone?: string;
  portfolio_url?: string;
  github_url?: string;
  consent_given: boolean;
  resume_url?: string;
  resume_text?: string;
  resume_parsed_data?: unknown;
  job_id?: string;
}

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  organization_email: string | null;
  company_name: string | null;
  company_website: string | null;
  company_size: string | null;
  industry: string | null;
  headquarters_location: string | null;
  hiring_regions: string | null;
  hiring_roles: string | null;
  preferred_timezone: string | null;
  contact_phone: string | null;
  onboarding_completed: boolean;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const profileApi = {
  get: () => request<Profile>('/profile'),
  update: (data: Partial<Profile>) => request<Profile>('/profile', { method: 'PATCH', body: data }),
};

export interface JobDescriptionCreate {
  title: string;
  role: 'salesforce_developer' | 'qa_engineer' | 'business_analyst';
  level: 'intern' | 'junior' | 'mid' | 'senior';
  description: string;
  must_have_skills: string[];
  good_to_have_skills: string[];
  min_experience_years: number;
}

export const jobsApi = {
  list: (params?: { role?: string; level?: string; is_active?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.role) searchParams.set('role', params.role);
    if (params?.level) searchParams.set('level', params.level);
    if (params?.is_active !== undefined) searchParams.set('is_active', String(params.is_active));
    const query = searchParams.toString();
    return request<JobDescription[]>(`/jobs${query ? `?${query}` : ''}`);
  },

  get: (id: string) => request<JobDescription>(`/jobs/${id}`),

  create: (data: JobDescriptionCreate) =>
    request<JobDescription>('/jobs', { method: 'POST', body: data }),

  update: (id: string, data: Partial<JobDescriptionCreate>) =>
    request<JobDescription>(`/jobs/${id}`, { method: 'PATCH', body: data }),

  delete: (id: string) =>
    request<{ success: boolean; message: string }>(`/jobs/${id}`, { method: 'DELETE' }),
};

// ============== Candidates API ==============

export interface ResumeData {
  skills: string[];
  experience: {
    title: string;
    company: string;
    duration: string;
    description: string;
  }[];
  education: {
    degree: string;
    institution: string;
    year: string;
  }[];
  summary: string;
  total_experience_years: number;
  certifications: string[];
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

export const candidatesApi = {
  list: (params?: { limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    const query = searchParams.toString();
    return request<Candidate[]>(`/candidates${query ? `?${query}` : ''}`);
  },

  get: (id: string) => request<Candidate>(`/candidates/${id}`),

  create: (data: CandidateCreatePayload) =>
    request<Candidate>('/candidates', { method: 'POST', body: data }),

  update: (id: string, data: Partial<Candidate>) =>
    request<Candidate>(`/candidates/${id}`, { method: 'PATCH', body: data }),

  uploadResume: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('resume', file);
    return uploadFile<Candidate>(`/candidates/${id}/upload-resume`, formData);
  },

  getParsedResume: (id: string) => request<ResumeData>(`/candidates/${id}/parsed-resume`),

  getAssessmentDetails: (id: string) => request<AssessmentDetails | null>(`/candidates/${id}/assessment-details`),

  getInterviewDetails: (id: string) => request<InterviewDetails | null>(`/candidates/${id}/interview-details`),

  delete: (id: string) =>
    request<{ success: boolean; message: string }>(`/candidates/${id}`, { method: 'DELETE' }),
};

// ============== Assessment Details ==============

export interface MCQSubmission {
  question_id: string;
  question: string;
  options: string[];
  selected_index: number;
  correct_index: number;
  is_correct: boolean;
  difficulty: string;
  topic: string;
  points_possible: number;
  points_earned: number;
}

export interface CodingSubmission {
  challenge_id: string;
  code: string;
  language: string;
  test_results: {
    input: string;
    expected: string;
    actual: string;
    passed: boolean;
    error: string | null;
  }[];
  passed_count: number;
  total_tests: number;
  score_percentage: number;
  points_earned: number;
  max_points: number;
  submitted_at: string;
}

export interface AssessmentDetails {
  session_id: string;
  status: string;
  mcq_score: number | null;
  coding_score: number | null;
  total_score: number | null;
  mcq_submissions: MCQSubmission[];
  coding_submissions: CodingSubmission[];
  mcq_questions: any[];
  coding_challenges: any[];
  proctoring_data: any;
  started_at: string | null;
  completed_at: string | null;
}

// ============== Interview Details ==============

export interface InterviewResponseRecord {
  question_index: number;
  transcript: string;
  audio_duration_seconds: number;
  confidence: number;
  submitted_at: string;
}

export interface InterviewFinalEvaluation {
  overall_score: number;
  technical_score: number;
  communication_score: number;
  confidence_score: number;
  integrity_score: number;
  role_fit_index: number;
  recommendation: string;
  strengths: string[];
  weaknesses: string[];
  detailed_feedback: string;
}

export interface InterviewDetails {
  session_id: string;
  status: string;
  questions: { question_text: string; question_type: string }[];
  responses: InterviewResponseRecord[];
  final_evaluation: InterviewFinalEvaluation | null;
  proctoring_data: any;
  started_at: string | null;
  completed_at: string | null;
}

// ============== Screening API ==============

export interface ReasonCode {
  code: string;
  type: 'positive' | 'negative' | 'neutral';
  description: string;
  impact: number;
}

export interface SkillMatch {
  skill: string;
  found: boolean;
  relevance: 'must_have' | 'good_to_have';
  evidence: string | null;
  confidence: number;
}

export interface DetailedAnalysis {
  skill_match: SkillMatch[];
  experience_analysis: string;
  education_analysis: string;
  career_gap_analysis: string;
  credibility_flags: string[];
}

export interface ATSScreeningResult {
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

export const screeningApi = {
  run: (candidateId: string, jobId: string) =>
    request<ATSScreeningResult>('/screening/run', {
      method: 'POST',
      body: { candidate_id: candidateId, job_id: jobId },
    }),

  getForCandidate: (candidateId: string) =>
    request<ATSScreeningResult[]>(`/screening/candidate/${candidateId}`),

  getForJob: (jobId: string, params?: { shortlisted_only?: boolean; min_score?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.shortlisted_only) searchParams.set('shortlisted_only', 'true');
    if (params?.min_score) searchParams.set('min_score', String(params.min_score));
    const query = searchParams.toString();
    return request<ATSScreeningResult[]>(`/screening/job/${jobId}${query ? `?${query}` : ''}`);
  },

  get: (id: string) => request<ATSScreeningResult>(`/screening/${id}`),
};

// ============== Interviews API ==============

export interface ProctoringData {
  tab_switches: number;
  copy_paste_count: number;
  fullscreen_exits: number;
  warnings: string[];
}

export interface InterviewSession {
  id: string;
  candidate_id: string;
  job_id: string;
  screening_id: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  question_seed: string | null;
  proctoring_data: ProctoringData;
  integrity_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface InterviewQuestion {
  id: string;
  session_id: string;
  question_type: 'technical' | 'practical' | 'behavioral';
  question_text: string;
  expected_answer: string | null;
  difficulty_level: number;
  max_score: number;
  time_limit_seconds: number | null;
  order_index: number;
  metadata: Record<string, unknown>;
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
  submitted_at: string;
}

export interface PracticalAssessment {
  id: string;
  session_id: string;
  role: string;
  task_title: string;
  task_description: string;
  starter_code: string | null;
  expected_output: string | null;
  evaluation_criteria: {
    name: string;
    description: string;
    max_points: number;
  }[];
  time_limit_minutes: number;
  order_index: number;
}

export interface PracticalSubmission {
  id: string;
  assessment_id: string;
  session_id: string;
  submitted_code: string | null;
  submitted_answer: string | null;
  score: number | null;
  feedback: string | null;
  ai_evaluation: {
    criteria_scores: {
      criterion: string;
      score: number;
      max_score: number;
      feedback: string;
    }[];
    overall_assessment: string;
    suggestions: string[];
  } | null;
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
  recommendation: 'strong_hire' | 'hire' | 'borderline' | 'no_hire' | null;
  strengths: string[];
  weaknesses: string[];
  detailed_feedback: string | null;
  evaluated_at: string;
}

export const interviewsApi = {
  list: (params?: { status?: string; candidate_id?: string; job_id?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.candidate_id) searchParams.set('candidate_id', params.candidate_id);
    if (params?.job_id) searchParams.set('job_id', params.job_id);
    const query = searchParams.toString();
    return request<InterviewSession[]>(`/interviews${query ? `?${query}` : ''}`);
  },

  get: (id: string) => request<InterviewSession>(`/interviews/${id}`),

  create: (data: { candidate_id: string; job_id: string; screening_id?: string; scheduled_at?: string }) =>
    request<InterviewSession>('/interviews', { method: 'POST', body: data }),

  start: (id: string) =>
    request<InterviewSession>(`/interviews/${id}/start`, { method: 'POST' }),

  getQuestions: (id: string) =>
    request<InterviewQuestion[]>(`/interviews/${id}/questions`),

  submitResponse: (sessionId: string, data: {
    question_id: string;
    response_text?: string;
    response_code?: string;
    time_taken_seconds?: number;
  }) =>
    request<CandidateResponse>(`/interviews/${sessionId}/responses`, {
      method: 'POST',
      body: { session_id: sessionId, ...data },
    }),

  getPracticals: (id: string) =>
    request<PracticalAssessment[]>(`/interviews/${id}/practicals`),

  submitPractical: (sessionId: string, assessmentId: string, data: {
    submitted_code?: string;
    submitted_answer?: string;
    time_taken_seconds?: number;
  }) =>
    request<PracticalSubmission>(`/interviews/${sessionId}/practicals/${assessmentId}/submit`, {
      method: 'POST',
      body: { assessment_id: assessmentId, session_id: sessionId, ...data },
    }),

  updateProctoring: (id: string, data: ProctoringData) =>
    request<{ success: boolean }>(`/interviews/${id}/proctoring`, {
      method: 'POST',
      body: data,
    }),

  complete: (id: string) =>
    request<InterviewEvaluation>(`/interviews/${id}/complete`, { method: 'POST' }),

  getEvaluation: (id: string) =>
    request<InterviewEvaluation>(`/interviews/${id}/evaluation`),
};

// ============== Analytics API ==============

export interface DashboardStats {
  total_candidates: number;
  total_candidates_change: number;
  active_jobs: number;
  active_jobs_change: number;
  pending_interviews: number;
  pending_interviews_change: number;
  completed_today: number;
  completed_today_change: number;
  average_score: number;
  shortlist_rate: number;
}

export interface CandidateAnalytics {
  candidate_id: string;
  candidate_name: string;
  job_title: string;
  ats_score: number;
  interview_status: string;
  technical_score: number | null;
  overall_score: number | null;
  recommendation: string | null;
}

export const analyticsApi = {
  getDashboard: () => request<DashboardStats>('/analytics/dashboard'),

  getCandidates: (params?: { job_id?: string; status?: string; recommendation?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.job_id) searchParams.set('job_id', params.job_id);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.recommendation) searchParams.set('recommendation', params.recommendation);
    const query = searchParams.toString();
    return request<CandidateAnalytics[]>(`/analytics/candidates${query ? `?${query}` : ''}`);
  },

  getJobSummary: (jobId: string) =>
    request<{
      job: { id: string; title: string; role: string; level: string };
      applicants: { total: number; shortlisted: number; shortlist_rate: number };
      interviews: Record<string, number>;
      recommendations: Record<string, number>;
      average_score: number;
    }>(`/analytics/job/${jobId}/summary`),

  getTrends: (days?: number) => {
    const query = days ? `?days=${days}` : '';
    return request<{
      trends: {
        date: string;
        screenings: number;
        shortlisted: number;
        interviews_started: number;
        interviews_completed: number;
        average_score: number;
      }[];
      period_days: number;
    }>(`/analytics/trends${query}`);
  },
};

export { APIError };
