"use strict";
/**
 * Clawkeeper-Bands Config Manager
 * Manages Clawkeeper-Bands configuration in OpenClaw's openclaw.json
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isOpenClawInstalled = isOpenClawInstalled;
exports.loadOpenClawConfig = loadOpenClawConfig;
exports.saveOpenClawConfig = saveOpenClawConfig;
exports.registerPlugin = registerPlugin;
exports.unregisterPlugin = unregisterPlugin;
exports.isPluginRegistered = isPluginRegistered;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const Logger_1 = require("../core/Logger");
const OPENCLAW_HOME = process.env.OPENCLAW_HOME || path_1.default.join(os_1.default.homedir(), '.openclaw');
const OPENCLAW_CONFIG_FILE = path_1.default.join(OPENCLAW_HOME, 'openclaw.json');
/**
 * Check if OpenClaw is installed
 */
async function isOpenClawInstalled() {
    return await fs_extra_1.default.pathExists(OPENCLAW_HOME);
}
/**
 * Load OpenClaw's main configuration
 */
async function loadOpenClawConfig() {
    try {
        if (!(await fs_extra_1.default.pathExists(OPENCLAW_CONFIG_FILE))) {
            return null;
        }
        return await fs_extra_1.default.readJson(OPENCLAW_CONFIG_FILE);
    }
    catch (error) {
        Logger_1.logger.error('Failed to load OpenClaw config', { error });
        return null;
    }
}
/**
 * Save OpenClaw's main configuration
 */
async function saveOpenClawConfig(config) {
    try {
        await fs_extra_1.default.ensureDir(OPENCLAW_HOME);
        await fs_extra_1.default.writeJson(OPENCLAW_CONFIG_FILE, config, { spaces: 2 });
        Logger_1.logger.info('OpenClaw config saved', { path: OPENCLAW_CONFIG_FILE });
    }
    catch (error) {
        Logger_1.logger.error('Failed to save OpenClaw config', { error });
        throw error;
    }
}
/**
 * Register Clawkeeper-Bands plugin in OpenClaw's config (plugins.entries["clawkeeper-bands"])
 */
async function registerPlugin(defaultAction = 'ASK') {
    const config = await loadOpenClawConfig();
    if (!config) {
        Logger_1.logger.warn('OpenClaw config not found, skipping plugin registration');
        return;
    }
    if (!config.plugins || typeof config.plugins !== 'object') {
        config.plugins = {};
    }
    if (!config.plugins.entries || typeof config.plugins.entries !== 'object') {
        config.plugins.entries = {};
    }
    config.plugins.entries['clawkeeper-bands'] = {
        enabled: true,
        config: { defaultAction },
    };
    await saveOpenClawConfig(config);
    Logger_1.logger.info('Registered Clawkeeper-Bands in OpenClaw config (plugins.entries["clawkeeper-bands"])');
}
/**
 * Unregister Clawkeeper-Bands plugin from OpenClaw's config
 */
async function unregisterPlugin() {
    const config = await loadOpenClawConfig();
    if (!config?.plugins?.entries) {
        return;
    }
    delete config.plugins.entries['clawkeeper-bands'];
    await saveOpenClawConfig(config);
    Logger_1.logger.info('Unregistered Clawkeeper-Bands plugin from OpenClaw config');
}
/**
 * Check if Clawkeeper-Bands is registered in OpenClaw
 */
async function isPluginRegistered() {
    const config = await loadOpenClawConfig();
    return !!config?.plugins?.entries?.['clawkeeper-bands'];
}
//# sourceMappingURL=config-manager.js.map