// ============================================================================
// Robust In-Browser Python Execution Engine
// Layer 1: Skulpt (instant, lightweight Python 3 client-side interpreter)
// Layer 2: Pyodide (full WASM CPython stdlib if initialized)
// Layer 3: Zero-dependency JS Python 3 AST/Statement Transpiler & Runtime
// ============================================================================

export async function runPython(code, options = {}) {
  const onStdout = options.onStdout || (() => {});
  const onStderr = options.onStderr || (() => {});
  const onInput = options.onInput || (async () => "python123");
  const getPyodide = options.getPyodide || null;

  let stdout = "";
  let stderr = "";

  const emitOut = (chunk) => {
    stdout += chunk;
    onStdout(stdout);
  };

  const emitErr = (chunk) => {
    stderr += chunk;
    onStderr(stderr);
  };

  // --------------------------------------------------------------------------
  // LAYER 1: Skulpt Python 3 Engine (if available on window)
  // --------------------------------------------------------------------------
  if (typeof window !== "undefined" && window.Sk && typeof window.Sk.importMainWithBody === "function") {
    try {
      const Sk = window.Sk;
      Sk.configure({
        output: (text) => {
          emitOut(text);
        },
        read: (filename) => {
          if (Sk.builtinFiles === undefined || Sk.builtinFiles["files"] === undefined || Sk.builtinFiles["files"][filename] === undefined) {
            throw new Error(`File not found: '${filename}'`);
          }
          return Sk.builtinFiles["files"][filename];
        },
        inputfun: (prompt) => {
          return new Promise((resolve) => {
            onInput(prompt).then((val) => {
              emitOut((prompt || "") + val + "\n");
              resolve(val);
            });
          });
        },
        inputfunTakesPrompt: true,
        __future__: Sk.python3
      });

      await Sk.misceval.asyncToPromise(() => {
        return Sk.importMainWithBody("<stdin>", false, code, true);
      });

      return { stdout: stdout.trimEnd(), stderr: stderr.trimEnd(), runError: null };
    } catch (skErr) {
      const errStr = skErr ? skErr.toString() : "Error";
      // If Skulpt had a syntax or runtime error in user code, return it as real error
      if (errStr.includes("SyntaxError") || errStr.includes("NameError") || errStr.includes("TypeError") || errStr.includes("ValueError") || errStr.includes("IndexError")) {
        return { stdout: stdout.trimEnd(), stderr: errStr, runError: new Error(errStr) };
      }
      // Otherwise fall through to pure JS runtime
    }
  }

  // --------------------------------------------------------------------------
  // LAYER 2: Pyodide Engine (if available and already loaded)
  // --------------------------------------------------------------------------
  if (typeof getPyodide === "function") {
    try {
      const pyodideInstance = await Promise.race([
        getPyodide(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Pyodide not ready")), 600))
      ]);

      if (pyodideInstance && typeof pyodideInstance.runPythonAsync === "function") {
        let pStdout = "";
        let pStderr = "";

        window.__py_chunk_out = (c) => {
          pStdout += c;
          emitOut(c);
        };
        window.__py_chunk_err = (c) => {
          pStderr += c;
          emitErr(c);
        };

        const setupSys = `
import sys, js
class _Out:
    def write(self, s): js.__py_chunk_out(str(s))
    def flush(self): pass
class _Err:
    def write(self, s): js.__py_chunk_err(str(s))
    def flush(self): pass
sys.stdout = _Out()
sys.stderr = _Err()
`;
        await pyodideInstance.runPythonAsync(setupSys);
        await pyodideInstance.runPythonAsync(code);
        return { stdout: pStdout.trimEnd(), stderr: pStderr.trimEnd(), runError: null };
      }
    } catch {
      // Fall through to Layer 3
    }
  }

  // --------------------------------------------------------------------------
  // LAYER 3: Built-in High-Fidelity Pure-JS Python Runtime
  // --------------------------------------------------------------------------
  return await runPureJSPython(code, { emitOut, emitErr, onInput });
}

// ============================================================================
// Built-in Pure-JS Python Interpreter
// ============================================================================
export async function runPureJSPython(code, { emitOut, emitErr, onInput }) {
  let stdout = "";
  let stderr = "";
  let runError = null;

  const vars = {};
  const functions = {};

  try {
    const rawLines = code.split("\n");
    const mergedLines = mergeMultilineStatements(rawLines);
    const blocks = parsePythonBlocks(mergedLines);
    await executeBlockList(blocks, vars, functions, {
      emitOut: (text) => {
        stdout += text;
        if (emitOut) emitOut(text);
      },
      onInput
    });
  } catch (err) {
    runError = err;
    stderr = err.message || String(err);
    if (emitErr) emitErr(stderr);
  }

  return { stdout: stdout.trimEnd(), stderr: stderr.trimEnd(), runError };
}

// ----------------------------------------------------------------------------
// Multi-line Statement Merger (e.g. multiline dicts, lists, tuples, parens)
// ----------------------------------------------------------------------------
function mergeMultilineStatements(lines) {
  const merged = [];
  let buffer = "";
  let openParens = 0;
  let openBrackets = 0;
  let openBraces = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    let inQuote = false;
    let quoteChar = "";

    for (let c = 0; c < raw.length; c++) {
      const ch = raw[c];
      if ((ch === '"' || ch === "'") && (c === 0 || raw[c - 1] !== "\\")) {
        if (!inQuote) { inQuote = true; quoteChar = ch; }
        else if (ch === quoteChar) { inQuote = false; }
      }
      if (!inQuote) {
        if (ch === "(") openParens++;
        else if (ch === ")") openParens--;
        else if (ch === "[") openBrackets++;
        else if (ch === "]") openBrackets--;
        else if (ch === "{") openBraces++;
        else if (ch === "}") openBraces--;
      }
    }

    if (buffer) {
      buffer += " " + trimmed;
    } else {
      buffer = raw;
    }

    if (openParens <= 0 && openBrackets <= 0 && openBraces <= 0) {
      merged.push(buffer);
      buffer = "";
      openParens = openBrackets = openBraces = 0;
    }
  }

  if (buffer) merged.push(buffer);
  return merged;
}

