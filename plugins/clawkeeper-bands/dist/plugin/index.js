"use strict";
/**
 * Clawkeeper-Bands Plugin Entry Point
 * OpenClaw plugin integration.
 *
 * IMPORTANT: register() must be SYNCHRONOUS — the OpenClaw gateway
 * ignores async plugin registration (the returned promise is not awaited).
 *
 * Hooks:
 *  before_tool_call → api.on() (tool interception)
 */
Object.defineProperty(exports, "__esModule", { value: true });
const Interceptor_1 = require("../core/Interceptor");
const PolicyStore_1 = require("../storage/PolicyStore");
const Logger_1 = require("../core/Logger");
const agent_end_bridge_1 = require("./agent-end-bridge");
const pending_decision_hook_1 = require("./pending-decision-hook");
const startup_audit_route_1 = require("./startup-audit-route");
const tool_interceptor_1 = require("./tool-interceptor");
/**
 * Attempt to register the clawkeeper_bands_respond tool via api.registerTool().
 * Returns true if the call succeeded, false if the API is not available.
 */
function tryRegisterTool(api) {
    try {
        if (!api.registerTool) {
            Logger_1.logger.info('[plugin] api.registerTool not available — fallback retry-as-approval');
            return false;
        }
        api.registerTool({
            name: tool_interceptor_1.CLAWKEEPER_BANDS_RESPOND_TOOL,
            description: 'Respond to a Clawkeeper-Bands security prompt. Call after the user says YES, NO, or ALLOW.',
            parameters: {
                type: 'object',
                properties: {
                    decision: {
                        type: 'string',
                        enum: ['yes', 'no', 'allow'],
                        description: 'The user decision: "yes" to approve once, "no" to deny, "allow" to auto-approve for 15 minutes.',
                    },
                },
                required: ['decision'],
            },
            // The actual logic runs in before_tool_call (tool-interceptor.ts).
            // This execute handler exists only because the gateway requires it.
            execute: async () => ({ result: 'Handled by Clawkeeper-Bands hook.' }),
        });
        Logger_1.logger.info(`[plugin] Registered tool: ${tool_interceptor_1.CLAWKEEPER_BANDS_RESPOND_TOOL}`);
        return true;
    }
    catch (err) {
        Logger_1.logger.warn(`[plugin] api.registerTool() threw`, { error: err });
        return false;
    }
}
/**
 * Safely attempt to register a hook via api.on().
 * Returns true if the call succeeded (no throw), false otherwise.
 */
function tryOn(api, hookName, handler, label) {
    try {
        if (!api.on) {
            Logger_1.logger.debug(`[plugin] ${label}: api.on not available`);
            return false;
        }
        api.on(hookName, handler);
        Logger_1.logger.info(`[plugin] ${label}: api.on('${hookName}') succeeded`);
        return true;
    }
    catch (err) {
        Logger_1.logger.warn(`[plugin] ${label}: api.on('${hookName}') threw`, { error: err });
        return false;
    }
}
function tryRegisterHttpRoute(api, params, label) {
    try {
        if (!api.registerHttpRoute) {
            Logger_1.logger.debug(`[plugin] ${label}: api.registerHttpRoute not available`);
            return false;
        }
        api.registerHttpRoute(params);
        Logger_1.logger.info(`[plugin] ${label}: api.registerHttpRoute('${params.path}') succeeded`);
        return true;
    }
    catch (err) {
        Logger_1.logger.warn(`[plugin] ${label}: api.registerHttpRoute('${params.path}') threw`, { error: err });
        return false;
    }
}
exports.default = {
    id: 'clawkeeper-bands',
    name: 'Clawkeeper-Bands',
    register(api) {
        Logger_1.logger.info('Clawkeeper-Bands plugin loading...');
        try {
            const policy = PolicyStore_1.PolicyStore.loadSync();
            Logger_1.logger.info('Security policy loaded', {
                defaultAction: policy.defaultAction,
                moduleCount: Object.keys(policy.modules).length,
            });
            const interceptor = new Interceptor_1.Interceptor(policy);
            // -----------------------------------------------------------------------
            // Hook: before_tool_call — tool interception
            // -----------------------------------------------------------------------
            const toolHook = (0, tool_interceptor_1.createToolCallHook)(interceptor);
            tryOn(api, 'before_tool_call', toolHook, 'before_tool_call');
            const agentEndHook = (0, agent_end_bridge_1.createAgentEndBridgeHook)(api.pluginConfig, api.config);
            tryOn(api, 'agent_end', agentEndHook, 'agent_end');
            const pendingDecisionHook = (0, pending_decision_hook_1.createPendingDecisionPromptHook)();
            tryOn(api, 'before_prompt_build', pendingDecisionHook, 'before_prompt_build');
            const startupAuditRoute = (0, startup_audit_route_1.createClawkeeperStartupAuditRoute)({
                config: api.config,
                logger: Logger_1.logger,
                runtime: api.runtime,
            });
            tryRegisterHttpRoute(api, {
                path: '/plugins/clawkeeper-bands/clawkeeper-startup-audit',
                auth: 'gateway',
                handler: startupAuditRoute,
            }, 'clawkeeper_startup_audit');
            // -----------------------------------------------------------------------
            // Tool registration: clawkeeper_bands_respond
            // If available, the LLM sees this tool and calls it with { decision: "yes"|"no"|"allow" }.
            // The actual logic is intercepted in before_tool_call (tool-interceptor.ts).
            // -----------------------------------------------------------------------
            const toolRegistered = tryRegisterTool(api);
            interceptor.respondToolAvailable = toolRegistered;
            Logger_1.logger.info('Clawkeeper-Bands: hook registration complete', {
                respondToolAvailable: toolRegistered,
            });
        }
        catch (error) {
            Logger_1.logger.error('Failed to initialize Clawkeeper-Bands plugin', { error });
            throw error;
        }
    },
};
//# sourceMappingURL=index.js.map