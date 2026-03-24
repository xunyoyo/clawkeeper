/**
 * Clawkeeper-Bands Interceptor
 * The Brain - Runtime Security Evaluation Engine
 */
import { SecurityPolicy, WebSocketConfig, CommandConfig } from '../types';
export declare class Interceptor {
    private policy;
    private arbitrator;
    private logEnabled;
    /**
     * Set to true when api.registerTool() succeeded for clawkeeper_bands_respond.
     * Controls the blockReason message sent to the LLM in channel mode.
     */
    respondToolAvailable: boolean;
    constructor(policy?: SecurityPolicy, wsConfig?: Partial<WebSocketConfig>, cmdConfig?: Partial<CommandConfig>, logEnabled?: boolean);
    /**
     * Evaluate the security policy for a tool call.
     * Used by the OpenClaw hook system — throws if the action is denied.
     * @param moduleName - The Clawkeeper-Bands module (e.g., 'FileSystem', 'Shell')
     * @param methodName - The method within the module (e.g., 'read', 'bash')
     * @param args - The arguments passed to the tool
     * @param sessionKey - OpenClaw session key (present in daemon/channel mode)
     */
    evaluate(moduleName: string, methodName: string, args: unknown[], sessionKey?: string): Promise<void>;
    /**
     * Lookup the security rule for a module/method combination
     */
    private lookupRule;
    /**
     * Execute the security decision based on the rule
     * @returns true if approved, false if denied
     */
    private executeDecision;
    /**
     * Log a decision to the audit trail and update stats
     */
    private logDecision;
    /**
     * Log an interception event
     */
    private logInterception;
}
//# sourceMappingURL=Interceptor.d.ts.map