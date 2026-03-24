"use strict";
/**
 * Clawkeeper-Bands Reset Command
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetCommand = resetCommand;
const inquirer_1 = __importDefault(require("inquirer"));
const chalk_1 = __importDefault(require("chalk"));
const StatsTracker_1 = require("../../storage/StatsTracker");
const Logger_1 = require("../../core/Logger");
async function resetCommand() {
    console.log('');
    console.log(chalk_1.default.bold.yellow('⚠️  Reset Statistics'));
    console.log('');
    try {
        const { confirm } = await inquirer_1.default.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: chalk_1.default.red('Are you sure you want to reset all statistics?'),
                default: false,
            },
        ]);
        if (confirm) {
            await StatsTracker_1.StatsTracker.reset();
            console.log(chalk_1.default.green('✅ Statistics reset successfully'));
            console.log('');
        }
        else {
            console.log(chalk_1.default.dim('Reset cancelled'));
            console.log('');
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('❌ Failed to reset statistics:'), error);
        Logger_1.logger.error('Reset command failed', { error });
        process.exit(1);
    }
}
//# sourceMappingURL=reset.js.map