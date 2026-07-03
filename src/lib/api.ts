/**
 * API Client for Rekshift Backend
 * Pure FastAPI backend - no Node fallback
 */

function normalizeBaseUrl(baseUrl: string): string {
  if (!baseUrl) return '';
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

function getFastApiOrigin(): string {
  return normalizeBaseUrl((import.meta as any)?.env?.VITE_API_BASE_URL ?? '');
}

function getFastApiBase(): string {
  const origin = getFastApiOrigin();
  return `${origin}/api/v2`;
}

function anySignal(signals: Array<AbortSignal | undefined>): AbortSignal {
  const filtered = signals.filter(Boolean) as AbortSignal[];
  if (filtered.length === 0) return new AbortController().signal;
  if (filtered.length === 1) return filtered[0];

  // Prefer native AbortSignal.any when available
  const anyFn = (AbortSignal as any)?.any as undefined | ((s: AbortSignal[]) => AbortSignal);
  if (typeof anyFn === 'function') {
    return anyFn(filtered);
  }

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  filtered.forEach((s) => {
    if (s.aborted) controller.abort();
    else s.addEventListener('abort', onAbort, { once: true });
  });
  return controller.signal;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number) {
  const timeoutController = new AbortController();
  const t = setTimeout(() => timeoutController.abort(), timeoutMs);

  const signal = anySignal([init.signal, timeoutController.signal]);

  try {
    return await fetch(input, { ...init, signal });
  } catch (err: any) {
    // Normalize timeout aborts into a stable message (avoid DOMException "signal is aborted" toasts)
    const isAbort = err?.name === 'AbortError' || err instanceof DOMException;
    if (isAbort && timeoutController.signal.aborted) {
      throw new Error('Request timed out');
    }
    throw err;
  } finally {
    clearTimeout(t);
  }
}

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
  timeoutMs?: number;
}

class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    headers = {},
    skipAuth = false,
    timeoutMs = 20000,
  } = options;

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

  const baseUrl = getFastApiBase();
  const url = `${baseUrl}${endpoint}`;

  const response = await fetchWithTimeout(url, config, timeoutMs);

  if (!response.ok) {
    let errorMessage = 'Request failed';
    try {
      const error = await response.json();
      errorMessage = error.error || error.detail || error.message || errorMessage;
    } catch {
      // If JSON parsing fails, try to get text
      try {
        const text = await response.text();
        errorMessage = text || errorMessage;
      } catch {
        // If text also fails, use status-based message
        errorMessage = `Request failed with status ${response.status}`;
      }
    }
    throw new APIError(response.status, errorMessage);
  }

  return response.json();
}

export async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  return request<T>(endpoint, options);
}

async function uploadFile<T>(
  endpoint: string,
  formData: FormData,
  skipAuth = false,
  opts?: { timeoutMs?: number },
): Promise<T> {
  const timeoutMs = opts?.timeoutMs ?? 120000;

  const headers: Record<string, string> = {};
  if (!skipAuth && getAuthToken) {
    const token = await getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const baseUrl = getFastApiBase();
  const url = `${baseUrl}${endpoint}`;

  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers,
      body: formData,
    },
    timeoutMs,
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new APIError(response.status, error.error || error.detail || error.message || 'Upload failed');
  }

  return response.json();
}

export async function apiUploadFile<T>(
  endpoint: string,
  formData: FormData,
  skipAuth = false,
  opts?: { timeoutMs?: number },
): Promise<T> {
  return uploadFile<T>(endpoint, formData, skipAuth, opts);
}

// ============== Jobs API ==============

import type { JobRole, RoleLevel } from '@/types/database';

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
  resume_cutoff?: number;
  assessment_cutoff?: number;
  interview_cutoff?: number;
  location?: string;
  endCustomer?: 'your_own_company' | 'end_customer';
  end_customer?: 'your_own_company' | 'end_customer';
  end_customer_name?: string | null;
  // Recruiter-controlled Salesforce/Apex flags
  is_salesforce_job?: boolean;
  include_apex_assessment?: boolean;
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
  location?: string;
  vendorName?: string;
  mainSkillset?: string;
}

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  organization_email: string | null;
  company_name: string | null;
  company_website: string | null;
  company_size: string | null;
  industry: string | null;
  headquarters_location: string | null;
  country: string | null;
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
  get: () =>
    request<Profile>('/profile', {}),
  update: (data: Partial<Profile>) =>
    request<Profile>('/profile', {
      method: 'PATCH',
      body: data,
    }),
};

export interface JobDescriptionCreate {
  title: string;
  role: JobRole;
  level: RoleLevel;
  description: string;
  must_have_skills: string[];
  good_to_have_skills: string[];
  min_experience_years: number;
  resume_cutoff?: number;
  assessment_cutoff?: number;
  interview_cutoff?: number;
  location?: string;
  endCustomer?: 'your_own_company' | 'end_customer';
  // Recruiter-controlled Salesforce/Apex flags
  is_salesforce_job?: boolean;
  include_apex_assessment?: boolean;
}

