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

export function highlightPython(code) {
  if (!code) return "";
  const tokenRegex = /(#[^\n]*)|("""[\s\S]*?"""|\x27\x27\x27[\s\S]*?\x27\x27\x27)|((?:[brufBRUF]{1,2})?"(?:[^"\\\n]|\\.)*"|(?:[brufBRUF]{1,2})?\x27(?:[^\x27\\\n]|\\.)*\x27)|(\b\d+(?:\.\d+)?\b)|(\b(?:def|class|lambda|import|from|as|global|nonlocal|async|await)\b)|(\b(?:if|elif|else|for|while|break|continue|return|yield|try|except|finally|raise|pass|with|match|case)\b)|(\b(?:True|False|None)\b)|(\b(?:print|input|len|range|type|int|str|float|bool|list|dict|tuple|set|sum|min|max|abs|round|sorted|enumerate|zip|open|isinstance|id)\b)|(\b(?:and|or|not|is|in)\b)|(\b[a-zA-Z_]\w*(?=\s*\())|(\b[a-zA-Z_]\w*\b)|([+\-*/%&|^~=<>!]=?|\*\*|\/\/)|([()[\]{}])/g;

  let result = "";
  let lastIndex = 0;
  let match;

  while ((match = tokenRegex.exec(code)) !== null) {
    if (match.index > lastIndex) {
      result += escapeHtml(code.slice(lastIndex, match.index));
    }
    const [full, comment, multilineStr, str, num, declKeyword, controlKeyword, boolConst, builtin, logOp, funcCall, ident, op, bracket] = match;

    if (comment) {
      result += `<span class="py-tok-comment">${escapeHtml(comment)}</span>`;
    } else if (multilineStr || str) {
      result += `<span class="py-tok-string">${escapeHtml(multilineStr || str)}</span>`;
    } else if (num) {
      result += `<span class="py-tok-number">${escapeHtml(num)}</span>`;
    } else if (declKeyword) {
      result += `<span class="py-tok-decl">${escapeHtml(declKeyword)}</span>`;
    } else if (controlKeyword) {
      result += `<span class="py-tok-control">${escapeHtml(controlKeyword)}</span>`;
    } else if (boolConst) {
      result += `<span class="py-tok-constant">${escapeHtml(boolConst)}</span>`;
    } else if (builtin) {
      result += `<span class="py-tok-builtin">${escapeHtml(builtin)}</span>`;
    } else if (logOp) {
      result += `<span class="py-tok-logical">${escapeHtml(logOp)}</span>`;
    } else if (funcCall) {
      result += `<span class="py-tok-func">${escapeHtml(funcCall)}</span>`;
    } else if (ident) {
      result += `<span class="py-tok-var">${escapeHtml(ident)}</span>`;
    } else if (op) {
      result += `<span class="py-tok-op">${escapeHtml(op)}</span>`;
    } else if (bracket) {
      result += `<span class="py-tok-bracket">${escapeHtml(bracket)}</span>`;
    } else {
      result += escapeHtml(full);
    }
    lastIndex = tokenRegex.lastIndex;
  }
  if (lastIndex < code.length) {
    result += escapeHtml(code.slice(lastIndex));
  }
  if (code.endsWith("\n")) {
    result += " ";
  }
  return result;
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
                  <pre class="py-snippet-code"><code>${highlightPython(concept.code)}</code></pre>
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

      <!-- Right Panel: VS Code-Style Python Editor + Terminal -->
      <div class="py-editor-wrapper py-vscode-container">
        <!-- VS Code Window Header / Tabs Bar -->
        <div class="py-window-header py-vscode-header">
          <div class="py-vscode-tabs">
            <div class="py-vscode-tab is-active" id="pyActiveTab">
              <span class="py-tab-icon">🐍</span>
              <span class="py-tab-title">main.py</span>
              <span class="py-tab-modified" id="pyTabModified" title="Unsaved changes" style="display:none;">●</span>
              <button class="py-tab-close" id="pyTabClose" title="Reset starter code">×</button>
            </div>
          </div>
          <div class="py-window-badges">
            <span class="py-engine-pill" id="pyEngineBadge">Pyodide Engine</span>
          </div>
        </div>

        <!-- VS Code Breadcrumbs Bar -->
        <div class="py-vscode-breadcrumbs">
          <span class="py-bc-item">xeli</span>
          <span class="py-bc-sep">›</span>
          <span class="py-bc-item">labs</span>
          <span class="py-bc-sep">›</span>
          <span class="py-bc-item">python</span>
          <span class="py-bc-sep">›</span>
          <span class="py-bc-item is-file">🐍 main.py</span>
          <span class="py-bc-sep">›</span>
          <span class="py-bc-item py-bc-symbol">{ } workspace</span>
        </div>

        <!-- Editor Toolbar -->
        <div class="py-toolbar">
          <button class="btn btn-primary py-run-btn" id="pyRunBtn" title="Execute script (Ctrl + Enter)">
            <span class="py-run-icon">▶</span> Run Code
          </button>
          <button class="btn btn-secondary py-clear-btn" id="pyClearConsoleBtn" title="Clear console output">
            Clear Output
          </button>
          <button class="btn btn-secondary py-reset-btn" id="pyToolbarResetBtn" title="Reset code back to starter template">
            Reset Code
          </button>
          <div class="py-exec-status" id="pyExecStatus">
            <span class="py-status-dot"></span>
            <span class="py-status-text" id="pyStatusText">Ready</span>
          </div>
        </div>

        <!-- Code Area with Syntax Highlighting Layer -->
        <div class="py-editor-body" id="pyEditorBody">
          <div class="py-gutter" id="pyGutter"></div>
          <div class="py-code-stage" id="pyCodeStage">
            <div class="py-active-line-bg" id="pyActiveLineBg"></div>
            <pre class="py-highlight-layer" id="pyHighlightLayer" aria-hidden="true"><code id="pyCodeHighlight"></code></pre>
            <textarea class="py-textarea" id="pyCodeTextarea" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off">${escapeHtml(currentCode)}</textarea>
          </div>
        </div>

        <!-- VS Code Status Bar -->
        <div class="py-vscode-statusbar">
          <div class="py-sb-left">
            <span class="py-sb-item" title="Python Interpreter"><span class="py-sb-icon">🐍</span> Python 3.11.4 64-bit</span>
            <span class="py-sb-item" id="pySbEngine" title="Execution Runtime">Pyodide WASM</span>
          </div>
          <div class="py-sb-right">
            <span class="py-sb-item" id="pyCursorPos">Ln 1, Col 1</span>
            <span class="py-sb-item" title="Indentation">Spaces: 4</span>
            <span class="py-sb-item" title="Encoding">UTF-8</span>
            <span class="py-sb-item" title="Line Sequence">LF</span>
            <span class="py-sb-item py-sb-lang">{ } Python</span>
          </div>
        </div>

        <!-- Console Output -->
        <div class="py-console-panel" id="pyConsolePanel">
          <div class="py-console-head">
            <span class="py-console-title">TERMINAL / OUTPUT</span>
            <span class="py-console-meta" id="pyConsoleMeta">Press ▶ Run Code or [Ctrl+Enter] to execute</span>
          </div>
          <div class="py-console-body-wrap">
            <pre class="py-console-body" id="pyConsoleBody">Python 3.11 (Pyodide WebAssembly)
Ready. Press "▶ Run Code" or press Ctrl+Enter to test your program.</pre>
            <div class="py-terminal-input-bar" id="pyTerminalInputBar" style="display:none;">
              <span class="py-term-prompt-icon">&gt;&gt;&gt;</span>
              <span class="py-term-prompt-text" id="pyTermPromptText">input:</span>
              <input type="text" class="py-term-input-field" id="pyTermInputField" placeholder="Type here and press Enter..." autocomplete="off" spellcheck="false" />
              <button type="button" class="btn btn-primary py-term-submit-btn" id="pyTermSubmitBtn">Send ↵</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const textarea = document.getElementById("pyCodeTextarea");
  const gutter = document.getElementById("pyGutter");
  const highlightCodeEl = document.getElementById("pyCodeHighlight");
  const highlightLayer = document.getElementById("pyHighlightLayer");
  const activeLineBg = document.getElementById("pyActiveLineBg");
  const cursorPosEl = document.getElementById("pyCursorPos");
  const tabModified = document.getElementById("pyTabModified");
  const tabCloseBtn = document.getElementById("pyTabClose");

  const runBtn = document.getElementById("pyRunBtn");
  const clearBtn = document.getElementById("pyClearConsoleBtn");
  const resetBtn = document.getElementById("pyResetBtn");
  const toolbarResetBtn = document.getElementById("pyToolbarResetBtn");
  const claimBtn = document.getElementById("pyClaimExpBtn");
  const consoleBody = document.getElementById("pyConsoleBody");
  const consoleMeta = document.getElementById("pyConsoleMeta");
  const execStatus = document.getElementById("pyExecStatus");
  const statusText = document.getElementById("pyStatusText");
  const progressCounter = document.getElementById("pyProgressCounter");
  const progressBarFill = document.getElementById("pyProgressBarFill");

  // Update cursor position and active line highlight
  function updateCursorAndLine() {
    if (!textarea) return;
    const start = textarea.selectionStart;
    const val = textarea.value;
    const textBefore = val.substring(0, start);
    const lines = textBefore.split("\n");
    const currentLineIdx = lines.length; // 1-based
    const currentColIdx = lines[lines.length - 1].length + 1; // 1-based

    if (cursorPosEl) {
      cursorPosEl.textContent = `Ln ${currentLineIdx}, Col ${currentColIdx}`;
    }

    if (gutter) {
      const lineEls = gutter.children;
      for (let i = 0; i < lineEls.length; i++) {
        if (i === currentLineIdx - 1) {
          lineEls[i].classList.add("is-active-line");
        } else {
          lineEls[i].classList.remove("is-active-line");
        }
      }
    }

    if (activeLineBg) {
      const lineHeight = 21;
      const topPad = 12;
      const topOffset = topPad + (currentLineIdx - 1) * lineHeight - textarea.scrollTop;
      activeLineBg.style.top = `${topOffset}px`;
      activeLineBg.style.display = (topOffset >= 0 && topOffset <= textarea.clientHeight) ? "block" : "none";
    }

    if (tabModified) {
      tabModified.style.display = val !== (c.starter || "") ? "inline-block" : "none";
    }
  }

  // Full Editor Sync: highlighting, line numbers, scrolling, cursor
  function syncEditor() {
    if (!textarea) return;
    const code = textarea.value;

    if (highlightCodeEl) {
      highlightCodeEl.innerHTML = highlightPython(code);
    }

    if (gutter) {
      const totalLines = Math.max(code.split("\n").length, 1);
      let html = "";
      for (let i = 1; i <= totalLines; i++) {
        html += `<div class="py-line-num">${i}</div>`;
      }
      gutter.innerHTML = html;
    }

    if (highlightLayer) {
      highlightLayer.scrollTop = textarea.scrollTop;
      highlightLayer.scrollLeft = textarea.scrollLeft;
    }
    if (gutter) {
      gutter.scrollTop = textarea.scrollTop;
    }

    updateCursorAndLine();
  }

  syncEditor();

  // Scroll sync between gutter, highlight layer, and textarea
  textarea.addEventListener("scroll", () => {
    if (highlightLayer) {
      highlightLayer.scrollTop = textarea.scrollTop;
      highlightLayer.scrollLeft = textarea.scrollLeft;
    }
    if (gutter) {
      gutter.scrollTop = textarea.scrollTop;
    }
    updateCursorAndLine();
  });

  textarea.addEventListener("click", updateCursorAndLine);
  textarea.addEventListener("keyup", (e) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(e.key)) {
      updateCursorAndLine();
    }
  });

  // VS Code Keystroke Handling
  textarea.addEventListener("keydown", (e) => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = textarea.value;

    // Run code shortcut: Ctrl+Enter or Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      executeCode();
      return;
    }

    // Toggle comment shortcut: Ctrl+/ or Cmd+/
    if ((e.ctrlKey || e.metaKey) && e.key === "/") {
      e.preventDefault();
      const before = val.substring(0, start);
      const lastNewline = before.lastIndexOf("\n");
      const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
      let nextNewline = val.indexOf("\n", end);
      if (nextNewline === -1) nextNewline = val.length;

      const lineContent = val.substring(lineStart, nextNewline);
      if (lineContent.startsWith("# ")) {
        textarea.value = val.substring(0, lineStart) + lineContent.substring(2) + val.substring(nextNewline);
        textarea.selectionStart = Math.max(lineStart, start - 2);
        textarea.selectionEnd = Math.max(lineStart, end - 2);
      } else {
        textarea.value = val.substring(0, lineStart) + "# " + lineContent + val.substring(nextNewline);
        textarea.selectionStart = start + 2;
        textarea.selectionEnd = end + 2;
      }
      syncEditor();
      playCliSound("key");
      return;
    }

    // Tab key indent & Shift+Tab dedent (4 spaces)
    if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        const before = val.substring(0, start);
        const lastNewline = before.lastIndexOf("\n");
        const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
        const lineText = val.substring(lineStart, start);
        if (lineText.startsWith("    ")) {
          textarea.value = val.substring(0, lineStart) + val.substring(lineStart + 4);
          textarea.selectionStart = textarea.selectionEnd = Math.max(lineStart, start - 4);
        } else if (lineText.startsWith("  ")) {
          textarea.value = val.substring(0, lineStart) + val.substring(lineStart + 2);
          textarea.selectionStart = textarea.selectionEnd = Math.max(lineStart, start - 2);
        }
      } else {
        textarea.value = val.substring(0, start) + "    " + val.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + 4;
      }
      syncEditor();
      playCliSound("tab");
      return;
    }

    // Auto-indent on Enter (and add 4 spaces if line ends with :)
    if (e.key === "Enter") {
      const before = val.substring(0, start);
      const lastNewline = before.lastIndexOf("\n");
      const currentLine = lastNewline === -1 ? before : before.substring(lastNewline + 1);
      const matchIndent = currentLine.match(/^\s*/)[0];
      const extraIndent = currentLine.trim().endsWith(":") ? "    " : "";
      const indent = matchIndent + extraIndent;

      e.preventDefault();
      textarea.value = val.substring(0, start) + "\n" + indent + val.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + 1 + indent.length;
      syncEditor();
      playCliSound("enter");
      return;
    }

    // Auto-closing quotes and brackets
    const pairs = {
      "(": ")",
      "[": "]",
      "{": "}",
      '"': '"',
      "'": "'"
    };

    if (pairs[e.key]) {
      const closing = pairs[e.key];
      // If typing quote and next char is the same quote, just advance cursor
      if ((e.key === '"' || e.key === "'") && val[start] === e.key && start === end) {
        e.preventDefault();
        textarea.selectionStart = textarea.selectionEnd = start + 1;
        updateCursorAndLine();
        return;
      }
      e.preventDefault();
      const selected = val.substring(start, end);
      textarea.value = val.substring(0, start) + e.key + selected + closing + val.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + 1 + selected.length;
      syncEditor();
      playCliSound("key");
      return;
    }

    // Smart Backspace between matching pairs e.g. (|) -> |
    if (e.key === "Backspace" && start === end && start > 0) {
      const prevChar = val[start - 1];
      const nextChar = val[start];
      if ((prevChar === "(" && nextChar === ")") ||
          (prevChar === "[" && nextChar === "]") ||
          (prevChar === "{" && nextChar === "}") ||
          (prevChar === '"' && nextChar === '"') ||
          (prevChar === "'" && nextChar === "'")) {
        e.preventDefault();
        textarea.value = val.substring(0, start - 1) + val.substring(start + 1);
        textarea.selectionStart = textarea.selectionEnd = start - 1;
        syncEditor();
        playCliSound("backspace");
        return;
      }
      playCliSound("backspace");
      setTimeout(syncEditor, 0);
      return;
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      playCliSound("key");
    }
  });

  textarea.addEventListener("input", () => {
    syncEditor();
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

  // Reset code handler
  function triggerResetCode() {
    if (confirm("Reset editor back to initial starter code?")) {
      textarea.value = c.starter || "";
      syncEditor();
      consoleBody.textContent = 'Code reset. Press "▶ Run Code" to test.';
      consoleBody.className = "py-console-body";
      consoleMeta.textContent = "Code reset to starter template";
      playCliSound("key");
    }
  }

  if (resetBtn) resetBtn.addEventListener("click", triggerResetCode);
  if (toolbarResetBtn) toolbarResetBtn.addEventListener("click", triggerResetCode);
  if (tabCloseBtn) tabCloseBtn.addEventListener("click", triggerResetCode);

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
      } else if (c.id === "py-level-7-mini-project-password-lock") {
        const cleanCode = code.replace(/#.*$/gm, "");
        if (g.id === "flag_and_attempts") {
          // Task 1: Boolean Flag & Loop
          const hasWhile = /\bwhile\b/.test(cleanCode);
          const hasFlag = /\b(logged_in|is_logged_in|success|authenticated|access_granted|is_auth|flag|logged)\s*=\s*False\b/i.test(cleanCode) || /\b(False|True)\b/.test(cleanCode);
          const hasAttempt = /\battempt\b/i.test(cleanCode) || /\b(count|tries)\b/i.test(cleanCode);
          const hasIncrement = /(\+=\s*1|\b\w+\s*=\s*\w+\s*\+\s*1)/.test(cleanCode);

          isMet = !runError && hasWhile && hasFlag && hasAttempt && hasIncrement;
        } else if (g.id === "conditional_access_denied") {
          // Task 2: Access Control & Bug Fix
          const hasBreak = /\bbreak\b/.test(cleanCode);
          const hasFlagTrue = /\b(logged_in|is_logged_in|success|authenticated|access_granted|is_auth|flag|logged)\s*=\s*True\b/i.test(cleanCode) || /while\s+.*:[\s\S]*?else\s*:/i.test(cleanCode);
          const hasPostLoopCheck = /\bif\s+(not\s+\w+|\w+\s*==\s*False|\w+\s*!=\s*True)/i.test(cleanCode) || /else\s*:\s*print\s*\(.*ACCESS DENIED/i.test(cleanCode);
          const hasGranted = /ACCESS GRANTED/i.test(code) || /ACCESS GRANTED/i.test(stdout);
          const hasDeniedInCode = /ACCESS DENIED/i.test(code);
          // Crucial bug check: In output with matching password, ACCESS GRANTED is printed, but ACCESS DENIED must NOT be printed!
          const bothOutputsPrinted = /ACCESS GRANTED/i.test(stdout) && /ACCESS DENIED/i.test(stdout);

          isMet = !runError && hasBreak && hasFlagTrue && hasPostLoopCheck && hasGranted && hasDeniedInCode && !bothOutputsPrinted;
        }
      } else if (c.id === "py-level-8-lists") {
        if (g.id === "grocery_list_manager") {
          // Level 8: Grocery List Manager
          const cleanCode = code.replace(/#.*$/gm, "");
          const hasGroceries = /\bgroceries\s*=\s*\[\s*\]|\bgroceries\b/.test(cleanCode);
          const hasAppend = (cleanCode.match(/\.append\s*\(/g) || []).length >= 3;
          const hasLen = /\blen\s*\(\s*groceries\s*\)/.test(cleanCode);
          const hasPrint = /\bprint\s*\(/.test(code);

          isMet = !runError && hasGroceries && hasAppend && hasLen && hasPrint;
        }
      } else if (c.id === "py-level-9-tuples") {
        if (g.id === "tuple_basics") {
          // Level 9: Tuple Basics
          const cleanCode = code.replace(/#.*$/gm, "");
          const hasTuple = /\(\s*[^)]+,\s*[^)]+,\s*[^)]+,\s*[^)]+\)/.test(cleanCode) || /\w+\s*=\s*\([^)]+\)/.test(cleanCode);
          const hasIndex1 = /\[\s*1\s*\]/.test(cleanCode);
          const hasNegIndex = /\[\s*-\s*1\s*\]/.test(cleanCode);
          const hasPrint = /\bprint\s*\(/.test(code);

          isMet = !runError && hasTuple && hasIndex1 && hasNegIndex && hasPrint;
        }
      } else if (c.id === "py-level-10-dictionaries") {
        const cleanCode = code.replace(/#.*$/gm, "");
        if (g.id === "build_profile") {
          // Level 10: Task 1: Build a Profile
          const hasProfile = /\bprofile\s*=\s*\{[\s\S]*?\}/.test(cleanCode);
          const hasKeyLookup = /\bprofile\s*\[\s*['"][^'"]+['"]\s*\]/.test(cleanCode);
          const hasPrint = /\bprint\s*\(/.test(code);

          isMet = !runError && hasProfile && hasKeyLookup && hasPrint;
        } else if (g.id === "loop_and_print") {
          // Level 10: Task 2: Loop and Print
          const hasItems = /\.items\s*\(\s*\)/.test(cleanCode);
          const hasFor = /\bfor\s+\w+(\s*,\s*\w+)?\s+in\s+/.test(cleanCode);
          const hasPrint = /\bprint\s*\(/.test(code);

          isMet = !runError && hasItems && hasFor && hasPrint;
        }
      } else if (c.id === "py-level-11-nested-data-structures") {
        const cleanCode = code.replace(/#.*$/gm, "");
        if (g.id === "person_with_hobbies") {
          // Level 11: Task 1: Person with Hobbies
          const hasHobbiesList = /['"]?hobbies['"]?\s*:\s*\[[\s\S]*?\]/.test(cleanCode);
          const hasLoopHobby = /\bfor\s+\w+\s+in\s+.*hobbies/i.test(cleanCode) || /\bfor\s+\w+\s+in\s+\w+\[['"]hobbies['"]\]/i.test(cleanCode);
          const hasPrint = /\bprint\s*\(/.test(code);

          isMet = !runError && hasHobbiesList && hasLoopHobby && hasPrint;
        } else if (g.id === "list_of_friends") {
          // Level 11: Task 2: List of Friends
          const hasListOfDicts = /\[\s*\{[\s\S]*?\}\s*,\s*\{[\s\S]*?\}\s*,\s*\{[\s\S]*?\}\s*\]/.test(cleanCode) ||
                                 (cleanCode.includes("[") && (cleanCode.match(/\{[^}]*name[^}]*\}/gi) || []).length >= 2);
          const hasLoop = /\bfor\s+\w+\s+in\s+/.test(cleanCode);
          const hasDictAccess = /\w+\[['"](name|age)['"]\]/i.test(cleanCode);
          const hasPrint = /\bprint\s*\(/.test(code);

          isMet = !runError && hasListOfDicts && hasLoop && hasDictAccess && hasPrint;
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

  let activeInputResolve = null;

  function requestTerminalInput(promptText) {
    return new Promise((resolve) => {
      activeInputResolve = resolve;
      const bar = document.getElementById("pyTerminalInputBar");
      const label = document.getElementById("pyTermPromptText");
      const input = document.getElementById("pyTermInputField");

      if (label) {
        label.textContent = promptText ? promptText.trim() : "input:";
      }
      if (consoleMeta) {
        consoleMeta.textContent = "Waiting for input in terminal below ↵";
      }
      if (bar && input) {
        bar.style.display = "flex";
        input.value = "";
        input.placeholder = promptText ? `Enter: ${promptText.trim()}` : "Type input and press Enter...";
        setTimeout(() => {
          input.focus();
        }, 50);
        if (consoleBody) {
          consoleBody.scrollTop = consoleBody.scrollHeight;
        }
      }
    });
  }

  function submitTerminalInput() {
    if (!activeInputResolve) return;
    const input = document.getElementById("pyTermInputField");
    const bar = document.getElementById("pyTerminalInputBar");
    const val = input ? input.value : "";
    if (bar) bar.style.display = "none";
    if (consoleMeta) consoleMeta.textContent = "Running script...";
    const resolve = activeInputResolve;
    activeInputResolve = null;
    resolve(val);
  }

  const termSubmitBtn = document.getElementById("pyTermSubmitBtn");
  const termInputField = document.getElementById("pyTermInputField");
  if (termSubmitBtn) {
    termSubmitBtn.addEventListener("click", () => submitTerminalInput());
  }
  if (termInputField) {
    termInputField.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitTerminalInput();
      }
    });
  }

  function preparePythonCodeForTerminal(rawCode) {
    const lines = rawCode.split("\n");
    const processed = lines.map((line) => {
      const commentIdx = line.indexOf("#");
      if (commentIdx !== -1) {
        const codePart = line.substring(0, commentIdx);
        const commentPart = line.substring(commentIdx);
        return codePart.replace(/\binput\s*\(/g, "(await __terminal_input(") + commentPart;
      }
      return line.replace(/\binput\s*\(/g, "(await __terminal_input(");
    });
    return processed.join("\n");
  }

  // Fallback JS-based lightweight Python executor in case Pyodide CDN is unreachable
  async function evaluateFallbackPython(code, onInput) {
    const lines = code.split("\n");
    let stdout = "";
    let stderr = "";
    const vars = {};

    try {
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        // Input assignment: var = int(input("...")) or var = input("...")
        const inputMatch = trimmed.match(/^([a-zA-Z_]\w*)\s*=\s*(?:(int|float)\s*\(\s*)?input\s*\((.*?)\)\s*\)?$/);
        if (inputMatch) {
          const varName = inputMatch[1];
          const castType = inputMatch[2];
          const rawPrompt = inputMatch[3].trim();
          let promptText = "";
          if (rawPrompt) {
            promptText = rawPrompt.replace(/^['"]|['"]$/g, "");
            stdout += promptText;
            consoleBody.textContent = stdout;
          }
          let inputVal = onInput ? await onInput(promptText) : "python123";
          stdout += String(inputVal) + "\n";
          consoleBody.textContent = stdout;
          if (castType === "int") inputVal = parseInt(inputVal, 10);
          else if (castType === "float") inputVal = parseFloat(inputVal);
          else inputVal = String(inputVal);
          vars[varName] = inputVal;
          continue;
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
          consoleBody.textContent = stdout;
        }
      }
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
        consoleBody.textContent = "";

        // Provide real-time live stdout/stderr hooks
        window.__py_stdout_write = (chunk) => {
          stdout += chunk;
          consoleBody.textContent = stdout;
          consoleBody.scrollTop = consoleBody.scrollHeight;
        };

        window.__py_stderr_write = (chunk) => {
          stderr += chunk;
          consoleBody.textContent = (stdout ? stdout + "\n" : "") + stderr;
          consoleBody.scrollTop = consoleBody.scrollHeight;
        };

        window.__js_terminal_input = async (promptStr) => {
          return await requestTerminalInput(promptStr);
        };

        const wrapper = `
import sys
import js

class __LiveStdout:
    def __init__(self):
        self.buffer = ""
    def write(self, s):
        val = str(s)
        self.buffer += val
        js.__py_stdout_write(val)
    def flush(self):
        pass

class __LiveStderr:
    def __init__(self):
        self.buffer = ""
    def write(self, s):
        val = str(s)
        self.buffer += val
        js.__py_stderr_write(val)
    def flush(self):
        pass

__live_out = __LiveStdout()
__live_err = __LiveStderr()
sys.stdout = __live_out
sys.stderr = __live_err

async def __terminal_input(prompt=""):
    prompt_str = str(prompt) if prompt is not None else ""
    if prompt_str:
        sys.stdout.write(prompt_str)
    val = await js.__js_terminal_input(prompt_str)
    sys.stdout.write(str(val) + "\\n")
    return str(val)
`;
        await pyodide.runPythonAsync(wrapper);

        const codeToRun = preparePythonCodeForTerminal(code);

        try {
          await pyodide.runPythonAsync(codeToRun);
        } catch (execErr) {
          runError = execErr;
          if (execErr && execErr.message) {
            stderr += (stderr ? "\n" : "") + execErr.message;
          }
        }

        const teardown = `
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
`;
        try {
          await pyodide.runPythonAsync(teardown);
        } catch {}
      } else {
        // Fallback engine
        const fallbackRes = await evaluateFallbackPython(code, requestTerminalInput);
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
