#!/usr/bin/env bash
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  printf 'Node.js is required for quick-harden.sh\n' >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

cd "${PROJECT_DIR}"
node --input-type=module <<'EOF'
import { resolveStateDir } from './src/core/state.js';
import { harden } from './src/core/hardening.js';
const stateDir = await resolveStateDir();
const result = await harden(stateDir);
console.log(`Clawkeeper hardening applied. Backup: ${result.backupDir}`);
for (const action of result.actions) {
  console.log(`- ${action}`);
}
EOF
