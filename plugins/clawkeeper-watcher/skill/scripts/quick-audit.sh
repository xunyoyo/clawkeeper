#!/usr/bin/env bash
set -euo pipefail

detect_state_dir() {
  if [[ -n "${OPENCLAW_HOME:-}" && -d "${OPENCLAW_HOME}" ]]; then
    printf '%s\n' "${OPENCLAW_HOME}"
    return
  fi

  for candidate in "${HOME}/.openclaw" "${HOME}/.moltbot" "${HOME}/.clawdbot" "${HOME}/clawd"; do
    if [[ -d "${candidate}" ]]; then
      printf '%s\n' "${candidate}"
      return
    fi
  done

  printf '%s\n' "${HOME}/.openclaw"
}

STATE_DIR="$(detect_state_dir)"
CONFIG_FILE="${STATE_DIR}/openclaw.json"
AGENTS_FILE="${STATE_DIR}/AGENTS.md"

printf 'Clawkeeper-Watcher quick audit\n'
printf 'state_dir=%s\n' "${STATE_DIR}"

if [[ ! -f "${CONFIG_FILE}" ]]; then
  printf '[HIGH] config missing: %s\n' "${CONFIG_FILE}"
  exit 0
fi

if grep -q '"bind"[[:space:]]*:[[:space:]]*"0.0.0.0"' "${CONFIG_FILE}"; then
  printf '[HIGH] gateway bind is public\n'
fi

if ! grep -Eq '"authToken"|"token"|"password"' "${CONFIG_FILE}"; then
  printf '[HIGH] no auth token or password detected\n'
fi

if grep -Eq '"mode"[[:space:]]*:[[:space:]]*"(danger-full-access|disabled|off)"' "${CONFIG_FILE}"; then
  printf '[HIGH] sandbox mode is risky\n'
fi

if grep -Eq '"approvals"[[:space:]]*:[[:space:]]*"(never|auto)"' "${CONFIG_FILE}"; then
  printf '[MEDIUM] exec approvals are too open\n'
fi

if [[ ! -f "${AGENTS_FILE}" ]] || ! grep -q 'clawkeeper-watcher:rules:start' "${AGENTS_FILE}"; then
  printf '[MEDIUM] soul rules missing\n'
fi
