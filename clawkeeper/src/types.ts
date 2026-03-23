/**
 * Type definitions for the clawkeeper launcher.
 */

/** Watcher run mode — remote or local. */
export type ClawkeeperMode = "remote" | "local";

/** All valid modes. */
export const VALID_MODES: readonly ClawkeeperMode[] = ["remote", "local"] as const;

/** Resolved paths and config for a single mode instance. */
export type ClawkeeperModeConfig = {
  /** The active mode. */
  mode: ClawkeeperMode;
  /** Absolute path to the clawkeeper root (e.g. /abs/path/clawkeeper). */
  rootDir: string;
  /** Absolute path to this mode's directory (e.g. /abs/path/clawkeeper/remote). */
  modeDir: string;
  /** Absolute path to config.json for this mode. */
  configPath: string;
  /** Absolute path to workspace/ for this mode. */
  workspaceDir: string;
  /** Absolute path to logs/ for this mode. */
  logsDir: string;
  /** Absolute path to state/ for this mode (used as OPENCLAW_STATE_DIR). */
  stateDir: string;
  /** Absolute path to runtime/ for this mode. */
  runtimeDir: string;
  /** Gateway port for this mode. */
  gatewayPort: number;
};

/** Persisted config.json shape for a mode. */
export type ClawkeeperConfig = {
  mode: ClawkeeperMode;
  watcher: {
    enabled: boolean;
    routes: {
      contextJudge: string;
    };
  };
  workspace: string;
  logs: string;
  state: string;
  runtime: string;
  gateway: {
    port: number;
  };
};

/** Result from the launcher init/prepare step. */
export type LauncherPrepareResult = {
  modeConfig: ClawkeeperModeConfig;
  env: Record<string, string>;
  created: {
    dirs: string[];
    files: string[];
  };
};
