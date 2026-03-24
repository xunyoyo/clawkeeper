export interface PendingDecisionRecord {
    pendingDecision: true;
    origin: 'skillkeeper-context-judge';
    requestId: string;
    question: string;
    continueHint?: string;
    createdAt: string;
}
export declare function getPendingDecision(sessionKey?: string): Promise<PendingDecisionRecord | null>;
export declare function setPendingDecision(sessionKey: string | undefined, decision: PendingDecisionRecord): Promise<void>;
export declare function clearPendingDecision(sessionKey?: string): Promise<void>;
//# sourceMappingURL=pending-decision-store.d.ts.map