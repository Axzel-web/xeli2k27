import * as THREE from "three";

// Dynamic animated components in the facility
export const blinkingLEDs = [];
export const spinningFans = [];
let nocCanvas = null;
let nocCtx = null;
let nocTexture = null;
let lastNocUpdate = 0;
let packetTrafficOffset = 0;

// ----------------------------------------------------------------------------
// PROCEDURAL PBR TEXTURE GENERATORS
// ----------------------------------------------------------------------------

export function createRaisedFloorTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  // Base dark industrial anti-static tile color (60cm x 60cm server tiles)
  ctx.fillStyle = "#121927";
  ctx.fillRect(0, 0, 512, 512);

  // Micro-stippled surface noise (anti-static vinyl composite)
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const alpha = 0.015 + Math.random() * 0.04;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  // 4x4 Grid of 128px tiles with subtle tonal shifts between adjacent tiles
  const tileSize = 128;
  for (let tx = 0; tx < 512; tx += tileSize) {
    for (let ty = 0; ty < 512; ty += tileSize) {
      const tileShift = ((tx / tileSize + ty / tileSize) % 2 === 0 ? 3 : -3);
      if (tileShift > 0) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.02)";
        ctx.fillRect(tx, ty, tileSize, tileSize);
      }

      // Outer tile perimeter seam (beveled edge)
      ctx.strokeStyle = "#080c14";
      ctx.lineWidth = 3;
      ctx.strokeRect(tx, ty, tileSize, tileSize);

      // Inner subtle metallic highlight bevel
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      ctx.strokeRect(tx + 2, ty + 2, tileSize - 4, tileSize - 4);

      // Corner screw anchor indentations (anti-static pedestal screw anchors)
      const corners = [
        [tx + 10, ty + 10],
        [tx + tileSize - 10, ty + 10],
        [tx + 10, ty + tileSize - 10],
        [tx + tileSize - 10, ty + tileSize - 10]
      ];
      corners.forEach(([cx, cy]) => {
        ctx.fillStyle = "#080d16";
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(10, 10);
  return texture;
}

export function createPerforatedVentTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0e1522";
  ctx.fillRect(0, 0, 128, 128);

  ctx.fillStyle = "#04070d";
  for (let x = 4; x < 128; x += 8) {
    for (let y = 4; y < 128; y += 8) {
      ctx.beginPath();
      ctx.arc(x + (y % 16 === 0 ? 0 : 4), y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

export function createServerFaceplateTexture(type = "switch", label = "") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  // Dark brushed aluminum chassis
  ctx.fillStyle = type === "router" ? "#141c2c" : (type === "storage" ? "#0f1622" : (type === "firewall" ? "#1e1b2e" : "#121927"));
  ctx.fillRect(0, 0, 512, 128);

  // Brushed metal hairline streaks
  ctx.strokeStyle = "rgba(255, 255, 255, 0.035)";
  for (let i = 0; i < 128; i += 3) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  // Rack Unit Mounting Ears on left and right
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(0, 0, 16, 128);
  ctx.fillRect(496, 0, 16, 128);

  // Screw holes on rack ears
  ctx.fillStyle = "#090d16";
  [24, 104].forEach((sy) => {
    ctx.beginPath(); ctx.arc(8, sy, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(504, sy, 4, 0, Math.PI * 2); ctx.fill();
  });

  if (type === "switch") {
    // Cisco Catalyst 9300 48P Enterprise Switch
    ctx.fillStyle = "#00d2ff";
    ctx.font = "bold 13px 'JetBrains Mono', monospace";
    ctx.fillText(label || "CISCO CATALYST 9300 48P-PoE+", 24, 22);

    // RJ-45 Port Grid (2 rows of 24 ports)
    for (let row = 0; row < 2; row++) {
      for (let p = 0; p < 24; p++) {
        const px = 24 + p * 15;
        const py = 45 + row * 28;
        // Port socket
        ctx.fillStyle = "#05080e";
        ctx.fillRect(px, py, 11, 16);
        ctx.strokeStyle = "#25344d";
        ctx.strokeRect(px, py, 11, 16);
        // Gold contact pins
        ctx.fillStyle = "#eab308";
        ctx.fillRect(px + 2, py + 11, 7, 3);
        // Link/Act LED
        ctx.fillStyle = p % 3 === 0 ? "#10b981" : (p % 7 === 0 ? "#f59e0b" : "#00d2ff");
        ctx.fillRect(px + 3, py - 6, 5, 3);
      }
    }

    // 4x SFP+ 10G/25G Uplink Cages on right
    for (let s = 0; s < 4; s++) {
      const sx = 400 + s * 22;
      ctx.fillStyle = "#1a2538";
      ctx.fillRect(sx, 48, 18, 32);
      ctx.strokeStyle = "#38bdf8";
      ctx.strokeRect(sx, 48, 18, 32);
      ctx.fillStyle = "#10b981";
      ctx.fillRect(sx + 6, 38, 6, 4);
    }
  } else if (type === "storage") {
    // 2U Storage Blade Server with 12x 3.5" SAS Hot-Swap Drive Caddies
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 13px 'JetBrains Mono', monospace";
    ctx.fillText(label || "ENTERPRISE BLADE SERVER // SAS-RAID 10", 24, 22);

    for (let c = 0; c < 12; c++) {
      const cx = 24 + c * 39;
      ctx.fillStyle = "#162032";
      ctx.fillRect(cx, 38, 34, 72);
      ctx.strokeStyle = "#2b3b55";
      ctx.strokeRect(cx, 38, 34, 72);
      // Drive release handle
      ctx.fillStyle = "#0b101a";
      ctx.fillRect(cx + 4, 92, 26, 12);
      // Disk activity LED
      ctx.fillStyle = c % 2 === 0 ? "#10b981" : "#00d2ff";
      ctx.fillRect(cx + 6, 44, 5, 4);
    }
  } else if (type === "firewall") {
    // Next-Gen Hardware Firewall (Fortinet / Palo Alto Style)
    ctx.fillStyle = "#1e1b2e";
    ctx.fillRect(0, 0, 512, 128);

    // Red Security Accent Top Bar
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(0, 0, 512, 6);

    ctx.fillStyle = "#f87171";
    ctx.font = "bold 13px 'JetBrains Mono', monospace";
    ctx.fillText(label || "ENTERPRISE NGFW-500E // INTRUSION PREVENTION", 24, 24);

    // RJ-45 & SFP+ Security Ports
    for (let p = 0; p < 16; p++) {
      const px = 24 + p * 19;
      ctx.fillStyle = "#090d16";
      ctx.fillRect(px, 50, 14, 20);
      ctx.strokeStyle = "#475569";
      ctx.strokeRect(px, 50, 14, 20);
      ctx.fillStyle = p % 2 === 0 ? "#10b981" : "#00d2ff";
      ctx.fillRect(px + 4, 38, 6, 4);
    }

    ctx.fillStyle = "#10b981";
    ctx.font = "bold 10px monospace";
    ctx.fillText("HA: CLUSTER SYNC [ACTIVE]", 340, 48);
    ctx.fillStyle = "#38bdf8";
    ctx.fillText("INSPECTION: DEEP SSL", 340, 68);
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("THREATS MITIGATED: 1,842", 340, 88);
  } else if (type === "fiber") {
    // 1U Optical Distribution Frame (ODF) Fiber Patch Bay
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, 512, 128);

    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 13px 'JetBrains Mono', monospace";
    ctx.fillText(label || "OPTICAL DISTRIBUTION FRAME // 48-STRAND LC/UPC", 24, 22);

    // Dual LC Duplex Adapter Couplers
    for (let f = 0; f < 12; f++) {
      const fx = 24 + f * 38;
      ctx.fillStyle = "#0284c7"; // LC Blue Coupler
      ctx.fillRect(fx, 46, 32, 42);
      ctx.strokeStyle = "#38bdf8";
      ctx.strokeRect(fx, 46, 32, 42);

      // Port ferrules
      ctx.fillStyle = "#040810";
      ctx.fillRect(fx + 4, 54, 10, 18);
      ctx.fillRect(fx + 18, 54, 10, 18);
      ctx.fillStyle = "#facc15";
      ctx.beginPath();
      ctx.arc(fx + 9, 63, 2, 0, Math.PI * 2);
      ctx.arc(fx + 23, 63, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === "patch") {
    // 48-Port Cat6 Patch Panel with Horizontal Cable Organizer Bar
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, 512, 128);

    ctx.fillStyle = "#cbd5e1";
    ctx.font = "bold 12px 'JetBrains Mono', monospace";
    ctx.fillText(label || "CAT6 GIGABIT PATCH PANEL // RACK DISTRIBUTION", 24, 22);

    // 24 Keystone RJ45 jacks
    for (let k = 0; k < 24; k++) {
      const kx = 24 + k * 19;
      ctx.fillStyle = "#020617";
      ctx.fillRect(kx, 42, 14, 20);
      ctx.strokeStyle = "#334155";
      ctx.strokeRect(kx, 42, 14, 20);

      // Port number
      ctx.fillStyle = "#64748b";
      ctx.font = "8px monospace";
      ctx.fillText(`${k + 1}`, kx + 2, 36);
    }

    // Horizontal Cable Management Ring Bar
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(24, 82, 464, 24);
    ctx.strokeStyle = "#475569";
    ctx.strokeRect(24, 82, 464, 24);
    for (let r = 0; r < 5; r++) {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(50 + r * 90, 86, 28, 16);
    }
  } else {
    // Cisco ISR Core Router
    ctx.fillStyle = "#00d2ff";
    ctx.font = "bold 13px 'JetBrains Mono', monospace";
    ctx.fillText(label || "CISCO 4451-X ISR // ROUTING ENGINE", 24, 22);

    // Modular NIM slots
    for (let m = 0; m < 3; m++) {
      const mx = 24 + m * 120;
      ctx.fillStyle = "#0a0f18";
      ctx.fillRect(mx, 40, 110, 68);
      ctx.strokeStyle = "#25344d";
      ctx.strokeRect(mx, 40, 110, 68);
      ctx.fillStyle = "#64748b";
      ctx.font = "10px monospace";
      ctx.fillText(`NIM-SLOT ${m}`, mx + 8, 56);
      // Dual Gigabit Ports per NIM
      ctx.fillStyle = "#05080e";
      ctx.fillRect(mx + 10, 68, 16, 22);
      ctx.fillRect(mx + 34, 68, 16, 22);
      ctx.fillStyle = "#10b981";
      ctx.fillRect(mx + 14, 94, 8, 3);
      ctx.fillRect(mx + 38, 94, 8, 3);
    }
  }

  return new THREE.CanvasTexture(canvas);
}

// ----------------------------------------------------------------------------
// NOC VIDEO WALL TEXTURE (Interactive High-Res 6-Panel Multi-Display)
// ----------------------------------------------------------------------------

export function createNocWallCanvasTexture() {
  nocCanvas = document.createElement("canvas");
  nocCanvas.width = 1024;
  nocCanvas.height = 512;
  nocCtx = nocCanvas.getContext("2d");
  nocTexture = new THREE.CanvasTexture(nocCanvas);
  renderNocDashboard(0);
  return nocTexture;
}

function renderNocDashboard(t) {
  if (!nocCtx) return;
  const ctx = nocCtx;
  const w = 1024;
  const h = 512;

  // Obsidian glass base with subtle bezel grid
  ctx.fillStyle = "#070c16";
  ctx.fillRect(0, 0, w, h);

  // Multi-Monitor Tile Grid lines (6 panels: 3x2)
  ctx.strokeStyle = "#141f33";
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, w, h);
  ctx.beginPath();
  ctx.moveTo(w / 3, 0); ctx.lineTo(w / 3, h);
  ctx.moveTo((w * 2) / 3, 0); ctx.lineTo((w * 2) / 3, h);
  ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
  ctx.stroke();

  // PANEL 1 (Top Left): Global Backbone Topology Map
  ctx.fillStyle = "#00d2ff";
  ctx.font = "bold 13px 'JetBrains Mono', monospace";
  ctx.fillText("■ CORE MESH TOPOLOGY // OSPF AREA 0", 20, 32);

  const nodes = [
    { name: "CORE-R1", x: 60, y: 130 },
    { name: "DIST-SW1", x: 160, y: 70 },
    { name: "DIST-SW2", x: 160, y: 190 },
    { name: "CORE-R2", x: 260, y: 130 }
  ];

  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(0, 210, 255, 0.45)";
  nodes.forEach((n1, i) => {
    nodes.forEach((n2, j) => {
      if (i < j) {
        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        ctx.lineTo(n2.x, n2.y);
        ctx.stroke();

        // Animated traveling data packet along link
        const pct = (t * 0.4 + i * 0.3) % 1.0;
        const px = n1.x + (n2.x - n1.x) * pct;
        const py = n1.y + (n2.y - n1.y) * pct;
        ctx.fillStyle = "#10b981";
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  });

  nodes.forEach((n) => {
    ctx.fillStyle = "#00d2ff";
    ctx.beginPath();
    ctx.arc(n.x, n.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "10px monospace";
    ctx.fillText(n.name, n.x - 22, n.y + 20);
  });

  // PANEL 2 (Top Center): Realtime Packet Throughput (Dynamic animated waveform)
  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 13px 'JetBrains Mono', monospace";
  ctx.fillText("■ BACKBONE TRAFFIC // 100Gbps FIBER", 365, 32);

  ctx.strokeStyle = "#10b981";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let x = 365; x < 660; x += 10) {
    const wave = Math.sin((x + t * 40) * 0.04) * 22 + Math.cos((x - t * 20) * 0.08) * 12;
    const y = 140 + wave;
    if (x === 365) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.fillStyle = "#94a3b8";
  ctx.font = "11px monospace";
  ctx.fillText("TX: 84.6 Gbps   RX: 79.2 Gbps   LOSS: 0.000%", 365, 210);

  // PANEL 3 (Top Right): Global PoP Latencies
  ctx.fillStyle = "#facc15";
  ctx.font = "bold 13px 'JetBrains Mono', monospace";
  ctx.fillText("■ GLOBAL EDGE LATENCY (RTT)", 705, 32);

  const pops = [
    { city: "TOKYO (TYO-1)", ms: "18ms", bar: 0.25 },
    { city: "SAN JOSE (SJC-2)", ms: "24ms", bar: 0.32 },
    { city: "FRANKFURT (FRA-1)", ms: "38ms", bar: 0.5 },
    { city: "SINGAPORE (SIN-1)", ms: "12ms", bar: 0.18 },
    { city: "LONDON (LHR-2)", ms: "42ms", bar: 0.55 }
  ];

  pops.forEach((p, idx) => {
    const py = 60 + idx * 32;
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "10px monospace";
    ctx.fillText(p.city, 705, py);
    ctx.fillText(p.ms, 960, py);

    ctx.fillStyle = "#1e293b";
    ctx.fillRect(705, py + 5, 280, 8);
    ctx.fillStyle = p.bar > 0.4 ? "#f59e0b" : "#10b981";
    ctx.fillRect(705, py + 5, 280 * p.bar, 8);
  });

  // PANEL 4 (Bottom Left): BGP & Routing Table Status
  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 13px 'JetBrains Mono', monospace";
  ctx.fillText("■ BGP RIB & OSPF ADJACENCIES", 20, 285);

  const routes = [
    "AS64512 PEER 10.254.0.1  ESTABLISHED (18h 42m)",
    "AS15169 PEER 10.254.1.1  ESTABLISHED (92h 11m)",
    "OSPF INT G0/0/0 AREA 0   FULL/BDR    (PRI: 1)",
    "OSPF INT G0/0/1 AREA 0   FULL/DR     (PRI: 1)",
    "IPV4 PREFIXES: 941,208   IPV6 PREFIXES: 184,912"
  ];
  routes.forEach((r, idx) => {
    ctx.fillStyle = idx === 4 ? "#10b981" : "#94a3b8";
    ctx.font = "10px monospace";
    ctx.fillText(r, 20, 315 + idx * 26);
  });

  // PANEL 5 (Bottom Center): Security & DDoS Mitigation
  ctx.fillStyle = "#00d2ff";
  ctx.font = "bold 13px 'JetBrains Mono', monospace";
  ctx.fillText("■ HARDWARE FIREWALL // PACKET INSPECTION", 365, 285);

  ctx.fillStyle = "#1e293b";
  ctx.fillRect(365, 305, 300, 160);
  ctx.strokeStyle = "#334155";
  ctx.strokeRect(365, 305, 300, 160);

  ctx.fillStyle = "#38bdf8";
  ctx.font = "11px monospace";
  ctx.fillText("STATEFUL INSPECTION: ACTIVE", 380, 335);
  ctx.fillText("TCP SYN FLOOD GUARD: ENABLED", 380, 360);
  ctx.fillText("ACL DROPS / SEC:     14 pkts", 380, 385);
  ctx.fillStyle = "#10b981";
  ctx.fillText("SECURITY POSTURE:    OPTIMAL", 380, 420);

  // PANEL 6 (Bottom Right): Data Center Environmental & Power
  ctx.fillStyle = "#a855f7";
  ctx.font = "bold 13px 'JetBrains Mono', monospace";
  ctx.fillText("■ FACILITY TELEMETRY & CRAC UNITS", 705, 285);

  const telemetry = [
    { k: "COLD AISLE TEMP", v: "19.8 °C (NOMINAL)" },
    { k: "HOT AISLE RETURN", v: "27.4 °C (OPTIMAL)" },
    { k: "UPS LOAD FACTOR", v: "42% (A+B FEED DUAL)" },
    { k: "PUE RATIO", v: "1.14 (EXCELLENT)" }
  ];
  telemetry.forEach((item, idx) => {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10.5px monospace";
    ctx.fillText(item.k, 705, 320 + idx * 34);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(item.v, 850, 320 + idx * 34);
  });

  if (nocTexture) nocTexture.needsUpdate = true;
}

// ----------------------------------------------------------------------------
// REALISTIC ARCHITECTURAL LIGHTING
// ----------------------------------------------------------------------------

export function setupRealisticLighting(scene) {
  // 1. Soft Ambient Slate Illumination (Clean modern facility base)
  const ambient = new THREE.AmbientLight(0x283852, 2.2);
  scene.add(ambient);

  // 2. High Overhead Key Sun (Directional Key Light casting soft shadows)
  const keySun = new THREE.DirectionalLight(0xf8fafc, 1.8);
  keySun.position.set(12, 32, 12);
  keySun.castShadow = true;
  keySun.shadow.mapSize.width = 2048;
  keySun.shadow.mapSize.height = 2048;
  keySun.shadow.camera.near = 1;
  keySun.shadow.camera.far = 70;
  keySun.shadow.camera.left = -26;
  keySun.shadow.camera.right = 26;
  keySun.shadow.camera.top = 26;
  keySun.shadow.camera.bottom = -26;
  keySun.shadow.bias = -0.0003;
  scene.add(keySun);

  // 3. Fill directional light from opposite angle for soft contact shadows
  const fillSun = new THREE.DirectionalLight(0x94a3b8, 0.8);
  fillSun.position.set(-16, 24, -16);
  scene.add(fillSun);

  // 4. Commercial Ceiling Recessed LED Troffers (Warm/Cool Commercial Office Panels)
  const troffers = [
    { x: -12, z: -11, color: 0xffffff, power: 2.4 }, // Network Lab
    { x: -12, z: -2, color: 0xffffff, power: 2.2 },  // Troubleshooting Lab
    { x: -12, z: 6, color: 0x38bdf8, power: 2.4 },   // Data Center Cold Aisle
    { x: 12, z: -11, color: 0x00d2ff, power: 2.6 },  // NOC Console & Screens
    { x: 12, z: 12, color: 0xfef08a, power: 2.6 },   // Arena spotlight
    { x: -1, z: 12, color: 0x38bdf8, power: 2.2 },   // Training Pods Arc
    { x: 0, z: -4, color: 0xf8fafc, power: 2.0 },    // Central Concourse North
    { x: 0, z: 4, color: 0xf8fafc, power: 2.0 }      // Central Concourse South
  ];

  troffers.forEach((tr) => {
    const pl = new THREE.PointLight(tr.color, tr.power, 26, 1.5);
    pl.position.set(tr.x, 4.3, tr.z);
    scene.add(pl);
  });

  // 5. NOC Video Wall Screen Bounce Light
  const nocScreenLight = new THREE.PointLight(0x00d2ff, 2.8, 18, 1.6);
  nocScreenLight.position.set(12, 2.4, -9.5);
  scene.add(nocScreenLight);
}

// ----------------------------------------------------------------------------
// FACILITY ENVIRONMENT BUILDER
// ----------------------------------------------------------------------------

export function buildRealisticFacility(scene, registerInteractive, openEquipmentModal, startMatchmaking, openTrainingPod) {
  const floorTex = createRaisedFloorTexture();
  const ventTex = createPerforatedVentTexture();

  // 1. Raised Server Room Floor (48m x 48m)
  const floorGeo = new THREE.PlaneGeometry(48, 48);
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: 0.35,
    metalness: 0.65
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Perforated Cold-Aisle Vents directly in front of server rack rows
  const ventMat = new THREE.MeshStandardMaterial({
    map: ventTex,
    roughness: 0.5,
    metalness: 0.8
  });
  const ventGeo = new THREE.PlaneGeometry(3.6, 12);
  const coldVent = new THREE.Mesh(ventGeo, ventMat);
  coldVent.rotation.x = -Math.PI / 2;
  coldVent.position.set(-10.2, 0.015, 6);
  scene.add(coldVent);

  // Underfloor subtle blue cool plenum glow
  const plenumLight = new THREE.PointLight(0x0284c7, 1.8, 14, 2);
  plenumLight.position.set(-10.2, 0.3, 6);
  scene.add(plenumLight);

  // 2. Architectural Ceiling & Structural I-Beams (at 4.6m height)
  buildRealisticCeiling(scene);

  // 3. Architectural Perimeter Walls & Glass Partitions
  buildArchitecturalWalls(scene);

  // 4. Structural Columns & Facility Signage
  buildStructuralColumns(scene);

  // 5. Area 1: Network Engineering Workbench & Cisco Equipment
  buildNetworkLabArea(scene, -12, -11, registerInteractive, openEquipmentModal);

  // 6. Area 2: Data Center Cold Aisle (42U Server Racks)
  buildDataCenterRacks(scene, -12, 6, registerInteractive, openEquipmentModal);

  // 7. Area 3: NOC Command Center (Curved Console, Video Wall, Monitors)
  buildNocOperationsCenter(scene, 12, -11, registerInteractive, openEquipmentModal);

  // 8. Area 4: Troubleshooting Lab (NGFW Firewall, Fiber Distribution ODF, OTDR)
  buildTroubleshootingLab(scene, -12, -2, registerInteractive, openEquipmentModal);

  // 9. Area 5: Network Challenge Arena (Elevated Platform & Duel Stations)
  buildNetworkChallengeArena(scene, 12, 12, registerInteractive, startMatchmaking);

  // 10. Area 6: Training Pods Arc (5 Interactive Kiosks)
  buildTrainingPodsArc(scene, -1, 12, registerInteractive, openTrainingPod);

  // 11. Overhead Yellow FiberRunner Cable Ladder Baskets
  buildOverheadCableTrays(scene);

  // 12. Safety & Facility Equipment (Fire Suppression, Extinguishers, Security Cameras)
  buildSafetyEquipment(scene);
}

function buildRealisticCeiling(scene) {
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: 0x0f1522,
    roughness: 0.8,
    metalness: 0.2
  });
  const ceilingGeo = new THREE.PlaneGeometry(48, 48);
  const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 4.6;
  scene.add(ceiling);

  // Structural Steel I-Beams across facility
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x1a2334, metalness: 0.85, roughness: 0.3 });
  for (let z = -18; z <= 18; z += 12) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(48, 0.35, 0.45), beamMat);
    beam.position.set(0, 4.4, z);
    scene.add(beam);
  }

  // Recessed LED Troffer Fixtures in Ceiling
  const trofferMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
  const trofferFrameMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9 });
  const trofferCoords = [
    [-12, -11], [-12, -2], [-12, 6], [12, -11], [12, 12], [-1, 12], [0, -4], [0, 4]
  ];

  trofferCoords.forEach(([tx, tz]) => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 1.2), trofferFrameMat);
    frame.position.set(tx, 4.55, tz);
    scene.add(frame);

    const lightFace = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.0), trofferMat);
    lightFace.rotation.x = Math.PI / 2;
    lightFace.position.set(tx, 4.5, tz);
    scene.add(lightFace);
  });

  // Circular HVAC Air Ducts (Sheet Metal with joints)
  const ductMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
  const ductGeo = new THREE.CylinderGeometry(0.45, 0.45, 48, 16);
  const duct1 = new THREE.Mesh(ductGeo, ductMat);
  duct1.rotation.z = Math.PI / 2;
  duct1.position.set(0, 4.0, -5);
  scene.add(duct1);

  const duct2 = new THREE.Mesh(ductGeo, ductMat);
  duct2.rotation.z = Math.PI / 2;
  duct2.position.set(0, 4.0, 15);
  scene.add(duct2);
}

