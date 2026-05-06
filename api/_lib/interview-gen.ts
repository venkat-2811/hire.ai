/**
 * Interview question generation — pool, individual, candidate-personalized.
 * Extracted verbatim from api/[...path].ts — lines 5728-6249.
 */
import { generateJSON } from './openai';

// ── Normalize ─────────────────────────────────────────────────────────────────

export function normalizeInterviewQuestions(raw: any): { text: string; type: string; duration: number }[] {
  let parsed = raw;

  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed) && parsed && Array.isArray(parsed.questions)) {
    parsed = parsed.questions;
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((q: any) => q?.text && q?.type)
    .map((q: any) => ({
      text: String(q.text),
      type: String(q.type),
      duration: Number(q.duration) || 120,
    }));
}

// ── Standard interview questions ──────────────────────────────────────────────

export async function generateInterviewQuestions(job: { title: string; role: string; level: string; must_have_skills?: string[] }) {
  try {
    const skills = (job.must_have_skills || []).join(', ') || 'General';
    const prompt = `You are an expert technical interviewer. Generate exactly 5 high-quality, completely independent interview questions for a ${job.level} ${job.role} position (${job.title}).
Required skills: ${skills}.

=== ABSOLUTE RULES ===
1. INDEPENDENCE (MOST IMPORTANT): Every question MUST be completely self-contained and standalone.
   NEVER reference other questions, prior answers, or use phrases like "Following up...", "Similarly...", "Also...", "What about..."
   Each question is asked in isolation — the candidate sees only that one question at a time.
2. NO REPETITION: Each question covers a completely different skill, concept, or competency.
3. BROAD COVERAGE: Distribute questions across multiple skills from: ${skills}
4. COMPLETE CONTEXT: Each question provides all necessary context within itself.

Create a balanced mix:
- 2 technical questions: each testing a DIFFERENT specific skill from: ${skills}
- 2 behavioral questions: each assessing a DIFFERENT professional competency (leadership, teamwork, communication, adaptability, etc.)
- 1 situational question: a realistic work scenario specific to the ${job.role} role

Return JSON array ONLY — each question must be fully standalone:
[{"text": "<complete, self-contained question with all necessary context>", "type": "technical|behavioral|situational", "duration": <seconds 90-180>}]`;
    const raw = await Promise.race<any>([
      generateJSON<any>(prompt),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
    ]);
    const valid = normalizeInterviewQuestions(raw).slice(0, 5);
    if (valid.length < 5) {
      throw new Error(`Generated only ${valid.length} interview questions`);
    }
    return valid;
  } catch {
    const fallback = [
      { text: `Walk me through your most relevant technical experience for the ${job.role} role, including specific technologies and what you built or contributed to.`, type: 'technical', duration: 150 },
      { text: `Describe a situation in a previous role where you had to solve a complex technical problem under constraints. What was the problem, your approach, and the outcome?`, type: 'behavioral', duration: 150 },
      { text: `Tell me about a project where you had to collaborate with a cross-functional team to meet a tight deadline. How did you manage your responsibilities and communication?`, type: 'behavioral', duration: 120 },
      { text: `You discover a critical data inconsistency in your system 2 hours before a major client demo. Walk me through exactly what steps you would take.`, type: 'situational', duration: 120 },
      { text: `What are the most important technical skills you bring to the ${job.title} position, and describe a concrete example where you applied one of these skills to deliver business value?`, type: 'technical', duration: 120 },
    ];
    return normalizeInterviewQuestions(fallback).slice(0, 5);
  }
}

// ── Candidate-personalized interview questions ────────────────────────────────

