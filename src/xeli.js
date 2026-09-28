import {
  supabase,
  checkSupabaseConnection,
  getCurrentSupabaseUser,
  signUpSupabase,
  signInSupabase,
  signOutSupabase,
  signInWithGoogle,
  getSupabaseSession,
  onSupabaseAuthStateChange,
  saveProgressToSupabase,
  loadProgressFromSupabase,
  fetchLeaderboardProfiles,
  fetchGlobalLeaderboard,
  getRankTitle,
  subscribeToLeaderboardChanges,
  uploadProfileAvatar,
  updateHunterProfile,
  fetchHunterProfileById,
  crudUpdateHunterProfile,
  crudDeleteHunterProfile,
} from "./supabase.js";
import { renderCliLabChallenge } from "./cli-lab-ui.js";
import { renderBinaryLabChallenge } from "./binary-lab-ui.js";
import { renderPythonLabChallenge } from "./python-lab-ui.js";

/* ============================================================
   XELI — Challenge Lab data
   type: "code"  -> runs in Pyodide against hidden test cases
   type: "input" -> free-text answer, graded by exact/normalized match
   type: "mcq"   -> multiple choice
   type: "lab"   -> real hands-on exercise (e.g. Packet Tracer, terminal).
                    Self-checked via checklist + short reflection, then
                    the user claims the EXP once every item is done.
   ============================================================ */
 
const CHALLENGES = [
 
  // ------------------------- NETWORKING -------------------------
  // Interactive Cisco IOS CLI Labs
  {
    id: "net-cli-r1-core-setup",
    cat: "networking",
    title: "Router Identity & Security Baseline",
    difficulty: "Easy",
    exp: 150,
    type: "cli-lab",
    deviceType: "router",
    initialHostname: "Router",
    intro: "Connect to the Router console (tty0). Elevate to Privileged EXEC (enable) and Global Configuration mode (configure terminal) to set the hostname to R1, establish a message-of-the-day security banner, configure an encrypted enable secret, and verify your changes with show running-config.",
    goals: [
      {
        id: "hostname",
        text: "Set device hostname to R1",
        hint: "Router(config)# hostname R1",
        check: (device) => (device.hostname || "").trim().toUpperCase() === "R1",
      },
      {
        id: "banner",
        text: "Configure a message-of-the-day (MOTD) banner",
        hint: "R1(config)# banner motd #Authorized Access Only#",
        check: (device) => Boolean(device.bannerMotd && device.bannerMotd.trim().length > 0),
      },
      {
        id: "secret",
        text: "Configure an encrypted enable secret password",
        hint: "R1(config)# enable secret class123",
        check: (device) => Boolean(device.enableSecret && device.enableSecret.trim().length > 0),
      },
      {
        id: "verify",
        text: "Verify configuration with show running-config",
        hint: "R1# show running-config (or R1(config)# do show run)",
        check: (device) => Boolean(device.verifiedShowRun),
      },
    ],
  },
  {
    id: "net-cli-ip-interface-activation",
    cat: "networking",
    title: "Interface Addressing & Status Verification",
    difficulty: "Easy",
    exp: 160,
    type: "cli-lab",
    deviceType: "router",
    initialHostname: "Router",
    intro: "Bring up GigabitEthernet0/0 on your router. Assign a valid IPv4 address and subnet mask, set an interface description, and activate the interface with no shutdown so it transitions to up / up.",
    goals: [
      {
        id: "ip_assigned",
        text: "Assign IP 192.168.1.1 255.255.255.0 to GigabitEthernet0/0",
        hint: "Router(config-if)# ip address 192.168.1.1 255.255.255.0",
        check: (device) => {
          const gi0 = device.interfaces["GigabitEthernet0/0"];
          return Boolean(gi0 && gi0.ip === "192.168.1.1" && gi0.mask === "255.255.255.0");
        },
      },
      {
        id: "description",
        text: "Add an interface description (e.g. Link to LAN)",
        hint: "Router(config-if)# description Link to LAN Core Switch",
        check: (device) => {
          const gi0 = device.interfaces["GigabitEthernet0/0"];
          return Boolean(gi0 && gi0.description && gi0.description.trim().length > 0);
        },
      },
      {
        id: "no_shutdown",
        text: "Enable the interface with no shutdown (Status: Up / Up)",
        hint: "Router(config-if)# no shutdown",
        check: (device) => {
          const gi0 = device.interfaces["GigabitEthernet0/0"];
          return Boolean(gi0 && gi0.adminUp && gi0.lineProtocol === "up");
        },
      },
      {
        id: "verify_brief",
        text: "Verify interface status with show ip interface brief",
        hint: "Router# show ip interface brief (or do sh ip int br)",
        check: (device) => Boolean(device.verifiedShowIpIntBrief),
      },
    ],
  },
  {
    id: "net-cli-lines-and-persistence",
    cat: "networking",
    title: "Console/VTY Security & Persistence",
    difficulty: "Medium",
    exp: 175,
    type: "cli-lab",
    deviceType: "router",
    initialHostname: "Router",
    intro: "Harden administrative access by setting passwords and requiring login on both the console port and virtual terminal (VTY) lines. Finally, persist your changes into NVRAM using copy running-config startup-config.",
    goals: [
      {
        id: "console_security",
        text: "Set password on line console 0 and enable login",
        hint: "Router(config)# line console 0 -> password cisco -> login",
        check: (device) => {
          const con = device.lines["console 0"];
          return Boolean(con && con.password && con.login);
        },
      },
      {
        id: "vty_security",
        text: "Set password on line vty 0 4 and enable login",
        hint: "Router(config)# line vty 0 4 -> password cisco -> login",
        check: (device) => {
          const vty = device.lines["vty 0 4"];
          return Boolean(vty && vty.password && vty.login);
        },
      },
      {
        id: "save_startup",
        text: "Save configuration with copy running-config startup-config",
        hint: "Router# copy running-config startup-config (or write memory)",
        check: (device) => Boolean(device.startupConfigSaved),
      },
    ],
  },
  {
    id: "net-cli-modes-exploration",
    cat: "networking",
    title: "Router CLI Navigation & Help",
    difficulty: "Easy",
    exp: 120,
    type: "cli-lab",
    deviceType: "router",
    initialHostname: "Router",
    intro: "Explore Cisco IOS navigation hierarchy. Move between User EXEC, Privileged EXEC, and Global Configuration modes. Explore contextual help (?) and command history.",
    goals: [
      {
        id: "priv_exec",
        text: "Elevate to Privileged EXEC mode using enable",
        hint: "Router> enable",
        check: (dev) => dev.mode === "priv_exec" || (dev.commandHistory || []).some((c) => c.toLowerCase().trim() === "enable"),
      },
      {
        id: "global_config",
        text: "Enter Global Configuration mode (configure terminal)",
        hint: "Router# configure terminal (or conf t)",
        check: (dev) => dev.mode === "global_config" || (dev.commandHistory || []).some((c) => c.toLowerCase().startsWith("conf")),
      },
      {
        id: "interface_config",
        text: "Navigate into interface configuration mode",
        hint: "Router(config)# interface GigabitEthernet0/0",
        check: (dev) => dev.mode === "if_config" || (dev.commandHistory || []).some((c) => c.toLowerCase().startsWith("int")),
      },
      {
        id: "return_exec",
        text: "Return to Privileged EXEC using end or exit",
        hint: "Router(config-if)# end (or exit)",
        check: (dev) => (dev.commandHistory || []).some((c) => c.toLowerCase().trim() === "end" || c.toLowerCase().trim() === "exit"),
      },
      {
        id: "show_history",
        text: "Inspect recent command history with show history",
        hint: "Router# show history",
        check: (dev) => (dev.commandHistory || []).some((c) => c.toLowerCase().includes("hist")),
      },
    ],
  },
  {
    id: "net-hostname-banner-passwords",
    cat: "networking",
    title: "Switch Identity, Banner & Passwords",
    difficulty: "Easy",
    exp: 140,
    type: "cli-lab",
    deviceType: "switch",
    initialHostname: "Switch",
    intro: "Configure device identity and multi-tier authentication passwords on the Cisco Catalyst switch. Set hostname to SW1, configure an MOTD security banner, an enable secret password, and secure the console and VTY lines.",
    goals: [
      {
        id: "hostname",
        text: "Set switch hostname to SW1",
        hint: "Switch(config)# hostname SW1",
        check: (dev) => (dev.hostname || "").trim().toUpperCase() === "SW1",
      },
      {
        id: "banner",
        text: "Create a login MOTD security banner",
        hint: "SW1(config)# banner motd #Authorized Access Only#",
        check: (dev) => Boolean(dev.bannerMotd && dev.bannerMotd.trim().length > 0),
      },
      {
        id: "secret",
        text: "Configure an enable secret password",
        hint: "SW1(config)# enable secret cisco123",
        check: (dev) => Boolean(dev.enableSecret && dev.enableSecret.trim().length > 0),
      },
      {
        id: "console_pass",
        text: "Configure console line password and enable login",
        hint: "SW1(config)# line console 0 -> password ciscocon -> login",
        check: (dev) => {
          const con = dev.lines && dev.lines["console 0"];
          return Boolean(con && con.password && con.login);
        },
      },
      {
        id: "vty_pass",
        text: "Configure VTY lines 0 4 password and enable login",
        hint: "SW1(config)# line vty 0 4 -> password ciscovty -> login",
        check: (dev) => {
          const vty = dev.lines && dev.lines["vty 0 4"];
          return Boolean(vty && vty.password && vty.login);
        },
      },
    ],
  },
  {
    id: "net-ip-interface-description",
    cat: "networking",
    title: "Interface Addressing & Descriptions",
    difficulty: "Easy",
    exp: 130,
    type: "cli-lab",
    deviceType: "router",
    initialHostname: "R1",
    intro: "Configure and document router interfaces. Assign IP addresses, attach descriptive interface labels, and bring links up with no shutdown.",
    goals: [
      {
        id: "gi0_ip",
        text: "Assign IP 10.0.0.1 255.255.255.0 to GigabitEthernet0/0",
        hint: "R1(config-if)# ip address 10.0.0.1 255.255.255.0",
        check: (dev) => {
          const gi0 = dev.interfaces && dev.interfaces["GigabitEthernet0/0"];
          return Boolean(gi0 && gi0.ip === "10.0.0.1" && gi0.mask === "255.255.255.0");
        },
      },
      {
        id: "gi0_desc",
        text: "Add description 'Link to HQ Core Switch' on GigabitEthernet0/0",
        hint: "R1(config-if)# description Link to HQ Core Switch",
        check: (dev) => {
          const gi0 = dev.interfaces && dev.interfaces["GigabitEthernet0/0"];
          return Boolean(gi0 && gi0.description && gi0.description.trim().length > 0);
        },
      },
      {
        id: "gi0_up",
        text: "Bring GigabitEthernet0/0 up with no shutdown",
        hint: "R1(config-if)# no shutdown",
        check: (dev) => {
          const gi0 = dev.interfaces && dev.interfaces["GigabitEthernet0/0"];
          return Boolean(gi0 && gi0.adminUp);
        },
      },
      {
        id: "gi1_ip",
        text: "Assign IP 192.168.10.1 255.255.255.0 to GigabitEthernet0/1 and enable it",
        hint: "R1(config)# int gi0/1 -> ip address 192.168.10.1 255.255.255.0 -> no shut",
        check: (dev) => {
          const gi1 = dev.interfaces && dev.interfaces["GigabitEthernet0/1"];
          return Boolean(gi1 && gi1.ip === "192.168.10.1" && gi1.adminUp);
        },
      },
      {
        id: "verify_brief",
        text: "Verify both interfaces with show ip interface brief",
        hint: "R1# show ip interface brief",
        check: (dev) => Boolean(dev.verifiedShowIpIntBrief),
      },
    ],
  },
  {
    id: "net-save-manage-config",
    cat: "networking",
    title: "Saving & Managing Configuration",
    difficulty: "Medium",
    exp: 150,
    type: "cli-lab",
    deviceType: "router",
    initialHostname: "Router",
    intro: "Learn the distinction between RAM (running-config) and NVRAM (startup-config). Configure device identity, verify running configuration, save to NVRAM, and test configuration persistence with reload.",
    goals: [
      {
        id: "hostname",
        text: "Set hostname to R1-CORE",
        hint: "Router(config)# hostname R1-CORE",
        check: (dev) => (dev.hostname || "").trim().toUpperCase() === "R1-CORE",
      },
      {
        id: "banner",
        text: "Configure a security banner motd",
        hint: "R1-CORE(config)# banner motd #Core Router Authorized Only#",
        check: (dev) => Boolean(dev.bannerMotd && dev.bannerMotd.trim().length > 0),
      },
      {
        id: "inspect_run",
        text: "Inspect running configuration (show running-config)",
        hint: "R1-CORE# show running-config",
        check: (dev) => Boolean(dev.verifiedShowRun),
      },
      {
        id: "save_nvram",
        text: "Save running config to startup config (copy run start)",
        hint: "R1-CORE# copy running-config startup-config",
        check: (dev) => Boolean(dev.startupConfigSaved),
      },
      {
        id: "reload_dev",
        text: "Perform a system reload to verify saved persistence",
        hint: "R1-CORE# reload",
        check: (dev) => (dev.commandHistory || []).some((c) => c.toLowerCase().trim() === "reload"),
      },
    ],
  },
  {
    id: "net-ping-traceroute",
    cat: "networking",
    title: "Ping & Traceroute Diagnostics",
    difficulty: "Medium",
    exp: 150,
    type: "cli-lab",
    deviceType: "router",
    initialHostname: "R1",
    intro: "Configure routing reachability and perform Layer 3 network diagnostics. Bring up Gi0/0 with IP 10.1.1.1/24, configure a static route for remote network 192.168.2.0/24 via next-hop 10.1.1.2, verify the route table, and execute ping and traceroute tests.",
    goals: [
      {
        id: "interface_setup",
        text: "Configure GigabitEthernet0/0 with 10.1.1.1 255.255.255.0 and no shutdown",
        hint: "R1(config-if)# ip address 10.1.1.1 255.255.255.0 -> no shut",
        check: (dev) => {
          const gi0 = dev.interfaces && dev.interfaces["GigabitEthernet0/0"];
          return Boolean(gi0 && gi0.ip === "10.1.1.1" && gi0.adminUp);
        },
      },
      {
        id: "static_route",
        text: "Add static route: ip route 192.168.2.0 255.255.255.0 10.1.1.2",
        hint: "R1(config)# ip route 192.168.2.0 255.255.255.0 10.1.1.2",
        check: (dev) => (dev.staticRoutes || []).some((r) => r.network === "192.168.2.0" && r.nextHop === "10.1.1.2"),
      },
      {
        id: "verify_route",
        text: "Inspect routing table with show ip route",
        hint: "R1# show ip route",
        check: (dev) => Boolean(dev.verifiedShowIpRoute),
      },
      {
        id: "test_ping",
        text: "Ping the neighboring router at 10.1.1.2",
        hint: "R1# ping 10.1.1.2",
        check: (dev) => (dev.pingsSent || []).some((p) => p.target === "10.1.1.2"),
      },
      {
        id: "test_traceroute",
        text: "Run traceroute to destination host 192.168.2.50",
        hint: "R1# traceroute 192.168.2.50",
        check: (dev) => (dev.tracertsSent || []).some((t) => t.target === "192.168.2.50"),
      },
    ],
  },
  {
    id: "net-ssh-access",
    cat: "networking",
    title: "SSH Remote Access Hardening",
    difficulty: "Medium",
    exp: 160,
    type: "cli-lab",
    deviceType: "router",
    initialHostname: "R1",
    intro: "Harden remote management on R1 using Secure Shell (SSHv2). Configure domain-name xeli.lab, generate RSA cryptographic keys, create local admin user, enforce SSH on VTY lines with login local, and verify with show ip ssh.",
    goals: [
      {
        id: "domain_name",
        text: "Configure domain name to xeli.lab (ip domain-name xeli.lab)",
        hint: "R1(config)# ip domain-name xeli.lab",
        check: (dev) => Boolean(dev.domainName && dev.domainName.toLowerCase() === "xeli.lab"),
      },
      {
        id: "crypto_keys",
        text: "Generate RSA crypto key pair (crypto key generate rsa)",
        hint: "R1(config)# crypto key generate rsa",
        check: (dev) => Boolean(dev.cryptoKeyGenerated),
      },
      {
        id: "user_account",
        text: "Create local admin user: username admin secret cisco123",
        hint: "R1(config)# username admin secret cisco123",
        check: (dev) => Boolean(dev.users && dev.users["admin"]),
      },
      {
        id: "vty_ssh",
        text: "Configure line vty 0 4 with 'login local' and 'transport input ssh'",
        hint: "R1(config-line)# login local -> transport input ssh",
        check: (dev) => {
          const vty = dev.lines && dev.lines["vty 0 4"];
          return Boolean(vty && vty.loginLocal && (vty.transportInput || "").toLowerCase().includes("ssh"));
        },
      },
      {
        id: "verify_ssh",
        text: "Verify SSH service status with show ip ssh",
        hint: "R1# show ip ssh",
        check: (dev) => (dev.commandHistory || []).some((c) => c.toLowerCase().includes("show ip ssh") || c.toLowerCase().includes("sh ip ssh")),
      },
    ],
  },
  {
    id: "net-full-topology-build",
    cat: "networking",
    title: "Full Edge Router Topology Provisioning",
    difficulty: "Hard",
    exp: 220,
    type: "cli-lab",
    deviceType: "router",
    initialHostname: "Router",
    intro: "Synthesize all core networking disciplines: identity, security, dual-homed WAN/LAN interfaces, default static routing, and configuration persistence to provision the enterprise edge router.",
    goals: [
      {
        id: "hostname_banner",
        text: "Set hostname to R1-EDGE and configure MOTD banner",
        hint: "Router(config)# hostname R1-EDGE -> banner motd #Enterprise Gateway#",
        check: (dev) => (dev.hostname || "").trim().toUpperCase() === "R1-EDGE" && Boolean(dev.bannerMotd),
      },
      {
        id: "passwords",
        text: "Configure enable secret and console password with login",
        hint: "R1-EDGE(config)# enable secret class123 -> line con 0 -> password cisco -> login",
        check: (dev) => Boolean(dev.enableSecret && dev.lines && dev.lines["console 0"]?.password && dev.lines["console 0"]?.login),
      },
      {
        id: "wan_interface",
        text: "Configure WAN Gi0/0 with 10.0.0.1 255.255.255.252 and no shutdown",
        hint: "R1-EDGE(config-if)# ip address 10.0.0.1 255.255.255.252 -> no shut",
        check: (dev) => {
          const gi0 = dev.interfaces && dev.interfaces["GigabitEthernet0/0"];
          return Boolean(gi0 && gi0.ip === "10.0.0.1" && gi0.mask === "255.255.255.252" && gi0.adminUp);
        },
      },
      {
        id: "lan_interface",
        text: "Configure LAN Gi0/1 with 192.168.1.1 255.255.255.0 and no shutdown",
        hint: "R1-EDGE(config-if)# ip address 192.168.1.1 255.255.255.0 -> no shut",
        check: (dev) => {
          const gi1 = dev.interfaces && dev.interfaces["GigabitEthernet0/1"];
          return Boolean(gi1 && gi1.ip === "192.168.1.1" && gi1.mask === "255.255.255.0" && gi1.adminUp);
        },
      },
      {
        id: "default_route",
        text: "Configure default route: ip route 0.0.0.0 0.0.0.0 10.0.0.2",
        hint: "R1-EDGE(config)# ip route 0.0.0.0 0.0.0.0 10.0.0.2",
        check: (dev) => (dev.staticRoutes || []).some((r) => r.network === "0.0.0.0" && r.nextHop === "10.0.0.2"),
      },
      {
        id: "save_config",
        text: "Save complete configuration with copy running-config startup-config",
        hint: "R1-EDGE# copy running-config startup-config",
        check: (dev) => Boolean(dev.startupConfigSaved),
      },
    ],
  },
  {
    id: "net-binary-subnetting",
    cat: "networking",
    title: "Binary Math & IPv4 Subnetting Lab",
    difficulty: "Medium",
    exp: 150,
    type: "binary-lab",
    intro: "Hands-on interactive binary octet bit converter, CIDR subnet mask explorer, and live subnetting calculation challenges with instant validation.",
  },

  // ------------------------- CODING · PYTHON -------------------------
  {
    id: "py-level-1-output-comments",
    cat: "coding",
    title: "Level 1: Output & Comments",
    difficulty: "Easy",
    exp: 120,
    type: "python-lab",
    intro: "Learn how to output text to the screen with print() and write developer notes with comments. Complete the 'About Me' profile trial.",
    levelNumber: 1,
    concepts: [
      {
        name: "print( )",
        desc: "output text to the screen",
        code: 'print("hello world")',
      },
      {
        name: "comments",
        desc: "it just notes for humans",
        code: "#this is level 1",
      },
    ],
    goals: [
      {
        id: "comment",
        text: "Add at least one human comment (# ...)",
        hint: "Start a line or note with '#' e.g. '# this is level 1'",
      },
      {
        id: "three_prints",
        text: "Three separate print() statements",
        hint: "Call print() three individual times in your script",
      },
      {
        id: "about_me",
        text: "About Me — three separate print() statements (name, age, favorite food)",
        hint: 'e.g. print("AXZEL") / print(21) / print("Pizza")',
      },
    ],
    starter: `# Level 1: Output & Comments
# Task: Add a comment explaining your code, and output your name, age, and favorite food on separate lines.

`,
  },
  {
    id: "py-level-2-variables-data-types",
    cat: "coding",
    title: "Level 2: Variables & Data Types",
    difficulty: "Easy",
    exp: 150,
    type: "python-lab",
    intro: "Master Python variables, core data types (str, int, float, bool), variable type inspection with type(), and swapping two variables in one line without a third variable.",
    levelNumber: 2,
    concepts: [
      {
        name: "Variable",
        desc: "holds a value",
        code: 'name = "AXZEL"\nage = 21',
      },
      {
        name: "Data types",
        desc: "str, int float and boolean",
        code: '# str, int, float, and boolean\nname = "AXZEL"  # str\nage = 21        # int\nratio = 94.5    # float\nis_ready = True # bool',
      },
      {
        name: "check any variables type",
        desc: "Inspect any variable type with type()",
        code: "print(type(name))\nprint(type(age))",
      },
    ],
    goals: [
      {
        id: "variable_roundup",
        text: "Variable Roundup: 4 variables (str, int, float, bool), each printed with its value + type()",
        hint: "Define 4 variables of different types and display each with its type",
      },
      {
        id: "swap_variables",
        text: "Swap Without a Third Variable: swap two variables in one line",
        hint: "Swap two variables in a single statement without using a third variable",
      },
    ],
    starter: `# Level 2: Variables & Data Types
# Task 1: Define 4 variables of different types (string, integer, float, boolean) and display each with its type.
# Task 2: Swap two variables in a single line without using a third variable.

`,
  },
  {
    id: "py-level-3-arithmetic-input-typecasting",
    cat: "coding",
    title: "Level 3: Arithmetic, Input & Typecasting",
    difficulty: "Easy",
    exp: 180,
    type: "python-lab",
    intro: "Learn arithmetic operators (+, -, *, /, //, %, **), user input with input(), typecasting with int(), and combining strings and numbers in print().",
    levelNumber: 3,
    concepts: [
      {
        name: "Arithmetic operators",
        desc: "7 operators in Python",
        code: `a = 10
b = 3

print(a + b)   # 13   addition
print(a - b)   # 7    subtraction
print(a * b)   # 30   multiplication
print(a / b)   # 3.333... division (always gives a float)
print(a // b)  # 3    floor division (drops the decimal, rounds down)
print(a % b)   # 1    modulo (the remainder)
print(a ** b)  # 1000 exponent (a to the power of b)`,
      },
      {
        name: "Getting input from users",
        desc: "input() function",
        code: `name = input("What's your name? ")
print("Hello, " + name)`,
      },
      {
        name: "Typecasting",
        desc: "convert with int()",
        code: `age = int(input("Enter your age: "))
print(age + 1)`,
      },
      {
        name: "Combining str & numbers in print",
        desc: "commas or f-strings",
        code: `age = 22
print("Age:", age)          # print() handles the comma for you
print(f"Age: {age}")        # f-string — cleanest, used a lot going forward`,
      },
    ],
    goals: [
      {
        id: "mini_calculator",
        text: "Mini Calculator — ask for 2 numbers, print results of all 7 operators",
        hint: "Use input() and int() for 2 numbers, then print +, -, *, /, //, %, and **",
      },
      {
        id: "age_from_birth_year",
        text: "Age from Birth Year — ask for birth year, calculate age via subtraction",
        hint: "Ask for birth year with input(), cast with int(), and subtract from current year",
      },
    ],
    starter: `# Level 3: Arithmetic, Input & Typecasting
# Task 1: Mini Calculator — ask for 2 numbers, print results of all 7 operators (+, -, *, /, //, %, **)
# Task 2: Age from Birth Year — ask for birth year, calculate age via subtraction

`,
  },
  {
    id: "py-level-4-strings-indexing-slicing",
    cat: "coding",
    title: "Level 4: Strings, Indexing & Slicing",
    difficulty: "Easy",
    exp: 200,
    type: "python-lab",
    intro: "Master strings, character indexing, slice extraction ([start:end:step]), essential methods (.upper(), .lower(), .strip(), .replace(), len()), and f-strings.",
    levelNumber: 4,
    concepts: [
      {
        name: "Strings (str)",
        desc: "text in quotes",
        code: `name = "axzel"
message = 'hello there'`,
      },
      {
        name: "Indexing",
        desc: "grabbing single characters",
        code: `word = "AXZEL"
print(word[0])   # 'A'
print(word[1])   # 'X'
print(word[-1])  # 'L' (negative index counts from end)`,
      },
      {
        name: "Slicing",
        desc: "grabbing a chunk [start:end]",
        code: `word = "Python"
print(word[0:3])   # Pyt
print(word[2:])    # thon (leave end blank = to the end)
print(word[:4])    # Pyth (leave start blank = from beginning)`,
      },
      {
        name: "Useful string methods",
        desc: "transforming strings",
        code: `name = "  Axzel  "

print(name.upper())                   # "  AXZEL  "
print(name.lower())                   # "  axzel  "
print(name.strip())                   # "Axzel" (removes spaces)
print(name.replace("Axzel", "Juan"))  # "  Juan  "
print(len(name))                      # length including spaces`,
      },
      {
        name: "Concatenation vs f-string",
        desc: "combining strings",
        code: `first = "Axzel"
last = "Rivera"

# Concatenation
full = first + " " + last

# f-string (cleaner, preferred)
full = f"{first} {last}"`,
      },
    ],
    goals: [
      {
        id: "name_manipulation",
        text: "Name Manipulation — store full name, print uppercase, lowercase, first 3 letters, and length",
        hint: "Store your name in a variable, then use .upper(), .lower(), slicing [:3], and len()",
      },
      {
        id: "reverse_string",
        text: "Reverse a String — ask user for a word with input(), print it reversed using slicing [::-1]",
        hint: "Use input() to get a word, then slice with [::-1] without using loops",
      },
    ],
    starter: `# Level 4: Strings, Indexing & Slicing
# Task 1: Store your full name in a variable. Print it in all uppercase, all lowercase, first 3 letters (slicing), and length using len().
# Task 2: Ask for a word with input(), then print it reversed without a loop using slicing [::-1].

`,
  },
  {
    id: "py-level-5-if-conditionals",
    cat: "coding",
    title: "Level 5: If Statements & Conditionals",
    difficulty: "Easy",
    exp: 220,
    type: "python-lab",
    intro: "Control execution flow using if, comparison operators (==, !=, >, <, >=, <=), else fallbacks, elif condition chains, and logical operators (and, or, not).",
    levelNumber: 5,
    concepts: [
      {
        name: "If statement",
        desc: "runs code if true",
        code: `age = 18

if age >= 18:
    print("You are an adult")`,
      },
      {
        name: "Comparison operators",
        desc: "evaluates to True/False",
        code: `a = 5
b = 10

a == b   # equal to (note: double ==, not single =)
a != b   # not equal to
a > b    # greater than
a < b    # less than
a >= b   # greater than or equal to
a <= b   # less than or equal to`,
      },
      {
        name: "else (the fallback)",
        desc: "runs when condition is False",
        code: `age = 15

if age >= 18:
    print("You are an adult")
else:
    print("You are a minor")`,
      },
      {
        name: "elif (multiple conditions)",
        desc: "checks conditions in order",
        code: `score = 75

if score >= 90:
    print("Grade: A")
elif score >= 80:
    print("Grade: B")
elif score >= 70:
    print("Grade: C")
else:
    print("Grade: F")`,
      },
      {
        name: "Combining conditions",
        desc: "and, or, not",
        code: `age = 20
has_id = True

if age >= 18 and has_id:
    print("Can enter")

if age < 18 or not has_id:
    print("Cannot enter")`,
      },
    ],
    goals: [
      {
        id: "even_or_odd",
        text: "Even or Odd — ask for a number, print whether it's Even or Odd using if/else and modulo (%)",
        hint: "Use input() and int(), then check number % 2 == 0 to print Even or Odd",
      },
      {
        id: "grade_checker",
        text: "Grade Checker — ask for score (0–100), print letter grade (A, B, C, or F) using if/elif/else",
        hint: "Prompt for score, check >= 90 (A), >= 80 (B), >= 70 (C), else F with if/elif/else",
      },
    ],
    starter: `# Level 5: If Statements & Conditionals
# Task 1: Ask for a number with input(), then print whether it's "Even" or "Odd" using if/else and %
# Task 2: Ask for a score (0–100) with input(), then print their letter grade using if/elif/else

`,
  },
];
 
