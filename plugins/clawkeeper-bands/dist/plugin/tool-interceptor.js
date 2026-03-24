"use strict";
/**
 * Clawkeeper-Bands Tool Interceptor
 * Hook-based interception for OpenClaw's before_tool_call event
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLAWKEEPER_BANDS_RESPOND_TOOL = void 0;
exports.createToolCallHook = createToolCallHook;
exports.getToolMapping = getToolMapping;
exports.getProtectedModules = getProtectedModules;
const ApprovalQueue_1 = require("../core/ApprovalQueue");
const Logger_1 = require("../core/Logger");
/**
 * Tool name for the custom clawkeeper_bands_respond tool.
 * The LLM calls this to relay the user's YES/NO/ALLOW decision.
 */
exports.CLAWKEEPER_BANDS_RESPOND_TOOL = "clawkeeper_bands_respond";
/**
 * Mapping from flat OpenClaw tool names to Clawkeeper-Bands module/method pairs.
 * OpenClaw exposes tools as flat names (e.g. "bash", "read"), while
 * Clawkeeper-Bands policies are organized by module/method (e.g. Shell.bash, FileSystem.read).
 */
const TOOL_TO_MODULE = {
    // FileSystem
    read: { module: "FileSystem", method: "read" },
    write: { module: "FileSystem", method: "write" },
    edit: { module: "FileSystem", method: "edit" },
    glob: { module: "FileSystem", method: "list" },
    // Shell
    bash: { module: "Shell", method: "bash" },
    exec: { module: "Shell", method: "exec" },
    // Browser
    navigate: { module: "Browser", method: "navigate" },
    screenshot: { module: "Browser", method: "screenshot" },
    click: { module: "Browser", method: "click" },
    type: { module: "Browser", method: "type" },
    evaluate: { module: "Browser", method: "evaluate" },
    // Network
    fetch: { module: "Network", method: "fetch" },
    request: { module: "Network", method: "request" },
    webhook: { module: "Network", method: "webhook" },
    download: { module: "Network", method: "download" },
    // Gateway
    list_sessions: { module: "Gateway", method: "listSessions" },
    list_nodes: { module: "Gateway", method: "listNodes" },
    send_message: { module: "Gateway", method: "sendMessage" },
};
/**
 * Create a handler for the typed `before_tool_call` plugin hook.
 * Register with `api.on('before_tool_call', handler)`.
 *
 * Returns { block, blockReason } to deny, or {} to allow passthrough.
 */
function createToolCallHook(interceptor) {
    return async (event, ctx) => {
        const { toolName, params } = event;
        // Intercept our own control tool before any policy evaluation
        if (toolName === exports.CLAWKEEPER_BANDS_RESPOND_TOOL) {
            return handleRespondTool(params, ctx);
        }
        const mapping = TOOL_TO_MODULE[toolName.toLowerCase()];
        const moduleName = mapping?.module ?? "Unknown";
        const methodName = mapping?.method ?? toolName;
        try {
            await interceptor.evaluate(moduleName, methodName, [params], ctx.sessionKey);
            return {};
        }
        catch (err) {
            const reason = err instanceof Error
                ? err.message
                : `${moduleName}.${methodName}() blocked by Clawkeeper-Bands policy`;
            Logger_1.logger.warn(`Blocking ${toolName}: ${reason}`);
            return { block: true, blockReason: reason };
        }
    };
}
/**
 * Handle the clawkeeper_bands_respond tool call.
 * Extracts the decision from params and approves/denies pending entries.
 * Always blocks (this is a control signal, not a real tool execution).
 */
function handleRespondTool(params, ctx) {
    const BLANKET_DURATION_MS = 15 * 60 * 1000;
    const decision = typeof params.decision === "string" ? params.decision.toLowerCase() : "";
    const rawDecision = typeof params.decision === "string" ? params.decision : JSON.stringify(params.decision);
    const sessionKey = ctx.sessionKey;
    if (!sessionKey) {
        Logger_1.logger.warn(`[${exports.CLAWKEEPER_BANDS_RESPOND_TOOL}] No sessionKey in context`);
        return { block: true, blockReason: "Error: no session context available." };
    }
    if (decision === "yes") {
        if (!ApprovalQueue_1.approvalQueue.hasPending(sessionKey)) {
            Logger_1.logger.info(`[${exports.CLAWKEEPER_BANDS_RESPOND_TOOL}] No pending approvals for session`, {
                sessionKey,
            });
            return { block: true, blockReason: "No pending approvals to approve." };
        }
        const count = ApprovalQueue_1.approvalQueue.approve(sessionKey);
        Logger_1.logger.info(`[${exports.CLAWKEEPER_BANDS_RESPOND_TOOL}] APPROVED`, { sessionKey, count });
        return { block: true, blockReason: "Approved. Retry the blocked tool." };
    }
    if (decision === "no") {
        const count = ApprovalQueue_1.approvalQueue.deny(sessionKey);
        Logger_1.logger.info(`[${exports.CLAWKEEPER_BANDS_RESPOND_TOOL}] DENIED`, { sessionKey, count });
        return { block: true, blockReason: "Denied. Do NOT retry the blocked tool." };
    }
    if (decision === "allow") {
        const pending = ApprovalQueue_1.approvalQueue.getPendingActions(sessionKey);
        if (pending.length === 0) {
            Logger_1.logger.info(`[${exports.CLAWKEEPER_BANDS_RESPOND_TOOL}] No pending approvals for ALLOW`, {
                sessionKey,
            });
            return { block: true, blockReason: "No pending approvals to allow." };
        }
        for (const { moduleName, methodName } of pending) {
            ApprovalQueue_1.approvalQueue.allowFor(sessionKey, moduleName, methodName, BLANKET_DURATION_MS);
        }
        const count = ApprovalQueue_1.approvalQueue.approve(sessionKey);
        const rules = pending.map((p) => `${p.moduleName}.${p.methodName}`).join(", ");
        Logger_1.logger.info(`[${exports.CLAWKEEPER_BANDS_RESPOND_TOOL}] ALLOW for 15 min`, {
            sessionKey,
            rules,
            count,
        });
        return {
            block: true,
            blockReason: `Approved for 15 minutes: ${rules}. Retry the blocked tool.`,
        };
    }
    Logger_1.logger.warn(`[${exports.CLAWKEEPER_BANDS_RESPOND_TOOL}] Invalid decision: "${rawDecision}"`, {
        sessionKey,
    });
    return { block: true, blockReason: 'Invalid decision. Use "yes", "no", or "allow".' };
}
/**
 * Get the tool-to-module mapping for display in CLI/init wizard
 */
function getToolMapping() {
    return { ...TOOL_TO_MODULE };
}
/**
 * Get the list of unique module names that Clawkeeper-Bands can protect
 */
function getProtectedModules() {
    const modules = new Set();
    for (const entry of Object.values(TOOL_TO_MODULE)) {
        modules.add(entry.module);
    }
    return Array.from(modules);
}
//# sourceMappingURL=tool-interceptor.js.map