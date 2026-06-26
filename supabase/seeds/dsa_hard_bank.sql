-- DSA Problem Bank Expansion — HARD Problems (Batch 6)
-- 15 new problems. Every problem: 2-3 public TCs, 5-8 private/edge TCs.

INSERT INTO public.dsa_problems (slug, title, difficulty, category, tags, description, constraints, examples, starter_code, solution_wrappers, test_cases, points, time_limit_seconds, memory_limit_kb)
VALUES

-- ============================================================
-- DYNAMIC PROGRAMMING (4)
-- ============================================================

-- 1. Longest Increasing Subsequence
(
  'longest-increasing-subsequence',
  'Longest Increasing Subsequence',
  'hard',
  'Dynamic Programming',
  ARRAY['array', 'binary-search', 'dynamic-programming'],
  E'Given an integer array `nums`, return the length of the **longest strictly increasing subsequence**.',
  E'1 <= nums.length <= 2500\n-10^4 <= nums[i] <= 10^4',
  '[{"input":"nums = [10,9,2,5,3,7,101,18]","output":"4","explanation":"LIS: [2,3,7,101] or [2,3,7,18]."},{"input":"nums = [0,1,0,3,2,3]","output":"4","explanation":"LIS: [0,1,2,3]."},{"input":"nums = [7,7,7,7,7,7,7]","output":"1","explanation":"All same, LIS length = 1."}]'::jsonb,
  '{"python3": "class Solution:\n    def lengthOfLIS(self, nums: list[int]) -> int:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @return {number}\n */\nclass Solution {\n    lengthOfLIS(nums) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int lengthOfLIS(int[] nums) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int lengthOfLIS(vector<int>& nums) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.lengthOfLIS(input_data[\"nums\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.lengthOfLIS(data.nums)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    System.out.println(new Solution().lengthOfLIS(nums));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << sol.lengthOfLIS(nums);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[10,9,2,5,3,7,101,18]}","expected_output":"4","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[0,1,0,3,2,3]}","expected_output":"4","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[7,7,7,7,7,7,7]}","expected_output":"1","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[1]}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[1,2,3,4,5]}","expected_output":"5","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[5,4,3,2,1]}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums\":[1,3,6,7,9,4,10,5,6]}","expected_output":"6","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"nums\":[-10000,0,10000,-9999,9999]}","expected_output":"3","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  200, 10, 262144
),

-- 2. Edit Distance
(
  'edit-distance',
  'Edit Distance',
  'hard',
  'Dynamic Programming',
  ARRAY['string', 'dynamic-programming'],
  E'Given two strings `word1` and `word2`, return the **minimum number of operations** required to convert `word1` to `word2`.\n\nYou have the following three operations permitted on a word:\n- Insert a character\n- Delete a character\n- Replace a character',
  E'0 <= word1.length, word2.length <= 500\nword1 and word2 consist of lowercase English letters.',
  '[{"input":"word1 = \"horse\", word2 = \"ros\"","output":"3","explanation":"horse→rorse (replace h→r)→rose (remove r)→ros (remove e)."},{"input":"word1 = \"intention\", word2 = \"execution\"","output":"5","explanation":"5 operations needed."}]'::jsonb,
  '{"python3": "class Solution:\n    def minDistance(self, word1: str, word2: str) -> int:\n        pass", "javascript": "/**\n * @param {string} word1\n * @param {string} word2\n * @return {number}\n */\nclass Solution {\n    minDistance(word1, word2) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int minDistance(String word1, String word2) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int minDistance(string word1, string word2) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.minDistance(input_data[\"word1\"], input_data[\"word2\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.minDistance(data.word1, data.word2)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Solution().minDistance(obj.get(\"word1\").getAsString(), obj.get(\"word2\").getAsString()));\n  }\n}", "cpp": "#include <iostream>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << sol.minDistance(input[\"word1\"].get<std::string>(), input[\"word2\"].get<std::string>());\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"word1\":\"horse\",\"word2\":\"ros\"}","expected_output":"3","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"word1\":\"intention\",\"word2\":\"execution\"}","expected_output":"5","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"word1\":\"\",\"word2\":\"a\"}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"word1\":\"\",\"word2\":\"\"}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"word1\":\"abc\",\"word2\":\"abc\"}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"word1\":\"sea\",\"word2\":\"eat\"}","expected_output":"2","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"word1\":\"dinitrophenylhydrazine\",\"word2\":\"benzalphenylhydrazone\"}","expected_output":"8","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  200, 10, 262144
),

