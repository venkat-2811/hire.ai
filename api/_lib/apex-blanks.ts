/**
 * Apex Fill-in-the-Blanks generation and evaluation (LLM-based).
 */
import crypto from 'node:crypto';
import { generateJSON } from './openai';

export interface ApexBlankItem {
  blank_id: string;
  placeholder: string;
  expected_answer: string;
  guidance?: string;
}

export interface ApexFillInBlankQuestion {
  id: string;
  title: string;
  instructions: string;
  code_with_blanks: string;
  blanks: ApexBlankItem[];
  points: number;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface ApexBlanksEvaluationResult {
  question_id: string;
  score: number; // 0..points
  max_score: number;
  feedback: string;
  per_blank: Array<{
    blank_id: string;
    correct: boolean;
    expected: string;
    received: string;
    notes?: string;
  }>;
}

function stableId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export async function generateApexFillInTheBlanks(opts: {
  job: {
    title?: string | null;
    role?: string | null;
    level?: string | null;
    description?: string | null;
    must_have_skills?: string[] | null;
    good_to_have_skills?: string[] | null;
  };
  count: number;
  difficulty: string;
}): Promise<ApexFillInBlankQuestion[]> {
  const count = Math.max(1, Math.min(20, Number(opts.count) || 5));
  const difficulty = String(opts.difficulty || 'medium').toLowerCase();

  const jobText = [
    opts.job.title,
    opts.job.role,
    opts.job.level,
    opts.job.description,
    ...(opts.job.must_have_skills || []),
    ...(opts.job.good_to_have_skills || []),
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, 1200);

  const prompt = `
You are an expert Salesforce technical assessor.
Generate exactly ${count} Apex "Fill in the Blanks" questions.

Context (Salesforce role): ${jobText}
Difficulty: ${difficulty}

STRICT REQUIREMENTS:
- These are NOT DSA problems.
- Each question must be based on practical Salesforce/Apex knowledge.
- Each question must contain EXACTLY ONE blank.
- In the code snippet, mark the blank location with the EXACT marker: /* BLANK */
- The marker /* BLANK */ must appear EXACTLY ONCE in code_with_blanks.
- Do NOT use placeholders like [[blank]] or [[BLANK_1]] in the question text or code.
- Do NOT provide hints, guidance, or suggestions for the blank.
- The blank should test syntax and platform concepts: SOQL, DML, triggers, bulkification, governor limits, sharing, exception handling, collections, null checks.
- Keep snippets small enough to read quickly (roughly 15-40 lines).
- For the blank, provide the EXACT expected answer string (case-sensitive).

OUTPUT JSON ONLY:
{
  "questions": [
    {
      "title": "...",
      "instructions": "...",
      "code_with_blanks": "...",
      "topic": "SOQL|Triggers|Governor Limits|Security|DML|Collections|Async|Testing|General",
      "difficulty": "easy|medium|hard",
      "points": 10,
      "blanks": [
        {
          "blank_id": "BLANK_1",
          "placeholder": "",
          "expected_answer": "...",
          "guidance": ""
        }
      ]
    }
  ]
}
`.trim();

  const result = await generateJSON<any>(prompt, {
    temperature: 0.7,
    maxTokens: Math.min(7000, 1600 + count * 700),
    timeoutMs: 16000,
  });

  const raw: any[] = Array.isArray(result?.questions) ? result.questions : [];
  const normalized: ApexFillInBlankQuestion[] = raw
    .map((q: any, i: number) => {
      const blanks: ApexBlankItem[] = Array.isArray(q?.blanks)
        ? q.blanks
            .map((b: any) => ({
              blank_id: String(b?.blank_id || '').trim() || `BLANK_${i + 1}`,
              placeholder: String(b?.placeholder || '').trim() || '',
              expected_answer: String(b?.expected_answer || '').trim(),
              guidance: String(b?.guidance || '').trim() || undefined,
            }))
            .filter((b: ApexBlankItem) => b.expected_answer.length > 0)
        : [];

      const code = String(q?.code_with_blanks || '').trim();
      if (!code || blanks.length < 1) return null;

      const markerCount = (code.match(/\/\*\s*BLANK\s*\*\//g) || []).length;
      if (markerCount !== 1) return null;

      const firstBlank = blanks[0];
      const normalizedBlanks: ApexBlankItem[] = [
        {
          blank_id: String(firstBlank.blank_id || 'BLANK_1').trim() || 'BLANK_1',
          placeholder: '',
          expected_answer: String(firstBlank.expected_answer || '').trim(),
        },
      ].filter((b) => b.expected_answer.length > 0);

      if (normalizedBlanks.length !== 1) return null;

      return {
        id: stableId('apex_blank'),
        title: String(q?.title || `Apex Fill-in-the-Blanks ${i + 1}`).trim(),
        instructions: String(q?.instructions || 'Fill in the missing Apex syntax.').trim(),
        code_with_blanks: code,
        blanks: normalizedBlanks,
        points: typeof q?.points === 'number' ? q.points : 10,
        topic: String(q?.topic || 'General').trim(),
        difficulty: (String(q?.difficulty || difficulty).toLowerCase() as any) || 'medium',
      };
    })
    .filter((q): q is ApexFillInBlankQuestion => Boolean(q));

  return normalized.slice(0, count);
}

export async function evaluateApexFillInTheBlanks(opts: {
  questions: ApexFillInBlankQuestion[];
  submissions: Record<string, Record<string, string>>; // question_id -> blank_id -> answer
}): Promise<{ results: ApexBlanksEvaluationResult[]; total_score: number; max_score: number }> {
  const questions = opts.questions || [];
  const submissions = opts.submissions || {};

  const maxScore = questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);

  const prompt = `
You are a strict Apex syntax evaluator.
Evaluate the candidate's answers for Apex fill-in-the-blanks questions.

RULES:
- Grade each blank as correct/incorrect.
- Correctness requires exact syntax (case-sensitive) unless Apex is case-insensitive for that token (e.g., keywords). Use reasonable judgment but be strict.
- If minor whitespace differences only, consider correct.
- Provide constructive feedback.
- Score each question between 0 and its points.

INPUT JSON:
${JSON.stringify({ questions, submissions })}

OUTPUT JSON ONLY:
{
  "results": [
    {
      "question_id": "...",
      "score": 0,
      "max_score": 10,
      "feedback": "...",
      "per_blank": [
        {"blank_id": "BLANK_1", "correct": true, "expected": "...", "received": "...", "notes": "..."}
      ]
    }
  ]
}
`.trim();

  const judged = await generateJSON<any>(prompt, {
    temperature: 0.2,
    maxTokens: 12000,
    timeoutMs: 25000,
  });

  const results: ApexBlanksEvaluationResult[] = Array.isArray(judged?.results) ? judged.results : [];

  const total = results.reduce((sum, r) => sum + (Number(r.score) || 0), 0);
  return { results, total_score: total, max_score: maxScore };
}
