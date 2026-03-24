"use strict";
/**
 * Clawkeeper-Bands Enable/Disable Commands
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.disableCommand = disableCommand;
exports.enableCommand = enableCommand;
const chalk_1 = __importDefault(require("chalk"));
const config_manager_1 = require("../../plugin/config-manager");
const Logger_1 = require("../../core/Logger");
async function disableCommand() {
    try {
        const config = await (0, config_manager_1.loadOpenClawConfig)();
        if (!config?.plugins?.entries?.['clawkeeper-bands']) {
            console.log(chalk_1.default.yellow('Clawkeeper-Bands is not registered in OpenClaw. Run: clawkeeper-bands init'));
            process.exit(0);
        }
        config.plugins.entries['clawkeeper-bands'].enabled = false;
        await (0, config_manager_1.saveOpenClawConfig)(config);
        console.log(chalk_1.default.green('Clawkeeper-Bands disabled'));
    }
    catch (error) {
        console.error(chalk_1.default.red('Failed to disable Clawkeeper-Bands:'), error);
        Logger_1.logger.error('Disable command failed', { error });
        process.exit(1);
    }
}
async function enableCommand() {
    try {
        const config = await (0, config_manager_1.loadOpenClawConfig)();
        if (!config?.plugins?.entries?.['clawkeeper-bands']) {
            console.log(chalk_1.default.yellow('Clawkeeper-Bands is not registered in OpenClaw. Run: clawkeeper-bands init'));
            process.exit(0);
        }
        config.plugins.entries['clawkeeper-bands'].enabled = true;
        await (0, config_manager_1.saveOpenClawConfig)(config);
        console.log(chalk_1.default.green('Clawkeeper-Bands enabled'));
    }
    catch (error) {
        console.error(chalk_1.default.red('Failed to enable Clawkeeper-Bands:'), error);
        Logger_1.logger.error('Enable command failed', { error });
        process.exit(1);
    }
}
//# sourceMappingURL=toggle.js.map