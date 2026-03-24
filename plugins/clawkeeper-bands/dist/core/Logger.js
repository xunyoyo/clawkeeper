"use strict";
/**
 * Clawkeeper-Bands Logger
 * Production-grade logging with Winston
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLAWKEEPER_BANDS_DATA_DIR = exports.LOG_PATH = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
const os_1 = __importDefault(require("os"));
// Determine Clawkeeper-Bands home directory
const OPENCLAW_HOME = process.env.OPENCLAW_HOME || path_1.default.join(os_1.default.homedir(), '.openclaw');
const CLAWKEEPER_BANDS_HOME = path_1.default.join(OPENCLAW_HOME, 'clawkeeper-bands');
// Ensure the data directory exists
if (!(0, fs_1.existsSync)(CLAWKEEPER_BANDS_HOME)) {
    (0, fs_1.mkdirSync)(CLAWKEEPER_BANDS_HOME, { recursive: true });
}
const LOG_FILE = path_1.default.join(CLAWKEEPER_BANDS_HOME, 'clawkeeper-bands.log');
exports.logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
    defaultMeta: { service: 'clawkeeper-bands' },
    transports: [
        // Console transport (colorized for development)
        new winston_1.default.transports.Console({
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.printf((info) => {
                const { timestamp, level, message, ...meta } = info;
                const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
                return `[${String(timestamp ?? '')}] ${String(level ?? '')}: ${String(message ?? '')} ${metaStr}`;
            })),
        }),
        // File transport (structured JSON logs)
        new winston_1.default.transports.File({
            filename: LOG_FILE,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            format: winston_1.default.format.json(),
        }),
    ],
});
// Export the log file path for reference
exports.LOG_PATH = LOG_FILE;
exports.CLAWKEEPER_BANDS_DATA_DIR = CLAWKEEPER_BANDS_HOME;
//# sourceMappingURL=Logger.js.map