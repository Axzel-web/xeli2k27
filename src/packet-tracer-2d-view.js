// ============================================================================
// 2D Cisco Packet Tracer Interactive Topology Workspace
// Authentic 2D Network Simulation Canvas with:
// - Drag-and-drop network devices: PC0, Switch0, Router (Chassis & CLI Hostname), Server0, Cloud/WAN
// - Interactive connection cables (Copper Straight-Through, Serial DTE)
// - Dynamic Cisco link lights (Green ▲ UP / Red ▼ DOWN) tied directly to Cisco CLI state
// - Packet Tracer device palette: Add PC, Add Switch, Add Router, Cable Connect tool
// - Interactive Simple PDU / ICMP Ping animation with traveling envelopes (✉️)
// - PC0 Desktop / IP Configuration dialog with interactive ping command prompt
// - Real-time synchronization with Cisco IOS CLI hostname and interface status
// ============================================================================

export class NetworkPacketTracer2DView {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.device = options.device || null;
    this.challenge = options.challenge || null;
    this.onFocusConsole = options.onFocusConsole || null;
    this.onPortClick = options.onPortClick || null;

    // Active tool: 'select' | 'cable' | 'delete'
    this.currentTool = "select";
    this.cableSourceNode = null;

    // Simulation & animation
    this.simRunning = true;
    this.animFrameId = null;
    this.packets = []; // in-flight envelope / ping packets
    this.pingBanner = null;

    // PC0 network settings
    this.pcConfig = {
      ip: "192.168.1.100",
      subnet: "255.255.255.0",
      gateway: "192.168.1.1",
      dns: "8.8.8.8",
      mac: "0002.16C3.9A01",
    };

    // Dragging & Interaction State
    this.draggedNode = null;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.hoveredNode = null;
    this.hoveredLink = null;
    this.selectedNode = null;
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1;

    // Topology Nodes (PC, Switch, Router, Server, Cloud)
    this.nodes = [];
    this.links = [];
    this.initDefaultTopology();

