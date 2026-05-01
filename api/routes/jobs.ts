/**
 * Jobs route handler.
 * POST /api/jobs/extract-skills — AI skill extraction
 * GET  /api/jobs — list jobs
 * POST /api/jobs — create job
 * GET  /api/jobs/:id — get single job
 * PATCH /api/jobs/:id — update job
 * DELETE /api/jobs/:id — archive/delete job
 * POST /api/jobs/:id/regenerate-questions — regenerate interview pool
 * Extracted verbatim from api/[...path].ts — lines 2014-2352.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../_lib/supabase';
import { ok, badRequest, notFound, methodNotAllowed, requireAuth } from '../_lib/helpers';
import { generateJSON } from '../_lib/openai';
import { checkPlanAccess, getUserProfile } from '../_lib/billing-utils';
import { generateInterviewQuestionPool } from '../_lib/interview-gen';

export default async function handleJobs(req: VercelRequest, res: VercelResponse, segments: string[]) {
  const supabase = getSupabaseAdmin();

  // POST /api/jobs/extract-skills — AI-powered skill extraction from job description
  if (req.method === 'POST' && segments.length === 2 && segments[1] === 'extract-skills') {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { description, title, role } = req.body || {};
    if (!description || typeof description !== 'string' || description.trim().length < 20) {
      return badRequest(res, 'Please provide a job description with at least 20 characters');
    }

    try {
      const prompt = `You are an expert technical recruiter. Analyze the following job description and extract two categorized skill lists.

Job Title: ${title || 'Not specified'}
Role: ${role || 'Not specified'}

Job Description:
${description.slice(0, 4000)}

Return ONLY valid JSON in this exact format:
{
  "must_have_skills": ["skill1", "skill2", ...],
  "good_to_have_skills": ["skill1", "skill2", ...]
}

Rules:
- "must_have_skills": Core technical skills explicitly required or strongly implied (5-10 skills)
- "good_to_have_skills": Nice-to-have, supplementary, or bonus skills (3-8 skills)
- Use concise, industry-standard skill names (e.g., "React", "Node.js", "AWS", "Salesforce Apex")
- Do NOT include soft skills or generic terms like "communication" or "teamwork"
- Do NOT duplicate skills between the two lists`;

      const result = await generateJSON<{ must_have_skills: string[]; good_to_have_skills: string[] }>(prompt);
      const mustHave = Array.isArray(result?.must_have_skills) ? result.must_have_skills.filter((s: any) => typeof s === 'string' && s.trim()) : [];
      const goodToHave = Array.isArray(result?.good_to_have_skills) ? result.good_to_have_skills.filter((s: any) => typeof s === 'string' && s.trim()) : [];

      return ok(res, { must_have_skills: mustHave, good_to_have_skills: goodToHave });
    } catch (e: any) {
      console.error('[jobs/extract-skills] AI extraction failed:', e?.message || e);
      return res.status(502).json({ error: 'Failed to extract skills. Please try again.' });
    }
  }

  if (segments.length === 1) {
    if (req.method === 'GET') {
      const user = await requireAuth(req, res);
      if (!user) return;

      const { role, level, is_active } = req.query;
      let q = supabase.from('job_descriptions').select('*').eq('created_by', user.id);
      if (role) q = q.ilike('role', `%${role}%`);
      if (level) q = q.eq('level', level);
      if (is_active === 'false') q = q.eq('is_active', false);
      else q = q.eq('is_active', true);
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return ok(res, data);
    }

    if (req.method === 'POST') {
      const user = await requireAuth(req, res);
      if (!user) return;

      const billingGate = await checkPlanAccess(supabase, user.id, 'create_job');
      if (!billingGate.allowed) {
        return res.status(billingGate.status || 402).json(billingGate);
      }

      const body = req.body;
      const jobData: Record<string, any> = {
        title: body.title,
        role: body.role,
        level: body.level,
        description: body.description,
        must_have_skills: body.must_have_skills || [],
        good_to_have_skills: body.good_to_have_skills || [],
        min_experience_years: body.min_experience_years || 0,
        resume_cutoff: body.resume_cutoff ?? 35,
        assessment_cutoff: body.assessment_cutoff ?? 40,
        interview_cutoff: body.interview_cutoff ?? 40,
        location: body.location || null,
        endCustomer: body.endCustomer || null,
        is_active: true,
        created_by: user.id,
      };

      // Pre-generate interview question pool for this job (15 questions)
      try {
        const pool = await generateInterviewQuestionPool({
          title: body.title,
          role: body.role,
          level: body.level,
          must_have_skills: body.must_have_skills || [],
          description: body.description || '',
        });
        if (pool && pool.length > 0) {
          jobData.interview_question_pool = pool;
        }
      } catch (poolErr: any) {
        console.error('Failed to generate interview question pool (non-blocking):', poolErr.message);
      }

      const { data, error } = await supabase
        .from('job_descriptions')
        .insert(jobData)
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });

      // Increment usage counter
      const profile = await getUserProfile(supabase, user.id);
      if (profile) {
        await supabase.from('profiles').update({
          jobs_count: (profile.jobs_count || 0) + 1,
          updated_at: new Date().toISOString(),
        }).eq('user_id', user.id);
      }

      return ok(res, data, 201);
    }

    return methodNotAllowed(res);
  }

  if (segments.length === 2) {
    const jobId = segments[1];

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('job_descriptions')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error || !data) return notFound(res, 'Job not found');
      return ok(res, data);
    }

    if (req.method === 'PATCH') {
      const user = await requireAuth(req, res);
      if (!user) return;

      const body = req.body || {};
      const allowedFields: Record<string, any> = {};
      const safeKeys = [
        'title', 'role', 'level', 'description',
        'must_have_skills', 'good_to_have_skills', 'min_experience_years',
        'is_active', 'resume_cutoff', 'assessment_cutoff', 'interview_cutoff',
        'interview_question_pool', 'location', 'endCustomer'
      ];
      for (const key of safeKeys) {
        if (key in body) allowedFields[key] = body[key];
      }
      allowedFields.updated_at = new Date().toISOString();

      const { data: existingJob } = await supabase
        .from('job_descriptions')
        .select('id')
        .eq('id', jobId)
        .eq('created_by', user.id)
        .maybeSingle();

      if (!existingJob) return notFound(res, 'Job not found or access denied');

      const { data, error } = await supabase
        .from('job_descriptions')
        .update(allowedFields)
        .eq('id', jobId)
        .eq('created_by', user.id)
        .select()
        .maybeSingle();

      if (error) return res.status(500).json({ error: error.message });
      if (!data) return notFound(res, 'Job not found or access denied');
      return ok(res, data);
    }

    if (req.method === 'DELETE') {
      const user = await requireAuth(req, res);
      if (!user) return;

      const permanent = req.query.permanent === 'true';

      if (permanent) {
        const { data: job } = await supabase
          .from('job_descriptions')
          .select('id')
          .eq('id', jobId)
          .eq('created_by', user.id)
          .single();

        if (!job) return notFound(res, 'Job not found');

        try {
          await supabase.from('assessment_sessions').delete().eq('job_id', jobId);
          await supabase.from('interview_sessions').delete().eq('job_id', jobId);
          await supabase.from('ats_screenings').delete().eq('job_id', jobId);
          await supabase.from('job_applications').delete().eq('job_id', jobId);

          const { data: jobCandidates } = await supabase
            .from('candidates')
            .select('id, job_id')
            .eq('job_id', jobId);

          if (jobCandidates && jobCandidates.length > 0) {
            for (const candidate of jobCandidates) {
              const { data: otherApps } = await supabase
                .from('job_applications')
                .select('id')
                .eq('candidate_id', candidate.id)
                .neq('job_id', jobId)
                .limit(1);

              const { data: otherAssessments } = await supabase
                .from('assessment_sessions')
                .select('id')
                .eq('candidate_id', candidate.id)
                .neq('job_id', jobId)
                .limit(1);

              const { data: otherInterviews } = await supabase
                .from('interview_sessions')
                .select('id')
                .eq('candidate_id', candidate.id)
                .neq('job_id', jobId)
                .limit(1);

              const hasOtherJobs = (otherApps && otherApps.length > 0) ||
                (otherAssessments && otherAssessments.length > 0) ||
                (otherInterviews && otherInterviews.length > 0);

              if (!hasOtherJobs) {
                await supabase.from('candidates').delete().eq('id', candidate.id);
              }
            }
          }

          const { error: delErr } = await supabase
            .from('job_descriptions')
            .delete()
            .eq('id', jobId)
            .eq('created_by', user.id);

          if (delErr) return res.status(500).json({ error: delErr.message });

          const profile = await getUserProfile(supabase, user.id);
          if (profile && (profile.jobs_count || 0) > 0) {
            await supabase.from('profiles').update({
              jobs_count: (profile.jobs_count || 0) - 1,
              updated_at: new Date().toISOString(),
            }).eq('user_id', user.id);
          }

          return ok(res, { success: true, message: 'Job and all related data permanently deleted' });
        } catch (e: any) {
          return res.status(500).json({ error: `Failed to delete job: ${e.message}` });
        }
      } else {
        const { data, error } = await supabase
          .from('job_descriptions')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', jobId)
          .eq('created_by', user.id)
          .select()
          .maybeSingle();

        if (error) return res.status(500).json({ error: error.message });
        if (!data) return notFound(res, 'Job not found or access denied');
        return ok(res, { success: true, message: 'Job archived successfully' });
      }
    }

    return methodNotAllowed(res);
  }

  // POST /api/jobs/:jobId/regenerate-questions
  if (segments.length === 3 && segments[2] === 'regenerate-questions' && req.method === 'POST') {
    const user = await requireAuth(req, res);
    if (!user) return;

    const billingGate = await checkPlanAccess(supabase, user.id, 'regenerate_interview_questions');
    if (!billingGate.allowed) {
      return res.status(billingGate.status || 402).json(billingGate);
    }

    const jobId = segments[1];
    const { data: job, error } = await supabase
      .from('job_descriptions')
      .select('*')
      .eq('id', jobId)
      .eq('created_by', user.id)
      .single();

    if (error || !job) return notFound(res, 'Job not found');

    try {
      const pool = await generateInterviewQuestionPool({
        title: job.title,
        role: job.role,
        level: job.level,
        must_have_skills: job.must_have_skills || [],
        description: job.description || '',
      });

      if (!pool.length) {
        return res.status(500).json({ error: 'Failed to generate questions. Please try again.' });
      }

      await supabase.from('job_descriptions').update({
        interview_question_pool: pool,
      }).eq('id', jobId);

      return ok(res, { success: true, questions_generated: pool.length, pool });
    } catch (e: any) {
      return res.status(500).json({ error: e.message || 'Failed to generate question pool' });
    }
  }

  return notFound(res);
}