function buildArchitecturalWalls(scene) {
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x0c121e,
    metalness: 0.6,
    roughness: 0.5
  });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x1f293d, metalness: 0.8 });

  const half = 24;
  const height = 4.6;

  const wallConfigs = [
    { pos: [0, height / 2, -half], size: [48, height, 0.6] },
    { pos: [0, height / 2, half], size: [48, height, 0.6] },
    { pos: [-half, height / 2, 0], size: [0.6, height, 48] },
    { pos: [half, height / 2, 0], size: [0.6, height, 48] }
  ];

  wallConfigs.forEach((cfg) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(...cfg.size), wallMat);
    wall.position.set(...cfg.pos);
    wall.receiveShadow = true;
    scene.add(wall);

    // Aluminum Baseboard Kickplate
    const baseGeo = new THREE.BoxGeometry(
      cfg.size[0] > 1 ? cfg.size[0] : 0.7,
      0.18,
      cfg.size[2] > 1 ? cfg.size[2] : 0.7
    );
    const base = new THREE.Mesh(baseGeo, trimMat);
    base.position.set(cfg.pos[0], 0.09, cfg.pos[2]);
    scene.add(base);
  });

  // Architectural Soundproof Glass Partition separating NOC from Data Center
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x00d2ff,
    transparent: true,
    opacity: 0.18,
    metalness: 0.95,
    roughness: 0.05
  });
  const glassFrameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 });

  const glassPartition = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.8, 16), glassMat);
  glassPartition.position.set(0, 1.9, -11);
  scene.add(glassPartition);

  // Aluminum Frame Posts for Glass
  for (let gp = -19; gp <= -3; gp += 4) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.0, 0.2), glassFrameMat);
    post.position.set(0, 2.0, gp);
    scene.add(post);
  }

  // Facility Main Security Entrance Doors (South wall z = 24)
  const doorGroup = new THREE.Group();
  doorGroup.position.set(0, 0, 23.6);

  // Door Frame
  const dFrame = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 2.9, 0.25),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 })
  );
  dFrame.position.y = 1.45;
  doorGroup.add(dFrame);

  // Dual Door Leaves
  const dLeafMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.3 });
  const leftLeaf = new THREE.Mesh(new THREE.BoxGeometry(1.65, 2.7, 0.12), dLeafMat);
  leftLeaf.position.set(-0.85, 1.4, 0);
  doorGroup.add(leftLeaf);

  const rightLeaf = new THREE.Mesh(new THREE.BoxGeometry(1.65, 2.7, 0.12), dLeafMat);
  rightLeaf.position.set(0.85, 1.4, 0);
  doorGroup.add(rightLeaf);

  // Stainless Steel Push Bars
  const barMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95 });
  const pushBar1 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.2), barMat);
  pushBar1.rotation.z = Math.PI / 2;
  pushBar1.position.set(-0.85, 1.1, -0.09);
  doorGroup.add(pushBar1);

  const pushBar2 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.2), barMat);
  pushBar2.rotation.z = Math.PI / 2;
  pushBar2.position.set(0.85, 1.1, -0.09);
  doorGroup.add(pushBar2);

  // Illuminated Green Emergency Exit Sign above Door
  const exitSign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 0.38),
    new THREE.MeshBasicMaterial({ color: 0x10b981 })
  );
  exitSign.position.set(0, 3.15, -0.15);
  doorGroup.add(exitSign);

  // Biometric RFID Badge Reader Terminal next to door
  const badgeReader = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.35, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x030712, metalness: 0.9 })
  );
  badgeReader.position.set(2.1, 1.3, -0.1);
  doorGroup.add(badgeReader);

  const readerLED = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.04, 0.02),
    new THREE.MeshBasicMaterial({ color: 0x00d2ff })
  );
  readerLED.position.set(2.1, 1.42, -0.15);
  doorGroup.add(readerLED);

  scene.add(doorGroup);
}

