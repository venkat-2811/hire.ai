/**
 * MCQ generation, shuffling, deduplication, and assessment difficulty mapping.
 * Extracted verbatim from api/[...path].ts — lines 137-427.
 */
import crypto from 'node:crypto';
import { generateJSON } from './openai';
import { isSalesforceRole } from './salesforce';

// ── Difficulty mapping ────────────────────────────────────────────────────────

export function mapAssessmentDifficulty(difficulty: string): { label: string; guidance: string } {
  const d = String(difficulty || '').toLowerCase();

  if (d === 'easy') {
    return {
      label: 'Medium-to-Hard',
      guidance: 'Target difficulty: medium-to-hard. Avoid trivial questions. Include real-world pitfalls and at least a few advanced edge cases.'
    };
  }

  if (d === 'medium') {
    return {
      label: 'Very Hard',
      guidance: 'Target difficulty: very hard. Include advanced concepts, tricky edge cases, and tradeoffs. Questions should require deep reasoning.'
    };
  }

  if (d === 'hard') {
    return {
      label: 'FAANG-Level (Very, Very Hard)',
      guidance: 'Target difficulty: very, very hard (FAANG-level). Expect senior-level depth, nuanced constraints, and multiple failure modes. Prioritize high-signal questions.'
    };
  }

  return {
    label: 'Very Hard',
    guidance: 'Target difficulty: very hard. Include advanced concepts, tricky edge cases, and tradeoffs. Questions should require deep reasoning.'
  };
}

// ── Shuffle helpers ───────────────────────────────────────────────────────────

/**
 * Fisher-Yates shuffle of an array (in-place, returns the same array).
 */
function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Randomly shuffle the 4 MCQ options and update correct_index to match.
 * This is the ONLY reliable way to distribute correct answers — LLMs
 * have an overwhelming bias toward placing the correct answer at index 0.
 */
export function shuffleMcqOptions(q: any): any {
  if (!Array.isArray(q.options) || q.options.length !== 4) return q;
  const correctAnswer = q.options[q.correct_index as number];
  const shuffled = shuffleArray([...q.options]);
  return {
    ...q,
    options: shuffled,
    correct_index: shuffled.indexOf(correctAnswer),
  };
}

/**
 * Derive a short topic fingerprint from question text for near-duplicate detection.
 * Strips common stop-words and normalises the first ~60 characters.
 */
function topicFingerprint(text: string): string {
  const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'can', 'shall', 'to', 'of', 'in',
    'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
    'about', 'against', 'between', 'out', 'up', 'down', 'your', 'this',
    'that', 'which', 'what', 'when', 'where', 'how', 'why', 'if', 'or',
    'and', 'but', 'not', 'no', 'so', 'than', 'then', 'its', 'it', 'you',
  ]);
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
    .slice(0, 8);
  return words.join(' ');
}

// ── Option label stripping ────────────────────────────────────────────────────

// Strip leading "A." / "A)" / "A -" style labels from option text — LLMs often
// include them even though we render the options without labels in the UI.
const stripOptionLabel = (text: string): string => {
  // Matches patterns like "A. ", "B) ", "C - ", "D: " at the very start
  return text.replace(/^[A-Da-d][.\)\-:]\s*/, '').trim();
};

// ── MCQ generation ────────────────────────────────────────────────────────────

