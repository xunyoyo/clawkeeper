# Clawkeeper

Clawkeeper is a watcher-focused fork built on top of [OpenClaw](https://github.com/openclaw/openclaw).
The project centers on `clawkeeper-watcher`: a dual-mode governance layer that adds context judgment, audit, hardening, drift monitoring, and remote risk intelligence around an OpenClaw runtime.

[Repository](https://github.com/xunyoyo/clawkeeper) · [Watcher Plugin](plugins/clawkeeper-watcher/README.md) · [Launcher Source](clawkeeper/) · [Vision](VISION.md) · [License](LICENSE)

## What Clawkeeper Is

Clawkeeper is not trying to re-document the full upstream OpenClaw platform from the repo homepage.
Instead, this repository presents a Clawkeeper-specific runtime model:

- A `clawkeeper` launcher that boots isolated OpenClaw environments
- A `clawkeeper-watcher` plugin that provides dual-mode governance
- Separate `remote` and `local` operating modes with different trust and remediation boundaries

The launcher delegates to the underlying `openclaw` runtime, but the top-level workflow and repository identity are Clawkeeper-first.

## Dual-Mode Governance Model

`clawkeeper-watcher` runs in two modes:

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

### Remote mode

Remote mode acts as a read-only decision service. It is designed for:

- risk judgment
- confirmation gating before execution continues
- multi-turn session state judgment across forwarded context
- decision memory persistence for non-continue and elevated-risk outcomes
- cross-session fingerprint matching for recurring risk patterns
- per-agent behavior profiling against historical baselines
- semantic intent drift detection when the tool chain diverges from user intent
- structured context review through `POST /plugins/clawkeeper-watcher/context-judge`

### Local mode

Local mode is the governance and remediation side. It is designed for:

- local context judgment with local-side evidence and `localEnhanced: true`
- startup audit against the user's OpenClaw state under `~/.openclaw`
- optional startup audit summaries forwarded back to the user's OpenClaw via a clawbands bridge
- safe auto hardening for explicitly auto-fixable issues only
- drift monitoring for key config and rules files with deduplicated high-severity alerts
- runtime governance records for decisions, audits, hardening runs, and drift detections
- periodic user skill guarding under `~/.openclaw/skills`
- local security audits
- safe hardening and rollback
- drift monitoring
- third-party skill scanning
- backup and rollback before local fixes are applied
- local log inspection and remediation guidance

## Context Judge Contract

Both modes expose the same route:

```text
POST /plugins/clawkeeper-watcher/context-judge
```

The handler returns one of three decisions:

- `continue`
- `ask_user`
- `stop`

The base response shape includes:

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

Mode-specific behavior:

- Local mode returns `mode: "local"` and `localEnhanced: true`
- Remote mode returns `mode: "remote"` and `localEnhanced: false`
- Remote mode may additionally attach fingerprint, agent-anomaly, or intent-drift signals when those features are enabled
- Decision memory is persisted only in remote mode

## Local Governance Features

The local side governs the user's OpenClaw state, not just Clawkeeper's own launcher workspace.

### Startup Audit

On gateway start in local mode, the watcher audits the user's `~/.openclaw` state and summarizes the current risk posture.
By default, notification forwarding is bridge-based and summary-only: risky startup findings can be sent back to the user's OpenClaw through an installed clawbands route, while full remediation detail stays in the local audit surface.

### Auto Hardening

When `autoHarden` is enabled, Clawkeeper only applies fixes with an explicit safe remediation path.
It does not rewrite user state indiscriminately.

### Drift Monitoring

The local side watches key policy and configuration files, reruns the audit on change, and only forwards deduplicated CRITICAL or HIGH summaries.

### Skill Guard

When enabled, Skill Guard periodically scans user-installed skills under `~/.openclaw/skills`.
Low-risk results stay local; CRITICAL and HIGH findings can be forwarded through the same bridge path.

### Backup and Rollback

Before local hardening changes are applied, Clawkeeper creates backups and keeps rollback available for the changed files.

## Remote Intelligence Features

Remote mode is where long-horizon judgment signals accumulate.

### Decision Memory

Remote context-judge results persist decision memory for non-continue or elevated-risk outcomes.
That archive keeps stop reasons, risk level, tool summaries, session keys, and other replayable context signals for later comparison.

### Risk Fingerprints

When enabled, incoming requests are compared against known cross-session risk fingerprints derived from decision memory.
Fingerprint matches are attached as additive warnings; they do not replace the base decision flow.

### Agent Behavior Profiling

When enabled, Clawkeeper builds per-agent baselines from historical event logs and compares current tool usage and token patterns against those baselines.

### Intent Drift Detection

Intent drift compares the user's apparent request against the observed tool chain and flags cases where actions move into a different risk domain, such as persistence, credential access, or exfiltration-oriented behavior.

## Repository Layout

```text
.
├─ clawkeeper/                 # Clawkeeper launcher package
├─ plugins/clawkeeper-watcher/ # Watcher plugin and audit logic
├─ src/                        # Upstream OpenClaw core runtime
└─ README.md                   # This project-level overview
```

## Install Clawkeeper From Source

Clawkeeper currently lives inside this repository as a launcher plus plugin layered on top of the OpenClaw codebase.

### 1. Install the repo dependencies

```bash
pnpm install
```

### 2. Build and install the `clawkeeper` CLI

```bash
cd clawkeeper
npm install
npm run build
npm link
cd ..
```

After `npm link`, the `clawkeeper` command is available on your PATH.
By default, Clawkeeper stores its mode directories under `~/.clawkeeper/`.

### 3. Inspect mode status

```bash
clawkeeper status
```

### 4. Initialize a mode

```bash
clawkeeper init remote
clawkeeper init local
```

### 5. Launch through Clawkeeper

```bash
# Remote mode
clawkeeper remote gateway run

# Local mode
clawkeeper local gateway run
```

The launcher prepares isolated state, config, and workspace directories for each mode, then delegates execution to the repo-local `openclaw.mjs` runtime.
Unless you override it with `--root <path>`, the default layout is:

```text
~/.clawkeeper/
├─ remote/
└─ local/
```

## Watcher Commands

The watcher plugin exposes a shared operational surface in both modes:

```bash
npx openclaw clawkeeper-watcher status
npx openclaw clawkeeper-watcher logs
npx openclaw clawkeeper-watcher logs --scan
npx openclaw clawkeeper-watcher scan-skill <name-or-path>
npx openclaw clawkeeper-watcher fingerprints
npx openclaw clawkeeper-watcher profiles
```

Local-only commands are intended for the trusted execution side:

```bash
npx openclaw clawkeeper-watcher audit
npx openclaw clawkeeper-watcher audit --fix
npx openclaw clawkeeper-watcher harden
npx openclaw clawkeeper-watcher monitor
npx openclaw clawkeeper-watcher rollback [backup]
```

For the full plugin surface, see [plugins/clawkeeper-watcher/README.md](plugins/clawkeeper-watcher/README.md).

## How Clawkeeper Relates to OpenClaw

This repository still contains the upstream OpenClaw runtime and many OpenClaw-facing identifiers, commands, and package names.
That is intentional for now.

Current positioning:

- `Clawkeeper` is the repository identity
- `clawkeeper` is the launcher used to choose mode and isolate runtime state
- `clawkeeper-watcher` is the primary project-specific capability
- `openclaw` remains the underlying runtime, plugin host, and command surface being wrapped

So the correct mental model is:

> Clawkeeper is a watcher-oriented operating layer on top of OpenClaw, not yet a full repo-wide rename of OpenClaw itself.

## Current Focus

The near-term goal of this fork is to make the watcher model usable and legible:

- keep remote and local responsibilities explicit
- provide auditable governance around tool use, confirmation boundaries, and skill loading
- preserve enough upstream compatibility to keep the OpenClaw runtime usable underneath

## Status

This repository is in an active transition state from an upstream OpenClaw presentation to a Clawkeeper-specific one.
If a file, package, or command still uses `openclaw`, treat that as upstream runtime inheritance unless a Clawkeeper wrapper has replaced it.
