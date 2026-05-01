/**
 * Apply route handler (public).
 * GET  /api/apply/job/:jobId
 * POST /api/apply/submit
 * Extracted verbatim from api/[...path].ts — lines 5476-5722.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../_lib/supabase';
import { ok, badRequest, notFound, methodNotAllowed } from '../_lib/helpers';
import { generateJSON } from '../_lib/openai';
import { extractResumeText } from '../_lib/resume-parser';
import { sendApplicationReceived } from '../_lib/offer-utils';
import { v4 as uuidv4 } from 'uuid';
import Busboy from 'busboy';

export default async function handleApply(req: VercelRequest, res: VercelResponse, segments: string[]) {
  const supabase = getSupabaseAdmin();

  // GET /api/apply/job/:jobId - Public job details
  if (segments.length === 3 && segments[1] === 'job') {
    if (req.method !== 'GET') return methodNotAllowed(res);

    const jobId = segments[2];
    const { data: job, error } = await supabase
      .from('job_descriptions')
      .select('id, title, role, level, description, must_have_skills, good_to_have_skills, min_experience_years, is_active')
      .eq('id', jobId)
      .eq('is_active', true)
      .single();

    if (error || !job) return notFound(res, 'Job not found or no longer accepting applications');
    return ok(res, job);
  }

  // POST /api/apply/submit - Submit job application (multipart form)
  if (segments.length === 2 && segments[1] === 'submit') {
    if (req.method !== 'POST') return methodNotAllowed(res);

    // Parse multipart form data
    const fields: Record<string, string> = {};
    let resumeFile: { filename: string; mimeType: string; buffer: Buffer } | null = null;

    await new Promise<void>((resolve, reject) => {
      const ct = req.headers['content-type'] || '';
      if (!ct.includes('multipart/form-data')) {
        // JSON body fallback
        const body = req.body || {};
        Object.entries(body).forEach(([k, v]) => { fields[k] = String(v); });
        resolve();
        return;
      }

      const bb = Busboy({ headers: req.headers as any });
      bb.on('field', (name: string, val: string) => { fields[name] = val; });
      bb.on('file', (name: string, file: any, info: any) => {
        if (name === 'resume') {
          const chunks: Buffer[] = [];
          file.on('data', (d: Buffer) => chunks.push(Buffer.from(d)));
          file.on('end', () => {
            resumeFile = {
              filename: info.filename || 'resume.pdf',
              mimeType: info.mimeType || 'application/octet-stream',
              buffer: Buffer.concat(chunks),
            };
          });
        } else {
          file.resume();
        }
      });
      bb.on('finish', () => resolve());
      bb.on('error', (err: Error) => reject(err));
      req.pipe(bb);
    });

    const jobId = fields.job_id;
    const fullName = fields.full_name;
    const email = fields.email;
    const phone = fields.phone || null;
    const portfolioUrl = fields.portfolio_url || null;
    const githubUrl = fields.github_url || null;
    const location = fields.location || null;
    const vendorName = fields.vendorName || null;
    const mainSkillset = fields.mainSkillset || null;
    const consentGiven = fields.consent_given === 'true';

    if (!jobId || !fullName || !email) {
      return badRequest(res, 'job_id, full_name, and email are required');
    }

    if (!consentGiven) {
      return badRequest(res, 'Consent is required to submit application');
    }

    // Verify job exists and is active
    const { data: job } = await supabase
      .from('job_descriptions')
      .select('*')
      .eq('id', jobId)
      .eq('is_active', true)
      .single();

    if (!job) return notFound(res, 'Job not found or no longer accepting applications');

    // Check if candidate already exists
    const { data: existingCandidates } = await supabase
      .from('candidates')
      .select('id')
      .eq('email', email)
      .limit(1);

    let candidateId: string;

    if (existingCandidates && existingCandidates.length > 0) {
      candidateId = existingCandidates[0].id;

      // Check if already applied to this job
      const { data: existingApp } = await supabase
        .from('job_applications')
        .select('id')
        .eq('candidate_id', candidateId)
        .eq('job_id', jobId)
        .limit(1);

      if (existingApp && existingApp.length > 0) {
        return badRequest(res, 'You have already applied to this job');
      }

      // Update candidate info
      await supabase
        .from('candidates')
        .update({
          full_name: fullName,
          phone,
          portfolio_url: portfolioUrl,
          github_url: githubUrl,
          location,
          vendorName,
          mainSkillset,
          consent_given: consentGiven,
          consent_timestamp: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', candidateId);
    } else {
      // Create new candidate
      const candidateData: Record<string, any> = {
        full_name: fullName,
        email,
        phone,
        portfolio_url: portfolioUrl,
        github_url: githubUrl,
        location,
        vendorName,
        mainSkillset,
        consent_given: consentGiven,
        consent_timestamp: new Date().toISOString(),
      };

      const { data: newCandidate, error: createErr } = await supabase
        .from('candidates')
        .insert(candidateData)
        .select()
        .single();

      if (createErr || !newCandidate) {
        return res.status(500).json({ error: createErr?.message || 'Failed to create candidate' });
      }
      candidateId = newCandidate.id;
    }

    // Handle resume upload
    let resumeParsedData: any = null;
    let resumeText = '';
    if (resumeFile) {
      try {
        const uploadedResume = resumeFile as { filename: string; mimeType: string; buffer: Buffer };
        const rawText = await extractResumeText(uploadedResume.buffer, uploadedResume.filename);
        resumeText = String(rawText)
          .replace(/\x00/g, '')
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
          .slice(0, 50000);

        // Parse with AI
        try {
          const prompt = \`You are an expert resume parser.\n\nParse the following resume and return ONLY valid JSON in this exact format:\n{\n  "skills": ["skill1"],\n  "experience": [{"title":"","company":"","duration":"","description":""}],\n  "education": [{"degree":"","institution":"","year":""}],\n  "summary": "",\n  "total_experience_years": 0,\n  "certifications": ["cert1"]\n}\n\nRESUME TEXT:\n\${resumeText.slice(0, 8000)}\`;
          resumeParsedData = await generateJSON<any>(prompt);
        } catch (err: any) {
          console.error('Resume AI parsing failed during application (will save raw text anyway):', err?.message);
          resumeParsedData = null;
        }

        // Update candidate with resume data
        await supabase
          .from('candidates')
          .update({
            resume_text: resumeText,
            resume_parsed_data: resumeParsedData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', candidateId);
      } catch (e: any) {
        console.error('Resume parsing error during apply:', e?.message);
      }
    }

    // Create job application
    const applicationId = uuidv4();
    const { error: appError } = await supabase
      .from('job_applications')
      .insert({
        id: applicationId,
        candidate_id: candidateId,
        job_id: jobId,
        status: 'applied',
        applied_at: new Date().toISOString(),
      });

    if (appError) {
      return res.status(500).json({ error: appError.message });
    }

    // Run ATS screening if resume was parsed
    if (resumeParsedData) {
      try {
        const prompt = \`Analyze this candidate's resume against the job requirements and provide ATS screening scores.\n\nJob: \${job.title} (\${job.role}, \${job.level})\nRequired Skills: \${(job.must_have_skills || []).join(', ')}\nNice-to-have Skills: \${(job.good_to_have_skills || []).join(', ')}\nMin Experience: \${job.min_experience_years} years\n\nCandidate Resume JSON:\n\${JSON.stringify(resumeParsedData)}\n\nReturn JSON:\n{\n  "overall_score": 0-100,\n  "skill_relevance_score": 0-100,\n  "experience_score": 0-100,\n  "education_score": 0-100,\n  "credibility_score": 0-100,\n  "shortlisted": true/false,\n  "shortlist_reason": "...",\n  "reason_codes": [{"code":"SKILL_MATCH","type":"positive","description":"...","impact":10}]\n}\`;
        const screeningResult = await generateJSON<any>(prompt);

        await supabase.from('ats_screenings').insert({
          candidate_id: candidateId,
          job_id: jobId,
          overall_score: screeningResult.overall_score,
          skill_relevance_score: screeningResult.skill_relevance_score ?? null,
          experience_score: screeningResult.experience_score ?? null,
          education_score: screeningResult.education_score ?? null,
          credibility_score: screeningResult.credibility_score ?? null,
          shortlisted: !!screeningResult.shortlisted,
          shortlist_reason: screeningResult.shortlist_reason ?? null,
          reason_codes: screeningResult.reason_codes ?? [],
          screened_at: new Date().toISOString(),
        });
      } catch (e: any) {
        console.error('ATS screening error during apply:', e?.message);
      }
    }

    // Send confirmation email
    try {
      await sendApplicationReceived(email, fullName, job.title);
    } catch (e: any) {
      console.error('Failed to send confirmation email:', e?.message);
    }

    return ok(res, {
      id: applicationId,
      job_id: jobId,
      candidate_id: candidateId,
      status: 'applied',
      message: \`Application submitted successfully for \${job.title}. Check your email for confirmation.\`,
    }, 201);
  }

  return notFound(res);
}
