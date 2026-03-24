"use strict";
/**
 * Clawkeeper-Bands Policy Management Command
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.policyCommand = policyCommand;
const chalk_1 = __importDefault(require("chalk"));
const inquirer_1 = __importDefault(require("inquirer"));
const Logger_1 = require("../../core/Logger");
const PolicyStore_1 = require("../../storage/PolicyStore");
async function policyCommand() {
    console.log("");
    console.log(chalk_1.default.bold.cyan("═".repeat(80)));
    console.log(chalk_1.default.bold.cyan("   🔒 Clawkeeper-Bands Policy Manager"));
    console.log(chalk_1.default.bold.cyan("═".repeat(80)));
    console.log("");
    try {
        const policy = await PolicyStore_1.PolicyStore.load();
        // Display current policy
        console.log(chalk_1.default.bold("Current Security Policy:"));
        console.log(chalk_1.default.dim(`  Default Action: ${policy.defaultAction}`));
        console.log(chalk_1.default.dim(`  Last Updated: ${policy.updatedAt}`));
        console.log("");
        console.log(chalk_1.default.bold("Protected Modules:"));
        Object.entries(policy.modules).forEach(([moduleName, rules]) => {
            console.log(chalk_1.default.cyan(`  ${moduleName}:`));
            Object.entries(rules).forEach(([methodName, rule]) => {
                const actionColor = rule.action === "ALLOW" ? chalk_1.default.green : rule.action === "DENY" ? chalk_1.default.red : chalk_1.default.yellow;
                console.log(`    ${methodName}: ${actionColor(rule.action)} ${chalk_1.default.dim(rule.description ? `- ${rule.description}` : "")}`);
            });
        });
        console.log("");
        // Action menu
        const { action } = await inquirer_1.default.prompt([
            {
                type: "list",
                name: "action",
                message: "What would you like to do?",
                choices: [
                    { name: "Change default security level", value: "change_level" },
                    { name: "Modify a specific rule", value: "modify_rule" },
                    { name: "Add a new module", value: "add_module" },
                    { name: "Reset to defaults", value: "reset" },
                    { name: "Exit", value: "exit" },
                ],
            },
        ]);
        switch (action) {
            case "change_level":
                await changeDefaultLevel(policy);
                break;
            case "modify_rule":
                await modifyRule(policy);
                break;
            case "add_module":
                await addModule(policy);
                break;
            case "reset":
                await resetPolicy();
                break;
            case "exit":
                console.log(chalk_1.default.dim("Exiting..."));
                break;
        }
    }
    catch (error) {
        console.error(chalk_1.default.red("❌ Failed to manage policy:"), error);
        Logger_1.logger.error("Policy command failed", { error });
        process.exit(1);
    }
}
async function changeDefaultLevel(policy) {
    const { newDefault } = await inquirer_1.default.prompt([
        {
            type: "list",
            name: "newDefault",
            message: "Select new default action for unknown tools:",
            choices: ["ALLOW", "ASK", "DENY"],
            default: policy.defaultAction,
        },
    ]);
    policy.defaultAction = newDefault;
    await PolicyStore_1.PolicyStore.save(policy);
    console.log(chalk_1.default.green(`✅ Default action changed to ${newDefault}`));
    console.log(chalk_1.default.yellow("⚠️  Restart OpenClaw for changes to take effect: openclaw restart"));
}
async function modifyRule(policy) {
    const modules = Object.keys(policy.modules);
    if (modules.length === 0) {
        console.log(chalk_1.default.yellow("No modules configured yet."));
        return;
    }
    const { moduleName } = await inquirer_1.default.prompt([
        {
            type: "list",
            name: "moduleName",
            message: "Select module:",
            choices: modules,
        },
    ]);
    const methods = Object.keys(policy.modules[moduleName]);
    const { methodName } = await inquirer_1.default.prompt([
        {
            type: "list",
            name: "methodName",
            message: "Select method:",
            choices: methods,
        },
    ]);
    const currentRule = policy.modules[moduleName][methodName];
    const { newAction, newDescription } = await inquirer_1.default.prompt([
        {
            type: "list",
            name: "newAction",
            message: `Current: ${currentRule.action}. New action:`,
            choices: ["ALLOW", "ASK", "DENY"],
            default: currentRule.action,
        },
        {
            type: "input",
            name: "newDescription",
            message: "Description (optional):",
            default: currentRule.description || "",
        },
    ]);
    policy.modules[moduleName][methodName] = {
        action: newAction,
        description: newDescription || undefined,
    };
    await PolicyStore_1.PolicyStore.save(policy);
    console.log(chalk_1.default.green(`✅ Rule updated: ${moduleName}.${methodName} → ${newAction}`));
    console.log(chalk_1.default.yellow("⚠️  Restart OpenClaw for changes to take effect: openclaw restart"));
}
async function addModule(policy) {
    const { moduleName, defaultAction } = await inquirer_1.default.prompt([
        {
            type: "input",
            name: "moduleName",
            message: 'Module name (e.g., "CustomTool"):',
            validate: (input) => (input.trim() ? true : "Module name cannot be empty"),
        },
        {
            type: "list",
            name: "defaultAction",
            message: "Default action for this module:",
            choices: ["ALLOW", "ASK", "DENY"],
            default: "ASK",
        },
    ]);
    policy.modules[moduleName] = {
        "*": { action: defaultAction, description: "Default rule for all methods" },
    };
    await PolicyStore_1.PolicyStore.save(policy);
    console.log(chalk_1.default.green(`✅ Module added: ${moduleName}`));
    console.log(chalk_1.default.yellow("⚠️  Restart OpenClaw for changes to take effect: openclaw restart"));
}
async function resetPolicy() {
    const { confirm } = await inquirer_1.default.prompt([
        {
            type: "confirm",
            name: "confirm",
            message: chalk_1.default.red("Are you sure you want to reset to default policy?"),
            default: false,
        },
    ]);
    if (confirm) {
        await PolicyStore_1.PolicyStore.reset();
        console.log(chalk_1.default.green("✅ Policy reset to defaults"));
        console.log(chalk_1.default.yellow("⚠️  Restart OpenClaw for changes to take effect: openclaw restart"));
    }
    else {
        console.log(chalk_1.default.dim("Reset cancelled"));
    }
}
//# sourceMappingURL=policy.js.map