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
// PROCEDURAL TEXTURE GENERATORS (PBR / Canvas)
// ----------------------------------------------------------------------------

export function createRaisedFloorTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  // Dark anti-static floor tile base (60cm x 60cm server tiles)
  ctx.fillStyle = "#111722";
  ctx.fillRect(0, 0, 512, 512);

  // Subtle metallic stipple noise
  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const brightness = Math.floor(Math.random() * 18);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.01 + brightness / 255})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Tile Seams & Bevels (4x4 grid in 512px)
  const tileSize = 128;
  for (let x = 0; x < 512; x += tileSize) {
    for (let y = 0; y < 512; y += tileSize) {
      // Outer border seam
      ctx.strokeStyle = "#080c14";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, tileSize, tileSize);

      // Inner subtle highlight edge
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 2, y + 2, tileSize - 4, tileSize - 4);

      // Corner screw anchor indentations
      ctx.fillStyle = "#0a0f18";
      ctx.beginPath();
      ctx.arc(x + 10, y + 10, 2.5, 0, Math.PI * 2);
      ctx.arc(x + tileSize - 10, y + 10, 2.5, 0, Math.PI * 2);
      ctx.arc(x + 10, y + tileSize - 10, 2.5, 0, Math.PI * 2);
      ctx.arc(x + tileSize - 10, y + tileSize - 10, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 12);
  return texture;
}

export function createPerforatedVentTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0c121c";
  ctx.fillRect(0, 0, 128, 128);

  ctx.fillStyle = "#04070c";
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

