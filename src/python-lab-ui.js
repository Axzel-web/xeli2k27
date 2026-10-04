// ============================================================================
// Interactive Python Code Lab UI Component
// Clean, distraction-free Python challenge environment with zero top icon nav bar,
// zero dock sidebar clutter, full CodeMirror integration for flawless arrow key navigation,
// and multi-engine Python 3 execution (Skulpt, Pyodide, and Pure-JS AST runner).
// ============================================================================

import { playCliSound } from "./cli-lab-ui.js";
import { runPython } from "./python-runner.js";

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
  const tokenRegex = /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?''')|((?:[brufBRUF]{1,2})?"(?:[^"\\\n]|\\.)*"|(?:[brufBRUF]{1,2})?'(?:[^'\\\n]|\\.)*')|(\b\d+(?:\.\d+)?\b)|(\b(?:def|class|lambda|import|from|as|global|nonlocal|async|await)\b)|(\b(?:if|elif|else|for|while|break|continue|return|yield|try|except|finally|raise|pass|with|match|case)\b)|(\b(?:True|False|None)\b)|(\b(?:print|input|len|range|type|int|str|float|bool|list|dict|tuple|set|sum|min|max|abs|round|sorted|enumerate|zip|open|isinstance|id)\b)|(\b(?:and|or|not|is|in)\b)|(\b[a-zA-Z_]\w*(?=\s*\())|(\b[a-zA-Z_]\w*\b)|([+\-*/%&|^~=<>!]=?|\*\*|\/\/)|([()[\]{}])/g;

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

// Level Specific Metadata matching curriculum
export const LEVEL_METADATA = {
  1: {
    displayTitle: "Hello World!",
    breadcrumb: "Introduction",
    badge: "Beginner",
    task: "Your task is to write a program that outputs <code>Hello World!</code>",
    note: "Note that anything inside quotation marks is <strong>case sensitive</strong>. The two lines below are not the same program: the first prints <code>Hello World!</code> with capital letters, the second prints <code>hello world!</code> in lowercase, and only the first one matches this task.",
    examples: ['print("Hello World!")', 'print("hello world!")'],
    expected: "Hello World!",
    solution: 'print("Hello World!")'
  },
  2: {
    displayTitle: "Variables & Data Types",
    breadcrumb: "Python Fundamentals",
    badge: "Beginner",
    task: "Your task is to define variables of 4 core data types (str, int, float, bool), display them with <code>type()</code>, and swap two variables without a third variable.",
    note: "Python dynamically infers variable types. You can inspect any variable with <code>type(var)</code>. To swap two variables in Python without a third variable, use tuple unpacking: <code>a, b = b, a</code>.",
    examples: ['name = "AXZEL"\nage = 21', 'print(name, type(name))', 'a, b = b, a'],
    expected: "AXZEL <class 'str'>\n21 <class 'int'>\n1.75 <class 'float'>\nTrue <class 'bool'>\nSwapped: a=20, b=10",
    solution: 'name = "AXZEL"\nage = 21\nheight = 1.75\nis_hunter = True\n\nprint(name, type(name))\nprint(age, type(age))\nprint(height, type(height))\nprint(is_hunter, type(is_hunter))\n\na = 10\nb = 20\na, b = b, a\nprint(f"Swapped: a={a}, b={b}")'
  },
  3: {
    displayTitle: "Arithmetic, Input & Typecasting",
    breadcrumb: "Python Fundamentals",
    badge: "Beginner",
    task: "Your task is to ask for numbers with <code>input()</code>, typecast them with <code>int()</code>, and calculate with arithmetic operators (+, -, *, /, //, %, **).",
    note: "Remember: <code>input()</code> returns a string. Convert it with <code>int(input(...))</code>. Slicing and formatted f-strings <code>f\"{var}\"</code> cleanly display numbers.",
    examples: ['num1 = int(input("Enter first number: "))', 'print(f"Addition (+): {num1 + num2}")'],
    expected: "Addition (+): 15\nSubtraction (-): 5\nMultiplication (*): 50\nDivision (/): 2.0\nFloor Division (//): 2\nModulus (%): 0\nExponent (**): 100000",
    solution: 'x = 10\ny = 5\nprint(f"Addition (+): {x + y}")\nprint(f"Subtraction (-): {x - y}")\nprint(f"Multiplication (*): {x * y}")\nprint(f"Division (/): {x / y}")\nprint(f"Floor Division (//): {x // y}")\nprint(f"Modulus (%): {x % y}")\nprint(f"Exponent (**): {x ** y}")'
  },
  4: {
    displayTitle: "Strings, Indexing & Slicing",
    breadcrumb: "Python Fundamentals",
    badge: "Beginner",
    task: "Your task is to manipulate strings using <code>.upper()</code>, <code>.lower()</code>, slicing <code>[:3]</code>, <code>len()</code>, and reverse a string using <code>[::-1]</code>.",
    note: "Slicing syntax is <code>string[start:end:step]</code>. With step <code>-1</code> (like <code>[::-1]</code>), Python reverses the string cleanly without needing loops.",
    examples: ['name = "Python Hunter"', 'print(name.upper())', 'print(name[::-1])'],
    expected: "UPPERCASE: PYTHON HUNTER\nlowercase: python hunter\nFirst 3 letters: PYT\nLength: 13\nReversed: retnuH nohtyP",
    solution: 'name = "Python Hunter"\nprint(f"UPPERCASE: {name.upper()}")\nprint(f"lowercase: {name.lower()}")\nprint(f"First 3 letters: {name[:3].upper()}")\nprint(f"Length: {len(name)}")\nprint(f"Reversed: {name[::-1]}")'
  },
  5: {
    displayTitle: "If Statements & Conditionals",
    breadcrumb: "Control Flow",
    badge: "Beginner",
    task: "Your task is to evaluate exam scores and hunter rankings using <code>if</code>, <code>elif</code>, and <code>else</code> branching.",
    note: "Indentation in Python defines code blocks. Keep 4 spaces consistently beneath every condition.",
    examples: ['if score >= 90:\n    rank = "S"', 'elif score >= 80:\n    rank = "A"'],
    expected: "Score 85: Rank A (Passed)",
    solution: 'score = 85\nif score >= 90:\n    rank = "S"\nelif score >= 80:\n    rank = "A"\nelif score >= 70:\n    rank = "B"\nelse:\n    rank = "C"\nprint(f"Score {score}: Rank {rank} (Passed)")'
  },
  6: {
    displayTitle: "Loops & Flow Control",
    breadcrumb: "Control Flow",
    badge: "Beginner",
    task: "Your task is to countdown from 10 to 1 with a <code>while</code> loop printing 'Liftoff!', and sum numbers from 1 to 100 with a <code>for</code> loop.",
    note: "A <code>while</code> loop repeats while its condition is true. A <code>for</code> loop with <code>range(1, 101)</code> iterates through all numbers up to 100.",
    examples: ['while count >= 1:\n    print(count)\n    count -= 1', 'for n in range(1, 101):\n    total += n'],
    expected: "10\n9\n8\n7\n6\n5\n4\n3\n2\n1\nLiftoff!\nSum 1 to 100: 5050",
    solution: 'count = 10\nwhile count >= 1:\n    print(count)\n    count -= 1\nprint("Liftoff!")\n\ntotal = 0\nfor n in range(1, 101):\n    total += n\nprint(f"Sum 1 to 100: {total}")'
  },
  7: {
    displayTitle: "Mini-Project — Password Lock",
    breadcrumb: "Mini-Projects",
    badge: "Intermediate",
    task: "Your task is to build a terminal password lock system with maximum 3 attempts using a <code>while</code> loop, <code>break</code>, and boolean state flags.",
    note: "Avoid printing 'ACCESS DENIED' when login succeeds! Set a boolean flag <code>logged_in = False</code>. Inside the loop, when password is correct, set <code>logged_in = True</code> and <code>break</code>. Only print 'ACCESS DENIED' if <code>not logged_in</code>.",
    examples: ['correct_password = "python123"', 'if password == correct_password:\n    logged_in = True\n    break'],
    expected: "ENTER YOUR PASSWORD: \nACCESS GRANTED",
    solution: 'correct_password = "python123"\nattempt = 0\nlogged_in = False\n\nwhile attempt < 3:\n    pwd = input("ENTER YOUR PASSWORD: ")\n    if pwd == correct_password:\n        logged_in = True\n        print("ACCESS GRANTED")\n        break\n    else:\n        attempt += 1\n        print("Incorrect password please try again")\n\nif not logged_in:\n    print("ACCESS DENIED TOO MANY FAILED ATTEMPTS")'
  },
  8: {
    displayTitle: "Lists",
    breadcrumb: "Data Structures",
    badge: "Beginner",
    task: "Your task is to create a list of items, append 5 items using <code>.append()</code>, print the list, and inspect its length.",
    note: "Lists are ordered, mutable sequences in square brackets <code>[]</code>. Add items one-by-one with <code>.append(...)</code>.",
    examples: ['groceries = []', 'groceries.append("apple")', 'print(len(groceries))'],
    expected: "['apple', 'banana', 'milk', 'bread', 'eggs']\n5",
    solution: 'groceries = []\ngroceries.append("apple")\ngroceries.append("banana")\ngroceries.append("milk")\ngroceries.append("bread")\ngroceries.append("eggs")\nprint(groceries)\nprint(len(groceries))'
  },
  9: {
    displayTitle: "Tuples",
    breadcrumb: "Data Structures",
    badge: "Beginner",
    task: "Your task is to create a tuple of 4 items, print the tuple, print the item at index 1, and the last item using <code>[-1]</code>.",
    note: "Tuples use parentheses <code>()</code> and are immutable. Access items with zero-based index <code>tuple[0]</code> or negative index <code>tuple[-1]</code>.",
    examples: ['my_tuple = ("AXZEL", 21, 5.9, True)', 'print(my_tuple[1])', 'print(my_tuple[-1])'],
    expected: "('AXZEL', 21, 5.9, True)\n21\nTrue",
    solution: 'my_tuple = ("AXZEL", 21, 5.9, True)\nprint(my_tuple)\nprint(my_tuple[1])\nprint(my_tuple[-1])'
  },
  10: {
    displayTitle: "Dictionaries",
    breadcrumb: "Data Structures",
    badge: "Medium",
    task: "Your task is to create a dictionary with at least 4 key-value pairs, print it, print a specific key, and loop through it with <code>.items()</code>.",
    note: "Dictionaries store key-value pairs in <code>{}</code>. Iterate over both keys and values using <code>for key, value in profile.items():</code>.",
    examples: ['profile = {"name": "AXZEL", "age": 21}', 'print(profile["name"])', 'for key, value in profile.items():'],
    expected: "{'name': 'AXZEL', 'age': 21, 'course': 'Computer Engr', 'hobby': 'Gaming'}\nAXZEL\nname: AXZEL\nage: 21\ncourse: Computer Engr\nhobby: Gaming",
    solution: 'profile = {\n    "name": "AXZEL",\n    "age": 21,\n    "course": "Computer Engr",\n    "hobby": "Gaming"\n}\nprint(profile)\nprint(profile["name"])\nfor key, value in profile.items():\n    print(f"{key}: {value}")'
  },
  11: {
    displayTitle: "Nested Data Structures",
    breadcrumb: "Data Structures",
    badge: "Medium",
    task: "Your task is to combine lists and dictionaries to model structured data (e.g. hunter profiles with a list of skills, or list of student records).",
    note: "Access nested data by chaining brackets: <code>hunter['skills'][0]</code> or <code>students[0]['name']</code>.",
    examples: ['hunter = {"name": "AXZEL", "skills": ["Slash", "Stealth"]}', 'print(hunter["skills"][0])'],
    expected: "Hunter: AXZEL | Skills: Slash, Stealth, Cleave\nPrimary Skill: Slash",
    solution: 'hunter = {\n    "name": "AXZEL",\n    "skills": ["Slash", "Stealth", "Cleave"]\n}\nprint(f"Hunter: {hunter[\'name\']} | Skills: {\', \'.join(hunter[\'skills\'])}")\nprint(f"Primary Skill: {hunter[\'skills\'][0]}")'
  }
};

export function renderPythonLabChallenge(c, solved, onClaimExp, getPyodide, state = {}, onClose = null) {
  const container = document.getElementById("chBody");
  if (!container) return;

  const lvlNum = c.levelNumber || parseInt((c.id.match(/level-(\d+)/) || [])[1] || "1", 10);
  const meta = LEVEL_METADATA[lvlNum] || {
    displayTitle: c.title.replace(/^Level \d+:\s*/, ""),
    breadcrumb: "Python Fundamentals",
    badge: c.difficulty || "Beginner",
    task: `Your task is to complete the ${escapeHtml(c.title)} mission.`,
    note: c.intro || "Write clean, indented Python code to satisfy all challenge goals.",
    examples: ['print("Hello World!")'],
    expected: "Hello World!",
    solution: c.starter || 'print("Hello World!")'
  };

  const savedKey = `py_code_${c.id}`;
  const initialCode = localStorage.getItem(savedKey) || c.starter || "";

  let isExecuting = false;
  let allGoalsSatisfied = solved;

  // Render Clean Layout (NO top gamification icon bar, NO dock sidebar buttons)
  container.innerHTML = `
    <div class="py-coddy-container" id="pyCoddyContainer">
      <div class="py-coddy-body">
        <!-- Left Column: Challenge Description & Objectives -->
        <div class="py-challenge-pane" id="pyChallengePane">
          <div class="py-challenge-header">
            <h2 class="py-challenge-title">${escapeHtml(meta.displayTitle)}</h2>
          </div>

          <!-- Mission Task Card -->
          <div class="py-mission-card">
            <div class="py-challenge-kicker">
              <span class="py-kicker-title">Challenge Objective</span>
              <span class="py-badge-pill">${escapeHtml(meta.badge)}</span>
              <span class="py-exp-pill">+${c.exp} EXP</span>
            </div>

            <p class="py-task-lead">${meta.task}</p>

            <!-- Guide Callout Box -->
            <div class="py-callout-box">
              <p class="py-callout-text">${meta.note}</p>
              ${meta.examples && meta.examples.length ? `
                <div class="py-callout-examples">
                  ${meta.examples.map((ex) => `
                    <div class="py-callout-code-item">
                      <code>${highlightPython(ex)}</code>
                    </div>
                  `).join("")}
                </div>
              ` : ''}
            </div>

            <!-- Optional Concept Reference (Integrated cleanly without sidebar buttons) -->
            ${(c.concepts && c.concepts.length) ? `
              <details class="py-concepts-details">
                <summary class="py-concepts-summary">Concept Guide &amp; Syntax Reference</summary>
                <div class="py-concepts-content">
                  ${c.concepts.map((cp) => `
                    <div class="py-concept-item">
                      <div class="py-concept-name"><code>${escapeHtml(cp.name)}</code></div>
                      <div class="py-concept-desc">${escapeHtml(cp.desc)}</div>
                      ${cp.code ? `<pre class="py-snippet-code"><code>${highlightPython(cp.code)}</code></pre>` : ''}
                    </div>
                  `).join("")}
                </div>
              </details>
            ` : ''}

            <!-- Objectives Checklist -->
            <div class="py-goals-card">
              <div class="py-goals-header">
                <span class="py-goals-title">LIVE OBJECTIVES</span>
                <span class="py-goals-count" id="pyProgressCounter">${solved ? (c.goals || [1]).length : 0} / ${(c.goals || [1]).length}</span>
              </div>
              <ul class="py-goals-list" id="pyGoalsList">
                ${(c.goals || [{ id: "output", text: `Output matches expected format: ${meta.expected.split("\n")[0]}` }]).map((g) => `
                  <li class="py-goal-item ${solved ? 'is-satisfied' : ''}" id="pyGoal-${g.id}">
                    <span class="py-goal-check" id="pyGoalIcon-${g.id}">${solved ? '✔' : '○'}</span>
                    <div class="py-goal-desc">
                      <span class="py-goal-text">${escapeHtml(g.text)}</span>
                      ${g.hint ? `<span class="py-goal-hint">${escapeHtml(g.hint)}</span>` : ''}
                    </div>
                  </li>
                `).join("")}
              </ul>
            </div>
          </div>

          <!-- Bottom Action Bar -->
          <div class="py-explain-bar">
            <button type="button" class="btn btn-primary py-claim-btn" id="pyClaimExpBtn" ${solved ? '' : 'disabled'}>
              ${solved ? 'EXP Claimed ✔' : `Claim +${c.exp} EXP`}
            </button>
          </div>
        </div>

        <!-- Right Column: Code Editor & Test Cases -->
        <div class="py-ide-pane">
          <!-- Editor Section -->
          <div class="py-editor-section">
            <div class="py-editor-topbar">
              <div class="py-lang-tab is-active">
                <span>main.py</span>
              </div>
            </div>

            <!-- Code Area with Full CodeMirror / Textarea Support -->
            <div class="py-editor-canvas" id="pyEditorCanvas">
              <div class="py-gutter" id="pyGutter"></div>
              <div class="py-code-stage">
                <pre class="py-highlight-layer" id="pyHighlightLayer" aria-hidden="true"><code id="pyCodeHighlight"></code></pre>
                <textarea class="py-textarea" id="pyCodeTextarea" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off">${escapeHtml(initialCode)}</textarea>
              </div>

              <!-- Floating Run Code Button -->
              <div class="py-floating-actions">
                <button type="button" class="py-run-btn" id="pyRunBtn" title="Run Code (Ctrl + Enter)">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  <span>Run Code</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Bottom Test Cases Panel -->
          <div class="py-testcases-panel" id="pyTestCasesPanel">
            <div class="py-tc-tabs">
              <button type="button" class="py-tc-tab is-active" id="pyTabTestCases">TEST CASES</button>
              <button type="button" class="py-tc-tab" id="pyTabSolution">SOLUTION</button>
              <span class="py-tc-status-text" id="pyExecStatusText">Ready to run</span>
            </div>

            <!-- Test Cases View -->
            <div class="py-tc-body" id="pyTcBodyTestCases">
              <div class="py-tc-columns">
                <!-- Left: Actual Output -->
                <div class="py-tc-col">
                  <div class="py-tc-label">Output</div>
                  <pre class="py-output-box" id="pyOutputBox">Click "▶ Run Code" or press Ctrl+Enter to execute.</pre>
                  
                  <!-- Interactive Terminal Input Bar -->
                  <div class="py-term-input-bar" id="pyTerminalInputBar" style="display:none;">
                    <span class="py-term-prompt-icon">&gt;&gt;&gt;</span>
                    <span class="py-term-prompt-text" id="pyTermPromptText">input:</span>
                    <input type="text" class="py-term-input-field" id="pyTermInputField" placeholder="Type input here and press Enter..." autocomplete="off" spellcheck="false" />
                    <button type="button" class="py-term-submit-btn" id="pyTermSubmitBtn">Send ↵</button>
                  </div>
                </div>

                <!-- Right: Expected Output -->
                <div class="py-tc-col">
                  <div class="py-tc-head-row">
                    <span class="py-tc-label">Expected Output</span>
                    <label class="py-toggle-wrap" title="Toggle expected output display">
                      <input type="checkbox" id="pyExpectedToggle" checked />
                      <span class="py-toggle-slider"></span>
                    </label>
                  </div>
                  <pre class="py-expected-box" id="pyExpectedBox">${escapeHtml(meta.expected)}</pre>
                </div>
              </div>

              <!-- Pass/Fail Banner -->
              <div class="py-eval-banner" id="pyEvalBanner" style="display:none;"></div>
            </div>

            <!-- Solution View -->
            <div class="py-tc-body" id="pyTcBodySolution" style="display:none;">
              <div class="py-solution-wrap">
                <div class="py-solution-title">Reference Python Solution:</div>
                <pre class="py-solution-code"><code>${highlightPython(meta.solution)}</code></pre>
                <button type="button" class="py-copy-solution-btn" id="pyCopySolutionBtn">Copy to Editor</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // DOM Elements
  const textarea = document.getElementById("pyCodeTextarea");
  const gutter = document.getElementById("pyGutter");
  const highlightCodeEl = document.getElementById("pyCodeHighlight");
  const highlightLayer = document.getElementById("pyHighlightLayer");
  const runBtn = document.getElementById("pyRunBtn");
  const claimBtn = document.getElementById("pyClaimExpBtn");
  const outputBox = document.getElementById("pyOutputBox");
  const expectedBox = document.getElementById("pyExpectedBox");
  const evalBanner = document.getElementById("pyEvalBanner");
  const statusText = document.getElementById("pyExecStatusText");
  const progressCounter = document.getElementById("pyProgressCounter");
  const expectedToggle = document.getElementById("pyExpectedToggle");
  const tabTestCases = document.getElementById("pyTabTestCases");
  const tabSolution = document.getElementById("pyTabSolution");
  const tcBodyTestCases = document.getElementById("pyTcBodyTestCases");
  const tcBodySolution = document.getElementById("pyTcBodySolution");
  const copySolutionBtn = document.getElementById("pyCopySolutionBtn");

  // CodeMirror instance
  let cm = null;

  // Helper to read and write editor content cleanly across CodeMirror & Textarea
  function getCode() {
    if (cm) return cm.getValue();
    return textarea ? textarea.value : "";
  }

  function setCode(code) {
    if (cm) {
      cm.setValue(code);
      cm.focus();
    } else if (textarea) {
      textarea.value = code;
      syncFallbackEditor();
      textarea.focus();
    }
    localStorage.setItem(savedKey, code);
  }

  function saveCode() {
    const code = getCode();
    localStorage.setItem(savedKey, code);
    if (statusText) statusText.textContent = "Code saved!";
    setTimeout(() => { if (statusText) statusText.textContent = "Ready to run"; }, 1500);
    playCliSound("key");
  }

  // Fallback editor sync for when CodeMirror is not present
  function syncFallbackEditor() {
    if (!textarea) return;
    const code = textarea.value;
    if (highlightCodeEl) {
      highlightCodeEl.innerHTML = highlightPython(code);
    }
    if (gutter) {
      const lineCount = Math.max(code.split("\n").length, 1);
      let gutterHtml = "";
      for (let i = 1; i <= lineCount; i++) {
        gutterHtml += `<div class="py-line-num">${i}</div>`;
      }
      gutter.innerHTML = gutterHtml;
    }
    localStorage.setItem(savedKey, code);
  }

  // Initialize CodeMirror for full arrow key navigation, cursor tracking, and syntax highlighting
  function initCodeEditor() {
    if (typeof window !== "undefined" && window.CodeMirror && textarea) {
      try {
        cm = window.CodeMirror.fromTextArea(textarea, {
          mode: { name: "python", version: 3, singleLineStringErrors: false },
          theme: "dracula",
          lineNumbers: true,
          tabSize: 4,
          indentUnit: 4,
          indentWithTabs: false,
          lineWrapping: false,
          matchBrackets: true,
          autoCloseBrackets: true,
          viewportMargin: Infinity,
          cursorScrollMargin: 20,
          extraKeys: {
            "Ctrl-Enter": () => executeCode(),
            "Cmd-Enter": () => executeCode(),
            "Ctrl-S": () => {
              saveCode();
              return false;
            },
            "Cmd-S": () => {
              saveCode();
              return false;
            },
            "Tab": (instance) => {
              if (instance.somethingSelected()) {
                instance.indentSelection("add");
              } else {
                instance.replaceSelection("    ", "end");
              }
            },
            "Shift-Tab": (instance) => {
              instance.indentSelection("subtract");
            }
          }
        });

        cm.setValue(initialCode);

        // Hide fallback elements since CodeMirror handles gutters and highlight layers natively
        if (gutter) gutter.style.display = "none";
        if (highlightLayer) highlightLayer.style.display = "none";

        cm.on("change", () => {
          const val = cm.getValue();
          localStorage.setItem(savedKey, val);
        });

        // Ensure cursor positioning and viewport are refreshed after mounting
        setTimeout(() => {
          if (cm) {
            cm.refresh();
            cm.focus();
          }
        }, 50);

        return;
      } catch (err) {
        console.warn("CodeMirror initialization failed, falling back to textarea:", err);
        cm = null;
      }
    }

    // Fallback: Setup native textarea with arrow key preservation
    syncFallbackEditor();

    if (textarea) {
      textarea.addEventListener("scroll", () => {
        if (highlightLayer) {
          highlightLayer.scrollTop = textarea.scrollTop;
          highlightLayer.scrollLeft = textarea.scrollLeft;
        }
        if (gutter) {
          gutter.scrollTop = textarea.scrollTop;
        }
      });

      textarea.addEventListener("input", () => {
        syncFallbackEditor();
      });

      textarea.addEventListener("keydown", (e) => {
        // Explicitly allow arrow keys to pass cleanly without any interference
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(e.key)) {
          return;
        }

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const val = textarea.value;

        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          executeCode();
          return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          saveCode();
          return;
        }

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
            }
          } else {
            textarea.value = val.substring(0, start) + "    " + val.substring(end);
            textarea.selectionStart = textarea.selectionEnd = start + 4;
          }
          syncFallbackEditor();
          playCliSound("tab");
          return;
        }

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
          syncFallbackEditor();
          playCliSound("enter");
          return;
        }

        const pairs = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'" };
        if (pairs[e.key]) {
          const closing = pairs[e.key];
          if ((e.key === '"' || e.key === "'") && val[start] === e.key && start === end) {
            e.preventDefault();
            textarea.selectionStart = textarea.selectionEnd = start + 1;
            return;
          }
          e.preventDefault();
          const selected = val.substring(start, end);
          textarea.value = val.substring(0, start) + e.key + selected + closing + val.substring(end);
          textarea.selectionStart = textarea.selectionEnd = start + 1 + selected.length;
          syncFallbackEditor();
          playCliSound("key");
          return;
        }
      });
    }
  }

  initCodeEditor();

  // Tabs: Test Cases vs Solution
  if (tabTestCases && tabSolution) {
    tabTestCases.addEventListener("click", () => {
      tabTestCases.classList.add("is-active");
      tabSolution.classList.remove("is-active");
      tcBodyTestCases.style.display = "flex";
      tcBodySolution.style.display = "none";
      playCliSound("key");
    });
    tabSolution.addEventListener("click", () => {
      tabSolution.classList.add("is-active");
      tabTestCases.classList.remove("is-active");
      tcBodyTestCases.style.display = "none";
      tcBodySolution.style.display = "block";
      playCliSound("key");
    });
  }

  // Copy Solution to Editor
  if (copySolutionBtn) {
    copySolutionBtn.addEventListener("click", () => {
      setCode(meta.solution);
      playCliSound("enter");
      tabTestCases.click();
    });
  }

  // Expected Output Toggle
  if (expectedToggle && expectedBox) {
    expectedToggle.addEventListener("change", () => {
      expectedBox.style.display = expectedToggle.checked ? "block" : "none";
    });
  }

  // Claim EXP
  if (claimBtn) {
    claimBtn.addEventListener("click", () => {
      if (claimBtn.disabled) return;
      claimBtn.disabled = true;
      claimBtn.textContent = "EXP Claimed ✔";
      onClaimExp(c);
      playCliSound("enter");
    });
  }

  // Interactive Terminal Input Handler
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
      if (statusText) {
        statusText.textContent = "Awaiting terminal input ↵";
      }
      if (bar && input) {
        bar.style.display = "flex";
        input.value = "";
        input.placeholder = promptText ? `Enter: ${promptText.trim()}` : "Type input and press Enter...";
        setTimeout(() => input.focus(), 50);
        if (outputBox) outputBox.scrollTop = outputBox.scrollHeight;
      }
    });
  }

  function submitTerminalInput() {
    if (!activeInputResolve) return;
    const input = document.getElementById("pyTermInputField");
    const bar = document.getElementById("pyTerminalInputBar");
    const val = input ? input.value : "";
    if (bar) bar.style.display = "none";
    if (statusText) statusText.textContent = "Running script...";
    const resolve = activeInputResolve;
    activeInputResolve = null;
    resolve(val);
  }

  const termSubmitBtn = document.getElementById("pyTermSubmitBtn");
  const termInputField = document.getElementById("pyTermInputField");
  if (termSubmitBtn) termSubmitBtn.addEventListener("click", submitTerminalInput);
  if (termInputField) {
    termInputField.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitTerminalInput();
      }
    });
  }

  // Live Goal Check Evaluator
  function evaluateGoals(code, stdout, stderr, runError) {
    const goals = c.goals || [{ id: "output", text: "Output matches expected format" }];
    let satisfiedCount = 0;

    goals.forEach((g) => {
      let isMet = false;

      if (c.id === "py-level-1-output-comments") {
        if (g.id === "comment") {
          isMet = /(?:^|\n)\s*#[^\n]+/m.test(code);
        } else if (g.id === "three_prints") {
          const printMatches = code.match(/\bprint\s*\(/g);
          isMet = Boolean(printMatches && printMatches.length >= 1);
        } else if (g.id === "about_me") {
          isMet = !runError && (stdout.includes("Hello World!") || stdout.trim().length > 0);
        } else {
          isMet = !runError && stdout.trim().length > 0;
        }
      } else if (c.id === "py-level-2-variables-data-types") {
        if (g.id === "variable_roundup") {
          const combined = (code + "\n" + stdout).toLowerCase();
          isMet = !runError && (combined.includes("str") || combined.includes("int") || combined.includes("float"));
        } else if (g.id === "swap_variables") {
          isMet = !runError && (/\b([a-zA-Z_]\w*)\s*,\s*([a-zA-Z_]\w*)\s*=\s*\2\s*,\s*\1\b/.test(code) || stdout.includes("Swapped"));
        } else {
          isMet = !runError && stdout.trim().length > 0;
        }
      } else if (c.id === "py-level-3-arithmetic-input-typecasting") {
        if (g.id === "mini_calculator") {
          isMet = !runError && (/\+/.test(code) || stdout.includes("Addition"));
        } else if (g.id === "age_from_birth_year") {
          isMet = !runError && (code.includes("input") || stdout.trim().length > 0);
        } else {
          isMet = !runError && stdout.trim().length > 0;
        }
      } else if (c.id === "py-level-4-strings-indexing-slicing") {
        if (g.id === "name_manipulation") {
          isMet = !runError && (code.includes(".upper()") || code.includes(".lower()") || code.includes("[:3]") || stdout.includes("PYTHON"));
        } else if (g.id === "reverse_string") {
          isMet = !runError && (code.includes("[::-1]") || stdout.includes("retnuH"));
        } else {
          isMet = !runError && stdout.trim().length > 0;
        }
      } else if (c.id === "py-level-5-if-conditionals") {
        isMet = !runError && (code.includes("if ") && (code.includes("else:") || code.includes("elif ")) || stdout.includes("Rank"));
      } else if (c.id === "py-level-6-loops-flow-control") {
        isMet = !runError && ((code.includes("for ") || code.includes("range(") || code.includes("while ")) || stdout.includes("5050") || stdout.includes("Liftoff"));
      } else if (c.id === "py-level-7-mini-project-password-lock") {
        isMet = !runError && (stdout.includes("ACCESS GRANTED") || stdout.includes("ENTER YOUR PASSWORD") || code.includes("while "));
      } else if (c.id === "py-level-8-lists") {
        isMet = !runError && (code.includes(".append(") || code.includes("[") || stdout.includes("apple"));
      } else if (c.id === "py-level-9-tuples") {
        isMet = !runError && (code.includes("(") || stdout.includes("21"));
      } else if (c.id === "py-level-10-dictionaries") {
        isMet = !runError && (code.includes("{") || stdout.includes("AXZEL"));
      } else if (c.id === "py-level-11-nested-data-structures") {
        isMet = !runError && (code.includes("{") || stdout.includes("Slash"));
      } else {
        isMet = !runError && stdout.trim().length > 0;
      }

      const itemEl = document.getElementById(`pyGoal-${g.id}`);
      const iconEl = document.getElementById(`pyGoalIcon-${g.id}`);
      if (itemEl && iconEl) {
        if (isMet) {
          itemEl.classList.add("is-satisfied");
          iconEl.textContent = "✔";
          satisfiedCount++;
        } else {
          itemEl.classList.remove("is-satisfied");
          iconEl.textContent = "○";
        }
      }
    });

    if (progressCounter) {
      progressCounter.textContent = `${satisfiedCount} / ${goals.length}`;
    }

    allGoalsSatisfied = satisfiedCount === goals.length;
    return allGoalsSatisfied;
  }

  // Execute Code Function with Live Stream and Evaluation
  async function executeCode() {
    if (isExecuting) return;
    const code = getCode();

    isExecuting = true;
    runBtn.disabled = true;
    runBtn.classList.add("is-running");
    if (statusText) statusText.textContent = "Running script...";
    outputBox.textContent = "Executing Python script...";
    outputBox.classList.remove("is-error");
    evalBanner.style.display = "none";

    try {
      const res = await runPython(code, {
        onStdout: (chunk) => {
          outputBox.textContent = chunk;
          outputBox.scrollTop = outputBox.scrollHeight;
        },
        onStderr: (chunk) => {
          outputBox.textContent = chunk;
          outputBox.scrollTop = outputBox.scrollHeight;
        },
        onInput: requestTerminalInput,
        getPyodide
      });

      const finalOut = (res.stdout || "").trim();
      const finalErr = (res.stderr || "").trim();

      if (res.runError || finalErr) {
        outputBox.textContent = (finalOut ? finalOut + "\n\n" : "") + `Runtime Error:\n${finalErr || res.runError?.message}`;
        outputBox.classList.add("is-error");
        statusText.textContent = "Execution failed";
        evalBanner.style.display = "flex";
        evalBanner.className = "py-eval-banner is-failed";
        evalBanner.innerHTML = `<span>✖ Output did not match or error occurred. Review your syntax above.</span>`;
        playCliSound("backspace");
      } else {
        outputBox.textContent = finalOut || "[Finished with no output]";
        outputBox.classList.remove("is-error");
        statusText.textContent = "Execution succeeded";

        // Check if output matches expected or satisfies objectives
        const normalizedOut = finalOut.toLowerCase().replace(/\s+/g, " ").trim();
        const normalizedExpected = meta.expected.toLowerCase().replace(/\s+/g, " ").trim();
        const matchesExpected = normalizedOut.includes(normalizedExpected) || normalizedExpected.includes(normalizedOut);

        const goalsPassed = evaluateGoals(code, finalOut, finalErr, res.runError);

        evalBanner.style.display = "flex";
        if (goalsPassed || matchesExpected) {
          evalBanner.className = "py-eval-banner is-passed";
          evalBanner.innerHTML = `<span>✔ Test Case Passed! (All challenge objectives cleared)</span>`;
          if (claimBtn) {
            claimBtn.disabled = false;
            claimBtn.classList.add("is-ready");
          }
          playCliSound("enter");
        } else {
          evalBanner.className = "py-eval-banner is-failed";
          evalBanner.innerHTML = `<span>● Keep going! Check the live objectives and expected output format.</span>`;
          playCliSound("key");
        }
      }
    } catch (fatal) {
      outputBox.textContent = `Fatal Error: ${fatal.message || fatal}`;
      outputBox.classList.add("is-error");
      statusText.textContent = "Fatal Error";
      playCliSound("backspace");
    } finally {
      isExecuting = false;
      runBtn.disabled = false;
      runBtn.classList.remove("is-running");
    }
  }

  if (runBtn) {
    runBtn.addEventListener("click", () => {
      executeCode();
    });
  }
}
