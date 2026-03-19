-- DSA Problem Bank - Additional HARD Problems (7 new)
-- Run AFTER dsa_problems.sql

INSERT INTO public.dsa_problems (slug, title, difficulty, category, tags, description, constraints, examples, starter_code, solution_wrappers, test_cases, points, time_limit_seconds, memory_limit_kb)
VALUES

-- ============================================================
-- HARD PROBLEMS (7 new)
-- ============================================================

(
  'median-of-two-sorted-arrays',
  'Median of Two Sorted Arrays',
  'hard',
  'Binary Search',
  ARRAY['binary-search', 'arrays', 'divide-and-conquer'],
  E'Given two sorted arrays `nums1` and `nums2` of size `m` and `n` respectively, return **the median** of the two sorted arrays.\n\nThe overall run time complexity should be `O(log (m+n))`.',
  E'nums1.length == m\nnums2.length == n\n0 <= m <= 1000\n0 <= n <= 1000\n1 <= m + n <= 2000\n-10^6 <= nums1[i], nums2[i] <= 10^6',
  '[{"input":"nums1 = [1,3], nums2 = [2]","output":"2.0","explanation":"merged = [1,2,3], median is 2.0"},{"input":"nums1 = [1,2], nums2 = [3,4]","output":"2.5","explanation":"merged = [1,2,3,4], median is (2+3)/2 = 2.5"}]'::jsonb,
  '{"python3":"class Solution:\n    def findMedianSortedArrays(self, nums1: list[int], nums2: list[int]) -> float:\n        pass","javascript":"/**\n * @param {number[]} nums1\n * @param {number[]} nums2\n * @return {number}\n */\nvar findMedianSortedArrays = function(nums1, nums2) {\n    \n};","java":"class Solution {\n    public double findMedianSortedArrays(int[] nums1, int[] nums2) {\n        \n    }\n}","cpp":"class Solution {\npublic:\n    double findMedianSortedArrays(vector<int>& nums1, vector<int>& nums2) {\n        \n    }\n};"}'::jsonb,
  '{"python3":"import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.findMedianSortedArrays(input_data[\"nums1\"], input_data[\"nums2\"])\nprint(json.dumps(result))","javascript":"const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  console.log(JSON.stringify(findMedianSortedArrays(data.nums1, data.nums2)));\n});","java":"import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] n1 = new Gson().fromJson(obj.get(\"nums1\"), int[].class);\n    int[] n2 = new Gson().fromJson(obj.get(\"nums2\"), int[].class);\n    System.out.println(new Solution().findMedianSortedArrays(n1, n2));\n  }\n}","cpp":"#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto n1 = input[\"nums1\"].get<std::vector<int>>();\n  auto n2 = input[\"nums2\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << sol.findMedianSortedArrays(n1, n2);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums1\":[1,3],\"nums2\":[2]}","expected_output":"2.0","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums1\":[1,2],\"nums2\":[3,4]}","expected_output":"2.5","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums1\":[],\"nums2\":[1]}","expected_output":"1.0","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums1\":[2],\"nums2\":[]}","expected_output":"2.0","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums1\":[1,1,1],\"nums2\":[1,1,1]}","expected_output":"1.0","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums1\":[1,3,5,7],\"nums2\":[2,4,6,8]}","expected_output":"4.5","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums1\":[-5,-3,-1],\"nums2\":[-2,0,1]}","expected_output":"-1.5","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  150, 5, 262144
),