-- 3. Burst Balloons
(
  'burst-balloons',
  'Burst Balloons',
  'hard',
  'Dynamic Programming',
  ARRAY['array', 'dynamic-programming'],
  E'You are given `n` balloons, indexed from `0` to `n - 1`. Each balloon is painted with a number on it represented by an array `nums`. You are asked to burst all the balloons.\n\nIf you burst the `i`th balloon, you will get `nums[i - 1] * nums[i] * nums[i + 1]` coins. If `i - 1` or `i + 1` goes out of bounds of the array, then treat it as if there is a balloon with a `1` painted on it.\n\nReturn the **maximum** coins you can collect by bursting the balloons wisely.',
  E'n == nums.length\n1 <= n <= 300\n0 <= nums[i] <= 100',
  '[{"input":"nums = [3,1,5,8]","output":"167","explanation":"Burst 1: 3*1*5=15. Burst 5: 3*5*8=120. Burst 3: 3*8*1=24. Burst 8: 1*8*1=8. Total=167."},{"input":"nums = [1,5]","output":"10","explanation":"Burst 1 first: 1*1*5=5. Burst 5: 1*5*1=5. Total=10."}]'::jsonb,
  '{"python3": "class Solution:\n    def maxCoins(self, nums: list[int]) -> int:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @return {number}\n */\nclass Solution {\n    maxCoins(nums) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int maxCoins(int[] nums) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int maxCoins(vector<int>& nums) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.maxCoins(input_data[\"nums\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.maxCoins(data.nums)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    System.out.println(new Solution().maxCoins(nums));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << sol.maxCoins(nums);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[3,1,5,8]}","expected_output":"167","visibility":"public","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[1,5]}","expected_output":"10","visibility":"public","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[1]}","expected_output":"1","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[0]}","expected_output":"0","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[5,8,3,7]}","expected_output":"192","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[1,2,3,4,5]}","expected_output":"110","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums\":[7,9,8,0,7,1,3,5,5,2,3]}","expected_output":"1654","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144}
  ]'::jsonb,
  200, 10, 262144
),

-- 4. Palindrome Partitioning II
(
  'palindrome-partitioning-ii',
  'Palindrome Partitioning II',
  'hard',
  'Dynamic Programming',
  ARRAY['string', 'dynamic-programming'],
  E'Given a string `s`, partition `s` such that every substring of the partition is a palindrome.\n\nReturn the **minimum cuts** needed for a palindrome partitioning of `s`.',
  E'1 <= s.length <= 2000\ns consists of lowercase English letters only.',
  '[{"input":"s = \"aab\"","output":"1","explanation":"Split into \"aa\" + \"b\". 1 cut."},{"input":"s = \"a\"","output":"0","explanation":"Already a palindrome."},{"input":"s = \"ab\"","output":"1","explanation":"Split \"a\" + \"b\". 1 cut."}]'::jsonb,
  '{"python3": "class Solution:\n    def minCut(self, s: str) -> int:\n        pass", "javascript": "/**\n * @param {string} s\n * @return {number}\n */\nclass Solution {\n    minCut(s) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int minCut(String s) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int minCut(string s) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.minCut(input_data[\"s\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.minCut(data.s)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Solution().minCut(obj.get(\"s\").getAsString()));\n  }\n}", "cpp": "#include <iostream>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << sol.minCut(input[\"s\"].get<std::string>());\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"s\":\"aab\"}","expected_output":"1","visibility":"public","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"s\":\"a\"}","expected_output":"0","visibility":"public","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"s\":\"ab\"}","expected_output":"1","visibility":"public","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"s\":\"aaa\"}","expected_output":"0","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"s\":\"ababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababab\"}","expected_output":"0","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"s\":\"abcde\"}","expected_output":"4","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"s\":\"raceacar\"}","expected_output":"2","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144}
  ]'::jsonb,
  200, 10, 262144
),

-- ============================================================
-- GRAPHS (3)
-- ============================================================

