/**
 * Candidates route handler.
 * Extracted verbatim from api/[...path].ts — lines 2354-3321.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../_lib/supabase';
import { ok, badRequest, notFound, methodNotAllowed, requireAuth } from '../_lib/helpers';
import { generateJSON } from '../_lib/openai';
import { checkPlanAccess } from '../_lib/billing-utils';
import { parseMultipartSingleFile, extractResumeText } from '../_lib/resume';
import { sendAcceptanceEmail, sendRejectionEmail, sendOfferLetterEmail, signOfferToken, verifyOfferToken, buildOfferLetterPdf } from '../_lib/offer-utils';

export default async function handleCandidates(req: VercelRequest, res: VercelResponse, segments: string[]) {
  const supabase = getSupabaseAdmin();

  // POST /api/candidates/parse-resume-preview — Parse resume and return extracted fields for auto-fill
  if (req.method === 'POST' && segments.length === 2 && segments[1] === 'parse-resume-preview') {
    const user = await requireAuth(req, res);
    if (!user) return;

    try {
      const fileData = await parseMultipartSingleFile(req, 'resume');
      if (!fileData) {
        return badRequest(res, 'No resume file provided');
      }

      const rawText = await extractResumeText(fileData.buffer, fileData.filename);
      const resumeText = String(rawText)
        .replace(/\x00/g, '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
        .slice(0, 50000);

      if (!resumeText || resumeText.length < 20) {
        return badRequest(res, 'Could not extract text from the resume. Please try a different file format.');
      }

      const prompt = `You are an expert resume parser. Parse the following resume and extract key information for a candidate profile.

Return ONLY valid JSON in this exact format:
{
  "full_name": "First Last",
  "email": "email@example.com",
  "phone": "+1234567890",
  "location": "City, Country",
  "skills": ["skill1", "skill2"],
  "summary": "Brief professional summary",
  "total_experience_years": 0
}

Rules:
- Extract the candidate's full name as it appears on the resume
- Extract email and phone if present, otherwise use empty string
- Location should be their current city/country
- Skills should be technical skills (max 15)
- Summary should be 1-2 sentences
- If a field cannot be determined, use an empty string or 0

RESUME TEXT:
${resumeText.slice(0, 8000)}`;

      const parsed = await generateJSON<any>(prompt);

      return ok(res, {
        full_name: typeof parsed?.full_name === 'string' ? parsed.full_name : '',
        email: typeof parsed?.email === 'string' ? parsed.email : '',
        phone: typeof parsed?.phone === 'string' ? parsed.phone : '',
        location: typeof parsed?.location === 'string' ? parsed.location : '',
        skills: Array.isArray(parsed?.skills) ? parsed.skills.filter((s: any) => typeof s === 'string') : [],
        summary: typeof parsed?.summary === 'string' ? parsed.summary : '',
        total_experience_years: typeof parsed?.total_experience_years === 'number' ? parsed.total_experience_years : 0,
      });
    } catch (e: any) {
      console.error('[candidates/parse-resume-preview] failed:', e?.message || e);
      return res.status(502).json({ error: 'Failed to parse resume. Please try again or enter details manually.' });
    }
  }

  if (segments.length === 1) {

    if (req.method === 'GET') {
      const user = await requireAuth(req, res);
      if (!user) return;

      const limit = parseInt((req.query.limit as string) || '50');
      const offset = parseInt((req.query.offset as string) || '0');
      const jobIdFilter = req.query.job_id as string | undefined;

      // Get this user's job IDs to scope candidates
      const { data: userJobs } = await supabase
        .from('job_descriptions')
        .select('id')
        .eq('created_by', user.id);

      const userJobIds = (userJobs || []).map((j: any) => j.id);
      if (userJobIds.length === 0) return ok(res, []);

      // Get candidate IDs who applied to this user's jobs
      let appQuery = supabase
        .from('job_applications')
        .select('candidate_id, job_id, status, applied_at')
        .in('job_id', userJobIds);

      if (jobIdFilter) appQuery = appQuery.eq('job_id', jobIdFilter);

      const { data: applications } = await appQuery
        .order('applied_at', { ascending: false })
        .limit(limit);

      const candidateIds = [...new Set((applications || []).map((a: any) => a.candidate_id))];
      if (candidateIds.length === 0) return ok(res, []);

      const { data, error } = await supabase
        .from('candidates')
        .select('id, full_name, email, phone, created_at, updated_at, consent_given, resume_url, resume_parsed_data')
        .in('id', candidateIds)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) return res.status(500).json({ error: error.message });

      // Build a map of candidate_id -> list of job_ids + per (candidate, job) applied_at
      const jobMap: Record<string, string[]> = {};
      const appliedAtMap: Record<string, string | null> = {};
      for (const app of (applications || [])) {
        const cid = app.candidate_id;
        const jid = app.job_id;
        if (!cid || !jid) continue;
        if (!jobMap[cid]) jobMap[cid] = [];
        if (!jobMap[cid].includes(jid)) {
          jobMap[cid].push(jid);
        }
        const key = `${cid}:${jid}`;
        if (!(key in appliedAtMap)) {
          appliedAtMap[key] = app.applied_at ?? null;
        }
      }

      // Return one entry per (candidate, job) pair for proper job-based grouping
      const result: any[] = [];
      for (const c of (data || [])) {
        const appliedJobs = jobMap[c.id] || [];
        for (const jid of appliedJobs) {
          result.push({ ...c, job_id: jid, applied_at: appliedAtMap[`${c.id}:${jid}`] ?? null });
        }
      }

      // Enrich with ATS screening scores
      if (result.length > 0) {
        const { data: screenings } = await supabase
          .from('ats_screenings')
          .select('candidate_id, job_id, overall_score, skill_relevance_score, experience_score, education_score, credibility_score, shortlisted, shortlist_reason')
          .in('candidate_id', candidateIds);

        if (screenings && screenings.length > 0) {
          // Build map keyed by "candidateId:jobId"
          const screeningMap: Record<string, any> = {};
          for (const s of screenings) {
            screeningMap[`${s.candidate_id}:${s.job_id}`] = s;
          }

          for (const entry of result) {
            const screening = screeningMap[`${entry.id}:${entry.job_id}`];
            if (screening) {
              entry.ats_score = screening.overall_score;
              entry.skill_relevance_score = screening.skill_relevance_score;
              entry.experience_score = screening.experience_score;
              entry.education_score = screening.education_score;
              entry.credibility_score = screening.credibility_score;
              entry.shortlisted = screening.shortlisted;
              entry.shortlist_reason = screening.shortlist_reason;
            } else {
              entry.ats_score = null;
              entry.shortlisted = null;
            }
          }
        }
      }

      return ok(res, result);
    }

    if (req.method === 'POST') {
      const user = await requireAuth(req, res);
      if (!user) return;

      // JSON-only candidate creation
      const body = req.body || {};
      if (!body.full_name || !body.email) return badRequest(res, 'full_name and email are required');

      // Optional: ensure provided job belongs to current user
      const jobId = body.job_id ? String(body.job_id) : null;
      if (jobId) {
        const { data: job } = await supabase
          .from('job_descriptions')
          .select('id')
          .eq('id', jobId)
          .eq('created_by', user.id)
          .single();
        if (!job) return badRequest(res, 'Invalid job_id');
      }

      // Check if candidate with same email already exists
      const { data: existingCandidates } = await supabase
        .from('candidates')
        .select('*')
        .eq('email', body.email)
        .limit(1);

      let candidateRow: any;

      if (existingCandidates && existingCandidates.length > 0) {
        // Reuse existing candidate, update their info
        const existingId = existingCandidates[0].id;
        const updateData: Record<string, any> = {
          full_name: body.full_name,
          phone: body.phone || null,
          portfolio_url: body.portfolio_url || null,
          github_url: body.github_url || null,
          consent_given: !!body.consent_given,
          consent_timestamp: body.consent_given ? new Date().toISOString() : null,
          location: body.location !== undefined ? body.location : existingCandidates[0].location,
          vendorName: body.vendorName !== undefined ? body.vendorName : existingCandidates[0].vendorName,
          mainSkillset: body.mainSkillset !== undefined ? body.mainSkillset : existingCandidates[0].mainSkillset,
          updated_at: new Date().toISOString(),
        };

        await supabase
          .from('candidates')
          .update(updateData)
          .eq('id', existingId);

        const { data: updated } = await supabase
          .from('candidates')
          .select('*')
          .eq('id', existingId)
          .single();

        candidateRow = updated || existingCandidates[0];
      } else {
        // Create new candidate
        const candidateData = {
          full_name: body.full_name,
          email: body.email,
          phone: body.phone || null,
          portfolio_url: body.portfolio_url || null,
          github_url: body.github_url || null,
          consent_given: !!body.consent_given,
          consent_timestamp: body.consent_given ? new Date().toISOString() : null,
          resume_url: body.resume_url || null,
          resume_text: body.resume_text || null,
          resume_parsed_data: body.resume_parsed_data || null,
          location: body.location || null,
          vendorName: body.vendorName || null,
          mainSkillset: body.mainSkillset || null,
        };

        const { data, error } = await supabase
          .from('candidates')
          .insert(candidateData)
          .select()
          .single();

        if (error) return res.status(500).json({ error: error.message });
        candidateRow = data;
      }

      // Create application mapping so user-scoped candidate lists include this candidate
      if (jobId) {
        // Check if already applied to this job
        const { data: existingApp } = await supabase
          .from('job_applications')
          .select('id')
          .eq('candidate_id', candidateRow.id)
          .eq('job_id', jobId)
          .limit(1);

        if (existingApp && existingApp.length > 0) {
          return badRequest(res, 'This candidate has already applied to this job');
        }

        const { error: appError } = await supabase
          .from('job_applications')
          .insert({
            job_id: jobId,
            candidate_id: candidateRow.id,
            status: 'applied',
            applied_at: new Date().toISOString(),
            screening_status: 'pending',
          });
        if (appError) {
          return res.status(500).json({ error: appError.message });
        }
      }

      return ok(res, { ...candidateRow, job_id: jobId }, 201);
    }

    return methodNotAllowed(res);
  }

  // POST /api/candidates/send-acceptance
  // NOTE: Must be handled before /api/candidates/:id route
  if (req.method === 'POST' && segments.length === 2 && segments[1] === 'send-acceptance') {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { candidate_ids, job_id } = req.body as { candidate_ids?: string[]; job_id?: string };
    if (!candidate_ids?.length || !job_id) return badRequest(res, 'candidate_ids and job_id are required');

    const { data: job } = await supabase.from('job_descriptions').select('id, title').eq('id', job_id).eq('created_by', user.id).single();
    if (!job) return notFound(res, 'Job not found or access denied');

    const { data: candidates } = await supabase.from('candidates').select('id, email, full_name').in('id', candidate_ids);
    if (!candidates?.length) return notFound(res, 'No candidates found');

    let emailsSent = 0;
    const errorMessages: string[] = [];

    for (const c of candidates) {
      try {
        await sendAcceptanceEmail(c.email, c.full_name, job.title);
        emailsSent++;
      } catch (e: any) {
        errorMessages.push(`${c.full_name}: ${e.message}`);
      }
    }

    return ok(res, { success: emailsSent > 0, emails_sent: emailsSent, error_messages: errorMessages });
  }

  // POST /api/candidates/send-rejection
  // NOTE: Must be handled before /api/candidates/:id route
  if (req.method === 'POST' && segments.length === 2 && segments[1] === 'send-rejection') {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { candidate_ids, job_id } = req.body as { candidate_ids?: string[]; job_id?: string };
    if (!candidate_ids?.length || !job_id) return badRequest(res, 'candidate_ids and job_id are required');

    const { data: job } = await supabase.from('job_descriptions').select('id, title').eq('id', job_id).eq('created_by', user.id).single();
    if (!job) return notFound(res, 'Job not found or access denied');

    const { data: candidates } = await supabase.from('candidates').select('id, email, full_name').in('id', candidate_ids);
    if (!candidates?.length) return notFound(res, 'No candidates found');

    let emailsSent = 0;
    const errorMessages: string[] = [];

    for (const c of candidates) {
      try {
        await sendRejectionEmail(c.email, c.full_name, job.title);
        emailsSent++;
      } catch (e: any) {
        errorMessages.push(`${c.full_name}: ${e.message}`);
      }
    }

    return ok(res, { success: emailsSent > 0, emails_sent: emailsSent, error_messages: errorMessages });
  }

  // POST /api/candidates/send-offer-letter
  if (req.method === 'POST' && segments.length === 2 && segments[1] === 'send-offer-letter') {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { candidate_ids, job_id, company_name, ctc, start_date, reporting_manager, location, time_period_years, time_period_months } = req.body as {
      candidate_ids?: string[];
      job_id?: string;
      company_name?: string;
      ctc?: string;
      start_date?: string;
      reporting_manager?: string;
      location?: string;
      time_period_years?: number | null;
      time_period_months?: number | null;
    };
    if (!candidate_ids?.length || !job_id) {
      return badRequest(res, 'candidate_ids and job_id are required');
    }
    if (!ctc || !String(ctc).trim()) {
      return badRequest(res, 'ctc is required');
    }
    if (!company_name || !String(company_name).trim()) {
      return badRequest(res, 'company_name is required');
    }

    const { data: job } = await supabase
      .from('job_descriptions')
      .select('id, title')
      .eq('id', job_id)
      .eq('created_by', user.id)
      .single();
    if (!job) return notFound(res, 'Job not found or access denied');

    const { data: candidates } = await supabase
      .from('candidates')
      .select('id, email, full_name')
      .in('id', candidate_ids);
    if (!candidates?.length) return notFound(res, 'No candidates found');

    const resolvedCompany = (company_name || '').trim() || 'Our Company';
    let emailsSent = 0;
    const errorMessages: string[] = [];

    for (const c of candidates) {
      try {
        const token = await signOfferToken(c.id, job_id);
        const acceptanceLink = `${getFrontendBaseUrl(req)}/offer-acceptance?token=${encodeURIComponent(token)}`;
        const pdfBytes = buildOfferLetterPdf({
          candidateName: c.full_name,
          candidateEmail: c.email,
          jobTitle: job.title,
          companyName: resolvedCompany,
          ctc: String(ctc).trim(),
          startDate: start_date || null,
          reportingManager: reporting_manager || null,
          location: location || null,
          contractYears: time_period_years ?? null,
          contractMonths: time_period_months ?? null,
        });

        await sendOfferLetterEmail(
          c.email,
          c.full_name,
          job.title,
          resolvedCompany,
          pdfBytes.toString('base64'),
          acceptanceLink
        );

        // Update final_status to offer_sent in the analytics view via job_applications
        await supabase
          .from('job_applications')
          .update({
            final_status: 'offer_sent',
            notes: [
              `[Offer Letter Snapshot]`,
              `Company Name: ${resolvedCompany}`,
              `CTC: ${String(ctc).trim()}`,
              `Contract Years: ${time_period_years ?? ''}`,
              `Contract Months: ${time_period_months ?? ''}`,
              `Start Date: ${start_date || ''}`,
              `Reporting Manager: ${reporting_manager || ''}`,
              `Location: ${location || ''}`,
              `Attachment Format: PDF`,
            ].join('\n'),
            updated_at: new Date().toISOString(),
          })
          .eq('candidate_id', c.id)
          .eq('job_id', job_id);

        emailsSent++;
      } catch (e: any) {
        errorMessages.push(`${c.full_name}: ${e.message}`);
      }
    }

    return ok(res, {
      success: emailsSent > 0,
      emails_sent: emailsSent,
      error_messages: errorMessages,
    });
  }

  // GET /api/candidates/offer-details?token=...
  if (req.method === 'GET' && segments.length === 2 && segments[1] === 'offer-details') {
    const token = String(req.query.token || '');
    if (!token) return badRequest(res, 'token is required');

    try {
      const { candidate_id, job_id } = await verifyOfferToken(token);
      const { data: application } = await supabase
        .from('job_applications')
        .select('final_status, notes, offer_signature_name, offer_accepted_at, offer_acceptance_ip')
        .eq('candidate_id', candidate_id)
        .eq('job_id', job_id)
        .maybeSingle();
      if (!application) return notFound(res, 'Offer details not found');

      const { data: candidate } = await supabase
        .from('candidates')
        .select('full_name, email')
        .eq('id', candidate_id)
        .maybeSingle();
      const { data: job } = await supabase
        .from('job_descriptions')
        .select('title')
        .eq('id', job_id)
        .maybeSingle();
      if (!candidate || !job) return notFound(res, 'Offer details not found');

      const notes = String(application.notes || '');
      const extract = (prefix: string): string | null => {
        const line = notes.split('\n').find((entry) => entry.startsWith(prefix));
        return line ? line.replace(prefix, '').trim() || null : null;
      };

      const status = String(application.final_status || '');
      const alreadyAccepted = status === 'offer_accepted' || status === 'accepted';

      return ok(res, {
        candidate_id,
        job_id,
        candidate_name: candidate.full_name,
        candidate_email: candidate.email || null,
        job_title: job.title,
        company_name: extract('Company Name:') || 'Our Company',
        ctc: extract('CTC:') || 'As per attached offer letter',
        time_period_years: extract('Contract Years:') ? Number(extract('Contract Years:')) : null,
        time_period_months: extract('Contract Months:') ? Number(extract('Contract Months:')) : null,
        start_date: extract('Start Date:'),
        reporting_manager: extract('Reporting Manager:'),
        location: extract('Location:'),
        accepted_signature_name: application.offer_signature_name || null,
        accepted_at: application.offer_accepted_at || null,
        accepted_ip: application.offer_acceptance_ip || null,
        already_accepted: alreadyAccepted,
      });
    } catch {
      return res.status(400).json({ detail: 'Invalid or expired offer link' });
    }
  }

  // POST /api/candidates/submit-offer-acceptance
  if (req.method === 'POST' && segments.length === 2 && segments[1] === 'submit-offer-acceptance') {
    const { token, full_name_signature } = req.body as { token?: string; full_name_signature?: string };
    if (!token) return badRequest(res, 'token is required');
    if (!full_name_signature || !String(full_name_signature).trim()) {
      return badRequest(res, 'Full name signature is required to accept the offer');
    }

    try {
      const { candidate_id, job_id } = await verifyOfferToken(String(token));
      const { data: application } = await supabase
        .from('job_applications')
        .select('final_status, notes')
        .eq('candidate_id', candidate_id)
        .eq('job_id', job_id)
        .maybeSingle();
      if (!application) return notFound(res, 'Job application not found');

      if (application.final_status === 'offer_accepted') {
        return ok(res, { success: true, message: 'Offer already accepted', already_accepted: true });
      }
      if (!['offer_sent', 'accepted'].includes(String(application.final_status || ''))) {
        return badRequest(res, 'Offer is not currently open for acceptance');
      }

      const clientIp = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'Unknown IP').split(',')[0].trim();
      const signature = String(full_name_signature).trim();
      const timestampIso = new Date().toISOString();
      const existingNotes = String(application.notes || '').trim();
      const acceptanceNote = [
        '[Digital Offer Acceptance]',
        `Accepted at: ${new Date(timestampIso).toISOString().replace('T', ' ').replace('.000Z', ' UTC')}`,
        `IP Address: ${clientIp}`,
        `Digital Signature: ${signature}`,
      ].join('\n');

      const notes = [existingNotes, acceptanceNote].filter(Boolean).join('\n');
      await supabase
        .from('job_applications')
        .update({
          final_status: 'offer_accepted',
          notes,
          offer_signature_name: signature,
          offer_accepted_at: timestampIso,
          offer_acceptance_ip: clientIp,
          updated_at: timestampIso,
        })
        .eq('candidate_id', candidate_id)
        .eq('job_id', job_id);

      return ok(res, {
        success: true,
        message: 'Offer accepted successfully. Welcome aboard!',
        already_accepted: false,
      });
    } catch {
      return res.status(400).json({ detail: 'Invalid or expired acceptance link' });
    }
  }

  // POST /api/candidates/bulk-update-interview-mode
  // NOTE: Must be handled before /api/candidates/:id route
  if (req.method === 'POST' && segments.length === 2 && segments[1] === 'bulk-update-interview-mode') {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { candidate_ids, job_id, interview_mode } = req.body as { candidate_ids?: string[]; job_id?: string; interview_mode?: string };
    if (!candidate_ids?.length || !job_id || !interview_mode) return badRequest(res, 'candidate_ids, job_id, and interview_mode are required');

    if (interview_mode !== 'ai' && interview_mode !== 'manual') {
      return badRequest(res, 'interview_mode must be either "ai" or "manual"');
    }

    const { data: job } = await supabase.from('job_descriptions').select('id').eq('id', job_id).eq('created_by', user.id).single();
    if (!job) return notFound(res, 'Job not found or access denied');

    let updatedCount = 0;
    const errorMessages: string[] = [];

    for (const candidateId of candidate_ids) {
      try {
        // Check if job_application exists
        const { data: existingApp } = await supabase
          .from('job_applications')
          .select('id')
          .eq('candidate_id', candidateId)
          .eq('job_id', job_id)
          .maybeSingle();

        if (existingApp) {
          // Update existing application
          const { error } = await supabase
            .from('job_applications')
            .update({ 
              interview_mode,
              updated_at: new Date().toISOString()
            })
            .eq('candidate_id', candidateId)
            .eq('job_id', job_id);
          
          if (!error) updatedCount++;
          else errorMessages.push(`Candidate ${candidateId}: ${error.message}`);
        } else {
          // Create new job_application with interview_mode
          const { error } = await supabase
            .from('job_applications')
            .insert({
              candidate_id: candidateId,
              job_id: job_id,
              interview_mode,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          
          if (!error) updatedCount++;
          else errorMessages.push(`Candidate ${candidateId}: ${error.message}`);
        }
      } catch (e: any) {
        errorMessages.push(`Candidate ${candidateId}: ${e.message}`);
      }
    }

    return ok(res, { success: updatedCount > 0, updated_count: updatedCount, error_messages: errorMessages });
  }

  if (segments.length === 2) {
    const candidateId = segments[1];

    if (req.method === 'GET') {
      const user = await requireAuth(req, res);
      if (!user) return;

      const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .eq('id', candidateId)
        .single();

      if (error || !data) return notFound(res, 'Candidate not found');
      return ok(res, data);
    }

    if (req.method === 'PATCH') {
      const user = await requireAuth(req, res);
      if (!user) return;

      // Verify the candidate exists before updating
      const { data: existingCandidate } = await supabase
        .from('candidates')
        .select('id')
        .eq('id', candidateId)
        .maybeSingle();

      if (!existingCandidate) return notFound(res, 'Candidate not found');

      const { data, error } = await supabase
        .from('candidates')
        .update({ ...req.body, updated_at: new Date().toISOString() })
        .eq('id', candidateId)
        .select()
        .maybeSingle();

      if (error) return res.status(500).json({ error: error.message });
      if (!data) return notFound(res, 'Candidate not found');
      return ok(res, data);
    }

    if (req.method === 'DELETE') {
      const user = await requireAuth(req, res);
      if (!user) return;

      const scopedJobId = typeof req.query.job_id === 'string' ? req.query.job_id : undefined;

      if (scopedJobId) {
        // Verify the requested job belongs to the current user.
        const { data: job } = await supabase
          .from('job_descriptions')
          .select('id')
          .eq('id', scopedJobId)
          .eq('created_by', user.id)
          .single();

        if (!job) return notFound(res, 'Job not found or access denied');

        // Remove job-scoped records first.
        await Promise.all([
          supabase.from('job_applications').delete().eq('candidate_id', candidateId).eq('job_id', scopedJobId),
          supabase.from('ats_screenings').delete().eq('candidate_id', candidateId).eq('job_id', scopedJobId),
          supabase.from('assessment_sessions').delete().eq('candidate_id', candidateId).eq('job_id', scopedJobId),
          supabase.from('interview_sessions').delete().eq('candidate_id', candidateId).eq('job_id', scopedJobId),
          supabase.from('ai_interview_sessions').delete().eq('candidate_id', candidateId).eq('job_id', scopedJobId),
        ]);

        // Keep candidate if still associated with any other jobs.
        const { count: remainingAppsCount, error: appCountErr } = await supabase
          .from('job_applications')
          .select('id', { count: 'exact', head: true })
          .eq('candidate_id', candidateId);

        if (appCountErr) return res.status(500).json({ error: appCountErr.message });

        if ((remainingAppsCount || 0) === 0) {
          const { error: deleteCandidateErr } = await supabase
            .from('candidates')
            .delete()
            .eq('id', candidateId);
          if (deleteCandidateErr) return res.status(500).json({ error: deleteCandidateErr.message });
          return ok(res, { success: true, message: 'Candidate removed from this job and deleted (no other job associations).' });
        }

        return ok(res, { success: true, message: 'Candidate removed from this job only.' });
      }

      const { error } = await supabase.from('candidates').delete().eq('id', candidateId);
      if (error) return res.status(500).json({ error: error.message });
      return ok(res, { success: true, message: 'Candidate deleted successfully' });
    }

    return methodNotAllowed(res);
  }

  if (segments.length === 3 && segments[2] === 'parsed-resume') {
    const user = await requireAuth(req, res);
    if (!user) return;

    const candidateId = segments[1];
    if (req.method !== 'GET') return methodNotAllowed(res);

    const { data, error } = await supabase
      .from('candidates')
      .select('resume_parsed_data')
      .eq('id', candidateId)
      .single();

    if (error || !data) return notFound(res, 'Candidate not found');
    return ok(res, data.resume_parsed_data || null);
  }

  // POST /api/candidates/:id/upload-resume
  if (segments.length === 3 && segments[2] === 'upload-resume') {
    const user = await requireAuth(req, res);
    if (!user) return;

    const billingGate = await checkPlanAccess(supabase, user.id, 'resume_parse');
    if (!billingGate.allowed) {
      return res.status(billingGate.status || 402).json(billingGate);
    }

    const candidateId = segments[1];
    if (req.method !== 'POST') return methodNotAllowed(res);

    // Verify candidate exists
    const { data: existing, error: existErr } = await supabase
      .from('candidates')
      .select('id')
      .eq('id', candidateId)
      .single();
    if (existErr || !existing) return notFound(res, 'Candidate not found');

    try {
      const uploaded = await parseMultipartSingleFile(req, 'resume');
      if (!uploaded) return badRequest(res, 'Missing resume file');

      const resumeTextRaw = await extractResumeText(uploaded.buffer, uploaded.filename);
      const resumeText = String(resumeTextRaw)
        .replace(/\x00/g, '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
        .slice(0, 50000);

      // Save raw text immediately
      const { data: updated, error: upErr } = await supabase
        .from('candidates')
        .update({
          resume_text: resumeText,
          updated_at: new Date().toISOString(),
        })
        .eq('id', candidateId)
        .select()
        .single();
      
      if (upErr) return res.status(500).json({ error: upErr.message });

      // Parse resume with AI directly
      let parsedData: any = null;
      try {
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
        parsedData = await generateJSON<any>(prompt, { timeoutMs: 20000, maxTokens: 1200, temperature: 0.1 });
      } catch (parseErr: any) {
        console.error('Resume AI parsing failed:', parseErr?.message);
        // Continue without parsed data - just save raw text
      }

      // Update candidate with parsed data
      const { error: updateErr } = await supabase
        .from('candidates')
        .update({
          resume_parsed_data: parsedData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', candidateId);

      if (updateErr) return res.status(500).json({ error: updateErr.message });

      return ok(res, { success: true, parsed: !!parsedData, message: 'Resume processed successfully' });
    } catch (e: any) {
      return res.status(400).json({ error: e?.message || 'Failed to upload/parse resume' });
    }
  }

  // GET /api/candidates/:id/assessment-details?job_id=xxx
  if (segments.length === 3 && segments[2] === 'assessment-details') {
    const user = await requireAuth(req, res);
    if (!user) return;

    const candidateId = segments[1];
    const jobIdFilter = req.query.job_id as string | undefined;
    if (req.method !== 'GET') return methodNotAllowed(res);

    // Get assessment sessions for this candidate, scoped by job if provided
    let q = supabase
      .from('assessment_sessions')
      .select('*')
      .eq('candidate_id', candidateId);
    if (jobIdFilter) q = q.eq('job_id', jobIdFilter);
    const { data: sessions } = await q.order('created_at', { ascending: false });

    if (!sessions?.length) return ok(res, null);

    // Return the most recent completed session
    const completedSession = sessions.find((s: any) => s.status === 'completed') || sessions[0];

    return ok(res, {
      session_id: completedSession.id,
      job_id: completedSession.job_id,
      status: completedSession.status,
      mcq_score: completedSession.mcq_score,
      coding_score: completedSession.coding_score,
      total_score: completedSession.total_score,
      mcq_submissions: completedSession.mcq_submissions || [],
      coding_submissions: completedSession.coding_submissions || [],
      mcq_questions: completedSession.mcq_questions || [],
      coding_challenges: completedSession.coding_challenges || [],
      proctoring_data: completedSession.proctoring_data || {},
      started_at: completedSession.started_at,
      completed_at: completedSession.completed_at,
    });
  }

  // GET /api/candidates/:id/interview-details?job_id=xxx
  if (segments.length === 3 && segments[2] === 'interview-details') {
    const user = await requireAuth(req, res);
    if (!user) return;

    const candidateId = segments[1];
    const jobIdFilter = req.query.job_id as string | undefined;
    if (req.method !== 'GET') return methodNotAllowed(res);

    // Get AI interview sessions for this candidate, scoped by job if provided
    let q = supabase
      .from('ai_interview_sessions')
      .select('*')
      .eq('candidate_id', candidateId);
    if (jobIdFilter) q = q.eq('job_id', jobIdFilter);
    const { data: sessions } = await q.order('created_at', { ascending: false });

    if (!sessions?.length) return ok(res, null);

    // Return the most recent completed session
    const completedSession = sessions.find((s: any) => s.status === 'completed') || sessions[0];

    return ok(res, {
      session_id: completedSession.id,
      job_id: completedSession.job_id,
      status: completedSession.status,
      questions: completedSession.questions || [],
      responses: completedSession.responses || [],
      final_evaluation: completedSession.final_evaluation || null,
      proctoring_data: completedSession.proctoring_data || {},
      started_at: completedSession.started_at,
      completed_at: completedSession.completed_at,
    });
  }

  // GET/PATCH /api/candidates/:id/manual-interview?job_id=xxx
  if (segments.length === 3 && segments[2] === 'manual-interview') {
    const user = await requireAuth(req, res);
    if (!user) return;

    const candidateId = segments[1];
    const jobId = req.query.job_id as string | undefined;
    if (!jobId) return badRequest(res, 'job_id is required');

    // Ensure job belongs to this user
    const { data: job } = await supabase
      .from('job_descriptions')
      .select('id')
      .eq('id', jobId)
      .eq('created_by', user.id)
      .maybeSingle();
    if (!job) return notFound(res, 'Job not found or access denied');

    if (req.method === 'GET') {
      const { data: app, error } = await supabase
        .from('job_applications')
        .select('candidate_id, job_id, interview_mode, manual_interview_score, manual_interview_feedback, manual_interview_notes, manual_interview_at, manual_interview_entered_by, interview_status, interview_completed_at')
        .eq('candidate_id', candidateId)
        .eq('job_id', jobId)
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!app) return ok(res, null);
      return ok(res, app);
    }

    if (req.method === 'PATCH') {
      const body = req.body || {};
      const allowed: Record<string, any> = {};

      if (typeof body.interview_mode === 'string') allowed.interview_mode = body.interview_mode;
      if (body.manual_interview_score !== undefined) allowed.manual_interview_score = body.manual_interview_score;
      if (body.manual_interview_feedback !== undefined) allowed.manual_interview_feedback = body.manual_interview_feedback;
      if (body.manual_interview_notes !== undefined) allowed.manual_interview_notes = body.manual_interview_notes;

      // If switching to manual, mark timestamps and status unless caller overrides.
      const mode = String(body.interview_mode || 'manual');
      if (mode === 'manual') {
        if (!('manual_interview_at' in body)) {
          allowed.manual_interview_at = new Date().toISOString();
        } else {
          allowed.manual_interview_at = body.manual_interview_at;
        }
        allowed.manual_interview_entered_by = user.id;
        if (body.interview_status !== undefined) allowed.interview_status = body.interview_status;
        else allowed.interview_status = 'completed';
        if (body.interview_completed_at !== undefined) allowed.interview_completed_at = body.interview_completed_at;
        else allowed.interview_completed_at = new Date().toISOString();
      }

      allowed.updated_at = new Date().toISOString();

      const { data: updated, error } = await supabase
        .from('job_applications')
        .update(allowed)
        .eq('candidate_id', candidateId)
        .eq('job_id', jobId)
        .select('candidate_id, job_id, interview_mode, manual_interview_score, manual_interview_feedback, manual_interview_notes, manual_interview_at, manual_interview_entered_by, interview_status, interview_completed_at')
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!updated) return notFound(res, 'Application not found');
      return ok(res, updated);
    }

    return methodNotAllowed(res);
  }

  return notFound(res);
}
