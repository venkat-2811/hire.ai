"""
Secure code execution service using HackerEarth Code Evaluation API v4.
Compiles and executes candidate code with full stdout/stderr, compilation
errors with line numbers, and detailed stack traces.

Falls back to local subprocess execution if HackerEarth API is unavailable.
"""
import asyncio
import subprocess
import tempfile
import os
import json
import sys
import re
import time
import traceback
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field

import httpx

from app.config import get_settings

HE_API_URL = "https://api.hackerearth.com/v4/partner/code-evaluation/submissions/"
MAX_POLL_ATTEMPTS = 30
POLL_INTERVAL_SECONDS = 1.5

# Map frontend language names to HackerEarth language identifiers
LANGUAGE_MAP = {
    "python3": "PYTHON3",
    "python": "PYTHON3",
    "javascript": "JAVASCRIPT_NODE",
    "java": "JAVA14",
    "cpp": "CPP17",
    "c": "C",
    "typescript": "TYPESCRIPT",
    "csharp": "CSHARP",
    "go": "GO",
    "rust": "RUST",
    "kotlin": "KOTLIN",
    "ruby": "RUBY",
    "swift": "SWIFT",
    "scala": "SCALA",
}


@dataclass
class TestResult:
    passed: bool
    input_data: Dict[str, Any]
    expected: Any
    actual: Any
    error: Optional[str] = None
    execution_time_ms: float = 0
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    status: str = "NA"  # AC, WA, TLE, MLE, RE, CE
    time_used: Optional[str] = None
    memory_used: Optional[str] = None


@dataclass
class ExecutionResult:
    success: bool
    test_results: List[TestResult]
    passed_count: int
    total_count: int
    score_percentage: float
    compilation_error: Optional[str] = None
    runtime_error: Optional[str] = None
    stdout: Optional[str] = None
    stderr: Optional[str] = None


