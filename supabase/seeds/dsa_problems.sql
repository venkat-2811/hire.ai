-- DSA Problem Bank Seed Data
-- Curated LeetCode-style problems across difficulty levels and categories
-- Each problem has: public test cases (visible), private test cases (hidden), edge cases

INSERT INTO public.dsa_problems (slug, title, difficulty, category, tags, description, constraints, examples, starter_code, solution_wrappers, test_cases, points, time_limit_seconds, memory_limit_kb)
VALUES

-- ============================================================
-- EASY PROBLEMS
-- ============================================================

(
  'two-sum',
  'Two Sum',
  'easy',
  'Arrays',
  ARRAY['hash-map', 'arrays'],
  E'Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have **exactly one solution**, and you may not use the same element twice.\n\nYou can return the answer in any order.',
  E'2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9\nOnly one valid answer exists.',
  '[{"input":"nums = [2,7,11,15], target = 9","output":"[0,1]","explanation":"Because nums[0] + nums[1] == 9, we return [0, 1]."},{"input":"nums = [3,2,4], target = 6","output":"[1,2]","explanation":"Because nums[1] + nums[2] == 6, we return [1, 2]."}]'::jsonb,
  '{"python3": "class Solution:\n    def twoSum(self, nums: list[int], target: int) -> list[int]:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @param {number} target\n * @return {number[]}\n */\nclass Solution {\n    twoSum(nums, target) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        \n    }\n};"}'::jsonb,
  '{
    "python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.twoSum(input_data[\"nums\"], input_data[\"target\"])\nprint(json.dumps(sorted(result)))",
    "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const result = twoSum(data.nums, data.target);\n  console.log(JSON.stringify(result.sort((a,b)=>a-b)));\n});",
    "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    String input = sc.nextLine();\n    JsonObject obj = JsonParser.parseString(input).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    int target = obj.get(\"target\").getAsInt();\n    int[] result = new Solution().twoSum(nums, target);\n    Arrays.sort(result);\n    System.out.println(Arrays.toString(result));\n  }\n}",
    "cpp": "#include <iostream>\n#include <vector>\n#include <algorithm>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  std::vector<int> nums = input[\"nums\"].get<std::vector<int>>();\n  int target = input[\"target\"].get<int>();\n  Solution sol;\n  auto result = sol.twoSum(nums, target);\n  std::sort(result.begin(), result.end());\n  std::cout << json(result).dump();\n}"
  }'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[2,7,11,15],\"target\":9}","expected_output":"[0,1]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[3,2,4],\"target\":6}","expected_output":"[1,2]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[3,3],\"target\":6}","expected_output":"[0,1]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[1,5,3,7,2,8],\"target\":10}","expected_output":"[1,3]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[-1,-2,-3,-4,-5],\"target\":-8}","expected_output":"[2,4]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[0,4,3,0],\"target\":0}","expected_output":"[0,3]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums\":[1000000000,-1000000000,3,2],\"target\":0}","expected_output":"[0,1]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