function buildStructuralColumns(scene) {
  const colMat = new THREE.MeshStandardMaterial({ color: 0x141b2a, metalness: 0.7, roughness: 0.4 });
  const conduitMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.9 });

  const colCoords = [
    [-6, -4], [6, -4], [-6, 8], [6, 8]
  ];

  colCoords.forEach(([cx, cz]) => {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.8, 4.6, 0.8), colMat);
    col.position.set(cx, 2.3, cz);
    col.castShadow = true;
    col.receiveShadow = true;
    scene.add(col);

    // Vertical metal conduit running up the column
    const conduit = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 4.6, 8), conduitMat);
    conduit.position.set(cx + 0.44, 2.3, cz);
    scene.add(conduit);
  });

  // Wall-Mounted Professional Facility Signage Plaques
  createWallSign(scene, -12, 3.4, -23.6, "NETWORK OPERATIONS LAB // CISCO R&S", 0x00d2ff);
  createWallSign(scene, 12, 3.4, -23.6, "NETWORK OPERATIONS CENTER // COMMAND", 0x38bdf8);
  createWallSign(scene, -23.6, 3.4, 6, "DATA CENTER // COLD AISLE CONTAINMENT", 0x38bdf8, Math.PI / 2);
  createWallSign(scene, 23.6, 3.4, 12, "NETWORK CHALLENGE ARENA", 0xfacc15, -Math.PI / 2);
}

