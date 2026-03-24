#!/usr/bin/env node
"use strict";
/**
 * Clawkeeper-Bands CLI Entry Point
 */
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const init_1 = require("./init");
const policy_1 = require("./commands/policy");
const stats_1 = require("./commands/stats");
const audit_1 = require("./commands/audit");
const reset_1 = require("./commands/reset");
const toggle_1 = require("./commands/toggle");
const program = new commander_1.Command();
program.name('clawkeeper-bands').description('🦞 Put safety bands on OpenClaw').version('1.0.0');
// Initialize Clawkeeper-Bands with OpenClaw
program
    .command('init')
    .description('Setup Clawkeeper-Bands with OpenClaw (interactive wizard)')
    .action(init_1.initWizard);
// Manage security policies
program.command('policy').description('Manage security policies').action(policy_1.policyCommand);
// View statistics
program.command('stats').description('View security statistics').action(stats_1.statsCommand);
// View audit trail
program
    .command('audit')
    .description('View decision audit trail')
    .option('-n, --lines <number>', 'Number of recent decisions to show', '50')
    .action(audit_1.auditCommand);
// Reset stats
program.command('reset').description('Reset statistics').action(reset_1.resetCommand);
// Disable Clawkeeper-Bands
program.command('disable').description('Temporarily disable Clawkeeper-Bands').action(toggle_1.disableCommand);
// Enable Clawkeeper-Bands
program.command('enable').description('Re-enable Clawkeeper-Bands').action(toggle_1.enableCommand);
program.parse();
//# sourceMappingURL=index.js.map