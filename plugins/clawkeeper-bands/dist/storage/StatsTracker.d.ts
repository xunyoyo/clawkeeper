/**
 * Clawkeeper-Bands StatsTracker
 * Tracks statistics about decisions (~/.openclaw/clawkeeper-bands/stats.json)
 */
export interface Stats {
    totalCalls: number;
    approved: number;
    rejected: number;
    blocked: number;
    allowed: number;
    avgDecisionTime: number;
    lastReset: string;
}
export declare class StatsTracker {
    /**
     * Load stats from disk
     */
    static load(): Promise<Stats>;
    /**
     * Save stats to disk
     */
    static save(stats: Stats): Promise<void>;
    /**
     * Increment a stat counter and update average decision time
     */
    static increment(decision: "ALLOWED" | "APPROVED" | "REJECTED" | "BLOCKED", decisionTime: number): Promise<void>;
    /**
     * Reset all stats to zero
     */
    static reset(): Promise<void>;
    /**
     * Get the stats file path
     */
    static getPath(): string;
}
//# sourceMappingURL=StatsTracker.d.ts.map