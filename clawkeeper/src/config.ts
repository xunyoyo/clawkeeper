/**
 * Default config generation for clawkeeper modes.
 */
import fs from "node:fs";
import { CONTEXT_JUDGE_ROUTE, WATCHER_PLUGIN_ID } from "./constants.js";
import type { ClawkeeperConfig, ClawkeeperModeConfig } from "./types.js";

/**
 * Generate a default config object for the given mode.
 */
export function generateDefaultConfig(modeConfig: ClawkeeperModeConfig): ClawkeeperConfig {
  return {
    mode: modeConfig.mode,
    watcher: {
      enabled: true,
      routes: {
        contextJudge: CONTEXT_JUDGE_ROUTE,
      },
    },
    workspace: modeConfig.workspaceDir,
    logs: modeConfig.logsDir,
    state: modeConfig.stateDir,
    runtime: modeConfig.runtimeDir,
    gateway: {
      port: modeConfig.gatewayPort,
    },
  };
}

/**
 * Write the default config.json for a mode if it doesn't already exist.
 * Returns true if a new config was written, false if it already existed.
 */
export function ensureConfig(modeConfig: ClawkeeperModeConfig): boolean {
  if (fs.existsSync(modeConfig.configPath)) {
    return false;
  }

  const config = generateDefaultConfig(modeConfig);
  fs.writeFileSync(modeConfig.configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
  return true;
}

/**
 * Read the config.json for a mode. Returns null if it doesn't exist.
 */
export function readConfig(modeConfig: ClawkeeperModeConfig): ClawkeeperConfig | null {
  if (!fs.existsSync(modeConfig.configPath)) {
    return null;
  }

  const raw = fs.readFileSync(modeConfig.configPath, "utf-8");
  return JSON.parse(raw) as ClawkeeperConfig;
}
