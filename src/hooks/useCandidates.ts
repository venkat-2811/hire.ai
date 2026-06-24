import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  candidatesApi,
  screeningApi,
  type Candidate,
  type CandidateCreatePayload,
} from '@/lib/api';

export function useCandidates(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['candidates', params],
    queryFn: () => candidatesApi.list(params),
  });
}

export function useUnassignedCandidates() {
  return useQuery({
    queryKey: ['candidates', 'unassigned'],
    queryFn: () => candidatesApi.list({ unassigned: true } as any),
  });
}

export function useCandidate(id: string, jobId?: string) {
  return useQuery({
    queryKey: ['candidates', id, jobId],
    queryFn: () => candidatesApi.get(id, jobId),
    enabled: !!id,
  });
}

export function useCreateCandidate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CandidateCreatePayload) => candidatesApi.create(data),
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
      return candidatesApi.uploadResume(id, file);
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
    queryFn: () => screeningApi.getForCandidate(candidateId),
    enabled: !!candidateId,
  });
}

export function useRunScreening() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ candidateId, jobId }: { candidateId: string; jobId: string }) => {
      return screeningApi.run(candidateId, jobId);
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['screenings'] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });

      const data = result.screeningData || result;
      if (data.shortlisted) {
        toast.success(`Candidate shortlisted with score ${data.overall_score}%`);
      } else {
        toast.info(`Screening complete. Score: ${data.overall_score}%`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to run screening');
    },
  });
}

export function useDeleteCandidate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, jobId }: { id: string; jobId?: string }) => candidatesApi.delete(id, jobId),
    onSuccess: () => {
      // Invalidate ALL related caches to prevent stale data from reappearing
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      queryClient.invalidateQueries({ queryKey: ['screenings'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['results'] });
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      toast.success('Candidate deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete candidate');
    },
  });
}
