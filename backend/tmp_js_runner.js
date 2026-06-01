// ---- Candidate code ----
function isPalindrome(x) { return x >= 0 && String(x) === String(x).split('').reverse().join(''); }
// ---- End candidate code ----

try { if (typeof isPalindrome !== 'undefined') { if (typeof globalThis !== 'undefined') { globalThis["isPalindrome"] = isPalindrome; } if (typeof global !== 'undefined') { global["isPalindrome"] = isPalindrome; } if (typeof module !== 'undefined' && module) { module.exports = module.exports || {}; if (typeof module.exports === 'object') { module.exports["isPalindrome"] = isPalindrome; } } } } catch (_e) {}
try { if (typeof Solution !== 'undefined') { if (typeof globalThis !== 'undefined') { globalThis["Solution"] = Solution; } if (typeof global !== 'undefined') { global["Solution"] = Solution; } if (typeof module !== 'undefined' && module) { module.exports = module.exports || {}; if (typeof module.exports === 'object') { module.exports["Solution"] = Solution; } } } } catch (_e) {}

// ── CommonJS export capture shim ──────────────────────────────────────────
// ES6 `class Foo {}` declarations are block-scoped and NOT added to `global`
// in Node.js. When candidates write `class Solution { ... }; module.exports = Solution;`
// the class is invisible to code above via `globalThis[CLASS_NAME]`.
// This shim captures the exported value back into a local `var` so that
// `typeof Solution !== 'undefined'` and `globalThis[CLASS_NAME]` checks work.
;(function() {
  try {
    var _exp = (typeof module !== 'undefined' && module && module.exports) ? module.exports : null;
    if (_exp && typeof _exp === 'function') {
      // module.exports = MyClass  (direct class export)
      var _name = (_exp.name && _exp.name.length > 0) ? _exp.name : 'Solution';
      if (typeof globalThis !== 'undefined') { globalThis[_name] = _exp; }
      if (typeof global !== 'undefined') { global[_name] = _exp; }
    } else if (_exp && typeof _exp === 'object') {
      // module.exports = { Solution: ... }  or  exports.Solution = ...
      Object.keys(_exp).forEach(function(k) {
        if (typeof _exp[k] === 'function') {
          if (typeof globalThis !== 'undefined') { globalThis[k] = _exp[k]; }
          if (typeof global !== 'undefined') { global[k] = _exp[k]; }
        }
      });
    }
  } catch (_e) {}
})();
// ──────────────────────────────────────────────────────────────────────────

var TEST_CASES = JSON.parse("[{\"input\": {\"x\": 121}, \"expected\": true}, {\"input\": {\"x\": -121}, \"expected\": false}, {\"input\": {\"x\": 10}, \"expected\": false}]");
var PARAM_SCHEMA = JSON.parse("[{\"name\": \"x\"}]");
var FUNCTION_NAME = "isPalindrome";
var EXECUTION_MODE = "";
var CLASS_NAME = "Solution";
var CANDIDATE_SOURCE = "function isPalindrome(x) { return x >= 0 && String(x) === String(x).split('').reverse().join(''); }";

function _nv(v, d) {
  d = d || 0;
  if (d > 8) return v;
  if (typeof v === 'string') {
    var cur = v;
    for (var i = 0; i < 4; i++) {
      var t = String(cur).trim();
      if (!t) break;
      if (!((t[0] === '{' && t[t.length - 1] === '}') || (t[0] === '[' && t[t.length - 1] === ']') || (t[0] === '"' && t[t.length - 1] === '"'))) break;
      try { var p = JSON.parse(t); if (typeof p === 'string') { cur = p; continue; } return _nv(p, d + 1); } catch (e) { break; }
    }
    var s = String(cur).trim();
    var sl = s.toLowerCase();
    if (sl === 'true') return true;
    if (sl === 'false') return false;
    if (sl === 'null' || sl === 'none') return null;
    if (/^[+-]?(?:\d+\.?\d*|\d*\.?\d+)(?:[eE][+-]?\d+)?$/.test(s)) { var n = Number(s); if (Number.isFinite(n)) return n; }
    return s;
  }
  if (v === null || typeof v === 'undefined') return null;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v;
  if (Array.isArray(v)) return v.map(function(x) { return _nv(x, d + 1); });
  if (typeof v === 'object') {
    var out = {};
    Object.keys(v).sort().forEach(function(k) { out[k] = _nv(v[k], d + 1); });
    return out;
  }
  return v;
}

