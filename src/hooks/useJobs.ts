import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { JobRole, RoleLevel } from '@/types/database';
import { jobsApi } from '@/lib/api';

export interface JobDescription {
  id: string;
  created_by: string | null;
  title: string;
  role: JobRole;
  level: RoleLevel;
  description: string;
  must_have_skills: string[];
  good_to_have_skills: string[];
  min_experience_years: number | null;
  resume_cutoff: number;
  assessment_cutoff: number;
  interview_cutoff: number;
  include_sql_assessment: boolean;
  // Recruiter-controlled Salesforce/Apex flags
  is_salesforce_job: boolean;
  include_apex_assessment: boolean;
  location?: string;
  endCustomer?: 'your_own_company' | 'end_customer';
  end_customer?: 'your_own_company' | 'end_customer';
  end_customer_name?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

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
  include_sql_assessment?: boolean;
  // Recruiter-controlled Salesforce/Apex flags
  is_salesforce_job?: boolean;
  include_apex_assessment?: boolean;
  location?: string;
  endCustomer?: 'your_own_company' | 'end_customer';
  end_customer_name?: string | null;
}

export function useJobs(params?: { role?: string; level?: string; is_active?: boolean }) {
  return useQuery({
    queryKey: ['jobs', params],
    queryFn: () => jobsApi.list(params),
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: ['jobs', id],
    queryFn: () => jobsApi.get(id),
    enabled: !!id,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (job: JobDescriptionCreate) => {
      return jobsApi.create(job);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create job');
    },
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<JobDescriptionCreate> }) => {
      return jobsApi.update(id, data);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs', id] });
      toast.success('Job updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update job');
    },
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, permanent = false }: { id: string; permanent?: boolean }) => {
      return jobsApi.delete(id, permanent);
    },
    onSuccess: (_, { permanent }) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      toast.success(permanent ? 'Job and all related data permanently deleted' : 'Job archived successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete job');
    },
  });
}
