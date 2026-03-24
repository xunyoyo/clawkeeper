/**
 * Clawkeeper-Bands PolicyStore
 * Manages persistence of security policies in ~/.openclaw/clawkeeper-bands/policy.json
 */
import { SecurityPolicy } from '../types';
export interface PersistedPolicy extends SecurityPolicy {
    version: string;
    createdAt: string;
    updatedAt: string;
}
export declare class PolicyStore {
    /**
     * Load the policy from disk, or create default if doesn't exist
     */
    static load(): Promise<PersistedPolicy>;
    /**
     * Save the policy to disk
     */
    static save(policy: PersistedPolicy): Promise<void>;
    /**
     * Reset policy to defaults
     */
    static reset(): Promise<void>;
    /**
     * Load the policy synchronously (for plugin register which must be sync)
     */
    static loadSync(): PersistedPolicy;
    /**
     * Get the policy file path
     */
    static getPath(): string;
}
//# sourceMappingURL=PolicyStore.d.ts.map