export const jobsApi = {
  list: (params?: { role?: string; level?: string; is_active?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.role) searchParams.set('role', params.role);
    if (params?.level) searchParams.set('level', params.level);
    if (params?.is_active !== undefined) searchParams.set('is_active', String(params.is_active));
    const query = searchParams.toString();
    return request<JobDescription[]>(`/jobs${query ? `?${query}` : ''}`, {});
  },

  get: (id: string) => request<JobDescription>(`/jobs/${id}`, {}),

  create: (data: JobDescriptionCreate) =>
    request<JobDescription>('/jobs', { method: 'POST', body: data }),

  extractSkills: (body: { description: string; title?: string; role?: string }) =>
    request<{ must_have_skills: string[]; good_to_have_skills: string[] }>(
      '/jobs/extract-skills',
      {
        method: 'POST',
        body,
        timeoutMs: 25000,
      },
    ),

  update: (id: string, data: Partial<JobDescriptionCreate>) =>
    request<JobDescription>(`/jobs/${id}`, { method: 'PATCH', body: data }),

  delete: (id: string, permanent: boolean = false) =>
    request<{ success: boolean; message: string }>(`/jobs/${id}${permanent ? '?permanent=true' : ''}`, { method: 'DELETE' }),
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
  projects?: {
    name?: string;
    title?: string;
    description?: string;
    technologies?: string[];
    link?: string;
  }[];
  extracted_text?: string;
  sections?: Record<string, any>;
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
  job_id?: string | null;
  applied_at?: string | null;
  location?: string;
  vendorName?: string;
  mainSkillset?: string;
  created_at: string;
  updated_at: string;
}

export const candidatesApi = {
  generateExpectedAnswers: (candidateId: string, jobId?: string) =>
    request<{ status: string; updated: boolean; questions: any[] }>(
      `/candidates/${candidateId}/generate-expected-answers${jobId ? `?job_id=${encodeURIComponent(jobId)}` : ''}`,
      { method: 'POST' }
    ),

  list: (params?: { limit?: number; offset?: number; unassigned?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    if (params?.unassigned !== undefined) searchParams.set('unassigned', String(params.unassigned));
    const query = searchParams.toString();
    return request<Candidate[]>(`/candidates${query ? `?${query}` : ''}`, {});
  },

  get: (id: string, jobId?: string) => 
    request<Candidate>(`/candidates/${id}${jobId ? `?job_id=${encodeURIComponent(jobId)}` : ''}`, {}),

  create: (data: CandidateCreatePayload) =>
    request<Candidate>('/candidates', { method: 'POST', body: data }),

  update: (id: string, data: Partial<Candidate>) =>
    request<Candidate>(`/candidates/${id}`, { method: 'PATCH', body: data }),

  uploadResume: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('resume', file);
    return uploadFile<Candidate>(`/candidates/${id}/upload-resume`, formData, false, {});
  },

  getParsedResume: (id: string) => request<ResumeData>(`/candidates/${id}/parsed-resume`, {}),

  getAssessmentDetails: (id: string, jobId?: string) => request<AssessmentDetails | null>(`/candidates/${id}/assessment-details${jobId ? `?job_id=${jobId}` : ''}`, {}),

  getInterviewDetails: (id: string, jobId?: string) => request<InterviewDetails | null>(`/candidates/${id}/interview-details${jobId ? `?job_id=${jobId}` : ''}`, {}),

  getManualInterview: (id: string, jobId: string) => request<ManualInterviewDetails | null>(`/candidates/${id}/manual-interview?job_id=${encodeURIComponent(jobId)}`, {}),

  updateManualInterview: (id: string, jobId: string, body: ManualInterviewUpdatePayload) =>
    request<ManualInterviewDetails>(`/candidates/${id}/manual-interview?job_id=${encodeURIComponent(jobId)}`, { method: 'PATCH', body }),

  delete: (id: string, jobId?: string) =>
    request<{ success: boolean; message: string }>(`/candidates/${id}${jobId ? `?job_id=${encodeURIComponent(jobId)}` : ''}`, { method: 'DELETE' }),
};

// ============== Resume Optimization API ==============

export interface ResumeOptimizationChange {
  change_id: string;
  section: string;
  section_label: string;
  original: string;
  improved: string;
  reason: string;
  change_type: 'wording' | 'ats_keyword' | 'jd_alignment' | 'formatting' | 'gap_caution' | 'missing_skill_notice';
  score_impact: number;
}

export interface ResumeOptimizationRecord {
  id: string;
  candidate_id: string;
  job_id: string;
  recruiter_id: string;
  status: 'draft' | 'finalized';
  before_score: number;
  after_score: number;
  optimization_summary: string;
  changes: ResumeOptimizationChange[];
  gap_cautions?: Array<{ reason: string }>;
  optimized_resume: Record<string, any>;
  accepted_change_ids: string[];
  rejected_change_ids: string[];
  final_resume?: Record<string, any> | null;
  candidate_name?: string;
  job_title?: string;
  created_at: string;
  updated_at: string;
  finalized_at?: string | null;
}

export const resumeOptimizationApi = {
  optimize: (candidateId: string, jobId: string, screeningData: any) =>
    request<ResumeOptimizationRecord>(
      `/resume-optimization/candidates/${candidateId}/optimize`,
      {
        method: 'POST',
        body: { job_id: jobId, screening_data: screeningData },
        timeoutMs: 120000,  // 2 min — AI generation can be slow
      }
    ),

  getHistory: (candidateId: string, jobId?: string) => {
    const qs = jobId ? `?job_id=${encodeURIComponent(jobId)}` : '';
    return request<ResumeOptimizationRecord[]>(
      `/resume-optimization/candidates/${candidateId}/history${qs}`,
      {}
    );
  },

  get: (optimizationId: string) =>
    request<ResumeOptimizationRecord>(`/resume-optimization/${optimizationId}`, {}),

  finalize: (
    optimizationId: string,
    body: {
      accepted_change_ids: string[];
      rejected_change_ids: string[];
      final_resume?: Record<string, any>;  // legacy-compat; backend ignores and rebuilds from text
    }
  ) =>
    request<{ success: boolean; optimization_id: string; status: string }>(
      `/resume-optimization/${optimizationId}/finalize`,
      { method: 'POST', body }
    ),

  deploy: (optimizationId: string) =>
    request<{ success: boolean; url: string; screening_score: number }>(
      `/resume-optimization/${optimizationId}/deploy`,
      { method: 'POST' }
    ),

  getDownloadUrl: (optimizationId: string, format: 'pdf' | 'docx', version: 'optimized' | 'original' = 'optimized') => {
    const base = `${(import.meta as any)?.env?.VITE_API_BASE_URL ?? ''}/api/v2`;
    return `${base}/resume-optimization/${optimizationId}/download/${format}?version=${version}`;
  },
};