    // Build DOM layout inside container
    this.initDOM();
    this.resizeCanvas();
    this.bindEvents();
    this.startLoop();
  }

  initDefaultTopology() {
    const routerName = this.device ? this.device.hostname : "Router";

    this.nodes = [
      {
        id: "pc0",
        type: "pc",
        name: "PC0",
        model: "PC-PT Desktop",
        ip: this.pcConfig.ip,
        x: 80,
        y: 160,
        w: 64,
        h: 64,
        ports: [
          { name: "FastEthernet0", status: "up", mac: "0002.16C3.9A01" },
        ],
      },
      {
        id: "sw0",
        type: "switch",
        name: "Switch0",
        model: "Cisco 2960-24TT",
        ip: "Vlan1 (Unassigned)",
        x: 270,
        y: 160,
        w: 76,
        h: 46,
        ports: [
          { name: "FastEthernet0/1", status: "up" },
          { name: "GigabitEthernet0/1", status: "up" },
        ],
      },
      {
        id: "rt0",
        type: "router",
        name: routerName,
        model: "Cisco 2901 ISR",
        ip: this.getRouterIP(),
        x: 470,
        y: 160,
        w: 68,
        h: 68,
        ports: [
          { name: "GigabitEthernet0/1", status: this.getRouterPortStatus("GigabitEthernet0/1") },
          { name: "GigabitEthernet0/0", status: this.getRouterPortStatus("GigabitEthernet0/0") },
        ],
      },
      {
        id: "cloud0",
        type: "cloud",
        name: "WAN / Cloud",
        model: "Cloud-PT (ISP Edge)",
        ip: "203.0.113.1",
        x: 650,
        y: 160,
        w: 80,
        h: 54,
        ports: [
          { name: "Serial0/0/0", status: "up" },
        ],
      },
    ];

    this.links = [
      {
        id: "link-pc0-sw0",
        from: "pc0",
        fromPort: "FastEthernet0",
        to: "sw0",
        toPort: "FastEthernet0/1",
        cableType: "copper-straight",
        status: "up",
      },
      {
        id: "link-sw0-rt0",
        from: "sw0",
        fromPort: "GigabitEthernet0/1",
        to: "rt0",
        toPort: "GigabitEthernet0/1",
        cableType: "copper-straight",
        status: this.getRouterPortStatus("GigabitEthernet0/1"),
      },
      {
        id: "link-rt0-cloud0",
        from: "rt0",
        fromPort: "GigabitEthernet0/0",
        to: "cloud0",
        toPort: "Serial0/0/0",
        cableType: "serial-dte",
        status: this.getRouterPortStatus("GigabitEthernet0/0"),
      },
    ];
  }

  getRouterIP() {
    if (!this.device || !this.device.interfaces) return "192.168.1.1";
    const iface = this.device.interfaces["GigabitEthernet0/1"] || this.device.interfaces["GigabitEthernet0/0"];
    return iface && iface.ip ? iface.ip : "Unassigned";
  }

  getRouterPortStatus(portName) {
    if (!this.device || !this.device.interfaces) return "down";
    const iface = this.device.interfaces[portName];
    if (!iface) return "down";
    return iface.enabled && iface.ip ? "up" : (iface.enabled ? "up" : "down");
  }

  initDOM() {
    this.container.innerHTML = `
      <div class="pt2d-workspace" id="pt2dWorkspace">
        <!-- Top Toolbar -->
        <div class="pt2d-toolbar">
          <div class="pt2d-tool-group">
            <span class="pt2d-bar-brand">
              <span class="pt2d-logo-dot"></span>
              PACKET TRACER 2D
            </span>
            <span class="pt2d-status-pill" id="pt2dStatusPill">REALTIME MODE</span>
          </div>

          <!-- Tools -->
          <div class="pt2d-tool-group">
            <button class="pt2d-btn is-active" id="ptBtnSelect" type="button" title="Select & Drag Devices">
              🖱️ Drag
            </button>
            <button class="pt2d-btn" id="ptBtnAddPC" type="button" title="Add PC to canvas">
              ➕ PC
            </button>
            <button class="pt2d-btn" id="ptBtnAddSwitch" type="button" title="Add 2960 Switch to canvas">
              ➕ Switch
            </button>
            <button class="pt2d-btn" id="ptBtnAddRouter" type="button" title="Add Cisco Router to canvas">
              ➕ Router
            </button>
            <button class="pt2d-btn" id="ptBtnCable" type="button" title="Connect Cable (Click node 1 then node 2)">
              ⚡ Connect
            </button>
            <button class="pt2d-btn" id="ptBtnPing" type="button" title="Send Simple PDU / Ping Packet (PC0 -> Router)">
              ✉️ Send Ping
            </button>
          </div>

          <!-- View actions -->
          <div class="pt2d-tool-group">
            <button class="pt2d-btn" id="ptBtnPcDesktop" type="button" title="Open PC0 IP Configuration">
              💻 PC0 IP
            </button>
            <button class="pt2d-btn" id="ptBtnFocusCli" type="button" title="Focus Cisco Terminal Console">
              📟 Router CLI
            </button>
            <button class="pt2d-btn" id="ptBtnResetLayout" type="button" title="Reset layout positions">
              ↺ Reset
            </button>
          </div>
        </div>

        <!-- Canvas Area -->
        <div class="pt2d-canvas-wrap" id="pt2dCanvasWrap">
          <canvas class="pt2d-canvas" id="pt2dCanvas"></canvas>

          <!-- Floating Inspector HUD Tooltip -->
          <div class="pt2d-hud-tooltip" id="pt2dTooltip" style="display: none;"></div>

          <!-- In-canvas Packet Tracer Dialog / Terminal banner -->
          <div class="pt2d-dialog-banner" id="pt2dDialog" style="display: none;">
            <div class="pt2d-dialog-head">
              <span class="pt2d-dialog-title" id="pt2dDialogTitle">PC0 - IP Configuration & Terminal</span>
              <button class="pt2d-dialog-close" id="pt2dDialogClose" type="button">✕</button>
            </div>
            <div class="pt2d-dialog-body" id="pt2dDialogBody"></div>
          </div>
        </div>

        <!-- Bottom Status Bar -->
        <div class="pt2d-footer">
          <div class="pt2d-footer-info" id="pt2dFooterInfo">
            💡 <strong>Tip:</strong> Drag any device (PC, Switch, Router) around the workspace. Click Router to jump to Cisco CLI.
          </div>
          <div class="pt2d-legend">
            <span class="pt2d-legend-item"><span class="pt2d-led-dot pt2d-led-green"></span> Link UP</span>
            <span class="pt2d-legend-item"><span class="pt2d-led-dot pt2d-led-red"></span> Link DOWN</span>
            <span class="pt2d-legend-item">── Copper</span>
            <span class="pt2d-legend-item pt2d-legend-serial">╌╌ Serial</span>
          </div>
        </div>
      </div>
    `;

    this.canvas = document.getElementById("pt2dCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.canvasWrap = document.getElementById("pt2dCanvasWrap");
    this.tooltip = document.getElementById("pt2dTooltip");
    this.dialog = document.getElementById("pt2dDialog");
    this.dialogTitle = document.getElementById("pt2dDialogTitle");
    this.dialogBody = document.getElementById("pt2dDialogBody");
    this.footerInfo = document.getElementById("pt2dFooterInfo");

    // Tool buttons
    this.btnSelect = document.getElementById("ptBtnSelect");
    this.btnAddPC = document.getElementById("ptBtnAddPC");
    this.btnAddSwitch = document.getElementById("ptBtnAddSwitch");
    this.btnAddRouter = document.getElementById("ptBtnAddRouter");
    this.btnCable = document.getElementById("ptBtnCable");
    this.btnPing = document.getElementById("ptBtnPing");
    this.btnPcDesktop = document.getElementById("ptBtnPcDesktop");
    this.btnFocusCli = document.getElementById("ptBtnFocusCli");
    this.btnResetLayout = document.getElementById("ptBtnResetLayout");
    this.dialogClose = document.getElementById("pt2dDialogClose");
  }

  bindEvents() {
    window.addEventListener("resize", () => this.resizeCanvas());

    // Tool switching
    this.btnSelect.addEventListener("click", () => this.setTool("select"));
    this.btnAddPC.addEventListener("click", () => this.addDevice("pc"));
    this.btnAddSwitch.addEventListener("click", () => this.addDevice("switch"));
    this.btnAddRouter.addEventListener("click", () => this.addDevice("router"));
    this.btnCable.addEventListener("click", () => this.setTool("cable"));
    this.btnPing.addEventListener("click", () => this.triggerPingSimulation());
    this.btnPcDesktop.addEventListener("click", () => this.openPcDesktop());
    this.btnFocusCli.addEventListener("click", () => {
      if (this.onFocusConsole) this.onFocusConsole();
    });
    this.btnResetLayout.addEventListener("click", () => {
      this.initDefaultTopology();
      this.centerTopology();
    });
    this.dialogClose.addEventListener("click", () => {
      this.dialog.style.display = "none";
    });

    // Canvas Pointer Events (Mouse + Touch)
    this.canvas.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    this.canvas.addEventListener("pointermove", (e) => this.onPointerMove(e));
    this.canvas.addEventListener("pointerup", (e) => this.onPointerUp(e));
    this.canvas.addEventListener("pointerleave", () => this.onPointerLeave());

    // Wheel zoom
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      this.zoom = Math.max(0.6, Math.min(2.0, this.zoom * zoomFactor));
    }, { passive: false });
  }

  setTool(tool) {
    this.currentTool = tool;
    this.cableSourceNode = null;
    this.btnSelect.classList.toggle("is-active", tool === "select");
    this.btnCable.classList.toggle("is-active", tool === "cable");

    if (tool === "cable") {
      this.footerInfo.innerHTML = "⚡ <strong>Connect Cable:</strong> Click the first device, then click the target device.";
    } else {
      this.footerInfo.innerHTML = "💡 <strong>Tip:</strong> Drag any device around the canvas. Click Router to jump to CLI terminal.";
    }
  }

  resizeCanvas() {
    if (!this.canvasWrap || !this.canvas) return;
    const rect = this.canvasWrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.width = rect.width;
    this.height = rect.height;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Initial center if needed
    if (!this.initializedPosition && this.width > 0) {
      this.centerTopology();
      this.initializedPosition = true;
    }
  }

  centerTopology() {
    if (!this.width || !this.height) return;
    const targetW = 680;
    const startX = Math.max(40, (this.width - targetW) / 2);
    const startY = Math.max(60, (this.height - 240) / 2 + 30);

    const pc = this.nodes.find((n) => n.id === "pc0");
    const sw = this.nodes.find((n) => n.id === "sw0");
    const rt = this.nodes.find((n) => n.id === "rt0");
    const cloud = this.nodes.find((n) => n.id === "cloud0");

    if (pc) { pc.x = startX; pc.y = startY; }
    if (sw) { sw.x = startX + 190; sw.y = startY; }
    if (rt) { rt.x = startX + 380; rt.y = startY; }
    if (cloud) { cloud.x = startX + 560; cloud.y = startY; }
  }

  getPointerPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left),
      y: (e.clientY - rect.top),
    };
  }

  findNodeAt(x, y) {
    // Traverse backwards so top-most node is picked
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      const halfW = n.w / 2;
      const halfH = n.h / 2;
      if (
        x >= n.x - halfW - 8 &&
        x <= n.x + halfW + 8 &&
        y >= n.y - halfH - 8 &&
        y <= n.y + halfH + 8
      ) {
        return n;
      }
    }
    return null;
  }

  onPointerDown(e) {
    const pos = this.getPointerPos(e);
    const hitNode = this.findNodeAt(pos.x, pos.y);

    if (this.currentTool === "cable") {
      if (hitNode) {
        if (!this.cableSourceNode) {
          this.cableSourceNode = hitNode;
          this.footerInfo.innerHTML = `⚡ Connecting from <strong>${hitNode.name}</strong>. Now click the second device!`;
        } else if (this.cableSourceNode.id !== hitNode.id) {
          // Connect new link!
          const exists = this.links.some(
            (l) =>
              (l.from === this.cableSourceNode.id && l.to === hitNode.id) ||
              (l.from === hitNode.id && l.to === this.cableSourceNode.id)
          );
          if (!exists) {
            this.links.push({
              id: `link-${Date.now()}`,
              from: this.cableSourceNode.id,
              fromPort: "Fa0/X",
              to: hitNode.id,
              toPort: "Fa0/Y",
              cableType: "copper-straight",
              status: "up",
            });
            this.footerInfo.innerHTML = `✅ Connected <strong>${this.cableSourceNode.name}</strong> to <strong>${hitNode.name}</strong>!`;
          }
          this.setTool("select");
        }
      }
      return;
    }

    if (hitNode) {
      this.draggedNode = hitNode;
      this.selectedNode = hitNode;
      this.dragOffsetX = pos.x - hitNode.x;
      this.dragOffsetY = pos.y - hitNode.y;
      this.canvas.style.cursor = "grabbing";

      // If clicked router, highlight and prepare focus
      if (hitNode.type === "router" && this.onFocusConsole) {
        this.footerInfo.innerHTML = `📟 Selected <strong>${hitNode.name}</strong> (Cisco 2901 Router). Terminal active.`;
      } else if (hitNode.type === "pc") {
        this.footerInfo.innerHTML = `💻 Selected <strong>${hitNode.name}</strong>. Click 'PC0 IP' to configure desktop network settings.`;
      }
    } else {
      this.selectedNode = null;
      this.isPanning = true;
      this.panStartX = pos.x;
      this.panStartY = pos.y;
    }
  }

  onPointerMove(e) {
    const pos = this.getPointerPos(e);

    if (this.draggedNode) {
      // Constrain dragging inside canvas boundaries
      const pad = 36;
      this.draggedNode.x = Math.max(pad, Math.min(this.width - pad, pos.x - this.dragOffsetX));
      this.draggedNode.y = Math.max(pad, Math.min(this.height - pad, pos.y - this.dragOffsetY));
      this.canvas.style.cursor = "grabbing";
      this.tooltip.style.display = "none";
      return;
    }

    // Hover detection
    const hitNode = this.findNodeAt(pos.x, pos.y);
    this.hoveredNode = hitNode;

    if (hitNode) {
      this.canvas.style.cursor = "grab";
      this.showTooltip(hitNode, pos.x, pos.y);
    } else {
      this.canvas.style.cursor = this.currentTool === "cable" ? "crosshair" : "default";
      this.tooltip.style.display = "none";
    }
  }

  onPointerUp(e) {
    if (this.draggedNode) {
      // If was just a quick click without much drag, handle device click
      const pos = this.getPointerPos(e);
      const dist = Math.hypot(pos.x - (this.draggedNode.x + this.dragOffsetX), pos.y - (this.draggedNode.y + this.dragOffsetY));
      if (dist < 4) {
        this.handleNodeClick(this.draggedNode);
      }
      this.draggedNode = null;
      this.canvas.style.cursor = "grab";
    }
    this.isPanning = false;
  }

  onPointerLeave() {
    this.draggedNode = null;
    this.hoveredNode = null;
    this.isPanning = false;
    this.tooltip.style.display = "none";
  }

  handleNodeClick(node) {
    if (node.type === "pc") {
      this.openPcDesktop();
    } else if (node.type === "router" && this.onFocusConsole) {
      this.onFocusConsole();
    }
  }

  showTooltip(node, x, y) {
    let portHtml = "";
    if (node.ports && node.ports.length > 0) {
      portHtml = node.ports
        .map(
          (p) =>
            `<div class="pt2d-tt-port">
              <span class="pt2d-port-name">${p.name}</span>
              <span class="pt2d-badge ${p.status === "up" ? "pt2d-badge-ok" : "pt2d-badge-err"}">${p.status.toUpperCase()}</span>
            </div>`
        )
        .join("");
    }

    this.tooltip.innerHTML = `
      <div class="pt2d-tt-head">
        <span class="pt2d-tt-name">${node.name}</span>
        <span class="pt2d-tt-type">${node.model}</span>
      </div>
      <div class="pt2d-tt-body">
        <div><strong>IP Address:</strong> ${node.ip || "None"}</div>
        <div class="pt2d-tt-ports-title">Interfaces:</div>
        ${portHtml}
      </div>
    `;

    const wrapRect = this.canvasWrap.getBoundingClientRect();
    let left = x + 15;
    let top = y - 10;
    if (left + 220 > wrapRect.width) left = x - 230;
    if (top + 160 > wrapRect.height) top = wrapRect.height - 170;

    this.tooltip.style.left = `${Math.max(10, left)}px`;
    this.tooltip.style.top = `${Math.max(10, top)}px`;
    this.tooltip.style.display = "block";
  }

  addDevice(type) {
    const id = `${type}${this.nodes.length + 1}`;
    let name = "PC1";
    let model = "PC-PT Desktop";
    let w = 64;
    let h = 64;
    let ip = `192.168.1.${100 + this.nodes.length}`;

    if (type === "switch") {
      name = `Switch${this.nodes.filter((n) => n.type === "switch").length + 1}`;
      model = "Cisco 2960-24TT";
      w = 76;
      h = 46;
      ip = "Vlan1 (Unassigned)";
    } else if (type === "router") {
      name = `Router${this.nodes.filter((n) => n.type === "router").length + 1}`;
      model = "Cisco 2901 ISR";
      w = 68;
      h = 68;
      ip = `192.168.${this.nodes.length}.1`;
    }

    const newNode = {
      id,
      type,
      name,
      model,
      ip,
      x: 120 + Math.random() * 200,
      y: 80 + Math.random() * 120,
      w,
      h,
      ports: [{ name: "FastEthernet0", status: "up" }],
    };

    this.nodes.push(newNode);
    this.selectedNode = newNode;
    this.footerInfo.innerHTML = `➕ Added <strong>${name}</strong> to the canvas! You can drag it anywhere.`;
  }

  triggerPingSimulation() {
    const pc = this.nodes.find((n) => n.id === "pc0");
    const sw = this.nodes.find((n) => n.id === "sw0");
    const rt = this.nodes.find((n) => n.id === "rt0");

    if (!pc || !sw || !rt) return;

    // Check if router Gi0/1 interface is UP
    const rtPortStatus = this.getRouterPortStatus("GigabitEthernet0/1");
    const isUp = rtPortStatus === "up";

    this.footerInfo.innerHTML = `✉️ <strong>ICMP Echo Request:</strong> Transmitting packet from PC0 (${this.pcConfig.ip}) ➔ Router...`;

    // Path 1: PC0 -> Switch0
    this.packets.push({
      fromX: pc.x,
      fromY: pc.y,
      toX: sw.x,
      toY: sw.y,
      progress: 0,
      speed: 0.025,
      type: "icmp-req",
      onComplete: () => {
        // Path 2: Switch0 -> Router
        this.packets.push({
          fromX: sw.x,
          fromY: sw.y,
          toX: rt.x,
          toY: rt.y,
          progress: 0,
          speed: 0.025,
          type: "icmp-req",
          onComplete: () => {
            if (isUp) {
              // Path 3: Reply from Router -> Switch -> PC0
              this.packets.push({
                fromX: rt.x,
                fromY: rt.y,
                toX: sw.x,
                toY: sw.y,
                progress: 0,
                speed: 0.025,
                type: "icmp-reply",
                onComplete: () => {
                  this.packets.push({
                    fromX: sw.x,
                    fromY: sw.y,
                    toX: pc.x,
                    toY: pc.y,
                    progress: 0,
                    speed: 0.025,
                    type: "icmp-reply",
                    onComplete: () => {
                      this.showPingResult(true);
                    },
                  });
                },
              });
            } else {
              // Failed because router interface is shutdown
              this.showPingResult(false);
            }
          },
        });
      },
    });
  }

  showPingResult(success) {
    if (success) {
      this.footerInfo.innerHTML = `✅ <strong>Ping Successful!</strong> Received 4 replies from ${this.getRouterIP()} (RTT: 2ms, TTL: 255). Interface is UP.`;
    } else {
      this.footerInfo.innerHTML = `❌ <strong>Request Timed Out!</strong> Router Gi0/1 interface is administratively down. Run <code>no shutdown</code> in CLI.`;
    }
  }

  openPcDesktop() {
    this.dialogTitle.textContent = "PC0 Desktop - IP Configuration";
    this.dialogBody.innerHTML = `
      <div class="pt2d-pc-form">
        <div class="pt2d-pc-tabs">
          <button class="pt2d-pc-tab is-active" id="ptTabIp">IP Configuration</button>
          <button class="pt2d-pc-tab" id="ptTabPrompt">Command Prompt</button>
        </div>

        <div id="ptPcIpPane">
          <div class="pt2d-form-row">
            <label>IP Configuration Mode:</label>
            <div class="pt2d-radio-group">
              <label><input type="radio" name="ipmode" value="static" checked> Static</label>
              <label><input type="radio" name="ipmode" value="dhcp"> DHCP</label>
            </div>
          </div>
          <div class="pt2d-form-row">
            <label>IPv4 Address:</label>
            <input type="text" class="pt2d-input" id="ptInputIp" value="${this.pcConfig.ip}">
          </div>
          <div class="pt2d-form-row">
            <label>Subnet Mask:</label>
            <input type="text" class="pt2d-input" id="ptInputSubnet" value="${this.pcConfig.subnet}">
          </div>
          <div class="pt2d-form-row">
            <label>Default Gateway:</label>
            <input type="text" class="pt2d-input" id="ptInputGateway" value="${this.pcConfig.gateway}">
          </div>
          <div class="pt2d-form-row">
            <label>DNS Server:</label>
            <input type="text" class="pt2d-input" id="ptInputDns" value="${this.pcConfig.dns}">
          </div>
          <div class="pt2d-form-actions">
            <button class="btn btn-primary" id="ptSavePcBtn">Apply Settings</button>
          </div>
        </div>

        <div id="ptPcPromptPane" style="display: none;">
          <div class="pt2d-cmd-terminal">
            <pre id="ptCmdOut">Cisco Packet Tracer PC Command Prompt 1.0\nType "ping 192.168.1.1" or "ipconfig" to test.</pre>
            <div class="pt2d-cmd-line">
              <span>C:\\&gt;</span>
              <input type="text" class="pt2d-cmd-input" id="ptCmdInput" placeholder="ping 192.168.1.1">
            </div>
          </div>
        </div>
      </div>
    `;

    this.dialog.style.display = "block";

    // Sub tabs
    const tabIp = document.getElementById("ptTabIp");
    const tabPrompt = document.getElementById("ptTabPrompt");
    const paneIp = document.getElementById("ptPcIpPane");
    const panePrompt = document.getElementById("ptPcPromptPane");

    tabIp.addEventListener("click", () => {
      tabIp.classList.add("is-active");
      tabPrompt.classList.remove("is-active");
      paneIp.style.display = "block";
      panePrompt.style.display = "none";
    });

    tabPrompt.addEventListener("click", () => {
      tabPrompt.classList.add("is-active");
      tabIp.classList.remove("is-active");
      panePrompt.style.display = "block";
      paneIp.style.display = "none";
    });

    // Save PC
    document.getElementById("ptSavePcBtn").addEventListener("click", () => {
      this.pcConfig.ip = document.getElementById("ptInputIp").value.trim() || this.pcConfig.ip;
      this.pcConfig.subnet = document.getElementById("ptInputSubnet").value.trim() || this.pcConfig.subnet;
      this.pcConfig.gateway = document.getElementById("ptInputGateway").value.trim() || this.pcConfig.gateway;
      this.pcConfig.dns = document.getElementById("ptInputDns").value.trim() || this.pcConfig.dns;

      const pc = this.nodes.find((n) => n.id === "pc0");
      if (pc) pc.ip = this.pcConfig.ip;

      this.footerInfo.innerHTML = `✅ Saved PC0 IP settings: <strong>${this.pcConfig.ip}</strong>. Gateway: <strong>${this.pcConfig.gateway}</strong>`;
      this.dialog.style.display = "none";
    });

    // Command Prompt Ping
    const cmdInput = document.getElementById("ptCmdInput");
    const cmdOut = document.getElementById("ptCmdOut");
    cmdInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const val = cmdInput.value.trim();
        cmdInput.value = "";
        if (!val) return;

        cmdOut.textContent += `\nC:\\> ${val}\n`;
        if (val.startsWith("ping")) {
          const isUp = this.getRouterPortStatus("GigabitEthernet0/1") === "up";
          if (isUp) {
            cmdOut.textContent += `Pinging ${this.getRouterIP()} with 32 bytes of data:\nReply from ${this.getRouterIP()}: bytes=32 time=2ms TTL=255\nReply from ${this.getRouterIP()}: bytes=32 time=1ms TTL=255\nReply from ${this.getRouterIP()}: bytes=32 time=2ms TTL=255\nReply from ${this.getRouterIP()}: bytes=32 time=1ms TTL=255\nPing statistics: Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)`;
            this.triggerPingSimulation();
          } else {
            cmdOut.textContent += `Pinging ${this.getRouterIP()} with 32 bytes of data:\nRequest timed out.\nRequest timed out.\nRequest timed out.\nRequest timed out.\nPing statistics: Packets: Sent = 4, Received = 0, Lost = 4 (100% loss)`;
          }
        } else if (val === "ipconfig") {
          cmdOut.textContent += `FastEthernet0 Connection:\n   IPv4 Address. . . . . : ${this.pcConfig.ip}\n   Subnet Mask . . . . . : ${this.pcConfig.subnet}\n   Default Gateway . . . : ${this.pcConfig.gateway}`;
        } else {
          cmdOut.textContent += `Bad command or filename: "${val}"`;
        }
      }
    });
  }

  updateDevice(device) {
    this.device = device;
    const rt = this.nodes.find((n) => n.id === "rt0");
    if (rt) {
      rt.name = device.hostname || "Router";
      rt.ip = this.getRouterIP();
      if (rt.ports) {
        rt.ports[0].status = this.getRouterPortStatus("GigabitEthernet0/1");
        rt.ports[1].status = this.getRouterPortStatus("GigabitEthernet0/0");
      }
    }

    // Sync links
    const swRtLink = this.links.find((l) => l.id === "link-sw0-rt0");
    if (swRtLink) {
      swRtLink.status = this.getRouterPortStatus("GigabitEthernet0/1");
    }
  }

  startLoop() {
    const render = () => {
      this.draw();
      this.animFrameId = requestAnimationFrame(render);
    };
    this.animFrameId = requestAnimationFrame(render);
  }

  destroy() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  // ============================================================================
  // Canvas Rendering (Grid, Cables, Link Lights, Device Icons, Envelopes)
  // ============================================================================
  draw() {
    if (!this.ctx || !this.width || !this.height) return;
    const ctx = this.ctx;

    // 1. Clear background & draw Packet Tracer subtle grid
    ctx.fillStyle = "#f4f6f9";
    ctx.fillRect(0, 0, this.width, this.height);

    this.drawGrid(ctx);

    // 2. Draw Cables connecting devices
    this.drawCables(ctx);

    // 3. Draw Traveling Data Envelopes / Packets
    this.drawPackets(ctx);

    // 4. Draw Device Nodes
    for (const node of this.nodes) {
      this.drawNode(ctx, node);
    }
  }

  drawGrid(ctx) {
    ctx.save();
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;

    const step = 24;
    for (let x = 0; x < this.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    for (let y = 0; y < this.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawCables(ctx) {
    for (const link of this.links) {
      const fromNode = this.nodes.find((n) => n.id === link.from);
      const toNode = this.nodes.find((n) => n.id === link.to);
      if (!fromNode || !toNode) continue;

      ctx.save();

      const isSerial = link.cableType === "serial-dte";
      ctx.strokeStyle = isSerial ? "#d32f2f" : "#2b303a";
      ctx.lineWidth = isSerial ? 2.5 : 2.8;

      if (isSerial) {
        ctx.setLineDash([6, 4]);
      } else {
        ctx.setLineDash([]);
      }

      // Draw cable line
      ctx.beginPath();
      ctx.moveTo(fromNode.x, fromNode.y);
      ctx.lineTo(toNode.x, toNode.y);
      ctx.stroke();

      ctx.restore();

      // Draw Cisco Interface Link Lights (Green ▲ / Red ▼ triangles)
      this.drawLinkTriangles(ctx, fromNode, toNode, link);
    }
  }

  drawLinkTriangles(ctx, fromNode, toNode, link) {
    const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
    const dist = Math.hypot(toNode.x - fromNode.x, toNode.y - fromNode.y);
    if (dist < 40) return;

    // Offsets from device centers
    const offsetFrom = 42;
    const offsetTo = 42;

    const x1 = fromNode.x + Math.cos(angle) * offsetFrom;
    const y1 = fromNode.y + Math.sin(angle) * offsetFrom;

    const x2 = toNode.x - Math.cos(angle) * offsetTo;
    const y2 = toNode.y - Math.sin(angle) * offsetTo;

    // Both ends have Cisco status indicator triangles
    const isUpFrom = link.status === "up";
    const isUpTo = link.status === "up";

    this.drawTriangle(ctx, x1, y1, angle, isUpFrom);
    this.drawTriangle(ctx, x2, y2, angle + Math.PI, isUpTo);

    // Port labels
    ctx.save();
    ctx.font = "bold 9px Consolas, monospace";
    ctx.fillStyle = "#4a5568";
    ctx.textAlign = "center";
    ctx.fillText(link.fromPort || "", x1, y1 - 8);
    ctx.fillText(link.toPort || "", x2, y2 - 8);
    ctx.restore();
  }

  drawTriangle(ctx, x, y, angle, isUp) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.fillStyle = isUp ? "#00c853" : "#d50000";
    ctx.strokeStyle = "#1b263b";
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  drawPackets(ctx) {
    for (let i = this.packets.length - 1; i >= 0; i--) {
      const p = this.packets[i];
      p.progress += p.speed;

      const curX = p.fromX + (p.toX - p.fromX) * p.progress;
      const curY = p.fromY + (p.toY - p.fromY) * p.progress;

      // Draw Cisco Packet Tracer Envelope (✉️)
      ctx.save();
      ctx.translate(curX, curY);

      // Envelope shadow
      ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
      ctx.shadowBlur = 6;

      // Envelope body
      const envW = 20;
      const envH = 14;
      ctx.fillStyle = p.type === "icmp-reply" ? "#4caf50" : "#ff9800";
      ctx.strokeStyle = "#1b263b";
      ctx.lineWidth = 1.2;

      ctx.fillRect(-envW / 2, -envH / 2, envW, envH);
      ctx.strokeRect(-envW / 2, -envH / 2, envW, envH);

      // Envelope flap lines
      ctx.beginPath();
      ctx.moveTo(-envW / 2, -envH / 2);
      ctx.lineTo(0, 2);
      ctx.lineTo(envW / 2, -envH / 2);
      ctx.stroke();

      ctx.restore();

      if (p.progress >= 1) {
        if (p.onComplete) p.onComplete();
        this.packets.splice(i, 1);
      }
    }
  }

  drawNode(ctx, node) {
    ctx.save();
    ctx.translate(node.x, node.y);

    const isSelected = this.selectedNode && this.selectedNode.id === node.id;
    const isHovered = this.hoveredNode && this.hoveredNode.id === node.id;

    // Selection bounding box with dashed outline
    if (isSelected || isHovered) {
      ctx.strokeStyle = isSelected ? "#0288d1" : "rgba(2, 136, 209, 0.45)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      const pad = 8;
      ctx.strokeRect(-node.w / 2 - pad, -node.h / 2 - pad, node.w + pad * 2, node.h + pad * 2);
      ctx.setLineDash([]);
    }

    // Render device icon by type
    if (node.type === "pc") {
      this.drawPcIcon(ctx, node);
    } else if (node.type === "switch") {
      this.drawSwitchIcon(ctx, node);
    } else if (node.type === "router") {
      this.drawRouterIcon(ctx, node);
    } else if (node.type === "cloud") {
      this.drawCloudIcon(ctx, node);
    }

    // Node Name Label
    ctx.font = "bold 11px Tahoma, sans-serif";
    ctx.fillStyle = "#1e293b";
    ctx.textAlign = "center";
    ctx.fillText(node.name, 0, node.h / 2 + 14);

    // Node Subtitle / IP Label
    if (node.ip) {
      ctx.font = "9.5px Consolas, monospace";
      ctx.fillStyle = "#64748b";
      ctx.fillText(node.ip, 0, node.h / 2 + 26);
    }

    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // Cisco Device Icons Rendering
  // --------------------------------------------------------------------------
  drawPcIcon(ctx) {
    // Monitor
    ctx.fillStyle = "#cfd8dc";
    ctx.strokeStyle = "#37474f";
    ctx.lineWidth = 1.5;

    // Monitor frame
    ctx.fillRect(-22, -26, 44, 30);
    ctx.strokeRect(-22, -26, 44, 30);

    // Screen
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(-18, -22, 36, 22);

    // Terminal prompt inside screen
    ctx.fillStyle = "#00e676";
    ctx.font = "bold 6px monospace";
    ctx.textAlign = "left";
    ctx.fillText("C:\\>_", -15, -10);

    // Stand & base
    ctx.fillStyle = "#90a4ae";
    ctx.fillRect(-4, 4, 8, 7);
    ctx.strokeRect(-4, 4, 8, 7);
    ctx.fillRect(-12, 10, 24, 3);
    ctx.strokeRect(-12, 10, 24, 3);

    // Computer Tower
    ctx.fillStyle = "#b0bec5";
    ctx.fillRect(16, -18, 12, 32);
    ctx.strokeRect(16, -18, 12, 32);

    // Power button & CD slot
    ctx.fillStyle = "#00e676";
    ctx.fillRect(20, -12, 4, 2);
    ctx.fillStyle = "#37474f";
    ctx.fillRect(18, -4, 8, 2);
  }

  drawSwitchIcon(ctx) {
    // Cisco 2960 Switch 2D Chassis
    ctx.fillStyle = "#1976d2";
    ctx.strokeStyle = "#0d47a1";
    ctx.lineWidth = 1.5;

    // Chassis rectangle
    ctx.fillRect(-36, -16, 72, 32);
    ctx.strokeRect(-36, -16, 72, 32);

    // Front plate
    ctx.fillStyle = "#1565c0";
    ctx.fillRect(-34, -14, 68, 28);

    // 4 Opposing Arrows (Cisco Switch Emblem)
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;

    // Left arrow
    ctx.beginPath();
    ctx.moveTo(-18, -4);
    ctx.lineTo(-8, -4);
    ctx.lineTo(-12, -8);
    ctx.stroke();

    // Right arrow
    ctx.beginPath();
    ctx.moveTo(18, 4);
    ctx.lineTo(8, 4);
    ctx.lineTo(12, 8);
    ctx.stroke();

    // Port LED lights row
    ctx.fillStyle = "#00e676";
    for (let i = -28; i <= 28; i += 7) {
      ctx.fillRect(i, 8, 3, 2);
    }
  }

  drawRouterIcon(ctx) {
    // Classic Cisco Router 2D Circle Icon
    const radius = 28;

    // Outer circle
    ctx.fillStyle = "#0288d1";
    ctx.strokeStyle = "#01579b";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner bevel ring
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, radius - 3, 0, Math.PI * 2);
    ctx.stroke();

    // 4 Inward/Outward Cisco Router Arrows
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    // Top-left arrow pointing inward
    ctx.beginPath();
    ctx.moveTo(-16, -16);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-10, -5);
    ctx.stroke();

    // Bottom-right arrow pointing outward
    ctx.beginPath();
    ctx.moveTo(5, 5);
    ctx.lineTo(16, 16);
    ctx.lineTo(11, 16);
    ctx.stroke();

    // Top-right arrow pointing outward
    ctx.beginPath();
    ctx.moveTo(5, -5);
    ctx.lineTo(16, -16);
    ctx.lineTo(11, -16);
    ctx.stroke();

    // Bottom-left arrow pointing inward
    ctx.beginPath();
    ctx.moveTo(-16, 16);
    ctx.lineTo(-5, 5);
    ctx.lineTo(-10, 5);
    ctx.stroke();
  }

  drawCloudIcon(ctx) {
    // Cloud WAN Icon
    ctx.fillStyle = "#e0f2fe";
    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = 1.8;

    ctx.beginPath();
    ctx.arc(-18, 0, 16, 0, Math.PI * 2);
    ctx.arc(0, -10, 20, 0, Math.PI * 2);
    ctx.arc(18, 0, 16, 0, Math.PI * 2);
    ctx.arc(0, 8, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cloud text
    ctx.fillStyle = "#0369a1";
    ctx.font = "bold 9px Tahoma, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("WAN", 0, 3);
  }
}
