// ============================================================================
// Cisco CLI Lab UI Component for XELI Leveling System
// Renders interactive retro terminal and dynamic live checklist
// ============================================================================

import {
  createDefaultDevice,
  getPrompt,
  executeCiscoCommand,
  getTabCompletion,
  getContextualHelp,
} from "./cisco-sim.js";

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function renderCliLabChallenge(c, solved, onClaimExp) {
  const container = document.getElementById("chBody");
  if (!container) return;

  // Initialize simulated device
  let device = createDefaultDevice({
    deviceType: c.deviceType || "router",
    hostname: c.initialHostname || "Router",
  });

  // Terminal state
  const history = [];
  let historyIdx = -1;
  const terminalLines = [];

  // Initial welcome/boot text
  terminalLines.push({
    type: "system",
    text: `Cisco IOS Software, C2900 Software (C2900-UNIVERSALK9-M), Version 15.4(3)M2
Technical Support: http://www.cisco.com/techsupport
XELI CCNA Terminal Simulator [v2.4 - Ready]
Type "?" for help or press [Tab] for command completion.
`,
  });

  // Render main layout
  container.innerHTML = `
    <div class="cli-lab-layout">
      <!-- Left Panel: Scenario & Live Objectives -->
      <div class="cli-lab-sidebar panel">
        <div class="cli-scenario-box">
          <div class="cli-badge-row">
            <span class="diff-tag">${escapeHtml(c.difficulty || "Easy")}</span>
            <span class="cli-track-pill">Interactive CLI Simulator</span>
            <span class="cli-exp-badge">+${c.exp} EXP</span>
          </div>
          <h4 class="cli-scenario-title">${escapeHtml(c.title)}</h4>
          <p class="cli-scenario-desc">${escapeHtml(c.intro || c.scenario || "")}</p>
        </div>

        <div class="cli-objectives-box">
          <div class="cli-obj-head">
            <span class="cli-obj-heading">LIVE OBJECTIVES</span>
            <span class="cli-progress-counter" id="cliProgressCounter">0 / ${c.goals.length}</span>
          </div>
          <div class="cli-progress-bar-wrap">
            <div class="cli-progress-bar-fill" id="cliProgressBarFill" style="width: 0%"></div>
          </div>
          
          <ul class="cli-goals-list" id="cliGoalsList">
            ${c.goals
              .map(
                (g, i) => `
              <li class="cli-goal-item ${solved ? "is-satisfied" : ""}" id="cliGoal-${i}">
                <span class="cli-goal-icon" id="cliGoalIcon-${i}">${solved ? "✔" : "○"}</span>
                <div class="cli-goal-info">
                  <span class="cli-goal-text">${escapeHtml(g.text)}</span>
                  ${g.hint ? `<span class="cli-goal-hint">${escapeHtml(g.hint)}</span>` : ""}
                </div>
              </li>`
              )
              .join("")}
          </ul>
        </div>

        <!-- Quick Reference / Cheat Sheet -->
        <details class="cli-cheatsheet-box" open>
          <summary class="cli-cheatsheet-summary">CLI Command Reference</summary>
          <div class="cli-cheatsheet-content">
            <code>enable</code> <span>Enter privileged EXEC mode</span><br>
            <code>conf t</code> <span>Enter global configuration</span><br>
            <code>hostname &lt;name&gt;</code> <span>Set device identity</span><br>
            <code>banner motd #&lt;msg&gt;#</code> <span>Configure login banner</span><br>
            <code>enable secret &lt;pass&gt;</code> <span>Set encrypted admin password</span><br>
            <code>interface &lt;name&gt;</code> <span>Enter interface sub-config</span><br>
            <code>ip address &lt;ip&gt; &lt;mask&gt;</code> <span>Assign interface IP</span><br>
            <code>no shutdown</code> <span>Turn on interface</span><br>
            <code>show running-config</code> <span>Inspect active running config</span><br>
            <code>show ip int brief</code> <span>Check IP status & protocol</span><br>
            <code>copy run start</code> <span>Save to startup memory</span><br>
            <code>exit / end</code> <span>Step down mode or jump to #</span>
          </div>
        </details>

        <!-- Actions -->
        <div class="cli-action-footer">
          <button class="btn btn-secondary cli-reset-btn" id="cliResetBtn" title="Reboot and wipe configuration">
            ↺ Reset Device
          </button>
          <button class="btn btn-primary cli-claim-btn" id="cliClaimExpBtn" ${solved ? "disabled" : "disabled"}>
            ${solved ? "EXP Claimed" : `Claim ${c.exp} EXP`}
          </button>
        </div>
      </div>

      <!-- Right Panel: Cisco IOS Retro Terminal Window -->
      <div class="cli-terminal-window">
        <div class="cli-term-titlebar">
          <div class="cli-term-title-left">
            <span class="cli-term-icon">📟</span>
            <span class="cli-term-title-text" id="cliTermTitle">Cisco IOS Console - ${escapeHtml(device.hostname)} (tty0)</span>
          </div>
          <div class="cli-term-controls">
            <button class="cli-win-btn" id="cliTermMinBtn" title="Minimize">_</button>
            <button class="cli-win-btn" id="cliTermMaxBtn" title="Maximize">□</button>
            <button class="cli-win-btn" id="cliTermHelpBtn" title="Context Help">?</button>
          </div>
        </div>

        <!-- Quick Toolbar -->
        <div class="cli-term-toolbar">
          <button class="cli-tool-btn" id="cliTabBtn" type="button" title="Auto-complete command">[Tab] Complete</button>
          <button class="cli-tool-btn" id="cliQuestionBtn" type="button" title="View valid commands in current mode">[?] Help</button>
          <button class="cli-tool-btn" id="cliEndBtn" type="button" title="Jump to privileged EXEC">end (Ctrl+Z)</button>
          <button class="cli-tool-btn" id="cliClearBtn" type="button" title="Clear screen">Clear</button>
        </div>

        <!-- Terminal Screen -->
        <div class="cli-term-screen" id="cliTermScreen" tabindex="0" role="region" aria-label="Cisco Terminal Screen">
          <div class="cli-term-history" id="cliTermHistory"></div>
          
          <div class="cli-term-prompt-line">
            <span class="cli-term-prompt" id="cliPrompt">${escapeHtml(getPrompt(device))} </span>
            <span class="cli-term-input-display" id="cliInputDisplay"></span>
            <span class="cli-term-cursor">█</span>
            <input type="text" class="cli-term-hidden-input" id="cliHiddenInput" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
          </div>
        </div>
      </div>
    </div>
  `;

  // Element handles
  const screen = document.getElementById("cliTermScreen");
  const historyEl = document.getElementById("cliTermHistory");
  const promptEl = document.getElementById("cliPrompt");
  const inputDisplay = document.getElementById("cliInputDisplay");
  const hiddenInput = document.getElementById("cliHiddenInput");
  const titleEl = document.getElementById("cliTermTitle");
  const claimBtn = document.getElementById("cliClaimExpBtn");
  const resetBtn = document.getElementById("cliResetBtn");
  const progressCounter = document.getElementById("cliProgressCounter");
  const progressBarFill = document.getElementById("cliProgressBarFill");

  // Keep screen focused on click
  screen.addEventListener("click", () => {
    hiddenInput.focus();
  });

  // Sync typed input display
  hiddenInput.addEventListener("input", () => {
    inputDisplay.textContent = hiddenInput.value;
  });

  function renderHistory() {
    historyEl.innerHTML = terminalLines
      .map((item) => {
        if (item.type === "cmd") {
          return `<div class="cli-line-cmd"><span class="cli-line-prompt">${escapeHtml(item.prompt)}</span> <span class="cli-line-cmd-text">${escapeHtml(item.cmd)}</span></div>`;
        }
        return `<pre class="cli-line-output">${escapeHtml(item.text)}</pre>`;
      })
      .join("");
    // Auto scroll to bottom
    screen.scrollTop = screen.scrollHeight;
  }

  // Update prompt and window title
  function updatePrompt() {
    const p = getPrompt(device);
    promptEl.textContent = p + " ";
    titleEl.textContent = `Cisco IOS Console - ${device.hostname} (tty0)`;
  }

  // Evaluate lab goals
  function evaluateGoals() {
    if (solved) {
      progressCounter.textContent = `${c.goals.length} / ${c.goals.length}`;
      progressBarFill.style.width = "100%";
      claimBtn.disabled = true;
      claimBtn.textContent = "EXP Claimed";
      return;
    }

    let satisfiedCount = 0;
    c.goals.forEach((goal, i) => {
      const itemEl = document.getElementById(`cliGoal-${i}`);
      const iconEl = document.getElementById(`cliGoalIcon-${i}`);
      const ok = goal.check(device);

      if (ok) {
        satisfiedCount++;
        if (itemEl) itemEl.classList.add("is-satisfied");
        if (iconEl) iconEl.textContent = "✔";
      } else {
        if (itemEl) itemEl.classList.remove("is-satisfied");
        if (iconEl) iconEl.textContent = "○";
      }
    });

    const percent = Math.round((satisfiedCount / c.goals.length) * 100);
    progressCounter.textContent = `${satisfiedCount} / ${c.goals.length}`;
    progressBarFill.style.width = `${percent}%`;

    if (satisfiedCount === c.goals.length) {
      claimBtn.disabled = false;
      claimBtn.classList.add("is-ready");
      claimBtn.textContent = `Claim ${c.exp} EXP!`;
    } else {
      claimBtn.disabled = true;
      claimBtn.classList.remove("is-ready");
      claimBtn.textContent = `Claim ${c.exp} EXP`;
    }
  }

  // Execute current command line
  function runCurrentCommand() {
    const rawVal = hiddenInput.value;
    const currentPrompt = getPrompt(device);

    // Append command to visual history
    terminalLines.push({ type: "cmd", prompt: currentPrompt, cmd: rawVal });

    if (rawVal.trim()) {
      history.push(rawVal);
      historyIdx = history.length;
    }

    // Execute via engine
    const result = executeCiscoCommand(device, rawVal);
    device = result.device;

    if (result.output) {
      terminalLines.push({ type: "output", text: result.output });
    }

    // Clear input
    hiddenInput.value = "";
    inputDisplay.textContent = "";

    // Update prompt & evaluate goals
    updatePrompt();
    renderHistory();
    evaluateGoals();
  }

  // Keyboard navigation
  hiddenInput.addEventListener("keydown", (e) => {
    // Enter
    if (e.key === "Enter") {
      e.preventDefault();
      runCurrentCommand();
      return;
    }

    // Tab Completion
    if (e.key === "Tab") {
      e.preventDefault();
      const current = hiddenInput.value;
      const completed = getTabCompletion(device, current);
      if (completed !== current) {
        hiddenInput.value = completed;
        inputDisplay.textContent = completed;
      }
      return;
    }

    // Contextual Help "?"
    if (e.key === "?") {
      e.preventDefault();
      const current = hiddenInput.value;
      const helpItems = getContextualHelp(device, current);
      const prompt = getPrompt(device);
      terminalLines.push({ type: "cmd", prompt, cmd: current + "?" });
      if (helpItems.length > 0) {
        const text = helpItems.map((h) => `  ${h.cmd.padEnd(25, " ")} ${h.desc}`).join("\n");
        terminalLines.push({ type: "output", text });
      } else {
        terminalLines.push({ type: "output", text: "% No matching commands found." });
      }
      renderHistory();
      return;
    }

    // Arrow Up (History back)
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      if (historyIdx > 0) {
        historyIdx--;
      }
      const val = history[historyIdx] || "";
      hiddenInput.value = val;
      inputDisplay.textContent = val;
      return;
    }

    // Arrow Down (History forward)
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (history.length === 0) return;
      if (historyIdx < history.length - 1) {
        historyIdx++;
        const val = history[historyIdx] || "";
        hiddenInput.value = val;
        inputDisplay.textContent = val;
      } else {
        historyIdx = history.length;
        hiddenInput.value = "";
        inputDisplay.textContent = "";
      }
      return;
    }

    // Ctrl+C or Ctrl+Z -> end command (jump back to Privileged EXEC)
    if ((e.ctrlKey && e.key === "c") || (e.ctrlKey && e.key === "z")) {
      e.preventDefault();
      const prompt = getPrompt(device);
      terminalLines.push({ type: "cmd", prompt, cmd: "^Z" });
      if (device.mode !== "user_exec" && device.mode !== "priv_exec") {
        device.mode = "priv_exec";
        device.currentInterface = null;
        device.currentLine = null;
        terminalLines.push({ type: "output", text: "%SYS-5-CONFIG_I: Configured from console by console" });
      }
      hiddenInput.value = "";
      inputDisplay.textContent = "";
      updatePrompt();
      renderHistory();
      evaluateGoals();
      return;
    }

    // Ctrl+L -> clear screen
    if (e.ctrlKey && e.key === "l") {
      e.preventDefault();
      terminalLines.length = 0;
      renderHistory();
      return;
    }
  });

  // Toolbar button hooks
  document.getElementById("cliTabBtn").addEventListener("click", () => {
    hiddenInput.focus();
    const completed = getTabCompletion(device, hiddenInput.value);
    hiddenInput.value = completed;
    inputDisplay.textContent = completed;
  });

  document.getElementById("cliQuestionBtn").addEventListener("click", () => {
    hiddenInput.focus();
    const prompt = getPrompt(device);
    const helpItems = getContextualHelp(device, hiddenInput.value);
    terminalLines.push({ type: "cmd", prompt, cmd: (hiddenInput.value || "") + "?" });
    if (helpItems.length > 0) {
      terminalLines.push({
        type: "output",
        text: helpItems.map((h) => `  ${h.cmd.padEnd(25, " ")} ${h.desc}`).join("\n"),
      });
    }
    renderHistory();
  });

  document.getElementById("cliEndBtn").addEventListener("click", () => {
    hiddenInput.focus();
    const prompt = getPrompt(device);
    terminalLines.push({ type: "cmd", prompt, cmd: "end" });
    if (device.mode !== "user_exec" && device.mode !== "priv_exec") {
      device.mode = "priv_exec";
      device.currentInterface = null;
      device.currentLine = null;
      terminalLines.push({ type: "output", text: "%SYS-5-CONFIG_I: Configured from console by console" });
    }
    updatePrompt();
    renderHistory();
    evaluateGoals();
  });

  document.getElementById("cliClearBtn").addEventListener("click", () => {
    terminalLines.length = 0;
    renderHistory();
    hiddenInput.focus();
  });

  // Reset terminal button
  resetBtn.addEventListener("click", () => {
    device = createDefaultDevice({
      deviceType: c.deviceType || "router",
      hostname: c.initialHostname || "Router",
    });
    terminalLines.length = 0;
    terminalLines.push({
      type: "system",
      text: `[System Restarted]
Cisco 2901 Processor Board initialized.
NVRAM cleared. Device restored to factory defaults.
Press RETURN to get started!
`,
    });
    hiddenInput.value = "";
    inputDisplay.textContent = "";
    updatePrompt();
    renderHistory();
    evaluateGoals();
    hiddenInput.focus();
  });

  // Claim EXP button
  claimBtn.addEventListener("click", () => {
    if (onClaimExp) {
      onClaimExp(c);
      claimBtn.disabled = true;
      claimBtn.textContent = "EXP Claimed";
      claimBtn.classList.remove("is-ready");
      progressCounter.textContent = `${c.goals.length} / ${c.goals.length}`;
      progressBarFill.style.width = "100%";
    }
  });

  // Initial render & focus
  renderHistory();
  updatePrompt();
  evaluateGoals();
  setTimeout(() => {
    hiddenInput.focus();
  }, 100);
}
