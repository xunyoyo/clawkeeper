"use strict";
/**
 * Clawkeeper-Bands Stats Command
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.statsCommand = statsCommand;
const chalk_1 = __importDefault(require("chalk"));
const StatsTracker_1 = require("../../storage/StatsTracker");
const Logger_1 = require("../../core/Logger");
async function statsCommand() {
    console.log('');
    console.log(chalk_1.default.bold.cyan('═'.repeat(80)));
    console.log(chalk_1.default.bold.cyan('   📊 Clawkeeper-Bands Statistics'));
    console.log(chalk_1.default.bold.cyan('═'.repeat(80)));
    console.log('');
    try {
        const stats = await StatsTracker_1.StatsTracker.load();
        if (stats.totalCalls === 0) {
            console.log(chalk_1.default.yellow('No activity recorded yet.'));
            console.log('');
            return;
        }
        // Calculate percentages
        const approvedPct = ((stats.approved / stats.totalCalls) * 100).toFixed(1);
        const rejectedPct = ((stats.rejected / stats.totalCalls) * 100).toFixed(1);
        const blockedPct = ((stats.blocked / stats.totalCalls) * 100).toFixed(1);
        const allowedPct = ((stats.allowed / stats.totalCalls) * 100).toFixed(1);
        console.log(chalk_1.default.bold('Total Calls:'), chalk_1.default.white(stats.totalCalls.toString()));
        console.log('');
        console.log(chalk_1.default.bold('Decisions:'));
        console.log(`  ${chalk_1.default.green('✅ Allowed:')}  ${stats.allowed.toString().padStart(6)} (${allowedPct}%)`);
        console.log(`  ${chalk_1.default.green('✅ Approved:')} ${stats.approved.toString().padStart(6)} (${approvedPct}%) - by user`);
        console.log(`  ${chalk_1.default.red('❌ Rejected:')} ${stats.rejected.toString().padStart(6)} (${rejectedPct}%) - by user`);
        console.log(`  ${chalk_1.default.red('🚫 Blocked:')}  ${stats.blocked.toString().padStart(6)} (${blockedPct}%) - by policy`);
        console.log('');
        console.log(chalk_1.default.bold('Average Decision Time:'), chalk_1.default.white(`${(stats.avgDecisionTime / 1000).toFixed(1)}s`));
        console.log('');
        console.log(chalk_1.default.dim(`Last Reset: ${new Date(stats.lastReset).toLocaleString()}`));
        console.log('');
    }
    catch (error) {
        console.error(chalk_1.default.red('❌ Failed to load statistics:'), error);
        Logger_1.logger.error('Stats command failed', { error });
        process.exit(1);
    }
}
//# sourceMappingURL=stats.js.map