function createWallSign(scene, x, y, z, text, accentColor = 0x00d2ff, rotY = 0) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#090e18";
  ctx.fillRect(0, 0, 512, 96);
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, 512, 96);

  ctx.fillStyle = "#00d2ff";
  ctx.fillRect(0, 0, 8, 96);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px 'Rajdhani', 'JetBrains Mono', sans-serif";
  ctx.fillText(text, 24, 55);

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 0.65),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas) })
  );
  sign.position.set(x, y, z);
  sign.rotation.y = rotY;
  scene.add(sign);
}

function buildNetworkLabArea(scene, cx, cz, registerInteractive, openEquipmentModal) {
  // Heavy-duty Technician Lab Workbench
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x162032, metalness: 0.7, roughness: 0.3 });
  const benchTop = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.15, 2.4), benchMat);
  benchTop.position.set(cx, 0.85, cz);
  benchTop.castShadow = true;
  benchTop.receiveShadow = true;
  scene.add(benchTop);

  // Steel Legs
  const legMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9 });
  const legCoords = [[-3.3, -1.0], [3.3, -1.0], [-3.3, 1.0], [3.3, 1.0]];
  legCoords.forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.85, 0.18), legMat);
    leg.position.set(cx + lx, 0.425, cz + lz);
    scene.add(leg);
  });

  // Anti-static Green ESD Workmat
  const matGeo = new THREE.PlaneGeometry(6.6, 2.0);
  const matMaterial = new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.6 });
  const mat = new THREE.Mesh(matGeo, matMaterial);
  mat.rotation.x = -Math.PI / 2;
  mat.position.set(cx, 0.93, cz);
  scene.add(mat);

  // 2x Realistic Cisco ISR 4451 Routers on Workbench
  const r1 = createRealisticCiscoBox("router", "CISCO 4451 CORE-R1");
  r1.position.set(cx - 1.8, 1.08, cz - 0.2);
  scene.add(r1);

  const r2 = createRealisticCiscoBox("router", "CISCO 4451 CORE-R2");
  r2.position.set(cx + 1.8, 1.08, cz - 0.2);
  scene.add(r2);

  // 1x Catalyst 3850 PoE Switch
  const sw = createRealisticCiscoBox("switch", "CISCO CATALYST 3850");
  sw.position.set(cx, 1.08, cz + 0.3);
  scene.add(sw);

  // Field Technician Rugged Laptop (Panasonic Toughbook style)
  const laptop = createFieldLaptop();
  laptop.position.set(cx - 0.4, 0.94, cz - 0.5);
  scene.add(laptop);

  // Curved Patch Cable Bundles (Cat6 Blue/Yellow connecting router to switch)
  const cable1 = createCurvedCableMesh(new THREE.Vector3(cx - 1.2, 1.15, cz - 0.05), new THREE.Vector3(cx - 0.2, 1.12, cz + 0.3), 0x00d2ff);
  scene.add(cable1);
  const cable2 = createCurvedCableMesh(new THREE.Vector3(cx + 1.2, 1.15, cz - 0.05), new THREE.Vector3(cx + 0.2, 1.12, cz + 0.3), 0xeab308);
  scene.add(cable2);

  // Interactive Routers & Switch
  registerInteractive({
    id: "cisco-router-01",
    title: "Cisco Core Router 01",
    actionText: "Router Configuration (CLI)",
    position: new THREE.Vector3(cx - 1.8, 1.4, cz + 1.4),
    radius: 3.2,
    onInteract: () => openEquipmentModal("router", "Cisco Core Router 01")
  });

  registerInteractive({
    id: "catalyst-switch-01",
    title: "Catalyst 3850 Switch",
    actionText: "Switch Console (VLANs)",
    position: new THREE.Vector3(cx, 1.4, cz + 1.6),
    radius: 3.2,
    onInteract: () => openEquipmentModal("switch", "Catalyst 3850 Switch")
  });
}

