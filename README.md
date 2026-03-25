# Clawkeeper: Watcher-Based Runtime Governance for OpenClaw

<p align="left">
  <a href="https://github.com/openclaw/openclaw">
    <img src="https://img.shields.io/badge/OpenClaw-Compatible-blue.svg" alt="OpenClaw">
  </a>
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT">
  </a>
</p>

**A watcher-first runtime governance layer for OpenClaw.**

Clawkeeper is centered on `clawkeeper-watcher`, a governance watcher for OpenClaw that adds context judgment, audit, hardening, drift monitoring, rollback, and remote risk intelligence around the runtime. The repository also includes the `clawkeeper` launcher for mode-scoped execution and `clawkeeper-bands`, a user-side approval and bridge plugin for notifications, confirmations, and remote judge relay.

[Repository](https://github.com/xunyoyo/clawkeeper) · [Watcher Plugin](plugins/clawkeeper-watcher/README.md) · [Bands Plugin](plugins/clawkeeper-bands/README.md) · [Clawkeeper Skill](skills/clawkeeper/SKILL.md) · [License](LICENSE)

This repo also ships a matching OpenClaw skill at `skills/clawkeeper/SKILL.md` for setup, configuration, verification, and debugging workflows.

# 💡 Features

Clawkeeper is designed as a watcher-centered governance layer around OpenClaw rather than a single-point filter. It keeps runtime judgment, local remediation, and user-side approvals explicit so the system stays auditable and easier to reason about.

### 👁️ Watcher Core

The watcher is the center of the system:

- **Context Judgment**: Review structured agent context before risky execution continues
- **Shared HTTP Contract**: Expose `POST /plugins/clawkeeper-watcher/context-judge`
- **Event Observation**: Capture tool calls, messages, and LLM activity for later analysis
- **Governance Output**: Return `continue`, `ask_user`, or `stop` with evidence and next-step hints

### 🔐 Local Protection

On the trusted side, the watcher can actively protect local state:

- **Startup Audit**: Inspect local OpenClaw state during startup
- **Safe Hardening**: Apply only explicitly safe remediation paths
- **Drift Monitoring**: Detect policy and config changes and re-audit on change
- **Skill Guard**: Periodically scan user-installed skills under `~/.openclaw/skills`
- **Backup and Rollback**: Preserve rollback points before local fixes are applied

### 👁️ Remote Intelligence

On the remote side, the watcher can accumulate long-horizon security signals:

- **Decision Memory**: Persist elevated-risk and non-continue outcomes
- **Risk Fingerprints**: Match recurring high-risk patterns across sessions
- **Agent Profiling**: Compare current behavior against historical baselines
- **Intent Drift Detection**: Flag tool chains that diverge from the user's apparent request

### 🎯 Mode-Specific Deployment

Clawkeeper packages the watcher into two operating modes with explicit trust boundaries:

- **Remote Watcher**: Read-only risk judgment, confirmation gating, and historical intelligence
- **Local Watcher**: Trusted audit, hardening, rollback, and drift monitoring
- **Operational Isolation**: Each mode runs in its own prepared state, config, and workspace tree

### 🔗 User-Side Bridge

Keep the user-facing gateway separate from the local remediation side:

- **Startup Audit Forwarding**: Send summary notifications back to a user gateway
- **Approval Flow Integration**: Let `clawkeeper-bands` hold pending confirmations on the receiving side
- **Remote Judge Relay**: Forward finished agent context to a remote watcher and surface `continue`, `ask_user`, or `stop`

### 📋 Auditing and Visibility

Make runtime behavior queryable instead of implicit:

- **Event Logging**: Record tool calls, message traffic, and LLM input/output events
- **Risk Scanning**: Analyze event logs for suspicious patterns
- **Structured Output**: Produce shared audit and scan report fields for human review and scripting
- **Mode Status Inspection**: Check initialization status and watcher readiness from the launcher

# 🚀 Quick Start

## Installation From Source

### 1. Install repository dependencies

```bash
pnpm install
```

### 2. Build and link the `clawkeeper` launcher

```bash
cd clawkeeper
npm install
npm run build
npm link
cd ..
```

### 3. Initialize the two operating modes

```bash
clawkeeper init remote
clawkeeper init local
clawkeeper local config set gateway.mode local
```

### 4. Launch through Clawkeeper

```bash
# Remote mode
clawkeeper remote gateway run

# Local mode
clawkeeper local gateway run
```

By default, Clawkeeper stores mode state under:

```text
~/.clawkeeper/
├── remote/
└── local/
```

## Included Skill

Clawkeeper includes a bundled workspace skill:

```text
skills/clawkeeper/SKILL.md
```

Use it when you want the agent to handle Clawkeeper setup, mode initialization, watcher verification, bridge wiring, or troubleshooting through a consistent workflow instead of ad hoc guessing.

## Plugin Entry Points

The repo exposes two main OpenClaw plugins with distinct roles:

- `plugins/clawkeeper-watcher/`
  - watcher-first governance plugin
  - owns `context-judge`, event logging, audit, hardening, rollback, and remote intelligence
- `plugins/clawkeeper-bands/`
  - user-side approval and bridge plugin
  - owns risky tool approval, startup-audit receiving, and remote judge relay

If you only want the core governance engine, start with `clawkeeper-watcher`. If you want user-facing approvals or watcher notifications on a separate gateway, add `clawkeeper-bands`.

---

# 🛠️ Command Reference

### Launcher Commands

```bash
# Show whether each mode has been initialized
clawkeeper status

# Initialize mode directories without launching
clawkeeper init remote
clawkeeper init local

# Run OpenClaw in remote or local mode
clawkeeper remote gateway run
clawkeeper local gateway run
```

### Watcher Commands Available in Both Modes

```bash
# Show the current watcher score and status
clawkeeper remote clawkeeper-watcher status
clawkeeper local clawkeeper-watcher status

# Read logs from the watcher event stream
clawkeeper remote clawkeeper-watcher logs
clawkeeper local clawkeeper-watcher logs --scan

# Inspect local or remote watcher outputs
clawkeeper local clawkeeper-watcher log-path
clawkeeper remote clawkeeper-watcher fingerprints
clawkeeper remote clawkeeper-watcher profiles

# Scan a skill path or installed skill name
clawkeeper local clawkeeper-watcher scan-skill <name-or-path>
```

### Local-Only Governance Commands

```bash
# Run local audit and remediation flows
clawkeeper local clawkeeper-watcher audit
clawkeeper local clawkeeper-watcher audit --json
clawkeeper local clawkeeper-watcher audit --fix
clawkeeper local clawkeeper-watcher harden
clawkeeper local clawkeeper-watcher monitor
clawkeeper local clawkeeper-watcher rollback [backup]
```

### User-Side Bridge Setup

```bash
# Install the user-side receiver plugin on the receiving gateway
openclaw plugins install --link /path/to/clawkeeper/plugins/clawkeeper-bands

# Forward startup-audit summaries from the local watcher
clawkeeper local config set plugins.entries.clawkeeper-watcher.config.notify.userBridge.enabled true
clawkeeper local config set plugins.entries.clawkeeper-watcher.config.notify.userBridge.url http://127.0.0.1:18889
clawkeeper local config set plugins.entries.clawkeeper-watcher.config.notify.userBridge.token <gateway-token>
```

### Plugin Docs

```text
plugins/clawkeeper-watcher/README.md
plugins/clawkeeper-bands/README.md
skills/clawkeeper/SKILL.md
```

# 🔄 Watcher Modes

`clawkeeper-watcher` runs in two modes with different responsibilities:

| Capability                           | `remote` | `local` |
| ------------------------------------ | -------- | ------- |
| Context judge HTTP endpoint          | yes      | yes     |
| Passive event logging                | yes      | yes     |
| Read-only status and log inspection  | yes      | yes     |
| Multi-turn session state judgment    | yes      | yes     |
| Decision memory persistence          | yes      | no      |
| Risk fingerprints                    | yes      | no      |
| Agent behavior profiling             | yes      | no      |
| Intent drift detection               | yes      | yes     |
| Startup audit against user state     | no       | yes     |
| Audit / hardening / drift monitoring | no       | yes     |
| Startup audit notification bridge    | no       | yes     |
| Skill scanning and local remediation | no       | yes     |
| Backup and rollback for local fixes  | no       | yes     |

---

# 🌐 Context Judge Contract

Both modes expose the same HTTP route:

```text
POST /plugins/clawkeeper-watcher/context-judge
```

The handler returns one of three decisions:

- `continue`
- `ask_user`
- `stop`

Typical response shape:

```json
{
  "version": 1,
  "mode": "local",
  "localEnhanced": true,
  "decision": "ask_user",
  "stopReason": "waiting_user_confirmation",
  "shouldContinue": false,
  "needsUserDecision": true,
  "userQuestion": "Command execution or another high-risk tool call was detected. Do you want to continue to the next step?",
  "summary": "The context contains high-risk actions, and the policy requires explicit user confirmation.",
  "riskLevel": "high",
  "evidence": ["tool=bash", "toolCount=2"],
  "nextAction": "ask_user",
  "continueHint": "Continue only after explicit user confirmation."
}
```

# 🎮 Example Flows

### Local-side audit and remediation

Run:

```bash
clawkeeper local clawkeeper-watcher audit
```

Clawkeeper inspects the local runtime state, produces a scored report, and points to safe next steps such as `harden` or manual remediation. When fixes are auto-applicable, rollback remains available before changes are written.

---

### Remote-side risk judgment

Run the remote gateway and send structured agent context to:

```text
POST /plugins/clawkeeper-watcher/context-judge
```

The remote watcher evaluates the context, attaches memory or fingerprint-based warnings when available, and returns a `continue`, `ask_user`, or `stop` decision without modifying local user state.

---

### User-side bridge notifications

Install `clawkeeper-bands` on the receiving gateway and enable the local watcher bridge.

Clawkeeper can then forward startup-audit summaries or user confirmation requests back to the user-facing gateway while keeping full local remediation detail on the trusted side.

---

# 📂 Architecture

Clawkeeper is organized around three main layers:

1. **Watcher Plugin** (`plugins/clawkeeper-watcher/`)
   - Core watcher-first governance layer
   - Owns `POST /plugins/clawkeeper-watcher/context-judge`
   - Handles event logging, audit, hardening, rollback, monitoring, skill scanning, and remote intelligence

2. **Launcher** (`clawkeeper/`)
   - Mode initialization and isolated directory preparation
   - `remote` and `local` execution entry points
   - Shared CLI surface through `clawkeeper ...`

3. **Bands Plugin** (`plugins/clawkeeper-bands/`)
   - User-facing approval and bridge layer
   - Owns `POST /plugins/clawkeeper-bands/clawkeeper-startup-audit`
   - Handles pending confirmations, startup-audit delivery, and remote judge relay

### File Structure

```text
.
├── clawkeeper/                 # Launcher package and mode bootstrap
├── plugins/clawkeeper-watcher/ # Watcher plugin and governance logic
├── plugins/clawkeeper-bands/   # User-side bridge and approval plugin
├── src/                        # Underlying OpenClaw runtime codebase
├── VISION.md                   # Direction and positioning
└── README.md                   # Project overview
```

---

# 📕 Reference

- Watcher plugin: [plugins/clawkeeper-watcher/README.md](plugins/clawkeeper-watcher/README.md)
- Bands plugin: [plugins/clawkeeper-bands/README.md](plugins/clawkeeper-bands/README.md)
- OpenClaw skill: [skills/clawkeeper/SKILL.md](skills/clawkeeper/SKILL.md)
- Vision: [VISION.md](VISION.md)
