import { inngest } from '../_lib/inngest';
import { getSupabaseAdmin } from '../_lib/supabase';
import { updateJobStatus } from '../_lib/jobTracker';
import { normalizeInterviewQuestions, generateCandidateInterviewQuestions } from '../_lib/interview-gen';
import { sendInterviewInvite } from '../_lib/offer-utils';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export const interviewQuestionGenWorker = inngest.createFunction(
  { id: 'interview-question-gen', name: 'Interview Question Generation', event: 'interview/generate-questions' },
  async ({ event, step }) => {
    const { 
      job_id: trackerJobId, 
      candidate_id: candidateId, 
      internal_job_id: internalJobId,
      requestedCount,
      deadlineIso,
      scheduledTime,
      frontendUrl 
    } = event.data;

    try {
      await updateJobStatus(trackerJobId, 'processing');

      // 1. Fetch Job and Candidate
      const { job, candidate } = await step.run('fetch-data', async () => {
        const supabase = getSupabaseAdmin();
        const { data: job } = await supabase.from('job_descriptions').select('*').eq('id', internalJobId).single();
        const { data: candidate } = await supabase.from('candidates').select('*').eq('id', candidateId).single();
        if (!job || !candidate) throw new Error('Data not found');
        return { job, candidate };
      });

      // 2. Generate questions
      const questions = await step.run('generate-questions', async () => {
        return generateCandidateInterviewQuestions(
          { title: job.title, role: job.role, level: job.level, must_have_skills: job.must_have_skills || [], description: job.description || '' },
          { full_name: candidate.full_name, resume_parsed_data: candidate.resume_parsed_data },
          requestedCount
        );
      });

      // 3. Create Session and Send Invite
      const sessionId = await step.run('create-session-and-invite', async () => {
        const supabase = getSupabaseAdmin();
        const token = crypto.randomBytes(32).toString('base64url');
        const sessionId = uuidv4();

        const normalizedQuestions = normalizeInterviewQuestions(questions);
        if (normalizedQuestions.length === 0) throw new Error('No interview questions generated');

        const resume = candidate.resume_parsed_data || {};
        const resumeInsights = {
          skills: Array.isArray(resume.skills) ? resume.skills.slice(0, 15) : [],
          experience_summary: Array.isArray(resume.experience)
            ? resume.experience.slice(0, 3).map((e: any) => `${e.title || ''} at ${e.company || ''}`).join('; ')
            : (typeof resume.experience === 'string' ? resume.experience.slice(0, 300) : ''),
          education_summary: Array.isArray(resume.education)
            ? resume.education.slice(0, 2).map((e: any) => `${e.degree || ''} from ${e.institution || ''}`).join('; ')
            : (typeof resume.education === 'string' ? resume.education.slice(0, 200) : ''),
        };

        const { error: insertErr } = await supabase.from('ai_interview_sessions').insert({
          id: sessionId,
          candidate_id: candidateId,
          job_id: internalJobId,
          token,
          status: 'pending',
          deadline: deadlineIso,
          current_question_index: 0,
          questions: normalizedQuestions,
          responses: [],
          proctoring_data: { warnings: [], camera_enabled: false, microphone_enabled: false, resume_insights: resumeInsights },
          created_at: new Date().toISOString(),
        });

        if (insertErr) throw new Error(`Failed to create session: ${insertErr.message}`);

        try {
          await sendInterviewInvite(candidate.email, candidate.full_name, job.title, `${frontendUrl}/ai-interview/${encodeURIComponent(token)}`, scheduledTime);
        } catch (emailErr: any) {
          await supabase.from('ai_interview_sessions').delete().eq('id', sessionId);
          throw new Error(`Failed to send invite email: ${emailErr?.message || emailErr}`);
        }

        return sessionId;
      });

      await updateJobStatus(trackerJobId, 'completed', { sessionId });
      return { success: true, sessionId };
    } catch (err: any) {
      console.error('[Inngest] interview-question-gen failed:', err);
      await updateJobStatus(trackerJobId, 'failed', null, err.message);
      throw err;
    }
  }
);