export async function generateCandidateInterviewQuestions(
  job: { title: string; role: string; level: string; must_have_skills?: string[]; description?: string },
  candidate: { full_name?: string; resume_parsed_data?: any },
  count: number
): Promise<{ text: string; type: string; duration: number }[]> {
  const skills = (job.must_have_skills || []).join(', ') || 'General';
  const resume = candidate.resume_parsed_data || {};

  // Extract useful resume signals for context
  const candidateSkills = Array.isArray(resume.skills) ? resume.skills.slice(0, 12).join(', ') : '';
  const projectsText = Array.isArray(resume.projects)
    ? resume.projects
        .slice(0, 4)
        .map((p: any) => {
          const name = p?.name || p?.title || '';
          const tech = Array.isArray(p?.technologies) ? p.technologies.join(', ') : (p?.tech_stack || '');
          const desc = (p?.description || p?.summary || '').toString().slice(0, 180);
          return [name, tech ? `(${tech})` : '', desc].filter(Boolean).join(' ');
        })
        .filter(Boolean)
        .join('; ')
    : typeof resume.projects === 'string' ? resume.projects.slice(0, 500) : '';
  const certificationsText = Array.isArray(resume.certifications)
    ? resume.certifications
        .slice(0, 6)
        .map((c: any) => (c?.name || c?.title || c)?.toString())
        .filter(Boolean)
        .join(', ')
    : typeof resume.certifications === 'string' ? resume.certifications.slice(0, 300) : '';
  const experienceYearsRaw = (resume.total_experience_years ?? resume.experience_years ?? resume.years_experience);
  const experienceYears = typeof experienceYearsRaw === 'number' ? experienceYearsRaw : Number(experienceYearsRaw || 0);
  const candidateExperience = Array.isArray(resume.experience)
    ? resume.experience.slice(0, 3).map((e: any) => `${e.title || e.role || ''} at ${e.company || ''} (${e.duration || ''})`).join('; ')
    : typeof resume.experience === 'string' ? resume.experience.slice(0, 400) : '';
  const candidateEducation = Array.isArray(resume.education)
    ? resume.education.slice(0, 2).map((e: any) => `${e.degree || ''} in ${e.field || e.major || ''} from ${e.institution || ''}`).join('; ')
    : typeof resume.education === 'string' ? resume.education.slice(0, 200) : '';
  const summary = typeof resume.summary === 'string' ? resume.summary.slice(0, 300) : '';

  const hasResume = candidateSkills || candidateExperience;
  const candidateName = candidate.full_name || 'the candidate';

  const experienceLevel = experienceYears >= 5 ? 'experienced' : experienceYears >= 2 ? 'mid' : 'fresher';

  const prompt = `You are a senior technical interviewer running a natural, role-specific, resume-grounded interview.
Generate exactly ${count} personalized interview questions for ${candidateName} applying for a ${job.level} ${job.role} position (${job.title}).

## JOB REQUIREMENTS
Required Skills: ${skills}
Job Context: ${(job.description || '').slice(0, 400)}

## CANDIDATE PROFILE
${candidateSkills ? `Skills on Resume: ${candidateSkills}` : ''}
${candidateExperience ? `Work Experience: ${candidateExperience}` : ''}
${projectsText ? `Projects: ${projectsText}` : ''}
${certificationsText ? `Certifications: ${certificationsText}` : ''}
${candidateEducation ? `Education: ${candidateEducation}` : ''}
${summary ? `Profile Summary: ${summary}` : ''}
${Number.isFinite(experienceYears) && experienceYears > 0 ? `Estimated Experience: ${experienceYears} years` : ''}

## INTERVIEW STYLE
- Ask questions like a real interviewer: concise, precise, and anchored to the candidate's background.
- Prefer project/experience-based questions that probe: contributions, architecture decisions, trade-offs, tooling, debugging, failures, learnings, and measurable impact.
- Questions must be verbal and discussion-based. Do NOT ask for code to be written.

## EXPERIENCE CALIBRATION
- Candidate seniority signal: ${experienceLevel}
- If fresher: emphasize fundamentals, projects, learning ability, debugging approach, and basic system concepts.
- If mid/experienced: emphasize system design, scalability, reliability, production incidents, observability, security, performance, and cross-team collaboration.

## ABSOLUTE RULES (CRITICAL):
1. INDEPENDENCE: Every question MUST be completely self-contained and standalone. Do NOT reference prior questions or prior answers.
2. NO REPETITION: Each question MUST focus on a different competency/area; avoid overlap.
3. COMPLETE CONTEXT: Every question must include enough context to be understood in isolation.
4. VERBAL-ONLY: Do not ask the candidate to write code, SQL, or pseudo-code.

## PERSONALIZATION RULES:
5. Use the resume content to generate questions tied to their projects, roles, and tools. Ask for concrete examples and decision reasoning.
6. Include at least 2 project-related questions (if projects exist) probing architecture choices, challenges, and what the candidate personally built.
7. Probe skill gaps: if a must-have skill is missing from the resume, ask how they would ramp up and apply it in this role.

## QUESTION MIX (for ${count} questions):
- ${Math.ceil(count * 0.4)} technical questions: each probing a DIFFERENT skill from: ${skills}
- ${Math.ceil(count * 0.35)} behavioral questions: STAR-format, each assessing a DIFFERENT competency (leadership, teamwork, communication, adaptability, conflict resolution, time management)
- ${Math.floor(count * 0.25)} situational questions: hypothetical but role-realistic scenarios, each presenting a unique challenge

## FORMAT:
Return ONLY a JSON array — every question must be fully standalone and self-explanatory:
[{"text": "<complete, self-contained question with all necessary context>", "type": "technical|behavioral|situational", "duration": <seconds 90-180>}]`;

  try {
    const raw = await Promise.race<any>([
      generateJSON<any>(prompt, { maxTokens: Math.min(8192, 1024 + count * 200), temperature: 0.6 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Interview question generation timed out')), 20000)),
    ]);
    const questions = Array.isArray(raw) ? raw : (Array.isArray(raw?.questions) ? raw.questions : []);
    const valid = questions
      .filter((q: any) => q?.text && q?.type)
      .map((q: any) => ({ text: String(q.text), type: String(q.type), duration: Number(q.duration) || 120 }))
      .slice(0, count);
    if (valid.length >= Math.max(1, Math.floor(count * 0.6))) return valid;
    // If AI returned too few, fall back
    throw new Error(`Too few questions returned: ${valid.length}`);
  } catch (e: any) {
    console.error('[generateCandidateInterviewQuestions] failed, using fallback:', e.message);
    const fallbackFive = await generateInterviewQuestions(job);
    const safeFallback = normalizeInterviewQuestions(fallbackFive);
    if (!safeFallback.length) {
      return [];
    }

    const expanded: { text: string; type: string; duration: number }[] = [];
    while (expanded.length < count) {
      expanded.push(safeFallback[expanded.length % safeFallback.length]);
    }
    return expanded.slice(0, count);
  }
}

// ── Question pool generation ──────────────────────────────────────────────────

export async function generateInterviewQuestionPool(job: { title: string; role: string; level: string; must_have_skills: string[]; description: string }) {
  const skills = job.must_have_skills.join(', ') || 'General';
  const prompt = `You are an expert technical interviewer. Generate exactly 20 diverse, high-quality, completely independent interview questions for a ${job.level} ${job.role} position (${job.title}).

Required Skills: ${skills}
${job.description ? `Job Context: ${job.description.slice(0, 500)}` : ''}

=== ABSOLUTE RULES ===

1. INDEPENDENCE (MOST IMPORTANT):
   Every question MUST be completely self-contained and standalone.
   NEVER reference other questions, prior answers, or use phrases like:
   "Following up...", "As mentioned...", "Similarly...", "Also...", "What about..."
   Each question is asked in complete isolation. A candidate could answer question 15 without seeing questions 1-14.

2. NO REPETITION:
   Each of the 20 questions MUST cover a completely different skill, technology, concept, or competency.
   Absolutely zero overlap. Never ask two questions about the same topic.

3. BROAD SKILL COVERAGE:
   Distribute technical questions evenly across ALL required skills: ${skills}
   Do NOT cluster multiple questions on the same technology.

4. COMPLETE CONTEXT:
   Every question must provide all necessary context within itself.
   Never assume the candidate has heard prior context.

5. ${job.level.toUpperCase()} LEVEL APPROPRIATE:
   Calibrate question complexity to match ${job.level} expectations.

Create this balanced mix:
- 9 technical questions: each testing a DIFFERENT skill from: ${skills} — cover all skills evenly
- 6 behavioral questions: STAR-format, each assessing a DIFFERENT competency:
  (leadership, teamwork, communication, adaptability, conflict resolution, time management)
- 5 situational questions: unique realistic work scenarios, each presenting a different type of challenge

Return ONLY a JSON array — every question must be fully standalone and self-explanatory:
[{"text": "<complete, self-contained question with all necessary context>", "type": "technical|behavioral|situational", "duration": <seconds 90-180>}]`;

  try {
    const raw = await Promise.race<any>([
      generateJSON<any>(prompt, { maxTokens: 8192, temperature: 0.6 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Pool generation timed out')), 20000)),
    ]);
    const questions = Array.isArray(raw) ? raw : Array.isArray(raw?.questions) ? raw.questions : [];
    return questions
      .filter((q: any) => q?.text && q?.type)
      .map((q: any) => ({
        text: String(q.text),
        type: String(q.type),
        duration: typeof q.duration === 'number' ? q.duration : 120,
      }))
      .slice(0, 20);
  } catch (e: any) {
    console.error('[generateInterviewQuestionPool] failed:', e.message);
    return [];
  }
}
