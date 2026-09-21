// ============================================================================
// Cisco IOS CLI Simulator Engine for XELI Leveling System
// Provides an in-browser simulated terminal for CCNA-style router & switch labs
// ============================================================================

/**
 * Normalizes interface names like "gi0/0", "g0/0", "gigabitethernet0/0"
 */
export function normalizeInterfaceName(input) {
  if (!input) return null;
  const raw = input.trim().toLowerCase();
  if (/^(g|gi|gig|gigabitethernet)0\/0$/.test(raw)) return "GigabitEthernet0/0";
  if (/^(g|gi|gig|gigabitethernet)0\/1$/.test(raw)) return "GigabitEthernet0/1";
  if (/^(s|se|ser|serial)0\/0\/0$/.test(raw)) return "Serial0/0/0";
  if (/^(fa|fastethernet)0\/1$/.test(raw)) return "FastEthernet0/1";
  if (/^(fa|fastethernet)0\/2$/.test(raw)) return "FastEthernet0/2";
  if (/^(vlan)1$/.test(raw)) return "Vlan1";
  return input.trim();
}

/**
 * Creates a clean default simulated Cisco device
 */
export function createDefaultDevice(options = {}) {
  const isSwitch = options.deviceType === "switch";
  const defaultHostname = isSwitch ? "Switch" : "Router";

  return {
    deviceType: isSwitch ? "switch" : "router",
    hostname: options.hostname || defaultHostname,
    mode: "user_exec", // user_exec, priv_exec, global_config, if_config, line_config
    currentInterface: null,
    currentLine: null,
    enableSecret: null,
    enablePassword: null,
    bannerMotd: null,
    startupConfigSaved: false,
    verifiedShowRun: false,
    verifiedShowIpIntBrief: false,
    pingsSent: [],
    lines: {
      "console 0": { password: null, login: false },
      "vty 0 4": { password: null, login: false },
    },
    interfaces: isSwitch
      ? {
          "FastEthernet0/1": { name: "FastEthernet0/1", ip: null, mask: null, adminUp: true, lineProtocol: "up", description: null },
          "FastEthernet0/2": { name: "FastEthernet0/2", ip: null, mask: null, adminUp: true, lineProtocol: "up", description: null },
          "Vlan1": { name: "Vlan1", ip: null, mask: null, adminUp: false, lineProtocol: "down", description: null },
        }
      : {
          "GigabitEthernet0/0": { name: "GigabitEthernet0/0", ip: null, mask: null, adminUp: false, lineProtocol: "down", description: null },
          "GigabitEthernet0/1": { name: "GigabitEthernet0/1", ip: null, mask: null, adminUp: false, lineProtocol: "down", description: null },
          "Serial0/0/0": { name: "Serial0/0/0", ip: null, mask: null, adminUp: false, lineProtocol: "down", description: null },
        },
  };
}

/**
 * Returns prompt string based on current mode and hostname
 */
export function getPrompt(device) {
  const h = device.hostname || "Router";
  switch (device.mode) {
    case "user_exec":
      return `${h}>`;
    case "priv_exec":
      return `${h}#`;
    case "global_config":
      return `${h}(config)#`;
    case "if_config":
      return `${h}(config-if)#`;
    case "line_config":
      return `${h}(config-line)#`;
    default:
      return `${h}>`;
  }
}

/**
 * Validates IPv4 address string (e.g. 192.168.1.1)
 */
function isValidIpv4(ip) {
  if (!ip) return false;
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    if (!/^\d+$/.test(p)) return false;
    const n = parseInt(p, 10);
    return n >= 0 && n <= 255;
  });
}

/**
 * Validates IPv4 subnet mask (e.g. 255.255.255.0)
 */
function isValidSubnetMask(mask) {
  if (!isValidIpv4(mask)) return false;
  const validOctets = [0, 128, 192, 224, 240, 248, 252, 254, 255];
  const parts = mask.split(".").map(Number);
  return parts.every((p) => validOctets.includes(p));
}

/**
 * Generates Cisco IOS running-config text based on state
 */
