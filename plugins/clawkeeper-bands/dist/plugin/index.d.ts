/**
 * Clawkeeper-Bands Plugin Entry Point
 * OpenClaw plugin integration.
 *
 * IMPORTANT: register() must be SYNCHRONOUS — the OpenClaw gateway
 * ignores async plugin registration (the returned promise is not awaited).
 *
 * Hooks:
 *  before_tool_call → api.on() (tool interception)
 */
import { type BridgeConfig } from './agent-end-bridge';
export interface ClawkeeperBandsConfig {
    enabled?: boolean;
    defaultAction?: 'ALLOW' | 'DENY' | 'ASK';
    bridge?: BridgeConfig;
}
/**
 * OpenClaw plugin API surface used by Clawkeeper-Bands.
 * Both methods are optional — the gateway may not support all of them.
 */
interface OpenClawPluginApi {
    config?: unknown;
    pluginConfig?: ClawkeeperBandsConfig;
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
    on?(hookName: string, handler: (...args: unknown[]) => void): void;
    registerHttpRoute?(params: {
        path: string;
        auth: 'gateway' | 'plugin';
        handler: (req: unknown, res: unknown) => Promise<boolean | void> | boolean | void;
    }): void;
    registerTool?(spec: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
        execute: (...args: unknown[]) => Promise<unknown>;
    }): void;
}
declare const _default: {
    id: string;
    name: string;
    register(api: OpenClawPluginApi): void;
};
export default _default;
//# sourceMappingURL=index.d.ts.map