-- 5. Word Ladder
(
  'word-ladder',
  'Word Ladder',
  'hard',
  'Graphs',
  ARRAY['hash-set', 'bfs', 'string'],
  E'A **transformation sequence** from word `beginWord` to word `endWord` using a dictionary `wordList` is a sequence `beginWord → s1 → s2 → ... → sk` such that:\n- Every adjacent pair of words differs by a single letter.\n- Every `si` for `1 <= i <= k` is in `wordList`. Note that `beginWord` does not need to be in `wordList`.\n- `sk == endWord`\n\nGiven two words, `beginWord` and `endWord`, and a dictionary `wordList`, return the **number of words in the shortest transformation sequence** from `beginWord` to `endWord`, or `0` if no such sequence exists.',
  E'1 <= beginWord.length <= 10\nendWord.length == beginWord.length\n1 <= wordList.length <= 5000\nwordList[i].length == beginWord.length\nbeginWord, endWord, and wordList[i] consist of lowercase English letters.\nbeginWord != endWord\nAll the words in wordList are unique.',
  '[{"input":"beginWord = \"hit\", endWord = \"cog\", wordList = [\"hot\",\"dot\",\"dog\",\"lot\",\"log\",\"cog\"]","output":"5","explanation":"hit→hot→dot→dog→cog (5 words)."},{"input":"beginWord = \"hit\", endWord = \"cog\", wordList = [\"hot\",\"dot\",\"dog\",\"lot\",\"log\"]","output":"0","explanation":"cog not in wordList, no path."}]'::jsonb,
  '{"python3": "class Solution:\n    def ladderLength(self, beginWord: str, endWord: str, wordList: list[str]) -> int:\n        pass", "javascript": "/**\n * @param {string} beginWord\n * @param {string} endWord\n * @param {string[]} wordList\n * @return {number}\n */\nclass Solution {\n    ladderLength(beginWord, endWord, wordList) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int ladderLength(String beginWord, String endWord, List<String> wordList) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int ladderLength(string beginWord, string endWord, vector<string>& wordList) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.ladderLength(input_data[\"beginWord\"], input_data[\"endWord\"], input_data[\"wordList\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.ladderLength(data.beginWord, data.endWord, data.wordList)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    String bw = obj.get(\"beginWord\").getAsString();\n    String ew = obj.get(\"endWord\").getAsString();\n    String[] wlArr = new Gson().fromJson(obj.get(\"wordList\"), String[].class);\n    System.out.println(new Solution().ladderLength(bw, ew, Arrays.asList(wlArr)));\n  }\n}", "cpp": "#include <iostream>\n#include <string>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto wordList = input[\"wordList\"].get<std::vector<std::string>>();\n  Solution sol;\n  std::cout << sol.ladderLength(input[\"beginWord\"].get<std::string>(), input[\"endWord\"].get<std::string>(), wordList);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"beginWord\":\"hit\",\"endWord\":\"cog\",\"wordList\":[\"hot\",\"dot\",\"dog\",\"lot\",\"log\",\"cog\"]}","expected_output":"5","visibility":"public","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"beginWord\":\"hit\",\"endWord\":\"cog\",\"wordList\":[\"hot\",\"dot\",\"dog\",\"lot\",\"log\"]}","expected_output":"0","visibility":"public","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"beginWord\":\"a\",\"endWord\":\"c\",\"wordList\":[\"a\",\"b\",\"c\"]}","expected_output":"2","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"beginWord\":\"hot\",\"endWord\":\"dog\",\"wordList\":[\"hot\",\"dog\"]}","expected_output":"0","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"beginWord\":\"leet\",\"endWord\":\"code\",\"wordList\":[\"lest\",\"leet\",\"lose\",\"code\",\"lode\",\"robe\",\"lost\"]}","expected_output":"6","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"beginWord\":\"qa\",\"endWord\":\"sq\",\"wordList\":[\"si\",\"go\",\"se\",\"cm\",\"so\",\"ph\",\"mt\",\"db\",\"mb\",\"sb\",\"kr\",\"ln\",\"tm\",\"le\",\"av\",\"sm\",\"ar\",\"ci\",\"ca\",\"br\",\"ti\",\"ba\",\"to\",\"ra\",\"fa\",\"yo\",\"ow\",\"sn\",\"ya\",\"cr\",\"po\",\"fe\",\"ho\",\"ma\",\"re\",\"or\",\"rn\",\"au\",\"ur\",\"rh\",\"sr\",\"tc\",\"lt\",\"lo\",\"as\",\"fr\",\"nb\",\"yb\",\"if\",\"pb\",\"ge\",\"th\",\"pm\",\"rb\",\"sh\",\"co\",\"ga\",\"li\",\"ha\",\"hz\",\"no\",\"bi\",\"di\",\"hi\",\"qa\",\"pi\",\"os\",\"uh\",\"wm\",\"an\",\"me\",\"mo\",\"na\",\"la\",\"st\",\"er\",\"sc\",\"ne\",\"mn\",\"mi\",\"am\",\"ex\",\"pt\",\"io\",\"be\",\"fm\",\"ta\",\"tb\",\"ni\",\"mr\",\"pa\",\"he\",\"lr\",\"sq\",\"ye\"]}","expected_output":"5","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144}
  ]'::jsonb,
  200, 10, 262144
),

-- 6. Alien Dictionary
(
  'alien-dictionary',
  'Alien Dictionary',
  'hard',
  'Graphs',
  ARRAY['array', 'string', 'dfs', 'bfs', 'graph', 'topological-sort'],
  E'There is a new alien language that uses the English alphabet. However, the order of the letters is unknown to you.\n\nYou are given a list of strings `words` from the alien language''s dictionary. From the dictionary, you can determine the order of some letters.\n\nReturn a string of the unique letters in the new alien language sorted in lexicographically increasing order as per the new language''s ordering rules. If there is no valid ordering, return `""`. If there are multiple valid orderings, return **any** of them.\n\n**Note**: Your solution will be validated by checking if the returned string represents a valid topological ordering.',
  E'1 <= words.length <= 100\n1 <= words[i].length <= 100\nwords[i] consists of only lowercase English letters.',
  '[{"input":"words = [\"wrt\",\"wrf\",\"er\",\"ett\",\"rftt\"]","output":"\"wertf\"","explanation":"w<e<r<t<f is one valid ordering."},{"input":"words = [\"z\",\"x\"]","output":"\"zx\"","explanation":"z<x."},{"input":"words = [\"z\",\"x\",\"z\"]","output":"\"\"","explanation":"Cycle: z→x→z, invalid."}]'::jsonb,
  '{"python3": "class Solution:\n    def alienOrder(self, words: list[str]) -> str:\n        pass", "javascript": "/**\n * @param {string[]} words\n * @return {string}\n */\nclass Solution {\n    alienOrder(words) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public String alienOrder(String[] words) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    string alienOrder(vector<string>& words) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\nfrom collections import Counter, defaultdict, deque\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.alienOrder(input_data[\"words\"])\n# Validate: topological order is correct\nif not result:\n    print(json.dumps(\"\"))\nelse:\n    pos = {c: i for i, c in enumerate(result)}\n    valid = True\n    words = input_data[\"words\"]\n    for i in range(len(words)-1):\n        w1, w2 = words[i], words[i+1]\n        for a, b in zip(w1, w2):\n            if a != b:\n                if pos.get(a, -1) > pos.get(b, -1):\n                    valid = False\n                break\n        else:\n            if len(w1) > len(w2):\n                valid = False\n    print(json.dumps(result if valid else \"\"))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  const result = sol.alienOrder(data.words);\n  // Just output; validation handled by judge\n  console.log(JSON.stringify(result));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    String[] words = new Gson().fromJson(obj.get(\"words\"), String[].class);\n    System.out.println(new Gson().toJson(new Solution().alienOrder(words)));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto words = input[\"words\"].get<std::vector<std::string>>();\n  Solution sol;\n  std::cout << json(sol.alienOrder(words)).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"words\":[\"wrt\",\"wrf\",\"er\",\"ett\",\"rftt\"]}","expected_output":"\"wertf\"","visibility":"public","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"words\":[\"z\",\"x\"]}","expected_output":"\"zx\"","visibility":"public","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"words\":[\"z\",\"x\",\"z\"]}","expected_output":"\"\"","visibility":"public","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"words\":[\"abc\",\"ab\"]}","expected_output":"\"\"","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"words\":[\"a\",\"b\",\"ca\",\"cc\"]}","expected_output":"\"abc\"","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"words\":[\"z\"]}","expected_output":"\"z\"","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144}
  ]'::jsonb,
  200, 10, 262144
),