export interface BulkEmailActionResponse {
  success: boolean;
  emails_sent: number;
  error_messages?: string[];
}

export interface OfferDetails {
  candidate_id: string;
  job_id: string;
  candidate_name: string;
  candidate_email?: string | null;
  job_title: string;
  company_name: string;
  ctc: string;
  time_period_years?: number | null;
  time_period_months?: number | null;
  start_date?: string | null;
  reporting_manager?: string | null;
  location?: string | null;
  accepted_signature_name?: string | null;
  accepted_at?: string | null;
  accepted_ip?: string | null;
  already_accepted: boolean;
}

export interface OfferAcceptanceResponse {
  success: boolean;
  message: string;
  already_accepted: boolean;
}

export interface BulkUpdateInterviewModeResponse {
  success: boolean;
  updated_count: number;
  error_messages?: string[];
}

export const candidatesWorkflowApi = {
  sendAcceptance: (body: { candidate_ids: string[]; job_id: string; send_email?: boolean }) =>
    request<BulkEmailActionResponse>('/candidates/send-acceptance', {
      method: 'POST',
      body,
    }),

  sendRejection: (body: { candidate_ids: string[]; job_id: string; send_email?: boolean }) =>
    request<BulkEmailActionResponse>('/candidates/send-rejection', {
      method: 'POST',
      body,
    }),

  sendOfferLetter: (body: {
    candidate_ids: string[];
    job_id: string;
    ctc: string;
    company_name: string;
    time_period_years?: number | null;
    time_period_months?: number | null;
    start_date?: string | null;
    reporting_manager?: string | null;
    location?: string | null;
  }) =>
    request<BulkEmailActionResponse>('/candidates/send-offer-letter', {
      method: 'POST',
      body,
    }),

  getOfferDetails: (token: string) =>
    request<OfferDetails>(`/candidates/offer-details?token=${encodeURIComponent(token)}`, {
      skipAuth: true,
    }),

  submitOfferAcceptance: (body: { token: string; full_name_signature: string }) =>
    request<OfferAcceptanceResponse>('/candidates/submit-offer-acceptance', {
      method: 'POST',
      body,
      skipAuth: true,
    }),

  bulkUpdateInterviewMode: (body: { candidate_ids: string[]; job_id: string; interview_mode: 'ai' | 'manual' }) =>
    request<BulkUpdateInterviewModeResponse>('/candidates/bulk-update-interview-mode', {
      method: 'POST',
      body,
    }),
};

// ============== Assessments API ==============

export interface AssessmentInviteRequest {
  candidate_ids: string[];
  job_id: string;
  deadline: string;
  mcq_question_count: number;
  coding_challenge_count: number;
  difficulty: 'easy' | 'medium' | 'hard' | string;
  include_mcq: boolean;
  include_coding: boolean;
  /** @deprecated kept for backward compat, no longer used for routing */
  assessment_mode?: 'dsa' | 'apex' | string;
  total_time_minutes?: number;
  include_sql?: boolean;
  sql_question_count?: number;
  /** Apex fill-in-the-blanks section — only active when job.include_apex_assessment = true */
  include_apex?: boolean;
  apex_question_count?: number;
  /** Recruiter-defined topics to prioritize during question generation (MCQ only) */
  focus_areas?: string;
  strict_focus?: boolean;
}

export interface AssessmentInviteResponse {
  success: boolean;
  invites_sent: number;
  failed: string[];
}

export const assessmentsApi = {
  invite: (body: AssessmentInviteRequest) =>
    request<AssessmentInviteResponse>('/assessments/invite', {
      method: 'POST',
      body,
      timeoutMs: 45000,
    }),
};

// ============== Assessment Runtime API ==============

export interface AssessmentProctoringResponse {
  warning: boolean;
  terminated: boolean;
  message: string;
  violations_remaining?: number;
  event_type?: string;
}

export interface AssessmentCompleteResponse {
  success: boolean;
  mcq_score: number;
  coding_score: number | null;
  sql_score: number | null;
  total_score: number;
}

export interface AssessmentMcqSubmission {
  question_id: string;
  selected_index: number;
  time_taken_seconds?: number;
}

export interface AssessmentMcqSubmitResponse {
  success: boolean;
  score: number;
  correct_count: number;
  total_count: number;
  weighted_points_earned: number;
  weighted_points_possible: number;
  results: Array<{
    question_id: string;
    question: string;
    options: string[];
    selected_index: number;
    correct_index: number;
    explanation: string;
    is_correct: boolean;
    difficulty: string;
    topic: string;
    points_possible: number;
    points_earned: number;
  }>;
}

