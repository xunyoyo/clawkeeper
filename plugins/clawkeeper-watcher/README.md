# Clawkeeper-Watcher for OpenClaw

Core security control plugin for OpenClaw, designed around clawkeeper's dual-end architecture.

## Dual-Mode Operation

The plugin detects its runtime mode from `config.mode` or the `CLAWKEEPER_MODE` environment variable. The default mode is `local`.

| Capability                                                | Remote        | Local |
| --------------------------------------------------------- | ------------- | ----- |
| Context Judge HTTP endpoint                               | yes           | yes   |
| Event logging (tool/message/LLM)                          | yes (passive) | yes   |
| Audit / hardening / drift monitoring                      | -             | yes   |
| User Skill Guard / scan-skill                             | -             | yes   |
| Read-only CLI commands (`status` / `logs` / `scan-skill`) | yes           | yes   |

## Installation

Install the plugin:

```sh
npx openclaw plugins install -l .
```

## Commands

### Available in both modes (`remote` + `local`)

```sh
npx openclaw clawkeeper-watcher status                            # Show the current security score
npx openclaw clawkeeper-watcher logs                              # Show today's event log
npx openclaw clawkeeper-watcher logs --date 2026-03-14            # Show logs for a specific date
npx openclaw clawkeeper-watcher logs --type before_tool_call      # Filter by event type
npx openclaw clawkeeper-watcher logs --tool bash                  # Filter by tool name
npx openclaw clawkeeper-watcher logs --scan                       # Scan the log for security risks
npx openclaw clawkeeper-watcher logs --scan --save-report         # Scan and save a report
npx openclaw clawkeeper-watcher logs --all                        # List all available log files
npx openclaw clawkeeper-watcher log-path                          # Show the path to today's log file
npx openclaw clawkeeper-watcher scan-skill <name-or-path>         # Scan a third-party skill
```

### Local mode only

The following commands are rejected in `remote` mode and must be run on the local side.

```sh
npx openclaw clawkeeper-watcher audit                             # Run the security audit
npx openclaw clawkeeper-watcher audit --json                      # Output JSON
npx openclaw clawkeeper-watcher audit --fix                       # Auto-fix after the audit
npx openclaw clawkeeper-watcher harden                            # Apply safe hardening
npx openclaw clawkeeper-watcher monitor                           # Run drift monitoring in the foreground
npx openclaw clawkeeper-watcher rollback [backup]                 # Restore a backup
```

## Context Judge HTTP Endpoint

Both modes register the same endpoint:

```
POST /plugins/clawkeeper-watcher/context-judge
```

It accepts structured context and returns a decision: `continue`, `stop`, or `ask_user`.
The response includes `mode` and `localEnhanced` so callers can distinguish the active side.

## Control Surface

- Network exposure surface
- Authentication on control entry points
- Filesystem boundary checks
- High-risk execution approval flow
- Runtime rule-loading state
- Third-party skill risk patterns
- Periodic user Skill security scanning
- Event logging -- automatically records tool calls, message traffic, and LLM interactions to `workspace/log/`
- Context Judge -- exposes structured context decisioning over HTTP

## Output Contract

Audit and scan reports follow a shared structure:

- `severity`
- `evidence`
- `autofix`
- `fix`
- `next`

They are designed for both human review and script consumption.

## Example

The repository includes a demo skill:

```sh
npm run smoke:scan
```

This scans `examples/unsafe-skill` and prints a minimal result.

## Development

Run tests:

```sh
npm test
```

Before publishing, confirm:

- `npm test` passes
- `npx openclaw clawkeeper-watcher audit` runs successfully in local mode
- `npx openclaw clawkeeper-watcher scan-skill <path>` runs successfully

## Structure

```text
plugins/clawkeeper-watcher/
  src/
    core/           # Audit engine, hardening, drift monitor, context-judge, and other core logic
    plugin/         # SDK registration, CLI commands, and HTTP handlers
    reporters/      # Console and JSON report formatting
    index.js
  skill/
    configs/        # Skill scanning rule library
  openclaw.plugin.json
  package.json
```