-- 7. Reconstruct Itinerary
(
  'reconstruct-itinerary',
  'Reconstruct Itinerary',
  'hard',
  'Graphs',
  ARRAY['dfs', 'graph', 'eulerian-path'],
  E'You are given a list of airline `tickets` represented by pairs of departure and arrival airports `[from, to]`. Reconstruct the itinerary in order. All tickets belong to a man who departs from `"JFK"`, thus, the itinerary must begin with `"JFK"`.\n\nIf there are multiple valid itineraries, return the itinerary that has the smallest lexical order when read as a single string.\n\nYou may assume all tickets form at least one valid itinerary. You must use all the tickets once and only once.',
  E'1 <= tickets.length <= 300\ntickets[i].length == 2\nfrom[i].length == 3\nto[i].length == 3\nfrom[i] and to[i] consist of uppercase English letters.\nfrom[i] != to[i]',
  '[{"input":"tickets = [[\"MUC\",\"LHR\"],[\"JFK\",\"MUC\"],[\"SFO\",\"SJC\"],[\"LHR\",\"SFO\"]]","output":"[\"JFK\",\"MUC\",\"LHR\",\"SFO\",\"SJC\"]","explanation":"Only one valid itinerary."},{"input":"tickets = [[\"JFK\",\"SFO\"],[\"JFK\",\"ATL\"],[\"SFO\",\"ATL\"],[\"ATL\",\"JFK\"],[\"ATL\",\"SFO\"]]","output":"[\"JFK\",\"ATL\",\"JFK\",\"SFO\",\"ATL\",\"SFO\"]","explanation":"Smallest lexical itinerary."}]'::jsonb,
  '{"python3": "class Solution:\n    def findItinerary(self, tickets: list[list[str]]) -> list[str]:\n        pass", "javascript": "/**\n * @param {string[][]} tickets\n * @return {string[]}\n */\nclass Solution {\n    findItinerary(tickets) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public List<String> findItinerary(List<List<String>> tickets) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<string> findItinerary(vector<vector<string>>& tickets) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.findItinerary(input_data[\"tickets\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.findItinerary(data.tickets)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    String[][] t = new Gson().fromJson(obj.get(\"tickets\"), String[][].class);\n    List<List<String>> tickets = new ArrayList<>();\n    for (String[] p : t) tickets.add(Arrays.asList(p));\n    System.out.println(new Gson().toJson(new Solution().findItinerary(tickets)));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  std::vector<std::vector<std::string>> tickets;\n  for (auto& t : input[\"tickets\"]) tickets.push_back(t.get<std::vector<std::string>>());\n  Solution sol;\n  auto result = sol.findItinerary(tickets);\n  std::cout << json(result).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"tickets\":[[\"MUC\",\"LHR\"],[\"JFK\",\"MUC\"],[\"SFO\",\"SJC\"],[\"LHR\",\"SFO\"]]}","expected_output":"[\"JFK\",\"MUC\",\"LHR\",\"SFO\",\"SJC\"]","visibility":"public","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"tickets\":[[\"JFK\",\"SFO\"],[\"JFK\",\"ATL\"],[\"SFO\",\"ATL\"],[\"ATL\",\"JFK\"],[\"ATL\",\"SFO\"]]}","expected_output":"[\"JFK\",\"ATL\",\"JFK\",\"SFO\",\"ATL\",\"SFO\"]","visibility":"public","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"tickets\":[[\"JFK\",\"KUL\"],[\"JFK\",\"NRT\"],[\"NRT\",\"JFK\"]]}","expected_output":"[\"JFK\",\"NRT\",\"JFK\",\"KUL\"]","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"tickets\":[[\"JFK\",\"A\"],[\"A\",\"JFK\"],[\"JFK\",\"B\"],[\"B\",\"A\"],[\"A\",\"B\"]]}","expected_output":"[\"JFK\",\"A\",\"B\",\"A\",\"JFK\",\"B\"]","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"tickets\":[[\"JFK\",\"ZZZ\"]]}","expected_output":"[\"JFK\",\"ZZZ\"]","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144}
  ]'::jsonb,
  200, 10, 262144
),