(
  'minimum-window-substring',
  'Minimum Window Substring',
  'hard',
  'Strings',
  ARRAY['sliding-window', 'hash-map', 'string'],
  E'Given two strings `s` and `t` of lengths `m` and `n` respectively, return the **minimum window substring** of `s` such that every character in `t` (including duplicates) is included in the window. If there is no such substring, return the empty string `""`.\n\nThe testcases will be generated such that the answer is **unique**.',
  E'm == s.length\nn == t.length\n1 <= m, n <= 10^5\ns and t consist of uppercase and lowercase English letters.',
  '[{"input":"s = \"ADOBECODEBANC\", t = \"ABC\"","output":"\"BANC\"","explanation":"The minimum window substring \"BANC\" includes A, B, and C from string t."},{"input":"s = \"a\", t = \"a\"","output":"\"a\""},{"input":"s = \"a\", t = \"aa\"","output":"\"\"","explanation":"Both ''a''s from t must be included."}]'::jsonb,
  '{"python3":"class Solution:\n    def minWindow(self, s: str, t: str) -> str:\n        pass","javascript":"/**\n * @param {string} s\n * @param {string} t\n * @return {string}\n */\nvar minWindow = function(s, t) {\n    \n};","java":"class Solution {\n    public String minWindow(String s, String t) {\n        \n    }\n}","cpp":"class Solution {\npublic:\n    string minWindow(string s, string t) {\n        \n    }\n};"}'::jsonb,
  '{"python3":"import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.minWindow(input_data[\"s\"], input_data[\"t\"])\nprint(json.dumps(result))","javascript":"const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  console.log(JSON.stringify(minWindow(data.s, data.t)));\n});","java":"import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(\"\\\"\" + new Solution().minWindow(obj.get(\"s\").getAsString(), obj.get(\"t\").getAsString()) + \"\\\"\");\n  }\n}","cpp":"#include <iostream>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << json(sol.minWindow(input[\"s\"].get<std::string>(), input[\"t\"].get<std::string>())).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"s\":\"ADOBECODEBANC\",\"t\":\"ABC\"}","expected_output":"\"BANC\"","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"s\":\"a\",\"t\":\"a\"}","expected_output":"\"a\"","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"s\":\"a\",\"t\":\"aa\"}","expected_output":"\"\"","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"s\":\"abc\",\"t\":\"b\"}","expected_output":"\"b\"","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"s\":\"ab\",\"t\":\"b\"}","expected_output":"\"b\"","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"s\":\"bba\",\"t\":\"ab\"}","expected_output":"\"ba\"","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"s\":\"aaflslflsldkalskaaa\",\"t\":\"aaa\"}","expected_output":"\"aaa\"","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  150, 5, 262144
),

(
  'longest-increasing-subsequence',
  'Longest Increasing Subsequence',
  'hard',
  'Dynamic Programming',
  ARRAY['dynamic-programming', 'binary-search', 'arrays'],
  E'Given an integer array `nums`, return the length of the longest **strictly increasing** subsequence.\n\nA **subsequence** is an array that can be derived from another array by deleting some or no elements without changing the order of the remaining elements.',
  E'1 <= nums.length <= 2500\n-10^4 <= nums[i] <= 10^4',
  '[{"input":"nums = [10,9,2,5,3,7,101,18]","output":"4","explanation":"The longest increasing subsequence is [2,3,7,101], length 4."},{"input":"nums = [0,1,0,3,2,3]","output":"4"},{"input":"nums = [7,7,7,7,7,7,7]","output":"1"}]'::jsonb,
  '{"python3":"class Solution:\n    def lengthOfLIS(self, nums: list[int]) -> int:\n        pass","javascript":"/**\n * @param {number[]} nums\n * @return {number}\n */\nvar lengthOfLIS = function(nums) {\n    \n};","java":"class Solution {\n    public int lengthOfLIS(int[] nums) {\n        \n    }\n}","cpp":"class Solution {\npublic:\n    int lengthOfLIS(vector<int>& nums) {\n        \n    }\n};"}'::jsonb,
  '{"python3":"import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.lengthOfLIS(input_data[\"nums\"])\nprint(json.dumps(result))","javascript":"const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  console.log(JSON.stringify(lengthOfLIS(data.nums)));\n});","java":"import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    System.out.println(new Solution().lengthOfLIS(nums));\n  }\n}","cpp":"#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << sol.lengthOfLIS(nums);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[10,9,2,5,3,7,101,18]}","expected_output":"4","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[0,1,0,3,2,3]}","expected_output":"4","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[7,7,7,7,7,7,7]}","expected_output":"1","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[1]}","expected_output":"1","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[1,2,3,4,5]}","expected_output":"5","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[5,4,3,2,1]}","expected_output":"1","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums\":[3,1,4,1,5,9,2,6]}","expected_output":"4","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"nums\":[-2,-1]}","expected_output":"2","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  150, 5, 262144
),

