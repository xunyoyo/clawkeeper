# Clawkeeper

Clawkeeper is a watcher-focused fork built on top of [OpenClaw](https://github.com/openclaw/openclaw).
The project centers on `clawkeeper-watcher`: a dual-mode security layer that adds review, audit, hardening, and drift monitoring around an OpenClaw runtime.

[Repository](https://github.com/xunyoyo/clawkeeper) · [Watcher Plugin](plugins/clawkeeper-watcher/README.md) · [Launcher Source](clawkeeper/) · [Vision](VISION.md) · [License](LICENSE)

## What Clawkeeper Is

Clawkeeper is not trying to re-document the full upstream OpenClaw platform from the repo homepage.
Instead, this repository presents a Clawkeeper-specific runtime model:

- A `clawkeeper` launcher that boots isolated OpenClaw environments
- A `clawkeeper-watcher` plugin that enforces a dual-mode control surface
- Separate `remote` and `local` operating modes with different trust and capability boundaries

The launcher delegates to the underlying `openclaw` runtime, but the top-level workflow and repository identity are Clawkeeper-first.

## Dual-Mode Watcher Model

`clawkeeper-watcher` runs in two modes:

| Capability                           | `remote` | `local` |
| ------------------------------------ | -------- | ------- |
| Context judge HTTP endpoint          | yes      | yes     |
| Passive event logging                | yes      | yes     |
| Read-only status and log inspection  | yes      | yes     |
| Audit / hardening / drift monitoring | no       | yes     |
| Skill scanning and local remediation | no       | yes     |

### Remote mode

Remote mode acts as a read-only second brain. It is designed for:

- risk judgment
- confirmation gating
- passive event logging
- structured context review through `POST /plugins/clawkeeper-watcher/context-judge`

### Local mode

Local mode is the execution side. It is designed for:

- local security audits
- safe hardening and rollback
- drift monitoring
- third-party skill scanning
- local log inspection and remediation

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
- provide auditable security controls around tool use and skill loading
- preserve enough upstream compatibility to keep the OpenClaw runtime usable underneath

## Status

This repository is in an active transition state from an upstream OpenClaw presentation to a Clawkeeper-specific one.
If a file, package, or command still uses `openclaw`, treat that as upstream runtime inheritance unless a Clawkeeper wrapper has replaced it.