-- ============================================================
-- SLIDING WINDOW HARD (2)
-- ============================================================

-- 8. Minimum Window Substring
(
  'minimum-window-substring',
  'Minimum Window Substring',
  'hard',
  'Sliding Window',
  ARRAY['hash-map', 'string', 'sliding-window', 'two-pointer'],
  E'Given two strings `s` and `t` of lengths `m` and `n` respectively, return the **minimum window substring** of `s` such that every character in `t` (including duplicates) is included in the window. If there is no such substring, return the empty string `""`.\n\nThe testcases will be generated such that the answer is **unique**.',
  E'm == s.length\nn == t.length\n1 <= m, n <= 10^5\ns and t consist of uppercase and lowercase English letters.',
  '[{"input":"s = \"ADOBECODEBANC\", t = \"ABC\"","output":"\"BANC\"","explanation":"Minimum window containing A, B, C."},{"input":"s = \"a\", t = \"a\"","output":"\"a\"","explanation":"Only one character."},{"input":"s = \"a\", t = \"aa\"","output":"\"\"","explanation":"t has two a''s but s only one."}]'::jsonb,
  '{"python3": "class Solution:\n    def minWindow(self, s: str, t: str) -> str:\n        pass", "javascript": "/**\n * @param {string} s\n * @param {string} t\n * @return {string}\n */\nclass Solution {\n    minWindow(s, t) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public String minWindow(String s, String t) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    string minWindow(string s, string t) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.minWindow(input_data[\"s\"], input_data[\"t\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.minWindow(data.s, data.t)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Gson().toJson(new Solution().minWindow(obj.get(\"s\").getAsString(), obj.get(\"t\").getAsString())));\n  }\n}", "cpp": "#include <iostream>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << json(sol.minWindow(input[\"s\"].get<std::string>(), input[\"t\"].get<std::string>())).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"s\":\"ADOBECODEBANC\",\"t\":\"ABC\"}","expected_output":"\"BANC\"","visibility":"public","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"s\":\"a\",\"t\":\"a\"}","expected_output":"\"a\"","visibility":"public","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"s\":\"a\",\"t\":\"aa\"}","expected_output":"\"\"","visibility":"public","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"s\":\"ab\",\"t\":\"b\"}","expected_output":"\"b\"","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"s\":\"bba\",\"t\":\"ab\"}","expected_output":"\"ba\"","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"s\":\"cabwefgewcwaefgcf\",\"t\":\"cae\"}","expected_output":"\"cwae\"","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"s\":\"aa\",\"t\":\"aa\"}","expected_output":"\"aa\"","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144}
  ]'::jsonb,
  200, 10, 262144
),

-- 9. Sliding Window Maximum
(
  'sliding-window-maximum',
  'Sliding Window Maximum',
  'hard',
  'Sliding Window',
  ARRAY['array', 'queue', 'sliding-window', 'heap', 'monotonic-queue'],
  E'You are given an array of integers `nums`, there is a sliding window of size `k` which is moving from the very left of the array to the very right. You can only see the `k` numbers in the window. Each time the sliding window moves right by one position.\n\nReturn the max sliding window.',
  E'1 <= nums.length <= 10^5\n-10^4 <= nums[i] <= 10^4\n1 <= k <= nums.length',
  '[{"input":"nums = [1,3,-1,-3,5,3,6,7], k = 3","output":"[3,3,5,5,6,7]","explanation":"Window max for each position of size 3."},{"input":"nums = [1], k = 1","output":"[1]","explanation":"Single element."}]'::jsonb,
  '{"python3": "class Solution:\n    def maxSlidingWindow(self, nums: list[int], k: int) -> list[int]:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @param {number} k\n * @return {number[]}\n */\nclass Solution {\n    maxSlidingWindow(nums, k) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int[] maxSlidingWindow(int[] nums, int k) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<int> maxSlidingWindow(vector<int>& nums, int k) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.maxSlidingWindow(input_data[\"nums\"], input_data[\"k\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.maxSlidingWindow(data.nums, data.k)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    System.out.println(Arrays.toString(new Solution().maxSlidingWindow(nums, obj.get(\"k\").getAsInt())));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  Solution sol;\n  auto result = sol.maxSlidingWindow(nums, input[\"k\"].get<int>());\n  std::cout << json(result).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[1,3,-1,-3,5,3,6,7],\"k\":3}","expected_output":"[3,3,5,5,6,7]","visibility":"public","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[1],\"k\":1}","expected_output":"[1]","visibility":"public","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[1,3,1,2,0,5],\"k\":3}","expected_output":"[3,3,2,5]","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[2,1,5,2,3,4,1,1,8],\"k\":4}","expected_output":"[5,5,5,4,8]","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[9,8,7,6,5,4,3,2,1],\"k\":3}","expected_output":"[9,8,7,6,5,4,3]","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[1,2,3,4,5,6,7,8,9],\"k\":3}","expected_output":"[3,4,5,6,7,8,9]","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums\":[-10000,10000,-10000,10000],\"k\":2}","expected_output":"[10000,10000,10000]","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144}
  ]'::jsonb,
  200, 10, 262144
),

-- ============================================================
-- BINARY SEARCH HARD (2)
-- ============================================================