export interface AssessmentCodingRunResponse {
  success: boolean;
  compilation_error?: string | null;
  runtime_error?: string | null;
  results: Array<{
    test_case_id: string | null;
    input: any;
    expected_output: any;
    actual_output: any;
    passed: boolean;
    status: string;
    time_used: string | null;
    memory_used: string | null;
    error?: string | null;
    stdout?: string | null;
    stderr?: string | null;
  }>;
  passed: number;
  total: number;
  score_percentage: number;
  ai_evaluation?: {
    score: number;
    verdict?: string;
    feedback?: string;
    issues?: string[];
    improvements?: string[];
  };
  disclaimer?: string;
  performance?: {
    avg_time_ms?: string | null;
    max_time_ms?: string | null;
    avg_memory_kb?: number | null;
    max_memory_kb?: number | null;
  };
}

export interface AssessmentCodingSubmitResponse {
  success: boolean;
  challenge_id: string;
  test_results: Array<{
    test_case_id: string | null;
    input: any;
    expected_output: any;
    actual_output: any;
    passed: boolean;
    status: string;
    time_used: string | null;
    memory_used: string | null;
    error?: string | null;
    stdout?: string | null;
    stderr?: string | null;
  }>;
  passed_count: number;
  total_tests: number;
  score_percentage: number;
  hidden_tests_passed?: number;
  hidden_tests_total?: number;
  compilation_error?: string | null;
  runtime_error?: string | null;
  ai_evaluation?: {
    score: number;
    verdict?: string;
    feedback?: string;
    issues?: string[];
    improvements?: string[];
  };
  disclaimer?: string;
}

const _assessmentsRuntimeApiBase = {
  start: (token: string) =>
    request<any>(`/assessments/start/${encodeURIComponent(token)}`, {
      timeoutMs: 30000,
      skipAuth: true,
    }),

  begin: (sessionId: string) =>
    request<{ success: boolean; started_at: string | null; expires_at: string | null; time_limit_minutes: number }>(
      `/assessments/${encodeURIComponent(sessionId)}/begin`,
      {
        method: 'POST',
        timeoutMs: 20000,
        skipAuth: true,
      },
    ),

  mcqSubmit: (sessionId: string, submissions: AssessmentMcqSubmission[]) =>
    request<AssessmentMcqSubmitResponse>(`/assessments/${encodeURIComponent(sessionId)}/mcq/submit`, {
      method: 'POST',
      body: submissions,
      timeoutMs: 30000,
      skipAuth: true,
    }),

  codingRun: (sessionId: string, body: { challenge_id: string; code: string; language: string }) =>
    request<AssessmentCodingRunResponse>(`/assessments/${encodeURIComponent(sessionId)}/coding/run`, {
      method: 'POST',
      body,
      timeoutMs: 60000,
      skipAuth: true,
    }),

  codingSubmit: (
    sessionId: string,
    body: { challenge_id: string; code: string; language: string; time_taken_seconds?: number },
  ) =>
    request<AssessmentCodingSubmitResponse>(`/assessments/${encodeURIComponent(sessionId)}/coding/submit`, {
      method: 'POST',
      body,
      timeoutMs: 90000,
      skipAuth: true,
    }),

  proctoring: (sessionId: string, body: { event_type: string; timestamp: string; details?: unknown }) =>
    request<AssessmentProctoringResponse>(`/assessments/${encodeURIComponent(sessionId)}/proctoring`, {
      method: 'POST',
      body,
      timeoutMs: 20000,
      skipAuth: true,
    }),

  complete: (sessionId: string) =>
    request<AssessmentCompleteResponse>(`/assessments/${encodeURIComponent(sessionId)}/complete`, {
      method: 'POST',
      timeoutMs: 30000,
      skipAuth: true,
    }),

  submitApexBlanks: (sessionId: string, submissions: Record<string, Record<string, string>>) =>
    request<any>(`/assessments/${encodeURIComponent(sessionId)}/apex-blanks/submit`, {
      method: 'POST',
      body: submissions,
      timeoutMs: 90000,
      skipAuth: true,
    }),
};

export const assessmentsRuntimeApi = {
  ..._assessmentsRuntimeApiBase,

  // Backwards-compatible aliases for existing UI callsites
  submitMcq: _assessmentsRuntimeApiBase.mcqSubmit,
  runCode: _assessmentsRuntimeApiBase.codingRun,
  submitCode: _assessmentsRuntimeApiBase.codingSubmit,
};

// ============== AI Interview API ==============

export interface AiInterviewInviteRequest {
  candidate_ids: string[];
  job_id: string;
  question_count?: number;
  difficulty?: 'easy' | 'medium' | 'hard' | string;
  deadline?: string;
  scheduled_time?: string;
  /** Recruiter-defined topics to prioritize during AI interview question generation */
  focus_areas?: string;
  strict_focus?: boolean;
}

export interface AiInterviewInviteResponse {
  success: boolean;
  invites_sent: number;
  failed: string[];
  failed_reasons?: Record<string, string>;
}

export interface AiInterviewStartResponse {
  session_id: string;
  candidate_name: string;
  job_title: string;
  total_questions: number;
  estimated_duration_minutes: number;
}

export interface AiInterviewQuestionResponse {
  completed?: boolean;
  message?: string;
  index?: number;
  question_text?: string;
  question_type?: string;
  expected_duration_seconds?: number;
  adaptive?: boolean;
}

export interface AiInterviewResponseSubmitResponse {
  success: boolean;
  is_last_question: boolean;
}

export interface AiInterviewProctoringResponse {
  success?: boolean;
  terminated?: boolean;
  warning?: boolean;
  message?: string;
  violations?: number;
  threshold?: number;
}