(
  'word-break',
  'Word Break',
  'hard',
  'Dynamic Programming',
  ARRAY['dynamic-programming', 'trie', 'string', 'hash-map'],
  E'Given a string `s` and a dictionary of strings `wordDict`, return `true` if `s` can be segmented into a space-separated sequence of one or more dictionary words.\n\nNote that the same word in the dictionary may be reused multiple times in the segmentation.',
  E'1 <= s.length <= 300\n1 <= wordDict.length <= 1000\n1 <= wordDict[i].length <= 20\ns and wordDict[i] consist of only lowercase English letters.\nAll the strings of wordDict are unique.',
  '[{"input":"s = \"leetcode\", wordDict = [\"leet\",\"code\"]","output":"true","explanation":"\"leetcode\" can be segmented as \"leet code\"."},{"input":"s = \"applepenapple\", wordDict = [\"apple\",\"pen\"]","output":"true"},{"input":"s = \"catsandog\", wordDict = [\"cats\",\"dog\",\"sand\",\"and\",\"cat\"]","output":"false"}]'::jsonb,
  '{"python3":"class Solution:\n    def wordBreak(self, s: str, wordDict: list[str]) -> bool:\n        pass","javascript":"/**\n * @param {string} s\n * @param {string[]} wordDict\n * @return {boolean}\n */\nvar wordBreak = function(s, wordDict) {\n    \n};","java":"class Solution {\n    public boolean wordBreak(String s, List<String> wordDict) {\n        \n    }\n}","cpp":"class Solution {\npublic:\n    bool wordBreak(string s, vector<string>& wordDict) {\n        \n    }\n};"}'::jsonb,
  '{"python3":"import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.wordBreak(input_data[\"s\"], input_data[\"wordDict\"])\nprint(json.dumps(result))","javascript":"const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  console.log(JSON.stringify(wordBreak(data.s, data.wordDict)));\n});","java":"import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    String s = obj.get(\"s\").getAsString();\n    String[] dict = new Gson().fromJson(obj.get(\"wordDict\"), String[].class);\n    System.out.println(new Solution().wordBreak(s, Arrays.asList(dict)));\n  }\n}","cpp":"#include <iostream>\n#include <vector>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto s = input[\"s\"].get<std::string>();\n  auto dict = input[\"wordDict\"].get<std::vector<std::string>>();\n  Solution sol;\n  std::cout << json(sol.wordBreak(s, dict)).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"s\":\"leetcode\",\"wordDict\":[\"leet\",\"code\"]}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"s\":\"applepenapple\",\"wordDict\":[\"apple\",\"pen\"]}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"s\":\"catsandog\",\"wordDict\":[\"cats\",\"dog\",\"sand\",\"and\",\"cat\"]}","expected_output":"false","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"s\":\"a\",\"wordDict\":[\"a\"]}","expected_output":"true","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"s\":\"aaaaaaa\",\"wordDict\":[\"aaa\",\"aaaa\"]}","expected_output":"true","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"s\":\"cars\",\"wordDict\":[\"car\",\"ca\",\"rs\"]}","expected_output":"true","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"s\":\"abcd\",\"wordDict\":[\"a\",\"abc\",\"b\",\"cd\"]}","expected_output":"true","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"s\":\"bb\",\"wordDict\":[\"a\",\"b\",\"bbb\",\"bbbb\"]}","expected_output":"true","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  150, 5, 262144
),