export function generateRunningConfig(device) {
  const isRouter = device.deviceType !== "switch";
  const lines = [
    "Building configuration...",
    "",
    "Current configuration : 1180 bytes",
    "!",
    "version 15.4",
    "no service timestamps log datetime msec",
    "no service timestamps debug datetime msec",
    "no service password-encryption",
    "!",
    `hostname ${device.hostname}`,
    "!",
  ];

  if (device.enableSecret) {
    lines.push(`enable secret 5 $1$mERr$hx5rVt7rPNoS4wqbXKX7m0 (set to "${device.enableSecret}")`);
  } else if (device.enablePassword) {
    lines.push(`enable password ${device.enablePassword}`);
  }

  lines.push("!");

  // Interfaces
  Object.values(device.interfaces).forEach((iface) => {
    lines.push(`interface ${iface.name}`);
    if (iface.description) {
      lines.push(` description ${iface.description}`);
    }
    if (iface.ip && iface.mask) {
      lines.push(` ip address ${iface.ip} ${iface.mask}`);
    } else {
      lines.push(` no ip address`);
    }
    if (!iface.adminUp) {
      lines.push(` shutdown`);
    } else {
      lines.push(` no shutdown`);
    }
    lines.push(" duplex auto");
    lines.push(" speed auto");
    lines.push("!");
  });

  // Banner
  if (device.bannerMotd) {
    lines.push(`banner motd #`);
    lines.push(device.bannerMotd);
    lines.push(`#`);
    lines.push("!");
  }

  // Lines
  const con = device.lines["console 0"];
  lines.push("line con 0");
  if (con.password) lines.push(` password ${con.password}`);
  if (con.login) lines.push(" login");
  lines.push("!");

  const vty = device.lines["vty 0 4"];
  lines.push("line vty 0 4");
  if (vty.password) lines.push(` password ${vty.password}`);
  if (vty.login) lines.push(" login");
  lines.push(" transport input all");
  lines.push("!");
  lines.push("end");

  return lines.join("\n");
}

/**
 * Generates Cisco IOS "show ip interface brief" table
 */
export function generateIpIntBrief(device) {
  const header = "Interface              IP-Address      OK? Method Status                Protocol";
  const rows = Object.values(device.interfaces).map((iface) => {
    const padName = iface.name.padEnd(23, " ");
    const ipStr = (iface.ip || "unassigned").padEnd(16, " ");
    const okStr = "YES".padEnd(4, " ");
    const methodStr = (iface.ip ? "manual" : "unset").padEnd(7, " ");
    const statusStr = (iface.adminUp ? "up" : "administratively down").padEnd(22, " ");
    const protoStr = iface.lineProtocol || "down";
    return `${padName}${ipStr}${okStr}${methodStr}${statusStr}${protoStr}`;
  });
  return [header, ...rows].join("\n");
}

/**
 * Returns contextual help list for current mode or given prefix
 */