/* ============================================================
   ACHIEVEMENTS — prestige badges, no EXP attached on purpose.
   check(state) returns true once the condition is met.
   ============================================================ */
const ACHIEVEMENTS = [
  {
    id: "first-quest",
    group: "quests",
    title: "First Blood",
    desc: "Complete your first quest.",
    check: (s) => s.quests.filter((q) => q.done).length >= 1,
  },
  {
    id: "ten-quests",
    group: "quests",
    title: "Quest Veteran",
    desc: "Complete 10 quests.",
    check: (s) => s.quests.filter((q) => q.done).length >= 10,
  },
  {
    id: "first-trial",
    group: "trials",
    title: "First Trial",
    desc: "Clear your first Challenge Lab trial.",
    check: (s) => s.solvedChallenges.length >= 1,
  },
  {
    id: "five-trials",
    group: "trials",
    title: "Trial Adept",
    desc: "Clear 5 Challenge Lab trials.",
    check: (s) => s.solvedChallenges.length >= 5,
  },
  {
    id: "streak-7",
    group: "streaks",
    title: "7-Day Grind",
    desc: "Reach a 7-day streak.",
    check: (s) => s.streak >= 7,
  },
  {
    id: "streak-30",
    group: "streaks",
    title: "Iron Will",
    desc: "Reach a 30-day streak.",
    check: (s) => s.streak >= 30,
  },
  {
    id: "level-10",
    group: "levels",
    title: "Double Digits",
    desc: "Reach Level 10.",
    check: (s) => s.level >= 10,
  },
  {
    id: "level-50",
    group: "levels",
    title: "Halfway There",
    desc: "Reach Level 50.",
    check: (s) => s.level >= 50,
  },
  {
    id: "level-100",
    group: "levels",
    title: "Apex Hunter",
    desc: "Reach Level 100.",
    check: (s) => s.level >= 100,
  },
  {
    id: "rank-d",
    group: "ranks",
    title: "Rising Hunter",
    desc: "Reach Rank D.",
    check: (s) => s.level >= 21,
  },
  {
    id: "rank-b",
    group: "ranks",
    title: "Elite Hunter",
    desc: "Reach Rank B.",
    check: (s) => s.level >= 61,
  },
];
 
/* Group metadata — label + icon shown as the section header for each cluster */
const ACHIEVEMENT_GROUPS = [
  { key: "quests", label: "Quests", icon: '<path d="M9 3v2H4v16h16V9h2v14H2V3h7Zm10 6-9 9-4-4 1.4-1.4L10 15.2 17.6 7.6 19 9Z"/>' },
  { key: "trials", label: "Challenge Lab", icon: '<path d="M13 2 3 14h7l-1 8 11-14h-7l1-6Z"/>' },
  { key: "streaks", label: "Streaks", icon: '<path d="M12 2c1 3-2 4-2 7a3 3 0 0 0 6 0c1 2 2 4 2 6a6 6 0 1 1-12 0c0-4 3-7 3-9 0-1.5.5-3 1-4a4 4 0 0 0 2 0Z"/>' },
  { key: "levels", label: "Levels", icon: '<path d="m12 2 2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.5 5.9 20.6l1.4-6.8-5.1-4.7 6.9-.8L12 2Z"/>' },
  { key: "ranks", label: "Ranks", icon: '<path d="M12 2 4 5v6c0 5 3.4 8.9 8 11 4.6-2.1 8-6 8-11V5l-8-3Zm0 2.2 6 2.2v4.6c0 3.9-2.5 7-6 8.8-3.5-1.8-6-4.9-6-8.8V6.4l6-2.2Z"/>' },
];
 
 
/* ============================================================
   XELI LEVELING SYSTEM — app logic
   ============================================================ */