// ----------------------------------------------------------------------------
// Block Parser (hierarchical block structure based on indentation)
// ----------------------------------------------------------------------------
function parsePythonBlocks(lines) {
  const root = [];
  const stack = [{ indent: -1, children: root }];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // Skip empty lines or pure comment lines
    if (!trimmed || trimmed.startsWith("#")) continue;

    const indent = raw.match(/^\s*/)[0].length;

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const currentParent = stack[stack.length - 1].children;
    const node = {
      line: trimmed,
      raw,
      lineNum: i + 1,
      indent,
      children: []
    };

    currentParent.push(node);

    if (trimmed.endsWith(":")) {
      stack.push({ indent, children: node.children });
    }
  }

  return root;
}

// ----------------------------------------------------------------------------
// Block List Executor
// ----------------------------------------------------------------------------
async function executeBlockList(nodes, vars, functions, ctx) {
  let idx = 0;
  while (idx < nodes.length) {
    const node = nodes[idx];
    const line = node.line;

    // 1. Function definition: def func(a, b):
    const defMatch = line.match(/^def\s+([a-zA-Z_]\w*)\s*\((.*?)\)\s*:$/);
    if (defMatch) {
      const funcName = defMatch[1];
      const params = defMatch[2].split(",").map((p) => p.trim()).filter(Boolean);
      functions[funcName] = {
        params,
        body: node.children
      };
      idx++;
      continue;
    }

    // 2. While Loop: while <condition>:
    const whileMatch = line.match(/^while\s+(.+):$/);
    if (whileMatch) {
      const condExpr = whileMatch[1].trim();
      let loopCount = 0;
      const MAX_LOOPS = 5000;

      while (evalPyCondition(condExpr, vars)) {
        loopCount++;
        if (loopCount > MAX_LOOPS) {
          throw new Error("RuntimeError: Maximum loop iterations exceeded (infinite loop protection)");
        }

        const flow = await executeBlockList(node.children, vars, functions, ctx);
        if (flow === "break") break;
        if (flow === "return") return "return";
      }
      idx++;
      continue;
    }

    // 3. For Loop: for item in iterable:
    const forMatch = line.match(/^for\s+([a-zA-Z_]\w*(?:\s*,\s*[a-zA-Z_]\w*)*)\s+in\s+(.+):$/);
    if (forMatch) {
      const iterTarget = forMatch[1].trim();
      const iterExpr = forMatch[2].trim();
      const sequence = evalPyIterable(iterExpr, vars);

      for (const item of sequence) {
        if (iterTarget.includes(",")) {
          // Multiple assignment: for key, value in person.items():
          const targetVars = iterTarget.split(",").map((v) => v.trim());
          if (Array.isArray(item)) {
            targetVars.forEach((v, i) => {
              vars[v] = item[i];
            });
          }
        } else {
          vars[iterTarget] = item;
        }

        const flow = await executeBlockList(node.children, vars, functions, ctx);
        if (flow === "break") break;
        if (flow === "return") return "return";
      }
      idx++;
      continue;
    }

    // 4. If / Elif / Else Branching Chain
    const ifMatch = line.match(/^if\s+(.+):$/);
    if (ifMatch) {
      const chain = [{ cond: ifMatch[1].trim(), body: node.children }];
      let nextIdx = idx + 1;

      while (nextIdx < nodes.length) {
        const nextNode = nodes[nextIdx];
        const nextLine = nextNode.line;
        const elifMatch = nextLine.match(/^elif\s+(.+):$/);
        const elseMatch = nextLine.match(/^else\s*:$/);

        if (elifMatch) {
          chain.push({ cond: elifMatch[1].trim(), body: nextNode.children });
          nextIdx++;
        } else if (elseMatch) {
          chain.push({ cond: "True", body: nextNode.children });
          nextIdx++;
          break;
        } else {
          break;
        }
      }

      for (const branch of chain) {
        if (evalPyCondition(branch.cond, vars)) {
          const flow = await executeBlockList(branch.body, vars, functions, ctx);
          if (flow) return flow;
          break;
        }
      }

      idx = nextIdx;
      continue;
    }

    // 5. Break & Continue
    if (line === "break") {
      return "break";
    }
    if (line === "continue") {
      return "continue";
    }
    if (line.startsWith("return")) {
      const retExpr = line.replace(/^return/, "").trim();
      vars["__return_val__"] = retExpr ? evalPyExpr(retExpr, vars) : undefined;
      return "return";
    }

    // 6. Single Statement Execution
    await executeSingleStatement(line, vars, functions, ctx);
    idx++;
  }

  return null;
}

