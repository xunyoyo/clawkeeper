"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.approvalQueue = exports.ApprovalQueue = void 0;
const Logger_1 = require("./Logger");
/** Default time-to-live for an approval entry (2 minutes). */
const DEFAULT_TTL_MS = 120_000;
/**
 * Maximum age for a pending entry to be consumed via retry-as-approval.
 * After this window, the pending is considered stale (user probably said NO or
 * moved on) and must be re-requested.
 */
const CONSUME_MAX_AGE_MS = 60_000;
/** Cleanup runs at most every 30 seconds. */
const CLEANUP_INTERVAL_MS = 30_000;
class ApprovalQueue {
    entries = new Map();
    blanketAllows = new Map(); // key → expiresAt
    lastCleanup = Date.now();
    ttl;
    constructor(ttlMs = DEFAULT_TTL_MS) {
        this.ttl = ttlMs;
    }
    // ---------------------------------------------------------------------------
    // Key helpers
    // ---------------------------------------------------------------------------
    /** Composite key: one pending per session + module.method */
    key(sessionKey, moduleName, methodName) {
        return `${sessionKey}::${moduleName}.${methodName}`;
    }
    /** All keys belonging to a session (for approve/deny by session). */
    keysForSession(sessionKey) {
        return Array.from(this.entries.keys()).filter((k) => k.startsWith(`${sessionKey}::`));
    }
    // ---------------------------------------------------------------------------
    // Core API
    // ---------------------------------------------------------------------------
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
    request(sessionKey, moduleName, methodName) {
        this.maybeCleanup();
        const k = this.key(sessionKey, moduleName, methodName);
        const existing = this.entries.get(k);
        if (existing && existing.status === "pending" && Date.now() < existing.expiresAt) {
            const age = Date.now() - existing.createdAt;
            if (age <= CONSUME_MAX_AGE_MS) {
                Logger_1.logger.debug(`ApprovalQueue: pending already exists within retry window, skipping`, {
                    sessionKey,
                    action: `${moduleName}.${methodName}`,
                    ageMs: age,
                });
                return k;
            }
        }
        this.entries.set(k, {
            sessionKey,
            moduleName,
            methodName,
            status: "pending",
            createdAt: Date.now(),
            expiresAt: Date.now() + this.ttl,
        });
        Logger_1.logger.info(`ApprovalQueue: pending request created`, {
            sessionKey,
            action: `${moduleName}.${methodName}`,
        });
        return k;
    }
    /**
     * Consume (remove) an approved entry so it can only be used once.
     * Returns true if an approval was found and consumed.
     */
    consume(sessionKey, moduleName, methodName) {
        const k = this.key(sessionKey, moduleName, methodName);
        const entry = this.entries.get(k);
        if (entry && entry.status === "approved" && Date.now() < entry.expiresAt) {
            this.entries.delete(k);
            Logger_1.logger.info(`ApprovalQueue: approval consumed`, {
                sessionKey,
                action: `${moduleName}.${methodName}`,
            });
            return true;
        }
        const expired = entry ? Date.now() >= entry.expiresAt : false;
        Logger_1.logger.debug(`ApprovalQueue.consume: not found/not approved`, {
            sessionKey,
            action: `${moduleName}.${methodName}`,
            entryStatus: entry?.status ?? "missing",
            expired,
            queueSize: this.entries.size,
        });
        return false;
    }
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
    consumePending(sessionKey, moduleName, methodName) {
        const k = this.key(sessionKey, moduleName, methodName);
        const entry = this.entries.get(k);
        if (entry && entry.status === "pending" && Date.now() < entry.expiresAt) {
            const age = Date.now() - entry.createdAt;
            if (age > CONSUME_MAX_AGE_MS) {
                Logger_1.logger.info(`ApprovalQueue: pending too old for retry-as-approval, will re-prompt`, {
                    sessionKey,
                    action: `${moduleName}.${methodName}`,
                    ageMs: age,
                    maxAgeMs: CONSUME_MAX_AGE_MS,
                });
                return false;
            }
            this.entries.delete(k);
            Logger_1.logger.info(`ApprovalQueue: pending consumed (retry-as-approval)`, {
                sessionKey,
                action: `${moduleName}.${methodName}`,
                ageMs: age,
            });
            return true;
        }
        return false;
    }
    /**
     * Mark all pending entries for a session as approved.
     * Called when the user replies YES on the messaging channel.
     * Returns the number of entries approved.
     */
    approve(sessionKey) {
        this.maybeCleanup();
        let count = 0;
        for (const k of this.keysForSession(sessionKey)) {
            const entry = this.entries.get(k);
            if (entry.status === "pending" && Date.now() < entry.expiresAt) {
                entry.status = "approved";
                // Reset TTL from the moment of approval
                entry.expiresAt = Date.now() + this.ttl;
                count++;
                Logger_1.logger.info(`ApprovalQueue: approved`, {
                    sessionKey,
                    action: `${entry.moduleName}.${entry.methodName}`,
                });
            }
        }
        return count;
    }
    /**
     * Mark all pending entries for a session as denied and remove them.
     * Called when the user replies NO on the messaging channel.
     * Returns the number of entries denied.
     */
    deny(sessionKey) {
        this.maybeCleanup();
        let count = 0;
        for (const k of this.keysForSession(sessionKey)) {
            const entry = this.entries.get(k);
            if (entry.status === "pending") {
                this.entries.delete(k);
                count++;
                Logger_1.logger.info(`ApprovalQueue: denied`, {
                    sessionKey,
                    action: `${entry.moduleName}.${entry.methodName}`,
                });
            }
        }
        return count;
    }
    /**
     * Check whether a session has any pending approvals waiting for a reply.
     */
    hasPending(sessionKey) {
        const keys = this.keysForSession(sessionKey);
        const result = keys.some((k) => {
            const e = this.entries.get(k);
            return e.status === "pending" && Date.now() < e.expiresAt;
        });
        Logger_1.logger.debug(`ApprovalQueue.hasPending`, {
            sessionKey,
            result,
            sessionEntries: keys.length,
            totalSize: this.entries.size,
        });
        return result;
    }
    // ---------------------------------------------------------------------------
    // Blanket allows (time-limited auto-approve)
    // ---------------------------------------------------------------------------
    /**
     * Auto-approve a module.method for this session during durationMs.
     * In-memory only — does not modify policy.json.
     */
    allowFor(sessionKey, moduleName, methodName, durationMs) {
        const k = this.key(sessionKey, moduleName, methodName);
        this.blanketAllows.set(k, Date.now() + durationMs);
        Logger_1.logger.info(`ApprovalQueue: blanket allow created`, {
            sessionKey,
            action: `${moduleName}.${methodName}`,
            durationMs,
        });
    }
    /**
     * Check if a blanket allow is active for this session + method.
     * Expired entries are cleaned up on access.
     */
    hasBlanketAllow(sessionKey, moduleName, methodName) {
        const k = this.key(sessionKey, moduleName, methodName);
        const expiresAt = this.blanketAllows.get(k);
        if (!expiresAt) {
            return false;
        }
        if (Date.now() >= expiresAt) {
            this.blanketAllows.delete(k);
            return false;
        }
        return true;
    }
    /**
     * Get all pending actions for a session (module/method pairs).
     * Used by the ALLOW handler to know which methods to blanket-allow.
     */
    getPendingActions(sessionKey) {
        return this.keysForSession(sessionKey)
            .map((k) => this.entries.get(k))
            .filter((e) => e.status === "pending" && Date.now() < e.expiresAt)
            .map((e) => ({ moduleName: e.moduleName, methodName: e.methodName }));
    }
    // ---------------------------------------------------------------------------
    // Housekeeping
    // ---------------------------------------------------------------------------
    maybeCleanup() {
        if (Date.now() - this.lastCleanup > CLEANUP_INTERVAL_MS) {
            this.cleanup();
        }
    }
    cleanup() {
        const now = Date.now();
        for (const [k, entry] of this.entries) {
            if (now >= entry.expiresAt) {
                this.entries.delete(k);
            }
        }
        for (const [k, expiresAt] of this.blanketAllows) {
            if (now >= expiresAt) {
                this.blanketAllows.delete(k);
            }
        }
        this.lastCleanup = now;
    }
}
exports.ApprovalQueue = ApprovalQueue;
/** Singleton instance shared across the plugin. */
exports.approvalQueue = new ApprovalQueue();
//# sourceMappingURL=ApprovalQueue.js.map