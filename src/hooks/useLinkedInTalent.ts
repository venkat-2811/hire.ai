import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { linkedInTalentApi } from '@/lib/api';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LinkedInFilters {
  keywords?: string;
  skills?: string[];
  job_titles?: string[];
  similar_roles?: string[];
  experience_min?: number;
  experience_max?: number;
  industry?: string;
  location?: string;
  seniority?: string;
  preferred_education?: string;
  current_role?: string;
  company?: string;
  language?: string;
  open_to_work?: boolean;
}

export interface LinkedInCandidate {
  provider_id?: string;
  public_identifier?: string;
  first_name?: string;
  last_name?: string;
  headline?: string;
  location?: string;
  profile_picture_url?: string;
  profile_picture_url_large?: string;
  email?: string;              // populated when Unipile returns it (open/premium profiles)
  summary?: string;
  work_experience?: WorkExperience[];
  education?: Education[];
  skills?: Skill[];
  languages?: Language[];
  certifications?: Certification[];
  follower_count?: number;
  connections_count?: number;
  is_open_profile?: boolean;
  is_premium?: boolean;
  network_distance?: string;
  websites?: string[];
  recommendations?: { given_total_count: number; received_total_count: number };
  match_score?: number;
  ai_summary?: string;
  strengths?: string[];
  gaps?: string[];
  public_profile_url?: string;
}

export interface WorkExperience {
  company?: string;
  company_id?: string;
  company_picture_url?: string;
  position?: string;
  location?: string;
  start?: string;
  end?: string;
  skills?: string[];
}

export interface Education {
  school?: string;
  school_id?: string;
  school_picture_url?: string;
  degree?: string;
  start?: string;
  end?: string;
}

export interface Skill {
  name?: string;
  [key: string]: any;
}

export interface Language {
  name?: string;
  proficiency?: string;
}

export interface Certification {
  name?: string;
  issuer?: string;
  date?: string;
}

export interface SearchResult {
  search_id?: string;
  requested: number;
  retrieved: number;
  profiles: LinkedInCandidate[];
}

export interface SearchHistory {
  id: string;
  job_id: string;
  filters: LinkedInFilters;
  candidate_count_requested: number;
  profiles_retrieved: number;
  candidates_contacted: number;
  created_at: string;
}

export interface SavedCandidate {
  id: string;
  job_id: string;
  linkedin_id?: string;
  public_identifier?: string;
  profile_data: LinkedInCandidate;
  match_score: number;
  ai_summary?: string;
  notes?: string;
  tags?: string[];
  status: 'saved' | 'contacted' | 'interested' | 'archived';
  contacted_at?: string;
  created_at: string;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useLinkedInAccounts() {
  return useQuery({
    queryKey: ['linkedin-accounts'],
    queryFn: () => linkedInTalentApi.getAccounts(),
    staleTime: 60_000,
    retry: false,
  });
}

export function useGenerateFilters() {
  return useMutation({
    mutationFn: (params: {
      job_id: string;
      title?: string;
      description?: string;
      must_have_skills?: string[];
      good_to_have_skills?: string[];
      min_experience_years?: number;
      location?: string;
    }) => linkedInTalentApi.generateFilters(params),
    onError: (e: Error) => toast.error(e.message || 'Failed to generate filters'),
  });
}

export function useLinkedInSearch() {
  return useMutation({
    mutationFn: (params: {
      job_id: string;
      filters: LinkedInFilters;
      candidate_count: number;
      title?: string;
      description?: string;
      must_have_skills?: string[];
    }) => linkedInTalentApi.search(params),
    onError: (e: Error) => toast.error(e.message || 'LinkedIn search failed'),
  });
}

export function useRankCandidates() {
  return useMutation({
    mutationFn: (params: {
      job_id: string;
      title: string;
      description: string;
      must_have_skills?: string[];
      good_to_have_skills?: string[];
      min_experience_years?: number;
      candidates: LinkedInCandidate[];
    }) => linkedInTalentApi.rankCandidates(params),
    onError: (e: Error) => toast.error(e.message || 'Ranking failed'),
  });
}

export function useGetFullProfile() {
  return useMutation({
    mutationFn: (params: { identifier: string; account_id?: string }) =>
      linkedInTalentApi.getProfile(params),
    onError: (e: Error) => toast.error(e.message || 'Failed to load profile'),
  });
}

export function useGenerateEmail() {
  return useMutation({
    mutationFn: (params: {
      candidate: LinkedInCandidate;
      job_title: string;
      company_name: string;
      job_description?: string;
      recruiter_name?: string;
      job_apply_url?: string;
    }) => linkedInTalentApi.generateEmail(params),
    onError: (e: Error) => toast.error(e.message || 'Failed to generate email'),
  });
}

export function useSaveCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      job_id: string;
      search_id?: string;
      profile: LinkedInCandidate;
      match_score?: number;
      ai_summary?: string;
    }) => linkedInTalentApi.saveCandidate(params),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['linkedin-saved-candidates', vars.job_id] });
      toast.success('Candidate saved!');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to save candidate'),
  });
}

