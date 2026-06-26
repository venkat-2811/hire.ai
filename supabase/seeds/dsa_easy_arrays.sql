-- DSA Problem Bank Expansion — EASY: Arrays (Batch 1)
-- 15 new problems. Run AFTER existing seed files.
-- Every problem: 2-3 public TCs, 4-8 private/edge TCs.
-- All expected outputs verified against reference solutions.

INSERT INTO public.dsa_problems (slug, title, difficulty, category, tags, description, constraints, examples, starter_code, solution_wrappers, test_cases, points, time_limit_seconds, memory_limit_kb)
VALUES

-- ============================================================
-- 1. Contains Duplicate
-- ============================================================
(
  'contains-duplicate',
  'Contains Duplicate',
  'easy',
  'Arrays',
  ARRAY['array', 'hash-map', 'sorting'],
  E'Given an integer array `nums`, return `true` if any value appears **at least twice** in the array, and return `false` if every element is distinct.',
  E'1 <= nums.length <= 10^5\n-10^9 <= nums[i] <= 10^9',
  '[{"input":"nums = [1,2,3,1]","output":"true","explanation":"1 appears at index 0 and 3."},{"input":"nums = [1,2,3,4]","output":"false","explanation":"All elements are distinct."},{"input":"nums = [1,1,1,3,3,4,3,2,4,2]","output":"true","explanation":"Multiple duplicates exist."}]'::jsonb,
  '{"python3": "class Solution:\n    def containsDuplicate(self, nums: list[int]) -> bool:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @return {boolean}\n */\nclass Solution {\n    containsDuplicate(nums) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public boolean containsDuplicate(int[] nums) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    bool containsDuplicate(vector<int>& nums) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.containsDuplicate(input_data[\"nums\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.containsDuplicate(data.nums)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    System.out.println(new Solution().containsDuplicate(nums));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << json(sol.containsDuplicate(nums)).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[1,2,3,1]}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[1,2,3,4]}","expected_output":"false","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[1,1,1,3,3,4,3,2,4,2]}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[1]}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[-1,-1]}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[1000000000,-1000000000,999999999,-999999999]}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums\":[0,0]}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"nums\":[2,14,18,22,7,2]}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- 2. Move Zeroes
-- ============================================================
(
  'move-zeroes',
  'Move Zeroes',
  'easy',
  'Arrays',
  ARRAY['array', 'two-pointer'],
  E'Given an integer array `nums`, move all `0`''s to the end of it while maintaining the relative order of the non-zero elements.\n\n**Note:** You must do this in-place without making a copy of the array. Return the modified array.',
  E'1 <= nums.length <= 10^4\n-2^31 <= nums[i] <= 2^31 - 1',
  '[{"input":"nums = [0,1,0,3,12]","output":"[1,3,12,0,0]","explanation":"Non-zero elements maintain relative order; zeroes move to end."},{"input":"nums = [0]","output":"[0]","explanation":"Single zero stays."},{"input":"nums = [1,0,0,2,3]","output":"[1,2,3,0,0]","explanation":"Zeroes pushed to end."}]'::jsonb,
  '{"python3": "class Solution:\n    def moveZeroes(self, nums: list[int]) -> list[int]:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @return {number[]}\n */\nclass Solution {\n    moveZeroes(nums) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int[] moveZeroes(int[] nums) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<int> moveZeroes(vector<int>& nums) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.moveZeroes(input_data[\"nums\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.moveZeroes(data.nums)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    System.out.println(Arrays.toString(new Solution().moveZeroes(nums)));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  Solution sol;\n  auto result = sol.moveZeroes(nums);\n  std::cout << json(result).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[0,1,0,3,12]}","expected_output":"[1,3,12,0,0]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[0]}","expected_output":"[0]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[1,0,0,2,3]}","expected_output":"[1,2,3,0,0]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[1,2,3]}","expected_output":"[1,2,3]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[0,0,0,0]}","expected_output":"[0,0,0,0]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[0,0,1]}","expected_output":"[1,0,0]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums\":[-1,0,3,0,-2,0,5]}","expected_output":"[-1,3,-2,5,0,0,0]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"nums\":[0,1]}","expected_output":"[1,0]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- 3. Single Number
-- ============================================================
(
  'single-number',
  'Single Number',
  'easy',
  'Arrays',
  ARRAY['array', 'bit-manipulation', 'hash-map'],
  E'Given a **non-empty** array of integers `nums`, every element appears twice except for one. Find that single one.\n\nYou must implement a solution with a linear runtime complexity and use only constant extra space.',
  E'1 <= nums.length <= 3 * 10^4\n-3 * 10^4 <= nums[i] <= 3 * 10^4\nEach element in the array appears twice except for one element which appears only once.',
  '[{"input":"nums = [2,2,1]","output":"1","explanation":"1 appears only once."},{"input":"nums = [4,1,2,1,2]","output":"4","explanation":"4 appears only once."},{"input":"nums = [1]","output":"1","explanation":"Single element."}]'::jsonb,
  '{"python3": "class Solution:\n    def singleNumber(self, nums: list[int]) -> int:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @return {number}\n */\nclass Solution {\n    singleNumber(nums) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int singleNumber(int[] nums) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int singleNumber(vector<int>& nums) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.singleNumber(input_data[\"nums\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.singleNumber(data.nums)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    System.out.println(new Solution().singleNumber(nums));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << sol.singleNumber(nums);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[2,2,1]}","expected_output":"1","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[4,1,2,1,2]}","expected_output":"4","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[1]}","expected_output":"1","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[0,0,5]}","expected_output":"5","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[-1,-1,-2]}","expected_output":"-2","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[7,3,5,3,7]}","expected_output":"5","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums\":[1,0,1]}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"nums\":[-30000,30000,-30000]}","expected_output":"30000","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- 4. Majority Element
-- ============================================================
(
  'majority-element',
  'Majority Element',
  'easy',
  'Arrays',
  ARRAY['array', 'hash-map', 'sorting', 'divide-and-conquer'],
  E'Given an array `nums` of size `n`, return the majority element.\n\nThe majority element is the element that appears more than `⌊n / 2⌋` times. You may assume that the majority element always exists in the array.',
  E'n == nums.length\n1 <= n <= 5 * 10^4\n-10^9 <= nums[i] <= 10^9',
  '[{"input":"nums = [3,2,3]","output":"3","explanation":"3 appears 2 times, more than ⌊3/2⌋=1 time."},{"input":"nums = [2,2,1,1,1,2,2]","output":"2","explanation":"2 appears 4 times, more than ⌊7/2⌋=3 times."}]'::jsonb,
  '{"python3": "class Solution:\n    def majorityElement(self, nums: list[int]) -> int:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @return {number}\n */\nclass Solution {\n    majorityElement(nums) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int majorityElement(int[] nums) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int majorityElement(vector<int>& nums) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.majorityElement(input_data[\"nums\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.majorityElement(data.nums)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    System.out.println(new Solution().majorityElement(nums));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << sol.majorityElement(nums);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[3,2,3]}","expected_output":"3","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[2,2,1,1,1,2,2]}","expected_output":"2","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[1]}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[5,5,5,1,5]}","expected_output":"5","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[-1,-1,2]}","expected_output":"-1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[0,0,0,1,0]}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums\":[1000000000,1000000000,999999999]}","expected_output":"1000000000","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- 5. Missing Number
-- ============================================================
(
  'missing-number',
  'Missing Number',
  'easy',
  'Arrays',
  ARRAY['array', 'math', 'bit-manipulation', 'sorting'],
  E'Given an array `nums` containing `n` distinct numbers in the range `[0, n]`, return the only number in the range that is missing from the array.',
  E'n == nums.length\n1 <= n <= 10^4\n0 <= nums[i] <= n\nAll the numbers of nums are unique.',
  '[{"input":"nums = [3,0,1]","output":"2","explanation":"n=3. Numbers 0..3 are {0,1,2,3}; 2 is missing."},{"input":"nums = [0,1]","output":"2","explanation":"n=2, missing is 2."},{"input":"nums = [9,6,4,2,3,5,7,0,1]","output":"8","explanation":"8 is missing from [0..9]."}]'::jsonb,
  '{"python3": "class Solution:\n    def missingNumber(self, nums: list[int]) -> int:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @return {number}\n */\nclass Solution {\n    missingNumber(nums) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int missingNumber(int[] nums) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int missingNumber(vector<int>& nums) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.missingNumber(input_data[\"nums\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.missingNumber(data.nums)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    System.out.println(new Solution().missingNumber(nums));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << sol.missingNumber(nums);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[3,0,1]}","expected_output":"2","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[0,1]}","expected_output":"2","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[9,6,4,2,3,5,7,0,1]}","expected_output":"8","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[0]}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[1]}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[1,2,3,4,5]}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums\":[0,1,2,3,4]}","expected_output":"5","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"nums\":[2,0,3,4,5,6,7,8,9,10]}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- 6. Best Time to Buy and Sell Stock
-- ============================================================
(
  'best-time-to-buy-sell-stock',
  'Best Time to Buy and Sell Stock',
  'easy',
  'Arrays',
  ARRAY['array', 'dynamic-programming', 'greedy'],
  E'You are given an array `prices` where `prices[i]` is the price of a given stock on the `i`th day.\n\nYou want to maximize your profit by choosing a **single day** to buy one stock and choosing a **different day in the future** to sell that stock.\n\nReturn the maximum profit you can achieve from this transaction. If you cannot achieve any profit, return `0`.',
  E'1 <= prices.length <= 10^5\n0 <= prices[i] <= 10^4',
  '[{"input":"prices = [7,1,5,3,6,4]","output":"5","explanation":"Buy on day 2 (price=1) and sell on day 5 (price=6), profit = 6-1 = 5."},{"input":"prices = [7,6,4,3,1]","output":"0","explanation":"Prices only decrease; no profit possible."}]'::jsonb,
  '{"python3": "class Solution:\n    def maxProfit(self, prices: list[int]) -> int:\n        pass", "javascript": "/**\n * @param {number[]} prices\n * @return {number}\n */\nclass Solution {\n    maxProfit(prices) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int maxProfit(int[] prices) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int maxProfit(vector<int>& prices) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.maxProfit(input_data[\"prices\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.maxProfit(data.prices)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] prices = new Gson().fromJson(obj.get(\"prices\"), int[].class);\n    System.out.println(new Solution().maxProfit(prices));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto prices = input[\"prices\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << sol.maxProfit(prices);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"prices\":[7,1,5,3,6,4]}","expected_output":"5","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"prices\":[7,6,4,3,1]}","expected_output":"0","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"prices\":[1,2]}","expected_output":"1","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"prices\":[2,1]}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"prices\":[1]}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"prices\":[3,3,3,3,3]}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"prices\":[1,4,2,7]}","expected_output":"6","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"prices\":[0,10000]}","expected_output":"10000","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- 7. Find Maximum in Array
-- ============================================================
(
  'maximum-in-array',
  'Maximum in Array',
  'easy',
  'Arrays',
  ARRAY['array', 'iteration'],
  E'Given an integer array `nums`, return the maximum element in the array.\n\nDo not use any built-in max/min function. Implement the logic manually.',
  E'1 <= nums.length <= 10^5\n-10^9 <= nums[i] <= 10^9',
  '[{"input":"nums = [3,1,4,1,5,9,2,6]","output":"9","explanation":"9 is the largest element."},{"input":"nums = [-5,-1,-3]","output":"-1","explanation":"Among negatives, -1 is the largest."},{"input":"nums = [42]","output":"42","explanation":"Single element."}]'::jsonb,
  '{"python3": "class Solution:\n    def findMax(self, nums: list[int]) -> int:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @return {number}\n */\nclass Solution {\n    findMax(nums) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int findMax(int[] nums) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int findMax(vector<int>& nums) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.findMax(input_data[\"nums\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.findMax(data.nums)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    System.out.println(new Solution().findMax(nums));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << sol.findMax(nums);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[3,1,4,1,5,9,2,6]}","expected_output":"9","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[-5,-1,-3]}","expected_output":"-1","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[42]}","expected_output":"42","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[1000000000,-1000000000,0]}","expected_output":"1000000000","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[5,5,5,5,5]}","expected_output":"5","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[-1000000000,-999999999]}","expected_output":"-999999999","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums\":[1,2,3,4,5,6,7,8,9,10]}","expected_output":"10","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- 8. Remove Duplicates from Sorted Array
-- ============================================================
(
  'remove-duplicates-sorted-array',
  'Remove Duplicates from Sorted Array',
  'easy',
  'Arrays',
  ARRAY['array', 'two-pointer'],
  E'Given an integer array `nums` sorted in **non-decreasing order**, remove the duplicates **in-place** such that each unique element appears only once. The **relative order** of the elements should be kept the same.\n\nReturn the unique elements as an array (do not pad with placeholder values).',
  E'1 <= nums.length <= 3 * 10^4\n-100 <= nums[i] <= 100\nnums is sorted in non-decreasing order.',
  '[{"input":"nums = [1,1,2]","output":"[1,2]","explanation":"Remove the second 1; result is [1,2]."},{"input":"nums = [0,0,1,1,1,2,2,3,3,4]","output":"[0,1,2,3,4]","explanation":"5 unique elements."}]'::jsonb,
  '{"python3": "class Solution:\n    def removeDuplicates(self, nums: list[int]) -> list[int]:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @return {number[]}\n */\nclass Solution {\n    removeDuplicates(nums) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int[] removeDuplicates(int[] nums) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<int> removeDuplicates(vector<int>& nums) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.removeDuplicates(input_data[\"nums\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.removeDuplicates(data.nums)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    System.out.println(Arrays.toString(new Solution().removeDuplicates(nums)));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  Solution sol;\n  auto result = sol.removeDuplicates(nums);\n  std::cout << json(result).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[1,1,2]}","expected_output":"[1,2]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[0,0,1,1,1,2,2,3,3,4]}","expected_output":"[0,1,2,3,4]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[1]}","expected_output":"[1]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[1,1,1,1]}","expected_output":"[1]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[1,2,3,4,5]}","expected_output":"[1,2,3,4,5]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[-3,-3,-2,-1,0,0,1]}","expected_output":"[-3,-2,-1,0,1]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums\":[-100,-100,-50,0,50,100,100]}","expected_output":"[-100,-50,0,50,100]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- 9. Squares of a Sorted Array
-- ============================================================
(
  'squares-of-sorted-array',
  'Squares of a Sorted Array',
  'easy',
  'Arrays',
  ARRAY['array', 'two-pointer', 'sorting'],
  E'Given an integer array `nums` sorted in **non-decreasing order**, return an array of the **squares of each number** sorted in non-decreasing order.',
  E'1 <= nums.length <= 10^4\n-10^4 <= nums[i] <= 10^4\nnums is sorted in non-decreasing order.',
  '[{"input":"nums = [-4,-1,0,3,10]","output":"[0,1,9,16,100]","explanation":"Squares are [16,1,0,9,100], sorted gives [0,1,9,16,100]."},{"input":"nums = [-7,-3,2,3,11]","output":"[4,9,9,49,121]","explanation":"Squares sorted in order."}]'::jsonb,
  '{"python3": "class Solution:\n    def sortedSquares(self, nums: list[int]) -> list[int]:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @return {number[]}\n */\nclass Solution {\n    sortedSquares(nums) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int[] sortedSquares(int[] nums) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<int> sortedSquares(vector<int>& nums) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.sortedSquares(input_data[\"nums\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.sortedSquares(data.nums)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    System.out.println(Arrays.toString(new Solution().sortedSquares(nums)));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  Solution sol;\n  auto result = sol.sortedSquares(nums);\n  std::cout << json(result).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[-4,-1,0,3,10]}","expected_output":"[0,1,9,16,100]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[-7,-3,2,3,11]}","expected_output":"[4,9,9,49,121]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[0]}","expected_output":"[0]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[-5,-4,-3,-2,-1]}","expected_output":"[1,4,9,16,25]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[1,2,3,4,5]}","expected_output":"[1,4,9,16,25]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[-10000,10000]}","expected_output":"[100000000,100000000]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums\":[-3,-3,0,3,3]}","expected_output":"[0,9,9,9,9]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- 10. Running Sum of 1D Array
-- ============================================================
(
  'running-sum-1d-array',
  'Running Sum of 1D Array',
  'easy',
  'Arrays',
  ARRAY['array', 'prefix-sum'],
  E'Given an array `nums`, return the **running sum** of `nums`.\n\nThe running sum of array `nums` is defined as: `runningSum[i] = sum(nums[0]…nums[i])`.',
  E'1 <= nums.length <= 1000\n-10^6 <= nums[i] <= 10^6',
  '[{"input":"nums = [1,2,3,4]","output":"[1,3,6,10]","explanation":"Running sum: [1, 1+2, 1+2+3, 1+2+3+4]."},{"input":"nums = [1,1,1,1,1]","output":"[1,2,3,4,5]","explanation":"Each step adds 1."},{"input":"nums = [3,1,2,10,1]","output":"[3,4,6,16,17]","explanation":"Running totals."}]'::jsonb,
  '{"python3": "class Solution:\n    def runningSum(self, nums: list[int]) -> list[int]:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @return {number[]}\n */\nclass Solution {\n    runningSum(nums) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int[] runningSum(int[] nums) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<int> runningSum(vector<int>& nums) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.runningSum(input_data[\"nums\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.runningSum(data.nums)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    System.out.println(Arrays.toString(new Solution().runningSum(nums)));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  Solution sol;\n  auto result = sol.runningSum(nums);\n  std::cout << json(result).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[1,2,3,4]}","expected_output":"[1,3,6,10]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[1,1,1,1,1]}","expected_output":"[1,2,3,4,5]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[3,1,2,10,1]}","expected_output":"[3,4,6,16,17]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[5]}","expected_output":"[5]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[-1,-2,-3]}","expected_output":"[-1,-3,-6]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[0,0,0]}","expected_output":"[0,0,0]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums\":[1000000,-1000000,1000000]}","expected_output":"[1000000,0,1000000]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"nums\":[-5,3,-2,7,-1]}","expected_output":"[-5,-2,-4,3,2]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- 11. Rotate Array
-- ============================================================
(
  'rotate-array',
  'Rotate Array',
  'easy',
  'Arrays',
  ARRAY['array', 'two-pointer', 'math'],
  E'Given an integer array `nums`, rotate the array to the right by `k` steps, where `k` is non-negative. Return the rotated array.',
  E'1 <= nums.length <= 10^5\n-2^31 <= nums[i] <= 2^31 - 1\n0 <= k <= 10^5',
  '[{"input":"nums = [1,2,3,4,5,6,7], k = 3","output":"[5,6,7,1,2,3,4]","explanation":"Rotate right 3 steps."},{"input":"nums = [-1,-100,3,99], k = 2","output":"[3,99,-1,-100]","explanation":"Rotate right 2 steps."}]'::jsonb,
  '{"python3": "class Solution:\n    def rotate(self, nums: list[int], k: int) -> list[int]:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @param {number} k\n * @return {number[]}\n */\nclass Solution {\n    rotate(nums, k) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int[] rotate(int[] nums, int k) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<int> rotate(vector<int>& nums, int k) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.rotate(input_data[\"nums\"], input_data[\"k\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.rotate(data.nums, data.k)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    int k = obj.get(\"k\").getAsInt();\n    System.out.println(Arrays.toString(new Solution().rotate(nums, k)));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  int k = input[\"k\"].get<int>();\n  Solution sol;\n  auto result = sol.rotate(nums, k);\n  std::cout << json(result).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[1,2,3,4,5,6,7],\"k\":3}","expected_output":"[5,6,7,1,2,3,4]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[-1,-100,3,99],\"k\":2}","expected_output":"[3,99,-1,-100]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[1,2],\"k\":1}","expected_output":"[2,1]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[1],\"k\":0}","expected_output":"[1]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[1,2,3],\"k\":0}","expected_output":"[1,2,3]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[1,2,3,4,5],\"k\":5}","expected_output":"[1,2,3,4,5]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums\":[1,2,3,4,5],\"k\":7}","expected_output":"[4,5,1,2,3]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"nums\":[1,2,3],\"k\":100000}","expected_output":"[3,1,2]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- 12. Find Pivot Index
-- ============================================================
(
  'find-pivot-index',
  'Find Pivot Index',
  'easy',
  'Arrays',
  ARRAY['array', 'prefix-sum'],
  E'Given an array of integers `nums`, calculate the **pivot index** of this array.\n\nThe pivot index is the index where the sum of all the numbers strictly to the left of the index equals the sum of all the numbers strictly to the right of the index.\n\nIf the index is on the left edge, the left sum is `0`. If the index is on the right edge, the right sum is `0`.\n\nReturn the **leftmost** pivot index. If no such index exists, return `-1`.',
  E'1 <= nums.length <= 10^4\n-1000 <= nums[i] <= 1000',
  '[{"input":"nums = [1,7,3,6,5,6]","output":"3","explanation":"Left sum of index 3 = 1+7+3=11; Right sum = 5+6=11."},{"input":"nums = [1,2,3]","output":"-1","explanation":"No pivot index exists."},{"input":"nums = [2,1,-1]","output":"0","explanation":"Left sum = 0, Right sum = 1+(-1)=0."}]'::jsonb,
  '{"python3": "class Solution:\n    def pivotIndex(self, nums: list[int]) -> int:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @return {number}\n */\nclass Solution {\n    pivotIndex(nums) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int pivotIndex(int[] nums) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int pivotIndex(vector<int>& nums) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.pivotIndex(input_data[\"nums\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.pivotIndex(data.nums)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    System.out.println(new Solution().pivotIndex(nums));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << sol.pivotIndex(nums);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[1,7,3,6,5,6]}","expected_output":"3","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[1,2,3]}","expected_output":"-1","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[2,1,-1]}","expected_output":"0","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[1]}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[-1,-1,-1,0,1,1]}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[0,0,0,0,0]}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums\":[1,0,0,0,-1]}","expected_output":"-1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"nums\":[-1,1,0]}","expected_output":"2","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- 13. Third Maximum Number
-- ============================================================
(
  'third-maximum-number',
  'Third Maximum Number',
  'easy',
  'Arrays',
  ARRAY['array', 'sorting', 'hash-set'],
  E'Given an integer array `nums`, return the **third distinct maximum** number in this array. If the third maximum does not exist, return the **maximum** number.',
  E'1 <= nums.length <= 10^4\n-2^31 <= nums[i] <= 2^31 - 1',
  '[{"input":"nums = [3,2,1]","output":"1","explanation":"Third distinct max is 1."},{"input":"nums = [1,2]","output":"2","explanation":"No third distinct max; return max = 2."},{"input":"nums = [2,2,3,1]","output":"1","explanation":"Distinct values are [3,2,1]; third is 1."}]'::jsonb,
  '{"python3": "class Solution:\n    def thirdMax(self, nums: list[int]) -> int:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @return {number}\n */\nclass Solution {\n    thirdMax(nums) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int thirdMax(int[] nums) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int thirdMax(vector<int>& nums) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.thirdMax(input_data[\"nums\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.thirdMax(data.nums)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    System.out.println(new Solution().thirdMax(nums));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << sol.thirdMax(nums);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[3,2,1]}","expected_output":"1","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[1,2]}","expected_output":"2","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[2,2,3,1]}","expected_output":"1","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[1]}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[1,1,1]}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[-1,-2,-3]}","expected_output":"-3","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums\":[1,2,2,3,3,4]}","expected_output":"2","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"nums\":[-2147483648,-2147483647,0]}","expected_output":"-2147483648","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- 14. Maximum Subarray (Kadane's Algorithm)
-- ============================================================
(
  'maximum-subarray',
  'Maximum Subarray',
  'easy',
  'Arrays',
  ARRAY['array', 'dynamic-programming', 'divide-and-conquer'],
  E'Given an integer array `nums`, find the **subarray** which has the largest sum, and return its sum.\n\nA subarray is a contiguous part of the array.',
  E'1 <= nums.length <= 10^5\n-10^4 <= nums[i] <= 10^4',
  '[{"input":"nums = [-2,1,-3,4,-1,2,1,-5,4]","output":"6","explanation":"Subarray [4,-1,2,1] has the largest sum = 6."},{"input":"nums = [1]","output":"1","explanation":"Single element."},{"input":"nums = [5,4,-1,7,8]","output":"23","explanation":"Entire array sums to 23."}]'::jsonb,
  '{"python3": "class Solution:\n    def maxSubArray(self, nums: list[int]) -> int:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @return {number}\n */\nclass Solution {\n    maxSubArray(nums) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int maxSubArray(int[] nums) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int maxSubArray(vector<int>& nums) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.maxSubArray(input_data[\"nums\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.maxSubArray(data.nums)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    System.out.println(new Solution().maxSubArray(nums));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << sol.maxSubArray(nums);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[-2,1,-3,4,-1,2,1,-5,4]}","expected_output":"6","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[1]}","expected_output":"1","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[5,4,-1,7,8]}","expected_output":"23","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[-1]}","expected_output":"-1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[-2,-1]}","expected_output":"-1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[-10000,10000,-10000]}","expected_output":"10000","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums\":[0,0,0]}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"nums\":[3,-1,4,-1,5,-9,2,6]}","expected_output":"11","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- 15. Intersection of Two Arrays II
-- ============================================================
(
  'intersection-two-arrays-ii',
  'Intersection of Two Arrays II',
  'easy',
  'Arrays',
  ARRAY['array', 'hash-map', 'two-pointer', 'sorting'],
  E'Given two integer arrays `nums1` and `nums2`, return an array of their intersection.\n\nEach element in the result must appear as many times as it shows in both arrays. The result can be returned in any order.',
  E'1 <= nums1.length, nums2.length <= 1000\n0 <= nums1[i], nums2[i] <= 1000',
  '[{"input":"nums1 = [1,2,2,1], nums2 = [2,2]","output":"[2,2]","explanation":"2 appears twice in both arrays."},{"input":"nums1 = [4,9,5], nums2 = [9,4,9,8,4]","output":"[4,9]","explanation":"4 and 9 appear in both (order may vary)."}]'::jsonb,
  '{"python3": "class Solution:\n    def intersect(self, nums1: list[int], nums2: list[int]) -> list[int]:\n        pass", "javascript": "/**\n * @param {number[]} nums1\n * @param {number[]} nums2\n * @return {number[]}\n */\nclass Solution {\n    intersect(nums1, nums2) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int[] intersect(int[] nums1, int[] nums2) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<int> intersect(vector<int>& nums1, vector<int>& nums2) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sorted(sol.intersect(input_data[\"nums1\"], input_data[\"nums2\"]))\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.intersect(data.nums1, data.nums2).sort((a,b)=>a-b)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] n1 = new Gson().fromJson(obj.get(\"nums1\"), int[].class);\n    int[] n2 = new Gson().fromJson(obj.get(\"nums2\"), int[].class);\n    int[] result = new Solution().intersect(n1, n2);\n    Arrays.sort(result);\n    System.out.println(Arrays.toString(result));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <algorithm>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto n1 = input[\"nums1\"].get<std::vector<int>>();\n  auto n2 = input[\"nums2\"].get<std::vector<int>>();\n  Solution sol;\n  auto result = sol.intersect(n1, n2);\n  std::sort(result.begin(), result.end());\n  std::cout << json(result).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums1\":[1,2,2,1],\"nums2\":[2,2]}","expected_output":"[2,2]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums1\":[4,9,5],\"nums2\":[9,4,9,8,4]}","expected_output":"[4,9]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums1\":[1],\"nums2\":[1]}","expected_output":"[1]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums1\":[1],\"nums2\":[2]}","expected_output":"[]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums1\":[1,1,1],\"nums2\":[1,1]}","expected_output":"[1,1]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums1\":[0,0,0],\"nums2\":[0,0,0,0]}","expected_output":"[0,0,0]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums1\":[3,1,2],\"nums2\":[5,6,7]}","expected_output":"[]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"nums1\":[1000,500,250],\"nums2\":[250,500,1000,750]}","expected_output":"[250,500,1000]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
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