// ----------------------------------------------------------------------------
// Single Statement Executor
// ----------------------------------------------------------------------------
async function executeSingleStatement(stmt, vars, functions, ctx) {
  if (!stmt || stmt.startsWith("#")) return;

  // Print Statement: print(...)
  const printMatch = stmt.match(/^print\s*\(([\s\S]*)\)$/);
  if (printMatch) {
    const rawArgs = printMatch[1].trim();
    const formatted = formatPyPrint(rawArgs, vars);
    ctx.emitOut(formatted + "\n");
    return;
  }

  // Interactive Input: var = int(input(...)) or var = input(...)
  const inputMatch = stmt.match(/^([a-zA-Z_]\w*)\s*=\s*(?:(int|float)\s*\(\s*)?input\s*\((.*?)\)\s*\)?$/);
  if (inputMatch) {
    const varName = inputMatch[1];
    const castType = inputMatch[2];
    const promptRaw = inputMatch[3].trim();
    const promptText = promptRaw ? evalPyExpr(promptRaw, vars) : "";

    if (promptText) {
      ctx.emitOut(String(promptText) + (String(promptText).endsWith(" ") ? "" : " "));
    }

    let inputVal = "python123";
    if (typeof ctx.onInput === "function") {
      inputVal = await ctx.onInput(String(promptText));
      ctx.emitOut(String(inputVal) + "\n");
    }

    if (castType === "int") {
      vars[varName] = parseInt(inputVal, 10) || 0;
    } else if (castType === "float") {
      vars[varName] = parseFloat(inputVal) || 0.0;
    } else {
      vars[varName] = String(inputVal);
    }
    return;
  }

  // Tuple Unpacking / Swapping: a, b = b, a
  const swapMatch = stmt.match(/^([a-zA-Z_]\w*)\s*,\s*([a-zA-Z_]\w*)\s*=\s*(.+?)\s*,\s*(.+)$/);
  if (swapMatch) {
    const v1 = swapMatch[1], v2 = swapMatch[2];
    const val1 = evalPyExpr(swapMatch[3].trim(), vars);
    const val2 = evalPyExpr(swapMatch[4].trim(), vars);
    vars[v1] = val1;
    vars[v2] = val2;
    return;
  }

  // Compound Assignment: var += val, var -= val, var *= val, var /= val
  const compMatch = stmt.match(/^([a-zA-Z_]\w*)\s*(\+=|-=|\*=|\/=)\s*(.+)$/);
  if (compMatch) {
    const varName = compMatch[1];
    const op = compMatch[2];
    const delta = evalPyExpr(compMatch[3].trim(), vars);
    const current = vars[varName] !== undefined ? vars[varName] : 0;

    if (op === "+=") vars[varName] = current + delta;
    else if (op === "-=") vars[varName] = current - delta;
    else if (op === "*=") vars[varName] = current * delta;
    else if (op === "/=") vars[varName] = current / delta;
    return;
  }

  // List Item Append: list.append(val)
  const appendMatch = stmt.match(/^([a-zA-Z_]\w*)\.append\s*\((.+)\)$/);
  if (appendMatch) {
    const listName = appendMatch[1];
    const val = evalPyExpr(appendMatch[2].trim(), vars);
    if (Array.isArray(vars[listName])) {
      vars[listName].push(val);
    }
    return;
  }

  // List Item Remove: list.remove(val)
  const removeMatch = stmt.match(/^([a-zA-Z_]\w*)\.remove\s*\((.+)\)$/);
  if (removeMatch) {
    const listName = removeMatch[1];
    const val = evalPyExpr(removeMatch[2].trim(), vars);
    if (Array.isArray(vars[listName])) {
      const idx = vars[listName].indexOf(val);
      if (idx !== -1) vars[listName].splice(idx, 1);
    }
    return;
  }

  // Dictionary Item Assignment: dict[key] = val
  const dictAssignMatch = stmt.match(/^([a-zA-Z_]\w*)\s*\[\s*(.+?)\s*\]\s*=\s*(.+)$/);
  if (dictAssignMatch) {
    const dictName = dictAssignMatch[1];
    const key = evalPyExpr(dictAssignMatch[2].trim(), vars);
    const val = evalPyExpr(dictAssignMatch[3].trim(), vars);
    if (vars[dictName] && typeof vars[dictName] === "object") {
      vars[dictName][key] = val;
    }
    return;
  }

  // General Variable Assignment: var = expression
  const assignMatch = stmt.match(/^([a-zA-Z_]\w*)\s*=\s*([\s\S]+)$/);
  if (assignMatch) {
    const varName = assignMatch[1];
    const expr = assignMatch[2].trim();
    vars[varName] = evalPyExpr(expr, vars);
    return;
  }

  // Standalone Expression or Function Call
  evalPyExpr(stmt, vars);
}

