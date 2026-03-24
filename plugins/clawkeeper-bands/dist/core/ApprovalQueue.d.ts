/**
 * Clawkeeper-Bands ApprovalQueue
 * In-memory store for channel-based ASK approvals (daemon / messaging mode).
 *
 * Primary flow (clawkeeper_bands_respond tool — v3):
 *  1. before_tool_call → ASK + no TTY → queue.request() → blocks with structured reason
 *  2. Agent asks user YES/NO → user replies → agent calls clawkeeper_bands_respond({ decision })
 *  3. before_tool_call intercepts clawkeeper_bands_respond → queue.approve() or queue.deny()
 *  4. Agent retries blocked tool → queue.consume() → approved (Path A)
 *
 * Fallback flow (retry-as-approval — when api.registerTool is not available):
 *  1. before_tool_call → ASK + no TTY → queue.request() → blocks
 *  2. Agent relays blockReason to user, user replies YES → agent retries
 *  3. before_tool_call → queue.consumePending() → approved (Path B, within 60s window)
 */
export declare class ApprovalQueue {
    private entries;
    private blanketAllows;
    private lastCleanup;
    private ttl;
    constructor(ttlMs?: number);
    /** Composite key: one pending per session + module.method */
    private key;
    /** All keys belonging to a session (for approve/deny by session). */
    private keysForSession;
    /**
     * Register a pending approval request.
     * Called when ASK fires in daemon mode and no prior approval exists.
     *
     * Idempotent: if a non-expired pending entry already exists within the retry
     * window (CONSUME_MAX_AGE_MS), it is NOT overwritten — this preserves the
     * original createdAt timestamp so the retry window stays accurate.
     * If the pending is past the retry window, it IS overwritten (fresh prompt).
     *
     * Returns the composite key for reference.
     */
    request(sessionKey: string, moduleName: string, methodName: string): string;
    /**
     * Consume (remove) an approved entry so it can only be used once.
     * Returns true if an approval was found and consumed.
     */
    consume(sessionKey: string, moduleName: string, methodName: string): boolean;
    /**
     * Consume (remove) a pending entry — used for retry-as-approval in channel mode.
     * When the agent retries a blocked tool call, the retry itself signals user approval.
     *
     * Only consumes if the pending is within the retry window (CONSUME_MAX_AGE_MS).
     * A stale pending (> 60s) is NOT consumed — the caller should create a fresh
     * pending via request() so the user is prompted again.
     *
     * Returns true if a pending entry was found and consumed.
     */
    consumePending(sessionKey: string, moduleName: string, methodName: string): boolean;
    /**
     * Mark all pending entries for a session as approved.
     * Called when the user replies YES on the messaging channel.
     * Returns the number of entries approved.
     */
    approve(sessionKey: string): number;
    /**
     * Mark all pending entries for a session as denied and remove them.
     * Called when the user replies NO on the messaging channel.
     * Returns the number of entries denied.
     */
    deny(sessionKey: string): number;
    /**
     * Check whether a session has any pending approvals waiting for a reply.
     */
    hasPending(sessionKey: string): boolean;
    /**
     * Auto-approve a module.method for this session during durationMs.
     * In-memory only — does not modify policy.json.
     */
    allowFor(sessionKey: string, moduleName: string, methodName: string, durationMs: number): void;
    /**
     * Check if a blanket allow is active for this session + method.
     * Expired entries are cleaned up on access.
     */
    hasBlanketAllow(sessionKey: string, moduleName: string, methodName: string): boolean;
    /**
     * Get all pending actions for a session (module/method pairs).
     * Used by the ALLOW handler to know which methods to blanket-allow.
     */
    getPendingActions(sessionKey: string): Array<{
        moduleName: string;
        methodName: string;
    }>;
    private maybeCleanup;
    private cleanup;
}
/** Singleton instance shared across the plugin. */
export declare const approvalQueue: ApprovalQueue;
//# sourceMappingURL=ApprovalQueue.d.ts.map