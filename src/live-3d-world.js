// ============================================================================
// XELI 3D LIVE // FUTURISTIC NETWORKING ENGINEER WORLD & DUEL ARENA
// Built with Three.js (v0.186), Supabase Realtime, and XELI Leveling Integration
// ============================================================================

import * as THREE from "three";
import { supabase, getCurrentSupabaseUser } from "./supabase.js";
import {
  setupRealisticLighting,
  buildRealisticFacility,
  updateFacilityAnimations
} from "./facility-builder.js";
import {
  createHumanHunterCharacter,
  animateHumanCharacter,
  updateProjectedNameplates
} from "./character-builder.js";

// Audio sound effects synthesized using Web Audio API
function playCyberTone(freq = 440, duration = 0.1, type = "sine", vol = 0.15) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // Audio context may require user interaction
  }
}

function playDuelBeep(success = true) {
  if (success) {
    playCyberTone(587.33, 0.1, "triangle", 0.2); // D5
    setTimeout(() => playCyberTone(880, 0.18, "sine", 0.25), 100); // A5
  } else {
    playCyberTone(220, 0.12, "sawtooth", 0.25);
    setTimeout(() => playCyberTone(146.83, 0.2, "sawtooth", 0.3), 120);
  }
}

// ----------------------------------------------------------------------------
// PRACTICAL NETWORKING DUEL & TRAINING CHALLENGE POOL (5 ROUNDS)
// ----------------------------------------------------------------------------
export const NETWORK_CHALLENGES = {
  subnetting: [
    {
      id: "sub-1",
      category: "ROUND 1: SUBNETTING",
      title: "Host Address Allocation",
      prompt: "You are designing an IP plan for the Engineering VLAN. The department requires at least 28 usable host addresses on subnet 192.168.10.0. Which CIDR prefix provides the minimum required host capacity without wasting excess address space?",
      snippet: "Network: 192.168.10.0\nRequired Hosts: 28 usable PCs\nGoal: Minimize wasted IPv4 addresses",
      options: [
        { id: "A", text: "/28 — 255.255.255.240 (14 usable hosts)", correct: false },
        { id: "B", text: "/27 — 255.255.255.224 (30 usable hosts)", correct: true },
        { id: "C", text: "/26 — 255.255.255.192 (62 usable hosts)", correct: false },
        { id: "D", text: "/29 — 255.255.255.248 (6 usable hosts)", correct: false }
      ],
      explanation: "2^(32 - 27) - 2 = 32 - 2 = 30 usable hosts. /28 only provides 14 hosts which is insufficient for 28 PCs."
    },
    {
      id: "sub-2",
      category: "ROUND 1: SUBNETTING",
      title: "Broadcast Address Collision",
      prompt: "A technician assigns IP 172.16.50.63 with subnet mask 255.255.255.192 (/26) to a network server. The server immediately fails to communicate on the local LAN. What is the root cause?",
      snippet: "Server IP:   172.16.50.63\nSubnet Mask: 255.255.255.192 (/26)\nBlock Size:  64 addresses (0 - 63)",
      options: [
        { id: "A", text: "172.16.50.63 is the directed broadcast address for 172.16.50.0/26", correct: true },
        { id: "B", text: "The 172.16.0.0 private range cannot use /26 masks", correct: false },
        { id: "C", text: "Default gateway must always be an even number", correct: false },
        { id: "D", text: "IP address must match the switch MAC address", correct: false }
      ],
      explanation: "For 172.16.50.0/26, the network ID is .0, valid hosts are .1 to .62, and .63 is the broadcast address."
    }
  ],
  vlan: [
    {
      id: "vlan-1",
      category: "ROUND 2: VLAN CONFIGURATION",
      title: "Inter-Switch Trunking Failure",
      prompt: "PC-A on Switch-1 (VLAN 10) cannot ping PC-B on Switch-2 (VLAN 10) across link G0/1. An inspection reveals G0/1 is operating in static 'access' mode. Which Cisco IOS configuration restores inter-switch 802.1Q trunking?",
      snippet: "Switch-1# show interface g0/1 switchport\nAdministrative Mode: static access\nOperational Mode:   static access",
      options: [
        { id: "A", text: "interface G0/1\n switchport mode trunk\n switchport trunk allowed vlan 10,20", correct: true },
        { id: "B", text: "interface G0/1\n switchport access vlan 10\n no shutdown", correct: false },
        { id: "C", text: "interface G0/1\n no switchport\n ip address 10.1.1.1 255.255.255.0", correct: false },
        { id: "D", text: "interface G0/1\n spanning-tree portfast trunk", correct: false }
      ],
      explanation: "Inter-switch uplinks carrying multiple VLANs must be configured with 'switchport mode trunk'."
    },
    {
      id: "vlan-2",
      category: "ROUND 2: VLAN CONFIGURATION",
      title: "Router-on-a-Stick Subinterface",
      prompt: "A network engineer creates subinterface G0/0.20 on Core Router R1 for inter-VLAN routing, but traffic for VLAN 20 is dropped. What command is missing?",
      snippet: "R1(config)# interface G0/0.20\nR1(config-subif)# ip address 192.168.20.1 255.255.255.0\n% Configuring IP routing on a LAN subinterface is only allowed if that subinterface is already configured as part of an 802.10, 802.1Q, or ISL vLAN.",
      options: [
        { id: "A", text: "encapsulation dot1Q 20", correct: true },
        { id: "B", text: "switchport mode trunk", correct: false },
        { id: "C", text: "ip helper-address 192.168.20.1", correct: false },
        { id: "D", text: "vlan 20 name Sales", correct: false }
      ],
      explanation: "Router subinterfaces require 'encapsulation dot1Q <vlan-id>' before an IP address can be bound."
    }
  ],
  routing: [
    {
      id: "rt-1",
      category: "ROUND 3: ROUTING",
      title: "Static Route Synthesis",
      prompt: "Router R1 needs to route packets destined for branch network 10.20.0.0/16 via the next-hop serial interface of R2 at 192.168.12.2. What is the correct static route syntax?",
      snippet: "Destination Network: 10.20.0.0/16\nNext-Hop Gateway:    192.168.12.2",
      options: [
        { id: "A", text: "ip route 10.20.0.0 255.255.0.0 192.168.12.2", correct: true },
        { id: "B", text: "ip route 192.168.12.2 255.255.0.0 10.20.0.0", correct: false },
        { id: "C", text: "route add 10.20.0.0 mask 255.255.0.0 192.168.12.2", correct: false },
        { id: "D", text: "router static 10.20.0.0 192.168.12.2", correct: false }
      ],
      explanation: "Cisco IOS static route format is 'ip route <destination-network> <subnet-mask> <next-hop-ip>'."
    },
    {
      id: "rt-2",
      category: "ROUND 3: ROUTING",
      title: "Administrative Distance Conflict",
      prompt: "A router learns a route to 172.24.0.0/24 from both OSPF and EIGRP. Which path is placed into the routing table and why?",
      snippet: "Routing Protocol 1: OSPF (AD = 110)\nRouting Protocol 2: EIGRP Internal (AD = 90)",
      options: [
        { id: "A", text: "EIGRP because it has a lower Administrative Distance (90 vs 110)", correct: true },
        { id: "B", text: "OSPF because link-state protocols always override distance-vector", correct: false },
        { id: "C", text: "Both routes share traffic equally via ECMP", correct: false },
        { id: "D", text: "The route with the highest metric cost wins", correct: false }
      ],
      explanation: "The route with the lower Administrative Distance is deemed more trustworthy and installed in the RIB."
    }
  ],
  acl: [
    {
      id: "acl-1",
      category: "ROUND 4: ACL TROUBLESHOOTING",
      title: "Standard ACL Placement",
      prompt: "You are applying standard ACL 10 to block host 192.168.1.50 from reaching finance server 10.10.10.5. Where should this Standard ACL be positioned?",
      snippet: "access-list 10 deny host 192.168.1.50\naccess-list 10 permit any",
      options: [
        { id: "A", text: "As close to the destination (Finance Server) as possible", correct: true },
        { id: "B", text: "As close to the source (Host PC) as possible", correct: false },
        { id: "C", text: "On the internet gateway router outbound", correct: false },
        { id: "D", text: "Inside the switch management VLAN", correct: false }
      ],
      explanation: "Standard ACLs only check source IP. If placed near the source, they inadvertently block traffic to all other destinations."
    },
    {
      id: "acl-2",
      category: "ROUND 4: ACL TROUBLESHOOTING",
      title: "Web Traffic Filter Inversion",
      prompt: "Host 192.168.1.100 cannot open HTTP web pages on 10.0.0.80:80. The router access-list contains: 'access-list 101 permit tcp host 192.168.1.100 host 10.0.0.80 eq 443'. Why is HTTP blocked?",
      snippet: "access-list 101 permit tcp host 192.168.1.100 host 10.0.0.80 eq 443\n(implicit deny all at bottom)",
      options: [
        { id: "A", text: "Port 443 is HTTPS. Port 80 is HTTP and is caught by the implicit deny.", correct: true },
        { id: "B", text: "Extended ACLs cannot filter TCP ports", correct: false },
        { id: "C", text: "Host keyword is only valid in standard ACLs", correct: false },
        { id: "D", text: "Subnet mask must be inverted to 255.255.255.255", correct: false }
      ],
      explanation: "HTTP operates on TCP port 80. The ACL only permits HTTPS (443) and terminates with an implicit deny."
    }
  ],
  troubleshooting: [
    {
      id: "tr-1",
      category: "ROUND 5: NETWORK TROUBLESHOOTING",
      title: "Default Gateway Subnet Mismatch",
      prompt: "Host PC1 has IP 192.168.1.45/24, but its default gateway is set to 192.168.2.1. The host can ping local subnet peers, but cannot access servers beyond the router. What is the defect?",
      snippet: "PC1 IP:             192.168.1.45\nSubnet Mask:        255.255.255.0\nDefault Gateway:    192.168.2.1 (Router IP is 192.168.1.1)",
      options: [
        { id: "A", text: "Default gateway is on a different subnet; reassign to 192.168.1.1", correct: true },
        { id: "B", text: "The network cable must be switched to cross-over", correct: false },
        { id: "C", text: "Subnet mask must be 255.255.0.0", correct: false },
        { id: "D", text: "DNS server address is corrupt", correct: false }
      ],
      explanation: "A device's default gateway must reside within the exact same local IP subnet as the host interface."
    },
    {
      id: "tr-2",
      category: "ROUND 5: NETWORK TROUBLESHOOTING",
      title: "Switchport Err-Disabled Event",
      prompt: "A switch port LED turns amber and drops into 'err-disabled' state. The console displays: '%PM-4-ERR_DISABLE: psecure-violation error detected on Fa0/5'. What event occurred?",
      snippet: "Switch# show interface fa0/5 status\nPort   Name    Status       Vlan    Duplex  Speed  Type\nFa0/5          err-disabled 10      auto    auto   10/100BaseTX",
      options: [
        { id: "A", text: "A port-security MAC violation occurred (unauthorized or excess MAC address)", correct: true },
        { id: "B", text: "Duplex mismatch caused excessive collisions", correct: false },
        { id: "C", text: "The patch cable exceeds 100 meters", correct: false },
        { id: "D", text: "Spanning Tree root bridge election failed", correct: false }
      ],
      explanation: "'psecure-violation' is triggered by Cisco Port Security when an unknown MAC sends frames to a secured port."
    }
  ]
};

