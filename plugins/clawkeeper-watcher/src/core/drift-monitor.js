import fs from 'node:fs';
import { createAuditContext, runAudit } from './audit-engine.js';

/** @type {{ file: string, listener: Function }[]} */
let subscriptions = [];
const watchTimers = new Map();

export async function startDriftMonitor(stateDir, pluginConfig = {}, logger = console) {
  await stopDriftMonitor();

  const context = await createAuditContext(stateDir, pluginConfig);
  for (const file of [context.configPath, context.soulPath]) {
    try {
      const listener = async (curr, prev) => {
        // Skip if file content hasn't actually changed (same mtime and size)
        if (curr.mtime === prev.mtime && curr.size === prev.size) {
          return;
        }

        // Debounce: avoid multiple rapid audits
        const fileKey = file;
        const existingTimer = watchTimers.get(fileKey);
        if (existingTimer) clearTimeout(existingTimer);

        const timer = setTimeout(async () => {
          try {
            const nextContext = await createAuditContext(stateDir, pluginConfig);
            const report = await runAudit(nextContext);
            const risky = report.findings.filter((item) => item.severity === 'CRITICAL' || item.severity === 'HIGH');
            if (risky.length > 0) {
              logger.warn(`[Clawkeeper] drift detected in ${file}: ${risky.map((item) => item.id).join(', ')}`);
            }
          } catch (error) {
            logger.error(`[Clawkeeper] drift monitor failed for ${file}: ${error.message}`);
          }
          watchTimers.delete(fileKey);
        }, 500);

        watchTimers.set(fileKey, timer);
      };

      // Use watchFile for cross-platform stability with debouncing
      fs.watchFile(file, { interval: 1000 }, listener);
      subscriptions.push({ file, listener });
    } catch {
      // best effort
    }
  }
}

export async function stopDriftMonitor() {
  // Unbind all file watchers (best-effort per subscription)
  for (const sub of subscriptions) {
    try {
      fs.unwatchFile(sub.file, sub.listener);
    } catch {
      // best effort — don't interrupt remaining cleanup
    }
  }
  subscriptions = [];

  // Clear all debounce timers
  for (const timer of watchTimers.values()) {
    try {
      clearTimeout(timer);
    } catch {
      // best effort
    }
  }
  watchTimers.clear();
}
