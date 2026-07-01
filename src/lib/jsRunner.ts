export interface TestCase {
  id: string;
  input: string | any;
  expected_output: string | any;
  is_hidden?: boolean;
}

export interface TestResult {
  test_case_id: string;
  is_hidden?: boolean;
  passed: boolean;
  input: any;
  expected_output: any;
  actual_output: any;
  status: string;
  time_used: string | null;
  memory_used: string | null;
  error?: string | null;
  stdout?: string | null;
  stderr?: string | null;
}

export interface ExecutionResponse {
  results: TestResult[];
  passed: number;
  total: number;
  score_percentage: number;
  compilation_error?: string | null;
  runtime_error?: string | null;
  hidden_tests_passed?: number;
  hidden_tests_total?: number;
}

const workerScript = `
self.onmessage = function (e) {
  const { code, testCases, isSubmit } = e.data;

  try {
    // 1. Setup mock environment for LeetCode style classes
    const mockModule = { exports: {} };
    const consoleLogs = [];
    
    // Mock console.log to capture stdout per testcase
    const originalLog = console.log;
    console.log = function (...args) {
      consoleLogs.push(args.map(a => 
        typeof a === 'object' ? JSON.stringify(a) : String(a)
      ).join(' '));
    };

    // 2. Evaluate candidate code
    let SolutionClass;
    let evalError = null;
    try {
      // Provide module and exports to the eval context
      const wrapper = new Function('module', 'exports', 'console', code);
      wrapper(mockModule, mockModule.exports, console);
      SolutionClass = mockModule.exports;
    } catch (err) {
      evalError = err;
    } finally {
      console.log = originalLog;
    }

    if (evalError) {
      self.postMessage({
        type: 'error',
        compilation_error: "Compilation/Syntax Error: " + evalError.message
      });
      return;
    }

    if (!SolutionClass || (typeof SolutionClass !== 'function' && typeof SolutionClass !== 'object')) {
      self.postMessage({
        type: 'error',
        runtime_error: "Could not find a valid exported class/function. Make sure you use 'module.exports = Solution;'."
      });
      return;
    }

    // Instantiate if it's a class
    let instance;
    try {
      instance = new SolutionClass();
    } catch (err) {
      // Might be a plain function or object
      instance = SolutionClass;
    }

    // Find the target method (first non-constructor method if class, or just the function itself)
    let targetMethod = typeof instance === 'function' ? instance : null;
    if (!targetMethod && typeof instance === 'object') {
      const props = Object.getOwnPropertyNames(Object.getPrototypeOf(instance));
      for (const prop of props) {
        if (prop !== 'constructor' && typeof instance[prop] === 'function') {
          targetMethod = instance[prop];
          break;
        }
      }
      if (!targetMethod) {
        // also check Object.keys (if it's a simple object export)
        for (const key of Object.keys(instance)) {
          if (typeof instance[key] === 'function') {
             targetMethod = instance[key];
             break;
          }
        }
      }
    }

    if (!targetMethod) {
      self.postMessage({
        type: 'error',
        runtime_error: "Could not find a valid method on the exported class."
      });
      return;
    }

    // 3. Run test cases
    const results = [];
    let passedCount = 0;
    let hiddenPassed = 0;
    let hiddenTotal = 0;

    for (const tc of testCases) {
      if (tc.is_hidden) hiddenTotal++;
      
      const resultObj = {
        test_case_id: tc.id,
        is_hidden: tc.is_hidden,
        passed: false,
        input: tc.input,
        expected_output: tc.expected_output,
        actual_output: null,
        status: 'NA',
        time_used: '0.00',
        memory_used: '0.00',
        error: null,
        stdout: null,
        stderr: null
      };

      // Clear previous logs
      consoleLogs.length = 0;
      console.log = function (...args) {
        consoleLogs.push(args.map(a => 
          typeof a === 'object' ? JSON.stringify(a) : String(a)
        ).join(' '));
      };

      try {
        // Parse inputs. Inputs come as JSON strings e.g., '{"nums":[2,7],"target":9}'
        let parsedInput = {};
        if (typeof tc.input === 'string') {
          try {
            parsedInput = JSON.parse(tc.input);
          } catch(e) {
            parsedInput = tc.input;
          }
        } else {
          parsedInput = tc.input;
        }

        // Call target method with values extracted from parsed input
        let callArgs = [];
        if (typeof parsedInput === 'object' && parsedInput !== null && !Array.isArray(parsedInput)) {
           callArgs = Object.values(parsedInput);
        } else {
           callArgs = [parsedInput];
        }

        const start = performance.now();
        const actual = targetMethod.apply(instance, callArgs);
        const end = performance.now();
        
        resultObj.time_used = ((end - start) / 1000).toFixed(3);
        resultObj.actual_output = typeof actual === 'undefined' ? null : actual;

        // Parse expected output
        let parsedExpected;
        if (typeof tc.expected_output === 'string') {
           try {
             parsedExpected = JSON.parse(tc.expected_output);
           } catch(e) {
             parsedExpected = tc.expected_output;
           }
        } else {
           parsedExpected = tc.expected_output;
        }

        // Compare
        const strActual = JSON.stringify(resultObj.actual_output);
        const strExpected = JSON.stringify(parsedExpected);

        if (strActual === strExpected) {
          resultObj.passed = true;
          resultObj.status = 'AC';
          passedCount++;
          if (tc.is_hidden) hiddenPassed++;
        } else {
          resultObj.passed = false;
          resultObj.status = 'WA';
        }

      } catch (err) {
        resultObj.status = 'RE';
        resultObj.error = err.message;
        resultObj.stderr = err.stack;
      } finally {
        console.log = originalLog;
        if (consoleLogs.length > 0) {
          resultObj.stdout = consoleLogs.join('\\n');
        }
      }

      results.push(resultObj);
    }

    const total = testCases.length;
    const score_percentage = total > 0 ? (passedCount / total) * 100 : 0;

    self.postMessage({
      type: 'success',
      data: {
        results,
        passed: passedCount,
        total,
        score_percentage,
        hidden_tests_passed: hiddenPassed,
        hidden_tests_total: hiddenTotal
      }
    });

  } catch (globalErr) {
    self.postMessage({
      type: 'error',
      runtime_error: "Global Runtime Error: " + globalErr.message
    });
  }
};
`;