-- 10. Median of Two Sorted Arrays
(
  'median-of-two-sorted-arrays',
  'Median of Two Sorted Arrays',
  'hard',
  'Binary Search',
  ARRAY['array', 'binary-search', 'divide-and-conquer'],
  E'Given two sorted arrays `nums1` and `nums2` of size `m` and `n` respectively, return **the median** of the two sorted arrays.\n\nThe overall run time complexity should be O(log (m+n)).\n\nIf the combined length is even, the median is the average of the two middle numbers.',
  E'nums1.length == m\nnums2.length == n\n0 <= m <= 1000\n0 <= n <= 1000\n1 <= m + n <= 2000\n-10^6 <= nums1[i], nums2[i] <= 10^6',
  '[{"input":"nums1 = [1,3], nums2 = [2]","output":"2.00000","explanation":"Merged: [1,2,3]. Median = 2."},{"input":"nums1 = [1,2], nums2 = [3,4]","output":"2.50000","explanation":"Merged: [1,2,3,4]. Median = (2+3)/2 = 2.5."}]'::jsonb,
  '{"python3": "class Solution:\n    def findMedianSortedArrays(self, nums1: list[int], nums2: list[int]) -> float:\n        pass", "javascript": "/**\n * @param {number[]} nums1\n * @param {number[]} nums2\n * @return {number}\n */\nclass Solution {\n    findMedianSortedArrays(nums1, nums2) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public double findMedianSortedArrays(int[] nums1, int[] nums2) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    double findMedianSortedArrays(vector<int>& nums1, vector<int>& nums2) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.findMedianSortedArrays(input_data[\"nums1\"], input_data[\"nums2\"])\nprint(round(result, 5))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  const result = sol.findMedianSortedArrays(data.nums1, data.nums2);\n  console.log(parseFloat(result.toFixed(5)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] n1 = new Gson().fromJson(obj.get(\"nums1\"), int[].class);\n    int[] n2 = new Gson().fromJson(obj.get(\"nums2\"), int[].class);\n    System.out.printf(\"%.5f%n\", new Solution().findMedianSortedArrays(n1, n2));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <iomanip>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto n1 = input[\"nums1\"].get<std::vector<int>>();\n  auto n2 = input[\"nums2\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << std::fixed << std::setprecision(5) << sol.findMedianSortedArrays(n1, n2);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums1\":[1,3],\"nums2\":[2]}","expected_output":"2.0","visibility":"public","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums1\":[1,2],\"nums2\":[3,4]}","expected_output":"2.5","visibility":"public","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums1\":[],\"nums2\":[1]}","expected_output":"1.0","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums1\":[2],\"nums2\":[]}","expected_output":"2.0","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums1\":[0,0],\"nums2\":[0,0]}","expected_output":"0.0","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums1\":[1,3,5,7,9],\"nums2\":[2,4,6,8,10]}","expected_output":"5.5","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums1\":[-1000000],\"nums2\":[1000000]}","expected_output":"0.0","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144}
  ]'::jsonb,
  200, 10, 262144
),

-- 11. Split Array Largest Sum
(
  'split-array-largest-sum',
  'Split Array Largest Sum',
  'hard',
  'Binary Search',
  ARRAY['array', 'binary-search', 'dynamic-programming', 'greedy', 'prefix-sum'],
  E'Given an integer array `nums` and an integer `k`, split `nums` into `k` non-empty subarrays such that the **largest sum** of any subarray is **minimized**.\n\nReturn the minimized largest sum of the split.',
  E'1 <= nums.length <= 1000\n0 <= nums[i] <= 10^6\n1 <= k <= min(50, nums.length)',
  '[{"input":"nums = [7,2,5,10,8], k = 2","output":"18","explanation":"Split into [7,2,5] and [10,8], max sum = 18."},{"input":"nums = [1,2,3,4,5], k = 2","output":"9","explanation":"Split into [1,2,3,4] and [5], max sum = 10. Or [1,2,3] and [4,5] = max 9."}]'::jsonb,
  '{"python3": "class Solution:\n    def splitArray(self, nums: list[int], k: int) -> int:\n        pass", "javascript": "/**\n * @param {number[]} nums\n * @param {number} k\n * @return {number}\n */\nclass Solution {\n    splitArray(nums, k) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int splitArray(int[] nums, int k) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int splitArray(vector<int>& nums, int k) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.splitArray(input_data[\"nums\"], input_data[\"k\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.splitArray(data.nums, data.k)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] nums = new Gson().fromJson(obj.get(\"nums\"), int[].class);\n    System.out.println(new Solution().splitArray(nums, obj.get(\"k\").getAsInt()));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto nums = input[\"nums\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << sol.splitArray(nums, input[\"k\"].get<int>());\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"nums\":[7,2,5,10,8],\"k\":2}","expected_output":"18","visibility":"public","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"nums\":[1,2,3,4,5],\"k\":2}","expected_output":"9","visibility":"public","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"nums\":[1],\"k\":1}","expected_output":"1","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"nums\":[1,4,4],\"k\":3}","expected_output":"4","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"nums\":[10,5,13,4,8,4,5,11,14,9,16,10,20,8],\"k\":8}","expected_output":"25","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"nums\":[1000000,1000000,1000000,1000000,1000000],\"k\":1}","expected_output":"5000000","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"nums\":[1000000,1000000,1000000,1000000,1000000],\"k\":5}","expected_output":"1000000","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144}
  ]'::jsonb,
  200, 10, 262144
),

