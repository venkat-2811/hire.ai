import { handler } from '../netlify/functions/execute-apex';
import axios from 'axios';

type Scenario = {
  name: string;
  code: string;
  expected: 'success' | 'compile_error' | 'runtime_error' | 'validation_error' | 'governor_limit_error';
  expectedHttp: number;
};

const scenarios: Scenario[] = [
  {
    name: 'valid_debug',
    expected: 'success',
    expectedHttp: 200,
    code: `
System.debug('Apex smoke test: success path');
Integer x = 7;
System.debug('Value=' + x);
`.trim(),
  },
  {
    name: 'syntax_error',
    expected: 'compile_error',
    expectedHttp: 200,
    code: `
System.debug('Apex smoke test: syntax error')
Integer x = 1;
`.trim(),
  },
  {
    name: 'runtime_failure',
    expected: 'runtime_error',
    expectedHttp: 200,
    code: `
Integer zero = 0;
Integer boom = 10 / zero;
System.debug('This should not print: ' + boom);
`.trim(),
  },
  {
    name: 'empty_code',
    expected: 'validation_error',
    expectedHttp: 400,
    code: '   ',
  },
  {
    name: 'governor_limit_probe',
    expected: 'governor_limit_error',
    expectedHttp: 200,
    code: `
for (Integer i = 0; i < 120; i++) {
  List<Account> rows = [SELECT Id FROM Account LIMIT 1];
  System.debug('iter=' + i + ' rows=' + rows.size());
}
`.trim(),
  },
];

async function invokeScenario(scenario: Scenario) {
  const result = await handler(
    {
      httpMethod: 'POST',
      body: JSON.stringify({ code: scenario.code }),
    } as any,
    {} as any,
    () => {}
  );

  const parsed = typeof result.body === 'string' ? JSON.parse(result.body) : result.body;

  return {
    name: scenario.name,
    expected: scenario.expected,
    expectedHttp: scenario.expectedHttp,
    statusCode: result.statusCode,
    body: parsed,
  };
}

function inferOutcome(body: any): Scenario['expected'] {
  if (body?.errorType === 'validation_error') return 'validation_error';
  if (body?.errorType === 'governor_limit_error') return 'governor_limit_error';
  if (body?.compiled === false) return 'compile_error';
  if (body?.compiled === true && body?.success === false) return 'runtime_error';
  if (body?.compiled === true && body?.success === true) return 'success';
  return 'runtime_error';
}

function evaluateFrontendCompatibility(body: any) {
  const hasCoreFields =
    typeof body?.compiled === 'boolean' &&
    typeof body?.success === 'boolean' &&
    typeof body?.logs === 'string';

  // Mirrors AssessmentPage Apex mapping behavior.
  const compilationError =
    body?.compiled === false ? (body?.exceptionMessage || body?.logs || 'Compilation failed') : undefined;
  const runtimeError =
    body?.compiled && !body?.success ? (body?.exceptionMessage || body?.logs || 'Execution failed') : undefined;

  return {
    hasCoreFields,
    mapsToCompilationError: body?.compiled === false ? typeof compilationError === 'string' : compilationError === undefined,
    mapsToRuntimeError:
      body?.compiled === true && body?.success === false
        ? typeof runtimeError === 'string'
        : runtimeError === undefined,
    carriesLogs: typeof body?.logs === 'string',
  };
}

async function main() {
  const required = ['SF_CLIENT_ID', 'SF_CLIENT_SECRET', 'SF_USERNAME', 'SF_PASSWORD', 'SF_SECURITY_TOKEN'];
  const missing = required.filter((k) => !process.env[k]);
  const usingMock = missing.length > 0;

  if (usingMock) {
    process.env.SF_CLIENT_ID = process.env.SF_CLIENT_ID || 'mock-client-id';
    process.env.SF_CLIENT_SECRET = process.env.SF_CLIENT_SECRET || 'mock-client-secret';
    process.env.SF_USERNAME = process.env.SF_USERNAME || 'mock-user@example.com';
    process.env.SF_PASSWORD = process.env.SF_PASSWORD || 'mock-password';
    process.env.SF_SECURITY_TOKEN = process.env.SF_SECURITY_TOKEN || 'mock-token';

    (axios.post as any) = async () => ({
      data: {
        access_token: 'mock-access-token',
        instance_url: 'https://mock-instance.salesforce.com',
      },
    });

    (axios.get as any) = async (_url: string, config?: { params?: { anonymousBody?: string } }) => {
      const code = String(config?.params?.anonymousBody || '');
      if (code.includes('syntax error')) {
        return {
          data: {
            compiled: false,
            success: false,
            line: 1,
            column: 1,
            compileProblem: 'Unexpected token',
          },
        };
      }

      if (code.includes('10 / zero')) {
        return {
          data: {
            compiled: true,
            success: false,
            exceptionMessage: 'System.MathException: Divide by 0',
            exceptionStackTrace: 'AnonymousBlock: line 2, column 1',
          },
        };
      }

      return {
        data: {
          compiled: true,
          success: true,
          debugLog: 'USER_DEBUG|[1]|DEBUG|Apex smoke test: success path',
        },
      };
    };
  }

  const outputs = [];
  for (const scenario of scenarios) {
    const output = await invokeScenario(scenario);
    const actual = inferOutcome(output.body);
    const frontend = evaluateFrontendCompatibility(output.body);
    outputs.push({
      ...output,
      actual,
      pass: actual === scenario.expected && output.statusCode === scenario.expectedHttp,
      frontendCompatibility: frontend,
    });
  }

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        mode: usingMock ? 'mocked' : 'live',
        allPassed: outputs.every((o) => o.pass),
        outputs,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error('Smoke test failed:', err?.message || err);
  process.exit(1);
});