export function useUnsaveCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { job_id: string; linkedin_id: string }) =>
      linkedInTalentApi.unsaveCandidate(params.job_id, params.linkedin_id),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['linkedin-saved-candidates', vars.job_id] });
      toast.success('Candidate removed from saved list');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to unsave candidate'),
  });
}

export function useUpdateCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      id: string;
      job_id: string;
      notes?: string;
      tags?: string[];
      status?: string;
    }) => linkedInTalentApi.updateCandidate(params.id, {
      notes: params.notes,
      tags: params.tags,
      status: params.status,
    }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['linkedin-saved-candidates', vars.job_id] });
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to update candidate'),
  });
}

export function useSavedCandidates(jobId: string) {
  return useQuery({
    queryKey: ['linkedin-saved-candidates', jobId],
    queryFn: async () => {
      try {
        return await linkedInTalentApi.getSavedCandidates(jobId);
      } catch {
        // Graceful fallback: table not migrated, network error, or timeout
        return { candidates: [] };
      }
    },
    enabled: !!jobId,
    retry: false,
    staleTime: 30_000,
  });
}

export function useSearchHistory(jobId: string) {
  return useQuery({
    queryKey: ['linkedin-search-history', jobId],
    queryFn: async () => {
      try {
        return await linkedInTalentApi.getSearchHistory(jobId);
      } catch {
        return { searches: [] };
      }
    },
    enabled: !!jobId,
    retry: false,
    staleTime: 30_000,
  });
}

export function useSendLinkedInMessage() {
  return useMutation({
    mutationFn: (params: {
      account_id: string;
      provider_id: string;
      message: string;
    }) => linkedInTalentApi.sendMessage(params),
    onSuccess: () => toast.success('LinkedIn message sent!'),
    onError: (e: Error) => toast.error(e.message || 'Failed to send message'),
  });
}

export function useSendOutreachEmail() {
  return useMutation({
    mutationFn: (params: {
      to_email: string;
      subject: string;
      body: string;
      candidate_name?: string;
      job_title?: string;
      job_apply_url?: string;
    }) => linkedInTalentApi.sendOutreachEmail(params),
    onSuccess: () => toast.success('Email sent successfully!'),
    onError: (e: Error) => toast.error(e.message || 'Failed to send email'),
  });
}

export function useAtsScoreProfile() {
  return useMutation({
    mutationFn: (params: {
      job_id: string;
      profile: LinkedInCandidate;
    }) => linkedInTalentApi.atsScoreProfile(params),
    onError: (e: Error) => toast.error(e.message || 'ATS scoring failed'),
  });
}

export interface AtsScoreResult {
  skills_score: number;
  experience_score: number;
  education_score: number;
  overall_score: number;
  strengths: string[];
  gaps: string[];
  recommendation: string;
  recommendation_reason: string;
}

export function useAddAsCandidate() {
  return useMutation({
    mutationFn: (params: {
      job_id: string;
      profile: LinkedInCandidate;
    }) => linkedInTalentApi.addAsCandidate(params),
    onError: (e: Error) => toast.error(e.message || 'Failed to add candidate'),
  });
}
