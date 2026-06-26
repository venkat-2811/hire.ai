-- DSA Problem Bank Expansion — EASY: Math, Trees, Hash Maps, Sorting (Batch 3)
-- 15 new problems. Run AFTER existing seed files.
-- Every problem: 2-3 public TCs, 4-8 private/edge TCs.

INSERT INTO public.dsa_problems (slug, title, difficulty, category, tags, description, constraints, examples, starter_code, solution_wrappers, test_cases, points, time_limit_seconds, memory_limit_kb)
VALUES

-- ============================================================
-- MATH PROBLEMS (5)
-- ============================================================

-- 1. Power of Two
(
  'power-of-two',
  'Power of Two',
  'easy',
  'Math',
  ARRAY['math', 'bit-manipulation', 'recursion'],
  E'Given an integer `n`, return `true` if it is a power of two. Otherwise, return `false`.\n\nAn integer `n` is a power of two, if there exists an integer `x` such that `n == 2^x`.',
  E'-2^31 <= n <= 2^31 - 1',
  '[{"input":"n = 1","output":"true","explanation":"2^0 = 1."},{"input":"n = 16","output":"true","explanation":"2^4 = 16."},{"input":"n = 3","output":"false","explanation":"3 is not a power of two."}]'::jsonb,
  '{"python3": "class Solution:\n    def isPowerOfTwo(self, n: int) -> bool:\n        pass", "javascript": "/**\n * @param {number} n\n * @return {boolean}\n */\nclass Solution {\n    isPowerOfTwo(n) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public boolean isPowerOfTwo(int n) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    bool isPowerOfTwo(int n) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.isPowerOfTwo(input_data[\"n\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.isPowerOfTwo(data.n)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Solution().isPowerOfTwo(obj.get(\"n\").getAsInt()));\n  }\n}", "cpp": "#include <iostream>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << json(sol.isPowerOfTwo(input[\"n\"].get<int>())).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"n\":1}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"n\":16}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"n\":3}","expected_output":"false","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"n\":0}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"n\":-1}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"n\":1024}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"n\":1073741824}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"n\":2147483647}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- 2. Fibonacci Number
(
  'fibonacci-number',
  'Fibonacci Number',
  'easy',
  'Math',
  ARRAY['math', 'dynamic-programming', 'recursion', 'memoization'],
  E'The **Fibonacci numbers**, commonly denoted `F(n)` form a sequence, called the **Fibonacci sequence**, such that each number is the sum of the two preceding ones, starting from `0` and `1`:\n\nF(0) = 0, F(1) = 1\nF(n) = F(n - 1) + F(n - 2), for n > 1\n\nGiven `n`, calculate `F(n)`.',
  E'0 <= n <= 30',
  '[{"input":"n = 2","output":"1","explanation":"F(2) = F(1) + F(0) = 1 + 0 = 1."},{"input":"n = 3","output":"2","explanation":"F(3) = F(2) + F(1) = 1 + 1 = 2."},{"input":"n = 4","output":"3","explanation":"F(4) = F(3) + F(2) = 2 + 1 = 3."}]'::jsonb,
  '{"python3": "class Solution:\n    def fib(self, n: int) -> int:\n        pass", "javascript": "/**\n * @param {number} n\n * @return {number}\n */\nclass Solution {\n    fib(n) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int fib(int n) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int fib(int n) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.fib(input_data[\"n\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.fib(data.n)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Solution().fib(obj.get(\"n\").getAsInt()));\n  }\n}", "cpp": "#include <iostream>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << sol.fib(input[\"n\"].get<int>());\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"n\":2}","expected_output":"1","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"n\":3}","expected_output":"2","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"n\":4}","expected_output":"3","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"n\":0}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"n\":1}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"n\":10}","expected_output":"55","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"n\":20}","expected_output":"6765","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"n\":30}","expected_output":"832040","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- 3. Climbing Stairs
(
  'climbing-stairs',
  'Climbing Stairs',
  'easy',
  'Math',
  ARRAY['math', 'dynamic-programming', 'memoization'],
  E'You are climbing a staircase. It takes `n` steps to reach the top.\n\nEach time you can either climb `1` or `2` steps. In how many distinct ways can you climb to the top?',
  E'1 <= n <= 45',
  '[{"input":"n = 2","output":"2","explanation":"Two ways: 1+1 or 2."},{"input":"n = 3","output":"3","explanation":"Three ways: 1+1+1, 1+2, 2+1."}]'::jsonb,
  '{"python3": "class Solution:\n    def climbStairs(self, n: int) -> int:\n        pass", "javascript": "/**\n * @param {number} n\n * @return {number}\n */\nclass Solution {\n    climbStairs(n) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int climbStairs(int n) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int climbStairs(int n) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.climbStairs(input_data[\"n\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.climbStairs(data.n)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Solution().climbStairs(obj.get(\"n\").getAsInt()));\n  }\n}", "cpp": "#include <iostream>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << sol.climbStairs(input[\"n\"].get<int>());\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"n\":2}","expected_output":"2","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"n\":3}","expected_output":"3","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"n\":1}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"n\":5}","expected_output":"8","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"n\":10}","expected_output":"89","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"n\":38}","expected_output":"63245986","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"n\":45}","expected_output":"1836311903","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- 4. Reverse Integer
(
  'reverse-integer',
  'Reverse Integer',
  'easy',
  'Math',
  ARRAY['math'],
  E'Given a signed 32-bit integer `x`, return `x` with its digits reversed. If reversing `x` causes the value to go outside the signed 32-bit integer range `[-2^31, 2^31 - 1]`, then return `0`.\n\n**Assume the environment does not allow you to store 64-bit integers (signed or unsigned).**',
  E'-2^31 <= x <= 2^31 - 1',
  '[{"input":"x = 123","output":"321","explanation":"123 reversed is 321."},{"input":"x = -123","output":"-321","explanation":"-123 reversed is -321."},{"input":"x = 120","output":"21","explanation":"120 reversed is 021 = 21."}]'::jsonb,
  '{"python3": "class Solution:\n    def reverse(self, x: int) -> int:\n        pass", "javascript": "/**\n * @param {number} x\n * @return {number}\n */\nclass Solution {\n    reverse(x) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int reverse(int x) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int reverse(int x) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.reverse(input_data[\"x\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.reverse(data.x)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Solution().reverse(obj.get(\"x\").getAsInt()));\n  }\n}", "cpp": "#include <iostream>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << sol.reverse(input[\"x\"].get<int>());\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"x\":123}","expected_output":"321","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"x\":-123}","expected_output":"-321","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"x\":120}","expected_output":"21","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"x\":0}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"x\":1534236469}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"x\":100}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"x\":-2147483648}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"x\":1000000003}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- 5. Happy Number
(
  'happy-number',
  'Happy Number',
  'easy',
  'Math',
  ARRAY['math', 'hash-set', 'two-pointer'],
  E'Write an algorithm to determine if a number `n` is happy.\n\nA **happy number** is a number defined by the following process:\n- Starting with any positive integer, replace the number by the sum of the squares of its digits.\n- Repeat the process until the number equals 1 (where it will stay), or it **loops endlessly in a cycle** which does not include 1.\n- Numbers for which this process ends in 1 are happy.\n\nReturn `true` if `n` is a happy number, and `false` if not.',
  E'1 <= n <= 2^31 - 1',
  '[{"input":"n = 19","output":"true","explanation":"1^2+9^2=82 → 8^2+2^2=68 → 6^2+8^2=100 → 1^2+0^2+0^2=1."},{"input":"n = 2","output":"false","explanation":"2 enters a cycle that does not reach 1."}]'::jsonb,
  '{"python3": "class Solution:\n    def isHappy(self, n: int) -> bool:\n        pass", "javascript": "/**\n * @param {number} n\n * @return {boolean}\n */\nclass Solution {\n    isHappy(n) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public boolean isHappy(int n) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    bool isHappy(int n) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.isHappy(input_data[\"n\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.isHappy(data.n)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Solution().isHappy(obj.get(\"n\").getAsInt()));\n  }\n}", "cpp": "#include <iostream>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << json(sol.isHappy(input[\"n\"].get<int>())).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"n\":19}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"n\":2}","expected_output":"false","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"n\":1}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"n\":7}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"n\":4}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"n\":100}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"n\":1000}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"n\":999}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- TREES PROBLEMS (5)
-- ============================================================

-- 6. Maximum Depth of Binary Tree
(
  'maximum-depth-binary-tree',
  'Maximum Depth of Binary Tree',
  'easy',
  'Trees',
  ARRAY['tree', 'dfs', 'bfs', 'recursion'],
  E'Given the `root` of a binary tree, return its **maximum depth**.\n\nA binary tree''s **maximum depth** is the number of nodes along the longest path from the root node down to the farthest leaf node.\n\nThe tree is given as a level-order (BFS) array where `null` represents empty nodes.',
  E'The number of nodes in the tree is in the range [0, 10^4].\n-100 <= Node.val <= 100',
  '[{"input":"root = [3,9,20,null,null,15,7]","output":"3","explanation":"Depth 3: 3→20→15 or 3→20→7."},{"input":"root = [1,null,2]","output":"2","explanation":"Depth 2: 1→2."}]'::jsonb,
  '{"python3": "class Solution:\n    def maxDepth(self, root: list) -> int:\n        # root is given as level-order array, e.g. [3,9,20,None,None,15,7]\n        pass", "javascript": "/**\n * @param {(number|null)[]} root - level-order array\n * @return {number}\n */\nclass Solution {\n    maxDepth(root) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int maxDepth(Integer[] root) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int maxDepth(vector<int>& root) {\n        // root is level-order with -101 as null sentinel\n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\nfrom collections import deque\ninput_data = json.loads(sys.stdin.read())\nroot_arr = input_data[\"root\"]\nsol = Solution()\nresult = sol.maxDepth(root_arr)\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.maxDepth(data.root)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    JsonArray arr = obj.getAsJsonArray(\"root\");\n    Integer[] root = new Integer[arr.size()];\n    for (int i = 0; i < arr.size(); i++) root[i] = arr.get(i).isJsonNull() ? null : arr.get(i).getAsInt();\n    System.out.println(new Solution().maxDepth(root));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  std::vector<int> root;\n  for (auto& v : input[\"root\"]) root.push_back(v.is_null() ? -101 : v.get<int>());\n  Solution sol;\n  std::cout << sol.maxDepth(root);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"root\":[3,9,20,null,null,15,7]}","expected_output":"3","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"root\":[1,null,2]}","expected_output":"2","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"root\":[]}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"root\":[1]}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"root\":[1,2,3,4,5]}","expected_output":"3","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"root\":[1,null,2,null,3,null,4]}","expected_output":"4","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"root\":[1,2,null,3,null,4,null,5]}","expected_output":"5","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- 7. Same Tree
(
  'same-tree',
  'Same Tree',
  'easy',
  'Trees',
  ARRAY['tree', 'dfs', 'bfs'],
  E'Given the roots of two binary trees `p` and `q`, write a function to check if they are the same or not.\n\nTwo binary trees are considered the same if they are structurally identical, and the nodes have the same value.\n\nTrees are given as level-order arrays with `null` for missing nodes.',
  E'The number of nodes in both trees is in the range [0, 100].\n-10^4 <= Node.val <= 10^4',
  '[{"input":"p = [1,2,3], q = [1,2,3]","output":"true","explanation":"Identical structure and values."},{"input":"p = [1,2], q = [1,null,2]","output":"false","explanation":"Different structure."},{"input":"p = [1,2,1], q = [1,1,2]","output":"false","explanation":"Same structure but different values."}]'::jsonb,
  '{"python3": "class Solution:\n    def isSameTree(self, p: list, q: list) -> bool:\n        pass", "javascript": "/**\n * @param {(number|null)[]} p\n * @param {(number|null)[]} q\n * @return {boolean}\n */\nclass Solution {\n    isSameTree(p, q) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public boolean isSameTree(Integer[] p, Integer[] q) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    bool isSameTree(vector<int>& p, vector<int>& q) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.isSameTree(input_data[\"p\"], input_data[\"q\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.isSameTree(data.p, data.q)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    JsonArray ap=obj.getAsJsonArray(\"p\"), aq=obj.getAsJsonArray(\"q\");\n    Integer[] p=new Integer[ap.size()], q=new Integer[aq.size()];\n    for(int i=0;i<ap.size();i++) p[i]=ap.get(i).isJsonNull()?null:ap.get(i).getAsInt();\n    for(int i=0;i<aq.size();i++) q[i]=aq.get(i).isJsonNull()?null:aq.get(i).getAsInt();\n    System.out.println(new Solution().isSameTree(p,q));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  std::vector<int> p, q;\n  for (auto& v : input[\"p\"]) p.push_back(v.is_null() ? -10001 : v.get<int>());\n  for (auto& v : input[\"q\"]) q.push_back(v.is_null() ? -10001 : v.get<int>());\n  Solution sol;\n  std::cout << json(sol.isSameTree(p, q)).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"p\":[1,2,3],\"q\":[1,2,3]}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"p\":[1,2],\"q\":[1,null,2]}","expected_output":"false","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"p\":[1,2,1],\"q\":[1,1,2]}","expected_output":"false","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"p\":[],\"q\":[]}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"p\":[1],\"q\":[1]}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"p\":[1,2,3,4,5],\"q\":[1,2,3,4,5]}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"p\":[1,2,3,4],\"q\":[1,2,3,null,4]}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- 8. Invert Binary Tree
(
  'invert-binary-tree',
  'Invert Binary Tree',
  'easy',
  'Trees',
  ARRAY['tree', 'dfs', 'bfs', 'recursion'],
  E'Given the `root` of a binary tree, invert the tree, and return its root (as a level-order array).\n\nInverting means swapping the left and right children of every node.',
  E'The number of nodes in the tree is in the range [0, 100].\n-100 <= Node.val <= 100',
  '[{"input":"root = [4,2,7,1,3,6,9]","output":"[4,7,2,9,6,3,1]","explanation":"Left and right subtrees are swapped at each level."},{"input":"root = [2,1,3]","output":"[2,3,1]","explanation":"1 and 3 are swapped."}]'::jsonb,
  '{"python3": "class Solution:\n    def invertTree(self, root: list) -> list:\n        pass", "javascript": "/**\n * @param {(number|null)[]} root\n * @return {(number|null)[]}\n */\nclass Solution {\n    invertTree(root) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public Integer[] invertTree(Integer[] root) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<int> invertTree(vector<int>& root) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.invertTree(input_data[\"root\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.invertTree(data.root)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    JsonArray arr = obj.getAsJsonArray(\"root\");\n    Integer[] root = new Integer[arr.size()];\n    for (int i=0;i<arr.size();i++) root[i]=arr.get(i).isJsonNull()?null:arr.get(i).getAsInt();\n    System.out.println(new Gson().toJson(new Solution().invertTree(root)));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  std::vector<int> root;\n  for (auto& v : input[\"root\"]) root.push_back(v.is_null() ? -101 : v.get<int>());\n  Solution sol;\n  std::cout << json(sol.invertTree(root)).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"root\":[4,2,7,1,3,6,9]}","expected_output":"[4,7,2,9,6,3,1]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"root\":[2,1,3]}","expected_output":"[2,3,1]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"root\":[]}","expected_output":"[]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"root\":[1]}","expected_output":"[1]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"root\":[1,2,null]}","expected_output":"[1,null,2]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"root\":[1,2,3,4,5,6,7]}","expected_output":"[1,3,2,7,6,5,4]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- 9. Symmetric Tree
(
  'symmetric-tree',
  'Symmetric Tree',
  'easy',
  'Trees',
  ARRAY['tree', 'dfs', 'bfs'],
  E'Given the `root` of a binary tree, check whether it is a mirror of itself (i.e., symmetric around its center).\n\nThe tree is given as a level-order array.',
  E'The number of nodes in the tree is in the range [1, 1000].\n-100 <= Node.val <= 100',
  '[{"input":"root = [1,2,2,3,4,4,3]","output":"true","explanation":"Mirror symmetric around root."},{"input":"root = [1,2,2,null,3,null,3]","output":"false","explanation":"Not symmetric — 3 appears on opposite sides differently."}]'::jsonb,
  '{"python3": "class Solution:\n    def isSymmetric(self, root: list) -> bool:\n        pass", "javascript": "/**\n * @param {(number|null)[]} root\n * @return {boolean}\n */\nclass Solution {\n    isSymmetric(root) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public boolean isSymmetric(Integer[] root) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    bool isSymmetric(vector<int>& root) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.isSymmetric(input_data[\"root\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.isSymmetric(data.root)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    JsonArray arr = obj.getAsJsonArray(\"root\");\n    Integer[] root = new Integer[arr.size()];\n    for (int i=0;i<arr.size();i++) root[i]=arr.get(i).isJsonNull()?null:arr.get(i).getAsInt();\n    System.out.println(new Solution().isSymmetric(root));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  std::vector<int> root;\n  for (auto& v : input[\"root\"]) root.push_back(v.is_null() ? -101 : v.get<int>());\n  Solution sol;\n  std::cout << json(sol.isSymmetric(root)).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"root\":[1,2,2,3,4,4,3]}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"root\":[1,2,2,null,3,null,3]}","expected_output":"false","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"root\":[1]}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"root\":[1,2,2]}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"root\":[1,2,3]}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"root\":[1,2,2,2,null,2]}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"root\":[5,4,4,null,null,null,null]}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- 10. Path Sum
(
  'path-sum',
  'Path Sum',
  'easy',
  'Trees',
  ARRAY['tree', 'dfs', 'bfs'],
  E'Given the `root` of a binary tree and an integer `targetSum`, return `true` if the tree has a **root-to-leaf** path such that adding up all the values along the path equals `targetSum`.\n\nA **leaf** is a node with no children. The tree is given as a level-order array.',
  E'The number of nodes in the tree is in the range [0, 5000].\n-1000 <= Node.val <= 1000\n-1000 <= targetSum <= 1000',
  '[{"input":"root = [5,4,8,11,null,13,4,7,2,null,null,null,1], targetSum = 22","output":"true","explanation":"Path 5→4→11→2 sums to 22."},{"input":"root = [1,2,3], targetSum = 5","output":"false","explanation":"No path sums to 5."}]'::jsonb,
  '{"python3": "class Solution:\n    def hasPathSum(self, root: list, targetSum: int) -> bool:\n        pass", "javascript": "/**\n * @param {(number|null)[]} root\n * @param {number} targetSum\n * @return {boolean}\n */\nclass Solution {\n    hasPathSum(root, targetSum) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public boolean hasPathSum(Integer[] root, int targetSum) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    bool hasPathSum(vector<int>& root, int targetSum) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.hasPathSum(input_data[\"root\"], input_data[\"targetSum\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.hasPathSum(data.root, data.targetSum)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    JsonArray arr = obj.getAsJsonArray(\"root\");\n    Integer[] root = new Integer[arr.size()];\n    for (int i=0;i<arr.size();i++) root[i]=arr.get(i).isJsonNull()?null:arr.get(i).getAsInt();\n    System.out.println(new Solution().hasPathSum(root, obj.get(\"targetSum\").getAsInt()));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  std::vector<int> root;\n  for (auto& v : input[\"root\"]) root.push_back(v.is_null() ? -1001 : v.get<int>());\n  Solution sol;\n  std::cout << json(sol.hasPathSum(root, input[\"targetSum\"].get<int>())).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"root\":[5,4,8,11,null,13,4,7,2,null,null,null,1],\"targetSum\":22}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"root\":[1,2,3],\"targetSum\":5}","expected_output":"false","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"root\":[],\"targetSum\":0}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"root\":[1],\"targetSum\":1}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"root\":[1,2],\"targetSum\":1}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"root\":[-2,null,-3],\"targetSum\":-5}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"root\":[1,2,null,3,null,4],\"targetSum\":10}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- HASH MAPS (3)
-- ============================================================

-- 11. Two Sum with Sorted Array
(
  'two-sum-sorted',
  'Two Sum II - Input Array Is Sorted',
  'easy',
  'Hash Maps',
  ARRAY['array', 'two-pointer', 'binary-search'],
  E'Given a **1-indexed** array of integers `numbers` that is already sorted in **non-decreasing order**, find two numbers such that they add up to a specific `target` number.\n\nReturn the indices of the two numbers, `index1` and `index2`, added by one as an integer array `[index1, index2]` of length 2.\n\nYour solution must use only constant extra space.',
  E'2 <= numbers.length <= 3 * 10^4\n-1000 <= numbers[i] <= 1000\nnumbers is sorted in non-decreasing order.\n-1000 <= target <= 1000\nThe tests are generated such that there is exactly one solution.',
  '[{"input":"numbers = [2,7,11,15], target = 9","output":"[1,2]","explanation":"2 + 7 = 9, indices 1 and 2."},{"input":"numbers = [2,3,4], target = 6","output":"[1,3]","explanation":"2 + 4 = 6."},{"input":"numbers = [-1,0], target = -1","output":"[1,2]","explanation":"-1 + 0 = -1."}]'::jsonb,
  '{"python3": "class Solution:\n    def twoSum(self, numbers: list[int], target: int) -> list[int]:\n        pass", "javascript": "/**\n * @param {number[]} numbers\n * @param {number} target\n * @return {number[]}\n */\nclass Solution {\n    twoSum(numbers, target) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int[] twoSum(int[] numbers, int target) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& numbers, int target) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.twoSum(input_data[\"numbers\"], input_data[\"target\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.twoSum(data.numbers, data.target)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] numbers = new Gson().fromJson(obj.get(\"numbers\"), int[].class);\n    int target = obj.get(\"target\").getAsInt();\n    System.out.println(Arrays.toString(new Solution().twoSum(numbers, target)));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto numbers = input[\"numbers\"].get<std::vector<int>>();\n  int target = input[\"target\"].get<int>();\n  Solution sol;\n  auto result = sol.twoSum(numbers, target);\n  std::cout << json(result).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"numbers\":[2,7,11,15],\"target\":9}","expected_output":"[1,2]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"numbers\":[2,3,4],\"target\":6}","expected_output":"[1,3]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"numbers\":[-1,0],\"target\":-1}","expected_output":"[1,2]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"numbers\":[-1000,-500,0,500,1000],\"target\":0}","expected_output":"[1,5]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"numbers\":[1,2,3,4,5,6,7,8,9,10],\"target\":19}","expected_output":"[9,10]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"numbers\":[5,25,75],\"target\":100}","expected_output":"[2,3]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"numbers\":[1,3],\"target\":4}","expected_output":"[1,2]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- 12. Isomorphic Strings
(
  'isomorphic-strings',
  'Isomorphic Strings',
  'easy',
  'Hash Maps',
  ARRAY['string', 'hash-map'],
  E'Given two strings `s` and `t`, determine if they are isomorphic.\n\nTwo strings `s` and `t` are isomorphic if the characters in `s` can be replaced to get `t`.\n\nAll occurrences of a character must be replaced with another character while preserving the order of characters. No two characters may map to the same character, but a character may map to itself.',
  E'1 <= s.length <= 5 * 10^4\nt.length == s.length\ns and t consist of any valid ASCII character.',
  '[{"input":"s = \"egg\", t = \"add\"","output":"true","explanation":"e→a, g→d."},{"input":"s = \"foo\", t = \"bar\"","output":"false","explanation":"o cannot map to both a and r."},{"input":"s = \"paper\", t = \"title\"","output":"true","explanation":"p→t, a→i, e→l, r→e."}]'::jsonb,
  '{"python3": "class Solution:\n    def isIsomorphic(self, s: str, t: str) -> bool:\n        pass", "javascript": "/**\n * @param {string} s\n * @param {string} t\n * @return {boolean}\n */\nclass Solution {\n    isIsomorphic(s, t) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public boolean isIsomorphic(String s, String t) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    bool isIsomorphic(string s, string t) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.isIsomorphic(input_data[\"s\"], input_data[\"t\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.isIsomorphic(data.s, data.t)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Solution().isIsomorphic(obj.get(\"s\").getAsString(), obj.get(\"t\").getAsString()));\n  }\n}", "cpp": "#include <iostream>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << json(sol.isIsomorphic(input[\"s\"].get<std::string>(), input[\"t\"].get<std::string>())).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"s\":\"egg\",\"t\":\"add\"}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"s\":\"foo\",\"t\":\"bar\"}","expected_output":"false","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"s\":\"paper\",\"t\":\"title\"}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"s\":\"badc\",\"t\":\"baba\"}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"s\":\"a\",\"t\":\"a\"}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"s\":\"ab\",\"t\":\"aa\"}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"s\":\"abcdefg\",\"t\":\"hijklmn\"}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"s\":\"aab\",\"t\":\"xxy\"}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- 13. Find All Numbers Disappeared in an Array
(
  'find-all-disappeared-numbers',
  'Find All Numbers Disappeared in an Array',
  'easy',
  'Hash Maps',
  ARRAY['array', 'hash-map'],
  E'Given an array `nums` of `n` integers where `nums[i]` is in the range `[1, n]`, return an array of all the integers in the range `[1, n]` that do not appear in `nums`.',
  E'n == nums.length\n1 <= n <= 10^5\n1 <= nums[i] <= n',
  '[{"input":"nums = [4,3,2,7,8,2,3,1]","output":"[5,6]","explanation":"5 and 6 are missing from [1..8]."},{"input":"nums = [1,1]","output":"[2]","explanation":"2 is missing from [1..2]."}]'::jsonb,
  '{"python3": "class Solution:\n    def findDisappearedNumbers(self, nums: list[int]) -> list[int]:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @return {number[]}\n */\nclass Solution {\n    findDisappearedNumbers(nums) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public List<Integer> findDisappearedNumbers(int[] nums) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<int> findDisappearedNumbers(vector<int>& nums) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.findDisappearedNumbers(input_data[\"nums\"])\nprint(json.dumps(sorted(result)))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.findDisappearedNumbers(data.nums).sort((a,b)=>a-b)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    List<Integer> result = new Solution().findDisappearedNumbers(nums);\n    Collections.sort(result);\n    System.out.println(new Gson().toJson(result));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <algorithm>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  Solution sol;\n  auto result = sol.findDisappearedNumbers(nums);\n  std::sort(result.begin(), result.end());\n  std::cout << json(result).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[4,3,2,7,8,2,3,1]}","expected_output":"[5,6]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[1,1]}","expected_output":"[2]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[1]}","expected_output":"[]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[2,2]}","expected_output":"[1]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[1,2,3,4,5]}","expected_output":"[]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[5,5,5,5,5]}","expected_output":"[1,2,3,4]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums\":[1,2,2,4]}","expected_output":"[3]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- SORTING (2)
-- ============================================================

-- 14. Sort Array by Parity
(
  'sort-array-by-parity',
  'Sort Array by Parity',
  'easy',
  'Sorting',
  ARRAY['array', 'sorting', 'two-pointer'],
  E'Given an integer array `nums`, move all the even integers at the beginning of the array followed by all the odd integers.\n\nReturn **any array** that satisfies this condition. (The relative order within even/odd groups does not matter.)',
  E'1 <= nums.length <= 5000\n0 <= nums[i] <= 5000',
  '[{"input":"nums = [3,1,2,4]","output":"[2,4,3,1]","explanation":"Evens first, then odds. Any valid order accepted."},{"input":"nums = [0]","output":"[0]","explanation":"Single element."}]'::jsonb,
  '{"python3": "class Solution:\n    def sortArrayByParity(self, nums: list[int]) -> list[int]:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @return {number[]}\n */\nclass Solution {\n    sortArrayByParity(nums) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int[] sortArrayByParity(int[] nums) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<int> sortArrayByParity(vector<int>& nums) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.sortArrayByParity(input_data[\"nums\"])\n# Validate: all evens before all odds\nevens = [x for x in result if x % 2 == 0]\nodds = [x for x in result if x % 2 != 0]\nif result[:len(evens)] == evens and result[len(evens):] == odds:\n    print(json.dumps(result))\nelse:\n    print(json.dumps([]))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  const result = sol.sortArrayByParity(data.nums);\n  // Normalize: sort evens then odds for deterministic comparison\n  const evens = result.filter(x => x%2===0).sort((a,b)=>a-b);\n  const odds = result.filter(x => x%2!==0).sort((a,b)=>a-b);\n  console.log(JSON.stringify([...evens,...odds]));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    int[] result = new Solution().sortArrayByParity(nums);\n    // Normalize output for deterministic comparison\n    List<Integer> evens = new ArrayList<>(), odds = new ArrayList<>();\n    for (int x : result) { if (x%2==0) evens.add(x); else odds.add(x); }\n    Collections.sort(evens); Collections.sort(odds);\n    evens.addAll(odds);\n    System.out.println(new Gson().toJson(evens));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <algorithm>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  Solution sol;\n  auto result = sol.sortArrayByParity(nums);\n  std::vector<int> evens, odds;\n  for (int x : result) { if (x%2==0) evens.push_back(x); else odds.push_back(x); }\n  std::sort(evens.begin(),evens.end()); std::sort(odds.begin(),odds.end());\n  for (int x : odds) evens.push_back(x);\n  std::cout << json(evens).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[3,1,2,4]}","expected_output":"[2,4,1,3]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[0]}","expected_output":"[0]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[1,3,5,7]}","expected_output":"[1,3,5,7]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[2,4,6,8]}","expected_output":"[2,4,6,8]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[1,2]}","expected_output":"[2,1]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[5000,4999,4998,4997]}","expected_output":"[4998,5000,4997,4999]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums\":[0,1,0,3,2]}","expected_output":"[0,0,2,1,3]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- 15. Merge Sorted Array
(
  'merge-sorted-array',
  'Merge Sorted Array',
  'easy',
  'Sorting',
  ARRAY['array', 'sorting', 'two-pointer'],
  E'You are given two integer arrays `nums1` and `nums2`, sorted in **non-decreasing order**, and two integers `m` and `n`, representing the number of elements in `nums1` and `nums2` respectively.\n\nMerge `nums1` and `nums2` into a single array sorted in **non-decreasing order**. Return the merged sorted array.',
  E'nums1.length == m + n\nnums2.length == n\n0 <= m, n <= 200\n1 <= m + n <= 200\n-10^9 <= nums1[i], nums2[j] <= 10^9',
  '[{"input":"nums1 = [1,2,3,0,0,0], m = 3, nums2 = [2,5,6], n = 3","output":"[1,2,2,3,5,6]","explanation":"Merged and sorted."},{"input":"nums1 = [1], m = 1, nums2 = [], n = 0","output":"[1]","explanation":"nums2 is empty."},{"input":"nums1 = [0], m = 0, nums2 = [1], n = 1","output":"[1]","explanation":"nums1 has no elements."}]'::jsonb,
  '{"python3": "class Solution:\n    def merge(self, nums1: list[int], m: int, nums2: list[int], n: int) -> list[int]:\n        pass", "javascript": "/**\n * @param {number[]} nums1\n * @param {number} m\n * @param {number[]} nums2\n * @param {number} n\n * @return {number[]}\n */\nclass Solution {\n    merge(nums1, m, nums2, n) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int[] merge(int[] nums1, int m, int[] nums2, int n) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<int> merge(vector<int>& nums1, int m, vector<int>& nums2, int n) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.merge(input_data[\"nums1\"], input_data[\"m\"], input_data[\"nums2\"], input_data[\"n\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.merge(data.nums1, data.m, data.nums2, data.n)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] n1 = new Gson().fromJson(obj.get(\"nums1\"), int[].class);\n    int[] n2 = new Gson().fromJson(obj.get(\"nums2\"), int[].class);\n    int m = obj.get(\"m\").getAsInt(), n = obj.get(\"n\").getAsInt();\n    System.out.println(Arrays.toString(new Solution().merge(n1, m, n2, n)));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto n1 = input[\"nums1\"].get<std::vector<int>>();\n  auto n2 = input[\"nums2\"].get<std::vector<int>>();\n  int m = input[\"m\"].get<int>(), n = input[\"n\"].get<int>();\n  Solution sol;\n  auto result = sol.merge(n1, m, n2, n);\n  std::cout << json(result).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums1\":[1,2,3,0,0,0],\"m\":3,\"nums2\":[2,5,6],\"n\":3}","expected_output":"[1,2,2,3,5,6]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums1\":[1],\"m\":1,\"nums2\":[],\"n\":0}","expected_output":"[1]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums1\":[0],\"m\":0,\"nums2\":[1],\"n\":1}","expected_output":"[1]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums1\":[2,0],\"m\":1,\"nums2\":[1],\"n\":1}","expected_output":"[1,2]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums1\":[-1,0,0,3,3,3,0,0,0],\"m\":6,\"nums2\":[1,2,2],\"n\":3}","expected_output":"[-1,0,0,1,2,2,3,3,3]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums1\":[4,5,6,0,0,0],\"m\":3,\"nums2\":[1,2,3],\"n\":3}","expected_output":"[1,2,3,4,5,6]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums1\":[0,0,0],\"m\":0,\"nums2\":[1,2,3],\"n\":3}","expected_output":"[1,2,3]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
)

ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  difficulty = EXCLUDED.difficulty,
  category = EXCLUDED.category,
  tags = EXCLUDED.tags,
  description = EXCLUDED.description,
  constraints = EXCLUDED.constraints,
  examples = EXCLUDED.examples,
  starter_code = EXCLUDED.starter_code,
  solution_wrappers = EXCLUDED.solution_wrappers,
  test_cases = EXCLUDED.test_cases,
  points = EXCLUDED.points,
  time_limit_seconds = EXCLUDED.time_limit_seconds,
  memory_limit_kb = EXCLUDED.memory_limit_kb,
  updated_at = now();