(
  'serialize-deserialize-binary-tree',
  'Serialize and Deserialize Binary Tree',
  'hard',
  'Trees',
  ARRAY['tree', 'bfs', 'dfs', 'design'],
  E'Design an algorithm to serialize and deserialize a binary tree. Serialization is the process of converting a data structure into a sequence of bits so it can be stored or transmitted.\n\nYour implementation should convert a binary tree (given as a level-order array with nulls) into a string, and then back into the same tree structure.\n\nReturn the level-order array representation of the deserialized tree.',
  E'The number of nodes in the tree is in the range [0, 10^4].\n-1000 <= Node.val <= 1000',
  '[{"input":"root = [1,2,3,null,null,4,5]","output":"[1,2,3,null,null,4,5]","explanation":"Serialize then deserialize should produce the same tree."},{"input":"root = []","output":"[]"}]'::jsonb,
  '{"python3":"class Solution:\n    def codec(self, root: list) -> list:\n        # Serialize and deserialize: input and output are level-order arrays\n        # Implement serialize(root) -> str and deserialize(str) -> root\n        # Return the result of deserialize(serialize(root))\n        pass","javascript":"/**\n * @param {(number|null)[]} root\n * @return {(number|null)[]}\n */\nvar codec = function(root) {\n    // Implement serialize and deserialize\n    // Return deserialize(serialize(root))\n};","java":"class Solution {\n    // Implement serialize and deserialize\n    // Input/output as Integer[] level-order with nulls\n    public Integer[] codec(Integer[] root) {\n        \n    }\n}","cpp":"class Solution {\npublic:\n    // Input/output as vector<int> level-order, -1001 = null\n    vector<int> codec(vector<int>& root) {\n        \n    }\n};"}'::jsonb,
  '{"python3":"import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.codec(input_data[\"root\"])\nprint(json.dumps(result))","javascript":"const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  console.log(JSON.stringify(codec(data.root)));\n});","java":"import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    JsonArray arr = obj.getAsJsonArray(\"root\");\n    Integer[] root = new Integer[arr.size()];\n    for (int i = 0; i < arr.size(); i++) root[i] = arr.get(i).isJsonNull() ? null : arr.get(i).getAsInt();\n    Integer[] result = new Solution().codec(root);\n    System.out.println(new Gson().toJson(result));\n  }\n}","cpp":"#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  std::vector<int> root;\n  for (auto& v : input[\"root\"]) root.push_back(v.is_null() ? -1001 : v.get<int>());\n  Solution sol;\n  auto result = sol.codec(root);\n  json out;\n  for (int v : result) { if (v == -1001) out.push_back(nullptr); else out.push_back(v); }\n  std::cout << out.dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"root\":[1,2,3,null,null,4,5]}","expected_output":"[1,2,3,null,null,4,5]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"root\":[]}","expected_output":"[]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"root\":[1]}","expected_output":"[1]","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"root\":[1,2,3,4,5,6,7]}","expected_output":"[1,2,3,4,5,6,7]","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"root\":[5,null,3,null,2]}","expected_output":"[5,null,3,null,2]","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"root\":[-1,0,1]}","expected_output":"[-1,0,1]","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  150, 5, 262144
),