export function getContextualHelp(device, currentInput = "") {
  const trimmed = currentInput.trim().toLowerCase();
  const mode = device.mode;

  if (!trimmed || trimmed === "?") {
    switch (mode) {
      case "user_exec":
        return [
          { cmd: "enable", desc: "Turn on privileged commands" },
          { cmd: "ping", desc: "Send echo messages" },
          { cmd: "show", desc: "Show running system information" },
          { cmd: "exit", desc: "Exit from the EXEC" },
        ];
      case "priv_exec":
        return [
          { cmd: "configure", desc: "Enter configuration mode" },
          { cmd: "copy", desc: "Copy from one file to another" },
          { cmd: "disable", desc: "Turn off privileged commands" },
          { cmd: "exit", desc: "Exit from the EXEC" },
          { cmd: "ping", desc: "Send echo messages" },
          { cmd: "reload", desc: "Halt and perform a cold restart" },
          { cmd: "show", desc: "Show running system information" },
          { cmd: "write", desc: "Write running configuration to memory" },
        ];
      case "global_config":
        return [
          { cmd: "banner", desc: "Define a login banner" },
          { cmd: "do", desc: "To run privileged EXEC commands" },
          { cmd: "enable", desc: "Modify enable password parameters" },
          { cmd: "end", desc: "Exit to privileged EXEC mode" },
          { cmd: "exit", desc: "Exit from configure mode" },
          { cmd: "hostname", desc: "Set system's network name" },
          { cmd: "interface", desc: "Select an interface to configure" },
          { cmd: "line", desc: "Configure a terminal line" },
          { cmd: "no", desc: "Negate a command or set its defaults" },
        ];
      case "if_config":
        return [
          { cmd: "description", desc: "Interface specific description" },
          { cmd: "do", desc: "To run privileged EXEC commands" },
          { cmd: "end", desc: "Exit to privileged EXEC mode" },
          { cmd: "exit", desc: "Exit from configure mode" },
          { cmd: "ip", desc: "Interface Internet Protocol config commands" },
          { cmd: "no", desc: "Negate a command (e.g. no shutdown)" },
          { cmd: "shutdown", desc: "Shutdown the selected interface" },
        ];
      case "line_config":
        return [
          { cmd: "do", desc: "To run privileged EXEC commands" },
          { cmd: "end", desc: "Exit to privileged EXEC mode" },
          { cmd: "exit", desc: "Exit from configure mode" },
          { cmd: "login", desc: "Enable password checking" },
          { cmd: "password", desc: "Assign a password to line" },
        ];
    }
  }

  // If typing "show ?"
  if (trimmed.startsWith("show")) {
    return [
      { cmd: "ip interface brief", desc: "IP interface status and configuration" },
      { cmd: "running-config", desc: "Current operating configuration" },
      { cmd: "startup-config", desc: "Contents of startup configuration" },
      { cmd: "version", desc: "System hardware and software status" },
    ];
  }

  // If typing "copy ?"
  if (trimmed.startsWith("copy")) {
    return [
      { cmd: "running-config startup-config", desc: "Copy running config to startup memory" },
    ];
  }

  // If typing "interface ?" or "int ?"
  if (trimmed.startsWith("interface") || trimmed.startsWith("int")) {
    return Object.keys(device.interfaces).map((k) => ({
      cmd: k,
      desc: `${k} interface`,
    }));
  }

  return [];
}

/**
 * Autocompletes user input using Cisco IOS keyword table
 */
export function getTabCompletion(device, input) {
  const trimmed = input.trimEnd();
  const tokens = trimmed.split(/\s+/);
  const mode = device.mode;

  const validTopCommands = {
    user_exec: ["enable", "ping", "show", "exit"],
    priv_exec: ["configure terminal", "copy running-config startup-config", "disable", "exit", "ping", "reload", "show ip interface brief", "show running-config", "show startup-config", "write memory"],
    global_config: ["banner motd", "do", "enable secret", "enable password", "end", "exit", "hostname", "interface", "line console 0", "line vty 0 4", "no"],
    if_config: ["description", "do", "end", "exit", "ip address", "no shutdown", "no ip address", "shutdown"],
    line_config: ["do", "end", "exit", "login", "password"],
  };

  const pool = validTopCommands[mode] || [];
  const matches = pool.filter((c) => c.toLowerCase().startsWith(trimmed.toLowerCase()));

  if (matches.length === 1) {
    return matches[0];
  }

  // Single word completion
  if (tokens.length === 1) {
    const singleWords = Array.from(new Set(pool.map((c) => c.split(" ")[0])));
    const wordMatches = singleWords.filter((w) => w.toLowerCase().startsWith(tokens[0].toLowerCase()));
    if (wordMatches.length === 1) {
      return wordMatches[0] + " ";
    }
  }

  // Two words completion (e.g. "conf t" -> "configure terminal")
  if (tokens.length === 2) {
    const t0 = tokens[0].toLowerCase();
    const t1 = tokens[1].toLowerCase();
    if (t0.startsWith("conf") && "terminal".startsWith(t1)) return "configure terminal";
    if (t0.startsWith("sh") && "running-config".startsWith(t1)) return "show running-config";
    if (t0.startsWith("sh") && "startup-config".startsWith(t1)) return "show startup-config";
    if (t0.startsWith("en") && "secret".startsWith(t1)) return "enable secret ";
    if (t0.startsWith("no") && "shutdown".startsWith(t1)) return "no shutdown";
    if (t0.startsWith("ip") && "address".startsWith(t1)) return "ip address ";
  }

  return input;
}