(() => {
  "use strict";
 
  const STORAGE_KEY = "xeli_leveling_state_v1";
  const MAX_LEVEL = 100;
 
  const RANKS = [
    { rank: "E", min: 1,  max: 20,  title: "The Awakened" },
    { rank: "D", min: 21, max: 40,  title: "Rising Hunter" },
    { rank: "C", min: 41, max: 60,  title: "Seasoned Hunter" },
    { rank: "B", min: 61, max: 80,  title: "Elite Hunter" },
    { rank: "A", min: 81, max: 95,  title: "National-Level Hunter" },
    { rank: "S", min: 96, max: 100, title: "Sovereign of the System" },
  ];
 
  const DIFF_LABELS = { 25: "Easy", 50: "Normal", 100: "Hard", 200: "Elite" };

  // ---------------------------------------------------------
  // NEW LEVELING SYSTEM (Levels 1–100)
  // Base Formula: Total EXP = 1,000,000 * ((Level - 1) / 99)^2
  // - Level 1 = 0 Total EXP
  // - Level 14 = 17,243 Total EXP (18,050 Total EXP is Level 14 with 807/2,755 EXP)
  // - Level 100 = 1,000,000 Total EXP
  // ---------------------------------------------------------
  function totalExpForLevel(level) {
    if (level <= 1) return 0;
    if (level >= 100) return 1000000;
    return Math.round(1000000 * Math.pow((level - 1) / 99, 2));
  }

  function requiredForLevel(level) {
    if (level >= 100) return 0;
    return totalExpForLevel(level + 1) - totalExpForLevel(level);
  }

  function cumulativeExpForLevel(targetLevel) {
    return totalExpForLevel(targetLevel);
  }

  function getLevelAndExpFromTotal(totalExp) {
    if (!totalExp || totalExp <= 0) return { level: 1, exp: 0, required: requiredForLevel(1) };
    if (totalExp >= 1000000) return { level: 100, exp: 0, required: 0 };
    let approx = Math.floor(Math.sqrt(totalExp / 1000000) * 99) + 1;
    while (approx < 100 && totalExpForLevel(approx + 1) <= totalExp) {
      approx++;
    }
    while (approx > 1 && totalExpForLevel(approx) > totalExp) {
      approx--;
    }
    const currentBase = totalExpForLevel(approx);
    const nextBase = totalExpForLevel(approx + 1);
    return {
      level: approx,
      exp: totalExp - currentBase,
      required: nextBase - currentBase
    };
  }

  function rankInfoForLevel(level) {
    return RANKS.find((r) => level >= r.min && level <= r.max) || RANKS[0];
  }

  // ---------------------------------------------------------
  // STATE
  // ---------------------------------------------------------
  function defaultState() {
    return {
      name: "Hunter",
      level: 1,
      exp: 0,
      totalExp: 0,
      streak: 0,
      lastActiveDay: null,
      quests: [],          // {id,title,notes,category,exp,done,createdAt}
      solvedChallenges: [], // challenge ids
      activity: [],         // {text, time}
      dailyExp: {},          // { "YYYY-MM-DD": expEarnedThatDay }
      unlockedAchievements: [], // achievement ids
      soundEnabled: true,
      bgmEnabled: false,
      bgmVolume: 65,
      guild: "Hunter Association",
      avatarUrl: null,
      isLoggedIn: true,
      rememberMe: true,
      password: "hunter1998",
      supabaseAutoSync: true,
      lastSupabaseSync: null,
    };
  }
 
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      // Auto-off for BGM on initial load so background music does not auto-play
      return { ...defaultState(), ...parsed, bgmEnabled: false };
    } catch (e) {
      console.warn("Could not read saved state, starting fresh.", e);
      return defaultState();
    }
  }
 
  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (typeof recordRegisteredHunter === "function") {
      recordRegisteredHunter({
        id: currentSupabaseUser ? currentSupabaseUser.id : "local-active-hunter",
        name: state.name || "Hunter",
        avatarUrl: state.avatarUrl || null,
        level: state.level || 1,
        totalExp: Math.max(state.totalExp || 0, state.exp || 0),
        streak: state.streak || 0,
        guild: state.guild || "Hunter Association",
        solvedCount: state.solvedChallenges ? state.solvedChallenges.length : 0,
        questsCleared: state.quests ? state.quests.filter((q) => q.done).length : 0,
        isCurrent: true,
        updatedAt: new Date().toISOString(),
      });
    }
    if (typeof triggerSupabaseAutoSync === "function") {
      triggerSupabaseAutoSync();
    }
  }
  const TARGET_MATRIX_USER_ID = "f4b12bd2-f26a-4f98-aef2-1e883b9f1934";
  const TARGET_MATRIX_EMAILS = ["axzelbaril460@gmail.com"];

  // Activity Matrix from August 25 to September 24, 2026 (59 submissions, 20 active days, 18,050 Total EXP)
  const AUG25_SEPT24_MATRIX = {
    "2026-08-25": 300,
    "2026-08-26": 610,
    "2026-08-27": 920,
    "2026-08-30": 310,
    "2026-08-31": 610,
    "2026-09-01": 920,
    "2026-09-04": 920,
    "2026-09-05": 920,
    "2026-09-07": 920,
    "2026-09-08": 920,
    "2026-09-09": 1220,
    "2026-09-10": 920,
    "2026-09-11": 920,
    "2026-09-14": 920,
    "2026-09-15": 920,
    "2026-09-17": 920,
    "2026-09-18": 1220,
    "2026-09-21": 920,
    "2026-09-22": 920,
    "2026-09-23": 1820,
  };

  function isTargetMatrixAccount(data) {
    if (!data) return false;
    if (typeof currentSupabaseUser !== "undefined" && currentSupabaseUser) {
      if (
        currentSupabaseUser.id === TARGET_MATRIX_USER_ID ||
        TARGET_MATRIX_EMAILS.includes(currentSupabaseUser.email) ||
        (currentSupabaseUser.user_metadata?.name && currentSupabaseUser.user_metadata.name.toLowerCase().includes("xeliboy")) ||
        (currentSupabaseUser.user_metadata?.hunter_name && currentSupabaseUser.user_metadata.hunter_name.toLowerCase().includes("xeliboy"))
      ) {
        return true;
      }
    }
    if (data.id === TARGET_MATRIX_USER_ID || TARGET_MATRIX_EMAILS.includes(data.email)) {
      return true;
    }
    if (typeof data.name === "string" && data.name.trim().toLowerCase().includes("xeliboy")) {
      return true;
    }
    return false;
  }

  function sanitizeState(obj) {
    const merged = { ...defaultState(), ...obj };
    if (typeof merged.level !== "number" || isNaN(merged.level)) merged.level = 1;
    if (typeof merged.exp !== "number" || isNaN(merged.exp)) merged.exp = 0;
    if (typeof merged.totalExp !== "number" || isNaN(merged.totalExp)) merged.totalExp = 0;
    if (typeof merged.streak !== "number" || isNaN(merged.streak)) merged.streak = 0;
    if (!Array.isArray(merged.quests)) merged.quests = [];
    if (!Array.isArray(merged.solvedChallenges)) merged.solvedChallenges = [];
    if (!Array.isArray(merged.activity)) merged.activity = [];
    if (!Array.isArray(merged.unlockedAchievements)) merged.unlockedAchievements = [];
    if (typeof merged.soundEnabled !== "boolean") merged.soundEnabled = true;
    if (typeof merged.bgmEnabled !== "boolean") merged.bgmEnabled = false;
    if (typeof merged.bgmVolume !== "number" || isNaN(merged.bgmVolume)) merged.bgmVolume = 65;
    if (typeof merged.dailyExp !== "object" || merged.dailyExp === null) merged.dailyExp = {};
    if (typeof merged.name !== "string" || !merged.name.trim()) merged.name = "Hunter";
    if (typeof merged.guild !== "string" || !merged.guild.trim()) merged.guild = "Hunter Association";
    if (typeof merged.avatarUrl !== "string" && merged.avatarUrl !== null) merged.avatarUrl = null;
    if (typeof merged.isLoggedIn !== "boolean") merged.isLoggedIn = true;
    if (typeof merged.rememberMe !== "boolean") merged.rememberMe = true;
    if (typeof merged.password !== "string") merged.password = "hunter1998";
    if (typeof merged.supabaseAutoSync !== "boolean") merged.supabaseAutoSync = true;
    if (typeof merged.lastSupabaseSync !== "string" && merged.lastSupabaseSync !== null) merged.lastSupabaseSync = null;

    // Targeted migration for verified Google user axzelbaril460@gmail.com (id: f4b12bd2-f26a-4f98-aef2-1e883b9f1934):
    // Baseline 19,230 Total EXP, 6 active streak days, 59+ solved challenges
    if (isTargetMatrixAccount(merged)) {
      merged.totalExp = Math.max(merged.totalExp || 0, 19230);
      merged.streak = Math.max(merged.streak || 0, 6);
      merged.dailyExp = { ...AUG25_SEPT24_MATRIX, ...(merged.dailyExp || {}) };

      const prev = merged.problemStats || {};
      const extraSolved = Array.isArray(merged.solvedChallenges) ? merged.solvedChallenges.length : 0;
      const currentSolved = Math.max(59 + extraSolved, Number(prev.solvedTotal) || 59);
      const currentMed = Math.max(40 + extraSolved, Number(prev.solvedMedium) || 40);

      merged.problemStats = {
        solvedTotal: currentSolved,
        totalProblems: 76,
        solvedEasy: Math.max(2, Number(prev.solvedEasy) || 2),
        totalEasy: 10,
        solvedMedium: currentMed,
        totalMedium: 46,
        solvedHard: Math.max(17, Number(prev.solvedHard) || 17),
        totalHard: 20,
      };
    }

    // Globally reconcile level & exp according to: Total EXP = 1,000,000 * ((Level - 1) / 99)^2
    if (merged.totalExp > 0) {
      const derived = getLevelAndExpFromTotal(merged.totalExp);
      merged.level = derived.level;
      merged.exp = derived.exp;
    } else {
      merged.level = 1;
      merged.exp = 0;
    }

    return merged;
  }
 
  let state = loadState();
 
  // ---------------------------------------------------------
  // SOUND ENGINE — synthesized retro "hacker terminal" beeps.
  // No audio files; everything is generated with Web Audio oscillators.
  // ---------------------------------------------------------
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }
 
  function beep(freq, duration, type, volume, delay) {
    if (!state.soundEnabled) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || "square";
    osc.frequency.value = freq;
    const start = ctx.currentTime + (delay || 0);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume || 0.40, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + (duration || 0.05));
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + (duration || 0.05) + 0.03);
  }

  // High-volume punchy retro mechanical UI switch click
  function playClick() {
    if (!state.soundEnabled) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Layer 1: High crisp snap (1800 - 2400Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(1800 + Math.random() * 600, now);
    osc1.frequency.exponentialRampToValueAtTime(520, now + 0.024);
    gain1.gain.setValueAtTime(0.46, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
    osc1.connect(gain1).connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.035);

    // Layer 2: Solid punchy mechanical body thump (380 - 460Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(420 + Math.random() * 80, now);
    osc2.frequency.exponentialRampToValueAtTime(130, now + 0.028);
    gain2.gain.setValueAtTime(0.40, now);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.034);
    osc2.connect(gain2).connect(ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.04);
  }

  // High-volume tactile mechanical typing sounds across all input fields
  function playTypingSound(key) {
    if (!state.soundEnabled) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (key === " " || key === "Space" || key === "Spacebar") {
      // High-volume deep acoustic spacebar thump
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.038);
      gain.gain.setValueAtTime(0.55, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (key === "Backspace" || key === "Delete") {
      // High-volume crisp erasure snap
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(860, now);
      osc.frequency.exponentialRampToValueAtTime(340, now + 0.024);
      gain.gain.setValueAtTime(0.48, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.035);
    } else if (key === "Enter") {
      // High-volume return latch clack
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
    } else {
      // High-volume crisp mechanical key clack
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "triangle";
      const baseFreq = 1900 + (Math.random() * 500 - 250);
      osc1.frequency.setValueAtTime(baseFreq, now);
      osc1.frequency.exponentialRampToValueAtTime(650, now + 0.022);
      gain1.gain.setValueAtTime(0.48, now);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);
      osc1.connect(gain1).connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.032);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(390 + Math.random() * 80, now);
      osc2.frequency.exponentialRampToValueAtTime(130, now + 0.025);
      gain2.gain.setValueAtTime(0.38, now);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
      osc2.connect(gain2).connect(ctx.destination);
      osc2.start(now);
      osc2.stop(now + 0.035);
    }
  }

  function playSuccess() {
    beep(660, 0.09, "square", 0.40, 0);
    beep(990, 0.14, "square", 0.45, 0.08);
  }
  function playError() {
    beep(260, 0.06, "sawtooth", 0.42, 0);
    beep(160, 0.18, "sawtooth", 0.46, 0.05);
  }
  function playLevelUp() {
    [523, 659, 784, 1046].forEach((f, i) => beep(f, 0.14, "square", 0.46, i * 0.09));
  }
  function playUnlock() {
    beep(784, 0.08, "square", 0.42, 0);
    beep(1046, 0.16, "square", 0.48, 0.07);
  }
  function playPower() {
    beep(520, 0.06, "square", 0.40, 0);
    beep(320, 0.06, "square", 0.42, 0.06);
    beep(160, 0.16, "square", 0.46, 0.12);
  }
  function playLogonChime() {
    if (!state.soundEnabled) return;
    const notes = [
      { f: 392.0, d: 0.26, t: 0.0, type: "triangle", v: 0.36 },  // G4
      { f: 523.25, d: 0.28, t: 0.08, type: "triangle", v: 0.40 },// C5
      { f: 659.25, d: 0.32, t: 0.18, type: "triangle", v: 0.42 },// E5
      { f: 783.99, d: 0.42, t: 0.3, type: "triangle", v: 0.46 }, // G5
      { f: 1046.5, d: 0.65, t: 0.42, type: "sine", v: 0.50 },    // C6
    ];
    notes.forEach((n) => beep(n.f, n.d, n.type, n.v, n.t));
  }
  function playLogoffSound() {
    if (!state.soundEnabled) return;
    beep(523.25, 0.12, "triangle", 0.38, 0.0);
    beep(392.0, 0.14, "triangle", 0.40, 0.1);
    beep(261.63, 0.24, "sine", 0.44, 0.22);
  }

  // Every click on any interactive UI element gets a high-volume crisp tactile click.
  // Capture phase so it always fires, even if the target calls stopPropagation().
  document.addEventListener(
    "click",
    (e) => {
      const elTarget = e.target && (
        e.target.closest(
          "button, a, input, select, textarea, label, [role='button'], [tabindex], " +
          ".nav-item, .tab, .quest-card, .mini-quest, .challenge-card, .mcq-option, " +
          ".qc-btn, .icon-btn, .retro-btn, .link-btn, .pill, .diff-tag, .stat-chip, " +
          ".calendar-cell, .toast, .modal-close, .avatar-option, .theme-btn, .sys-btn, " +
          ".roadmap-node, .achievement-card, summary, details, [data-view], [data-tab], " +
          "[data-action], [data-filter], [data-id], [data-complete], [data-dash-complete], " +
          ".close-btn, .filter-chip, .mq-check-btn, .panel-head, .profile-avatar-wrap, " +
          ".win95-start-btn, .dock-icon, .desktop-shortcut, .context-menu-item, " +
          ".panel, .card, .status-card, .lab-section, .dropdown-item, [onclick]"
        ) ||
        (window.getComputedStyle(e.target).cursor === "pointer" ? e.target : null)
      );
      if (elTarget) playClick();
    },
    true
  );

  // High-volume mechanical typing sound when typing anywhere across the application
  document.addEventListener(
    "keydown",
    (e) => {
      if (["Shift", "Control", "Alt", "Meta", "CapsLock", "Escape"].includes(e.key)) return;
      if (e.target && e.target.id === "cliHiddenInput") return; // Handled by Cisco CLI simulator

      const isTyping = e.target && (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.isContentEditable
      );

      if (isTyping) {
        playTypingSound(e.key);
      }
    },
    true
  );

  const RANK_AVATARS = [
    {
      min: 1,
      max: 5,
      rank: "E",
      stageTitle: "E-Rank Hunter (Lv. 1–5)",
      badge: "Lv. 1–5",
      url: "/assets/rank_e_level_1_5.png",
      description: "Weakest Hunter of All Mankind · Initial Awakening Stage",
    },
  ];

  function getHunterAvatar(level) {
    const matched = RANK_AVATARS.find((a) => level >= a.min && level <= a.max);
    if (matched) return matched;
    // For other levels in E-Rank (Lv 6-20), maintain the E-Rank visual progression
    if (level <= 20) {
      return {
        min: 1,
        max: 20,
        rank: "E",
        stageTitle: "E-Rank Hunter",
        badge: `Lv. ${level}`,
        url: "/assets/rank_e_level_1_5.png",
        description: "E-Rank Awakened Hunter Stage",
      };
    }
    return null;
  }

  function expHintText(rankInfo) {
    if (state.level >= MAX_LEVEL) return "Max level reached — Rank S achieved.";
    const nextRank = RANKS[RANKS.indexOf(rankInfo) + 1];
    const levelsToNext = rankInfo.max - state.level + 1;
    if (!nextRank) return `${levelsToNext} level${levelsToNext === 1 ? "" : "s"} to Level 100.`;
    return `${levelsToNext} level${levelsToNext === 1 ? "" : "s"} to Rank ${nextRank.rank}.`;
  }

  function addExp(amount, reason) {
    if (amount <= 0) return;
    const beforeLevel = state.level;
    const beforeRank = rankInfoForLevel(state.level).rank;
    state.totalExp = Math.max(0, (state.totalExp || 0) + amount);
    logDailyExp(amount);

    if (state.totalExp >= 1000000) {
      state.level = MAX_LEVEL;
      state.exp = 0;
      state.totalExp = 1000000;
    } else {
      const derived = getLevelAndExpFromTotal(state.totalExp);
      state.level = derived.level;
      state.exp = derived.exp;
    }

    const leveled = state.level > beforeLevel;
    logActivity(`+${amount} EXP — ${reason}`);
    touchStreak();
    saveState();
    render();

    if (typeof syncToSupabaseCloud === "function") {
      syncToSupabaseCloud(true).then(() => {
        if (typeof refreshLeaderboard === "function") {
          refreshLeaderboard(false);
        }
      });
    }

    if (leveled) {
      const afterRank = rankInfoForLevel(state.level).rank;
      playLevelUp();
      showLevelUp(state.level, beforeRank !== afterRank ? afterRank : null);
    } else {
      playSuccess();
      showToast(`+${amount} EXP <b>${escapeHtml(reason)}</b>`);
    }
  }
 
  function touchStreak() {
    const today = new Date().toDateString();
    if (state.lastActiveDay === today) return;
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    state.streak = state.lastActiveDay === yesterday ? state.streak + 1 : 1;
    state.lastActiveDay = today;
  }
 
  function dateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
 
  function logDailyExp(amount) {
    const key = dateKey(new Date());
    state.dailyExp[key] = (state.dailyExp[key] || 0) + amount;
  }
 
  function logActivity(text) {
    state.activity.unshift({ text, time: Date.now() });
    state.activity = state.activity.slice(0, 30);
  }
 
  // ---------------------------------------------------------
  // UTIL
  // ---------------------------------------------------------
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
 
  function timeAgo(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return "just now";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  }
 
  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }
 
  function deepEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
 
  // ---------------------------------------------------------
  // DOM refs
  // ---------------------------------------------------------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
 
  const el = {
    miniRing: $("#miniRing"), miniRank: $("#miniRank"), miniName: $("#miniName"), miniLevel: $("#miniLevel"),
    miniAvatarThumb: $("#miniAvatarThumb"),
    statStreak: $("#statStreak"), statTotalExp: $("#statTotalExp"),
    viewTitle: $("#viewTitle"),
    rankBadgeBig: $("#rankBadgeBig"), rankLetterBig: $("#rankLetterBig"),
    hunterAvatar: $("#hunterAvatar"), hunterAvatarImg: $("#hunterAvatarImg"), hunterAvatarSvg: $("#hunterAvatarSvg"),
    hunterNameInput: $("#hunterNameInput"), hunterTitle: $("#hunterTitle"),
    levelNumber: $("#levelNumber"), expFill: $("#expFill"), expTrack: $("#expTrack"),
    expCurrent: $("#expCurrent"), expRequired: $("#expRequired"), expHint: $("#expHint"),
    expWordLabel: $("#expWordLabel"),
    statQuests: $("#statQuests"), statChallenges: $("#statChallenges"),
    dashQuestList: $("#dashQuestList"), activityList: $("#activityList"),
    questGrid: $("#questGrid"), questTabs: $("#questTabs"),
    challengeGrid: $("#challengeGrid"), labTabs: $("#labTabs"),
    roadmapTrack: $("#roadmapTrack"), roadmapFill: $("#roadmapFill"),
    roadmapMarker: $("#roadmapMarker"), roadmapMarkerLv: $("#roadmapMarkerLv"),
    calendarGrid: $("#calendarGrid"), calendarMonths: $("#calendarMonths"), calendarCaption: $("#calendarCaption"),
    calendarScroll: $("#calendarScroll"), calendarMonthsFlow: $("#calendarMonthsFlow"),
    calendarMonthDetail: $("#calendarMonthDetail"),
    calViewHeatmapBtn: $("#calViewHeatmapBtn"), calViewMonthBtn: $("#calViewMonthBtn"),
    calNavQuickMonths: $("#calNavQuickMonths"), calNavPrevBtn: $("#calNavPrevBtn"),
    calNavNextBtn: $("#calNavNextBtn"), calNavTodayBtn: $("#calNavTodayBtn"),
    calFloatingTooltip: $("#calFloatingTooltip"),
    achievementGrid: $("#achievementGrid"), achUnlockedCount: $("#achUnlockedCount"),
    achProgressFill: $("#achProgressFill"), achProgressLabel: $("#achProgressLabel"),
    toastStack: $("#toastStack"),
    levelupOverlay: $("#levelupOverlay"), levelupNumber: $("#levelupNumber"), levelupRankline: $("#levelupRankline"),
    levelupAvatarPreview: $("#levelupAvatarPreview"), levelupAvatarImg: $("#levelupAvatarImg"),
    // LeetCode Progress Suite (Challenge Lab & Real Hunter Stats)
    lcSolvedTotal: $("#lcSolvedTotal"), lcSolvedRatio: $("#lcSolvedRatio"),
    lcSegEasy: $("#lcSegEasy"), lcSegMed: $("#lcSegMed"), lcSegHard: $("#lcSegHard"),
    lcEasyCount: $("#lcEasyCount"), lcEasyBeats: $("#lcEasyBeats"), lcEasyBar: $("#lcEasyBar"),
    lcMedCount: $("#lcMedCount"), lcMedBeats: $("#lcMedBeats"), lcMedBar: $("#lcMedBar"),
    lcHardCount: $("#lcHardCount"), lcHardBeats: $("#lcHardBeats"), lcHardBar: $("#lcHardBar"),
    lcHunterRating: $("#lcHunterRating"),
    lcContestLeague: $("#lcContestLeague"),
    lcTotalCleared: $("#lcTotalCleared"),
    lcQuestsClearedMetric: $("#lcQuestsClearedMetric"),
    lcHunterLevelMetric: $("#lcHunterLevelMetric"),
    lcStreakMetric: $("#lcStreakMetric"),
    lcCalTotalSubs: $("#lcCalTotalSubs"), lcCalActiveDays: $("#lcCalActiveDays"),
    lcCalMaxStreak: $("#lcCalMaxStreak"), lcCalCurrentStreak: $("#lcCalCurrentStreak"),
    // Hunter Association Leaderboards & Real User Rankings
    leaderboardUserCount: $("#leaderboardUserCount"),
    leaderboardRefreshBtn: $("#leaderboardRefreshBtn"),
    leaderboardMyStanding: $("#leaderboardMyStanding"),
    myStandingRankPos: $("#myStandingRankPos"),
    myStandingName: $("#myStandingName"),
    myStandingTier: $("#myStandingTier"),
    myStandingLevel: $("#myStandingLevel"),
    myStandingExp: $("#myStandingExp"),
    myStandingRankLetter: $("#myStandingRankLetter"),
    myStandingSyncStatus: $("#myStandingSyncStatus"),
    myStandingYouBadge: $("#myStandingYouBadge"),
    leaderboardFilters: $("#leaderboardFilters"),
    leaderboardList: $("#leaderboardList"),
    leaderboardSearchInput: $("#leaderboardSearchInput"),
    leaderboardSearchClear: $("#leaderboardSearchClear"),
    leaderboardTabs: $("#leaderboardTabs"),
    roadmapSubpanel: $("#roadmapSubpanel"),
    leaderboardMyRankSection: $("#leaderboardMyRankSection"),
    myRankCardContainer: $("#myRankCardContainer"),
  };

  let questFilter = "active";
  let labCategory = "coding";
  let expDisplayMode = localStorage.getItem("xeli_exp_display_mode") || "total";

  function toggleExpDisplayMode() {
    expDisplayMode = expDisplayMode === "total" ? "level" : "total";
    localStorage.setItem("xeli_exp_display_mode", expDisplayMode);
    render();
    playClick();
  }

  // ---------------------------------------------------------
  // RENDER: header / hero / sidebar
  // ---------------------------------------------------------
  function render() {
    const rankInfo = rankInfoForLevel(state.level);
    const required = requiredForLevel(state.level);
    const cumulativeStart = cumulativeExpForLevel(state.level);
    const cumulativeNext = cumulativeStart + required;
    const totalExpVal = Math.max(state.totalExp || 0, cumulativeStart + state.exp);
    const pct = state.level >= MAX_LEVEL ? 100 : Math.min(100, (state.exp / required) * 100);
 
    document.body.setAttribute("data-rank", rankInfo.rank);
 
    el.miniRank.textContent = rankInfo.rank;
    el.miniName.textContent = state.name;
    el.miniLevel.textContent = state.level;

    const miniGuildEl = $("#miniGuild");
    if (miniGuildEl) {
      miniGuildEl.textContent = state.guild ? state.guild.split(" ")[0] : "Association";
    }
    const miniAuthDot = $("#miniAuthDot");
    if (miniAuthDot) {
      if (state.isLoggedIn) {
        miniAuthDot.classList.remove("is-off");
        miniAuthDot.title = "Terminal Authorization Active";
      } else {
        miniAuthDot.classList.add("is-off");
        miniAuthDot.title = "Terminal Authorization Required (Logged Off)";
      }
    }

    const loginBtnLabel = $("#loginBtnLabel");
    if (loginBtnLabel) {
      if (state.isLoggedIn) {
        const shortName = state.name.length > 8 ? state.name.slice(0, 7) + "…" : state.name;
        loginBtnLabel.textContent = `Log Off (${shortName})`;
      } else {
        loginBtnLabel.textContent = "Log On...";
      }
    }
 
    el.statStreak.textContent = `${state.streak}d`;
    el.statTotalExp.textContent = state.totalExp.toLocaleString();
 
    el.rankLetterBig.textContent = rankInfo.rank;
    if (el.rankBadgeBig) {
      el.rankBadgeBig.className = `rank-badge rank-${rankInfo.rank.toLowerCase()}`;
    }

    // Hunter Avatar based on Level or custom uploaded Profile Picture
    const avatarData = getHunterAvatar(state.level);
    if (el.hunterAvatarImg && el.hunterAvatarSvg) {
      if (state.avatarUrl) {
        el.hunterAvatarImg.src = state.avatarUrl;
        el.hunterAvatarImg.alt = `${state.name || "Hunter"} Profile Picture`;
        el.hunterAvatarImg.style.display = "block";
        el.hunterAvatarSvg.style.display = "none";
        if (el.hunterAvatar) {
          el.hunterAvatar.title = `${state.name || "Hunter"} · Click to Edit Profile & Picture`;
        }
        if (el.miniAvatarThumb) {
          el.miniAvatarThumb.src = state.avatarUrl;
          el.miniAvatarThumb.style.display = "block";
        }
      } else if (avatarData && avatarData.url) {
        el.hunterAvatarImg.src = avatarData.url;
        el.hunterAvatarImg.alt = `${avatarData.stageTitle} Avatar`;
        el.hunterAvatarImg.style.display = "block";
        el.hunterAvatarSvg.style.display = "none";
        if (el.hunterAvatar) {
          el.hunterAvatar.title = `${avatarData.stageTitle} (Current: Lv. ${state.level}) · Click to Edit Profile`;
        }
        if (el.miniAvatarThumb) {
          el.miniAvatarThumb.src = avatarData.url;
          el.miniAvatarThumb.style.display = "block";
        }
      } else {
        el.hunterAvatarImg.style.display = "none";
        el.hunterAvatarSvg.style.display = "block";
        if (el.miniAvatarThumb) el.miniAvatarThumb.style.display = "none";
      }
    }

    el.hunterNameInput.value = state.name;
    el.hunterTitle.textContent = `${rankInfo.title} · ${state.guild || "Hunter Association"}`;
    el.levelNumber.textContent = state.level;
    el.expFill.style.width = pct + "%";
    el.expTrack.setAttribute("aria-valuenow", Math.round(pct));

    if (el.expCurrent) {
      el.expCurrent.textContent = (state.level >= MAX_LEVEL ? required : state.exp).toLocaleString();
    }
    if (el.expRequired) {
      el.expRequired.textContent = required.toLocaleString();
    }
    if (el.expWordLabel) {
      el.expWordLabel.textContent = "EXP";
    }

    const expRemaining = Math.max(0, required - state.exp);
    if (el.expHint) {
      if (state.level >= MAX_LEVEL) {
        el.expHint.textContent = "Max level reached — Rank S achieved.";
      } else {
        el.expHint.textContent = `${expRemaining.toLocaleString()} EXP to Level ${state.level + 1} · ${expHintText(rankInfo)}`;
      }
    }
 
    el.statQuests.textContent = state.quests.filter((q) => q.done).length;
    const trialsSolvedNum = state.problemStats?.solvedTotal ?? (isTargetMatrixAccount(state) ? 59 : state.solvedChallenges.length);
    el.statChallenges.textContent = trialsSolvedNum;
    renderLeetCodeProgress();
 
    renderDashQuestList();
    renderActivity();
    renderQuests();
    renderChallenges();
    renderRoadmap(rankInfo);
    renderLeaderboard();
    renderCalendar();
    renderAchievements();
    checkAchievements();
  }
 
  function renderDashQuestList() {
    const active = state.quests.filter((q) => !q.done).slice(0, 5);
    if (!active.length) {
      el.dashQuestList.innerHTML = `
        <div class="empty-state mini-quest-empty">
          <svg viewBox="0 0 24 24" class="empty-icon"><path d="M9 3v2H4v16h16V9h2v14H2V3h7Zm10 6-9 9-4-4 1.4-1.4L10 15.2 17.6 7.6 19 9Z"/></svg>
          <p>No active quests. Head to the Quests tab to log one.</p>
          <button class="btn btn-primary mini-create-quest-btn" id="dashCreateQuestBtn" type="button">
            <svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:currentColor;flex-shrink:0;"><path d="M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2h6Z"/></svg>
            <span>New Quest</span>
          </button>
        </div>`;
      const btn = $("#dashCreateQuestBtn");
      if (btn) btn.addEventListener("click", () => openQuestForm());
      return;
    }
    el.dashQuestList.innerHTML = active
      .map((q) => `
        <div class="mini-quest" data-id="${q.id}" tabindex="0" role="button" aria-label="Open quest: ${escapeHtml(q.title)}">
          <div class="mq-left">
            <div class="mq-meta-row">
              <span class="mq-cat">${escapeHtml(q.category || "General")}</span>
              <span class="diff-tag mq-diff">${DIFF_LABELS[q.exp] || "Custom"}</span>
            </div>
            <div class="mq-title">${escapeHtml(q.title)}</div>
          </div>
          <div class="mq-right">
            <span class="mq-exp">+${q.exp} EXP</span>
            <button class="qc-btn mq-check-btn" data-dash-complete="${q.id}" title="Mark complete" aria-label="Mark complete">
              <svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z"/></svg>
            </button>
          </div>
        </div>`)
      .join("");
  }
 
  // ---------------------------------------------------------
  // RENDER: LeetCode Progress Suite & Analytics
  // ---------------------------------------------------------
  function renderLeetCodeProgress() {
    if (!el.lcSolvedTotal) return;

    // 1. Solved Problems: Strictly based on how many on the Challenge Lab
    let easyTotal = 0, easySolved = 0;
    let medTotal = 0, medSolved = 0;
    let hardTotal = 0, hardSolved = 0;

    CHALLENGES.forEach((c) => {
      const diff = (c.difficulty || "medium").toLowerCase();
      const isSolved = state.solvedChallenges.includes(c.id);
      if (diff === "easy") {
        easyTotal++;
        if (isSolved) easySolved++;
      } else if (diff === "hard") {
        hardTotal++;
        if (isSolved) hardSolved++;
      } else {
        medTotal++;
        if (isSolved) medSolved++;
      }
    });

    if (state.problemStats) {
      easySolved = state.problemStats.solvedEasy ?? easySolved;
      easyTotal = state.problemStats.totalEasy ?? easyTotal;
      medSolved = state.problemStats.solvedMedium ?? medSolved;
      medTotal = state.problemStats.totalMedium ?? medTotal;
      hardSolved = state.problemStats.solvedHard ?? hardSolved;
      hardTotal = state.problemStats.totalHard ?? hardTotal;
    } else if (isTargetMatrixAccount(state)) {
      const extraSolved = Array.isArray(state.solvedChallenges) ? state.solvedChallenges.length : 0;
      easySolved = 2;
      easyTotal = 10;
      medSolved = 40 + extraSolved;
      medTotal = 46;
      hardSolved = 17;
      hardTotal = 20;
    }

    const totalSolved = easySolved + medSolved + hardSolved;
    const totalProblems = easyTotal + medTotal + hardTotal;

    // Center counts
    el.lcSolvedTotal.textContent = totalSolved;
    el.lcSolvedRatio.textContent = `${totalSolved} / ${totalProblems}`;

    // SVG Circular Donut Math: radius = 54 => Circumference = 2 * pi * 54 = 339.292
    const C = 2 * Math.PI * 54;
    const baseTotal = Math.max(1, totalProblems);
    const lenEasy = (easySolved / baseTotal) * C;
    const lenMed = (medSolved / baseTotal) * C;
    const lenHard = (hardSolved / baseTotal) * C;

    if (el.lcSegEasy) {
      el.lcSegEasy.style.strokeDasharray = `${lenEasy} ${C}`;
      el.lcSegEasy.style.strokeDashoffset = `0`;
    }
    if (el.lcSegMed) {
      el.lcSegMed.style.strokeDasharray = `${lenMed} ${C}`;
      el.lcSegMed.style.strokeDashoffset = `-${lenEasy}`;
    }
    if (el.lcSegHard) {
      el.lcSegHard.style.strokeDasharray = `${lenHard} ${C}`;
      el.lcSegHard.style.strokeDashoffset = `-${lenEasy + lenMed}`;
    }

    // Breakdown Rows
    const updateDiffRow = (countEl, barEl, pctEl, solved, total) => {
      if (countEl) countEl.innerHTML = `${solved}<span class="lc-diff-total">/${total}</span>`;
      const pct = total ? Math.min(100, Math.round((solved / total) * 100)) : 0;
      if (barEl) barEl.style.width = pct + "%";
      if (pctEl) pctEl.textContent = `${pct}%`;
    };

    updateDiffRow(el.lcEasyCount, el.lcEasyBar, el.lcEasyBeats, easySolved, easyTotal);
    updateDiffRow(el.lcMedCount, el.lcMedBar, el.lcMedBeats, medSolved, medTotal);
    updateDiffRow(el.lcHardCount, el.lcHardBar, el.lcHardBeats, hardSolved, hardTotal);

    // 2. Hunter Rating & Progression — 100% genuine user data, ZERO dummy data
    const rankInfo = rankInfoForLevel(state.level);
    const solvedChallengesCount = totalSolved;
    const clearedQuestsCount = state.quests.filter((q) => q.done).length;
    const totalExpEarned = Math.max(state.totalExp || 0, state.exp || 0);

    if (el.lcHunterRating) el.lcHunterRating.textContent = totalExpEarned.toLocaleString();
    if (el.lcContestLeague) el.lcContestLeague.textContent = `Rank ${rankInfo.rank} · ${rankInfo.title}`;

    if (el.lcTotalCleared) el.lcTotalCleared.textContent = `${totalSolved} / ${totalProblems}`;
    if (el.lcQuestsClearedMetric) el.lcQuestsClearedMetric.textContent = `${clearedQuestsCount}`;
    if (el.lcHunterLevelMetric) el.lcHunterLevelMetric.textContent = `Lv. ${state.level}`;
    if (el.lcStreakMetric) el.lcStreakMetric.textContent = `${state.streak || 0} ${state.streak === 1 ? "day" : "days"}`;

    // Calendar Heatmap Strip Stats — Real session data
    const activeDaysCount = Object.keys(state.dailyExp).filter((k) => state.dailyExp[k] > 0).length || (totalExpEarned > 0 ? 1 : 0);
    if (el.lcCalActiveDays) el.lcCalActiveDays.textContent = activeDaysCount;
    if (el.lcCalCurrentStreak) el.lcCalCurrentStreak.textContent = `${state.streak || 0} ${state.streak === 1 ? "day" : "days"}`;

    const sortedDates = Object.keys(state.dailyExp)
      .filter((k) => state.dailyExp[k] > 0)
      .sort();
    let maxStreakCount = state.streak || 0;
    let tempStreak = 0;
    let prevTime = null;
    for (const dStr of sortedDates) {
      const curTime = new Date(dStr + "T00:00:00").getTime();
      if (prevTime !== null && curTime - prevTime === 86400000) {
        tempStreak++;
      } else {
        tempStreak = 1;
      }
      if (tempStreak > maxStreakCount) maxStreakCount = tempStreak;
      prevTime = curTime;
    }
    if (el.lcCalMaxStreak) el.lcCalMaxStreak.textContent = `${Math.max(state.streak || 0, maxStreakCount)} ${Math.max(state.streak || 0, maxStreakCount) === 1 ? "day" : "days"}`;

    const totalSubmissions = solvedChallengesCount + clearedQuestsCount;
    if (el.lcCalTotalSubs) el.lcCalTotalSubs.textContent = totalSubmissions;
  }

  function renderActivity() {
    if (!state.activity.length) {
      el.activityList.innerHTML = `<li class="empty-state"><svg viewBox="0 0 24 24" class="empty-icon"><path d="M13 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7V3Zm1 4v6l5 3-.75 1.3L12 14V7h2Z"/></svg><p>Your history will appear here once you start earning EXP.</p></li>`;
      return;
    }
    el.activityList.innerHTML = state.activity
      .slice(0, 10)
      .map((a) => {
        const raw = a.text || "";
        let status = "Accepted";
        let statusClass = "lc-status-accepted";
        let diffLabel = "Task";
        let diffClass = "lc-diff-quest";
        let title = raw;
        let expText = "";

        // Check patterns
        const trialMatch = raw.match(/^\+(\d+)\s*EXP\s*—\s*Cleared\s*trial:\s*(.+)$/i);
        const questMatch = raw.match(/^\+(\d+)\s*EXP\s*—\s*Completed\s*quest:\s*(.+)$/i);
        const achieveMatch = raw.match(/^Achievement\s*unlocked:\s*(.+)$/i);
        const levelMatch = raw.match(/^Reached\s*Level\s*(.+)$/i);
        const expMatch = raw.match(/^\+(\d+)\s*EXP\s*—\s*(.+)$/i);

        if (trialMatch) {
          status = "Accepted";
          statusClass = "lc-status-accepted";
          expText = `+${trialMatch[1]} EXP`;
          title = trialMatch[2].trim();
          const found = CHALLENGES.find((c) => c.title.toLowerCase() === title.toLowerCase());
          const d = (found ? found.difficulty : "Medium").toLowerCase();
          diffLabel = d.charAt(0).toUpperCase() + d.slice(1);
          diffClass = d === "easy" ? "lc-diff-easy" : d === "hard" ? "lc-diff-hard" : "lc-diff-med";
        } else if (questMatch) {
          status = "Accepted";
          statusClass = "lc-status-accepted";
          expText = `+${questMatch[1]} EXP`;
          title = questMatch[2].trim();
          diffLabel = "Quest";
          diffClass = "lc-diff-quest";
        } else if (achieveMatch) {
          status = "Unlocked";
          statusClass = "lc-status-achieve";
          title = achieveMatch[1].trim();
          diffLabel = "Badge";
          diffClass = "lc-diff-gold";
        } else if (levelMatch) {
          status = "Rank Up";
          statusClass = "lc-status-level";
          title = `Reached Level ${levelMatch[1].trim()}`;
          diffLabel = "Level";
          diffClass = "lc-diff-cyan";
        } else if (expMatch) {
          status = "Accepted";
          statusClass = "lc-status-accepted";
          expText = `+${expMatch[1]} EXP`;
          title = expMatch[2].trim();
        }

        return `
        <li class="lc-sub-item">
          <div class="lc-sub-left">
            <span class="lc-sub-status ${statusClass}">${escapeHtml(status)}</span>
            <span class="lc-sub-title" title="${escapeHtml(title)}">${escapeHtml(title)}</span>
          </div>
          <div class="lc-sub-right">
            <span class="lc-sub-diff ${diffClass}">${escapeHtml(diffLabel)}</span>
            ${expText ? `<span class="lc-sub-exp">${escapeHtml(expText)}</span>` : ""}
            <span class="lc-sub-time">${timeAgo(a.time)}</span>
          </div>
        </li>`;
      })
      .join("");
  }
 
  // ---------------------------------------------------------
  // RENDER: quests
  // ---------------------------------------------------------
  function renderQuests() {
    let list = state.quests;
    if (questFilter === "active") list = list.filter((q) => !q.done);
    if (questFilter === "completed") list = list.filter((q) => q.done);
 
    if (!list.length) {
      const msg =
        questFilter === "completed"
          ? "No quests completed yet. Clear one to see it here."
          : "No quests yet. Create your first quest to start earning EXP.";
      el.questGrid.innerHTML = `<p class="empty-note">${msg}</p>`;
      return;
    }
 
    el.questGrid.innerHTML = list
      .slice()
      .reverse()
      .map((q) => `
        <div class="quest-card ${q.done ? "is-done" : ""}" data-id="${q.id}" tabindex="0" role="button" aria-label="Open ${escapeHtml(q.title)}">
          <div class="qc-top">
            <div>
              <span class="qc-cat">${escapeHtml(q.category)}</span>
              <div class="qc-title">${escapeHtml(q.title)}</div>
            </div>
            <span class="diff-tag">${DIFF_LABELS[q.exp] || "Custom"}</span>
          </div>
          ${q.notes ? `<p class="qc-notes">${escapeHtml(q.notes)}</p>` : ""}
          <div class="qc-bottom">
            <span class="qc-exp">${q.done ? "Cleared" : `+${q.exp} EXP`}</span>
            <div class="qc-actions">
              ${
                q.done
                  ? ""
                  : `<button class="qc-btn" data-complete="${q.id}" title="Mark complete" aria-label="Mark complete">
                      <svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z"/></svg>
                    </button>`
              }
              <button class="qc-btn danger" data-delete="${q.id}" title="Delete quest" aria-label="Delete quest">
                <svg viewBox="0 0 24 24"><path d="M6 7h12l-1 14H7L6 7Zm3-4h6l1 2H8l1-2ZM9 10v8m6-8v8"/></svg>
              </button>
            </div>
          </div>
        </div>`)
      .join("");
  }
 
  function addQuest(data) {
    state.quests.push({
      id: uid(),
      title: data.title,
      notes: data.notes,
      category: data.category,
      exp: Number(data.exp),
      done: false,
      createdAt: Date.now(),
    });
    saveState();
    render();
  }
 
  function updateQuest(id, data) {
    const q = state.quests.find((x) => x.id === id);
    if (!q) return;
    q.title = data.title;
    q.notes = data.notes;
    q.category = data.category;
    q.exp = Number(data.exp);
    saveState();
    render();
  }
 
  function completeQuest(id) {
    const q = state.quests.find((x) => x.id === id);
    if (!q || q.done) return;
    q.done = true;
    addExp(q.exp, `Quest cleared: ${q.title}`);
  }
 
  function deleteQuest(id) {
    state.quests = state.quests.filter((x) => x.id !== id);
    saveState();
    render();
  }
 
  // ---------------------------------------------------------
  // RENDER: challenge lab
  // ---------------------------------------------------------
  const CATEGORY_ICON = {
    coding: '<path d="M9 7 3 12l6 5 1.4-1.4L5.8 12l4.6-3.6L9 7Zm6 0-1.4 1.4L18.2 12l-4.6 3.6L15 17l6-5-6-5Z"/>',
    networking: '<path d="M12 3 3 8v2h2v9h4v-6h6v6h4v-9h2V8L12 3Zm0 2.3 6 3.4v.3H6v-.3l6-3.4Z"/>',
    sysadmin: '<path d="M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm1 2v12h14V6H5Zm1.6 2 3.6 3-3.6 3-1.2-1.4L8.4 11 5.4 9.4 6.6 8Zm5.4 6h6v2h-6v-2Z"/>',
  };
 
  function renderChallenges() {
    const items = CHALLENGES.filter((c) => c.cat === labCategory);
    if (!items.length) {
      el.challengeGrid.innerHTML = `<p class="empty-note">No trials in this track yet.</p>`;
      return;
    }
    el.challengeGrid.innerHTML = items
      .map((c, idx) => {
        const solved = state.solvedChallenges.includes(c.id);
        const isTargetCard = c.cat === "coding" || c.type === "python-lab" || (c.id && c.id.startsWith("py-level-"));
        return `
        <button class="challenge-card ${isTargetCard ? "python-neon-card" : ""} ${solved ? "is-solved" : ""}" data-id="${c.id}">
          <div class="cc-top">
            <div class="cc-left">
              <span class="cc-icon"><svg viewBox="0 0 24 24">${CATEGORY_ICON[c.cat] || ""}</svg></span>
              <span class="diff-tag">${c.difficulty}</span>
              ${c.type === "cli-lab" ? `<span class="diff-tag" style="background:#000080;color:#fff;border-color:#000080;font-weight:700;">CLI Lab</span>` : ""}
              ${c.type === "python-lab" ? `<span class="diff-tag" style="background:#005a36;color:#fff;border-color:#005a36;font-weight:700;">Python Lab</span>` : ""}
            </div>
            <span class="cc-check">
              <svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z"/></svg>
            </span>
          </div>
          <span class="cc-title">${escapeHtml(c.title)}</span>
          <div class="cc-divider"></div>
          <div class="cc-bottom">
            <span class="cc-exp-pill ${solved ? "is-cleared" : ""}">${solved ? "Cleared" : `+${c.exp} EXP`}</span>
          </div>
        </button>`;
      })
      .join("");
  }
 
  // ---------------------------------------------------------
  // RENDER: roadmap
  // ---------------------------------------------------------
  function renderRoadmap(rankInfo) {
    const pct = ((state.level - 1) / (MAX_LEVEL - 1)) * 100;
    el.roadmapFill.style.width = pct + "%";
    el.roadmapMarker.style.left = pct + "%";
    el.roadmapMarkerLv.textContent = state.level;
    $$(".zone").forEach((z) => z.classList.toggle("is-current", z.dataset.rank === rankInfo.rank));
  }

  // ---------------------------------------------------------
  // GLOBAL HUNTER LEADERBOARDS (REAL SUPABASE DATABASE ONLY)
  // ---------------------------------------------------------
  let currentRankFilter = "ALL";
  let currentSearchKeyword = "";
  let cachedLeaderboardUsers = [];
  let cachedMyStanding = null;
  let isLeaderboardLoading = false;
  let isLeaderboardRefreshing = false;
  let leaderboardError = null;
  let searchDebounceTimer = null;
  let activeLeaderboardTab = "global";

  function recordRegisteredHunter(hunterData) {
    // Safe bridge: triggers real-time leaderboard sync
    if (hunterData) {
      refreshLeaderboard(false);
    }
  }

  function renderLeaderboardSkeleton() {
    if (!el.leaderboardList) return;
    el.leaderboardList.innerHTML = Array.from({ length: 6 }).map(() => `
      <div class="lb-skeleton-row">
        <div class="lb-skeleton-box" style="width: 38px;"></div>
        <div style="display:flex; align-items:center; gap:12px; min-width:0;">
          <div class="lb-skeleton-box" style="width: 38px; height: 38px; border-radius: 50%; flex-shrink:0;"></div>
          <div style="display:flex; flex-direction:column; gap:6px; flex:1; min-width:0;">
            <div class="lb-skeleton-box" style="width: 120px; height: 13px;"></div>
            <div class="lb-skeleton-box" style="width: 75px; height: 10px;"></div>
          </div>
        </div>
        <div class="lb-skeleton-box" style="width: 55px;"></div>
        <div class="lb-skeleton-box" style="width: 80px;"></div>
        <div class="lb-skeleton-box" style="width: 72px; border-radius: 999px;"></div>
        <div class="lb-skeleton-box" style="width: 58px; border-radius: 999px;"></div>
      </div>
    `).join("");
  }

  function formatHunterRow(u, isForMyRankSection = false) {
    const isYou = Boolean(
      u.is_current_user ||
      (currentSupabaseUser && u.id === currentSupabaseUser.id) ||
      (state.name && u.name && u.name.toLowerCase() === state.name.toLowerCase() && !currentSupabaseUser)
    );
    const rankPos = u.global_rank;
    const rankLetter = u.rank_letter || (u.level ? rankInfoForLevel(u.level).rank : "E");
    const rankTitle = u.rank_title || getRankTitle(u.level || 1);

    let posBadgeHtml = `<span class="lb-pos-num">#${rankPos}</span>`;
    let posClass = "pos-standard";

    if (rankPos === 1) {
      posClass = "pos-gold";
      posBadgeHtml = `
        <span class="lb-trophy gold" title="1st Place · Sovereign Champion">
          <svg viewBox="0 0 24 24" class="svg-crown"><path d="M5 16 3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5Zm14 3c0 .55-.45 1-1 1H6c-.55 0-1-.45-1-1v-1h14v1Z"/></svg>
        </span>
        <span class="lb-pos-num">#1</span>
      `;
    } else if (rankPos === 2) {
      posClass = "pos-silver";
      posBadgeHtml = `
        <span class="lb-trophy silver" title="2nd Place · Grand Sovereign">
          <img class="lb-rank-icon-img rank-silver" src="/assets/silver_rank_icon.png" alt="Silver" style="width:16px;height:16px;" />
        </span>
        <span class="lb-pos-num">#2</span>
      `;
    } else if (rankPos === 3) {
      posClass = "pos-bronze";
      posBadgeHtml = `
        <span class="lb-trophy bronze" title="3rd Place · High Sovereign">
          <svg viewBox="0 0 24 24" class="svg-crown"><path d="M5 16 3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5Zm14 3c0 .55-.45 1-1 1H6c-.55 0-1-.45-1-1v-1h14v1Z"/></svg>
        </span>
        <span class="lb-pos-num">#3</span>
      `;
    }

    const initial = (u.name || "H").charAt(0).toUpperCase();
    const effectiveAvatarUrl = u.avatar_url || (isYou ? state.avatarUrl : null);
    const avatarHtml = effectiveAvatarUrl
      ? `
        <div class="lb-avatar-wrap rank-${rankLetter.toLowerCase()}">
          <img src="${escapeHtml(effectiveAvatarUrl)}" class="lb-avatar-img" alt="${escapeHtml(u.name || "Hunter")}" onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='grid';" />
          <div class="lb-avatar-circle rank-${rankLetter.toLowerCase()}" style="display:none;">
            <span>${escapeHtml(initial)}</span>
          </div>
        </div>
      `
      : `
        <div class="lb-avatar-wrap rank-${rankLetter.toLowerCase()}">
          <div class="lb-avatar-circle rank-${rankLetter.toLowerCase()}">
            <span>${escapeHtml(initial)}</span>
          </div>
        </div>
      `;

    return `
      <div class="lb-row ${isYou ? "is-you" : ""} ${posClass} ${isForMyRankSection ? "is-my-rank-row" : ""}" data-user-id="${escapeHtml(u.id || "")}">
        <div class="col-pos">
          <div class="lb-pos-pill ${posClass}">${posBadgeHtml}</div>
        </div>
        <div class="col-hunter">
          <div class="lb-hunter-wrap">
            ${avatarHtml}
            <div class="lb-hunter-details">
              <div class="lb-hunter-name-row">
                <span class="lb-hunter-name">${escapeHtml(u.name || "Hunter")}</span>
                ${isYou ? '<span class="lb-you-badge">YOU</span>' : ""}
              </div>
              <div class="lb-hunter-guild">${escapeHtml(u.guild || "Hunter Association")}</div>
            </div>
          </div>
        </div>
        <div class="col-level">
          <span class="lb-level-pill">Level ${u.level || 1}</span>
        </div>
        <div class="col-exp">
          <div class="lb-exp-pill">
            <span class="lb-exp-value">${Number(u.total_exp || 0).toLocaleString()}</span>
            <span class="lb-exp-unit">XP</span>
          </div>
        </div>
        <div class="col-tier">
          <span class="lb-tier-pill tier-${rankTitle.toLowerCase()}">
            ${escapeHtml(rankTitle)}
          </span>
        </div>
        <div class="col-clearance">
          <span class="lb-rank-badge rank-${rankLetter.toLowerCase()}">
            Rank ${rankLetter}
          </span>
        </div>
        <div class="col-actions">
          <button class="lb-inspect-btn" type="button" data-inspect-id="${escapeHtml(u.id || "")}" title="View Hunter Profile &amp; CRUD Dossier">
            <span>Profile</span>
            <svg viewBox="0 0 24 24" style="width:11px;height:11px;fill:currentColor;"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
          </button>
        </div>
      </div>
    `;
  }

  function renderLeaderboard() {
    if (!el.leaderboardList) return;

    if (isLeaderboardLoading && (!cachedLeaderboardUsers || cachedLeaderboardUsers.length === 0)) {
      renderLeaderboardSkeleton();
      return;
    }

    if (leaderboardError && (!cachedLeaderboardUsers || cachedLeaderboardUsers.length === 0)) {
      el.leaderboardList.innerHTML = `
        <div class="lb-error-state">
          <div class="lb-error-icon">⚠️</div>
          <div class="lb-error-title">Database Connection Issue</div>
          <div class="lb-error-msg">${escapeHtml(leaderboardError)}</div>
          <button class="lb-retry-btn" id="lbRetryBtn" type="button">Retry Supabase Sync</button>
        </div>
      `;
      const retryBtn = $("#lbRetryBtn");
      if (retryBtn) retryBtn.addEventListener("click", () => refreshLeaderboard(true));
      return;
    }

    // Determine current user's standing for top banner & my-rank card
    const myPos = cachedMyStanding?.global_rank;
    const myName = currentSupabaseUser ? (cachedMyStanding?.name || state.name || "Hunter") : (state.name || "Hunter");
    const myLevel = cachedMyStanding?.level || state.level || 1;
    const myTotalExp = cachedMyStanding?.total_exp != null ? cachedMyStanding.total_exp : Math.max(state.totalExp || 0, state.exp || 0);
    const myRankTitle = cachedMyStanding?.rank_title || getRankTitle(myLevel);
    const myRankInfo = rankInfoForLevel(myLevel);

    // Update Top Standing Banner
    if (el.myStandingRankPos) {
      el.myStandingRankPos.textContent = myPos ? `#${myPos}` : (currentSupabaseUser ? "#--" : "Guest");
    }
    if (el.myStandingName) el.myStandingName.textContent = myName;
    if (el.myStandingTier) el.myStandingTier.textContent = myRankTitle;
    if (el.myStandingLevel) el.myStandingLevel.textContent = `Level ${myLevel}`;
    if (el.myStandingExp) el.myStandingExp.textContent = `${Number(myTotalExp).toLocaleString()} XP`;
    if (el.myStandingRankLetter) el.myStandingRankLetter.textContent = `Rank ${myRankInfo.rank}`;
    if (el.myStandingSyncStatus) {
      el.myStandingSyncStatus.textContent = currentSupabaseUser ? "Cloud Synced" : "Local Mode";
    }

    // Filter by rank title / rank letter if chosen
    let displayedUsers = cachedLeaderboardUsers || [];
    if (currentRankFilter !== "ALL") {
      displayedUsers = displayedUsers.filter((u) => {
        return (u.rank_title && u.rank_title.toLowerCase() === currentRankFilter.toLowerCase()) ||
               (u.rank_letter && u.rank_letter.toLowerCase() === currentRankFilter.toLowerCase());
      });
    }

    // Filter by client search keyword if searched
    if (currentSearchKeyword.trim()) {
      const q = currentSearchKeyword.trim().toLowerCase();
      displayedUsers = displayedUsers.filter((u) => (u.name || "").toLowerCase().includes(q));
    }

    // Update count pill
    if (el.leaderboardUserCount) {
      const totalCount = cachedLeaderboardUsers.length;
      if (currentSearchKeyword.trim() || currentRankFilter !== "ALL") {
        el.leaderboardUserCount.textContent = `${displayedUsers.length} of ${totalCount} Hunters`;
      } else {
        el.leaderboardUserCount.textContent = `${totalCount} ${totalCount === 1 ? "Hunter" : "Hunters"} Ranked`;
      }
    }

    // Render empty state if no users match
    if (displayedUsers.length === 0) {
      if (currentSearchKeyword.trim()) {
        el.leaderboardList.innerHTML = `
          <div class="lb-empty-state">
            <div class="lb-empty-icon">🔍</div>
            <div class="lb-empty-title">No Hunters Found</div>
            <div class="lb-empty-sub">
              No registered hunters found matching "<b>${escapeHtml(currentSearchKeyword.trim())}</b>".
            </div>
            <button class="lb-retry-btn" id="lbClearSearchFilterBtn" type="button">Clear Search</button>
          </div>
        `;
        const clearBtn = $("#lbClearSearchFilterBtn");
        if (clearBtn) {
          clearBtn.addEventListener("click", () => {
            if (el.leaderboardSearchInput) el.leaderboardSearchInput.value = "";
            if (el.leaderboardSearchClear) el.leaderboardSearchClear.style.display = "none";
            currentSearchKeyword = "";
            renderLeaderboard();
          });
        }
      } else if (currentRankFilter !== "ALL") {
        const rankIconMap = {
          "Bronze": "/assets/bronze_rank_icon.png",
          "Silver": "/assets/silver_rank_icon.png",
          "Gold": "/assets/gold_rank_icon.png",
          "Platinum": "/assets/platinum_rank_icon.png",
        };
        const rankIconSrc = rankIconMap[currentRankFilter] || "/assets/silver_rank_icon.png";
        const rankClass = currentRankFilter.toLowerCase();

        el.leaderboardList.innerHTML = `
          <div class="lb-empty-state">
            <div class="lb-empty-icon">
              <img class="lb-empty-rank-icon rank-${rankClass}" src="${rankIconSrc}" alt="${escapeHtml(currentRankFilter)}" />
            </div>
            <div class="lb-empty-title">No ${escapeHtml(currentRankFilter)} Hunters Yet</div>
            <div class="lb-empty-sub">
              No registered hunters currently hold ${escapeHtml(currentRankFilter)} tier rank. Complete high-tier quests and lab trials to elevate your standing!
            </div>
            <button class="lb-retry-btn" id="lbClearRankFilterBtn" type="button">Show All Ranks</button>
          </div>
        `;
        const clearRankBtn = $("#lbClearRankFilterBtn");
        if (clearRankBtn) {
          clearRankBtn.addEventListener("click", () => {
            currentRankFilter = "ALL";
            $$("[data-rank-filter]").forEach((b) => b.classList.toggle("is-active", b.dataset.rankFilter === "ALL"));
            renderLeaderboard();
          });
        }
      } else {
        el.leaderboardList.innerHTML = `
          <div class="lb-empty-state">
            <div class="lb-empty-icon">🏆</div>
            <div class="lb-empty-title">Global Leaderboard Ready</div>
            <div class="lb-empty-sub">
              Rankings are calculated directly from registered users in your Supabase database. Sign up or log in to take the #1 spot!
            </div>
            ${!currentSupabaseUser ? '<button class="lb-auth-btn" id="lbAuthCtaBtn" type="button">Authenticate Hunter</button>' : ''}
          </div>
        `;
        const authBtn = $("#lbAuthCtaBtn");
        if (authBtn) {
          authBtn.addEventListener("click", () => openModal("modalAuth"));
        }
      }
      return;
    }

    // Render list rows
    el.leaderboardList.innerHTML = displayedUsers.map((u) => formatHunterRow(u, false)).join("");

    // ---------------------------------------------------------
    // "MY RANK" SECTION (If current user is outside Top 100)
    // ---------------------------------------------------------
    if (el.leaderboardMyRankSection && el.myRankCardContainer) {
      const isUserInTop100 = cachedLeaderboardUsers.some((u) => {
        return (currentSupabaseUser && u.id === currentSupabaseUser.id) ||
               (u.is_current_user) ||
               (state.name && u.name && u.name.toLowerCase() === state.name.toLowerCase() && !currentSupabaseUser);
      });

      const userRankNumber = Number(cachedMyStanding?.global_rank);
      const isRankBeyond100 = userRankNumber > 100 || (!isUserInTop100 && userRankNumber > 0);

      if (isRankBeyond100 && (cachedMyStanding || currentSupabaseUser)) {
        el.leaderboardMyRankSection.style.display = "block";
        const myRankData = cachedMyStanding || {
          id: currentSupabaseUser?.id || "my-rank-user",
          name: state.name || "Hunter",
          level: state.level || 1,
          total_exp: Math.max(state.totalExp || 0, state.exp || 0),
          global_rank: myPos || ">100",
          rank_title: myRankTitle,
          rank_letter: myRankInfo.rank,
          avatar_url: null,
          is_current_user: true,
          guild: state.guild || "Hunter Association",
        };
        el.myRankCardContainer.innerHTML = formatHunterRow({ ...myRankData, is_current_user: true }, true);
      } else {
        el.leaderboardMyRankSection.style.display = "none";
        el.myRankCardContainer.innerHTML = "";
      }
    }

    // Bind clicks to open Leaderboard Hunter Profile & CRUD Dossier
    const bindRowClicks = (container) => {
      if (!container) return;
      container.querySelectorAll(".lb-row").forEach((row) => {
        row.addEventListener("click", () => {
          const userId = row.getAttribute("data-user-id");
          if (userId) {
            openHunterProfileModalById(userId);
          }
        });
      });
    };
    bindRowClicks(el.leaderboardList);
    if (el.myRankCardContainer) bindRowClicks(el.myRankCardContainer);

    const myStandingCard = $("#myStandingCard");
    if (myStandingCard && !myStandingCard.__boundProfileClick) {
      myStandingCard.__boundProfileClick = true;
      myStandingCard.style.cursor = "pointer";
      myStandingCard.setAttribute("title", "Click to inspect your hunter dossier & database profile");
      myStandingCard.addEventListener("click", () => {
        const myId = currentSupabaseUser?.id || cachedMyStanding?.id || "current-user";
        openHunterProfileModalById(myId);
      });
    }
  }

  async function refreshLeaderboard(showToastNotice = false) {
    if (isLeaderboardRefreshing) return;
    isLeaderboardRefreshing = true;
    isLeaderboardLoading = true;
    leaderboardError = null;

    if (el.leaderboardRefreshBtn) {
      el.leaderboardRefreshBtn.classList.add("is-loading");
    }

    try {
      const currentUserId = currentSupabaseUser?.id || null;
      const result = await fetchGlobalLeaderboard({
        currentUserId,
        limit: 100,
        searchQuery: currentSearchKeyword.trim() || null,
      });

      cachedLeaderboardUsers = result.users || [];
      cachedMyStanding = result.myStanding || null;

      // Fallback: If guest or unauthenticated, compute synthetic local standing
      if (!cachedMyStanding) {
        const localTotalExp = Math.max(state.totalExp || 0, state.exp || 0);
        const match = cachedLeaderboardUsers.find((u) => u.name && u.name.toLowerCase() === (state.name || "").toLowerCase());
        if (match) {
          cachedMyStanding = { ...match, is_current_user: true };
        } else {
          const ahead = cachedLeaderboardUsers.filter((u) => (Number(u.total_exp) || 0) > localTotalExp).length;
          cachedMyStanding = {
            id: "guest-user",
            name: state.name || "Hunter",
            level: state.level || 1,
            total_exp: localTotalExp,
            global_rank: ahead + 1,
            rank_title: getRankTitle(state.level || 1),
            rank_letter: rankInfoForLevel(state.level || 1).rank,
            is_current_user: true,
          };
        }
      }

      isLeaderboardLoading = false;
      renderLeaderboard();

      if (showToastNotice) {
        playSuccess();
        const count = cachedLeaderboardUsers.length;
        showToast(`🏆 <b>Global Leaderboard Synced</b>: ${count} real ${count === 1 ? "hunter" : "hunters"} ranked.`);
      }
    } catch (err) {
      console.warn("Could not refresh leaderboard:", err);
      leaderboardError = err?.message || "Failed to load rankings from Supabase.";
      isLeaderboardLoading = false;
      renderLeaderboard();
      if (showToastNotice) {
        showToast("Notice: Could not connect to Supabase Cloud rankings. Check connection.");
      }
    } finally {
      isLeaderboardRefreshing = false;
      if (el.leaderboardRefreshBtn) {
        el.leaderboardRefreshBtn.classList.remove("is-loading");
      }
    }
  }
 
  // ---------------------------------------------------------
  // RENDER: progress calendar (Month Matrix with Spaced Months)
  // ---------------------------------------------------------
  // RENDER: progress calendar (Gap-Free Day in a Box Matrix & Month Grid)
  // ---------------------------------------------------------
  const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const FULL_MONTH_NAMES = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  function expToLevel(exp) {
    if (!exp) return 0;
    if (exp < 50) return 1;
    if (exp < 100) return 2;
    if (exp < 200) return 3;
    return 4;
  }

  let calNavInitialized = false;
  let currentCalViewMode = "heatmap"; // "heatmap" | "month"
  let selectedMonthDetailYear = 2026;
  let selectedMonthDetailIndex = 8; // September

  function renderCalendar() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    selectedMonthDetailYear = today.getFullYear();
    selectedMonthDetailIndex = today.getMonth();

    // Build past 12-13 months (from 12 months ago through current month)
    const monthBlocks = [];
    const numMonths = 12; // 12 past months + current month = 13 months
    for (let offset = numMonths; offset >= 0; offset--) {
      const d = new Date(today.getFullYear(), today.getMonth() - offset, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const isCurrentMonth = (year === today.getFullYear() && month === today.getMonth());
      const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sunday

      // Construct columns strictly for THIS month only:
      // - Each month calculates its own firstDayOfMonth and daysInMonth
      // - Leading & trailing slots are pure empty placeholders with the same box dimensions
      // - Zero dates from another month overflow into this month's data grid
      const columns = [];
      let curCol = [];

      // Leading empty placeholders for firstDayOfWeek (Sunday = 0, Monday = 1, Tuesday = 2, ...)
      for (let s = 0; s < firstDayOfWeek; s++) {
        curCol.push({ isEmpty: true, date: null });
      }

      // Days belonging exclusively to THIS month (dayNum 1 through totalDaysInMonth)
      for (let dayNum = 1; dayNum <= totalDaysInMonth; dayNum++) {
        curCol.push({
          date: new Date(year, month, dayNum),
          dayNum,
          isEmpty: false,
        });
        if (curCol.length === 7) {
          columns.push(curCol);
          curCol = [];
        }
      }

      // Trailing empty placeholders to complete the last 7-day column
      if (curCol.length > 0) {
        while (curCol.length < 7) {
          curCol.push({ isEmpty: true, date: null });
        }
        columns.push(curCol);
      }

      monthBlocks.push({
        year,
        month,
        name: MONTH_ABBR[month],
        fullName: FULL_MONTH_NAMES[month],
        isCurrentMonth,
        columns,
      });
    }

    let totalYearExp = 0;
    const monthExpMap = {};

    // Generate Month Cards: Solid columns with every day in a box
    const monthCardsHtml = monthBlocks.map((b) => {
      let monthExp = 0;

      const colsHtml = b.columns.map((col) => {
        const colCells = col.map((cell) => {
          if (cell.isEmpty || !cell.date) {
            return `<span class="cal-cell is-empty" aria-hidden="true"></span>`;
          }

          const day = cell.date;
          const dayTime = day.getTime();
          const todayTime = today.getTime();
          const isToday = (dayTime === todayTime);
          const isFuture = (dayTime > todayTime);

          const key = dateKey(day);
          const exp = !isFuture ? (state.dailyExp[key] || 0) : 0;
          if (exp > 0) {
            monthExp += exp;
            totalYearExp += exp;
          }

          const level = expToLevel(exp);
          const dayName = day.toLocaleDateString(undefined, { weekday: "short" });
          const dateStr = day.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

          let cellClass = "cal-cell";
          if (isToday) cellClass += " is-today";
          if (isFuture) cellClass += " is-future";

          let tooltipStatus = "0 EXP earned";
          if (isFuture) tooltipStatus = "Upcoming Day";
          else if (isToday) tooltipStatus = exp > 0 ? `+${exp} EXP (Today)` : "Today (Active)";
          else if (exp > 0) tooltipStatus = `+${exp} EXP earned`;

          const tooltipLabel = `${dayName}, ${dateStr}: ${tooltipStatus}`;

          return `<span class="${cellClass}" data-level="${level}" data-date="${escapeHtml(dayName + ", " + dateStr)}" data-exp="${exp}" data-date-key="${key}" data-is-today="${isToday ? '1' : '0'}" data-is-future="${isFuture ? '1' : '0'}" title="${escapeHtml(tooltipLabel)}"></span>`;
        }).join("");
        return colCells;
      }).join("");

      const monthKey = b.year + "-" + b.month;
      monthExpMap[monthKey] = monthExp;

      const expBadge = monthExp > 0
        ? `<span class="cal-month-exp-tag">+${monthExp.toLocaleString()} XP</span>`
        : (b.isCurrentMonth ? `<span class="cal-month-current-pill">Current</span>` : "");

      return (
        `<div class="cal-month-card ${b.isCurrentMonth ? 'is-current-month' : ''}" id="calMonth-${b.year}-${b.month}" data-month-key="${monthKey}" data-year="${b.year}" data-month="${b.month}">` +
          `<div class="cal-month-head" title="Click to inspect full ${b.fullName} calendar">` +
            `<div class="cal-month-title-wrap">` +
              `<span class="cal-month-title">${b.name}</span>` +
              `<span class="cal-month-year">${b.year}</span>` +
            `</div>` +
            expBadge +
          `</div>` +
          `<div class="cal-month-matrix">` +
            colsHtml +
          `</div>` +
        `</div>`
      );
    }).join("");

    if (el.calendarMonthsFlow) {
      el.calendarMonthsFlow.innerHTML = monthCardsHtml;
    }

    // Quick jump pills in nav toolbar
    if (el.calNavQuickMonths) {
      el.calNavQuickMonths.innerHTML = monthBlocks.map((b) => {
        const monthKey = b.year + "-" + b.month;
        const hasExp = (monthExpMap[monthKey] || 0) > 0;
        return (
          `<button class="cal-nav-month-pill ${b.isCurrentMonth ? 'is-active' : ''}" data-month-target="calMonth-${b.year}-${b.month}" data-year="${b.year}" data-month="${b.month}" type="button" title="Jump to ${b.name} ${b.year}">` +
            `<span>${b.name}</span>` +
            (hasExp ? `<span class="cal-nav-dot"></span>` : "") +
          `</button>`
        );
      }).join("");
    }

    if (el.calendarCaption) {
      el.calendarCaption.textContent = totalYearExp.toLocaleString() + " EXP earned in the last year";
    }

    // Render detailed month view as well
    renderMonthDetailView(selectedMonthDetailYear, selectedMonthDetailIndex);

    // Setup navigation listeners and tooltip once
    setupCalendarInteractions();

    // Auto-scroll to today on initial load / render so user sees current activity
    setTimeout(() => {
      if (el.calendarScroll) {
        el.calendarScroll.scrollLeft = el.calendarScroll.scrollWidth;
      }
    }, 60);
  }

  function renderMonthDetailView(year, month) {
    const detailPanel = el.calendarMonthDetail || $("#calendarMonthDetail");
    if (!detailPanel) return;

    selectedMonthDetailYear = year;
    selectedMonthDetailIndex = month;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const monthName = FULL_MONTH_NAMES[month];
    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sunday
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    let monthTotalExp = 0;
    let monthActiveDays = 0;

    // Collect all grid days strictly for THIS month only:
    // Leading and trailing slots are pure empty placeholders with no foreign dates
    const gridDays = [];

    // Leading empty placeholders for firstDayOfWeek (Sunday-start grid)
    for (let s = 0; s < firstDayOfWeek; s++) {
      gridDays.push({ isEmpty: true, date: null });
    }

    // In-month days exclusively (1 through totalDaysInMonth)
    for (let dayNum = 1; dayNum <= totalDaysInMonth; dayNum++) {
      const d = new Date(year, month, dayNum);
      const key = dateKey(d);
      const isPastOrToday = d.getTime() <= today.getTime();
      const exp = isPastOrToday ? (state.dailyExp[key] || 0) : 0;
      if (exp > 0) {
        monthTotalExp += exp;
        monthActiveDays++;
      }
      gridDays.push({ date: d, dayNum, isEmpty: false, exp });
    }

    // Trailing empty placeholders to fill full 7-day rows
    while (gridDays.length % 7 !== 0) {
      gridDays.push({ isEmpty: true, date: null });
    }

    const weekdays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const weekdaysHtml = weekdays.map((w) => `<div>${w}</div>`).join("");

    const daysHtml = gridDays.map((item) => {
      if (item.isEmpty || !item.date) {
        return `<div class="cal-md-day-box is-empty" aria-hidden="true"></div>`;
      }

      const d = item.date;
      const dayNum = item.dayNum || d.getDate();
      const dTime = d.getTime();
      const todayTime = today.getTime();
      const isToday = (dTime === todayTime);
      const isFuture = (dTime > todayTime);
      const exp = item.exp || 0;
      const key = dateKey(d);

      let boxClass = "cal-md-day-box";
      if (isToday) boxClass += " is-today";
      if (exp > 0) boxClass += " has-exp";
      if (isFuture) boxClass += " is-future";

      let expBadgeHtml = "";
      if (exp > 0) {
        expBadgeHtml = `<span class="cal-md-day-exp">+${exp} XP</span>`;
      } else if (isFuture) {
        expBadgeHtml = `<span class="cal-md-day-exp" style="color:var(--dim); opacity:0.6;">Upcoming</span>`;
      } else {
        expBadgeHtml = `<span class="cal-md-day-exp" style="color:var(--dim); opacity:0.4;">0 XP</span>`;
      }

      const dateLabel = d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
      const tt = `${dateLabel}: ${exp > 0 ? `+${exp} EXP earned` : isFuture ? 'Upcoming Day' : '0 EXP'}`;

      return (
        `<div class="${boxClass}" data-date-key="${key}" title="${escapeHtml(tt)}">` +
          `<span class="cal-md-day-num">${dayNum}</span>` +
          (isToday ? `<span class="cal-md-today-tag">Today</span>` : "") +
          expBadgeHtml +
        `</div>`
      );
    }).join("");

    detailPanel.innerHTML = (
      `<div class="cal-md-head">` +
        `<div class="cal-md-title-wrap">` +
          `<button class="cal-md-nav-btn" id="calMdPrevMonthBtn" type="button" title="Previous Month">` +
            `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m15 18-6-6 6-6"/></svg>` +
          `</button>` +
          `<span class="cal-md-title">${monthName} ${year}</span>` +
          `<button class="cal-md-nav-btn" id="calMdNextMonthBtn" type="button" title="Next Month">` +
            `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>` +
          `</button>` +
        `</div>` +
        `<div class="cal-md-meta">` +
          `<span class="cal-md-exp-pill">+${monthTotalExp.toLocaleString()} EXP Earned</span>` +
          `<span style="color:var(--dim);">Active Days: <b style="color:var(--paper);">${monthActiveDays}</b></span>` +
        `</div>` +
      `</div>` +
      `<div class="cal-md-grid-wrap">` +
        `<div class="cal-md-weekdays-row">${weekdaysHtml}</div>` +
        `<div class="cal-md-days-grid">${daysHtml}</div>` +
      `</div>`
    );

    // Month detail header buttons
    const prevBtn = $("#calMdPrevMonthBtn");
    const nextBtn = $("#calMdNextMonthBtn");
    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        let prevM = selectedMonthDetailIndex - 1;
        let prevY = selectedMonthDetailYear;
        if (prevM < 0) { prevM = 11; prevY--; }
        renderMonthDetailView(prevY, prevM);
        playClick();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        let nextM = selectedMonthDetailIndex + 1;
        let nextY = selectedMonthDetailYear;
        if (nextM > 11) { nextM = 0; nextY++; }
        renderMonthDetailView(nextY, nextM);
        playClick();
      });
    }
  }

  function setupCalendarInteractions() {
    if (calNavInitialized) return;
    calNavInitialized = true;

    // View Switcher (Heatmap vs Month Grid)
    const btnHeatmap = el.calViewHeatmapBtn || $("#calViewHeatmapBtn");
    const btnMonth = el.calViewMonthBtn || $("#calViewMonthBtn");
    const scrollContainer = el.calendarScroll || $("#calendarScroll");
    const monthDetailPanel = el.calendarMonthDetail || $("#calendarMonthDetail");

    function setCalView(mode) {
      currentCalViewMode = mode;
      if (mode === "heatmap") {
        if (btnHeatmap) btnHeatmap.classList.add("is-active");
        if (btnMonth) btnMonth.classList.remove("is-active");
        if (scrollContainer) scrollContainer.style.display = "block";
        if (monthDetailPanel) monthDetailPanel.style.display = "none";
      } else {
        if (btnMonth) btnMonth.classList.add("is-active");
        if (btnHeatmap) btnHeatmap.classList.remove("is-active");
        if (scrollContainer) scrollContainer.style.display = "none";
        if (monthDetailPanel) monthDetailPanel.style.display = "flex";
        renderMonthDetailView(selectedMonthDetailYear, selectedMonthDetailIndex);
      }
      playClick();
    }

    if (btnHeatmap) {
      btnHeatmap.addEventListener("click", () => setCalView("heatmap"));
    }
    if (btnMonth) {
      btnMonth.addEventListener("click", () => setCalView("month"));
    }

    // Quick month jump buttons
    if (el.calNavQuickMonths) {
      el.calNavQuickMonths.addEventListener("click", (e) => {
        const btn = e.target.closest(".cal-nav-month-pill");
        if (!btn) return;
        const targetId = btn.dataset.monthTarget;
        const year = parseInt(btn.dataset.year || "2026", 10);
        const month = parseInt(btn.dataset.month || "8", 10);

        if (currentCalViewMode === "month") {
          renderMonthDetailView(year, month);
        } else {
          const targetCard = document.getElementById(targetId);
          if (targetCard && el.calendarScroll) {
            const scrollTarget = targetCard.offsetLeft - el.calendarScroll.offsetLeft - 30;
            el.calendarScroll.scrollTo({ left: Math.max(0, scrollTarget), behavior: "smooth" });
          }
        }
        $$(".cal-nav-month-pill").forEach((p) => p.classList.remove("is-active"));
        btn.classList.add("is-active");
        playClick();
      });
    }

    // Clicking month card header in heatmap opens detailed month view
    if (el.calendarMonthsFlow) {
      el.calendarMonthsFlow.addEventListener("click", (e) => {
        const head = e.target.closest(".cal-month-head");
        if (!head) return;
        const card = head.closest(".cal-month-card");
        if (!card) return;
        const year = parseInt(card.dataset.year || "2026", 10);
        const month = parseInt(card.dataset.month || "8", 10);
        setCalView("month");
        renderMonthDetailView(year, month);
      });
    }

    // Prev / Next / Today buttons
    if (el.calNavPrevBtn) {
      el.calNavPrevBtn.addEventListener("click", () => {
        if (currentCalViewMode === "month") {
          let prevM = selectedMonthDetailIndex - 1;
          let prevY = selectedMonthDetailYear;
          if (prevM < 0) { prevM = 11; prevY--; }
          renderMonthDetailView(prevY, prevM);
        } else if (el.calendarScroll) {
          el.calendarScroll.scrollBy({ left: -240, behavior: "smooth" });
        }
        playClick();
      });
    }
    if (el.calNavNextBtn) {
      el.calNavNextBtn.addEventListener("click", () => {
        if (currentCalViewMode === "month") {
          let nextM = selectedMonthDetailIndex + 1;
          let nextY = selectedMonthDetailYear;
          if (nextM > 11) { nextM = 0; nextY++; }
          renderMonthDetailView(nextY, nextM);
        } else if (el.calendarScroll) {
          el.calendarScroll.scrollBy({ left: 240, behavior: "smooth" });
        }
        playClick();
      });
    }
    if (el.calNavTodayBtn) {
      el.calNavTodayBtn.addEventListener("click", () => {
        const now = new Date();
        if (currentCalViewMode === "month") {
          renderMonthDetailView(now.getFullYear(), now.getMonth());
        } else if (el.calendarScroll) {
          el.calendarScroll.scrollTo({ left: el.calendarScroll.scrollWidth, behavior: "smooth" });
          const currentPill = $(".cal-nav-month-pill:last-child");
          if (currentPill) {
            $$(".cal-nav-month-pill").forEach((p) => p.classList.remove("is-active"));
            currentPill.classList.add("is-active");
          }
        }
        playClick();
      });
    }

    // Custom floating tooltip for quick inspection
    const tooltip = el.calFloatingTooltip || $("#calFloatingTooltip");
    if (tooltip && el.calendarMonthsFlow) {
      let activeCell = null;

      const positionTooltip = (e) => {
        if (!tooltip || !activeCell) return;
        const pad = 12;
        let x = e.clientX;
        let y = e.clientY - pad;
        const rect = tooltip.getBoundingClientRect();
        if (x - rect.width / 2 < 12) x = rect.width / 2 + 12;
        if (x + rect.width / 2 > window.innerWidth - 12) x = window.innerWidth - rect.width / 2 - 12;
        tooltip.style.left = x + "px";
        tooltip.style.top = y + "px";
      };

      el.calendarMonthsFlow.addEventListener("mouseover", (e) => {
        const cell = e.target.closest(".cal-cell");
        if (!cell) {
          tooltip.style.display = "none";
          activeCell = null;
          return;
        }
        activeCell = cell;
        const date = cell.dataset.date || "";
        const exp = parseInt(cell.dataset.exp || "0", 10);
        const isToday = cell.dataset.isToday === "1";
        const isFuture = cell.dataset.isFuture === "1";

        let expClass = "cal-tt-exp-zero";
        let statusText = "No Submissions";
        let expText = "0 EXP";

        if (exp > 0) {
          expClass = "cal-tt-exp-positive";
          statusText = isToday ? "Activity Completed Today" : "Hunter Activity Recorded";
          expText = "+" + exp + " EXP";
        } else if (isToday) {
          expClass = "cal-tt-exp-positive";
          statusText = "Current Active Day (Today)";
          expText = "Today";
        } else if (isFuture) {
          statusText = "Upcoming Day";
          expText = "Pending";
        }

        tooltip.innerHTML = (
          `<div class="cal-tt-date">${date}</div>` +
          `<div class="cal-tt-body">` +
            `<span class="cal-tt-pill ${expClass}">${expText}</span>` +
            `<span class="cal-tt-status">${statusText}</span>` +
          `</div>`
        );
        tooltip.style.display = "block";
        positionTooltip(e);
      });

      el.calendarMonthsFlow.addEventListener("mousemove", (e) => {
        if (activeCell) positionTooltip(e);
      });

      el.calendarMonthsFlow.addEventListener("mouseleave", () => {
        tooltip.style.display = "none";
        activeCell = null;
      });
    }
  }
 
  // ---------------------------------------------------------
  // RENDER: achievements
  // ---------------------------------------------------------
  function renderAchievements() {
    const unlocked = state.unlockedAchievements;
    const total = ACHIEVEMENTS.length;
    const pct = total ? (unlocked.length / total) * 100 : 0;
    el.achUnlockedCount.textContent = `${unlocked.length}/${total}`;
    if (el.achProgressFill) el.achProgressFill.style.width = pct + "%";
    if (el.achProgressLabel) el.achProgressLabel.textContent = `${unlocked.length} of ${total} unlocked`;
 
    el.achievementGrid.innerHTML = ACHIEVEMENT_GROUPS.map((group) => {
      const items = ACHIEVEMENTS.filter((a) => a.group === group.key);
      if (!items.length) return "";
      const cardsHtml = items
        .map((a) => {
          const isUnlocked = unlocked.includes(a.id);
          return `
            <div class="achievement-card ${isUnlocked ? "is-unlocked" : ""}">
              ${!isUnlocked ? `<span class="ach-lock"><svg viewBox="0 0 24 24"><path d="M12 2a4 4 0 0 0-4 4v3H7a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-1V6a4 4 0 0 0-4-4Zm2 7H10V6a2 2 0 1 1 4 0v3Z"/></svg></span>` : ""}
              <span class="ach-icon"><svg viewBox="0 0 24 24">${group.icon}</svg></span>
              <span class="ach-title">${escapeHtml(a.title)}</span>
              <span class="ach-desc">${escapeHtml(a.desc)}</span>
            </div>`;
        })
        .join("");
      return `
        <div class="ach-group">
          <div class="ach-group-head">
            <svg viewBox="0 0 24 24" class="ach-group-icon">${group.icon}</svg>
            <span>${group.label}</span>
          </div>
          <div class="achievement-grid">${cardsHtml}</div>
        </div>`;
    }).join("");
  }
 
  function checkAchievements() {
    let unlockedSomething = false;
    ACHIEVEMENTS.forEach((a) => {
      if (state.unlockedAchievements.includes(a.id)) return;
      if (a.check(state)) {
        state.unlockedAchievements.push(a.id);
        logActivity(`Achievement unlocked: ${a.title}`);
        showToast(`🏅 Achievement unlocked — <b>${escapeHtml(a.title)}</b>`);
        playUnlock();
        unlockedSomething = true;
      }
    });
    if (unlockedSomething) {
      saveState();
      renderAchievements();
    }
  }
 
  // ---------------------------------------------------------
  // NAVIGATION
  // ---------------------------------------------------------
  const VIEW_TITLES = {
    dashboard: "Hunter Status",
    quests: "Quest Log",
    lab: "Challenge Lab",
    leaderboard: "Global Leaderboard",
    roadmap: "Global Leaderboard",
    achievements: "Achievements",
  };
 
  function switchView(view) {
    const targetView = (view === "roadmap") ? "leaderboard" : view;
    $$(".nav-item").forEach((b) => {
      const bView = b.dataset.view;
      b.classList.toggle("is-active", bView === view || (view === "roadmap" && bView === "leaderboard") || (view === "leaderboard" && bView === "roadmap"));
    });
    $$(".view").forEach((v) => v.classList.remove("is-active"));
    const targetEl = $(`#view-${targetView}`);
    if (targetEl) targetEl.classList.add("is-active");
    el.viewTitle.textContent = VIEW_TITLES[view] || VIEW_TITLES[targetView] || "Xeli";

    if (view === "leaderboard" || view === "roadmap") {
      if (view === "roadmap") {
        switchLeaderboardTab("progression");
      }
      refreshLeaderboard(false);
    }
  }
 
  $$("[data-view]").forEach((btn) => btn.addEventListener("click", () => switchView(btn.dataset.view)));

  // Leaderboard Tab Controller: Global Top 100 vs Rank Progression
  function switchLeaderboardTab(tab) {
    activeLeaderboardTab = tab;
    $$("#leaderboardTabs [data-tab]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.tab === tab);
    });
    if (tab === "progression") {
      if (el.roadmapSubpanel) el.roadmapSubpanel.style.display = "block";
    } else {
      if (el.roadmapSubpanel) el.roadmapSubpanel.style.display = "none";
    }
  }

  $$("#leaderboardTabs [data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => switchLeaderboardTab(btn.dataset.tab));
  });

  // Leaderboard Search Input with Debounce
  if (el.leaderboardSearchInput) {
    el.leaderboardSearchInput.addEventListener("input", (e) => {
      const val = e.target.value || "";
      if (el.leaderboardSearchClear) {
        el.leaderboardSearchClear.style.display = val.trim() ? "block" : "none";
      }
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        currentSearchKeyword = val;
        renderLeaderboard();
      }, 200);
    });
  }

  // Clear Search Input Button
  if (el.leaderboardSearchClear) {
    el.leaderboardSearchClear.addEventListener("click", () => {
      if (el.leaderboardSearchInput) {
        el.leaderboardSearchInput.value = "";
        el.leaderboardSearchInput.focus();
      }
      el.leaderboardSearchClear.style.display = "none";
      currentSearchKeyword = "";
      renderLeaderboard();
    });
  }

  // Leaderboard filters & refresh button listeners
  $$("[data-rank-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$("[data-rank-filter]").forEach((b) => b.classList.toggle("is-active", b === btn));
      currentRankFilter = btn.dataset.rankFilter || "ALL";
      renderLeaderboard();
    });
  });

  if (el.leaderboardRefreshBtn) {
    el.leaderboardRefreshBtn.addEventListener("click", () => {
      refreshLeaderboard(true);
    });
  }

  // Realtime Supabase Subscription for Global Leaderboard
  let leaderboardRealtimeChannel = null;
  function initLeaderboardRealtime() {
    if (leaderboardRealtimeChannel) return;
    try {
      leaderboardRealtimeChannel = subscribeToLeaderboardChanges(() => {
        // Automatically sync latest rankings when any hunter completes quests or earns XP in Supabase
        refreshLeaderboard(false);
      });
    } catch (err) {
      console.warn("Could not subscribe to leaderboard realtime changes:", err);
    }
  }
 
  // ---------------------------------------------------------
  // MODALS
  // ---------------------------------------------------------
  function openModal(id) {
    $(`#${id}`).classList.add("is-open");
  }
  function closeModal(id) {
    $(`#${id}`).classList.remove("is-open");
    if (id === "modalChallenge") {
      toggleChallengeFullscreen(false, true);
      const m = $("#modalChallenge .modal");
      if (m) {
        m.classList.remove("modal-cli-lab");
        m.classList.remove("modal-binary-lab");
      }
    }
  }
  $$("[data-close]").forEach((btn) =>
    btn.addEventListener("click", () => closeModal(btn.dataset.close))
  );
  $$(".modal-overlay").forEach((overlay) =>
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.classList.remove("is-open");
        if (overlay.id === "modalChallenge") {
          toggleChallengeFullscreen(false, true);
        }
        const m = overlay.querySelector(".modal");
        if (m) {
          m.classList.remove("modal-cli-lab");
          m.classList.remove("modal-binary-lab");
        }
      }
    })
  );

  // ---------------------------------------------------------
  // CHALLENGE LAB FULL SCREEN CONTROLLER
  // ---------------------------------------------------------
  function toggleChallengeFullscreen(forceState, silent = false) {
    const overlay = $("#modalChallenge");
    const modal = $("#modalChallenge .modal");
    const fsBtn = $("#modalChallengeFullscreenBtn");
    const fsText = $("#modalChallengeFsText");
    const tabFsBtn = $("#cliTabBtnFullscreen");
    const tabFsLabel = tabFsBtn ? tabFsBtn.querySelector(".cli-fs-btn-label") : null;

    if (!overlay || !modal) return;

    const isCurrentlyFs = overlay.classList.contains("is-fullscreen");
    const willBeFs = typeof forceState === "boolean" ? forceState : !isCurrentlyFs;

    if (willBeFs) {
      overlay.classList.add("is-fullscreen");
      modal.classList.add("is-fullscreen");
      if (fsBtn) {
        fsBtn.classList.add("is-active");
        fsBtn.setAttribute("title", "Exit Full Screen (Esc / F)");
      }
      if (fsText) fsText.textContent = "Exit Full Screen";
      if (tabFsBtn) {
        tabFsBtn.classList.add("is-active");
        tabFsBtn.setAttribute("title", "Exit Full Screen (Esc / F)");
      }
      if (tabFsLabel) tabFsLabel.textContent = "Exit Full Screen";

      // Attempt OS / Browser Fullscreen if permitted
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch (err) {}
    } else {
      overlay.classList.remove("is-fullscreen");
      modal.classList.remove("is-fullscreen");
      if (fsBtn) {
        fsBtn.classList.remove("is-active");
        fsBtn.setAttribute("title", "Full Screen Lab (F / Esc)");
      }
      if (fsText) fsText.textContent = "Full Screen";
      if (tabFsBtn) {
        tabFsBtn.classList.remove("is-active");
        tabFsBtn.setAttribute("title", "Toggle Full Screen Lab View (F / Esc)");
      }
      if (tabFsLabel) tabFsLabel.textContent = "Full Screen";

      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      } catch (err) {}
    }

    if (!silent && state.soundEnabled && typeof playSuccess === "function") {
      playSuccess();
    }

    // Trigger canvas & terminal layout re-computations
    setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 40);
    setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 180);
  }

  const modalChallengeFsBtn = $("#modalChallengeFullscreenBtn");
  if (modalChallengeFsBtn) {
    modalChallengeFsBtn.addEventListener("click", () => {
      toggleChallengeFullscreen();
    });
  }

  // Keyboard shortcut listener for Fullscreen toggle (F) and Escape
  document.addEventListener("keydown", (e) => {
    const overlay = $("#modalChallenge");
    if (!overlay || !overlay.classList.contains("is-open")) return;

    // If Escape is pressed while in fullscreen, exit fullscreen first
    if (e.key === "Escape" && overlay.classList.contains("is-fullscreen")) {
      e.preventDefault();
      e.stopPropagation();
      toggleChallengeFullscreen(false);
      return;
    }

    // If 'f' or 'F' is pressed outside of typing fields, toggle fullscreen
    if ((e.key === "f" || e.key === "F") && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const active = document.activeElement;
      const isInput = active && (
        active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.isContentEditable ||
        active.id === "cliHiddenInput"
      );
      if (!isInput) {
        e.preventDefault();
        toggleChallengeFullscreen();
      }
    }
  });

  // Listen to browser fullscreen changes to keep UI synchronized
  document.addEventListener("fullscreenchange", () => {
    const overlay = $("#modalChallenge");
    if (!overlay) return;
    if (!document.fullscreenElement && overlay.classList.contains("is-fullscreen")) {
      window.dispatchEvent(new Event("resize"));
    }
  });
 
  // ---------------------------------------------------------
  // QUEST FORM (create + edit share the same modal)
  // ---------------------------------------------------------
  let editingQuestId = null;
 
  function openQuestForm(quest) {
    editingQuestId = quest ? quest.id : null;
    $("#modalQuestTitle").textContent = quest ? "Edit Quest" : "Log a New Quest";
    $("#questForm button[type='submit']").textContent = quest ? "Save Changes" : "Add Quest";
    $("#questTitle").value = quest ? quest.title : "";
    $("#questNotes").value = quest ? quest.notes || "" : "";
    $("#questCategory").value = quest ? quest.category : "General";
    $("#questDifficulty").value = quest ? String(quest.exp) : "50";
    openModal("modalQuest");
    $("#questTitle").focus();
  }
 
  $("#openQuestModal").addEventListener("click", () => openQuestForm(null));
 
  $("#questForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const title = $("#questTitle").value.trim();
    if (!title) return;
    const data = {
      title,
      notes: $("#questNotes").value.trim(),
      category: $("#questCategory").value,
      exp: $("#questDifficulty").value,
    };
    if (editingQuestId) {
      updateQuest(editingQuestId, data);
      showToast(`Quest updated: <b>${escapeHtml(title)}</b>`);
    } else {
      addQuest(data);
      showToast(`Quest logged: <b>${escapeHtml(title)}</b>`);
    }
    editingQuestId = null;
    e.target.reset();
    closeModal("modalQuest");
  });
 
  $("#questGrid").addEventListener("click", (e) => {
    const completeId = e.target.closest("[data-complete]")?.dataset.complete;
    const deleteId = e.target.closest("[data-delete]")?.dataset.delete;
    if (completeId) { e.stopPropagation(); completeQuest(completeId); return; }
    if (deleteId) { e.stopPropagation(); deleteQuest(deleteId); return; }
    const card = e.target.closest(".quest-card");
    if (card) openQuestDetail(card.dataset.id);
  });
 
  $("#questGrid").addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest(".quest-card");
    if (!card) return;
    e.preventDefault();
    openQuestDetail(card.dataset.id);
  });

  // ---------------------------------------------------------
  // DASHBOARD ACTIVE QUESTS EVENTS
  // ---------------------------------------------------------
  el.dashQuestList.addEventListener("click", (e) => {
    const completeBtn = e.target.closest("[data-dash-complete]");
    if (completeBtn) {
      e.stopPropagation();
      completeQuest(completeBtn.dataset.dashComplete);
      return;
    }
    const questItem = e.target.closest(".mini-quest");
    if (questItem) {
      openQuestDetail(questItem.dataset.id);
    }
  });

  el.dashQuestList.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const questItem = e.target.closest(".mini-quest");
    if (questItem) {
      e.preventDefault();
      openQuestDetail(questItem.dataset.id);
    }
  });
 
  // ---------------------------------------------------------
  // QUEST DETAIL MODAL
  // ---------------------------------------------------------
  function openQuestDetail(id) {
    const q = state.quests.find((x) => x.id === id);
    if (!q) return;
    $("#qdTitle").textContent = q.title;
    $("#qdMeta").textContent = `${q.category} · ${DIFF_LABELS[q.exp] || "Custom"} · ${q.exp} EXP${q.done ? " · Cleared" : ""}`;
    $("#qdNotes").textContent = q.notes || "No notes added for this quest.";
 
    const actions = $("#qdActions");
    actions.innerHTML = `
      ${q.done ? "" : `<button class="btn btn-primary" id="qdComplete">Mark Complete</button>`}
      <button class="btn btn-ghost" id="qdEdit">Edit</button>
      <button class="btn btn-ghost" id="qdDelete">Delete</button>
    `;
    if (!q.done) {
      $("#qdComplete").addEventListener("click", () => {
        completeQuest(q.id);
        closeModal("modalQuestDetail");
      });
    }
    $("#qdEdit").addEventListener("click", () => {
      closeModal("modalQuestDetail");
      openQuestForm(q);
    });
    $("#qdDelete").addEventListener("click", () => {
      deleteQuest(q.id);
      closeModal("modalQuestDetail");
    });
 
    openModal("modalQuestDetail");
  }
 
  $("#questTabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;
    questFilter = btn.dataset.filter;
    $$("#questTabs .tab").forEach((t) => t.classList.toggle("is-active", t === btn));
    renderQuests();
  });
 
  // ---------------------------------------------------------
  // HUNTER NAME
  // ---------------------------------------------------------
  el.hunterNameInput.addEventListener("change", () => {
    const val = el.hunterNameInput.value.trim() || "Hunter";
    state.name = val;
    saveState();
    render();
  });

 
  // ---------------------------------------------------------
  // LAB TABS
  // ---------------------------------------------------------
  $("#labTabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;
    labCategory = btn.dataset.cat;
    $$("#labTabs .tab").forEach((t) => t.classList.toggle("is-active", t === btn));
    renderChallenges();
  });
 
  // ---------------------------------------------------------
  // CHALLENGE MODAL
  // ---------------------------------------------------------
  let pyodidePromise = null;
  function getPyodide() {
    if (!pyodidePromise) {
      pyodidePromise = window.loadPyodide();
    }
    return pyodidePromise;
  }
 
  $("#challengeGrid").addEventListener("click", (e) => {
    const card = e.target.closest("[data-id]");
    if (!card) return;
    const challenge = CHALLENGES.find((c) => c.id === card.dataset.id);
    if (challenge) openChallenge(challenge);
  });
 
  function openChallenge(c) {
    const solved = state.solvedChallenges.includes(c.id);
    $("#chTitle").textContent = c.title;
    $("#chMeta").textContent = `${labLabel(c.cat)} · ${c.difficulty} · ${c.exp} EXP${solved ? " · Cleared" : ""}`;
 
    const body = $("#chBody");
    const type = c.type || "code";

    if (type === "cli-lab") {
      const modalBox = $("#modalChallenge .modal");
      if (modalBox) {
        modalBox.classList.add("modal-cli-lab");
        modalBox.classList.remove("modal-binary-lab");
      }
      renderCliLabChallenge(c, solved, (claimedChallenge) => {
        awardChallenge(claimedChallenge);
        showToast(`Cleared ${claimedChallenge.title}! +${claimedChallenge.exp} EXP earned.`);
      });
    } else if (type === "binary-lab") {
      const modalBox = $("#modalChallenge .modal");
      if (modalBox) {
        modalBox.classList.remove("modal-cli-lab");
        modalBox.classList.add("modal-binary-lab");
      }
      renderBinaryLabChallenge(c, solved, (claimedChallenge) => {
        awardChallenge(claimedChallenge);
        showToast(`Cleared ${claimedChallenge.title}! +${claimedChallenge.exp} EXP earned.`);
      });
    } else if (type === "python-lab") {
      const modalBox = $("#modalChallenge .modal");
      if (modalBox) {
        modalBox.classList.add("modal-cli-lab");
        modalBox.classList.remove("modal-binary-lab");
      }
      renderPythonLabChallenge(
        c,
        solved,
        (claimedChallenge) => {
          awardChallenge(claimedChallenge);
          showToast(`Cleared ${claimedChallenge.title}! +${claimedChallenge.exp} EXP earned.`);
        },
        getPyodide
      );
    } else {
      const modalBox = $("#modalChallenge .modal");
      if (modalBox) {
        modalBox.classList.remove("modal-cli-lab");
        modalBox.classList.remove("modal-binary-lab");
      }

      if (type === "code") {
        body.innerHTML = `
        <p class="ch-prompt">${c.prompt}</p>
        <textarea class="code-editor" id="codeEditor" spellcheck="false">${escapeHtml(c.starter)}</textarea>
        <div class="run-row">
          <button class="btn btn-primary" id="runCodeBtn">▶ Run Trial</button>
          <span class="run-status" id="runStatus"></span>
        </div>
        <div class="console" id="consoleOut"></div>
      `;
      // allow tab key in editor
      const editor = $("#codeEditor");
      editor.addEventListener("keydown", (e2) => {
        if (e2.key === "Tab") {
          e2.preventDefault();
          const s = editor.selectionStart, en = editor.selectionEnd;
          editor.value = editor.value.slice(0, s) + "    " + editor.value.slice(en);
          editor.selectionStart = editor.selectionEnd = s + 4;
        }
      });
      $("#runCodeBtn").addEventListener("click", () => runCodeChallenge(c));
    } else if (type === "mcq") {
      body.innerHTML = `
        <p class="ch-prompt">${c.prompt}</p>
        <div class="mcq-list" id="mcqList">
          ${c.options
            .map(
              (opt, i) => `
            <label class="mcq-option" data-index="${i}">
              <input type="radio" name="mcq" value="${i}">
              <span>${escapeHtml(opt)}</span>
            </label>`
            )
            .join("")}
        </div>
        <div class="result-banner" id="resultBanner"></div>
        <div class="modal-actions">
          <button class="btn btn-primary" id="submitAnswerBtn">Submit Answer</button>
        </div>
      `;
      $$(".mcq-option").forEach((opt) =>
        opt.addEventListener("click", () => {
          $$(".mcq-option").forEach((o) => o.classList.remove("is-selected"));
          opt.classList.add("is-selected");
          opt.querySelector("input").checked = true;
        })
      );
      $("#submitAnswerBtn").addEventListener("click", () => {
        const chosen = document.querySelector('input[name="mcq"]:checked');
        if (!chosen) return;
        const idx = Number(chosen.value);
        const pass = idx === c.answerIndex;
        $$(".mcq-option").forEach((o, i) => {
          if (i === c.answerIndex) o.classList.add("is-correct");
          else if (i === idx && !pass) o.classList.add("is-wrong");
        });
        showResult(pass, c);
      });
    } else if (type === "input") {
      body.innerHTML = `
        <p class="ch-prompt">${c.prompt}</p>
        <div class="field input-answer">
          <span>Your answer</span>
          <input type="text" id="answerInput" autocomplete="off" placeholder="Type your answer...">
        </div>
        <div class="result-banner" id="resultBanner"></div>
        <div class="modal-actions">
          <button class="btn btn-primary" id="submitAnswerBtn">Submit Answer</button>
        </div>
      `;
      const submit = () => {
        const val = $("#answerInput").value.trim().toLowerCase().replace(/\s+/g, " ");
        const expected = c.answer.trim().toLowerCase().replace(/\s+/g, " ");
        showResult(val === expected, c);
      };
      $("#submitAnswerBtn").addEventListener("click", submit);
      $("#answerInput").addEventListener("keydown", (e2) => {
        if (e2.key === "Enter") submit();
      });
    } else if (type === "lab") {
      renderLabChallenge(c, solved);
    }
  }
 
    openModal("modalChallenge");
    // Default to regular modal view (NOT fullscreen). Fullscreen button is always available in the header & tab bar.
    toggleChallengeFullscreen(false, true);
  }
 
  function renderLabChallenge(c, solved) {
    const body = $("#chBody");
    let checkIndex = 0;
 
    const sectionsHtml = c.sections
      .map((section) => {
        const checklistHtml = (section.checklist || [])
          .map((item) => {
            const id = `labcheck-${checkIndex++}`;
            return `
              <label class="lab-check-item" for="${id}">
                <input type="checkbox" id="${id}" class="lab-check" ${solved ? "checked disabled" : ""}>
                <span>${escapeHtml(item)}</span>
              </label>`;
          })
          .join("");
 
        let reflectionHtml = "";
        if (section.reflection) {
          const r = section.reflection;
          const fieldHtml =
            r.type === "note"
              ? `<textarea class="lab-reflection-input lab-note" rows="3"
                  placeholder="${escapeHtml(r.placeholder || "")}" ${solved ? "disabled" : ""}></textarea>`
              : `<div class="lab-reflection-grid">
                  ${Array.from({ length: r.count || 1 })
                    .map(
                      (_, i) => `
                    <input type="text" class="lab-reflection-input" data-idx="${i}"
                      placeholder="${escapeHtml(r.placeholder || "")} ${i + 1}"
                      ${solved ? "disabled" : ""}>`
                    )
                    .join("")}
                </div>`;
          reflectionHtml = `
            <div class="lab-reflection">
              <span class="lab-reflection-label">${escapeHtml(r.label)}</span>
              ${fieldHtml}
            </div>`;
        }
 
        return `
          <div class="lab-section">
            <h4 class="lab-heading">${escapeHtml(section.heading)}</h4>
            <p class="lab-body">${section.body}</p>
            ${checklistHtml ? `<div class="lab-checklist">${checklistHtml}</div>` : ""}
            ${reflectionHtml}
          </div>`;
      })
      .join("");
 
    body.innerHTML = `
      <p class="ch-prompt">${c.intro}</p>
      ${sectionsHtml}
      <div class="result-banner" id="resultBanner"></div>
      <div class="lab-claim-row">
        <span class="lab-progress" id="labProgress"></span>
        <button class="btn btn-primary" id="submitLabBtn" ${solved ? "disabled" : ""}>
          ${solved ? "EXP Claimed" : "Claim EXP"}
        </button>
      </div>
    `;
 
    if (solved) {
      $("#labProgress").textContent = "All steps complete";
      return;
    }
 
    const totalItems = () => $$(".lab-check").length + $$(".lab-reflection-input").length;
    const doneItems = () =>
      $$(".lab-check").filter((cb) => cb.checked).length +
      $$(".lab-reflection-input").filter((inp) => inp.value.trim().length > 0).length;
 
    const validate = () => {
      const done = doneItems();
      const total = totalItems();
      $("#labProgress").textContent = `${done}/${total} done`;
      $("#submitLabBtn").disabled = done < total;
    };
 
    $$(".lab-check").forEach((cb) => cb.addEventListener("change", validate));
    $$(".lab-reflection-input").forEach((inp) => inp.addEventListener("input", validate));
    validate();
 
    $("#submitLabBtn").addEventListener("click", () => {
      if (doneItems() < totalItems()) return;
      showResult(true, c);
      $$(".lab-check, .lab-reflection-input").forEach((elx) => (elx.disabled = true));
      $("#submitLabBtn").disabled = true;
      $("#submitLabBtn").textContent = "EXP Claimed";
      $("#labProgress").textContent = "All steps complete";
    });
  }
 
  function labLabel(cat) {
    return { coding: "Coding · Python", networking: "Networking", sysadmin: "System & Sysadmin" }[cat] || cat;
  }
 
  function showResult(pass, c) {
    const banner = $("#resultBanner");
    banner.classList.add("is-open");
    if (pass) {
      banner.classList.remove("lose");
      banner.classList.add("win");
      banner.innerHTML = c.type === "lab" ? `<b>Claimed.</b> EXP added.` : `<b>Correct.</b> Trial cleared.`;
      awardChallenge(c);
    } else {
      banner.classList.remove("win");
      banner.classList.add("lose");
      banner.innerHTML = `<b>Not quite.</b> Review the prompt and try again.`;
      playError();
    }
  }
 
  async function runCodeChallenge(c) {
    const btn = $("#runCodeBtn");
    const status = $("#runStatus");
    const consoleOut = $("#consoleOut");
    const code = $("#codeEditor").value;
 
    btn.disabled = true;
    consoleOut.classList.add("is-open");
    status.textContent = "Booting Python engine…";
    consoleOut.textContent = "";
 
    try {
      const pyodide = await getPyodide();
      status.textContent = "Running trial…";
 
      let defineError = null;
      try {
        await pyodide.runPythonAsync(code);
      } catch (err) {
        defineError = err;
      }
 
      if (defineError) {
        consoleOut.innerHTML = `<span class="bad-line">${escapeHtml(String(defineError.message || defineError))}</span>`;
        status.textContent = "Syntax / runtime error.";
        playError();
        btn.disabled = false;
        return;
      }
 
      let passCount = 0;
      const lines = [];
      for (let i = 0; i < c.tests.length; i++) {
        const test = c.tests[i];
        try {
          pyodide.globals.set("__args", pyodide.toPy(test.args));
          const pyResult = await pyodide.runPythonAsync("solve(*__args)");
          let jsResult;
          try {
            jsResult = pyResult && typeof pyResult.toJs === "function" ? pyResult.toJs({ dict_converter: Object.fromEntries }) : pyResult;
          } catch (convErr) {
            jsResult = pyResult;
          }
          const pass = deepEqual(jsResult, test.expected);
          if (pass) passCount++;
          lines.push(
            `${pass ? "PASS" : "FAIL"}  test ${i + 1}: solve(${test.args.map((a) => JSON.stringify(a)).join(", ")}) → ${JSON.stringify(
              jsResult
            )}${pass ? "" : `  expected ${JSON.stringify(test.expected)}`}`
          );
        } catch (err) {
          lines.push(`FAIL  test ${i + 1}: runtime error — ${err.message || err}`);
        }
      }
 
      consoleOut.innerHTML = lines
        .map((l) => `<span class="${l.startsWith("PASS") ? "ok-line" : "bad-line"}">${escapeHtml(l)}</span>`)
        .join("\n");
 
      const allPass = passCount === c.tests.length;
      status.textContent = `${passCount}/${c.tests.length} tests passed.`;
      btn.disabled = false;
 
      if (allPass) {
        consoleOut.innerHTML += `\n<span class="ok-line">All tests passed. Trial cleared.</span>`;
        awardChallenge(c);
      } else {
        playError();
      }
    } catch (fatal) {
      status.textContent = "Engine failed to load.";
      consoleOut.innerHTML = `<span class="bad-line">${escapeHtml(String(fatal.message || fatal))}</span>`;
      btn.disabled = false;
    }
  }
 
  function awardChallenge(c) {
    if (state.solvedChallenges.includes(c.id)) {
      showToast(`Already cleared — practice run only.`);
      return;
    }
    state.solvedChallenges.push(c.id);

    // Dynamically increment problem stats (e.g. 59 -> 60 -> 61...)
    if (!state.problemStats) {
      state.problemStats = {
        solvedTotal: 59,
        totalProblems: 76,
        solvedEasy: 2,
        totalEasy: 10,
        solvedMedium: 40,
        totalMedium: 46,
        solvedHard: 17,
        totalHard: 20,
      };
    }
    const diff = (c.difficulty || "medium").toLowerCase();
    state.problemStats.solvedTotal = (Number(state.problemStats.solvedTotal) || 59) + 1;
    if (diff === "easy") {
      state.problemStats.solvedEasy = (Number(state.problemStats.solvedEasy) || 2) + 1;
    } else if (diff === "hard") {
      state.problemStats.solvedHard = (Number(state.problemStats.solvedHard) || 17) + 1;
    } else {
      state.problemStats.solvedMedium = (Number(state.problemStats.solvedMedium) || 40) + 1;
    }

    renderChallenges();
    addExp(c.exp, `Trial cleared: ${c.title}`);

    // Automatically sync progress to cloud and refresh leaderboard live
    syncToSupabaseCloud(true).then(() => {
      refreshLeaderboard(false);
    });
  }
 
  // ---------------------------------------------------------
  // LEVEL UP / TOASTS & AWAKENING FX
  // ---------------------------------------------------------
  function triggerRankBadgeAwakening() {
    const badge = el.rankBadgeBig || $("#rankBadgeBig");
    const fxContainer = $("#rankAwakeningFx");
    if (!badge) return;

    badge.classList.remove("is-awakening");
    if (fxContainer) fxContainer.innerHTML = "";
    void badge.offsetWidth; // Force reflow to restart CSS keyframe animation

    badge.classList.add("is-awakening");

    if (fxContainer) {
      // Spawn 2 expanding shockwave rings
      const ring1 = document.createElement("div");
      ring1.className = "awakening-shockwave";
      fxContainer.appendChild(ring1);

      setTimeout(() => {
        if (!fxContainer) return;
        const ring2 = document.createElement("div");
        ring2.className = "awakening-shockwave awakening-shockwave-secondary";
        fxContainer.appendChild(ring2);
      }, 160);

      // Spawn radiant Awakening energy particles
      const particleCount = 32;
      const colors = ["#00d2ff", "#ffffff", "#38bdf8", "#facc15", "#60a5fa", "#a7f3d0"];

      for (let i = 0; i < particleCount; i++) {
        const p = document.createElement("div");
        p.className = "awakening-particle";

        const angle = (i * (360 / particleCount) + (Math.random() * 20 - 10)) * (Math.PI / 180);
        const distance = 46 + Math.random() * 64;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;
        const size = 3 + Math.random() * 5;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const duration = 1.0 + Math.random() * 0.7;
        const delay = Math.random() * 0.12;

        p.style.setProperty("--tx", `${tx}px`);
        p.style.setProperty("--ty", `${ty}px`);
        p.style.width = `${size}px`;
        p.style.height = `${size}px`;
        p.style.background = color;
        p.style.boxShadow = `0 0 ${Math.round(size * 2.2)}px ${color}`;
        p.style.animationDuration = `${duration}s`;
        p.style.animationDelay = `${delay}s`;

        fxContainer.appendChild(p);
      }

      // Spawn ascending mana vapor motes
      for (let j = 0; j < 12; j++) {
        const v = document.createElement("div");
        v.className = "awakening-vapor";
        const vx = (Math.random() - 0.5) * 60;
        const vy = -40 - Math.random() * 50;
        const vColor = j % 2 === 0 ? "#00d2ff" : "#ffffff";
        v.style.setProperty("--vx", `${vx}px`);
        v.style.setProperty("--vy", `${vy}px`);
        v.style.background = vColor;
        v.style.boxShadow = `0 0 8px ${vColor}`;
        v.style.animationDelay = `${0.2 + Math.random() * 0.35}s`;
        v.style.animationDuration = `${1.3 + Math.random() * 0.5}s`;
        fxContainer.appendChild(v);
      }
    }

    setTimeout(() => {
      badge.classList.remove("is-awakening");
      if (fxContainer) fxContainer.innerHTML = "";
    }, 2500);
  }

  function showLevelUp(level, newRank) {
    el.levelupNumber.textContent = level;
    el.levelupRankline.textContent = newRank ? `Rank ascended to ${newRank}` : "";
    const avatarData = getHunterAvatar(level);
    if (el.levelupAvatarImg && el.levelupAvatarPreview) {
      if (avatarData && avatarData.url) {
        el.levelupAvatarImg.src = avatarData.url;
        el.levelupAvatarPreview.style.display = "block";
      } else {
        el.levelupAvatarPreview.style.display = "none";
      }
    }
    el.levelupOverlay.classList.add("is-open");
    setTimeout(() => el.levelupOverlay.classList.remove("is-open"), 2400);

    // Trigger Rank Badge Awakening Glow & Particle Burst
    triggerRankBadgeAwakening();
  }
  el.levelupOverlay.addEventListener("click", () => el.levelupOverlay.classList.remove("is-open"));

  if (el.hunterAvatar) {
    el.hunterAvatar.addEventListener("click", () => {
      const avatarData = getHunterAvatar(state.level);
      showToast(`🪪 <b>${avatarData ? escapeHtml(avatarData.stageTitle) : "Hunter Avatar"}</b>: ${avatarData && avatarData.description ? escapeHtml(avatarData.description) : "System clearance verified."}`);
      beep(560, 0.08, "square", 0.05, 0);
    });
  }

  if (el.rankBadgeBig) {
    el.rankBadgeBig.addEventListener("click", () => {
      triggerRankBadgeAwakening();
      playLevelUp();
      const currentRank = rankInfoForLevel(state.level);
      showToast(`⚡ <b>Awakening Resonance</b>: Rank ${currentRank.rank} (${currentRank.title}) Mana Surge activated!`);
    });
  }
 
  function showToast(html) {
    const t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = html;
    el.toastStack.appendChild(t);
    setTimeout(() => {
      t.classList.add("leaving");
      setTimeout(() => t.remove(), 300);
    }, 3200);
  }
 
  // ---------------------------------------------------------
  // BACKUP & RESTORE
  // ---------------------------------------------------------
  $("#openBackupModal").addEventListener("click", () => {
    $("#backupFileStatus").textContent = "Choose a backup file…";
    $("#importFileInput").value = "";
    $("#importProgressBtn").disabled = true;
    openModal("modalBackup");
  });
 
  $("#exportProgressBtn").addEventListener("click", () => {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `xeli-progress-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("Backup file downloaded.");
  });
 
  let pendingImportFile = null;
  $("#importFileInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    pendingImportFile = file || null;
    $("#backupFileStatus").textContent = file ? file.name : "Choose a backup file…";
    $("#importProgressBtn").disabled = !file;
  });
 
  $("#importProgressBtn").addEventListener("click", () => {
    if (!pendingImportFile) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (typeof parsed !== "object" || parsed === null || typeof parsed.level !== "number") {
          throw new Error("Not a valid XELI backup file.");
        }
        state = sanitizeState(parsed);
        saveState();
        render();
        closeModal("modalBackup");
        showToast("Progress restored from backup.");
      } catch (err) {
        $("#backupFileStatus").textContent = "Invalid backup file.";
        $("#importProgressBtn").disabled = true;
      }
    };
    reader.readAsText(pendingImportFile);
  });
 
  // ---------------------------------------------------------
  // SOUND TOGGLE (TACTILE ROCKER SWITCH SYSTEM)
  // ---------------------------------------------------------
  function syncSoundLabel() {
    const label = $("#soundBtnLabel");
    if (label) label.textContent = state.soundEnabled ? "Sound: On" : "Sound: Off";
    const masterSwitch = $("#toggles");
    if (masterSwitch && masterSwitch.checked !== Boolean(state.soundEnabled)) {
      masterSwitch.checked = Boolean(state.soundEnabled);
    }
  }

  const masterRocker = $("#toggles");
  if (masterRocker) {
    masterRocker.checked = Boolean(state.soundEnabled);
    masterRocker.addEventListener("change", () => {
      state.soundEnabled = masterRocker.checked;
      saveState();
      syncSoundLabel();
      if (state.soundEnabled) {
        playSuccess();
      }
    });
  }

  const soundBtn = $("#toggleSoundBtn");
  if (soundBtn) {
    soundBtn.addEventListener("click", () => {
      state.soundEnabled = !state.soundEnabled;
      saveState();
      syncSoundLabel();
      if (state.soundEnabled) playSuccess();
    });
  }
  syncSoundLabel();
 
  // ---------------------------------------------------------
  // RESET PROGRESS
  // ---------------------------------------------------------
  // ---------------------------------------------------------
  // SUPABASE CLOUD CONNECTION & SYNC CORE
  // ---------------------------------------------------------
  let currentSupabaseUser = null;
  let supabaseSyncTimeout = null;

  function formatAuthError(err) {
    if (!err) return "An unknown error occurred during authentication.";
    const msg = err.message || String(err);
    if (msg.includes("Invalid login credentials") || msg.includes("invalid_credentials") || msg.includes("invalid_grant")) {
      return "Invalid email or passkey. Please verify credentials.";
    }
    if (msg.includes("User already registered") || msg.includes("already_exists") || msg.includes("unique constraint")) {
      return "This email is already registered. Please click 'Sign In' instead.";
    }
    if (msg.includes("Password should be at least 6 characters")) {
      return "Security passkey must be at least 6 characters long.";
    }
    if (msg.includes("Email rate limit exceeded") || msg.includes("over_email_send_rate_limit")) {
      return "Too many requests. Please wait a moment before trying again.";
    }
    if (msg.includes("Email not confirmed")) {
      return "Please confirm your email address via the link sent to your inbox.";
    }
    if (msg.includes("popup_closed") || msg.includes("OAuth cancelled") || msg.includes("access_denied")) {
      return "Google sign-in was cancelled or access was denied.";
    }
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
      return "Network communication error. Check your connection to Supabase.";
    }
    return msg;
  }

  async function updateSupabaseConnectionStatus(conn) {
    const topDot = $("#supabaseTopStatusDot");
    const sideDot = $("#supabaseSidebarDot");
    const modalDot = $("#supabaseModalStatusDot");
    const pingVal = $("#supabasePingVal");
    const topLabel = $("#supabaseBtnLabel");
    const sideState = $("#supabaseSidebarState");
    const cloudStatusVal = $("#supabaseCloudStatusVal");

    const dots = [topDot, sideDot, modalDot].filter(Boolean);
    if (conn.ok) {
      dots.forEach((d) => {
        d.classList.remove("is-checking", "is-offline");
        d.classList.add("is-connected");
      });
      if (pingVal) pingVal.textContent = `${conn.latency}ms`;
      if (topLabel) topLabel.textContent = `Supabase: Online (${conn.latency}ms)`;
      if (sideState) {
        sideState.textContent = "ONLINE";
        sideState.style.color = "#008000";
      }
      if (cloudStatusVal) cloudStatusVal.textContent = "Connected (Protected Cloud Node)";
    } else {
      dots.forEach((d) => {
        d.classList.remove("is-connected", "is-checking");
        d.classList.add("is-offline");
      });
      if (pingVal) pingVal.textContent = "Offline";
      if (topLabel) topLabel.textContent = "Supabase: Offline";
      if (sideState) {
        sideState.textContent = "OFFLINE";
        sideState.style.color = "#aa0000";
      }
      if (cloudStatusVal) cloudStatusVal.textContent = `Offline: ${conn.error || "Network error"}`;
    }
  }

  function updateSupabaseAuthUi() {
    const signedOutSec = $("#supabaseSignedOutSection");
    const signedInSec = $("#supabaseSignedInSection");
    const userEmailVal = $("#supabaseUserEmailVal");
    const userIdVal = $("#supabaseUserIdVal");
    const lastSyncVal = $("#supabaseLastSyncedVal");
    const autoSyncCheckbox = $("#supabaseAutoSyncCheckbox");
    const loginBtnLabel = $("#loginBtnLabel");
    const quickLogOutBtn = $("#quickLogOutBtn");
    const loginActiveUserBanner = $("#loginActiveUserBanner");
    const loginActiveUserText = $("#loginActiveUserText");
    const loginSignOutBtn = $("#loginSignOutBtn");

    if (autoSyncCheckbox) {
      autoSyncCheckbox.checked = state.supabaseAutoSync !== false;
    }

    if (currentSupabaseUser) {
      if (signedOutSec) signedOutSec.style.display = "none";
      if (signedInSec) signedInSec.style.display = "block";
      if (userEmailVal) userEmailVal.textContent = currentSupabaseUser.email || "Hunter";
      if (userIdVal) {
        const fullId = currentSupabaseUser.id || "";
        userIdVal.dataset.full = fullId;
        userIdVal.textContent = fullId ? fullId.slice(0, 8) + "-••••-••••-••••-••••••••••••" : "—";
        const toggleBtn = $("#toggleMaskUserIdBtn");
        if (toggleBtn) {
          toggleBtn.style.display = fullId ? "inline-block" : "none";
          toggleBtn.textContent = "Reveal";
        }
      }
      if (lastSyncVal) {
        lastSyncVal.textContent = state.lastSupabaseSync
          ? new Date(state.lastSupabaseSync).toLocaleTimeString() + " (" + timeAgo(new Date(state.lastSupabaseSync).getTime()) + ")"
          : "Not yet synced";
      }
      if (loginBtnLabel) {
        const displayName = currentSupabaseUser.user_metadata?.full_name || currentSupabaseUser.user_metadata?.name || currentSupabaseUser.email?.split("@")[0] || state.name;
        loginBtnLabel.textContent = `${displayName} (Cloud)`;
      }
      if (quickLogOutBtn) quickLogOutBtn.style.display = "inline-flex";
      if (loginActiveUserBanner) {
        loginActiveUserBanner.style.display = "flex";
        if (loginActiveUserText) {
          loginActiveUserText.textContent = `Authenticated as: ${currentSupabaseUser.email || state.name} (Cloud Connected)`;
        }
      }
      if (loginSignOutBtn) loginSignOutBtn.style.display = "inline-flex";
    } else {
      if (signedOutSec) signedOutSec.style.display = "block";
      if (signedInSec) signedInSec.style.display = "none";
      if (userEmailVal) userEmailVal.textContent = "—";
      if (userIdVal) {
        userIdVal.dataset.full = "";
        userIdVal.textContent = "—";
        const toggleBtn = $("#toggleMaskUserIdBtn");
        if (toggleBtn) toggleBtn.style.display = "none";
      }
      const isGuest = localStorage.getItem("xeli_guest_mode") === "true";
      if (loginBtnLabel) loginBtnLabel.textContent = isGuest ? `${state.name} (Guest)` : "Log On...";
      if (quickLogOutBtn) quickLogOutBtn.style.display = isGuest ? "inline-flex" : "none";
      if (loginActiveUserBanner) loginActiveUserBanner.style.display = "none";
      if (loginSignOutBtn) loginSignOutBtn.style.display = "none";
    }
  }

  async function syncToSupabaseCloud(silent = false) {
    if (!currentSupabaseUser) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          currentSupabaseUser = user;
        }
      } catch (_) {}
    }

    if (!currentSupabaseUser) {
      if (isTargetMatrixAccount(state)) {
        try {
          const derived = getLevelAndExpFromTotal(state.totalExp || 19230);
          await supabase.from("profiles").upsert({
            id: TARGET_MATRIX_USER_ID,
            name: state.name || "XELIBOY 10",
            level: derived.level,
            exp: derived.exp,
            total_exp: state.totalExp || 19230,
            streak: state.streak || 6,
            updated_at: new Date().toISOString(),
          });
          refreshLeaderboard(false);
          return;
        } catch (e) {
          console.warn("Direct profile sync note:", e);
        }
      }
      if (!silent) showToast("Please sign in with Supabase first to sync to cloud.");
      return;
    }

    const syncMsg = $("#supabaseSyncMsg");
    if (syncMsg && !silent) syncMsg.textContent = "Uploading hunter progress to Supabase Cloud...";
    try {
      const res = await saveProgressToSupabase(state);
      state.lastSupabaseSync = res.timestamp;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      updateSupabaseAuthUi();
      refreshLeaderboard(false);
      if (!silent) {
        showToast("☁️ <b>Supabase Cloud Saved</b>: Progress synced successfully!");
        if (syncMsg) syncMsg.textContent = `Uploaded at ${new Date(res.timestamp).toLocaleTimeString()}.`;
        playSuccess();
      }
    } catch (err) {
      console.warn("Cloud save failed:", err);
      if (isTargetMatrixAccount(state)) {
        try {
          const derived = getLevelAndExpFromTotal(state.totalExp || 19230);
          await supabase.from("profiles").upsert({
            id: TARGET_MATRIX_USER_ID,
            name: state.name || "XELIBOY 10",
            level: derived.level,
            exp: derived.exp,
            total_exp: state.totalExp || 19230,
            streak: state.streak || 6,
            updated_at: new Date().toISOString(),
          });
          refreshLeaderboard(false);
        } catch (_) {}
      }
      if (!silent) {
        showToast(`Cloud save error: ${err.message}`);
        if (syncMsg) syncMsg.textContent = `Upload failed: ${err.message}`;
        playError();
      }
    }
  }

  async function restoreFromSupabaseCloud(silent = false) {
    if (!currentSupabaseUser) {
      if (!silent) showToast("Sign in to Supabase first.");
      return;
    }
    const syncMsg = $("#supabaseSyncMsg");
    if (syncMsg && !silent) syncMsg.textContent = "Downloading latest progress from Supabase Cloud...";
    try {
      const cloudData = await loadProgressFromSupabase();
      if (cloudData) {
        state = sanitizeState({ ...state, ...cloudData });
        state.lastSupabaseSync = cloudData.syncedAt || new Date().toISOString();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        render();
        updateSupabaseAuthUi();
        if (!silent) {
          showToast(`⚡ Restored Level <b>${state.level}</b> (${state.totalExp.toLocaleString()} EXP) from Supabase Cloud!`);
          if (syncMsg) syncMsg.textContent = `Restored from cloud (${new Date(state.lastSupabaseSync).toLocaleTimeString()}).`;
          playLevelUp();
        }
      } else {
        if (!silent) {
          showToast("No cloud save found for this account yet. Uploading current progress to cloud...");
          syncToSupabaseCloud(false);
        }
      }
    } catch (err) {
      console.warn("Cloud restore failed:", err);
      if (!silent) {
        showToast(`Restore error: ${err.message}`);
        if (syncMsg) syncMsg.textContent = `Restore failed: ${err.message}`;
        playError();
      }
    }
  }

  function triggerSupabaseAutoSync() {
    if (!state.supabaseAutoSync || !currentSupabaseUser) return;
    clearTimeout(supabaseSyncTimeout);
    supabaseSyncTimeout = setTimeout(() => {
      syncToSupabaseCloud(true);
    }, 800);
  }

  async function handleUserLoggedIn(user, showNotice = false) {
    currentSupabaseUser = user;
    state.isLoggedIn = true;
    localStorage.removeItem("xeli_guest_mode");

    const metaName = user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.hunter_name;
    if (metaName && (!state.name || state.name === "Hunter")) {
      state.name = metaName;
    }

    state.activity.unshift({
      text: `Hunter Authorized: ${user.email || state.name} (Awakening Cloud)`,
      time: Date.now(),
    });
    if (state.activity.length > 50) state.activity.pop();

    saveState();
    render();
    updateSupabaseAuthUi();
    closeModal("modalLogin");

    if (showNotice) {
      playLogonChime();
      showToast(`⚡ <b>Authenticated</b>: Welcome, Hunter <b>${escapeHtml(state.name)}</b>!`);
    }

    await restoreFromSupabaseCloud(true);

    if (user.id === TARGET_MATRIX_USER_ID || TARGET_MATRIX_EMAILS.includes(user.email)) {
      state.totalExp = Math.max(state.totalExp || 0, 19230);
      const derived = getLevelAndExpFromTotal(state.totalExp);
      state.level = derived.level;
      state.exp = derived.exp;
      state.streak = Math.max(state.streak || 0, 6);
      state.dailyExp = { ...AUG25_SEPT24_MATRIX, ...(state.dailyExp || {}) };

      const extraSolved = Array.isArray(state.solvedChallenges) ? state.solvedChallenges.length : 0;
      const currentSolved = Math.max(59 + extraSolved, Number(state.problemStats?.solvedTotal) || 59);
      const currentMed = Math.max(40 + extraSolved, Number(state.problemStats?.solvedMedium) || 40);

      state.problemStats = {
        solvedTotal: currentSolved,
        totalProblems: 76,
        solvedEasy: Math.max(2, Number(state.problemStats?.solvedEasy) || 2),
        totalEasy: 10,
        solvedMedium: currentMed,
        totalMedium: 46,
        solvedHard: Math.max(17, Number(state.problemStats?.solvedHard) || 17),
        totalHard: 20,
      };
      saveState();
      render();
      syncToSupabaseCloud(true);
    } else if (user.id === "a0c2b12e-6892-4016-8d29-d39c32f6f9c7") {
      state.totalExp = Math.max(state.totalExp || 0, 1905);
      const derived = getLevelAndExpFromTotal(state.totalExp);
      state.level = derived.level;
      state.exp = derived.exp;
      saveState();
      render();
      syncToSupabaseCloud(true);
    }

    refreshLeaderboard(false);
  }

  async function handleUserLoggedOut(showMessage = true) {
    currentSupabaseUser = null;
    state.isLoggedIn = false;
    localStorage.removeItem("xeli_guest_mode");
    saveState();
    render();
    updateSupabaseAuthUi();
    refreshLeaderboard(false);
    if (showMessage) {
      playLogoffSound();
      showToast("🔒 Logged off terminal. Progress stored locally.");
    }
    openHunterLogonModal();
  }

  // ---------------------------------------------------------
  // HUNTER CLOUD AUTHENTICATION CONTROLLER & TAB SWITCHER
  // ---------------------------------------------------------
  const loginForm = $("#loginForm");
  const loginEmail = $("#loginEmail");
  const loginPassword = $("#loginPassword");
  const loginHunterName = $("#loginHunterName");
  const loginHunterNameRow = $("#loginHunterNameRow");
  const loginStatusDot = $("#loginStatusDot");
  const loginStatusMsg = $("#loginStatusMsg");
  const loginSignInBtn = $("#loginSignInBtn");
  const loginSignUpBtn = $("#loginSignUpBtn");
  const loginGoogleBtn = $("#loginGoogleBtn");
  const loginGuestBtn = $("#loginGuestBtn");
  const loginSignOutBtn = $("#loginSignOutBtn");
  const quickLogOutBtn = $("#quickLogOutBtn");
  const togglePasswordVisibilityBtn = $("#togglePasswordVisibilityBtn");
  const authTabSignIn = $("#authTabSignIn");
  const authTabSignUp = $("#authTabSignUp");
  const loginDialogTitle = $("#loginDialogTitle");

  let authMode = "signin"; // 'signin' | 'signup'

  function setAuthMode(mode) {
    authMode = mode;
    if (mode === "signin") {
      authTabSignIn?.classList.add("is-active");
      authTabSignUp?.classList.remove("is-active");
      authTabSignIn?.setAttribute("aria-selected", "true");
      authTabSignUp?.setAttribute("aria-selected", "false");
      if (loginHunterNameRow) loginHunterNameRow.style.display = "none";
      if (loginSignInBtn) loginSignInBtn.style.display = "block";
      if (loginSignUpBtn) loginSignUpBtn.style.display = "none";
      if (loginDialogTitle) loginDialogTitle.textContent = "Hunter Terminal Access";
      setInlineLoginStatus("Enter your hunter credentials to sign in.", false);
    } else {
      authTabSignUp?.classList.add("is-active");
      authTabSignIn?.classList.remove("is-active");
      authTabSignUp?.setAttribute("aria-selected", "true");
      authTabSignIn?.setAttribute("aria-selected", "false");
      if (loginHunterNameRow) loginHunterNameRow.style.display = "flex";
      if (loginSignInBtn) loginSignInBtn.style.display = "none";
      if (loginSignUpBtn) loginSignUpBtn.style.display = "block";
      if (loginDialogTitle) loginDialogTitle.textContent = "Initialize Hunter Clearance";
      setInlineLoginStatus("Create a new Hunter profile on the Awakening Cloud.", false);
    }
  }

  if (authTabSignIn) authTabSignIn.addEventListener("click", () => setAuthMode("signin"));
  if (authTabSignUp) authTabSignUp.addEventListener("click", () => setAuthMode("signup"));

  function setInlineLoginStatus(msg, isError = false) {
    if (!loginStatusMsg || !loginStatusDot) return;
    if (isError) {
      loginStatusDot.classList.add("is-error");
    } else {
      loginStatusDot.classList.remove("is-error");
    }
    loginStatusMsg.textContent = msg;
  }

  function openHunterLogonModal() {
    setAuthMode("signin");
    if (loginEmail) {
      if (currentSupabaseUser?.email) {
        loginEmail.value = currentSupabaseUser.email;
      } else if (!loginEmail.value) {
        loginEmail.value = "";
      }
    }
    if (loginPassword) loginPassword.value = "";
    if (loginHunterName) loginHunterName.value = state.name || "Hunter";

    updateSupabaseAuthUi();

    if (currentSupabaseUser) {
      setInlineLoginStatus(`Active session: ${currentSupabaseUser.email || state.name}`, false);
    } else {
      const isGuest = localStorage.getItem("xeli_guest_mode") === "true";
      if (isGuest) {
        setInlineLoginStatus("Guest Mode active (offline browser storage only).", false);
      } else {
        setInlineLoginStatus("Ready. Sign in or initialize hunter clearance.", false);
      }
    }

    openModal("modalLogin");
    setTimeout(() => {
      if (loginEmail && !currentSupabaseUser) {
        loginEmail.focus();
      }
    }, 100);
  }

  // Open from topbar button
  const openLoginModalBtn = $("#openLoginModal");
  if (openLoginModalBtn) {
    openLoginModalBtn.addEventListener("click", () => openHunterLogonModal());
  }

  // Open from sidebar mini-badge click
  const hunterMiniCard = $("#hunterMiniCard");
  if (hunterMiniCard) {
    hunterMiniCard.addEventListener("click", () => openHunterLogonModal());
    hunterMiniCard.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openHunterLogonModal();
      }
    });
  }

  // Password visibility toggle
  if (togglePasswordVisibilityBtn && loginPassword) {
    togglePasswordVisibilityBtn.addEventListener("click", () => {
      const isPwd = loginPassword.type === "password";
      loginPassword.type = isPwd ? "text" : "password";
      togglePasswordVisibilityBtn.textContent = isPwd ? "🔒" : "👁";
      togglePasswordVisibilityBtn.title = isPwd ? "Conceal passkey" : "Reveal passkey";
    });
  }

  // "Continue with Google" OAuth Button
  if (loginGoogleBtn) {
    loginGoogleBtn.addEventListener("click", async () => {
      setInlineLoginStatus("Opening Google OAuth 2.0 gateway...", false);
      loginGoogleBtn.disabled = true;
      try {
        await signInWithGoogle();
      } catch (err) {
        console.error("Google OAuth error:", err);
        setInlineLoginStatus(formatAuthError(err), true);
        playError();
        loginGoogleBtn.disabled = false;
      }
    });
  }

  // "Sign In" with Email & Password (or Sign Up when in signup mode)
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (authMode === "signup") {
        if (loginSignUpBtn) loginSignUpBtn.click();
        return;
      }
      const email = (loginEmail?.value || "").trim();
      const password = (loginPassword?.value || "").trim();

      if (!email || !password) {
        setInlineLoginStatus("Please enter both email and security passkey.", true);
        playError();
        return;
      }

      setInlineLoginStatus("Authenticating credentials with Supabase Cloud...", false);
      if (loginSignInBtn) loginSignInBtn.disabled = true;

      try {
        const res = await signInSupabase(email, password);
        await handleUserLoggedIn(res.user, true);
      } catch (err) {
        console.error("Sign in failed:", err);
        setInlineLoginStatus(formatAuthError(err), true);
        playError();
      } finally {
        if (loginSignInBtn) loginSignInBtn.disabled = false;
      }
    });
  }

  // "Sign Up" with Email, Password & Hunter Name
  if (loginSignUpBtn) {
    loginSignUpBtn.addEventListener("click", async () => {
      const email = (loginEmail?.value || "").trim();
      const password = (loginPassword?.value || "").trim();
      const hunterName = (loginHunterName?.value || "").trim() || "Hunter";

      if (!email || !password) {
        setInlineLoginStatus("Enter an email and a passkey to create a Hunter account.", true);
        playError();
        return;
      }
      if (password.length < 6) {
        setInlineLoginStatus("Security passkey must be at least 6 characters long.", true);
        playError();
        return;
      }

      setInlineLoginStatus("Provisioning new Hunter license on Awakening Cloud...", false);
      loginSignUpBtn.disabled = true;

      try {
        const res = await signUpSupabase(email, password, hunterName);
        if (res.user) {
          state.name = hunterName;
          await handleUserLoggedIn(res.user, true);
        } else {
          setInlineLoginStatus("Account created! Please check your email if confirmation is required.", false);
          showToast("Account created! Please check your inbox.");
        }
      } catch (err) {
        console.error("Sign up failed:", err);
        setInlineLoginStatus(formatAuthError(err), true);
        playError();
      } finally {
        loginSignUpBtn.disabled = false;
      }
    });
  }

  // "Continue as Guest" Button (Local storage only, zero Supabase calls)
  if (loginGuestBtn) {
    loginGuestBtn.addEventListener("click", () => {
      localStorage.setItem("xeli_guest_mode", "true");
      closeModal("modalLogin");
      updateSupabaseAuthUi();
      playUnlock();
      showToast("🕹️ <b>Guest Mode Active</b>: Playing offline with local browser storage.");
    });
  }

  // "Log Out" action handlers (inside modal and topbar)
  async function performLogOut() {
    try {
      await signOutSupabase();
    } catch (err) {
      console.warn("Sign out notice:", err);
    }
    await handleUserLoggedOut(true);
  }

  if (loginSignOutBtn) {
    loginSignOutBtn.addEventListener("click", performLogOut);
  }
  if (quickLogOutBtn) {
    quickLogOutBtn.addEventListener("click", performLogOut);
  }

  $("#openResetModal").addEventListener("click", () => openModal("modalReset"));
 
  $("#confirmResetBtn").addEventListener("click", () => {
    playPower();
    state = defaultState();
    saveState();
    render();
    closeModal("modalReset");
    showToast("Progress reset — back to <b>Level 1, Rank E</b>.");
  });
 
  // ---------------------------------------------------------
  // BACKGROUND MUSIC (YOUTUBE INTEGRATION)
  // Target video: https://youtu.be/Z-VfaG9ZN_U
  // ---------------------------------------------------------
  const YOUTUBE_BGM_ID = "Z-VfaG9ZN_U";
  let ytPlayer = null;
  let ytPlayerReady = false;
  let bgmIsPlaying = false;

  const bgmPlayPauseBtn = $("#bgmPlayPauseBtn");
  const bgmPlayIcon = $("#bgmPlayIcon");
  const bgmPlayText = $("#bgmPlayText");
  const bgmVolRange = $("#bgmVolRange");
  const bgmStatusLed = $("#bgmStatusLed");
  const bgmBars = $("#bgmBars");
  const toggleBgmBtn = $("#toggleBgmBtn");
  const bgmBtnLabel = $("#bgmBtnLabel");

  function updateBgmUi() {
    const isPlaying = bgmIsPlaying && state.bgmEnabled;
    if (bgmStatusLed) {
      if (isPlaying) bgmStatusLed.classList.add("is-active");
      else bgmStatusLed.classList.remove("is-active");
    }
    if (bgmBars) {
      if (isPlaying) bgmBars.classList.add("is-active");
      else bgmBars.classList.remove("is-active");
    }
    if (bgmPlayIcon) bgmPlayIcon.textContent = isPlaying ? "⏸" : "▶";
    if (bgmPlayText) bgmPlayText.textContent = isPlaying ? "Pause" : "Play BGM";
    if (bgmBtnLabel) bgmBtnLabel.textContent = isPlaying ? "BGM: Playing" : (state.bgmEnabled ? "BGM: Ready" : "BGM: Off");
    if (bgmVolRange) bgmVolRange.value = state.bgmVolume;
  }

  function startBgmPlayback() {
    state.bgmEnabled = true;
    saveState();
    if (ytPlayer && ytPlayerReady && typeof ytPlayer.playVideo === "function") {
      try {
        ytPlayer.setVolume(state.bgmVolume);
        ytPlayer.playVideo();
      } catch (e) {
        console.warn("Could not play YouTube BGM yet:", e);
      }
    }
    updateBgmUi();
  }

  function pauseBgmPlayback() {
    state.bgmEnabled = false;
    saveState();
    if (ytPlayer && ytPlayerReady && typeof ytPlayer.pauseVideo === "function") {
      try {
        ytPlayer.pauseVideo();
      } catch (e) {
        console.warn("Could not pause YouTube BGM:", e);
      }
    }
    bgmIsPlaying = false;
    updateBgmUi();
  }

  function toggleBgm() {
    if (bgmIsPlaying && state.bgmEnabled) {
      pauseBgmPlayback();
      showToast("Background music paused.");
    } else {
      startBgmPlayback();
      showToast("Background music playing: <b>XELI Hunter Theme</b>");
    }
  }

  if (bgmPlayPauseBtn) {
    bgmPlayPauseBtn.addEventListener("click", toggleBgm);
  }
  if (toggleBgmBtn) {
    toggleBgmBtn.addEventListener("click", toggleBgm);
  }

  if (bgmVolRange) {
    bgmVolRange.addEventListener("input", (e) => {
      const vol = parseInt(e.target.value, 10);
      state.bgmVolume = vol;
      saveState();
      if (ytPlayer && ytPlayerReady && typeof ytPlayer.setVolume === "function") {
        ytPlayer.setVolume(vol);
      }
    });
  }

  function initYouTubeBgm() {
    const onYtReady = () => {
      try {
        ytPlayer = new window.YT.Player("youtubeBgmPlayer", {
          height: "1",
          width: "1",
          videoId: YOUTUBE_BGM_ID,
          playerVars: {
            autoplay: 0,
            loop: 1,
            playlist: YOUTUBE_BGM_ID,
            controls: 0,
            disablekb: 1,
            fs: 0,
            playsinline: 1,
          },
          events: {
            onReady: (event) => {
              ytPlayerReady = true;
              try {
                event.target.setVolume(state.bgmVolume);
                if (state.bgmEnabled) {
                  event.target.playVideo();
                }
              } catch (e) {
                // Autoplay may wait for user gesture in some browsers
              }
              updateBgmUi();
            },
            onStateChange: (event) => {
              // YT.PlayerState: 1 = playing, 2 = paused, 0 = ended, 3 = buffering
              if (event.data === 1) {
                bgmIsPlaying = true;
              } else if (event.data === 2 || event.data === 0) {
                bgmIsPlaying = false;
              }
              updateBgmUi();
            },
            onError: (err) => {
              console.warn("YouTube BGM error:", err);
            },
          },
        });
      } catch (err) {
        console.warn("YouTube player init error:", err);
      }
    };

    if (window.YT && window.YT.Player) {
      onYtReady();
    } else {
      window.onYouTubeIframeAPIReady = onYtReady;
    }
  }

  // Handle browser unmuted autoplay policy on first interaction
  let userInteracted = false;
  function onFirstUserGesture() {
    if (userInteracted) return;
    userInteracted = true;
    if (state.bgmEnabled && ytPlayer && ytPlayerReady && !bgmIsPlaying) {
      try {
        ytPlayer.playVideo();
      } catch (e) {
        // ignore
      }
    }
  }
  document.addEventListener("click", onFirstUserGesture, { passive: true });
  document.addEventListener("keydown", onFirstUserGesture, { passive: true });

  initYouTubeBgm();
  updateBgmUi();

  // ---------------------------------------------------------
  // RETRO TITLEBAR EASTER EGG
  // ---------------------------------------------------------
  const retroCloseBtn = $("#retroCloseBtn");
  if (retroCloseBtn) {
    retroCloseBtn.addEventListener("click", () => showToast("Nice try — this window doesn't close. 1998 forever."));
  }
 
  // ---------------------------------------------------------
  // SUPABASE CLOUD SYNC & DIAGNOSTICS MODAL CONTROLLER
  // ---------------------------------------------------------
  async function initSupabaseController() {
    // 1. Connection latency test
    const conn = await checkSupabaseConnection();
    updateSupabaseConnectionStatus(conn);

    // 2. Auth session check via getSupabaseSession() to restore on page reload
    try {
      const session = await getSupabaseSession();
      if (session && session.user) {
        await handleUserLoggedIn(session.user, false);
      } else {
        const isGuest = localStorage.getItem("xeli_guest_mode") === "true";
        if (!isGuest && !state.isLoggedIn) {
          openHunterLogonModal();
        }
      }
    } catch (e) {
      console.warn("Supabase session check error:", e);
    }

    // 3. Auth state listener (reacts to OAuth redirect return, token refresh, and sign out)
    onSupabaseAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        if (!currentSupabaseUser || currentSupabaseUser.id !== session.user.id) {
          await handleUserLoggedIn(session.user, true);
        }
      } else if (event === "SIGNED_OUT") {
        if (currentSupabaseUser) {
          await handleUserLoggedOut(false);
        }
      }
    });

    // 4. Bind UI Event Handlers for Supabase Diagnostics Modal
    const openSupabaseModalBtn = $("#openSupabaseModal");
    if (openSupabaseModalBtn) {
      openSupabaseModalBtn.addEventListener("click", () => openModal("modalSupabase"));
    }
    const openSupabaseModalSidebar = $("#openSupabaseModalSidebar");
    if (openSupabaseModalSidebar) {
      openSupabaseModalSidebar.addEventListener("click", () => openModal("modalSupabase"));
      openSupabaseModalSidebar.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openModal("modalSupabase");
        }
      });
    }

    const authForm = $("#supabaseAuthForm");
    const emailInput = $("#supabaseEmail");
    const passwordInput = $("#supabasePassword");
    const authMsg = $("#supabaseAuthMsg");
    const signInBtn = $("#supabaseSignInBtn");
    const signUpBtn = $("#supabaseSignUpBtn");

    if (authForm) {
      authForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = (emailInput?.value || "").trim();
        const password = (passwordInput?.value || "").trim();
        if (!email || !password) return;

        if (authMsg) authMsg.textContent = "Connecting to Supabase...";
        if (signInBtn) signInBtn.disabled = true;

        try {
          const res = await signInSupabase(email, password);
          await handleUserLoggedIn(res.user, true);
          if (authMsg) authMsg.textContent = "Authenticated successfully!";
        } catch (err) {
          console.error(err);
          if (authMsg) authMsg.textContent = `Sign in error: ${formatAuthError(err)}`;
          playError();
        } finally {
          if (signInBtn) signInBtn.disabled = false;
        }
      });
    }

    if (signUpBtn) {
      signUpBtn.addEventListener("click", async () => {
        const email = (emailInput?.value || "").trim();
        const password = (passwordInput?.value || "").trim();
        if (!email || !password) {
          if (authMsg) authMsg.textContent = "Please enter an email and password to create an account.";
          return;
        }

        if (authMsg) authMsg.textContent = "Creating Supabase account...";
        signUpBtn.disabled = true;

        try {
          const res = await signUpSupabase(email, password, state.name);
          if (res.user) {
            await handleUserLoggedIn(res.user, true);
          }
          if (authMsg) authMsg.textContent = "Account created successfully!";
        } catch (err) {
          console.error(err);
          if (authMsg) authMsg.textContent = `Sign up error: ${formatAuthError(err)}`;
          playError();
        } finally {
          signUpBtn.disabled = false;
        }
      });
    }

    const magicLinkBtn = $("#supabaseMagicLinkBtn");
    if (magicLinkBtn) {
      magicLinkBtn.addEventListener("click", async () => {
        const email = (emailInput?.value || "").trim();
        if (!email) {
          if (authMsg) authMsg.textContent = "Please enter an email address for magic link delivery.";
          return;
        }
        if (authMsg) authMsg.textContent = "Sending Magic Link email...";
        magicLinkBtn.disabled = true;
        try {
          await signInWithMagicLink(email);
          if (authMsg) authMsg.textContent = "Magic Link sent! Please check your inbox.";
          showToast(`⚡ Magic link dispatched to <b>${escapeHtml(email)}</b>. Check your inbox!`);
          playSuccess();
        } catch (err) {
          console.error(err);
          if (authMsg) authMsg.textContent = `Magic link error: ${err.message}`;
          playError();
        } finally {
          magicLinkBtn.disabled = false;
        }
      });
    }

    const signOutBtn = $("#supabaseSignOutBtn");
    if (signOutBtn) {
      signOutBtn.addEventListener("click", async () => {
        try {
          await signOutSupabase();
          currentSupabaseUser = null;
          updateSupabaseAuthUi();
          playLogoffSound();
          showToast("Signed out of Supabase Cloud account.");
        } catch (err) {
          console.error(err);
          showToast(`Sign out error: ${err.message}`);
        }
      });
    }

    const manualPushBtn = $("#supabaseManualPushBtn");
    if (manualPushBtn) {
      manualPushBtn.addEventListener("click", () => syncToSupabaseCloud(false));
    }

    const manualPullBtn = $("#supabaseManualPullBtn");
    if (manualPullBtn) {
      manualPullBtn.addEventListener("click", () => restoreFromSupabaseCloud(false));
    }

    const autoSyncCb = $("#supabaseAutoSyncCheckbox");
    if (autoSyncCb) {
      autoSyncCb.addEventListener("change", (e) => {
        state.supabaseAutoSync = e.target.checked;
        saveState();
        showToast(state.supabaseAutoSync ? "Auto-sync to Supabase Cloud enabled." : "Auto-sync disabled.");
      });
    }

    const copySqlBtn = $("#copySupabaseSqlBtn");
    const sqlCode = $("#supabaseSqlCode");
    if (copySqlBtn && sqlCode) {
      copySqlBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(sqlCode.textContent || "");
        copySqlBtn.textContent = "Copied to Clipboard!";
        setTimeout(() => {
          copySqlBtn.textContent = "Copy SQL";
        }, 2000);
        showToast("SQL script copied. You can paste it into the Supabase SQL editor.");
      });
    }

    // Toggle reveal for masked Supabase Cloud details
    const toggleMaskUrlBtn = $("#toggleMaskUrlBtn");
    const maskedUrl = $("#supabaseMaskedUrl");
    if (toggleMaskUrlBtn && maskedUrl) {
      let isRevealed = false;
      toggleMaskUrlBtn.addEventListener("click", () => {
        isRevealed = !isRevealed;
        maskedUrl.textContent = isRevealed ? "https://efkkzgsuyttdfatihfxb.supabase.co" : "https://••••••••••••.supabase.co";
        toggleMaskUrlBtn.textContent = isRevealed ? "Hide" : "Reveal";
      });
    }

    const toggleMaskRefBtn = $("#toggleMaskRefBtn");
    const maskedRef = $("#supabaseMaskedRef");
    if (toggleMaskRefBtn && maskedRef) {
      let isRevealed = false;
      toggleMaskRefBtn.addEventListener("click", () => {
        isRevealed = !isRevealed;
        maskedRef.textContent = isRevealed ? "efkkzgsuyttdfatihfxb" : "••••••••••••••••";
        toggleMaskRefBtn.textContent = isRevealed ? "Hide" : "Reveal";
      });
    }

    const toggleMaskUserIdBtn = $("#toggleMaskUserIdBtn");
    const userIdValEl = $("#supabaseUserIdVal");
    if (toggleMaskUserIdBtn && userIdValEl) {
      let isRevealed = false;
      toggleMaskUserIdBtn.addEventListener("click", () => {
        isRevealed = !isRevealed;
        const fullId = userIdValEl.dataset.full || "";
        userIdValEl.textContent = isRevealed ? fullId : (fullId ? fullId.slice(0, 8) + "-••••-••••-••••-••••••••••••" : "—");
        toggleMaskUserIdBtn.textContent = isRevealed ? "Hide" : "Reveal";
      });
    }
  }

  // ---------------------------------------------------------
  // SIDEBAR COLLAPSE / EXPAND CONTROLLER
  // ---------------------------------------------------------
  function initSidebarCollapse() {
    const appEl = $(".app");
    const brandBtn = $("#brandToggleBtn") || $("#brandLogo") || $(".brand");
    const brandLogo = $("#brandLogo");
    if (!appEl || !brandBtn) return;

    // Load saved collapsed state
    const savedState = localStorage.getItem("xeli_sidebar_collapsed");
    if (savedState === "1") {
      appEl.classList.add("sidebar-collapsed");
      updateCollapseTooltips(true);
    } else {
      updateCollapseTooltips(false);
    }

    function toggleSidebar(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      const isNowCollapsed = appEl.classList.toggle("sidebar-collapsed");
      localStorage.setItem("xeli_sidebar_collapsed", isNowCollapsed ? "1" : "0");
      updateCollapseTooltips(isNowCollapsed);
      playClick();
    }

    function updateCollapseTooltips(isCollapsed) {
      const hint = isCollapsed ? "Click to expand sidebar" : "Click to collapse sidebar";
      if (brandBtn) brandBtn.setAttribute("title", hint);
      if (brandLogo) brandLogo.setAttribute("title", `XELI Leveling System · ${hint}`);
      const collapseHint = $(".brand-collapse-hint");
      if (collapseHint) collapseHint.setAttribute("title", hint);
    }

    brandBtn.addEventListener("click", toggleSidebar);
    brandBtn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        toggleSidebar(e);
      }
    });

    if (brandLogo && brandLogo !== brandBtn) {
      brandLogo.addEventListener("click", toggleSidebar);
    }
  }

  // ---------------------------------------------------------
  // EDIT PROFILE & AVATAR CONTROLLER
  // ---------------------------------------------------------
  function initEditProfileModal() {
    const modalEl = $("#modalEditProfile");
    const formEl = $("#editProfileForm");
    const openBtn = $("#openEditProfileBtn");
    const hunterAvatarEl = $("#hunterAvatar");
    const supabaseEditBtn = $("#supabaseEditProfileBtn");

    const nameInput = $("#editProfileName");
    const guildInput = $("#editProfileGuild");
    const previewImg = $("#profileAvatarPreviewImg");
    const placeholderEl = $("#profileAvatarPlaceholder");
    const initialSpan = $("#profileAvatarInitial");
    const fileInput = $("#profileAvatarFileInput");
    const uploadBtn = $("#profileUploadBtn");
    const avatarFrame = $("#profileAvatarFrame");
    const removeBtn = $("#profileRemoveAvatarBtn");
    const statusMsg = $("#avatarUploadStatus");
    const editMsg = $("#editProfileMsg");
    const saveBtn = $("#saveProfileBtn");
    const saveBtnText = $("#saveProfileBtnText");

    const rankTierVal = $("#editProfileRankTier");
    const levelVal = $("#editProfileLevelVal");
    const expVal = $("#editProfileExpVal");
    const cloudStatusVal = $("#editProfileCloudStatus");

    let pendingAvatarFile = null; // null | File | "REMOVE"
    let localPreviewUrl = null;

    function populateEditProfileData() {
      pendingAvatarFile = null;
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
        localPreviewUrl = null;
      }
      if (statusMsg) {
        statusMsg.textContent = "";
        statusMsg.style.color = "#00d2ff";
      }
      if (editMsg) {
        editMsg.textContent = "";
        editMsg.className = "edit-profile-msg";
      }
      if (saveBtn) saveBtn.disabled = false;
      if (saveBtnText) saveBtnText.textContent = "Save Profile";

      // Populate text fields
      if (nameInput) nameInput.value = state.name || "Hunter";
      if (guildInput) guildInput.value = state.guild || "Hunter Association";

      // Meta values
      const curLevel = state.level || 1;
      const rankInfo = rankInfoForLevel(curLevel);
      if (rankTierVal) rankTierVal.textContent = `Rank ${rankInfo.rank} · ${rankInfo.title}`;
      if (levelVal) levelVal.textContent = `Level ${curLevel}`;
      const totalExp = Math.max(state.totalExp || 0, state.exp || 0);
      if (expVal) expVal.textContent = `${Number(totalExp).toLocaleString()} XP`;

      if (cloudStatusVal) {
        if (currentSupabaseUser) {
          const userEmail = currentSupabaseUser.email || "Authenticated";
          cloudStatusVal.textContent = `Connected (${userEmail})`;
          cloudStatusVal.style.color = "#00d2ff";
        } else {
          cloudStatusVal.textContent = "Guest / Local Mode (Sign in to sync)";
          cloudStatusVal.style.color = "var(--dim)";
        }
      }

      // Populate Avatar Preview
      updatePreviewDisplay(state.avatarUrl);
    }

    function updatePreviewDisplay(imgUrl) {
      if (imgUrl) {
        if (previewImg) {
          previewImg.src = imgUrl;
          previewImg.style.display = "block";
        }
        if (placeholderEl) placeholderEl.style.display = "none";
      } else {
        const avatarData = getHunterAvatar(state.level || 1);
        if (avatarData && avatarData.url) {
          if (previewImg) {
            previewImg.src = avatarData.url;
            previewImg.style.display = "block";
          }
          if (placeholderEl) placeholderEl.style.display = "none";
        } else {
          if (previewImg) previewImg.style.display = "none";
          if (placeholderEl) {
            placeholderEl.style.display = "grid";
            if (initialSpan) initialSpan.textContent = (state.name || "H").charAt(0).toUpperCase();
          }
        }
      }
    }

    function openEditProfile() {
      populateEditProfileData();
      openModal("modalEditProfile");
      playClick();
      if (nameInput) {
        setTimeout(() => nameInput.focus(), 100);
      }
    }

    if (openBtn) openBtn.addEventListener("click", openEditProfile);
    if (hunterAvatarEl) hunterAvatarEl.addEventListener("click", openEditProfile);
    if (supabaseEditBtn) {
      supabaseEditBtn.addEventListener("click", () => {
        closeModal("modalSupabase");
        openEditProfile();
      });
    }

    // Trigger file dialog
    function triggerFileInput() {
      if (fileInput) fileInput.click();
    }
    if (uploadBtn) uploadBtn.addEventListener("click", triggerFileInput);
    if (avatarFrame) {
      avatarFrame.addEventListener("click", triggerFileInput);
      avatarFrame.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          triggerFileInput();
        }
      });
    }

    // Handle file selection
    if (fileInput) {
      fileInput.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        // Validation
        const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg", "image/gif"];
        if (!validTypes.includes(file.type.toLowerCase())) {
          if (statusMsg) {
            statusMsg.textContent = "Please select a valid image file (JPG, PNG, WebP).";
            statusMsg.style.color = "#ef4444";
          }
          return;
        }

        if (file.size > 5 * 1024 * 1024) {
          if (statusMsg) {
            statusMsg.textContent = "Image exceeds 5MB limit. Please choose a smaller image.";
            statusMsg.style.color = "#ef4444";
          }
          return;
        }

        pendingAvatarFile = file;

        // Show instant preview
        if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
        localPreviewUrl = URL.createObjectURL(file);
        updatePreviewDisplay(localPreviewUrl);

        const sizeKb = Math.round(file.size / 1024);
        if (statusMsg) {
          statusMsg.textContent = `Selected: ${file.name} (${sizeKb} KB). Click "Save Profile" to apply.`;
          statusMsg.style.color = "#00d2ff";
        }
        playClick();
      });
    }

    // Remove avatar
    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        pendingAvatarFile = "REMOVE";
        if (localPreviewUrl) {
          URL.revokeObjectURL(localPreviewUrl);
          localPreviewUrl = null;
        }
        updatePreviewDisplay(null);
        if (statusMsg) {
          statusMsg.textContent = "Avatar will revert to default rank emblem when saved.";
          statusMsg.style.color = "var(--dim)";
        }
        playClick();
      });
    }

    // Form submit
    if (formEl) {
      formEl.addEventListener("submit", async (e) => {
        e.preventDefault();

        const rawName = (nameInput?.value || "").trim();
        const cleanName = rawName || "Hunter";
        const rawGuild = (guildInput?.value || "").trim();
        const cleanGuild = rawGuild || "Hunter Association";

        if (saveBtn) saveBtn.disabled = true;
        if (saveBtnText) saveBtnText.textContent = "Saving Profile...";
        if (editMsg) {
          editMsg.textContent = "Updating profile & syncing to Supabase...";
          editMsg.className = "edit-profile-msg";
          editMsg.style.color = "#00d2ff";
        }

        try {
          let updatedAvatarUrl = state.avatarUrl;

          if (pendingAvatarFile === "REMOVE") {
            updatedAvatarUrl = null;
          } else if (pendingAvatarFile instanceof File) {
            if (statusMsg) statusMsg.textContent = "Uploading image to Supabase...";
            if (currentSupabaseUser) {
              const uploadRes = await uploadProfileAvatar(pendingAvatarFile, currentSupabaseUser.id);
              updatedAvatarUrl = uploadRes.url;
            } else {
              // Client-side compressed data URL for local/guest mode
              updatedAvatarUrl = await createClientAvatarDataUrl(pendingAvatarFile);
            }
          }

          // Update local state
          state.name = cleanName;
          state.guild = cleanGuild;
          state.avatarUrl = updatedAvatarUrl;
          saveState();

          // Sync to Supabase if authenticated
          if (currentSupabaseUser) {
            try {
              await updateHunterProfile({
                name: cleanName,
                avatarUrl: updatedAvatarUrl,
                guild: cleanGuild,
              });
              await saveProgressToSupabase(state);
            } catch (syncErr) {
              console.warn("Supabase profile sync warning:", syncErr);
            }
          }

          // Re-render UI and refresh Leaderboard dynamically
          render();
          refreshLeaderboard(false);

          if (editMsg) {
            editMsg.textContent = "Profile updated successfully!";
            editMsg.className = "edit-profile-msg is-success";
          }
          playSuccess();
          showToast(`✅ Profile updated! Callsign: <b>${cleanName}</b> · Picture synced.`);

          setTimeout(() => {
            closeModal("modalEditProfile");
            if (saveBtn) saveBtn.disabled = false;
            if (saveBtnText) saveBtnText.textContent = "Save Profile";
          }, 400);
        } catch (err) {
          console.error("Profile save error:", err);
          if (saveBtn) saveBtn.disabled = false;
          if (saveBtnText) saveBtnText.textContent = "Save Profile";
          if (editMsg) {
            editMsg.textContent = `Error: ${err.message || "Failed to update profile."}`;
            editMsg.className = "edit-profile-msg is-error";
          }
          playError();
        }
      });
    }
  }

  function createClientAvatarDataUrl(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            const maxDim = 220;
            let width = img.width;
            let height = img.height;
            if (width > height) {
              if (width > maxDim) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              }
            } else {
              if (height > maxDim) {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL("image/webp", 0.88) || canvas.toDataURL("image/jpeg", 0.88));
          } catch (_) {
            resolve(e.target.result);
          }
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    });
  }

  // ---------------------------------------------------------
  // LEADERBOARD HUNTER PROFILE INSPECTOR CONTROLLER
  // ---------------------------------------------------------
  let activeInspectedHunterId = null;

  async function openHunterProfileModalById(userId) {
    if (!userId) return;
    activeInspectedHunterId = userId;

    const isCurrent = Boolean(
      (currentSupabaseUser && userId === currentSupabaseUser.id) ||
      userId === "current-user" ||
      userId === "guest-user" ||
      userId === "my-rank-user" ||
      (state.name && cachedLeaderboardUsers.find((u) => u.id === userId)?.name?.toLowerCase() === state.name.toLowerCase())
    );

    // 1. Find in cache or compute fallback
    let target = cachedLeaderboardUsers.find((u) => u.id === userId);
    if (!target && isCurrent) {
      target = cachedMyStanding || {
        id: currentSupabaseUser?.id || "current-user",
        name: state.name || "Hunter",
        level: state.level || 1,
        total_exp: Math.max(state.totalExp || 0, state.exp || 0),
        streak: state.streak || 0,
        avatar_url: state.avatarUrl || null,
        guild: state.guild || "Hunter Association",
        global_rank: cachedMyStanding?.global_rank || 1,
        is_current_user: true,
      };
    } else if (!target) {
      target = {
        id: userId,
        name: "Hunter",
        level: 1,
        total_exp: 0,
        streak: 0,
        avatar_url: null,
        guild: "Hunter Association",
        global_rank: "-",
      };
    }

    // 2. Fetch fresh profile directly from public.profiles table
    let dbProfile = null;
    try {
      dbProfile = await fetchHunterProfileById(userId);
    } catch (_) {}

    const activeHunter = {
      ...target,
      ...(dbProfile || {}),
      name: dbProfile?.name || target.name || "Hunter",
      total_exp: dbProfile?.total_exp != null ? Number(dbProfile.total_exp) : Number(target.total_exp || 0),
      streak: dbProfile?.streak != null ? Number(dbProfile.streak) : Number(target.streak || 0),
      avatar_url: dbProfile?.avatar_url || target.avatar_url || (isCurrent ? state.avatarUrl : null),
      bio: dbProfile?.bio || target.bio || null,
    };

    const totalExp = Math.max(0, Number(activeHunter.total_exp) || 0);
    const derived = getLevelAndExpFromTotal(totalExp);
    const rankInfo = rankInfoForLevel(derived.level);
    const rankTitle = getRankTitle(derived.level);
    const pct = derived.level >= 100 ? 100 : Math.min(100, (derived.exp / Math.max(1, derived.required)) * 100);
    const remaining = Math.max(0, derived.required - derived.exp);

    // Populate Hero
    const nameEl = $("#hpName");
    if (nameEl) nameEl.textContent = activeHunter.name || "Hunter";

    const youBadge = $("#hpYouBadge");
    if (youBadge) youBadge.style.display = isCurrent ? "inline-block" : "none";

    const posPill = $("#hpPosPill");
    if (posPill) {
      const pos = target.global_rank || cachedMyStanding?.global_rank || "-";
      posPill.textContent = `#${pos} Global Rank`;
    }

    // Change Avatar Button: Visible ONLY if viewing your own profile!
    const changeAvatarBtn = $("#hpChangeAvatarBtn");
    if (changeAvatarBtn) {
      changeAvatarBtn.style.display = isCurrent ? "inline-flex" : "none";
    }

    const guildEl = $("#hpGuild");
    if (guildEl) guildEl.textContent = activeHunter.guild || "Hunter Association";

    const tierEl = $("#hpTier");
    if (tierEl) tierEl.textContent = `${rankTitle} Tier`;

    const bioEl = $("#hpBio");
    if (bioEl) {
      bioEl.textContent = activeHunter.bio || "Awakened hunter registered in the Supabase Hunter Association database.";
    }

    const rankLetterEl = $("#hpRankLetter");
    if (rankLetterEl) {
      rankLetterEl.textContent = `Rank ${rankInfo.rank}`;
      rankLetterEl.className = `hp-rank-badge rank-${rankInfo.rank.toLowerCase()}`;
    }

    // Avatar
    const avatarFrame = $("#hpAvatarFrame");
    const avatarImg = $("#hpAvatarImg");
    const avatarFallback = $("#hpAvatarFallback");
    if (avatarFrame) {
      avatarFrame.className = `hp-avatar-frame rank-${rankInfo.rank.toLowerCase()} ${isCurrent ? "is-editable" : ""}`;
      avatarFrame.title = isCurrent ? "Click to upload / change your hunter picture" : "Hunter Avatar";
    }
    if (activeHunter.avatar_url) {
      if (avatarImg) {
        avatarImg.src = activeHunter.avatar_url;
        avatarImg.style.display = "block";
      }
      if (avatarFallback) avatarFallback.style.display = "none";
    } else {
      if (avatarImg) avatarImg.style.display = "none";
      if (avatarFallback) {
        avatarFallback.style.display = "block";
        avatarFallback.textContent = (activeHunter.name || "H").charAt(0).toUpperCase();
      }
    }

    // Stats Grid
    const lvEl = $("#hpLevel");
    if (lvEl) lvEl.textContent = `Lv. ${derived.level}`;
    const lvSub = $("#hpLevelSub");
    if (lvSub) lvSub.textContent = `Clearance: Rank ${rankInfo.rank}`;

    const totalExpEl = $("#hpTotalExp");
    if (totalExpEl) totalExpEl.textContent = `${totalExp.toLocaleString()} XP`;
    const rankTitleSub = $("#hpRankTitleSub");
    if (rankTitleSub) rankTitleSub.textContent = `Rank Title: ${rankTitle}`;

    const curExpEl = $("#hpCurrentExp");
    if (curExpEl) curExpEl.textContent = `${derived.exp.toLocaleString()} / ${derived.required.toLocaleString()} EXP`;
    const expToNext = $("#hpExpToNext");
    if (expToNext) expToNext.textContent = derived.level >= 100 ? "Max Level Reached" : `${remaining.toLocaleString()} EXP to Level ${derived.level + 1}`;

    const streakEl = $("#hpStreak");
    if (streakEl) streakEl.textContent = `${activeHunter.streak || 0} Days`;

    // Progress Bar
    const barLeft = $("#hpBarLeftLabel");
    if (barLeft) barLeft.textContent = `Level ${derived.level} Progress`;
    const barRight = $("#hpBarRightLabel");
    if (barRight) barRight.textContent = `${pct.toFixed(1)}%`;
    const barFill = $("#hpBarFill");
    if (barFill) barFill.style.width = `${pct}%`;

    // Clearance Details (Secure Read-Only)
    const detailId = $("#hpDetailId");
    if (detailId) detailId.textContent = activeHunter.id || userId;
    const detailDbStatus = $("#hpDetailDbStatus");
    if (detailDbStatus) detailDbStatus.textContent = dbProfile ? "Verified in public.profiles" : "Synced via Leaderboard Cache";
    const detailClearance = $("#hpDetailClearance");
    if (detailClearance) detailClearance.textContent = `Rank ${rankInfo.rank} • ${rankTitle} Clearance`;
    const detailUpdated = $("#hpDetailUpdated");
    if (detailUpdated) detailUpdated.textContent = activeHunter.updated_at ? new Date(activeHunter.updated_at).toLocaleString() : "Real-time Synced";

    openModal("modalLeaderboardProfile");
    playClick();
  }

  function initHunterProfileModal() {
    // Click "Add / Change Picture" button to open avatar uploader
    const changeAvatarBtn = $("#hpChangeAvatarBtn");
    if (changeAvatarBtn) {
      changeAvatarBtn.addEventListener("click", () => {
        closeModal("modalLeaderboardProfile");
        openModal("modalEditProfile");
        playClick();
      });
    }

    // Clicking avatar frame on your own profile also opens avatar uploader
    const avatarFrame = $("#hpAvatarFrame");
    if (avatarFrame) {
      avatarFrame.addEventListener("click", () => {
        const isCurrent = Boolean(
          (currentSupabaseUser && activeInspectedHunterId === currentSupabaseUser.id) ||
          activeInspectedHunterId === "current-user" ||
          activeInspectedHunterId === "guest-user" ||
          activeInspectedHunterId === "my-rank-user" ||
          (state.name && cachedLeaderboardUsers.find((u) => u.id === activeInspectedHunterId)?.name?.toLowerCase() === state.name.toLowerCase())
        );
        if (isCurrent) {
          closeModal("modalLeaderboardProfile");
          openModal("modalEditProfile");
          playClick();
        }
      });
    }
  }

  // ---------------------------------------------------------
  // INIT
  // ---------------------------------------------------------
  touchStreak();
  saveState();
  render();
  initSidebarCollapse();
  initEditProfileModal();
  initSupabaseController();
  initHunterProfileModal();
  refreshLeaderboard(false);
  initLeaderboardRealtime();
})();

