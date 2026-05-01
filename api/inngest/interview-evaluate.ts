import { inngest } from '../_lib/inngest';
import { getSupabaseAdmin } from '../_lib/supabase';
import { generateJSON } from '../_lib/openai';
import { updateJobStatus } from '../_lib/jobTracker';
import { normalizeInterviewQuestions } from '../_lib/interview-gen';

export const interviewEvaluateWorker = inngest.createFunction(
  { id: 'interview-evaluate', name: 'AI Interview Evaluation', event: 'interview/evaluate' },
  async ({ event, step }) => {
    const { job_id: trackerJobId, session_id: sessionId } = event.data;

    try {
      await updateJobStatus(trackerJobId, 'processing');

      // 1. Fetch Session
      const session = await step.run('fetch-session', async () => {
        const supabase = getSupabaseAdmin();
        const { data: session } = await supabase
          .from('ai_interview_sessions')
          .select('*, candidates(full_name), job_descriptions(title, role, level, must_have_skills)')
          .eq('id', sessionId)
          .single();
        if (!session) throw new Error(`Session ${sessionId} not found`);
        return session;
      });

      // 2. Evaluate
      const finalEvaluation = await step.run('evaluate-interview', async () => {
        const questions = normalizeInterviewQuestions(session.questions);
        const responses = session.responses || [];

        const qaPairs = questions.map((q: any, i: number) => {
          const resp = responses.find((r: any) => r.question_index === i);
          return `Q${i + 1} (${q.type}): ${q.text}\nA${i + 1}: ${resp?.transcript || '[No response]'}`;
        }).join('\n\n');

        const evalPrompt = `Evaluate this AI interview for a ${session.job_descriptions?.level} ${session.job_descriptions?.role} position (${session.job_descriptions?.title}).
Required skills: ${(session.job_descriptions?.must_have_skills || []).join(', ')}

Interview Q&A:
${qaPairs}

Evaluate and return JSON:
{
  "overall_score": 0-100,
  "technical_score": 0-100,
  "communication_score": 0-100,
  "confidence_score": 0-100,
  "recommendation": "strong_hire" or "hire" or "maybe" or "no_hire",
  "strengths": ["strength1", "strength2"],
  "areas_for_improvement": ["area1", "area2"],
  "detailed_feedback": "2-3 sentence summary of candidate performance"
}`;
        
        try {
          return await generateJSON<any>(evalPrompt);
        } catch {
          const answeredCount = responses.filter((r: any) => r.transcript && r.transcript.trim()).length;
          const completionRate = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;
          return {
            overall_score: Math.round(completionRate * 0.7),
            technical_score: Math.round(completionRate * 0.6),
            communication_score: Math.round(completionRate * 0.8),
            confidence_score: Math.round(completionRate * 0.7),
            recommendation: completionRate >= 70 ? 'maybe' : 'no_hire',
            strengths: answeredCount > 0 ? ['Completed interview responses'] : [],
            areas_for_improvement: ['Could not perform AI evaluation - scores are approximate'],
            detailed_feedback: `Candidate answered ${answeredCount} of ${questions.length} questions.`,
          };
        }
      });

      // 3. Save to DB
      await step.run('save-evaluation', async () => {
        const supabase = getSupabaseAdmin();
        await supabase.from('ai_interview_sessions').update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          final_evaluation: finalEvaluation,
        }).eq('id', sessionId);
      });

      await updateJobStatus(trackerJobId, 'completed', finalEvaluation);
      return { success: true, finalEvaluation };
    } catch (err: any) {
      console.error('[Inngest] interview-evaluate failed:', err);
      await updateJobStatus(trackerJobId, 'failed', null, err.message);
      throw err;
    }
  }
);
