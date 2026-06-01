-- DSA Problem Bank - Additional MEDIUM Problems (10 new)
-- Run AFTER dsa_problems.sql

INSERT INTO public.dsa_problems (slug, title, difficulty, category, tags, description, constraints, examples, starter_code, solution_wrappers, test_cases, points, time_limit_seconds, memory_limit_kb)
VALUES

-- ============================================================
-- MEDIUM PROBLEMS (10 new)
-- ============================================================

(
  'three-sum',
  '3Sum',
  'medium',
  'Arrays',
  ARRAY['arrays', 'two-pointer', 'sorting'],
  E'Given an integer array `nums`, return all the triplets `[nums[i], nums[j], nums[k]]` such that `i != j`, `i != k`, and `j != k`, and `nums[i] + nums[j] + nums[k] == 0`.\n\nNotice that the solution set must not contain duplicate triplets. Return the triplets sorted.',
  E'3 <= nums.length <= 3000\n-10^5 <= nums[i] <= 10^5',
  '[{"input":"nums = [-1,0,1,2,-1,-4]","output":"[[-1,-1,2],[-1,0,1]]"},{"input":"nums = [0,1,1]","output":"[]"},{"input":"nums = [0,0,0]","output":"[[0,0,0]]"}]'::jsonb,
  '{"python3": "class Solution:\n    def threeSum(self, nums: list[int]) -> list[list[int]]:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @return {number[][]}\n */\nclass Solution {\n    threeSum(nums) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public List<List<Integer>> threeSum(int[] nums) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<vector<int>> threeSum(vector<int>& nums) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.threeSum(input_data[\"nums\"])\nresult.sort()\nprint(json.dumps(result))", "javascript": "class Solution {\n    medium() {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    List<List<Integer>> result = new Solution().threeSum(nums);\n    result.sort(Comparator.comparing(Object::toString));\n    System.out.println(new Gson().toJson(result));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <algorithm>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  Solution sol;\n  auto result = sol.threeSum(nums);\n  std::sort(result.begin(), result.end());\n  std::cout << json(result).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[-1,0,1,2,-1,-4]}","expected_output":"[[-1,-1,2],[-1,0,1]]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[0,1,1]}","expected_output":"[]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[0,0,0]}","expected_output":"[[0,0,0]]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[-2,0,1,1,2]}","expected_output":"[[-2,0,2],[-2,1,1]]","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[0,0,0,0]}","expected_output":"[[0,0,0]]","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[-1,-1,-1,2]}","expected_output":"[[-1,-1,2]]","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums\":[1,2,-2,-1]}","expected_output":"[]","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

(
  'group-anagrams',
  'Group Anagrams',
  'medium',
  'Strings',
  ARRAY['hash-map', 'string', 'sorting'],
  E'Given an array of strings `strs`, group the **anagrams** together. You can return the answer in any order.\n\nAn anagram is a word or phrase formed by rearranging the letters of a different word or phrase, using all the original letters exactly once.',
  E'1 <= strs.length <= 10^4\n0 <= strs[i].length <= 100\nstrs[i] consists of lowercase English letters.',
  '[{"input":"strs = [\"eat\",\"tea\",\"tan\",\"ate\",\"nat\",\"bat\"]","output":"[[\"bat\"],[\"eat\",\"tea\",\"ate\"],[\"tan\",\"nat\"]]","explanation":"Anagrams are grouped together."},{"input":"strs = [\"\"]","output":"[[\"\"]]"},{"input":"strs = [\"a\"]","output":"[[\"a\"]]"}]'::jsonb,
  '{"python3": "class Solution:\n    def groupAnagrams(self, strs: list[str]) -> list[list[str]]:\n        pass", "javascript": "/**\n * @param {string[]} strs\n * @return {string[][]}\n */\nclass Solution {\n    groupAnagrams(strs) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public List<List<String>> groupAnagrams(String[] strs) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<vector<string>> groupAnagrams(vector<string>& strs) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.groupAnagrams(input_data[\"strs\"])\nresult = [sorted(g) for g in result]\nresult.sort(key=lambda x: x[0] if x else \"\")\nprint(json.dumps(result))", "javascript": "class Solution {\n    medium() {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    String[] strs = new Gson().fromJson(obj.get(\"strs\"), String[].class);\n    List<List<String>> result = new Solution().groupAnagrams(strs);\n    result.forEach(Collections::sort);\n    result.sort(Comparator.comparing(a -> a.isEmpty() ? \"\" : a.get(0)));\n    System.out.println(new Gson().toJson(result));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <string>\n#include <algorithm>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto strs = input[\"strs\"].get<std::vector<std::string>>();\n  Solution sol;\n  auto result = sol.groupAnagrams(strs);\n  for (auto& g : result) std::sort(g.begin(), g.end());\n  std::sort(result.begin(), result.end());\n  std::cout << json(result).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"strs\":[\"eat\",\"tea\",\"tan\",\"ate\",\"nat\",\"bat\"]}","expected_output":"[[\"bat\"],[\"ate\",\"eat\",\"tea\"],[\"nat\",\"tan\"]]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"strs\":[\"\"]}","expected_output":"[[\"\"]]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"strs\":[\"a\"]}","expected_output":"[[\"a\"]]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"strs\":[\"abc\",\"bca\",\"cab\",\"xyz\",\"zyx\"]}","expected_output":"[[\"abc\",\"bca\",\"cab\"],[\"xyz\",\"zyx\"]]","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"strs\":[\"a\",\"b\",\"c\"]}","expected_output":"[[\"a\"],[\"b\"],[\"c\"]]","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"strs\":[\"\",\"\"]}","expected_output":"[[\"\",\"\"]]","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

(
  'product-of-array-except-self',
  'Product of Array Except Self',
  'medium',
  'Arrays',
  ARRAY['arrays', 'prefix-sum'],
  E'Given an integer array `nums`, return an array `answer` such that `answer[i]` is equal to the product of all the elements of `nums` except `nums[i]`.\n\nThe product of any prefix or suffix of `nums` is **guaranteed** to fit in a **32-bit** integer.\n\nYou must write an algorithm that runs in `O(n)` time and without using the division operation.',
  E'2 <= nums.length <= 10^5\n-30 <= nums[i] <= 30\nThe product of any prefix or suffix of nums fits in a 32-bit integer.',
  '[{"input":"nums = [1,2,3,4]","output":"[24,12,8,6]"},{"input":"nums = [-1,1,0,-3,3]","output":"[0,0,9,0,0]"}]'::jsonb,
  '{"python3": "class Solution:\n    def productExceptSelf(self, nums: list[int]) -> list[int]:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @return {number[]}\n */\nclass Solution {\n    productExceptSelf(nums) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int[] productExceptSelf(int[] nums) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<int> productExceptSelf(vector<int>& nums) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.productExceptSelf(input_data[\"nums\"])\nprint(json.dumps(result))", "javascript": "class Solution {\n    medium() {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    System.out.println(Arrays.toString(new Solution().productExceptSelf(nums)));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  Solution sol;\n  auto result = sol.productExceptSelf(nums);\n  std::cout << json(result).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[1,2,3,4]}","expected_output":"[24,12,8,6]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[-1,1,0,-3,3]}","expected_output":"[0,0,9,0,0]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[2,3]}","expected_output":"[3,2]","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[0,0]}","expected_output":"[0,0]","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[1,1,1,1,1]}","expected_output":"[1,1,1,1,1]","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[5,-2,3,1]}","expected_output":"[-6,15,-10,-30]","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

(
  'search-in-rotated-sorted-array',
  'Search in Rotated Sorted Array',
  'medium',
  'Binary Search',
  ARRAY['binary-search', 'arrays'],
  E'There is an integer array `nums` sorted in ascending order (with **distinct** values).\n\nPrior to being passed to your function, `nums` is **possibly rotated** at an unknown pivot index `k` (1 <= k < nums.length) such that the resulting array is `[nums[k], nums[k+1], ..., nums[n-1], nums[0], nums[1], ..., nums[k-1]]`.\n\nGiven the array `nums` after the possible rotation and an integer `target`, return the index of `target` if it is in `nums`, or `-1` if it is not in `nums`.\n\nYou must write an algorithm with `O(log n)` runtime complexity.',
  E'1 <= nums.length <= 5000\n-10^4 <= nums[i] <= 10^4\nAll values of nums are unique.\nnums is an ascending array that is possibly rotated.\n-10^4 <= target <= 10^4',
  '[{"input":"nums = [4,5,6,7,0,1,2], target = 0","output":"4"},{"input":"nums = [4,5,6,7,0,1,2], target = 3","output":"-1"},{"input":"nums = [1], target = 0","output":"-1"}]'::jsonb,
  '{"python3": "class Solution:\n    def search(self, nums: list[int], target: int) -> int:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @param {number} target\n * @return {number}\n */\nclass Solution {\n    search(nums, target) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int search(int[] nums, int target) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int search(vector<int>& nums, int target) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.search(input_data[\"nums\"], input_data[\"target\"])\nprint(json.dumps(result))", "javascript": "class Solution {\n    medium() {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    int target = obj.get(\"target\").getAsInt();\n    System.out.println(new Solution().search(nums, target));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  int target = input[\"target\"].get<int>();\n  Solution sol;\n  std::cout << sol.search(nums, target);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[4,5,6,7,0,1,2],\"target\":0}","expected_output":"4","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[4,5,6,7,0,1,2],\"target\":3}","expected_output":"-1","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[1],\"target\":0}","expected_output":"-1","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[1],\"target\":1}","expected_output":"0","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[3,1],\"target\":1}","expected_output":"1","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[5,1,2,3,4],\"target\":5}","expected_output":"0","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums\":[2,3,4,5,6,7,8,9,1],\"target\":9}","expected_output":"7","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

(
  'coin-change',
  'Coin Change',
  'medium',
  'Dynamic Programming',
  ARRAY['dynamic-programming', 'bfs'],
  E'You are given an integer array `coins` representing coins of different denominations and an integer `amount` representing a total amount of money.\n\nReturn the fewest number of coins that you need to make up that amount. If that amount of money cannot be made up by any combination of the coins, return `-1`.\n\nYou may assume that you have an infinite number of each kind of coin.',
  E'1 <= coins.length <= 12\n1 <= coins[i] <= 2^31 - 1\n0 <= amount <= 10^4',
  '[{"input":"coins = [1,5,10,25], amount = 41","output":"4","explanation":"25+10+5+1 = 41"},{"input":"coins = [2], amount = 3","output":"-1"},{"input":"coins = [1], amount = 0","output":"0"}]'::jsonb,
  '{"python3": "class Solution:\n    def coinChange(self, coins: list[int], amount: int) -> int:\n        pass", "javascript": "/**\n * @param {number[]} coins\n * @param {number} amount\n * @return {number}\n */\nclass Solution {\n    coinChange(coins, amount) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int coinChange(int[] coins, int amount) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int coinChange(vector<int>& coins, int amount) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.coinChange(input_data[\"coins\"], input_data[\"amount\"])\nprint(json.dumps(result))", "javascript": "class Solution {\n    medium() {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] coins = new Gson().fromJson(obj.get(\"coins\"), int[].class);\n    int amount = obj.get(\"amount\").getAsInt();\n    System.out.println(new Solution().coinChange(coins, amount));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto coins = input[\"coins\"].get<std::vector<int>>();\n  int amount = input[\"amount\"].get<int>();\n  Solution sol;\n  std::cout << sol.coinChange(coins, amount);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"coins\":[1,5,10,25],\"amount\":41}","expected_output":"4","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"coins\":[2],\"amount\":3}","expected_output":"-1","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"coins\":[1],\"amount\":0}","expected_output":"0","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"coins\":[1],\"amount\":1}","expected_output":"1","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"coins\":[1,2,5],\"amount\":11}","expected_output":"3","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"coins\":[186,419,83,408],\"amount\":6249}","expected_output":"20","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"coins\":[2],\"amount\":1}","expected_output":"-1","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

(
  'number-of-islands',
  'Number of Islands',
  'medium',
  'Graphs',
  ARRAY['graph', 'bfs', 'dfs', 'matrix'],
  E'Given an `m x n` 2D binary grid `grid` which represents a map of `''1''`s (land) and `''0''`s (water), return the number of islands.\n\nAn **island** is surrounded by water and is formed by connecting adjacent lands horizontally or vertically. You may assume all four edges of the grid are all surrounded by water.',
  E'm == grid.length\nn == grid[i].length\n1 <= m, n <= 300\ngrid[i][j] is ''0'' or ''1''.',
  '[{"input":"grid = [[\"1\",\"1\",\"1\",\"1\",\"0\"],[\"1\",\"1\",\"0\",\"1\",\"0\"],[\"1\",\"1\",\"0\",\"0\",\"0\"],[\"0\",\"0\",\"0\",\"0\",\"0\"]]","output":"1"},{"input":"grid = [[\"1\",\"1\",\"0\",\"0\",\"0\"],[\"1\",\"1\",\"0\",\"0\",\"0\"],[\"0\",\"0\",\"1\",\"0\",\"0\"],[\"0\",\"0\",\"0\",\"1\",\"1\"]]","output":"3"}]'::jsonb,
  '{"python3": "class Solution:\n    def numIslands(self, grid: list[list[str]]) -> int:\n        pass", "javascript": "/**\n * @param {character[][]} grid\n * @return {number}\n */\nclass Solution {\n    numIslands(grid) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int numIslands(char[][] grid) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int numIslands(vector<vector<char>>& grid) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.numIslands(input_data[\"grid\"])\nprint(json.dumps(result))", "javascript": "class Solution {\n    medium() {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    JsonArray arr = obj.getAsJsonArray(\"grid\");\n    char[][] grid = new char[arr.size()][];\n    for (int i = 0; i < arr.size(); i++) {\n      JsonArray row = arr.get(i).getAsJsonArray();\n      grid[i] = new char[row.size()];\n      for (int j = 0; j < row.size(); j++) grid[i][j] = row.get(j).getAsString().charAt(0);\n    }\n    System.out.println(new Solution().numIslands(grid));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  std::vector<std::vector<char>> grid;\n  for (auto& row : input[\"grid\"]) {\n    std::vector<char> r;\n    for (auto& c : row) r.push_back(c.get<std::string>()[0]);\n    grid.push_back(r);\n  }\n  Solution sol;\n  std::cout << sol.numIslands(grid);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"grid\":[[\"1\",\"1\",\"1\",\"1\",\"0\"],[\"1\",\"1\",\"0\",\"1\",\"0\"],[\"1\",\"1\",\"0\",\"0\",\"0\"],[\"0\",\"0\",\"0\",\"0\",\"0\"]]}","expected_output":"1","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"grid\":[[\"1\",\"1\",\"0\",\"0\",\"0\"],[\"1\",\"1\",\"0\",\"0\",\"0\"],[\"0\",\"0\",\"1\",\"0\",\"0\"],[\"0\",\"0\",\"0\",\"1\",\"1\"]]}","expected_output":"3","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"grid\":[[\"1\"]]}","expected_output":"1","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"grid\":[[\"0\"]]}","expected_output":"0","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"grid\":[[\"1\",\"0\",\"1\"],[\"0\",\"1\",\"0\"],[\"1\",\"0\",\"1\"]]}","expected_output":"5","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"grid\":[[\"1\",\"1\",\"1\"],[\"1\",\"1\",\"1\"],[\"1\",\"1\",\"1\"]]}","expected_output":"1","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

(
  'validate-binary-search-tree',
  'Validate Binary Search Tree',
  'medium',
  'Trees',
  ARRAY['tree', 'dfs', 'bst'],
  E'Given the `root` of a binary tree (as a level-order array with nulls), determine if it is a valid **binary search tree** (BST).\n\nA valid BST is defined as follows:\n- The left subtree of a node contains only nodes with keys **less than** the node''s key.\n- The right subtree of a node contains only nodes with keys **greater than** the node''s key.\n- Both the left and right subtrees must also be binary search trees.',
  E'The number of nodes in the tree is in the range [1, 10^4].\n-2^31 <= Node.val <= 2^31 - 1',
  '[{"input":"root = [2,1,3]","output":"true"},{"input":"root = [5,1,4,null,null,3,6]","output":"false","explanation":"The root node''s value is 5 but its right child''s value is 4."}]'::jsonb,
  '{"python3": "class Solution:\n    def isValidBST(self, root: list) -> bool:\n        # root is level-order array with None for null nodes\n        pass", "javascript": "/**\n * @param {(number|null)[]} root\n * @return {boolean}\n */\nclass Solution {\n    isValidBST(root) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public boolean isValidBST(Integer[] root) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    // -1001 is null sentinel\n    bool isValidBST(vector<int>& root) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.isValidBST(input_data[\"root\"])\nprint(json.dumps(result))", "javascript": "class Solution {\n    medium() {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    JsonArray arr = obj.getAsJsonArray(\"root\");\n    Integer[] root = new Integer[arr.size()];\n    for (int i = 0; i < arr.size(); i++) root[i] = arr.get(i).isJsonNull() ? null : arr.get(i).getAsInt();\n    System.out.println(new Solution().isValidBST(root));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  std::vector<int> root;\n  for (auto& v : input[\"root\"]) root.push_back(v.is_null() ? -1001 : v.get<int>());\n  Solution sol;\n  std::cout << json(sol.isValidBST(root)).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"root\":[2,1,3]}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"root\":[5,1,4,null,null,3,6]}","expected_output":"false","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"root\":[1]}","expected_output":"true","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"root\":[5,4,6,null,null,3,7]}","expected_output":"false","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"root\":[10,5,15,3,7,null,20]}","expected_output":"true","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"root\":[2,2,2]}","expected_output":"false","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"root\":[0,-1]}","expected_output":"true","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

(
  'longest-palindromic-substring',
  'Longest Palindromic Substring',
  'medium',
  'Strings',
  ARRAY['string', 'dynamic-programming', 'two-pointer'],
  E'Given a string `s`, return the **longest palindromic substring** in `s`.\n\nIf there are multiple answers of the same length, return any one.',
  E'1 <= s.length <= 1000\ns consist of only digits and English letters.',
  '[{"input":"s = \"babad\"","output":"\"bab\"","explanation":"\"aba\" is also a valid answer."},{"input":"s = \"cbbd\"","output":"\"bb\""}]'::jsonb,
  '{"python3": "class Solution:\n    def longestPalindrome(self, s: str) -> str:\n        pass", "javascript": "/**\n * @param {string} s\n * @return {string}\n */\nclass Solution {\n    longestPalindrome(s) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public String longestPalindrome(String s) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    string longestPalindrome(string s) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.longestPalindrome(input_data[\"s\"])\nprint(json.dumps(result))", "javascript": "class Solution {\n    medium() {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(\"\\\"\" + new Solution().longestPalindrome(obj.get(\"s\").getAsString()) + \"\\\"\");\n  }\n}", "cpp": "#include <iostream>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << json(sol.longestPalindrome(input[\"s\"].get<std::string>())).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"s\":\"babad\"}","expected_output":"\"bab\"","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"s\":\"cbbd\"}","expected_output":"\"bb\"","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"s\":\"a\"}","expected_output":"\"a\"","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"s\":\"ac\"}","expected_output":"\"a\"","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"s\":\"racecar\"}","expected_output":"\"racecar\"","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"s\":\"aacabdkacaa\"}","expected_output":"\"aca\"","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

(
  'kth-largest-element',
  'Kth Largest Element in an Array',
  'medium',
  'Arrays',
  ARRAY['arrays', 'heap', 'sorting', 'quickselect'],
  E'Given an integer array `nums` and an integer `k`, return the `k`th largest element in the array.\n\nNote that it is the `k`th largest element in the sorted order, not the `k`th distinct element.\n\nCan you solve it without sorting?',
  E'1 <= k <= nums.length <= 10^5\n-10^4 <= nums[i] <= 10^4',
  '[{"input":"nums = [3,2,1,5,6,4], k = 2","output":"5"},{"input":"nums = [3,2,3,1,2,4,5,5,6], k = 4","output":"4"}]'::jsonb,
  '{"python3": "class Solution:\n    def findKthLargest(self, nums: list[int], k: int) -> int:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @param {number} k\n * @return {number}\n */\nclass Solution {\n    findKthLargest(nums, k) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int findKthLargest(int[] nums, int k) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int findKthLargest(vector<int>& nums, int k) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.findKthLargest(input_data[\"nums\"], input_data[\"k\"])\nprint(json.dumps(result))", "javascript": "class Solution {\n    medium() {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    int k = obj.get(\"k\").getAsInt();\n    System.out.println(new Solution().findKthLargest(nums, k));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  int k = input[\"k\"].get<int>();\n  Solution sol;\n  std::cout << sol.findKthLargest(nums, k);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[3,2,1,5,6,4],\"k\":2}","expected_output":"5","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[3,2,3,1,2,4,5,5,6],\"k\":4}","expected_output":"4","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[1],\"k\":1}","expected_output":"1","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[7,7,7,7],\"k\":2}","expected_output":"7","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[-1,-2,-3,-4],\"k\":1}","expected_output":"-1","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[99,99,1,2,3,4,5],\"k\":3}","expected_output":"5","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
),

(
  'top-k-frequent-elements',
  'Top K Frequent Elements',
  'medium',
  'Arrays',
  ARRAY['hash-map', 'heap', 'sorting', 'bucket-sort'],
  E'Given an integer array `nums` and an integer `k`, return the `k` most frequent elements. You may return the answer in **any order**.\n\nReturn the answer sorted in ascending order for consistent judging.',
  E'1 <= nums.length <= 10^5\n-10^4 <= nums[i] <= 10^4\nk is in the range [1, the number of unique elements in the array].\nIt is guaranteed that the answer is unique.',
  '[{"input":"nums = [1,1,1,2,2,3], k = 2","output":"[1,2]"},{"input":"nums = [1], k = 1","output":"[1]"}]'::jsonb,
  '{"python3": "class Solution:\n    def topKFrequent(self, nums: list[int], k: int) -> list[int]:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @param {number} k\n * @return {number[]}\n */\nclass Solution {\n    topKFrequent(nums, k) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int[] topKFrequent(int[] nums, int k) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<int> topKFrequent(vector<int>& nums, int k) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.topKFrequent(input_data[\"nums\"], input_data[\"k\"])\nprint(json.dumps(sorted(result)))", "javascript": "class Solution {\n    medium() {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    int k = obj.get(\"k\").getAsInt();\n    int[] result = new Solution().topKFrequent(nums, k);\n    Arrays.sort(result);\n    System.out.println(Arrays.toString(result));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <algorithm>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  int k = input[\"k\"].get<int>();\n  Solution sol;\n  auto result = sol.topKFrequent(nums, k);\n  std::sort(result.begin(), result.end());\n  std::cout << json(result).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[1,1,1,2,2,3],\"k\":2}","expected_output":"[1,2]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[1],\"k\":1}","expected_output":"[1]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[4,4,4,3,3,2,1],\"k\":1}","expected_output":"[4]","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[1,2],\"k\":2}","expected_output":"[1,2]","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[-1,-1,2,2,3],\"k\":2}","expected_output":"[-1,2]","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[5,5,5,5,5],\"k\":1}","expected_output":"[5]","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  100, 5, 262144
)

ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, difficulty = EXCLUDED.difficulty, category = EXCLUDED.category,
  tags = EXCLUDED.tags, description = EXCLUDED.description, constraints = EXCLUDED.constraints,
  examples = EXCLUDED.examples, starter_code = EXCLUDED.starter_code,
  solution_wrappers = EXCLUDED.solution_wrappers, test_cases = EXCLUDED.test_cases,
  points = EXCLUDED.points, time_limit_seconds = EXCLUDED.time_limit_seconds,
  memory_limit_kb = EXCLUDED.memory_limit_kb, updated_at = now();
