"""Quick validation: generates a JS runner and checks for obvious syntax issues."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Mock settings so the import doesn't fail
os.environ.setdefault('SUPABASE_URL', 'https://fake.supabase.co')
os.environ.setdefault('SUPABASE_KEY', 'fake-key')
os.environ.setdefault('OPENAI_API_KEY', 'fake-key')
os.environ.setdefault('CLERK_SECRET_KEY', 'fake-key')

from app.services.code_executor import HackerEarthExecutor

executor = HackerEarthExecutor()

# Test: Simple JavaScript function
candidate_code = """function twoSum(nums, target) {
  const map = {};
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (complement in map) return [map[complement], i];
    map[nums[i]] = i;
  }
  return [];
}"""

test_cases = [
    {"input": {"nums": [2, 7, 11, 15], "target": 9}, "expected": [0, 1]},
    {"input": {"nums": [3, 2, 4], "target": 6}, "expected": [1, 2]},
]

source = executor._build_bundle_runner_source(
    code=candidate_code,
    function_name="twoSum",
    execution_mode=None,
    class_name=None,
    parameter_schema=[{"name": "nums"}, {"name": "target"}],
    test_cases=test_cases,
    language="javascript",
    wrapper_template=None,
)

print("=== Generated JavaScript Runner ===")
print(f"Length: {len(source)} chars")
print()

# Check for common issues
issues = []

# Check no double braces (f-string artifact)
if '{{' in source or '}}' in source:
    # Filter out actual JS where {{ might appear in strings
    lines = source.split('\n')
    for i, line in enumerate(lines, 1):
        if '{{' in line or '}}' in line:
            stripped = line.strip()
            # Skip if it's in a string or JSON
            if not stripped.startswith('//') and not stripped.startswith('*'):
                issues.append(f"  Line {i}: Possible f-string brace artifact: {stripped[:80]}")

# Check regex is correct
if '\\\\d' in source:
    issues.append("  CRITICAL: Found \\\\d in regex (should be \\d)")
if '\\\\.' in source:
    issues.append("  CRITICAL: Found \\\\. in regex (should be \\.)")

# Check no eval()
if 'eval(' in source:
    issues.append("  WARNING: Found eval() call (should use safe lookup)")

# Check for RESULT_SEPARATOR
if '---RESULT_SEPARATOR---' not in source:
    issues.append("  CRITICAL: Missing ---RESULT_SEPARATOR--- marker")

# Check proper regex
if '/^[+-]?(?:\\d+\\.?\\d*|\\d*\\.?\\d+)(?:[eE][+-]?\\d+)?$/' in source:
    print("[OK] Regex is correct (\\d and \\. metacharacters)")
else:
    issues.append("  WARNING: Could not find expected regex pattern")

# Check for _startCapture/_stopCapture (stdout capture)
if '_startCapture()' in source and '_stopCapture()' in source:
    print("[OK] Per-test stdout capture is present")
else:
    issues.append("  WARNING: Missing per-test stdout capture")

# Check Function.length usage
if 'target.length' in source or 'paramCount' in source:
    print("[OK] Function.length-based param count detection present")
else:
    issues.append("  WARNING: Missing Function.length detection")

# Check no eval
if 'eval(' not in source:
    print("[OK] No eval() calls (safe function lookup)")
else:
    issues.append("  WARNING: eval() still present")

# Check template placeholders are all replaced
for placeholder in ['__CANDIDATE_CODE__', '__TC_JSON__', '__PS_JSON__', '__FN_JSON__', '__MODE_JSON__', '__CLS_JSON__']:
    if placeholder in source:
        issues.append(f"  CRITICAL: Unreplaced placeholder {placeholder}")

if issues:
    print("\n[FAIL] Issues found:")
    for issue in issues:
        print(issue)
else:
    print("\n[OK] All checks passed!")

# Print first 50 lines for visual inspection
print("\n=== First 50 lines ===")
for i, line in enumerate(source.split('\n')[:50], 1):
    print(f"{i:3d}: {line}")
