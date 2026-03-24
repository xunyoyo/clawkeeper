"use strict";
/**
 * Clawkeeper-Bands Default Security Policy
 * Philosophy: "Secure by Default"
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CMD_CONFIG = exports.DEFAULT_WS_CONFIG = exports.DEFAULT_POLICY = void 0;
exports.DEFAULT_POLICY = {
    // PARANOIA MODE: If a tool is unknown, ask the human.
    defaultAction: 'ASK',
    modules: {
        FileSystem: {
            read: {
                action: 'ALLOW',
                description: 'Read-only access is generally safe',
            },
            write: {
                action: 'ASK',
                description: 'Modification of files requires approval',
            },
            delete: {
                action: 'DENY',
                description: 'Deletion is strictly prohibited',
            },
        },
        Shell: {
            bash: {
                action: 'ASK',
                description: 'Shell command execution risk',
            },
            exec: {
                action: 'ASK',
                description: 'Arbitrary Code Execution (RCE) risk',
            },
            spawn: {
                action: 'ASK',
                description: 'Process spawning risk',
            },
        },
        Network: {
            fetch: {
                action: 'ASK',
                description: 'Potential data exfiltration',
            },
            request: {
                action: 'ASK',
                description: 'HTTP request may leak data',
            },
        },
    },
};
/**
 * Default WebSocket configuration for external AI agent approval
 */
exports.DEFAULT_WS_CONFIG = {
    url: 'ws://localhost:8080',
    timeout: 300000,
    enabled: false,
};
/**
 * Default Command configuration for external script approval
 */
exports.DEFAULT_CMD_CONFIG = {
    command: './ask-approval.sh',
    timeout: 30000,
    enabled: false,
};
//# sourceMappingURL=config.js.map