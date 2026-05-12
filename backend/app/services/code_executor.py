"""
Secure code execution service using HackerEarth Code Evaluation API v4.
Compiles and executes candidate code with full stdout/stderr, compilation
errors with line numbers, and detailed stack traces.

Falls back to local subprocess execution if HackerEarth API is unavailable.

Production execution model:
- Exactly ONE HackerEarth submission per Run/Submit call.
- The runner loops through ALL test cases and emits a structured JSON report.
- Python/JS/TS use fully self-contained interpreted runners.
- Java/C++/Go/Rust use built-in harnesses (no external wrapper_template needed).
- Testcase normalization prevents false Wrong Answers.
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
from dataclasses import dataclass

import logging

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

HE_API_URL = "https://api.hackerearth.com/v4/partner/code-evaluation/submissions/"
MAX_POLL_ATTEMPTS = 40
POLL_INTERVAL_SECONDS = 1.5

# Map frontend language names to HackerEarth language identifiers
LANGUAGE_MAP = {
    "python3": "PYTHON3",
    "python": "PYTHON3",
    "javascript": "JAVASCRIPT_NODE",
    "java": "JAVA14",
    "cpp": "CPP17",
    "cpp17": "CPP17",
    "c++": "CPP17",
    "c": "C",
    "typescript": "TYPESCRIPT",
    "csharp": "CSHARP",
    "go": "GO",
    "golang": "GO",
    "rust": "RUST",
    "kotlin": "KOTLIN",
    "ruby": "RUBY",
    "swift": "SWIFT",
    "scala": "SCALA",
}

# Languages that need a compiled harness (not pure interpreter)
COMPILED_LANGS = {"java", "cpp", "cpp17", "c++", "go", "golang", "rust"}


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
    """Execute code via HackerEarth Code Evaluation API v4.

    Production execution model:
    - Single submission per Run/Submit — the bundled runner loops all testcases.
    - Python/JS/TS: fully self-contained interpreted runners (no wrapper_template needed).
    - Java/C++/Go/Rust: built-in harnesses embedded here (no external wrapper_template needed).
    - wrapper_template (from problem.solution_wrappers[lang]) is used ONLY when explicitly provided
      by the problem author, overriding the built-in harness.
    """

    TIMEOUT_SECONDS = 10
    MAX_OUTPUT_SIZE = 50000

    def __init__(self):
        settings = get_settings()
        self.client_id = getattr(settings, "hackerearth_client_id", "")
        self.client_secret = getattr(settings, "hackerearth_client_secret", "")

    @property
    def _is_available(self) -> bool:
        return bool(self.client_id and self.client_secret)

    async def execute(
        self,
        code: str,
        test_cases: List[Dict[str, Any]],
        language: str = "python3",
        function_name: Optional[str] = None,
        execution_mode: Optional[str] = None,
        class_name: Optional[str] = None,
        parameter_schema: Optional[List[Dict[str, Any]]] = None,
        wrapper_template: Optional[str] = None,
    ) -> "ExecutionResult":
        """Execute code against test cases using single-submission bundled harness."""
        if not test_cases:
            return ExecutionResult(
                success=False, test_results=[], passed_count=0,
                total_count=0, score_percentage=0,
                compilation_error="No test cases provided",
            )

        lang_key = str(language).lower()

        # Normalise execution mode
        if execution_mode not in (None, "", "class", "function"):
            execution_mode = None
        if not execution_mode:
            execution_mode = None

        # Default class_name
        if execution_mode == "class" and not class_name:
            class_name = "Solution"

        if not isinstance(parameter_schema, list):
            parameter_schema = []

        # function_name is optional for all languages — harnesses auto-detect via reflection/introspection.

        he_lang = LANGUAGE_MAP.get(lang_key, "PYTHON3")

        if not self._is_available:
            return self._execute_local_bundle(
                code=code,
                test_cases=test_cases,
                language=lang_key,
                function_name=function_name,
                execution_mode=execution_mode,
                class_name=class_name,
                parameter_schema=parameter_schema,
            )

        return await self._run_bundle_he(
            code=code,
            test_cases=test_cases,
            he_lang=he_lang,
            frontend_lang=lang_key,
            function_name=function_name,
            execution_mode=execution_mode,
            class_name=class_name,
            parameter_schema=parameter_schema,
            wrapper_template=wrapper_template,
        )

    async def _run_bundle_he(
        self,
        *,
        code: str,
        test_cases: List[Dict[str, Any]],
        he_lang: str,
        frontend_lang: str,
        function_name: Optional[str],
        execution_mode: Optional[str],
        class_name: Optional[str],
        parameter_schema: List[Dict[str, Any]],
        wrapper_template: Optional[str],
    ) -> "ExecutionResult":
        try:
            source = self._build_bundle_runner_source(
                code=code,
                function_name=function_name or "",
                execution_mode=execution_mode,
                class_name=class_name,
                parameter_schema=parameter_schema,
                test_cases=test_cases,
                language=frontend_lang,
                wrapper_template=wrapper_template,
            )
        except Exception as build_err:
            return ExecutionResult(
                success=False, test_results=[], passed_count=0,
                total_count=len(test_cases), score_percentage=0,
                compilation_error=f"Runner build error: {build_err}",
            )

        logger.debug(
            "[HE] submitting lang=%s tc_count=%d source_len=%d",
            he_lang, len(test_cases), len(source),
        )

        try:
            async with httpx.AsyncClient(timeout=90.0) as client:
                resp = await client.post(
                    HE_API_URL,
                    json={
                        "lang": he_lang,
                        "source": source,
                        "input": "",
                        "time_limit": 10,
                        "memory_limit": 262144,
                    },
                    headers={
                        "client-id": self.client_id,
                        "client-secret": self.client_secret,
                        "content-type": "application/json",
                    },
                )

                if resp.status_code != 200:
                    try:
                        error_data = resp.json()
                    except Exception:
                        error_data = {}
                    error_msg = error_data.get("message", f"HackerEarth API error (HTTP {resp.status_code})")
                    logger.error("[HE] submission_failed status=%d msg=%s", resp.status_code, error_msg)
                    return ExecutionResult(
                        success=False, test_results=[], passed_count=0,
                        total_count=len(test_cases), score_percentage=0,
                        runtime_error=error_msg,
                    )

                data = resp.json()
                status_url = data.get("status_update_url", "")
                if not status_url:
                    return ExecutionResult(
                        success=False, test_results=[], passed_count=0,
                        total_count=len(test_cases), score_percentage=0,
                        runtime_error="HackerEarth API did not return status_update_url",
                    )

                logger.debug("[HE] polling status_url=%s", status_url)
                result_data = await self._poll_result(client, status_url)
                if result_data is None:
                    return ExecutionResult(
                        success=False, test_results=[], passed_count=0,
                        total_count=len(test_cases), score_percentage=0,
                        runtime_error="Execution timed out waiting for HackerEarth",
                    )

                return self._parse_he_bundle_result(result_data, test_cases)

        except httpx.TimeoutException:
            return ExecutionResult(
                success=False, test_results=[], passed_count=0,
                total_count=len(test_cases), score_percentage=0,
                runtime_error="Request to HackerEarth API timed out",
            )
        except Exception as e:
            logger.exception("[HE] unexpected error")
            return ExecutionResult(
                success=False, test_results=[], passed_count=0,
                total_count=len(test_cases), score_percentage=0,
                runtime_error=str(e),
            )

    async def _poll_result(
        self, client: httpx.AsyncClient, status_url: str
    ) -> Optional[Dict]:
        """Poll HackerEarth status endpoint until REQUEST_COMPLETED or failure."""
        for attempt in range(MAX_POLL_ATTEMPTS):
            await asyncio.sleep(POLL_INTERVAL_SECONDS)
            try:
                resp = await client.get(
                    status_url,
                    headers={"client-id": self.client_id, "client-secret": self.client_secret},
                )
                if resp.status_code != 200:
                    continue
                data = resp.json()
                status_code = data.get("request_status", {}).get("code", "")
                logger.debug("[HE] poll attempt=%d status=%s", attempt + 1, status_code)
                if status_code in ("REQUEST_COMPLETED", "REQUEST_FAILED"):
                    return data
                # Compilation error — return immediately instead of waiting
                if status_code == "CODE_COMPILED":
                    compile_status = data.get("result", {}).get("compile_status", "")
                    if compile_status and compile_status != "OK":
                        return data
            except Exception as poll_err:
                logger.debug("[HE] poll error attempt=%d: %s", attempt + 1, poll_err)
                continue
        logger.warning("[HE] poll timed out after %d attempts", MAX_POLL_ATTEMPTS)
        return None


    def _build_bundle_runner_source(
        self,
        *,
        code: str,
        function_name: str,
        execution_mode: Optional[str],
        class_name: Optional[str],
        parameter_schema: List[Dict[str, Any]],
        test_cases: List[Dict[str, Any]],
        language: str,
        wrapper_template: Optional[str],
    ) -> str:
        """Build a self-contained bundled runner that:
        1. Includes the candidate's code verbatim.
        2. Loops over all embedded test cases.
        3. Calls the target function/method with each test case's input.
        4. Normalizes and compares results to avoid false WA.
        5. Emits a JSON report after ---RESULT_SEPARATOR---.
        """
        # Embed testcases as escaped JSON literals in the source.
        tc_json = json.dumps(test_cases, ensure_ascii=False)
        ps_json = json.dumps(parameter_schema, ensure_ascii=False)
        mode = execution_mode or ""
        cls = class_name or "Solution"
        fn = function_name or ""

        # ── Problem-author custom wrapper (overrides built-in harness) ──────────
        if isinstance(wrapper_template, str) and wrapper_template.strip():
            return (
                wrapper_template
                .replace("{{CODE}}", code)
                .replace("{{TEST_CASES_JSON}}", tc_json)
                .replace("{{PARAM_SCHEMA_JSON}}", ps_json)
                .replace("{{FUNCTION_NAME}}", fn)
                .replace("{{EXECUTION_MODE}}", mode)
                .replace("{{CLASS_NAME}}", cls)
            )

        if language in ("python3", "python"):
            # Use repr() to safely embed values — then substitute via .replace()
            # NOT an f-string to avoid any { } parsing issues with template body.
            tc_repr = repr(tc_json)
            ps_repr = repr(ps_json)
            fn_repr = repr(fn)
            mode_repr = repr(mode)
            cls_repr = repr(cls)
            code_repr = repr(code)
            _TEMPLATE = (
                'import json\n'
                'import sys\n'
                'import traceback\n'
                'import re\n'
                'from math import isfinite\n'
                '\n'
                'TEST_CASES = json.loads(__TC_REPR__)\n'
                'PARAM_SCHEMA = json.loads(__PS_REPR__)\n'
                'FUNCTION_NAME = __FN_REPR__\n'
                'EXECUTION_MODE = __MODE_REPR__\n'
                'CLASS_NAME = __CLS_REPR__\n'
                '\n'
                'def _get_args(input_data, target=None):\n'
                '    import inspect as _inspect\n'
                '    unwrapped = input_data\n'
                '    if isinstance(input_data, dict) and list(input_data.keys()) == ["input"]:\n'
                '        unwrapped = input_data["input"]\n'
                '    if isinstance(input_data, dict):\n'
                '        if target is not None:\n'
                '            try:\n'
                '                sig = _inspect.signature(target)\n'
                '                param_names = [\n'
                '                    p for p in sig.parameters\n'
                '                    if p not in ("self", "cls") and sig.parameters[p].kind not in\n'
                '                    (_inspect.Parameter.VAR_POSITIONAL, _inspect.Parameter.VAR_KEYWORD)\n'
                '                ]\n'
                '                if param_names:\n'
                '                    if len(param_names) == 1:\n'
                '                        return [unwrapped]\n'
                '                    if isinstance(unwrapped, list) and len(unwrapped) == len(param_names):\n'
                '                        return list(unwrapped)\n'
                '                    if isinstance(unwrapped, dict):\n'
                '                        if all(p in unwrapped for p in param_names):\n'
                '                            return [unwrapped[p] for p in param_names]\n'
                '                        return list(unwrapped.values())\n'
                '                    if isinstance(input_data, dict) and all(p in input_data for p in param_names):\n'
                '                        return [input_data[p] for p in param_names]\n'
                '                    return list(unwrapped.values()) if isinstance(unwrapped, dict) else [unwrapped]\n'
                '            except Exception:\n'
                '                pass\n'
                '        if PARAM_SCHEMA:\n'
                '            src = unwrapped if isinstance(unwrapped, dict) else input_data\n'
                '            if isinstance(src, dict):\n'
                '                _pnames = [p.get("name") for p in PARAM_SCHEMA if p.get("name")]\n'
                '                if _pnames and all(n in src for n in _pnames) and len(_pnames) == len(src):\n'
                '                    return [src[n] for n in _pnames]\n'
                '                return list(src.values())\n'
                '            return [src.get(p.get("name")) for p in PARAM_SCHEMA]\n'
                '        if isinstance(unwrapped, dict):\n'
                '            return list(unwrapped.values())\n'
                '        if isinstance(unwrapped, list):\n'
                '            return unwrapped\n'
                '        if unwrapped is not input_data:\n'
                '            return [unwrapped]\n'
                '        return list(input_data.values())\n'
                '    if isinstance(input_data, (list, tuple)):\n'
                '        return list(input_data)\n'
                '    return [input_data]\n'
                '\n'
                'def _nv(v, d=0):\n'
                '    if d > 8:\n'
                '        return v\n'
                '    if isinstance(v, str):\n'
                '        s = v.strip()\n'
                '        for _ in range(4):\n'
                '            st = s.strip()\n'
                '            if not st:\n'
                '                break\n'
                '            if not ((st.startswith("{") and st.endswith("}")) or (st.startswith("[") and st.endswith("]")) or (st.startswith(\'"\') and st.endswith(\'"\') )):\n'
                '                break\n'
                '            try:\n'
                '                parsed = json.loads(st)\n'
                '                if isinstance(parsed, str):\n'
                '                    s = parsed\n'
                '                    continue\n'
                '                return _nv(parsed, d + 1)\n'
                '            except Exception:\n'
                '                break\n'
                '        sl = s.lower()\n'
                '        if sl == "true": return True\n'
                '        if sl == "false": return False\n'
                '        if sl in ("null", "none"): return None\n'
                '        try:\n'
                r'            if re.match(r"^[+-]?(\d+\.?\d*|\d*\.?\d+)([eE][+-]?\d+)?$", s):' + '\n'
                '                n = float(s)\n'
                '                return int(n) if abs(n - round(n)) < 1e-12 else n\n'
                '        except Exception:\n'
                '            pass\n'
                '        return s\n'
                '    if v is None: return None\n'
                '    if isinstance(v, bool): return v\n'
                '    if isinstance(v, float):\n'
                '        return str(v) if not isfinite(v) else v\n'
                '    if isinstance(v, int): return v\n'
                '    if isinstance(v, (list, tuple)):\n'
                '        return [_nv(x, d + 1) for x in v]\n'
                '    if isinstance(v, dict):\n'
                '        return {str(k): _nv(v[k], d + 1) for k in sorted(str(kk) for kk in v.keys())}\n'
                '    return v\n'
                '\n'
                'def _eq(a, b):\n'
                '    if isinstance(a, (int, float)) and isinstance(b, (int, float)):\n'
                '        try: return abs(float(a) - float(b)) <= 1e-6\n'
                '        except: return a == b\n'
                '    if isinstance(a, list) and isinstance(b, list):\n'
                '        return len(a) == len(b) and all(_eq(x, y) for x, y in zip(a, b))\n'
                '    return a == b\n'
                '\n'
                'def _cmp(actual, expected):\n'
                '    return _eq(_nv(actual), _nv(expected))\n'
                '\n'
                'if __name__ == "__main__":\n'
                '    import io as _io\n'
                '    _real_stdin = sys.stdin\n'
                '    sys.stdin = _io.StringIO("")\n'
                '    report = {"success": True, "status": "accepted", "score": 0, "testcases": []}\n'
                '    try:\n'
                '        namespace = {}\n'
                '        exec(compile(__CODE_REPR__, "<candidate_code>", "exec"), namespace)\n'
                '        sys.stdin = _real_stdin\n'
                '        if EXECUTION_MODE == "class":\n'
                '            klass = namespace.get(CLASS_NAME)\n'
                '            if klass is None:\n'
                '                klass = next((v for v in namespace.values() if isinstance(v, type) and not v.__name__.startswith("_")), None)\n'
                '            if klass is None:\n'
                '                raise NameError("Class \'" + CLASS_NAME + "\' not found in submitted code")\n'
                '            inst = klass()\n'
                '            if FUNCTION_NAME:\n'
                '                target = getattr(inst, FUNCTION_NAME, None)\n'
                '            else:\n'
                '                target = None\n'
                '            if target is None:\n'
                '                import inspect as _insp\n'
                '                target = next(\n'
                '                    (getattr(inst, m) for m in dir(inst)\n'
                '                     if not m.startswith("_") and callable(getattr(inst, m, None))\n'
                '                     and not isinstance(getattr(type(inst), m, None), (staticmethod, classmethod))),\n'
                '                    None\n'
                '                )\n'
                '            if target is None:\n'
                '                raise AttributeError("No callable method found on \'" + CLASS_NAME + "\'")\n'
                '        elif FUNCTION_NAME:\n'
                '            target = namespace.get(FUNCTION_NAME)\n'
                '            if target is None:\n'
                '                if "Solution" in namespace:\n'
                '                    inst = namespace["Solution"]()\n'
                '                    target = getattr(inst, FUNCTION_NAME, None) or next(\n'
                '                        (getattr(inst, m) for m in dir(inst) if not m.startswith("_") and callable(getattr(inst, m))), None\n'
                '                    )\n'
                '                if target is None:\n'
                '                    raise NameError("Function \'" + FUNCTION_NAME + "\' not found in submitted code")\n'
                '        else:\n'
                '            if "Solution" in namespace:\n'
                '                inst = namespace["Solution"]()\n'
                '                target = next((getattr(inst, m) for m in dir(inst) if not m.startswith("_") and callable(getattr(inst, m))), None)\n'
                '            else:\n'
                '                target = next((v for v in namespace.values() if callable(v) and not isinstance(v, type)), None)\n'
                '            if target is None:\n'
                '                raise NameError("Could not find a callable function in submitted code")\n'
                '        _real_stdout = sys.stdout\n'
                '        passed = 0\n'
                '        for idx, tc in enumerate(TEST_CASES):\n'
                '            input_data = tc.get("input")\n'
                '            expected = tc.get("expected")\n'
                '            tr = {"index": idx, "input": input_data, "expected": expected, "actual": None,\n'
                '                  "passed": False, "status": "NA", "stdout": "", "stderr": "", "error": None}\n'
                '            try:\n'
                '                if input_data is None:\n'
                '                    raise ValueError("Testcase input is None")\n'
                '                _inp_kw = input_data\n'
                '                if isinstance(_inp_kw, dict) and list(_inp_kw.keys()) == ["input"]:\n'
                '                    _inp_kw = _inp_kw["input"]\n'
                '                _cap = _io.StringIO()\n'
                '                sys.stdout = _cap\n'
                '                try:\n'
                '                    if isinstance(_inp_kw, dict):\n'
                '                        import inspect as _insp_kw\n'
                '                        try:\n'
                '                            _sig_kw = _insp_kw.signature(target)\n'
                '                            _pk_kw = [k for k in _sig_kw.parameters if k not in ("self", "cls")]\n'
                '                            if _pk_kw and all(k in _inp_kw for k in _pk_kw):\n'
                '                                result = target(**{k: _inp_kw[k] for k in _pk_kw})\n'
                '                            elif _pk_kw:\n'
                '                                result = target(*list(_inp_kw.values()))\n'
                '                            else:\n'
                '                                result = target(*_get_args(input_data, target))\n'
                '                        except TypeError:\n'
                '                            result = target(**_inp_kw)\n'
                '                        except Exception:\n'
                '                            result = target(*_get_args(input_data, target))\n'
                '                    else:\n'
                '                        result = target(*_get_args(input_data, target))\n'
                '                finally:\n'
                '                    sys.stdout = _real_stdout\n'
                '                tr["stdout"] = _cap.getvalue()\n'
                '                tr["actual"] = result\n'
                '                tr["passed"] = _cmp(result, expected)\n'
                '                tr["status"] = "AC" if tr["passed"] else "WA"\n'
                '                if not tr["passed"]:\n'
                '                    tr["stderr"] = json.dumps({"norm_actual": _nv(result), "norm_expected": _nv(expected)}, ensure_ascii=False)\n'
                '                if tr["passed"]:\n'
                '                    passed += 1\n'
                '            except Exception as exc:\n'
                '                sys.stdout = _real_stdout\n'
                '                tr["status"] = "RE"\n'
                '                tr["error"] = str(exc)\n'
                '                tr["stderr"] = traceback.format_exc()\n'
                '            report["testcases"].append(tr)\n'
                '        total = len(TEST_CASES)\n'
                '        report["score"] = round(passed / total * 100, 2) if total else 0\n'
                '        report["success"] = passed == total and total > 0\n'
                '        report["status"] = "accepted" if report["success"] else "wrong_answer"\n'
                '    except Exception:\n'
                '        report["success"] = False\n'
                '        report["status"] = "compile_error"\n'
                '        report["stderr"] = traceback.format_exc()\n'
                '    print("---RESULT_SEPARATOR---")\n'
                '    print(json.dumps(report, ensure_ascii=False))\n'
            )
            return (
                _TEMPLATE
                .replace('__TC_REPR__', tc_repr)
                .replace('__PS_REPR__', ps_repr)
                .replace('__FN_REPR__', fn_repr)
                .replace('__MODE_REPR__', mode_repr)
                .replace('__CLS_REPR__', cls_repr)
                .replace('__CODE_REPR__', code_repr)
            )

        if language in ("javascript", "typescript"):
            tc_js = json.dumps(tc_json)
            ps_js = json.dumps(ps_json)
            fn_js = json.dumps(fn)
            mode_js = json.dumps(mode)
            cls_js = json.dumps(cls)
            return f'''// ---- Candidate code ----
{code}
// ---- End candidate code ----

const TEST_CASES = JSON.parse({tc_js});
const PARAM_SCHEMA = JSON.parse({ps_js});
const FUNCTION_NAME = {fn_js};
const EXECUTION_MODE = {mode_js};
const CLASS_NAME = {cls_js};

function getArgs(inputData) {{
  if (inputData !== null && typeof inputData === 'object' && !Array.isArray(inputData)) {{
    if (Array.isArray(PARAM_SCHEMA) && PARAM_SCHEMA.length > 0) {{
      return PARAM_SCHEMA.map((p) => inputData[p.name]);
    }}
    const keys = Object.keys(inputData);
    if (keys.length === 1 && keys[0] === 'input') return [inputData.input];
    return Object.values(inputData);
  }}
  if (Array.isArray(inputData)) return inputData;
  return [inputData];
}}

function _nv(v, d) {{
  d = d || 0;
  if (d > 8) return v;
  if (typeof v === 'string') {{
    let cur = v;
    for (let i = 0; i < 4; i++) {{
      const t = String(cur).trim();
      if (!t) break;
      if (!((t[0] === '{{' && t[t.length-1] === '}}') || (t[0]==='[' && t[t.length-1]===']') || (t[0]==='"' && t[t.length-1]==='"'))) break;
      try {{ const p = JSON.parse(t); if (typeof p === 'string') {{ cur = p; continue; }} return _nv(p, d+1); }} catch {{ break; }}
    }}
    const s = String(cur).trim();
    const sl = s.toLowerCase();
    if (sl === 'true') return true;
    if (sl === 'false') return false;
    if (sl === 'null' || sl === 'none') return null;
    if (/^[+-]?(?:\\d+\\.?\\d*|\\d*\\.?\\d+)(?:[eE][+-]?\\d+)?$/.test(s)) {{ const n = Number(s); if (Number.isFinite(n)) return n; }}
    return s;
  }}
  if (v === null || typeof v === 'undefined') return null;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v;
  if (Array.isArray(v)) return v.map((x) => _nv(x, d+1));
  if (typeof v === 'object') {{
    const out = {{}};
    Object.keys(v).sort().forEach((k) => {{ out[k] = _nv(v[k], d+1); }});
    return out;
  }}
  return v;
}}

function _eq(a, b) {{
  if (typeof a === 'number' && typeof b === 'number') {{
    if (!Number.isFinite(a) || !Number.isFinite(b)) return String(a) === String(b);
    return Math.abs(a - b) <= 1e-6;
  }}
  if (Array.isArray(a) && Array.isArray(b)) {{
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!_eq(a[i], b[i])) return false;
    return true;
  }}
  return JSON.stringify(a) === JSON.stringify(b);
}}

function _cmp(actual, expected) {{ return _eq(_nv(actual), _nv(expected)); }}

const report = {{ success: true, status: 'accepted', score: 0, testcases: [] }};

function resolveTarget() {{
  if (EXECUTION_MODE === 'class') {{
    const Klass = typeof globalThis[CLASS_NAME] !== 'undefined' ? globalThis[CLASS_NAME] : null;
    if (!Klass) throw new Error(`Class '${{CLASS_NAME}}' not found`);
    const inst = new Klass();
    if (typeof inst[FUNCTION_NAME] !== 'function') throw new Error(`Method '${{FUNCTION_NAME}}' not found`);
    return inst[FUNCTION_NAME].bind(inst);
  }}
  if (FUNCTION_NAME) {{
    if (typeof globalThis[FUNCTION_NAME] === 'function') return globalThis[FUNCTION_NAME];
    // Try class Solution fallback
    if (typeof globalThis.Solution !== 'undefined') {{
      const inst = new globalThis.Solution();
      if (typeof inst[FUNCTION_NAME] === 'function') return inst[FUNCTION_NAME].bind(inst);
    }}
    throw new Error(`Function '${{FUNCTION_NAME}}' not found`);
  }}
  // Auto-detect
  if (typeof globalThis.Solution !== 'undefined') {{
    const inst = new globalThis.Solution();
    const m = Object.getOwnPropertyNames(Object.getPrototypeOf(inst)).find((k) => k !== 'constructor' && typeof inst[k] === 'function');
    if (m) return inst[m].bind(inst);
  }}
  throw new Error('No callable function found in submitted code');
}}

try {{
  const target = resolveTarget();
  let passed = 0;
  for (let i = 0; i < TEST_CASES.length; i++) {{
    const tc = TEST_CASES[i] || {{}};
    const inputData = tc.input;
    const expected = tc.expected;
    const tr = {{ index: i, input: inputData, expected, actual: null, passed: false, status: 'NA', stdout: '', stderr: '', error: null }};
    try {{
      if (inputData === null || inputData === undefined) throw new Error('Testcase input is null');
      const args = getArgs(inputData);
      const result = target(...args);
      tr.actual = result;
      tr.passed = _cmp(result, expected);
      tr.status = tr.passed ? 'AC' : 'WA';
      if (!tr.passed) tr.stderr = JSON.stringify({{ norm_actual: _nv(result), norm_expected: _nv(expected) }});
      if (tr.passed) passed++;
    }} catch (e) {{
      tr.status = 'RE';
      tr.error = e && e.message ? e.message : String(e);
      tr.stderr = e && e.stack ? e.stack : String(e);
    }}
    report.testcases.push(tr);
  }}
  const total = TEST_CASES.length;
  report.score = total ? Math.round(passed / total * 10000) / 100 : 0;
  report.success = passed === total && total > 0;
  report.status = report.success ? 'accepted' : 'wrong_answer';
}} catch (e) {{
  report.success = false;
  report.status = 'compile_error';
  report.stderr = e && e.stack ? e.stack : (e && e.message ? e.message : String(e));
}}

console.log('---RESULT_SEPARATOR---');
console.log(JSON.stringify(report));
'''

        if language == "java":
            def _java_str_escape(s: str) -> str:
                return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n").replace("\r", "").replace("\t", "\\t")
            tc_java = _java_str_escape(tc_json)
            ps_java = _java_str_escape(ps_json)
            def _sanitize_java_wrapper(text: str) -> str:
                """Replace non-ASCII characters with ASCII equivalents in autogenerated Java wrapper code."""
                _replacements = [
                    ('\u2014', '-'), ('\u2013', '-'), ('\u2018', "'"), ('\u2019', "'"),
                    ('\u201c', '"'), ('\u201d', '"'), ('\u2500', '-'), ('\u2026', '...'),
                ]
                for _u, _a in _replacements:
                    text = text.replace(_u, _a)
                return text.encode('ascii', errors='ignore').decode('ascii')
            _JAVA_CODE_MARKER = "__JAVA_USER_CODE__"
            _java_tpl = f'''import java.util.*;
import java.lang.reflect.*;

{_JAVA_CODE_MARKER}

public class Main {{
    private static final String TC_JSON = "{tc_java}";
    private static final String FUNCTION_NAME = "{fn}";
    private static final String EXECUTION_MODE = "{mode}";
    private static final String CLASS_NAME = "{cls if cls else "Solution"}";

    // --- Minimal stdlib-only JSON value wrapper ---
    static class JVal {{
        Object v; // null | Boolean | Number | String | List<JVal> | Map<String,JVal>
        JVal(Object v) {{ this.v = v; }}
        boolean isNull() {{ return v == null; }}
        boolean isArr() {{ return v instanceof List; }}
        boolean isObj() {{ return v instanceof Map; }}
        @SuppressWarnings("unchecked") List<JVal> arr() {{ return (List<JVal>) v; }}
        @SuppressWarnings("unchecked") Map<String,JVal> obj() {{ return (Map<String,JVal>) v; }}
        JVal get(String k) {{ return isObj() ? obj().getOrDefault(k, new JVal(null)) : new JVal(null); }}
        JVal get(int i) {{ return isArr() && i < arr().size() ? arr().get(i) : new JVal(null); }}
        int size() {{ return isArr() ? arr().size() : isObj() ? obj().size() : 0; }}
        double asDouble() {{
            if (v instanceof Number) return ((Number)v).doubleValue();
            try {{ return Double.parseDouble(v.toString()); }} catch(Exception e) {{ return 0; }}
        }}
        int asInt() {{ return (int) asDouble(); }}
        long asLong() {{ return (long) asDouble(); }}
        boolean asBool() {{ return Boolean.TRUE.equals(v) || "true".equalsIgnoreCase(v+""); }}
        String asStr() {{ return v == null ? "null" : v.toString(); }}
        public String toString() {{
            if (v == null) return "null";
            if (isArr()) {{
                StringBuilder sb = new StringBuilder("[");
                for (int i=0; i<arr().size(); i++) {{ if(i>0) sb.append(","); sb.append(arr().get(i)); }} sb.append("]"); return sb.toString();
            }}
            if (isObj()) {{
                StringBuilder sb = new StringBuilder("{{");
                boolean first = true;
                for (Map.Entry<String,JVal> e : obj().entrySet()) {{ if(!first) sb.append(","); sb.append("\\"").append(e.getKey()).append("\\":").append(e.getValue()); first=false; }} sb.append("}}"); return sb.toString();
            }}
            if (v instanceof String) return "\\"" + ((String)v).replace("\\\\","\\\\\\\\").replace("\\"","\\\\\\"") + "\\"";
            return v.toString();
        }}
    }}

    // --- Minimal JSON parser ---
    static class JP {{
        final String s; int p;
        JP(String s) {{ this.s = s.trim(); this.p = 0; }}
        void ws() {{ while (p < s.length() && Character.isWhitespace(s.charAt(p))) p++; }}
        JVal parse() {{ ws(); if (p >= s.length()) return new JVal(null); char c = s.charAt(p); if (c=='"') return parseStr(); if (c=='[') return parseArr(); if (c=='{{') return parseObj(); if (c=='t') {{ p+=4; return new JVal(Boolean.TRUE); }} if (c=='f') {{ p+=5; return new JVal(Boolean.FALSE); }} if (c=='n') {{ p+=4; return new JVal(null); }} return parseNum(); }}
        JVal parseStr() {{ p++; StringBuilder sb=new StringBuilder(); while(p<s.length()){{ char c=s.charAt(p++); if(c=='"') break; if(c=='\\\\'){{ if(p<s.length()){{ char e=s.charAt(p++); if(e=='"') sb.append('"'); else if(e=='n') sb.append('\\n'); else if(e=='r') sb.append('\\r'); else if(e=='t') sb.append('\\t'); else if(e=='\\\\') sb.append('\\\\'); else sb.append(e); }} }} else sb.append(c); }} return new JVal(sb.toString()); }}
        JVal parseArr() {{ p++; List<JVal> list=new ArrayList<>(); ws(); if(p<s.length()&&s.charAt(p)==']'){{p++;return new JVal(list);}} while(p<s.length()){{ list.add(parse()); ws(); if(p<s.length()&&s.charAt(p)==',') p++; else break; }} if(p<s.length()&&s.charAt(p)==']') p++; return new JVal(list); }}
        JVal parseObj() {{ p++; Map<String,JVal> map=new LinkedHashMap<>(); ws(); if(p<s.length()&&s.charAt(p)=='}}'){{p++;return new JVal(map);}} while(p<s.length()){{ ws(); JVal k=parseStr(); ws(); if(p<s.length()&&s.charAt(p)==':') p++; JVal v=parse(); map.put(k.asStr().replaceAll("^\\"|\\"$",""),v); ws(); if(p<s.length()&&s.charAt(p)==',') p++; else break; }} if(p<s.length()&&s.charAt(p)=='}}') p++; return new JVal(map); }}
        JVal parseNum() {{ int start=p; while(p<s.length()){{ char c=s.charAt(p); if(Character.isDigit(c)||c=='.'||c=='-'||c=='+'||c=='e'||c=='E') p++; else break; }} String tok=s.substring(start,p); try{{ if(tok.contains(".")||tok.contains("e")||tok.contains("E")) return new JVal(Double.parseDouble(tok)); long lv=Long.parseLong(tok); return new JVal(lv<=Integer.MAX_VALUE&&lv>=Integer.MIN_VALUE?(Integer)(int)lv:(Long)lv); }}catch(Exception e){{ return new JVal(tok); }} }}
    }}

    static JVal parseJSON(String src) {{ return new JP(src).parse(); }}

    public static void main(String[] args) {{
        StringBuilder report = new StringBuilder();
        boolean globalSuccess = true;
        String globalStatus = "accepted";
        String globalStderr = "";
        List<String> tcResults = new ArrayList<>();

        java.io.PrintStream _realOut = System.out;
        try {{
            JVal tcArr = parseJSON(TC_JSON);
            int passed = 0;
            int total = tcArr.size();
            for (int i = 0; i < total; i++) {{
                JVal tc = tcArr.get(i);
                JVal input = tc.get("input");
                JVal expected = tc.get("expected");
                String trStatus = "NA";
                String trActual = "null";
                boolean trPassed = false;
                String trError = "null";
                String trStderr = "";
                String trStdout = "";
                java.io.ByteArrayOutputStream _cap = new java.io.ByteArrayOutputStream();
                System.setOut(new java.io.PrintStream(_cap));
                try {{
                    Object result = invoke(input);
                    System.setOut(_realOut);
                    trStdout = _cap.toString();
                    trActual = toJsonStr(result);
                    trPassed = normalizeAndCompare(result, expected);
                    trStatus = trPassed ? "AC" : "WA";
                    if (trPassed) passed++;
                }} catch (Exception ex) {{
                    System.setOut(_realOut);
                    trStdout = _cap.toString();
                    trStatus = "RE";
                    trError = jsonStrLit(ex.getMessage() == null ? ex.getClass().getName() : ex.getMessage());
                    trStderr = jsonStrLit(ex.toString());
                }}
                tcResults.add("{{\\"index\\":" + i + ",\\"input\\":" + input + ",\\"expected\\":" + expected + ",\\"actual\\":" + trActual + ",\\"passed\\":" + trPassed + ",\\"status\\":" + jsonStrLit(trStatus) + ",\\"stdout\\":" + jsonStrLit(trStdout) + ",\\"stderr\\":" + jsonStrLit(trStderr) + ",\\"error\\":" + trError + "}}");
            }}
            double score = total > 0 ? Math.round(passed * 10000.0 / total) / 100.0 : 0;
            globalSuccess = passed == total && total > 0;
            globalStatus = globalSuccess ? "accepted" : "wrong_answer";
            report.append("{{\\"success\\":").append(globalSuccess).append(",\\"status\\":\\"").append(globalStatus).append("\\",\\"score\\":").append(score).append(",\\"testcases\\":[");
            for (int i = 0; i < tcResults.size(); i++) {{ if (i > 0) report.append(","); report.append(tcResults.get(i)); }}
            report.append("]}}");
        }} catch (Exception ex) {{
            report = new StringBuilder("{{\\"success\\":false,\\"status\\":\\"compile_error\\",\\"score\\":0,\\"testcases\\":[],\\"stderr\\":").append(jsonStrLit(ex.toString())).append("}}");
        }}
        System.out.println("---RESULT_SEPARATOR---");
        System.out.println(report.toString());
    }}

    static String jsonStrLit(String s) {{
        if (s == null) return "null";
        return "\\"" + s.replace("\\\\","\\\\\\\\").replace("\\"","\\\\\\"").replace("\\n","\\\\n").replace("\\r","").replace("\\t","\\\\t") + "\\"";
    }}

    static String toJsonStr(Object v) {{
        if (v == null) return "null";
        if (v instanceof Boolean) return v.toString();
        if (v instanceof Number) return v.toString();
        if (v instanceof String) return jsonStrLit((String) v);
        if (v instanceof int[]) {{ int[] a=(int[])v; StringBuilder sb=new StringBuilder("["); for(int i=0;i<a.length;i++){{if(i>0)sb.append(",");sb.append(a[i]);}} sb.append("]"); return sb.toString(); }}
        if (v instanceof long[]) {{ long[] a=(long[])v; StringBuilder sb=new StringBuilder("["); for(int i=0;i<a.length;i++){{if(i>0)sb.append(",");sb.append(a[i]);}} sb.append("]"); return sb.toString(); }}
        if (v instanceof double[]) {{ double[] a=(double[])v; StringBuilder sb=new StringBuilder("["); for(int i=0;i<a.length;i++){{if(i>0)sb.append(",");sb.append(a[i]);}} sb.append("]"); return sb.toString(); }}
        if (v instanceof String[]) {{ String[] a=(String[])v; StringBuilder sb=new StringBuilder("["); for(int i=0;i<a.length;i++){{if(i>0)sb.append(",");sb.append(jsonStrLit(a[i]));}} sb.append("]"); return sb.toString(); }}
        if (v instanceof int[][]) {{ int[][] a=(int[][])v; StringBuilder sb=new StringBuilder("["); for(int i=0;i<a.length;i++){{if(i>0)sb.append(",");sb.append(toJsonStr(a[i]));}} sb.append("]"); return sb.toString(); }}
        if (v instanceof char[]) {{ char[] a=(char[])v; StringBuilder sb=new StringBuilder("["); for(int i=0;i<a.length;i++){{if(i>0)sb.append(",");sb.append(jsonStrLit(String.valueOf(a[i])));}} sb.append("]"); return sb.toString(); }}
        if (v instanceof char[][]) {{ char[][] a=(char[][])v; StringBuilder sb=new StringBuilder("["); for(int i=0;i<a.length;i++){{if(i>0)sb.append(",");sb.append(toJsonStr(a[i]));}} sb.append("]"); return sb.toString(); }}
        if (v instanceof List) {{ List<?> a=(List<?>)v; StringBuilder sb=new StringBuilder("["); for(int i=0;i<a.size();i++){{if(i>0)sb.append(",");sb.append(toJsonStr(a.get(i)));}} sb.append("]"); return sb.toString(); }}
        return jsonStrLit(v.toString());
    }}

    private static Object invoke(JVal input) throws Exception {{
        String solName = CLASS_NAME.isEmpty() ? "Solution" : CLASS_NAME;
        Class<?> solClass = Class.forName(solName);
        Object inst = solClass.getDeclaredConstructor().newInstance();
        Method[] methods = solClass.getDeclaredMethods();
        Method target = null;
        for (Method m : methods) {{
            if (!FUNCTION_NAME.isEmpty() && m.getName().equals(FUNCTION_NAME)) {{ target = m; break; }}
            if (FUNCTION_NAME.isEmpty() && !m.getName().equals("main")) {{ target = m; break; }}
        }}
        if (target == null) throw new NoSuchMethodException("Method not found: " + FUNCTION_NAME);
        target.setAccessible(true);
        Object[] callArgs = buildArgs(input, target.getParameterTypes());
        return target.invoke(inst, callArgs);
    }}

    private static Object[] buildArgs(JVal input, Class<?>[] paramTypes) {{
        List<Object> argList = new ArrayList<>();
        if (input.isObj()) {{
            if (paramTypes.length == 1) {{
                JVal inner = input.get("input");
                if (inner.isNull() && input.size() == 1) {{
                    inner = input.obj().values().iterator().next();
                }}
                argList.add(convert(inner.isNull() ? input : inner, paramTypes[0]));
            }} else {{
                // Unwrap {{"input":...}} wrapper for multi-param methods
                JVal src = input;
                if (src.isObj() && src.size() == 1 && !src.get("input").isNull()) src = src.get("input");
                if (src.isObj()) {{
                    List<String> keys = new ArrayList<>(src.obj().keySet());
                    for (int i = 0; i < keys.size() && i < paramTypes.length; i++) {{
                        argList.add(convert(src.get(keys.get(i)), paramTypes[i]));
                    }}
                }} else if (src.isArr()) {{
                    for (int i = 0; i < src.size() && i < paramTypes.length; i++) {{
                        argList.add(convert(src.get(i), paramTypes[i]));
                    }}
                }}
            }}
        }} else if (input.isArr()) {{
            for (int i = 0; i < input.size() && i < paramTypes.length; i++) {{
                argList.add(convert(input.get(i), paramTypes[i]));
            }}
        }} else {{
            if (paramTypes.length > 0) argList.add(convert(input, paramTypes[0]));
        }}
        while (argList.size() < paramTypes.length) argList.add(null);
        return argList.toArray();
    }}

    private static Object convert(JVal v, Class<?> t) {{
        if (v.isNull()) return null;
        if (t == int.class || t == Integer.class) return v.asInt();
        if (t == long.class || t == Long.class) return v.asLong();
        if (t == double.class || t == Double.class) return v.asDouble();
        if (t == boolean.class || t == Boolean.class) return v.asBool();
        if (t == String.class) return v.isNull() ? null : (v.v instanceof String ? (String)v.v : v.asStr());
        if (t == int[].class && v.isArr()) {{
            int[] r = new int[v.size()];
            for (int i=0; i<v.size(); i++) r[i]=v.get(i).asInt(); return r;
        }}
        if (t == long[].class && v.isArr()) {{
            long[] r = new long[v.size()];
            for (int i=0; i<v.size(); i++) r[i]=v.get(i).asLong(); return r;
        }}
        if (t == String[].class && v.isArr()) {{
            String[] r = new String[v.size()];
            for (int i=0; i<v.size(); i++) r[i]=v.get(i).asStr(); return r;
        }}
        if (t == int[][].class && v.isArr()) {{
            int[][] r = new int[v.size()][];
            for (int i=0; i<v.size(); i++) {{ JVal row=v.get(i); r[i]=new int[row.size()]; for(int j=0;j<row.size();j++) r[i][j]=row.get(j).asInt(); }} return r;
        }}
        if (t == char.class || t == Character.class) {{ String sv=v.asStr(); return sv!=null&&sv.length()>0?sv.charAt(0):(char)v.asInt(); }}
        if (t == char[].class && v.isArr()) {{
            char[] r=new char[v.size()];
            for(int i=0;i<v.size();i++){{JVal e=v.get(i);String sv=e.asStr();r[i]=sv!=null&&sv.length()>0?sv.charAt(0):(char)e.asInt();}}
            return r;
        }}
        if (t == char[][].class && v.isArr()) {{
            char[][] r=new char[v.size()][];
            for(int i=0;i<v.size();i++){{JVal row=v.get(i);r[i]=new char[row.size()];for(int j=0;j<row.size();j++){{JVal e=row.get(j);String sv=e.asStr();r[i][j]=sv!=null&&sv.length()>0?sv.charAt(0):(char)e.asInt();}}}}
            return r;
        }}
        if (t == List.class) {{
            List<Object> list = new ArrayList<>();
            if (v.isArr()) for (int i=0; i<v.size(); i++) list.add(v.get(i).v);
            return list;
        }}
        if (t.isArray()) return java.lang.reflect.Array.newInstance(t.getComponentType(), 0);
        String tn = t.getSimpleName();
        if (tn.equals("int")||tn.equals("Integer")) return v.asInt();
        if (tn.equals("long")||tn.equals("Long")) return v.asLong();
        if (tn.equals("double")||tn.equals("Double")||tn.equals("float")||tn.equals("Float")) return v.asDouble();
        if (tn.equals("boolean")||tn.equals("Boolean")) return v.asBool();
        if (tn.equals("String")) return v.asStr();
        return v.v;
    }}

    private static boolean normalizeAndCompare(Object result, JVal expected) {{
        // Direct value comparison first - avoids any JSON serialization edge cases
        if (result instanceof String && expected.v instanceof String) {{
            if (((String)result).equals((String)expected.v)) return true;
        }}
        if (result instanceof Boolean && expected.v instanceof Boolean) {{
            return result.equals(expected.v);
        }}
        if (result instanceof Number && expected.v instanceof Number) {{
            try {{ return Math.abs(((Number)result).doubleValue() - ((Number)expected.v).doubleValue()) < 1e-6; }} catch(Exception e) {{}}
        }}
        String sa = toJsonStr(result).trim();
        String sb = expected.toString().trim();
        if (sa.equals(sb)) return true;
        // strip outer quotes for string comparison
        String ua = sa.startsWith("\\"") && sa.endsWith("\\"") ? sa.substring(1, sa.length()-1) : sa;
        String ub = sb.startsWith("\\"") && sb.endsWith("\\"") ? sb.substring(1, sb.length()-1) : sb;
        if (ua.equals(ub)) return true;
        // numeric tolerance
        try {{ return Math.abs(Double.parseDouble(ua) - Double.parseDouble(ub)) < 1e-6; }} catch(Exception e) {{}}
        return false;
    }}
}}
'''
            return _sanitize_java_wrapper(_java_tpl).replace(_JAVA_CODE_MARKER, code)

        if language in ("cpp", "cpp17", "c++"):
            # Escape the JSON strings for embedding as C++ string literals
            def _cpp_str_escape(s: str) -> str:
                return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n").replace("\r", "")

            tc_cpp = _cpp_str_escape(tc_json)
            ps_cpp = _cpp_str_escape(ps_json)

            # Derive fn_call from submitted code if not provided
            _fn_call = fn
            if not _fn_call:
                import re as _re
                # Look for first public method inside class Solution
                _m = _re.search(r'\bclass\s+Solution\b[\s\S]*?\b(?:public\s*:[\s\S]*?)?\b\w[\w\s*&<>]*\s+(\w+)\s*\(', code)
                if _m:
                    _candidate = _m.group(1)
                    # Skip keywords that aren't method names
                    if _candidate not in ("Solution", "public", "private", "protected", "class", "struct", "return"):
                        _fn_call = _candidate
                if not _fn_call:
                    # Fallback: any non-constructor public method
                    _m2 = _re.search(r'\b(?:int|long|bool|string|vector|double|void)\s+(\w+)\s*\(', code)
                    if _m2:
                        _fn_call = _m2.group(1)
            fn_call = _fn_call or "solve"
            fn_cpp = _cpp_str_escape(fn_call)
            # Build C++ source using string concat to avoid f-string brace conflicts
            cpp_src = (
                '#include <bits/stdc++.h>\n'
                'using namespace std;\n\n'
                + code + '\n\n'
                '// ---- JSON helpers ----\n'
                'string j_str(const string& s) {\n'
                '    string r = "\\""; for (char c : s) { if (c==\'"\') r+="\\\\\\""; else if (c==\'\\\\\') r+="\\\\\\\\"; else r+=c; } r+="\\""; return r;\n'
                '}\n'
                'string j_val(const string& v) { return j_str(v); }\n'
                'string j_val(int v) { return to_string(v); }\n'
                'string j_val(long long v) { return to_string(v); }\n'
                'string j_val(double v) { ostringstream o; o<<v; return o.str(); }\n'
                'string j_val(bool v) { return v?"true":"false"; }\n'
                'string j_val(char v) { return j_str(string(1,v)); }\n'
                'template<typename T> string j_val(const vector<T>& v) {\n'
                '    string r="["; for (size_t i=0;i<v.size();i++) { if(i) r+=","; r+=j_val(v[i]); } r+="]"; return r;\n'
                '}\n'
                'template<typename T> string j_val(const vector<vector<T>>& v) {\n'
                '    string r="["; for (size_t i=0;i<v.size();i++) { if(i) r+=","; r+=j_val(v[i]); } r+="]"; return r;\n'
                '}\n\n'
                '// ---- Minimal JSON parser ----\n'
                'struct JVal {\n'
                '    bool is_arr=false,is_obj=false,is_null=false,is_str=false,is_num=false,is_bool=false;\n'
                '    vector<JVal> arr;\n'
                '    map<string,JVal> obj;\n'
                '    string str_val; double num_val=0; bool bool_val=false;\n'
                '};\n'
                'static size_t _ji=0;\n'
                'static string _js;\n'
                'void skip_ws() { while (_ji<_js.size() && isspace(_js[_ji])) _ji++; }\n'
                'JVal parse_val();\n'
                'string parse_str() {\n'
                '    _ji++; string r;\n'
                '    while (_ji<_js.size() && _js[_ji]!=\'"\') {\n'
                '        if (_js[_ji]==\'\\\\\') { _ji++; if (_ji<_js.size()) r+=_js[_ji]; } else r+=_js[_ji]; _ji++;\n'
                '    } _ji++; return r;\n'
                '}\n'
                'JVal parse_arr() {\n'
                '    JVal v; v.is_arr=true; _ji++;\n'
                '    skip_ws();\n'
                '    if (_ji<_js.size() && _js[_ji]==\']\') { _ji++; return v; }\n'
                '    while (true) { skip_ws(); v.arr.push_back(parse_val()); skip_ws();\n'
                '        if (_ji<_js.size() && _js[_ji]==\',\') _ji++; else break; }\n'
                '    skip_ws(); if (_ji<_js.size()) _ji++; return v;\n'
                '}\n'
                'JVal parse_obj() {\n'
                '    JVal v; v.is_obj=true; _ji++;\n'
                '    skip_ws();\n'
                '    if (_ji<_js.size() && _js[_ji]==\'}\') { _ji++; return v; }\n'
                '    while (true) {\n'
                '        skip_ws(); string k=parse_str(); skip_ws(); if(_ji<_js.size()) _ji++;\n'
                '        skip_ws(); v.obj[k]=parse_val(); skip_ws();\n'
                '        if (_ji<_js.size() && _js[_ji]==\',\') _ji++; else break;\n'
                '    }\n'
                '    skip_ws(); if (_ji<_js.size()) _ji++; return v;\n'
                '}\n'
                'JVal parse_val() {\n'
                '    skip_ws(); JVal v;\n'
                '    if (_ji>=_js.size()) return v;\n'
                '    if (_js[_ji]==\'"\') { v.is_str=true; v.str_val=parse_str(); return v; }\n'
                '    if (_js[_ji]==\'[\') return parse_arr();\n'
                '    if (_js[_ji]==\'{\') return parse_obj();\n'
                '    if (_js.substr(_ji,4)=="null") { v.is_null=true; _ji+=4; return v; }\n'
                '    if (_js.substr(_ji,4)=="true") { v.is_bool=true; v.bool_val=true; _ji+=4; return v; }\n'
                '    if (_js.substr(_ji,5)=="false") { v.is_bool=true; v.bool_val=false; _ji+=5; return v; }\n'
                '    size_t end=_ji; while(end<_js.size()&&!isspace(_js[end])&&_js[end]!=\',\'&&_js[end]!=\']\'&&_js[end]!=\')\'&&_js[end]!=\'}\'&&_js[end]!=\':\') end++;\n'
                '    if(end>_ji) { v.is_num=true; try{v.num_val=stod(_js.substr(_ji,end-_ji));}catch(...){} _ji=end; return v; }\n'
                '    _ji++; return v;\n'
                '}\n'
                'JVal parse_json(const string& s) { _js=s; _ji=0; return parse_val(); }\n\n'
                'vector<int> to_int_vec(const JVal& v) {\n'
                '    vector<int> r; if(v.is_arr) for(auto& x:v.arr) r.push_back((int)x.num_val); return r;\n'
                '}\n'
                'vector<vector<int>> to_int_mat(const JVal& v) {\n'
                '    vector<vector<int>> r; if(v.is_arr) for(auto& row:v.arr) r.push_back(to_int_vec(row)); return r;\n'
                '}\n'
                'vector<string> to_str_vec(const JVal& v) {\n'
                '    vector<string> r; if(v.is_arr) for(auto& x:v.arr) r.push_back(x.str_val); return r;\n'
                '}\n'
                'vector<char> to_char_vec(const JVal& v) {\n'
                '    vector<char> r; if(v.is_arr) for(auto& x:v.arr) r.push_back(x.is_str&&!x.str_val.empty()?x.str_val[0]:(char)(int)x.num_val); return r;\n'
                '}\n'
                'vector<vector<char>> to_char_mat(const JVal& v) {\n'
                '    vector<vector<char>> r; if(v.is_arr) for(auto& row:v.arr) r.push_back(to_char_vec(row)); return r;\n'
                '}\n'
                'vector<long long> to_ll_vec(const JVal& v) {\n'
                '    vector<long long> r; if(v.is_arr) for(auto& x:v.arr) r.push_back((long long)x.num_val); return r;\n'
                '}\n'
                'vector<double> to_dbl_vec(const JVal& v) {\n'
                '    vector<double> r; if(v.is_arr) for(auto& x:v.arr) r.push_back(x.num_val); return r;\n'
                '}\n'
                'vector<vector<double>> to_dbl_mat(const JVal& v) {\n'
                '    vector<vector<double>> r; if(v.is_arr) for(auto& row:v.arr) r.push_back(to_dbl_vec(row)); return r;\n'
                '}\n'
                'vector<vector<string>> to_str_mat(const JVal& v) {\n'
                '    vector<vector<string>> r; if(v.is_arr) for(auto& row:v.arr) r.push_back(to_str_vec(row)); return r;\n'
                '}\n\n'
                'string jval_to_str(const JVal& v) {\n'
                '    if (v.is_null) return "null";\n'
                '    if (v.is_bool) return v.bool_val ? "true" : "false";\n'
                '    if (v.is_str) return j_str(v.str_val);\n'
                '    if (v.is_num) { double d=v.num_val; if(d==(long long)d) return to_string((long long)d); ostringstream os; os<<d; return os.str(); }\n'
                '    if (v.is_arr) { string r="["; for(size_t i=0;i<v.arr.size();i++){if(i)r+=",";r+=jval_to_str(v.arr[i]);} r+="]"; return r; }\n'
                '    if (v.is_obj) { string r="{"; bool f=true; for(auto& kv:v.obj){if(!f)r+=",";r+=j_str(kv.first);r+=":";r+=jval_to_str(kv.second);f=false;} r+="}"; return r; }\n'
                '    return "null";\n'
                '}\n\n'
            )
            # ── Signature-aware C++ main() generation ────────────────────────────────
            import re as _sig_re

            def _parse_cpp_sig(src, fname):
                pat = rf'\b{_sig_re.escape(fname)}\s*\(([^{{;]*?)\)\s*(?:const\s*)?(?:\{{|$)'
                m = _sig_re.search(pat, src)
                if not m:
                    return []
                ps = m.group(1).strip()
                if not ps:
                    return []
                parts, depth, cur = [], 0, ''
                for ch in ps:
                    if ch == '<': depth += 1
                    elif ch == '>': depth -= 1
                    if ch == ',' and depth == 0:
                        parts.append(cur.strip()); cur = ''
                    else:
                        cur += ch
                if cur.strip():
                    parts.append(cur.strip())
                result = []
                for p in parts:
                    p = _sig_re.sub(r'\bconst\b', '', p).replace('&', '').replace('*', '').strip()
                    p = _sig_re.sub(r'\s+', ' ', p).strip()
                    toks = p.split()
                    if len(toks) >= 2:
                        nm, ts = toks[-1], ' '.join(toks[:-1])
                    elif toks:
                        nm, ts = f'arg{len(result)}', toks[0]
                    else:
                        continue
                    ts = _sig_re.sub(r'\s*<\s*', '<', ts)
                    ts = _sig_re.sub(r'\s*>\s*', '>', ts)
                    ts = _sig_re.sub(r'\s+', '', ts).replace('std::', '')
                    result.append((ts, nm))
                return result

            def _jval_expr(t, jv):
                if t in ('int', 'int32_t', 'short', 'uint32_t', 'size_t'): return f'(int)({jv}).num_val'
                if t in ('longlong', 'long long', 'int64_t', 'uint64_t', 'long'): return f'(long long)({jv}).num_val'
                if t in ('double', 'float'): return f'({jv}).num_val'
                if t == 'bool': return f'({jv}).bool_val'
                if t == 'string': return f'({jv}).str_val'
                if t == 'char': return f'(({jv}).is_str&&!({jv}).str_val.empty()?({jv}).str_val[0]:(char)(int)({jv}).num_val)'
                if t in ('vector<int>', 'vector<int32_t>', 'vector<uint32_t>'): return f'to_int_vec({jv})'
                if t in ('vector<longlong>', 'vector<long long>', 'vector<int64_t>'): return f'to_ll_vec({jv})'
                if t in ('vector<double>', 'vector<float>'): return f'to_dbl_vec({jv})'
                if t == 'vector<char>': return f'to_char_vec({jv})'
                if t == 'vector<string>': return f'to_str_vec({jv})'
                if t in ('vector<vector<int>>', 'vector<vector<int32_t>>'): return f'to_int_mat({jv})'
                if t == 'vector<vector<char>>': return f'to_char_mat({jv})'
                if t in ('vector<vector<string>>',): return f'to_str_mat({jv})'
                if t in ('vector<vector<double>>', 'vector<vector<float>>'): return f'to_dbl_mat({jv})'
                if 'vector' in t and t.count('vector') >= 2: return f'to_int_mat({jv})'
                if 'vector' in t: return f'to_int_vec({jv})'
                return f'(int)({jv}).num_val'

            _sig_params = _parse_cpp_sig(code, fn_call)
            _ml = []
            _ml.append('int main() {\n')
            _ml.append(f'    string TC_JSON = "{tc_cpp}";\n')
            _ml.append('    JVal tcs = parse_json(TC_JSON);\n')
            _ml.append('    int passed = 0, total = (int)tcs.arr.size();\n')
            _ml.append('    ostringstream __json_buf;\n')
            _ml.append('    __json_buf << "{\\"success\\":true,\\"status\\":\\"running\\",\\"score\\":0,\\"testcases\\":[";\n')
            _ml.append('    Solution sol;\n')
            _ml.append('    for (int i = 0; i < total; i++) {\n')
            _ml.append('        if (i) __json_buf << ",";\n')
            _ml.append('        streambuf* __cout_orig = cout.rdbuf();\n')
            _ml.append('        ostringstream __user_stdout;\n')
            _ml.append('        cout.rdbuf(__user_stdout.rdbuf());\n')
            _ml.append('        JVal tc = tcs.arr[i];\n')
            _ml.append('        JVal input_val = tc.obj.count("input") ? tc.obj["input"] : JVal();\n')
            _ml.append('        JVal expected_val = tc.obj.count("expected") ? tc.obj["expected"] : JVal();\n')
            _ml.append('        string actual_str = "null";\n')
            _ml.append('        string status = "RE";\n')
            _ml.append('        string err = "";\n')
            _ml.append('        bool ok = false;\n')
            _ml.append('        try {\n')
            if _sig_params:
                for _pi, (_pt, _pn) in enumerate(_sig_params):
                    if len(_sig_params) == 1:
                        _pv = f'(input_val.is_obj && input_val.obj.count("{_pn}") ? input_val.obj["{_pn}"] : (input_val.is_obj && input_val.obj.count("input") ? input_val.obj["input"] : input_val))'
                    else:
                        _pv = f'(input_val.is_obj && input_val.obj.count("{_pn}") ? input_val.obj["{_pn}"] : JVal())'
                    _ml.append(f'            JVal _pv{_pi} = {_pv};\n')
                    _ml.append(f'            auto _arg{_pi} = {_jval_expr(_pt, f"_pv{_pi}")};\n')
                _call = ', '.join(f'_arg{i}' for i in range(len(_sig_params)))
                _ml.append(f'            auto _res = sol.{fn_call}({_call});\n')
                _ml.append('            actual_str = j_val(_res);\n')
            else:
                _ml.append('            JVal iv = input_val;\n')
                _ml.append('            if (iv.is_obj && iv.obj.size() == 1 && iv.obj.count("input")) iv = iv.obj["input"];\n')
                _ml.append(f'            if (iv.is_num) {{ auto res = sol.{fn_call}((int)iv.num_val); actual_str = j_val(res); }}\n')
                _ml.append(f'            else if (iv.is_bool) {{ auto res = sol.{fn_call}(iv.bool_val); actual_str = j_val(res); }}\n')
                _ml.append(f'            else if (iv.is_str) {{ auto res = sol.{fn_call}(iv.str_val); actual_str = j_val(res); }}\n')
                _ml.append(f'            else if (iv.is_arr && !iv.arr.empty() && iv.arr[0].is_arr) {{ auto res = sol.{fn_call}(to_int_mat(iv)); actual_str = j_val(res); }}\n')
                _ml.append(f'            else if (iv.is_arr) {{ auto res = sol.{fn_call}(to_int_vec(iv)); actual_str = j_val(res); }}\n')
            _ml.append('            string exp_str = jval_to_str(expected_val);\n')
            _ml.append('            ok = (actual_str == exp_str);\n')
            _ml.append('            if (!ok) {\n')
            _ml.append('                char Q=\'"\';\n')
            _ml.append('                string ua=(actual_str.size()>=2&&actual_str[0]==Q&&actual_str.back()==Q)?actual_str.substr(1,actual_str.size()-2):actual_str;\n')
            _ml.append('                string ub=(exp_str.size()>=2&&exp_str[0]==Q&&exp_str.back()==Q)?exp_str.substr(1,exp_str.size()-2):exp_str;\n')
            _ml.append('                ok=(ua==ub);\n')
            _ml.append('            }\n')
            _ml.append('            if (!ok && expected_val.is_num) {\n')
            _ml.append('                try { ok = abs(stod(actual_str) - expected_val.num_val) <= 1e-6; } catch (...) {}\n')
            _ml.append('            }\n')
            _ml.append('            status = ok ? "AC" : "WA";\n')
            _ml.append('            if (ok) passed++;\n')
            _ml.append('        } catch (exception& ex) {\n')
            _ml.append('            err = ex.what(); status = "RE";\n')
            _ml.append('        } catch (...) {\n')
            _ml.append('            err = "Unknown exception"; status = "RE";\n')
            _ml.append('        }\n')
            _ml.append('        cout.rdbuf(__cout_orig);\n')
            _ml.append('        __json_buf << "{\\"index\\":" << i\n')
            _ml.append('             << ",\\"input\\":" << jval_to_str(input_val)\n')
            _ml.append('             << ",\\"expected\\":" << jval_to_str(expected_val)\n')
            _ml.append('             << ",\\"actual\\":" << actual_str\n')
            _ml.append('             << ",\\"passed\\":" << (ok?"true":"false")\n')
            _ml.append('             << ",\\"status\\":\\"" << status << "\\""\n')
            _ml.append('             << ",\\"error\\":" << (err.empty()?"null":j_str(err))\n')
            _ml.append('             << "}";\n')
            _ml.append('    }\n')
            _ml.append('    double score = total > 0 ? round(passed * 10000.0 / total) / 100.0 : 0;\n')
            _ml.append('    __json_buf << "]"\n')
            _ml.append('              << ",\\"score\\":" << score\n')
            _ml.append('              << ",\\"success\\":" << ((passed==total&&total>0)?"true":"false")\n')
            _ml.append('              << ",\\"status\\":\\"" << ((passed==total&&total>0)?"accepted":"wrong_answer") << "\\"}";\n')
            _ml.append('    cout << "\\n---RESULT_SEPARATOR---\\n";\n')
            _ml.append('    cout << __json_buf.str() << "\\n";\n')
            _ml.append('    return 0;\n')
            _ml.append('}\n')
            cpp_src += ''.join(_ml)
            return cpp_src

        if language in ("go", "golang"):
            tc_go = tc_json.replace("`", "`+\"`\"+`")
            ps_go = ps_json.replace("`", "`+\"`\"+`")
            return f'''package main

import (
\t"encoding/json"
\t"fmt"
\t"math"
\t"reflect"
)

{code}

func normalizeAndCompare(actual, expected interface{{}}) bool {{
\ta, _ := json.Marshal(actual)
\te, _ := json.Marshal(expected)
\tif string(a) == string(e) {{
\t\treturn true
\t}}
\taf, aok := toFloat(actual)
\tef, eok := toFloat(expected)
\tif aok && eok {{
\t\treturn math.Abs(af-ef) <= 1e-6
\t}}
\treturn reflect.DeepEqual(actual, expected)
}}

func toFloat(v interface{{}}) (float64, bool) {{
\tswitch x := v.(type) {{
\tcase float64: return x, true
\tcase int: return float64(x), true
\tcase int64: return float64(x), true
\t}}
\treturn 0, false
}}

type tcEntry struct {{
\tInput    interface{{}} `json:"input"`
\tExpected interface{{}} `json:"expected"`
}}

func main() {{
\ttcJSON := `{tc_go}`
\tvar testCases []tcEntry
\tif err := json.Unmarshal([]byte(tcJSON), &testCases); err != nil {{
\t\tfmt.Printf("{{\\"success\\":false,\\"status\\":\\"compile_error\\",\\"stderr\\":%q}}\\n", err.Error())
\t\tfmt.Println("---RESULT_SEPARATOR---")
\t\treturn
\t}}

\ttype tcResult struct {{
\t\tIndex    int         `json:"index"`
\t\tInput    interface{{}} `json:"input"`
\t\tExpected interface{{}} `json:"expected"`
\t\tActual   interface{{}} `json:"actual"`
\t\tPassed   bool        `json:"passed"`
\t\tStatus   string      `json:"status"`
\t\tStdout   string      `json:"stdout"`
\t\tStderr   string      `json:"stderr"`
\t\tError    interface{{}} `json:"error"`
\t}}

\tpassed := 0
\tresults := make([]tcResult, 0, len(testCases))

\tfor i, tc := range testCases {{
\t\ttr := tcResult{{Index: i, Input: tc.Input, Expected: tc.Expected, Status: "NA"}}
\t\tfunc() {{
\t\t\tdefer func() {{
\t\t\t\tif r := recover(); r != nil {{
\t\t\t\t\ttr.Status = "RE"
\t\t\t\t\ttr.Error = fmt.Sprintf("%v", r)
\t\t\t\t}}
\t\t\t}}()
\t\t\tvar result interface{{}}
\t\t\tswitch inp := tc.Input.(type) {{
\t\t\tcase map[string]interface{{}}:
\t\t\t\tvals := make([]interface{{}}, 0, len(inp))
\t\t\t\tfor _, v := range inp {{ vals = append(vals, v) }}
\t\t\t\tif len(vals) == 1 {{
\t\t\t\t\tresult = solve(vals[0])
\t\t\t\t}} else {{
\t\t\t\t\tresult = solve(inp)
\t\t\t\t}}
\t\t\tcase []interface{{}}:
\t\t\t\tresult = solve(inp)
\t\t\tdefault:
\t\t\t\tresult = solve(inp)
\t\t\t}}
\t\t\ttr.Actual = result
\t\t\tok := normalizeAndCompare(result, tc.Expected)
\t\t\ttr.Passed = ok
\t\t\tif ok {{ tr.Status = "AC"; passed++ }} else {{ tr.Status = "WA" }}
\t\t}}()
\t\tresults = append(results, tr)
\t}}

\ttotal := len(testCases)
\tscore := 0.0
\tif total > 0 {{
\t\tscore = math.Round(float64(passed)*10000/float64(total)) / 100
\t}}
\tstatus := "wrong_answer"
\tif passed == total && total > 0 {{
\t\tstatus = "accepted"
\t}}

\ttype Report struct {{
\t\tSuccess   bool        `json:"success"`
\t\tStatus    string      `json:"status"`
\t\tScore     float64     `json:"score"`
\t\tTestcases interface{{}} `json:"testcases"`
\t}}
\trep := Report{{
\t\tSuccess:   passed == total && total > 0,
\t\tStatus:    status,
\t\tScore:     score,
\t\tTestcases: results,
\t}}
\tb, _ := json.Marshal(rep)
\tfmt.Println(string(b))
\tfmt.Println("---RESULT_SEPARATOR---")
}}
'''

        if language == "rust":
            tc_rust = tc_json.replace('"', '\\"').replace('\n', '\\n')
            return f'''use std::collections::HashMap;

{code}

fn main() {{
    let tc_json = "{tc_rust}";
    // Minimal: just emit pass-through JSON report indicating the test ran
    // Full Rust reflection harness requires proc_macro — emit a stub report.
    println!("{{\\"success\\":false,\\"status\\":\\"compile_error\\",\\"stderr\\":\\"Rust auto-harness not supported. Please provide a wrapper_template.\\",\\"score\\":0,\\"testcases\\":[]}}");
    println!("---RESULT_SEPARATOR---");
}}
'''

        raise ValueError(
            f"No built-in harness for language '{language}'. "
            "Supported: python3, javascript, typescript, java, cpp, go, rust. "
            "For other languages, provide a wrapper_template in problem.solution_wrappers[lang]."
        )

    def _parse_he_bundle_result(
        self, data: Dict, original_test_cases: List[Dict[str, Any]]
    ) -> "ExecutionResult":
        """Parse the HackerEarth bundle result into an ExecutionResult."""
        result = data.get("result", {})
        compile_status = result.get("compile_status", "")
        run_status = result.get("run_status", {})

        # Compilation error
        if compile_status and compile_status != "OK":
            logger.warning("[HE] compilation_error: %s", compile_status[:200])
            return ExecutionResult(
                success=False, test_results=[], passed_count=0,
                total_count=len(original_test_cases), score_percentage=0,
                compilation_error=compile_status,
            )

        run_stat = run_status.get("status", "NA")
        stderr_raw = run_status.get("stderr", "") or ""
        time_used = run_status.get("time_used")
        memory_used = run_status.get("memory_used")
        output_url = run_status.get("output", "")
        status_detail = run_status.get("status_detail", "")

        # Fetch stdout content
        stdout_content = ""
        local_stdout = data.get("_local_stdout")
        if isinstance(local_stdout, str) and local_stdout:
            stdout_content = local_stdout
        elif output_url and output_url.startswith("http"):
            try:
                import urllib.request
                with urllib.request.urlopen(output_url, timeout=15) as resp:
                    stdout_content = resp.read().decode("utf-8", errors="replace")
            except Exception as fetch_err:
                logger.warning("[HE] stdout_fetch_failed: %s", fetch_err)
                stdout_content = ""

        logger.debug(
            "[HE] run_status=%s stderr_len=%d stdout_len=%d",
            run_stat, len(stderr_raw), len(stdout_content),
        )

        # For TLE/MLE — try to extract partial report from stdout before giving up
        if run_stat in ("TLE", "MLE", "RE") and not stdout_content:
            err_map = {"TLE": "Time Limit Exceeded", "MLE": "Memory Limit Exceeded", "RE": "Runtime Error"}
            err = err_map.get(run_stat, run_stat)
            if stderr_raw:
                err = stderr_raw[:2000]
            elif status_detail:
                err = f"{err} ({status_detail})"
            return ExecutionResult(
                success=False, test_results=[], passed_count=0,
                total_count=len(original_test_cases), score_percentage=0,
                runtime_error=err,
                stderr=stderr_raw or None,
            )

        # Parse the JSON report from stdout
        report_obj: Dict[str, Any] = {}
        if stdout_content:
            lines = stdout_content.rstrip("\n").split("\n")
            sep_idx = next((i for i, l in enumerate(lines) if l.strip() == "---RESULT_SEPARATOR---"), None)
            if sep_idx is not None:
                # Try JSON after separator first (Python/Java/JS style)
                after = "\n".join(lines[sep_idx + 1:]).strip()
                before = "\n".join(lines[:sep_idx]).strip()
                payload = after if after else before
            else:
                # No separator — entire stdout is the report
                payload = stdout_content.strip()
            if payload:
                try:
                    report_obj = json.loads(payload)
                except json.JSONDecodeError:
                    # Try the other side of the separator if first side failed
                    if sep_idx is not None:
                        alt = before if payload == after else after
                        try:
                            report_obj = json.loads(alt)
                        except json.JSONDecodeError:
                            report_obj = {"success": False, "status": "runtime_error", "stderr": payload[:2000]}
                    else:
                        report_obj = {"success": False, "status": "runtime_error", "stderr": payload[:2000]}

        # If TLE/MLE/RE but we got a partial report, still propagate it
        if run_stat in ("TLE", "MLE", "RE") and not report_obj:
            err_map = {"TLE": "Time Limit Exceeded", "MLE": "Memory Limit Exceeded"}
            err = err_map.get(run_stat, stderr_raw or f"Runtime Error ({status_detail})")
            return ExecutionResult(
                success=False, test_results=[], passed_count=0,
                total_count=len(original_test_cases), score_percentage=0,
                runtime_error=err, stderr=stderr_raw or None,
            )

        # If no report at all
        if not report_obj:
            err = stderr_raw or f"No output from runner (status={run_stat})"
            return ExecutionResult(
                success=False, test_results=[], passed_count=0,
                total_count=len(original_test_cases), score_percentage=0,
                runtime_error=err[:2000], stderr=stderr_raw or None,
            )

        # Check for compile/runtime error reported by the runner itself
        report_status = str(report_obj.get("status") or "")
        if report_status in ("compile_error",) and not report_obj.get("testcases"):
            return ExecutionResult(
                success=False, test_results=[], passed_count=0,
                total_count=len(original_test_cases), score_percentage=0,
                compilation_error=report_obj.get("stderr") or "Compilation error",
            )

        tc_out = report_obj.get("testcases") if isinstance(report_obj, dict) else None
        if not isinstance(tc_out, list):
            tc_out = []

        test_results: List[TestResult] = []
        passed_count = 0

        def _py_cmp_normalize(v: Any) -> Any:
            """Strip one level of JSON string encoding for comparison."""
            if isinstance(v, str):
                s = v.strip()
                if s.startswith('"') and s.endswith('"') and len(s) >= 2:
                    try:
                        parsed = json.loads(s)
                        if isinstance(parsed, str):
                            return parsed
                        return parsed
                    except Exception:
                        pass
                try:
                    f = float(s)
                    return int(f) if f == int(f) else f
                except Exception:
                    pass
            return v

        def _py_values_match(actual: Any, expected: Any) -> bool:
            """Python-side equality check as safety net for compiled-language runner bugs."""
            if actual is None or expected is None:
                return actual is expected
            a, b = _py_cmp_normalize(actual), _py_cmp_normalize(expected)
            if a == b:
                return True
            try:
                return abs(float(a) - float(b)) <= 1e-6  # type: ignore[arg-type]
            except Exception:
                pass
            return False

        for tc in tc_out:
            if not isinstance(tc, dict):
                continue
            raw_passed = bool(tc.get("passed"))
            raw_status = str(tc.get("status") or "NA")
            if not raw_passed:
                act_v = tc.get("actual")
                exp_v = tc.get("expected")
                if act_v is not None and exp_v is not None and _py_values_match(act_v, exp_v):
                    raw_passed = True
                    raw_status = "AC"
            tr = TestResult(
                passed=raw_passed,
                input_data=tc.get("input"),
                expected=tc.get("expected"),
                actual=tc.get("actual"),
                error=tc.get("error") or None,
                stdout=tc.get("stdout") or None,
                stderr=tc.get("stderr") or None,
                status=raw_status,
                time_used=str(time_used) if time_used is not None else None,
                memory_used=str(memory_used) if memory_used is not None else None,
            )
            test_results.append(tr)
            if tr.passed:
                passed_count += 1

        total_count = len(original_test_cases)
        # Always recompute score from Python-verified passed_count for consistency
        score = round(passed_count / total_count * 100, 2) if total_count else 0

        # Re-derive overall_success from Python-verified passed_count
        overall_success = (passed_count == total_count and total_count > 0)

        # Extract runner-level stderr/runtime_error
        runner_stderr = report_obj.get("stderr") if isinstance(report_obj, dict) else None
        runtime_err: Optional[str] = None
        if not overall_success and runner_stderr and not tc_out:
            runtime_err = str(runner_stderr)[:2000]
        elif not overall_success and stderr_raw and not tc_out:
            runtime_err = stderr_raw[:2000]

        return ExecutionResult(
            success=overall_success,
            test_results=test_results,
            passed_count=passed_count,
            total_count=total_count,
            score_percentage=score,
            runtime_error=runtime_err,
            stdout=stdout_content[:5000] if stdout_content else None,
            stderr=stderr_raw[:2000] if stderr_raw else None,
        )

    def _execute_local_bundle(
        self,
        *,
        code: str,
        test_cases: List[Dict[str, Any]],
        language: str,
        function_name: Optional[str],
        execution_mode: Optional[str],
        class_name: Optional[str],
        parameter_schema: List[Dict[str, Any]],
    ) -> "ExecutionResult":
        """Local fallback: only supports Python."""
        if language not in ("python3", "python"):
            return ExecutionResult(
                success=False, test_results=[], passed_count=0,
                total_count=len(test_cases), score_percentage=0,
                runtime_error=f"Local execution fallback supports only Python. Requested: {language}",
            )

        try:
            runner = self._build_bundle_runner_source(
                code=code,
                function_name=function_name or "",
                execution_mode=execution_mode,
                class_name=class_name,
                parameter_schema=parameter_schema,
                test_cases=test_cases,
                language=language,
                wrapper_template=None,
            )
        except Exception as build_err:
            return ExecutionResult(
                success=False, test_results=[], passed_count=0,
                total_count=len(test_cases), score_percentage=0,
                compilation_error=f"Runner build error: {build_err}",
            )

        try:
            with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, encoding="utf-8") as f:
                f.write(runner)
                temp_file = f.name

            try:
                proc = subprocess.run(
                    [sys.executable, temp_file],
                    capture_output=True, text=True, timeout=60,
                    cwd=tempfile.gettempdir(),
                )
                stdout_content = proc.stdout or ""
                stderr_content = proc.stderr or ""
                fake_data = {
                    "result": {
                        "compile_status": "OK",
                        "run_status": {
                            "status": "AC" if proc.returncode == 0 else "RE",
                            "stderr": stderr_content,
                            "output": "",
                        },
                    },
                    "_local_stdout": stdout_content,
                }
                return self._parse_he_bundle_result(fake_data, test_cases)
            except subprocess.TimeoutExpired:
                return ExecutionResult(
                    success=False, test_results=[], passed_count=0,
                    total_count=len(test_cases), score_percentage=0,
                    runtime_error="Local execution timed out (60s)",
                )
            finally:
                try:
                    os.unlink(temp_file)
                except Exception:
                    pass
        except Exception as e:
            return ExecutionResult(
                success=False, test_results=[], passed_count=0,
                total_count=len(test_cases), score_percentage=0,
                runtime_error=str(e),
            )


# ─── Singleton / factory ──────────────────────────────────────────────────────

_executor: Optional[HackerEarthExecutor] = None


def get_code_executor() -> HackerEarthExecutor:
    global _executor
    if _executor is None:
        _executor = HackerEarthExecutor()
    return _executor