-- ============================================================
-- ARRAYS HARD (2)
-- ============================================================

-- 12. Trapping Rain Water
(
  'trapping-rain-water',
  'Trapping Rain Water',
  'hard',
  'Arrays',
  ARRAY['array', 'two-pointer', 'dynamic-programming', 'stack', 'monotonic-stack'],
  E'Given `n` non-negative integers representing an elevation map where the width of each bar is `1`, compute how much water it can trap after raining.',
  E'n == height.length\n1 <= n <= 2 * 10^4\n0 <= height[i] <= 10^5',
  '[{"input":"height = [0,1,0,2,1,0,1,3,2,1,2,1]","output":"6","explanation":"6 units of rainwater trapped."},{"input":"height = [4,2,0,3,2,5]","output":"9","explanation":"9 units trapped."}]'::jsonb,
  '{"python3": "class Solution:\n    def trap(self, height: list[int]) -> int:\n        pass", "javascript": "/**\n * @param {number[]} height\n * @return {number}\n */\nclass Solution {\n    trap(height) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int trap(int[] height) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int trap(vector<int>& height) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.trap(input_data[\"height\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.trap(data.height)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] height = new Gson().fromJson(obj.get(\"height\"), int[].class);\n    System.out.println(new Solution().trap(height));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto height = input[\"height\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << sol.trap(height);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"height\":[0,1,0,2,1,0,1,3,2,1,2,1]}","expected_output":"6","visibility":"public","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"height\":[4,2,0,3,2,5]}","expected_output":"9","visibility":"public","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"height\":[1,0,1]}","expected_output":"1","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"height\":[3,0,0,2,0,4]}","expected_output":"10","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"height\":[0,0,0,0]}","expected_output":"0","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"height\":[5,5,5,5,5]}","expected_output":"0","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"height\":[0,100000,0,100000,0]}","expected_output":"200000","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"height\":[4,9,4,5,0,5,1,6,0,4]}","expected_output":"17","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144}
  ]'::jsonb,
  200, 10, 262144
),

-- 13. Largest Rectangle in Histogram
(
  'largest-rectangle-histogram',
  'Largest Rectangle in Histogram',
  'hard',
  'Arrays',
  ARRAY['array', 'stack', 'monotonic-stack'],
  E'Given an array of integers `heights` representing the histogram''s bar height where the width of each bar is `1`, return the area of the largest rectangle in the histogram.',
  E'1 <= heights.length <= 10^5\n0 <= heights[i] <= 10^4',
  '[{"input":"heights = [2,1,5,6,2,3]","output":"10","explanation":"The largest rectangle is width 2, height 5 = 10."},{"input":"heights = [2,4]","output":"4","explanation":"Largest is [4] with area 4."}]'::jsonb,
  '{"python3": "class Solution:\n    def largestRectangleArea(self, heights: list[int]) -> int:\n        pass", "javascript": "/**\n * @param {number[]} heights\n * @return {number}\n */\nclass Solution {\n    largestRectangleArea(heights) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int largestRectangleArea(int[] heights) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int largestRectangleArea(vector<int>& heights) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.largestRectangleArea(input_data[\"heights\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.largestRectangleArea(data.heights)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    int[] heights = new Gson().fromJson(obj.get(\"heights\"), int[].class);\n    System.out.println(new Solution().largestRectangleArea(heights));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto heights = input[\"heights\"].get<std::vector<int>>();\n  Solution sol;\n  std::cout << sol.largestRectangleArea(heights);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"heights\":[2,1,5,6,2,3]}","expected_output":"10","visibility":"public","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"heights\":[2,4]}","expected_output":"4","visibility":"public","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"heights\":[1]}","expected_output":"1","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"heights\":[0]}","expected_output":"0","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"heights\":[6,7,5,2,4,5,9,3]}","expected_output":"16","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"heights\":[10000,10000,10000]}","expected_output":"30000","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"heights\":[1,1,1,1,1,1,1,1,1,1]}","expected_output":"10","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"heights\":[5,4,3,2,1]}","expected_output":"9","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144}
  ]'::jsonb,
  200, 10, 262144
),

-- ============================================================
-- TREES HARD (2)
-- ============================================================