export interface AiInterviewEvaluationResult {
  overall_score: number;
  technical_score: number;
  communication_score: number;
  confidence_score: number;
  recommendation: string;
  strengths: string[];
  areas_for_improvement: string[];
  detailed_feedback: string;
}

export const aiInterviewApi = {
  invite: (body: AiInterviewInviteRequest) =>
    request<AiInterviewInviteResponse>('/ai-interview/invite', {
      method: 'POST',
      body,
      timeoutMs: 60000,
    }),

  start: (token: string) =>
    request<AiInterviewStartResponse>(`/ai-interview/start/${encodeURIComponent(token)}`, {
      timeoutMs: 25000,
      skipAuth: true,
    }),

  question: (sessionId: string) =>
    request<AiInterviewQuestionResponse>(`/ai-interview/${encodeURIComponent(sessionId)}/question`, {
      timeoutMs: 25000,
      skipAuth: true,
    }),

  adaptQuestion: (sessionId: string, next_index: number) =>
    request<AiInterviewQuestionResponse>(`/ai-interview/${encodeURIComponent(sessionId)}/adapt-question`, {
      method: 'POST',
      body: { next_index },
      timeoutMs: 25000,
      skipAuth: true,
    }),

  transcribeStore: (sessionId: string, audio: Blob, questionIndex: number, audioDurationSeconds: number) => {
    const formData = new FormData();
    const ext = audio.type.includes('ogg') ? 'ogg'
      : audio.type.includes('mp4') ? 'mp4'
        : audio.type.includes('wav') ? 'wav'
          : 'webm';
    formData.append('audio', audio, `recording.${ext}`);
    formData.append('question_index', String(questionIndex));
    formData.append('mime_type', audio.type || 'audio/webm');
    formData.append('audio_duration_seconds', String(audioDurationSeconds));
    return uploadFile<{ success: boolean; question_index: number; transcript_length: number }>(
      `/ai-interview/${encodeURIComponent(sessionId)}/transcribe-store`,
      formData,
      true,
      { timeoutMs: 90000 },
    );
  },

  submitResponse: (sessionId: string, body: {
    question_index: number;
    transcript: string;
    audio_duration_seconds?: number;
    confidence?: number;
  }) =>
    request<AiInterviewResponseSubmitResponse>(`/ai-interview/${encodeURIComponent(sessionId)}/response`, {
      method: 'POST',
      body,
      timeoutMs: 25000,
      skipAuth: true,
    }),

  proctoring: (sessionId: string, body: {
    event_type: string;
    timestamp: string;
    details?: unknown;
  }) =>
    request<AiInterviewProctoringResponse>(`/ai-interview/${encodeURIComponent(sessionId)}/proctoring`, {
      method: 'POST',
      body,
      timeoutMs: 25000,
      skipAuth: true,
    }),

  complete: (sessionId: string) =>
    request<AiInterviewEvaluationResult>(`/ai-interview/${encodeURIComponent(sessionId)}/complete`, {
      method: 'POST',
      timeoutMs: 45000,
      skipAuth: true,
    }),
};

// ============== Apply (Public) API ==============

export interface PublicJob {
  id: string;
  title: string;
  role: string;
  level: string;
  description: string;
  must_have_skills: string[];
  good_to_have_skills: string[];
  min_experience_years: number;
  is_active?: boolean;
  company_name?: string;
}

export interface ApplySubmissionResponse {
  id: string;
  job_id: string;
  candidate_id: string;
  status: string;
  message: string;
}