export function createServerFaceplateTexture(type = "switch") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  // Dark brushed aluminum chassis
  ctx.fillStyle = type === "router" ? "#141c2c" : (type === "storage" ? "#0f1622" : "#121927");
  ctx.fillRect(0, 0, 512, 128);

  // Brushed hairline finish
  ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
  for (let i = 0; i < 128; i += 3) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  if (type === "switch") {
    // Cisco 48-port Catalyst Switch Layout
    ctx.fillStyle = "#00d2ff";
    ctx.font = "bold 13px 'JetBrains Mono', monospace";
    ctx.fillText("CISCO CATALYST 9300 48P-PoE+", 18, 22);

    // RJ-45 Port Grid (2 rows of 24 ports)
    for (let row = 0; row < 2; row++) {
      for (let p = 0; p < 24; p++) {
        const px = 20 + p * 15;
        const py = 45 + row * 28;
        // Port socket
        ctx.fillStyle = "#05080e";
        ctx.fillRect(px, py, 11, 16);
        ctx.strokeStyle = "#25344d";
        ctx.strokeRect(px, py, 11, 16);
        // Gold contact pins
        ctx.fillStyle = "#eab308";
        ctx.fillRect(px + 2, py + 11, 7, 3);
        // Link LED
        ctx.fillStyle = p % 3 === 0 ? "#10b981" : (p % 5 === 0 ? "#f59e0b" : "#00d2ff");
        ctx.fillRect(px + 3, py - 6, 5, 3);
      }
    }

    // SFP+ 10G Uplink cages on right
    for (let s = 0; s < 4; s++) {
      ctx.fillStyle = "#1a2538";
      ctx.fillRect(405 + s * 24, 48, 18, 32);
      ctx.strokeStyle = "#38bdf8";
      ctx.strokeRect(405 + s * 24, 48, 18, 32);
      ctx.fillStyle = "#10b981";
      ctx.fillRect(411 + s * 24, 38, 6, 4);
    }
  } else if (type === "storage") {
    // 2U Storage Blade Server with 12x 3.5" Drive Caddies
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 13px 'JetBrains Mono', monospace";
    ctx.fillText("ENTERPRISE BLADE SERVER // SAS-RAID 10", 18, 22);

    for (let c = 0; c < 12; c++) {
      const cx = 20 + c * 40;
      ctx.fillStyle = "#162032";
      ctx.fillRect(cx, 38, 34, 72);
      ctx.strokeStyle = "#2b3b55";
      ctx.strokeRect(cx, 38, 34, 72);
      // Drive handle
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
    ctx.fillText("ENTERPRISE NGFW-500E // INTRUSION PREVENTION", 18, 24);

    // RJ-45 & SFP+ Security Ports
    for (let p = 0; p < 16; p++) {
      const px = 20 + p * 19;
      ctx.fillStyle = "#090d16";
      ctx.fillRect(px, 50, 14, 20);
      ctx.strokeStyle = "#475569";
      ctx.strokeRect(px, 50, 14, 20);
      ctx.fillStyle = p % 2 === 0 ? "#10b981" : "#00d2ff";
      ctx.fillRect(px + 4, 38, 6, 4);
    }

    // Status indicators
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
    ctx.fillText("OPTICAL DISTRIBUTION FRAME // 48-STRAND LC/UPC", 18, 22);

    // Dual LC Duplex Adapter Couplers (Blue for Singlemode, Aqua for OM4)
    for (let f = 0; f < 12; f++) {
      const fx = 20 + f * 40;
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
  } else {
    // Cisco ISR Core Router
    ctx.fillStyle = "#00d2ff";
    ctx.font = "bold 13px 'JetBrains Mono', monospace";
    ctx.fillText("CISCO 4451-X ISR // ROUTING ENGINE", 18, 22);

    // Modular NIM slots
    for (let m = 0; m < 3; m++) {
      const mx = 20 + m * 120;
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
// NOC VIDEO WALL TEXTURE (Interactive High-Res Multi-Display)
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

  // Obsidian glass base
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
  ctx.strokeStyle = "rgba(0, 210, 255, 0.4)";
  nodes.forEach((n1, i) => {
    nodes.forEach((n2, j) => {
      if (i < j) {
        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        ctx.lineTo(n2.x, n2.y);
        ctx.stroke();
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
  // 1. Soft Ambient Slate Illumination
  const ambient = new THREE.AmbientLight(0x1a263c, 1.4);
  scene.add(ambient);

  // 2. Soft Key Overhead Light from High Ceiling
  const keySun = new THREE.DirectionalLight(0xeef6ff, 1.2);
  keySun.position.set(12, 28, 12);
  keySun.castShadow = true;
  keySun.shadow.mapSize.width = 2048;
  keySun.shadow.mapSize.height = 2048;
  keySun.shadow.camera.near = 1;
  keySun.shadow.camera.far = 60;
  keySun.shadow.camera.left = -26;
  keySun.shadow.camera.right = 26;
  keySun.shadow.camera.top = 26;
  keySun.shadow.camera.bottom = -26;
  keySun.shadow.bias = -0.0005;
  scene.add(keySun);

  // 3. Recessed Ceiling LED Downlights (Warm/Cool Commercial Office Troffers)
  const troffers = [
    { x: -12, z: -10, color: 0xf0f7ff, power: 1.8 },
    { x: -12, z: 8, color: 0xf0f7ff, power: 1.8 },
    { x: 12, z: -10, color: 0x00d2ff, power: 2.2 }, // Soft cyan NOC bounce
    { x: 12, z: 12, color: 0xfef08a, power: 2.0 },  // Arena spotlight
    { x: 0, z: 0, color: 0xe2e8f0, power: 1.5 }
  ];

  troffers.forEach((tr) => {
    const pl = new THREE.PointLight(tr.color, tr.power, 22, 1.6);
    pl.position.set(tr.x, 4.3, tr.z);
    scene.add(pl);
  });

  // 4. NOC Screen Glow Bounce (casts subtle cyan onto nearby console and floor)
  const nocScreenLight = new THREE.PointLight(0x00d2ff, 2.4, 16, 1.8);
  nocScreenLight.position.set(12, 2.4, -9.5);
  scene.add(nocScreenLight);

  // 5. Data Center Cold Aisle Cool Blue Illumination
  const coldAisleLight = new THREE.PointLight(0x38bdf8, 1.8, 14, 2.0);
  coldAisleLight.position.set(-12, 2.2, 6);
  scene.add(coldAisleLight);

  // 6. Troubleshooting Lab Diagnostic Task Light
  const troubleshootLight = new THREE.PointLight(0xf0f7ff, 1.6, 12, 1.8);
  troubleshootLight.position.set(-12, 3.0, -2);
  scene.add(troubleshootLight);
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

  // 4. Area 1: Network Engineering Workbench & Cisco Equipment
  buildNetworkLabArea(scene, -12, -11, registerInteractive, openEquipmentModal);

  // 5. Area 2: Data Center Cold Aisle (42U Server Racks)
  buildDataCenterRacks(scene, -12, 6, registerInteractive, openEquipmentModal);

  // 6. Area 3: NOC Command Center (Curved Console, Video Wall, Monitors)
  buildNocOperationsCenter(scene, 12, -11, registerInteractive, openEquipmentModal);

  // 7. Area 4: Troubleshooting Lab (NGFW Firewall, Fiber Distribution ODF, OTDR)
  buildTroubleshootingLab(scene, -12, -2, registerInteractive, openEquipmentModal);

  // 8. Area 5: Network Challenge Arena (Elevated Holographic Platform)
  buildNetworkChallengeArena(scene, 12, 12, registerInteractive, startMatchmaking);

  // 9. Area 6: Training Pods Arc (5 Interactive Kiosks)
  buildTrainingPodsArc(scene, -1, 12, registerInteractive, openTrainingPod);

  // 10. Overhead Cable Ladder Baskets
  buildOverheadCableTrays(scene);
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

  // Structural Steel I-Beams
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
    [-12, -10], [-12, 8], [12, -10], [12, 12], [0, -4], [0, 8]
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
  duct1.position.set(0, 4.0, -4);
  scene.add(duct1);

  const duct2 = new THREE.Mesh(ductGeo, ductMat);
  duct2.rotation.z = Math.PI / 2;
  duct2.position.set(0, 4.0, 14);
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
    { zOffset: -2.8 },
    { zOffset: 2.8 }
  ];

  rows.forEach((row, rowIdx) => {
    for (let c = 0; c < 4; c++) {
      const rx = cx - 4.5 + c * 2.8;
      const rz = cz + row.zOffset;

      const rack = createEnterpriseRack42U(rowIdx === 0 ? "switch" : "storage");
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
  // Massive 9m x 3.6m Wall-Mounted NOC Video Wall
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
    new THREE.CylinderGeometry(7.2, 7.8, 0.45, 32),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.25 })
  );
  arenaBase.position.set(cx, 0.225, cz);
  arenaBase.receiveShadow = true;
  scene.add(arenaBase);

  // Tempered Safety Glass Floor with subtle gold boundary ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(6.6, 7.1, 48),
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

  // Dual Dueling Engineer Battle Terminals
  const p1Terminal = createBattleTerminal("P1 // LOCAL", 0x00d2ff);
  p1Terminal.position.set(cx - 3.2, 0.45, cz);
  scene.add(p1Terminal);

  const p2Terminal = createBattleTerminal("P2 // CHALLENGER", 0xf43f5e);
  p2Terminal.position.set(cx + 3.2, 0.45, cz);
  p2Terminal.rotation.y = Math.PI;
  scene.add(p2Terminal);

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
  const ladderMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.6, roughness: 0.4 }); // Yellow FiberRunner
  const tray1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 36), ladderMat);
  tray1.position.set(-12, 3.8, 4);
  scene.add(tray1);

  const tray2 = new THREE.Mesh(new THREE.BoxGeometry(24, 0.15, 0.4), ladderMat);
  tray2.position.set(0, 3.8, -10);
  scene.add(tray2);
}

// ----------------------------------------------------------------------------
// HIGH-FIDELITY COMPONENT MESH BUILDERS
// ----------------------------------------------------------------------------

function createEnterpriseRack42U(rackContent = "switch") {
  const group = new THREE.Group();

  // 42U Server Rack Dimensions: 0.8m wide, 1.0m deep, 2.15m tall
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0a0f18, metalness: 0.85, roughness: 0.35 });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.95 });

  // Main Enclosure Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.82, 2.15, 1.02), frameMat);
  body.position.y = 1.075;
  body.castShadow = true;
  group.add(body);

  // Front Honeycomb Perforated Door
  const doorGeo = new THREE.PlaneGeometry(0.74, 2.05);
  const doorMat = new THREE.MeshStandardMaterial({
    map: createPerforatedVentTexture(),
    transparent: true,
    opacity: 0.55,
    metalness: 0.9,
    roughness: 0.2
  });
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.position.set(0, 1.075, 0.515);
  group.add(door);

  // Stack of 8 Rack Units inside
  const faceTexture = createServerFaceplateTexture(rackContent);
  const uGeo = new THREE.PlaneGeometry(0.72, 0.2);
  const uMat = new THREE.MeshBasicMaterial({ map: faceTexture });

  for (let u = 0; u < 8; u++) {
    const face = new THREE.Mesh(uGeo, uMat);
    face.position.set(0, 0.32 + u * 0.23, 0.505);
    group.add(face);

    // Blinking Micro LED on face
    const ledMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.015, 0.015, 0.01),
      new THREE.MeshBasicMaterial({ color: u % 2 === 0 ? 0x10b981 : 0x00d2ff })
    );
    ledMesh.position.set(0.28, 0.32 + u * 0.23, 0.512);
    group.add(ledMesh);
    blinkingLEDs.push(ledMesh);
  }

  // Top Exhaust Fan Grilles
  for (let f = -1; f <= 1; f++) {
    const fanGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.04, 12);
    const fan = new THREE.Mesh(fanGeo, postMat);
    fan.position.set(0, 2.16, f * 0.26);
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

  const chassisMat = new THREE.MeshStandardMaterial({ color: 0x172236, metalness: 0.8, roughness: 0.3 });
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), chassisMat);
  chassis.castShadow = true;
  group.add(chassis);

  // Front Faceplate
  const faceMat = new THREE.MeshBasicMaterial({ map: createServerFaceplateTexture(type) });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.96, height * 0.92), faceMat);
  face.position.set(0, 0, depth / 2 + 0.002);
  group.add(face);

  return group;
}

