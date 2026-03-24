import type { IncomingMessage, ServerResponse } from "http";
type StartupAuditRouteDeps = {
    config: unknown;
    logger: {
        info: (message: string, meta?: Record<string, unknown>) => void;
        warn: (message: string, meta?: Record<string, unknown>) => void;
    };
    runtime?: {
        system?: {
            enqueueSystemEvent?: (text: string, opts: {
                sessionKey: string;
                contextKey?: string | null;
            }) => boolean;
            requestHeartbeatNow?: (opts?: {
                reason?: string;
                sessionKey?: string;
            }) => void;
        };
    };
};
export declare function createClawkeeperStartupAuditRoute(deps: StartupAuditRouteDeps): (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;
export {};
//# sourceMappingURL=startup-audit-route.d.ts.map