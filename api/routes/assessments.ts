/**
 * Assessments route handler.
 * GET  /api/assessments/start/:token
 * GET  /api/assessments/:sessionId/mcq
 * GET  /api/assessments/:sessionId/coding
 * POST /api/assessments/:sessionId/mcq/submit
 * POST /api/assessments/:sessionId/coding/run
 * POST /api/assessments/:sessionId/coding/submit
 * POST /api/assessments/:sessionId/proctoring
 * POST /api/assessments/:sessionId/complete
 * POST /api/assessments/invite
 * Extracted verbatim from api/[...path].ts — lines 3913-4822.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { sendAssessmentInvite } from '../_lib/email';
import { getSupabaseAdmin } from '../_lib/supabase';
import { requireAuth, ok, badRequest, notFound, methodNotAllowed, normalizeBaseUrl, resolveFrontendBaseUrl, checkRateLimit } from '../_lib/helpers';
import { checkPlanAccess } from '../_lib/billing-utils';
import { generateAssessmentMcqsForJob } from '../_lib/mcq';
import { isSalesforceRole, generateSalesforceApexChallenges } from '../_lib/salesforce';
import { evaluateApexFillInTheBlanks, generateApexFillInTheBlanks } from '../_lib/apex-blanks';
import { mapLanguageKey, executeTestCasesViaHackerEarth } from '../_lib/hackerearth';
import { evaluateApexWithLLM } from '../_lib/apex-evaluator';

export default async function handleAssessments(req: VercelRequest, res: VercelResponse, segments: string[]) {
  const supabase = getSupabaseAdmin();

  // GET /api/assessments/start/:token (public)
  // KEY PERF FIX: This endpoint now generates + returns BOTH MCQ questions and coding
  // challenges in a single response, replacing 3 serial client round-trips with 1.
  if (req.method === 'GET' && segments.length === 3 && segments[1] === 'start') {
    try {
      const token = segments[2];
      const { data: session, error } = await supabase
        .from('assessment_sessions')
        .select('*, candidates(full_name, email), job_descriptions(title, role, level, description, must_have_skills, good_to_have_skills)')
        .eq('token', token)
        .single();

      if (error || !session) return notFound(res, 'Assessment not found or link expired');
      if (['completed', 'terminated'].includes(session.status)) return badRequest(res, 'Assessment already completed or terminated');

      if (!session.deadline) {
        return res.status(500).json({ error: 'Assessment session misconfigured (missing deadline)' });
      }

      const deadline = new Date(session.deadline);
      if (Number.isNaN(deadline.getTime())) {
        return res.status(500).json({ error: 'Assessment session misconfigured (invalid deadline)' });
      }

      if (new Date() > deadline) {
        await supabase.from('assessment_sessions').update({ 
          status: 'expired',
          mcq_score: 0,
          coding_score: 0,
          total_score: 0,
          completed_at: new Date().toISOString()
        }).eq('id', session.id);
        return badRequest(res, 'Assessment deadline has passed');
      }

      if (session.status === 'pending') {
        await supabase.from('assessment_sessions').update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
        }).eq('id', session.id);
      }

      const assessmentConfig = session.proctoring_data?.assessment_config || {};
      const assessmentMode = (assessmentConfig.assessment_mode === 'apex' || assessmentConfig.assessment_mode === 'dsa')
        ? assessmentConfig.assessment_mode
        : (Boolean((session as any)?.is_apex_mode ?? assessmentConfig.is_apex_mode) ? 'apex' : 'dsa');
      const mcqCount = session.mcq_question_count ?? 20;
      const codingCount = session.coding_challenge_count ?? 2;
      const difficulty = assessmentConfig.difficulty || session.difficulty || 'medium';
      const includeMcq = assessmentMode === 'apex'
        ? (mcqCount > 0)
        : (assessmentConfig.include_mcq !== false && mcqCount > 0);
      const includeCoding = assessmentMode === 'apex'
        ? false
        : (assessmentConfig.include_coding !== false && codingCount > 0);
      const salesforceRole = isSalesforceRole({
        role: session.job_descriptions?.role,
        title: session.job_descriptions?.title,
        description: session.job_descriptions?.description,
        must_have_skills: session.job_descriptions?.must_have_skills || [],
        good_to_have_skills: session.job_descriptions?.good_to_have_skills || [],
      });
      // Back-compat: some DBs may not have an is_apex_mode column.
      // Derive Apex mode from assessment_mode when available.
      const isApexMode = assessmentMode === 'apex' || Boolean((session as any)?.is_apex_mode ?? assessmentConfig.is_apex_mode);

      const getApexBlanks = async (): Promise<any[]> => {
        if (assessmentMode !== 'apex') return [];
        const content = session.proctoring_data?.assessment_content || {};
        const stored: any[] = content.apex_blanks || [];
        if (stored.length > 0) return stored;

        throw new Error('Apex questions are not available for this session. Please ask the recruiter to resend the assessment.');
      };

      // Retrieve pre-generated MCQ questions only
      const getMcqQuestions = async (): Promise<any[]> => {
        if (!includeMcq) {
          console.log('[getMcqQuestions] MCQ disabled or count=0');
          return [];
        }
        const storedMcq: any[] = session.mcq_questions || [];
        if (storedMcq.length > 0) {
          if (storedMcq.length !== mcqCount) {
            throw new Error(`MCQ question count mismatch for this session. Expected ${mcqCount}, found ${storedMcq.length}.`);
          }
          console.log('[getMcqQuestions] Returning cached MCQs:', storedMcq.length);
          return storedMcq;
        }
        throw new Error('MCQ questions are not available for this session. Please ask the recruiter to resend the assessment.');
      };

      // Fetch coding challenges from DSA bank (or Salesforce-Apex generator when Apex mode is enabled)
      const getCodingChallenges = async (): Promise<any[]> => {
        if (!includeCoding) return [];
        const storedCoding: any[] = session.coding_challenges || [];
        if (storedCoding.length > 0) {
          // If Apex mode is enabled but cached challenges are not Apex-only, regenerate.
          if (isApexMode) {
            const looksApex = storedCoding.every((c: any) =>
              Array.isArray(c?.supported_languages) && c.supported_languages.length === 1 && c.supported_languages[0] === 'apex'
            );
            if (looksApex) return storedCoding;
          } else {
            return storedCoding;
          }
        }

        throw new Error('Coding challenges are not available for this session. Please ask the recruiter to resend the assessment.');
      };

      // Run in parallel — halves the wait time
      const [mcqQuestions, codingChallenges, apexBlanks] = await Promise.all([
        getMcqQuestions(),
        getCodingChallenges(),
        getApexBlanks(),
      ]);

      const safeMcq = mcqQuestions.map((q: any) => ({
        id: q.id, question: q.question, options: q.options,
        difficulty: q.difficulty, topic: q.topic, points: q.points,
      }));

      return ok(res, {
        session_id: session.id,
        candidate_name: session.candidates?.full_name,
        job_title: session.job_descriptions?.title,
        job_role: session.job_descriptions?.role,
        assessment_mode: assessmentMode,
        is_apex_mode: isApexMode,
        coding_environment_label: isApexMode ? 'Apex Coding Environment (AI-Evaluated - Phase 1)' : null,
        mcq_count: safeMcq.length,
        coding_count: codingChallenges.length,
        total_time_minutes: session.total_time_minutes ?? 90,
        deadline: session.deadline,
        mcq_questions: safeMcq,
        coding_challenges: codingChallenges,
        apex_blanks: apexBlanks,
      });
    } catch (e: any) {
      console.error('[assessments/start] failed', e?.message || e);
      return res.status(500).json({ error: 'Failed to start assessment' });
    }
  }

  // GET /api/assessments/:sessionId/apex-blanks
  if (req.method === 'GET' && segments.length === 3 && segments[2] === 'apex-blanks') {
    const sessionId = segments[1];
    const { data: session, error } = await supabase
      .from('assessment_sessions')
      .select('id, status, proctoring_data, coding_challenge_count, difficulty, job_id, job_descriptions(title, role, level, description, must_have_skills, good_to_have_skills)')
      .eq('id', sessionId)
      .single();
    if (error || !session) return notFound(res, 'Session not found');
    if (session.status !== 'in_progress') return badRequest(res, 'Assessment not in progress');

    const assessmentConfig = session.proctoring_data?.assessment_config || {};
    const assessmentMode = assessmentConfig.assessment_mode === 'apex' ? 'apex' : 'dsa';
    if (assessmentMode !== 'apex') return badRequest(res, 'Apex blanks not enabled for this assessment');

    const content = session.proctoring_data?.assessment_content || {};
    const stored: any[] = content.apex_blanks || [];
    if (stored.length) return ok(res, stored);

    return badRequest(res, 'Apex blanks are not available for this session. Please ask the recruiter to resend the assessment.');
  }

  // POST /api/assessments/:sessionId/apex-blanks/submit
  if (req.method === 'POST' && segments.length === 4 && segments[2] === 'apex-blanks' && segments[3] === 'submit') {
    const sessionId = segments[1];
    const submissions = req.body || {};

    const { data: session, error } = await supabase
      .from('assessment_sessions')
      .select('id, status, proctoring_data, coding_score')
      .eq('id', sessionId)
      .single();
    if (error || !session) return notFound(res, 'Session not found');
    if (session.status !== 'in_progress') return badRequest(res, 'Assessment not in progress');

    const assessmentConfig = session.proctoring_data?.assessment_config || {};
    const assessmentMode = assessmentConfig.assessment_mode === 'apex' ? 'apex' : 'dsa';
    if (assessmentMode !== 'apex') return badRequest(res, 'Apex blanks not enabled for this assessment');

    const content = session.proctoring_data?.assessment_content || {};
    const questions: any[] = content.apex_blanks || [];
    if (!Array.isArray(questions) || questions.length === 0) {
      return badRequest(res, 'Apex blanks questions are not available for this session.');
    }

    const evaluation = await evaluateApexFillInTheBlanks({
      questions,
      submissions,
    });

    const proctoring = session.proctoring_data || {};
    await supabase.from('assessment_sessions').update({
      proctoring_data: {
        ...proctoring,
        submissions: {
          ...(proctoring.submissions || {}),
          apex_blanks: submissions,
        },
        results: {
          ...(proctoring.results || {}),
          apex_blanks: evaluation.results,
        },
      },
      coding_score: evaluation.max_score > 0 ? (evaluation.total_score / evaluation.max_score) * 100 : 0,
      updated_at: new Date().toISOString(),
    }).eq('id', sessionId);

    return ok(res, evaluation);
  }

  // Everything else requires auth (manager)
  if (!(req.method === 'GET' && segments.length === 3 && segments[1] === 'start')) {
    // candidate assessment endpoints are public but session_id based; keeping them public for now
  }

  // GET /api/assessments/:sessionId/mcq
  if (req.method === 'GET' && segments.length === 3 && segments[2] === 'mcq') {
    const sessionId = segments[1];
    const { data: session, error } = await supabase
      .from('assessment_sessions')
      .select('id, status, job_id, mcq_questions, mcq_question_count, proctoring_data')
      .eq('id', sessionId)
      .single();

    if (error || !session) return notFound(res, 'Session not found');
    if (session.status !== 'in_progress') return badRequest(res, 'Assessment not in progress');

    const assessmentConfig = session.proctoring_data?.assessment_config || {};
    if (assessmentConfig.include_mcq === false || (session.mcq_question_count || 0) === 0) {
      return ok(res, []);
    }

    const stored = session.mcq_questions || [];
    if (stored.length) {
      const expectedCount = session.mcq_question_count || 20;
      if (stored.length !== expectedCount) {
        return badRequest(res, `MCQ question count mismatch for this session. Expected ${expectedCount}, found ${stored.length}.`);
      }
      return ok(res, stored.map((q: any) => ({
        id: q.id,
        question: q.question,
        options: q.options || [],
        difficulty: q.difficulty,
        topic: q.topic,
        points: q.points ?? 5,
      })));
    }

    return badRequest(res, 'MCQ questions are not available for this session. Please ask the recruiter to resend the assessment.');
  }

  // GET /api/assessments/:sessionId/coding
  // Serves DSA problems from the problem bank, except Salesforce/Apex roles
  if (req.method === 'GET' && segments.length === 3 && segments[2] === 'coding') {
    const sessionId = segments[1];
    const { data: session, error } = await supabase
      .from('assessment_sessions')
      .select('id, status, coding_challenges, coding_challenge_count, coding_problem_ids, proctoring_data, job_id')
      .eq('id', sessionId)
      .single();

    if (error || !session) return notFound(res, 'Session not found');
    if (session.status !== 'in_progress') return badRequest(res, 'Assessment not in progress');

    const assessmentConfig = session.proctoring_data?.assessment_config || {};
    if (assessmentConfig.include_coding === false || (session.coding_challenge_count || 0) === 0) {
      return ok(res, []);
    }

    // Return cached challenges if already assigned
    const storedChallenges = session.coding_challenges || [];
    if (storedChallenges.length) {
      const isApexMode = Boolean((session as any)?.is_apex_mode ?? assessmentConfig.is_apex_mode);
      if (!isApexMode) return ok(res, storedChallenges);

      const looksApex = storedChallenges.every((c: any) =>
        Array.isArray(c?.supported_languages) && c.supported_languages.length === 1 && c.supported_languages[0] === 'apex'
      );
      if (looksApex) return ok(res, storedChallenges);
      // If Apex mode is enabled but cached challenges are DSA, fall through and regenerate Apex.
    }

    const isApexMode = Boolean((session as any)?.is_apex_mode ?? assessmentConfig.is_apex_mode);

    const { data: jobMeta } = await supabase
      .from('job_descriptions')
      .select('title, role, level, description, must_have_skills, good_to_have_skills')
      .eq('id', session.job_id)
      .single();

    if (jobMeta && (isApexMode || isSalesforceRole(jobMeta))) {
      const apexChallenges = await generateSalesforceApexChallenges({
        job: jobMeta,
        codingCount: session.coding_challenge_count || 2,
        difficulty: assessmentConfig.difficulty || 'medium',
      });
      await supabase.from('assessment_sessions').update({
        coding_challenges: apexChallenges,
        updated_at: new Date().toISOString(),
      }).eq('id', sessionId);
      return ok(res, apexChallenges);
    }

    // Select problems from DSA bank based on difficulty
    const count = session.coding_challenge_count || 2;
    const difficulty = assessmentConfig.difficulty || 'medium';

    // Difficulty mapping: easy → 1 easy + 1 easy, medium → 1 easy + 1 medium, hard → 1 medium + 1 hard
    let difficultyDistribution: string[];
    if (difficulty === 'easy') {
      difficultyDistribution = Array(count).fill('easy');
    } else if (difficulty === 'hard') {
      difficultyDistribution = count >= 2
        ? ['medium', ...Array(count - 1).fill('hard')]
        : ['hard'];
    } else {
      // medium (default)
      difficultyDistribution = count >= 2
        ? ['easy', ...Array(count - 1).fill('medium')]
        : ['medium'];
    }

    // Fetch candidate problems per difficulty level
    const selectedProblems: any[] = [];
    for (const diff of difficultyDistribution) {
      const { data: problems } = await supabase
        .from('dsa_problems')
        .select('*')
        .eq('difficulty', diff)
        .eq('is_active', true)
        .limit(20);

      if (problems && problems.length > 0) {
        // Exclude already selected problems
        const available = problems.filter((p: any) => !selectedProblems.some(s => s.id === p.id));
        if (available.length > 0) {
          const pick = available[Math.floor(Math.random() * available.length)];
          selectedProblems.push(pick);
        }
      }
    }

    if (!selectedProblems.length) {
      return res.status(500).json({ error: 'No DSA problems available in the problem bank. Please contact the administrator.' });
    }

    // Build candidate-facing challenge objects (hide private/edge test cases, hide solution wrappers)
    const challenges = selectedProblems.map((p: any) => {
      const publicTests = (p.test_cases || []).filter((tc: any) => tc.visibility === 'public');
      return {
        id: p.id,
        slug: p.slug,
        title: p.title,
        description: p.description,
        constraints: p.constraints || '',
        examples: p.examples || [],
        starter_code: p.starter_code || {},
        test_cases: publicTests.map((tc: any) => ({ id: tc.id, input: tc.input, expected_output: tc.expected_output })),
        points: p.points,
        time_limit_seconds: p.time_limit_seconds,
        supported_languages: Object.keys(p.starter_code || {}),
      };
    });

    // Store problem IDs and candidate-facing challenges in session
    await supabase.from('assessment_sessions').update({
      coding_problem_ids: selectedProblems.map((p: any) => p.id),
      coding_challenges: challenges,
      updated_at: new Date().toISOString(),
    }).eq('id', sessionId);

    return ok(res, challenges);
  }

  // POST /api/assessments/:sessionId/mcq/submit
  if (req.method === 'POST' && segments.length === 4 && segments[2] === 'mcq' && segments[3] === 'submit') {
    const sessionId = segments[1];
    const submissions = req.body as any[];

    const { data: session } = await supabase.from('assessment_sessions').select('*').eq('id', sessionId).single();
    if (!session || session.status !== 'in_progress') return badRequest(res, 'Invalid session');

    const stored: any[] = session.mcq_questions || [];
    if (!stored.length) return badRequest(res, 'Questions not found for this session');

    const questionMap = new Map<string, any>(stored.map((q: any) => [q.id, q] as const));

    // Difficulty weights: easy=1, medium=2, hard=3
    const difficultyWeight: Record<string, number> = { easy: 1, medium: 2, hard: 3 };

    let totalWeightedPoints = 0;
    let scoredWeightedPoints = 0;
    let correctCount = 0;
    let totalCount = 0;

    // Build detailed results for storage
    const detailedResults: any[] = [];

    for (const s of submissions) {
      const q = questionMap.get(s.question_id);
      if (!q) continue;

      totalCount++;
      const basePoints = q.points ?? 5;
      const weight = difficultyWeight[q.difficulty] || 2;
      const weightedPoints = basePoints * weight;
      totalWeightedPoints += weightedPoints;

      const isCorrect = s.selected_index === q.correct_index;
      if (isCorrect) {
        scoredWeightedPoints += weightedPoints;
        correctCount++;
      }

      detailedResults.push({
        question_id: q.id,
        question: q.question,
        options: q.options,
        selected_index: s.selected_index,
        correct_index: q.correct_index,
        explanation: q.explanation || '',
        is_correct: isCorrect,
        difficulty: q.difficulty,
        topic: q.topic,
        points_possible: weightedPoints,
        points_earned: isCorrect ? weightedPoints : 0,
      });
    }

    const percentage = totalWeightedPoints > 0 ? (scoredWeightedPoints / totalWeightedPoints) * 100 : 0;

    await supabase.from('assessment_sessions').update({
      mcq_submissions: detailedResults,
      mcq_score: percentage,
    }).eq('id', sessionId);

    return ok(res, {
      success: true,
      score: percentage,
      correct_count: correctCount,
      total_count: totalCount,
      weighted_points_earned: scoredWeightedPoints,
      weighted_points_possible: totalWeightedPoints,
      results: detailedResults,
    });
  }

  // POST /api/assessments/:sessionId/coding/run (run against public test cases only - LeetCode style)
  if (req.method === 'POST' && segments.length === 4 && segments[2] === 'coding' && segments[3] === 'run') {
    const sessionId = segments[1];
    const { challenge_id, code, language = 'python3' } = req.body;

    if (!checkRateLimit(`run:${sessionId}`, 10)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Maximum 10 runs per minute.' });
    }

    const { data: session } = await supabase.from('assessment_sessions').select('*').eq('id', sessionId).single();
    if (!session || session.status !== 'in_progress') return badRequest(res, 'Invalid session');

    // Apex Mode (Phase 1): LLM-only approximate evaluation (no real execution).
    const assessmentConfig = session.proctoring_data?.assessment_config || {};
    const isApexMode = Boolean((session as any)?.is_apex_mode ?? assessmentConfig.is_apex_mode);
    if (isApexMode || language === 'apex') {
      const apexChallenge = (session.coding_challenges || []).find((c: any) => c.id === challenge_id);
      if (!apexChallenge) return badRequest(res, 'Challenge not found');

      const evalResult = await evaluateApexWithLLM({
        problemStatement: String(apexChallenge.description || ''),
        candidateCode: String(code || ''),
        testCases: Array.isArray(apexChallenge.test_cases) ? apexChallenge.test_cases : [],
      });

      return ok(res, {
        success: true,
        evaluation_mode: 'apex_llm_phase1',
        disclaimer: 'AI-Evaluated (Phase 1 - Approximate Validation, Not Real Execution)',
        ai_evaluation: evalResult,
        results: [],
        passed: 0,
        total: (apexChallenge.test_cases || []).length || 0,
        score_percentage: evalResult.score,
      });
    }

    // Fetch the full problem from DSA bank (with all test cases + solution wrappers)
    const { data: problem } = await supabase.from('dsa_problems').select('*').eq('id', challenge_id).single();
    if (!problem) return badRequest(res, 'Problem not found');

    const allTestCases: any[] = problem.test_cases || [];
    // Run mode: only execute against public test cases
    const publicTests = allTestCases.filter((tc: any) => tc.visibility === 'public');
    if (!publicTests.length) {
      return ok(res, { success: false, error: 'No public test cases available', results: [], passed: 0, total: 0, score_percentage: 0 });
    }

    const langKey = mapLanguageKey(language);
    const wrapperTemplate = (problem.solution_wrappers || {})[langKey];
    if (!wrapperTemplate) {
      return badRequest(res, `Language '${language}' is not supported for this problem. Supported: ${Object.keys(problem.starter_code || {}).join(', ')}`);
    }

    const results = await executeTestCasesViaHackerEarth(code, wrapperTemplate, langKey, publicTests, problem.time_limit_seconds, problem.memory_limit_kb);

    const passedCount = results.filter((r: any) => r.passed).length;
    const compilationError = results.find((r: any) => r.status === 'CE')?.error || null;

    return ok(res, {
      success: !compilationError,
      compilation_error: compilationError,
      results: results.map((r: any) => ({
        test_case_id: r.test_case_id,
        input: r.input,
        expected_output: r.expected_output,
        actual_output: r.actual_output,
        passed: r.passed,
        status: r.status,
        time_used: r.time_used,
        memory_used: r.memory_used,
        error: r.error,
        stdout: r.stdout,
        stderr: r.stderr,
      })),
      passed: passedCount,
      total: publicTests.length,
      score_percentage: publicTests.length > 0 ? (passedCount / publicTests.length) * 100 : 0,
    });
  }

  // POST /api/assessments/:sessionId/coding/submit (run against ALL test cases and store results)
  if (req.method === 'POST' && segments.length === 4 && segments[2] === 'coding' && segments[3] === 'submit') {
    const sessionId = segments[1];
    const { challenge_id, code, language = 'python3' } = req.body;

    if (!checkRateLimit(`submit:${sessionId}`, 5)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Maximum 5 submissions per minute.' });
    }

    const { data: session } = await supabase.from('assessment_sessions').select('*').eq('id', sessionId).single();
    if (!session || session.status !== 'in_progress') return badRequest(res, 'Invalid session');

    // Apex Mode (Phase 1): LLM-only approximate evaluation (no real execution).
    const assessmentConfig = session.proctoring_data?.assessment_config || {};
    const isApexMode = Boolean((session as any)?.is_apex_mode ?? assessmentConfig.is_apex_mode);
    if (isApexMode || language === 'apex') {
      const apexChallenge = (session.coding_challenges || []).find((c: any) => c.id === challenge_id);
      if (!apexChallenge) return badRequest(res, 'Challenge not found');

      const maxPoints = Number(apexChallenge?.points || 100);
      const evalResult = await evaluateApexWithLLM({
        problemStatement: String(apexChallenge.description || ''),
        candidateCode: String(code || ''),
        testCases: Array.isArray(apexChallenge.test_cases) ? apexChallenge.test_cases : [],
      });

      const pointsEarned = Math.round((evalResult.score / 100) * maxPoints);
      const apexSubmission = {
        challenge_id,
        problem_slug: apexChallenge?.slug || 'apex-challenge',
        code,
        language: 'apex',
        execution_mode: 'apex_llm_phase1',
        ai_evaluation: evalResult,
        test_results: [],
        passed_count: 0,
        total_tests: (apexChallenge.test_cases || []).length || 0,
        score_percentage: evalResult.score,
        points_earned: pointsEarned,
        max_points: maxPoints,
        submitted_at: new Date().toISOString(),
        disclaimer: 'AI-Evaluated (Phase 1 - Approximate Validation, Not Real Execution)',
      };

      const existing = session.coding_submissions || [];
      const existingIdx = existing.findIndex((s: any) => s.challenge_id === challenge_id);
      if (existingIdx >= 0) {
        existing[existingIdx] = apexSubmission;
      } else {
        existing.push(apexSubmission);
      }

      // Calculate coding score across all challenges using points earned
      let totalCodingPoints = 0;
      let earnedCodingPoints = 0;
      for (const sub of existing) {
        totalCodingPoints += sub.max_points || 100;
        earnedCodingPoints += sub.points_earned || 0;
      }
      const codingScore = totalCodingPoints > 0 ? (earnedCodingPoints / totalCodingPoints) * 100 : 0;

      await supabase.from('assessment_sessions').update({
        coding_submissions: existing,
        coding_score: codingScore,
      }).eq('id', sessionId);

      return ok(res, {
        success: true,
        evaluation_mode: 'apex_llm_phase1',
        disclaimer: 'AI-Evaluated (Phase 1 - Approximate Validation, Not Real Execution)',
        challenge_id,
        ai_evaluation: evalResult,
        passed_count: 0,
        total_tests: (apexChallenge.test_cases || []).length || 0,
        score_percentage: evalResult.score,
        points_earned: pointsEarned,
        test_results: [],
        hidden_tests_passed: 0,
        hidden_tests_total: 0,
      });
    }

    // Fetch the full problem from DSA bank
    const { data: problem } = await supabase.from('dsa_problems').select('*').eq('id', challenge_id).single();
    if (!problem) return badRequest(res, 'Problem not found');

    const allTestCases: any[] = problem.test_cases || [];
    const langKey = mapLanguageKey(language);
    const wrapperTemplate = (problem.solution_wrappers || {})[langKey];
    if (!wrapperTemplate) {
      return badRequest(res, `Language '${language}' is not supported for this problem.`);
    }

    // Submit mode: execute against ALL test cases (public + private + edge)
    const results = await executeTestCasesViaHackerEarth(code, wrapperTemplate, langKey, allTestCases, problem.time_limit_seconds, problem.memory_limit_kb);

    const passedCount = results.filter((r: any) => r.passed).length;
    const totalTests = allTestCases.length || 1;
    const scorePercentage = (passedCount / totalTests) * 100;
    const pointsEarned = Math.round((passedCount / totalTests) * (problem.points || 100));

    // Separate results by visibility for reporting
    const publicResults = results.filter((r: any) => r.visibility === 'public');
    const privateResults = results.filter((r: any) => r.visibility === 'private');
    const edgeResults = results.filter((r: any) => r.visibility === 'edge');

    // Calculate time/memory performance stats
    const executionTimes = results.filter((r: any) => r.time_used).map((r: any) => parseFloat(r.time_used));
    const memoryUsages = results.filter((r: any) => r.memory_used).map((r: any) => parseInt(r.memory_used));

    const submissionRecord = {
      challenge_id,
      problem_slug: problem.slug,
      code,
      language: langKey,
      test_results: results.map((r: any) => ({
        test_case_id: r.test_case_id,
        visibility: r.visibility,
        passed: r.passed,
        status: r.status,
        time_used: r.time_used,
        memory_used: r.memory_used,
        // Only include input/output for public tests in stored results
        ...(r.visibility === 'public' ? { input: r.input, expected_output: r.expected_output, actual_output: r.actual_output, stdout: r.stdout, stderr: r.stderr } : {}),
      })),
      summary: {
        public_passed: publicResults.filter((r: any) => r.passed).length,
        public_total: publicResults.length,
        private_passed: privateResults.filter((r: any) => r.passed).length,
        private_total: privateResults.length,
        edge_passed: edgeResults.filter((r: any) => r.passed).length,
        edge_total: edgeResults.length,
      },
      performance: {
        avg_time_ms: executionTimes.length > 0 ? (executionTimes.reduce((a: number, b: number) => a + b, 0) / executionTimes.length * 1000).toFixed(2) : null,
        max_time_ms: executionTimes.length > 0 ? (Math.max(...executionTimes) * 1000).toFixed(2) : null,
        avg_memory_kb: memoryUsages.length > 0 ? Math.round(memoryUsages.reduce((a: number, b: number) => a + b, 0) / memoryUsages.length) : null,
        max_memory_kb: memoryUsages.length > 0 ? Math.max(...memoryUsages) : null,
      },
      passed_count: passedCount,
      total_tests: totalTests,
      score_percentage: scorePercentage,
      points_earned: pointsEarned,
      max_points: problem.points || 100,
      submitted_at: new Date().toISOString(),
    };

    const existing = session.coding_submissions || [];
    const existingIdx = existing.findIndex((s: any) => s.challenge_id === challenge_id);
    if (existingIdx >= 0) {
      existing[existingIdx] = submissionRecord;
    } else {
      existing.push(submissionRecord);
    }

    // Calculate total coding score across all challenges
    let totalCodingPoints = 0;
    let earnedCodingPoints = 0;
    for (const sub of existing) {
      totalCodingPoints += sub.max_points || 100;
      earnedCodingPoints += sub.points_earned || 0;
    }
    const codingScore = totalCodingPoints > 0 ? (earnedCodingPoints / totalCodingPoints) * 100 : 0;

    await supabase.from('assessment_sessions').update({
      coding_submissions: existing,
      coding_score: codingScore,
    }).eq('id', sessionId);

    return ok(res, {
      success: true,
      challenge_id,
      passed_count: passedCount,
      total_tests: totalTests,
      score_percentage: scorePercentage,
      points_earned: pointsEarned,
      summary: submissionRecord.summary,
      performance: submissionRecord.performance,
      // Only send public test results to candidate
      test_results: publicResults.map((r: any) => ({
        test_case_id: r.test_case_id,
        input: r.input,
        expected_output: r.expected_output,
        actual_output: r.actual_output,
        passed: r.passed,
        status: r.status,
        time_used: r.time_used,
        memory_used: r.memory_used,
        stdout: r.stdout,
        stderr: r.stderr,
      })),
      hidden_tests_passed: (submissionRecord.summary.private_passed + submissionRecord.summary.edge_passed),
      hidden_tests_total: (submissionRecord.summary.private_total + submissionRecord.summary.edge_total),
    });
  }

  // POST /api/assessments/:sessionId/proctoring
  if (req.method === 'POST' && segments.length === 3 && segments[2] === 'proctoring') {
    const sessionId = segments[1];
    const event = req.body;

    const { data: session } = await supabase.from('assessment_sessions').select('*').eq('id', sessionId).single();
    if (!session) return notFound(res, 'Session not found');

    const proctoring = session.proctoring_data || {};

    // Update counters
    if (event.event_type === 'tab_switch') proctoring.tab_switches = (proctoring.tab_switches || 0) + 1;
    else if (event.event_type === 'fullscreen_exit') proctoring.fullscreen_exits = (proctoring.fullscreen_exits || 0) + 1;
    else if (event.event_type === 'window_blur') proctoring.window_blurs = (proctoring.window_blurs || 0) + 1;
    else if (event.event_type === 'copy_paste') proctoring.copy_paste_attempts = (proctoring.copy_paste_attempts || 0) + 1;
    else if (event.event_type === 'right_click') proctoring.right_click_attempts = (proctoring.right_click_attempts || 0) + 1;
    else if (event.event_type === 'face_not_detected') proctoring.face_detection_failures = (proctoring.face_detection_failures || 0) + 1;
    else if (event.event_type === 'devtools_open') proctoring.devtools_attempts = (proctoring.devtools_attempts || 0) + 1;

    const isCritical = ['tab_switch', 'fullscreen_exit', 'window_blur'].includes(event.event_type);
    const warnings = proctoring.warnings || [];
    warnings.push({ type: event.event_type, timestamp: event.timestamp, details: event.details, severity: isCritical ? 'critical' : 'warning' });
    proctoring.warnings = warnings;

    // STRICT: immediate termination for critical events
    let shouldTerminate = false;
    let terminationReason = '';

    if (isCritical) {
      shouldTerminate = true;
      terminationReason = `Assessment terminated: ${event.event_type.replace(/_/g, ' ')} detected. This is a strict proctoring violation.`;
    } else if ((proctoring.face_detection_failures || 0) >= 3) {
      shouldTerminate = true;
      terminationReason = 'Assessment terminated: Face not visible 3 times.';
    } else {
      const minorViolations = (proctoring.copy_paste_attempts || 0) + (proctoring.right_click_attempts || 0) + (proctoring.devtools_attempts || 0);
      if (minorViolations >= 3) {
        shouldTerminate = true;
        terminationReason = 'Assessment terminated: Too many proctoring violations.';
      }
    }

    if (shouldTerminate) {
      proctoring.terminated = true;
      proctoring.termination_reason = terminationReason;
      await supabase.from('assessment_sessions').update({
        proctoring_data: proctoring,
        status: 'terminated',
        completed_at: new Date().toISOString(),
        mcq_score: 0,
        coding_score: 0,
        total_score: 0,
      }).eq('id', sessionId);
      return ok(res, { warning: false, terminated: true, message: terminationReason, violations_remaining: 0 });
    }

    const minorViolations = (proctoring.copy_paste_attempts || 0) + (proctoring.right_click_attempts || 0) + (proctoring.devtools_attempts || 0);
    await supabase.from('assessment_sessions').update({ proctoring_data: proctoring }).eq('id', sessionId);
    return ok(res, {
      warning: true,
      terminated: false,
      violations_remaining: Math.max(0, 3 - minorViolations),
      message: 'Warning: Proctoring violation recorded. Repeated violations will terminate your assessment.',
      event_type: event.event_type,
    });
  }

  // POST /api/assessments/:sessionId/complete
  if (req.method === 'POST' && segments.length === 3 && segments[2] === 'complete') {
    const sessionId = segments[1];

    const { data: session } = await supabase.from('assessment_sessions').select('*').eq('id', sessionId).single();
    if (!session) return notFound(res, 'Session not found');
    if (session.status !== 'in_progress') return badRequest(res, 'Assessment not in progress');

    const mcqScore = session.mcq_score;
    const codingScore = session.coding_score;
    const mcqVal = mcqScore != null ? Number(mcqScore) : 0;
    const codingVal = codingScore != null ? Number(codingScore) : 0;

    const totalScore = codingScore == null ? mcqVal : mcqScore == null ? codingVal : (mcqVal + codingVal) / 2;

    await supabase.from('assessment_sessions').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      mcq_score: mcqVal,
      coding_score: codingScore == null ? null : codingVal,
      total_score: totalScore,
    }).eq('id', sessionId);

    return ok(res, { success: true, mcq_score: mcqVal, coding_score: codingScore == null ? null : codingVal, total_score: totalScore });
  }

  // POST /api/assessments/invite (manager)
  if (req.method === 'POST' && segments.length === 2 && segments[1] === 'invite') {
    try {
      const user = await requireAuth(req, res);
      if (!user) return;

      const body = req.body;
      const candidateIds = body.candidate_ids as string[];
      const jobId = body.job_id as string;
      const assessmentMode = (body.assessment_mode === 'apex' || body.assessment_mode === 'dsa') ? body.assessment_mode : 'dsa';
      const includeMcq = assessmentMode === 'apex' ? true : (body.include_mcq !== false);
      const includeCoding = assessmentMode === 'apex' ? false : (body.include_coding !== false);
      const difficulty = (body.difficulty as string) || 'medium';
      const mcqCount = includeMcq ? Number(body.mcq_question_count ?? 20) : 0;
      const apexBlanksCount = assessmentMode === 'apex' ? Number(body.coding_challenge_count ?? 4) : 0;
      const codingCount = includeCoding ? Number(body.coding_challenge_count ?? 2) : 0;
      const effectiveCodingCount = assessmentMode === 'apex' ? apexBlanksCount : codingCount;

      // Deadline: prefer explicit datetime from body.deadline, fallback to deadline_hours
      let deadline: Date;
      if (body.deadline) {
        deadline = new Date(body.deadline);
        if (Number.isNaN(deadline.getTime())) {
          return badRequest(res, 'Invalid deadline date/time format');
        }
        if (deadline <= new Date()) {
          return badRequest(res, 'Deadline must be in the future');
        }
      } else {
        const deadlineHours = body.deadline_hours ?? 72;
        deadline = new Date(Date.now() + Number(deadlineHours) * 3600000);
      }

      const billingGate = await checkPlanAccess(supabase, user.id, 'assessment_invite', {
        quantity: Math.max(1, (candidateIds || []).length),
      });
      if (!billingGate.allowed) {
        return res.status(billingGate.status || 402).json(billingGate);
      }

      const { data: job } = await supabase
        .from('job_descriptions')
        .select('id, title, role, level, description, must_have_skills, good_to_have_skills')
        .eq('id', jobId)
        .eq('created_by', user.id)
        .single();
      if (!job) return notFound(res, 'Job not found');
      const isApexMode = assessmentMode === 'apex';

      const { data: candidates } = await supabase.from('candidates').select('id, email, full_name').in('id', candidateIds);
      if (!candidates?.length) return notFound(res, 'No candidates found');

      const frontendUrl = normalizeBaseUrl(resolveFrontendBaseUrl(req));

      if (includeMcq && mcqCount < 1) {
        return badRequest(res, 'MCQ question count must be at least 1 when MCQ is enabled');
      }

      // Auto-calculate time based on questions and difficulty if not provided
      let totalTimeMinutes = body.total_time_minutes;
      if (!totalTimeMinutes) {
        // MCQ time per question based on difficulty
        const mcqTimePerQuestion = difficulty === 'easy' ? 1 : difficulty === 'hard' ? 2 : 1.5;
        // Coding time per challenge based on difficulty
        const codingTimePerChallenge = difficulty === 'easy' ? 15 : difficulty === 'hard' ? 30 : 20;

        totalTimeMinutes = Math.ceil((mcqCount * mcqTimePerQuestion) + (effectiveCodingCount * codingTimePerChallenge));

        // Ensure minimum time of 15 minutes
        totalTimeMinutes = Math.max(15, totalTimeMinutes);
      }

      let invitesSent = 0;
      const failed: string[] = [];

      for (const c of candidates) {
        try {
          const token = crypto.randomBytes(32).toString('base64url');
          const sessionId = uuidv4();
          const { error: insertError } = await supabase.from('assessment_sessions').insert({
            id: sessionId,
            candidate_id: c.id,
            job_id: jobId,
            token,
            status: 'pending',
            deadline: deadline.toISOString(),
            mcq_question_count: mcqCount,
            coding_challenge_count: assessmentMode === 'apex' ? effectiveCodingCount : codingCount,
            total_time_minutes: totalTimeMinutes,
            mcq_questions: [],
            coding_challenges: [],
            proctoring_data: {
              tab_switches: 0,
              fullscreen_exits: 0,
              copy_paste_attempts: 0,
              warnings: [],
              terminated: false,
              assessment_config: {
                include_mcq: includeMcq,
                include_coding: includeCoding,
                difficulty,
                is_apex_mode: isApexMode,
                assessment_mode: assessmentMode,
              },
            },
            created_at: new Date().toISOString(),
          });

          if (insertError) {
            console.error('[assessments/invite] DB insert failed for candidate', c.id, insertError.message);
            failed.push(c.id);
            continue;
          }

          try {
            let generatedMcqs: any[] = [];
            let generatedCoding: any[] = [];
            let generatedApexBlanks: any[] = [];

            if (includeMcq && mcqCount > 0) {
              generatedMcqs = await generateAssessmentMcqsForJob({
                job: {
                  title: job.title,
                  role: job.role,
                  level: job.level,
                  description: job.description || '',
                  must_have_skills: job.must_have_skills || [],
                  good_to_have_skills: job.good_to_have_skills || [],
                },
                mcqCount,
                difficulty,
              });
            }

            if (assessmentMode === 'apex') {
              if (effectiveCodingCount > 0) {
                generatedApexBlanks = await generateApexFillInTheBlanks({
                  job: {
                    title: job.title,
                    role: job.role,
                    level: job.level,
                    description: job.description || '',
                    must_have_skills: job.must_have_skills || [],
                    good_to_have_skills: job.good_to_have_skills || [],
                  },
                  count: Math.max(1, Math.min(20, effectiveCodingCount)),
                  difficulty,
                });
              }
            } else if (includeCoding && codingCount > 0) {
              let dist: string[];
              if (difficulty === 'easy') dist = Array(codingCount).fill('easy');
              else if (difficulty === 'hard') dist = codingCount >= 2 ? ['medium', ...Array(codingCount - 1).fill('hard')] : ['hard'];
              else dist = codingCount >= 2 ? ['easy', ...Array(codingCount - 1).fill('medium')] : ['medium'];

              const lookups = await Promise.all(dist.map(d =>
                supabase.from('dsa_problems').select('*').eq('difficulty', d).eq('is_active', true).limit(20)
              ));
              const selected: any[] = [];
              for (const { data: problems } of lookups) {
                if (problems?.length) {
                  const avail = problems.filter((p: any) => !selected.some(s => s.id === p.id));
                  if (avail.length) selected.push(avail[Math.floor(Math.random() * avail.length)]);
                }
              }

              generatedCoding = selected.map((p: any) => {
                const pub = (p.test_cases || []).filter((tc: any) => tc.visibility === 'public');
                return {
                  id: p.id, slug: p.slug, title: p.title, description: p.description,
                  constraints: p.constraints || '', examples: p.examples || [],
                  starter_code: p.starter_code || {},
                  test_cases: pub.map((tc: any) => ({ id: tc.id, input: tc.input, expected_output: tc.expected_output })),
                  points: p.points, time_limit_seconds: p.time_limit_seconds,
                  supported_languages: Object.keys(p.starter_code || {}),
                };
              });
            }

            await supabase.from('assessment_sessions').update({
              mcq_questions: Array.isArray(generatedMcqs) ? generatedMcqs : [],
              coding_challenges: Array.isArray(generatedCoding) ? generatedCoding : [],
              proctoring_data: {
                tab_switches: 0,
                fullscreen_exits: 0,
                copy_paste_attempts: 0,
                warnings: [],
                terminated: false,
                assessment_config: {
                  include_mcq: includeMcq,
                  include_coding: includeCoding,
                  difficulty,
                  is_apex_mode: isApexMode,
                  assessment_mode: assessmentMode,
                },
                assessment_content: assessmentMode === 'apex' ? { apex_blanks: generatedApexBlanks } : undefined,
              },
              updated_at: new Date().toISOString(),
            }).eq('id', sessionId);
          } catch (genErr: any) {
            console.error('[assessments/invite] Question generation failed for candidate', c.id, genErr?.message || genErr);
            failed.push(c.id);
            await supabase.from('assessment_sessions').delete().eq('id', sessionId);
            continue;
          }

          try {
            await sendAssessmentInvite(c.email, c.full_name, job.title, `${frontendUrl}/assessment/${encodeURIComponent(token)}`, deadline.toLocaleString());
          } catch (emailErr: any) {
            // Email failure is non-fatal — the session is created; recruiter can resend later
            console.error('[assessments/invite] Email send failed for candidate', c.id, emailErr?.message || emailErr);
          }
          invitesSent += 1;
        } catch (err: any) {
          console.error('[assessments/invite] Unexpected error for candidate', c.id, err?.message || err);
          failed.push(c.id);
        }
      }

      if (invitesSent === 0 && candidates.length > 0) {
        return res.status(500).json({ error: 'Failed to create assessment sessions for all selected candidates. Please try again.' });
      }

      return ok(res, { success: invitesSent > 0, invites_sent: invitesSent, failed });
    } catch (err: any) {
      const requestId = (req.headers['x-nf-request-id'] || req.headers['x-nf-requestid'] || req.headers['x-request-id']) as string | undefined;
      console.error('[assessments/invite] Unhandled error', { requestId }, err);
      return res.status(500).json({
        error: err?.message || 'Failed to send invites',
        request_id: requestId || null,
      });
    }
  }

  return notFound(res);
}
