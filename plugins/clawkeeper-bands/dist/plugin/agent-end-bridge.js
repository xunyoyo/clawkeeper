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
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const Logger_1 = require("../core/Logger");
const pending_decision_store_1 = require("./pending-decision-store");
const BRIDGE_EVENTS_PATH = path_1.default.join(Logger_1.CLAWKEEPER_BANDS_DATA_DIR, "bridge-events.jsonl");
const BRIDGE_LAST_REQUEST_PATH = path_1.default.join(Logger_1.CLAWKEEPER_BANDS_DATA_DIR, "bridge-last-request.json");
const DEFAULT_MAX_CONTEXT_CHARS = 120_000;
const DEFAULT_JUDGE_PATH = "/plugins/clawkeeper-watcher/context-judge";
const DEFAULT_AGENT_ID = "main";
let runtimeHelpersPromise = null;
function resolveBridgeConfig(pluginConfig) {
    const raw = pluginConfig?.bridge ?? {};
    const enabled = raw.enabled ?? process.env.CLAWKEEPER_BANDS_BRIDGE_ENABLED !== "false";
    const url = raw.url ?? process.env.CLAWKEEPER_BANDS_BRIDGE_URL ?? "";
    const token = raw.token ?? process.env.CLAWKEEPER_BANDS_BRIDGE_TOKEN ?? "";
    if (!enabled || !url || !token) {
        return null;
    }
    return {
        enabled: true,
        url: url.replace(/\/$/, ""),
        token,
        judgePath: raw.judgePath ?? process.env.CLAWKEEPER_BANDS_BRIDGE_JUDGE_PATH ?? DEFAULT_JUDGE_PATH,
        model: raw.model ?? process.env.CLAWKEEPER_BANDS_BRIDGE_MODEL ?? "",
        systemPrompt: raw.systemPrompt ?? process.env.CLAWKEEPER_BANDS_BRIDGE_SYSTEM_PROMPT ?? "",
        userPrompt: raw.userPrompt ?? process.env.CLAWKEEPER_BANDS_BRIDGE_USER_PROMPT ?? "",
        timeoutMs: raw.timeoutMs ?? Number(process.env.CLAWKEEPER_BANDS_BRIDGE_TIMEOUT_MS ?? 15000),
        maxContextChars: raw.maxContextChars ??
            Number(process.env.CLAWKEEPER_BANDS_BRIDGE_MAX_CONTEXT_CHARS ?? DEFAULT_MAX_CONTEXT_CHARS),
        policy: raw.policy ?? {},
    };
}
function stringifyUnknown(value, maxChars) {
    if (value == null) {
        return "";
    }
    if (typeof value === "string") {
        return value.length > maxChars ? `${value.slice(0, maxChars)}\n...[truncated]` : value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    try {
        const json = JSON.stringify(value, (_key, nested) => {
            if (typeof nested === "string") {
                return nested.length > 12_000 ? `${nested.slice(0, 12_000)}...[truncated]` : nested;
            }
            return nested;
        }, 2);
        return json.length > maxChars ? `${json.slice(0, maxChars)}\n...[truncated]` : json;
    }
    catch {
        return "[unserializable]";
    }
}
function extractText(value, maxChars) {
    if (typeof value === "string") {
        return stringifyUnknown(value, maxChars);
    }
    if (!Array.isArray(value)) {
        return stringifyUnknown(value, maxChars);
    }
    return value
        .map((entry) => {
        if (!entry || typeof entry !== "object") {
            return stringifyUnknown(entry, Math.min(maxChars, 500));
        }
        const text = entry.text;
        return typeof text === "string" ? text : stringifyUnknown(entry, Math.min(maxChars, 2000));
    })
        .filter(Boolean)
        .join("\n");
}
function normalizeMessageRecord(entry, maxChars) {
    if (!entry || typeof entry !== "object") {
        return null;
    }
    const record = entry;
    const role = typeof record.role === "string"
        ? record.role
        : typeof record.type === "string"
            ? record.type
            : "unknown";
    const normalized = {
        role,
        content: extractText(record.content, Math.min(20_000, maxChars)),
    };
    if (typeof record.name === "string") {
        normalized.name = record.name;
    }
    if (typeof record.toolName === "string") {
        normalized.toolName = record.toolName;
    }
    if (typeof record.toolCallId === "string") {
        normalized.toolCallId = record.toolCallId;
    }
    if (typeof record.tool_call_id === "string") {
        normalized.toolCallId = record.tool_call_id;
    }
    if (typeof record.id === "string") {
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
    await (0, promises_1.appendFile)(BRIDGE_EVENTS_PATH, `${JSON.stringify(event)}\n`, "utf8");
}
async function writeLastBridgeRequest(payload) {
    await (0, promises_1.writeFile)(BRIDGE_LAST_REQUEST_PATH, JSON.stringify(payload, null, 2), "utf8");
}
function normalizeJudgeResponse(rawPayload) {
    if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
        return {
            version: 1,
            decision: "stop",
            stopReason: "invalid_response",
            shouldContinue: false,
            needsUserDecision: false,
            userQuestion: null,
            summary: "Remote context-judge did not return a valid JSON object.",
            riskLevel: "medium",
            evidence: [],
            nextAction: "stop_run",
            continueHint: null,
        };
    }
    const parsed = rawPayload;
    const decision = parsed.decision === "continue" || parsed.decision === "stop" || parsed.decision === "ask_user"
        ? parsed.decision
        : "stop";
    return {
        version: Number.isFinite(parsed.version) ? Number(parsed.version) : 1,
        decision,
        stopReason: typeof parsed.stopReason === "string" ? parsed.stopReason : "unknown",
        shouldContinue: typeof parsed.shouldContinue === "boolean" ? parsed.shouldContinue : decision === "continue",
        needsUserDecision: typeof parsed.needsUserDecision === "boolean"
            ? parsed.needsUserDecision
            : decision === "ask_user",
        userQuestion: typeof parsed.userQuestion === "string" ? parsed.userQuestion : null,
        summary: typeof parsed.summary === "string"
            ? parsed.summary
            : "Remote context-judge did not provide a summary.",
        riskLevel: parsed.riskLevel === "low" ||
            parsed.riskLevel === "medium" ||
            parsed.riskLevel === "high" ||
            parsed.riskLevel === "critical"
            ? parsed.riskLevel
            : decision === "continue"
                ? "low"
                : "medium",
        evidence: Array.isArray(parsed.evidence)
            ? parsed.evidence.filter((item) => typeof item === "string")
            : [],
        nextAction: parsed.nextAction === "continue_run" ||
            parsed.nextAction === "ask_user" ||
            parsed.nextAction === "stop_run"
            ? parsed.nextAction
            : decision === "continue"
                ? "continue_run"
                : decision === "ask_user"
                    ? "ask_user"
                    : "stop_run",
        continueHint: typeof parsed.continueHint === "string" ? parsed.continueHint : null,
    };
}
function resolveAgentIdFromSessionKey(sessionKey) {
    if (!sessionKey || !sessionKey.startsWith("agent:")) {
        return undefined;
    }
    const parts = sessionKey.split(":");
    return parts.length >= 2 ? parts[1] : undefined;
}
function normalizeAgentId(raw) {
    const trimmed = typeof raw === "string" ? raw.trim().toLowerCase() : "";
    return trimmed || DEFAULT_AGENT_ID;
}
function expandHomePath(input, env = process.env) {
    if (input === "~") {
        return env.HOME || os_1.default.homedir();
    }
    if (input.startsWith("~/")) {
        return path_1.default.join(env.HOME || os_1.default.homedir(), input.slice(2));
    }
    return input;
}
function resolveLocalStorePath(store, opts) {
    const env = opts?.env ?? process.env;
    const agentId = normalizeAgentId(opts?.agentId);
    const stateDir = env.OPENCLAW_STATE_DIR || env.OPENCLAW_HOME || path_1.default.join(env.HOME || os_1.default.homedir(), ".openclaw");
    if (!store) {
        return path_1.default.join(stateDir, "agents", agentId, "sessions", "sessions.json");
    }
    if (store.includes("{agentId}")) {
        return path_1.default.resolve(expandHomePath(store.replaceAll("{agentId}", agentId), env));
    }
    return path_1.default.resolve(expandHomePath(store, env));
}
async function importRuntimeHelpers() {
    if (!runtimeHelpersPromise) {
        runtimeHelpersPromise = (async () => {
            const fs = require("fs");
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
                return fs.existsSync(path_1.default.join(candidate, "dist"));
            });
            if (!rootDir) {
                throw new Error("Unable to locate OpenClaw dist/ runtime from clawkeeper-bands bridge");
            }
            const loadModule = (relativePath) => {
                const fullPath = path_1.default.join(rootDir, relativePath);
                return require(fullPath);
            };
            const findNamedExport = (relativePath, targetName) => {
                const mod = loadModule(relativePath);
                for (const value of Object.values(mod)) {
                    if (typeof value === "function" && value.name === targetName) {
                        return value;
                    }
                }
                return null;
            };
            const distDir = path_1.default.join(rootDir, "dist");
            const distEntries = fs.readdirSync(distDir).filter((entry) => entry.endsWith(".js"));
            const replyRuntimeEntry = distEntries.find((entry) => /^route-reply\.runtime-.*\.js$/.test(entry));
            if (!replyRuntimeEntry) {
                throw new Error("Unable to locate route-reply runtime bundle from OpenClaw dist");
            }
            const routeReply = findNamedExport(`dist/${replyRuntimeEntry}`, "routeReply");
            if (typeof routeReply !== "function") {
                throw new Error(`Unable to resolve routeReply from OpenClaw ${replyRuntimeEntry}`);
            }
            return {
                routeReply,
            };
        })();
    }
    return runtimeHelpersPromise;
}
async function loadSessionStoreFromDisk(storePath) {
    try {
        const { readFile } = await Promise.resolve().then(() => __importStar(require("fs/promises")));
        const raw = await readFile(storePath, "utf8");
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    }
    catch {
        return {};
    }
}
function normalizeDeliveryField(value) {
    return typeof value === "string" ? value.trim() || undefined : undefined;
}
function normalizeThreadId(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return Math.trunc(value);
    }
    return typeof value === "string" ? value.trim() || undefined : undefined;
}
function deliveryContextFromSessionEntry(entry) {
    if (!entry) {
        return undefined;
    }
    const direct = entry.deliveryContext;
    const channel = normalizeDeliveryField(direct?.channel ?? entry.lastChannel ?? entry.channel);
    const to = normalizeDeliveryField(direct?.to ?? entry.lastTo);
    const accountId = normalizeDeliveryField(direct?.accountId ?? entry.lastAccountId);
    const threadId = normalizeThreadId(direct?.threadId ?? entry.lastThreadId ?? entry.origin?.threadId);
    if (!channel && !to && !accountId && threadId == null) {
        return undefined;
    }
    return {
        channel,
        to,
        accountId,
        ...(threadId != null ? { threadId } : {}),
    };
}
async function loadCurrentDeliveryContext(params) {
    if (!params.sessionKey) {
        return { reason: "missing sessionKey" };
    }
    try {
        await importRuntimeHelpers();
        const agentId = resolveAgentIdFromSessionKey(params.sessionKey);
        const storePath = resolveLocalStorePath(params.cfg.session?.store, {
            agentId,
            env: process.env,
        });
        const store = await loadSessionStoreFromDisk(storePath);
        const entry = store[params.sessionKey.toLowerCase()] ?? store[params.sessionKey];
        const delivery = deliveryContextFromSessionEntry(entry);
        if (!delivery?.channel || !delivery.to) {
            return { reason: "no deliveryContext on current session" };
        }
        return { delivery };
    }
    catch (error) {
        return { reason: error instanceof Error ? error.message : String(error) };
    }
}
async function replyToCurrentChannel(params) {
    if (!params.text?.trim()) {
        return { ok: false, reason: "missing text" };
    }
    try {
        const helpers = await importRuntimeHelpers();
        const loaded = await loadCurrentDeliveryContext({
            cfg: params.cfg,
            sessionKey: params.sessionKey,
        });
        if (!loaded.delivery?.channel || !loaded.delivery.to) {
            return { ok: false, reason: loaded.reason ?? "missing deliveryContext" };
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
            return { ok: false, reason: result.error ?? "routeReply failed" };
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
            source: "openclaw-a-agent_end-bridge",
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
            requestId,
            forwardedContext,
            policy: bridge.policy,
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
                method: "POST",
                headers: {
                    Authorization: `Bearer ${bridge.token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(requestPayload),
                signal: AbortSignal.timeout(bridge.timeoutMs),
            });
            const payload = await response.json();
            const judge = normalizeJudgeResponse(payload);
            if (!response.ok) {
                throw new Error(`remote context-judge returned ${response.status}: ${judge.summary || "request failed"}`);
            }
            if (judge.decision === "ask_user") {
                await (0, pending_decision_store_1.setPendingDecision)(ctx.sessionKey, {
                    pendingDecision: true,
                    origin: "clawkeeper-context-judge",
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
            if (judge.decision === "ask_user") {
                deliveryResult = await replyToCurrentChannel({
                    cfg: openclawConfig,
                    sessionKey: ctx.sessionKey,
                    text: judge.userQuestion ?? judge.summary,
                });
            }
            else if (judge.decision === "stop" && judge.summary) {
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
                payload,
                judge,
                deliveredToChannel: deliveryResult?.ok ?? false,
                deliveryReason: deliveryResult?.reason,
            };
            await appendBridgeEvent(bridgeEvent);
            Logger_1.logger.info("[bridge] agent_end context judge completed", bridgeEvent);
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
            Logger_1.logger.warn("[bridge] agent_end context judge failed", bridgeEvent);
        }
    };
}
//# sourceMappingURL=agent-end-bridge.js.map