// ----------------------------------------------------------------------------
// 3D WORLD STATE & ENGINE VARIABLES
// ----------------------------------------------------------------------------
let scene = null;
let camera = null;
let renderer = null;
let animationFrameId = null;
let isInitialized = false;
let isRunning = false;

// Player & Controls State
let playerGroup = null;
let playerMesh = null;
let playerVisor = null;
let playerLimbs = { leftArm: null, rightArm: null, leftLeg: null, rightLeg: null };
let playerVelocity = new THREE.Vector3();
let isGrounded = true;
let moveSpeed = 9.0;
let sprintSpeed = 16.5;
let currentSpeed = moveSpeed;

// Camera Orbit
let cameraYaw = Math.PI * 0.25;
let cameraPitch = 0.28;
let cameraDistance = 6.2;
let isMouseDown = false;
let previousMousePosition = { x: 0, y: 0 };

// Keyboard Keys State
const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  shift: false,
  space: false,
  e: false
};

// Interactive World Elements
let interactiveObjects = [];
let activeProximityObject = null;
let zoneIndicators = [];
let currentZoneName = "Network Facility · Main Lab";

// Multiplayer / Supabase
let realtimeChannel = null;
let remotePlayers = new Map(); // id -> { group, targetPos, targetRot, nameplate, name, level, rank }
let lastPositionBroadcast = 0;

// Bot Network Drones (Active facility agents)
let botAgents = [];

// Duel & Matchmaking State
let activeDuelState = null;
let matchmakingInterval = null;
let duelTimerInterval = null;

// Callbacks to update XELI leveling system
let appCallbacks = {
  onAddExp: null,
  onRefreshLeaderboard: null,
  getState: null
};

// ----------------------------------------------------------------------------
// INITIALIZE 3D LIVE FACILITY
// ----------------------------------------------------------------------------
export function init3DLiveWorld(container, callbacks = {}) {
  if (isInitialized && renderer) {
    resume3DLiveWorld();
    return;
  }

  appCallbacks = callbacks;
  const canvas = document.getElementById("live3dCanvas");
  if (!canvas || !container) return;

  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || (window.innerHeight - 70);

  // 1. Scene setup (Modern high-tech facility atmosphere)
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e1526);
  scene.fog = new THREE.FogExp2(0x0e1526, 0.012);

  // 2. Camera setup
  camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 500);
  camera.position.set(0, 4, 8);

  // 3. Renderer setup
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance"
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;

  // 4. Realistic Lighting setup
  setupRealisticLighting(scene);

  // 5. Build Facility Map (Lab, Data Center, NOC, Arena, Training Pods)
  interactiveObjects = [];
  buildRealisticFacility(
    scene,
    registerInteractiveObject,
    openEquipmentModal,
    startMatchmaking,
    openTrainingPodChallenge
  );

  // 6. Spawn Local Player Character (Stylized Realistic Human ~1.82m)
  spawnLocalPlayer();

  // 7. Spawn Active Facility Patrol Drones
  spawnFacilityPatrolDrones();

  // 8. Event Listeners (Controls, Resize, Mouse)
  setupEventListeners(container, canvas);

  // 9. Supabase Realtime Multiplayer Sync
  setupSupabaseRealtime();

  // 10. Update HUD & Profile info
  update3DLiveProfileHUD();

  // 11. Start Animation Loop
  isInitialized = true;
  isRunning = true;
  let lastTime = performance.now();

  function animate(now) {
    if (!isRunning) return;
    animationFrameId = requestAnimationFrame(animate);

    const delta = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    updatePlayerMovement(delta);
    updateCameraFollow();
    updateInteractiveProximity();
    updateBots(delta);
    updateFacilityAnimations(delta);
    updateProjectedNameplates(camera, width, height, remotePlayers, botAgents);
    updateMinimap();

    renderer.render(scene, camera);
  }

  animationFrameId = requestAnimationFrame(animate);
}

// ----------------------------------------------------------------------------
// LIGHTING SETUP
// ----------------------------------------------------------------------------
// Facility architecture and lighting are handled by facility-builder.js

// ----------------------------------------------------------------------------
// MESH GENERATOR HELPERS (Low-Poly Cyber Aesthetic)
// ----------------------------------------------------------------------------
function createServerRackMesh() {
  const group = new THREE.Group();

  const cabinetGeo = new THREE.BoxGeometry(2.4, 5.2, 2.0);
  const cabinetMat = new THREE.MeshStandardMaterial({ color: 0x0f1624, metalness: 0.8 });
  const cabinet = new THREE.Mesh(cabinetGeo, cabinetMat);
  cabinet.position.y = 2.6;
  cabinet.castShadow = true;
  group.add(cabinet);

  // Glass Front
  const glassGeo = new THREE.PlaneGeometry(2.1, 4.8);
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x00d2ff,
    transparent: true,
    opacity: 0.22,
    metalness: 0.9,
    roughness: 0.1
  });
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.position.set(0, 2.6, 1.01);
  group.add(glass);

  // Internal Blinking LED arrays
  const ledGeo = new THREE.BoxGeometry(1.9, 0.12, 0.05);
  for (let l = 0; l < 8; l++) {
    const ledMat = new THREE.MeshBasicMaterial({
      color: l % 3 === 0 ? 0x00d2ff : (l % 2 === 0 ? 0x22c55e : 0xfacc15)
    });
    const led = new THREE.Mesh(ledGeo, ledMat);
    led.position.set(0, 0.8 + l * 0.5, 0.95);
    group.add(led);
  }

  return group;
}

function createRouterMesh(label) {
  const group = new THREE.Group();

  const chassisGeo = new THREE.BoxGeometry(3.6, 0.9, 2.2);
  const chassisMat = new THREE.MeshStandardMaterial({ color: 0x1b273d, metalness: 0.7 });
  const chassis = new THREE.Mesh(chassisGeo, chassisMat);
  chassis.castShadow = true;
  group.add(chassis);

  // Cisco Logo Emblem
  const emblemMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
  const emblem = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.3), emblemMat);
  emblem.position.set(0, 0.46, 0.6);
  group.add(emblem);

  // Front Ports
  const portMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const ports = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.25, 0.06), portMat);
  ports.position.set(0, -0.1, 1.11);
  group.add(ports);

  // Dual Antennas
  const antMat = new THREE.MeshStandardMaterial({ color: 0x111827 });
  const ant1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4), antMat);
  ant1.position.set(-1.4, 0.7, -0.8);
  group.add(ant1);

  const ant2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4), antMat);
  ant2.position.set(1.4, 0.7, -0.8);
  group.add(ant2);

  return group;
}

