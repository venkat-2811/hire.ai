/**
 * Analytics route handler.
 * GET /api/analytics/dashboard
 * GET /api/analytics/candidates
 * GET /api/analytics/trends
 * Extracted verbatim from api/[...path].ts — lines 3462-3911.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../_lib/supabase';
import { ok, methodNotAllowed, requireAuth } from '../_lib/helpers';

export default async function handleAnalytics(req: VercelRequest, res: VercelResponse, segments: string[]) {
  const supabase = getSupabaseAdmin();
  const user = await requireAuth(req, res);
  if (!user) return;
  if (req.method !== 'GET') return methodNotAllowed(res);

  // GET /api/analytics/dashboard
  if (segments.length === 2 && segments[1] === 'dashboard') {
    // Scope everything to this user's jobs
    const { data: userJobs } = await supabase
      .from('job_descriptions')
      .select('id')
      .eq('created_by', user.id);
    const userJobIds = (userJobs || []).map((j: any) => j.id);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString();

    const [activeJobsRes, activeJobsLastWeekRes] = await Promise.all([
      supabase
        .from('job_descriptions')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', user.id)
        .eq('is_active', true),
      supabase
        .from('job_descriptions')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', user.id)
        .eq('is_active', true)
        .lt('created_at', weekAgoStr)
    ]);

    const activeJobs = activeJobsRes.count || 0;
    const activeJobsLastWeek = activeJobsLastWeekRes.count || 0;
    const active_jobs_change = activeJobsLastWeek === 0 ? (activeJobs > 0 ? 100 : 0) : Math.round(((activeJobs - activeJobsLastWeek) / activeJobsLastWeek) * 100);

    let totalCandidates = 0;
    let total_candidates_change = 0;
    let pendingInterviews = 0;
    let pending_interviews_change = 0;
    let averageScore = 0;
    let shortlistRate = 0;
    let completedToday = 0;
    let completed_today_change = 0;

    if (userJobIds.length > 0) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);

      // Run independent queries concurrently
      const [
        candCountRes,
        candCountLastWeekRes,
        pendCountResWrapper,
        scoresRes,
        todayCountResWrapper,
        yesterdayCountResWrapper
      ] = await Promise.all([
        supabase
          .from('job_applications')
          .select('candidate_id', { count: 'exact', head: true })
          .in('job_id', userJobIds),

        supabase
          .from('job_applications')
          .select('candidate_id', { count: 'exact', head: true })
          .in('job_id', userJobIds)
          .lt('applied_at', weekAgoStr),

        // Handle potential missing tables gracefully
        supabase
          .from('ai_interview_sessions')
          .select('id', { count: 'exact', head: true })
          .in('job_id', userJobIds)
          .eq('status', 'pending'),

        supabase
          .from('ats_screenings')
          .select('overall_score, shortlisted')
          .in('job_id', userJobIds),

        supabase
          .from('ai_interview_sessions')
          .select('id', { count: 'exact', head: true })
          .in('job_id', userJobIds)
          .eq('status', 'completed')
          .gte('completed_at', todayStart.toISOString()),

        supabase
          .from('ai_interview_sessions')
          .select('id', { count: 'exact', head: true })
          .in('job_id', userJobIds)
          .eq('status', 'completed')
          .gte('completed_at', yesterdayStart.toISOString())
          .lt('completed_at', todayStart.toISOString())
      ]);

      totalCandidates = candCountRes.count || 0;
      const candLastWeek = candCountLastWeekRes.count || 0;
      total_candidates_change = candLastWeek === 0 ? (totalCandidates > 0 ? 100 : 0) : Math.round(((totalCandidates - candLastWeek) / candLastWeek) * 100);

      pendingInterviews = pendCountResWrapper.count || 0;
      pending_interviews_change = 0; // Approximated without deep history

      completedToday = todayCountResWrapper.count || 0;
      const completedYesterday = yesterdayCountResWrapper.count || 0;
      completed_today_change = completedYesterday === 0 ? (completedToday > 0 ? 100 : 0) : Math.round(((completedToday - completedYesterday) / completedYesterday) * 100);

      const scores = scoresRes.data;
      const validScores = (scores || [])
        .map((s: any) => s.overall_score)
        .filter((s: unknown): s is number => typeof s === 'number');

      averageScore = validScores.length
        ? Math.round(validScores.reduce((a: number, b: number) => a + b, 0) / validScores.length)
        : 0;

      const shortlistedCount = (scores || []).filter((s: any) => s.shortlisted).length;
      shortlistRate = validScores.length > 0
        ? Math.round((shortlistedCount / validScores.length) * 100)
        : 0;
    }

    return ok(res, {
      total_candidates: totalCandidates,
      total_candidates_change,
      active_jobs: activeJobs || 0,
      active_jobs_change,
      pending_interviews: pendingInterviews,
      pending_interviews_change,
      completed_today: completedToday,
      completed_today_change,
      average_score: averageScore,
      shortlist_rate: shortlistRate,
    });
  }

  // GET /api/analytics/candidates
  if (segments.length === 2 && segments[1] === 'candidates') {
    const jobId = (req.query.job_id as string) || null;
    const limit = parseInt((req.query.limit as string) || '50');

    // Scope to user's jobs
    const { data: userJobs } = await supabase
      .from('job_descriptions')
      .select('id, title')
      .eq('created_by', user.id);
    const userJobIds = (userJobs || []).map((j: any) => j.id);
    const jobTitleMap: Record<string, string> = {};
    for (const j of userJobs || []) jobTitleMap[j.id] = j.title;

    if (userJobIds.length === 0) return ok(res, []);

    // Validate that requested jobId belongs to this user
    if (jobId && !userJobIds.includes(jobId)) return ok(res, []);

    // Get applications scoped to user's jobs
    let appQuery = supabase
      .from('job_applications')
      .select('candidate_id, job_id, status, final_status, applied_at, interview_mode, manual_interview_score, interview_status')
      .in('job_id', jobId ? [jobId] : userJobIds)
      .order('applied_at', { ascending: false })
      .limit(limit);

    const { data: applications } = await appQuery;
    const applicationsMap: Record<string, any> = {};
    const toMillis = (value?: string | null) => (value ? new Date(value).getTime() : 0);
    for (const app of applications || []) {
      const key = `${app.candidate_id}:${app.job_id}`;
      const existing = applicationsMap[key];
      if (!existing || toMillis(app.applied_at) > toMillis(existing.applied_at)) {
        applicationsMap[key] = app;
      }
    }

    const candidateIds = [...new Set((applications || []).map((a: any) => a.candidate_id))];
    if (candidateIds.length === 0) return ok(res, []);

    // Fetch candidates
    const { data: candidates, error } = await supabase
      .from('candidates')
      .select('id, full_name, email, created_at')
      .in('id', candidateIds);
    if (error) return res.status(500).json({ error: error.message });
    if (!candidates?.length) return ok(res, []);
    const candidateMap: Record<string, any> = {};
    for (const c of candidates) candidateMap[c.id] = c;

    const effectiveJobIds = jobId ? [jobId] : userJobIds;
    const makeKey = (candidateId: string, jobIdValue: string) => `${candidateId}:${jobIdValue}`;

    // Fetch ATS screenings
    const screeningsMap: Record<string, any> = {};
    const { data: screenings } = await supabase
      .from('ats_screenings')
      .select('candidate_id, overall_score, job_id, shortlisted, created_at')
      .in('candidate_id', candidateIds)
      .in('job_id', effectiveJobIds);
    for (const s of screenings || []) {
      if (!s?.candidate_id || !s?.job_id) continue;
      const key = makeKey(s.candidate_id, s.job_id);
      const existing = screeningsMap[key];
      if (!existing || toMillis(s.created_at) > toMillis(existing.created_at)) {
        screeningsMap[key] = s;
      }
    }

    // Fetch assessment sessions
    const assessmentsMap: Record<string, any> = {};
    try {
      const { data: assessments } = await supabase
        .from('assessment_sessions')
        .select('candidate_id, total_score, status, job_id, completed_at, updated_at, created_at')
        .in('candidate_id', candidateIds)
        .in('job_id', effectiveJobIds);
      for (const a of assessments || []) {
        if (!a?.candidate_id || !a?.job_id) continue;
        const key = makeKey(a.candidate_id, a.job_id);
        const existing = assessmentsMap[key];
        const aTs = toMillis(a.completed_at) || toMillis(a.updated_at) || toMillis(a.created_at);
        const eTs = existing
          ? (toMillis(existing.completed_at) || toMillis(existing.updated_at) || toMillis(existing.created_at))
          : 0;
        if (!existing || aTs >= eTs) {
          assessmentsMap[key] = a;
        }
      }
    } catch { /* table may not exist */ }

    // Fetch AI interview sessions
    const interviewsMap: Record<string, any> = {};
    try {
      const { data: interviews } = await supabase
        .from('ai_interview_sessions')
        .select('candidate_id, status, job_id, completed_at, updated_at, created_at, final_evaluation')
        .in('candidate_id', candidateIds)
        .in('job_id', effectiveJobIds);
      for (const i of interviews || []) {
        if (!i?.candidate_id || !i?.job_id) continue;
        const key = makeKey(i.candidate_id, i.job_id);
        const existing = interviewsMap[key];
        const iTs = toMillis(i.completed_at) || toMillis(i.updated_at) || toMillis(i.created_at);
        const eTs = existing
          ? (toMillis(existing.completed_at) || toMillis(existing.updated_at) || toMillis(existing.created_at))
          : 0;
        if (!existing || iTs >= eTs) {
          interviewsMap[key] = i;
        }
      }
    } catch { /* table may not exist */ }

    const analytics = Object.values(applicationsMap).map((application: any) => {
      const row = candidateMap[application.candidate_id];
      if (!row) return null;

      const key = makeKey(application.candidate_id, application.job_id);
      const screening = screeningsMap[key];
      const assessment = assessmentsMap[key];
      const interview = interviewsMap[key];
      const finalEval = interview?.final_evaluation || {};
      const appliedJobId = application?.job_id || jobId || null;
      const assessmentTerminated = assessment?.status === 'terminated';
      const interviewTerminated = interview?.status === 'terminated';
      const interviewMode = application?.interview_mode || 'ai';
      const manualInterviewScore = application?.manual_interview_score;
      const applicationInterviewStatus = application?.interview_status;

      // Use manual interview score if mode is 'manual', otherwise use AI interview score
      let interviewScore: number | null = null;
      let technicalScore: number | null = null;
      let overallScore: number | null = null;
      let recommendation: string | null = null;
      let interviewStatus: string | null = null;

      if (interviewMode === 'manual' && manualInterviewScore != null) {
        interviewScore = manualInterviewScore;
        technicalScore = manualInterviewScore; // Use same score for consistency
        overallScore = manualInterviewScore;
        // For manual interviews, derive recommendation from score
        if (manualInterviewScore >= 80) recommendation = 'strong_hire';
        else if (manualInterviewScore >= 60) recommendation = 'hire';
        else if (manualInterviewScore >= 40) recommendation = 'borderline';
        else recommendation = 'no_hire';
        // Use application interview_status for manual interviews
        interviewStatus = applicationInterviewStatus || 'completed';
      } else {
        // Use AI interview evaluation
        interviewScore = interviewTerminated ? 0 : (finalEval.overall_score ?? null);
        technicalScore = interviewTerminated ? 0 : (finalEval.technical_score ?? null);
        overallScore = interviewTerminated ? 0 : (finalEval.overall_score ?? null);
        recommendation = interviewTerminated ? 'no_hire' : (finalEval.recommendation ?? null);
        // Use AI interview session status for AI interviews
        interviewStatus = interview?.status ?? null;
      }

      return {
        candidate_id: row.id,
        candidate_name: row.full_name,
        candidate_email: row.email,
        job_title: appliedJobId ? (jobTitleMap[appliedJobId] || 'N/A') : 'N/A',
        job_id: appliedJobId,
        application_status: application?.status || 'applied',
        final_status: application?.final_status ?? null,
        ats_score: screening?.overall_score ?? null,
        shortlisted: screening?.shortlisted ?? null,
        assessment_score: assessmentTerminated ? 0 : (assessment?.total_score ?? null),
        assessment_status: assessment?.status ?? null,
        interview_status: interviewStatus,
        interview_mode: interviewMode,
        interview_score: interviewScore,
        technical_score: technicalScore,
        overall_score: overallScore,
        recommendation: recommendation,
      };
    }).filter(Boolean);

    return ok(res, analytics);
  }

  // GET /api/analytics/trends
  if (segments.length === 2 && segments[1] === 'trends') {
    const days = parseInt((req.query.days as string) || '30', 10);
    const safeDays = Number.isFinite(days) ? Math.min(365, Math.max(1, days)) : 30;
    const period_days = safeDays;

    const toDayKey = (value: string | Date) => {
      const d = typeof value === 'string' ? new Date(value) : value;
      return d.toISOString().split('T')[0];
    };

    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(start.getDate() - (safeDays - 1));
    start.setHours(0, 0, 0, 0);
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    const { data: userJobs, error: jobsErr } = await supabase
      .from('job_descriptions')
      .select('id')
      .eq('created_by', user.id);
    if (jobsErr) return res.status(500).json({ error: jobsErr.message });
    const userJobIds = (userJobs || []).map((j: any) => j.id);

    const dayMap: Record<string, {
      date: string;
      screenings: number;
      shortlisted: number;
      interviews_started: number;
      interviews_completed: number;
      score_sum: number;
      score_count: number;
    }> = {};

    for (let i = 0; i < safeDays; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const k = toDayKey(d);
      dayMap[k] = {
        date: k,
        screenings: 0,
        shortlisted: 0,
        interviews_started: 0,
        interviews_completed: 0,
        score_sum: 0,
        score_count: 0,
      };
    }

    if (userJobIds.length === 0) {
      const trends = Object.values(dayMap).map((d) => ({
        date: d.date,
        screenings: 0,
        shortlisted: 0,
        interviews_started: 0,
        interviews_completed: 0,
        average_score: 0,
      }));
      return ok(res, { trends, period_days });
    }

    // ATS screenings (for screenings volume + average_score + shortlist count)
    const { data: screenings, error: screeningsErr } = await supabase
      .from('ats_screenings')
      .select('job_id, created_at, shortlisted, overall_score')
      .in('job_id', userJobIds)
      .gte('created_at', startIso)
      .lte('created_at', endIso);
    if (screeningsErr) return res.status(500).json({ error: screeningsErr.message });

    for (const s of screenings || []) {
      if (!s?.created_at) continue;
      const k = toDayKey(s.created_at);
      const bucket = dayMap[k];
      if (!bucket) continue;
      bucket.screenings += 1;
      if (s.shortlisted === true) bucket.shortlisted += 1;
      if (typeof s.overall_score === 'number') {
        bucket.score_sum += s.overall_score;
        bucket.score_count += 1;
      }
    }

    // AI interview sessions (started + completed)
    try {
      const { data: interviews, error: interviewsErr } = await supabase
        .from('ai_interview_sessions')
        .select('job_id, status, created_at, completed_at, updated_at')
        .in('job_id', userJobIds)
        .gte('created_at', startIso)
        .lte('created_at', endIso);
      if (interviewsErr) return res.status(500).json({ error: interviewsErr.message });

      for (const i of interviews || []) {
        if (i?.created_at) {
          const k = toDayKey(i.created_at);
          const bucket = dayMap[k];
          if (bucket) bucket.interviews_started += 1;
        }

        if (String(i?.status || '').toLowerCase() === 'completed') {
          const completedAt = i?.completed_at || i?.updated_at || null;
          if (completedAt) {
            const k = toDayKey(completedAt);
            const bucket = dayMap[k];
            if (bucket) bucket.interviews_completed += 1;
          }
        }
      }
    } catch { /* table may not exist */ }

    const trends = Object.values(dayMap).map((d) => ({
      date: d.date,
      screenings: d.screenings,
      shortlisted: d.shortlisted,
      interviews_started: d.interviews_started,
      interviews_completed: d.interviews_completed,
      average_score: d.score_count > 0 ? Math.round((d.score_sum / d.score_count) * 10) / 10 : 0,
    }));

    return ok(res, { trends, period_days });
  }

  return notFound(res);
}
