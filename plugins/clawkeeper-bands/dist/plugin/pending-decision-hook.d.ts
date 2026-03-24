interface PendingPromptEvent {
    messages?: unknown[];
    prompt?: string;
}
interface PendingPromptContext {
    sessionKey?: string;
}
export declare function createPendingDecisionPromptHook(): (event: PendingPromptEvent, ctx: PendingPromptContext) => Promise<{
    prependContext: string;
} | undefined>;
export {};
//# sourceMappingURL=pending-decision-hook.d.ts.map