/**
 * Main command interpreter for Cisco IOS simulator
 * Returns: { output: string, device: Object, feedbackType?: 'info'|'success'|'error'|'reboot' }
 */
export function executeCiscoCommand(device, rawLine) {
  const line = (rawLine || "").trim();
  const dev = { ...device };

  // Empty command: press enter gives empty newline
  if (!line) {
    return { output: "", device: dev };
  }

  // History tracking
  dev.commandHistory = dev.commandHistory || [];
  dev.commandHistory.push(line);

  // Handle help "?"
  if (line === "?" || line.endsWith("?")) {
    const helpItems = getContextualHelp(dev, line.replace(/\?$/, ""));
    if (helpItems.length === 0) {
      return { output: "% No help available for this context.", device: dev };
    }
    const formatted = helpItems
      .map((h) => `  ${h.cmd.padEnd(25, " ")} ${h.desc}`)
      .join("\n");
    return { output: formatted, device: dev };
  }

  const tokens = line.split(/\s+/);
  const cmd0 = tokens[0].toLowerCase();
  const cmd1 = (tokens[1] || "").toLowerCase();
  const cmd2 = (tokens[2] || "").toLowerCase();

  // =========================================================================
  // UNIVERSAL COMMANDS ACROSS MODES
  // =========================================================================

  // "do <cmd>": Execute privileged EXEC commands from any config sub-mode
  if (cmd0 === "do" && (dev.mode === "global_config" || dev.mode === "if_config" || dev.mode === "line_config")) {
    const subLine = tokens.slice(1).join(" ");
    const tempDev = { ...dev, mode: "priv_exec" };
    const res = executeCiscoCommand(tempDev, subLine);
    // Persist verified flags and changes back to dev
    dev.verifiedShowRun = dev.verifiedShowRun || res.device.verifiedShowRun;
    dev.verifiedShowIpIntBrief = dev.verifiedShowIpIntBrief || res.device.verifiedShowIpIntBrief;
    dev.startupConfigSaved = dev.startupConfigSaved || res.device.startupConfigSaved;
    return { output: res.output, device: dev };
  }

  // "end" or Ctrl+Z equivalent: jumps straight back to Privileged EXEC (#)
  if (cmd0 === "end") {
    if (dev.mode === "global_config" || dev.mode === "if_config" || dev.mode === "line_config") {
      dev.mode = "priv_exec";
      dev.currentInterface = null;
      dev.currentLine = null;
      return {
        output: "%SYS-5-CONFIG_I: Configured from console by console",
        device: dev,
      };
    }
    return { output: "% Invalid input detected at '^' marker.", device: dev };
  }

  // =========================================================================
  // USER EXEC MODE (Router>)
  // =========================================================================
  if (dev.mode === "user_exec") {
    if (cmd0 === "enable" || cmd0 === "en") {
      dev.mode = "priv_exec";
      return { output: "", device: dev };
    }

    if (cmd0 === "show" || cmd0 === "sh") {
      if (cmd1 === "ip" && (cmd2 === "interface" || cmd2 === "int") && (tokens[3] || "").toLowerCase().startsWith("br")) {
        dev.verifiedShowIpIntBrief = true;
        return { output: generateIpIntBrief(dev), device: dev };
      }
      if (cmd1 === "version" || cmd1 === "ver") {
        return {
          output: `Cisco IOS Software, C2900 Software (C2900-UNIVERSALK9-M), Version 15.4(3)M2\nTechnical Support: http://www.cisco.com/techsupport\n${dev.hostname} uptime is 18 minutes`,
          device: dev,
        };
      }
      return { output: '% Type "enable" for privileged commands.', device: dev };
    }

    if (cmd0 === "ping") {
      if (!tokens[1]) return { output: "% Incomplete command.", device: dev };
      const target = tokens[1];
      const reachable = isValidIpv4(target);
      dev.pingsSent.push({ target, success: reachable });
      return {
        output: `Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to ${target}, timeout is 2 seconds:\n${
          reachable ? "!!!!!\nSuccess rate is 100 percent (5/5), round-trip min/avg/max = 1/2/4 ms" : ".....\nSuccess rate is 0 percent (0/5)"
        }`,
        device: dev,
      };
    }

    if (cmd0 === "exit" || cmd0 === "quit") {
      return { output: `[Connection to ${dev.hostname} closed]`, device: dev };
    }

    return { output: `% Invalid input detected at '^' marker.\n  ${line}\n  ^`, device: dev };
  }

  // =========================================================================
  // PRIVILEGED EXEC MODE (Router#)
  // =========================================================================
  if (dev.mode === "priv_exec") {
    // "configure terminal" / "conf t"
    if ((cmd0 === "configure" || cmd0 === "conf" || cmd0 === "config") && (cmd1 === "terminal" || cmd1 === "t")) {
      dev.mode = "global_config";
      return {
        output: "Enter configuration commands, one per line.  End with CNTL/Z.",
        device: dev,
      };
    }

    // "disable"
    if (cmd0 === "disable" || cmd0 === "dis") {
      dev.mode = "user_exec";
      return { output: "", device: dev };
    }

    // "show running-config" / "show run" / "sh run"
    if ((cmd0 === "show" || cmd0 === "sh") && (cmd1 === "running-config" || cmd1 === "run")) {
      dev.verifiedShowRun = true;
      return { output: generateRunningConfig(dev), device: dev };
    }

    // "show startup-config" / "show start" / "sh start"
    if ((cmd0 === "show" || cmd0 === "sh") && (cmd1 === "startup-config" || cmd1 === "start")) {
      if (!dev.startupConfigSaved) {
        return { output: "%% Non-volatile configuration memory invalid or not present", device: dev };
      }
      return { output: generateRunningConfig(dev), device: dev };
    }

    // "show ip interface brief" / "sh ip int br"
    if ((cmd0 === "show" || cmd0 === "sh") && cmd1 === "ip" && (cmd2 === "interface" || cmd2 === "int") && (tokens[3] || "").toLowerCase().startsWith("br")) {
      dev.verifiedShowIpIntBrief = true;
      return { output: generateIpIntBrief(dev), device: dev };
    }

    // "show version"
    if ((cmd0 === "show" || cmd0 === "sh") && (cmd1 === "version" || cmd1 === "ver")) {
      return {
        output: `Cisco IOS Software, C2900 Software (C2900-UNIVERSALK9-M), Version 15.4(3)M2\nROM: System Bootstrap, Version 15.1(4)M4\n${dev.hostname} uptime is 42 minutes\nSystem image file is "flash0:c2900-universalk9-mz.SPA.154-3.M2.bin"`,
        device: dev,
      };
    }

    // "copy running-config startup-config" / "copy run start" / "write memory" / "wr"
    if (
      ((cmd0 === "copy" || cmd0 === "cp") && (cmd1 === "running-config" || cmd1 === "run") && (cmd2 === "startup-config" || cmd2 === "start")) ||
      (cmd0 === "write" && (cmd1 === "memory" || !cmd1)) ||
      cmd0 === "wr"
    ) {
      dev.startupConfigSaved = true;
      return {
        output: "Destination filename [startup-config]? \nBuilding configuration...\n[OK]",
        device: dev,
      };
    }

    // "reload"
    if (cmd0 === "reload") {
      dev.mode = "user_exec";
      return {
        output: `Proceed with reload? [confirm]\n\nSystem Bootstrap, Version 15.1(4)M4, RELEASE SOFTWARE\nCisco 2901 (revision 1.0) with 491520K bytes of memory.\nProcessor board ID FHK16120F4P\n2 Gigabit Ethernet interfaces\n\nPress RETURN to get started!`,
        device: dev,
        feedbackType: "reboot",
      };
    }

    // "ping <ip>"
    if (cmd0 === "ping") {
      if (!tokens[1]) return { output: "% Incomplete command.", device: dev };
      const target = tokens[1];
      const valid = isValidIpv4(target);
      dev.pingsSent.push({ target, success: valid });
      return {
        output: `Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to ${target}, timeout is 2 seconds:\n${
          valid ? "!!!!!\nSuccess rate is 100 percent (5/5), round-trip min/avg/max = 1/2/4 ms" : ".....\nSuccess rate is 0 percent (0/5)"
        }`,
        device: dev,
      };
    }

    // "exit"
    if (cmd0 === "exit" || cmd0 === "quit") {
      dev.mode = "user_exec";
      return { output: "", device: dev };
    }

    return { output: `% Invalid input detected at '^' marker.\n  ${line}\n  ^`, device: dev };
  }

  // =========================================================================
  // GLOBAL CONFIG MODE (Router(config)#)
  // =========================================================================
  if (dev.mode === "global_config") {
    // "hostname <name>" / "host <name>"
    if (cmd0 === "hostname" || cmd0 === "host") {
      if (!tokens[1]) return { output: "% Incomplete command.", device: dev };
      dev.hostname = tokens[1].trim();
      return { output: "", device: dev };
    }

    // "banner motd <delim><text><delim>" or "banner motd #<text>#"
    if (cmd0 === "banner" && cmd1 === "motd") {
      const rest = line.substring(line.toLowerCase().indexOf("motd") + 4).trim();
      if (!rest) {
        return { output: "% Incomplete command. Example: banner motd #Authorized Access Only#", device: dev };
      }
      const delim = rest[0];
      const lastDelim = rest.lastIndexOf(delim);
      let bannerContent = "";
      if (lastDelim > 0) {
        bannerContent = rest.substring(1, lastDelim).trim();
      } else {
        bannerContent = rest.replace(/^[#@$%&*]/, "").replace(/[#@$%&*]$/, "").trim();
      }
      dev.bannerMotd = bannerContent || "Authorized Access Only";
      return { output: "", device: dev };
    }

    // "enable secret <password>" / "enable sec <pass>"
    if (cmd0 === "enable" && (cmd1 === "secret" || cmd1 === "sec")) {
      if (!tokens[2]) return { output: "% Incomplete command.", device: dev };
      dev.enableSecret = tokens.slice(2).join(" ").trim();
      return { output: "", device: dev };
    }

    // "enable password <password>"
    if (cmd0 === "enable" && (cmd1 === "password" || cmd1 === "pass")) {
      if (!tokens[2]) return { output: "% Incomplete command.", device: dev };
      dev.enablePassword = tokens.slice(2).join(" ").trim();
      return { output: "", device: dev };
    }

    // "interface <name>" / "int <name>"
    if (cmd0 === "interface" || cmd0 === "int") {
      if (!tokens[1]) return { output: "% Incomplete command.", device: dev };
      const ifName = normalizeInterfaceName(tokens[1]);
      if (!dev.interfaces[ifName]) {
        // Auto-create interface if valid format
        dev.interfaces[ifName] = {
          name: ifName,
          ip: null,
          mask: null,
          adminUp: false,
          lineProtocol: "down",
          description: null,
        };
      }
      dev.currentInterface = ifName;
      dev.mode = "if_config";
      return { output: "", device: dev };
    }

    // "line console 0" / "line con 0"
    if (cmd0 === "line" && (cmd1 === "console" || cmd1 === "con") && tokens[2] === "0") {
      dev.currentLine = "console 0";
      dev.mode = "line_config";
      return { output: "", device: dev };
    }

    // "line vty 0 4" / "line vty 0 15"
    if (cmd0 === "line" && cmd1 === "vty") {
      dev.currentLine = "vty 0 4";
      dev.mode = "line_config";
      return { output: "", device: dev };
    }

    // "exit"
    if (cmd0 === "exit") {
      dev.mode = "priv_exec";
      return {
        output: "%SYS-5-CONFIG_I: Configured from console by console",
        device: dev,
      };
    }

    return { output: `% Invalid input detected at '^' marker.\n  ${line}\n  ^`, device: dev };
  }

  // =========================================================================
  // INTERFACE CONFIG MODE (Router(config-if)#)
  // =========================================================================
  if (dev.mode === "if_config") {
    const ifName = dev.currentInterface;
    const iface = dev.interfaces[ifName] || {
      name: ifName,
      ip: null,
      mask: null,
      adminUp: false,
      lineProtocol: "down",
      description: null,
    };

    // "ip address <ip> <mask>" / "ip add <ip> <mask>"
    if (cmd0 === "ip" && (cmd1 === "address" || cmd1 === "add")) {
      const ip = tokens[2];
      const mask = tokens[3];
      if (!ip || !mask) {
        return { output: "% Incomplete command. Syntax: ip address <IP> <SUBNET_MASK>", device: dev };
      }
      if (!isValidIpv4(ip) || !isValidSubnetMask(mask)) {
        return { output: "% Bad IP address or subnet mask.", device: dev };
      }
      iface.ip = ip;
      iface.mask = mask;
      if (iface.adminUp) {
        iface.lineProtocol = "up";
      }
      dev.interfaces[ifName] = iface;
      return { output: "", device: dev };
    }

    // "no ip address" / "no ip add"
    if (cmd0 === "no" && cmd1 === "ip" && (cmd2 === "address" || cmd2 === "add")) {
      iface.ip = null;
      iface.mask = null;
      iface.lineProtocol = "down";
      dev.interfaces[ifName] = iface;
      return { output: "", device: dev };
    }

    // "no shutdown" / "no shut"
    if (cmd0 === "no" && (cmd1 === "shutdown" || cmd1 === "shut")) {
      iface.adminUp = true;
      iface.lineProtocol = iface.ip ? "up" : "down";
      dev.interfaces[ifName] = iface;
      return {
        output: `%LINK-3-UPDOWN: Interface ${ifName}, changed state to up\n%LINEPROTO-5-UPDOWN: Line protocol on Interface ${ifName}, changed state to ${iface.lineProtocol}`,
        device: dev,
      };
    }

    // "shutdown" / "shut"
    if (cmd0 === "shutdown" || cmd0 === "shut") {
      iface.adminUp = false;
      iface.lineProtocol = "down";
      dev.interfaces[ifName] = iface;
      return {
        output: `%LINK-5-CHANGED: Interface ${ifName}, changed state to administratively down\n%LINEPROTO-5-UPDOWN: Line protocol on Interface ${ifName}, changed state to down`,
        device: dev,
      };
    }

    // "description <text>" / "desc <text>"
    if (cmd0 === "description" || cmd0 === "desc") {
      if (!tokens[1]) return { output: "% Incomplete command.", device: dev };
      iface.description = tokens.slice(1).join(" ").trim();
      dev.interfaces[ifName] = iface;
      return { output: "", device: dev };
    }

    // "no description"
    if (cmd0 === "no" && (cmd1 === "description" || cmd1 === "desc")) {
      iface.description = null;
      dev.interfaces[ifName] = iface;
      return { output: "", device: dev };
    }

    // "exit" -> drops back to global_config
    if (cmd0 === "exit") {
      dev.mode = "global_config";
      dev.currentInterface = null;
      return { output: "", device: dev };
    }

    return { output: `% Invalid input detected at '^' marker.\n  ${line}\n  ^`, device: dev };
  }

  // =========================================================================
  // LINE CONFIG MODE (Router(config-line)#)
  // =========================================================================
  if (dev.mode === "line_config") {
    const lineKey = dev.currentLine || "console 0";
    const lineObj = dev.lines[lineKey] || { password: null, login: false };

    // "password <pass>" / "pass <pass>"
    if (cmd0 === "password" || cmd0 === "pass") {
      if (!tokens[1]) return { output: "% Incomplete command.", device: dev };
      lineObj.password = tokens.slice(1).join(" ").trim();
      dev.lines[lineKey] = lineObj;
      return { output: "", device: dev };
    }

    // "login"
    if (cmd0 === "login") {
      lineObj.login = true;
      dev.lines[lineKey] = lineObj;
      return { output: "", device: dev };
    }

    // "no login"
    if (cmd0 === "no" && cmd1 === "login") {
      lineObj.login = false;
      dev.lines[lineKey] = lineObj;
      return { output: "", device: dev };
    }

    // "exit" -> drops back to global_config
    if (cmd0 === "exit") {
      dev.mode = "global_config";
      dev.currentLine = null;
      return { output: "", device: dev };
    }

    return { output: `% Invalid input detected at '^' marker.\n  ${line}\n  ^`, device: dev };
  }

  return { output: `% Unrecognized mode or command: ${line}`, device: dev };
}
