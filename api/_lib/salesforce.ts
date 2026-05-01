/**
 * Salesforce role detection and Apex challenge generation.
 * Extracted verbatim from api/[...path].ts — lines 167-494.
 */
import crypto from 'node:crypto';
import { generateJSON } from './openai';

// ── Role detection ────────────────────────────────────────────────────────────

export function isSalesforceRoleText(value: string | null | undefined): boolean {
  if (!value) return false;
  return /(salesforce|apex|crm developer)/i.test(value);
}

export function isSalesforceRole(job: {
  role?: string | null;
  title?: string | null;
  description?: string | null;
  must_have_skills?: string[] | null;
  good_to_have_skills?: string[] | null;
}): boolean {
  return [
    job.role,
    job.title,
    job.description,
    ...(job.must_have_skills || []),
    ...(job.good_to_have_skills || []),
  ].some((value) => isSalesforceRoleText(value || ''));
}

// ── Apex challenge generation ─────────────────────────────────────────────────

export async function generateSalesforceApexChallenges(opts: {
  job: {
    title?: string;
    role?: string;
    level?: string;
    description?: string;
    must_have_skills?: string[];
    good_to_have_skills?: string[];
  };
  codingCount: number;
  difficulty: string;
}): Promise<any[]> {
  const { job, codingCount, difficulty } = opts;
  if (codingCount < 1) return [];

  const prompt = `You are an expert Salesforce technical interviewer.
Generate exactly ${codingCount} practical Salesforce coding challenges for a ${job.level} ${job.role} role (${job.title}).

Job Description: ${(job.description || '').slice(0, 600)}
Must-have Skills: ${(job.must_have_skills || []).join(', ')}
Good-to-have Skills: ${(job.good_to_have_skills || []).join(', ')}
Difficulty: ${difficulty}

Rules:
1. Questions must be Salesforce-specific only.
2. Use Apex/Trigger/SOQL/Bulkification/Governor-limit scenarios.
3. Strictly exclude generic DSA/LeetCode algorithm puzzles.
4. Each challenge should be executable as anonymous Apex.
5. Include at least 2 public test scenarios as sample input/output guidance.

Return only JSON:
{
  "challenges": [
    {
      "title": "string",
      "description": "string",
      "constraints": "string",
      "examples": [{"input":"string","output":"string","explanation":"string"}],
      "starter_code": "Apex code template",
      "test_cases": [{"id":"tc1","input":"string","expected_output":"string"}],
      "points": 100,
      "time_limit_seconds": 1200
    }
  ]
}`;

  const generated = await generateJSON<any>(prompt, { maxTokens: 7000, temperature: 0.7 });
  const raw = Array.isArray(generated) ? generated : (Array.isArray(generated?.challenges) ? generated.challenges : []);

  return raw.slice(0, codingCount).map((challenge: any, idx: number) => ({
    id: String(challenge?.id || `apex-${idx + 1}-${crypto.randomUUID()}`),
    slug: String(challenge?.slug || `salesforce-apex-${idx + 1}`),
    title: String(challenge?.title || `Salesforce Apex Challenge ${idx + 1}`),
    description: String(challenge?.description || 'Implement the required Salesforce logic using Apex.'),
    constraints: String(challenge?.constraints || 'Follow Salesforce governor limits and bulkification best practices.'),
    examples: Array.isArray(challenge?.examples) ? challenge.examples : [],
    starter_code: {
      apex: String(challenge?.starter_code || '// Write Apex code here\nSystem.debug(\'Hello from Apex\');'),
    },
    test_cases: Array.isArray(challenge?.test_cases) ? challenge.test_cases : [],
    points: Number(challenge?.points || 100),
    time_limit_seconds: Number(challenge?.time_limit_seconds || 1200),
    supported_languages: ['apex'],
    execution_mode: 'apex',
  }));
}