function _eq(a, b) {
  if (typeof a === 'number' && typeof b === 'number') {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return String(a) === String(b);
    return Math.abs(a - b) <= 1e-6;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (!_eq(a[i], b[i])) return false;
    return true;
  }
  if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return a === b;
}

function _cmp(actual, expected) { return _eq(_nv(actual), _nv(expected)); }

function _stdinText(inputData) {
  var raw = inputData;
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw).length === 1 && Object.prototype.hasOwnProperty.call(raw, 'input')) {
    raw = raw.input;
  }
  raw = _nv(raw);
  if (raw === null || typeof raw === 'undefined') return '';
  if (typeof raw === 'string') return /\n$/.test(raw) ? raw : raw + '\n';
  if (typeof raw === 'object') return JSON.stringify(raw) + '\n';
  return String(raw) + '\n';
}

function _makeStdin(stdinText) {
  return {
    _text: stdinText,
    setEncoding: function() {},
    resume: function() {},
    on: function(event, cb) {
      if (event === 'data' && stdinText) cb(stdinText);
      if (event === 'end') cb();
      return this;
    },
    once: function(event, cb) { return this.on(event, cb); }
  };
}

function _makeRequire(stdinText) {
  var realRequire = (typeof require === 'function') ? require : null;
  return function(mod) {
    if (mod === 'fs') {
      return {
        readFileSync: function(fd) {
          if (fd === 0 || fd === '0') return stdinText;
          if (!realRequire) return stdinText;
          return realRequire('fs').readFileSync.apply(realRequire('fs'), arguments);
        }
      };
    }
    if (!realRequire) throw new Error('require is not available');
    return realRequire(mod);
  };
}

async function _runProgramCase(source, inputData) {
  var stdinText = _stdinText(inputData);
  var lines = [];
  var fakeConsole = {
    log: function() { lines.push(Array.prototype.slice.call(arguments).map(String).join(' ')); },
    warn: function() { lines.push(Array.prototype.slice.call(arguments).map(String).join(' ')); },
    error: function() { lines.push(Array.prototype.slice.call(arguments).map(String).join(' ')); }
  };
  var moduleObj = { exports: {} };
  var fakeProcess = {
    env: (typeof process !== 'undefined' && process && process.env) ? process.env : {},
    argv: (typeof process !== 'undefined' && process && process.argv) ? process.argv.slice() : [],
    stdin: _makeStdin(stdinText),
    stdout: { write: function(s) { lines.push(String(s)); } },
    stderr: { write: function(s) { lines.push(String(s)); } },
    exit: function(code) { throw new Error('Process exited with code ' + String(code)); }
  };
  var runner = new Function('require', 'module', 'exports', 'process', 'console', 'globalThis', source);
  var result = runner(_makeRequire(stdinText), moduleObj, moduleObj.exports, fakeProcess, fakeConsole, {});
  if (result && typeof result.then === 'function') await result;
  return lines.join('\n');
}

function _lookupGlobal(name) {
  if (!name) return undefined;
  try {
    if (typeof globalThis !== 'undefined' && typeof globalThis[name] !== 'undefined') return globalThis[name];
  } catch (e) {}
  try {
    if (typeof global !== 'undefined' && typeof global[name] !== 'undefined') return global[name];
  } catch (e) {}
  try {
    if (typeof module !== 'undefined' && module && module.exports) {
      if (typeof module.exports === 'function' && (module.exports.name === name || name === CLASS_NAME)) return module.exports;
      if (typeof module.exports === 'object' && typeof module.exports[name] !== 'undefined') return module.exports[name];
    }
  } catch (e) {}
  return undefined;
}