function createSwitchMesh(label) {
  const group = new THREE.Group();

  const bodyGeo = new THREE.BoxGeometry(4.2, 0.65, 2.0);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x152236, metalness: 0.65 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);

  // 24 Ethernet Port LEDs (2 rows of 12)
  const portGeo = new THREE.BoxGeometry(0.18, 0.12, 0.04);
  const portOn = new THREE.MeshBasicMaterial({ color: 0x22c55e });

  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 12; col++) {
      const port = new THREE.Mesh(portGeo, portOn);
      port.position.set(-1.6 + col * 0.28, -0.1 + row * 0.22, 1.01);
      group.add(port);
    }
  }

  return group;
}

function createDesktopMonitorMesh() {
  const group = new THREE.Group();

  const stand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.8),
    new THREE.MeshStandardMaterial({ color: 0x1e293b })
  );
  stand.position.y = 0.4;
  group.add(stand);

  const screen = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1.4, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x0b111e })
  );
  screen.position.y = 1.0;
  group.add(screen);

  const glowScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 1.2),
    new THREE.MeshBasicMaterial({ color: 0x00d2ff, transparent: true, opacity: 0.4 })
  );
  glowScreen.position.set(0, 1.0, 0.06);
  group.add(glowScreen);

  return group;
}

function createPedestalMesh(label, colorHex) {
  const group = new THREE.Group();

  const padGeo = new THREE.CylinderGeometry(1.8, 2.0, 0.35, 16);
  const padMat = new THREE.MeshStandardMaterial({ color: 0x111927, metalness: 0.8 });
  const pad = new THREE.Mesh(padGeo, padMat);
  pad.position.y = 0.17;
  group.add(pad);

  const ringGeo = new THREE.RingGeometry(1.6, 1.78, 24);
  const ringMat = new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.36;
  group.add(ring);

  return group;
}

function createTrainingPodMesh(title, icon) {
  const group = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.8, 0.3, 6),
    new THREE.MeshStandardMaterial({ color: 0x0f1829, metalness: 0.8 })
  );
  base.position.y = 0.15;
  group.add(base);

  const pillar = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 2.2, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x162238 })
  );
  pillar.position.y = 1.2;
  group.add(pillar);

  // Angled Interactive Screen
  const screen = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.9, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x0b111e })
  );
  screen.rotation.x = -0.3;
  screen.position.set(0, 2.2, 0.2);
  group.add(screen);

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 0.75),
    new THREE.MeshBasicMaterial({ color: 0x00d2ff, transparent: true, opacity: 0.6 })
  );
  glow.rotation.x = -0.3;
  glow.position.set(0, 2.21, 0.27);
  group.add(glow);

  // Floating Holographic Beacon Icon
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), beaconMat);
  beacon.position.set(0, 3.2, 0);
  group.add(beacon);

  return group;
}

function createNocCanvasTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  // Draw High-Tech Cyber Network Topology
  ctx.fillStyle = "#070c18";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(0, 210, 255, 0.25)";
  ctx.lineWidth = 2;
  for (let x = 0; x < canvas.width; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Draw Topology Nodes
  ctx.fillStyle = "#00d2ff";
  ctx.font = "bold 26px Rajdhani, monospace";
  ctx.fillText("XELI GLOBAL NETWORK MONITOR // NOC CENTER", 40, 50);

  ctx.font = "18px monospace";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("BACKBONE: 100G FIBER · OSPF AREA 0 · CORE MESH ACTIVE", 40, 85);

  // Topology Diagram
  const nodes = [
    { x: 220, y: 220, label: "Core-R1 (10.0.0.1)" },
    { x: 512, y: 160, label: "Dist-SW1 (10.0.1.1)" },
    { x: 800, y: 220, label: "Core-R2 (10.0.0.2)" },
    { x: 340, y: 380, label: "Access-VLAN10" },
    { x: 680, y: 380, label: "Access-VLAN20" }
  ];

  ctx.strokeStyle = "#00d2ff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(nodes[0].x, nodes[0].y);
  ctx.lineTo(nodes[1].x, nodes[1].y);
  ctx.lineTo(nodes[2].x, nodes[2].y);
  ctx.lineTo(nodes[4].x, nodes[4].y);
  ctx.lineTo(nodes[3].x, nodes[3].y);
  ctx.lineTo(nodes[0].x, nodes[0].y);
  ctx.stroke();

  nodes.forEach((n) => {
    ctx.fillStyle = "#00d2ff";
    ctx.beginPath();
    ctx.arc(n.x, n.y, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px monospace";
    ctx.fillText(n.label, n.x - 50, n.y + 32);
  });

  return new THREE.CanvasTexture(canvas);
}

function createHoloTextTexture(text, color = "#00d2ff") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "bold 32px Rajdhani, monospace";
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.fillText(text, 256, 64);

  return new THREE.CanvasTexture(canvas);
}

// ----------------------------------------------------------------------------
// LOCAL & REMOTE HUNTER CHARACTERS (Stylized Realistic Human Models)
// ----------------------------------------------------------------------------
function spawnLocalPlayer() {
  const { root, limbs } = createHumanHunterCharacter(true, 0x00d2ff);
  playerGroup = root;
  playerLimbs = limbs;
  playerGroup.position.set(0, 0, 0);
  scene.add(playerGroup);
}

// ----------------------------------------------------------------------------
// FACILITY PATROL AGENTS (Active Network Engineers)
// ----------------------------------------------------------------------------
function spawnFacilityPatrolDrones() {
  botAgents = [
    {
      name: "NOC-Lead-Echo",
      level: 10,
      rank: "C",
      position: new THREE.Vector3(12, 0, -12),
      targetPos: new THREE.Vector3(12, 0, -12),
      waypoints: [
        new THREE.Vector3(12, 0, -12),
        new THREE.Vector3(18, 0, -10),
        new THREE.Vector3(14, 0, 4),
        new THREE.Vector3(12, 0, -4)
      ],
      waypointIdx: 0,
      group: null,
      limbs: null
    },
    {
      name: "SeniorSysAdmin-Prime",
      level: 18,
      rank: "D",
      position: new THREE.Vector3(-14, 0, -10),
      targetPos: new THREE.Vector3(-14, 0, -10),
      waypoints: [
        new THREE.Vector3(-14, 0, -10),
        new THREE.Vector3(-8, 0, -14),
        new THREE.Vector3(-12, 0, 0),
        new THREE.Vector3(-16, 0, -6)
      ],
      waypointIdx: 0,
      group: null,
      limbs: null
    }
  ];

  botAgents.forEach((bot) => {
    const { root, limbs } = createHumanHunterCharacter(false, 0xec4899);
    bot.group = root;
    bot.limbs = limbs;
    bot.group.position.copy(bot.position);
    scene.add(bot.group);
  });
}

function createRemoteHunterModel(name, level, rank, accentColor = 0x00d2ff) {
  const { root, limbs } = createHumanHunterCharacter(false, accentColor);
  return { group: root, limbs };
}

