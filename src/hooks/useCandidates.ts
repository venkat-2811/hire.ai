import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

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
  resume_parsed_data: ResumeData | Json | null;
  portfolio_url: string | null;
  github_url: string | null;
  consent_given: boolean;
  consent_timestamp: string | null;
  created_at: string;
  updated_at: string;
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
  reason_codes: Json;
  detailed_analysis: Json | null;
  screened_at: string;
}

export function useCandidates(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['candidates', params],
    queryFn: async () => {
      let query = supabase.from('candidates').select('*').order('created_at', { ascending: false });
      
      if (params?.limit) {
        query = query.limit(params.limit);
      }
      if (params?.offset) {
        query = query.range(params.offset, params.offset + (params.limit || 10) - 1);
      }
      
      const { data, error } = await query;
      
      if (error) throw new Error(error.message);
      return data as Candidate[];
    },
  });
}

export function useCandidate(id: string) {
  return useQuery({
    queryKey: ['candidates', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw new Error(error.message);
      return data as Candidate;
    },
    enabled: !!id,
  });
}

interface CreateCandidateData {
  full_name: string;
  email: string;
  phone?: string;
  portfolio_url?: string;
  github_url?: string;
  consent_given: boolean;
  resume_file?: File;
}

export function useCreateCandidate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateCandidateData | FormData) => {
      let candidateData: {
        full_name: string;
        email: string;
        phone?: string | null;
        portfolio_url?: string | null;
        github_url?: string | null;
        consent_given: boolean;
        consent_timestamp?: string;
        resume_url?: string | null;
      };
      
      let resumeFile: File | null = null;
      
      // Handle FormData or plain object
      if (data instanceof FormData) {
        candidateData = {
          full_name: data.get('full_name') as string,
          email: data.get('email') as string,
          phone: (data.get('phone') as string) || null,
          portfolio_url: (data.get('portfolio_url') as string) || null,
          github_url: (data.get('github_url') as string) || null,
          consent_given: data.get('consent_given') === 'true',
          consent_timestamp: new Date().toISOString(),
        };
        resumeFile = data.get('resume') as File | null;
      } else {
        candidateData = {
          full_name: data.full_name,
          email: data.email,
          phone: data.phone || null,
          portfolio_url: data.portfolio_url || null,
          github_url: data.github_url || null,
          consent_given: data.consent_given,
          consent_timestamp: new Date().toISOString(),
        };
        resumeFile = data.resume_file || null;
      }
      
      // Upload resume if provided
      if (resumeFile) {
        const fileExt = resumeFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `resumes/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(filePath, resumeFile);
        
        if (uploadError) {
          console.error('Resume upload error:', uploadError);
          // Continue without resume URL if upload fails
        } else {
          const { data: urlData } = supabase.storage
            .from('resumes')
            .getPublicUrl(filePath);
          candidateData.resume_url = urlData.publicUrl;
        }
      }
      
      // Insert candidate
      const { data: candidate, error } = await supabase
        .from('candidates')
        .insert(candidateData)
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      
      // Call parse-resume edge function if resume was uploaded
      if (candidateData.resume_url && candidate) {
        try {
          const { error: parseError } = await supabase.functions.invoke('parse-resume', {
            body: { 
              candidate_id: candidate.id,
              resume_url: candidateData.resume_url
            }
          });
          
          if (parseError) {
            console.error('Resume parsing error:', parseError);
          }
        } catch (e) {
          console.error('Resume parsing failed:', e);
        }
      }
      
      return candidate as Candidate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      toast.success('Candidate created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create candidate');
    },
  });
}

export function useUploadResume() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${id}-${Date.now()}.${fileExt}`;
      const filePath = `resumes/${fileName}`;
      
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(filePath, file);
      
      if (uploadError) throw new Error(uploadError.message);
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('resumes')
        .getPublicUrl(filePath);
      
      // Update candidate with resume URL
      const { data, error } = await supabase
        .from('candidates')
        .update({ resume_url: urlData.publicUrl })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      
      // Call parse-resume edge function
      try {
        await supabase.functions.invoke('parse-resume', {
          body: { 
            candidate_id: id,
            resume_url: urlData.publicUrl
          }
        });
      } catch (e) {
        console.error('Resume parsing failed:', e);
      }
      
      return data as Candidate;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      queryClient.invalidateQueries({ queryKey: ['candidates', id] });
      toast.success('Resume uploaded and parsed successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload resume');
    },
  });
}

export function useCandidateScreenings(candidateId: string) {
  return useQuery({
    queryKey: ['screenings', 'candidate', candidateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ats_screenings')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('screened_at', { ascending: false });
      
      if (error) throw new Error(error.message);
      return data as ATSScreeningResult[];
    },
    enabled: !!candidateId,
  });
}

export function useRunScreening() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ candidateId, jobId }: { candidateId: string; jobId: string }) => {
      // Call ats-screening edge function
      const { data, error } = await supabase.functions.invoke('ats-screening', {
        body: { 
          candidate_id: candidateId,
          job_id: jobId
        }
      });
      
      if (error) throw new Error(error.message);
      return data as ATSScreeningResult;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['screenings'] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      
      if (result.shortlisted) {
        toast.success(`Candidate shortlisted with score ${result.overall_score}%`);
      } else {
        toast.info(`Screening complete. Score: ${result.overall_score}%`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to run screening');
    },
  });
}
