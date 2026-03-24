"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAgentEndBridgeHook = createAgentEndBridgeHook;
const promises_1 = require("fs/promises");
const path_1 = __importDefault(require("path"));
const url_1 = require("url");
const crypto_1 = require("crypto");
const Logger_1 = require("../core/Logger");
const pending_decision_store_1 = require("./pending-decision-store");
const BRIDGE_EVENTS_PATH = path_1.default.join(Logger_1.CLAWKEEPER_BANDS_DATA_DIR, 'bridge-events.jsonl');
const BRIDGE_LAST_REQUEST_PATH = path_1.default.join(Logger_1.CLAWKEEPER_BANDS_DATA_DIR, 'bridge-last-request.json');
const DEFAULT_MAX_CONTEXT_CHARS = 120_000;
const DEFAULT_JUDGE_PATH = '/v1/chat/completions';
const DEFAULT_SYSTEM_PROMPT = [
    '你是 OpenClaw B。',
    '你会接收 OpenClaw A 转发来的完整运行上下文，包括对话、工具调用、命令输出和元数据。',
    '你要使用你自己的思考、skills、plugins 和提示词来判断 A 下一步应不应该继续。',
    '你不是执行者，不要假装已经替 A 执行了工具。',
    '你必须只输出一个 JSON 对象，不要输出任何额外解释、代码块或前后缀。',
    'JSON 必须包含这些字段：decision, summary, userQuestion, continueHint, stopReason。',
    'decision 只能是 continue、stop、ask_user。',
    '如果需要用户确认，decision=ask_user，userQuestion 必须是直接发给最终用户的话。',
].join('\n');
const DEFAULT_USER_PROMPT = '以下是 OpenClaw A 转发的完整上下文。请基于这份上下文输出严格 JSON。';
let runtimeHelpersPromise = null;
function resolveBridgeConfig(pluginConfig) {
    const raw = pluginConfig?.bridge ?? {};
    const enabled = raw.enabled ?? process.env.CLAWKEEPER_BANDS_BRIDGE_ENABLED !== 'false';
    const url = raw.url ?? process.env.CLAWKEEPER_BANDS_BRIDGE_URL ?? '';
    const token = raw.token ?? process.env.CLAWKEEPER_BANDS_BRIDGE_TOKEN ?? '';
    if (!enabled || !url || !token) {
        return null;
    }
    return {
        enabled: true,
        url: url.replace(/\/$/, ''),
        token,
        model: raw.model ?? process.env.CLAWKEEPER_BANDS_BRIDGE_MODEL ?? 'openclaw:main',
        judgePath: raw.judgePath ?? process.env.CLAWKEEPER_BANDS_BRIDGE_JUDGE_PATH ?? DEFAULT_JUDGE_PATH,
        systemPrompt: raw.systemPrompt ?? process.env.CLAWKEEPER_BANDS_BRIDGE_SYSTEM_PROMPT ?? DEFAULT_SYSTEM_PROMPT,
        userPrompt: raw.userPrompt ?? process.env.CLAWKEEPER_BANDS_BRIDGE_USER_PROMPT ?? DEFAULT_USER_PROMPT,
        timeoutMs: raw.timeoutMs ?? Number(process.env.CLAWKEEPER_BANDS_BRIDGE_TIMEOUT_MS ?? 15000),
        maxContextChars: raw.maxContextChars ?? Number(process.env.CLAWKEEPER_BANDS_BRIDGE_MAX_CONTEXT_CHARS ?? DEFAULT_MAX_CONTEXT_CHARS),
        policy: raw.policy ?? {},
    };
}
function stringifyUnknown(value, maxChars) {
    if (value == null) {
        return '';
    }
    if (typeof value === 'string') {
        return value.length > maxChars ? `${value.slice(0, maxChars)}\n...[truncated]` : value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    try {
        const json = JSON.stringify(value, (_key, nested) => {
            if (typeof nested === 'string') {
                return nested.length > 12_000 ? `${nested.slice(0, 12_000)}...[truncated]` : nested;
            }
            return nested;
        }, 2);
        return json.length > maxChars ? `${json.slice(0, maxChars)}\n...[truncated]` : json;
    }
    catch {
        return '[unserializable]';
    }
}
function extractText(value, maxChars) {
    if (typeof value === 'string') {
        return stringifyUnknown(value, maxChars);
    }
    if (!Array.isArray(value)) {
        return stringifyUnknown(value, maxChars);
    }
    return value
        .map((entry) => {
        if (!entry || typeof entry !== 'object') {
            return stringifyUnknown(entry, Math.min(maxChars, 500));
        }
        const text = entry.text;
        return typeof text === 'string' ? text : stringifyUnknown(entry, Math.min(maxChars, 2000));
    })
        .filter(Boolean)
        .join('\n');
}
function normalizeMessageRecord(entry, maxChars) {
    if (!entry || typeof entry !== 'object') {
        return null;
    }
    const record = entry;
    const role = typeof record.role === 'string' ? record.role : typeof record.type === 'string' ? record.type : 'unknown';
    const normalized = {
        role,
        content: extractText(record.content, Math.min(20_000, maxChars)),
    };
    if (typeof record.name === 'string') {
        normalized.name = record.name;
    }
    if (typeof record.toolName === 'string') {
        normalized.toolName = record.toolName;
    }
    if (typeof record.toolCallId === 'string') {
        normalized.toolCallId = record.toolCallId;
    }
    if (typeof record.tool_call_id === 'string') {
        normalized.toolCallId = record.tool_call_id;
    }
    if (typeof record.id === 'string') {
        normalized.id = record.id;
    }
    if (record.details !== undefined) {
        normalized.details = stringifyUnknown(record.details, Math.min(20_000, maxChars));
    }
    if (record.tool_calls !== undefined) {
        normalized.toolCalls = stringifyUnknown(record.tool_calls, Math.min(20_000, maxChars));
    }
    if (record.toolCalls !== undefined) {
        normalized.toolCalls = stringifyUnknown(record.toolCalls, Math.min(20_000, maxChars));
    }
    if (record.result !== undefined) {
        normalized.result = stringifyUnknown(record.result, Math.min(20_000, maxChars));
    }
    if (record.error !== undefined) {
        normalized.error = stringifyUnknown(record.error, Math.min(8000, maxChars));
    }
    const raw = stringifyUnknown(entry, Math.min(20_000, maxChars));
    if (raw) {
        normalized.raw = raw;
    }
    return normalized;
}
async function appendBridgeEvent(event) {
    await (0, promises_1.appendFile)(BRIDGE_EVENTS_PATH, `${JSON.stringify(event)}\n`, 'utf8');
}
async function writeLastBridgeRequest(payload) {
    await (0, promises_1.writeFile)(BRIDGE_LAST_REQUEST_PATH, JSON.stringify(payload, null, 2), 'utf8');
}
function extractAssistantReply(payload) {
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content === 'string') {
        return content;
    }
    if (Array.isArray(content)) {
        return content
            .map((item) => (typeof item?.text === 'string' ? item.text : ''))
            .filter(Boolean)
            .join('\n');
    }
    return '';
}
function extractFirstJsonObject(text) {
    const start = text.indexOf('{');
    if (start < 0) {
        return null;
    }
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i += 1) {
        const ch = text[i];
        if (inString) {
            if (escaped) {
                escaped = false;
            }
            else if (ch === '\\') {
                escaped = true;
            }
            else if (ch === '"') {
                inString = false;
            }
            continue;
        }
        if (ch === '"') {
            inString = true;
            continue;
        }
        if (ch === '{') {
            depth += 1;
            continue;
        }
        if (ch === '}') {
            depth -= 1;
            if (depth === 0) {
                return text.slice(start, i + 1);
            }
        }
    }
    return null;
}
function normalizeJudgeResponse(rawText) {
    const jsonText = extractFirstJsonObject(rawText);
    if (!jsonText) {
        return {
            version: 1,
            decision: 'stop',
            stopReason: 'invalid_json_reply',
            shouldContinue: false,
            needsUserDecision: false,
            userQuestion: null,
            summary: rawText.trim() || 'B 没有返回可解析的 JSON。',
            riskLevel: 'medium',
            evidence: [],
            nextAction: 'stop_run',
            continueHint: null,
        };
    }
    try {
        const parsed = JSON.parse(jsonText);
        const decision = parsed.decision === 'continue' || parsed.decision === 'stop' || parsed.decision === 'ask_user'
            ? parsed.decision
            : 'stop';
        return {
            version: 1,
            decision,
            stopReason: typeof parsed.stopReason === 'string' ? parsed.stopReason : 'unknown',
            shouldContinue: decision === 'continue',
            needsUserDecision: decision === 'ask_user',
            userQuestion: typeof parsed.userQuestion === 'string' ? parsed.userQuestion : null,
            summary: typeof parsed.summary === 'string' ? parsed.summary : rawText.trim() || 'B 没有提供 summary。',
            riskLevel: parsed.riskLevel === 'low' || parsed.riskLevel === 'medium' || parsed.riskLevel === 'high' || parsed.riskLevel === 'critical'
                ? parsed.riskLevel
                : decision === 'continue'
                    ? 'low'
                    : 'medium',
            evidence: Array.isArray(parsed.evidence) ? parsed.evidence.filter((item) => typeof item === 'string') : [],
            nextAction: decision === 'continue' ? 'continue_run' : decision === 'ask_user' ? 'ask_user' : 'stop_run',
            continueHint: typeof parsed.continueHint === 'string' ? parsed.continueHint : null,
        };
    }
    catch {
        return {
            version: 1,
            decision: 'stop',
            stopReason: 'invalid_json_reply',
            shouldContinue: false,
            needsUserDecision: false,
            userQuestion: null,
            summary: rawText.trim() || 'B 返回的 JSON 解析失败。',
            riskLevel: 'medium',
            evidence: [],
            nextAction: 'stop_run',
            continueHint: null,
        };
    }
}
function resolveAgentIdFromSessionKey(sessionKey) {
    if (!sessionKey || !sessionKey.startsWith('agent:')) {
        return undefined;
    }
    const parts = sessionKey.split(':');
    return parts.length >= 2 ? parts[1] : undefined;
}
async function importRuntimeHelpers() {
    if (!runtimeHelpersPromise) {
        runtimeHelpersPromise = (async () => {
            const fs = require('fs');
            const fsp = require('fs/promises');
            const candidateRoots = new Set();
            let cursor = process.cwd();
            candidateRoots.add(cursor);
            cursor = __dirname;
            for (let i = 0; i < 10; i += 1) {
                candidateRoots.add(cursor);
                const parent = path_1.default.dirname(cursor);
                if (parent === cursor) {
                    break;
                }
                cursor = parent;
            }
            const rootDir = Array.from(candidateRoots).find((candidate) => {
                return (fs.existsSync(path_1.default.join(candidate, 'dist')));
            });
            if (!rootDir) {
                throw new Error('Unable to locate OpenClaw dist/ runtime from clawkeeper-bands bridge');
            }
            const loadModule = async (relativePath) => {
                const fullPath = path_1.default.join(rootDir, relativePath);
                const loaded = await Promise.resolve(`${(0, url_1.pathToFileURL)(fullPath).href}`).then(s => __importStar(require(s)));
                return loaded;
            };
            const distDir = path_1.default.join(rootDir, 'dist');
            const distEntries = (await fsp.readdir(distDir))
                .filter((entry) => entry.endsWith('.js') && /^(sessions|paths|reply)-/.test(entry))
                .toSorted();
            const findNamedExport = async (targetName) => {
                for (const entry of distEntries) {
                    const mod = await loadModule(`dist/${entry}`);
                    for (const value of Object.values(mod)) {
                        if (typeof value === 'function' && value.name === targetName) {
                            return value;
                        }
                    }
                }
                throw new Error(`Unable to resolve ${targetName} from OpenClaw dist bundles`);
            };
            const loadSessionStore = await findNamedExport('loadSessionStore');
            const resolveStorePath = await findNamedExport('resolveStorePath');
            const deliveryContextFromSession = await findNamedExport('deliveryContextFromSession');
            const routeReply = await findNamedExport('routeReply');
            return {
                resolveStorePath,
                loadSessionStore,
                deliveryContextFromSession,
                routeReply,
            };
        })();
    }
    return runtimeHelpersPromise;
}
async function loadCurrentDeliveryContext(params) {
    if (!params.sessionKey) {
        return { reason: 'missing sessionKey' };
    }
    try {
        const helpers = await importRuntimeHelpers();
        const agentId = resolveAgentIdFromSessionKey(params.sessionKey);
        const storePath = helpers.resolveStorePath(params.cfg.session?.store, {
            agentId,
        });
        const store = helpers.loadSessionStore(storePath, { skipCache: true });
        const entry = store[params.sessionKey.toLowerCase()] ?? store[params.sessionKey];
        const delivery = helpers.deliveryContextFromSession(entry);
        if (!delivery?.channel || !delivery.to) {
            return { reason: 'no deliveryContext on current session' };
        }
        return { delivery };
    }
    catch (error) {
        return { reason: error instanceof Error ? error.message : String(error) };
    }
}
async function replyToCurrentChannel(params) {
    if (!params.text?.trim()) {
        return { ok: false, reason: 'missing text' };
    }
    try {
        const helpers = await importRuntimeHelpers();
        const loaded = await loadCurrentDeliveryContext({ cfg: params.cfg, sessionKey: params.sessionKey });
        if (!loaded.delivery?.channel || !loaded.delivery.to) {
            return { ok: false, reason: loaded.reason ?? 'missing deliveryContext' };
        }
        const result = await helpers.routeReply({
            payload: { text: params.text },
            channel: loaded.delivery.channel,
            to: loaded.delivery.to,
            accountId: loaded.delivery.accountId,
            threadId: loaded.delivery.threadId,
            sessionKey: params.sessionKey,
            cfg: params.cfg,
            mirror: true,
        });
        if (!result.ok) {
            return { ok: false, reason: result.error ?? 'routeReply failed' };
        }
        return { ok: true };
    }
    catch (error) {
        return { ok: false, reason: error instanceof Error ? error.message : String(error) };
    }
}
function createAgentEndBridgeHook(pluginConfig, openclawConfig) {
    return async (event, ctx) => {
        const bridge = resolveBridgeConfig(pluginConfig);
        if (!bridge) {
            return;
        }
        const requestId = (0, crypto_1.randomUUID)();
        const delivery = await loadCurrentDeliveryContext({
            cfg: openclawConfig,
            sessionKey: ctx.sessionKey,
        });
        const normalizedMessages = (event.messages ?? [])
            .map((message) => normalizeMessageRecord(message, bridge.maxContextChars))
            .filter((message) => Boolean(message));
        const forwardedContext = {
            source: 'openclaw-a-agent_end-bridge',
            metadata: {
                agentId: ctx.agentId ?? null,
                sessionId: ctx.sessionId ?? null,
                sessionKey: ctx.sessionKey ?? null,
                workspaceDir: ctx.workspaceDir ?? null,
                success: event.success,
                error: event.error ?? null,
                durationMs: event.durationMs ?? null,
                messageCount: normalizedMessages.length,
                channel: delivery.delivery?.channel ?? null,
                to: delivery.delivery?.to ?? null,
                accountId: delivery.delivery?.accountId ?? null,
                threadId: delivery.delivery?.threadId ?? null,
            },
            messages: normalizedMessages,
        };
        const requestPayload = {
            model: bridge.model,
            messages: [
                { role: 'system', content: bridge.systemPrompt },
                {
                    role: 'user',
                    content: [
                        bridge.userPrompt,
                        '',
                        stringifyUnknown({
                            requestId,
                            forwardedContext,
                            policy: bridge.policy,
                        }, bridge.maxContextChars),
                    ].join('\n'),
                },
            ],
        };
        const startedAt = Date.now();
        try {
            await writeLastBridgeRequest({
                ts: new Date().toISOString(),
                url: `${bridge.url}${bridge.judgePath}`,
                sessionKey: ctx.sessionKey,
                request: requestPayload,
            });
            const response = await fetch(`${bridge.url}${bridge.judgePath}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${bridge.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestPayload),
                signal: AbortSignal.timeout(bridge.timeoutMs),
            });
            const payload = (await response.json());
            const rawReply = extractAssistantReply(payload);
            const judge = normalizeJudgeResponse(rawReply);
            if (judge.decision === 'ask_user') {
                await (0, pending_decision_store_1.setPendingDecision)(ctx.sessionKey, {
                    pendingDecision: true,
                    origin: 'skillkeeper-context-judge',
                    requestId,
                    question: judge.userQuestion ?? judge.summary,
                    continueHint: judge.continueHint ?? undefined,
                    createdAt: new Date().toISOString(),
                });
            }
            else {
                await (0, pending_decision_store_1.clearPendingDecision)(ctx.sessionKey);
            }
            let deliveryResult;
            if (judge.decision === 'ask_user') {
                deliveryResult = await replyToCurrentChannel({
                    cfg: openclawConfig,
                    sessionKey: ctx.sessionKey,
                    text: judge.userQuestion ?? judge.summary,
                });
            }
            else if (judge.decision === 'stop' && judge.summary) {
                deliveryResult = await replyToCurrentChannel({
                    cfg: openclawConfig,
                    sessionKey: ctx.sessionKey,
                    text: judge.summary,
                });
            }
            const bridgeEvent = {
                ts: new Date().toISOString(),
                ok: response.ok,
                status: response.status,
                url: `${bridge.url}${bridge.judgePath}`,
                requestId,
                agentId: ctx.agentId,
                sessionId: ctx.sessionId,
                sessionKey: ctx.sessionKey,
                durationMs: Date.now() - startedAt,
                rawReply,
                judge,
                deliveredToChannel: deliveryResult?.ok ?? false,
                deliveryReason: deliveryResult?.reason,
                error: payload.error,
            };
            await appendBridgeEvent(bridgeEvent);
            Logger_1.logger.info('[bridge] agent_end context judge completed', bridgeEvent);
        }
        catch (error) {
            const bridgeEvent = {
                ts: new Date().toISOString(),
                ok: false,
                url: `${bridge.url}${bridge.judgePath}`,
                requestId,
                agentId: ctx.agentId,
                sessionId: ctx.sessionId,
                sessionKey: ctx.sessionKey,
                durationMs: Date.now() - startedAt,
                error: error instanceof Error ? error.message : String(error),
            };
            await appendBridgeEvent(bridgeEvent);
            Logger_1.logger.warn('[bridge] agent_end context judge failed', bridgeEvent);
        }
    };
}
//# sourceMappingURL=agent-end-bridge.js.map