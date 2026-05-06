/**
 * Interview question generation — pool, individual, candidate-personalized.
 * Extracted verbatim from api/[...path].ts — lines 5728-6249.
 */
import { generateJSON } from './openai';

 function buildUniquenessSeed(): string {
   return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
 }

 function looksLikeCodingPrompt(text: string): boolean {
   if (!text) return false;
   return /(write\s+(a\s+)?function|implement\s+(an\s+)?algorithm|write\s+code|code\s+for|provide\s+(the\s+)?syntax|solve\s+(this\s+)?problem|leetcode|dsa|big[-\s]?o|time\s+complexity|space\s+complexity)/i.test(text);
 }

 function normalizeList(value: unknown, max: number): string[] {
   if (!Array.isArray(value)) return [];
   return value
     .map((v) => String(v || '').trim())
     .filter(Boolean)
     .slice(0, max);
 }

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
  job: { title: string; role: string; level: string; must_have_skills?: string[]; good_to_have_skills?: string[]; description?: string },
  candidate: { full_name?: string; resume_parsed_data?: any },
  count: number
): Promise<{ text: string; type: string; duration: number }[]> {
  const mustHave = (job.must_have_skills || []).map(String).filter(Boolean);
  const goodToHave = (job.good_to_have_skills || []).map(String).filter(Boolean);
  const resume = candidate.resume_parsed_data || {};

  // Extract useful resume signals for context
  const candidateSkills = Array.isArray(resume.skills) ? resume.skills.slice(0, 12).join(', ') : '';
  const candidateExperience = Array.isArray(resume.experience)
    ? resume.experience.slice(0, 3).map((e: any) => `${e.title || e.role || ''} at ${e.company || ''} (${e.duration || ''})`).join('; ')
    : typeof resume.experience === 'string' ? resume.experience.slice(0, 400) : '';
  const candidateEducation = Array.isArray(resume.education)
    ? resume.education.slice(0, 2).map((e: any) => `${e.degree || ''} in ${e.field || e.major || ''} from ${e.institution || ''}`).join('; ')
    : typeof resume.education === 'string' ? resume.education.slice(0, 200) : '';
  const summary = typeof resume.summary === 'string' ? resume.summary.slice(0, 300) : '';

  const resumeSkillsList = normalizeList(resume.skills, 25);
  const resumeToolsList = normalizeList((resume as any).tools, 25);
  const resumeFrameworksList = normalizeList((resume as any).frameworks, 25);
  const resumeTech = Array.from(new Set([...resumeSkillsList, ...resumeToolsList, ...resumeFrameworksList]))
    .slice(0, 30);

  const overlap = resumeTech
    .filter((s) => {
      const ss = s.toLowerCase();
      return mustHave.some((m) => m.toLowerCase() === ss) || goodToHave.some((g) => g.toLowerCase() === ss);
    })
    .slice(0, 15);

  const candidateExpYearsRaw = Number((resume as any)?.total_experience_years);
  const candidateExpYears = Number.isFinite(candidateExpYearsRaw) ? candidateExpYearsRaw : undefined;
  const resumeQualityScore = (
    (resumeTech.length ? 1 : 0) +
    (candidateExperience ? 1 : 0) +
    (summary ? 1 : 0)
  );

  const hasResume = candidateSkills || candidateExperience;
  const candidateName = candidate.full_name || 'the candidate';

  const seed = buildUniquenessSeed();

  const roleSpecializationHints = (() => {
    const r = String(job.role || '').toLowerCase();
    if (/(frontend|ui|react|angular|vue)/i.test(r)) {
      return 'Frontend interview focus: UI architecture, state management, performance, accessibility, responsiveness, component design, testing.';
    }
    if (/(backend|api|server|node|java|python|dotnet)/i.test(r)) {
      return 'Backend interview focus: API design, authentication/authorization, databases, scalability, observability, reliability, caching, distributed systems.';
    }
    if (/(salesforce|apex|crm)/i.test(r)) {
      return 'Salesforce interview focus: Apex, triggers, flows, SOQL, governor limits, bulkification, sharing/security model, integrations.';
    }
    if (/(ml|ai|data|machine learning|nlp)/i.test(r)) {
      return 'AI/ML interview focus: model selection, training/evaluation, datasets, leakage, metrics, deployment, monitoring, trade-offs.';
    }
    if (/(qa|test)/i.test(r)) {
      return 'QA interview focus: test strategy, automation, debugging, flaky tests, coverage, CI, non-functional testing.';
    }
    return 'General interview focus: role responsibilities, problem-solving, collaboration, and communication.';
  })();

  const targetDifficultyGuidance = (() => {
    // Dynamic difficulty guidance (LLM decides per question, but we steer).
    // Use job level + resume strength as hints.
    const lvl = String(job.level || '').toLowerCase();
    const isJunior = /(intern|junior|entry)/i.test(lvl);
    const isSenior = /(senior|lead|staff|principal)/i.test(lvl);
    if (isJunior) return 'Difficulty: mostly basic conceptual + simple project discussions.';
    if (isSenior) return 'Difficulty: advanced scenario/architecture trade-offs + leadership/ownership discussions.';
    if (candidateExpYears != null) {
      if (candidateExpYears < 2) return 'Difficulty: mostly basic conceptual + project walkthrough questions.';
      if (candidateExpYears > 6) return 'Difficulty: advanced scenario/architecture + optimization and decision-making questions.';
    }
    return 'Difficulty: medium — implementation discussions and trade-offs without asking for code.';
  })();

  const prompt = `You are an expert interviewer conducting a REAL-TIME, verbal (audio) AI interview.

Generate exactly ${count} personalized, non-repetitive questions for ${candidateName} applying for a ${job.level} ${job.role} position (${job.title}).

This must feel like a natural HR + technical conversation. Questions should be concise and human-like.

Uniqueness seed: ${seed}

## JOB REQUIREMENTS (50% weight)
Job Description: ${(job.description || '').slice(0, 700)}
Must-Have Skills: ${(mustHave || []).join(', ') || 'N/A'}
Good-to-Have Skills: ${(goodToHave || []).join(', ') || 'N/A'}

## CANDIDATE RESUME (50% weight)
${candidateSkills ? `Skills on Resume: ${candidateSkills}` : ''}
${candidateExperience ? `Work Experience: ${candidateExperience}` : ''}
${candidateEducation ? `Education: ${candidateEducation}` : ''}
${summary ? `Profile Summary: ${summary}` : ''}
${candidateExpYears != null ? `Estimated Experience: ${candidateExpYears} years` : ''}

## RESUME + JD MATCHING (CRITICAL)
Identify overlapping technologies/skills/tools/frameworks between resume and job requirements.
Overlapping skills (detected by system; still verify): ${overlap.length ? overlap.join(', ') : 'None found'}

Ask primarily about the overlap. If overlap is small, ask about the MOST relevant resume projects/experience AND how they will ramp up on must-haves.

## ROLE SPECIALIZATION
${roleSpecializationHints}

## DIFFICULTY ADAPTATION
${targetDifficultyGuidance}
Resume quality signal (0-3): ${resumeQualityScore}

## ABSOLUTE RULES (CRITICAL):
1. INDEPENDENCE: Every question MUST be completely self-contained and standalone.
   NEVER reference prior questions, prior answers, or use linking phrases like:
   "Following up on that...", "As you mentioned...", "Similarly...", "Also...", "What about..."
   Each question is asked in isolation — the candidate sees only ONE question at a time.
2. NO REPETITION: Each of the ${count} questions MUST cover a different skill, technology, or competency. Absolutely zero overlap.
3. COMPLETE CONTEXT: Every question must include all necessary context within itself to be fully understood without any prior discussion.
4. OVERLAP-FIRST: Questions must primarily focus on overlapping skills between resume and JD.
5. VERBAL / DISCUSSION ONLY: Do NOT ask for writing code, functions, SQL, syntax, algorithms, or puzzles.
   Forbidden patterns include: "Write a function", "Implement an algorithm", "Write code", "Solve this", "Big-O".
   Instead ask: experience, reasoning, trade-offs, design decisions, debugging approach, incidents, collaboration.

## PERSONALIZATION RULES:
6. Cross-reference the candidate's resume with job requirements — ask about relevant experience and specifics from their projects.
7. ${hasResume ? 'Reference resume projects/experience naturally ("In your project X..."), but keep each question standalone.' : 'Use the job requirements to craft highly role-specific questions.'}
8. If a must-have skill is missing from the resume, ask how they would approach learning/ramping up (discussion-only).

## QUESTION MIX (for ${count} questions):
Return a blended mix of:
- Technical discussion questions (experience + reasoning; overlap-first)
- Experience/project deep-dives ("walk me through", "what trade-offs")
- Situational/behavioral questions relevant to the role and seniority

## FORMAT:
Return ONLY a JSON array (no extra keys, no prose):
[{"text": "...", "type": "technical|behavioral|situational", "duration": 90-180}]`;

  try {
    const raw = await Promise.race<any>([
      generateJSON<any>(prompt, { maxTokens: Math.min(8192, 1200 + count * 260), temperature: 0.85 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Interview question generation timed out')), 20000)),
    ]);
    const questions = Array.isArray(raw) ? raw : (Array.isArray(raw?.questions) ? raw.questions : []);
    const valid = questions
      .filter((q: any) => q?.text && q?.type)
      .map((q: any) => ({ text: String(q.text), type: String(q.type), duration: Number(q.duration) || 120 }))
      .filter((q: any) => !looksLikeCodingPrompt(String(q.text)))
      .slice(0, count);
    if (valid.length >= Math.max(1, Math.floor(count * 0.8))) return valid;
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
