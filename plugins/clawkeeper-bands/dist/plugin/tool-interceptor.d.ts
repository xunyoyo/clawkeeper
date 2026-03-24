/**
 * Clawkeeper-Bands Tool Interceptor
 * Hook-based interception for OpenClaw's before_tool_call event
 */
import { Interceptor } from "../core/Interceptor";
/**
 * Tool name for the custom clawkeeper_bands_respond tool.
 * The LLM calls this to relay the user's YES/NO/ALLOW decision.
 */
export declare const CLAWKEEPER_BANDS_RESPOND_TOOL = "clawkeeper_bands_respond";
/**
 * Matches PluginHookBeforeToolCallEvent from openclaw/plugin-sdk
 */
export interface BeforeToolCallEvent {
    toolName: string;
    params: Record<string, unknown>;
}
/**
 * Matches PluginHookToolContext from openclaw/plugin-sdk
 */
export interface ToolContext {
    agentId?: string;
    sessionKey?: string;
    toolName: string;
}
/**
 * Matches PluginHookBeforeToolCallResult from openclaw/plugin-sdk
 */
export interface BeforeToolCallResult {
    params?: Record<string, unknown>;
    block?: boolean;
    blockReason?: string;
}
/**
 * Create a handler for the typed `before_tool_call` plugin hook.
 * Register with `api.on('before_tool_call', handler)`.
 *
 * Returns { block, blockReason } to deny, or {} to allow passthrough.
 */
export declare function createToolCallHook(interceptor: Interceptor): (event: BeforeToolCallEvent, ctx: ToolContext) => Promise<BeforeToolCallResult | void>;
/**
 * Get the tool-to-module mapping for display in CLI/init wizard
 */
export declare function getToolMapping(): Record<string, {
    module: string;
    method: string;
}>;
/**
 * Get the list of unique module names that Clawkeeper-Bands can protect
 */
export declare function getProtectedModules(): string[];
//# sourceMappingURL=tool-interceptor.d.ts.map