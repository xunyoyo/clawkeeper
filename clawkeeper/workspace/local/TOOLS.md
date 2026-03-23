# TOOLS — Clawkeeper Watcher (Local Mode)

## Available Tools

### context-judge
- **Route**: `POST /plugins/clawkeeper-watcher/context-judge`
- **Purpose**: Evaluate context payloads for risk and relevance
- **Input**: Context payload with metadata
- **Output**: Structured judgment with verdict, confidence, reasoning, and local evidence

### local-audit
- **Purpose**: Inspect local file system for integrity checks
- **Scope**: `./clawkeeper/local/` directory tree
- **Output**: File hashes, modification timestamps, anomaly flags

### skill-scan
- **Purpose**: Enumerate and evaluate installed skills and plugins
- **Scope**: Current OpenClaw instance's plugin registry
- **Output**: Skill inventory with version, status, and risk assessment

### log-analysis
- **Purpose**: Parse and search runtime logs
- **Scope**: `./clawkeeper/local/logs/`
- **Output**: Matching log entries, patterns, timeline summaries

### state-inspection
- **Purpose**: Read runtime state files for additional context
- **Scope**: `./clawkeeper/local/state/`
- **Output**: State snapshots, delta comparisons
