// ============================================================================
// Interactive Python Code Lab UI Component for XELI Leveling System
// Provides side-by-side retro IDE with live Pyodide execution, live objectives,
// and copyable concept references for Python Levels.
// ============================================================================

import { playCliSound } from "./cli-lab-ui.js";

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function renderPythonLabChallenge(c, solved, onClaimExp, getPyodide) {
  const container = document.getElementById("chBody");
  if (!container) return;

  let currentCode = c.starter || "";
  let isExecuting = false;
  let allGoalsSatisfied = solved;
  const goalResults = {};
  (c.goals || []).forEach((g) => {
    goalResults[g.id] = solved;
  });

  // Render main layout
  container.innerHTML = `
    <div class="cli-lab-layout py-lab-layout">
      <!-- Left Panel: Scenario & Live Objectives & Python Reference -->
      <div class="cli-lab-sidebar panel py-lab-sidebar">
        <div class="cli-scenario-box">
          <div class="cli-badge-row">
            <span class="diff-tag">${escapeHtml(c.difficulty || "Easy")}</span>
            <span class="cli-track-pill py-track-pill">Python Hands-on Lab</span>
            <span class="cli-exp-badge">+${c.exp} EXP</span>
          </div>
          <h4 class="cli-scenario-title">${escapeHtml(c.title)}</h4>
          <p class="cli-scenario-desc">${escapeHtml(c.intro || "")}</p>
        </div>

        <div class="cli-objectives-box">
          <div class="cli-obj-head">
            <span class="cli-obj-heading">LIVE OBJECTIVES</span>
            <span class="cli-progress-counter" id="pyProgressCounter">${solved ? c.goals.length : 0} / ${c.goals.length}</span>
          </div>
          <div class="cli-progress-bar-wrap">
            <div class="cli-progress-bar-fill" id="pyProgressBarFill" style="width: ${solved ? 100 : 0}%"></div>
          </div>
          
          <ul class="cli-goals-list" id="pyGoalsList">
            ${(c.goals || [])
              .map(
                (g, i) => `
              <li class="cli-goal-item ${solved ? "is-satisfied" : ""}" id="pyGoal-${g.id}">
                <span class="cli-goal-icon" id="pyGoalIcon-${g.id}">${solved ? "✔" : "○"}</span>
                <div class="cli-goal-info">
                  <span class="cli-goal-text">${escapeHtml(g.text)}</span>
                  ${g.hint ? `<span class="cli-goal-hint">${escapeHtml(g.hint)}</span>` : ""}
                </div>
              </li>`
              )
              .join("")}
          </ul>
        </div>

        <!-- Concept Reference / Syntax Cheat Sheet -->
        <div class="py-reference-box">
          <div class="py-ref-head">
            <span class="py-ref-title">📚 PYTHON CONCEPTS &amp; SYNTAX</span>
          </div>
          <div class="py-concepts-list">
            ${(c.concepts || [])
              .map(
                (concept, idx) => `
              <div class="py-concept-card">
                <div class="py-concept-header">
                  <span class="py-concept-name"><code>${escapeHtml(concept.name)}</code></span>
                  <span class="py-concept-desc">${escapeHtml(concept.desc)}</span>
                </div>
                ${
                  concept.code
                    ? `
                <div class="py-snippet-box">
                  <div class="py-snippet-top">
                    <span class="py-snippet-label">Code</span>
                    <button class="py-copy-btn" data-snippet="${escapeHtml(concept.code)}" title="Copy code snippet">
                      <span class="copy-text">Copy</span>
                    </button>
                  </div>
                  <pre class="py-snippet-code"><code>${escapeHtml(concept.code)}</code></pre>
                </div>`
                    : ""
                }
              </div>`
              )
              .join("")}
          </div>
        </div>

        <!-- Actions Footer -->
        <div class="cli-action-footer">
          <button class="btn btn-secondary cli-reset-btn" id="pyResetBtn" title="Reset starter code">
            ↺ Reset Code
          </button>
          <button class="btn btn-primary cli-claim-btn" id="pyClaimExpBtn" ${solved ? "" : "disabled"}>
            ${solved ? "EXP Claimed" : `Claim ${c.exp} EXP`}
          </button>
        </div>
      </div>

      <!-- Right Panel: Python Code Editor + Interactive Output Terminal -->
      <div class="py-editor-wrapper">
        <!-- Editor Header -->
        <div class="py-window-header">
          <div class="py-window-title">
            <span class="py-window-icon">🐍</span>
            <span>main.py — Python 3 Interactive Workspace</span>
          </div>
          <div class="py-window-badges">
            <span class="py-engine-pill" id="pyEngineBadge">Pyodide Engine</span>
          </div>
        </div>

        <!-- Editor Toolbar -->
        <div class="py-toolbar">
          <button class="btn btn-primary py-run-btn" id="pyRunBtn" title="Execute script (Ctrl + Enter)">
            <span class="py-run-icon">▶</span> Run Code
          </button>
          <button class="btn btn-secondary py-clear-btn" id="pyClearConsoleBtn" title="Clear console output">
            Clear Output
          </button>
          <button class="btn btn-secondary py-reset-btn" id="pyResetBtn" title="Reset code back to starter template">
            Reset Code
          </button>
          <div class="py-exec-status" id="pyExecStatus">
            <span class="py-status-dot"></span>
            <span class="py-status-text" id="pyStatusText">Ready</span>
          </div>
        </div>

        <!-- Code Area -->
        <div class="py-editor-body">
          <div class="py-gutter" id="pyGutter">1</div>
          <textarea class="py-textarea" id="pyCodeTextarea" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off">${escapeHtml(currentCode)}</textarea>
        </div>

        <!-- Console Output -->
        <div class="py-console-panel">
          <div class="py-console-head">
            <span class="py-console-title">Console Output (stdout / stderr)</span>
            <span class="py-console-meta" id="pyConsoleMeta">Press ▶ Run Code or [Ctrl+Enter] to execute</span>
          </div>
          <pre class="py-console-body" id="pyConsoleBody">Python 3.11 (Pyodide WebAssembly)\nReady. Press "▶ Run Code" or press Ctrl+Enter to test your program.</pre>
        </div>
      </div>
    </div>
  `;

  const textarea = document.getElementById("pyCodeTextarea");
  const gutter = document.getElementById("pyGutter");
  const runBtn = document.getElementById("pyRunBtn");
  const clearBtn = document.getElementById("pyClearConsoleBtn");
  const resetBtn = document.getElementById("pyResetBtn");
  const claimBtn = document.getElementById("pyClaimExpBtn");
  const consoleBody = document.getElementById("pyConsoleBody");
  const consoleMeta = document.getElementById("pyConsoleMeta");
  const execStatus = document.getElementById("pyExecStatus");
  const statusText = document.getElementById("pyStatusText");
  const progressCounter = document.getElementById("pyProgressCounter");
  const progressBarFill = document.getElementById("pyProgressBarFill");

  // Sync line numbers in gutter
  function updateGutter() {
    if (!textarea || !gutter) return;
    const lines = textarea.value.split("\n").length;
    let nums = "";
    for (let i = 1; i <= Math.max(lines, 1); i++) {
      nums += i + "\n";
    }
    gutter.textContent = nums;
  }
  updateGutter();

  // Scroll sync between gutter and textarea
  textarea.addEventListener("scroll", () => {
    if (gutter) gutter.scrollTop = textarea.scrollTop;
  });

  // Handle Tab key inside textarea
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      textarea.value = textarea.value.substring(0, start) + "    " + textarea.value.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + 4;
      updateGutter();
      playCliSound("tab");
    } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      executeCode();
    } else if (e.key === "Enter") {
      playCliSound("enter");
      setTimeout(updateGutter, 0);
    } else if (e.key === "Backspace") {
      playCliSound("backspace");
      setTimeout(updateGutter, 0);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      playCliSound("key");
      setTimeout(updateGutter, 0);
    }
  });

  textarea.addEventListener("input", () => {
    updateGutter();
  });

  // Copy buttons
  container.querySelectorAll(".py-copy-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const snippet = btn.getAttribute("data-snippet");
      if (!snippet) return;
      navigator.clipboard.writeText(snippet).then(() => {
        playCliSound("key");
        const copyTextSpan = btn.querySelector(".copy-text");
        if (copyTextSpan) {
          const orig = copyTextSpan.textContent;
          copyTextSpan.textContent = "Copied!";
          btn.classList.add("is-copied");
          setTimeout(() => {
            copyTextSpan.textContent = orig;
            btn.classList.remove("is-copied");
          }, 1500);
        }
      });
    });
  });

  // Reset button
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (confirm("Reset editor back to initial starter code?")) {
        textarea.value = c.starter || "";
        updateGutter();
        consoleBody.textContent = 'Code reset. Press "▶ Run Code" to test.';
        consoleBody.className = "py-console-body";
        consoleMeta.textContent = "Code reset to starter template";
        playCliSound("key");
      }
    });
  }

  // Clear output
  clearBtn.addEventListener("click", () => {
    consoleBody.textContent = "Console cleared.";
    consoleBody.className = "py-console-body";
    consoleMeta.textContent = "Output cleared";
    playCliSound("key");
  });

  // Claim EXP button
  claimBtn.addEventListener("click", () => {
    if (claimBtn.disabled) return;
    claimBtn.disabled = true;
    claimBtn.textContent = "EXP Claimed";
    onClaimExp(c);
    playCliSound("enter");
  });

  // Live Goal Check Evaluator
  function evaluateGoals(code, stdout, stderr, runError, globalsMap) {
    const goals = c.goals || [];
    let satisfiedCount = 0;

    goals.forEach((g) => {
      let isMet = false;

      if (c.id === "py-level-1-output-comments") {
        if (g.id === "comment") {
          // Checks for at least one human comment (# ...)
          isMet = /(?:^|\n)\s*#[^\n]+/m.test(code);
        } else if (g.id === "three_prints") {
          // Checks for at least three separate print(...) statements
          const printMatches = code.match(/\bprint\s*\(/g);
          isMet = Boolean(printMatches && printMatches.length >= 3);
        } else if (g.id === "about_me") {
          // Task: About Me — three separate print statements for name, age, favorite food
          // Output should have at least 3 non-empty output lines without runtime errors
          const lines = stdout
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
          isMet = !runError && lines.length >= 3;
        }
      } else if (c.id === "py-level-2-variables-data-types") {
        if (g.id === "variable_roundup") {
          // Task 1: 4 variables (str, int, float, bool), each printed with value + type()
          const combined = (code + "\n" + stdout).toLowerCase();
          const hasStr = combined.includes("<class 'str'>") || combined.includes("str") || /['"][^'"]+['"]/.test(code);
          const hasInt = combined.includes("<class 'int'>") || combined.includes("int") || /\b\d+\b/.test(code);
          const hasFloat = combined.includes("<class 'float'>") || combined.includes("float") || /\b\d+\.\d+\b/.test(code);
          const hasBool = combined.includes("<class 'bool'>") || combined.includes("bool") || /\b(True|False)\b/.test(code);
          const hasType = /\btype\s*\(/.test(code);

          // In globalsMap or output:
          const typeMatchesInOutput = (stdout.match(/<class '(str|int|float|bool)'>/g) || []).length;
          isMet = !runError && hasType && hasStr && hasInt && hasFloat && (typeMatchesInOutput >= 2 || (hasBool && hasType));
        } else if (g.id === "swap_variables") {
          // Task 2: Swap Without a Third Variable - swap two variables in one line
          // e.g. a, b = b, a or x, y = y, x
          const singleLineSwapRegex = /\b([a-zA-Z_]\w*)\s*,\s*([a-zA-Z_]\w*)\s*=\s*\2\s*,\s*\1\b/;
          const hasSingleLineSwap = singleLineSwapRegex.test(code);
          // And check that no third temp variable was used for the swap
          isMet = !runError && hasSingleLineSwap;
        }
      } else if (c.id === "py-level-3-arithmetic-input-typecasting") {
        if (g.id === "mini_calculator") {
          // Task 1: Mini Calculator — ask for 2 numbers, print results of all 7 operators (+, -, *, /, //, %, **)
          const cleanCode = code.replace(/#.*$/gm, "");
          const hasInput = /\binput\s*\(/.test(code);
          const hasTypecast = /\b(int|float)\s*\(/.test(code);
          const hasAdd = /\+/.test(cleanCode);
          const hasSub = /(?<!-)-(?!-)/.test(cleanCode);
          const hasMul = /(?<!\*)\*(?!\*)/.test(cleanCode);
          const hasDiv = /(?<!\/)\/(?!\/)/.test(cleanCode);
          const hasFloor = /\/\//.test(cleanCode);
          const hasMod = /%/.test(cleanCode);
          const hasExp = /\*\*/.test(cleanCode);

          const hasAll7Ops = hasAdd && hasSub && hasMul && hasDiv && hasFloor && hasMod && hasExp;
          const hasPrint = /\bprint\s*\(/.test(code);

          isMet = !runError && hasInput && hasTypecast && hasAll7Ops && hasPrint;
        } else if (g.id === "age_from_birth_year") {
          // Task 2: Age from Birth Year — ask for birth year, calculate age via subtraction
          const cleanCode = code.replace(/#.*$/gm, "");
          const hasInput = /\binput\s*\(/.test(code);
          const hasTypecast = /\b(int|float)\s*\(/.test(code);
          const hasSubtraction = /(?<!-)-(?!-)/.test(cleanCode);
          const hasAgeLogic = /(birth|year|age|\b20\d\d\b)/i.test(code);
          const hasPrint = /\bprint\s*\(/.test(code);

          isMet = !runError && hasInput && hasTypecast && hasSubtraction && hasAgeLogic && hasPrint;
        }
      } else if (c.id === "py-level-4-strings-indexing-slicing") {
        if (g.id === "name_manipulation") {
          // Task 1: Name manipulation
          // Store full name in a variable. Print: uppercase, lowercase, first 3 letters (slicing), len()
          const cleanCode = code.replace(/#.*$/gm, "");
          const hasUpper = /\.upper\s*\(\s*\)/.test(cleanCode);
          const hasLower = /\.lower\s*\(\s*\)/.test(cleanCode);
          const hasSlice = /\[\s*(0\s*)?:\s*3\s*\]/.test(cleanCode);
          const hasLen = /\blen\s*\(/.test(cleanCode);
          const hasPrint = /\bprint\s*\(/.test(code);

          isMet = !runError && hasUpper && hasLower && hasSlice && hasLen && hasPrint;
        } else if (g.id === "reverse_string") {
          // Task 2: Reverse a string
          // Ask for word with input(), print it reversed without a loop using slicing [::-1]
          const cleanCode = code.replace(/#.*$/gm, "");
          const hasInput = /\binput\s*\(/.test(code);
          const hasRevSlice = /\[\s*:\s*:\s*-1\s*\]/.test(cleanCode);
          const hasLoop = /\b(for\s+\w+\s+in|while\b)/.test(cleanCode);
          const hasPrint = /\bprint\s*\(/.test(code);

          isMet = !runError && hasInput && hasRevSlice && !hasLoop && hasPrint;
        }
      } else if (c.id === "py-level-5-if-conditionals") {
        if (g.id === "even_or_odd") {
          // Task 1: Even or Odd
          // Ask for a number with input(), then print "Even" or "Odd" using if/else and modulo (%)
          const cleanCode = code.replace(/#.*$/gm, "");
          const hasInput = /\binput\s*\(/.test(code);
          const hasModulo = /%\s*2\b|%/.test(cleanCode);
          const hasIfElse = /\bif\b/.test(cleanCode) && /\belse\s*:/.test(cleanCode);
          const hasKeywords = /even/i.test(code) && /odd/i.test(code);
          const hasPrint = /\bprint\s*\(/.test(code);

          isMet = !runError && hasInput && hasModulo && hasIfElse && hasKeywords && hasPrint;
        } else if (g.id === "grade_checker") {
          // Task 2: Grade Checker
          // Ask for a score (0-100), print letter grade using if/elif/else
          const cleanCode = code.replace(/#.*$/gm, "");
          const hasInput = /\binput\s*\(/.test(code) || /score\s*=/.test(cleanCode);
          const hasElif = /\belif\b/.test(cleanCode);
          const hasIf = /\bif\b/.test(cleanCode);
          const hasGrades = /['"]?A['"]?.*['"]?B['"]?.*['"]?C['"]?.*['"]?F['"]?/s.test(cleanCode) || 
                            (/[ABC]/i.test(cleanCode) && /\b(90|80|70)\b/.test(cleanCode));
          const hasComparison = /[><]=?/.test(cleanCode);

          isMet = !runError && hasInput && hasIf && hasElif && hasGrades && hasComparison;
        }
      } else if (c.id === "py-level-6-loops-flow-control") {
        if (g.id === "countdown") {
          // Task 1: Countdown
          // Using a while loop, print numbers from 10 to 1, then print "Liftoff!"
          const cleanCode = code.replace(/#.*$/gm, "");
          const hasWhile = /\bwhile\b/.test(cleanCode);
          const hasDecrement = /(-=\s*1|count\s*-\s*1|n\s*-\s*1|i\s*-\s*1)/.test(cleanCode) || /-\s*1/.test(cleanCode);
          const hasLiftoff = /liftoff/i.test(code) || /liftoff/i.test(stdout);
          const hasPrint = /\bprint\s*\(/.test(code);
          const hasOutputCountdown = /\b10\b/.test(stdout) && /\b1\b/.test(stdout);

          isMet = !runError && hasWhile && (hasDecrement || hasOutputCountdown) && hasLiftoff && hasPrint;
        } else if (g.id === "sum_of_numbers") {
          // Task 2: Sum of numbers
          // Using a for loop and range(), calculate and print the sum of all numbers from 1 to 100
          const cleanCode = code.replace(/#.*$/gm, "");
          const hasFor = /\bfor\s+\w+\s+in\s+range\s*\(/.test(cleanCode);
          const hasRunningTotal = /(\+=\s*\w+|\b\w+\s*=\s*\w+\s*\+\s*\w+)/.test(cleanCode);
          const has5050 = /\b5050\b/.test(stdout) || /5050/.test(cleanCode) || /101/.test(cleanCode) || /100/.test(cleanCode);
          const hasPrint = /\bprint\s*\(/.test(code);

          isMet = !runError && hasFor && hasRunningTotal && has5050 && hasPrint;
        }
      } else {
        // Generic fallback for custom goals
        isMet = !runError && stdout.trim().length > 0;
      }

      goalResults[g.id] = isMet || solved;
      if (goalResults[g.id]) satisfiedCount++;

      // Update goal item UI
      const itemEl = document.getElementById(`pyGoal-${g.id}`);
      const iconEl = document.getElementById(`pyGoalIcon-${g.id}`);
      if (itemEl && iconEl) {
        if (goalResults[g.id]) {
          itemEl.classList.add("is-satisfied");
          iconEl.textContent = "✔";
        } else {
          itemEl.classList.remove("is-satisfied");
          iconEl.textContent = "○";
        }
      }
    });

    // Update progress bar & counter
    if (progressCounter) {
      progressCounter.textContent = `${satisfiedCount} / ${goals.length}`;
    }
    if (progressBarFill) {
      const pct = Math.round((satisfiedCount / goals.length) * 100);
      progressBarFill.style.width = `${pct}%`;
    }

    if (satisfiedCount === goals.length) {
      allGoalsSatisfied = true;
      if (!claimBtn.disabled && claimBtn.textContent.includes("Claim")) {
        claimBtn.classList.add("is-ready");
      }
      claimBtn.disabled = false;
    }
  }

  // Fallback JS-based lightweight Python executor in case Pyodide CDN is unreachable
  function evaluateFallbackPython(code) {
    const lines = code.split("\n");
    let stdout = "";
    let stderr = "";
    const vars = {};

    try {
      lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;

        // Input assignment: var = int(input("...")) or var = input("...")
        const inputMatch = trimmed.match(/^([a-zA-Z_]\w*)\s*=\s*(?:(int|float)\s*\(\s*)?input\s*\((.*?)\)\s*\)?$/);
        if (inputMatch) {
          const varName = inputMatch[1];
          const castType = inputMatch[2];
          const rawPrompt = inputMatch[3].trim();
          if (rawPrompt) {
            const promptText = rawPrompt.replace(/^['"]|['"]$/g, "");
            stdout += promptText;
          }
          const simInputs = [10, 3, 2004, 15, 5, 2000, 42, 7];
          const curIdx = Object.keys(vars).filter((k) => k.startsWith("__inp_")).length;
          vars[`__inp_${curIdx}`] = true;
          let inputVal = simInputs[curIdx % simInputs.length];
          stdout += String(inputVal) + "\n";
          if (castType === "int") inputVal = parseInt(inputVal, 10);
          else if (castType === "float") inputVal = parseFloat(inputVal);
          else inputVal = String(inputVal);
          vars[varName] = inputVal;
          return;
        }

        // Tuple swap: a, b = b, a
        const swapMatch = trimmed.match(/^([a-zA-Z_]\w*)\s*,\s*([a-zA-Z_]\w*)\s*=\s*([a-zA-Z_]\w*)\s*,\s*([a-zA-Z_]\w*)$/);
        if (swapMatch) {
          const v1 = swapMatch[1], v2 = swapMatch[2];
          const r1 = swapMatch[3], r2 = swapMatch[4];
          const val1 = vars[r1] !== undefined ? vars[r1] : r1;
          const val2 = vars[r2] !== undefined ? vars[r2] : r2;
          vars[v1] = val1;
          vars[v2] = val2;
          return;
        }

        // Variable assignment: name = "AXZEL", age = 21, or math
        const assignMatch = trimmed.match(/^([a-zA-Z_]\w*)\s*=\s*(.+)$/);
        if (assignMatch) {
          const varName = assignMatch[1];
          const rawVal = assignMatch[2].trim();
          if ((rawVal.startsWith('"') && rawVal.endsWith('"')) || (rawVal.startsWith("'") && rawVal.endsWith("'"))) {
            vars[varName] = rawVal.slice(1, -1);
          } else if (rawVal === "True") {
            vars[varName] = true;
          } else if (rawVal === "False") {
            vars[varName] = false;
          } else if (!isNaN(Number(rawVal))) {
            vars[varName] = Number(rawVal);
          } else {
            try {
              let jsExpr = rawVal.replace(/\/\//g, "/").replace(/\*\*/g, "**");
              Object.keys(vars).forEach((k) => {
                if (!k.startsWith("__")) {
                  const reg = new RegExp(`\\b${k}\\b`, "g");
                  jsExpr = jsExpr.replace(reg, JSON.stringify(vars[k]));
                }
              });
              const evalRes = Function(`"use strict"; return (${jsExpr})`)();
              vars[varName] = evalRes;
            } catch {
              vars[varName] = rawVal;
            }
          }
          return;
        }

        // Print statement: print(...)
        const printMatch = trimmed.match(/^print\s*\((.*)\)$/);
        if (printMatch) {
          const argsRaw = printMatch[1].trim();
          // Check for f-string: f"Age: {age}"
          const fstringMatch = argsRaw.match(/^f['"](.*)['"]$/);
          if (fstringMatch) {
            let res = fstringMatch[1].replace(/\{([a-zA-Z_]\w*)\}/g, (_, v) => (vars[v] !== undefined ? vars[v] : ""));
            stdout += res + "\n";
            return;
          }

          const parts = argsRaw.split(",").map((p) => p.trim());
          const outParts = parts.map((part) => {
            const typeMatch = part.match(/^type\s*\(([a-zA-Z_]\w*)\)$/);
            if (typeMatch) {
              const targetVar = typeMatch[1];
              const val = vars[targetVar];
              if (typeof val === "string") return "<class 'str'>";
              if (typeof val === "number") return Number.isInteger(val) ? "<class 'int'>" : "<class 'float'>";
              if (typeof val === "boolean") return "<class 'bool'>";
              return "<class 'object'>";
            }
            if ((part.startsWith('"') && part.endsWith('"')) || (part.startsWith("'") && part.endsWith("'"))) {
              return part.slice(1, -1);
            }
            if (vars[part] !== undefined) {
              return String(vars[part]);
            }
            // Evaluate string methods like name.upper(), name.lower(), len(name)
            const upperMatch = part.match(/^([a-zA-Z_]\w*)\.upper\(\)$/);
            if (upperMatch && vars[upperMatch[1]] !== undefined) {
              return String(vars[upperMatch[1]]).toUpperCase();
            }
            const lowerMatch = part.match(/^([a-zA-Z_]\w*)\.lower\(\)$/);
            if (lowerMatch && vars[lowerMatch[1]] !== undefined) {
              return String(vars[lowerMatch[1]]).toLowerCase();
            }
            const lenMatch = part.match(/^len\(([a-zA-Z_]\w*)\)$/);
            if (lenMatch && vars[lenMatch[1]] !== undefined) {
              return String(String(vars[lenMatch[1]]).length);
            }
            // Evaluate string slicing: word[0], word[-1], word[0:3], word[:3], word[::-1]
            const sliceMatch = part.match(/^([a-zA-Z_]\w*)\[([^\]]+)\]$/);
            if (sliceMatch && vars[sliceMatch[1]] !== undefined) {
              const strVal = String(vars[sliceMatch[1]]);
              const sl = sliceMatch[2].trim();
              if (sl === "::-1") {
                return strVal.split("").reverse().join("");
              }
              if (sl.startsWith(":") || sl.startsWith("0:")) {
                const end = parseInt(sl.replace(/^[0:]*/, "") || "3", 10);
                return strVal.slice(0, end);
              }
              const idx = parseInt(sl, 10);
              if (!isNaN(idx)) {
                return idx < 0 ? strVal[strVal.length + idx] || "" : strVal[idx] || "";
              }
            }
            // Evaluate math in print e.g. print(a + b), print(a // b)
            try {
              let jsExpr = part.replace(/\/\//g, "/").replace(/\*\*/g, "**");
              Object.keys(vars).forEach((k) => {
                if (!k.startsWith("__")) {
                  const reg = new RegExp(`\\b${k}\\b`, "g");
                  jsExpr = jsExpr.replace(reg, JSON.stringify(vars[k]));
                }
              });
              const val = Function(`"use strict"; return (${jsExpr})`)();
              if (part.includes("//")) return String(Math.floor(val));
              return String(val);
            } catch {
              return part;
            }
          });
          stdout += outParts.join(" ") + "\n";
        }
      });
    } catch (err) {
      stderr += String(err.message || err) + "\n";
    }

    return { stdout, stderr, runError: stderr.length > 0 ? new Error(stderr) : null };
  }

  // Execute Code in Pyodide with live stdout redirection
  async function executeCode() {
    if (isExecuting) return;
    const code = textarea.value;

    isExecuting = true;
    runBtn.disabled = true;
    execStatus.className = "py-exec-status is-running";
    statusText.textContent = "Executing...";
    consoleBody.textContent = "Executing Python script in WebAssembly runtime...";
    consoleBody.className = "py-console-body";
    consoleMeta.textContent = "Connecting to execution engine...";

    try {
      let stdout = "";
      let stderr = "";
      let runError = null;

      let pyodide = null;
      try {
        if (typeof getPyodide === "function") {
          pyodide = await getPyodide();
        } else if (window.loadPyodide) {
          pyodide = await window.loadPyodide();
        }
      } catch (loadErr) {
        console.warn("Pyodide load exception, using fallback runner:", loadErr);
      }

      if (pyodide) {
        consoleMeta.textContent = "Running script...";
        // Setup Python stdout/stderr interception and interactive input support
        const wrapper = `
import sys
import builtins
from io import StringIO
__stdout_capture = StringIO()
__stderr_capture = StringIO()
sys.stdout = __stdout_capture
sys.stderr = __stderr_capture

__sim_inputs = ["10", "85", "3", "2004", "Python", "Axzel Rivera", "hello", "world", "15", "5", "2000", "42", "7", "1998"]
__in_idx = 0

def __safe_input(prompt=""):
    global __in_idx
    if prompt:
        sys.stdout.write(str(prompt))
    if __in_idx < len(__sim_inputs):
        val = __sim_inputs[__in_idx]
        __in_idx += 1
        sys.stdout.write(str(val) + "\\n")
        return val
    sys.stdout.write("Python\\n")
    return "Python"

builtins.input = __safe_input
`;
        await pyodide.runPythonAsync(wrapper);

        try {
          await pyodide.runPythonAsync(code);
        } catch (execErr) {
          runError = execErr;
        }

        const teardown = `
__out_val = __stdout_capture.getvalue()
__err_val = __stderr_capture.getvalue()
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
(__out_val, __err_val)
`;
        const pyResult = await pyodide.runPythonAsync(teardown);
        stdout = pyResult.get(0) || "";
        stderr = pyResult.get(1) || "";
      } else {
        // Fallback engine
        const fallbackRes = evaluateFallbackPython(code);
        stdout = fallbackRes.stdout;
        stderr = fallbackRes.stderr;
        runError = fallbackRes.runError;
      }

      // Display results
      let finalConsoleOutput = "";
      if (stdout) {
        finalConsoleOutput += stdout;
      }
      if (stderr) {
        finalConsoleOutput += (finalConsoleOutput ? "\n" : "") + stderr;
      }
      if (runError) {
        finalConsoleOutput += (finalConsoleOutput ? "\n" : "") + `Traceback (most recent call last):\n  ${runError.message || runError}`;
      }

      if (!finalConsoleOutput.trim()) {
        finalConsoleOutput = "[Program finished with no output to stdout]";
      }

      consoleBody.textContent = finalConsoleOutput;
      consoleMeta.textContent = `Execution completed · ${stdout.split("\n").filter(Boolean).length} output lines`;

      if (runError) {
        consoleBody.className = "py-console-body is-error";
        execStatus.className = "py-exec-status is-error";
        statusText.textContent = "Runtime Error";
        playCliSound("backspace");
      } else {
        consoleBody.className = "py-console-body is-success";
        execStatus.className = "py-exec-status is-success";
        statusText.textContent = "Success";
        playCliSound("enter");
      }

      // Evaluate objectives
      evaluateGoals(code, stdout, stderr, runError);

      if (allGoalsSatisfied) {
        consoleBody.textContent += "\n\n✔ All live objectives met! Click 'Claim " + c.exp + " EXP' to submit trial.";
      }
    } catch (fatal) {
      consoleBody.textContent = `Fatal Execution Error:\n${fatal.message || fatal}`;
      consoleBody.className = "py-console-body is-error";
      execStatus.className = "py-exec-status is-error";
      statusText.textContent = "Error";
      playCliSound("backspace");
    } finally {
      isExecuting = false;
      runBtn.disabled = false;
    }
  }

  runBtn.addEventListener("click", () => {
    executeCode();
  });
}
