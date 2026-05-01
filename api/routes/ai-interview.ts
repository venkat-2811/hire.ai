/**
 * AI Interview route handler.
 * GET  /api/ai-interview/start/:token
 * GET  /api/ai-interview/:sessionId/question
 * POST /api/ai-interview/:sessionId/adapt-question
 * POST /api/ai-interview/:sessionId/transcribe
 * POST /api/ai-interview/:sessionId/transcribe-store
 * POST /api/ai-interview/:sessionId/response
 * POST /api/ai-interview/:sessionId/proctoring
 * POST /api/ai-interview/:sessionId/complete
 * POST /api/ai-interview/invite
 * Extracted verbatim from api/[...path].ts — lines 4824-5430.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../_lib/supabase';
import { ok, badRequest, notFound, methodNotAllowed, requireAuth, normalizeBaseUrl, resolveFrontendBaseUrl } from '../_lib/helpers';
import { checkPlanAccess } from '../_lib/billing-utils';
import { generateJSON } from '../_lib/openai';
import { transcribeWithAssemblyAI } from '../_lib/assemblyai';
import { normalizeInterviewQuestions, generateCandidateInterviewQuestions } from '../_lib/interview-gen';
import { sendInterviewInvite } from '../_lib/offer-utils';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export default async function handleAiInterview(req: VercelRequest, res: VercelResponse, segments: string[]) {
  const supabase = getSupabaseAdmin();

  // GET /api/ai-interview/start/:token
  if (req.method === 'GET' && segments.length === 3 && segments[1] === 'start') {
    try {
      const token = decodeURIComponent(segments[2] || '').trim();
      console.log('[ai-interview/start] token:', token?.slice(0, 10) + '...');
      const { data: session, error } = await supabase
        .from('ai_interview_sessions')
        .select('*, candidates(full_name, email), job_descriptions(title, role, level)')
        .eq('token', token)
        .single();

      if (error) {
        console.error('[ai-interview/start] DB error:', error.message);
        return notFound(res, 'Interview not found or link expired');
      }
      if (!session) return notFound(res, 'Interview not found or link expired');
      if (['completed', 'terminated'].includes(session.status)) return badRequest(res, 'Interview already completed or terminated');

      // Enforce Deadline
      if (!session.deadline) {
        return res.status(500).json({ error: 'Interview session misconfigured (missing deadline)' });
      }
      const deadlineDate = new Date(session.deadline);
      if (Number.isNaN(deadlineDate.getTime())) {
        return res.status(500).json({ error: 'Interview session misconfigured (invalid deadline)' });
      }
      if (new Date() > deadlineDate) {
        await supabase.from('ai_interview_sessions').update({ 
          status: 'expired',
          integrity_score: 0,
          completed_at: new Date().toISOString()
        }).eq('id', session.id);
        
        await supabase.from('job_applications').update({
          interview_status: 'expired',
          manual_interview_score: 0
        }).eq('candidate_id', session.candidate_id).eq('job_id', session.job_id);

        return badRequest(res, 'Interview deadline has passed');
      }

      const sessionQuestions = normalizeInterviewQuestions(session.questions);
      const questionCount = sessionQuestions.length;
      if (questionCount === 0) {
        return badRequest(res, 'Interview questions are not available yet. Please contact the hiring team.');
      }

      if (session.status === 'pending') {
        await supabase.from('ai_interview_sessions').update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
        }).eq('id', session.id);
      }

      return ok(res, {
        session_id: session.id,
        candidate_name: session.candidates?.full_name,
        job_title: session.job_descriptions?.title,
        total_questions: questionCount,
        estimated_duration_minutes: (questionCount || 5) * 3,
      });
    } catch (e: any) {
      console.error('[ai-interview/start] failed:', e?.message || e);
      return res.status(500).json({ error: 'Failed to load interview session' });
    }
  }

  // GET /api/ai-interview/:sessionId/question
  if (req.method === 'GET' && segments.length === 3 && segments[2] === 'question') {
    const sessionId = segments[1];
    const { data: session } = await supabase.from('ai_interview_sessions').select('*').eq('id', sessionId).single();
    if (!session) return notFound(res, 'Session not found');
    if (session.status !== 'in_progress') return badRequest(res, 'Interview not in progress');

    const idx = session.current_question_index || 0;
    const questions = normalizeInterviewQuestions(session.questions);
    if (idx >= questions.length) return ok(res, { completed: true, message: 'All questions answered' });
    const q = questions[idx];

    return ok(res, {
      index: idx,
      question_text: q.text,
      question_type: q.type,
      expected_duration_seconds: q.duration ?? 120,
    });
  }

  // POST /api/ai-interview/:sessionId/adapt-question
  // Generates a context-aware adaptive follow-up question based on previous responses.
  // Body: { next_index: number }
  // Returns the question at next_index (replacing the pre-stored one if AI generates a better one).
  if (req.method === 'POST' && segments.length === 3 && segments[2] === 'adapt-question') {
    const sessionId = segments[1];
    const { next_index } = (req.body || {}) as { next_index?: number };

    const { data: session } = await supabase
      .from('ai_interview_sessions')
      .select('*, job_descriptions(title, role, level, must_have_skills, description)')
      .eq('id', sessionId)
      .single();

    if (!session) return notFound(res, 'Session not found');
    if (session.status !== 'in_progress') return badRequest(res, 'Interview not in progress');

    const questions = normalizeInterviewQuestions(session.questions);
    const responses: any[] = Array.isArray(session.responses) ? session.responses : [];
    const idx = typeof next_index === 'number' ? next_index : (session.current_question_index || 0);

    // If index is beyond question list or no prior responses, just return the pre-stored question
    if (responses.length === 0 || idx >= questions.length) {
      const q = questions[idx];
      if (!q) return ok(res, { completed: true });
      return ok(res, { index: idx, question_text: q.text, question_type: q.type, expected_duration_seconds: q.duration ?? 120, adaptive: false });
    }

    // Build context from prior Q&A pairs
    const job = session.job_descriptions || {};
    const resumeInsights = session.proctoring_data?.resume_insights || {};
    const priorQA = responses
      .filter((r: any) => typeof r?.question_index === 'number' && questions[r.question_index])
      .sort((a: any, b: any) => a.question_index - b.question_index)
      .slice(-3) // last 3 responses for context
      .map((r: any) => {
        const q = questions[r.question_index];
        return `Q (${q.type}): ${q.text}\nA: ${r.transcript || '[No response provided]'}`;
      })
      .join('\n\n');

    const nextPreStored = questions[idx];
    const skills = (job.must_have_skills || []).join(', ') || 'General';
    const candidateSkills = Array.isArray(resumeInsights.skills) ? resumeInsights.skills.join(', ') : '';

    const adaptPrompt = `You are an expert technical interviewer conducting a live ${job.level} ${job.role} interview for ${job.title}.

Required Skills: ${skills}
${candidateSkills ? `Candidate Skills: ${candidateSkills}` : ''}
${resumeInsights.experience_summary ? `Candidate Experience: ${resumeInsights.experience_summary}` : ''}

## Interview Progress So Far (last ${Math.min(responses.length, 3)} Q&A pairs):
${priorQA}

## Pre-planned next question (question ${idx + 1} of ${questions.length}):
"${nextPreStored?.text || ''}" (type: ${nextPreStored?.type || 'technical'})

## Your Task:
Based on the candidate's answers above, generate a BETTER adaptive follow-up question for question ${idx + 1}.
- If the candidate gave a strong answer, go deeper on that topic or a related advanced concept.
- If the candidate struggled, probe with a simpler or more supportive follow-up.
- If the answer revealed a gap in required skills, ask about it directly.
- Keep the question type (${nextPreStored?.type || 'technical'}) unless a behavioral/situational follow-up would reveal more.
- If the pre-planned question is already ideal given context, you may return it as-is.

Return ONLY this JSON:
{"text": "<the adaptive question>", "type": "technical|behavioral|situational", "duration": <seconds 90-180>}`;

    try {
      const adapted = await Promise.race<any>([
        generateJSON<any>(adaptPrompt, { temperature: 0.7, maxTokens: 512 }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('adapt timeout')), 8000)),
      ]);
      if (adapted?.text && adapted?.type) {
        // Replace the pre-stored question at this index with the adaptive one
        const updatedQuestions = [...questions];
        updatedQuestions[idx] = {
          text: String(adapted.text),
          type: String(adapted.type),
          duration: typeof adapted.duration === 'number' ? adapted.duration : 120,
        };
        await supabase.from('ai_interview_sessions')
          .update({ questions: updatedQuestions, updated_at: new Date().toISOString() })
          .eq('id', sessionId);
        return ok(res, { index: idx, question_text: adapted.text, question_type: adapted.type, expected_duration_seconds: adapted.duration ?? 120, adaptive: true });
      }
    } catch (e: any) {
      console.warn('[adapt-question] AI adaptation failed, using pre-stored:', e.message);
    }

    // Fallback to pre-stored question
    if (!nextPreStored) return ok(res, { completed: true });
    return ok(res, { index: idx, question_text: nextPreStored.text, question_type: nextPreStored.type, expected_duration_seconds: nextPreStored.duration ?? 120, adaptive: false });
  }

  // POST /api/ai-interview/:sessionId/transcribe
  // Accepts JSON body: { audio_base64: string, mime_type?: string }
  if (req.method === 'POST' && segments.length === 3 && segments[2] === 'transcribe') {
    const sessionId = segments[1];

    const { data: session } = await supabase
      .from('ai_interview_sessions')
      .select('id, status')
      .eq('id', sessionId)
      .single();

    if (!session) return notFound(res, 'Session not found');
    if (!['in_progress', 'completed'].includes(session.status)) {
      return badRequest(res, 'Interview not in progress');
    }

    const body = req.body as { audio_base64?: string; mime_type?: string };
    if (!body?.audio_base64) {
      return badRequest(res, 'Missing audio_base64 in request body.');
    }

    let audioBuffer: Buffer;
    try {
      audioBuffer = Buffer.from(body.audio_base64, 'base64');
    } catch {
      return badRequest(res, 'Invalid base64 audio data.');
    }

    if (audioBuffer.length === 0) {
      return badRequest(res, 'Empty audio data received.');
    }

    try {
      const transcript = await transcribeWithAssemblyAI(audioBuffer, body.mime_type || 'audio/webm');
      return ok(res, { transcript });
    } catch (e: any) {
      console.error('Transcription error:', e.message);
      if (e.message.includes('ASSEMBLYAI_API_KEY')) {
        return res.status(503).json({ error: e.message });
      }
      return res.status(500).json({ error: `Transcription failed: ${e.message}` });
    }
  }

  // POST /api/ai-interview/:sessionId/transcribe-store
  // Accepts JSON body: { question_index: number, audio_base64: string, mime_type?: string, audio_duration_seconds?: number }
  // Transcribes on server and stores transcript on the matching question response.
  if (req.method === 'POST' && segments.length === 3 && segments[2] === 'transcribe-store') {
    const sessionId = segments[1];
    const body = req.body as {
      question_index?: number;
      audio_base64?: string;
      mime_type?: string;
      audio_duration_seconds?: number;
    };

    const { data: session } = await supabase
      .from('ai_interview_sessions')
      .select('id, status, responses')
      .eq('id', sessionId)
      .single();

    if (!session) return notFound(res, 'Session not found');
    if (!['in_progress', 'completed'].includes(session.status)) {
      return badRequest(res, 'Interview not in progress');
    }

    if (typeof body?.question_index !== 'number' || body.question_index < 0) {
      return badRequest(res, 'Missing or invalid question_index.');
    }
    if (!body?.audio_base64) {
      return badRequest(res, 'Missing audio_base64 in request body.');
    }

    let audioBuffer: Buffer;
    try {
      audioBuffer = Buffer.from(body.audio_base64, 'base64');
    } catch {
      return badRequest(res, 'Invalid base64 audio data.');
    }
    if (audioBuffer.length === 0) {
      return badRequest(res, 'Empty audio data received.');
    }

    try {
      const transcript = await transcribeWithAssemblyAI(audioBuffer, body.mime_type || 'audio/webm');

      const responses: any[] = Array.isArray(session.responses) ? [...session.responses] : [];
      const existingIdx = responses.findIndex((r: any) => Number(r?.question_index) === body.question_index);
      const existing = existingIdx >= 0 ? responses[existingIdx] : {};

      const updatedResponse = {
        ...existing,
        question_index: body.question_index,
        transcript,
        audio_duration_seconds: typeof body.audio_duration_seconds === 'number'
          ? body.audio_duration_seconds
          : (existing?.audio_duration_seconds ?? 0),
        confidence: typeof existing?.confidence === 'number' ? existing.confidence : 0.9,
        transcribed_at: new Date().toISOString(),
        submitted_at: existing?.submitted_at || new Date().toISOString(),
      };

      if (existingIdx >= 0) {
        responses[existingIdx] = updatedResponse;
      } else {
        responses.push(updatedResponse);
      }

      await supabase
        .from('ai_interview_sessions')
        .update({ responses, updated_at: new Date().toISOString() })
        .eq('id', sessionId);

      return ok(res, {
        success: true,
        question_index: body.question_index,
        transcript_length: transcript.length,
      });
    } catch (e: any) {
      console.error('Transcription-store error:', e.message);
      if (e.message.includes('ASSEMBLYAI_API_KEY')) {
        return res.status(503).json({ error: e.message });
      }
      return res.status(500).json({ error: \`Transcription failed: \${e.message}\` });
    }
  }

  // POST /api/ai-interview/:sessionId/response
  if (req.method === 'POST' && segments.length === 3 && segments[2] === 'response') {
    const sessionId = segments[1];
    const body = req.body;

    const { data: session } = await supabase.from('ai_interview_sessions').select('*').eq('id', sessionId).single();
    if (!session) return notFound(res, 'Session not found');

    const responses = Array.isArray(session.responses) ? [...session.responses] : [];
    const existingIdx = responses.findIndex((r: any) => Number(r?.question_index) === Number(body.question_index));
    const responsePayload = {
      question_index: body.question_index,
      transcript: typeof body.transcript === 'string' ? body.transcript : '',
      audio_duration_seconds: body.audio_duration_seconds,
      confidence: body.confidence,
      submitted_at: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      responses[existingIdx] = {
        ...responses[existingIdx],
        ...responsePayload,
      };
    } else {
      responses.push(responsePayload);
    }

    const nextIndex = (session.current_question_index || 0) + 1;
    const questionCount = normalizeInterviewQuestions(session.questions).length;
    const isLast = nextIndex >= questionCount;

    await supabase.from('ai_interview_sessions').update({
      responses,
      current_question_index: nextIndex,
      updated_at: new Date().toISOString(),
    }).eq('id', sessionId);

    return ok(res, { success: true, is_last_question: isLast });
  }

  // POST /api/ai-interview/:sessionId/proctoring
  if (req.method === 'POST' && segments.length === 3 && segments[2] === 'proctoring') {
    const sessionId = segments[1];
    const event = req.body;

    const { data: session } = await supabase.from('ai_interview_sessions').select('*').eq('id', sessionId).single();
    if (!session) return notFound(res, 'Session not found');

    const proctoring = session.proctoring_data || {};

    // Update counters
    if (event.event_type === 'tab_switch') proctoring.tab_switches = (proctoring.tab_switches || 0) + 1;
    else if (event.event_type === 'fullscreen_exit') proctoring.fullscreen_exits = (proctoring.fullscreen_exits || 0) + 1;
    else if (event.event_type === 'window_blur') proctoring.window_blurs = (proctoring.window_blurs || 0) + 1;
    else if (event.event_type === 'face_not_detected') proctoring.face_detection_failures = (proctoring.face_detection_failures || 0) + 1;
    else if (event.event_type === 'copy_paste') proctoring.copy_paste_attempts = (proctoring.copy_paste_attempts || 0) + 1;
    else if (event.event_type === 'devtools_open') proctoring.devtools_attempts = (proctoring.devtools_attempts || 0) + 1;

    const warnings = proctoring.warnings || [];
    const isCritical = ['tab_switch', 'fullscreen_exit', 'window_blur'].includes(event.event_type);
    warnings.push({ type: event.event_type, timestamp: event.timestamp, details: event.details, severity: isCritical ? 'critical' : 'warning' });
    proctoring.warnings = warnings;

    // STRICT: immediate termination for critical events
    let shouldTerminate = false;
    let terminationReason = '';

    if (isCritical) {
      shouldTerminate = true;
      terminationReason = \`Interview terminated: \${event.event_type.replace(/_/g, ' ')} detected. This is a strict proctoring violation.\`;
    } else if ((proctoring.face_detection_failures || 0) >= 3) {
      shouldTerminate = true;
      terminationReason = 'Interview terminated: Face not visible 3 times.';
    } else {
      const minorViolations = (proctoring.copy_paste_attempts || 0) + (proctoring.devtools_attempts || 0);
      if (minorViolations >= 3) {
        shouldTerminate = true;
        terminationReason = 'Interview terminated: Too many proctoring violations.';
      }
    }

    if (shouldTerminate) {
      proctoring.terminated = true;
      proctoring.termination_reason = terminationReason;
      const terminatedEvaluation = {
        overall_score: 0,
        technical_score: 0,
        communication_score: 0,
        confidence_score: 0,
        recommendation: 'no_hire',
        strengths: [],
        areas_for_improvement: ['Interview terminated due to proctoring violations.'],
        detailed_feedback: terminationReason,
      };
      await supabase.from('ai_interview_sessions').update({
        proctoring_data: proctoring,
        status: 'terminated',
        completed_at: new Date().toISOString(),
        final_evaluation: terminatedEvaluation,
      }).eq('id', sessionId);
      return ok(res, { terminated: true, message: terminationReason });
    }

    await supabase.from('ai_interview_sessions').update({ proctoring_data: proctoring }).eq('id', sessionId);
    return ok(res, { success: true, terminated: false, warning: true, message: 'Proctoring violation recorded.' });
  }

  // POST /api/ai-interview/:sessionId/complete
  if (req.method === 'POST' && segments.length === 3 && segments[2] === 'complete') {
    const sessionId = segments[1];
    const { data: session } = await supabase
      .from('ai_interview_sessions')
      .select('*, candidates(full_name), job_descriptions(title, role, level, must_have_skills)')
      .eq('id', sessionId)
      .single();
    if (!session) return notFound(res, 'Session not found');

    // AI-powered evaluation based on actual responses
    let finalEvaluation: any;
    const questions = normalizeInterviewQuestions(session.questions);
    const responses = session.responses || [];

    try {
      const qaPairs = questions.map((q: any, i: number) => {
        const resp = responses.find((r: any) => r.question_index === i);
        return \`Q\${i + 1} (\${q.type}): \${q.text}\\nA\${i + 1}: \${resp?.transcript || '[No response]'}\`;
      }).join('\n\n');

      const evalPrompt = \`Evaluate this AI interview for a \${session.job_descriptions?.level} \${session.job_descriptions?.role} position (\${session.job_descriptions?.title}).
Required skills: \${(session.job_descriptions?.must_have_skills || []).join(', ')}

Interview Q&A:
\${qaPairs}

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
}\`;
      finalEvaluation = await generateJSON<any>(evalPrompt);
    } catch {
      // Fallback if AI evaluation fails
      const answeredCount = responses.filter((r: any) => r.transcript && r.transcript.trim()).length;
      const completionRate = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;
      finalEvaluation = {
        overall_score: Math.round(completionRate * 0.7),
        technical_score: Math.round(completionRate * 0.6),
        communication_score: Math.round(completionRate * 0.8),
        confidence_score: Math.round(completionRate * 0.7),
        recommendation: completionRate >= 70 ? 'maybe' : 'no_hire',
        strengths: answeredCount > 0 ? ['Completed interview responses'] : [],
        areas_for_improvement: ['Could not perform AI evaluation - scores are approximate'],
        detailed_feedback: \`Candidate answered \${answeredCount} of \${questions.length} questions.\`,
      };
    }

    await supabase.from('ai_interview_sessions').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      final_evaluation: finalEvaluation,
    }).eq('id', sessionId);

    return ok(res, finalEvaluation);
  }

  // POST /api/ai-interview/invite (manager)
  if (req.method === 'POST' && segments.length === 2 && segments[1] === 'invite') {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { candidate_ids, job_id, scheduled_time } = req.body;
    const requestedCountRaw = req.body?.question_count;
    const requestedCount = Math.max(1, Math.min(30, Number(requestedCountRaw ?? 5) || 5));

    // Deadline: prefer explicit datetime from body.deadline, fallback to 72h
    let deadlineDate: Date;
    if (req.body?.deadline) {
      deadlineDate = new Date(req.body.deadline);
      if (Number.isNaN(deadlineDate.getTime())) {
        return badRequest(res, 'Invalid deadline date/time format');
      }
      if (deadlineDate <= new Date()) {
        return badRequest(res, 'Deadline must be in the future');
      }
    } else {
      deadlineDate = new Date(Date.now() + 72 * 3600000);
    }

    const billingGate = await checkPlanAccess(supabase, user.id, 'ai_interview_invite', {
      quantity: Math.max(1, (candidate_ids || []).length),
    });
    if (!billingGate.allowed) {
      return res.status(billingGate.status || 402).json(billingGate);
    }

    const { data: job } = await supabase
      .from('job_descriptions')
      .select('id, title, role, level, must_have_skills, description')
      .eq('id', job_id)
      .eq('created_by', user.id)
      .single();

    if (!job) return notFound(res, 'Job not found');

    const { data: candidates } = await supabase
      .from('candidates')
      .select('id, email, full_name, resume_parsed_data')
      .in('id', candidate_ids);

    if (!candidates?.length) return notFound(res, 'No candidates found');

    const frontendUrl = normalizeBaseUrl(resolveFrontendBaseUrl(req));
    let invitesSent = 0;
    const failed: string[] = [];
    const failed_reasons: Record<string, string> = {};

    for (const c of candidates) {
      try {
        if (!c.email) {
          throw new Error('Candidate email is missing');
        }

        const token = crypto.randomBytes(32).toString('base64url');
        const sessionId = uuidv4();

        // Generate personalized questions per candidate using their resume data (GPT-4.1-mini)
        console.log('[ai-interview/invite] Generating personalized questions for candidate:', c.id, 'with resume:', !!c.resume_parsed_data);
        const questions = await generateCandidateInterviewQuestions(
          { title: job.title, role: job.role, level: job.level, must_have_skills: job.must_have_skills || [], description: job.description || '' },
          { full_name: c.full_name, resume_parsed_data: c.resume_parsed_data },
          requestedCount
        );

        const normalizedQuestions = normalizeInterviewQuestions(questions);
        if (normalizedQuestions.length === 0) {
          throw new Error('No interview questions generated for candidate');
        }

        console.log('[ai-interview/invite] Generated', normalizedQuestions.length, 'questions for candidate:', c.id);

        // Build a lightweight resume_insights snapshot stored in the session for adaptive use
        const resume = c.resume_parsed_data || {};
        const resumeInsights = {
          skills: Array.isArray(resume.skills) ? resume.skills.slice(0, 15) : [],
          experience_summary: Array.isArray(resume.experience)
            ? resume.experience.slice(0, 3).map((e: any) => \`\${e.title || ''} at \${e.company || ''}\`).join('; ')
            : (typeof resume.experience === 'string' ? resume.experience.slice(0, 300) : ''),
          education_summary: Array.isArray(resume.education)
            ? resume.education.slice(0, 2).map((e: any) => \`\${e.degree || ''} from \${e.institution || ''}\`).join('; ')
            : (typeof resume.education === 'string' ? resume.education.slice(0, 200) : ''),
        };

        const { error: insertErr } = await supabase.from('ai_interview_sessions').insert({
          id: sessionId,
          candidate_id: c.id,
          job_id,
          token,
          status: 'pending',
          deadline: deadlineDate.toISOString(),
          current_question_index: 0,
          questions: normalizedQuestions,
          responses: [],
          proctoring_data: { warnings: [], camera_enabled: false, microphone_enabled: false, resume_insights: resumeInsights },
          created_at: new Date().toISOString(),
        });
        if (insertErr) {
          throw new Error(\`Failed to create interview session: \${insertErr.message}\`);
        }

        try {
          await sendInterviewInvite(c.email, c.full_name, job.title, \`\${frontendUrl}/ai-interview/\${encodeURIComponent(token)}\`, scheduled_time);
        } catch (emailErr: any) {
          await supabase.from('ai_interview_sessions').delete().eq('id', sessionId);
          throw new Error(\`Failed to send interview invite email: \${emailErr?.message || emailErr}\`);
        }

        invitesSent += 1;
      } catch (err: any) {
        const reason = String(err?.message || err || 'Unknown error');
        console.error('[ai-interview/invite] Failed for candidate:', c.id, reason);
        failed.push(c.id);
        failed_reasons[c.id] = reason;
      }
    }

    return ok(res, { success: invitesSent > 0, invites_sent: invitesSent, failed, failed_reasons });
  }

  return notFound(res);
}
