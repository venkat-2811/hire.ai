"""Generate representative bundled runners and validate key compatibility paths."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

os.environ.setdefault('SUPABASE_URL', 'https://fake.supabase.co')
os.environ.setdefault('SUPABASE_KEY', 'fake-key')
os.environ.setdefault('OPENAI_API_KEY', 'fake-key')
os.environ.setdefault('CLERK_SECRET_KEY', 'fake-key')

from app.services.code_executor import HackerEarthExecutor


executor = HackerEarthExecutor()


CASES = [
    {
        "name": "python_function",
        "language": "python3",
        "code": "def add(a, b):\n    return a + b\n",
        "function_name": "add",
        "execution_mode": None,
        "class_name": None,
        "parameter_schema": [{"name": "a"}, {"name": "b"}],
        "test_cases": [{"input": {"a": 2, "b": 3}, "expected": 5}],
        "required": [
            "FUNCTION_NAME = 'add'",
            'def _get_args(',
            'result = target(*_get_args(input_data, target))',
        ],
    },
    {
        "name": "python_stdin_fallback",
        "language": "python3",
        "code": "import sys\nprint(sys.stdin.read().strip())\n",
        "function_name": "",
        "execution_mode": None,
        "class_name": None,
        "parameter_schema": [],
        "test_cases": [{"input": "hello", "expected": "hello"}],
        "required": [
            'def _run_program(src, input_data):',
            '_program_stdout = _run_program(',
            'tr["passed"] = _cmp(result, expected) or _cmp(tr["stdout"].rstrip("\\n"), expected)',
        ],
    },
    {
        "name": "javascript_async_function",
        "language": "javascript",
        "code": "const solve = async (n) => n + 1;\n",
        "function_name": "solve",
        "execution_mode": None,
        "class_name": None,
        "parameter_schema": [{"name": "n"}],
        "test_cases": [{"input": {"n": 2}, "expected": 3}],
        "required": [
            '(async function() {',
            'if (result && typeof result.then === \'function\') result = await result;',
            'var CANDIDATE_SOURCE = ',
        ],
    },
    {
        "name": "javascript_stdin_program",
        "language": "javascript",
        "code": "const fs = require('fs');\nconst input = fs.readFileSync(0, 'utf8').trim();\nconsole.log(input);\n",
        "function_name": "",
        "execution_mode": None,
        "class_name": None,
        "parameter_schema": [],
        "test_cases": [{"input": "hello", "expected": "hello"}],
        "required": [
            'async function _runProgramCase(source, inputData) {',
            'if (mod === \'fs\') {',
            'tr.stdout = await _runProgramCase(CANDIDATE_SOURCE, inputData);',
        ],
    },
    {
        "name": "java_main_fallback",
        "language": "java",
        "code": "import java.util.*;\nclass Solver { public static void main(String[] args) { Scanner sc = new Scanner(System.in); System.out.print(sc.nextLine()); } }\n",
        "function_name": "",
        "execution_mode": None,
        "class_name": None,
        "parameter_schema": [],
        "test_cases": [{"input": "hi", "expected": "hi"}],
        "required": [
            'PRIMARY_CLASS_NAME',
            'String[] candidates = new String[] { CLASS_NAME, PRIMARY_CLASS_NAME, "Solution" };',
            'Method mainMethod = solClass.getMethod("main", String[].class);',
        ],
    },
    {
        "name": "cpp_free_function",
        "language": "cpp",
        "code": "#include <vector>\nusing namespace std;\nvector<int> twoSum(vector<int> nums, int target) { return {0, 1}; }\n",
        "function_name": "twoSum",
        "execution_mode": None,
        "class_name": None,
        "parameter_schema": [{"name": "nums"}, {"name": "target"}],
        "test_cases": [{"input": {"nums": [2, 7], "target": 9}, "expected": [0, 1]}],
        "required": [
            'auto _res = twoSum(_arg0, _arg1);',
        ],
        "forbidden": [
            'Solution sol;',
        ],
    },
    {
        "name": "cpp_main_fallback",
        "language": "cpp",
        "code": "#include <iostream>\n#include <string>\nusing namespace std;\nint main(){ string s; getline(cin, s); cout << s; return 0; }\n",
        "function_name": "",
        "execution_mode": None,
        "class_name": None,
        "parameter_schema": [],
        "test_cases": [{"input": "yo", "expected": "yo"}],
        "required": [
            '#define main __candidate_main__',
            'cin.rdbuf(__user_stdin.rdbuf());',
            '__candidate_main__();',
        ],
    },
]


COMMON_FORBIDDEN = [
    '__CANDIDATE_CODE__',
    '__TC_JSON__',
    '__PS_JSON__',
    '__FN_JSON__',
    '__MODE_JSON__',
    '__CLS_JSON__',
]


failures = []

for case in CASES:
    source = executor._build_bundle_runner_source(
        code=case['code'],
        function_name=case['function_name'],
        execution_mode=case['execution_mode'],
        class_name=case['class_name'],
        parameter_schema=case['parameter_schema'],
        test_cases=case['test_cases'],
        language=case['language'],
        wrapper_template=None,
    )

    print(f"=== {case['name']} ({case['language']}) ===")
    print(f"length={len(source)}")

    for text in case.get('required', []):
        if text not in source:
            failures.append(f"[{case['name']}] missing required snippet: {text}")
        else:
            print(f"[OK] contains: {text[:90]}")

    for text in COMMON_FORBIDDEN + case.get('forbidden', []):
        if text in source:
            failures.append(f"[{case['name']}] found forbidden snippet: {text}")

    if '---RESULT_SEPARATOR---' not in source:
        failures.append(f"[{case['name']}] missing result separator")
    if len(source) < 500:
        failures.append(f"[{case['name']}] generated source unexpectedly short")

    print()

if failures:
    print("[FAIL] Validation issues found:")
    for failure in failures:
        print(f"- {failure}")
    raise SystemExit(1)

print("[OK] All multi-language runner validations passed!")
