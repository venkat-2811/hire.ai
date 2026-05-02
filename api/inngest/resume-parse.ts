import { inngest } from '../_lib/inngest';
import { getSupabaseAdmin } from '../_lib/supabase';
import { generateJSON } from '../_lib/openai';
import { updateJobStatus } from '../_lib/jobTracker';

export const resumeParseWorker = inngest.createFunction(
  { id: 'resume-parse', name: 'Resume AI Parsing', retries: 3, triggers: [{ event: 'candidate/parse-resume' }] },
  async ({ event, step }) => {
    const rawData: any = (event as any)?.data;

    // Inngest UI/manual runs can wrap the input in different ways depending on transport.
    // Try a few known shapes:
    // - event.data
    // - event.data.data
    // - event.data.payload
    // - event.data.body (stringified JSON)
    let data: any = {};
    if (rawData && typeof rawData === 'object') {
      data = rawData;
      if (rawData.data && typeof rawData.data === 'object') data = rawData.data;
      if (rawData.payload && typeof rawData.payload === 'object') data = rawData.payload;

      if (typeof rawData.body === 'string') {
        try {
          const parsed = JSON.parse(rawData.body);
          if (parsed && typeof parsed === 'object') data = parsed;
        } catch {
          // ignore
        }
      } else if (rawData.body && typeof rawData.body === 'object') {
        data = rawData.body;
      }
    }

    const trackerJobId = data.job_id;
    const candidateId = data.candidate_id;
    const resumeText = data.resumeText;

    // Validate required fields
    if (!candidateId) {
      throw new Error('candidate_id is required in event data (expected: { candidate_id, resumeText, job_id? })');
    }
    if (!resumeText || typeof resumeText !== 'string') {
      throw new Error('resumeText is required and must be a string in event data (expected: { candidate_id, resumeText, job_id? })');
    }

    try {
      if (trackerJobId) {
        await updateJobStatus(trackerJobId, 'processing');
      }

      // 1. Generate parsed JSON
      const parsedData = await step.run('parse-resume', async () => {
        const prompt = `You are an expert resume parser.

Parse the following resume and return ONLY valid JSON in this exact format:
{
  "skills": ["skill1"],
  "experience": [{"title":"","company":"","duration":"","description":""}],
  "education": [{"degree":"","institution":"","year":""}],
  "summary": "",
  "total_experience_years": 0,
  "certifications": ["cert1"]
}

RESUME TEXT:
${resumeText.slice(0, 8000)}`;

        return generateJSON<any>(prompt);
      });

      // 2. Save to DB
      await step.run('save-parsed-resume', async () => {
        const supabase = getSupabaseAdmin();
        const { error } = await supabase
          .from('candidates')
          .update({
            resume_parsed_data: parsedData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', candidateId);

        if (error) throw new Error(error.message);
      });

      if (trackerJobId) {
        await updateJobStatus(trackerJobId, 'completed', parsedData);
      }
      return { success: true, parsedData };
    } catch (err: any) {
      console.error('[Inngest] resume-parse failed:', err);
      if (trackerJobId) {
        await updateJobStatus(trackerJobId, 'failed', null, err.message);
      }
      throw err;
    }
  }
);
