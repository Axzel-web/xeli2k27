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

// ============================================================================
// Web Audio Synthesizer for Cisco CLI Retro Mechanical Typing Sounds
// ============================================================================
let cliAudioCtx = null;
let isCliSoundMuted = false;

function getCliAudioContext() {
  try {
    if (!cliAudioCtx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      cliAudioCtx = new AudioCtx();
    }
    if (cliAudioCtx && cliAudioCtx.state === "suspended") {
      cliAudioCtx.resume().catch(() => {});
    }
    return cliAudioCtx;
  } catch (e) {
    return null;
  }
}

export function playCliSound(type = "key") {
  if (isCliSoundMuted) return;
  const ctx = getCliAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  try {
    if (type === "key") {
      // High-volume vintage mechanical key click with randomized micro-jitter (1800Hz - 2300Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = "highpass";
      filter.frequency.setValueAtTime(800, now);

      const baseFreq = 1900 + (Math.random() * 450 - 225);
      osc.type = "triangle";
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(650, now + 0.022);

      gain.gain.setValueAtTime(0.48, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.032);

      // Secondary tactile casing thud for authentic high-volume clack
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(390 + Math.random() * 70, now);
      osc2.frequency.exponentialRampToValueAtTime(130, now + 0.025);
      gain2.gain.setValueAtTime(0.38, now);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now);
      osc2.stop(now + 0.035);
    } else if (type === "space") {
      // High-volume deeper acoustic spacebar thump
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.038);

      gain.gain.setValueAtTime(0.55, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === "backspace") {
      // High-volume quick crisp erasure snap
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(860, now);
      osc.frequency.exponentialRampToValueAtTime(340, now + 0.024);

      gain.gain.setValueAtTime(0.48, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.035);
    } else if (type === "enter") {
      // High-volume solid mechanical return latch clack (dual frequency)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "triangle";
      osc1.frequency.setValueAtTime(280, now);
      osc1.frequency.exponentialRampToValueAtTime(90, now + 0.045);

      osc2.type = "square";
      osc2.frequency.setValueAtTime(1400, now);
      osc2.frequency.exponentialRampToValueAtTime(380, now + 0.035);

      gain.gain.setValueAtTime(0.58, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.055);
      osc2.stop(now + 0.055);
    } else if (type === "tab") {
      // High-volume ascending dual auto-complete chirp
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(987.77, now);
      osc.frequency.setValueAtTime(1318.51, now + 0.04);

      gain.gain.setValueAtTime(0.50, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.13);
    } else if (type === "help") {
      // High-volume Contextual Help chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1174.66, now + 0.05);

      gain.gain.setValueAtTime(0.50, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.14);
    } else if (type === "error") {
      // High-volume Retro console buzzer/bell
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(320, now);

      gain.gain.setValueAtTime(0.46, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.17);
    } else if (type === "goal") {
      // High-volume Objective satisfied chime
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "triangle";
        o.frequency.setValueAtTime(freq, now + idx * 0.07);
        g.gain.setValueAtTime(0, now + idx * 0.07);
        g.gain.linearRampToValueAtTime(0.48, now + idx * 0.07 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.07 + 0.13);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(now + idx * 0.07);
        o.stop(now + idx * 0.07 + 0.15);
      });
    } else if (type === "fanfare") {
      // High-volume Claim EXP fanfare
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(freq, now + idx * 0.08);
        g.gain.setValueAtTime(0, now + idx * 0.08);
        g.gain.linearRampToValueAtTime(0.52, now + idx * 0.08 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.22);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(now + idx * 0.08);
        o.stop(now + idx * 0.08 + 0.24);
      });
    }
  } catch (e) {}
}

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
          <button class="cli-tool-btn cli-sound-toggle-btn" id="cliSoundToggleBtn" type="button" title="Toggle mechanical keyboard typing audio">🔊 Audio: On</button>
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
  const soundToggleBtn = document.getElementById("cliSoundToggleBtn");

  // Keep track of satisfied goals to trigger celebratory audio on new completion
  const satisfiedGoalsSet = new Set();

  // Keep screen focused on click
  screen.addEventListener("click", () => {
    hiddenInput.focus();
  });

  // Sync typed input display & trigger mechanical sound
  hiddenInput.addEventListener("input", () => {
    inputDisplay.textContent = hiddenInput.value;
    playCliSound(hiddenInput.value.endsWith(" ") ? "space" : "key");
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
    let newlySatisfied = false;

    c.goals.forEach((goal, i) => {
      const itemEl = document.getElementById(`cliGoal-${i}`);
      const iconEl = document.getElementById(`cliGoalIcon-${i}`);
      const ok = goal.check(device);

      if (ok) {
        satisfiedCount++;
        if (!satisfiedGoalsSet.has(i)) {
          satisfiedGoalsSet.add(i);
          newlySatisfied = true;
        }
        if (itemEl) itemEl.classList.add("is-satisfied");
        if (iconEl) iconEl.textContent = "✔";
      } else {
        satisfiedGoalsSet.delete(i);
        if (itemEl) itemEl.classList.remove("is-satisfied");
        if (iconEl) iconEl.textContent = "○";
      }
    });

    if (newlySatisfied) {
      playCliSound("goal");
    }

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
      if (
        result.output.includes("% Invalid") ||
        result.output.includes("% Incomplete") ||
        result.output.includes("% Bad") ||
        result.output.includes("% Access denied")
      ) {
        playCliSound("error");
      }
    }

    // Clear input
    hiddenInput.value = "";
    inputDisplay.textContent = "";

    // Update prompt & evaluate goals
    updatePrompt();
    renderHistory();
    evaluateGoals();
  }

  // Keyboard navigation & sound effects
  hiddenInput.addEventListener("keydown", (e) => {
    // Enter
    if (e.key === "Enter") {
      e.preventDefault();
      playCliSound("enter");
      runCurrentCommand();
      return;
    }

    // Backspace / Delete
    if (e.key === "Backspace" || e.key === "Delete") {
      playCliSound("backspace");
      return;
    }

    // Tab Completion
    if (e.key === "Tab") {
      e.preventDefault();
      playCliSound("tab");
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
      playCliSound("help");
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

  // Sound toggle button
  if (soundToggleBtn) {
    soundToggleBtn.addEventListener("click", () => {
      isCliSoundMuted = !isCliSoundMuted;
      soundToggleBtn.textContent = isCliSoundMuted ? "🔇 Audio: Muted" : "🔊 Audio: On";
      soundToggleBtn.classList.toggle("is-muted", isCliSoundMuted);
      if (!isCliSoundMuted) {
        playCliSound("key");
      }
      hiddenInput.focus();
    });
  }

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
      playCliSound("fanfare");
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
