"use strict";
/**
 * Clawkeeper-Bands Interceptor
 * The Brain - Runtime Security Evaluation Engine
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Interceptor = void 0;
const config_1 = require("../config");
const Arbitrator_1 = require("./Arbitrator");
const DecisionLog_1 = require("../storage/DecisionLog");
const StatsTracker_1 = require("../storage/StatsTracker");
const Logger_1 = require("./Logger");
const chalk_1 = __importDefault(require("chalk"));
class Interceptor {
    policy;
    arbitrator;
    logEnabled;
    /**
     * Set to true when api.registerTool() succeeded for clawkeeper_bands_respond.
     * Controls the blockReason message sent to the LLM in channel mode.
     */
    respondToolAvailable = false;
    constructor(policy, wsConfig, cmdConfig, logEnabled = true) {
        this.policy = policy || config_1.DEFAULT_POLICY;
        this.arbitrator = new Arbitrator_1.Arbitrator(wsConfig, cmdConfig);
        this.logEnabled = logEnabled;
    }
    /**
     * Evaluate the security policy for a tool call.
     * Used by the OpenClaw hook system — throws if the action is denied.
     * @param moduleName - The Clawkeeper-Bands module (e.g., 'FileSystem', 'Shell')
     * @param methodName - The method within the module (e.g., 'read', 'bash')
     * @param args - The arguments passed to the tool
     * @param sessionKey - OpenClaw session key (present in daemon/channel mode)
     */
    async evaluate(moduleName, methodName, args, sessionKey) {
        const rule = this.lookupRule(moduleName, methodName);
        if (this.logEnabled) {
            this.logInterception(moduleName, methodName, rule.action);
        }
        const allowed = await this.executeDecision(rule, moduleName, methodName, args, sessionKey);
        if (!allowed) {
            // In channel mode (no TTY + sessionKey), provide a message the agent can
            // relay to the user on WhatsApp/Telegram so they can reply YES to approve.
            const isChannelMode = !process.stdin.isTTY && sessionKey;
            const detail = rule.description || 'No description provided.';
            if (isChannelMode) {
                const instructions = this.respondToolAvailable
                    ? `Ask the user: YES, NO, or ALLOW (auto-approve for 15 min).\n` +
                        `- YES → clawkeeper_bands_respond({ decision: "yes" }), then retry.\n` +
                        `- NO → clawkeeper_bands_respond({ decision: "no" }). Do NOT retry.\n` +
                        `- ALLOW → clawkeeper_bands_respond({ decision: "allow" }), then retry. Auto-approves this action for 15 minutes.`
                    : `Ask the user YES or NO.\n` +
                        `- If YES: call ${moduleName}.${methodName}() again exactly as before.\n` +
                        `- If NO: do NOT call the tool again. Tell the user the action was cancelled.`;
                throw new Error(`[Clawkeeper-Bands:APPROVAL_REQUIRED] ${moduleName}.${methodName}() is blocked pending human approval. ` +
                    `Risk: ${detail}\n` +
                    instructions);
            }
            throw new Error(`Clawkeeper-Bands Security Violation: ${moduleName}.${methodName}() was DENIED. ${detail}`);
        }
    }
    /**
     * Lookup the security rule for a module/method combination
     */
    lookupRule(moduleName, methodName) {
        const moduleRules = this.policy.modules[moduleName];
        if (moduleRules && moduleRules[methodName]) {
            return moduleRules[methodName];
        }
        // Fallback to default action
        return {
            action: this.policy.defaultAction,
            description: `No specific rule defined for ${moduleName}.${methodName}`,
        };
    }
    /**
     * Execute the security decision based on the rule
     * @returns true if approved, false if denied
     */
    async executeDecision(rule, moduleName, methodName, args, sessionKey) {
        const startTime = Date.now();
        switch (rule.action) {
            case 'ALLOW': {
                const decisionTime = Date.now() - startTime;
                await this.logDecision({
                    timestamp: new Date().toISOString(),
                    module: moduleName,
                    method: methodName,
                    args,
                    decision: 'ALLOWED',
                    decisionTime,
                });
                return true;
            }
            case 'DENY': {
                const decisionTime = Date.now() - startTime;
                await this.logDecision({
                    timestamp: new Date().toISOString(),
                    module: moduleName,
                    method: methodName,
                    args,
                    decision: 'BLOCKED',
                    reason: 'Policy: DENY',
                    decisionTime,
                });
                return false;
            }
            case 'ASK': {
                const context = {
                    moduleName,
                    methodName,
                    args,
                    rule,
                    sessionKey,
                };
                const approved = await this.arbitrator.judge(context);
                const decisionTime = Date.now() - startTime;
                await this.logDecision({
                    timestamp: new Date().toISOString(),
                    module: moduleName,
                    method: methodName,
                    args,
                    decision: approved ? 'APPROVED' : 'REJECTED',
                    userId: 'human',
                    decisionTime,
                });
                return approved;
            }
            default:
                // Should never happen with TypeScript, but adding for safety
                throw new Error('Unknown decision type');
        }
    }
    /**
     * Log a decision to the audit trail and update stats
     */
    async logDecision(record) {
        try {
            await DecisionLog_1.DecisionLog.append(record);
            await StatsTracker_1.StatsTracker.increment(record.decision, record.decisionTime);
        }
        catch (error) {
            // Don't fail the operation if logging fails
            Logger_1.logger.error('Failed to log decision', { error });
        }
    }
    /**
     * Log an interception event
     */
    logInterception(moduleName, methodName, action) {
        const coloredAction = action === 'ALLOW'
            ? chalk_1.default.green(action)
            : action === 'DENY'
                ? chalk_1.default.red(action)
                : chalk_1.default.yellow(action);
        Logger_1.logger.info(`${chalk_1.default.cyan('Clawkeeper-Bands:')} ${moduleName}.${methodName}() → ${coloredAction}`);
    }
}
exports.Interceptor = Interceptor;
//# sourceMappingURL=Interceptor.js.map