export async function runJavascriptClientSide(
  code: string,
  testCases: TestCase[],
  isSubmit: boolean = false
): Promise<ExecutionResponse> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([workerScript], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);

    // Timeout to prevent infinite loops (5 seconds max per execution batch)
    const timeout = setTimeout(() => {
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve({
        results: [],
        passed: 0,
        total: testCases.length,
        score_percentage: 0,
        runtime_error: "Time Limit Exceeded: Your code took too long to execute (possible infinite loop)."
      });
    }, 5000);

    worker.onmessage = (e) => {
      clearTimeout(timeout);
      worker.terminate();
      URL.revokeObjectURL(url);

      const msg = e.data;
      if (msg.type === "error") {
        resolve({
          results: [],
          passed: 0,
          total: testCases.length,
          score_percentage: 0,
          compilation_error: msg.compilation_error,
          runtime_error: msg.runtime_error
        });
      } else {
        // Filter out hidden tests if this is just a "run" (not a "submit")
        const finalResults = isSubmit ? msg.data.results : msg.data.results.filter((r: any) => !r.is_hidden);
        resolve({
          ...msg.data,
          results: finalResults,
          // When just "running" (not submitting), total is public tests count
          total: isSubmit ? msg.data.total : finalResults.length,
          passed: isSubmit ? msg.data.passed : finalResults.filter((r: any) => r.passed).length,
        });
      }
    };

    worker.onerror = (err) => {
      clearTimeout(timeout);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve({
        results: [],
        passed: 0,
        total: testCases.length,
        score_percentage: 0,
        runtime_error: "Worker Error: " + err.message
      });
    };

    worker.postMessage({ code, testCases, isSubmit });
  });
}