function buildDataCenterRacks(scene, cx, cz, registerInteractive, openEquipmentModal) {
  // Two Cold-Aisle Parallel Rows of 42U Enterprise Server Racks
  const rows = [
    { zOffset: -2.8, types: ["switch", "storage", "patch", "router"] },
    { zOffset: 2.8, types: ["storage", "glass", "switch", "open-patch"] }
  ];

  rows.forEach((row, rowIdx) => {
    for (let c = 0; c < 4; c++) {
      const rx = cx - 4.5 + c * 2.8;
      const rz = cz + row.zOffset;
      const rackType = row.types[c];
      const rackId = `RACK 0${rowIdx + 1}-${String.fromCharCode(65 + c)}`;

      const rack = createEnterpriseRack42U(rackType, rackId);
      rack.position.set(rx, 0, rz);
      if (rowIdx === 1) rack.rotation.y = Math.PI; // Face the cold aisle
      scene.add(rack);

      // Vertical Cable Drop Conduit from overhead FiberRunner into rack top
      const dropConduit = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 1.6, 8),
        new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.6 })
      );
      dropConduit.position.set(rx, 2.95, rz);
      scene.add(dropConduit);

      if (rowIdx === 0 && c === 1) {
        registerInteractive({
          id: "server-rack-01",
          title: "Blade Server Array 01",
          actionText: "Server Diagnostics",
          position: new THREE.Vector3(rx, 1.5, rz + 1.5),
          radius: 3.2,
          onInteract: () => openEquipmentModal("server", "Blade Server Array 01")
        });
      }
    }
  });

  // End-of-Row Power Distribution Units (PDU / UPS Dual Feed)
  const pdu1 = createPowerDistributionUnit();
  pdu1.position.set(cx + 5.5, 0, cz - 2.8);
  scene.add(pdu1);

  const pdu2 = createPowerDistributionUnit();
  pdu2.position.set(cx + 5.5, 0, cz + 2.8);
  pdu2.rotation.y = Math.PI;
  scene.add(pdu2);

  // Cold Aisle Containment Plexiglas Clear Doors at Aisle Ends
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.28,
    metalness: 0.95,
    roughness: 0.08
  });
  const doorFrameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 });

  [-5.9, 4.3].forEach((doorX) => {
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 5.6), doorFrameMat);
    doorFrame.position.set(cx + doorX, 1.2, cz);
    scene.add(doorFrame);

    const doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.2), doorMat);
    doorGlass.rotation.y = Math.PI / 2;
    doorGlass.position.set(cx + doorX, 1.2, cz);
    scene.add(doorGlass);
  });
}

function buildTroubleshootingLab(scene, cx, cz, registerInteractive, openEquipmentModal) {
  // Mobile diagnostics cart & workbench
  const cartMat = new THREE.MeshStandardMaterial({ color: 0x162033, metalness: 0.8, roughness: 0.3 });
  const cart = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.9, 1.8), cartMat);
  cart.position.set(cx, 0.45, cz);
  cart.castShadow = true;
  cart.receiveShadow = true;
  scene.add(cart);

  // Casters / Wheels on cart
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x090d14, metalness: 0.9 });
  const wCoords = [[-1.8, -0.7], [1.8, -0.7], [-1.8, 0.7], [1.8, 0.7]];
  wCoords.forEach(([wx, wz]) => {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 16), wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(cx + wx, 0.12, cz + wz);
    scene.add(wheel);
  });

  // Next-Gen Hardware Firewall (FortiGate style with red accent bar & blinking security LEDs)
  const fw = createRealisticCiscoBox("firewall", "FORTINET NGFW-500E");
  fw.position.set(cx - 1.0, 1.05, cz - 0.1);
  scene.add(fw);

  // Fiber Optic Distribution Panel (ODF) with fiber patch cords
  const fiberPanel = createRealisticCiscoBox("fiber", "FIBER OPTIC ODF 48P");
  fiberPanel.position.set(cx + 1.0, 1.05, cz - 0.1);
  scene.add(fiberPanel);

  // Oscilloscope / OTDR Diagnostic Screen
  const otdr = createOtdrDisplay();
  otdr.position.set(cx, 0.95, cz + 0.4);
  scene.add(otdr);

  // Patch cables connecting Firewall to Fiber Panel
  const fiberCable1 = createCurvedCableMesh(new THREE.Vector3(cx - 0.4, 1.15, cz - 0.05), new THREE.Vector3(cx + 0.4, 1.15, cz - 0.05), 0xf59e0b);
  scene.add(fiberCable1);
  const fiberCable2 = createCurvedCableMesh(new THREE.Vector3(cx - 0.7, 1.15, cz - 0.05), new THREE.Vector3(cx + 0.7, 1.15, cz - 0.05), 0x00d2ff);
  scene.add(fiberCable2);

  // Interactive hooks for Area 4: Troubleshooting Lab
  registerInteractive({
    id: "troubleshoot-fw",
    title: "Hardware Next-Gen Firewall",
    actionText: "Firewall Policy & NAT Inspection",
    position: new THREE.Vector3(cx - 1.0, 1.4, cz + 1.2),
    radius: 3.2,
    onInteract: () => openEquipmentModal("firewall", "Enterprise NGFW-500E Firewall")
  });

  registerInteractive({
    id: "troubleshoot-fiber",
    title: "Fiber Optic Patch Panel",
    actionText: "OTDR Fiber Continuity Test",
    position: new THREE.Vector3(cx + 1.0, 1.4, cz + 1.2),
    radius: 3.2,
    onInteract: () => openEquipmentModal("fiber", "Fiber Optic Distribution Bay (ODF)")
  });
}