(
  'lru-cache',
  'LRU Cache',
  'hard',
  'Design',
  ARRAY['design', 'hash-map', 'linked-list'],
  E'Design a data structure that follows the constraints of a **Least Recently Used (LRU) cache**.\n\nImplement the `LRUCache` class:\n- `LRUCache(int capacity)` Initialize the LRU cache with **positive** size capacity.\n- `int get(int key)` Return the value of the key if it exists, otherwise return `-1`.\n- `void put(int key, int value)` Update the value of the key if it exists. Otherwise, add the key-value pair. If the number of keys exceeds the capacity, evict the least recently used key.\n\nThe functions `get` and `put` must each run in `O(1)` average time complexity.\n\nInput is an array of operations and arguments. Output is an array of results.',
  E'1 <= capacity <= 3000\n0 <= key <= 10^4\n0 <= value <= 10^5\nAt most 2 * 10^5 calls will be made to get and put.',
  '[{"input":"operations = [\"LRUCache\",\"put\",\"put\",\"get\",\"put\",\"get\",\"put\",\"get\",\"get\",\"get\"], args = [[2],[1,1],[2,2],[1],[3,3],[2],[4,4],[1],[3],[4]]","output":"[null,null,null,1,null,-1,null,-1,3,4]"}]'::jsonb,
  '{"python3":"class LRUCache:\n    def __init__(self, capacity: int):\n        pass\n\n    def get(self, key: int) -> int:\n        pass\n\n    def put(self, key: int, value: int) -> None:\n        pass","javascript":"/**\n * @param {number} capacity\n */\nvar LRUCache = function(capacity) {\n    \n};\n\n/**\n * @param {number} key\n * @return {number}\n */\nLRUCache.prototype.get = function(key) {\n    \n};\n\n/**\n * @param {number} key\n * @param {number} value\n * @return {void}\n */\nLRUCache.prototype.put = function(key, value) {\n    \n};","java":"class LRUCache {\n    public LRUCache(int capacity) {\n        \n    }\n    public int get(int key) {\n        \n    }\n    public void put(int key, int value) {\n        \n    }\n}","cpp":"class LRUCache {\npublic:\n    LRUCache(int capacity) {\n        \n    }\n    int get(int key) {\n        \n    }\n    void put(int key, int value) {\n        \n    }\n};"}'::jsonb,
  '{"python3":"import json, sys\ninput_data = json.loads(sys.stdin.read())\nops = input_data[\"operations\"]\nargs = input_data[\"args\"]\nresults = []\nobj = None\nfor i, op in enumerate(ops):\n    if op == \"LRUCache\":\n        obj = LRUCache(args[i][0])\n        results.append(None)\n    elif op == \"get\":\n        results.append(obj.get(args[i][0]))\n    elif op == \"put\":\n        obj.put(args[i][0], args[i][1])\n        results.append(None)\nprint(json.dumps(results))","javascript":"const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const ops = data.operations, args = data.args;\n  const results = [];\n  let obj = null;\n  for (let i = 0; i < ops.length; i++) {\n    if (ops[i] === ''LRUCache'') { obj = new LRUCache(args[i][0]); results.push(null); }\n    else if (ops[i] === ''get'') { results.push(obj.get(args[i][0])); }\n    else if (ops[i] === ''put'') { obj.put(args[i][0], args[i][1]); results.push(null); }\n  }\n  console.log(JSON.stringify(results));\n});","java":"import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    JsonArray ops = obj.getAsJsonArray(\"operations\");\n    JsonArray argsArr = obj.getAsJsonArray(\"args\");\n    List<Object> results = new ArrayList<>();\n    LRUCache cache = null;\n    for (int i = 0; i < ops.size(); i++) {\n      String op = ops.get(i).getAsString();\n      JsonArray a = argsArr.get(i).getAsJsonArray();\n      if (op.equals(\"LRUCache\")) { cache = new LRUCache(a.get(0).getAsInt()); results.add(null); }\n      else if (op.equals(\"get\")) { results.add(cache.get(a.get(0).getAsInt())); }\n      else if (op.equals(\"put\")) { cache.put(a.get(0).getAsInt(), a.get(1).getAsInt()); results.add(null); }\n    }\n    System.out.println(new Gson().toJson(results));\n  }\n}","cpp":"#include <iostream>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto ops = input[\"operations\"];\n  auto args = input[\"args\"];\n  json results;\n  LRUCache* cache = nullptr;\n  for (size_t i = 0; i < ops.size(); i++) {\n    std::string op = ops[i].get<std::string>();\n    if (op == \"LRUCache\") { cache = new LRUCache(args[i][0].get<int>()); results.push_back(nullptr); }\n    else if (op == \"get\") { results.push_back(cache->get(args[i][0].get<int>())); }\n    else if (op == \"put\") { cache->put(args[i][0].get<int>(), args[i][1].get<int>()); results.push_back(nullptr); }\n  }\n  delete cache;\n  std::cout << results.dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"operations\":[\"LRUCache\",\"put\",\"put\",\"get\",\"put\",\"get\",\"put\",\"get\",\"get\",\"get\"],\"args\":[[2],[1,1],[2,2],[1],[3,3],[2],[4,4],[1],[3],[4]]}","expected_output":"[null,null,null,1,null,-1,null,-1,3,4]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"operations\":[\"LRUCache\",\"put\",\"get\",\"put\",\"get\",\"get\"],\"args\":[[1],[2,1],[2],[3,2],[2],[3]]}","expected_output":"[null,null,1,null,-1,2]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"operations\":[\"LRUCache\",\"get\"],\"args\":[[1],[0]]}","expected_output":"[null,-1]","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"operations\":[\"LRUCache\",\"put\",\"put\",\"put\",\"put\",\"get\",\"get\"],\"args\":[[2],[2,1],[1,1],[2,3],[4,1],[1],[2]]}","expected_output":"[null,null,null,null,null,-1,3]","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"operations\":[\"LRUCache\",\"put\",\"put\",\"get\",\"put\",\"put\",\"get\"],\"args\":[[2],[2,1],[2,2],[2],[1,1],[4,1],[2]]}","expected_output":"[null,null,null,2,null,null,-1]","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  150, 5, 262144
),

