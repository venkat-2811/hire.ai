import { generateJSON } from './openai';

export type ApexLLMEvaluation = {
  score: number; // 0-100
  verdict: 'Correct' | 'Partially Correct' | 'Incorrect';
  feedback: string;
  issues: string[];
  improvements: string[];
};

function clampScore(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function normalizeVerdict(v: unknown): ApexLLMEvaluation['verdict'] {
  if (v === 'Correct' || v === 'Partially Correct' || v === 'Incorrect') return v;
  const s = String(v || '').toLowerCase();
  if (s.includes('partial')) return 'Partially Correct';
  if (s.includes('correct')) return 'Correct';
  return 'Incorrect';
}

function normalizeStringList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .slice(0, 20);
}

export function buildApexEvaluationPrompt(opts: {
  problemStatement: string;
  candidateCode: string;
  testCases: Array<{ input: string; expected_output: string }>;
}): string {
  const { problemStatement, candidateCode, testCases } = opts;

  const tcText = (testCases || [])
    .slice(0, 25)
    .map((tc, idx) => `TestCase ${idx + 1}:\n- input: ${tc?.input ?? ''}\n- expected_output: ${tc?.expected_output ?? ''}`)
    .join('\n\n');

  return `You are an evaluator for a Salesforce Apex coding assessment.

IMPORTANT CONSTRAINTS (Phase 1):
- You MUST NOT claim to actually execute, compile, or run Apex.
- You MUST NOT hallucinate runtime output or Salesforce org state.
- You MUST ONLY "simulate" the logic by reasoning step-by-step.
- If the code is ambiguous, incomplete, or syntactically unlike Apex, reflect that in issues and score.

Your task:
1) Check whether the submission resembles Apex syntax and uses Apex constructs appropriately when relevant (classes, methods, triggers, SOQL patterns, bulkification, etc.).
2) For EACH test case, reason step-by-step how the code would (likely) behave and whether it matches the expected_output.
3) Produce a conservative, deterministic score (0-100) based on:
   - Logical correctness against test cases
   - Apex-like syntax and structure
   - Use of Apex/Salesforce best practices when applicable (e.g., bulkification)

Output MUST be STRICT JSON with exactly these keys:
{
  "score": <number between 0-100>,
  "verdict": "Correct" | "Partially Correct" | "Incorrect",
  "feedback": "<detailed explanation>",
  "issues": ["<list of problems identified>"],
  "improvements": ["<suggestions for better code>"]
}

PROBLEM STATEMENT:
${problemStatement}

CANDIDATE APEX CODE:
${candidateCode}

TEST CASES (input/output expectations):
${tcText}
`;
}

export async function evaluateApexWithLLM(opts: {
  problemStatement: string;
  candidateCode: string;
  testCases: Array<{ input: string; expected_output: string }>;
}): Promise<ApexLLMEvaluation> {
  const prompt = buildApexEvaluationPrompt(opts);

  const raw = await generateJSON<any>(prompt, {
    temperature: 0,
    maxTokens: 1800,
    timeoutMs: 30000,
  });

  const score = clampScore(raw?.score);
  const verdict = normalizeVerdict(raw?.verdict);
  const feedback = String(raw?.feedback ?? '').trim() || 'No feedback provided.';
  const issues = normalizeStringList(raw?.issues);
  const improvements = normalizeStringList(raw?.improvements);

  return { score, verdict, feedback, issues, improvements };
}

