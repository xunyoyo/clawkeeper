import { createAuditContext, runAudit } from "../core/audit-engine.js";
import { startDriftMonitor, stopDriftMonitor } from "../core/drift-monitor.js";
import { harden } from "../core/hardening.js";
import { readLogFile, getLogFiles, getTodayLogPath } from "../core/interceptor.js";
import { PLUGIN_ID, PLUGIN_NAME } from "../core/metadata.js";
import { rollback } from "../core/rollback.js";
import {
  scanLogsForSecurityRisks,
  formatScanResults,
  saveSecurityScanReport,
} from "../core/security-scanner.js";
import { scanSkill } from "../core/skill-scanner.js";
import { resolveStateDir, resolveUserOpenClawStateDir } from "../core/state.js";
import { formatConsoleReport, formatSkillScanReport } from "../reporters/console-reporter.js";
import { formatJsonReport } from "../reporters/json-reporter.js";

const VALID_MODES = new Set(["remote", "local"]);

/**
 * Resolve the active clawkeeper mode for CLI context.
 * Same semantics as sdk.js resolveMode: config.mode → CLAWKEEPER_MODE env → 'local'.
 */
function resolveCliMode(config) {
  const fromConfig = config?.mode;
  if (typeof fromConfig === "string" && VALID_MODES.has(fromConfig)) {
    return fromConfig;
  }
  const fromEnv = process.env.CLAWKEEPER_MODE;
  if (typeof fromEnv === "string" && VALID_MODES.has(fromEnv)) {
    return fromEnv;
  }
  return "local";
}

function requireLocalMode(mode, commandName) {
  if (mode !== "local") {
    console.error(
      `[${PLUGIN_NAME}] "${commandName}" is only available in local mode (current: ${mode}).`,
    );
    console.error(`[${PLUGIN_NAME}] Please run this command on the local clawkeeper instance.`);
    return false;
  }
  return true;
}