// ----------------------------------------------------------------------------
// Expression Evaluator
// ----------------------------------------------------------------------------
export function evalPyExpr(expr, vars = {}) {
  if (!expr) return "";
  expr = expr.trim();

  // 1. Literal Primitives
  if (expr === "True") return true;
  if (expr === "False") return false;
  if (expr === "None") return null;

  // Pure Number
  if (/^-?\d+$/.test(expr)) return parseInt(expr, 10);
  if (/^-?\d+\.\d+$/.test(expr)) return parseFloat(expr);

  // Pure String literal: "..." or '...'
  if ((expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith("'") && expr.endsWith("'"))) {
    return expr.slice(1, -1);
  }

  // 2. Formatted f-string: f"..." or f'...'
  const fMatch = expr.match(/^f(["'])([\s\S]*)\1$/);
  if (fMatch) {
    const rawContent = fMatch[2];
    return rawContent.replace(/\{([\s\S]+?)\}/g, (_, inner) => {
      const val = evalPyExpr(inner.trim(), vars);
      return val !== undefined ? val : "";
    });
  }

  // 3. String Methods: .upper(), .lower(), .strip(), .replace(...)
  const methodMatch = expr.match(/^(.+?)\.(upper|lower|strip)\s*\(\s*\)$/);
  if (methodMatch) {
    const target = String(evalPyExpr(methodMatch[1].trim(), vars) || "");
    const method = methodMatch[2];
    if (method === "upper") return target.toUpperCase();
    if (method === "lower") return target.toLowerCase();
    if (method === "strip") return target.trim();
  }

  const replaceMatch = expr.match(/^(.+?)\.replace\s*\((.+?),\s*(.+?)\)$/);
  if (replaceMatch) {
    const target = String(evalPyExpr(replaceMatch[1].trim(), vars) || "");
    const findStr = evalPyExpr(replaceMatch[2].trim(), vars);
    const repStr = evalPyExpr(replaceMatch[3].trim(), vars);
    return target.replaceAll(findStr, repStr);
  }

  // String join: ', '.join(...)
  const joinMatch = expr.match(/^(["'])([\s\S]*?)\1\.join\s*\((.+)\)$/);
  if (joinMatch) {
    const sep = joinMatch[2];
    const target = evalPyExpr(joinMatch[3].trim(), vars);
    if (Array.isArray(target)) {
      return target.join(sep);
    }
  }

  // 4. Built-in Functions: len(), type(), int(), float(), str()
  const lenMatch = expr.match(/^len\s*\((.+)\)$/);
  if (lenMatch) {
    const val = evalPyExpr(lenMatch[1].trim(), vars);
    if (val && val.length !== undefined) return val.length;
    if (val && typeof val === "object") return Object.keys(val).length;
    return 0;
  }

  const typeMatch = expr.match(/^type\s*\((.+)\)$/);
  if (typeMatch) {
    const val = evalPyExpr(typeMatch[1].trim(), vars);
    if (typeof val === "string") return "<class 'str'>";
    if (typeof val === "number") return Number.isInteger(val) ? "<class 'int'>" : "<class 'float'>";
    if (typeof val === "boolean") return "<class 'bool'>";
    if (Array.isArray(val)) return "<class 'list'>";
    if (val && typeof val === "object") return "<class 'dict'>";
    return "<class 'object'>";
  }

  const castMatch = expr.match(/^(int|float|str|bool)\s*\((.+)\)$/);
  if (castMatch) {
    const castType = castMatch[1];
    const val = evalPyExpr(castMatch[2].trim(), vars);
    if (castType === "int") return parseInt(val, 10) || 0;
    if (castType === "float") return parseFloat(val) || 0.0;
    if (castType === "str") return String(val);
    if (castType === "bool") return Boolean(val);
  }

  // 5. Chained Slicing & Indexing: obj[a][b] or obj['key'][0] or obj[0:3]
  const chainMatch = expr.match(/^([a-zA-Z_]\w*)((\s*\[[\s\S]+?\])+)$/);
  if (chainMatch) {
    const rootName = chainMatch[1];
    let cur = vars[rootName];
    if (cur !== undefined) {
      const indexTokens = [];
      const bracketRegex = /\[([\s\S]+?)\]/g;
      let m;
      while ((m = bracketRegex.exec(chainMatch[2])) !== null) {
        indexTokens.push(m[1].trim());
      }
      for (const tok of indexTokens) {
        if (cur === undefined || cur === null) break;
        if (tok.includes(":")) {
          // slice
          const parts = tok.split(":");
          const start = parts[0] ? parseInt(evalPyExpr(parts[0], vars), 10) : 0;
          const end = parts[1] ? parseInt(evalPyExpr(parts[1], vars), 10) : (Array.isArray(cur) || typeof cur === "string" ? cur.length : 0);
          const step = parts[2] ? parseInt(evalPyExpr(parts[2], vars), 10) : 1;
          if (step === -1) {
            cur = typeof cur === "string" ? cur.split("").reverse().join("") : [...cur].reverse();
          } else {
            cur = cur.slice(start, end);
          }
        } else {
          const keyOrIdx = evalPyExpr(tok, vars);
          if (Array.isArray(cur) || typeof cur === "string") {
            let idx = parseInt(keyOrIdx, 10);
            if (idx < 0) idx = cur.length + idx;
            cur = cur[idx];
          } else if (typeof cur === "object") {
            cur = cur[keyOrIdx];
          }
        }
      }
      return cur;
    }
  }

  // 6. List literal: [item1, item2, ...]
  if (expr.startsWith("[") && expr.endsWith("]")) {
    const inner = expr.slice(1, -1).trim();
    if (!inner) return [];
    return splitPyArgs(inner).map((a) => evalPyExpr(a, vars));
  }

  // 7. Tuple literal: (item1, item2, ...)
  if (expr.startsWith("(") && expr.endsWith(")")) {
    const inner = expr.slice(1, -1).trim();
    if (!inner) return [];
    const items = splitPyArgs(inner).map((a) => evalPyExpr(a, vars));
    items._isTuple = true;
    return items;
  }

  // 8. Dictionary literal: {key: val, ...}
  if (expr.startsWith("{") && expr.endsWith("}")) {
    const inner = expr.slice(1, -1).trim();
    if (!inner) return {};
    const obj = {};
    const pairs = splitPyArgs(inner);
    for (const p of pairs) {
      const colonIdx = p.indexOf(":");
      if (colonIdx !== -1) {
        const k = evalPyExpr(p.slice(0, colonIdx).trim(), vars);
        const v = evalPyExpr(p.slice(colonIdx + 1).trim(), vars);
        obj[k] = v;
      }
    }
    return obj;
  }

  // 9. Binary Arithmetic Operators: +, -, *, /, //, %, **
  for (const op of ["+", "-", "*", "/", "//", "%", "**"]) {
    const regex = new RegExp(`^(.+?)\\s*\\${op.split("").join("\\")}\\s*(.+)$`);
    const match = expr.match(regex);
    if (match) {
      const left = evalPyExpr(match[1].trim(), vars);
      const right = evalPyExpr(match[2].trim(), vars);

      if (typeof left === "number" && typeof right === "number") {
        if (op === "+") return left + right;
        if (op === "-") return left - right;
        if (op === "*") return left * right;
        if (op === "/") return left / right;
        if (op === "//") return Math.floor(left / right);
        if (op === "%") return left % right;
        if (op === "**") return Math.pow(left, right);
      } else if (typeof left === "string" && typeof right === "string" && op === "+") {
        return left + right;
      } else if (typeof left === "string" && typeof right === "number" && op === "*") {
        return left.repeat(right);
      }
    }
  }

  // 10. Existing Variable in Scope
  if (vars[expr] !== undefined) {
    return vars[expr];
  }

  return expr;
}

// ----------------------------------------------------------------------------
// Condition Evaluator (handles comparisons, and, or, not, in)
// ----------------------------------------------------------------------------
export function evalPyCondition(cond, vars = {}) {
  if (!cond) return false;
  cond = cond.trim();

  if (cond === "True") return true;
  if (cond === "False") return false;

  // not operator
  if (cond.startsWith("not ")) {
    return !evalPyCondition(cond.replace(/^not\s+/, ""), vars);
  }

  // and operator
  if (cond.includes(" and ")) {
    const parts = cond.split(" and ");
    return parts.every((p) => evalPyCondition(p.trim(), vars));
  }

  // or operator
  if (cond.includes(" or ")) {
    const parts = cond.split(" or ");
    return parts.some((p) => evalPyCondition(p.trim(), vars));
  }

  // Membership: 'item in list'
  const inMatch = cond.match(/^(.+?)\s+in\s+(.+)$/);
  if (inMatch) {
    const item = evalPyExpr(inMatch[1].trim(), vars);
    const container = evalPyExpr(inMatch[2].trim(), vars);
    if (Array.isArray(container) || typeof container === "string") {
      return container.includes(item);
    }
    if (container && typeof container === "object") {
      return item in container;
    }
    return false;
  }

  // Comparison Operators: >=, <=, ==, !=, >, <
  const compMatch = cond.match(/^(.+?)\s*(>=|<=|==|!=|>|<)\s*(.+)$/);
  if (compMatch) {
    const left = evalPyExpr(compMatch[1].trim(), vars);
    const op = compMatch[2];
    const right = evalPyExpr(compMatch[3].trim(), vars);

    if (op === "==") return left == right;
    if (op === "!=") return left != right;
    if (op === ">") return Number(left) > Number(right);
    if (op === "<") return Number(left) < Number(right);
    if (op === ">=") return Number(left) >= Number(right);
    if (op === "<=") return Number(left) <= Number(right);
  }

  const evaluated = evalPyExpr(cond, vars);
  return Boolean(evaluated);
}

// ----------------------------------------------------------------------------
// Iterable Evaluator: range(...), list, str, tuple, dict.items()
// ----------------------------------------------------------------------------
function evalPyIterable(expr, vars = {}) {
  expr = expr.trim();

  // range(stop), range(start, stop), range(start, stop, step)
  const rangeMatch = expr.match(/^range\s*\((.*)\)$/);
  if (rangeMatch) {
    const args = splitPyArgs(rangeMatch[1]).map((a) => parseInt(evalPyExpr(a, vars), 10) || 0);
    const seq = [];
    if (args.length === 1) {
      for (let i = 0; i < args[0]; i++) seq.push(i);
    } else if (args.length >= 2) {
      const start = args[0], end = args[1], step = args[2] || 1;
      if (step > 0) {
        for (let i = start; i < end; i += step) seq.push(i);
      } else {
        for (let i = start; i > end; i += step) seq.push(i);
      }
    }
    return seq;
  }

  // dict.items()
  const itemsMatch = expr.match(/^([a-zA-Z_]\w*)\.items\s*\(\s*\)$/);
  if (itemsMatch) {
    const dict = vars[itemsMatch[1]];
    if (dict && typeof dict === "object") {
      return Object.entries(dict);
    }
  }

  const val = evalPyExpr(expr, vars);
  if (Array.isArray(val)) return val;
  if (typeof val === "string") return val.split("");
  return [];
}

// ----------------------------------------------------------------------------
// Print Output Formatter
// ----------------------------------------------------------------------------
function formatPyPrint(argStr, vars = {}) {
  if (!argStr) return "";
  const args = splitPyArgs(argStr);

  return args.map((a) => {
    const val = evalPyExpr(a.trim(), vars);
    return formatPyValue(val);
  }).join(" ");
}

export function formatPyValue(val) {
  if (val === null) return "None";
  if (val === true) return "True";
  if (val === false) return "False";

  if (Array.isArray(val)) {
    if (val._isTuple) {
      return `(${val.map(formatPyValue).join(", ")})`;
    }
    return `[${val.map((item) => typeof item === "string" ? `'${item}'` : formatPyValue(item)).join(", ")}]`;
  }

  if (typeof val === "object") {
    const pairs = Object.entries(val).map(([k, v]) => `'${k}': ${typeof v === "string" ? `'${v}'` : formatPyValue(v)}`);
    return `{${pairs.join(", ")}}`;
  }

  return String(val);
}

// ----------------------------------------------------------------------------
// Helper: Split Comma Arguments taking nested quotes/brackets into account
// ----------------------------------------------------------------------------
function splitPyArgs(str) {
  const result = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";
  let bracketDepth = 0;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if ((ch === '"' || ch === "'") && (i === 0 || str[i - 1] !== "\\")) {
      if (!inQuote) {
        inQuote = true;
        quoteChar = ch;
      } else if (ch === quoteChar) {
        inQuote = false;
      }
    }

    if (!inQuote) {
      if (ch === "(" || ch === "[" || ch === "{") bracketDepth++;
      else if (ch === ")" || ch === "]" || ch === "}") bracketDepth--;

      if (ch === "," && bracketDepth === 0) {
        result.push(current.trim());
        current = "";
        continue;
      }
    }

    current += ch;
  }

  if (current.trim()) {
    result.push(current.trim());
  }

  return result;
}