function _resolveNamedFunction(name) {
  var found = _lookupGlobal(name);
  if (typeof found === 'function') return found;
  return null;
}

function _resolveClass(name) {
  var found = _lookupGlobal(name);
  if (typeof found === 'function') return found;
  return null;
}

function _bindFirstMethod(inst) {
  var methods = Object.getOwnPropertyNames(Object.getPrototypeOf(inst)).filter(function(k) {
    return k !== 'constructor' && typeof inst[k] === 'function';
  });
  if (methods.length > 0) return inst[methods[0]].bind(inst);
  return null;
}

function _resolveFromClass(name, methodName) {
  var Klass = _resolveClass(name);
  if (!Klass) return null;
  var inst = new Klass();
  if (methodName && typeof inst[methodName] === 'function') {
    return inst[methodName].bind(inst);
  }
  return _bindFirstMethod(inst);
}

function getArgs(inputData, target) {
  var paramCount = -1;
  if (typeof target === 'function') {
    try { paramCount = target.length; } catch (e) {}
  }
  if (inputData !== null && typeof inputData === 'object' && !Array.isArray(inputData)) {
    // Unwrap {input: ...} wrapper
    if (Object.keys(inputData).length === 1 && 'input' in inputData) {
      var inner = inputData.input;
      if (inner !== null && typeof inner === 'object' && !Array.isArray(inner)) {
        if (paramCount === 1) {
          if (Array.isArray(PARAM_SCHEMA) && PARAM_SCHEMA.length === 1 && PARAM_SCHEMA[0] && Object.prototype.hasOwnProperty.call(inner, PARAM_SCHEMA[0].name)) {
            return [inner[PARAM_SCHEMA[0].name]];
          }
          var innerKeys = Object.keys(inner);
          if (innerKeys.length === 1) return [inner[innerKeys[0]]];
          return [inner];
        }
        if (Array.isArray(PARAM_SCHEMA) && PARAM_SCHEMA.length > 0) {
          return PARAM_SCHEMA.map(function(p) { return inner[p.name]; });
        }
        return Object.values(inner);
      }
      return [inner];
    }
    // Direct object input
    if (paramCount === 1) {
      if (Array.isArray(PARAM_SCHEMA) && PARAM_SCHEMA.length === 1 && PARAM_SCHEMA[0] && Object.prototype.hasOwnProperty.call(inputData, PARAM_SCHEMA[0].name)) {
        return [inputData[PARAM_SCHEMA[0].name]];
      }
      var directKeys = Object.keys(inputData);
      if (directKeys.length === 1) return [inputData[directKeys[0]]];
      return [inputData];
    }
    if (Array.isArray(PARAM_SCHEMA) && PARAM_SCHEMA.length > 0) {
      return PARAM_SCHEMA.map(function(p) { return inputData[p.name]; });
    }
    return Object.values(inputData);
  }
  if (Array.isArray(inputData)) {
    if (paramCount === 1) return [inputData];
    return inputData;
  }
  return [inputData];
}

