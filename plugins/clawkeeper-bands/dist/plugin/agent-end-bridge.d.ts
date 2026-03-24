export interface AgentEndEvent {
    messages: unknown[];
    success: boolean;
    error?: string;
    durationMs?: number;
}
export interface AgentEndContext {
    agentId?: string;
    sessionId?: string;
    sessionKey?: string;
    workspaceDir?: string;
}
export interface BridgePolicy {
    maxRiskBeforeStop?: 'low' | 'medium' | 'high' | 'critical';
    requireUserConfirmationFor?: string[];
    autoContinueAllowed?: boolean;
    maxToolStepsWithoutUserTurn?: number;
    treatCommandExecutionAsHighRisk?: boolean;
}
export interface BridgeConfig {
    enabled?: boolean;
    url?: string;
    token?: string;
    model?: string;
    judgePath?: string;
    systemPrompt?: string;
    userPrompt?: string;
    timeoutMs?: number;
    maxContextChars?: number;
    policy?: BridgePolicy;
}
export interface BridgeHookPluginConfig {
    bridge?: BridgeConfig;
}
export declare function createAgentEndBridgeHook(pluginConfig: BridgeHookPluginConfig | undefined, openclawConfig: unknown): (event: AgentEndEvent, ctx: AgentEndContext) => Promise<void>;
//# sourceMappingURL=agent-end-bridge.d.ts.map