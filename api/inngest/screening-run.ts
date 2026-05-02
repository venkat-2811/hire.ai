import { inngest } from '../_lib/inngest';
import { getSupabaseAdmin } from '../_lib/supabase';
import { generateJSON } from '../_lib/openai';
import { updateJobStatus } from '../_lib/jobTracker';

export const screeningRunWorker = inngest.createFunction(
  { id: 'screening-run', name: 'ATS Resume Screening', retries: 3 },
  { event: 'screening/run' },
  async ({ event, step }) => {
    const { job_id: jobId, candidate_id: candidateId, internal_job_id: internalJobId } = event.data;

    try {
      await updateJobStatus(jobId, 'processing');

      // 1. Fetch data
      const { candidate, jobDesc } = await step.run('fetch-data', async () => {
        const supabase = getSupabaseAdmin();
        const { data: candidate } = await supabase.from('candidates').select('*').eq('id', candidateId).single();
        if (!candidate || !candidate.resume_parsed_data) {
          throw new Error(`Candidate ${candidateId} not found or missing parsed resume`);
        }
        
        const { data: jobDesc } = await supabase.from('job_descriptions').select('*').eq('id', internalJobId).single();
        if (!jobDesc) {
          throw new Error(`Job ${internalJobId} not found`);
        }
        
        return { candidate, jobDesc };
      });

      // 2. Generate score
      const result = await step.run('generate-score', async () => {
        const prompt = `
Analyze this candidate's resume against the job requirements and provide ATS screening scores.

Job: ${jobDesc.title} (${jobDesc.role}, ${jobDesc.level})
Required Skills: ${(jobDesc.must_have_skills || []).join(', ')}
Nice-to-have Skills: ${(jobDesc.good_to_have_skills || []).join(', ')}
Min Experience: ${jobDesc.min_experience_years} years

Candidate Resume JSON:
${JSON.stringify(candidate.resume_parsed_data)}

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

        return generateJSON<any>(prompt);
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
          ? await supabase.from('ats_screenings').update(dataToSave).eq('id', existing.id).select().maybeSingle()
          : await supabase.from('ats_screenings').insert(dataToSave).select().maybeSingle();

        if (saved.error) throw new Error(saved.error.message);
        return saved.data;
      });

      await updateJobStatus(jobId, 'completed', screeningData);
      return { success: true, screeningData };
    } catch (err: any) {
      console.error('[Inngest] screening-run failed:', err);
      await updateJobStatus(jobId, 'failed', null, err.message);
      throw err;
    }
  }
);
