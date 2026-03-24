/**
 * Clawkeeper-Bands DecisionLog
 * Audit trail in JSON Lines format (~/.openclaw/clawkeeper-bands/decisions.jsonl)
 */
export interface DecisionRecord {
    timestamp: string;
    module: string;
    method: string;
    args: unknown[];
    decision: 'ALLOWED' | 'APPROVED' | 'REJECTED' | 'BLOCKED';
    userId?: string;
    decisionTime: number;
    reason?: string;
}
export declare class DecisionLog {
    /**
     * Append a decision record to the log (JSON Lines format)
     */
    static append(record: DecisionRecord): Promise<void>;
    /**
     * Read all decisions from the log
     */
    static readAll(): Promise<DecisionRecord[]>;
    /**
     * Read the last N decisions
     */
    static readLast(n: number): Promise<DecisionRecord[]>;
    /**
     * Get the decision log file path
     */
    static getPath(): string;
}
//# sourceMappingURL=DecisionLog.d.ts.map