export const applyApi = {
  getJob: (jobId: string) =>
    request<PublicJob>(`/apply/job/${encodeURIComponent(jobId)}`, {
      timeoutMs: 20000,
      skipAuth: true,
    }),

  submit: (formData: FormData) =>
    uploadFile<ApplySubmissionResponse>(`/apply/submit`, formData, true, {
      timeoutMs: 60000,
    }),
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
  problem_slug?: string;
  code: string;
  language: string;
  test_results: {
    test_case_id: string;
    visibility: string;
    passed: boolean;
    status: string; // AC, WA, TLE, MLE, RE, CE, ERROR
    time_used: string | null;
    memory_used: string | null;
    input?: string;
    expected_output?: string;
    actual_output?: string;
  }[];
  summary?: {
    public_passed: number;
    public_total: number;
    private_passed: number;
    private_total: number;
    edge_passed: number;
    edge_total: number;
  };
  performance?: {
    avg_time_ms: string | null;
    max_time_ms: string | null;
    avg_memory_kb: number | null;
    max_memory_kb: number | null;
  };
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
  sql_score: number | null;
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
  integrity_score?: number;
  role_fit_index?: number;
  recommendation: string;
  strengths: string[];
  weaknesses?: string[];
  areas_for_improvement?: string[];
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

// ============== Manual Interview Details ==============

export interface ManualInterviewDetails {
  candidate_id: string;
  job_id: string;
  interview_mode: 'ai' | 'manual' | string;
  manual_interview_score: number | null;
  manual_interview_feedback: string | null;
  manual_interview_notes: string | null;
  manual_interview_at: string | null;
  manual_interview_entered_by: string | null;
  interview_status: string | null;
  interview_completed_at: string | null;
}

export interface ManualInterviewUpdatePayload {
  interview_mode?: 'ai' | 'manual' | string;
  manual_interview_score?: number | null;
  manual_interview_feedback?: string | null;
  manual_interview_notes?: string | null;
  manual_interview_at?: string | null;
  interview_status?: string | null;
  interview_completed_at?: string | null;
}

// ============== Job Status API ==============

export type BackgroundJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface BackgroundJobState<T = any> {
  id: string;
  type: string;
  status: BackgroundJobStatus;
  result?: T;
  error?: string | null;
  created_at: string;
  updated_at?: string;
  completed_at?: string | null;
}

export const jobStatusApi = {
  get: <T = any>(jobId: string) =>
    request<BackgroundJobState<T>>(`/job-status/${jobId}`, {
    }),
};

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
    request<ATSScreeningResult[]>(`/screening/candidate/${candidateId}`, {
    }),

  getForJob: (jobId: string, params?: { shortlisted_only?: boolean; min_score?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.shortlisted_only) searchParams.set('shortlisted_only', 'true');
    if (params?.min_score) searchParams.set('min_score', String(params.min_score));
    const query = searchParams.toString();
    return request<ATSScreeningResult[]>(`/screening/job/${jobId}${query ? `?${query}` : ''}`, {
    });
  },

  get: (id: string) =>
    request<ATSScreeningResult>(`/screening/${id}`, {
    }),
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
    return request<InterviewSession[]>(`/interviews${query ? `?${query}` : ''}`, {
    });
  },

  get: (id: string) =>
    request<InterviewSession>(`/interviews/${id}`, {
    }),

  create: (data: { candidate_id: string; job_id: string; screening_id?: string; scheduled_at?: string }) =>
    request<InterviewSession>('/interviews', {
      method: 'POST',
      body: data,
    }),

  start: (id: string) =>
    request<InterviewSession>(`/interviews/${id}/start`, {
      method: 'POST',
    }),

  getQuestions: (id: string) =>
    request<InterviewQuestion[]>(`/interviews/${id}/questions`, {
    }),

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
    request<PracticalAssessment[]>(`/interviews/${id}/practicals`, {
    }),

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
    request<InterviewEvaluation>(`/interviews/${id}/complete`, {
      method: 'POST',
    }),

  getEvaluation: (id: string) =>
    request<InterviewEvaluation>(`/interviews/${id}/evaluation`, {
    }),
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
  candidate_email?: string;
  job_title: string;
  job_id?: string;
  application_status?: string;
  final_status?: string | null;
  ats_score: number | null;
  shortlisted?: boolean | null;
  assessment_score: number | null;
  assessment_status?: string | null;
  interview_score: number | null;
  interview_status: string | null;
  technical_score: number | null;
  overall_score: number | null;
  recommendation: string | null;
  vendorName?: string | null;
}

export const analyticsApi = {
  getDashboard: () =>
    request<DashboardStats>('/analytics/dashboard', {
    }),

  getCandidates: (params?: { job_id?: string; status?: string; recommendation?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.job_id) searchParams.set('job_id', params.job_id);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.recommendation) searchParams.set('recommendation', params.recommendation);
    const query = searchParams.toString();
    return request<CandidateAnalytics[]>(`/analytics/candidates${query ? `?${query}` : ''}`, {
    });
  },

  getJobSummary: (jobId: string) =>
    request<{
      job: { id: string; title: string; role: string; level: string };
      applicants: { total: number; shortlisted: number; shortlist_rate: number };
      interviews: Record<string, number>;
      recommendations: Record<string, number>;
      average_score: number;
    }>(`/analytics/job/${jobId}/summary`, {
    }),

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
    }>(`/analytics/trends${query}`, {
    });
  },
};

// ============== Subscription API ==============

export interface SubscriptionInfo {
  plan: 'free' | 'starter' | 'professional' | 'enterprise';
  status: string;
  subscription_id: string | null;
  plan_selected_at: string | null;
  limits: {
    max_jobs: number;
    max_assessments: number;
    max_interviews: number;
    price: number;
    label: string;
  };
  usage: {
    jobs_count: number;
    assessments_count: number;
    interviews_count: number;
  };
}

export interface UsageInfo {
  plan: string;
  plan_label: string;
  usage: {
    jobs: { used: number; limit: number; label: string };
    assessments: { used: number; limit: number; label: string };
    interviews: { used: number; limit: number; label: string };
  };
}

export const subscriptionApi = {
  get: () =>
    request<SubscriptionInfo>('/subscription', {
    }),

  selectFree: () =>
    request<{ success: boolean; plan: string; message: string }>('/subscription/select-free', {
      method: 'POST',
    }),

  createOrder: (plan: string, currency?: string, country?: string) =>
    request<{ session_id: string; url: string; plan: string }>(
      '/subscription/create-order',
      { method: 'POST', body: { plan, currency, country } },
    ),

  verify: (data: {
    session_id: string;
    plan: string;
  }) =>
    request<{ success: boolean; plan: string; message: string }>(
      '/subscription/verify',
      { method: 'POST', body: data },
    ),

  cancel: () =>
    request<{ success: boolean; message: string }>('/subscription/cancel', {
      method: 'POST',
    }),

  reactivate: () =>
    request<{ success: boolean; message: string }>('/subscription/reactivate', {
      method: 'POST',
    }),
};

export const usageApi = {
  get: () =>
    request<UsageInfo>('/usage', {
    }),
};

// ============== Billing API ==============

export interface BillingUsageResponse {
  plan: 'free' | 'starter' | 'professional' | 'enterprise';
  status: string;
  billing_cycle_end: string;
  currency: string;
  country: string;
  validity: string;
  candidates_limit: number;
  candidates_count: number;
  price: number;
}

export interface BillingInvoice {
  metadata: any;
  id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  line_items: Array<Record<string, unknown>>;
  subtotal: number;
  tax_amount: number;
  total: number;
  status: 'pending' | 'paid' | 'overdue' | 'void';
  due_date: string;
  paid_at?: string | null;
  payment_reference?: string | null;
  created_at: string;
  updated_at: string;
}