(
  'valid-parentheses',
  'Valid Parentheses',
  'easy',
  'Stacks',
  ARRAY['stack', 'string'],
  E'Given a string `s` containing just the characters `''(''`, `'')''`, `''{''`, `''}''`, `''[''` and `'']''`, determine if the input string is valid.\n\nAn input string is valid if:\n1. Open brackets must be closed by the same type of brackets.\n2. Open brackets must be closed in the correct order.\n3. Every close bracket has a corresponding open bracket of the same type.',
  E'1 <= s.length <= 10^4\ns consists of parentheses only ''()[]{}''.', 
  '[{"input":"s = \"()\"","output":"true","explanation":"Simple valid pair."},{"input":"s = \"()[]{}\"","output":"true","explanation":"Multiple valid pairs."},{"input":"s = \"(]\"","output":"false","explanation":"Mismatched brackets."}]'::jsonb,
  '{
    "python3": "class Solution:\n    def isValid(self, s: str) -> bool:\n        pass",
    "javascript": "/**\n * @param {string} s\n * @return {boolean}\n */\nvar isValid = function(s) {\n    \n};",
    "java": "class Solution {\n    public boolean isValid(String s) {\n        \n    }\n}",
    "cpp": "class Solution {\npublic:\n    bool isValid(string s) {\n        \n    }\n};"
  }'::jsonb,
  '{
    "python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.isValid(input_data[\"s\"])\nprint(json.dumps(result))",
    "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  console.log(JSON.stringify(isValid(data.s)));\n});",
    "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Solution().isValid(obj.get(\"s\").getAsString()));\n  }\n}",
    "cpp": "#include <iostream>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << json(sol.isValid(input[\"s\"].get<std::string>())).dump();\n}"
  }'::jsonb,
  '[
    {"id":"tc1","input":"{\"s\":\"()\"}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"s\":\"()[]{}\"}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"s\":\"(]\"}","expected_output":"false","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"s\":\"([{}])\"}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"s\":\"((()))\"}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"s\":\"]\"}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"s\":\"\"}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"s\":\"(((((((((())))))))))\"}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

(
  'reverse-linked-list',
  'Reverse Linked List',
  'easy',
  'Linked Lists',
  ARRAY['linked-list', 'recursion'],
  E'Given the `head` of a singly linked list, reverse the list, and return the reversed list.\n\nThe linked list is represented as an array for input/output purposes.',
  E'The number of nodes in the list is the range [0, 5000].\n-5000 <= Node.val <= 5000',
  '[{"input":"head = [1,2,3,4,5]","output":"[5,4,3,2,1]","explanation":"Reverse the entire list."},{"input":"head = [1,2]","output":"[2,1]","explanation":"Simple two-node reversal."}]'::jsonb,
  '{"python3": "class Solution:\n    def reverseList(self, head: list[int]) -> list[int]:\n        # Input/output as arrays for simplicity\n        pass", "javascript": "/**\n * @param {number[]} head\n * @return {number[]}\n */\nclass Solution {\n    reverseList(head) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int[] reverseList(int[] head) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<int> reverseList(vector<int>& head) {\n        \n    }\n};"}'::jsonb,
  '{
    "python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.reverseList(input_data[\"head\"])\nprint(json.dumps(result))",
    "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  console.log(JSON.stringify(reverseList(data.head)));\n});",
    "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] head = new Gson().fromJson(obj.get(\"head\"), int[].class);\n    System.out.println(Arrays.toString(new Solution().reverseList(head)));\n  }\n}",
    "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  std::vector<int> head = input[\"head\"].get<std::vector<int>>();\n  Solution sol;\n  auto result = sol.reverseList(head);\n  std::cout << json(result).dump();\n}"
  }'::jsonb,
  '[
    {"id":"tc1","input":"{\"head\":[1,2,3,4,5]}","expected_output":"[5,4,3,2,1]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"head\":[1,2]}","expected_output":"[2,1]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"head\":[]}","expected_output":"[]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"head\":[1]}","expected_output":"[1]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"head\":[1,1,1,1,1]}","expected_output":"[1,1,1,1,1]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"head\":[10,20,30,40,50,60,70,80,90,100]}","expected_output":"[100,90,80,70,60,50,40,30,20,10]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- MEDIUM PROBLEMS
-- ============================================================

(
  'longest-substring-without-repeating',
  'Longest Substring Without Repeating Characters',
  'medium',
  'Strings',
  ARRAY['sliding-window', 'hash-map', 'string'],
  E'Given a string `s`, find the length of the **longest substring** without repeating characters.',
  E'0 <= s.length <= 5 * 10^4\ns consists of English letters, digits, symbols and spaces.',
  '[{"input":"s = \"abcabcbb\"","output":"3","explanation":"The answer is \"abc\", with the length of 3."},{"input":"s = \"bbbbb\"","output":"1","explanation":"The answer is \"b\", with the length of 1."},{"input":"s = \"pwwkew\"","output":"3","explanation":"The answer is \"wke\", with the length of 3."}]'::jsonb,
  '{"python3": "class Solution:\n    def lengthOfLongestSubstring(self, s: str) -> int:\n        pass", "javascript": "/**\n * @param {string} s\n * @return {number}\n */\nclass Solution {\n    lengthOfLongestSubstring(s) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int lengthOfLongestSubstring(String s) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int lengthOfLongestSubstring(string s) {\n        \n    }\n};"}'::jsonb,
  '{
    "python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.lengthOfLongestSubstring(input_data[\"s\"])\nprint(json.dumps(result))",
    "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  console.log(JSON.stringify(lengthOfLongestSubstring(data.s)));\n});",
    "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Solution().lengthOfLongestSubstring(obj.get(\"s\").getAsString()));\n  }\n}",
    "cpp": "#include <iostream>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << sol.lengthOfLongestSubstring(input[\"s\"].get<std::string>());\n}"
  }'::jsonb,
  '[
    {"id":"tc1","input":"{\"s\":\"abcabcbb\"}","expected_output":"3","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"s\":\"bbbbb\"}","expected_output":"1","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"s\":\"pwwkew\"}","expected_output":"3","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"s\":\"\"}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"s\":\" \"}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"s\":\"dvdf\"}","expected_output":"3","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"s\":\"anviaj\"}","expected_output":"5","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"s\":\"abcdefghijklmnopqrstuvwxyz\"}","expected_output":"26","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

(
  'container-with-most-water',
  'Container With Most Water',
  'medium',
  'Arrays',
  ARRAY['two-pointer', 'greedy', 'arrays'],
  E'You are given an integer array `height` of length `n`. There are `n` vertical lines drawn such that the two endpoints of the `i`th line are `(i, 0)` and `(i, height[i])`.\n\nFind two lines that together with the x-axis form a container, such that the container contains the most water.\n\nReturn the maximum amount of water a container can store.\n\n**Notice** that you may not slant the container.',
  E'n == height.length\n2 <= n <= 10^5\n0 <= height[i] <= 10^4',
  '[{"input":"height = [1,8,6,2,5,4,8,3,7]","output":"49","explanation":"The max area is between index 1 (height 8) and index 8 (height 7), area = 7 * 7 = 49."},{"input":"height = [1,1]","output":"1","explanation":"Only two lines, area = 1 * 1 = 1."}]'::jsonb,
  '{"python3": "class Solution:\n    def maxArea(self, height: list[int]) -> int:\n        pass", "javascript": "/**\n * @param {number[]} height\n * @return {number}\n */\nclass Solution {\n    maxArea(height) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int maxArea(int[] height) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int maxArea(vector<int>& height) {\n        \n    }\n};"}'::jsonb,
  '{
    "python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.maxArea(input_data[\"height\"])\nprint(json.dumps(result))",
    "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  console.log(JSON.stringify(maxArea(data.height)));\n});",
    "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] height = new Gson().fromJson(obj.get(\"height\"), int[].class);\n    System.out.println(new Solution().maxArea(height));\n  }\n}",
    "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto height = input[\"height\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << sol.maxArea(height);\n}"
  }'::jsonb,
  '[
    {"id":"tc1","input":"{\"height\":[1,8,6,2,5,4,8,3,7]}","expected_output":"49","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"height\":[1,1]}","expected_output":"1","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"height\":[4,3,2,1,4]}","expected_output":"16","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"height\":[1,2,1]}","expected_output":"2","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"height\":[10000,10000]}","expected_output":"10000","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"height\":[1,2,4,3]}","expected_output":"4","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

(
  'binary-tree-level-order',
  'Binary Tree Level Order Traversal',
  'medium',
  'Trees',
  ARRAY['bfs', 'tree', 'queue'],
  E'Given the `root` of a binary tree, return the level order traversal of its nodes'' values. (i.e., from left to right, level by level).\n\nThe tree is represented as an array in level-order (BFS) format where `null` indicates empty nodes.',
  E'The number of nodes in the tree is in the range [0, 2000].\n-1000 <= Node.val <= 1000',
  '[{"input":"root = [3,9,20,null,null,15,7]","output":"[[3],[9,20],[15,7]]","explanation":"Level 0: [3], Level 1: [9,20], Level 2: [15,7]"},{"input":"root = [1]","output":"[[1]]","explanation":"Single node tree."}]'::jsonb,
  '{"python3": "class Solution:\n    def levelOrder(self, root: list) -> list[list[int]]:\n        # root is given as level-order array, e.g. [3,9,20,None,None,15,7]\n        pass", "javascript": "/**\n * @param {(number|null)[]} root - level-order array\n * @return {number[][]}\n */\nclass Solution {\n    levelOrder(root) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    // root is level-order Integer array with nulls\n    public List<List<Integer>> levelOrder(Integer[] root) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    // root is level-order vector with -1001 as null sentinel\n    vector<vector<int>> levelOrder(vector<int>& root) {\n        \n    }\n};"}'::jsonb,
  '{
    "python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.levelOrder(input_data[\"root\"])\nprint(json.dumps(result))",
    "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  console.log(JSON.stringify(levelOrder(data.root)));\n});",
    "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    JsonArray arr = obj.getAsJsonArray(\"root\");\n    Integer[] root = new Integer[arr.size()];\n    for (int i = 0; i < arr.size(); i++) root[i] = arr.get(i).isJsonNull() ? null : arr.get(i).getAsInt();\n    System.out.println(new Gson().toJson(new Solution().levelOrder(root)));\n  }\n}",
    "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  std::vector<int> root;\n  for (auto& v : input[\"root\"]) root.push_back(v.is_null() ? -1001 : v.get<int>());\n  Solution sol;\n  auto result = sol.levelOrder(root);\n  std::cout << json(result).dump();\n}"
  }'::jsonb,
  '[
    {"id":"tc1","input":"{\"root\":[3,9,20,null,null,15,7]}","expected_output":"[[3],[9,20],[15,7]]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"root\":[1]}","expected_output":"[[1]]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"root\":[]}","expected_output":"[]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"root\":[1,2,3,4,5,6,7]}","expected_output":"[[1],[2,3],[4,5,6,7]]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"root\":[1,null,2,null,3]}","expected_output":"[[1],[2],[3]]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- ============================================================
-- HARD PROBLEMS
-- ============================================================

(
  'merge-k-sorted-lists',
  'Merge k Sorted Lists',
  'hard',
  'Linked Lists',
  ARRAY['heap', 'divide-and-conquer', 'linked-list'],
  E'You are given an array of `k` linked-lists `lists`, each linked-list is sorted in ascending order.\n\nMerge all the linked-lists into one sorted linked-list and return it.\n\nLinked lists are represented as arrays for input/output.',
  E'k == lists.length\n0 <= k <= 10^4\n0 <= lists[i].length <= 500\n-10^4 <= lists[i][j] <= 10^4\nlists[i] is sorted in ascending order.\nThe sum of lists[i].length will not exceed 10^4.',
  '[{"input":"lists = [[1,4,5],[1,3,4],[2,6]]","output":"[1,1,2,3,4,4,5,6]","explanation":"Merge all three sorted lists into one."},{"input":"lists = []","output":"[]","explanation":"Empty input."}]'::jsonb,
  '{"python3": "class Solution:\n    def mergeKLists(self, lists: list[list[int]]) -> list[int]:\n        pass", "javascript": "/**\n * @param {number[][]} lists\n * @return {number[]}\n */\nclass Solution {\n    mergeKLists(lists) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int[] mergeKLists(int[][] lists) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<int> mergeKLists(vector<vector<int>>& lists) {\n        \n    }\n};"}'::jsonb,
  '{
    "python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.mergeKLists(input_data[\"lists\"])\nprint(json.dumps(result))",
    "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  console.log(JSON.stringify(mergeKLists(data.lists)));\n});",
    "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[][] lists = new Gson().fromJson(obj.get(\"lists\"), int[][].class);\n    System.out.println(Arrays.toString(new Solution().mergeKLists(lists)));\n  }\n}",
    "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  std::vector<std::vector<int>> lists;\n  for (auto& l : input[\"lists\"]) lists.push_back(l.get<std::vector<int>>());\n  Solution sol;\n  auto result = sol.mergeKLists(lists);\n  std::cout << json(result).dump();\n}"
  }'::jsonb,
  '[
    {"id":"tc1","input":"{\"lists\":[[1,4,5],[1,3,4],[2,6]]}","expected_output":"[1,1,2,3,4,4,5,6]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"lists\":[]}","expected_output":"[]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"lists\":[[]]}","expected_output":"[]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"lists\":[[1],[2],[3],[4],[5]]}","expected_output":"[1,2,3,4,5]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"lists\":[[-2,-1,0],[0,1,2],[-3,3]]}","expected_output":"[-3,-2,-1,0,0,1,2,3]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"lists\":[[1,1,1],[1,1,1],[1,1,1]]}","expected_output":"[1,1,1,1,1,1,1,1,1]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  150, 5, 262144
),

(
  'trapping-rain-water',
  'Trapping Rain Water',
  'hard',
  'Arrays',
  ARRAY['two-pointer', 'stack', 'dynamic-programming'],
  E'Given `n` non-negative integers representing an elevation map where the width of each bar is `1`, compute how much water it can trap after raining.',
  E'n == height.length\n1 <= n <= 2 * 10^4\n0 <= height[i] <= 10^5',
  '[{"input":"height = [0,1,0,2,1,0,1,3,2,1,2,1]","output":"6","explanation":"6 units of rain water are trapped."},{"input":"height = [4,2,0,3,2,5]","output":"9","explanation":"9 units of rain water are trapped."}]'::jsonb,
  '{"python3": "class Solution:\n    def trap(self, height: list[int]) -> int:\n        pass", "javascript": "/**\n * @param {number[]} height\n * @return {number}\n */\nclass Solution {\n    trap(height) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int trap(int[] height) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int trap(vector<int>& height) {\n        \n    }\n};"}'::jsonb,
  '{
    "python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.trap(input_data[\"height\"])\nprint(json.dumps(result))",
    "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  console.log(JSON.stringify(trap(data.height)));\n});",
    "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] height = new Gson().fromJson(obj.get(\"height\"), int[].class);\n    System.out.println(new Solution().trap(height));\n  }\n}",
    "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto height = input[\"height\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << sol.trap(height);\n}"
  }'::jsonb,
  '[
    {"id":"tc1","input":"{\"height\":[0,1,0,2,1,0,1,3,2,1,2,1]}","expected_output":"6","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"height\":[4,2,0,3,2,5]}","expected_output":"9","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"height\":[0]}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"height\":[1,2,3,4,5]}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"height\":[5,4,3,2,1]}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"height\":[5,2,1,2,1,5]}","expected_output":"14","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"height\":[0,0,0,0]}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"height\":[3,0,0,0,3]}","expected_output":"9","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  150, 5, 262144
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

-- Additional 25 problems are in dsa_problems_extra.sql
