/**
 * HackerEarth and Piston code execution engines.
 * Extracted verbatim from api/[...path].ts — lines 5881-6190.
 */

// ── Language mappings ─────────────────────────────────────────────────────────

export const HACKEREARTH_LANG_MAP: Record<string, string> = {
  python3: 'PYTHON3', javascript: 'JAVASCRIPT_NODE', java: 'JAVA14', cpp: 'CPP17',
  c: 'C', csharp: 'CSHARP', go: 'GO', ruby: 'RUBY', rust: 'RUST',
  typescript: 'TYPESCRIPT', kotlin: 'KOTLIN', swift: 'SWIFT'
};

export const MONACO_LANG_MAP: Record<string, string> = {
  python3: 'python', javascript: 'javascript', java: 'java', cpp: 'cpp',
  c: 'c', csharp: 'csharp', go: 'go', ruby: 'ruby', rust: 'rust',
  typescript: 'typescript', kotlin: 'kotlin', swift: 'swift'
};

export const LANG_DISPLAY_NAMES: Record<string, string> = {
  python3: 'Python 3', javascript: 'JavaScript', java: 'Java', cpp: 'C++',
  c: 'C', csharp: 'C#', go: 'Go', ruby: 'Ruby', rust: 'Rust',
  typescript: 'TypeScript', kotlin: 'Kotlin', swift: 'Swift'
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export function mapLanguageKey(lang: string): string {
  const n = lang.toLowerCase().replace(/[^a-z0-9+#]/g, '');
  if (n.includes('python') || n === 'py') return 'python3';
  if (n.includes('javascript') || n === 'js' || n === 'node') return 'javascript';
  if (n.includes('java') && !n.includes('script')) return 'java';
  if (n.includes('cpp') || n.includes('c++') || n === 'c17' || n === 'cpp17') return 'cpp';
  if (n.includes('typescript') || n === 'ts') return 'typescript';
  if (n.includes('csharp') || n === 'c#' || n === 'cs') return 'csharp';
  if (n === 'go' || n === 'golang') return 'go';
  if (n === 'ruby' || n === 'rb') return 'ruby';
  if (n === 'rust' || n === 'rs') return 'rust';
  if (n === 'kotlin' || n === 'kt') return 'kotlin';
  if (n === 'swift') return 'swift';
  return n || 'python3';
}

// Normalize output for strict comparison (handles trailing whitespace, newlines)
export function normalizeOutput(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/\r\n/g, '\n').trim().replace(/\n+$/, '');
}

export function outputsEquivalent(expectedValue: string | null | undefined, actualValue: string | null | undefined): boolean {
  const expected = normalizeOutput(expectedValue);
  const actual = normalizeOutput(actualValue);
  if (actual === expected) return true;

  // Fallback: ignore all whitespace-only differences (e.g. array formatting like [1, 2, 3] vs [1,2,3]).
  const compact = (v: string) => v.replace(/\s+/g, '');
  return compact(actual) === compact(expected);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type TCInput = { id: string; input: string; expected_output: string; visibility?: string; time_limit_ms?: number; memory_limit_kb?: number };
export type TCResult = {
  test_case_id: string; input: string; expected_output: string;
  actual_output: string | null; passed: boolean; status: string;
  time_used: string | null; memory_used: string | null;
  visibility: string; error: string | null;
  stdout?: string | null; stderr?: string | null;
};

// ── HackerEarth Polling ───────────────────────────────────────────────────────

// Poll HackerEarth for a single submission result
async function pollHEResult(pollUrl: string, secret: string, maxMs: number = 30000): Promise<any> {
  const start = Date.now();
  const intervals = [500, 1000, 1500, 2000, 2000, 3000, 3000, 4000, 5000, 5000];
  for (let i = 0; Date.now() - start < maxMs; i++) {
    const wait = intervals[Math.min(i, intervals.length - 1)];
    await new Promise(r => setTimeout(r, wait));
    try {
      const resp = await fetch(pollUrl, { headers: { 'client-secret': secret } });
      const data = await resp.json();
      const code = data.request_status?.code;
      if (code === 'REQUEST_COMPLETED' || code === 'REQUEST_FAILED') return data;
    } catch { /* retry */ }
  }
  return null;
}

// Fetch output from S3 URL returned by HackerEarth
async function fetchHEOutput(url: string | undefined): Promise<string | null> {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return null;
  try {
    const resp = await fetch(url);
    return normalizeOutput(await resp.text());
  } catch { return null; }
}

// Submit a single test case to HackerEarth and evaluate
async function submitAndEvalSingleHE(
  source: string, tc: TCInput, heLang: string, secret: string,
  defaultTimeLimitSec: number, defaultMemoryLimitKb: number,
): Promise<TCResult> {
  const vis = tc.visibility || 'public';
  const timeLimitSec = tc.time_limit_ms ? Math.ceil(tc.time_limit_ms / 1000) : defaultTimeLimitSec;
  const memLimitKb = tc.memory_limit_kb || defaultMemoryLimitKb;

  try {
    const submitResp = await fetch('https://api.hackerearth.com/v4/partner/code-evaluation/submissions/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'client-secret': secret },
      body: JSON.stringify({
        lang: heLang, source, input: tc.input,
        time_limit: Math.min(timeLimitSec, 5),
        memory_limit: Math.min(memLimitKb, 262144),
      }),
    });
    const submitData = await submitResp.json();

    if (!submitData.he_id || !submitData.status_update_url) {
      return { test_case_id: tc.id, input: tc.input, expected_output: tc.expected_output,
        actual_output: null, passed: false, status: 'REQUEST_FAILED',
        time_used: null, memory_used: null, visibility: vis,
        error: submitData.errors?.message || submitData.request_status?.message || 'Submission failed' };
    }

    const result = await pollHEResult(submitData.status_update_url, secret, 30000);
    if (!result) {
      return { test_case_id: tc.id, input: tc.input, expected_output: tc.expected_output,
        actual_output: null, passed: false, status: 'TIMEOUT',
        time_used: null, memory_used: null, visibility: vis,
        error: 'Execution timed out (30s)' };
    }

    const runStatus = result.result?.run_status || {};
    const compileStatus = result.result?.compile_status || '';
    const status = runStatus.status || 'NA';

    // Compilation error
    if (compileStatus && compileStatus !== 'OK') {
      return { test_case_id: tc.id, input: tc.input, expected_output: tc.expected_output,
        actual_output: null, passed: false, status: 'CE',
        time_used: null, memory_used: null, visibility: vis,
        error: `Compilation Error: ${compileStatus}` };
    }

    const stdoutRaw = await fetchHEOutput(runStatus.output);
    const stderrRaw = await fetchHEOutput(runStatus.stderr);

    // Runtime error / TLE / MLE
    if (status !== 'AC') {
      const errorMap: Record<string, string> = {
        'TLE': 'Time Limit Exceeded', 'MLE': 'Memory Limit Exceeded',
        'RE': `Runtime Error: ${runStatus.status_detail || ''}`.trim(),
        'NZEC': `Non-Zero Exit Code: ${runStatus.status_detail || ''}`.trim(),
        'SI': 'Signal Error', 'OTHER': runStatus.status_detail || 'Unknown Error',
      };
      return { test_case_id: tc.id, input: tc.input, expected_output: tc.expected_output,
        actual_output: stdoutRaw, passed: false, status: status === 'NZEC' ? 'RE' : status,
        time_used: runStatus.time_used || null, memory_used: runStatus.memory_used || null,
        visibility: vis, error: errorMap[status] || `Execution error: ${status}`,
        stdout: stdoutRaw, stderr: stderrRaw };
    }

    const actual = normalizeOutput(stdoutRaw);
    const passed = outputsEquivalent(tc.expected_output, stdoutRaw);

    return { test_case_id: tc.id, input: tc.input, expected_output: tc.expected_output,
      actual_output: actual, passed, status: passed ? 'AC' : 'WA',
      time_used: runStatus.time_used || null, memory_used: runStatus.memory_used || null,
      visibility: vis, error: passed ? null : 'Wrong Answer',
      stdout: stdoutRaw, stderr: stderrRaw };

  } catch (err: any) {
    return { test_case_id: tc.id, input: tc.input, expected_output: tc.expected_output,
      actual_output: null, passed: false, status: 'ERROR',
      time_used: null, memory_used: null, visibility: vis,
      error: err.message || 'Execution failed' };
  }
}

// ── Piston fallback ───────────────────────────────────────────────────────────

async function runSinglePiston(
  source: string, tc: TCInput,
  lang: { language: string; version: string }, timeLimitSec: number,
): Promise<TCResult> {
  const vis = tc.visibility || 'public';
  try {
    const resp = await fetch('https://emkc.org/api/v2/piston/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: lang.language, version: lang.version,
        files: [{ content: source }], stdin: tc.input, args: [],
        compile_timeout: 10000, run_timeout: timeLimitSec * 1000,
      }),
    });
    const data = await resp.json();
    const stdout = normalizeOutput(data.run?.stdout);
    const stderr = (data.run?.stderr || '').slice(0, 2000);

    if (data.compile?.stderr) {
      return { test_case_id: tc.id, input: tc.input, expected_output: tc.expected_output,
        actual_output: null, passed: false, status: 'CE', time_used: null, memory_used: null,
        visibility: vis, error: `Compilation Error: ${data.compile.stderr.slice(0, 2000)}` };
    }
    if ((data.run?.code || 0) !== 0 && !stdout) {
      return { test_case_id: tc.id, input: tc.input, expected_output: tc.expected_output,
        actual_output: null, passed: false, status: 'RE', time_used: null, memory_used: null,
        visibility: vis, error: `Runtime Error: ${stderr}` };
    }

    const passed = outputsEquivalent(tc.expected_output, stdout);
    return { test_case_id: tc.id, input: tc.input, expected_output: tc.expected_output,
      actual_output: stdout, passed, status: passed ? 'AC' : 'WA',
      time_used: null, memory_used: null, visibility: vis,
      error: passed ? null : (stderr || 'Wrong Answer') };
  } catch (err: any) {
    return { test_case_id: tc.id, input: tc.input, expected_output: tc.expected_output,
      actual_output: null, passed: false, status: 'ERROR', time_used: null, memory_used: null,
      visibility: vis, error: err.message || 'Execution failed' };
  }
}

