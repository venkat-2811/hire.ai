import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
  min_experience_years: number | null;
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
}

export function useJobs(params?: { role?: string; level?: string; is_active?: boolean }) {
  return useQuery({
    queryKey: ['jobs', params],
    queryFn: async () => {
      let query = supabase.from('job_descriptions').select('*');
      
      if (params?.role) {
        query = query.eq('role', params.role);
      }
      if (params?.level) {
        query = query.eq('level', params.level);
      }
      if (params?.is_active !== undefined) {
        query = query.eq('is_active', params.is_active);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw new Error(error.message);
      return data as JobDescription[];
    },
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: ['jobs', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_descriptions')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw new Error(error.message);
      return data as JobDescription;
    },
    enabled: !!id,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (job: JobDescriptionCreate) => {
      const { data, error } = await supabase
        .from('job_descriptions')
        .insert({
          title: job.title,
          role: job.role,
          level: job.level,
          description: job.description,
          must_have_skills: job.must_have_skills,
          good_to_have_skills: job.good_to_have_skills,
          min_experience_years: job.min_experience_years,
          is_active: true,
        })
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      return data as JobDescription;
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
      const { data: result, error } = await supabase
        .from('job_descriptions')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      return result as JobDescription;
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
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('job_descriptions')
        .update({ is_active: false })
        .eq('id', id);
      
      if (error) throw new Error(error.message);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job archived successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to archive job');
    },
  });
}
