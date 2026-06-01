-- DSA Problem Bank - Additional 25 LeetCode-style Problems
-- Run AFTER dsa_problems.sql
-- Categories: Arrays, Strings, Math, Linked Lists, Trees, Graphs, DP, Binary Search, Stacks, Hash Maps

INSERT INTO public.dsa_problems (slug, title, difficulty, category, tags, description, constraints, examples, starter_code, solution_wrappers, test_cases, points, time_limit_seconds, memory_limit_kb)
VALUES

-- ============================================================
-- EASY PROBLEMS (8 new)
-- ============================================================

(
  'palindrome-number',
  'Palindrome Number',
  'easy',
  'Math',
  ARRAY['math'],
  E'Given an integer `x`, return `true` if `x` is a **palindrome**, and `false` otherwise.\n\nAn integer is a palindrome when it reads the same forward and backward.',
  E'-2^31 <= x <= 2^31 - 1',
  '[{"input":"x = 121","output":"true","explanation":"121 reads the same forward and backward."},{"input":"x = -121","output":"false","explanation":"Reads -121 forward, 121- backward."},{"input":"x = 10","output":"false"}]'::jsonb,
  '{"python3": "class Solution:\n    def isPalindrome(self, x: int) -> bool:\n        pass", "javascript": "/**\n * @param {number} x\n * @return {boolean}\n */\nclass Solution {\n    isPalindrome(x) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public boolean isPalindrome(int x) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    bool isPalindrome(int x) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.isPalindrome(input_data[\"x\"])\nprint(json.dumps(result))", "javascript": "class Solution {\n    easy() {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Solution().isPalindrome(obj.get(\"x\").getAsInt()));\n  }\n}", "cpp": "#include <iostream>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << json(sol.isPalindrome(input[\"x\"].get<int>())).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"x\":121}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"x\":-121}","expected_output":"false","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"x\":10}","expected_output":"false","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"x\":0}","expected_output":"true","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"x\":12321}","expected_output":"true","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"x\":1000021}","expected_output":"false","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"x\":2147483647}","expected_output":"false","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

(
  'merge-two-sorted-lists',
  'Merge Two Sorted Lists',
  'easy',
  'Linked Lists',
  ARRAY['linked-list', 'recursion'],
  E'You are given the heads of two sorted linked lists `list1` and `list2`.\n\nMerge the two lists into one **sorted** list. The list should be made by splicing together the nodes of the first two lists.\n\nReturn the merged linked list (represented as array).',
  E'The number of nodes in both lists is in the range [0, 50].\n-100 <= Node.val <= 100\nBoth lists are sorted in non-decreasing order.',
  '[{"input":"list1 = [1,2,4], list2 = [1,3,4]","output":"[1,1,2,3,4,4]"},{"input":"list1 = [], list2 = []","output":"[]"},{"input":"list1 = [], list2 = [0]","output":"[0]"}]'::jsonb,
  '{"python3": "class Solution:\n    def mergeTwoLists(self, list1: list[int], list2: list[int]) -> list[int]:\n        pass", "javascript": "/**\n * @param {number[]} list1\n * @param {number[]} list2\n * @return {number[]}\n */\nclass Solution {\n    mergeTwoLists(list1, list2) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int[] mergeTwoLists(int[] list1, int[] list2) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<int> mergeTwoLists(vector<int>& list1, vector<int>& list2) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.mergeTwoLists(input_data[\"list1\"], input_data[\"list2\"])\nprint(json.dumps(result))", "javascript": "class Solution {\n    easy() {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] l1 = new Gson().fromJson(obj.get(\"list1\"), int[].class);\n    int[] l2 = new Gson().fromJson(obj.get(\"list2\"), int[].class);\n    System.out.println(Arrays.toString(new Solution().mergeTwoLists(l1, l2)));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto l1 = input[\"list1\"].get<std::vector<int>>();\n  auto l2 = input[\"list2\"].get<std::vector<int>>();\n  Solution sol;\n  auto result = sol.mergeTwoLists(l1, l2);\n  std::cout << json(result).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"list1\":[1,2,4],\"list2\":[1,3,4]}","expected_output":"[1,1,2,3,4,4]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"list1\":[],\"list2\":[]}","expected_output":"[]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"list1\":[],\"list2\":[0]}","expected_output":"[0]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"list1\":[1,1,1],\"list2\":[2,2,2]}","expected_output":"[1,1,1,2,2,2]","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"list1\":[-5,-3,0],\"list2\":[-4,-2,1]}","expected_output":"[-5,-4,-3,-2,0,1]","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"list1\":[5],\"list2\":[1,2,3,4]}","expected_output":"[1,2,3,4,5]","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

(
  'best-time-to-buy-sell-stock',
  'Best Time to Buy and Sell Stock',
  'easy',
  'Arrays',
  ARRAY['arrays', 'dynamic-programming', 'greedy'],
  E'You are given an array `prices` where `prices[i]` is the price of a given stock on the `i`th day.\n\nYou want to maximize your profit by choosing a **single day** to buy one stock and choosing a **different day in the future** to sell that stock.\n\nReturn the maximum profit you can achieve. If no profit is possible, return `0`.',
  E'1 <= prices.length <= 10^5\n0 <= prices[i] <= 10^4',
  '[{"input":"prices = [7,1,5,3,6,4]","output":"5","explanation":"Buy on day 2 (price=1), sell on day 5 (price=6), profit = 5."},{"input":"prices = [7,6,4,3,1]","output":"0","explanation":"No profitable transaction possible."}]'::jsonb,
  '{"python3": "class Solution:\n    def maxProfit(self, prices: list[int]) -> int:\n        pass", "javascript": "/**\n * @param {number[]} prices\n * @return {number}\n */\nclass Solution {\n    maxProfit(prices) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int maxProfit(int[] prices) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int maxProfit(vector<int>& prices) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.maxProfit(input_data[\"prices\"])\nprint(json.dumps(result))", "javascript": "class Solution {\n    easy() {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] prices = new Gson().fromJson(obj.get(\"prices\"), int[].class);\n    System.out.println(new Solution().maxProfit(prices));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto prices = input[\"prices\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << sol.maxProfit(prices);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"prices\":[7,1,5,3,6,4]}","expected_output":"5","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"prices\":[7,6,4,3,1]}","expected_output":"0","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"prices\":[1]}","expected_output":"0","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"prices\":[2,4,1]}","expected_output":"2","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"prices\":[1,2,3,4,5]}","expected_output":"4","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"prices\":[3,3,3,3]}","expected_output":"0","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"prices\":[2,1,2,1,0,1,2]}","expected_output":"2","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

(
  'valid-anagram',
  'Valid Anagram',
  'easy',
  'Strings',
  ARRAY['hash-map', 'string', 'sorting'],
  E'Given two strings `s` and `t`, return `true` if `t` is an **anagram** of `s`, and `false` otherwise.\n\nAn anagram is a word or phrase formed by rearranging the letters of a different word or phrase, using all the original letters exactly once.',
  E'1 <= s.length, t.length <= 5 * 10^4\ns and t consist of lowercase English letters.',
  '[{"input":"s = \"anagram\", t = \"nagaram\"","output":"true"},{"input":"s = \"rat\", t = \"car\"","output":"false"}]'::jsonb,
  '{"python3": "class Solution:\n    def isAnagram(self, s: str, t: str) -> bool:\n        pass", "javascript": "/**\n * @param {string} s\n * @param {string} t\n * @return {boolean}\n */\nclass Solution {\n    isAnagram(s, t) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public boolean isAnagram(String s, String t) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    bool isAnagram(string s, string t) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.isAnagram(input_data[\"s\"], input_data[\"t\"])\nprint(json.dumps(result))", "javascript": "class Solution {\n    easy() {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Solution().isAnagram(obj.get(\"s\").getAsString(), obj.get(\"t\").getAsString()));\n  }\n}", "cpp": "#include <iostream>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << json(sol.isAnagram(input[\"s\"].get<std::string>(), input[\"t\"].get<std::string>())).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"s\":\"anagram\",\"t\":\"nagaram\"}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"s\":\"rat\",\"t\":\"car\"}","expected_output":"false","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"s\":\"a\",\"t\":\"a\"}","expected_output":"true","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"s\":\"ab\",\"t\":\"a\"}","expected_output":"false","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"s\":\"listen\",\"t\":\"silent\"}","expected_output":"true","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"s\":\"aabbcc\",\"t\":\"abcabc\"}","expected_output":"true","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"s\":\"aacc\",\"t\":\"ccac\"}","expected_output":"false","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

(
  'maximum-subarray',
  'Maximum Subarray',
  'easy',
  'Arrays',
  ARRAY['arrays', 'dynamic-programming', 'divide-and-conquer'],
  E'Given an integer array `nums`, find the subarray with the largest sum, and return its sum.\n\nA **subarray** is a contiguous non-empty sequence of elements within an array.',
  E'1 <= nums.length <= 10^5\n-10^4 <= nums[i] <= 10^4',
  '[{"input":"nums = [-2,1,-3,4,-1,2,1,-5,4]","output":"6","explanation":"The subarray [4,-1,2,1] has the largest sum 6."},{"input":"nums = [1]","output":"1"},{"input":"nums = [5,4,-1,7,8]","output":"23"}]'::jsonb,
  '{"python3": "class Solution:\n    def maxSubArray(self, nums: list[int]) -> int:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @return {number}\n */\nclass Solution {\n    maxSubArray(nums) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int maxSubArray(int[] nums) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int maxSubArray(vector<int>& nums) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.maxSubArray(input_data[\"nums\"])\nprint(json.dumps(result))", "javascript": "class Solution {\n    easy() {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    System.out.println(new Solution().maxSubArray(nums));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << sol.maxSubArray(nums);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[-2,1,-3,4,-1,2,1,-5,4]}","expected_output":"6","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[1]}","expected_output":"1","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[5,4,-1,7,8]}","expected_output":"23","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[-1]}","expected_output":"-1","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[-2,-1]}","expected_output":"-1","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[1,2,3,4,5]}","expected_output":"15","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums\":[-5,3,-2,4,-1]}","expected_output":"5","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

(
  'contains-duplicate',
  'Contains Duplicate',
  'easy',
  'Arrays',
  ARRAY['arrays', 'hash-map', 'sorting'],
  E'Given an integer array `nums`, return `true` if any value appears **at least twice** in the array, and return `false` if every element is distinct.',
  E'1 <= nums.length <= 10^5\n-10^9 <= nums[i] <= 10^9',
  '[{"input":"nums = [1,2,3,1]","output":"true"},{"input":"nums = [1,2,3,4]","output":"false"},{"input":"nums = [1,1,1,3,3,4,3,2,4,2]","output":"true"}]'::jsonb,
  '{"python3": "class Solution:\n    def containsDuplicate(self, nums: list[int]) -> bool:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @return {boolean}\n */\nclass Solution {\n    containsDuplicate(nums) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public boolean containsDuplicate(int[] nums) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    bool containsDuplicate(vector<int>& nums) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.containsDuplicate(input_data[\"nums\"])\nprint(json.dumps(result))", "javascript": "class Solution {\n    easy() {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    System.out.println(new Solution().containsDuplicate(nums));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << json(sol.containsDuplicate(nums)).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[1,2,3,1]}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[1,2,3,4]}","expected_output":"false","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[1,1,1,3,3,4,3,2,4,2]}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[1]}","expected_output":"false","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[0,0]}","expected_output":"true","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[1000000000,-1000000000]}","expected_output":"false","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

(
  'climbing-stairs',
  'Climbing Stairs',
  'easy',
  'Dynamic Programming',
  ARRAY['dynamic-programming', 'math', 'memoization'],
  E'You are climbing a staircase. It takes `n` steps to reach the top.\n\nEach time you can either climb `1` or `2` steps. In how many distinct ways can you climb to the top?',
  E'1 <= n <= 45',
  '[{"input":"n = 2","output":"2","explanation":"1. 1 step + 1 step; 2. 2 steps"},{"input":"n = 3","output":"3","explanation":"1. 1+1+1; 2. 1+2; 3. 2+1"}]'::jsonb,
  '{"python3": "class Solution:\n    def climbStairs(self, n: int) -> int:\n        pass", "javascript": "/**\n * @param {number} n\n * @return {number}\n */\nclass Solution {\n    climbStairs(n) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int climbStairs(int n) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int climbStairs(int n) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.climbStairs(input_data[\"n\"])\nprint(json.dumps(result))", "javascript": "class Solution {\n    easy() {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Solution().climbStairs(obj.get(\"n\").getAsInt()));\n  }\n}", "cpp": "#include <iostream>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << sol.climbStairs(input[\"n\"].get<int>());\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"n\":2}","expected_output":"2","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"n\":3}","expected_output":"3","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"n\":1}","expected_output":"1","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"n\":5}","expected_output":"8","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"n\":10}","expected_output":"89","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"n\":45}","expected_output":"1836311903","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"n\":20}","expected_output":"10946","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

(
  'roman-to-integer',
  'Roman to Integer',
  'easy',
  'Strings',
  ARRAY['hash-map', 'string', 'math'],
  E'Roman numerals are represented by seven symbols: `I`, `V`, `X`, `L`, `C`, `D` and `M`.\n\nGiven a roman numeral, convert it to an integer.\n\n| Symbol | Value |\n|--------|-------|\n| I | 1 |\n| V | 5 |\n| X | 10 |\n| L | 50 |\n| C | 100 |\n| D | 500 |\n| M | 1000 |\n\n`I` can be placed before `V` (4) and `X` (9). `X` before `L` (40) and `C` (90). `C` before `D` (400) and `M` (900).',
  E'1 <= s.length <= 15\ns contains only the characters (''I'', ''V'', ''X'', ''L'', ''C'', ''D'', ''M'').\nIt is guaranteed that s is a valid roman numeral in the range [1, 3999].',
  '[{"input":"s = \"III\"","output":"3"},{"input":"s = \"LVIII\"","output":"58","explanation":"L = 50, V = 5, III = 3."},{"input":"s = \"MCMXCIV\"","output":"1994","explanation":"M = 1000, CM = 900, XC = 90, IV = 4."}]'::jsonb,
  '{"python3": "class Solution:\n    def romanToInt(self, s: str) -> int:\n        pass", "javascript": "/**\n * @param {string} s\n * @return {number}\n */\nclass Solution {\n    romanToInt(s) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int romanToInt(String s) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int romanToInt(string s) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.romanToInt(input_data[\"s\"])\nprint(json.dumps(result))", "javascript": "class Solution {\n    easy() {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Solution().romanToInt(obj.get(\"s\").getAsString()));\n  }\n}", "cpp": "#include <iostream>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << sol.romanToInt(input[\"s\"].get<std::string>());\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"s\":\"III\"}","expected_output":"3","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"s\":\"LVIII\"}","expected_output":"58","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"s\":\"MCMXCIV\"}","expected_output":"1994","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"s\":\"I\"}","expected_output":"1","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"s\":\"MMMCMXCIX\"}","expected_output":"3999","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"s\":\"CDXLIV\"}","expected_output":"444","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"s\":\"DCCCXC\"}","expected_output":"890","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
)

ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, difficulty = EXCLUDED.difficulty, category = EXCLUDED.category,
  tags = EXCLUDED.tags, description = EXCLUDED.description, constraints = EXCLUDED.constraints,
  examples = EXCLUDED.examples, starter_code = EXCLUDED.starter_code,
  solution_wrappers = EXCLUDED.solution_wrappers, test_cases = EXCLUDED.test_cases,
  points = EXCLUDED.points, time_limit_seconds = EXCLUDED.time_limit_seconds,
  memory_limit_kb = EXCLUDED.memory_limit_kb, updated_at = now();
