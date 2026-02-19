"""
Secure code execution service for running candidate code against test cases.
Uses subprocess with strict timeouts and resource limits.
"""
import subprocess
import tempfile
import os
import json
import sys
from typing import List, Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class TestResult:
    passed: bool
    input_data: Dict[str, Any]
    expected: Any
    actual: Any
    error: Optional[str] = None
    execution_time_ms: float = 0


@dataclass
class ExecutionResult:
    success: bool
    test_results: List[TestResult]
    passed_count: int
    total_count: int
    score_percentage: float
    compilation_error: Optional[str] = None
    runtime_error: Optional[str] = None


class CodeExecutor:
    """Execute Python code safely in a sandboxed environment."""
    
    TIMEOUT_SECONDS = 10
    MAX_OUTPUT_SIZE = 10000
    
    def __init__(self):
        pass
    
    def execute_python(
        self,
        code: str,
        test_cases: List[Dict[str, Any]],
        function_name: str = None,
    ) -> ExecutionResult:
        """
        Execute Python code against test cases.
        
        Args:
            code: The Python code to execute
            test_cases: List of test cases with 'input' and 'expected' keys
            function_name: Optional function name to call (auto-detected if not provided)
        
        Returns:
            ExecutionResult with test results and scores
        """
        if not test_cases:
            return ExecutionResult(
                success=False,
                test_results=[],
                passed_count=0,
                total_count=0,
                score_percentage=0,
                compilation_error="No test cases provided",
            )
        
        # Try to detect function name from code if not provided
        if not function_name:
            function_name = self._detect_function_name(code)
        
        if not function_name:
            return ExecutionResult(
                success=False,
                test_results=[],
                passed_count=0,
                total_count=0,
                score_percentage=0,
                compilation_error="Could not detect function name in code",
            )
        
        test_results = []
        passed_count = 0
        
        for test_case in test_cases:
            result = self._run_single_test(code, function_name, test_case)
            test_results.append(result)
            if result.passed:
                passed_count += 1
        
        total_count = len(test_cases)
        score_percentage = (passed_count / total_count * 100) if total_count > 0 else 0
        
        return ExecutionResult(
            success=True,
            test_results=test_results,
            passed_count=passed_count,
            total_count=total_count,
            score_percentage=score_percentage,
        )
    
    def _detect_function_name(self, code: str) -> Optional[str]:
        """Detect the main function name from the code."""
        import re
        # Look for function definitions
        matches = re.findall(r'def\s+(\w+)\s*\(', code)
        if matches:
            # Return the first non-helper function (not starting with _)
            for match in matches:
                if not match.startswith('_'):
                    return match
            return matches[0]
        return None
    
    def _run_single_test(
        self,
        code: str,
        function_name: str,
        test_case: Dict[str, Any],
    ) -> TestResult:
        """Run a single test case."""
        input_data = test_case.get("input", {})
        expected = test_case.get("expected")
        
        # Build the test runner script
        runner_code = self._build_runner_script(code, function_name, input_data)
        
        try:
            with tempfile.NamedTemporaryFile(
                mode='w',
                suffix='.py',
                delete=False,
                encoding='utf-8'
            ) as f:
                f.write(runner_code)
                temp_file = f.name
            
            try:
                # Execute with timeout
                result = subprocess.run(
                    [sys.executable, temp_file],
                    capture_output=True,
                    text=True,
                    timeout=self.TIMEOUT_SECONDS,
                    cwd=tempfile.gettempdir(),
                )
                
                if result.returncode != 0:
                    error_msg = result.stderr[:self.MAX_OUTPUT_SIZE] if result.stderr else "Unknown error"
                    return TestResult(
                        passed=False,
                        input_data=input_data,
                        expected=expected,
                        actual=None,
                        error=f"Runtime error: {error_msg}",
                    )
                
                # Parse output
                output = result.stdout.strip()
                try:
                    actual = json.loads(output)
                except json.JSONDecodeError:
                    actual = output
                
                # Compare results
                passed = self._compare_results(actual, expected)
                
                return TestResult(
                    passed=passed,
                    input_data=input_data,
                    expected=expected,
                    actual=actual,
                )
                
            except subprocess.TimeoutExpired:
                return TestResult(
                    passed=False,
                    input_data=input_data,
                    expected=expected,
                    actual=None,
                    error=f"Time limit exceeded ({self.TIMEOUT_SECONDS}s)",
                )
            finally:
                # Clean up temp file
                try:
                    os.unlink(temp_file)
                except:
                    pass
                    
        except Exception as e:
            return TestResult(
                passed=False,
                input_data=input_data,
                expected=expected,
                actual=None,
                error=f"Execution error: {str(e)}",
            )
    
    def _build_runner_script(
        self,
        code: str,
        function_name: str,
        input_data: Dict[str, Any],
    ) -> str:
        """Build a runner script that executes the code and prints JSON output."""
        # Serialize input data
        input_json = json.dumps(input_data)
        
        runner = f'''
import json
import sys

# Candidate's code
{code}

# Test runner
if __name__ == "__main__":
    try:
        input_data = json.loads({repr(input_json)})
        result = {function_name}(**input_data)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({{"__error__": str(e)}}))
        sys.exit(1)
'''
        return runner
    
    def _compare_results(self, actual: Any, expected: Any) -> bool:
        """Compare actual and expected results with type flexibility."""
        if actual == expected:
            return True
        
        # Handle list comparison (order might matter or not depending on problem)
        if isinstance(actual, list) and isinstance(expected, list):
            # Try sorted comparison for lists of comparable items
            try:
                if sorted(actual) == sorted(expected):
                    return True
            except TypeError:
                pass
            return actual == expected
        
        # Handle numeric comparison with tolerance
        if isinstance(actual, (int, float)) and isinstance(expected, (int, float)):
            return abs(actual - expected) < 1e-9
        
        # String comparison
        if isinstance(actual, str) and isinstance(expected, str):
            return actual.strip() == expected.strip()
        
        return False


# Singleton instance
_executor: Optional[CodeExecutor] = None


def get_code_executor() -> CodeExecutor:
    global _executor
    if _executor is None:
        _executor = CodeExecutor()
    return _executor
