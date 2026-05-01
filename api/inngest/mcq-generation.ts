import { inngest } from '../_lib/inngest';
import { getSupabaseAdmin } from '../_lib/supabase';
import { generateAssessmentMcqsForJob } from '../_lib/mcq';
import { updateJobStatus } from '../_lib/jobTracker';

export const mcqGenerationWorker = inngest.createFunction(
  { id: 'mcq-generation', name: 'MCQ Generation' },
  { event: 'assessment/generate-mcqs' },
  async ({ event, step }) => {
    const { job_id: trackerJobId, internal_job_id: internalJobId, mcqCount, difficulty } = event.data;

    try {
      await updateJobStatus(trackerJobId, 'processing');

      // 1. Fetch Job
      const jobDesc = await step.run('fetch-job', async () => {
        const supabase = getSupabaseAdmin();
        const { data: job } = await supabase.from('job_descriptions').select('*').eq('id', internalJobId).single();
        if (!job) throw new Error(`Job ${internalJobId} not found`);
        return job;
      });

      // 2. Generate MCQs
      const mcqs = await step.run('generate-mcqs', async () => {
        return generateAssessmentMcqsForJob({
          job: jobDesc,
          mcqCount,
          difficulty
        });
      });

      // 3. Update DB
      await step.run('save-mcqs', async () => {
        const supabase = getSupabaseAdmin();
        const { error } = await supabase.from('job_descriptions')
          .update({
            assessment_mcqs: mcqs,
            mcq_generation_status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', internalJobId);

        if (error) throw new Error(`Failed to save MCQs: ${error.message}`);
      });

      await updateJobStatus(trackerJobId, 'completed', mcqs);
      return { success: true, count: mcqs.length };
    } catch (err: any) {
      console.error('[Inngest] mcq-generation failed:', err);
      await updateJobStatus(trackerJobId, 'failed', null, err.message);
      
      // Update the job posting status to failed as well
      const supabase = getSupabaseAdmin();
      await supabase.from('job_descriptions')
        .update({ mcq_generation_status: 'failed' })
        .eq('id', internalJobId);
        
      throw err;
    }
  }
);
