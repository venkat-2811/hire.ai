-- DSA Problem Bank Expansion — EASY: Linked Lists, Stacks, Recursion, Bit Manipulation (Batch 4)
-- 15 new problems. Run AFTER existing seed files.

INSERT INTO public.dsa_problems (slug, title, difficulty, category, tags, description, constraints, examples, starter_code, solution_wrappers, test_cases, points, time_limit_seconds, memory_limit_kb)
VALUES

-- ============================================================
-- LINKED LISTS (5)
-- ============================================================

-- 1. Middle of the Linked List
(
  'middle-of-linked-list',
  'Middle of the Linked List',
  'easy',
  'Linked Lists',
  ARRAY['linked-list', 'two-pointer'],
  E'Given the `head` of a singly linked list (as an array), return the middle node of the linked list.\n\nIf there are two middle nodes, return the **second** middle node.',
  E'The number of nodes in the list is in the range [1, 100].\n1 <= Node.val <= 100',
  '[{"input":"head = [1,2,3,4,5]","output":"[3,4,5]","explanation":"Middle node is 3 (index 2). Return from 3 onwards."},{"input":"head = [1,2,3,4,5,6]","output":"[4,5,6]","explanation":"Two middles: 3 and 4 — return from second middle (4) onwards."}]'::jsonb,
  '{"python3": "class Solution:\n    def middleNode(self, head: list[int]) -> list[int]:\n        pass", "javascript": "/**\n * @param {number[]} head\n * @return {number[]}\n */\nclass Solution {\n    middleNode(head) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int[] middleNode(int[] head) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<int> middleNode(vector<int>& head) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.middleNode(input_data[\"head\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.middleNode(data.head)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] head = new Gson().fromJson(obj.get(\"head\"), int[].class);\n    System.out.println(Arrays.toString(new Solution().middleNode(head)));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto head = input[\"head\"].get<std::vector<int>>();\n  Solution sol;\n  auto result = sol.middleNode(head);\n  std::cout << json(result).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"head\":[1,2,3,4,5]}","expected_output":"[3,4,5]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"head\":[1,2,3,4,5,6]}","expected_output":"[4,5,6]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"head\":[1]}","expected_output":"[1]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"head\":[1,2]}","expected_output":"[2]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"head\":[1,2,3]}","expected_output":"[2,3]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"head\":[10,20,30,40,50,60,70,80,90,100]}","expected_output":"[60,70,80,90,100]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"head\":[5,5,5,5,5,5,5]}","expected_output":"[5,5,5,5]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- 2. Remove Duplicates from Sorted Linked List
(
  'remove-duplicates-sorted-list',
  'Remove Duplicates from Sorted List',
  'easy',
  'Linked Lists',
  ARRAY['linked-list'],
  E'Given the `head` of a sorted linked list (as an array), delete all duplicates such that each element appears only once. Return the linked list sorted as well.\n\nReturn the resulting array after removing duplicates.',
  E'The number of nodes in the list is in the range [0, 300].\n-100 <= Node.val <= 100\nThe list is guaranteed to be sorted in ascending order.',
  '[{"input":"head = [1,1,2]","output":"[1,2]","explanation":"Duplicate 1 removed."},{"input":"head = [1,1,2,3,3]","output":"[1,2,3]","explanation":"Duplicate 1 and 3 removed."}]'::jsonb,
  '{"python3": "class Solution:\n    def deleteDuplicates(self, head: list[int]) -> list[int]:\n        pass", "javascript": "/**\n * @param {number[]} head\n * @return {number[]}\n */\nclass Solution {\n    deleteDuplicates(head) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int[] deleteDuplicates(int[] head) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<int> deleteDuplicates(vector<int>& head) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.deleteDuplicates(input_data[\"head\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.deleteDuplicates(data.head)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] head = new Gson().fromJson(obj.get(\"head\"), int[].class);\n    System.out.println(Arrays.toString(new Solution().deleteDuplicates(head)));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto head = input[\"head\"].get<std::vector<int>>();\n  Solution sol;\n  auto result = sol.deleteDuplicates(head);\n  std::cout << json(result).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"head\":[1,1,2]}","expected_output":"[1,2]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"head\":[1,1,2,3,3]}","expected_output":"[1,2,3]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"head\":[]}","expected_output":"[]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"head\":[1]}","expected_output":"[1]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"head\":[1,1,1,1]}","expected_output":"[1]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"head\":[-3,-3,-1,0,0,1,2,2]}","expected_output":"[-3,-1,0,1,2]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"head\":[1,2,3,4,5]}","expected_output":"[1,2,3,4,5]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- 3. Linked List Cycle
(
  'linked-list-cycle',
  'Linked List Cycle',
  'easy',
  'Linked Lists',
  ARRAY['linked-list', 'two-pointer', 'hash-set'],
  E'Given an array representing the `next` pointers of a linked list (where `next[i]` is the index of the next node, or -1 for null), and the number of nodes `n`, determine if the linked list has a cycle.\n\nReturn `true` if there is a cycle in the linked list, otherwise return `false`.\n\n`vals` contains the node values, `next` contains the next pointer indices, `pos` is the index where the tail connects (-1 if no cycle).',
  E'0 <= n <= 10^4\n-10^5 <= vals[i] <= 10^5\n-1 <= next[i] < n\n-1 <= pos < n',
  '[{"input":"vals = [3,2,0,-4], next = [1,2,3,1], pos = 1","output":"true","explanation":"Tail connects to node at index 1, forming a cycle."},{"input":"vals = [1,2], next = [1,-1], pos = -1","output":"false","explanation":"No cycle."}]'::jsonb,
  '{"python3": "class Solution:\n    def hasCycle(self, vals: list[int], next_ptrs: list[int], pos: int) -> bool:\n        pass", "javascript": "/**\n * @param {number[]} vals\n * @param {number[]} next_ptrs\n * @param {number} pos\n * @return {boolean}\n */\nclass Solution {\n    hasCycle(vals, next_ptrs, pos) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public boolean hasCycle(int[] vals, int[] next_ptrs, int pos) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    bool hasCycle(vector<int>& vals, vector<int>& next_ptrs, int pos) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.hasCycle(input_data[\"vals\"], input_data[\"next\"], input_data[\"pos\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.hasCycle(data.vals, data.next, data.pos)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] vals = new Gson().fromJson(obj.get(\"vals\"), int[].class);\n    int[] nxt = new Gson().fromJson(obj.get(\"next\"), int[].class);\n    int pos = obj.get(\"pos\").getAsInt();\n    System.out.println(new Solution().hasCycle(vals, nxt, pos));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto vals = input[\"vals\"].get<std::vector<int>>();\n  auto nxt = input[\"next\"].get<std::vector<int>>();\n  int pos = input[\"pos\"].get<int>();\n  Solution sol;\n  std::cout << json(sol.hasCycle(vals, nxt, pos)).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"vals\":[3,2,0,-4],\"next\":[1,2,3,1],\"pos\":1}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"vals\":[1,2],\"next\":[1,-1],\"pos\":-1}","expected_output":"false","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"vals\":[1],\"next\":[-1],\"pos\":-1}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"vals\":[1],\"next\":[0],\"pos\":0}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"vals\":[1,2,3,4,5],\"next\":[1,2,3,4,-1],\"pos\":-1}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"vals\":[1,2,3,4,5],\"next\":[1,2,3,4,2],\"pos\":2}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"vals\":[5,4,3,2,1,0],\"next\":[1,2,3,4,5,0],\"pos\":0}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- 4. Palindrome Linked List
(
  'palindrome-linked-list',
  'Palindrome Linked List',
  'easy',
  'Linked Lists',
  ARRAY['linked-list', 'two-pointer', 'recursion'],
  E'Given the `head` of a singly linked list (as an array), return `true` if it is a palindrome or `false` otherwise.',
  E'The number of nodes in the list is in the range [1, 10^5].\n0 <= Node.val <= 9',
  '[{"input":"head = [1,2,2,1]","output":"true","explanation":"The list reads the same forward and backward."},{"input":"head = [1,2]","output":"false","explanation":"1,2 is not a palindrome."}]'::jsonb,
  '{"python3": "class Solution:\n    def isPalindrome(self, head: list[int]) -> bool:\n        pass", "javascript": "/**\n * @param {number[]} head\n * @return {boolean}\n */\nclass Solution {\n    isPalindrome(head) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public boolean isPalindrome(int[] head) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    bool isPalindrome(vector<int>& head) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.isPalindrome(input_data[\"head\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.isPalindrome(data.head)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] head = new Gson().fromJson(obj.get(\"head\"), int[].class);\n    System.out.println(new Solution().isPalindrome(head));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto head = input[\"head\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << json(sol.isPalindrome(head)).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"head\":[1,2,2,1]}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"head\":[1,2]}","expected_output":"false","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"head\":[1]}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"head\":[0,0]}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"head\":[1,2,3,2,1]}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"head\":[1,2,3,4,5]}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"head\":[9,9,9,9,9,9]}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"head\":[1,0,0,1]}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- 5. Remove Nth Node From End of List
(
  'remove-nth-from-end',
  'Remove Nth Node From End of List',
  'easy',
  'Linked Lists',
  ARRAY['linked-list', 'two-pointer'],
  E'Given the `head` of a linked list (as an array), remove the `n`th node from the end of the list and return the head (as an array).',
  E'The number of nodes in the list is sz.\n1 <= sz <= 30\n0 <= Node.val <= 100\n1 <= n <= sz',
  '[{"input":"head = [1,2,3,4,5], n = 2","output":"[1,2,3,5]","explanation":"Remove 4 (2nd from end)."},{"input":"head = [1], n = 1","output":"[]","explanation":"Remove the only node."},{"input":"head = [1,2], n = 1","output":"[1]","explanation":"Remove last node."}]'::jsonb,
  '{"python3": "class Solution:\n    def removeNthFromEnd(self, head: list[int], n: int) -> list[int]:\n        pass", "javascript": "/**\n * @param {number[]} head\n * @param {number} n\n * @return {number[]}\n */\nclass Solution {\n    removeNthFromEnd(head, n) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int[] removeNthFromEnd(int[] head, int n) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<int> removeNthFromEnd(vector<int>& head, int n) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.removeNthFromEnd(input_data[\"head\"], input_data[\"n\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.removeNthFromEnd(data.head, data.n)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] head = new Gson().fromJson(obj.get(\"head\"), int[].class);\n    int n = obj.get(\"n\").getAsInt();\n    System.out.println(Arrays.toString(new Solution().removeNthFromEnd(head, n)));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto head = input[\"head\"].get<std::vector<int>>();\n  int n = input[\"n\"].get<int>();\n  Solution sol;\n  auto result = sol.removeNthFromEnd(head, n);\n  std::cout << json(result).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"head\":[1,2,3,4,5],\"n\":2}","expected_output":"[1,2,3,5]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"head\":[1],\"n\":1}","expected_output":"[]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"head\":[1,2],\"n\":1}","expected_output":"[1]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"head\":[1,2],\"n\":2}","expected_output":"[2]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"head\":[1,2,3,4,5],\"n\":5}","expected_output":"[2,3,4,5]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"head\":[1,2,3,4,5],\"n\":1}","expected_output":"[1,2,3,4]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"head\":[10,20,30,40,50],\"n\":3}","expected_output":"[10,20,40,50]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- STACKS & QUEUES (4)
-- ============================================================

-- 6. Min Stack
(
  'min-stack',
  'Min Stack',
  'easy',
  'Stacks',
  ARRAY['stack', 'design'],
  E'Design a stack that supports push, pop, top, and retrieving the minimum element in constant time.\n\nImplement the `MinStack` class:\n- `push(val)` pushes the element val onto the stack.\n- `pop()` removes the element on the top of the stack.\n- `top()` gets the top element of the stack.\n- `getMin()` retrieves the minimum element in the stack.\n\nYou must implement a solution with O(1) time complexity for each function.\n\nFor testing, given a sequence of operations as a list and their arguments, return the results list (null for void operations).',
  E'Methods push, pop, top and getMin operations will always be called on non-empty stacks (except push).\n-2^31 <= val <= 2^31 - 1\nAt most 3 * 10^4 calls will be made to push, pop, top, and getMin.',
  '[{"input":"ops = [\"push\",\"push\",\"push\",\"getMin\",\"pop\",\"top\",\"getMin\"], args = [[-2],[0],[-3],[],[],[],[]]","output":"[null,null,null,-3,null,0,-2]","explanation":"After pushes -2,0,-3: min=-3. After pop: top=0, min=-2."}]'::jsonb,
  '{"python3": "class MinStack:\n    def __init__(self):\n        pass\n\n    def push(self, val: int) -> None:\n        pass\n\n    def pop(self) -> None:\n        pass\n\n    def top(self) -> int:\n        pass\n\n    def getMin(self) -> int:\n        pass\n\n\nclass Solution:\n    def simulate(self, ops: list[str], args: list[list]) -> list:\n        obj = MinStack()\n        result = []\n        for op, arg in zip(ops, args):\n            if op == \"push\":\n                obj.push(arg[0])\n                result.append(None)\n            elif op == \"pop\":\n                obj.pop()\n                result.append(None)\n            elif op == \"top\":\n                result.append(obj.top())\n            elif op == \"getMin\":\n                result.append(obj.getMin())\n        return result", "javascript": "class MinStack {\n    constructor() {\n        \n    }\n    push(val) {}\n    pop() {}\n    top() {}\n    getMin() {}\n}\n\nclass Solution {\n    simulate(ops, args) {\n        const obj = new MinStack();\n        return ops.map((op, i) => {\n            if (op === ''push'') { obj.push(args[i][0]); return null; }\n            if (op === ''pop'') { obj.pop(); return null; }\n            if (op === ''top'') return obj.top();\n            if (op === ''getMin'') return obj.getMin();\n        });\n    }\n}\n\nmodule.exports = Solution;", "java": "import java.util.*;\nclass MinStack {\n    public MinStack() {}\n    public void push(int val) {}\n    public void pop() {}\n    public int top() { return 0; }\n    public int getMin() { return 0; }\n}\n\nclass Solution {\n    public List<Integer> simulate(String[] ops, int[][] args) {\n        MinStack obj = new MinStack();\n        List<Integer> result = new ArrayList<>();\n        for (int i = 0; i < ops.length; i++) {\n            switch (ops[i]) {\n                case \"push\": obj.push(args[i].length > 0 ? args[i][0] : 0); result.add(null); break;\n                case \"pop\": obj.pop(); result.add(null); break;\n                case \"top\": result.add(obj.top()); break;\n                case \"getMin\": result.add(obj.getMin()); break;\n            }\n        }\n        return result;\n    }\n}", "cpp": "class MinStack {\npublic:\n    MinStack() {}\n    void push(int val) {}\n    void pop() {}\n    int top() { return 0; }\n    int getMin() { return 0; }\n};\n\nclass Solution {\npublic:\n    vector<int> simulate(vector<string>& ops, vector<vector<int>>& args) {\n        MinStack obj;\n        vector<int> result;\n        for (int i = 0; i < (int)ops.size(); i++) {\n            if (ops[i]==\"push\") { obj.push(args[i][0]); result.push_back(-1); }\n            else if (ops[i]==\"pop\") { obj.pop(); result.push_back(-1); }\n            else if (ops[i]==\"top\") result.push_back(obj.top());\n            else if (ops[i]==\"getMin\") result.push_back(obj.getMin());\n        }\n        return result;\n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.simulate(input_data[\"ops\"], input_data[\"args\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.simulate(data.ops, data.args)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    String[] ops = new Gson().fromJson(obj.get(\"ops\"), String[].class);\n    int[][] argArr = new Gson().fromJson(obj.get(\"args\"), int[][].class);\n    System.out.println(new Gson().toJson(new Solution().simulate(ops, argArr)));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto ops = input[\"ops\"].get<std::vector<std::string>>();\n  std::vector<std::vector<int>> argArr;\n  for (auto& a : input[\"args\"]) argArr.push_back(a.get<std::vector<int>>());\n  Solution sol;\n  auto result = sol.simulate(ops, argArr);\n  std::cout << json(result).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"ops\":[\"push\",\"push\",\"push\",\"getMin\",\"pop\",\"top\",\"getMin\"],\"args\":[[-2],[0],[-3],[],[],[],[]]}","expected_output":"[null,null,null,-3,null,0,-2]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"ops\":[\"push\",\"getMin\",\"pop\",\"push\",\"getMin\"],\"args\":[[5],[],[],[3],[]]}","expected_output":"[null,5,null,null,3]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"ops\":[\"push\",\"push\",\"getMin\",\"getMin\"],\"args\":[[1],[2],[],[]]}","expected_output":"[null,null,1,1]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"ops\":[\"push\",\"push\",\"push\",\"pop\",\"getMin\"],\"args\":[[1],[2],[0],[],[]]}","expected_output":"[null,null,null,null,1]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"ops\":[\"push\",\"top\",\"getMin\"],\"args\":[[42],[],[]]}","expected_output":"[null,42,42]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"ops\":[\"push\",\"push\",\"push\",\"pop\",\"pop\",\"getMin\"],\"args\":[[-5],[-3],[-1],[],[],[]]}","expected_output":"[null,null,null,null,null,-5]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- 7. Implement Queue using Stacks
(
  'implement-queue-using-stacks',
  'Implement Queue using Stacks',
  'easy',
  'Stacks',
  ARRAY['stack', 'queue', 'design'],
  E'Implement a first in first out (FIFO) queue using only two stacks. The implemented queue should support all the functions of a normal queue: push, peek, pop, and empty.\n\nFor testing, given ops and args arrays representing the operations, return the result list.',
  E'1 <= x <= 9\nAt most 100 calls will be made to push, pop, peek, and empty.\nAll calls to pop and peek are valid.',
  '[{"input":"ops = [\"push\",\"push\",\"peek\",\"pop\",\"empty\"], args = [[1],[2],[],[],[]]","output":"[null,null,1,1,false]","explanation":"Queue: push 1, push 2. peek=1, pop=1, empty=false."}]'::jsonb,
  '{"python3": "class MyQueue:\n    def __init__(self):\n        pass\n\n    def push(self, x: int) -> None:\n        pass\n\n    def pop(self) -> int:\n        pass\n\n    def peek(self) -> int:\n        pass\n\n    def empty(self) -> bool:\n        pass\n\n\nclass Solution:\n    def simulate(self, ops: list[str], args: list[list]) -> list:\n        q = MyQueue()\n        result = []\n        for op, arg in zip(ops, args):\n            if op == \"push\":\n                q.push(arg[0])\n                result.append(None)\n            elif op == \"pop\":\n                result.append(q.pop())\n            elif op == \"peek\":\n                result.append(q.peek())\n            elif op == \"empty\":\n                result.append(q.empty())\n        return result", "javascript": "class MyQueue {\n    constructor() {}\n    push(x) {}\n    pop() {}\n    peek() {}\n    empty() {}\n}\n\nclass Solution {\n    simulate(ops, args) {\n        const q = new MyQueue();\n        return ops.map((op, i) => {\n            if (op===''push'') { q.push(args[i][0]); return null; }\n            if (op===''pop'') return q.pop();\n            if (op===''peek'') return q.peek();\n            if (op===''empty'') return q.empty();\n        });\n    }\n}\n\nmodule.exports = Solution;", "java": "class MyQueue {\n    public void push(int x) {}\n    public int pop() { return 0; }\n    public int peek() { return 0; }\n    public boolean empty() { return true; }\n}\n\nclass Solution {\n    public List<Object> simulate(String[] ops, int[][] args) {\n        MyQueue q = new MyQueue();\n        List<Object> result = new ArrayList<>();\n        for (int i=0;i<ops.length;i++) {\n            switch(ops[i]) {\n                case \"push\": q.push(args[i][0]); result.add(null); break;\n                case \"pop\": result.add(q.pop()); break;\n                case \"peek\": result.add(q.peek()); break;\n                case \"empty\": result.add(q.empty()); break;\n            }\n        }\n        return result;\n    }\n}", "cpp": "class MyQueue {\npublic:\n    void push(int x) {}\n    int pop() { return 0; }\n    int peek() { return 0; }\n    bool empty() { return true; }\n};\n\nclass Solution {\npublic:\n    vector<string> simulate(vector<string>& ops, vector<vector<int>>& args) {\n        MyQueue q;\n        vector<string> result;\n        for (int i=0;i<(int)ops.size();i++) {\n            if(ops[i]==\"push\"){q.push(args[i][0]);result.push_back(\"null\");}\n            else if(ops[i]==\"pop\") result.push_back(std::to_string(q.pop()));\n            else if(ops[i]==\"peek\") result.push_back(std::to_string(q.peek()));\n            else if(ops[i]==\"empty\") result.push_back(q.empty()?\"true\":\"false\");\n        }\n        return result;\n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.simulate(input_data[\"ops\"], input_data[\"args\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.simulate(data.ops, data.args)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    String[] ops = new Gson().fromJson(obj.get(\"ops\"), String[].class);\n    int[][] argArr = new Gson().fromJson(obj.get(\"args\"), int[][].class);\n    System.out.println(new Gson().toJson(new Solution().simulate(ops, argArr)));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto ops = input[\"ops\"].get<std::vector<std::string>>();\n  std::vector<std::vector<int>> argArr;\n  for (auto& a : input[\"args\"]) argArr.push_back(a.is_array() ? a.get<std::vector<int>>() : std::vector<int>{});\n  Solution sol;\n  std::cout << json(sol.simulate(ops, argArr)).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"ops\":[\"push\",\"push\",\"peek\",\"pop\",\"empty\"],\"args\":[[1],[2],[],[],[]]}","expected_output":"[null,null,1,1,false]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"ops\":[\"push\",\"empty\",\"pop\",\"empty\"],\"args\":[[5],[],[],[]]}","expected_output":"[null,false,5,true]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"ops\":[\"push\",\"push\",\"push\",\"pop\",\"pop\",\"pop\"],\"args\":[[1],[2],[3],[],[],[]]}","expected_output":"[null,null,null,1,2,3]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"ops\":[\"push\",\"peek\",\"peek\"],\"args\":[[9],[],[]]}","expected_output":"[null,9,9]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"ops\":[\"push\",\"push\",\"push\",\"peek\",\"pop\",\"peek\"],\"args\":[[3],[7],[1],[],[],[]]}","expected_output":"[null,null,null,3,3,7]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- 8. Baseball Game
(
  'baseball-game',
  'Baseball Game',
  'easy',
  'Stacks',
  ARRAY['array', 'stack', 'simulation'],
  E'You are keeping the scores for a baseball game with strange rules. At the beginning of the game, you start with an empty record.\n\nYou are given a list of strings `operations`, where `operations[i]` is the ith operation you must apply to the record and is one of the following:\n- An integer x: Record a new score of x.\n- `"+"`: Record a new score that is the sum of the previous two scores.\n- `"D"`: Record a new score that is the double of the previous score.\n- `"C"`: Invalidate the previous score, removing it from the record.\n\nReturn the sum of all the scores on the record after applying all the operations.',
  E'1 <= operations.length <= 1000\noperations[i] is "C", "D", "+", or a string representing an integer in the range [-3 * 10^4, 3 * 10^4].\nFor "+" operation, there will always be at least two previous scores.\nFor "D" and "C" operations, there will always be at least one previous score.',
  '[{"input":"ops = [\"5\",\"2\",\"C\",\"D\",\"+\"]","output":"30","explanation":"5,2 → C removes 2 → D doubles 5→10 → + adds 5+10=15. Sum=5+10+15=30."},{"input":"ops = [\"5\",\"-2\",\"4\",\"C\",\"D\",\"9\",\"+\",\"+\"]","output":"27","explanation":"Multiple operations applied."}]'::jsonb,
  '{"python3": "class Solution:\n    def calPoints(self, operations: list[str]) -> int:\n        pass", "javascript": "/**\n * @param {string[]} operations\n * @return {number}\n */\nclass Solution {\n    calPoints(operations) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int calPoints(String[] operations) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int calPoints(vector<string>& operations) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.calPoints(input_data[\"ops\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.calPoints(data.ops)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    String[] ops = new Gson().fromJson(obj.get(\"ops\"), String[].class);\n    System.out.println(new Solution().calPoints(ops));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto ops = input[\"ops\"].get<std::vector<std::string>>();\n  Solution sol;\n  std::cout << sol.calPoints(ops);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"ops\":[\"5\",\"2\",\"C\",\"D\",\"+\"]}","expected_output":"30","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"ops\":[\"5\",\"-2\",\"4\",\"C\",\"D\",\"9\",\"+\",\"+\"]}","expected_output":"27","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"ops\":[\"1\"]}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"ops\":[\"1\",\"2\",\"+\"]}","expected_output":"6","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"ops\":[\"10\",\"D\",\"D\"]}","expected_output":"70","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"ops\":[\"1\",\"C\",\"2\",\"D\",\"+\"]}","expected_output":"10","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"ops\":[\"-30000\",\"D\",\"+\"]}","expected_output":"-150000","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- 9. Next Greater Element I
(
  'next-greater-element-i',
  'Next Greater Element I',
  'easy',
  'Stacks',
  ARRAY['array', 'hash-map', 'stack', 'monotonic-stack'],
  E'The **next greater element** of some element `x` in an array is the **first greater** element that is to the right of `x` in the same array.\n\nYou are given two **distinct 0-indexed** integer arrays `nums1` and `nums2`, where `nums1` is a subset of `nums2`.\n\nFor each `0 <= i < nums1.length`, find the index `j` such that `nums1[i] == nums2[j]` and determine the next greater element of `nums2[j]` in `nums2`. If there is no next greater element, then the answer for this query is `-1`.\n\nReturn an array `ans` of length `nums1.length` such that `ans[i]` is the next greater element of `nums1[i]`.',
  E'1 <= nums1.length <= nums2.length <= 1000\n0 <= nums1[i], nums2[i] <= 10^4\nAll integers in nums1 and nums2 are unique.\nAll the integers of nums1 also appear in nums2.',
  '[{"input":"nums1 = [4,1,2], nums2 = [1,3,4,2]","output":"[-1,3,-1]","explanation":"4 has no greater to right. 1 has 3. 2 has no greater."},{"input":"nums1 = [2,4], nums2 = [1,2,3,4]","output":"[3,-1]","explanation":"2 has 3 after it. 4 has none."}]'::jsonb,
  '{"python3": "class Solution:\n    def nextGreaterElement(self, nums1: list[int], nums2: list[int]) -> list[int]:\n        pass", "javascript": "/**\n * @param {number[]} nums1\n * @param {number[]} nums2\n * @return {number[]}\n */\nclass Solution {\n    nextGreaterElement(nums1, nums2) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int[] nextGreaterElement(int[] nums1, int[] nums2) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<int> nextGreaterElement(vector<int>& nums1, vector<int>& nums2) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.nextGreaterElement(input_data[\"nums1\"], input_data[\"nums2\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.nextGreaterElement(data.nums1, data.nums2)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] n1 = new Gson().fromJson(obj.get(\"nums1\"), int[].class);\n    int[] n2 = new Gson().fromJson(obj.get(\"nums2\"), int[].class);\n    System.out.println(Arrays.toString(new Solution().nextGreaterElement(n1, n2)));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto n1 = input[\"nums1\"].get<std::vector<int>>();\n  auto n2 = input[\"nums2\"].get<std::vector<int>>();\n  Solution sol;\n  auto result = sol.nextGreaterElement(n1, n2);\n  std::cout << json(result).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums1\":[4,1,2],\"nums2\":[1,3,4,2]}","expected_output":"[-1,3,-1]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums1\":[2,4],\"nums2\":[1,2,3,4]}","expected_output":"[3,-1]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums1\":[1],\"nums2\":[1]}","expected_output":"[-1]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums1\":[1,3,5,2,4],\"nums2\":[6,5,4,3,2,1,7]}","expected_output":"[7,7,7,7,7]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums1\":[2],\"nums2\":[3,1,2]}","expected_output":"[-1]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums1\":[1],\"nums2\":[2,1,4]}","expected_output":"[4]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- RECURSION (3)
-- ============================================================

-- 10. Power of Three
(
  'power-of-three',
  'Power of Three',
  'easy',
  'Math',
  ARRAY['math', 'recursion'],
  E'Given an integer `n`, return `true` if it is a power of three. Otherwise, return `false`.\n\nAn integer `n` is a power of three if there exists an integer `x` such that `n == 3^x`.\n\nFollow-up: Could you solve it without loops or recursion?',
  E'-2^31 <= n <= 2^31 - 1',
  '[{"input":"n = 27","output":"true","explanation":"27 = 3^3."},{"input":"n = 0","output":"false","explanation":"0 is not a power of three."},{"input":"n = 9","output":"true","explanation":"9 = 3^2."}]'::jsonb,
  '{"python3": "class Solution:\n    def isPowerOfThree(self, n: int) -> bool:\n        pass", "javascript": "/**\n * @param {number} n\n * @return {boolean}\n */\nclass Solution {\n    isPowerOfThree(n) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public boolean isPowerOfThree(int n) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    bool isPowerOfThree(int n) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.isPowerOfThree(input_data[\"n\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.isPowerOfThree(data.n)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Solution().isPowerOfThree(obj.get(\"n\").getAsInt()));\n  }\n}", "cpp": "#include <iostream>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << json(sol.isPowerOfThree(input[\"n\"].get<int>())).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"n\":27}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"n\":0}","expected_output":"false","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"n\":9}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"n\":1}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"n\":-1}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"n\":729}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"n\":243}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"n\":1162261467}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- 11. Sum of Digits Until Single Digit
(
  'sum-of-digits-single',
  'Add Digits',
  'easy',
  'Math',
  ARRAY['math', 'simulation', 'number-theory'],
  E'Given an integer `num`, repeatedly add all its digits until the result has only one digit, and return it.\n\nFor example: 38 → 3+8=11 → 1+1=2.',
  E'0 <= num <= 2^31 - 1',
  '[{"input":"num = 38","output":"2","explanation":"38 → 11 → 2."},{"input":"num = 0","output":"0","explanation":"0 is already single digit."}]'::jsonb,
  '{"python3": "class Solution:\n    def addDigits(self, num: int) -> int:\n        pass", "javascript": "/**\n * @param {number} num\n * @return {number}\n */\nclass Solution {\n    addDigits(num) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int addDigits(int num) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int addDigits(int num) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.addDigits(input_data[\"num\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.addDigits(data.num)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Solution().addDigits(obj.get(\"num\").getAsInt()));\n  }\n}", "cpp": "#include <iostream>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << sol.addDigits(input[\"num\"].get<int>());\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"num\":38}","expected_output":"2","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"num\":0}","expected_output":"0","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"num\":9}","expected_output":"9","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"num\":1}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"num\":999}","expected_output":"9","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"num\":1000}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"num\":2147483647}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"num\":10}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- 12. Counting Bits
(
  'counting-bits',
  'Counting Bits',
  'easy',
  'Bit Manipulation',
  ARRAY['dynamic-programming', 'bit-manipulation'],
  E'Given an integer `n`, return an array `ans` of length `n + 1` such that for each `i` (0 <= i <= n), `ans[i]` is the **number of 1's** in the binary representation of `i`.',
  E'0 <= n <= 10^5',
  '[{"input":"n = 2","output":"[0,1,1]","explanation":"0=0b0→0, 1=0b1→1, 2=0b10→1."},{"input":"n = 5","output":"[0,1,1,2,1,2]","explanation":"Counts of 1-bits for 0..5."}]'::jsonb,
  '{"python3": "class Solution:\n    def countBits(self, n: int) -> list[int]:\n        pass", "javascript": "/**\n * @param {number} n\n * @return {number[]}\n */\nclass Solution {\n    countBits(n) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int[] countBits(int n) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<int> countBits(int n) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.countBits(input_data[\"n\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.countBits(data.n)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(Arrays.toString(new Solution().countBits(obj.get(\"n\").getAsInt())));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  auto result = sol.countBits(input[\"n\"].get<int>());\n  std::cout << json(result).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"n\":2}","expected_output":"[0,1,1]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"n\":5}","expected_output":"[0,1,1,2,1,2]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"n\":0}","expected_output":"[0]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"n\":1}","expected_output":"[0,1]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"n\":8}","expected_output":"[0,1,1,2,1,2,2,3,1]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"n\":15}","expected_output":"[0,1,1,2,1,2,2,3,1,2,2,3,2,3,3,4]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"n\":10}","expected_output":"[0,1,1,2,1,2,2,3,1,2,2]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- BIT MANIPULATION (3)
-- ============================================================

-- 13. Number of 1 Bits
(
  'number-of-1-bits',
  'Number of 1 Bits',
  'easy',
  'Bit Manipulation',
  ARRAY['divide-and-conquer', 'bit-manipulation'],
  E'Write a function that takes the binary representation of a positive integer and returns the number of **set bits** it has (also known as the Hamming weight).',
  E'1 <= n <= 2^31 - 1',
  '[{"input":"n = 11","output":"3","explanation":"11 in binary is 1011, which has 3 set bits."},{"input":"n = 128","output":"1","explanation":"128 = 10000000 in binary, 1 set bit."},{"input":"n = 2147483645","output":"30","explanation":"30 set bits."}]'::jsonb,
  '{"python3": "class Solution:\n    def hammingWeight(self, n: int) -> int:\n        pass", "javascript": "/**\n * @param {number} n\n * @return {number}\n */\nclass Solution {\n    hammingWeight(n) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int hammingWeight(int n) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int hammingWeight(uint32_t n) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.hammingWeight(input_data[\"n\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.hammingWeight(data.n)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Solution().hammingWeight(obj.get(\"n\").getAsInt()));\n  }\n}", "cpp": "#include <iostream>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << sol.hammingWeight((uint32_t)input[\"n\"].get<long long>());\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"n\":11}","expected_output":"3","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"n\":128}","expected_output":"1","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"n\":2147483645}","expected_output":"30","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"n\":1}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"n\":2147483647}","expected_output":"31","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"n\":255}","expected_output":"8","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"n\":1024}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"n\":65535}","expected_output":"16","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- 14. Reverse Bits
(
  'reverse-bits',
  'Reverse Bits',
  'easy',
  'Bit Manipulation',
  ARRAY['divide-and-conquer', 'bit-manipulation'],
  E'Reverse bits of a given 32 bits unsigned integer.\n\nFor example, the number 43261596 (in binary: 00000010100101000001111010011100) reversed gives 964176192 (binary: 00111001011110000010100101000000).',
  E'The input must be a binary string of length 32.',
  '[{"input":"n = 43261596","output":"964176192","explanation":"00000010100101000001111010011100 reversed."},{"input":"n = 4294967293","output":"3221225471","explanation":"11111111111111111111111111111101 reversed."}]'::jsonb,
  '{"python3": "class Solution:\n    def reverseBits(self, n: int) -> int:\n        pass", "javascript": "/**\n * @param {number} n - a positive integer\n * @return {number} - a positive integer\n */\nclass Solution {\n    reverseBits(n) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public long reverseBits(long n) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    uint32_t reverseBits(uint32_t n) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.reverseBits(input_data[\"n\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.reverseBits(data.n)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Solution().reverseBits(obj.get(\"n\").getAsLong()));\n  }\n}", "cpp": "#include <iostream>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << sol.reverseBits((uint32_t)input[\"n\"].get<long long>());\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"n\":43261596}","expected_output":"964176192","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"n\":4294967293}","expected_output":"3221225471","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"n\":0}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"n\":4294967295}","expected_output":"4294967295","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"n\":1}","expected_output":"2147483648","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"n\":2147483648}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"n\":2147483647}","expected_output":"4294967294","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- 15. XOR of All Elements
(
  'xor-all-elements',
  'Find the Difference',
  'easy',
  'Bit Manipulation',
  ARRAY['string', 'hash-map', 'sorting', 'bit-manipulation'],
  E'You are given two strings `s` and `t`.\n\nString `t` is generated by random shuffling string `s` and then add one more letter at a random position.\n\nReturn the letter that was added to `t`.',
  E'0 <= s.length <= 1000\nt.length == s.length + 1\ns and t consist of lowercase English letters.',
  '[{"input":"s = \"abcd\", t = \"abcde\"","output":"\"e\"","explanation":"e is the extra character."},{"input":"s = \"\", t = \"y\"","output":"\"y\"","explanation":"Empty s, y is the extra."}]'::jsonb,
  '{"python3": "class Solution:\n    def findTheDifference(self, s: str, t: str) -> str:\n        pass", "javascript": "/**\n * @param {string} s\n * @param {string} t\n * @return {string}\n */\nclass Solution {\n    findTheDifference(s, t) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public char findTheDifference(String s, String t) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    char findTheDifference(string s, string t) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.findTheDifference(input_data[\"s\"], input_data[\"t\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.findTheDifference(data.s, data.t)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Gson().toJson(String.valueOf(new Solution().findTheDifference(obj.get(\"s\").getAsString(), obj.get(\"t\").getAsString()))));\n  }\n}", "cpp": "#include <iostream>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  char result = sol.findTheDifference(input[\"s\"].get<std::string>(), input[\"t\"].get<std::string>());\n  std::cout << json(std::string(1, result)).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"s\":\"abcd\",\"t\":\"abcde\"}","expected_output":"\"e\"","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"s\":\"\",\"t\":\"y\"}","expected_output":"\"y\"","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"s\":\"a\",\"t\":\"aa\"}","expected_output":"\"a\"","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"s\":\"ae\",\"t\":\"aea\"}","expected_output":"\"a\"","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"s\":\"abc\",\"t\":\"cbaz\"}","expected_output":"\"z\"","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"s\":\"aaaa\",\"t\":\"aaaab\"}","expected_output":"\"b\"","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"s\":\"xyz\",\"t\":\"xyza\"}","expected_output":"\"a\"","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
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
