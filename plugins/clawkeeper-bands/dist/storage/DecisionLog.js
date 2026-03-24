"use strict";
/**
 * Clawkeeper-Bands DecisionLog
 * Audit trail in JSON Lines format (~/.openclaw/clawkeeper-bands/decisions.jsonl)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DecisionLog = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const Logger_1 = require("../core/Logger");
const DECISIONS_FILE = path_1.default.join(Logger_1.CLAWKEEPER_BANDS_DATA_DIR, 'decisions.jsonl');
class DecisionLog {
    /**
     * Append a decision record to the log (JSON Lines format)
     */
    static async append(record) {
        try {
            await fs_extra_1.default.ensureDir(Logger_1.CLAWKEEPER_BANDS_DATA_DIR);
            // Append as JSON Lines (one JSON object per line)
            const line = JSON.stringify(record) + '\n';
            await fs_extra_1.default.appendFile(DECISIONS_FILE, line, 'utf8');
            Logger_1.logger.debug('Decision logged', { decision: record.decision, module: record.module });
        }
        catch (error) {
            Logger_1.logger.error('Failed to log decision', { error });
            // Don't throw - logging failures shouldn't break execution
        }
    }
    /**
     * Read all decisions from the log
     */
    static async readAll() {
        try {
            if (!(await fs_extra_1.default.pathExists(DECISIONS_FILE))) {
                return [];
            }
            const content = await fs_extra_1.default.readFile(DECISIONS_FILE, 'utf8');
            const lines = content.trim().split('\n').filter(Boolean);
            return lines.map((line) => JSON.parse(line));
        }
        catch (error) {
            Logger_1.logger.error('Failed to read decision log', { error });
            return [];
        }
    }
    /**
     * Read the last N decisions
     */
    static async readLast(n) {
        const all = await this.readAll();
        return all.slice(-n);
    }
    /**
     * Get the decision log file path
     */
    static getPath() {
        return DECISIONS_FILE;
    }
}
exports.DecisionLog = DecisionLog;
//# sourceMappingURL=DecisionLog.js.map