class HackerEarthExecutor:
    """Execute code via HackerEarth Code Evaluation API v4."""

    TIMEOUT_SECONDS = 10
    MAX_OUTPUT_SIZE = 10000

    def __init__(self):
        settings = get_settings()
        self.client_secret = settings.hackerearth_client_secret

    @property
    def _is_available(self) -> bool:
        return bool(self.client_secret)

    async def execute(
        self,
        code: str,
        test_cases: List[Dict[str, Any]],
        language: str = "python3",
        function_name: str = None,
    ) -> ExecutionResult:
        """
        Execute code against test cases using HackerEarth API.

        For each test case, builds a runner script that wraps the candidate's code,
        sends it to HackerEarth for execution, and compares output.
        """
        if not test_cases:
            return ExecutionResult(
                success=False, test_results=[], passed_count=0,
                total_count=0, score_percentage=0,
                compilation_error="No test cases provided",
            )

        # Detect function name if not given
        if not function_name:
            function_name = self._detect_function_name(code, language)

        if not function_name:
            return ExecutionResult(
                success=False, test_results=[], passed_count=0,
                total_count=0, score_percentage=0,
                compilation_error="Could not detect function name in code. "
                                  "Make sure your code defines a function.",
            )

        he_lang = LANGUAGE_MAP.get(language, "PYTHON3")

        # If HackerEarth API is not configured, fall back to local execution
        if not self._is_available:
            return self._execute_local(code, test_cases, function_name)

        test_results: List[TestResult] = []
        passed_count = 0
        overall_compilation_error = None

        for tc in test_cases:
            result = await self._run_single_test_he(
                code, function_name, tc, he_lang, language
            )
            test_results.append(result)
            if result.passed:
                passed_count += 1
            # If first test had a compilation error, record it and
            # cascade it to all remaining tests (no need to re-submit)
            if result.status == "CE" and not overall_compilation_error:
                overall_compilation_error = result.error or result.stderr
                # Mark remaining test cases as CE without API calls
                for remaining_tc in test_cases[len(test_results):]:
                    input_data = remaining_tc.get("input", {})
                    expected = remaining_tc.get("expected")
                    test_results.append(TestResult(
                        passed=False, input_data=input_data, expected=expected,
                        actual=None, error=overall_compilation_error,
                        status="CE", stderr=result.stderr,
                    ))
                break

        total_count = len(test_cases)
        score = (passed_count / total_count * 100) if total_count > 0 else 0

        return ExecutionResult(
            success=overall_compilation_error is None,
            test_results=test_results,
            passed_count=passed_count,
            total_count=total_count,
            score_percentage=score,
            compilation_error=overall_compilation_error,
        )

    async def _run_single_test_he(
        self,
        code: str,
        function_name: str,
        test_case: Dict[str, Any],
        he_lang: str,
        frontend_lang: str,
    ) -> TestResult:
        """Run a single test case through HackerEarth API."""
        input_data = test_case.get("input", {})
        expected = test_case.get("expected")

        # Build the full source that includes candidate code + test harness
        source = self._build_runner_source(
            code, function_name, input_data, frontend_lang
        )

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                # POST submission
                resp = await client.post(
                    HE_API_URL,
                    json={
                        "source": source,
                        "lang": he_lang,
                        "time_limit": 5,
                        "memory_limit": 262144,
                    },
                    headers={
                        "client-secret": self.client_secret,
                        "content-type": "application/json",
                    },
                )

                if resp.status_code != 200:
                    error_data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
                    error_msg = error_data.get("message", f"HackerEarth API error (HTTP {resp.status_code})")
                    return TestResult(
                        passed=False, input_data=input_data, expected=expected,
                        actual=None, error=error_msg, status="ERROR",
                    )

                data = resp.json()
                he_id = data.get("he_id")
                status_url = data.get("status_update_url", "")

                if not he_id or not status_url:
                    return TestResult(
                        passed=False, input_data=input_data, expected=expected,
                        actual=None, error="HackerEarth API did not return a valid submission ID",
                        status="ERROR",
                    )

                # Poll for completion
                result_data = await self._poll_result(client, status_url)

                if result_data is None:
                    return TestResult(
                        passed=False, input_data=input_data, expected=expected,
                        actual=None, error="Execution timed out while waiting for HackerEarth response",
                        status="TLE",
                    )

                return self._parse_he_result(result_data, input_data, expected)

        except httpx.TimeoutException:
            return TestResult(
                passed=False, input_data=input_data, expected=expected,
                actual=None, error="Request to HackerEarth API timed out",
                status="TLE",
            )
        except Exception as e:
            traceback.print_exc()
            # Fall back to local execution for this test case
            return self._run_single_test_local(code, function_name, test_case)

    async def _poll_result(
        self, client: httpx.AsyncClient, status_url: str
    ) -> Optional[Dict]:
        """Poll HackerEarth status endpoint until REQUEST_COMPLETED or failure."""
        for _ in range(MAX_POLL_ATTEMPTS):
            await asyncio.sleep(POLL_INTERVAL_SECONDS)
            try:
                resp = await client.get(
                    status_url,
                    headers={"client-secret": self.client_secret},
                )
                if resp.status_code != 200:
                    continue
                data = resp.json()
                status_code = data.get("request_status", {}).get("code", "")
                if status_code == "REQUEST_COMPLETED":
                    return data
                if status_code == "REQUEST_FAILED":
                    return data
                if status_code == "CODE_COMPILED":
                    # Check if compilation failed
                    compile_status = data.get("result", {}).get("compile_status", "")
                    if compile_status and compile_status != "OK":
                        # Compilation error — return immediately
                        return data
            except Exception:
                continue
        return None

    def _parse_he_result(
        self, data: Dict, input_data: Dict, expected: Any
    ) -> TestResult:
        """Parse HackerEarth API result into a TestResult."""
        result = data.get("result", {})
        compile_status = result.get("compile_status", "")
        run_status = result.get("run_status", {})

        # Check compilation error
        if compile_status and compile_status != "OK":
            return TestResult(
                passed=False, input_data=input_data, expected=expected,
                actual=None,
                error=compile_status,
                stderr=compile_status,
                status="CE",
            )

        status = run_status.get("status", "NA")
        stderr = run_status.get("stderr", "") or ""
        time_used = run_status.get("time_used")
        memory_used = run_status.get("memory_used")
        output_url = run_status.get("output", "")
        status_detail = run_status.get("status_detail", "NA")

        # Download stdout from S3 URL
        stdout_content = ""
        if output_url and output_url.startswith("http"):
            try:
                import urllib.request
                with urllib.request.urlopen(output_url, timeout=10) as response:
                    stdout_content = response.read().decode("utf-8", errors="replace")
            except Exception:
                stdout_content = ""

        # Handle non-AC statuses
        if status == "TLE":
            return TestResult(
                passed=False, input_data=input_data, expected=expected,
                actual=None, error="Time Limit Exceeded",
                stdout=stdout_content, stderr=stderr,
                status="TLE", time_used=time_used, memory_used=memory_used,
            )
        if status == "MLE":
            return TestResult(
                passed=False, input_data=input_data, expected=expected,
                actual=None, error="Memory Limit Exceeded",
                stdout=stdout_content, stderr=stderr,
                status="MLE", time_used=time_used, memory_used=memory_used,
            )
        if status == "RE":
            error_detail = f"Runtime Error ({status_detail})"
            if stderr:
                error_detail = stderr
            return TestResult(
                passed=False, input_data=input_data, expected=expected,
                actual=None, error=error_detail,
                stdout=stdout_content, stderr=stderr,
                status="RE", time_used=time_used, memory_used=memory_used,
            )

        # Status is AC — parse the actual output from stdout
        # Our runner script prints the result as the LAST line as JSON
        # preceded by a separator
        actual = None
        user_stdout = ""
        if stdout_content:
            lines = stdout_content.rstrip("\n").split("\n")
            separator_idx = None
            for i, line in enumerate(lines):
                if line.strip() == "---RESULT_SEPARATOR---":
                    separator_idx = i
                    break

            if separator_idx is not None:
                user_stdout = "\n".join(lines[:separator_idx])
                result_line = "\n".join(lines[separator_idx + 1:]).strip()
                try:
                    actual = json.loads(result_line)
                except (json.JSONDecodeError, ValueError):
                    actual = result_line
            else:
                # No separator found — entire output is the result
                try:
                    actual = json.loads(stdout_content.strip())
                except (json.JSONDecodeError, ValueError):
                    actual = stdout_content.strip()
                user_stdout = ""

        passed = self._compare_results(actual, expected)

        return TestResult(
            passed=passed, input_data=input_data, expected=expected,
            actual=actual,
            stdout=user_stdout if user_stdout else None,
            stderr=stderr if stderr else None,
            status="AC" if passed else "WA",
            time_used=time_used, memory_used=memory_used,
        )

    def _build_runner_source(
        self, code: str, function_name: str, input_data: Dict, language: str
    ) -> str:
        """Build a runner script that wraps the candidate code + test harness."""
        input_json = json.dumps(input_data)

        if language in ("python3", "python"):
            return f'''import json
import sys
import traceback

# ---- Candidate's code ----
{code}
# ---- End candidate's code ----

if __name__ == "__main__":
    try:
        input_data = json.loads({repr(input_json)})
        result = {function_name}(**input_data)
        print("---RESULT_SEPARATOR---")
        print(json.dumps(result))
    except Exception as e:
        tb = traceback.format_exc()
        print(tb, file=sys.stderr)
        sys.exit(1)
'''
        elif language == "javascript":
            return f'''// ---- Candidate's code ----
{code}
// ---- End candidate's code ----

try {{
    const inputData = {input_json};
    const result = {function_name}(...Object.values(inputData));
    console.log("---RESULT_SEPARATOR---");
    console.log(JSON.stringify(result));
}} catch (e) {{
    console.error(e.stack || e.message || e);
    process.exit(1);
}}
'''
        elif language == "java":
            return code  # Java requires class structure; run as-is
        elif language == "cpp":
            return code  # C++ runs as-is
        else:
            # Default: treat as Python
            return f'''import json
import sys
import traceback

{code}

if __name__ == "__main__":
    try:
        input_data = json.loads({repr(input_json)})
        result = {function_name}(**input_data)
        print("---RESULT_SEPARATOR---")
        print(json.dumps(result))
    except Exception as e:
        tb = traceback.format_exc()
        print(tb, file=sys.stderr)
        sys.exit(1)
'''

    # ─── Local fallback ───────────────────────────────────────────────────

    def _execute_local(
        self, code: str, test_cases: List[Dict], function_name: str
    ) -> ExecutionResult:
        """Fallback: execute Python code locally via subprocess."""
        test_results = []
        passed_count = 0

        for tc in test_cases:
            result = self._run_single_test_local(code, function_name, tc)
            test_results.append(result)
            if result.passed:
                passed_count += 1

        total = len(test_cases)
        score = (passed_count / total * 100) if total > 0 else 0
        return ExecutionResult(
            success=True, test_results=test_results,
            passed_count=passed_count, total_count=total,
            score_percentage=score,
        )

    def _run_single_test_local(
        self, code: str, function_name: str, test_case: Dict
    ) -> TestResult:
        """Run a single test case locally via subprocess."""
        input_data = test_case.get("input", {})
        expected = test_case.get("expected")
        input_json = json.dumps(input_data)

        runner_code = f'''
import json
import sys
import traceback

{code}

if __name__ == "__main__":
    try:
        input_data = json.loads({repr(input_json)})
        result = {function_name}(**input_data)
        print("---RESULT_SEPARATOR---")
        print(json.dumps(result))
    except Exception as e:
        tb = traceback.format_exc()
        print(tb, file=sys.stderr)
        sys.exit(1)
'''
        try:
            with tempfile.NamedTemporaryFile(
                mode='w', suffix='.py', delete=False, encoding='utf-8'
            ) as f:
                f.write(runner_code)
                temp_file = f.name

            try:
                result = subprocess.run(
                    [sys.executable, temp_file],
                    capture_output=True, text=True,
                    timeout=self.TIMEOUT_SECONDS,
                    cwd=tempfile.gettempdir(),
                )

                stdout_content = result.stdout or ""
                stderr_content = result.stderr or ""

                if result.returncode != 0:
                    return TestResult(
                        passed=False, input_data=input_data, expected=expected,
                        actual=None,
                        error=stderr_content[:self.MAX_OUTPUT_SIZE] or "Unknown error",
                        stdout=stdout_content, stderr=stderr_content,
                        status="RE",
                    )

                # Parse output
                actual = None
                user_stdout = ""
                lines = stdout_content.rstrip("\n").split("\n")
                separator_idx = None
                for i, line in enumerate(lines):
                    if line.strip() == "---RESULT_SEPARATOR---":
                        separator_idx = i
                        break

                if separator_idx is not None:
                    user_stdout = "\n".join(lines[:separator_idx])
                    result_line = "\n".join(lines[separator_idx + 1:]).strip()
                    try:
                        actual = json.loads(result_line)
                    except json.JSONDecodeError:
                        actual = result_line
                else:
                    try:
                        actual = json.loads(stdout_content.strip())
                    except json.JSONDecodeError:
                        actual = stdout_content.strip()

                passed = self._compare_results(actual, expected)

                return TestResult(
                    passed=passed, input_data=input_data, expected=expected,
                    actual=actual,
                    stdout=user_stdout if user_stdout else None,
                    stderr=stderr_content if stderr_content else None,
                    status="AC" if passed else "WA",
                )

            except subprocess.TimeoutExpired:
                return TestResult(
                    passed=False, input_data=input_data, expected=expected,
                    actual=None, error=f"Time limit exceeded ({self.TIMEOUT_SECONDS}s)",
                    status="TLE",
                )
            finally:
                try:
                    os.unlink(temp_file)
                except Exception:
                    pass

        except Exception as e:
            return TestResult(
                passed=False, input_data=input_data, expected=expected,
                actual=None, error=f"Execution error: {str(e)}",
                status="ERROR",
            )

    # ─── Helpers ──────────────────────────────────────────────────────────

    def _detect_function_name(self, code: str, language: str = "python3") -> Optional[str]:
        """Detect the main function name from the code."""
        if language in ("python3", "python"):
            matches = re.findall(r'def\s+(\w+)\s*\(', code)
            if matches:
                for m in matches:
                    if not m.startswith('_'):
                        return m
                return matches[0]
        elif language == "javascript":
            # function foo(...) or const foo = (...)
            matches = re.findall(r'(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:\(|function))', code)
            if matches:
                for m in matches:
                    name = m[0] or m[1]
                    if name:
                        return name
        elif language in ("java", "cpp", "csharp", "go", "rust", "kotlin", "ruby", "typescript", "swift", "scala"):
            # Generic: look for common function patterns
            matches = re.findall(r'(?:def|func|fn|fun|function|static\s+\w+)\s+(\w+)\s*\(', code)
            if matches:
                for m in matches:
                    if m not in ('main', 'Main'):
                        return m
                return matches[0]
        return None

    def _compare_results(self, actual: Any, expected: Any) -> bool:
        """Compare actual and expected results with type flexibility."""
        if actual == expected:
            return True

        if isinstance(actual, list) and isinstance(expected, list):
            try:
                if sorted(actual) == sorted(expected):
                    return True
            except TypeError:
                pass
            return actual == expected

        if isinstance(actual, (int, float)) and isinstance(expected, (int, float)):
            return abs(actual - expected) < 1e-9

        if isinstance(actual, str) and isinstance(expected, str):
            return actual.strip() == expected.strip()

        # Try string comparison as fallback
        if str(actual).strip() == str(expected).strip():
            return True

        return False


# ─── Singleton / factory ──────────────────────────────────────────────────────

_executor: Optional[HackerEarthExecutor] = None


def get_code_executor() -> HackerEarthExecutor:
    global _executor
    if _executor is None:
        _executor = HackerEarthExecutor()
    return _executor