function resolveTarget() {
  // 1. Class-based execution
  if (EXECUTION_MODE === 'class') {
    var classTarget = _resolveFromClass(CLASS_NAME, FUNCTION_NAME);
    if (!classTarget && CLASS_NAME !== 'Solution') classTarget = _resolveFromClass('Solution', FUNCTION_NAME);
    if (classTarget) return classTarget;
  }

  // 2. Named function lookup
  if (FUNCTION_NAME) {
    var found = _resolveNamedFunction(FUNCTION_NAME);
    if (typeof found === 'function') return found;

    // Try Solution class fallback
    var fallbackClassTarget = _resolveFromClass(CLASS_NAME, FUNCTION_NAME);
    if (!fallbackClassTarget && CLASS_NAME !== 'Solution') fallbackClassTarget = _resolveFromClass('Solution', FUNCTION_NAME);
    if (fallbackClassTarget) return fallbackClassTarget;
    throw new Error("Function '" + FUNCTION_NAME + "' not found. Make sure your function is declared at the top level.");
  }

  // 3. Auto-detect: Solution class first
  var autoClassTarget = _resolveFromClass(CLASS_NAME, '');
  if (!autoClassTarget && CLASS_NAME !== 'Solution') autoClassTarget = _resolveFromClass('Solution', '');
  if (autoClassTarget) return autoClassTarget;

  // 4. Find any named function in global scope
  var candidates = ['solve', 'solution', 'main', 'run', 'execute', 'process',
    'twoSum', 'threeSum', 'maxSubArray', 'maxProfit', 'isValid', 'hasCycle',
    'reverseList', 'mergeTwoLists', 'levelOrder', 'maxDepth', 'invertTree',
    'search', 'findMedian', 'longestPalindrome', 'climbStairs', 'coinChange',
    'lengthOfLongestSubstring', 'productExceptSelf', 'groupAnagrams',
    'numIslands', 'canFinish', 'rob', 'trap', 'merge', 'insert'];
  for (var i = 0; i < candidates.length; i++) {
    var c = _resolveNamedFunction(candidates[i]);
    if (typeof c === 'function') return c;
  }

  throw new Error('No callable function found in submitted code. Define a function or a Solution class with a method.');
}

// --- Per-test stdout capture ---
var _origLog = console.log;
var _origWarn = console.warn;
var _origError = console.error;
var _capturedLogs = [];

function _startCapture() {
  _capturedLogs = [];
  console.log = function() { _capturedLogs.push(Array.prototype.slice.call(arguments).map(String).join(' ')); };
  console.warn = function() { _capturedLogs.push('[WARN] ' + Array.prototype.slice.call(arguments).map(String).join(' ')); };
  console.error = function() { _capturedLogs.push('[ERROR] ' + Array.prototype.slice.call(arguments).map(String).join(' ')); };
}

function _stopCapture() {
  console.log = _origLog;
  console.warn = _origWarn;
  console.error = _origError;
  return _capturedLogs.join('\n');
}

var report = { success: true, status: 'accepted', score: 0, testcases: [] };

(async function() {
try {
  var target = null;
  try { target = resolveTarget(); } catch (_resolveErr) { target = null; }
  var passed = 0;
  for (var i = 0; i < TEST_CASES.length; i++) {
    var tc = TEST_CASES[i] || {};
    var inputData = tc.input;
    var expected = tc.expected;
    var tr = { index: i, input: inputData, expected: expected, actual: null, passed: false, status: 'NA', stdout: '', stderr: '', error: null };
    try {
      if (inputData === null || inputData === undefined) throw new Error('Testcase input is null');
      var result;
      if (typeof target === 'function') {
        _startCapture();
        var args = getArgs(inputData, target);
        result = target.apply(null, args);
        if (result && typeof result.then === 'function') result = await result;
        tr.stdout = _stopCapture();
      } else {
        tr.stdout = await _runProgramCase(CANDIDATE_SOURCE, inputData);
        result = tr.stdout.replace(/\n+$/, '');
      }
      tr.actual = result;
      tr.passed = _cmp(result, expected) || _cmp(tr.stdout.replace(/\n+$/, ''), expected);
      tr.status = tr.passed ? 'AC' : 'WA';
      if (!tr.passed) tr.stderr = JSON.stringify({ norm_actual: _nv(result), norm_expected: _nv(expected) });
      if (tr.passed) passed++;
    } catch (e) {
      try { _stopCapture(); } catch (e2) {}
      tr.status = 'RE';
      tr.error = e && e.message ? e.message : String(e);
      tr.stderr = e && e.stack ? e.stack : String(e);
    }
    report.testcases.push(tr);
  }
  var total = TEST_CASES.length;
  report.score = total ? Math.round(passed / total * 10000) / 100 : 0;
  report.success = passed === total && total > 0;
  report.status = report.success ? 'accepted' : 'wrong_answer';
} catch (e) {
  report.success = false;
  report.status = 'compile_error';
  report.stderr = e && e.stack ? e.stack : (e && e.message ? e.message : String(e));
}

_origLog('---RESULT_SEPARATOR---');
_origLog(JSON.stringify(report));
})();
