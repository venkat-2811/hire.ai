-- DSA Problem Bank Expansion — MEDIUM Problems (Batch 5)
-- 40 new problems across: Binary Search, Trees, Graphs, Greedy,
-- Stacks, Sliding Window, Heaps, Dynamic Programming, Intervals
-- Every problem: 2-3 public TCs, 4-8 private/edge TCs.

INSERT INTO public.dsa_problems (slug, title, difficulty, category, tags, description, constraints, examples, starter_code, solution_wrappers, test_cases, points, time_limit_seconds, memory_limit_kb)
VALUES

-- ============================================================
-- BINARY SEARCH (5)
-- ============================================================

-- 1. Binary Search
(
  'binary-search',
  'Binary Search',
  'medium',
  'Binary Search',
  ARRAY['array', 'binary-search'],
  E'Given an array of integers `nums` which is sorted in ascending order, and an integer `target`, write a function to search `target` in `nums`. If `target` exists, then return its index. Otherwise, return `-1`.\n\nYou must write an algorithm with O(log n) runtime complexity.',
  E'1 <= nums.length <= 10^4\n-10^4 < nums[i], target < 10^4\nAll the integers in nums are unique.\nnums is sorted in ascending order.',
  '[{"input":"nums = [-1,0,3,5,9,12], target = 9","output":"4","explanation":"9 exists in nums at index 4."},{"input":"nums = [-1,0,3,5,9,12], target = 2","output":"-1","explanation":"2 does not exist in nums."}]'::jsonb,
  '{"python3": "class Solution:\n    def search(self, nums: list[int], target: int) -> int:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @param {number} target\n * @return {number}\n */\nclass Solution {\n    search(nums, target) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int search(int[] nums, int target) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int search(vector<int>& nums, int target) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.search(input_data[\"nums\"], input_data[\"target\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.search(data.nums, data.target)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    System.out.println(new Solution().search(nums, obj.get(\"target\").getAsInt()));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << sol.search(nums, input[\"target\"].get<int>());\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[-1,0,3,5,9,12],\"target\":9}","expected_output":"4","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[-1,0,3,5,9,12],\"target\":2}","expected_output":"-1","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[5],\"target\":5}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[5],\"target\":6}","expected_output":"-1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[-9999,-5000,0,5000,9999],\"target\":-9999}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[-9999,-5000,0,5000,9999],\"target\":9999}","expected_output":"4","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums\":[1,3,5,7,9,11,13,15,17,19],\"target\":11}","expected_output":"5","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"nums\":[1,3,5,7,9,11],\"target\":6}","expected_output":"-1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- 2. Find Minimum in Rotated Sorted Array
(
  'find-minimum-rotated-sorted',
  'Find Minimum in Rotated Sorted Array',
  'medium',
  'Binary Search',
  ARRAY['array', 'binary-search'],
  E'Suppose an array of length `n` sorted in ascending order is **rotated** between 1 and n times.\n\nGiven the sorted rotated array `nums` of **unique** elements, return the minimum element of this array.\n\nYou must write an algorithm that runs in O(log n) time.',
  E'n == nums.length\n1 <= n <= 5000\n-5000 <= nums[i] <= 5000\nAll the integers of nums are unique.\nnums is sorted and rotated between 1 and n times.',
  '[{"input":"nums = [3,4,5,1,2]","output":"1","explanation":"Rotated [1,2,3,4,5]. Min is 1."},{"input":"nums = [4,5,6,7,0,1,2]","output":"0","explanation":"Min is 0."},{"input":"nums = [11,13,15,17]","output":"11","explanation":"No rotation needed."}]'::jsonb,
  '{"python3": "class Solution:\n    def findMin(self, nums: list[int]) -> int:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @return {number}\n */\nclass Solution {\n    findMin(nums) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int findMin(int[] nums) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int findMin(vector<int>& nums) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.findMin(input_data[\"nums\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.findMin(data.nums)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    System.out.println(new Solution().findMin(nums));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << sol.findMin(nums);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[3,4,5,1,2]}","expected_output":"1","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[4,5,6,7,0,1,2]}","expected_output":"0","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[11,13,15,17]}","expected_output":"11","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[1]}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[2,1]}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[5000,-5000,-2000,0,3000]}","expected_output":"-5000","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums\":[3,1,2]}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"nums\":[5,1,2,3,4]}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- 3. Search in Rotated Sorted Array
(
  'search-rotated-sorted-array',
  'Search in Rotated Sorted Array',
  'medium',
  'Binary Search',
  ARRAY['array', 'binary-search'],
  E'There is an integer array `nums` sorted in ascending order (with distinct values).\n\nPrior to being passed to your function, `nums` is **possibly rotated** at an unknown pivot index `k`.\n\nGiven the array `nums` after the possible rotation and an integer `target`, return the index of `target` if it is in `nums`, or `-1` if it is not in `nums`.\n\nYou must write an algorithm with O(log n) runtime complexity.',
  E'1 <= nums.length <= 5000\n-10^4 <= nums[i] <= 10^4\nAll values of nums are unique.\nnums is an ascending array that is possibly rotated.\n-10^4 <= target <= 10^4',
  '[{"input":"nums = [4,5,6,7,0,1,2], target = 0","output":"4","explanation":"0 is at index 4."},{"input":"nums = [4,5,6,7,0,1,2], target = 3","output":"-1","explanation":"3 is not in the array."},{"input":"nums = [1], target = 0","output":"-1","explanation":"0 not found."}]'::jsonb,
  '{"python3": "class Solution:\n    def search(self, nums: list[int], target: int) -> int:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @param {number} target\n * @return {number}\n */\nclass Solution {\n    search(nums, target) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int search(int[] nums, int target) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int search(vector<int>& nums, int target) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.search(input_data[\"nums\"], input_data[\"target\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.search(data.nums, data.target)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    System.out.println(new Solution().search(nums, obj.get(\"target\").getAsInt()));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << sol.search(nums, input[\"target\"].get<int>());\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[4,5,6,7,0,1,2],\"target\":0}","expected_output":"4","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[4,5,6,7,0,1,2],\"target\":3}","expected_output":"-1","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[1],\"target\":0}","expected_output":"-1","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[1],\"target\":1}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[3,1],\"target\":1}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[5,1,3],\"target\":3}","expected_output":"2","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums\":[1,2,3,4,5,6,7],\"target\":4}","expected_output":"3","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"nums\":[6,7,1,2,3,4,5],\"target\":6}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- 4. Find Peak Element
(
  'find-peak-element',
  'Find Peak Element',
  'medium',
  'Binary Search',
  ARRAY['array', 'binary-search'],
  E'A **peak element** is an element that is strictly greater than its neighbors.\n\nGiven a **0-indexed** integer array `nums`, find a peak element, and return its index. If the array contains multiple peaks, return the index to **any of the peaks**.\n\nYou may imagine that `nums[-1] = nums[n] = -∞`. In other words, an element is always considered to be strictly greater than a neighbor that is outside the array.\n\nYou must write an algorithm that runs in O(log n) time.',
  E'1 <= nums.length <= 1000\n-2^31 <= nums[i] <= 2^31 - 1\nnums[i] != nums[i + 1] for all valid i.',
  '[{"input":"nums = [1,2,3,1]","output":"2","explanation":"3 is a peak element at index 2."},{"input":"nums = [1,2,1,3,5,6,4]","output":"5","explanation":"6 is a peak at index 5. Index 1 is also valid."}]'::jsonb,
  '{"python3": "class Solution:\n    def findPeakElement(self, nums: list[int]) -> int:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @return {number}\n */\nclass Solution {\n    findPeakElement(nums) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int findPeakElement(int[] nums) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int findPeakElement(vector<int>& nums) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nnums = input_data[\"nums\"]\nsol = Solution()\nidx = sol.findPeakElement(nums)\n# validate it is actually a peak\nn = len(nums)\nleft_ok = (idx == 0 or nums[idx] > nums[idx-1])\nright_ok = (idx == n-1 or nums[idx] > nums[idx+1])\nif left_ok and right_ok:\n    print(json.dumps(idx))\nelse:\n    print(json.dumps(-1))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  const idx = sol.findPeakElement(data.nums);\n  const nums = data.nums, n = nums.length;\n  const leftOk = idx===0 || nums[idx]>nums[idx-1];\n  const rightOk = idx===n-1 || nums[idx]>nums[idx+1];\n  console.log(JSON.stringify(leftOk && rightOk ? idx : -1));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    int idx = new Solution().findPeakElement(nums);\n    int n = nums.length;\n    boolean leftOk = (idx==0 || nums[idx]>nums[idx-1]);\n    boolean rightOk = (idx==n-1 || nums[idx]>nums[idx+1]);\n    System.out.println(leftOk && rightOk ? idx : -1);\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  Solution sol;\n  int idx = sol.findPeakElement(nums);\n  int n = nums.size();\n  bool leftOk = (idx==0 || nums[idx]>nums[idx-1]);\n  bool rightOk = (idx==n-1 || nums[idx]>nums[idx+1]);\n  std::cout << (leftOk && rightOk ? idx : -1);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[1,2,3,1]}","expected_output":"2","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[1,2,1,3,5,6,4]}","expected_output":"5","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[1]}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[1,2]}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[2,1]}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[1,3,2,4,3]}","expected_output":"3","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums\":[10,9,8,7,6,5]}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- 5. Koko Eating Bananas
(
  'koko-eating-bananas',
  'Koko Eating Bananas',
  'medium',
  'Binary Search',
  ARRAY['array', 'binary-search'],
  E'Koko loves to eat bananas. There are `n` piles of bananas, the ith pile has `piles[i]` bananas. The guards have gone and will come back in `h` hours.\n\nKoko can decide her bananas-per-hour eating speed `k`. Each hour, she chooses some pile of bananas and eats `k` bananas from that pile. If the pile has less than `k` bananas, she eats all of them instead and will not eat any more bananas during this hour.\n\nKoko likes to eat slowly but still wants to finish eating all the bananas before the guards return.\n\nReturn the minimum integer `k` such that she can eat all the bananas within `h` hours.',
  E'1 <= piles.length <= 10^4\npiles.length <= h <= 10^9\n1 <= piles[i] <= 10^9',
  '[{"input":"piles = [3,6,7,11], h = 8","output":"4","explanation":"At k=4: ceil(3/4)+ceil(6/4)+ceil(7/4)+ceil(11/4)=1+2+2+3=8 hours."},{"input":"piles = [30,11,23,4,20], h = 5","output":"30","explanation":"Must eat at max speed."}]'::jsonb,
  '{"python3": "class Solution:\n    def minEatingSpeed(self, piles: list[int], h: int) -> int:\n        pass", "javascript": "/**\n * @param {number[]} piles\n * @param {number} h\n * @return {number}\n */\nclass Solution {\n    minEatingSpeed(piles, h) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int minEatingSpeed(int[] piles, int h) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int minEatingSpeed(vector<int>& piles, int h) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.minEatingSpeed(input_data[\"piles\"], input_data[\"h\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.minEatingSpeed(data.piles, data.h)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] piles = new Gson().fromJson(obj.get(\"piles\"), int[].class);\n    System.out.println(new Solution().minEatingSpeed(piles, obj.get(\"h\").getAsInt()));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto piles = input[\"piles\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << sol.minEatingSpeed(piles, input[\"h\"].get<int>());\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"piles\":[3,6,7,11],\"h\":8}","expected_output":"4","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"piles\":[30,11,23,4,20],\"h\":5}","expected_output":"30","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"piles\":[30,11,23,4,20],\"h\":6}","expected_output":"23","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"piles\":[1000000000],\"h\":2}","expected_output":"500000000","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"piles\":[1],\"h\":1000000000}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"piles\":[312884470],\"h\":312884469}","expected_output":"2","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"piles\":[3,6,7,11],\"h\":4}","expected_output":"11","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- ============================================================
-- TREES (5)
-- ============================================================

-- 6. Validate Binary Search Tree
(
  'validate-bst',
  'Validate Binary Search Tree',
  'medium',
  'Trees',
  ARRAY['tree', 'dfs', 'binary-search-tree'],
  E'Given the `root` of a binary tree (as a level-order array), determine if it is a valid **binary search tree** (BST).\n\nA valid BST is defined as follows:\n- The left subtree of a node contains only nodes with keys **strictly less than** the node''s key.\n- The right subtree of a node contains only nodes with keys **strictly greater than** the node''s key.\n- Both the left and right subtrees must also be binary search trees.',
  E'The number of nodes in the tree is in the range [1, 10^4].\n-2^31 <= Node.val <= 2^31 - 1',
  '[{"input":"root = [2,1,3]","output":"true","explanation":"1 < 2 < 3, valid BST."},{"input":"root = [5,1,4,null,null,3,6]","output":"false","explanation":"Root is 5, right child is 4 (< 5). Invalid."}]'::jsonb,
  '{"python3": "class Solution:\n    def isValidBST(self, root: list) -> bool:\n        pass", "javascript": "/**\n * @param {(number|null)[]} root\n * @return {boolean}\n */\nclass Solution {\n    isValidBST(root) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public boolean isValidBST(Integer[] root) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    bool isValidBST(vector<int>& root) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.isValidBST(input_data[\"root\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.isValidBST(data.root)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    JsonArray arr = obj.getAsJsonArray(\"root\");\n    Integer[] root = new Integer[arr.size()];\n    for (int i=0;i<arr.size();i++) root[i]=arr.get(i).isJsonNull()?null:arr.get(i).getAsInt();\n    System.out.println(new Solution().isValidBST(root));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  std::vector<int> root;\n  for (auto& v : input[\"root\"]) root.push_back(v.is_null() ? INT_MIN : v.get<int>());\n  Solution sol;\n  std::cout << json(sol.isValidBST(root)).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"root\":[2,1,3]}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"root\":[5,1,4,null,null,3,6]}","expected_output":"false","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"root\":[1]}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"root\":[2,2,2]}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"root\":[10,5,15,null,null,6,20]}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"root\":[10,5,15,3,7,12,20]}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"root\":[2147483647]}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- 7. Lowest Common Ancestor of BST
(
  'lowest-common-ancestor-bst',
  'Lowest Common Ancestor of a Binary Search Tree',
  'medium',
  'Trees',
  ARRAY['tree', 'dfs', 'binary-search-tree'],
  E'Given a binary search tree (BST) represented as a level-order array, and two values `p` and `q`, find their lowest common ancestor (LCA).\n\nThe LCA of two nodes p and q in a tree T is defined as the lowest node in T that has both p and q as descendants (where we allow a node to be a descendant of itself).\n\nReturn the value of the LCA node.',
  E'The number of nodes in the tree is in the range [2, 10^5].\n-10^9 <= Node.val <= 10^9\nAll Node.val are unique.\np != q\np and q will exist in the BST.',
  '[{"input":"root = [6,2,8,0,4,7,9,null,null,3,5], p = 2, q = 8","output":"6","explanation":"LCA of 2 and 8 is 6."},{"input":"root = [6,2,8,0,4,7,9,null,null,3,5], p = 2, q = 4","output":"2","explanation":"LCA of 2 and 4 is 2 (ancestor of itself)."}]'::jsonb,
  '{"python3": "class Solution:\n    def lowestCommonAncestor(self, root: list, p: int, q: int) -> int:\n        pass", "javascript": "/**\n * @param {(number|null)[]} root\n * @param {number} p\n * @param {number} q\n * @return {number}\n */\nclass Solution {\n    lowestCommonAncestor(root, p, q) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int lowestCommonAncestor(Integer[] root, int p, int q) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int lowestCommonAncestor(vector<int>& root, int p, int q) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.lowestCommonAncestor(input_data[\"root\"], input_data[\"p\"], input_data[\"q\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.lowestCommonAncestor(data.root, data.p, data.q)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    JsonArray arr = obj.getAsJsonArray(\"root\");\n    Integer[] root = new Integer[arr.size()];\n    for (int i=0;i<arr.size();i++) root[i]=arr.get(i).isJsonNull()?null:arr.get(i).getAsInt();\n    System.out.println(new Solution().lowestCommonAncestor(root, obj.get(\"p\").getAsInt(), obj.get(\"q\").getAsInt()));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  std::vector<int> root;\n  for (auto& v : input[\"root\"]) root.push_back(v.is_null() ? INT_MIN : v.get<int>());\n  Solution sol;\n  std::cout << sol.lowestCommonAncestor(root, input[\"p\"].get<int>(), input[\"q\"].get<int>());\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"root\":[6,2,8,0,4,7,9,null,null,3,5],\"p\":2,\"q\":8}","expected_output":"6","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"root\":[6,2,8,0,4,7,9,null,null,3,5],\"p\":2,\"q\":4}","expected_output":"2","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"root\":[2,1],\"p\":2,\"q\":1}","expected_output":"2","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"root\":[6,2,8,0,4,7,9,null,null,3,5],\"p\":3,\"q\":5}","expected_output":"4","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"root\":[10,5,20,3,7,15,25],\"p\":3,\"q\":25}","expected_output":"10","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"root\":[10,5,20,3,7,15,25],\"p\":5,\"q\":7}","expected_output":"5","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- 8. Binary Tree Right Side View
(
  'binary-tree-right-side-view',
  'Binary Tree Right Side View',
  'medium',
  'Trees',
  ARRAY['tree', 'dfs', 'bfs'],
  E'Given the `root` of a binary tree (as a level-order array), imagine yourself standing on the **right side** of it, return the values of the nodes you can see ordered from top to bottom.',
  E'The number of nodes in the tree is in the range [0, 100].\n-100 <= Node.val <= 100',
  '[{"input":"root = [1,2,3,null,5,null,4]","output":"[1,3,4]","explanation":"Right side: 1 (root), 3 (rightmost level 1), 4 (rightmost level 2)."},{"input":"root = [1,null,3]","output":"[1,3]","explanation":"Right side: 1, 3."},{"input":"root = []","output":"[]","explanation":"Empty tree."}]'::jsonb,
  '{"python3": "class Solution:\n    def rightSideView(self, root: list) -> list[int]:\n        pass", "javascript": "/**\n * @param {(number|null)[]} root\n * @return {number[]}\n */\nclass Solution {\n    rightSideView(root) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public List<Integer> rightSideView(Integer[] root) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<int> rightSideView(vector<int>& root) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.rightSideView(input_data[\"root\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.rightSideView(data.root)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    JsonArray arr = obj.getAsJsonArray(\"root\");\n    Integer[] root = new Integer[arr.size()];\n    for (int i=0;i<arr.size();i++) root[i]=arr.get(i).isJsonNull()?null:arr.get(i).getAsInt();\n    System.out.println(new Gson().toJson(new Solution().rightSideView(root)));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  std::vector<int> root;\n  for (auto& v : input[\"root\"]) root.push_back(v.is_null() ? -101 : v.get<int>());\n  Solution sol;\n  std::cout << json(sol.rightSideView(root)).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"root\":[1,2,3,null,5,null,4]}","expected_output":"[1,3,4]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"root\":[1,null,3]}","expected_output":"[1,3]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"root\":[]}","expected_output":"[]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"root\":[1]}","expected_output":"[1]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"root\":[1,2,null,3]}","expected_output":"[1,2,3]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"root\":[1,2,3,4,5,6,7]}","expected_output":"[1,3,7]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"root\":[1,2,3,null,4,null,5]}","expected_output":"[1,3,5]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- 9. Kth Smallest Element in BST
(
  'kth-smallest-bst',
  'Kth Smallest Element in a BST',
  'medium',
  'Trees',
  ARRAY['tree', 'dfs', 'binary-search-tree'],
  E'Given the `root` of a binary search tree (as a level-order array), and an integer `k`, return the `k`th smallest value (1-indexed) of all the values of the nodes in the tree.',
  E'The number of nodes in the tree is n.\n1 <= k <= n <= 10^4\n0 <= Node.val <= 10^4',
  '[{"input":"root = [3,1,4,null,2], k = 1","output":"1","explanation":"In-order: 1,2,3,4 — 1st smallest is 1."},{"input":"root = [5,3,6,2,4,null,null,1], k = 3","output":"3","explanation":"In-order: 1,2,3,4,5,6 — 3rd smallest is 3."}]'::jsonb,
  '{"python3": "class Solution:\n    def kthSmallest(self, root: list, k: int) -> int:\n        pass", "javascript": "/**\n * @param {(number|null)[]} root\n * @param {number} k\n * @return {number}\n */\nclass Solution {\n    kthSmallest(root, k) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int kthSmallest(Integer[] root, int k) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int kthSmallest(vector<int>& root, int k) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.kthSmallest(input_data[\"root\"], input_data[\"k\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.kthSmallest(data.root, data.k)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    JsonArray arr = obj.getAsJsonArray(\"root\");\n    Integer[] root = new Integer[arr.size()];\n    for (int i=0;i<arr.size();i++) root[i]=arr.get(i).isJsonNull()?null:arr.get(i).getAsInt();\n    System.out.println(new Solution().kthSmallest(root, obj.get(\"k\").getAsInt()));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  std::vector<int> root;\n  for (auto& v : input[\"root\"]) root.push_back(v.is_null() ? -1 : v.get<int>());\n  Solution sol;\n  std::cout << sol.kthSmallest(root, input[\"k\"].get<int>());\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"root\":[3,1,4,null,2],\"k\":1}","expected_output":"1","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"root\":[5,3,6,2,4,null,null,1],\"k\":3}","expected_output":"3","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"root\":[1],\"k\":1}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"root\":[3,1,4,null,2],\"k\":5}","expected_output":"4","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"root\":[10,5,15,3,7,12,20],\"k\":4}","expected_output":"10","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"root\":[10,5,15,3,7,12,20],\"k\":1}","expected_output":"3","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- 10. Diameter of Binary Tree (medium variant)
(
  'diameter-binary-tree',
  'Diameter of Binary Tree',
  'medium',
  'Trees',
  ARRAY['tree', 'dfs'],
  E'Given the `root` of a binary tree (as a level-order array), return the length of the **diameter** of the tree.\n\nThe **diameter** of a binary tree is the **length of the longest path** between any two nodes in a tree. This path may or may not pass through the root.\n\nThe **length** of a path between two nodes is represented by the number of edges between them.',
  E'The number of nodes in the tree is in the range [1, 10^4].\n-100 <= Node.val <= 100',
  '[{"input":"root = [1,2,3,4,5]","output":"3","explanation":"Longest path: [4,2,1,3] or [5,2,1,3] — 3 edges."},{"input":"root = [1,2]","output":"1","explanation":"One edge between 1 and 2."}]'::jsonb,
  '{"python3": "class Solution:\n    def diameterOfBinaryTree(self, root: list) -> int:\n        pass", "javascript": "/**\n * @param {(number|null)[]} root\n * @return {number}\n */\nclass Solution {\n    diameterOfBinaryTree(root) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int diameterOfBinaryTree(Integer[] root) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int diameterOfBinaryTree(vector<int>& root) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.diameterOfBinaryTree(input_data[\"root\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.diameterOfBinaryTree(data.root)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    JsonArray arr = obj.getAsJsonArray(\"root\");\n    Integer[] root = new Integer[arr.size()];\n    for (int i=0;i<arr.size();i++) root[i]=arr.get(i).isJsonNull()?null:arr.get(i).getAsInt();\n    System.out.println(new Solution().diameterOfBinaryTree(root));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  std::vector<int> root;\n  for (auto& v : input[\"root\"]) root.push_back(v.is_null() ? -101 : v.get<int>());\n  Solution sol;\n  std::cout << sol.diameterOfBinaryTree(root);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"root\":[1,2,3,4,5]}","expected_output":"3","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"root\":[1,2]}","expected_output":"1","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"root\":[1]}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"root\":[4,2,null,3,null,1]}","expected_output":"3","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"root\":[1,null,2,null,3,null,4,null,5]}","expected_output":"4","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"root\":[1,2,3,4,5,6,7,8,9]}","expected_output":"5","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- ============================================================
-- GRAPHS (5)
-- ============================================================

-- 11. Number of Islands
(
  'number-of-islands',
  'Number of Islands',
  'medium',
  'Graphs',
  ARRAY['array', 'dfs', 'bfs', 'union-find', 'matrix'],
  E'Given an `m x n` 2D binary grid `grid` which represents a map of `''1''`s (land) and `''0''`s (water), return the number of islands.\n\nAn **island** is surrounded by water and is formed by connecting adjacent lands horizontally or vertically. You may assume all four edges of the grid are all surrounded by water.\n\nThe grid is passed as a 2D array of strings.',
  E'm == grid.length\nn == grid[i].length\n1 <= m, n <= 300\ngrid[i][j] is ''0'' or ''1''.',
  '[{"input":"grid = [[\"1\",\"1\",\"1\",\"1\",\"0\"],[\"1\",\"1\",\"0\",\"1\",\"0\"],[\"1\",\"1\",\"0\",\"0\",\"0\"],[\"0\",\"0\",\"0\",\"0\",\"0\"]]","output":"1","explanation":"One large island."},{"input":"grid = [[\"1\",\"1\",\"0\",\"0\",\"0\"],[\"1\",\"1\",\"0\",\"0\",\"0\"],[\"0\",\"0\",\"1\",\"0\",\"0\"],[\"0\",\"0\",\"0\",\"1\",\"1\"]]","output":"3","explanation":"Three separate islands."}]'::jsonb,
  '{"python3": "class Solution:\n    def numIslands(self, grid: list[list[str]]) -> int:\n        pass", "javascript": "/**\n * @param {string[][]} grid\n * @return {number}\n */\nclass Solution {\n    numIslands(grid) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int numIslands(char[][] grid) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int numIslands(vector<vector<char>>& grid) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.numIslands(input_data[\"grid\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.numIslands(data.grid)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    String[][] strGrid = new Gson().fromJson(obj.get(\"grid\"), String[][].class);\n    char[][] grid = new char[strGrid.length][];\n    for (int i=0;i<strGrid.length;i++) { grid[i]=new char[strGrid[i].length]; for (int j=0;j<strGrid[i].length;j++) grid[i][j]=strGrid[i][j].charAt(0); }\n    System.out.println(new Solution().numIslands(grid));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  std::vector<std::vector<char>> grid;\n  for (auto& row : input[\"grid\"]) {\n    std::vector<char> r;\n    for (auto& cell : row) r.push_back(cell.get<std::string>()[0]);\n    grid.push_back(r);\n  }\n  Solution sol;\n  std::cout << sol.numIslands(grid);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"grid\":[[\"1\",\"1\",\"1\",\"1\",\"0\"],[\"1\",\"1\",\"0\",\"1\",\"0\"],[\"1\",\"1\",\"0\",\"0\",\"0\"],[\"0\",\"0\",\"0\",\"0\",\"0\"]]}","expected_output":"1","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"grid\":[[\"1\",\"1\",\"0\",\"0\",\"0\"],[\"1\",\"1\",\"0\",\"0\",\"0\"],[\"0\",\"0\",\"1\",\"0\",\"0\"],[\"0\",\"0\",\"0\",\"1\",\"1\"]]}","expected_output":"3","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"grid\":[[\"1\"]]}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"grid\":[[\"0\"]]}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"grid\":[[\"1\",\"0\",\"1\"],[\"0\",\"1\",\"0\"],[\"1\",\"0\",\"1\"]]}","expected_output":"5","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"grid\":[[\"1\",\"1\",\"1\"],[\"0\",\"1\",\"0\"],[\"1\",\"1\",\"1\"]]}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"grid\":[[\"0\",\"0\",\"0\"],[\"0\",\"0\",\"0\"],[\"0\",\"0\",\"0\"]]}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- 12. Clone Graph
(
  'clone-graph',
  'Clone Graph',
  'medium',
  'Graphs',
  ARRAY['hash-map', 'dfs', 'bfs', 'graph'],
  E'Given a reference of a node in a **connected** undirected graph, return a **deep copy** (clone) of the graph.\n\nThe graph is given as an adjacency list where `adjList[i]` is the list of neighbors of node `i+1`.\n\nFor testing, return the adjacency list of the cloned graph sorted for consistency.',
  E'The number of nodes in the graph is in the range [0, 100].\n1 <= Node.val <= 100\nNode.val is unique for each node.\nThere are no repeated edges and no self-loops in the graph.\nThe Graph is connected and all nodes can be visited starting from the given node.',
  '[{"input":"adjList = [[2,4],[1,3],[2,4],[1,3]]","output":"[[2,4],[1,3],[2,4],[1,3]]","explanation":"Deep copy of a 4-node cycle."},{"input":"adjList = [[]]","output":"[[]]","explanation":"Single node, no neighbors."}]'::jsonb,
  '{"python3": "class Solution:\n    def cloneGraph(self, adjList: list[list[int]]) -> list[list[int]]:\n        pass", "javascript": "/**\n * @param {number[][]} adjList\n * @return {number[][]}\n */\nclass Solution {\n    cloneGraph(adjList) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int[][] cloneGraph(int[][] adjList) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<vector<int>> cloneGraph(vector<vector<int>>& adjList) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.cloneGraph(input_data[\"adjList\"])\nfor row in result: row.sort()\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  const result = sol.cloneGraph(data.adjList);\n  result.forEach(r => r.sort((a,b)=>a-b));\n  console.log(JSON.stringify(result));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[][] adjList = new Gson().fromJson(obj.get(\"adjList\"), int[][].class);\n    int[][] result = new Solution().cloneGraph(adjList);\n    for (int[] row : result) Arrays.sort(row);\n    System.out.println(new Gson().toJson(result));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <algorithm>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  std::vector<std::vector<int>> adj;\n  for (auto& row : input[\"adjList\"]) adj.push_back(row.get<std::vector<int>>());\n  Solution sol;\n  auto result = sol.cloneGraph(adj);\n  for (auto& row : result) std::sort(row.begin(), row.end());\n  std::cout << json(result).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"adjList\":[[2,4],[1,3],[2,4],[1,3]]}","expected_output":"[[2,4],[1,3],[2,4],[1,3]]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"adjList\":[[]]}","expected_output":"[[]]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"adjList\":[[2],[1]]}","expected_output":"[[2],[1]]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"adjList\":[[2,3],[1,3],[1,2]]}","expected_output":"[[2,3],[1,3],[1,2]]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"adjList\":[[2,3,4],[1,3,4],[1,2,4],[1,2,3]]}","expected_output":"[[2,3,4],[1,3,4],[1,2,4],[1,2,3]]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- 13. Course Schedule (Cycle Detection)
(
  'course-schedule',
  'Course Schedule',
  'medium',
  'Graphs',
  ARRAY['dfs', 'bfs', 'graph', 'topological-sort'],
  E'There are a total of `numCourses` courses you have to take, labeled from `0` to `numCourses - 1`. You are given an array `prerequisites` where `prerequisites[i] = [ai, bi]` indicates that you **must** take course `bi` first if you want to take course `ai`.\n\nReturn `true` if you can finish all courses. Otherwise, return `false`.',
  E'1 <= numCourses <= 2000\n0 <= prerequisites.length <= 5000\nprerequisites[i].length == 2\n0 <= ai, bi < numCourses\nAll the pairs prerequisites[i] are unique.',
  '[{"input":"numCourses = 2, prerequisites = [[1,0]]","output":"true","explanation":"Take 0 then 1. No cycle."},{"input":"numCourses = 2, prerequisites = [[1,0],[0,1]]","output":"false","explanation":"Cycle: 0↔1."}]'::jsonb,
  '{"python3": "class Solution:\n    def canFinish(self, numCourses: int, prerequisites: list[list[int]]) -> bool:\n        pass", "javascript": "/**\n * @param {number} numCourses\n * @param {number[][]} prerequisites\n * @return {boolean}\n */\nclass Solution {\n    canFinish(numCourses, prerequisites) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public boolean canFinish(int numCourses, int[][] prerequisites) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    bool canFinish(int numCourses, vector<vector<int>>& prerequisites) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.canFinish(input_data[\"numCourses\"], input_data[\"prerequisites\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.canFinish(data.numCourses, data.prerequisites)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[][] prereqs = new Gson().fromJson(obj.get(\"prerequisites\"), int[][].class);\n    System.out.println(new Solution().canFinish(obj.get(\"numCourses\").getAsInt(), prereqs));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  std::vector<std::vector<int>> prereqs;\n  for (auto& p : input[\"prerequisites\"]) prereqs.push_back(p.get<std::vector<int>>());\n  Solution sol;\n  std::cout << json(sol.canFinish(input[\"numCourses\"].get<int>(), prereqs)).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"numCourses\":2,\"prerequisites\":[[1,0]]}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"numCourses\":2,\"prerequisites\":[[1,0],[0,1]]}","expected_output":"false","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"numCourses\":1,\"prerequisites\":[]}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"numCourses\":5,\"prerequisites\":[[1,4],[2,4],[3,1],[3,2]]}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"numCourses\":4,\"prerequisites\":[[1,0],[2,1],[3,2],[0,3]]}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"numCourses\":3,\"prerequisites\":[[0,1],[0,2],[1,2]]}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"numCourses\":6,\"prerequisites\":[[1,0],[2,1],[3,5],[4,3],[5,4]]}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- 14. Flood Fill
(
  'flood-fill',
  'Flood Fill',
  'medium',
  'Graphs',
  ARRAY['array', 'dfs', 'bfs', 'matrix'],
  E'An image is represented by an `m x n` integer grid `image` where `image[i][j]` represents the pixel value of the image.\n\nYou are also given three integers `sr`, `sc`, and `color`. Perform a **flood fill** on the image starting from the pixel `image[sr][sc]`.\n\nTo perform a flood fill, consider the starting pixel, plus any pixels connected 4-directionally to the starting pixel of the same color as the starting pixel, plus any pixels connected 4-directionally to those pixels (also with the same color), and so on. Replace the color of all of the aforementioned pixels with color.\n\nReturn the modified image after performing the flood fill.',
  E'm == image.length\nn == image[i].length\n1 <= m, n <= 50\n0 <= image[i][j], color < 2^16\n0 <= sr < m\n0 <= sc < n',
  '[{"input":"image = [[1,1,1],[1,1,0],[1,0,1]], sr = 1, sc = 1, color = 2","output":"[[2,2,2],[2,2,0],[2,0,1]]","explanation":"Center flood fill replaces all connected 1s with 2."},{"input":"image = [[0,0,0],[0,0,0]], sr = 0, sc = 0, color = 0","output":"[[0,0,0],[0,0,0]]","explanation":"Same color, no change."}]'::jsonb,
  '{"python3": "class Solution:\n    def floodFill(self, image: list[list[int]], sr: int, sc: int, color: int) -> list[list[int]]:\n        pass", "javascript": "/**\n * @param {number[][]} image\n * @param {number} sr\n * @param {number} sc\n * @param {number} color\n * @return {number[][]}\n */\nclass Solution {\n    floodFill(image, sr, sc, color) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int[][] floodFill(int[][] image, int sr, int sc, int color) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<vector<int>> floodFill(vector<vector<int>>& image, int sr, int sc, int color) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.floodFill(input_data[\"image\"], input_data[\"sr\"], input_data[\"sc\"], input_data[\"color\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.floodFill(data.image, data.sr, data.sc, data.color)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[][] image = new Gson().fromJson(obj.get(\"image\"), int[][].class);\n    System.out.println(new Gson().toJson(new Solution().floodFill(image, obj.get(\"sr\").getAsInt(), obj.get(\"sc\").getAsInt(), obj.get(\"color\").getAsInt())));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  std::vector<std::vector<int>> image;\n  for (auto& row : input[\"image\"]) image.push_back(row.get<std::vector<int>>());\n  Solution sol;\n  auto result = sol.floodFill(image, input[\"sr\"].get<int>(), input[\"sc\"].get<int>(), input[\"color\"].get<int>());\n  std::cout << json(result).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"image\":[[1,1,1],[1,1,0],[1,0,1]],\"sr\":1,\"sc\":1,\"color\":2}","expected_output":"[[2,2,2],[2,2,0],[2,0,1]]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"image\":[[0,0,0],[0,0,0]],\"sr\":0,\"sc\":0,\"color\":0}","expected_output":"[[0,0,0],[0,0,0]]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"image\":[[1]],\"sr\":0,\"sc\":0,\"color\":2}","expected_output":"[[2]]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"image\":[[1,2,1],[2,2,2],[1,2,1]],\"sr\":1,\"sc\":1,\"color\":0}","expected_output":"[[1,0,1],[0,0,0],[1,0,1]]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"image\":[[0,0,0],[0,1,1]],\"sr\":1,\"sc\":1,\"color\":0}","expected_output":"[[0,0,0],[0,0,0]]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"image\":[[1,1,1],[1,2,1],[1,1,1]],\"sr\":1,\"sc\":1,\"color\":3}","expected_output":"[[1,1,1],[1,3,1],[1,1,1]]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- 15. Number of Connected Components in an Undirected Graph
(
  'number-connected-components',
  'Number of Connected Components in an Undirected Graph',
  'medium',
  'Graphs',
  ARRAY['dfs', 'bfs', 'union-find', 'graph'],
  E'You have a graph of `n` nodes. You are given an integer `n` and an array `edges` where `edges[i] = [ai, bi]` indicates that there is an edge between `ai` and `bi` in the graph.\n\nReturn the number of connected components in the graph.',
  E'1 <= n <= 2000\n1 <= edges.length <= 5000\nedges[i].length == 2\n0 <= ai <= bi < n\nai != bi\nThere are no repeated edges.',
  '[{"input":"n = 5, edges = [[0,1],[1,2],[3,4]]","output":"2","explanation":"Two components: {0,1,2} and {3,4}."},{"input":"n = 5, edges = [[0,1],[1,2],[2,3],[3,4]]","output":"1","explanation":"All connected."}]'::jsonb,
  '{"python3": "class Solution:\n    def countComponents(self, n: int, edges: list[list[int]]) -> int:\n        pass", "javascript": "/**\n * @param {number} n\n * @param {number[][]} edges\n * @return {number}\n */\nclass Solution {\n    countComponents(n, edges) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int countComponents(int n, int[][] edges) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int countComponents(int n, vector<vector<int>>& edges) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.countComponents(input_data[\"n\"], input_data[\"edges\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.countComponents(data.n, data.edges)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[][] edges = new Gson().fromJson(obj.get(\"edges\"), int[][].class);\n    System.out.println(new Solution().countComponents(obj.get(\"n\").getAsInt(), edges));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  std::vector<std::vector<int>> edges;\n  for (auto& e : input[\"edges\"]) edges.push_back(e.get<std::vector<int>>());\n  Solution sol;\n  std::cout << sol.countComponents(input[\"n\"].get<int>(), edges);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"n\":5,\"edges\":[[0,1],[1,2],[3,4]]}","expected_output":"2","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"n\":5,\"edges\":[[0,1],[1,2],[2,3],[3,4]]}","expected_output":"1","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"n\":1,\"edges\":[]}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"n\":4,\"edges\":[]}","expected_output":"4","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"n\":6,\"edges\":[[0,1],[2,3],[4,5]]}","expected_output":"3","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"n\":7,\"edges\":[[0,1],[0,2],[3,4],[5,6]]}","expected_output":"3","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"n\":3,\"edges\":[[0,1],[0,2],[1,2]]}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- ============================================================
-- GREEDY (4)
-- ============================================================

-- 16. Jump Game
(
  'jump-game',
  'Jump Game',
  'medium',
  'Greedy',
  ARRAY['array', 'dynamic-programming', 'greedy'],
  E'You are given an integer array `nums`. You are initially positioned at the array''s **first index**, and each element in the array represents your maximum jump length at that position.\n\nReturn `true` if you can reach the last index, or `false` otherwise.',
  E'1 <= nums.length <= 10^4\n0 <= nums[i] <= 10^5',
  '[{"input":"nums = [2,3,1,1,4]","output":"true","explanation":"Jump 1 step from index 0, then 3 steps to last."},{"input":"nums = [3,2,1,0,4]","output":"false","explanation":"Always stuck at index 3."}]'::jsonb,
  '{"python3": "class Solution:\n    def canJump(self, nums: list[int]) -> bool:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @return {boolean}\n */\nclass Solution {\n    canJump(nums) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public boolean canJump(int[] nums) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    bool canJump(vector<int>& nums) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.canJump(input_data[\"nums\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.canJump(data.nums)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    System.out.println(new Solution().canJump(nums));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << json(sol.canJump(nums)).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[2,3,1,1,4]}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[3,2,1,0,4]}","expected_output":"false","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[0]}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[1]}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[1,0,0,0]}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[2,0,0]}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums\":[1,1,1,1,1,1,0]}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"nums\":[0,1]}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- 17. Gas Station
(
  'gas-station',
  'Gas Station',
  'medium',
  'Greedy',
  ARRAY['array', 'greedy'],
  E'There are `n` gas stations along a circular route, where the amount of gas at the ith station is `gas[i]`.\n\nYou have a car with an unlimited gas tank and it costs `cost[i]` of gas to travel from the ith station to its next `(i + 1)`th station. You begin the journey with an empty tank at one of the gas stations.\n\nGiven two integer arrays `gas` and `cost`, return the starting gas station''s index if you can travel around the circuit once in the clockwise direction, otherwise return `-1`. If there exists a solution, it is **guaranteed** to be **unique**.',
  E'n == gas.length == cost.length\n1 <= n <= 10^5\n0 <= gas[i], cost[i] <= 10^4',
  '[{"input":"gas = [1,2,3,4,5], cost = [3,4,5,1,2]","output":"3","explanation":"Start at station 3 (index 3): 4+5-1=8→8+5-2=11→11+1-3=9→9+2-4=7→7+3-5=5>0."},{"input":"gas = [2,3,4], cost = [3,4,3]","output":"-1","explanation":"Cannot complete circuit."}]'::jsonb,
  '{"python3": "class Solution:\n    def canCompleteCircuit(self, gas: list[int], cost: list[int]) -> int:\n        pass", "javascript": "/**\n * @param {number[]} gas\n * @param {number[]} cost\n * @return {number}\n */\nclass Solution {\n    canCompleteCircuit(gas, cost) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int canCompleteCircuit(int[] gas, int[] cost) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int canCompleteCircuit(vector<int>& gas, vector<int>& cost) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.canCompleteCircuit(input_data[\"gas\"], input_data[\"cost\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.canCompleteCircuit(data.gas, data.cost)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] gas = new Gson().fromJson(obj.get(\"gas\"), int[].class);\n    int[] cost = new Gson().fromJson(obj.get(\"cost\"), int[].class);\n    System.out.println(new Solution().canCompleteCircuit(gas, cost));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto gas = input[\"gas\"].get<std::vector<int>>();\n  auto cost = input[\"cost\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << sol.canCompleteCircuit(gas, cost);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"gas\":[1,2,3,4,5],\"cost\":[3,4,5,1,2]}","expected_output":"3","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"gas\":[2,3,4],\"cost\":[3,4,3]}","expected_output":"-1","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"gas\":[5],\"cost\":[4]}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"gas\":[5],\"cost\":[5]}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"gas\":[3,1,1],\"cost\":[1,2,2]}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"gas\":[1,2,3,4,5],\"cost\":[5,4,3,2,1]}","expected_output":"2","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"gas\":[0,0,0,0],\"cost\":[1,1,1,1]}","expected_output":"-1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- 18. Meeting Rooms II
(
  'meeting-rooms-ii',
  'Meeting Rooms II',
  'medium',
  'Greedy',
  ARRAY['array', 'greedy', 'sorting', 'heap'],
  E'Given an array of meeting time intervals `intervals` where `intervals[i] = [starti, endi]`, return the minimum number of conference rooms required.',
  E'1 <= intervals.length <= 10^4\n0 <= starti < endi <= 10^6',
  '[{"input":"intervals = [[0,30],[5,10],[15,20]]","output":"2","explanation":"Two rooms needed: room 1 for [0,30] and room 2 for [5,10] then reused for [15,20]."},{"input":"intervals = [[7,10],[2,4]]","output":"1","explanation":"Non-overlapping, one room suffices."}]'::jsonb,
  '{"python3": "class Solution:\n    def minMeetingRooms(self, intervals: list[list[int]]) -> int:\n        pass", "javascript": "/**\n * @param {number[][]} intervals\n * @return {number}\n */\nclass Solution {\n    minMeetingRooms(intervals) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int minMeetingRooms(int[][] intervals) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int minMeetingRooms(vector<vector<int>>& intervals) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.minMeetingRooms(input_data[\"intervals\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.minMeetingRooms(data.intervals)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[][] intervals = new Gson().fromJson(obj.get(\"intervals\"), int[][].class);\n    System.out.println(new Solution().minMeetingRooms(intervals));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  std::vector<std::vector<int>> intervals;\n  for (auto& i : input[\"intervals\"]) intervals.push_back(i.get<std::vector<int>>());\n  Solution sol;\n  std::cout << sol.minMeetingRooms(intervals);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"intervals\":[[0,30],[5,10],[15,20]]}","expected_output":"2","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"intervals\":[[7,10],[2,4]]}","expected_output":"1","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"intervals\":[[1,5]]}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"intervals\":[[1,3],[2,4],[3,5]]}","expected_output":"2","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"intervals\":[[1,10],[2,3],[4,5],[6,7],[8,9]]}","expected_output":"2","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"intervals\":[[1,4],[2,5],[3,6],[4,7]]}","expected_output":"3","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"intervals\":[[1,2],[2,3],[3,4],[4,5]]}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- 19. Task Scheduler
(
  'task-scheduler',
  'Task Scheduler',
  'medium',
  'Greedy',
  ARRAY['array', 'greedy', 'heap', 'hash-map', 'sorting'],
  E'Given a characters array `tasks`, representing the tasks a CPU needs to do, where each letter represents a different task. Tasks could be done in any order. Each task is done in one unit of time. For each unit of time, the CPU could complete either one task or just be idle.\n\nHowever, there is a non-negative integer `n` that represents the cooldown interval between two **same tasks** (the same letter in the array), that is that there must be at least `n` units of time between any two same tasks.\n\nReturn the least number of units of times that the CPU will take to finish all the given tasks.',
  E'1 <= task.length <= 10^4\ntasks[i] is upper-case English letter.\n0 <= n <= 100',
  '[{"input":"tasks = [\"A\",\"A\",\"A\",\"B\",\"B\",\"B\"], n = 2","output":"8","explanation":"A→B→idle→A→B→idle→A→B."},{"input":"tasks = [\"A\",\"A\",\"A\",\"B\",\"B\",\"B\"], n = 0","output":"6","explanation":"No cooldown needed."}]'::jsonb,
  '{"python3": "class Solution:\n    def leastInterval(self, tasks: list[str], n: int) -> int:\n        pass", "javascript": "/**\n * @param {character[]} tasks\n * @param {number} n\n * @return {number}\n */\nclass Solution {\n    leastInterval(tasks, n) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int leastInterval(char[] tasks, int n) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int leastInterval(vector<char>& tasks, int n) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.leastInterval(input_data[\"tasks\"], input_data[\"n\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.leastInterval(data.tasks, data.n)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    String[] t = new Gson().fromJson(obj.get(\"tasks\"), String[].class);\n    char[] tasks = new char[t.length];\n    for(int i=0;i<t.length;i++) tasks[i]=t[i].charAt(0);\n    System.out.println(new Solution().leastInterval(tasks, obj.get(\"n\").getAsInt()));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto ts = input[\"tasks\"].get<std::vector<std::string>>();\n  std::vector<char> tasks;\n  for (auto& s : ts) tasks.push_back(s[0]);\n  Solution sol;\n  std::cout << sol.leastInterval(tasks, input[\"n\"].get<int>());\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"tasks\":[\"A\",\"A\",\"A\",\"B\",\"B\",\"B\"],\"n\":2}","expected_output":"8","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"tasks\":[\"A\",\"A\",\"A\",\"B\",\"B\",\"B\"],\"n\":0}","expected_output":"6","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"tasks\":[\"A\",\"C\",\"A\",\"B\",\"D\",\"B\"],\"n\":1}","expected_output":"6","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"tasks\":[\"A\"],\"n\":100}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"tasks\":[\"A\",\"A\"],\"n\":1}","expected_output":"3","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"tasks\":[\"A\",\"B\",\"A\",\"B\",\"A\",\"B\"],\"n\":2}","expected_output":"8","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"tasks\":[\"A\",\"A\",\"A\",\"A\",\"A\",\"A\"],\"n\":2}","expected_output":"16","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- ============================================================
-- DYNAMIC PROGRAMMING (7)
-- ============================================================

-- 20. House Robber
(
  'house-robber',
  'House Robber',
  'medium',
  'Dynamic Programming',
  ARRAY['array', 'dynamic-programming'],
  E'You are a professional robber planning to rob houses along a street. Each house has a certain amount of money stashed, the only constraint stopping you from robbing each of them is that adjacent houses have security systems connected and it will automatically contact the police if **two adjacent houses** were broken into on the same night.\n\nGiven an integer array `nums` representing the amount of money of each house, return the maximum amount of money you can rob tonight **without alerting the police**.',
  E'1 <= nums.length <= 100\n0 <= nums[i] <= 400',
  '[{"input":"nums = [1,2,3,1]","output":"4","explanation":"Rob house 1 (1) and house 3 (3). Total = 4."},{"input":"nums = [2,7,9,3,1]","output":"12","explanation":"Rob houses 1, 3, 5. Total = 2+9+1 = 12."}]'::jsonb,
  '{"python3": "class Solution:\n    def rob(self, nums: list[int]) -> int:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @return {number}\n */\nclass Solution {\n    rob(nums) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int rob(int[] nums) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int rob(vector<int>& nums) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.rob(input_data[\"nums\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.rob(data.nums)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    System.out.println(new Solution().rob(nums));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << sol.rob(nums);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[1,2,3,1]}","expected_output":"4","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[2,7,9,3,1]}","expected_output":"12","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[1]}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[2,1]}","expected_output":"2","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[0,0,0,0]}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[400,400,400,400,400]}","expected_output":"1200","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums\":[1,2,3,4,5,6,7,8,9,10]}","expected_output":"30","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"nums\":[100,1,100,1,100]}","expected_output":"300","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- 21. Unique Paths
(
  'unique-paths',
  'Unique Paths',
  'medium',
  'Dynamic Programming',
  ARRAY['math', 'dynamic-programming', 'combinatorics'],
  E'There is a robot on an `m x n` grid. The robot is initially located at the **top-left corner** (i.e., `grid[0][0]`). The robot tries to move to the **bottom-right corner** (i.e., `grid[m - 1][n - 1]`). The robot can only move either **down** or **right** at any point in time.\n\nGiven the two integers `m` and `n`, return the number of possible unique paths that the robot can take to reach the bottom-right corner.',
  E'1 <= m, n <= 100',
  '[{"input":"m = 3, n = 7","output":"28","explanation":"28 unique paths."},{"input":"m = 3, n = 2","output":"3","explanation":"Three paths: right-down-down, down-right-down, down-down-right."}]'::jsonb,
  '{"python3": "class Solution:\n    def uniquePaths(self, m: int, n: int) -> int:\n        pass", "javascript": "/**\n * @param {number} m\n * @param {number} n\n * @return {number}\n */\nclass Solution {\n    uniquePaths(m, n) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int uniquePaths(int m, int n) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int uniquePaths(int m, int n) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.uniquePaths(input_data[\"m\"], input_data[\"n\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.uniquePaths(data.m, data.n)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Solution().uniquePaths(obj.get(\"m\").getAsInt(), obj.get(\"n\").getAsInt()));\n  }\n}", "cpp": "#include <iostream>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << sol.uniquePaths(input[\"m\"].get<int>(), input[\"n\"].get<int>());\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"m\":3,\"n\":7}","expected_output":"28","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"m\":3,\"n\":2}","expected_output":"3","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"m\":1,\"n\":1}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"m\":1,\"n\":100}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"m\":100,\"n\":1}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"m\":10,\"n\":10}","expected_output":"48620","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"m\":5,\"n\":5}","expected_output":"70","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- 22. Coin Change
(
  'coin-change',
  'Coin Change',
  'medium',
  'Dynamic Programming',
  ARRAY['array', 'dynamic-programming', 'breadth-first-search'],
  E'You are given an integer array `coins` representing coins of different denominations and an integer `amount` representing a total amount of money.\n\nReturn the fewest number of coins that you need to make up that amount. If that amount of money cannot be made up by any combination of the coins, return `-1`.\n\nYou may assume that you have an infinite number of each kind of coin.',
  E'1 <= coins.length <= 12\n1 <= coins[i] <= 2^31 - 1\n0 <= amount <= 10^4',
  '[{"input":"coins = [1,2,5], amount = 11","output":"3","explanation":"11 = 5 + 5 + 1."},{"input":"coins = [2], amount = 3","output":"-1","explanation":"Cannot make 3 with only 2s."},{"input":"coins = [1], amount = 0","output":"0","explanation":"0 coins needed for amount 0."}]'::jsonb,
  '{"python3": "class Solution:\n    def coinChange(self, coins: list[int], amount: int) -> int:\n        pass", "javascript": "/**\n * @param {number[]} coins\n * @param {number} amount\n * @return {number}\n */\nclass Solution {\n    coinChange(coins, amount) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int coinChange(int[] coins, int amount) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int coinChange(vector<int>& coins, int amount) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.coinChange(input_data[\"coins\"], input_data[\"amount\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.coinChange(data.coins, data.amount)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] coins = new Gson().fromJson(obj.get(\"coins\"), int[].class);\n    System.out.println(new Solution().coinChange(coins, obj.get(\"amount\").getAsInt()));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto coins = input[\"coins\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << sol.coinChange(coins, input[\"amount\"].get<int>());\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"coins\":[1,2,5],\"amount\":11}","expected_output":"3","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"coins\":[2],\"amount\":3}","expected_output":"-1","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"coins\":[1],\"amount\":0}","expected_output":"0","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"coins\":[1],\"amount\":10000}","expected_output":"10000","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"coins\":[2,5,10,1],\"amount\":27}","expected_output":"4","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"coins\":[3,7,405,436],\"amount\":8839}","expected_output":"25","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"coins\":[1,2147483647],\"amount\":2}","expected_output":"2","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- 23. Longest Common Subsequence
(
  'longest-common-subsequence',
  'Longest Common Subsequence',
  'medium',
  'Dynamic Programming',
  ARRAY['string', 'dynamic-programming'],
  E'Given two strings `text1` and `text2`, return the length of their **longest common subsequence**. If there is no common subsequence, return `0`.\n\nA **subsequence** of a string is a new string generated from the original string with some characters (can be none) deleted without changing the relative order of the remaining characters.\n\nA **common subsequence** of two strings is a subsequence that is common to both strings.',
  E'1 <= text1.length, text2.length <= 1000\ntext1 and text2 consist of only lowercase English characters.',
  '[{"input":"text1 = \"abcde\", text2 = \"ace\"","output":"3","explanation":"The LCS is \"ace\", which has length 3."},{"input":"text1 = \"abc\", text2 = \"abc\"","output":"3","explanation":"LCS is \"abc\" itself."},{"input":"text1 = \"abc\", text2 = \"def\"","output":"0","explanation":"No common subsequence."}]'::jsonb,
  '{"python3": "class Solution:\n    def longestCommonSubsequence(self, text1: str, text2: str) -> int:\n        pass", "javascript": "/**\n * @param {string} text1\n * @param {string} text2\n * @return {number}\n */\nclass Solution {\n    longestCommonSubsequence(text1, text2) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int longestCommonSubsequence(String text1, String text2) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int longestCommonSubsequence(string text1, string text2) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.longestCommonSubsequence(input_data[\"text1\"], input_data[\"text2\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.longestCommonSubsequence(data.text1, data.text2)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Solution().longestCommonSubsequence(obj.get(\"text1\").getAsString(), obj.get(\"text2\").getAsString()));\n  }\n}", "cpp": "#include <iostream>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << sol.longestCommonSubsequence(input[\"text1\"].get<std::string>(), input[\"text2\"].get<std::string>());\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"text1\":\"abcde\",\"text2\":\"ace\"}","expected_output":"3","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"text1\":\"abc\",\"text2\":\"abc\"}","expected_output":"3","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"text1\":\"abc\",\"text2\":\"def\"}","expected_output":"0","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"text1\":\"a\",\"text2\":\"a\"}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"text1\":\"a\",\"text2\":\"b\"}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"text1\":\"bsbininm\",\"text2\":\"jmjkbkjkv\"}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"text1\":\"oxcpqrsvwf\",\"text2\":\"shmtulqrypy\"}","expected_output":"2","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"text1\":\"abcba\",\"text2\":\"abcbcba\"}","expected_output":"5","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- 24. Word Break
(
  'word-break',
  'Word Break',
  'medium',
  'Dynamic Programming',
  ARRAY['string', 'dynamic-programming', 'trie', 'memoization', 'hash-set'],
  E'Given a string `s` and a dictionary of strings `wordDict`, return `true` if `s` can be segmented into a space-separated sequence of one or more dictionary words.\n\nNote that the same word in the dictionary may be reused multiple times in the segmentation.',
  E'1 <= s.length <= 300\n1 <= wordDict.length <= 1000\n1 <= wordDict[i].length <= 20\ns and wordDict[i] consist of only lowercase English letters.\nAll the strings of wordDict are unique.',
  '[{"input":"s = \"leetcode\", wordDict = [\"leet\",\"code\"]","output":"true","explanation":"\"leetcode\" = \"leet\" + \"code\"."},{"input":"s = \"applepenapple\", wordDict = [\"apple\",\"pen\"]","output":"true","explanation":"\"apple\" + \"pen\" + \"apple\"."},{"input":"s = \"catsandog\", wordDict = [\"cats\",\"dog\",\"sand\",\"and\",\"cat\"]","output":"false","explanation":"Cannot segment."}]'::jsonb,
  '{"python3": "class Solution:\n    def wordBreak(self, s: str, wordDict: list[str]) -> bool:\n        pass", "javascript": "/**\n * @param {string} s\n * @param {string[]} wordDict\n * @return {boolean}\n */\nclass Solution {\n    wordBreak(s, wordDict) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public boolean wordBreak(String s, List<String> wordDict) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    bool wordBreak(string s, vector<string>& wordDict) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.wordBreak(input_data[\"s\"], input_data[\"wordDict\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.wordBreak(data.s, data.wordDict)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    String s = obj.get(\"s\").getAsString();\n    String[] wdArr = new Gson().fromJson(obj.get(\"wordDict\"), String[].class);\n    List<String> wordDict = Arrays.asList(wdArr);\n    System.out.println(new Solution().wordBreak(s, wordDict));\n  }\n}", "cpp": "#include <iostream>\n#include <string>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto wordDict = input[\"wordDict\"].get<std::vector<std::string>>();\n  Solution sol;\n  std::cout << json(sol.wordBreak(input[\"s\"].get<std::string>(), wordDict)).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"s\":\"leetcode\",\"wordDict\":[\"leet\",\"code\"]}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"s\":\"applepenapple\",\"wordDict\":[\"apple\",\"pen\"]}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"s\":\"catsandog\",\"wordDict\":[\"cats\",\"dog\",\"sand\",\"and\",\"cat\"]}","expected_output":"false","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"s\":\"a\",\"wordDict\":[\"a\"]}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"s\":\"bb\",\"wordDict\":[\"a\",\"b\",\"bbb\",\"bbbb\"]}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"s\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab\",\"wordDict\":[\"a\",\"aa\",\"aaa\",\"aaaa\"]}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"s\":\"goalspecial\",\"wordDict\":[\"go\",\"goal\",\"goals\",\"special\"]}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- 25. Partition Equal Subset Sum
(
  'partition-equal-subset-sum',
  'Partition Equal Subset Sum',
  'medium',
  'Dynamic Programming',
  ARRAY['array', 'dynamic-programming'],
  E'Given an integer array `nums`, return `true` if you can partition the array into two subsets such that the sum of the elements in both subsets is equal or `false` otherwise.',
  E'1 <= nums.length <= 200\n1 <= nums[i] <= 100',
  '[{"input":"nums = [1,5,11,5]","output":"true","explanation":"Subsets [1,5,5] and [11] both sum to 11."},{"input":"nums = [1,2,3,5]","output":"false","explanation":"Cannot split into equal-sum subsets."}]'::jsonb,
  '{"python3": "class Solution:\n    def canPartition(self, nums: list[int]) -> bool:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @return {boolean}\n */\nclass Solution {\n    canPartition(nums) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public boolean canPartition(int[] nums) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    bool canPartition(vector<int>& nums) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.canPartition(input_data[\"nums\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.canPartition(data.nums)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    System.out.println(new Solution().canPartition(nums));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << json(sol.canPartition(nums)).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[1,5,11,5]}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[1,2,3,5]}","expected_output":"false","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[1,1]}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[1,2]}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[3,3,3,4,5]}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100]}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums\":[1]}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- 26. Decode Ways
(
  'decode-ways',
  'Decode Ways',
  'medium',
  'Dynamic Programming',
  ARRAY['string', 'dynamic-programming'],
  E'A message containing letters from `A-Z` can be **encoded** into numbers using the following mapping:\n\n`"A" -> "1"`, `"B" -> "2"`, ..., `"Z" -> "26"`\n\nTo **decode** an encoded message, all the digits must be grouped then mapped back into letters using the reverse of the mapping above (there may be multiple ways). For example, `"11106"` can be mapped into `"AAJF"` with the grouping `(1 1 10 6)` or `"KJF"` with the grouping `(11 10 6)`.\n\nGiven a string `s` containing only digits, return the **number** of ways to **decode** it.',
  E'1 <= s.length <= 100\ns contains only digits and may contain leading zero(s).',
  '[{"input":"s = \"12\"","output":"2","explanation":"\"12\" can decode as \"AB\" (1 2) or \"L\" (12)."},{"input":"s = \"226\"","output":"3","explanation":"\"226\" -> \"BZ\" (2 26), \"VF\" (22 6), \"BBF\" (2 2 6)."},{"input":"s = \"06\"","output":"0","explanation":"06 cannot be decoded; leading zero not valid."}]'::jsonb,
  '{"python3": "class Solution:\n    def numDecodings(self, s: str) -> int:\n        pass", "javascript": "/**\n * @param {string} s\n * @return {number}\n */\nclass Solution {\n    numDecodings(s) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int numDecodings(String s) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int numDecodings(string s) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.numDecodings(input_data[\"s\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.numDecodings(data.s)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Solution().numDecodings(obj.get(\"s\").getAsString()));\n  }\n}", "cpp": "#include <iostream>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << sol.numDecodings(input[\"s\"].get<std::string>());\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"s\":\"12\"}","expected_output":"2","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"s\":\"226\"}","expected_output":"3","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"s\":\"06\"}","expected_output":"0","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"s\":\"1\"}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"s\":\"10\"}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"s\":\"110\"}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"s\":\"2611055971756562\"}","expected_output":"4","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"s\":\"111111111111111111111111111111111111111111111\"}","expected_output":"1836311903","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- ============================================================
-- SLIDING WINDOW (4)
-- ============================================================

-- 27. Longest Repeating Character Replacement
(
  'longest-repeating-char-replacement',
  'Longest Repeating Character Replacement',
  'medium',
  'Sliding Window',
  ARRAY['string', 'sliding-window', 'hash-map'],
  E'You are given a string `s` and an integer `k`. You can choose any character of the string and change it to any other uppercase English character. You can perform this operation at most `k` times.\n\nReturn the length of the longest substring containing the same letter you can get after performing the above operations.',
  E'1 <= s.length <= 10^5\ns consists of only uppercase English letters.\n0 <= k <= s.length',
  '[{"input":"s = \"ABAB\", k = 2","output":"4","explanation":"Replace both A''s or both B''s to get \"AAAA\" or \"BBBB\"."},{"input":"s = \"AABABBA\", k = 1","output":"4","explanation":"Replace the one ''B'' to get \"AABABBA\" → best window is 4."}]'::jsonb,
  '{"python3": "class Solution:\n    def characterReplacement(self, s: str, k: int) -> int:\n        pass", "javascript": "/**\n * @param {string} s\n * @param {number} k\n * @return {number}\n */\nclass Solution {\n    characterReplacement(s, k) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int characterReplacement(String s, int k) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int characterReplacement(string s, int k) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.characterReplacement(input_data[\"s\"], input_data[\"k\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.characterReplacement(data.s, data.k)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Solution().characterReplacement(obj.get(\"s\").getAsString(), obj.get(\"k\").getAsInt()));\n  }\n}", "cpp": "#include <iostream>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << sol.characterReplacement(input[\"s\"].get<std::string>(), input[\"k\"].get<int>());\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"s\":\"ABAB\",\"k\":2}","expected_output":"4","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"s\":\"AABABBA\",\"k\":1}","expected_output":"4","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"s\":\"A\",\"k\":0}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"s\":\"AAAA\",\"k\":2}","expected_output":"4","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"s\":\"ABCDE\",\"k\":1}","expected_output":"2","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"s\":\"BAAA\",\"k\":1}","expected_output":"4","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"s\":\"EOEMQLLQBHSS\",\"k\":3}","expected_output":"7","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- 28. Permutation in String
(
  'permutation-in-string',
  'Permutation in String',
  'medium',
  'Sliding Window',
  ARRAY['hash-map', 'sliding-window', 'string', 'two-pointer'],
  E'Given two strings `s1` and `s2`, return `true` if `s2` contains a **permutation** of `s1`, or `false` otherwise.\n\nIn other words, return `true` if one of `s1`''s permutations is the substring of `s2`.',
  E'1 <= s1.length, s2.length <= 10^4\ns1 and s2 consist of lowercase English letters.',
  '[{"input":"s1 = \"ab\", s2 = \"eidbaooo\"","output":"true","explanation":"s2 contains one permutation of s1: \"ba\"."},{"input":"s1 = \"ab\", s2 = \"eidboaoo\"","output":"false","explanation":"No permutation of s1 in s2."}]'::jsonb,
  '{"python3": "class Solution:\n    def checkInclusion(self, s1: str, s2: str) -> bool:\n        pass", "javascript": "/**\n * @param {string} s1\n * @param {string} s2\n * @return {boolean}\n */\nclass Solution {\n    checkInclusion(s1, s2) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public boolean checkInclusion(String s1, String s2) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    bool checkInclusion(string s1, string s2) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.checkInclusion(input_data[\"s1\"], input_data[\"s2\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.checkInclusion(data.s1, data.s2)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Solution().checkInclusion(obj.get(\"s1\").getAsString(), obj.get(\"s2\").getAsString()));\n  }\n}", "cpp": "#include <iostream>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << json(sol.checkInclusion(input[\"s1\"].get<std::string>(), input[\"s2\"].get<std::string>())).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"s1\":\"ab\",\"s2\":\"eidbaooo\"}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"s1\":\"ab\",\"s2\":\"eidboaoo\"}","expected_output":"false","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"s1\":\"a\",\"s2\":\"a\"}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"s1\":\"abc\",\"s2\":\"bbbca\"}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"s1\":\"adc\",\"s2\":\"dcda\"}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"s1\":\"hello\",\"s2\":\"ooolleoooleh\"}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"s1\":\"abcd\",\"s2\":\"dcbaabcd\"}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- 29. Minimum Size Subarray Sum
(
  'minimum-size-subarray-sum',
  'Minimum Size Subarray Sum',
  'medium',
  'Sliding Window',
  ARRAY['array', 'binary-search', 'sliding-window', 'two-pointer'],
  E'Given an array of positive integers `nums` and a positive integer `target`, return the **minimal length** of a **subarray** whose sum is greater than or equal to `target`. If there is no such subarray, return `0` instead.',
  E'1 <= target <= 10^9\n1 <= nums.length <= 10^5\n1 <= nums[i] <= 10^4',
  '[{"input":"target = 7, nums = [2,3,1,2,4,3]","output":"2","explanation":"Subarray [4,3] has min length 2 and sum >= 7."},{"input":"target = 4, nums = [1,4,4]","output":"1","explanation":"Subarray [4] satisfies."},{"input":"target = 11, nums = [1,1,1,1,1,1,1,1]","output":"0","explanation":"Sum of all = 8 < 11."}]'::jsonb,
  '{"python3": "class Solution:\n    def minSubArrayLen(self, target: int, nums: list[int]) -> int:\n        pass", "javascript": "/**\n * @param {number} target\n * @param {number[]} nums\n * @return {number}\n */\nclass Solution {\n    minSubArrayLen(target, nums) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int minSubArrayLen(int target, int[] nums) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int minSubArrayLen(int target, vector<int>& nums) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.minSubArrayLen(input_data[\"target\"], input_data[\"nums\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.minSubArrayLen(data.target, data.nums)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    System.out.println(new Solution().minSubArrayLen(obj.get(\"target\").getAsInt(), nums));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << sol.minSubArrayLen(input[\"target\"].get<int>(), nums);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"target\":7,\"nums\":[2,3,1,2,4,3]}","expected_output":"2","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"target\":4,\"nums\":[1,4,4]}","expected_output":"1","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"target\":11,\"nums\":[1,1,1,1,1,1,1,1]}","expected_output":"0","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"target\":100,\"nums\":[100]}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"target\":5,\"nums\":[1,1,1,1,5]}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"target\":213,\"nums\":[12,28,83,4,25,26,25,2,25,25,25,12]}","expected_output":"8","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"target\":15,\"nums\":[1,2,3,4,5]}","expected_output":"5","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- 30. Fruits Into Baskets
(
  'fruit-into-baskets',
  'Fruit Into Baskets',
  'medium',
  'Sliding Window',
  ARRAY['array', 'sliding-window', 'hash-map'],
  E'You are visiting a farm that has a single row of fruit trees arranged from left to right. The trees are represented by an integer array `fruits` where `fruits[i]` is the **type** of fruit the ith tree produces.\n\nYou want to collect as much fruit as possible. However, the owner has some strict rules that you must follow:\n\n- You only have **two baskets**, and each basket can only hold a **single type** of fruit.\n- Starting from any tree of your choice, you must pick **exactly one fruit** from every tree (including the start tree) while moving to the right.\n- Once you reach a tree with fruit that cannot fit in your baskets, you must stop.\n\nGiven the integer array `fruits`, return the **maximum** number of fruits you can pick.',
  E'1 <= fruits.length <= 10^5\n0 <= fruits[i] < fruits.length',
  '[{"input":"fruits = [1,2,1]","output":"3","explanation":"Pick all 3 fruits: types 1 and 2."},{"input":"fruits = [0,1,2,2]","output":"3","explanation":"Pick [1,2,2] — types 1 and 2."},{"input":"fruits = [1,2,3,2,2]","output":"4","explanation":"Pick [2,3,2,2] — types 2 and 3."}]'::jsonb,
  '{"python3": "class Solution:\n    def totalFruit(self, fruits: list[int]) -> int:\n        pass", "javascript": "/**\n * @param {number[]} fruits\n * @return {number}\n */\nclass Solution {\n    totalFruit(fruits) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int totalFruit(int[] fruits) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int totalFruit(vector<int>& fruits) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.totalFruit(input_data[\"fruits\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.totalFruit(data.fruits)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] fruits = new Gson().fromJson(obj.get(\"fruits\"), int[].class);\n    System.out.println(new Solution().totalFruit(fruits));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto fruits = input[\"fruits\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << sol.totalFruit(fruits);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"fruits\":[1,2,1]}","expected_output":"3","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"fruits\":[0,1,2,2]}","expected_output":"3","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"fruits\":[1,2,3,2,2]}","expected_output":"4","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"fruits\":[0]}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"fruits\":[1,1,1,1]}","expected_output":"4","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"fruits\":[3,3,3,1,2,1,1,2,3,3,4]}","expected_output":"5","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"fruits\":[1,0,1,4,1,4,1,2,3]}","expected_output":"5","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- ============================================================
-- HEAPS (4)
-- ============================================================

-- 31. Kth Largest Element in an Array
(
  'kth-largest-element',
  'Kth Largest Element in an Array',
  'medium',
  'Heaps',
  ARRAY['array', 'divide-and-conquer', 'sorting', 'heap', 'quickselect'],
  E'Given an integer array `nums` and an integer `k`, return the `k`th largest element in the array.\n\nNote that it is the `k`th largest element in the sorted order, not the `k`th distinct element.\n\nCan you solve it without sorting?',
  E'1 <= k <= nums.length <= 10^5\n-10^4 <= nums[i] <= 10^4',
  '[{"input":"nums = [3,2,1,5,6,4], k = 2","output":"5","explanation":"Sorted: [6,5,4,3,2,1]. 2nd largest = 5."},{"input":"nums = [3,2,3,1,2,4,5,5,6], k = 4","output":"4","explanation":"Sorted: [6,5,5,4,3,3,2,2,1]. 4th largest = 4."}]'::jsonb,
  '{"python3": "class Solution:\n    def findKthLargest(self, nums: list[int], k: int) -> int:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @param {number} k\n * @return {number}\n */\nclass Solution {\n    findKthLargest(nums, k) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int findKthLargest(int[] nums, int k) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int findKthLargest(vector<int>& nums, int k) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.findKthLargest(input_data[\"nums\"], input_data[\"k\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.findKthLargest(data.nums, data.k)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    System.out.println(new Solution().findKthLargest(nums, obj.get(\"k\").getAsInt()));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << sol.findKthLargest(nums, input[\"k\"].get<int>());\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[3,2,1,5,6,4],\"k\":2}","expected_output":"5","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[3,2,3,1,2,4,5,5,6],\"k\":4}","expected_output":"4","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[1],\"k\":1}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[7,6,5,4,3,2,1],\"k\":5}","expected_output":"3","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[-10000,10000,5000,-5000,0],\"k\":3}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[99,99,99,99,99],\"k\":1}","expected_output":"99","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums\":[2,1],\"k\":1}","expected_output":"2","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- 32. Top K Frequent Elements
(
  'top-k-frequent-elements',
  'Top K Frequent Elements',
  'medium',
  'Heaps',
  ARRAY['array', 'hash-map', 'divide-and-conquer', 'sorting', 'heap', 'bucket-sort'],
  E'Given an integer array `nums` and an integer `k`, return the `k` most frequent elements. You may return the answer in **any order**.\n\nYour algorithm''s time complexity must be better than O(n log n), where n is the array''s size.',
  E'1 <= nums.length <= 10^5\n-10^4 <= nums[i] <= 10^4\nk is in the range [1, the number of unique elements in the array].\nIt is guaranteed that the answer is unique.',
  '[{"input":"nums = [1,1,1,2,2,3], k = 2","output":"[1,2]","explanation":"1 appears 3 times, 2 appears 2 times."},{"input":"nums = [1], k = 1","output":"[1]","explanation":"Only one element."}]'::jsonb,
  '{"python3": "class Solution:\n    def topKFrequent(self, nums: list[int], k: int) -> list[int]:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @param {number} k\n * @return {number[]}\n */\nclass Solution {\n    topKFrequent(nums, k) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int[] topKFrequent(int[] nums, int k) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<int> topKFrequent(vector<int>& nums, int k) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sorted(sol.topKFrequent(input_data[\"nums\"], input_data[\"k\"]))\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.topKFrequent(data.nums, data.k).sort((a,b)=>a-b)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    int[] result = new Solution().topKFrequent(nums, obj.get(\"k\").getAsInt());\n    Arrays.sort(result);\n    System.out.println(Arrays.toString(result));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <algorithm>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  Solution sol;\n  auto result = sol.topKFrequent(nums, input[\"k\"].get<int>());\n  std::sort(result.begin(), result.end());\n  std::cout << json(result).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[1,1,1,2,2,3],\"k\":2}","expected_output":"[1,2]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[1],\"k\":1}","expected_output":"[1]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[1,1],\"k\":1}","expected_output":"[1]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[4,1,2,2,3,3,3],\"k\":2}","expected_output":"[2,3]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[-1,-1,1,2,2],\"k\":2}","expected_output":"[-1,2]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[5,5,4,4,3,3,2,2,1,1],\"k\":3}","expected_output":"[3,4,5]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- 33. Sort Characters By Frequency
(
  'sort-characters-by-frequency',
  'Sort Characters By Frequency',
  'medium',
  'Heaps',
  ARRAY['string', 'hash-map', 'sorting', 'heap', 'bucket-sort'],
  E'Given a string `s`, sort it in **decreasing order** based on the **frequency** of the characters. The **frequency** of a character is the number of times it appears in the string.\n\nReturn the sorted string. If there are multiple answers, return **any of them**.',
  E'1 <= s.length <= 5 * 10^5\ns consists of uppercase and lowercase English letters and digits.',
  '[{"input":"s = \"tree\"","output":"\"eert\"","explanation":"e appears twice, r and t appear once. Sort by freq desc."},{"input":"s = \"cccaaa\"","output":"\"aaaccc\"","explanation":"Both c and a appear 3 times. Either order is valid."},{"input":"s = \"Aabb\"","output":"\"bbAa\"","explanation":"b appears twice, A and a once each."}]'::jsonb,
  '{"python3": "class Solution:\n    def frequencySort(self, s: str) -> str:\n        pass", "javascript": "/**\n * @param {string} s\n * @return {string}\n */\nclass Solution {\n    frequencySort(s) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public String frequencySort(String s) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    string frequencySort(string s) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\nfrom collections import Counter\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.frequencySort(input_data[\"s\"])\n# validate: sorted by freq descending (allow any tie-breaking)\ncounts = Counter(result)\nfreqs = [counts[c] for c in result]\nvalid = all(freqs[i] >= freqs[i+1] for i in range(len(freqs)-1))\nif valid and Counter(result) == Counter(input_data[\"s\"]):\n    print(json.dumps(result))\nelse:\n    print(json.dumps(\"\"))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  const result = sol.frequencySort(data.s);\n  // Normalize: sort groups by char for deterministic output\n  const freq = {};\n  for (const c of result) freq[c] = (freq[c]||0)+1;\n  const sorted = Object.entries(freq).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([c,f])=>c.repeat(f)).join(\"\");\n  console.log(JSON.stringify(sorted));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    String result = new Solution().frequencySort(obj.get(\"s\").getAsString());\n    Map<Character,Integer> freq = new HashMap<>();\n    for (char c : result.toCharArray()) freq.merge(c,1,Integer::sum);\n    List<Map.Entry<Character,Integer>> entries = new ArrayList<>(freq.entrySet());\n    entries.sort((a,b)->b.getValue()!=a.getValue()?b.getValue()-a.getValue():a.getKey()-b.getKey());\n    StringBuilder sb = new StringBuilder();\n    for (Map.Entry<Character,Integer> e : entries) for (int i=0;i<e.getValue();i++) sb.append(e.getKey());\n    System.out.println(new Gson().toJson(sb.toString()));\n  }\n}", "cpp": "#include <iostream>\n#include <string>\n#include <map>\n#include <algorithm>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::string result = sol.frequencySort(input[\"s\"].get<std::string>());\n  std::map<char,int> freq;\n  for (char c : result) freq[c]++;\n  std::vector<std::pair<int,char>> v;\n  for (auto& p : freq) v.push_back({p.second, p.first});\n  std::sort(v.begin(),v.end(),[](auto& a,auto& b){return a.first!=b.first?a.first>b.first:a.second<b.second;});\n  std::string norm;\n  for (auto& p : v) norm += std::string(p.first, p.second);\n  std::cout << json(norm).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"s\":\"tree\"}","expected_output":"\"eert\"","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"s\":\"cccaaa\"}","expected_output":"\"aaaccc\"","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"s\":\"Aabb\"}","expected_output":"\"bbAa\"","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"s\":\"z\"}","expected_output":"\"z\"","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"s\":\"2a554442f544asfasssffffasss\"}","expected_output":"\"sssssssffffff444444a2\"","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- 34. Merge Intervals
(
  'merge-intervals',
  'Merge Intervals',
  'medium',
  'Heaps',
  ARRAY['array', 'sorting'],
  E'Given an array of `intervals` where `intervals[i] = [starti, endi]`, merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.',
  E'1 <= intervals.length <= 10^4\nintervals[i].length == 2\n0 <= starti <= endi <= 10^4',
  '[{"input":"intervals = [[1,3],[2,6],[8,10],[15,18]]","output":"[[1,6],[8,10],[15,18]]","explanation":"[1,3] and [2,6] overlap → [1,6]."},{"input":"intervals = [[1,4],[4,5]]","output":"[[1,5]]","explanation":"[1,4] and [4,5] are adjacent and merge."}]'::jsonb,
  '{"python3": "class Solution:\n    def merge(self, intervals: list[list[int]]) -> list[list[int]]:\n        pass", "javascript": "/**\n * @param {number[][]} intervals\n * @return {number[][]}\n */\nclass Solution {\n    merge(intervals) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int[][] merge(int[][] intervals) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<vector<int>> merge(vector<vector<int>>& intervals) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.merge(input_data[\"intervals\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.merge(data.intervals)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[][] intervals = new Gson().fromJson(obj.get(\"intervals\"), int[][].class);\n    System.out.println(new Gson().toJson(new Solution().merge(intervals)));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  std::vector<std::vector<int>> intervals;\n  for (auto& i : input[\"intervals\"]) intervals.push_back(i.get<std::vector<int>>());\n  Solution sol;\n  std::cout << json(sol.merge(intervals)).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"intervals\":[[1,3],[2,6],[8,10],[15,18]]}","expected_output":"[[1,6],[8,10],[15,18]]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"intervals\":[[1,4],[4,5]]}","expected_output":"[[1,5]]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"intervals\":[[1,4]]}","expected_output":"[[1,4]]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"intervals\":[[1,4],[0,4]]}","expected_output":"[[0,4]]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"intervals\":[[1,4],[0,1]]}","expected_output":"[[0,4]]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"intervals\":[[1,4],[2,3]]}","expected_output":"[[1,4]]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"intervals\":[[1,2],[3,4],[5,6],[7,8]]}","expected_output":"[[1,2],[3,4],[5,6],[7,8]]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"intervals\":[[0,0],[0,0],[0,0]]}","expected_output":"[[0,0]]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- ============================================================
-- STACKS MEDIUM (5)
-- ============================================================

-- 35. Daily Temperatures
(
  'daily-temperatures',
  'Daily Temperatures',
  'medium',
  'Stacks',
  ARRAY['array', 'stack', 'monotonic-stack'],
  E'Given an array of integers `temperatures` represents the daily temperatures, return an array `answer` such that `answer[i]` is the number of days you have to wait after the ith day to get a warmer temperature. If there is no future day for which this is possible, keep `answer[i] == 0` instead.',
  E'1 <= temperatures.length <= 10^5\n30 <= temperatures[i] <= 100',
  '[{"input":"temperatures = [73,74,75,71,69,72,76,73]","output":"[1,1,4,2,1,1,0,0]","explanation":"After day 0 (73), wait 1 day for 74. etc."},{"input":"temperatures = [30,40,50,60]","output":"[1,1,1,0]","explanation":"Always next day is warmer."},{"input":"temperatures = [30,60,90]","output":"[1,1,0]","explanation":"Each day followed by a warmer one."}]'::jsonb,
  '{"python3": "class Solution:\n    def dailyTemperatures(self, temperatures: list[int]) -> list[int]:\n        pass", "javascript": "/**\n * @param {number[]} temperatures\n * @return {number[]}\n */\nclass Solution {\n    dailyTemperatures(temperatures) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int[] dailyTemperatures(int[] temperatures) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<int> dailyTemperatures(vector<int>& temperatures) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.dailyTemperatures(input_data[\"temperatures\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.dailyTemperatures(data.temperatures)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] temps = new Gson().fromJson(obj.get(\"temperatures\"), int[].class);\n    System.out.println(Arrays.toString(new Solution().dailyTemperatures(temps)));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto temps = input[\"temperatures\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << json(sol.dailyTemperatures(temps)).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"temperatures\":[73,74,75,71,69,72,76,73]}","expected_output":"[1,1,4,2,1,1,0,0]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"temperatures\":[30,40,50,60]}","expected_output":"[1,1,1,0]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"temperatures\":[30,60,90]}","expected_output":"[1,1,0]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"temperatures\":[89,62,70,58,47,47,46,76,100,70]}","expected_output":"[8,1,5,4,3,2,1,1,0,0]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"temperatures\":[100,100,100]}","expected_output":"[0,0,0]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"temperatures\":[30]}","expected_output":"[0]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"temperatures\":[70,70,70,80]}","expected_output":"[3,2,1,0]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- 36. Asteroid Collision
(
  'asteroid-collision',
  'Asteroid Collision',
  'medium',
  'Stacks',
  ARRAY['array', 'stack'],
  E'We are given an array `asteroids` of integers representing asteroids in a row.\n\nFor each asteroid, the absolute value represents its size, and the sign represents its direction (positive meaning right, negative meaning left). Each asteroid moves at the same speed.\n\nFind out the state of the asteroids after all collisions. If two asteroids meet, the smaller one will explode. If both are the same size, both will explode. Two asteroids moving in the same direction will never meet.',
  E'2 <= asteroids.length <= 10^4\n-1000 <= asteroids[i] <= 1000\nasteroids[i] != 0',
  '[{"input":"asteroids = [5,10,-5]","output":"[5,10]","explanation":"-5 and 10 collide: 10 wins."},{"input":"asteroids = [8,-8]","output":"[]","explanation":"8 and -8 are same size, both explode."},{"input":"asteroids = [10,2,-5]","output":"[10]","explanation":"2 and -5 collide (-5 wins), then 10 and -5 (10 wins)."}]'::jsonb,
  '{"python3": "class Solution:\n    def asteroidCollision(self, asteroids: list[int]) -> list[int]:\n        pass", "javascript": "/**\n * @param {number[]} asteroids\n * @return {number[]}\n */\nclass Solution {\n    asteroidCollision(asteroids) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int[] asteroidCollision(int[] asteroids) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<int> asteroidCollision(vector<int>& asteroids) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.asteroidCollision(input_data[\"asteroids\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.asteroidCollision(data.asteroids)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] asteroids = new Gson().fromJson(obj.get(\"asteroids\"), int[].class);\n    System.out.println(Arrays.toString(new Solution().asteroidCollision(asteroids)));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto asteroids = input[\"asteroids\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << json(sol.asteroidCollision(asteroids)).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"asteroids\":[5,10,-5]}","expected_output":"[5,10]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"asteroids\":[8,-8]}","expected_output":"[]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"asteroids\":[10,2,-5]}","expected_output":"[10]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"asteroids\":[-2,-1,1,2]}","expected_output":"[-2,-1,1,2]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"asteroids\":[1,-1,-1,-1]}","expected_output":"[-1,-1]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"asteroids\":[1,2,-1,-2]}","expected_output":"[]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"asteroids\":[5,-5,1,-1]}","expected_output":"[]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"asteroids\":[-1000,1000]}","expected_output":"[-1000,1000]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- 37. Evaluate Reverse Polish Notation
(
  'evaluate-reverse-polish-notation',
  'Evaluate Reverse Polish Notation',
  'medium',
  'Stacks',
  ARRAY['array', 'math', 'stack'],
  E'You are given an array of strings `tokens` that represents an arithmetic expression in a **Reverse Polish Notation**.\n\nEvaluate the expression. Return an integer that represents the value of the expression.\n\nNote that:\n- The valid operators are `''+''`, `''-''`, `''*''`, and `''/''`.\n- Each operand may be an integer or another expression.\n- The division between two integers always **truncates toward zero**.\n- There will not be any division by zero.\n- The input represents a valid arithmetic expression in a reverse polish notation.\n- The answer and all the intermediate calculations can be represented in a **32-bit** integer.',
  E'1 <= tokens.length <= 10^4\ntokens[i] is either an operator ("+", "-", "*", or "/"), or an integer in the range [-200, 200].',
  '[{"input":"tokens = [\"2\",\"1\",\"+\",\"3\",\"*\"]","output":"9","explanation":"(2+1)*3 = 9."},{"input":"tokens = [\"4\",\"13\",\"5\",\"/\",\"+\"]","output":"6","explanation":"4+(13/5) = 4+2 = 6."},{"input":"tokens = [\"10\",\"6\",\"9\",\"3\",\"+\",\"-11\",\"*\",\"/\",\"*\",\"17\",\"+\",\"5\",\"+\"]","output":"22","explanation":"Complex expression."}]'::jsonb,
  '{"python3": "class Solution:\n    def evalRPN(self, tokens: list[str]) -> int:\n        pass", "javascript": "/**\n * @param {string[]} tokens\n * @return {number}\n */\nclass Solution {\n    evalRPN(tokens) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int evalRPN(String[] tokens) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int evalRPN(vector<string>& tokens) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.evalRPN(input_data[\"tokens\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.evalRPN(data.tokens)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    String[] tokens = new Gson().fromJson(obj.get(\"tokens\"), String[].class);\n    System.out.println(new Solution().evalRPN(tokens));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto tokens = input[\"tokens\"].get<std::vector<std::string>>();\n  Solution sol;\n  std::cout << sol.evalRPN(tokens);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"tokens\":[\"2\",\"1\",\"+\",\"3\",\"*\"]}","expected_output":"9","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"tokens\":[\"4\",\"13\",\"5\",\"/\",\"+\"]}","expected_output":"6","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"tokens\":[\"10\",\"6\",\"9\",\"3\",\"+\",\"-11\",\"*\",\"/\",\"*\",\"17\",\"+\",\"5\",\"+\"]}","expected_output":"22","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"tokens\":[\"3\"]}","expected_output":"3","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"tokens\":[\"5\",\"3\",\"-\"]}","expected_output":"2","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"tokens\":[\"2\",\"3\",\"*\",\"4\",\"+\"]}","expected_output":"10","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"tokens\":[\"-3\",\"4\",\"*\",\"5\",\"/\"]}","expected_output":"-2","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- 38. Decode String
(
  'decode-string',
  'Decode String',
  'medium',
  'Stacks',
  ARRAY['string', 'stack', 'recursion'],
  E'Given an encoded string, return its decoded string.\n\nThe encoding rule is: `k[encoded_string]`, where the `encoded_string` inside the square brackets is being repeated exactly `k` times. Note that `k` is guaranteed to be a positive integer.\n\nYou may assume that the input string is always valid; there are no extra white spaces, square brackets are well-formed, etc. Furthermore, you may assume that the original data does not contain any digits and that all the digits in the input only appear as the repeat count `k`.',
  E'1 <= s.length <= 30\ns consists of lowercase English letters, digits, and square brackets ''[]''.\ns is guaranteed to be a valid input.\nAll the integers in s are in the range [1, 300].',
  '[{"input":"s = \"3[a]2[bc]\"","output":"\"aaabcbc\"","explanation":"aaa + bcbc."},{"input":"s = \"3[a2[c]]\"","output":"\"accaccacc\"","explanation":"Nested: a + cc repeated 3 times."},{"input":"s = \"2[abc]3[cd]ef\"","output":"\"abcabccdcdcdef\"","explanation":"Multiple groups."}]'::jsonb,
  '{"python3": "class Solution:\n    def decodeString(self, s: str) -> str:\n        pass", "javascript": "/**\n * @param {string} s\n * @return {string}\n */\nclass Solution {\n    decodeString(s) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public String decodeString(String s) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    string decodeString(string s) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.decodeString(input_data[\"s\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.decodeString(data.s)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Gson().toJson(new Solution().decodeString(obj.get(\"s\").getAsString())));\n  }\n}", "cpp": "#include <iostream>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << json(sol.decodeString(input[\"s\"].get<std::string>())).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"s\":\"3[a]2[bc]\"}","expected_output":"\"aaabcbc\"","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"s\":\"3[a2[c]]\"}","expected_output":"\"accaccacc\"","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"s\":\"2[abc]3[cd]ef\"}","expected_output":"\"abcabccdcdcdef\"","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"s\":\"abc\"}","expected_output":"\"abc\"","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"s\":\"1[a]\"}","expected_output":"\"a\"","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"s\":\"10[a]\"}","expected_output":"\"aaaaaaaaaa\"","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"s\":\"2[2[2[a]]]\"}","expected_output":"\"aaaaaaaa\"","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"s\":\"3[z]2[2[y]pq4[2[jk]e1[f]]]ef\"}","expected_output":"\"zzzyypqjkjkeffjkjkeffjkjkeffjkjkeffyypqjkjkeffjkjkeffjkjkeffjkjkeffef\"","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- 39. Insert Interval
(
  'insert-interval',
  'Insert Interval',
  'medium',
  'Stacks',
  ARRAY['array'],
  E'You are given an array of non-overlapping intervals `intervals` where `intervals[i] = [starti, endi]` represent the start and the end of the ith interval and `intervals` is sorted in ascending order by `starti`. You are also given an interval `newInterval = [start, end]` that represents the start and end of another interval.\n\nInsert `newInterval` into `intervals` such that `intervals` is still sorted in ascending order by `starti` and `intervals` still does not have any overlapping intervals (merge if necessary).\n\nReturn `intervals` after the insertion.',
  E'0 <= intervals.length <= 10^4\nintervals[i].length == 2\n0 <= starti <= endi <= 10^5\nintervals is sorted by starti in ascending order.\nnewInterval.length == 2\n0 <= start <= end <= 10^5',
  '[{"input":"intervals = [[1,3],[6,9]], newInterval = [2,5]","output":"[[1,5],[6,9]]","explanation":"[2,5] merges with [1,3]."},{"input":"intervals = [[1,2],[3,5],[6,7],[8,10],[12,16]], newInterval = [4,8]","output":"[[1,2],[3,10],[12,16]]","explanation":"[4,8] overlaps [3,5],[6,7],[8,10]."}]'::jsonb,
  '{"python3": "class Solution:\n    def insert(self, intervals: list[list[int]], newInterval: list[int]) -> list[list[int]]:\n        pass", "javascript": "/**\n * @param {number[][]} intervals\n * @param {number[]} newInterval\n * @return {number[][]}\n */\nclass Solution {\n    insert(intervals, newInterval) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int[][] insert(int[][] intervals, int[] newInterval) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<vector<int>> insert(vector<vector<int>>& intervals, vector<int>& newInterval) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.insert(input_data[\"intervals\"], input_data[\"newInterval\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.insert(data.intervals, data.newInterval)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[][] intervals = new Gson().fromJson(obj.get(\"intervals\"), int[][].class);\n    int[] ni = new Gson().fromJson(obj.get(\"newInterval\"), int[].class);\n    System.out.println(new Gson().toJson(new Solution().insert(intervals, ni)));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  std::vector<std::vector<int>> intervals;\n  for (auto& i : input[\"intervals\"]) intervals.push_back(i.get<std::vector<int>>());\n  auto ni = input[\"newInterval\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << json(sol.insert(intervals, ni)).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"intervals\":[[1,3],[6,9]],\"newInterval\":[2,5]}","expected_output":"[[1,5],[6,9]]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"intervals\":[[1,2],[3,5],[6,7],[8,10],[12,16]],\"newInterval\":[4,8]}","expected_output":"[[1,2],[3,10],[12,16]]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"intervals\":[],\"newInterval\":[5,7]}","expected_output":"[[5,7]]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"intervals\":[[1,5]],\"newInterval\":[2,3]}","expected_output":"[[1,5]]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"intervals\":[[1,5]],\"newInterval\":[6,8]}","expected_output":"[[1,5],[6,8]]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"intervals\":[[1,5]],\"newInterval\":[0,0]}","expected_output":"[[0,0],[1,5]]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"intervals\":[[1,3],[4,6]],\"newInterval\":[2,5]}","expected_output":"[[1,6]]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

-- 40. Non-overlapping Intervals
(
  'non-overlapping-intervals',
  'Non-overlapping Intervals',
  'medium',
  'Greedy',
  ARRAY['array', 'dynamic-programming', 'greedy', 'sorting'],
  E'Given an array of intervals `intervals` where `intervals[i] = [starti, endi]`, return the **minimum number of intervals you need to remove** to make the rest of the intervals non-overlapping.',
  E'1 <= intervals.length <= 10^5\nintervals[i].length == 2\n-5 * 10^4 <= starti < endi <= 5 * 10^4',
  '[{"input":"intervals = [[1,2],[2,3],[3,4],[1,3]]","output":"1","explanation":"Remove [1,3] to have [[1,2],[2,3],[3,4]]."},{"input":"intervals = [[1,2],[1,2],[1,2]]","output":"2","explanation":"Remove 2 of the 3 overlapping intervals."},{"input":"intervals = [[1,2],[2,3]]","output":"0","explanation":"Already non-overlapping (touching at 2)."}]'::jsonb,
  '{"python3": "class Solution:\n    def eraseOverlapIntervals(self, intervals: list[list[int]]) -> int:\n        pass", "javascript": "/**\n * @param {number[][]} intervals\n * @return {number}\n */\nclass Solution {\n    eraseOverlapIntervals(intervals) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int eraseOverlapIntervals(int[][] intervals) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int eraseOverlapIntervals(vector<vector<int>>& intervals) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.eraseOverlapIntervals(input_data[\"intervals\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.eraseOverlapIntervals(data.intervals)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[][] intervals = new Gson().fromJson(obj.get(\"intervals\"), int[][].class);\n    System.out.println(new Solution().eraseOverlapIntervals(intervals));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  std::vector<std::vector<int>> intervals;\n  for (auto& i : input[\"intervals\"]) intervals.push_back(i.get<std::vector<int>>());\n  Solution sol;\n  std::cout << sol.eraseOverlapIntervals(intervals);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"intervals\":[[1,2],[2,3],[3,4],[1,3]]}","expected_output":"1","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"intervals\":[[1,2],[1,2],[1,2]]}","expected_output":"2","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"intervals\":[[1,2],[2,3]]}","expected_output":"0","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"intervals\":[[1,100],[11,22],[1,11],[2,12]]}","expected_output":"2","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"intervals\":[[0,2],[1,3],[2,4],[3,5],[4,6]]}","expected_output":"2","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"intervals\":[[-50000,-1],[0,50000]]}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"intervals\":[[1,2]]}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
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