export type BillingPlanId =
  | 'starter'
  | 'growth'
  | 'scale';

export const billingApi = {
  /**
   * Initiates a Stripe Checkout session for a given plan.
   * @param plan  Plan identifier
   * @param currency  'USD' or 'INR' — must match the user's geo-detected currency
   * @param country   ISO 3166-1 alpha-2 country code (e.g. 'IN', 'US')
   */
  subscribe: (plan: BillingPlanId, currency?: string, country?: string) =>
    request<{ success: boolean; session_id: string; checkout_url: string; plan: string; currency: string; deposit_amount: number }>(
      '/billing/subscribe',
      { method: 'POST', body: { plan, currency, country } },
    ),

  usage: () =>
    request<BillingUsageResponse>('/billing/usage', {
    }),

  topup: (amount: number) =>
    request<{ success: boolean; session_id: string; checkout_url: string }>('/billing/topup', {
      method: 'POST',
      body: { amount },
    }),

  payInvoice: (invoiceId: string) =>
    request<{ success: boolean; session_id?: string; checkout_url?: string; already_paid?: boolean }>('/billing/pay-invoice', {
      method: 'POST',
      body: { invoice_id: invoiceId },
    }),

  invoices: () =>
    request<BillingInvoice[]>('/billing/invoices', {
    }),

  verifySession: (sessionId: string, plan: string) =>
    request<{ success: boolean; plan: string; message: string }>(
      '/billing/verify-session',
      { method: 'POST', body: { session_id: sessionId, plan } },
    ),
};

// ============== Admin API ==============

export interface AdminOverview {
  generated_at: string;
  recruiters_total: number;
  plan_distribution: Record<string, number>;
  billing_paid_transactions_last_7d: number;
  billing_paid_amount_last_7d: number;
  billing_paid_transactions_prev_7d: number;
  billing_paid_amount_prev_7d: number;
}

export interface AdminRecruiterCandidateCount {
  recruiter_user_id: string;
  full_name?: string | null;
  email?: string | null;
  company_name?: string | null;
  subscription_plan: string;
  subscription_status: string;
  subscription_start_date?: string | null;
  candidates_enrolled_count: number;
  candidates_consumed_counter: number;
}