// ----------------------------------------------------------------------------
// PLAYER MOVEMENT & CONTROLS ENGINE
// ----------------------------------------------------------------------------
function updatePlayerMovement(delta) {
  if (!playerGroup) return;

  currentSpeed = keys.shift ? sprintSpeed : moveSpeed;

  const moveVector = new THREE.Vector3(0, 0, 0);

  // Compute direction relative to camera yaw
  const forward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
  const right = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));

  if (keys.w) moveVector.add(forward);
  if (keys.s) moveVector.sub(forward);
  if (keys.d) moveVector.add(right);
  if (keys.a) moveVector.sub(right);

  const isMoving = moveVector.lengthSq() > 0.001;

  if (isMoving) {
    moveVector.normalize();
    playerVelocity.x = moveVector.x * currentSpeed;
    playerVelocity.z = moveVector.z * currentSpeed;

    // Smooth body rotation to face move direction
    const targetAngle = Math.atan2(moveVector.x, moveVector.z);
    playerGroup.rotation.y = THREE.MathUtils.lerp(playerGroup.rotation.y, targetAngle, 12 * delta);
  } else {
    playerVelocity.x = THREE.MathUtils.lerp(playerVelocity.x, 0, 10 * delta);
    playerVelocity.z = THREE.MathUtils.lerp(playerVelocity.z, 0, 10 * delta);
  }

  // Jump physics
  if (keys.space && isGrounded) {
    playerVelocity.y = 8.8;
    isGrounded = false;
    playCyberTone(440, 0.12, "sine", 0.15);
  }

  // Gravity
  if (!isGrounded) {
    playerVelocity.y -= 24.0 * delta;
  }

  // Apply displacement
  playerGroup.position.x += playerVelocity.x * delta;
  playerGroup.position.y += playerVelocity.y * delta;
  playerGroup.position.z += playerVelocity.z * delta;

  // Ground collision clamp
  if (playerGroup.position.y <= 0) {
    playerGroup.position.y = 0;
    playerVelocity.y = 0;
    isGrounded = true;
  }

  // Facility walls boundary clamp (-23.2 to +23.2 inside 48m room)
  playerGroup.position.x = THREE.MathUtils.clamp(playerGroup.position.x, -23.2, 23.2);
  playerGroup.position.z = THREE.MathUtils.clamp(playerGroup.position.z, -23.2, 23.2);

  // Realistic human animation controller (walking, running, sprinting, jumping, idle breathing)
  animateHumanCharacter(playerLimbs, isMoving, keys.shift, isGrounded, delta);

  // Broadcast position to Supabase Realtime if elapsed > 100ms
  const now = performance.now();
  if (now - lastPositionBroadcast > 100 && realtimeChannel) {
    lastPositionBroadcast = now;
    broadcastPlayerPosition();
  }
}

// ----------------------------------------------------------------------------
// CAMERA ORBIT & THIRD-PERSON FOLLOW
// ----------------------------------------------------------------------------
function updateCameraFollow() {
  if (!playerGroup || !camera) return;

  const targetLook = new THREE.Vector3(
    playerGroup.position.x,
    playerGroup.position.y + 1.4,
    playerGroup.position.z
  );

  // Compute camera offset from spherical angles (yaw & pitch)
  let actualDist = cameraDistance;

  // Camera Wall Collision Prevention:
  // If camera position would penetrate facility walls (±22.8m in X/Z), smoothly dolly forward
  const normX = Math.sin(cameraYaw) * Math.cos(cameraPitch);
  const normZ = Math.cos(cameraYaw) * Math.cos(cameraPitch);

  const testX = targetLook.x + actualDist * normX;
  const testZ = targetLook.z + actualDist * normZ;

  const wallLimit = 22.6;
  if (Math.abs(testX) > wallLimit) {
    const maxDistX = Math.abs((Math.sign(normX) * wallLimit - targetLook.x) / (normX || 0.0001));
    if (maxDistX > 0.8) actualDist = Math.min(actualDist, maxDistX);
  }
  if (Math.abs(testZ) > wallLimit) {
    const maxDistZ = Math.abs((Math.sign(normZ) * wallLimit - targetLook.z) / (normZ || 0.0001));
    if (maxDistZ > 0.8) actualDist = Math.min(actualDist, maxDistZ);
  }

  const offsetX = actualDist * normX;
  const offsetY = actualDist * Math.sin(cameraPitch);
  const offsetZ = actualDist * normZ;

  const desiredPosition = new THREE.Vector3(
    targetLook.x + offsetX,
    Math.max(0.6, targetLook.y + offsetY),
    targetLook.z + offsetZ
  );

  camera.position.lerp(desiredPosition, 0.18);
  camera.lookAt(targetLook);
}

// ----------------------------------------------------------------------------
// INTERACTIVE PROXIMITY DETECTION & HUD
// ----------------------------------------------------------------------------
function registerInteractiveObject(obj) {
  interactiveObjects.push(obj);
}

function updateInteractiveProximity() {
  if (!playerGroup) return;

  const playerPos = playerGroup.position;
  let nearest = null;
  let minDistance = Infinity;

  interactiveObjects.forEach((obj) => {
    const d = playerPos.distanceTo(obj.position);
    if (d < obj.radius && d < minDistance) {
      minDistance = d;
      nearest = obj;
    }
  });

  const promptEl = document.getElementById("live3dInteractPrompt");
  const actionEl = document.getElementById("live3dInteractAction");
  const targetEl = document.getElementById("live3dInteractTarget");

  if (nearest) {
    activeProximityObject = nearest;
    if (promptEl) promptEl.style.display = "flex";
    if (actionEl) actionEl.textContent = nearest.actionText || "INTERACT";
    if (targetEl) targetEl.textContent = nearest.title;
  } else {
    activeProximityObject = null;
    if (promptEl) promptEl.style.display = "none";
  }

  // Update current zone indicator based on player coordinates
  updateZoneBanner(playerPos.x, playerPos.z);
}

function updateZoneBanner(px, pz) {
  let zone = "Network Engineering Facility · Central Concourse";
  let icon = "🌐";

  if (px < -3 && pz < -6) {
    zone = "Area 1: Network Lab · Cisco Routing & Switching";
    icon = "🔬";
  } else if (px < -3 && pz >= 2) {
    zone = "Area 2: Data Center · 42U Server Cold Aisle";
    icon = "🏢";
  } else if (px >= 3 && pz < 0) {
    zone = "Area 3: NOC Command Center · Backbone Wall";
    icon = "📊";
  } else if (px < -3 && pz >= -6 && pz < 2) {
    zone = "Area 4: Troubleshooting Lab · NGFW & Fiber Optics";
    icon = "🔧";
  } else if (px >= 3 && pz >= 3) {
    zone = "Area 5: Network Challenge Arena · Duel Ring";
    icon = "⚔";
  } else if (px >= -3 && px < 3 && pz >= 5) {
    zone = "Area 6: Training Zone · Subnet, VLAN & ACL Pods";
    icon = "🎓";
  }

  if (zone !== currentZoneName) {
    currentZoneName = zone;
    const nameEl = document.getElementById("live3dZoneName");
    if (nameEl) nameEl.textContent = zone;
  }
}

// ----------------------------------------------------------------------------
// PATROL BOTS MOVEMENT
// ----------------------------------------------------------------------------
function updateBots(delta) {
  botAgents.forEach((bot) => {
    if (!bot.group) return;

    const currentWay = bot.waypoints[bot.waypointIdx];
    const dist = bot.group.position.distanceTo(currentWay);

    if (dist < 0.6) {
      bot.waypointIdx = (bot.waypointIdx + 1) % bot.waypoints.length;
      if (bot.limbs) animateHumanCharacter(bot.limbs, false, false, true, delta);
    } else {
      const dir = new THREE.Vector3().subVectors(currentWay, bot.group.position).normalize();
      bot.group.position.addScaledVector(dir, 3.2 * delta);
      bot.group.rotation.y = THREE.MathUtils.lerp(bot.group.rotation.y, Math.atan2(dir.x, dir.z), 6 * delta);
      if (bot.limbs) animateHumanCharacter(bot.limbs, true, false, true, delta);
    }
  });
}