(
  'word-search-ii',
  'Word Search II',
  'hard',
  'Graphs',
  ARRAY['trie', 'dfs', 'backtracking', 'matrix'],
  E'Given an `m x n` board of characters and a list of strings `words`, return all words on the board.\n\nEach word must be constructed from letters of sequentially adjacent cells, where adjacent cells are horizontally or vertically neighboring. The same letter cell may not be used more than once in a word.\n\nReturn the found words sorted alphabetically.',
  E'm == board.length\nn == board[i].length\n1 <= m, n <= 12\nboard[i][j] is a lowercase English letter.\n1 <= words.length <= 3 * 10^4\n1 <= words[i].length <= 10\nwords[i] consists of lowercase English letters.\nAll the strings of words are unique.',
  '[{"input":"board = [[\"o\",\"a\",\"a\",\"n\"],[\"e\",\"t\",\"a\",\"e\"],[\"i\",\"h\",\"k\",\"r\"],[\"i\",\"f\",\"l\",\"v\"]], words = [\"oath\",\"pea\",\"eat\",\"rain\"]","output":"[\"eat\",\"oath\"]"},{"input":"board = [[\"a\",\"b\"],[\"c\",\"d\"]], words = [\"abcb\"]","output":"[]"}]'::jsonb,
  '{"python3":"class Solution:\n    def findWords(self, board: list[list[str]], words: list[str]) -> list[str]:\n        pass","javascript":"/**\n * @param {character[][]} board\n * @param {string[]} words\n * @return {string[]}\n */\nvar findWords = function(board, words) {\n    \n};","java":"class Solution {\n    public List<String> findWords(char[][] board, String[] words) {\n        \n    }\n}","cpp":"class Solution {\npublic:\n    vector<string> findWords(vector<vector<char>>& board, vector<string>& words) {\n        \n    }\n};"}'::jsonb,
  '{"python3":"import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.findWords(input_data[\"board\"], input_data[\"words\"])\nresult.sort()\nprint(json.dumps(result))","javascript":"const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const result = findWords(data.board, data.words);\n  result.sort();\n  console.log(JSON.stringify(result));\n});","java":"import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    JsonArray boardArr = obj.getAsJsonArray(\"board\");\n    char[][] board = new char[boardArr.size()][];\n    for (int i = 0; i < boardArr.size(); i++) {\n      JsonArray row = boardArr.get(i).getAsJsonArray();\n      board[i] = new char[row.size()];\n      for (int j = 0; j < row.size(); j++) board[i][j] = row.get(j).getAsString().charAt(0);\n    }\n    String[] words = new Gson().fromJson(obj.get(\"words\"), String[].class);\n    List<String> result = new Solution().findWords(board, words);\n    Collections.sort(result);\n    System.out.println(new Gson().toJson(result));\n  }\n}","cpp":"#include <iostream>\n#include <vector>\n#include <string>\n#include <algorithm>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  std::vector<std::vector<char>> board;\n  for (auto& row : input[\"board\"]) {\n    std::vector<char> r;\n    for (auto& c : row) r.push_back(c.get<std::string>()[0]);\n    board.push_back(r);\n  }\n  auto words = input[\"words\"].get<std::vector<std::string>>();\n  Solution sol;\n  auto result = sol.findWords(board, words);\n  std::sort(result.begin(), result.end());\n  std::cout << json(result).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"board\":[[\"o\",\"a\",\"a\",\"n\"],[\"e\",\"t\",\"a\",\"e\"],[\"i\",\"h\",\"k\",\"r\"],[\"i\",\"f\",\"l\",\"v\"]],\"words\":[\"oath\",\"pea\",\"eat\",\"rain\"]}","expected_output":"[\"eat\",\"oath\"]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"board\":[[\"a\",\"b\"],[\"c\",\"d\"]],\"words\":[\"abcb\"]}","expected_output":"[]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"board\":[[\"a\"]],\"words\":[\"a\"]}","expected_output":"[\"a\"]","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"board\":[[\"a\",\"b\"],[\"c\",\"d\"]],\"words\":[\"ab\",\"cb\",\"ad\",\"bd\",\"ac\",\"ca\",\"da\",\"bc\",\"db\",\"adcb\",\"dabc\",\"abb\",\"acb\"]}","expected_output":"[\"ab\",\"ac\",\"bd\",\"ca\",\"db\"]","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"board\":[[\"a\",\"a\"]],\"words\":[\"aaa\"]}","expected_output":"[]","visibility":"edge","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"board\":[[\"a\",\"b\",\"c\"],[\"a\",\"e\",\"d\"],[\"a\",\"f\",\"g\"]],\"words\":[\"abcdefg\",\"gfedcba\",\"eaabcdgfe\"]}","expected_output":"[\"abcdefg\",\"eaabcdgfe\",\"gfedcba\"]","visibility":"private","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  150, 5, 262144
)

ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, difficulty = EXCLUDED.difficulty, category = EXCLUDED.category,
  tags = EXCLUDED.tags, description = EXCLUDED.description, constraints = EXCLUDED.constraints,
  examples = EXCLUDED.examples, starter_code = EXCLUDED.starter_code,
  solution_wrappers = EXCLUDED.solution_wrappers, test_cases = EXCLUDED.test_cases,
  points = EXCLUDED.points, time_limit_seconds = EXCLUDED.time_limit_seconds,
  memory_limit_kb = EXCLUDED.memory_limit_kb, updated_at = now();
