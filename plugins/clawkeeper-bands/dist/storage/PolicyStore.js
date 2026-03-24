"use strict";
/**
 * Clawkeeper-Bands PolicyStore
 * Manages persistence of security policies in ~/.openclaw/clawkeeper-bands/policy.json
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyStore = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const Logger_1 = require("../core/Logger");
const POLICY_FILE = path_1.default.join(Logger_1.CLAWKEEPER_BANDS_DATA_DIR, 'policy.json');
function describeError(error) {
    return error instanceof Error ? error.message : JSON.stringify(error);
}
class PolicyStore {
    /**
     * Load the policy from disk, or create default if doesn't exist
     */
    static async load() {
        try {
            // Ensure directory exists
            await fs_extra_1.default.ensureDir(Logger_1.CLAWKEEPER_BANDS_DATA_DIR);
            if (await fs_extra_1.default.pathExists(POLICY_FILE)) {
                const data = await fs_extra_1.default.readJson(POLICY_FILE);
                Logger_1.logger.info('Policy loaded from disk', { path: POLICY_FILE });
                return data;
            }
            else {
                // Create default policy
                Logger_1.logger.info('No existing policy found, creating default');
                const defaultPolicy = {
                    ...config_1.DEFAULT_POLICY,
                    version: '1.0.0',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                await this.save(defaultPolicy);
                return defaultPolicy;
            }
        }
        catch (error) {
            Logger_1.logger.error('Failed to load policy', { error });
            throw new Error(`Failed to load policy: ${describeError(error)}`, { cause: error });
        }
    }
    /**
     * Save the policy to disk
     */
    static async save(policy) {
        try {
            await fs_extra_1.default.ensureDir(Logger_1.CLAWKEEPER_BANDS_DATA_DIR);
            policy.updatedAt = new Date().toISOString();
            await fs_extra_1.default.writeJson(POLICY_FILE, policy, { spaces: 2 });
            Logger_1.logger.info('Policy saved to disk', { path: POLICY_FILE });
        }
        catch (error) {
            Logger_1.logger.error('Failed to save policy', { error });
            throw new Error(`Failed to save policy: ${describeError(error)}`, { cause: error });
        }
    }
    /**
     * Reset policy to defaults
     */
    static async reset() {
        const defaultPolicy = {
            ...config_1.DEFAULT_POLICY,
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        await this.save(defaultPolicy);
        Logger_1.logger.info('Policy reset to defaults');
    }
    /**
     * Load the policy synchronously (for plugin register which must be sync)
     */
    static loadSync() {
        try {
            if (!(0, fs_1.existsSync)(Logger_1.CLAWKEEPER_BANDS_DATA_DIR)) {
                (0, fs_1.mkdirSync)(Logger_1.CLAWKEEPER_BANDS_DATA_DIR, { recursive: true });
            }
            if ((0, fs_1.existsSync)(POLICY_FILE)) {
                const data = JSON.parse((0, fs_1.readFileSync)(POLICY_FILE, 'utf-8'));
                Logger_1.logger.info('Policy loaded from disk (sync)', { path: POLICY_FILE });
                return data;
            }
            else {
                const defaultPolicy = {
                    ...config_1.DEFAULT_POLICY,
                    version: '1.0.0',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                (0, fs_1.writeFileSync)(POLICY_FILE, JSON.stringify(defaultPolicy, null, 2), 'utf-8');
                Logger_1.logger.info('Created default policy (sync)', { path: POLICY_FILE });
                return defaultPolicy;
            }
        }
        catch (error) {
            Logger_1.logger.error('Failed to load policy (sync)', { error });
            throw new Error(`Failed to load policy: ${describeError(error)}`, { cause: error });
        }
    }
    /**
     * Get the policy file path
     */
    static getPath() {
        return POLICY_FILE;
    }
}
exports.PolicyStore = PolicyStore;
//# sourceMappingURL=PolicyStore.js.map