-- 14. Binary Tree Maximum Path Sum
(
  'binary-tree-maximum-path-sum',
  'Binary Tree Maximum Path Sum',
  'hard',
  'Trees',
  ARRAY['dynamic-programming', 'tree', 'dfs'],
  E'A **path** in a binary tree is a sequence of nodes where each pair of adjacent nodes in the sequence has an edge connecting them. A node can only appear in the sequence **at most once**. Note that the path does not need to pass through the root.\n\nThe **path sum** of a path is the sum of the node''s values in the path.\n\nGiven the `root` of a binary tree (as a level-order array), return the **maximum path sum** of any **non-empty** path.',
  E'The number of nodes in the tree is in the range [1, 3 * 10^4].\n-1000 <= Node.val <= 1000',
  '[{"input":"root = [1,2,3]","output":"6","explanation":"Path 2→1→3 gives 2+1+3=6."},{"input":"root = [-10,9,20,null,null,15,7]","output":"42","explanation":"Path 15→20→7 gives 42."}]'::jsonb,
  '{"python3": "class Solution:\n    def maxPathSum(self, root: list) -> int:\n        pass", "javascript": "/**\n * @param {(number|null)[]} root\n * @return {number}\n */\nclass Solution {\n    maxPathSum(root) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int maxPathSum(Integer[] root) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int maxPathSum(vector<int>& root) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.maxPathSum(input_data[\"root\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.maxPathSum(data.root)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    JsonArray arr = obj.getAsJsonArray(\"root\");\n    Integer[] root = new Integer[arr.size()];\n    for (int i=0;i<arr.size();i++) root[i]=arr.get(i).isJsonNull()?null:arr.get(i).getAsInt();\n    System.out.println(new Solution().maxPathSum(root));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  std::vector<int> root;\n  for (auto& v : input[\"root\"]) root.push_back(v.is_null() ? -1001 : v.get<int>());\n  Solution sol;\n  std::cout << sol.maxPathSum(root);\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"root\":[1,2,3]}","expected_output":"6","visibility":"public","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"root\":[-10,9,20,null,null,15,7]}","expected_output":"42","visibility":"public","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"root\":[-3]}","expected_output":"-3","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"root\":[1,2]}","expected_output":"3","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"root\":[-1,-2,-3]}","expected_output":"-1","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"root\":[5,4,8,11,null,13,4,7,2,null,null,null,1]}","expected_output":"48","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"root\":[1000,-1000,-1000,-1000,1000,1000,-1000]}","expected_output":"3000","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144}
  ]'::jsonb,
  200, 10, 262144
),

-- 15. Serialize and Deserialize Binary Tree
(
  'serialize-deserialize-binary-tree',
  'Serialize and Deserialize Binary Tree',
  'hard',
  'Trees',
  ARRAY['string', 'tree', 'dfs', 'bfs', 'design'],
  E'Serialization is the process of converting a data structure or object into a sequence of bits so that it can be stored in a file or memory buffer, or transmitted across a network connection link to be reconstructed later in the same or another computer environment.\n\nDesign an algorithm to serialize and deserialize a binary tree. There is no restriction on how your serialization/deserialization algorithm should work. You just need to ensure that a binary tree can be serialized to a string and this string can be deserialized to the original tree structure.\n\nFor testing: given a level-order array `root`, serialize then deserialize it and verify the result matches the original level-order array.',
  E'The number of nodes in the tree is in the range [0, 10^4].\n-1000 <= Node.val <= 1000',
  '[{"input":"root = [1,2,3,null,null,4,5]","output":"[1,2,3,null,null,4,5]","explanation":"Serialize to string then deserialize back to original."},{"input":"root = []","output":"[]","explanation":"Empty tree."}]'::jsonb,
  '{"python3": "class Codec:\n    def serialize(self, root: list) -> str:\n        pass\n\n    def deserialize(self, data: str) -> list:\n        pass\n\n\nclass Solution:\n    def roundTrip(self, root: list) -> list:\n        c = Codec()\n        s = c.serialize(root)\n        return c.deserialize(s)", "javascript": "class Codec {\n    serialize(root) {}\n    deserialize(data) {}\n}\n\nclass Solution {\n    roundTrip(root) {\n        const c = new Codec();\n        return c.deserialize(c.serialize(root));\n    }\n}\n\nmodule.exports = Solution;", "java": "class Codec {\n    public String serialize(Integer[] root) { return \"\"; }\n    public Integer[] deserialize(String data) { return new Integer[0]; }\n}\n\nclass Solution {\n    public Integer[] roundTrip(Integer[] root) {\n        Codec c = new Codec();\n        return c.deserialize(c.serialize(root));\n    }\n}", "cpp": "class Codec {\npublic:\n    string serialize(vector<int>& root) { return \"\"; }\n    vector<int> deserialize(const string& data) { return {}; }\n};\n\nclass Solution {\npublic:\n    vector<int> roundTrip(vector<int>& root) {\n        Codec c;\n        return c.deserialize(c.serialize(root));\n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.roundTrip(input_data[\"root\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.roundTrip(data.root)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    JsonArray arr = obj.getAsJsonArray(\"root\");\n    Integer[] root = new Integer[arr.size()];\n    for (int i=0;i<arr.size();i++) root[i]=arr.get(i).isJsonNull()?null:arr.get(i).getAsInt();\n    System.out.println(new Gson().toJson(new Solution().roundTrip(root)));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  std::vector<int> root;\n  for (auto& v : input[\"root\"]) root.push_back(v.is_null() ? -1001 : v.get<int>());\n  Solution sol;\n  auto result = sol.roundTrip(root);\n  std::cout << json(result).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"root\":[1,2,3,null,null,4,5]}","expected_output":"[1,2,3,null,null,4,5]","visibility":"public","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"root\":[]}","expected_output":"[]","visibility":"public","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"root\":[1]}","expected_output":"[1]","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"root\":[-1000,null,1000]}","expected_output":"[-1000,null,1000]","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"root\":[5,4,7,3,null,2,null,-1,null,9]}","expected_output":"[5,4,7,3,null,2,null,-1,null,9]","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"root\":[1,2,3,4,5,6,7,8,9,10]}","expected_output":"[1,2,3,4,5,6,7,8,9,10]","visibility":"hidden","time_limit_ms":10000,"memory_limit_kb":262144}
  ]'::jsonb,
  200, 10, 262144
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
