"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Arbitrator = void 0;
const inquirer_1 = __importDefault(require("inquirer"));
const chalk_1 = __importDefault(require("chalk"));
const ws_1 = __importDefault(require("ws"));
const child_process_1 = require("child_process");
const Logger_1 = require("./Logger");
const ApprovalQueue_1 = require("./ApprovalQueue");
const config_1 = require("../config");
class Arbitrator {
    wsConfig;
    cmdConfig;
    constructor(wsConfig, cmdConfig) {
        this.wsConfig = { ...config_1.DEFAULT_WS_CONFIG, ...wsConfig };
        this.cmdConfig = { ...config_1.DEFAULT_CMD_CONFIG, ...cmdConfig };
    }
    /**
     * Request human judgment on an intercepted action.
     * @param context - The execution context (includes optional sessionKey)
     * @returns true if approved, false if rejected
     */
    async judge(context) {
        // -----------------------------------------------------------------------
        // Mode 5: Command — execute external script and wait for YES/NO
        // -----------------------------------------------------------------------
        if (this.cmdConfig.enabled) {
            return this.judgeCommand(context);
        }
        // -----------------------------------------------------------------------
        // Mode 4: WebSocket — send to external AI agent and wait for YES/NO/ALLOW
        // -----------------------------------------------------------------------
        if (this.wsConfig.enabled) {
            return this.judgeWebSocket(context);
        }
        // -----------------------------------------------------------------------
        // Mode 1: Interactive TTY — prompt via inquirer (original behavior)
        // -----------------------------------------------------------------------
        if (process.stdin.isTTY) {
            return this.judgeTTY(context);
        }
        // -----------------------------------------------------------------------
        // Mode 2: Daemon with session — channel-based approval queue
        // -----------------------------------------------------------------------
        if (context.sessionKey) {
            return this.judgeChannel(context);
        }
        // -----------------------------------------------------------------------
        // Mode 3: Daemon without session (cron, webhook, etc.) — auto-deny
        // -----------------------------------------------------------------------
        Logger_1.logger.info(`ASK policy → auto-denied (no TTY, no session): ${context.moduleName}.${context.methodName}()`, { args: context.args });
        return false;
    }
    // ---------------------------------------------------------------------------
    // Mode 1 — TTY prompt
    // ---------------------------------------------------------------------------
    async judgeTTY(context) {
        this.displayBanner();
        this.displayContext(context);
        const answer = await inquirer_1.default.prompt([
            {
                type: 'list',
                name: 'decision',
                message: chalk_1.default.bold.yellow('⚠️  What should Clawkeeper-Bands do?'),
                choices: [
                    {
                        name: chalk_1.default.green('✓ Approve - Allow this action'),
                        value: true,
                    },
                    {
                        name: chalk_1.default.red('✗ Reject - Block this action'),
                        value: false,
                    },
                ],
                default: 1, // Default to Reject for safety
            },
        ]);
        console.log(''); // Add spacing after decision
        if (answer.decision) {
            console.log(chalk_1.default.green('✓ Action APPROVED by user\n'));
        }
        else {
            console.log(chalk_1.default.red('✗ Action REJECTED by user\n'));
        }
        return answer.decision;
    }
    // ---------------------------------------------------------------------------
    // Mode 2 — Channel-based approval (WhatsApp / Telegram / etc.)
    // ---------------------------------------------------------------------------
    judgeChannel(context) {
        const { sessionKey, moduleName, methodName } = context;
        // Path 0: blanket allow — auto-approved for this session + method (15 min window)
        if (ApprovalQueue_1.approvalQueue.hasBlanketAllow(sessionKey, moduleName, methodName)) {
            Logger_1.logger.info(`ASK policy → auto-approved (blanket allow): ${moduleName}.${methodName}()`, {
                sessionKey,
            });
            return true;
        }
        // Path A (primary): explicit approval — clawkeeper_bands_respond({ decision: "yes" })
        // called approve().
        if (ApprovalQueue_1.approvalQueue.consume(sessionKey, moduleName, methodName)) {
            Logger_1.logger.info(`ASK policy → approved via channel: ${moduleName}.${methodName}()`, {
                sessionKey,
            });
            return true;
        }
        // Path B (fallback): retry-as-approval — used when api.registerTool() is not
        // available (old gateway). The agent retries the blocked tool after the user
        // said YES, and the retry itself is the approval signal.
        if (ApprovalQueue_1.approvalQueue.consumePending(sessionKey, moduleName, methodName)) {
            Logger_1.logger.info(`ASK policy → approved via channel (retry-as-approval): ${moduleName}.${methodName}()`, { sessionKey });
            return true;
        }
        // Path C: first encounter — create a pending entry and block.
        // The Interceptor will throw an error whose message instructs the agent to
        // ask the user YES/NO. If clawkeeper_bands_respond is available, the agent calls it;
        // otherwise falls back to retry-as-approval (Path B).
        ApprovalQueue_1.approvalQueue.request(sessionKey, moduleName, methodName);
        Logger_1.logger.info(`ASK policy → awaiting channel approval: ${moduleName}.${methodName}()`, {
            sessionKey,
        });
        return false;
    }
    // ---------------------------------------------------------------------------
    // Mode 4 — WebSocket-based approval (external AI agent)
    // ---------------------------------------------------------------------------
    async judgeWebSocket(context) {
        const { moduleName, methodName, args, rule } = context;
        const wsUrl = this.wsConfig.url;
        const timeout = this.wsConfig.timeout || 30000;
        Logger_1.logger.info(`ASK policy → WebSocket approval request: ${moduleName}.${methodName}()`);
        return new Promise((resolve) => {
            let ws;
            let timer;
            const cleanup = () => {
                if (timer) {
                    clearTimeout(timer);
                }
                if (ws && ws.readyState === ws_1.default.OPEN) {
                    ws.close();
                }
            };
            try {
                ws = new ws_1.default(wsUrl);
                // Timeout handler
                timer = setTimeout(() => {
                    Logger_1.logger.warn('WebSocket approval request timed out');
                    cleanup();
                    resolve(false);
                }, timeout);
                ws.on('open', () => {
                    // Send approval request to external AI agent
                    const request = {
                        type: 'approval_request',
                        moduleName,
                        methodName,
                        args,
                        rule,
                        timestamp: new Date().toISOString(),
                    };
                    ws.send(JSON.stringify(request));
                    Logger_1.logger.info('WebSocket approval request sent', { moduleName, methodName });
                });
                ws.on('message', (data) => {
                    try {
                        const raw = typeof data === 'string'
                            ? data
                            : Buffer.isBuffer(data)
                                ? data.toString('utf8')
                                : Array.isArray(data)
                                    ? Buffer.concat(data).toString('utf8')
                                    : '';
                        const response = JSON.parse(raw);
                        const decision = response.decision?.toUpperCase();
                        Logger_1.logger.info('WebSocket response received', { decision, response });
                        switch (decision) {
                            case 'YES':
                            case 'ALLOW':
                                cleanup();
                                Logger_1.logger.info(`ASK policy → WebSocket approved: ${moduleName}.${methodName}()`);
                                resolve(true);
                                break;
                            case 'NO':
                                cleanup();
                                Logger_1.logger.info(`ASK policy → WebSocket rejected: ${moduleName}.${methodName}()`);
                                resolve(false);
                                break;
                            default:
                                Logger_1.logger.warn('WebSocket received unknown decision', { decision });
                        }
                    }
                    catch (err) {
                        Logger_1.logger.error('Failed to parse WebSocket response', { err });
                    }
                });
                ws.on('error', (err) => {
                    Logger_1.logger.error('WebSocket connection error', { err });
                    cleanup();
                    resolve(false);
                });
            }
            catch (err) {
                Logger_1.logger.error('Failed to create WebSocket connection', { err });
                cleanup();
                resolve(false);
            }
        });
    }
    // ---------------------------------------------------------------------------
    // Mode 5 — Command-based approval (external script)
    // ---------------------------------------------------------------------------
    async judgeCommand(context) {
        const { moduleName, methodName, args } = context;
        const command = this.cmdConfig.command;
        const timeout = this.cmdConfig.timeout || 30000;
        // Build command arguments: <moduleName> <methodName> <args as JSON>
        const argsJson = JSON.stringify(args);
        const cmdArgs = `${moduleName} ${methodName} "${argsJson.replace(/"/g, '\\"')}"`;
        Logger_1.logger.info(`ASK policy → Command approval request: ${moduleName}.${methodName}()`);
        Logger_1.logger.info(`Executing: ${command} ${cmdArgs}`);
        return new Promise((resolve) => {
            const child = (0, child_process_1.exec)(`${command} ${cmdArgs}`, { timeout }, (error, stdout) => {
                if (error) {
                    if (error.killed) {
                        Logger_1.logger.warn('Command execution timed out');
                    }
                    else {
                        Logger_1.logger.error('Command execution failed', { error });
                    }
                    resolve(false);
                    return;
                }
                const output = stdout.trim().toUpperCase();
                Logger_1.logger.info('Command output received', { output });
                switch (output) {
                    case 'YES':
                    case 'ALLOW':
                        Logger_1.logger.info(`ASK policy → Command approved: ${moduleName}.${methodName}()`);
                        resolve(true);
                        break;
                    case 'NO':
                        Logger_1.logger.info(`ASK policy → Command rejected: ${moduleName}.${methodName}()`);
                        resolve(false);
                        break;
                    default:
                        Logger_1.logger.warn('Command returned unknown output, treating as NO', { output });
                        resolve(false);
                }
            });
            child.on('error', (err) => {
                Logger_1.logger.error('Failed to spawn command', { err });
                resolve(false);
            });
        });
    }
    // ---------------------------------------------------------------------------
    // Display helpers (TTY mode)
    // ---------------------------------------------------------------------------
    displayBanner() {
        console.log('');
        console.log(chalk_1.default.bgRed.white.bold('═'.repeat(80)));
        console.log(chalk_1.default.bgRed.white.bold('   🦞 CLAWBANDS SECURITY ALERT - HUMAN AUTHORIZATION REQUIRED'));
        console.log(chalk_1.default.bgRed.white.bold('═'.repeat(80)));
        console.log('');
    }
    displayContext(context) {
        console.log(chalk_1.default.bold.cyan('📦 Module:'), chalk_1.default.white(context.moduleName));
        console.log(chalk_1.default.bold.cyan('🔧 Method:'), chalk_1.default.white(context.methodName));
        if (context.rule.description) {
            console.log(chalk_1.default.bold.cyan('⚠️  Risk:'), chalk_1.default.yellow(context.rule.description));
        }
        console.log(chalk_1.default.bold.cyan('📋 Arguments:'));
        try {
            const argsJson = JSON.stringify(context.args, null, 2);
            console.log(chalk_1.default.gray(this.indentJson(argsJson)));
        }
        catch {
            console.log(chalk_1.default.gray('  [Arguments contain non-serializable data]'));
            console.log(chalk_1.default.gray('  ' + String(context.args)));
        }
        console.log('');
        console.log(chalk_1.default.dim('─'.repeat(80)));
        console.log('');
    }
    indentJson(json) {
        return json
            .split('\n')
            .map((line) => '  ' + line)
            .join('\n');
    }
}
exports.Arbitrator = Arbitrator;
//# sourceMappingURL=Arbitrator.js.map