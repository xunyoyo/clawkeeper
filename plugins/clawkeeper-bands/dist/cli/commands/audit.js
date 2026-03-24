"use strict";
/**
 * Clawkeeper-Bands Audit Command
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditCommand = auditCommand;
const chalk_1 = __importDefault(require("chalk"));
const Logger_1 = require("../../core/Logger");
const DecisionLog_1 = require("../../storage/DecisionLog");
async function auditCommand(options) {
    console.log("");
    console.log(chalk_1.default.bold.cyan("═".repeat(80)));
    console.log(chalk_1.default.bold.cyan("   📋 Clawkeeper-Bands Audit Trail"));
    console.log(chalk_1.default.bold.cyan("═".repeat(80)));
    console.log("");
    try {
        const lineCount = parseInt(options.lines, 10);
        const decisions = await DecisionLog_1.DecisionLog.readLast(lineCount);
        if (decisions.length === 0) {
            console.log(chalk_1.default.yellow("No decisions recorded yet."));
            console.log("");
            return;
        }
        console.log(chalk_1.default.dim(`Showing last ${decisions.length} decision(s):`));
        console.log("");
        decisions.forEach((record) => {
            const timestamp = new Date(record.timestamp).toLocaleTimeString();
            const decisionColor = record.decision === "ALLOWED" || record.decision === "APPROVED" ? chalk_1.default.green : chalk_1.default.red;
            const decisionText = decisionColor(record.decision.padEnd(10));
            const timeText = chalk_1.default.dim(`${(record.decisionTime / 1000).toFixed(1)}s`.padStart(6));
            const userText = record.userId ? chalk_1.default.dim(` (${record.userId})`) : "";
            const reasonText = record.reason ? chalk_1.default.dim(` - ${record.reason}`) : "";
            console.log(`${chalk_1.default.dim(timestamp)} | ${chalk_1.default.cyan(`${record.module}.${record.method}`.padEnd(25))} | ${decisionText} | ${timeText}${userText}${reasonText}`);
        });
        console.log("");
        console.log(chalk_1.default.dim(`Audit log: ${DecisionLog_1.DecisionLog.getPath()}`));
        console.log("");
    }
    catch (error) {
        console.error(chalk_1.default.red("❌ Failed to load audit trail:"), error);
        Logger_1.logger.error("Audit command failed", { error });
        process.exit(1);
    }
}
//# sourceMappingURL=audit.js.map