function buildNocOperationsCenter(scene, cx, cz, registerInteractive, openEquipmentModal) {
  // Massive 9.6m x 3.8m Wall-Mounted NOC Video Wall
  const wallGeo = new THREE.PlaneGeometry(9.6, 3.8);
  const wallMat = new THREE.MeshBasicMaterial({ map: createNocWallCanvasTexture() });
  const videoWall = new THREE.Mesh(wallGeo, wallMat);
  videoWall.position.set(cx, 2.4, cz - 11.8);
  scene.add(videoWall);

  // Curved Operator Command Console Desk
  const deskMat = new THREE.MeshStandardMaterial({ color: 0x131a28, metalness: 0.65, roughness: 0.35 });
  const desk = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.75, 2.2), deskMat);
  desk.position.set(cx, 0.375, cz - 4);
  desk.castShadow = true;
  desk.receiveShadow = true;
  scene.add(desk);

  // Dual Operator Workstation Ergonomic Chairs (Herman Miller style)
  for (let oc = -1; oc <= 1; oc += 2) {
    const chair = createErgonomicMeshChair();
    chair.position.set(cx + oc * 2.4, 0, cz - 2.2);
    chair.rotation.y = Math.PI;
    scene.add(chair);
  }

  // Multi-Monitor Setups on Articulated Monitor Arms
  for (let m = -2; m <= 2; m += 2) {
    const mon = createCurvedMonitor34();
    mon.position.set(cx + m * 1.8, 0.75, cz - 4.2);
    mon.rotation.y = m * -0.15;
    scene.add(mon);

    // Mechanical Keyboard and Mouse on Desk
    const kbMat = new THREE.MeshStandardMaterial({ color: 0x090d16, metalness: 0.8 });
    const kb = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.16), kbMat);
    kb.position.set(cx + m * 1.8, 0.76, cz - 3.7);
    scene.add(kb);

    const mouse = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.025, 0.11), kbMat);
    mouse.position.set(cx + m * 1.8 + 0.3, 0.76, cz - 3.7);
    scene.add(mouse);
  }

  registerInteractive({
    id: "noc-console-01",
    title: "NOC Operations Wall",
    actionText: "Network Monitoring Dashboard",
    position: new THREE.Vector3(cx, 1.4, cz - 2.2),
    radius: 4.2,
    onInteract: () => openEquipmentModal("noc", "NOC Operations Monitoring")
  });
}

function buildNetworkChallengeArena(scene, cx, cz, registerInteractive, startMatchmaking) {
  // Elevated Circular Titanium & Tempered Glass Arena Platform
  const arenaBase = new THREE.Mesh(
    new THREE.CylinderGeometry(7.4, 7.9, 0.45, 32),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.25 })
  );
  arenaBase.position.set(cx, 0.225, cz);
  arenaBase.receiveShadow = true;
  scene.add(arenaBase);

  // Tempered Safety Glass Floor with subtle gold boundary ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(6.6, 7.2, 48),
    new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(cx, 0.46, cz);
  scene.add(ring);

  // 4 Holographic Pylon Emitters
  const pylonMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 });
  const pylonAngles = [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2];
  pylonAngles.forEach((ang) => {
    const px = cx + Math.cos(ang) * 6.8;
    const pz = cz + Math.sin(ang) * 6.8;

    const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 3.2, 16), pylonMat);
    pylon.position.set(px, 1.6, pz);
    scene.add(pylon);

    // Emitter Crystal Tip
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.4, 8), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
    tip.position.set(px, 3.3, pz);
    scene.add(tip);
  });

  // Dual Dueling Engineer Battle Stations (P1 vs P2 facing each other)
  const p1Station = createDuelBattleStation("P1 // LOCAL", 0x00d2ff);
  p1Station.position.set(cx - 3.4, 0.45, cz);
  scene.add(p1Station);

  const p2Station = createDuelBattleStation("P2 // CHALLENGER", 0xf43f5e);
  p2Station.position.set(cx + 3.4, 0.45, cz);
  p2Station.rotation.y = Math.PI;
  scene.add(p2Station);

  // Large Overhead Dual-Sided Duel Scoreboard Screen
  const duelBoard = createOverheadDuelScoreboard();
  duelBoard.position.set(cx, 3.4, cz);
  scene.add(duelBoard);

  // Suspended Holographic Arena Portal
  registerInteractive({
    id: "arena-portal",
    title: "Network Duel Arena",
    actionText: "Enter Network Challenge Duel",
    position: new THREE.Vector3(cx, 1.5, cz),
    radius: 4.8,
    onInteract: () => startMatchmaking()
  });
}

function createDuelBattleStation(label, color = 0x00d2ff) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x141f32, metalness: 0.85, roughness: 0.3 });

  // Console Desk
  const desk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.85, 1.2), mat);
  desk.position.y = 0.425;
  group.add(desk);

  // Dueling Terminal Dual Monitors
  const monMat = new THREE.MeshStandardMaterial({ color: 0x090d16, metalness: 0.9 });
  const mon1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.48, 0.04), monMat);
  mon1.position.set(-0.45, 1.15, 0.1);
  mon1.rotation.y = 0.15;
  group.add(mon1);

  const screen1 = new THREE.Mesh(
    new THREE.PlaneGeometry(0.76, 0.44),
    new THREE.MeshBasicMaterial({ color })
  );
  screen1.position.set(-0.45, 1.15, 0.125);
  screen1.rotation.y = 0.15;
  group.add(screen1);

  const mon2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.48, 0.04), monMat);
  mon2.position.set(0.45, 1.15, 0.1);
  mon2.rotation.y = -0.15;
  group.add(mon2);

  const screen2 = new THREE.Mesh(
    new THREE.PlaneGeometry(0.76, 0.44),
    new THREE.MeshBasicMaterial({ color: 0x10b981 })
  );
  screen2.position.set(0.45, 1.15, 0.125);
  screen2.rotation.y = -0.15;
  group.add(screen2);

  // Compact Cisco Router on Desk
  const miniRouter = createRealisticCiscoBox("router", label);
  miniRouter.scale.set(0.65, 0.65, 0.65);
  miniRouter.position.set(0, 0.95, -0.2);
  group.add(miniRouter);

  // Keyboard & Mouse
  const kbMat = new THREE.MeshStandardMaterial({ color: 0x030712, metalness: 0.9 });
  const kb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.18), kbMat);
  kb.position.set(0, 0.86, 0.35);
  group.add(kb);

  return group;
}

function createOverheadDuelScoreboard() {
  const group = new THREE.Group();

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#070c18";
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = "#facc15";
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, 512, 256);

  ctx.fillStyle = "#facc15";
  ctx.font = "bold 20px 'Rajdhani', sans-serif";
  ctx.fillText("⚔ NETWORK DUEL // HEAD-TO-HEAD ARENA", 20, 36);

  ctx.fillStyle = "#00d2ff";
  ctx.font = "bold 16px 'JetBrains Mono', monospace";
  ctx.fillText("YOU [HUNTER]   vs   OPPONENT [ENGINEER]", 20, 72);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "12px monospace";
  const rounds = [
    "ROUND 1: SUBNETTING ALLOCATION (VLSM / CIDR)",
    "ROUND 2: VLAN TRUNKING & 802.1Q ENCAPSULATION",
    "ROUND 3: OSPF & BGP ROUTING PROTOCOLS",
    "ROUND 4: EXTENDED ACCESS CONTROL LISTS (ACL)",
    "ROUND 5: ENTERPRISE TOPOLOGY TROUBLESHOOTING"
  ];
  rounds.forEach((rd, idx) => {
    ctx.fillStyle = idx % 2 === 0 ? "#e2e8f0" : "#38bdf8";
    ctx.fillText(`• ${rd}`, 24, 110 + idx * 26);
  });

  const tex = new THREE.CanvasTexture(canvas);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 });
  const boardFrame = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.7, 0.2), frameMat);
  group.add(boardFrame);

  // Front display
  const fScreen = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 2.5), new THREE.MeshBasicMaterial({ map: tex }));
  fScreen.position.z = 0.105;
  group.add(fScreen);

  // Back display
  const bScreen = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 2.5), new THREE.MeshBasicMaterial({ map: tex }));
  bScreen.rotation.y = Math.PI;
  bScreen.position.z = -0.105;
  group.add(bScreen);

  // Ceiling hanging steel cables
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.95 });
  for (let c = -2.2; c <= 2.2; c += 4.4) {
    const hanger = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4), cableMat);
    hanger.position.set(c, 1.8, 0);
    group.add(hanger);
  }

  return group;
}

