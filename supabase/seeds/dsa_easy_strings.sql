-- DSA Problem Bank Expansion — EASY: Strings (Batch 2)
-- 15 new problems. Run AFTER existing seed files.
-- Every problem: 2-3 public TCs, 4-8 private/edge TCs.

INSERT INTO public.dsa_problems (slug, title, difficulty, category, tags, description, constraints, examples, starter_code, solution_wrappers, test_cases, points, time_limit_seconds, memory_limit_kb)
VALUES

-- ============================================================
-- 1. Reverse String
-- ============================================================
(
  'reverse-string',
  'Reverse String',
  'easy',
  'Strings',
  ARRAY['string', 'two-pointer', 'recursion'],
  E'Write a function that reverses a string. The input is given as an array of characters `s`.\n\nYou must do this by modifying the input array in-place with O(1) extra memory. Return the reversed array.',
  E'1 <= s.length <= 10^5\ns[i] is a printable ASCII character.',
  '[{"input":"s = [\"h\",\"e\",\"l\",\"l\",\"o\"]","output":"[\"o\",\"l\",\"l\",\"e\",\"h\"]","explanation":"Reversed in-place."},{"input":"s = [\"H\",\"a\",\"n\",\"n\",\"a\",\"h\"]","output":"[\"h\",\"a\",\"n\",\"n\",\"a\",\"H\"]","explanation":"Reversed in-place."}]'::jsonb,
  '{"python3": "class Solution:\n    def reverseString(self, s: list[str]) -> list[str]:\n        pass", "javascript": "/**\n * @param {string[]} s\n * @return {string[]}\n */\nclass Solution {\n    reverseString(s) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public String[] reverseString(String[] s) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    vector<string> reverseString(vector<string>& s) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.reverseString(input_data[\"s\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.reverseString(data.s)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    String[] s = new Gson().fromJson(obj.get(\"s\"), String[].class);\n    System.out.println(new Gson().toJson(new Solution().reverseString(s)));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto s = input[\"s\"].get<std::vector<std::string>>();\n  Solution sol;\n  auto result = sol.reverseString(s);\n  std::cout << json(result).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"s\":[\"h\",\"e\",\"l\",\"l\",\"o\"]}","expected_output":"[\"o\",\"l\",\"l\",\"e\",\"h\"]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"s\":[\"H\",\"a\",\"n\",\"n\",\"a\",\"h\"]}","expected_output":"[\"h\",\"a\",\"n\",\"n\",\"a\",\"H\"]","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"s\":[\"a\"]}","expected_output":"[\"a\"]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"s\":[\"a\",\"b\"]}","expected_output":"[\"b\",\"a\"]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"s\":[\"A\",\" \",\"b\"]}","expected_output":"[\"b\",\" \",\"A\"]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"s\":[\"1\",\"2\",\"3\",\"4\",\"5\"]}","expected_output":"[\"5\",\"4\",\"3\",\"2\",\"1\"]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"s\":[\"x\",\"x\",\"x\"]}","expected_output":"[\"x\",\"x\",\"x\"]","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- 2. Valid Anagram
-- ============================================================
(
  'valid-anagram',
  'Valid Anagram',
  'easy',
  'Strings',
  ARRAY['string', 'hash-map', 'sorting'],
  E'Given two strings `s` and `t`, return `true` if `t` is an anagram of `s`, and `false` otherwise.\n\nAn **anagram** is a word or phrase formed by rearranging the letters of a different word or phrase, typically using all the original letters exactly once.',
  E'1 <= s.length, t.length <= 5 * 10^4\ns and t consist of lowercase English letters.',
  '[{"input":"s = \"anagram\", t = \"nagaram\"","output":"true","explanation":"nagaram is an anagram of anagram."},{"input":"s = \"rat\", t = \"car\"","output":"false","explanation":"rat and car do not share the same characters."}]'::jsonb,
  '{"python3": "class Solution:\n    def isAnagram(self, s: str, t: str) -> bool:\n        pass", "javascript": "/**\n * @param {string} s\n * @param {string} t\n * @return {boolean}\n */\nclass Solution {\n    isAnagram(s, t) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public boolean isAnagram(String s, String t) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    bool isAnagram(string s, string t) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.isAnagram(input_data[\"s\"], input_data[\"t\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.isAnagram(data.s, data.t)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Solution().isAnagram(obj.get(\"s\").getAsString(), obj.get(\"t\").getAsString()));\n  }\n}", "cpp": "#include <iostream>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << json(sol.isAnagram(input[\"s\"].get<std::string>(), input[\"t\"].get<std::string>())).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"s\":\"anagram\",\"t\":\"nagaram\"}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"s\":\"rat\",\"t\":\"car\"}","expected_output":"false","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"s\":\"a\",\"t\":\"a\"}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"s\":\"a\",\"t\":\"ab\"}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"s\":\"listen\",\"t\":\"silent\"}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"s\":\"aaaa\",\"t\":\"aaab\"}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"s\":\"aab\",\"t\":\"baa\"}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"s\":\"z\",\"t\":\"z\"}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- 3. First Unique Character in a String
-- ============================================================
(
  'first-unique-character',
  'First Unique Character in a String',
  'easy',
  'Strings',
  ARRAY['string', 'hash-map', 'queue'],
  E'Given a string `s`, find the first non-repeating character in it and return its **index**. If it does not exist, return `-1`.',
  E'1 <= s.length <= 10^5\ns consists of only lowercase English letters.',
  '[{"input":"s = \"leetcode\"","output":"0","explanation":"''l'' is the first unique character."},{"input":"s = \"loveleetcode\"","output":"2","explanation":"''v'' at index 2 is the first unique character."},{"input":"s = \"aabb\"","output":"-1","explanation":"No unique character."}]'::jsonb,
  '{"python3": "class Solution:\n    def firstUniqChar(self, s: str) -> int:\n        pass", "javascript": "/**\n * @param {string} s\n * @return {number}\n */\nclass Solution {\n    firstUniqChar(s) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int firstUniqChar(String s) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int firstUniqChar(string s) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.firstUniqChar(input_data[\"s\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.firstUniqChar(data.s)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Solution().firstUniqChar(obj.get(\"s\").getAsString()));\n  }\n}", "cpp": "#include <iostream>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << sol.firstUniqChar(input[\"s\"].get<std::string>());\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"s\":\"leetcode\"}","expected_output":"0","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"s\":\"loveleetcode\"}","expected_output":"2","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"s\":\"aabb\"}","expected_output":"-1","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"s\":\"z\"}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"s\":\"aabbcc\"}","expected_output":"-1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"s\":\"abcabc\"}","expected_output":"-1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"s\":\"dddccdbba\"}","expected_output":"8","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"s\":\"aababcabcda\"}","expected_output":"10","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- 4. Longest Common Prefix
-- ============================================================
(
  'longest-common-prefix',
  'Longest Common Prefix',
  'easy',
  'Strings',
  ARRAY['string', 'trie', 'sorting'],
  E'Write a function to find the longest common prefix string amongst an array of strings.\n\nIf there is no common prefix, return an empty string `""`.',
  E'1 <= strs.length <= 200\n0 <= strs[i].length <= 200\nstrs[i] consists of only lowercase English letters.',
  '[{"input":"strs = [\"flower\",\"flow\",\"flight\"]","output":"\"fl\"","explanation":"The longest common prefix is \"fl\"."},{"input":"strs = [\"dog\",\"racecar\",\"car\"]","output":"\"\"","explanation":"There is no common prefix."}]'::jsonb,
  '{"python3": "class Solution:\n    def longestCommonPrefix(self, strs: list[str]) -> str:\n        pass", "javascript": "/**\n * @param {string[]} strs\n * @return {string}\n */\nclass Solution {\n    longestCommonPrefix(strs) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public String longestCommonPrefix(String[] strs) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    string longestCommonPrefix(vector<string>& strs) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.longestCommonPrefix(input_data[\"strs\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.longestCommonPrefix(data.strs)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    String[] strs = new Gson().fromJson(obj.get(\"strs\"), String[].class);\n    System.out.println(new Gson().toJson(new Solution().longestCommonPrefix(strs)));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto strs = input[\"strs\"].get<std::vector<std::string>>();\n  Solution sol;\n  std::cout << json(sol.longestCommonPrefix(strs)).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"strs\":[\"flower\",\"flow\",\"flight\"]}","expected_output":"\"fl\"","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"strs\":[\"dog\",\"racecar\",\"car\"]}","expected_output":"\"\"","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"strs\":[\"interview\"]}","expected_output":"\"interview\"","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"strs\":[\"\"]}","expected_output":"\"\"","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"strs\":[\"a\",\"a\",\"a\"]}","expected_output":"\"a\"","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"strs\":[\"abc\",\"abcd\",\"ab\"]}","expected_output":"\"ab\"","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"strs\":[\"zzz\",\"zzz\",\"zzz\"]}","expected_output":"\"zzz\"","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"strs\":[\"a\",\"b\"]}","expected_output":"\"\"","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- 5. Is Subsequence
-- ============================================================
(
  'is-subsequence',
  'Is Subsequence',
  'easy',
  'Strings',
  ARRAY['string', 'two-pointer', 'dynamic-programming'],
  E'Given two strings `s` and `t`, return `true` if `s` is a **subsequence** of `t`, or `false` otherwise.\n\nA **subsequence** of a string is a sequence that can be derived from it by deleting some (or no) characters without disturbing the relative order of the remaining characters.',
  E'0 <= s.length <= 100\n0 <= t.length <= 10^4\ns and t consist only of lowercase English letters.',
  '[{"input":"s = \"ace\", t = \"abcde\"","output":"true","explanation":"a,c,e are in t in order."},{"input":"s = \"aec\", t = \"abcde\"","output":"false","explanation":"e comes before c in t, so aec is not a subsequence."}]'::jsonb,
  '{"python3": "class Solution:\n    def isSubsequence(self, s: str, t: str) -> bool:\n        pass", "javascript": "/**\n * @param {string} s\n * @param {string} t\n * @return {boolean}\n */\nclass Solution {\n    isSubsequence(s, t) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public boolean isSubsequence(String s, String t) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    bool isSubsequence(string s, string t) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.isSubsequence(input_data[\"s\"], input_data[\"t\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.isSubsequence(data.s, data.t)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Solution().isSubsequence(obj.get(\"s\").getAsString(), obj.get(\"t\").getAsString()));\n  }\n}", "cpp": "#include <iostream>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << json(sol.isSubsequence(input[\"s\"].get<std::string>(), input[\"t\"].get<std::string>())).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"s\":\"ace\",\"t\":\"abcde\"}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"s\":\"aec\",\"t\":\"abcde\"}","expected_output":"false","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"s\":\"\",\"t\":\"ahbgdc\"}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"s\":\"b\",\"t\":\"abc\"}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"s\":\"axc\",\"t\":\"ahbgdc\"}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"s\":\"abc\",\"t\":\"abc\"}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"s\":\"abc\",\"t\":\"ab\"}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"s\":\"aaaa\",\"t\":\"aaaaaa\"}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- 6. Reverse Words in a String III
-- ============================================================
(
  'reverse-words-in-string-iii',
  'Reverse Words in a String III',
  'easy',
  'Strings',
  ARRAY['string', 'two-pointer'],
  E'Given a string `s`, reverse the order of characters in each word within a sentence while still preserving whitespace and the initial word order.',
  E'1 <= s.length <= 5 * 10^4\ns contains printable ASCII characters.\ns does not contain any leading or trailing spaces.\nThere is at least one word in s.\nAll the words in s are separated by a single space.',
  '[{"input":"s = \"Let us go to the gym\"","output":"\"teL su og ot eht myg\"","explanation":"Each word is reversed individually."},{"input":"s = \"God Ding\"","output":"\"doG gniD\"","explanation":"Each word reversed."}]'::jsonb,
  '{"python3": "class Solution:\n    def reverseWords(self, s: str) -> str:\n        pass", "javascript": "/**\n * @param {string} s\n * @return {string}\n */\nclass Solution {\n    reverseWords(s) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public String reverseWords(String s) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    string reverseWords(string s) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.reverseWords(input_data[\"s\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.reverseWords(data.s)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Gson().toJson(new Solution().reverseWords(obj.get(\"s\").getAsString())));\n  }\n}", "cpp": "#include <iostream>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << json(sol.reverseWords(input[\"s\"].get<std::string>())).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"s\":\"Let us go to the gym\"}","expected_output":"\"teL su og ot eht myg\"","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"s\":\"God Ding\"}","expected_output":"\"doG gniD\"","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"s\":\"hello\"}","expected_output":"\"olleh\"","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"s\":\"a\"}","expected_output":"\"a\"","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"s\":\"abc def ghi\"}","expected_output":"\"cba fed ihg\"","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"s\":\"racecar\"}","expected_output":"\"racecar\"","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"s\":\"I love programming\"}","expected_output":"\"I evol gnimmargorp\"","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- 7. Count Vowels in a String
-- ============================================================
(
  'count-vowels-in-string',
  'Count Vowels in a String',
  'easy',
  'Strings',
  ARRAY['string', 'iteration'],
  E'Given a string `word`, return the **sum** of the number of vowels (`''a''`, `''e''`, `''i''`, `''o''`, and `''u''`) in every substring of `word` of length `k`.\n\nAlternatively (simpler version): Given a string `word`, return the total number of vowels (a, e, i, o, u, both upper and lower case) in the string.',
  E'1 <= word.length <= 10^5\nword consists of letters (both uppercase and lowercase).',
  '[{"input":"word = \"Programming\"","output":"3","explanation":"Vowels are o, a, i — total 3."},{"input":"word = \"aeiou\"","output":"5","explanation":"All characters are vowels."},{"input":"word = \"xyz\"","output":"0","explanation":"No vowels."}]'::jsonb,
  '{"python3": "class Solution:\n    def countVowels(self, word: str) -> int:\n        pass", "javascript": "/**\n * @param {string} word\n * @return {number}\n */\nclass Solution {\n    countVowels(word) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int countVowels(String word) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int countVowels(string word) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.countVowels(input_data[\"word\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.countVowels(data.word)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Solution().countVowels(obj.get(\"word\").getAsString()));\n  }\n}", "cpp": "#include <iostream>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << sol.countVowels(input[\"word\"].get<std::string>());\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"word\":\"Programming\"}","expected_output":"3","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"word\":\"aeiou\"}","expected_output":"5","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"word\":\"xyz\"}","expected_output":"0","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"word\":\"a\"}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"word\":\"AEIOU\"}","expected_output":"5","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"word\":\"bcdfghjklmnpqrstvwxyz\"}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"word\":\"Interview\"}","expected_output":"4","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"word\":\"AaEeIiOoUu\"}","expected_output":"10","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- 8. Roman to Integer
-- ============================================================
(
  'roman-to-integer',
  'Roman to Integer',
  'easy',
  'Strings',
  ARRAY['string', 'hash-map', 'math'],
  E'Roman numerals are represented by seven different symbols: I, V, X, L, C, D and M.\n\nGiven a roman numeral, convert it to an integer.\n\nSymbol values: I=1, V=5, X=10, L=50, C=100, D=500, M=1000\n\nIV=4, IX=9, XL=40, XC=90, CD=400, CM=900.',
  E'1 <= s.length <= 15\ns contains only the characters (''I'', ''V'', ''X'', ''L'', ''C'', ''D'', ''M'').\nIt is guaranteed that s is a valid roman numeral in the range [1, 3999].',
  '[{"input":"s = \"III\"","output":"3","explanation":"I + I + I = 3."},{"input":"s = \"LVIII\"","output":"58","explanation":"L=50, V=5, III=3."},{"input":"s = \"MCMXCIV\"","output":"1994","explanation":"M=1000, CM=900, XC=90, IV=4."}]'::jsonb,
  '{"python3": "class Solution:\n    def romanToInt(self, s: str) -> int:\n        pass", "javascript": "/**\n * @param {string} s\n * @return {number}\n */\nclass Solution {\n    romanToInt(s) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int romanToInt(String s) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int romanToInt(string s) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.romanToInt(input_data[\"s\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.romanToInt(data.s)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Solution().romanToInt(obj.get(\"s\").getAsString()));\n  }\n}", "cpp": "#include <iostream>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << sol.romanToInt(input[\"s\"].get<std::string>());\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"s\":\"III\"}","expected_output":"3","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"s\":\"LVIII\"}","expected_output":"58","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"s\":\"MCMXCIV\"}","expected_output":"1994","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"s\":\"I\"}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"s\":\"IV\"}","expected_output":"4","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"s\":\"IX\"}","expected_output":"9","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"s\":\"MMMDCCXLIX\"}","expected_output":"3749","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"s\":\"MMMCMXCIX\"}","expected_output":"3999","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- 9. Detect Capital
-- ============================================================
(
  'detect-capital',
  'Detect Capital',
  'easy',
  'Strings',
  ARRAY['string'],
  E'We define the usage of capitals in a word to be right when one of the following cases holds:\n\n1. All letters in this word are capitals, like `"USA"`.\n2. All letters in this word are not capitals, like `"leetcode"`.\n3. Only the first letter in this word is capital, like `"Google"`.\n\nGiven a string `word`, return `true` if the usage of capitals in it is right.',
  E'1 <= word.length <= 100\nword consists of lowercase and uppercase English letters.',
  '[{"input":"word = \"USA\"","output":"true","explanation":"All capitals."},{"input":"word = \"FlaG\"","output":"false","explanation":"Mixed capitalization does not match any valid pattern."}]'::jsonb,
  '{"python3": "class Solution:\n    def detectCapitalUse(self, word: str) -> bool:\n        pass", "javascript": "/**\n * @param {string} word\n * @return {boolean}\n */\nclass Solution {\n    detectCapitalUse(word) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public boolean detectCapitalUse(String word) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    bool detectCapitalUse(string word) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.detectCapitalUse(input_data[\"word\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.detectCapitalUse(data.word)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Solution().detectCapitalUse(obj.get(\"word\").getAsString()));\n  }\n}", "cpp": "#include <iostream>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << json(sol.detectCapitalUse(input[\"word\"].get<std::string>())).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"word\":\"USA\"}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"word\":\"FlaG\"}","expected_output":"false","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"word\":\"leetcode\"}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"word\":\"g\"}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"word\":\"G\"}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"word\":\"Google\"}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"word\":\"gOOGLE\"}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"word\":\"MiXeD\"}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- 10. String Compression
-- ============================================================
(
  'string-compression',
  'String Compression',
  'easy',
  'Strings',
  ARRAY['string', 'two-pointer'],
  E'Given an array of characters `chars`, compress it using the following algorithm:\n\nBegin with an empty string `s`. For each group of **consecutive repeating characters** in `chars`:\n- If the group''s length is 1, append the character to s.\n- Otherwise, append the character followed by the group''s length.\n\nReturn the compressed string (as a string, not array length).',
  E'1 <= chars.length <= 2000\nchars[i] is a lowercase English letter, uppercase English letter, digit, or symbol.',
  '[{"input":"chars = [\"a\",\"a\",\"b\",\"b\",\"c\",\"c\",\"c\"]","output":"\"a2b2c3\"","explanation":"a×2, b×2, c×3."},{"input":"chars = [\"a\"]","output":"\"a\"","explanation":"Single char, no compression."},{"input":"chars = [\"a\",\"b\",\"b\",\"b\",\"b\",\"b\",\"b\",\"b\",\"b\",\"b\",\"b\",\"b\",\"b\"]","output":"\"ab12\"","explanation":"a×1, b×12."}]'::jsonb,
  '{"python3": "class Solution:\n    def compress(self, chars: list[str]) -> str:\n        pass", "javascript": "/**\n * @param {string[]} chars\n * @return {string}\n */\nclass Solution {\n    compress(chars) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public String compress(char[] chars) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    string compress(vector<char>& chars) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.compress(input_data[\"chars\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.compress(data.chars)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    char[] chars = new Gson().fromJson(obj.get(\"chars\"), String.class).toCharArray();\n    System.out.println(new Gson().toJson(new Solution().compress(chars)));\n  }\n}", "cpp": "#include <iostream>\n#include <vector>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  auto arr = input[\"chars\"].get<std::vector<std::string>>();\n  std::vector<char> chars;\n  for (auto& s : arr) if (!s.empty()) chars.push_back(s[0]);\n  Solution sol;\n  std::cout << json(sol.compress(chars)).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"chars\":[\"a\",\"a\",\"b\",\"b\",\"c\",\"c\",\"c\"]}","expected_output":"\"a2b2c3\"","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"chars\":[\"a\"]}","expected_output":"\"a\"","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"chars\":[\"a\",\"b\",\"b\",\"b\",\"b\",\"b\",\"b\",\"b\",\"b\",\"b\",\"b\",\"b\",\"b\"]}","expected_output":"\"ab12\"","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"chars\":[\"a\",\"a\",\"a\"]}","expected_output":"\"a3\"","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"chars\":[\"a\",\"b\",\"c\"]}","expected_output":"\"abc\"","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"chars\":[\"x\",\"x\",\"x\",\"x\",\"x\",\"x\",\"x\",\"x\",\"x\",\"x\"]}","expected_output":"\"x10\"","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"chars\":[\"a\",\"a\",\"a\",\"b\"]}","expected_output":"\"a3b\"","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- 11. Count Binary Substrings
-- ============================================================
(
  'count-binary-substrings',
  'Count Binary Substrings',
  'easy',
  'Strings',
  ARRAY['string', 'two-pointer'],
  E'Given a binary string `s`, return the number of non-empty substrings that have the same number of `0`''s and `1`''s, and all the `0`''s and all the `1`''s in these substrings are grouped consecutively.\n\nSubstrings that occur multiple times are counted the number of times they occur.',
  E'1 <= s.length <= 10^5\ns[i] is either ''0'' or ''1''.',
  '[{"input":"s = \"00110011\"","output":"6","explanation":"Substrings: [0011, 01, 1100, 10, 0011, 01] — all valid."},{"input":"s = \"10101\"","output":"4","explanation":"Substrings [10,01,10,01] are valid."}]'::jsonb,
  '{"python3": "class Solution:\n    def countBinarySubstrings(self, s: str) -> int:\n        pass", "javascript": "/**\n * @param {string} s\n * @return {number}\n */\nclass Solution {\n    countBinarySubstrings(s) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public int countBinarySubstrings(String s) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    int countBinarySubstrings(string s) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.countBinarySubstrings(input_data[\"s\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.countBinarySubstrings(data.s)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Solution().countBinarySubstrings(obj.get(\"s\").getAsString()));\n  }\n}", "cpp": "#include <iostream>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << sol.countBinarySubstrings(input[\"s\"].get<std::string>());\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"s\":\"00110011\"}","expected_output":"6","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"s\":\"10101\"}","expected_output":"4","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"s\":\"0\"}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"s\":\"01\"}","expected_output":"1","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"s\":\"0011\"}","expected_output":"2","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"s\":\"000111\"}","expected_output":"3","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"s\":\"0000\"}","expected_output":"0","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- 12. Check If the Sentence Is Pangram
-- ============================================================
(
  'check-pangram',
  'Check if the Sentence Is Pangram',
  'easy',
  'Strings',
  ARRAY['string', 'hash-set'],
  E'A **pangram** is a sentence where every letter of the English alphabet appears at least once.\n\nGiven a string `sentence` containing only lowercase English letters, return `true` if `sentence` is a pangram, or `false` otherwise.',
  E'1 <= sentence.length <= 1000\nsentence consists of lowercase English letters.',
  '[{"input":"sentence = \"thequickbrownfoxjumpsoverthelazydog\"","output":"true","explanation":"Contains every letter of the alphabet."},{"input":"sentence = \"leetcode\"","output":"false","explanation":"Missing many letters."}]'::jsonb,
  '{"python3": "class Solution:\n    def checkIfPangram(self, sentence: str) -> bool:\n        pass", "javascript": "/**\n * @param {string} sentence\n * @return {boolean}\n */\nclass Solution {\n    checkIfPangram(sentence) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public boolean checkIfPangram(String sentence) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    bool checkIfPangram(string sentence) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.checkIfPangram(input_data[\"sentence\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.checkIfPangram(data.sentence)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Solution().checkIfPangram(obj.get(\"sentence\").getAsString()));\n  }\n}", "cpp": "#include <iostream>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << json(sol.checkIfPangram(input[\"sentence\"].get<std::string>())).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"sentence\":\"thequickbrownfoxjumpsoverthelazydog\"}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"sentence\":\"leetcode\"}","expected_output":"false","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"sentence\":\"abcdefghijklmnopqrstuvwxyz\"}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"sentence\":\"a\"}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"sentence\":\"abcdefghijklmnopqrstuvwxy\"}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"sentence\":\"abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz\"}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"sentence\":\"packjudgesmywolvesquintzofix\"}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- 13. To Lower Case
-- ============================================================
(
  'to-lower-case',
  'To Lower Case',
  'easy',
  'Strings',
  ARRAY['string'],
  E'Given a string `s`, return the string after replacing every uppercase letter with the same lowercase letter.\n\nDo not use any built-in `lower()` or `toLowerCase()` method — implement the conversion yourself using ASCII values.',
  E'1 <= s.length <= 100\ns consists of printable ASCII characters.',
  '[{"input":"s = \"Hello\"","output":"\"hello\"","explanation":"H becomes h."},{"input":"s = \"here\"","output":"\"here\"","explanation":"Already lowercase."},{"input":"s = \"LOVELY\"","output":"\"lovely\"","explanation":"All uppercase letters converted."}]'::jsonb,
  '{"python3": "class Solution:\n    def toLowerCase(self, s: str) -> str:\n        pass", "javascript": "/**\n * @param {string} s\n * @return {string}\n */\nclass Solution {\n    toLowerCase(s) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public String toLowerCase(String s) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    string toLowerCase(string s) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.toLowerCase(input_data[\"s\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.toLowerCase(data.s)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Gson().toJson(new Solution().toLowerCase(obj.get(\"s\").getAsString())));\n  }\n}", "cpp": "#include <iostream>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << json(sol.toLowerCase(input[\"s\"].get<std::string>())).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"s\":\"Hello\"}","expected_output":"\"hello\"","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"s\":\"here\"}","expected_output":"\"here\"","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"s\":\"LOVELY\"}","expected_output":"\"lovely\"","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"s\":\"A\"}","expected_output":"\"a\"","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"s\":\"z\"}","expected_output":"\"z\"","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"s\":\"ABC123\"}","expected_output":"\"abc123\"","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"s\":\"AlTeRnAtInG\"}","expected_output":"\"alternating\"","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- 14. Word Pattern
-- ============================================================
(
  'word-pattern',
  'Word Pattern',
  'easy',
  'Strings',
  ARRAY['string', 'hash-map'],
  E'Given a `pattern` and a string `s`, find if `s` follows the same pattern.\n\nHere **follow** means a full match, such that there is a bijection between a letter in `pattern` and a **non-empty word** in `s`.',
  E'1 <= pattern.length <= 300\npattern contains only lower-case English letters.\n1 <= s.length <= 3000\ns contains only lowercase English letters and spaces.\ns does not contain any leading or trailing spaces.\nAll the words in s are separated by a single space.',
  '[{"input":"pattern = \"abba\", s = \"dog cat cat dog\"","output":"true","explanation":"a→dog, b→cat bijection holds."},{"input":"pattern = \"abba\", s = \"dog cat cat fish\"","output":"false","explanation":"a maps to both dog and fish."},{"input":"pattern = \"aaaa\", s = \"dog cat cat dog\"","output":"false","explanation":"a maps to dog and cat."}]'::jsonb,
  '{"python3": "class Solution:\n    def wordPattern(self, pattern: str, s: str) -> bool:\n        pass", "javascript": "/**\n * @param {string} pattern\n * @param {string} s\n * @return {boolean}\n */\nclass Solution {\n    wordPattern(pattern, s) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public boolean wordPattern(String pattern, String s) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    bool wordPattern(string pattern, string s) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.wordPattern(input_data[\"pattern\"], input_data[\"s\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.wordPattern(data.pattern, data.s)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Solution().wordPattern(obj.get(\"pattern\").getAsString(), obj.get(\"s\").getAsString()));\n  }\n}", "cpp": "#include <iostream>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << json(sol.wordPattern(input[\"pattern\"].get<std::string>(), input[\"s\"].get<std::string>())).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"pattern\":\"abba\",\"s\":\"dog cat cat dog\"}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"pattern\":\"abba\",\"s\":\"dog cat cat fish\"}","expected_output":"false","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"pattern\":\"aaaa\",\"s\":\"dog cat cat dog\"}","expected_output":"false","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"pattern\":\"aabb\",\"s\":\"dog dog cat cat\"}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"pattern\":\"a\",\"s\":\"dog\"}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"pattern\":\"ab\",\"s\":\"dog dog\"}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"pattern\":\"abc\",\"s\":\"dog cat dog\"}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"pattern\":\"abcabc\",\"s\":\"one two three one two three\"}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
  ]'::jsonb,
  50, 5, 262144
),

-- ============================================================
-- 15. Ransom Note
-- ============================================================
(
  'ransom-note',
  'Ransom Note',
  'easy',
  'Strings',
  ARRAY['string', 'hash-map', 'counting'],
  E'Given two strings `ransomNote` and `magazine`, return `true` if `ransomNote` can be constructed by using the letters from `magazine` and `false` otherwise.\n\nEach letter in `magazine` can only be used once in `ransomNote`.',
  E'1 <= ransomNote.length, magazine.length <= 10^5\nransomNote and magazine consist of lowercase English letters.',
  '[{"input":"ransomNote = \"a\", magazine = \"b\"","output":"false","explanation":"Cannot make ''a'' from ''b''."},{"input":"ransomNote = \"aa\", magazine = \"ab\"","output":"false","explanation":"Only one ''a'' available in magazine."},{"input":"ransomNote = \"aa\", magazine = \"aab\"","output":"true","explanation":"Two ''a''s available in magazine."}]'::jsonb,
  '{"python3": "class Solution:\n    def canConstruct(self, ransomNote: str, magazine: str) -> bool:\n        pass", "javascript": "/**\n * @param {string} ransomNote\n * @param {string} magazine\n * @return {boolean}\n */\nclass Solution {\n    canConstruct(ransomNote, magazine) {\n        \n    }\n}\n\nmodule.exports = Solution;", "java": "class Solution {\n    public boolean canConstruct(String ransomNote, String magazine) {\n        \n    }\n}", "cpp": "class Solution {\npublic:\n    bool canConstruct(string ransomNote, string magazine) {\n        \n    }\n};"}'::jsonb,
  '{"python3": "import json, sys\ninput_data = json.loads(sys.stdin.read())\nsol = Solution()\nresult = sol.canConstruct(input_data[\"ransomNote\"], input_data[\"magazine\"])\nprint(json.dumps(result))", "javascript": "const readline = require(''readline'');\nlet input = '''';\nprocess.stdin.on(''data'', d => input += d);\nprocess.stdin.on(''end'', () => {\n  const data = JSON.parse(input);\n  const sol = new Solution();\n  console.log(JSON.stringify(sol.canConstruct(data.ransomNote, data.magazine)));\n});", "java": "import java.util.*;\nimport com.google.gson.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    JsonObject obj = JsonParser.parseString(sc.nextLine()).getAsJsonObject();\n    System.out.println(new Solution().canConstruct(obj.get(\"ransomNote\").getAsString(), obj.get(\"magazine\").getAsString()));\n  }\n}", "cpp": "#include <iostream>\n#include <string>\n#include <nlohmann/json.hpp>\nusing json = nlohmann::json;\nint main() {\n  json input;\n  std::cin >> input;\n  Solution sol;\n  std::cout << json(sol.canConstruct(input[\"ransomNote\"].get<std::string>(), input[\"magazine\"].get<std::string>())).dump();\n}"}'::jsonb,
  '[
    {"id":"tc1","input":"{\"ransomNote\":\"a\",\"magazine\":\"b\"}","expected_output":"false","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc2","input":"{\"ransomNote\":\"aa\",\"magazine\":\"ab\"}","expected_output":"false","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc3","input":"{\"ransomNote\":\"aa\",\"magazine\":\"aab\"}","expected_output":"true","visibility":"public","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc4","input":"{\"ransomNote\":\"a\",\"magazine\":\"a\"}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc5","input":"{\"ransomNote\":\"bg\",\"magazine\":\"efjbdfbdgfjhhaiigfhbaejahgfbbgbjagbddfgdiaigdadhcfcj\"}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc6","input":"{\"ransomNote\":\"aab\",\"magazine\":\"baa\"}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc7","input":"{\"ransomNote\":\"abc\",\"magazine\":\"ab\"}","expected_output":"false","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144},
    {"id":"tc8","input":"{\"ransomNote\":\"zzz\",\"magazine\":\"zzzzzz\"}","expected_output":"true","visibility":"hidden","time_limit_ms":5000,"memory_limit_kb":262144}
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
