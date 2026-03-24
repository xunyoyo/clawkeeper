/**
 * Clawkeeper-Bands Config Manager
 * Manages Clawkeeper-Bands configuration in OpenClaw's openclaw.json
 */
export interface OpenClawConfig {
    plugins?: {
        entries?: Record<string, {
            enabled: boolean;
            config?: Record<string, unknown>;
        }>;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}
/**
 * Check if OpenClaw is installed
 */
export declare function isOpenClawInstalled(): Promise<boolean>;
/**
 * Load OpenClaw's main configuration
 */
export declare function loadOpenClawConfig(): Promise<OpenClawConfig | null>;
/**
 * Save OpenClaw's main configuration
 */
export declare function saveOpenClawConfig(config: OpenClawConfig): Promise<void>;
/**
 * Register Clawkeeper-Bands plugin in OpenClaw's config (plugins.entries["clawkeeper-bands"])
 */
export declare function registerPlugin(defaultAction?: 'ALLOW' | 'DENY' | 'ASK'): Promise<void>;
/**
 * Unregister Clawkeeper-Bands plugin from OpenClaw's config
 */
export declare function unregisterPlugin(): Promise<void>;
/**
 * Check if Clawkeeper-Bands is registered in OpenClaw
 */
export declare function isPluginRegistered(): Promise<boolean>;
//# sourceMappingURL=config-manager.d.ts.map