export function registerCliCommands({ program, config }) {
  const mode = resolveCliMode(config);
  const root = program.command(PLUGIN_ID).description(`${PLUGIN_NAME} core security controls`);

  root
    .command("audit")
    .description("Run the core security audit (local only)")
    .option("--json", "Output JSON")
    .option("--fix", "Apply safe fixes after audit")
    .action(async (...args) => {
      if (!requireLocalMode(mode, "audit")) {
        return;
      }
      const opts = args[0] ?? {};
      const userOpenClawStateDir = await resolveUserOpenClawStateDir();
      const context = await createAuditContext(userOpenClawStateDir, config);
      const report = await runAudit(context);
      console.log(opts.json ? formatJsonReport(report) : formatConsoleReport(report));

      if (opts.fix) {
        const result = await harden(userOpenClawStateDir, config);
        console.log(`\nUser OpenClaw hardening applied. Backup: ${result.backupDir}`);
      }
    });

  root
    .command("harden")
    .description("Apply safe hardening changes (local only)")
    .action(async () => {
      if (!requireLocalMode(mode, "harden")) {
        return;
      }
      const userOpenClawStateDir = await resolveUserOpenClawStateDir();
      const result = await harden(userOpenClawStateDir, config);
      console.log(`User OpenClaw hardening applied. Backup: ${result.backupDir}`);
      for (const action of result.actions) {
        console.log(`  - ${action}`);
      }
    });

  root
    .command("monitor")
    .description("Run drift monitoring in the foreground (local only)")
    .action(async () => {
      if (!requireLocalMode(mode, "monitor")) {
        return;
      }
      const userOpenClawStateDir = await resolveUserOpenClawStateDir();
      await startDriftMonitor(userOpenClawStateDir, config, console);
      console.log(
        "Clawkeeper-Watcher drift monitor for user OpenClaw is running. Press Ctrl+C to stop.",
      );

      const shutdown = async () => {
        await stopDriftMonitor();
        process.exit(0);
      };

      process.once("SIGINT", shutdown);
      process.once("SIGTERM", shutdown);
      await new Promise(() => {});
    });

  root
    .command("rollback")
    .description("Restore the latest or selected backup (local only)")
    .argument("[backup]", "Backup folder name")
    .action(async (...args) => {
      if (!requireLocalMode(mode, "rollback")) {
        return;
      }
      const userOpenClawStateDir = await resolveUserOpenClawStateDir();
      const result = await rollback(userOpenClawStateDir, args[0]);
      console.log(`User OpenClaw rollback restored from: ${result.backupDir}`);
      for (const restored of result.restoredFiles) {
        console.log(`  - ${restored}`);
      }
    });

  root
    .command("status")
    .description("Show current score only")
    .action(async () => {
      const stateDir =
        mode === "local" ? await resolveUserOpenClawStateDir() : await resolveStateDir();
      const context = await createAuditContext(stateDir, config);
      const report = await runAudit(context);
      console.log(`Clawkeeper-Watcher score: ${report.score}/100`);
      console.log(`Top threats: ${Object.keys(report.threatSummary).join(", ") || "none"}`);
    });

  root
    .command("logs")
    .description("Show event logs (tool calls, messages, LLM interactions, etc.)")
    .option("--date <date>", "Show logs for specific date (YYYY-MM-DD), defaults to today")
    .option("--all", "Show all available log files")
    .option(
      "--type <type>",
      "Filter by event type (before_tool_call, message_received, message_sending, llm_input, llm_output)",
    )
    .option("--tool <name>", "Filter by tool name (only for before_tool_call events)")
    .option("--scan", "Scan logs for security risks")
    .option("--save-report [value]", "Save security scan report to file (default: false)", "false")
    .option("--limit <number>", "Limit output lines", "20")
    .action(async (...args) => {
      const opts = args[0] ?? {};

      if (opts.all) {
        const files = await getLogFiles();
        if (files.length === 0) {
          console.log("📭 No log files found");
          return;
        }
        console.log("📋 Available log files:");
        files.forEach((f) => console.log(`  • ${f}`));
        return;
      }

      let filename;
      if (opts.date) {
        filename = `${opts.date}.jsonl`;
      } else {
        const now = new Date();
        const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
        const today = beijingTime.toISOString().split("T")[0];
        filename = `${today}.jsonl`;
      }

      const records = await readLogFile(filename);

      if (records.length === 0) {
        console.log(`📭 No events logged for ${filename}`);
        return;
      }

      // Handle --scan option for security scanning
      if (opts.scan) {
        const stateDir = await resolveStateDir();
        const shouldSaveReport =
          opts.saveReport && (opts.saveReport === true || opts.saveReport === "true");
        const scanResult = scanLogsForSecurityRisks(records);

        if (shouldSaveReport) {
          const reportPath = await saveSecurityScanReport(scanResult, records, stateDir, filename);
          console.log(formatScanResults(scanResult, records));
          console.log(`\n📁 Report saved: ${reportPath}`);
        } else {
          console.log(formatScanResults(scanResult, records));
        }
        return;
      }

      // Filter by type if specified
      let filtered = records;
      if (opts.type) {
        filtered = records.filter((r) => r.type === opts.type);
      }

      // Filter by tool name if specified (only for before_tool_call events)
      if (opts.tool) {
        filtered = filtered.filter(
          (r) => r.toolName && r.toolName.toLowerCase().includes(opts.tool.toLowerCase()),
        );
      }

      if (filtered.length === 0) {
        const filterDesc = opts.type
          ? `type: ${opts.type}`
          : opts.tool
            ? `tool: ${opts.tool}`
            : "filters";
        console.log(`📭 No events found matching ${filterDesc}`);
        return;
      }

      // Show limited results
      const limit = parseInt(opts.limit, 10) || 20;
      const displayed = filtered.slice(-limit);

      console.log(
        `\n📊 Event Logs (${filename}) - Latest ${displayed.length}/${filtered.length}\n`,
      );
      console.log("┌──────────────────────────────────────────────────────────────────────────┐");
      displayed.forEach((record) => {
        const eventLabel = record.type.padEnd(18);
        const timeAndType = `${record.timestamp} │ ${eventLabel}`;
        console.log(`│ ${timeAndType} │`);

        // Show event-specific details
        if (record.type === "before_tool_call") {
          console.log(`│   Tool: ${(record.toolName || "unknown").padEnd(35)} │`);
          if (record.paramsCount > 0) {
            console.log(`│   Params: ${record.paramsCount} args`);
          }
        } else if (record.type === "message_received" || record.type === "message_sending") {
          const direction = record.type === "message_received" ? "from" : "to";
          const target = record.type === "message_received" ? record.from : record.to;
          console.log(`│   ${direction.padEnd(6)}: ${(target || "unknown").substring(0, 50)}`);
          if (record.content) {
            console.log(`│   Content: ${record.content.substring(0, 50)}...`);
          }
        } else if (record.type === "llm_input") {
          console.log(`│   Model: ${(record.model || "unknown").padEnd(35)} │`);
          console.log(`│   Prompt length: ${record.promptLength} chars │`);
        } else if (record.type === "llm_output") {
          console.log(`│   Model: ${(record.model || "unknown").padEnd(35)} │`);
          if (record.totalTokens) {
            console.log(
              `│   Tokens: ${record.totalTokens} (input: ${record.inputTokens}, output: ${record.outputTokens}) │`,
            );
          }
          if (record.assistantTexts && Array.isArray(record.assistantTexts)) {
            const textPreview = record.assistantTexts[0]?.substring(0, 50) || "";
            if (textPreview) {
              console.log(`│   Response: ${textPreview}...`);
            }
          }
        }
      });
      console.log("└──────────────────────────────────────────────────────────────────────────┘");
      console.log(`\n💾 Log file: ${filename}`);
      if (opts.type || opts.tool) {
        const filters = [];
        if (opts.type) {
          filters.push(`type: ${opts.type}`);
        }
        if (opts.tool) {
          filters.push(`tool: ${opts.tool}`);
        }
        console.log(`🔍 Filters applied: ${filters.join(", ")}`);
      }
    });

  root
    .command("log-path")
    .description("Show the path to today's log file")
    .action(async () => {
      const logPath = await getTodayLogPath();
      console.log(`📁 Today's log file: ${logPath}`);
    });

  root
    .command("scan-skill")
    .description("Scan another skill for unsafe patterns")
    .argument("<target>", "Skill name in ~/.openclaw/skills or a local path")
    .option("--json", "Output JSON")
    .action(async (...args) => {
      const target = args[0];
      const opts = args[1] ?? {};
      const report = await scanSkill(target);
      console.log(opts.json ? formatJsonReport(report) : formatSkillScanReport(report));
    });
}
