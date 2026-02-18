import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  candidatesApi,
  screeningApi,
  type Candidate,
} from '@/lib/api';

export function useCandidates(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['candidates', params],
    queryFn: () => candidatesApi.list(params),
  });
}

export function useCandidate(id: string) {
  return useQuery({
    queryKey: ['candidates', id],
    queryFn: () => candidatesApi.get(id),
    enabled: !!id,
  });
}

export function useCreateCandidate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: FormData) => candidatesApi.create(data),
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

export function useDeleteCandidate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => candidatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      toast.success('Candidate deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete candidate');
    },
  });
}