export async function generateAssessmentMcqsForJob(opts: {
  job: {
    title?: string;
    role?: string;
    level?: string;
    description?: string;
    must_have_skills?: string[];
    good_to_have_skills?: string[];
  };
  mcqCount: number;
  difficulty: string;
}): Promise<any[]> {
  const { job, mcqCount, difficulty } = opts;
  if (mcqCount < 1) return [];
  const salesforceRole = isSalesforceRole(job);

  const mapped = mapAssessmentDifficulty(difficulty);
  const mustHaveSkills = (job.must_have_skills || []).join(', ') || 'general programming';
  const goodToHaveSkills = (job.good_to_have_skills || []).join(', ');

  // ── Normalise raw LLM output → structured MCQ objects ──────────────────────
  // NOTE: We do NOT trust correct_index from the LLM (it always returns 0).
  // Instead we ask the LLM to name the correct answer by label, then look it up.
  const normalizeQuestions = (raw: any[], defaultDifficulty: string): any[] => {
    return raw
      .map((q: any, i: number) => {
        const options: string[] = Array.isArray(q?.options)
          ? q.options.map((o: any) => stripOptionLabel(String(o).trim())).filter(Boolean).slice(0, 4)
          : [];
        if (options.length !== 4) return null;

        // Resolve correct answer by label (A/B/C/D) — more reliable than index
        let correctIdx = 0;
        const label = String(q?.correct_answer_label || '').trim().toUpperCase();
        const labelMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
        if (label in labelMap) {
          correctIdx = labelMap[label];
        } else if (typeof q?.correct_index === 'number' && q.correct_index >= 0 && q.correct_index <= 3) {
          correctIdx = q.correct_index;
        }

        return {
          id: String(q?.id || `q${i + 1}`),
          question: String(q?.question || '').trim(),
          options,
          correct_index: correctIdx,
          difficulty: String(q?.difficulty || defaultDifficulty),
          topic: String(q?.topic || 'General'),
          points: typeof q?.points === 'number' ? q.points : 5,
          explanation: String(q?.explanation || ''),
        };
      })
      .filter((q): q is NonNullable<typeof q> => q !== null && q.question.length > 0);
  };

  // ── Prompt: ask LLM to identify correct answer by LABEL not index ───────────
  const buildPrompt = (batchCount: number, excludedTexts: string[], excludedTopics: string[]): string => `
You are an expert technical assessment designer.
Generate exactly ${batchCount} unique multiple-choice questions for a ${job.level} ${job.role} technical assessment.

Job Title: ${job.title}
Job Description: ${(job.description || '').slice(0, 500)}
Required Skills: ${mustHaveSkills}
${goodToHaveSkills ? `Nice-to-Have Skills: ${goodToHaveSkills}` : ''}
Difficulty: ${mapped.label} — ${mapped.guidance}

━━━ STRICT RULES ━━━

[1] SCENARIO-BASED ONLY
Every question MUST describe a concrete realistic scenario — not a definition.
Bad: "What is a closure in JavaScript?"
Good: "A developer writes a function that returns another function referencing a variable from the outer scope. They notice the inner function always reflects the latest value of that variable. What JavaScript concept explains this behaviour?"

[2] NO REPETITION — CRITICAL
Do NOT generate questions that are similar to, or cover the same concept as, any of these already-generated questions:
${excludedTexts.length ? excludedTexts.map((t, i) => `  ${i + 1}. ${t}`).join('\n') : '  (none yet)'}
Do NOT generate questions in these already-covered topic areas:
${excludedTopics.length ? excludedTopics.map(t => `  - ${t}`).join('\n') : '  (none yet)'}

[3] EXACTLY 4 OPTIONS
Each question MUST have exactly 4 options (A, B, C, D). No more, no less.

[4] CORRECT ANSWER — USE LABEL (CRITICAL)
Identify the correct answer using the "correct_answer_label" field — set it to "A", "B", "C", or "D".
Do NOT rely on position. The correct answer should appear at DIFFERENT positions across different questions.
For a batch of ${batchCount} questions spread the correct answer evenly: some at A, some at B, some at C, some at D.

[5] PLAUSIBLE DISTRACTORS
All 3 wrong options must be technically plausible — representing real misconceptions.
NEVER use "None of the above", "All of the above", or clearly unrelated dummy answers.
Distractor pattern:
  - One: a common misconception about the topic
  - One: partially correct but missing a critical detail
  - One: technically-sounding but fundamentally wrong

[6] BROAD SKILL COVERAGE
Distribute questions evenly across ALL required skills: ${mustHaveSkills}.
Do NOT cluster multiple questions on the same technology or concept.

${salesforceRole ? `[7] SALESFORCE-ONLY SCOPE (CRITICAL)
The candidate is for a Salesforce role.
Only generate Salesforce platform questions covering Apex, Triggers, SOQL/SOSL, Flow vs Apex, Batch/Queueable/Future, Bulkification, sharing/security model, and governor limits.
Strictly exclude generic DSA/LeetCode-style algorithm puzzles (e.g., arrays, trees, graph traversals, dynamic programming) unless directly tied to Salesforce platform behavior.
` : ''}
━━━ OUTPUT FORMAT ━━━
Return ONLY valid JSON — no markdown, no explanations:
{
  "questions": [
    {
      "question": "<scenario-based question>",
      "options": ["<A>", "<B>", "<C>", "<D>"],
      "correct_answer_label": "C",
      "topic": "<specific skill covered>",
      "difficulty": "<easy|medium|hard>",
      "points": 5,
      "explanation": "<why the correct answer is right and each distractor is wrong>"
    }
  ]
}
`.trim();

  // ── Batch generation with shuffle + deduplication ───────────────────────────
  const generateBatch = async (batchCount: number, excludedTexts: string[], excludedTopics: string[]): Promise<any[]> => {
    const prompt = buildPrompt(batchCount, excludedTexts, excludedTopics);
    const maxTokens = Math.min(14000, 1200 + batchCount * 300);
    const generated = await Promise.race<any>([
      generateJSON<any>(prompt, { maxTokens, temperature: 0.85 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('MCQ generation timed out')), 45000)),
    ]);
    const raw = Array.isArray(generated)
      ? generated
      : (Array.isArray(generated?.questions) ? generated.questions : []);
    // Normalize then shuffle options to guarantee correct_index is randomised
    return normalizeQuestions(raw, difficulty).map(shuffleMcqOptions);
  };

  const questions: any[] = [];
  const seenTexts  = new Set<string>();   // exact-text dedup
  const seenTopics = new Set<string>();   // topic-fingerprint dedup
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts && questions.length < mcqCount; attempt += 1) {
    const remaining = mcqCount - questions.length;
    const chunkSize = remaining > 15 ? 8 : 5;
    const chunks: number[] = [];
    for (let left = remaining; left > 0; left -= chunkSize) {
      chunks.push(Math.min(chunkSize, left));
    }

    const excludedTexts  = questions.map((q: any) => String(q.question).slice(0, 120));
    const excludedTopics = Array.from(seenTopics);
    const batchResults = await Promise.allSettled(
      chunks.map(c => generateBatch(c, excludedTexts, excludedTopics))
    );

    for (const result of batchResults) {
      if (result.status !== 'fulfilled') continue;
      for (const q of result.value) {
        const textKey  = String(q.question || '').toLowerCase().slice(0, 80);
        const topicKey = topicFingerprint(q.question);

        // Reject exact duplicates and near-topic duplicates
        if (!textKey || seenTexts.has(textKey)) continue;
        if (topicKey && seenTopics.has(topicKey)) continue;

        seenTexts.add(textKey);
        seenTopics.add(topicKey);
        questions.push({ ...q, id: `q${questions.length + 1}` });
        if (questions.length === mcqCount) break;
      }
      if (questions.length === mcqCount) break;
    }
  }

  if (questions.length !== mcqCount) {
    throw new Error(`MCQ generation returned ${questions.length} questions; expected ${mcqCount}`);
  }

  return questions;
}
