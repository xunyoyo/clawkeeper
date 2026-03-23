# TOOLS — Clawkeeper Watcher (Remote Mode)

## Available Tools

### context-judge
- **Route**: `POST /plugins/clawkeeper-watcher/context-judge`
- **Purpose**: Evaluate context payloads for risk and relevance
- **Input**: Context payload with metadata
- **Output**: Structured judgment with verdict, confidence, reasoning

## Unavailable Tools (Remote Mode)

The following tools are only available in local mode:

- **local-audit**: File system audit and integrity checks
- **skill-scan**: Scan and evaluate installed skills
- **log-analysis**: Parse and analyze runtime logs
- **state-inspection**: Inspect runtime state files