// ----------------------------------------------------------------------------
// 2D MINIMAP ENGINE
// ----------------------------------------------------------------------------
function updateMinimap() {
  const canvas = document.getElementById("live3dMinimap");
  if (!canvas || !playerGroup) return;

  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const mapScale = w / 74;

  ctx.fillStyle = "#060913";
  ctx.fillRect(0, 0, w, h);

  // Grid
  ctx.strokeStyle = "rgba(0, 210, 255, 0.15)";
  ctx.lineWidth = 1;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  ctx.beginPath();
  ctx.moveTo(w / 2, 4);
  ctx.lineTo(w / 2, h - 4);
  ctx.moveTo(4, h / 2);
  ctx.lineTo(w - 4, h / 2);
  ctx.stroke();

  // Draw Zones
  ctx.fillStyle = "rgba(0, 210, 255, 0.25)";
  ctx.font = "8px monospace";
  ctx.fillText("LAB", 14, 22);
  ctx.fillText("NOC", w - 30, 22);
  ctx.fillText("TRAIN", 10, h - 14);
  ctx.fillText("ARENA", w - 34, h - 14);

  // Draw Interactive Objects (Cyan blips)
  ctx.fillStyle = "#00d2ff";
  interactiveObjects.forEach((obj) => {
    const mx = (obj.position.x + 37) * mapScale;
    const my = (obj.position.z + 37) * mapScale;
    ctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
  });

  // Draw Other Players / Bots (Orange/Red)
  ctx.fillStyle = "#f43f5e";
  botAgents.forEach((bot) => {
    if (!bot.group) return;
    const bx = (bot.group.position.x + 37) * mapScale;
    const by = (bot.group.position.z + 37) * mapScale;
    ctx.beginPath();
    ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Draw Local Player (Cyan Arrow)
  const px = (playerGroup.position.x + 37) * mapScale;
  const py = (playerGroup.position.z + 37) * mapScale;

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(-cameraYaw);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.lineTo(3.5, 4);
  ctx.lineTo(0, 2.5);
  ctx.lineTo(-3.5, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ----------------------------------------------------------------------------
// SUPABASE REALTIME MULTIPLAYER SYNC
// ----------------------------------------------------------------------------
async function setupSupabaseRealtime() {
  try {
    const user = await getCurrentSupabaseUser();
    const userId = user?.id || `hunter_${Math.floor(Math.random() * 99999)}`;
    const state = appCallbacks.getState ? appCallbacks.getState() : { name: "Hunter", level: 1, rank: "E" };

    realtimeChannel = supabase.channel("3d_live_facility", {
      config: {
        presence: { key: userId },
        broadcast: { self: false }
      }
    });

    realtimeChannel
      .on("presence", { event: "sync" }, () => {
        const presenceState = realtimeChannel.presenceState();
        updateOnlineCount(presenceState);
      })
      .on("broadcast", { event: "player_pos" }, ({ payload }) => {
        handleRemotePlayerPosition(payload);
      })
      .on("broadcast", { event: "duel_match_found" }, ({ payload }) => {
        handleRemoteDuelMatch(payload);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await realtimeChannel.track({
            id: userId,
            name: state.name || "Hunter",
            level: state.level || 1,
            rank: state.rank || "E",
            onlineAt: new Date().toISOString()
          });
        }
      });
  } catch (err) {
    console.warn("3D Live Realtime notice:", err);
  }
}

function updateOnlineCount(presenceState) {
  let count = Object.keys(presenceState || {}).length;
  count = Math.max(count, 1); // User is always online

  const badgeEl = document.getElementById("live3dOnlineCount");
  if (badgeEl) {
    badgeEl.textContent = `${count} Hunter${count > 1 ? "s" : ""} Online`;
  }
}

function broadcastPlayerPosition() {
  if (!realtimeChannel || !playerGroup) return;
  const state = appCallbacks.getState ? appCallbacks.getState() : { name: "Hunter", level: 1, rank: "E" };

  realtimeChannel.send({
    type: "broadcast",
    event: "player_pos",
    payload: {
      name: state.name || "Hunter",
      level: state.level || 1,
      rank: state.rank || "E",
      x: Math.round(playerGroup.position.x * 100) / 100,
      y: Math.round(playerGroup.position.y * 100) / 100,
      z: Math.round(playerGroup.position.z * 100) / 100,
      rotY: Math.round(playerGroup.rotation.y * 100) / 100
    }
  });
}

function handleRemotePlayerPosition(payload) {
  if (!payload || !payload.name) return;
  const id = payload.id || payload.name;

  let remote = remotePlayers.get(id);
  if (!remote) {
    const { group, limbs } = createRemoteHunterModel(payload.name, payload.level, payload.rank, 0x00d2ff);
    group.position.set(payload.x || 0, payload.y || 0, payload.z || 0);
    scene.add(group);
    remote = {
      group,
      limbs,
      name: payload.name,
      level: payload.level,
      rank: payload.rank,
      lastPos: new THREE.Vector3(payload.x || 0, payload.y || 0, payload.z || 0)
    };
    remotePlayers.set(id, remote);
  } else {
    const prevPos = remote.lastPos || remote.group.position.clone();
    const currPos = new THREE.Vector3(payload.x || 0, payload.y || 0, payload.z || 0);
    const isMoving = prevPos.distanceTo(currPos) > 0.05;
    remote.lastPos = currPos.clone();
    remote.group.position.copy(currPos);
    remote.group.rotation.y = payload.rotY || 0;
    if (remote.limbs) {
      animateHumanCharacter(remote.limbs, isMoving, false, true, 0.016);
    }
  }
}

// ----------------------------------------------------------------------------
// "⚔ FIND OPPONENT" MATCHMAKING & 5-ROUND NETWORK DUEL
// ----------------------------------------------------------------------------
export function startMatchmaking() {
  const modal = document.getElementById("live3dMatchmakingModal");
  const title = document.getElementById("live3dMatchStatusTitle");
  const sub = document.getElementById("live3dMatchStatusSub");
  const card = document.getElementById("live3dOpponentCard");
  const acceptBtn = document.getElementById("live3dAcceptChallengeBtn");

  if (!modal) return;

  modal.style.display = "flex";
  if (title) title.textContent = "Searching for Opponent...";
  if (sub) sub.textContent = "Scanning the Network Challenge Arena for available Hunters...";
  if (card) card.style.display = "none";
  if (acceptBtn) acceptBtn.style.display = "none";

  playCyberTone(660, 0.15, "triangle", 0.2);

  // Search for real online opponent or pick arena challenger
  const pool = [
    { name: "NETWORK_HUNTER_99", level: 14, rank: "D", exp: 18450, title: "Senior NOC Engineer" },
    { name: "CISCO_ARCHITECT_X", level: 22, rank: "D", exp: 38200, title: "Enterprise Routing Specialist" },
    { name: "VLAN_ENFORCER", level: 12, rank: "E", exp: 14200, title: "Layer-2 Switch Master" },
    { name: "PACKET_SLASHER", level: 16, rank: "D", exp: 22800, title: "Wireshark Packet Hunter" }
  ];
  const chosenOpponent = pool[Math.floor(Math.random() * pool.length)];

  matchmakingInterval = setTimeout(() => {
    if (title) title.textContent = "⚡ Opponent Found!";
    if (sub) sub.textContent = "Challenger is ready in the Network Challenge Arena.";

    const oppName = document.getElementById("live3dOppName");
    const oppRank = document.getElementById("live3dOppRank");
    const oppTitle = document.getElementById("live3dOppTitle");
    const oppLevel = document.getElementById("live3dOppLevel");
    const oppExp = document.getElementById("live3dOppExp");

    if (oppName) oppName.textContent = chosenOpponent.name;
    if (oppRank) oppRank.textContent = `${chosenOpponent.rank}-RANK`;
    if (oppTitle) oppTitle.textContent = chosenOpponent.title;
    if (oppLevel) oppLevel.textContent = chosenOpponent.level;
    if (oppExp) oppExp.textContent = chosenOpponent.exp.toLocaleString();

    if (card) card.style.display = "flex";
    if (acceptBtn) acceptBtn.style.display = "inline-flex";

    playDuelBeep(true);
  }, 1400);

  // Setup Accept handler
  if (acceptBtn) {
    acceptBtn.onclick = () => {
      modal.style.display = "none";
      launchNetworkDuel(chosenOpponent);
    };
  }
}

export function cancelMatchmaking() {
  if (matchmakingInterval) clearTimeout(matchmakingInterval);
  const modal = document.getElementById("live3dMatchmakingModal");
  if (modal) modal.style.display = "none";
  playCyberTone(240, 0.1, "sine", 0.1);
}

// ----------------------------------------------------------------------------
// 5-ROUND NETWORK DUEL ENGINE
// ----------------------------------------------------------------------------
function launchNetworkDuel(opponent) {
  const duelModal = document.getElementById("live3dDuelModal");
  if (!duelModal) return;

  duelModal.style.display = "flex";

  const state = appCallbacks.getState ? appCallbacks.getState() : { name: "Hunter", level: 1, rank: "E" };

  // Setup Duel State
  activeDuelState = {
    opponent,
    playerScore: 0,
    opponentScore: 0,
    currentRoundIndex: 0,
    rounds: [
      getRandomRoundQuestion("subnetting"),
      getRandomRoundQuestion("vlan"),
      getRandomRoundQuestion("routing"),
      getRandomRoundQuestion("acl"),
      getRandomRoundQuestion("troubleshooting")
    ],
    roundTimeRemaining: 120, // 2 minutes (120s)
    isAnswered: false
  };

  // Header Elements
  const p1Name = document.getElementById("live3dDuelP1Name");
  const p1Level = document.getElementById("live3dDuelP1Level");
  const p1Score = document.getElementById("live3dDuelP1Score");
  const p2Name = document.getElementById("live3dDuelP2Name");
  const p2Level = document.getElementById("live3dDuelP2Level");
  const p2Score = document.getElementById("live3dDuelP2Score");

  if (p1Name) p1Name.textContent = state.name || "Hunter";
  if (p1Level) p1Level.textContent = `Lv. ${state.level || 1}`;
  if (p1Score) p1Score.textContent = "0 pts";

  if (p2Name) p2Name.textContent = opponent.name;
  if (p2Level) p2Level.textContent = `Lv. ${opponent.level}`;
  if (p2Score) p2Score.textContent = "0 pts";

  startDuelRound();
}

function getRandomRoundQuestion(category) {
  const pool = NETWORK_CHALLENGES[category] || NETWORK_CHALLENGES.subnetting;
  return pool[Math.floor(Math.random() * pool.length)];
}

function startDuelRound() {
  if (!activeDuelState) return;

  const currentQ = activeDuelState.rounds[activeDuelState.currentRoundIndex];
  activeDuelState.isAnswered = false;
  activeDuelState.roundTimeRemaining = 120; // 2 minutes (120s) per round

  const roundPill = document.getElementById("live3dDuelRoundPill");
  const catBadge = document.getElementById("live3dDuelCategoryBadge");
  const promptEl = document.getElementById("live3dDuelPrompt");
  const snippetBox = document.getElementById("live3dDuelSnippetBox");
  const snippetEl = document.getElementById("live3dDuelSnippet");
  const optionsGrid = document.getElementById("live3dDuelOptionsGrid");
  const feedbackEl = document.getElementById("live3dRoundFeedback");

  if (feedbackEl) feedbackEl.style.display = "none";
  if (roundPill) roundPill.textContent = `ROUND ${activeDuelState.currentRoundIndex + 1}/5: ${currentQ.category.replace(/ROUND \d+:\s*/, "")}`;
  if (catBadge) catBadge.textContent = currentQ.category;
  if (promptEl) promptEl.textContent = currentQ.prompt;

  if (currentQ.snippet) {
    if (snippetBox) snippetBox.style.display = "block";
    if (snippetEl) snippetEl.textContent = currentQ.snippet;
  } else {
    if (snippetBox) snippetBox.style.display = "none";
  }

  // Populate 4 Options
  if (optionsGrid) {
    optionsGrid.innerHTML = "";
    currentQ.options.forEach((opt, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "live3d-duel-option-btn";
      btn.innerHTML = `<span class="live3d-opt-letter">${opt.id}</span> <span class="live3d-opt-text">${escapeHtml(opt.text)}</span>`;
      btn.onclick = () => handlePlayerAnswer(opt, btn);
      optionsGrid.appendChild(btn);
    });
  }

  // Start 2-Minute (120s) Timer
  if (duelTimerInterval) clearInterval(duelTimerInterval);
  updateTimerUI();

  duelTimerInterval = setInterval(() => {
    activeDuelState.roundTimeRemaining--;
    updateTimerUI();

    if (activeDuelState.roundTimeRemaining <= 0) {
      clearInterval(duelTimerInterval);
      handleRoundTimeout();
    }
  }, 1000);
}

function formatDuelTimer(totalSecs) {
  const mins = Math.floor(Math.max(0, totalSecs) / 60);
  const secs = Math.max(0, totalSecs) % 60;
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

function updateTimerUI() {
  if (!activeDuelState) return;
  const secEl = document.getElementById("live3dDuelSeconds");
  const fillEl = document.getElementById("live3dDuelTimerFill");
  const pct = Math.max(0, (activeDuelState.roundTimeRemaining / 120) * 100);

  if (secEl) secEl.textContent = formatDuelTimer(activeDuelState.roundTimeRemaining);
  if (fillEl) fillEl.style.width = `${pct}%`;
}

function handlePlayerAnswer(opt, btnEl) {
  if (!activeDuelState || activeDuelState.isAnswered) return;
  activeDuelState.isAnswered = true;
  clearInterval(duelTimerInterval);

  // Disable all buttons
  const allBtns = document.querySelectorAll(".live3d-duel-option-btn");
  allBtns.forEach((b) => (b.disabled = true));

  const isCorrect = opt.correct;
  const timeBonus = Math.max(30, Math.round((activeDuelState.roundTimeRemaining / 120) * 200));
  const roundPts = isCorrect ? 200 + timeBonus : 0;

  if (isCorrect) {
    btnEl.classList.add("is-correct");
    activeDuelState.playerScore += roundPts;
    playDuelBeep(true);
  } else {
    btnEl.classList.add("is-wrong");
    playDuelBeep(false);
  }

  // Opponent simulated response
  const oppCorrect = Math.random() > 0.35;
  const oppPts = oppCorrect ? 180 + Math.floor(Math.random() * 80) : 0;
  activeDuelState.opponentScore += oppPts;

  // Update Score Displays
  const p1Score = document.getElementById("live3dDuelP1Score");
  const p2Score = document.getElementById("live3dDuelP2Score");
  if (p1Score) p1Score.textContent = `${activeDuelState.playerScore} pts`;
  if (p2Score) p2Score.textContent = `${activeDuelState.opponentScore} pts`;

  // Show Feedback Banner
  const feedbackEl = document.getElementById("live3dRoundFeedback");
  if (feedbackEl) {
    feedbackEl.style.display = "block";
    feedbackEl.className = `live3d-round-feedback ${isCorrect ? "is-won" : "is-lost"}`;
    feedbackEl.innerHTML = `
      <div class="live3d-fb-title">${isCorrect ? "✔ CORRECT CONFIGURATION!" : "✖ INCORRECT CONFIGURATION"} (+${roundPts} pts)</div>
      <div class="live3d-fb-sub">${activeDuelState.rounds[activeDuelState.currentRoundIndex].explanation}</div>
    `;
  }

  // Next round or conclude duel
  setTimeout(() => {
    activeDuelState.currentRoundIndex++;
    if (activeDuelState.currentRoundIndex < activeDuelState.rounds.length) {
      startDuelRound();
    } else {
      concludeNetworkDuel();
    }
  }, 2400);
}

function handleRoundTimeout() {
  if (!activeDuelState || activeDuelState.isAnswered) return;
  activeDuelState.isAnswered = true;

  playDuelBeep(false);
  const feedbackEl = document.getElementById("live3dRoundFeedback");
  if (feedbackEl) {
    feedbackEl.style.display = "block";
    feedbackEl.className = "live3d-round-feedback is-lost";
    feedbackEl.innerHTML = `
      <div class="live3d-fb-title">⌛ ROUND TIMEOUT!</div>
      <div class="live3d-fb-sub">Time expired before a packet configuration was committed.</div>
    `;
  }

  setTimeout(() => {
    activeDuelState.currentRoundIndex++;
    if (activeDuelState.currentRoundIndex < activeDuelState.rounds.length) {
      startDuelRound();
    } else {
      concludeNetworkDuel();
    }
  }, 2000);
}

function concludeNetworkDuel() {
  const pScore = activeDuelState.playerScore;
  const oScore = activeDuelState.opponentScore;
  const isWinner = pScore >= oScore;

  // Award real EXP to XELI Leveling System
  const expAward = isWinner ? 220 : 70;
  if (typeof appCallbacks.onAddExp === "function") {
    appCallbacks.onAddExp(expAward, `Network Duel: ${isWinner ? "Victory" : "Match Played"}`);
  }

  const feedbackEl = document.getElementById("live3dRoundFeedback");
  if (feedbackEl) {
    feedbackEl.style.display = "block";
    feedbackEl.className = `live3d-round-feedback ${isWinner ? "is-victory" : "is-lost"}`;
    feedbackEl.innerHTML = `
      <div class="live3d-fb-title" style="font-size:22px;">
        ${isWinner ? "🏆 VICTORY IN NETWORK CHALLENGE ARENA!" : "DEFEAT — GOOD ATTEMPT"}
      </div>
      <div class="live3d-fb-sub" style="font-size:15px; margin: 8px 0;">
        Final Score: You <b>${pScore} pts</b> vs Opponent <b>${oScore} pts</b>
      </div>
      <div class="live3d-fb-award">
        +${expAward} EXP awarded to your Hunter Account!
      </div>
      <button type="button" class="btn btn-primary" id="live3dCloseDuelBtn" style="margin-top:12px;">
        RETURN TO 3D FACILITY
      </button>
    `;

    const closeBtn = document.getElementById("live3dCloseDuelBtn");
    if (closeBtn) {
      closeBtn.onclick = () => {
        const duelModal = document.getElementById("live3dDuelModal");
        if (duelModal) duelModal.style.display = "none";
        activeDuelState = null;
        update3DLiveProfileHUD();
      };
    }
  }
}

// ----------------------------------------------------------------------------
// INTERACTIVE EQUIPMENT & TRAINING POD MODALS
// ----------------------------------------------------------------------------
function openEquipmentModal(type, title) {
  const modal = document.getElementById("live3dEquipmentModal");
  const titleEl = document.getElementById("live3dEquipTitle");
  const subEl = document.getElementById("live3dEquipSub");
  const iconEl = document.getElementById("live3dEquipIcon");
  const contentEl = document.getElementById("live3dEquipContent");

  if (!modal || !contentEl) return;
  modal.style.display = "flex";

  if (titleEl) titleEl.textContent = title;

  if (type === "router") {
    if (iconEl) iconEl.textContent = "📡";
    if (subEl) subEl.textContent = "Cisco IOS Core Terminal · OSPF / BGP Active";
    contentEl.innerHTML = `
      <div class="live3d-cli-box">
        <div class="live3d-cli-out" id="live3dCliOut">
Router-Core-01> enable
Password: *********
Router-Core-01# show ip interface brief
Interface                  IP-Address      OK? Method Status                Protocol
GigabitEthernet0/0         192.168.1.1     YES manual up                    up
GigabitEthernet0/1         10.0.0.1        YES manual up                    up
Serial0/0/0                203.0.113.2     YES manual up                    up
Loopback0                  1.1.1.1         YES manual up                    up

Router-Core-01# show ip route
Gateway of last resort is 203.0.113.1 to network 0.0.0.0

      10.0.0.0/24 is subnetted, 1 subnets
C        10.0.0.0 is directly connected, GigabitEthernet0/1
      192.168.1.0/24 is subnetted, 1 subnets
C        192.168.1.0 is directly connected, GigabitEthernet0/0
S*    0.0.0.0/0 [1/0] via 203.0.113.1
        </div>
        <div class="live3d-cli-input-row">
          <span>Router-Core-01#</span>
          <input type="text" id="live3dRouterCmdInput" class="live3d-cli-input" placeholder="Type Cisco command (e.g., ping 10.0.0.1, show run)..." />
          <button type="button" class="btn btn-primary" id="live3dRouterSendBtn">Execute ↵</button>
        </div>
      </div>
    `;

    const input = document.getElementById("live3dRouterCmdInput");
    const sendBtn = document.getElementById("live3dRouterSendBtn");
    const out = document.getElementById("live3dCliOut");

    const exec = () => {
      const val = (input?.value || "").trim().toLowerCase();
      if (!val) return;
      out.textContent += `\nRouter-Core-01# ${val}\n`;

      if (val.includes("ping")) {
        out.textContent += `Sending 5, 100-byte ICMP Echos, timeout is 2 seconds:\n!!!!!\nSuccess rate is 100 percent (5/5), round-trip min/avg/max = 1/2/4 ms\n`;
      } else if (val.includes("show vlan") || val.includes("show ip int")) {
        out.textContent += `GigabitEthernet0/0: UP/UP (192.168.1.1/24)\nGigabitEthernet0/1: UP/UP (10.0.0.1/24)\n`;
      } else if (val.includes("show run")) {
        out.textContent += `Building configuration...\nhostname Router-Core-01\n!\nip routing\n!\ninterface GigabitEthernet0/0\n ip address 192.168.1.1 255.255.255.0\n!\nend\n`;
      } else {
        out.textContent += `% Command executed successfully on Core Router 01.\n`;
      }
      out.scrollTop = out.scrollHeight;
      input.value = "";
    };

    if (sendBtn) sendBtn.onclick = exec;
    if (input) input.onkeydown = (e) => e.key === "Enter" && exec();
  } else if (type === "switch") {
    if (iconEl) iconEl.textContent = "🔀";
    if (subEl) subEl.textContent = "Catalyst 3750-X 24P · 802.1Q Trunks Active";
    contentEl.innerHTML = `
      <div class="live3d-cli-box">
        <div class="live3d-cli-out">
Switch-3750# show vlan brief

VLAN Name                             Status    Ports
---- -------------------------------- --------- -------------------------------
1    default                          active    Fa0/1, Fa0/2, Fa0/3, Fa0/4
10   Engineering                      active    Fa0/5, Fa0/6, Fa0/7, Fa0/8
20   Sales                            active    Fa0/9, Fa0/10, Fa0/11, Fa0/12
99   Management                       active    Fa0/23, Fa0/24

Switch-3750# show interfaces trunk
Port        Mode             Encapsulation  Status        Native vlan
Gi0/1       on               802.1q         trunking      1
        </div>
      </div>
    `;
  } else if (type === "firewall") {
    if (iconEl) iconEl.textContent = "🛡️";
    if (subEl) subEl.textContent = "Enterprise NGFW-500E · FortiOS 7.4 · Deep Packet Inspection";
    contentEl.innerHTML = `
      <div class="live3d-cli-box">
        <div class="live3d-cli-out" id="live3dCliOut">
NGFW-500E# get system status
Version: FortiGate-500E v7.4.2,build2578,231129 (GA)
Security Fabric: Connected
IPS Engine: 7.00281 · AV Engine: 6.00288
Active Session Count: 48,912 / 2,000,000
CPU Utilization: 12% · Memory: 28%

NGFW-500E# diagnose firewall iprope show
Policy Rule #14 [LAN -> WAN]: ACCEPT (NAT: Overload, Inspection: Deep SSL)
Policy Rule #22 [DMZ -> LAN]: DENY (Intrusion Detection: Active)
Policy Rule #37 [Untrusted -> Internal]: DROP (IP: 198.51.100.22 - Port Scan Blocked)
        </div>
        <div class="live3d-cli-input-row">
          <span>NGFW-500E#</span>
          <input type="text" id="live3dRouterCmdInput" class="live3d-cli-input" placeholder="Type firewall command (e.g., diagnose sys session, get policy)..." />
          <button type="button" class="btn btn-primary" id="live3dRouterSendBtn">Execute ↵</button>
        </div>
      </div>
    `;

    const input = document.getElementById("live3dRouterCmdInput");
    const sendBtn = document.getElementById("live3dRouterSendBtn");
    const out = document.getElementById("live3dCliOut");

    const exec = () => {
      const val = (input?.value || "").trim().toLowerCase();
      if (!val) return;
      out.textContent += `\nNGFW-500E# ${val}\n`;
      if (val.includes("session")) {
        out.textContent += `Active NAT Sessions: 1,429 | Protocol: TCP/UDP | State: ESTABLISHED\n`;
      } else if (val.includes("policy") || val.includes("rule")) {
        out.textContent += `Rule 1: permit 10.0.0.0/8 -> any eq 443 (hitcount: 98,214)\nRule 2: deny any -> 10.10.10.0/24 (hitcount: 312)\n`;
      } else {
        out.textContent += `% Command executed successfully on Next-Gen Firewall.\n`;
      }
      out.scrollTop = out.scrollHeight;
      input.value = "";
    };

    if (sendBtn) sendBtn.onclick = exec;
    if (input) input.onkeydown = (e) => e.key === "Enter" && exec();
  } else if (type === "fiber") {
    if (iconEl) iconEl.textContent = "💡";
    if (subEl) subEl.textContent = "Optical Distribution Bay (ODF) · OTDR 1310/1550nm Diagnostics";
    contentEl.innerHTML = `
      <div class="live3d-noc-diag-grid">
        <div class="live3d-diag-card">
          <div class="live3d-diag-label">CORE BACKBONE OPTICAL FIBER</div>
          <div class="live3d-diag-val" style="color:#10b981;">STRAND 1-24: NOMINAL</div>
        </div>
        <div class="live3d-diag-card">
          <div class="live3d-diag-label">TX OPTICAL LAUNCH POWER</div>
          <div class="live3d-diag-val" style="color:#00d2ff;">-2.4 dBm (100G-LR4)</div>
        </div>
        <div class="live3d-diag-card">
          <div class="live3d-diag-label">OPTICAL ATTENUATION / KM</div>
          <div class="live3d-diag-val" style="color:#38bdf8;">0.19 dB/km (OPTIMAL)</div>
        </div>
        <div class="live3d-diag-card">
          <div class="live3d-diag-label">CONNECTOR REFLECTANCE</div>
          <div class="live3d-diag-val" style="color:#facc15;">-54.2 dB (LC/UPC PASS)</div>
        </div>
      </div>
    `;
  } else if (type === "noc") {
    if (iconEl) iconEl.textContent = "📊";
    if (subEl) subEl.textContent = "Network Operations Center · Live Latency Matrix";
    contentEl.innerHTML = `
      <div class="live3d-noc-diag-grid">
        <div class="live3d-diag-card">
          <div class="live3d-diag-label">GLOBAL BACKBONE THROUGHPUT</div>
          <div class="live3d-diag-val" style="color:#00d2ff;">84.2 Gbps / 100G</div>
        </div>
        <div class="live3d-diag-card">
          <div class="live3d-diag-label">PACKET LOSS RATIO</div>
          <div class="live3d-diag-val" style="color:#22c55e;">0.002% (NOMINAL)</div>
        </div>
        <div class="live3d-diag-card">
          <div class="live3d-diag-label">OSPF NEIGHBOR ADJACENCIES</div>
          <div class="live3d-diag-val" style="color:#facc15;">14 / 14 FULL</div>
        </div>
        <div class="live3d-diag-card">
          <div class="live3d-diag-label">AVERAGE RTT LATENCY</div>
          <div class="live3d-diag-val" style="color:#38bdf8;">1.8 ms</div>
        </div>
      </div>
    `;
  } else {
    if (iconEl) iconEl.textContent = "💻";
    if (subEl) subEl.textContent = "System Diagnostics · CPU & Memory Load";
    contentEl.innerHTML = `
      <div class="live3d-cli-box">
        <div class="live3d-cli-out">
Linux debian-netlab-blade01 6.1.0 #1 SMP PREEMPT_DYNAMIC
Load average: 0.12, 0.08, 0.04
Active network sockets: 284 ESTABLISHED
Memory: 14.2 GB / 64 GB in use (22%)
Status: HEALTHY · ALL BLADES OPERATIONAL
        </div>
      </div>
    `;
  }

  const closeBtn = document.getElementById("live3dEquipCloseBtn");
  if (closeBtn) closeBtn.onclick = () => (modal.style.display = "none");
}

function openTrainingPodChallenge(cat, name) {
  const modal = document.getElementById("live3dEquipmentModal");
  const titleEl = document.getElementById("live3dEquipTitle");
  const subEl = document.getElementById("live3dEquipSub");
  const iconEl = document.getElementById("live3dEquipIcon");
  const contentEl = document.getElementById("live3dEquipContent");

  if (!modal || !contentEl) return;
  modal.style.display = "flex";

  if (iconEl) iconEl.textContent = "🎓";
  if (titleEl) titleEl.textContent = `${name} — Practical Lab`;
  if (subEl) subEl.textContent = "Complete the network diagnostic challenge to earn +60 EXP!";

  const q = getRandomRoundQuestion(cat);

  contentEl.innerHTML = `
    <div class="live3d-training-card">
      <div class="live3d-training-prompt">${escapeHtml(q.prompt)}</div>
      ${q.snippet ? `<div class="live3d-training-snippet"><pre><code>${escapeHtml(q.snippet)}</code></pre></div>` : ""}
      <div class="live3d-duel-options-grid" id="live3dTrainingOptions">
        ${q.options
          .map(
            (opt) => `
          <button type="button" class="live3d-duel-option-btn" data-correct="${opt.correct}">
            <span class="live3d-opt-letter">${opt.id}</span>
            <span class="live3d-opt-text">${escapeHtml(opt.text)}</span>
          </button>
        `
          )
          .join("")}
      </div>
      <div id="live3dTrainingResult" class="live3d-round-feedback" style="display:none; margin-top:14px;"></div>
    </div>
  `;

  const optBtns = contentEl.querySelectorAll(".live3d-duel-option-btn");
  const resEl = document.getElementById("live3dTrainingResult");

  optBtns.forEach((btn) => {
    btn.onclick = () => {
      optBtns.forEach((b) => (b.disabled = true));
      const isCorrect = btn.dataset.correct === "true";

      if (isCorrect) {
        btn.classList.add("is-correct");
        playDuelBeep(true);
        if (typeof appCallbacks.onAddExp === "function") {
          appCallbacks.onAddExp(60, `${name} Clearance`);
        }
        resEl.style.display = "block";
        resEl.className = "live3d-round-feedback is-won";
        resEl.innerHTML = `
          <div class="live3d-fb-title">✔ EXCELLENT WORK! +60 EXP Awarded</div>
          <div class="live3d-fb-sub">${q.explanation}</div>
        `;
      } else {
        btn.classList.add("is-wrong");
        playDuelBeep(false);
        resEl.style.display = "block";
        resEl.className = "live3d-round-feedback is-lost";
        resEl.innerHTML = `
          <div class="live3d-fb-title">✖ INCORRECT CONFIGURATION</div>
          <div class="live3d-fb-sub">${q.explanation}</div>
        `;
      }
      update3DLiveProfileHUD();
    };
  });

  const closeBtn = document.getElementById("live3dEquipCloseBtn");
  if (closeBtn) closeBtn.onclick = () => (modal.style.display = "none");
}

// ----------------------------------------------------------------------------
// EVENT LISTENERS & TELEPORT SHORTCUTS
// ----------------------------------------------------------------------------
function setupEventListeners(container, canvas) {
  // Keyboard Listeners
  window.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    if (key === "w" || key === "arrowup") keys.w = true;
    if (key === "a" || key === "arrowleft") keys.a = true;
    if (key === "s" || key === "arrowdown") keys.s = true;
    if (key === "d" || key === "arrowright") keys.d = true;
    if (e.shiftKey || key === "shift") keys.shift = true;
    if (e.code === "Space") {
      keys.space = true;
      e.preventDefault();
    }
    if (key === "e") {
      if (activeProximityObject && typeof activeProximityObject.onInteract === "function") {
        activeProximityObject.onInteract();
      }
    }
  });

  window.addEventListener("keyup", (e) => {
    const key = e.key.toLowerCase();
    if (key === "w" || key === "arrowup") keys.w = false;
    if (key === "a" || key === "arrowleft") keys.a = false;
    if (key === "s" || key === "arrowdown") keys.s = false;
    if (key === "d" || key === "arrowright") keys.d = false;
    if (!e.shiftKey && key === "shift") keys.shift = false;
    if (e.code === "Space") keys.space = false;
  });

  // Mouse Drag Camera Orbit
  canvas.addEventListener("mousedown", (e) => {
    isMouseDown = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener("mouseup", () => {
    isMouseDown = false;
  });

  window.addEventListener("mousemove", (e) => {
    if (!isMouseDown) return;

    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;

    cameraYaw -= deltaX * 0.0055;
    cameraPitch += deltaY * 0.004;

    // Clamp pitch between -15° and +65°
    cameraPitch = THREE.MathUtils.clamp(cameraPitch, -0.25, 1.15);

    previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  // Mouse Wheel Zoom
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    cameraDistance = THREE.MathUtils.clamp(cameraDistance + e.deltaY * 0.005, 3.2, 14.0);
  });

  // Window Resize
  window.addEventListener("resize", () => {
    if (!container || !renderer || !camera) return;
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || (window.innerHeight - 70);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  // Teleport Buttons
  const btnLab = document.getElementById("live3dTeleportLab");
  const btnNoc = document.getElementById("live3dTeleportNoc");
  const btnArena = document.getElementById("live3dTeleportArena");
  const btnTrain = document.getElementById("live3dTeleportTraining");

  if (btnLab) btnLab.onclick = () => teleportPlayer(-16, -12);
  if (btnNoc) btnNoc.onclick = () => teleportPlayer(16, -12);
  if (btnArena) btnArena.onclick = () => teleportPlayer(16, 14);
  if (btnTrain) btnTrain.onclick = () => teleportPlayer(-14, 14);

  // Find Opponent Button
  const findBtn = document.getElementById("live3dFindOpponentBtn");
  if (findBtn) findBtn.onclick = () => startMatchmaking();

  const cancelBtn = document.getElementById("live3dCancelMatchBtn");
  if (cancelBtn) cancelBtn.onclick = () => cancelMatchmaking();

  const interactPrompt = document.getElementById("live3dInteractPrompt");
  if (interactPrompt) {
    interactPrompt.onclick = () => {
      if (activeProximityObject && typeof activeProximityObject.onInteract === "function") {
        activeProximityObject.onInteract();
      }
    };
  }
}

function teleportPlayer(tx, tz) {
  if (!playerGroup) return;
  playerGroup.position.set(tx, 0, tz);
  playerVelocity.set(0, 0, 0);
  playCyberTone(520, 0.14, "sine", 0.2);
}

// ----------------------------------------------------------------------------
// RESUME / PAUSE ENGINE (When navigating tabs)
// ----------------------------------------------------------------------------
export function resume3DLiveWorld() {
  if (!isInitialized) return;
  isRunning = true;
  update3DLiveProfileHUD();

  const containerEl = document.getElementById("live3dContainer");
  if (renderer && containerEl) {
    const w = containerEl.clientWidth || window.innerWidth;
    const h = containerEl.clientHeight || (window.innerHeight - 70);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
}

export function pause3DLiveWorld() {
  isRunning = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

// ----------------------------------------------------------------------------
// SYNC LOCAL USER HUD WITH XELI LEVELING STATE
// ----------------------------------------------------------------------------
export function update3DLiveProfileHUD() {
  const state = appCallbacks.getState ? appCallbacks.getState() : { name: "Hunter", level: 1, rank: "E", totalExp: 0 };

  const nameEl = document.getElementById("live3dHunterName");
  const rankEl = document.getElementById("live3dHunterRank");
  const levelEl = document.getElementById("live3dHunterLevel");
  const expEl = document.getElementById("live3dHunterExp");
  const avatarEl = document.getElementById("live3dAvatarImg");

  if (nameEl) nameEl.textContent = state.name || "Hunter";
  if (rankEl) rankEl.textContent = `${state.rank || "E"}-RANK`;
  if (levelEl) levelEl.textContent = state.level || 1;
  if (expEl) expEl.textContent = (state.totalExp || 0).toLocaleString();

  if (avatarEl && state.avatarUrl) {
    avatarEl.src = state.avatarUrl;
  }
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