function buildTrainingPodsArc(scene, cx, cz, registerInteractive, openTrainingPod) {
  const pods = [
    { name: "VLAN Station", cat: "vlan", offset: [-5, -2], icon: "🔀" },
    { name: "Subnetting Station", cat: "subnetting", offset: [-2.5, 2], icon: "🌐" },
    { name: "Routing Station", cat: "routing", offset: [0, 5], icon: "🛣️" },
    { name: "ACL Station", cat: "acl", offset: [2.5, 2], icon: "🛡️" },
    { name: "Troubleshooting Pod", cat: "troubleshooting", offset: [5, -2], icon: "🔧" }
  ];

  pods.forEach((p) => {
    const px = cx + p.offset[0];
    const pz = cz + p.offset[1];

    const pod = createDiagnosticTrainingKiosk(p.name, p.icon);
    pod.position.set(px, 0, pz);
    scene.add(pod);

    registerInteractive({
      id: `pod-${p.cat}`,
      title: `${p.icon} ${p.name}`,
      actionText: `Practice ${p.name}`,
      position: new THREE.Vector3(px, 1.4, pz + 1.2),
      radius: 2.8,
      onInteract: () => openTrainingPod(p.cat, p.name)
    });
  });
}

function buildOverheadCableTrays(scene) {
  const ladderMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.65, roughness: 0.35 }); // Yellow FiberRunner
  const tray1 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.15, 36), ladderMat);
  tray1.position.set(-12, 3.8, 4);
  scene.add(tray1);

  const tray2 = new THREE.Mesh(new THREE.BoxGeometry(26, 0.15, 0.45), ladderMat);
  tray2.position.set(0, 3.8, -10);
  scene.add(tray2);
}

function buildSafetyEquipment(scene) {
  // Fire Extinguishers on perimeter walls (Type C electrical fire rated)
  const extMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.6, roughness: 0.3 });
  const hoseMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.8 });

  [
    [-23.6, 1.4, -10],
    [-23.6, 1.4, 10],
    [23.6, 1.4, -4],
    [23.6, 1.4, 10]
  ].forEach(([ex, ey, ez]) => {
    const extGroup = new THREE.Group();
    extGroup.position.set(ex, ey, ez);

    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.65, 16), extMat);
    extGroup.add(bottle);

    const hose = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4), hoseMat);
    hose.position.set(0.09, 0.1, 0);
    extGroup.add(hose);

    scene.add(extGroup);
  });

  // Ceiling 360-Degree Dome Security Cameras
  const camMat = new THREE.MeshStandardMaterial({ color: 0x090d16, metalness: 0.9 });
  const lensMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

  [
    [-18, 4.4, -18],
    [18, 4.4, -18],
    [-18, 4.4, 18],
    [18, 4.4, 18]
  ].forEach(([cx, cy, cz]) => {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), camMat);
    dome.rotation.x = Math.PI;
    dome.position.set(cx, cy, cz);
    scene.add(dome);

    const recLED = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), lensMat);
    recLED.position.set(cx, cy - 0.16, cz + 0.08);
    scene.add(recLED);
  });
}

// ----------------------------------------------------------------------------
// HIGH-FIDELITY COMPONENT MESH BUILDERS
// ----------------------------------------------------------------------------

function createEnterpriseRack42U(rackType = "switch", rackId = "RACK 01-A") {
  const group = new THREE.Group();

  // 42U Server Rack Dimensions: 0.84m wide, 1.05m deep, 2.18m tall
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x090e18, metalness: 0.9, roughness: 0.28 });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.95 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9 });

  // Main Heavy-Gauge Welded Frame
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.84, 2.18, 1.05), frameMat);
  body.position.y = 1.09;
  body.castShadow = true;
  group.add(body);

  // Vertical Rack Rails (Silkscreened U-Rails on left and right)
  for (let r = -1; r <= 1; r += 2) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.05, 0.04), railMat);
    rail.position.set(r * 0.38, 1.09, 0.51);
    group.add(rail);
  }

  // Top ID Plate with silkscreened Rack Identifier
  const idCanvas = document.createElement("canvas");
  idCanvas.width = 256;
  idCanvas.height = 64;
  const idCtx = idCanvas.getContext("2d");
  idCtx.fillStyle = "#020617";
  idCtx.fillRect(0, 0, 256, 64);
  idCtx.fillStyle = "#38bdf8";
  idCtx.font = "bold 20px 'JetBrains Mono', monospace";
  idCtx.fillText(rackId, 24, 40);

  const idPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.68, 0.12),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(idCanvas) })
  );
  idPlate.position.set(0, 2.12, 0.528);
  group.add(idPlate);

  // Door variants
  if (rackType === "glass") {
    // Tinted Tempered Safety Glass Door
    const glassDoor = new THREE.Mesh(
      new THREE.PlaneGeometry(0.76, 2.02),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.35,
        metalness: 0.95,
        roughness: 0.05
      })
    );
    glassDoor.position.set(0, 1.07, 0.53);
    group.add(glassDoor);
  } else if (rackType !== "open-patch") {
    // Honeycomb Perforated Steel Front Door
    const doorGeo = new THREE.PlaneGeometry(0.76, 2.02);
    const doorMat = new THREE.MeshStandardMaterial({
      map: createPerforatedVentTexture(),
      transparent: true,
      opacity: 0.58,
      metalness: 0.9,
      roughness: 0.25
    });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, 1.07, 0.53);
    group.add(door);

    // Door Recessed Handle
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.04), postMat);
    handle.position.set(0.33, 1.1, 0.54);
    group.add(handle);
  }

  // 8 Rack Units mounted inside
  const faceTexture = createServerFaceplateTexture(rackType === "glass" ? "storage" : (rackType === "open-patch" ? "patch" : rackType));
  const uGeo = new THREE.PlaneGeometry(0.74, 0.21);
  const uMat = new THREE.MeshBasicMaterial({ map: faceTexture });

  for (let u = 0; u < 8; u++) {
    const face = new THREE.Mesh(uGeo, uMat);
    const faceY = 0.32 + u * 0.23;
    face.position.set(0, faceY, 0.505);
    group.add(face);

    // Blinking Micro Status LED
    const ledMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.015, 0.015, 0.01),
      new THREE.MeshBasicMaterial({ color: u % 2 === 0 ? 0x10b981 : 0x00d2ff })
    );
    ledMesh.position.set(0.31, faceY, 0.515);
    group.add(ledMesh);
    blinkingLEDs.push(ledMesh);
  }

  // Natural Cat6 Patch Cord Bundles inside the rack
  if (rackType === "switch" || rackType === "open-patch") {
    const c1 = createCurvedCableMesh(new THREE.Vector3(-0.25, 0.55, 0.51), new THREE.Vector3(-0.05, 0.78, 0.51), 0x00d2ff);
    group.add(c1);
    const c2 = createCurvedCableMesh(new THREE.Vector3(0.05, 0.55, 0.51), new THREE.Vector3(0.25, 0.78, 0.51), 0xeab308);
    group.add(c2);
    const c3 = createCurvedCableMesh(new THREE.Vector3(-0.15, 1.01, 0.51), new THREE.Vector3(0.12, 1.24, 0.51), 0x38bdf8);
    group.add(c3);
  }

  // Top Exhaust Fan Grilles
  for (let f = -1; f <= 1; f++) {
    const fanGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.04, 12);
    const fan = new THREE.Mesh(fanGeo, postMat);
    fan.position.set(0, 2.19, f * 0.26);
    group.add(fan);
    spinningFans.push(fan);
  }

  return group;
}

function createRealisticCiscoBox(type = "router", label = "") {
  const group = new THREE.Group();
  const width = type === "router" ? 1.6 : 1.4;
  const height = 0.24;
  const depth = 0.9;

  const chassisMat = new THREE.MeshStandardMaterial({ color: 0x172236, metalness: 0.85, roughness: 0.28 });
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), chassisMat);
  chassis.castShadow = true;
  group.add(chassis);

  // Front Faceplate
  const faceMat = new THREE.MeshBasicMaterial({ map: createServerFaceplateTexture(type, label) });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.96, height * 0.92), faceMat);
  face.position.set(0, 0, depth / 2 + 0.002);
  group.add(face);

  return group;
}

