import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  interviewsApi,
  InterviewSession,
  InterviewQuestion,
  CandidateResponse,
  PracticalAssessment,
  PracticalSubmission,
  InterviewEvaluation,
  ProctoringData
} from '@/lib/api';
import { toast } from 'sonner';

export function useInterviews(params?: { status?: string; candidate_id?: string; job_id?: string }) {
  return useQuery({
    queryKey: ['interviews', params],
    queryFn: () => interviewsApi.list(params),
  });
}

export function useInterview(id: string) {
  return useQuery({
    queryKey: ['interviews', id],
    queryFn: () => interviewsApi.get(id),
    enabled: !!id,
  });
}

export function useCreateInterview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { candidate_id: string; job_id: string; screening_id?: string; scheduled_at?: string }) =>
      interviewsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      toast.success('Interview session created');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create interview');
    },
  });
}

export function useStartInterview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => interviewsApi.start(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      queryClient.invalidateQueries({ queryKey: ['interviews', id] });
      toast.success('Interview started - questions generated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to start interview');
    },
  });
}

export function useInterviewQuestions(sessionId: string) {
  return useQuery({
    queryKey: ['interviews', sessionId, 'questions'],
    queryFn: () => interviewsApi.getQuestions(sessionId),
    enabled: !!sessionId,
  });
}

export function useSubmitResponse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, data }: {
      sessionId: string;
      data: { question_id: string; response_text?: string; response_code?: string; time_taken_seconds?: number }
    }) => interviewsApi.submitResponse(sessionId, data),
    onSuccess: (response, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: ['interviews', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      if (response.ai_score !== null) {
        toast.success(`Response evaluated: ${response.ai_score}%`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit response');
    },
  });
}

export function usePracticalAssessments(sessionId: string) {
  return useQuery({
    queryKey: ['interviews', sessionId, 'practicals'],
    queryFn: () => interviewsApi.getPracticals(sessionId),
    enabled: !!sessionId,
  });
}

export function useSubmitPractical() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, assessmentId, data }: {
      sessionId: string;
      assessmentId: string;
      data: { submitted_code?: string; submitted_answer?: string; time_taken_seconds?: number }
    }) => interviewsApi.submitPractical(sessionId, assessmentId, data),
    onSuccess: (submission, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: ['interviews', sessionId, 'practicals'] });
      if (submission.score !== null) {
        toast.success(`Practical evaluated: ${submission.score}%`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit practical');
    },
  });
}

export function useUpdateProctoring() {
  return useMutation({
    mutationFn: ({ sessionId, data }: { sessionId: string; data: ProctoringData }) =>
      interviewsApi.updateProctoring(sessionId, data),
  });
}

export function useCompleteInterview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => interviewsApi.complete(id),
    onSuccess: (evaluation, id) => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      queryClient.invalidateQueries({ queryKey: ['interviews', id] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });

      const recText = evaluation.recommendation?.replace('_', ' ').toUpperCase() || 'PENDING';
      toast.success(`Interview completed - Recommendation: ${recText}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to complete interview');
    },
  });
}

export function useInterviewEvaluation(sessionId: string) {
  return useQuery({
    queryKey: ['interviews', sessionId, 'evaluation'],
    queryFn: () => interviewsApi.getEvaluation(sessionId),
    enabled: !!sessionId,
  });
}
