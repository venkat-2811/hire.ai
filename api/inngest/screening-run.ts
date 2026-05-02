import { inngest } from '../_lib/inngest';
import { getSupabaseAdmin } from '../_lib/supabase';
import { generateJSON } from '../_lib/openai';
import { updateJobStatus } from '../_lib/jobTracker';

export const screeningRunWorker = inngest.createFunction(
  {
    id: 'screening-run',
    name: 'ATS Resume Screening',
    retries: 3,
    triggers: [{ event: 'screening/run' }],
    concurrency: {
      limit: 5,
      key: 'event.data.candidate_id',
    },
  },
  async ({ event, step }) => {
    const withTimeout = async <T,>(ms: number, fn: () => Promise<T>): Promise<T> => {
      let t: ReturnType<typeof setTimeout> | null = null;
      try {
        return await Promise.race([
          fn(),
          new Promise<T>((_, reject) => {
            t = setTimeout(() => reject(new Error(`ATS screening timed out after ${Math.round(ms / 1000)}s`)), ms);
          }),
        ]);
      } finally {
        if (t) clearTimeout(t);
      }
    };

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

    const jobId = data.job_id;
    const candidateId = data.candidate_id;
    const internalJobId = data.internal_job_id;

    // Validate required fields
    if (!candidateId) {
      throw new Error('candidate_id is required in event data (expected: { candidate_id, internal_job_id, job_id? })');
    }
    if (!internalJobId) {
      throw new Error('internal_job_id is required in event data (expected: { candidate_id, internal_job_id, job_id? })');
    }

    try {
      return await withTimeout(120000, async () => {
        if (jobId) {
          await updateJobStatus(jobId, 'processing');
        }

      const existingScreening = await step.run('check-existing', async () => {
        const supabase = getSupabaseAdmin();
        const { data } = await supabase
          .from('ats_screenings')
          .select('*')
          .eq('candidate_id', candidateId)
          .eq('job_id', internalJobId)
          .maybeSingle();
        return data ?? null;
      });

      if (existingScreening) {
        if (jobId) {
          await updateJobStatus(jobId, 'completed', existingScreening);
        }
        return { success: true, screeningData: existingScreening, cached: true };
      }

      // 1. Fetch data
      const { candidate, jobDesc } = await step.run('fetch-data', async () => {
        const supabase = getSupabaseAdmin();
        const { data: candidate } = await supabase
          .from('candidates')
          .select('id,resume_parsed_data')
          .eq('id', candidateId)
          .single();
        if (!candidate) {
          throw new Error(`Candidate ${candidateId} not found`);
        }
        if (!candidate.resume_parsed_data) {
          throw new Error(`Candidate ${candidateId} missing parsed resume data. Please ensure resume parsing completed before screening.`);
        }
        
        const { data: jobDesc } = await supabase
          .from('job_descriptions')
          .select('id,title,role,level,must_have_skills,good_to_have_skills,min_experience_years')
          .eq('id', internalJobId)
          .single();
        if (!jobDesc) {
          throw new Error(`Job ${internalJobId} not found`);
        }
        
        return { candidate, jobDesc };
      });

      // 2. Generate score
      const result = await step.run('generate-score', async () => {
        const resumeJson = JSON.stringify(candidate.resume_parsed_data).slice(0, 6000);
        const prompt = `
Analyze this candidate's resume against the job requirements and provide ATS screening scores.

Job: ${jobDesc.title} (${jobDesc.role}, ${jobDesc.level})
Required Skills: ${(jobDesc.must_have_skills || []).join(', ')}
Nice-to-have Skills: ${(jobDesc.good_to_have_skills || []).join(', ')}
Min Experience: ${jobDesc.min_experience_years} years

Candidate Resume JSON:
${resumeJson}

Return JSON:
{
  "overall_score": 0-100,
  "skill_relevance_score": 0-100,
  "experience_score": 0-100,
  "education_score": 0-100,
  "credibility_score": 0-100,
  "shortlisted": true/false,
  "shortlist_reason": "...",
  "reason_codes": [{"code":"SKILL_MATCH","type":"positive","description":"...","impact":10}]
}`;

        return generateJSON<any>(prompt, { timeoutMs: 20000, maxTokens: 1200, temperature: 0.1 });
      });

      // 3. Save to DB
      const screeningData = await step.run('save-result', async () => {
        const supabase = getSupabaseAdmin();
        const dataToSave = {
          candidate_id: candidateId,
          job_id: internalJobId,
          overall_score: result.overall_score,
          skill_relevance_score: result.skill_relevance_score ?? null,
          experience_score: result.experience_score ?? null,
          education_score: result.education_score ?? null,
          credibility_score: result.credibility_score ?? null,
          shortlisted: !!result.shortlisted,
          shortlist_reason: result.shortlist_reason ?? null,
          reason_codes: result.reason_codes ?? [],
          screened_at: new Date().toISOString(),
        };

        const { data: existing } = await supabase
          .from('ats_screenings')
          .select('id')
          .eq('candidate_id', candidateId)
          .eq('job_id', internalJobId)
          .maybeSingle();

        const saved = existing
          ? await supabase
              .from('ats_screenings')
              .update(dataToSave)
              .eq('id', existing.id)
              .select('*')
              .maybeSingle()
          : await supabase
              .from('ats_screenings')
              .insert(dataToSave)
              .select('*')
              .maybeSingle();

        if (saved.error) throw new Error(saved.error.message);
        return saved.data;
      });

        if (jobId) {
          await updateJobStatus(jobId, 'completed', screeningData);
        }
        return { success: true, screeningData };
      });
    } catch (err: any) {
      console.error('[Inngest] screening-run failed:', err);
      if (jobId) {
        await updateJobStatus(jobId, 'failed', null, err.message);
      }
      throw err;
    }
  }
);
