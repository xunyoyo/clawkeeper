"use strict";
/**
 * Clawkeeper-Bands StatsTracker
 * Tracks statistics about decisions (~/.openclaw/clawkeeper-bands/stats.json)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatsTracker = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const Logger_1 = require("../core/Logger");
const STATS_FILE = path_1.default.join(Logger_1.CLAWKEEPER_BANDS_DATA_DIR, 'stats.json');
/** Serializes concurrent writes to prevent lost increments. */
let writeChain = Promise.resolve();
class StatsTracker {
    /**
     * Load stats from disk
     */
    static async load() {
        try {
            await fs_extra_1.default.ensureDir(Logger_1.CLAWKEEPER_BANDS_DATA_DIR);
            if (await fs_extra_1.default.pathExists(STATS_FILE)) {
                return await fs_extra_1.default.readJson(STATS_FILE);
            }
            else {
                // Initialize with zeros
                const initialStats = {
                    totalCalls: 0,
                    approved: 0,
                    rejected: 0,
                    blocked: 0,
                    allowed: 0,
                    avgDecisionTime: 0,
                    lastReset: new Date().toISOString(),
                };
                await this.save(initialStats);
                return initialStats;
            }
        }
        catch (error) {
            Logger_1.logger.error('Failed to load stats', { error });
            throw error;
        }
    }
    /**
     * Save stats to disk
     */
    static async save(stats) {
        try {
            await fs_extra_1.default.ensureDir(Logger_1.CLAWKEEPER_BANDS_DATA_DIR);
            await fs_extra_1.default.writeJson(STATS_FILE, stats, { spaces: 2 });
        }
        catch (error) {
            Logger_1.logger.error('Failed to save stats', { error });
            throw error;
        }
    }
    /**
     * Increment a stat counter and update average decision time
     */
    static async increment(decision, decisionTime) {
        // Serialize writes to prevent concurrent load/modify/save from losing increments
        const op = writeChain.then(async () => {
            const stats = await this.load();
            stats.totalCalls++;
            switch (decision) {
                case 'ALLOWED':
                    stats.allowed++;
                    break;
                case 'APPROVED':
                    stats.approved++;
                    break;
                case 'REJECTED':
                    stats.rejected++;
                    break;
                case 'BLOCKED':
                    stats.blocked++;
                    break;
            }
            // Update rolling average decision time
            const totalDecisionTime = stats.avgDecisionTime * (stats.totalCalls - 1) + decisionTime;
            stats.avgDecisionTime = Math.round(totalDecisionTime / stats.totalCalls);
            await this.save(stats);
        });
        writeChain = op.catch(() => { });
        return op;
    }
    /**
     * Reset all stats to zero
     */
    static async reset() {
        const resetStats = {
            totalCalls: 0,
            approved: 0,
            rejected: 0,
            blocked: 0,
            allowed: 0,
            avgDecisionTime: 0,
            lastReset: new Date().toISOString(),
        };
        await this.save(resetStats);
        Logger_1.logger.info('Stats reset');
    }
    /**
     * Get the stats file path
     */
    static getPath() {
        return STATS_FILE;
    }
}
exports.StatsTracker = StatsTracker;
//# sourceMappingURL=StatsTracker.js.map