export interface AdminBillingTransaction {
  id: string;
  recruiter_user_id?: string;
  recruiter_full_name?: string | null;
  recruiter_email?: string | null;
  recruiter_company_name?: string | null;
  plan: string;
  status: string;
  raw_status: string;
  period_start: string;
  period_end: string;
  line_items: Array<Record<string, unknown>>;
  subtotal: number;
  tax_amount: number;
  total: number;
  due_date: string;
  paid_at?: string | null;
  payment_reference?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AdminBillingTransactionsSummary {
  transactions_count: number;
  total_amount: number;
  paid_transactions_count: number;
  paid_amount: number;
}

export interface AdminPlanRecruiter {
  recruiter_user_id: string;
  full_name: string;
  email: string;
  company_name: string;
  subscription_start_date?: string | null;
  subscription_status: string;
  subscription_plan: string;
  created_at?: string | null;
}

export interface AdminActivitySummary {
  generated_at: string;
  active_now_count: number;
  active_now_user_ids: string[];
  logins_today_unique_users: number;
  logins_7d_count: number;
  logins_7d_unique_users: number;
  logins_prev_7d_count: number;
  logins_prev_7d_unique_users: number;
}

export interface AdminLoginEvent {
  id: string;
  user_id: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  company_name?: string | null;
  last_login_at?: string | null;
  logged_in_at: string;
  ip_address?: string | null;
  user_agent?: string | null;
  status?: string | null;
}

export interface AdminCandidateEntry {
  candidate_id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  job_title: string;
  job_id?: string | null;
  recruiter_user_id?: string | null;
  recruiter_full_name?: string | null;
  recruiter_email?: string | null;
  recruiter_company_name?: string | null;
  application_status: string;
  created_at: string;
}

export interface AdminAllRecruiterEntry {
  recruiter_user_id: string;
  full_name: string;
  email: string;
  company_name: string;
  subscription_plan: string;
  jobs_count: number;
  candidates_count: number;
  assessments_count: number;
  interviews_count: number;
}

export interface AdminRecruiterDetails {
  recruiter_user_id: string;
  full_name: string;
  email: string;
  company_name: string;
  subscription_plan: string;
  subscription_status: string;
  plan_selected_at: string | null;
  created_at: string | null;
  jobs_count: number;
  candidates_count: number;
  assessments_count: number;
  interviews_count: number;
  recent_jobs: {
    id: string;
    title: string;
    role: string;
    level: string;
    created_at: string;
    is_active: boolean;
  }[];
}

export const adminApi = {
  health: () =>
    request<{ ok: boolean; scope: string }>('/admin/health', {
    }),

  overview: () =>
    request<AdminOverview>('/admin/overview', {
    }),

  recruiterCandidateCounts: (params?: { limit?: number; offset?: number }) => {
    const sp = new URLSearchParams();
    if (typeof params?.limit === 'number') sp.set('limit', String(params.limit));
    if (typeof params?.offset === 'number') sp.set('offset', String(params.offset));
    const q = sp.toString();
    return request<{ total_recruiters: number; recruiters: AdminRecruiterCandidateCount[] }>(
      `/admin/recruiters/candidate-counts${q ? `?${q}` : ''}`,
      {}
    );
  },

  subscriptionPlanCounts: () =>
    request<{ total_recruiters: number; by_plan: Record<string, number> }>('/admin/subscriptions/plan-counts', {
    }),

  billingTransactions: (params?: {
    recruiter_user_id?: string;
    plan?: string;
    status?: string;
    user?: string;
    company?: string;
    search?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
  }) => {
    const sp = new URLSearchParams();
    if (params?.recruiter_user_id) sp.set('recruiter_user_id', params.recruiter_user_id);
    if (params?.plan) sp.set('plan', params.plan);
    if (params?.status) sp.set('status', params.status);
    if (params?.user) sp.set('user', params.user);
    if (params?.company) sp.set('company', params.company);
    if (params?.search) sp.set('search', params.search);
    if (params?.start_date) sp.set('start_date', params.start_date);
    if (params?.end_date) sp.set('end_date', params.end_date);
    if (typeof params?.limit === 'number') sp.set('limit', String(params.limit));
    if (typeof params?.offset === 'number') sp.set('offset', String(params.offset));
    const q = sp.toString();
    return request<{
      total: number;
      offset: number;
      limit: number;
      transactions: AdminBillingTransaction[];
      summary: AdminBillingTransactionsSummary;
    }>(
      `/admin/billing/transactions${q ? `?${q}` : ''}`,
      {}
    );
  },

  loginsToday: (params?: { limit?: number; offset?: number }) => {
    const sp = new URLSearchParams();
    if (typeof params?.limit === 'number') sp.set('limit', String(params.limit));
    if (typeof params?.offset === 'number') sp.set('offset', String(params.offset));
    const q = sp.toString();
    return request<{ total: number; offset: number; limit: number; logins: AdminLoginEvent[] }>(
      `/admin/activity/logins-today${q ? `?${q}` : ''}`,
      {}
    );
  },

  planRecruiters: (params: { plan: string; search?: string; limit?: number; offset?: number }) => {
    const sp = new URLSearchParams();
    sp.set('plan', params.plan);
    if (params.search) sp.set('search', params.search);
    if (typeof params.limit === 'number') sp.set('limit', String(params.limit));
    if (typeof params.offset === 'number') sp.set('offset', String(params.offset));
    return request<{
      plan: string;
      total: number;
      offset: number;
      limit: number;
      recruiters: AdminPlanRecruiter[];
    }>(`/admin/subscriptions/plan-recruiters?${sp.toString()}`, {});
  },

  allRecruiters: (params?: { search?: string; limit?: number; offset?: number }) => {
    const sp = new URLSearchParams();
    if (params?.search) sp.set('search', params.search);
    if (typeof params?.limit === 'number') sp.set('limit', String(params.limit));
    if (typeof params?.offset === 'number') sp.set('offset', String(params.offset));
    const q = sp.toString();
    return request<{ total: number; offset: number; limit: number; recruiters: AdminAllRecruiterEntry[] }>(
      `/admin/recruiters/all${q ? `?${q}` : ''}`,
      {}
    );
  },

  recruiterDetails: (recruiterId: string) => {
    return request<AdminRecruiterDetails>(`/admin/recruiters/${recruiterId}`, {});
  },

  activitySummary: () =>
    request<AdminActivitySummary>('/admin/activity/summary', {
    }),

  recentLogins: (limit?: number) => {
    const sp = new URLSearchParams();
    if (typeof limit === 'number') sp.set('limit', String(limit));
    const q = sp.toString();
    return request<{ logins: AdminLoginEvent[] }>(
      `/admin/activity/recent-logins${q ? `?${q}` : ''}`,
      {}
    );
  },

  candidatesList: (params?: { limit?: number; offset?: number }) => {
    const sp = new URLSearchParams();
    if (typeof params?.limit === 'number') sp.set('limit', String(params.limit));
    if (typeof params?.offset === 'number') sp.set('offset', String(params.offset));
    const q = sp.toString();
    return request<{ total: number; offset: number; limit: number; candidates: AdminCandidateEntry[] }>(
      `/admin/candidates/list${q ? `?${q}` : ''}`,
      {}
    );
  },
};

// ============== DSA Problems API ==============

export interface DsaProblem {
  id: string;
  slug: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard' | string;
  category: string;
  tags: string[];
  description?: string;
  constraints?: string;
  examples?: unknown[];
  starter_code?: Record<string, string>;
  solution_wrappers?: Record<string, string>;
  test_cases?: unknown[];
  points: number;
  time_limit_seconds?: number;
  memory_limit_kb?: number;
  is_active: boolean;
  created_at: string;
}

export const dsaProblemsApi = {
  list: (params?: { difficulty?: string; category?: string; is_active?: boolean }) => {
    const sp = new URLSearchParams();
    if (params?.difficulty) sp.set('difficulty', params.difficulty);
    if (params?.category) sp.set('category', params.category);
    if (params?.is_active === false) sp.set('is_active', 'false');
    const q = sp.toString();
    return request<DsaProblem[]>(`/dsa-problems${q ? `?${q}` : ''}`, {
    });
  },

  get: (id: string) =>
    request<DsaProblem>(`/dsa-problems/${id}`, {
    }),

  create: (data: Partial<DsaProblem>) =>
    request<DsaProblem>('/dsa-problems', {
      method: 'POST',
      body: data,
    }),

  update: (id: string, data: Partial<DsaProblem>) =>
    request<DsaProblem>(`/dsa-problems/${id}`, {
      method: 'PATCH',
      body: data,
    }),

  delete: (id: string) =>
    request<{ success: boolean; message: string }>(`/dsa-problems/${id}`, {
      method: 'DELETE',
    }),
};

export { APIError };