function createCurvedCableMesh(start, end, color = 0x00d2ff) {
  const mid = new THREE.Vector3()
    .addVectors(start, end)
    .multiplyScalar(0.5)
    .add(new THREE.Vector3(0, 0.25, 0.15));

  const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
  const geo = new THREE.TubeGeometry(curve, 16, 0.018, 8, false);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3 });
  return new THREE.Mesh(geo, mat);
}

function createFieldLaptop() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.7 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.03, 0.38), bodyMat);
  group.add(base);

  // Screen Lid angled 110 degrees
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.36, 0.02), bodyMat);
  lid.position.set(0, 0.18, -0.18);
  lid.rotation.x = 0.2;
  group.add(lid);

  // Terminal Screen
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.48, 0.31),
    new THREE.MeshBasicMaterial({ color: 0x0f172a })
  );
  screen.position.set(0, 0.18, -0.168);
  screen.rotation.x = 0.2;
  group.add(screen);

  return group;
}

function createCurvedMonitor34() {
  const group = new THREE.Group();
  const standMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9 });
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.45), standMat);
  stand.position.y = 0.225;
  group.add(stand);

  // 34" Ultrawide Curved Panel
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x090e18 });
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.48, 0.05), standMat);
  panel.position.set(0, 0.45, 0);
  group.add(panel);

  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.44), screenMat);
  screen.position.set(0, 0.45, 0.026);
  group.add(screen);

  return group;
}

function createErgonomicMeshChair() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7 });
  // Seat cushion
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.08, 0.6), mat);
  seat.position.y = 0.52;
  group.add(seat);

  // Backrest
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.72, 0.06), mat);
  back.position.set(0, 0.95, -0.28);
  back.rotation.x = -0.08;
  group.add(back);

  // Base stem
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.48), mat);
  stem.position.y = 0.26;
  group.add(stem);

  return group;
}

function createBattleTerminal(label, color = 0x00d2ff) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x141f32, metalness: 0.8 });
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.05, 0.55), mat);
  stand.position.y = 0.525;
  group.add(stand);

  // Angled Touch Screen
  const screen = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 0.52, 0.04),
    new THREE.MeshBasicMaterial({ color })
  );
  screen.position.set(0, 1.15, 0.08);
  screen.rotation.x = -0.38;
  group.add(screen);

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
  // 1. Spinning server fans
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
