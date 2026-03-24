"use strict";
/**
 * Clawkeeper-Bands Init Wizard
 * Interactive setup for Clawkeeper-Bands with OpenClaw
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initWizard = initWizard;
const inquirer_1 = __importDefault(require("inquirer"));
const chalk_1 = __importDefault(require("chalk"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const config_manager_1 = require("../plugin/config-manager");
const PolicyStore_1 = require("../storage/PolicyStore");
const Logger_1 = require("../core/Logger");
const config_1 = require("../config");
const tool_interceptor_1 = require("../plugin/tool-interceptor");
const SECURITY_PRESETS = {
    permissive: {
        name: '🟢 Permissive',
        description: 'read: ALLOW, write: ASK, delete: ASK, bash: ASK',
        policy: {
            FileSystem: {
                read: { action: 'ALLOW', description: 'Safe read-only' },
                write: { action: 'ASK', description: 'Needs approval' },
                delete: { action: 'ASK', description: 'Requires confirmation' },
            },
            Shell: {
                bash: { action: 'ASK', description: 'RCE risk' },
                exec: { action: 'ASK', description: 'RCE risk' },
            },
        },
    },
    balanced: {
        name: '🟡 Balanced (Recommended)',
        description: 'read: ALLOW, write: ASK, delete: DENY, bash: ASK',
        policy: config_1.DEFAULT_POLICY.modules,
    },
    strict: {
        name: '🔴 Strict',
        description: 'read: ASK, write: ASK, delete: DENY, bash: DENY',
        policy: {
            FileSystem: {
                read: { action: 'ASK', description: 'Confirm all reads' },
                write: { action: 'ASK', description: 'Needs approval' },
                delete: { action: 'DENY', description: 'Strictly prohibited' },
            },
            Shell: {
                bash: { action: 'DENY', description: 'RCE blocked' },
                exec: { action: 'DENY', description: 'RCE blocked' },
            },
        },
    },
};
async function initWizard() {
    console.log('');
    console.log(chalk_1.default.bold.cyan('═'.repeat(80)));
    console.log(chalk_1.default.bold.cyan('   🦞 + 🪢 Clawkeeper-Bands Setup Wizard'));
    console.log(chalk_1.default.bold.cyan('   Put safety bands on OpenClaw'));
    console.log(chalk_1.default.bold.cyan('═'.repeat(80)));
    console.log('');
    try {
        // Step 1: Detect OpenClaw
        console.log(chalk_1.default.bold('Step 1: Detecting OpenClaw...'));
        const isInstalled = await (0, config_manager_1.isOpenClawInstalled)();
        if (!isInstalled) {
            console.log('');
            console.log(chalk_1.default.red('❌ OpenClaw is not installed or not found.'));
            console.log('');
            console.log(chalk_1.default.yellow('Please install OpenClaw first:'));
            console.log(chalk_1.default.dim('  npm install -g openclaw'));
            console.log('');
            process.exit(1);
        }
        console.log(chalk_1.default.green('✅ OpenClaw detected'));
        console.log('');
        // Check if already registered
        const alreadyRegistered = await (0, config_manager_1.isPluginRegistered)();
        if (alreadyRegistered) {
            const { shouldReconfigure } = await inquirer_1.default.prompt([
                {
                    type: 'confirm',
                    name: 'shouldReconfigure',
                    message: 'Clawkeeper-Bands is already configured. Reconfigure?',
                    default: false,
                },
            ]);
            if (!shouldReconfigure) {
                console.log(chalk_1.default.yellow('Setup cancelled.'));
                return;
            }
        }
        // Step 2: Choose security level
        console.log(chalk_1.default.bold('Step 2: Choose your security level'));
        console.log('');
        const { securityLevel } = await inquirer_1.default.prompt([
            {
                type: 'list',
                name: 'securityLevel',
                message: 'Which security policy would you like to use?',
                choices: [
                    {
                        name: `${SECURITY_PRESETS.permissive.name} - ${SECURITY_PRESETS.permissive.description}`,
                        value: 'permissive',
                    },
                    {
                        name: `${SECURITY_PRESETS.balanced.name} - ${SECURITY_PRESETS.balanced.description}`,
                        value: 'balanced',
                    },
                    {
                        name: `${SECURITY_PRESETS.strict.name} - ${SECURITY_PRESETS.strict.description}`,
                        value: 'strict',
                    },
                    {
                        name: '⚙️  Custom (configure manually after setup)',
                        value: 'custom',
                    },
                ],
                default: 'balanced',
            },
        ]);
        console.log('');
        // Step 3: Select modules to protect
        console.log(chalk_1.default.bold('Step 3: Select which OpenClaw tools to protect'));
        console.log('');
        const availableModules = (0, tool_interceptor_1.getProtectedModules)();
        const { selectedModules } = await inquirer_1.default.prompt([
            {
                type: 'checkbox',
                name: 'selectedModules',
                message: 'Which tool modules should Clawkeeper-Bands intercept?',
                choices: availableModules.map((mod) => ({
                    name: mod,
                    value: mod,
                    checked: ['FileSystem', 'Shell', 'Browser'].includes(mod), // Default selections
                })),
            },
        ]);
        console.log('');
        // Step 4: Create the policy
        console.log(chalk_1.default.bold('Step 4: Creating security policy...'));
        const selectedPreset = SECURITY_PRESETS[securityLevel];
        const modules = {};
        if (securityLevel !== 'custom' && selectedPreset) {
            // Apply preset to selected modules only
            selectedModules.forEach((moduleName) => {
                if (selectedPreset.policy[moduleName]) {
                    modules[moduleName] =
                        selectedPreset.policy[moduleName];
                }
                else {
                    // Default to ASK for modules not in preset
                    modules[moduleName] = {
                        '*': { action: 'ASK', description: 'Default security' },
                    };
                }
            });
        }
        const policy = {
            version: '1.0.0',
            defaultAction: 'ASK',
            modules,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        await PolicyStore_1.PolicyStore.save(policy);
        console.log(chalk_1.default.green(`✅ Policy saved to ${PolicyStore_1.PolicyStore.getPath()}`));
        console.log('');
        // Step 5: Install plugin in OpenClaw
        console.log(chalk_1.default.bold('Step 5: Registering with OpenClaw...'));
        // Find the project root (where openclaw.plugin.json lives)
        const pluginRoot = path_1.default.resolve(__dirname, '..', '..');
        const manifestPath = path_1.default.join(pluginRoot, 'openclaw.plugin.json');
        const manifestExists = await fs_extra_1.default.pathExists(manifestPath);
        if (manifestExists) {
            console.log(chalk_1.default.dim(`  Plugin manifest found: ${manifestPath}`));
            console.log(chalk_1.default.dim(`  Install with: openclaw plugins install --link ${pluginRoot}`));
        }
        await (0, config_manager_1.registerPlugin)(policy.defaultAction);
        console.log(chalk_1.default.green('✅ Clawkeeper-Bands registered in OpenClaw config'));
        console.log('');
        // Success summary
        console.log(chalk_1.default.bold.green('═'.repeat(80)));
        console.log(chalk_1.default.bold.green('   ✅ Clawkeeper-Bands installed successfully!'));
        console.log(chalk_1.default.bold.green('═'.repeat(80)));
        console.log('');
        console.log(chalk_1.default.bold('Configuration:'));
        console.log(chalk_1.default.dim(`  Policy:     ${PolicyStore_1.PolicyStore.getPath()}`));
        console.log(chalk_1.default.dim(`  Audit log:  ${Logger_1.CLAWKEEPER_BANDS_DATA_DIR}/decisions.jsonl`));
        console.log(chalk_1.default.dim(`  Stats:      ${Logger_1.CLAWKEEPER_BANDS_DATA_DIR}/stats.json`));
        console.log('');
        console.log(chalk_1.default.bold('Next steps:'));
        if (manifestExists) {
            console.log(chalk_1.default.cyan('  1. Install plugin:') +
                chalk_1.default.dim(`    openclaw plugins install --link ${pluginRoot}`));
        }
        console.log(chalk_1.default.cyan('  2. Edit policy:') + chalk_1.default.dim('       clawkeeper-bands policy'));
        console.log(chalk_1.default.cyan('  3. View audit trail:') + chalk_1.default.dim('  clawkeeper-bands audit'));
        console.log('');
    }
    catch (error) {
        console.error(chalk_1.default.red('❌ Setup failed:'), error);
        Logger_1.logger.error('Init wizard failed', { error });
        process.exit(1);
    }
}
//# sourceMappingURL=init.js.map