function createCurvedCableMesh(start, end, color = 0x00d2ff) {
  const mid = new THREE.Vector3()
    .addVectors(start, end)
    .multiplyScalar(0.5)
    .add(new THREE.Vector3(0, 0.18, 0.12));

  const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
  const geo = new THREE.TubeGeometry(curve, 16, 0.016, 8, false);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.25 });
  return new THREE.Mesh(geo, mat);
}

function createFieldLaptop() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.75, roughness: 0.3 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.03, 0.38), bodyMat);
  group.add(base);

  // Screen Lid angled 110 degrees
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.36, 0.02), bodyMat);
  lid.position.set(0, 0.18, -0.18);
  lid.rotation.x = 0.2;
  group.add(lid);

  // Terminal Screen showing Cisco IOS CLI
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, 256, 160);
  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 9px monospace";
  ctx.fillText("R1# show ip ospf neighbor", 10, 22);
  ctx.fillStyle = "#10b981";
  ctx.fillText("Neighbor ID: 10.254.1.2  FULL/DR", 10, 42);
  ctx.fillText("Interface: GigabitEthernet0/0/0", 10, 58);
  ctx.fillStyle = "#facc15";
  ctx.fillText("Ping 10.254.1.2: 5/5 (100% OK)", 10, 84);

  const screenTex = new THREE.CanvasTexture(canvas);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.32),
    new THREE.MeshBasicMaterial({ map: screenTex })
  );
  screen.position.set(0, 0.18, -0.168);
  screen.rotation.x = 0.2;
  group.add(screen);

  return group;
}

function createCurvedMonitor34() {
  const group = new THREE.Group();
  const standMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.95 });
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.45), standMat);
  stand.position.y = 0.225;
  group.add(stand);

  // 34" Ultrawide Curved Panel
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.48, 0.05), standMat);
  panel.position.set(0, 0.45, 0);
  group.add(panel);

  // Screen with active NOC dashboard
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#030712";
  ctx.fillRect(0, 0, 512, 192);

  ctx.fillStyle = "#00d2ff";
  ctx.font = "bold 13px 'JetBrains Mono', monospace";
  ctx.fillText("CORE ROUTER TELEMETRY // REAL-TIME RTT", 16, 26);

  ctx.fillStyle = "#10b981";
  ctx.font = "11px monospace";
  ctx.fillText("BGP PEER 10.0.1.1: ESTABLISHED  ·  PREFIXES: 941k", 16, 56);
  ctx.fillText("PACKET LOSS: 0.00%  ·  JITTER: 0.24ms", 16, 80);

  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 16; x < 496; x += 12) {
    const y = 140 + Math.sin(x * 0.1) * 16;
    if (x === 16) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  const screenTex = new THREE.CanvasTexture(canvas);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.44), new THREE.MeshBasicMaterial({ map: screenTex }));
  screen.position.set(0, 0.45, 0.026);
  group.add(screen);

  return group;
}

function createErgonomicMeshChair() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7 });
  const meshMat = new THREE.MeshStandardMaterial({ color: 0x1f293d, metalness: 0.4, roughness: 0.6 });

  // Seat cushion
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.08, 0.6), meshMat);
  seat.position.y = 0.52;
  group.add(seat);

  // Ergonomic Curved Backrest
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.72, 0.06), meshMat);
  back.position.set(0, 0.95, -0.28);
  back.rotation.x = -0.08;
  group.add(back);

  // Armrests
  for (let a = -1; a <= 1; a += 2) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.32), mat);
    arm.position.set(a * 0.35, 0.72, -0.05);
    group.add(arm);
  }

  // Base stem
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.48), mat);
  stem.position.y = 0.26;
  group.add(stem);

  // 5-Star Caster Base
  for (let star = 0; star < 5; star++) {
    const ang = (star * Math.PI * 2) / 5;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.35), mat);
    leg.position.set(Math.sin(ang) * 0.18, 0.04, Math.cos(ang) * 0.18);
    leg.rotation.y = ang;
    group.add(leg);
  }

  return group;
}

function createDiagnosticTrainingKiosk(name, icon) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.3 });
  const kiosk = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.9, 0.6), bodyMat);
  kiosk.position.y = 0.95;
  kiosk.castShadow = true;
  group.add(kiosk);

  // Header Station Sign
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.05, 0.32),
    new THREE.MeshBasicMaterial({ color: 0x0284c7 })
  );
  sign.position.set(0, 1.7, 0.305);
  group.add(sign);

  // Screen
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 0.62),
    new THREE.MeshBasicMaterial({ color: 0x00d2ff, transparent: true, opacity: 0.8 })
  );
  screen.position.set(0, 1.15, 0.305);
  group.add(screen);

  return group;
}

function createPowerDistributionUnit() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x0b111e, metalness: 0.9, roughness: 0.25 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.2, 0.9), mat);
  body.position.y = 1.1;
  body.castShadow = true;
  group.add(body);

  // Digital Voltage / Current LED Meter Screen
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = "#22c55e";
  ctx.font = "bold 14px monospace";
  ctx.fillText("415V / 60Hz", 12, 26);
  ctx.fillStyle = "#38bdf8";
  ctx.font = "11px monospace";
  ctx.fillText("LOAD: 42.8 kW", 12, 48);

  const meter = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55, 0.28),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas) })
  );
  meter.position.set(0, 1.6, 0.46);
  group.add(meter);

  return group;
}

function createOtdrDisplay() {
  const group = new THREE.Group();
  const caseMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.2), caseMat);
  body.position.y = 0.225;
  group.add(body);

  // Canvas for OTDR optical trace graph
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#030712";
  ctx.fillRect(0, 0, 256, 160);

  // Grid lines
  ctx.strokeStyle = "rgba(0, 210, 255, 0.2)";
  ctx.lineWidth = 1;
  for (let x = 0; x < 256; x += 32) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 160); ctx.stroke();
  }
  for (let y = 0; y < 160; y += 32) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
  }

  // OTDR Trace Line (Attenuation slope with reflection spikes)
  ctx.strokeStyle = "#10b981";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(10, 20);
  ctx.lineTo(20, 120); // Initial Fresnel launch reflection
  ctx.lineTo(30, 45);
  ctx.lineTo(120, 75); // Fiber backscatter Rayleigh slope
  ctx.lineTo(125, 40); // Fusion splice reflection
  ctx.lineTo(130, 80);
  ctx.lineTo(220, 110); // End of fiber break reflection
  ctx.lineTo(225, 30);
  ctx.lineTo(230, 140);
  ctx.stroke();

  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 10px monospace";
  ctx.fillText("OTDR 1310/1550nm: OK", 14, 18);
  ctx.fillStyle = "#facc15";
  ctx.fillText("LOSS: 0.19 dB/km", 14, 150);

  const screenTex = new THREE.CanvasTexture(canvas);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.38),
    new THREE.MeshBasicMaterial({ map: screenTex })
  );
  screen.position.set(0, 0.225, 0.102);
  group.add(screen);

  return group;
}

// ----------------------------------------------------------------------------
// ANIMATION TICK FOR FACILITY (Blinking LEDs, Spinning Fans, Video Wall)
// ----------------------------------------------------------------------------

export function updateFacilityAnimations(delta) {
  // 1. Spinning server exhaust fans
  spinningFans.forEach((fan) => {
    fan.rotation.y += 0.15;
  });

  // 2. Random rhythmic LED pulses
  if (Math.random() < 0.25) {
    const idx = Math.floor(Math.random() * blinkingLEDs.length);
    const led = blinkingLEDs[idx];
    if (led) {
      led.visible = !led.visible;
    }
  }

  // 3. Periodic NOC canvas redraw (~every 200ms)
  const now = performance.now();
  if (now - lastNocUpdate > 220) {
    lastNocUpdate = now;
    packetTrafficOffset += 0.3;
    renderNocDashboard(packetTrafficOffset);
  }
}
