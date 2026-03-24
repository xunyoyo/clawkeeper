/**
 * Clawkeeper-Bands Arbitrator
 * The UI/Prompt Logic for Human-in-the-Loop Decisions
 *
 * Five modes:
 *  1. TTY (interactive terminal)  → inquirer prompt
 *  2. Daemon + sessionKey (channel) → approval queue (block-and-retry via messaging)
 *  3. Daemon without sessionKey    → auto-deny (fail-secure)
 *  4. WebSocket (external AI agent) → ws request + wait for YES/NO/ALLOW
 *  5. Command (external script)    → execute command + parse YES/NO
 */
import { ExecutionContext, WebSocketConfig, CommandConfig } from '../types';
export declare class Arbitrator {
    private wsConfig;
    private cmdConfig;
    constructor(wsConfig?: Partial<WebSocketConfig>, cmdConfig?: Partial<CommandConfig>);
    /**
     * Request human judgment on an intercepted action.
     * @param context - The execution context (includes optional sessionKey)
     * @returns true if approved, false if rejected
     */
    judge(context: ExecutionContext): Promise<boolean>;
    private judgeTTY;
    private judgeChannel;
    private judgeWebSocket;
    private judgeCommand;
    private displayBanner;
    private displayContext;
    private indentJson;
}
//# sourceMappingURL=Arbitrator.d.ts.map