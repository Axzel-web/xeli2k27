// ============================================================================
// Interactive IP Addressing & Binary Subnetting Hands-on Lab
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

export function renderBinaryLabChallenge(c, solved, onClaimExp) {
  const container = document.getElementById("chBody");
  if (!container) return;

  // Active Bit States for the 8-bit visual register: [128, 64, 32, 16, 8, 4, 2, 1]
  const bitWeights = [128, 64, 32, 16, 8, 4, 2, 1];
  let bitStates = [1, 1, 0, 0, 0, 0, 0, 0]; // default: 192

  // Interactive challenges state
  const stageStates = {
    s1: { input: "", targetDec: 168, correctBin: "10101000", ok: false },
    s2: { input: "", targetBin: "11110000", correctDec: 240, ok: false },
    s3: {
      net: "",
      bcast: "",
      first: "",
      last: "",
      targetIp: "192.168.10.65/26",
      correctNet: "192.168.10.64",
      correctBcast: "192.168.10.127",
      correctFirst: "192.168.10.65",
      correctLast: "192.168.10.126",
      ok: false,
    },
    s4: {
      net: "",
      bcast: "",
      first: "",
      last: "",
      targetIp: "10.0.4.18/30",
      correctNet: "10.0.4.16",
      correctBcast: "10.0.4.19",
      correctFirst: "10.0.4.17",
      correctLast: "10.0.4.18",
      ok: false,
    },
  };

  container.innerHTML = `
    <div class="bin-lab-wrap">
      <!-- Header / Overview -->
      <div class="bin-lab-header">
        <div class="bin-lab-badge-row">
          <span class="diff-tag">${escapeHtml(c.difficulty || "Medium")}</span>
          <span class="cli-track-pill">Interactive Hands-on Lab</span>
          <span class="cli-exp-badge">+${c.exp} EXP</span>
        </div>
        <h3 class="bin-lab-title">${escapeHtml(c.title)}</h3>
        <p class="bin-lab-desc">
          Master IPv4 binary octet math, subnet masks, CIDR prefix notation, and network/broadcast calculations with real-time interactive tooling and instant validation.
        </p>
      </div>

      <!-- Section 1: Interactive 8-Bit Octet Register -->
      <div class="bin-card">
        <div class="bin-card-head">
          <h4 class="bin-card-title">1. Interactive 8-Bit Binary Bit Register</h4>
          <span class="bin-card-sub">Click individual bit switches or use quick presets</span>
        </div>
        <div class="bin-bit-grid" id="binBitGrid">
          ${bitWeights
            .map(
              (w, i) => `
            <button type="button" class="bin-bit-btn ${bitStates[i] ? "is-active" : ""}" data-idx="${i}">
              <span class="bin-bit-val">${bitStates[i]}</span>
              <span class="bin-bit-weight">${w}</span>
              <span class="bin-bit-power">2<sup>${7 - i}</sup></span>
            </button>
          `
            )
            .join("")}
        </div>

        <div class="bin-display-row">
          <div class="bin-val-box">
            <span class="bin-val-label">Binary Byte</span>
            <span class="bin-val-code" id="binByteDisplay">11000000</span>
          </div>
          <div class="bin-val-operator">=</div>
          <div class="bin-val-box">
            <span class="bin-val-label">Decimal Value</span>
            <span class="bin-val-num" id="binDecDisplay">192</span>
          </div>
          <div class="bin-val-box">
            <span class="bin-val-label">Hexadecimal</span>
            <span class="bin-val-code" id="binHexDisplay">0xC0</span>
          </div>
        </div>

        <div class="bin-presets-row">
          <span class="bin-preset-label">Subnet Mask Octet Presets:</span>
          <div class="bin-preset-chips" id="binPresetChips">
            <button type="button" class="bin-chip" data-dec="255">255 (/32)</button>
            <button type="button" class="bin-chip" data-dec="254">254 (/31)</button>
            <button type="button" class="bin-chip" data-dec="252">252 (/30)</button>
            <button type="button" class="bin-chip" data-dec="248">248 (/29)</button>
            <button type="button" class="bin-chip" data-dec="240">240 (/28)</button>
            <button type="button" class="bin-chip" data-dec="224">224 (/27)</button>
            <button type="button" class="bin-chip" data-dec="192">192 (/26)</button>
            <button type="button" class="bin-chip" data-dec="128">128 (/25)</button>
            <button type="button" class="bin-chip" data-dec="0">0 (/24)</button>
          </div>
        </div>
      </div>

      <!-- Section 2: CIDR & Subnet Mask Inspector -->
      <div class="bin-card">
        <div class="bin-card-head">
          <h4 class="bin-card-title">2. Subnet Mask & Prefix Explorer</h4>
          <span class="bin-card-sub">Select prefix length to view binary breakdown & address capacities</span>
        </div>
        <div class="bin-cidr-slider-row">
          <label for="binCidrSlider" class="bin-slider-label">Prefix Length: <strong id="binCidrLabel">/24</strong></label>
          <input type="range" min="8" max="30" value="24" class="bin-slider" id="binCidrSlider" />
        </div>
        <div class="bin-cidr-details" id="binCidrDetails">
          <!-- Populated by updateCidrDetails() -->
        </div>
      </div>

      <!-- Section 3: Hands-On Practice Stages -->
      <div class="bin-card">
        <div class="bin-card-head">
          <h4 class="bin-card-title">3. Hands-On Verification Challenges</h4>
          <span class="bin-card-sub">Solve all 4 stages to unlock EXP</span>
        </div>

        <div class="bin-stages-list">
          <!-- Stage 1 -->
          <div class="bin-stage-item" id="stageItem1">
            <div class="bin-stage-head">
              <span class="bin-stage-num">Challenge 1</span>
              <span class="bin-stage-title">Convert Decimal <strong>168</strong> to 8-bit Binary</span>
              <span class="bin-stage-status" id="stageStatus1">○ Incomplete</span>
            </div>
            <div class="bin-stage-controls">
              <input type="text" maxlength="8" placeholder="e.g. 10101000" class="bin-stage-input" id="s1Input" />
              <button type="button" class="btn btn-secondary bin-check-btn" id="s1CheckBtn">Verify</button>
            </div>
            <p class="bin-stage-feedback" id="s1Feedback"></p>
          </div>

          <!-- Stage 2 -->
          <div class="bin-stage-item" id="stageItem2">
            <div class="bin-stage-head">
              <span class="bin-stage-num">Challenge 2</span>
              <span class="bin-stage-title">Convert Binary <strong>11110000</strong> to Decimal</span>
              <span class="bin-stage-status" id="stageStatus2">○ Incomplete</span>
            </div>
            <div class="bin-stage-controls">
              <input type="number" placeholder="e.g. 240" class="bin-stage-input" id="s2Input" />
              <button type="button" class="btn btn-secondary bin-check-btn" id="s2CheckBtn">Verify</button>
            </div>
            <p class="bin-stage-feedback" id="s2Feedback"></p>
          </div>

          <!-- Stage 3 -->
          <div class="bin-stage-item" id="stageItem3">
            <div class="bin-stage-head">
              <span class="bin-stage-num">Challenge 3</span>
              <span class="bin-stage-title">Subnet Math for <strong>192.168.10.65 /26</strong> (Block size: 64)</span>
              <span class="bin-stage-status" id="stageStatus3">○ Incomplete</span>
            </div>
            <div class="bin-subnet-grid">
              <div class="bin-sub-field">
                <label>Network Address</label>
                <input type="text" placeholder="e.g. 192.168.10.64" id="s3Net" class="bin-stage-input" />
              </div>
              <div class="bin-sub-field">
                <label>First Usable Host</label>
                <input type="text" placeholder="e.g. 192.168.10.65" id="s3First" class="bin-stage-input" />
              </div>
              <div class="bin-sub-field">
                <label>Last Usable Host</label>
                <input type="text" placeholder="e.g. 192.168.10.126" id="s3Last" class="bin-stage-input" />
              </div>
              <div class="bin-sub-field">
                <label>Broadcast Address</label>
                <input type="text" placeholder="e.g. 192.168.10.127" id="s3Bcast" class="bin-stage-input" />
              </div>
            </div>
            <button type="button" class="btn btn-secondary bin-check-btn" id="s3CheckBtn">Verify Subnet Details</button>
            <p class="bin-stage-feedback" id="s3Feedback"></p>
          </div>

          <!-- Stage 4 -->
          <div class="bin-stage-item" id="stageItem4">
            <div class="bin-stage-head">
              <span class="bin-stage-num">Challenge 4</span>
              <span class="bin-stage-title">Point-to-Point WAN Subnet Math for <strong>10.0.4.18 /30</strong> (Block size: 4)</span>
              <span class="bin-stage-status" id="stageStatus4">○ Incomplete</span>
            </div>
            <div class="bin-subnet-grid">
              <div class="bin-sub-field">
                <label>Network Address</label>
                <input type="text" placeholder="e.g. 10.0.4.16" id="s4Net" class="bin-stage-input" />
              </div>
              <div class="bin-sub-field">
                <label>First Usable Host</label>
                <input type="text" placeholder="e.g. 10.0.4.17" id="s4First" class="bin-stage-input" />
              </div>
              <div class="bin-sub-field">
                <label>Last Usable Host</label>
                <input type="text" placeholder="e.g. 10.0.4.18" id="s4Last" class="bin-stage-input" />
              </div>
              <div class="bin-sub-field">
                <label>Broadcast Address</label>
                <input type="text" placeholder="e.g. 10.0.4.19" id="s4Bcast" class="bin-stage-input" />
              </div>
            </div>
            <button type="button" class="btn btn-secondary bin-check-btn" id="s4CheckBtn">Verify WAN Subnet</button>
            <p class="bin-stage-feedback" id="s4Feedback"></p>
          </div>
        </div>
      </div>

      <!-- Action Footer -->
      <div class="bin-lab-footer">
        <div class="bin-progress-info">
          <span class="bin-progress-text" id="binProgressText">0 of 4 Challenges Solved</span>
          <div class="bin-progress-bar">
            <div class="bin-progress-fill" id="binProgressFill" style="width: 0%"></div>
          </div>
        </div>
        <button type="button" class="btn btn-primary bin-claim-btn" id="binClaimExpBtn" ${solved ? "disabled" : "disabled"}>
          ${solved ? "EXP Claimed" : `Claim ${c.exp} EXP`}
        </button>
      </div>
    </div>
  `;

  // Visual Register elements
  const bitGrid = document.getElementById("binBitGrid");
  const byteDisplay = document.getElementById("binByteDisplay");
  const decDisplay = document.getElementById("binDecDisplay");
  const hexDisplay = document.getElementById("binHexDisplay");

  function updateBitRegister() {
    const binStr = bitStates.join("");
    const decVal = bitStates.reduce((sum, b, i) => sum + (b ? bitWeights[i] : 0), 0);
    const hexVal = "0x" + decVal.toString(16).toUpperCase().padStart(2, "0");

    byteDisplay.textContent = binStr;
    decDisplay.textContent = decVal;
    hexDisplay.textContent = hexVal;

    const btns = bitGrid.querySelectorAll(".bin-bit-btn");
    btns.forEach((btn, i) => {
      btn.classList.toggle("is-active", Boolean(bitStates[i]));
      btn.querySelector(".bin-bit-val").textContent = bitStates[i];
    });
  }

  bitGrid.addEventListener("click", (e) => {
    const btn = e.target.closest(".bin-bit-btn");
    if (!btn) return;
    const idx = parseInt(btn.dataset.idx, 10);
    bitStates[idx] = bitStates[idx] ? 0 : 1;
    playCliSound("key");
    updateBitRegister();
  });

  // Preset chips
  document.getElementById("binPresetChips").addEventListener("click", (e) => {
    const chip = e.target.closest(".bin-chip");
    if (!chip) return;
    const dec = parseInt(chip.dataset.dec, 10);
    const bin = dec.toString(2).padStart(8, "0").split("").map(Number);
    bitStates = bin;
    playCliSound("tab");
    updateBitRegister();
  });

  // CIDR Inspector
  const cidrSlider = document.getElementById("binCidrSlider");
  const cidrLabel = document.getElementById("binCidrLabel");
  const cidrDetails = document.getElementById("binCidrDetails");

  function calcSubnetFromCidr(prefix) {
    const maskBits = "".padStart(prefix, "1").padEnd(32, "0");
    const octets = [];
    const wildcardOctets = [];
    for (let i = 0; i < 4; i++) {
      const byte = parseInt(maskBits.substring(i * 8, (i + 1) * 8), 2);
      octets.push(byte);
      wildcardOctets.push(255 - byte);
    }
    const hostBits = 32 - prefix;
    const totalHosts = Math.pow(2, hostBits);
    const usableHosts = prefix >= 31 ? (prefix === 31 ? 2 : 1) : totalHosts - 2;
    const maskStr = octets.join(".");
    const wildcardStr = wildcardOctets.join(".");
    const lastOctet = octets[3] || octets[2] || octets[1] || octets[0];
    const blockSize = 256 - lastOctet || 1;

    return { prefix, maskStr, wildcardStr, totalHosts, usableHosts, blockSize, maskBits };
  }

  function updateCidrDetails(prefix) {
    const s = calcSubnetFromCidr(prefix);
    cidrLabel.textContent = `/${prefix}`;
    cidrDetails.innerHTML = `
      <div class="bin-cidr-metric">
        <span class="bin-metric-lbl">Subnet Mask:</span>
        <span class="bin-metric-val">${escapeHtml(s.maskStr)}</span>
      </div>
      <div class="bin-cidr-metric">
        <span class="bin-metric-lbl">Wildcard Mask:</span>
        <span class="bin-metric-val">${escapeHtml(s.wildcardStr)}</span>
      </div>
      <div class="bin-cidr-metric">
        <span class="bin-metric-lbl">Total IPv4 Addresses:</span>
        <span class="bin-metric-val">${s.totalHosts.toLocaleString()}</span>
      </div>
      <div class="bin-cidr-metric">
        <span class="bin-metric-lbl">Usable Host Hosts:</span>
        <span class="bin-metric-val">${s.usableHosts.toLocaleString()}</span>
      </div>
      <div class="bin-cidr-metric">
        <span class="bin-metric-lbl">Block Size (Magic #):</span>
        <span class="bin-metric-val">${s.blockSize}</span>
      </div>
    `;
  }

  cidrSlider.addEventListener("input", () => {
    updateCidrDetails(parseInt(cidrSlider.value, 10));
    playCliSound("key");
  });

  // Verification Logic
  const claimBtn = document.getElementById("binClaimExpBtn");
  const progressText = document.getElementById("binProgressText");
  const progressFill = document.getElementById("binProgressFill");

  function evaluateStages() {
    if (solved) {
      progressText.textContent = "4 of 4 Challenges Solved (Cleared)";
      progressFill.style.width = "100%";
      claimBtn.disabled = true;
      claimBtn.textContent = "EXP Claimed";
      return;
    }

    let count = 0;
    if (stageStates.s1.ok) count++;
    if (stageStates.s2.ok) count++;
    if (stageStates.s3.ok) count++;
    if (stageStates.s4.ok) count++;

    const percent = Math.round((count / 4) * 100);
    progressText.textContent = `${count} of 4 Challenges Solved`;
    progressFill.style.width = `${percent}%`;

    if (count === 4) {
      claimBtn.disabled = false;
      claimBtn.classList.add("is-ready");
      claimBtn.textContent = `Claim ${c.exp} EXP!`;
    } else {
      claimBtn.disabled = true;
      claimBtn.classList.remove("is-ready");
      claimBtn.textContent = `Claim ${c.exp} EXP`;
    }
  }

  // Challenge 1 Verify
  document.getElementById("s1CheckBtn").addEventListener("click", () => {
    const val = (document.getElementById("s1Input").value || "").trim().replace(/\s+/g, "");
    const ok = val === stageStates.s1.correctBin;
    stageStates.s1.ok = ok;
    const fb = document.getElementById("s1Feedback");
    const st = document.getElementById("stageStatus1");
    if (ok) {
      fb.className = "bin-stage-feedback is-success";
      fb.textContent = "✔ Correct! 128 + 32 + 8 = 168 (Binary: 10101000)";
      st.className = "bin-stage-status is-ok";
      st.textContent = "✔ Solved";
      playCliSound("goal");
    } else {
      fb.className = "bin-stage-feedback is-error";
      fb.textContent = "✖ Not quite. Hint: 168 = 128 + 32 + 8. Check your active bit positions.";
      st.className = "bin-stage-status is-err";
      st.textContent = "○ Incorrect";
      playCliSound("error");
    }
    evaluateStages();
  });

  // Challenge 2 Verify
  document.getElementById("s2CheckBtn").addEventListener("click", () => {
    const val = parseInt((document.getElementById("s2Input").value || "").trim(), 10);
    const ok = val === stageStates.s2.correctDec;
    stageStates.s2.ok = ok;
    const fb = document.getElementById("s2Feedback");
    const st = document.getElementById("stageStatus2");
    if (ok) {
      fb.className = "bin-stage-feedback is-success";
      fb.textContent = "✔ Correct! 128 + 64 + 32 + 16 = 240";
      st.className = "bin-stage-status is-ok";
      st.textContent = "✔ Solved";
      playCliSound("goal");
    } else {
      fb.className = "bin-stage-feedback is-error";
      fb.textContent = "✖ Not quite. 11110000 has bits for 128, 64, 32, and 16 active.";
      st.className = "bin-stage-status is-err";
      st.textContent = "○ Incorrect";
      playCliSound("error");
    }
    evaluateStages();
  });

  // Challenge 3 Verify
  document.getElementById("s3CheckBtn").addEventListener("click", () => {
    const net = (document.getElementById("s3Net").value || "").trim();
    const first = (document.getElementById("s3First").value || "").trim();
    const last = (document.getElementById("s3Last").value || "").trim();
    const bcast = (document.getElementById("s3Bcast").value || "").trim();

    const ok =
      net === stageStates.s3.correctNet &&
      bcast === stageStates.s3.correctBcast &&
      first === stageStates.s3.correctFirst &&
      last === stageStates.s3.correctLast;

    stageStates.s3.ok = ok;
    const fb = document.getElementById("s3Feedback");
    const st = document.getElementById("stageStatus3");

    if (ok) {
      fb.className = "bin-stage-feedback is-success";
      fb.textContent = "✔ Perfect! Subnet block 64-127 correctly identified.";
      st.className = "bin-stage-status is-ok";
      st.textContent = "✔ Solved";
      playCliSound("goal");
    } else {
      fb.className = "bin-stage-feedback is-error";
      fb.textContent = "✖ Check values: with /26, block size is 64. Networks are .0, .64, .128, .192. Host 65 falls in network .64.";
      st.className = "bin-stage-status is-err";
      st.textContent = "○ Incorrect";
      playCliSound("error");
    }
    evaluateStages();
  });

  // Challenge 4 Verify
  document.getElementById("s4CheckBtn").addEventListener("click", () => {
    const net = (document.getElementById("s4Net").value || "").trim();
    const first = (document.getElementById("s4First").value || "").trim();
    const last = (document.getElementById("s4Last").value || "").trim();
    const bcast = (document.getElementById("s4Bcast").value || "").trim();

    const ok =
      net === stageStates.s4.correctNet &&
      bcast === stageStates.s4.correctBcast &&
      first === stageStates.s4.correctFirst &&
      last === stageStates.s4.correctLast;

    stageStates.s4.ok = ok;
    const fb = document.getElementById("s4Feedback");
    const st = document.getElementById("stageStatus4");

    if (ok) {
      fb.className = "bin-stage-feedback is-success";
      fb.textContent = "✔ Excellent! Point-to-point /30 subnet (Network .16, Broadcast .19, Hosts .17-.18) verified.";
      st.className = "bin-stage-status is-ok";
      st.textContent = "✔ Solved";
      playCliSound("goal");
    } else {
      fb.className = "bin-stage-feedback is-error";
      fb.textContent = "✖ For a /30 subnet, block size is 4. Multiples of 4 are 0, 4, 8, 12, 16, 20... Host .18 falls in network .16.";
      st.className = "bin-stage-status is-err";
      st.textContent = "○ Incorrect";
      playCliSound("error");
    }
    evaluateStages();
  });

  // Claim EXP
  claimBtn.addEventListener("click", () => {
    if (onClaimExp) {
      playCliSound("fanfare");
      onClaimExp(c);
      claimBtn.disabled = true;
      claimBtn.textContent = "EXP Claimed";
      claimBtn.classList.remove("is-ready");
      progressText.textContent = "4 of 4 Challenges Solved (Cleared)";
      progressFill.style.width = "100%";
    }
  });

  // Initial renders
  updateBitRegister();
  updateCidrDetails(24);
  evaluateStages();
}