async function executeTestCasesViaPiston(
  userCode: string, wrapperTemplate: string, langKey: string,
  testCases: TCInput[], defaultTimeLimitSec: number,
): Promise<TCResult[]> {
  const pistonLangMap: Record<string, { language: string; version: string }> = {
    python3: { language: 'python', version: '3.10' },
    javascript: { language: 'javascript', version: '18.15' },
    java: { language: 'java', version: '15.0' },
    cpp: { language: 'c++', version: '10.2' },
    typescript: { language: 'typescript', version: '5.0' },
  };

  const pistonLang = pistonLangMap[langKey] || pistonLangMap.python3;
  const fullSource = `${userCode}\n\n${wrapperTemplate}`;
  const results: TCResult[] = [];

  // Run first test case to check compilation
  const firstResult = await runSinglePiston(fullSource, testCases[0], pistonLang, defaultTimeLimitSec);
  results.push(firstResult);

  if (firstResult.status === 'CE') {
    for (let i = 1; i < testCases.length; i++) {
      results.push({
        test_case_id: testCases[i].id, input: testCases[i].input,
        expected_output: testCases[i].expected_output, actual_output: null,
        passed: false, status: 'CE', time_used: null, memory_used: null,
        visibility: testCases[i].visibility || 'public', error: firstResult.error,
      });
    }
    return results;
  }

  // Run remaining sequentially (Piston free tier is rate-limited)
  for (let i = 1; i < testCases.length; i++) {
    results.push(await runSinglePiston(fullSource, testCases[i], pistonLang, defaultTimeLimitSec));
  }
  return results;
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function executeTestCasesViaHackerEarth(
  userCode: string, wrapperTemplate: string, langKey: string,
  testCases: TCInput[], defaultTimeLimitSec: number, defaultMemoryLimitKb: number,
): Promise<TCResult[]> {
  const secret = process.env.HACKEREARTH_CLIENT_SECRET;
  const heLang = HACKEREARTH_LANG_MAP[langKey];
  if (!secret || !heLang) {
    return executeTestCasesViaPiston(userCode, wrapperTemplate, langKey, testCases, defaultTimeLimitSec);
  }

  const fullSource = `${userCode}\n\n${wrapperTemplate}`;
  const results: TCResult[] = [];

  // Phase 1: Submit first test case to check for compilation errors
  const firstTC = testCases[0];
  const firstResult = await submitAndEvalSingleHE(fullSource, firstTC, heLang, secret, defaultTimeLimitSec, defaultMemoryLimitKb);
  results.push(firstResult);

  // Early termination: if CE, mark all remaining as CE (compilation is same for all)
  if (firstResult.status === 'CE') {
    for (let i = 1; i < testCases.length; i++) {
      results.push({
        test_case_id: testCases[i].id, input: testCases[i].input,
        expected_output: testCases[i].expected_output, actual_output: null,
        passed: false, status: 'CE', time_used: null, memory_used: null,
        visibility: testCases[i].visibility || 'public', error: firstResult.error,
        stdout: null, stderr: null,
      });
    }
    return results;
  }

  // Phase 2: Submit remaining test cases in parallel batches of 3
  const remaining = testCases.slice(1);
  const BATCH_SIZE = 3;
  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    const batch = remaining.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(tc => submitAndEvalSingleHE(fullSource, tc, heLang, secret, defaultTimeLimitSec, defaultMemoryLimitKb))
    );
    results.push(...batchResults);
  }

  return results;
}
