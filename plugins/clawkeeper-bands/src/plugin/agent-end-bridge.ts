import { randomUUID } from "crypto";
import { appendFile, writeFile } from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";
import { CLAWKEEPER_BANDS_DATA_DIR, logger } from "../core/Logger";
import { clearPendingDecision, setPendingDecision } from "./pending-decision-store";

export interface AgentEndEvent {
  messages: unknown[];
  success: boolean;
  error?: string;
  durationMs?: number;
}

export interface AgentEndContext {
  agentId?: string;
  sessionId?: string;
  sessionKey?: string;
  workspaceDir?: string;
}

export interface BridgePolicy {
  maxRiskBeforeStop?: "low" | "medium" | "high" | "critical";
  requireUserConfirmationFor?: string[];
  autoContinueAllowed?: boolean;
  maxToolStepsWithoutUserTurn?: number;
  treatCommandExecutionAsHighRisk?: boolean;
}

export interface BridgeConfig {
  enabled?: boolean;
  url?: string;
  token?: string;
  model?: string;
  judgePath?: string;
  systemPrompt?: string;
  userPrompt?: string;
  timeoutMs?: number;
  maxContextChars?: number;
  policy?: BridgePolicy;
}

export interface BridgeHookPluginConfig {
  bridge?: BridgeConfig;
}

type JudgeResponse = {
  version: number;
  decision: "continue" | "stop" | "ask_user";
  stopReason: string;
  shouldContinue: boolean;
  needsUserDecision: boolean;
  userQuestion: string | null;
  summary: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  evidence: string[];
  nextAction: "continue_run" | "ask_user" | "stop_run";
  continueHint: string | null;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  error?: unknown;
};

type DeliveryContext = {
  channel?: string;
  to?: string;
  accountId?: string;
  threadId?: string | number;
};

type SessionEntry = {
  deliveryContext?: DeliveryContext;
  lastChannel?: string;
  lastTo?: string;
  lastAccountId?: string;
  lastThreadId?: string | number;
};

type RouteReplyFn = (params: {
  payload: { text: string };
  channel: string;
  to: string;
  accountId?: string;
  threadId?: string | number;
  sessionKey?: string;
  cfg: unknown;
  mirror?: boolean;
}) => Promise<{ ok: boolean; messageId?: string; error?: string }>;

type RuntimeHelpers = {
  resolveStorePath: (store?: string, opts?: { agentId?: string }) => string;
  loadSessionStore: (
    storePath: string,
    opts?: { skipCache?: boolean },
  ) => Record<string, SessionEntry>;
  deliveryContextFromSession: (entry?: SessionEntry) => DeliveryContext | undefined;
  routeReply: RouteReplyFn;
};

const BRIDGE_EVENTS_PATH = path.join(CLAWKEEPER_BANDS_DATA_DIR, "bridge-events.jsonl");
const BRIDGE_LAST_REQUEST_PATH = path.join(CLAWKEEPER_BANDS_DATA_DIR, "bridge-last-request.json");
const DEFAULT_MAX_CONTEXT_CHARS = 120_000;
const DEFAULT_JUDGE_PATH = "/v1/chat/completions";
const DEFAULT_SYSTEM_PROMPT = [
  "你是 OpenClaw B。",
  "你会接收 OpenClaw A 转发来的完整运行上下文，包括对话、工具调用、命令输出和元数据。",
  "你要使用你自己的思考、skills、plugins 和提示词来判断 A 下一步应不应该继续。",
  "你不是执行者，不要假装已经替 A 执行了工具。",
  "你必须只输出一个 JSON 对象，不要输出任何额外解释、代码块或前后缀。",
  "JSON 必须包含这些字段：decision, summary, userQuestion, continueHint, stopReason。",
  "decision 只能是 continue、stop、ask_user。",
  "如果需要用户确认，decision=ask_user，userQuestion 必须是直接发给最终用户的话。",
].join("\n");
const DEFAULT_USER_PROMPT = "以下是 OpenClaw A 转发的完整上下文。请基于这份上下文输出严格 JSON。";

let runtimeHelpersPromise: Promise<RuntimeHelpers> | null = null;

function resolveBridgeConfig(
  pluginConfig: { bridge?: BridgeConfig } | undefined,
): Required<BridgeConfig> | null {
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
    model: raw.model ?? process.env.CLAWKEEPER_BANDS_BRIDGE_MODEL ?? "openclaw:main",
    judgePath:
      raw.judgePath ?? process.env.CLAWKEEPER_BANDS_BRIDGE_JUDGE_PATH ?? DEFAULT_JUDGE_PATH,
    systemPrompt:
      raw.systemPrompt ??
      process.env.CLAWKEEPER_BANDS_BRIDGE_SYSTEM_PROMPT ??
      DEFAULT_SYSTEM_PROMPT,
    userPrompt:
      raw.userPrompt ?? process.env.CLAWKEEPER_BANDS_BRIDGE_USER_PROMPT ?? DEFAULT_USER_PROMPT,
    timeoutMs: raw.timeoutMs ?? Number(process.env.CLAWKEEPER_BANDS_BRIDGE_TIMEOUT_MS ?? 15000),
    maxContextChars:
      raw.maxContextChars ??
      Number(process.env.CLAWKEEPER_BANDS_BRIDGE_MAX_CONTEXT_CHARS ?? DEFAULT_MAX_CONTEXT_CHARS),
    policy: raw.policy ?? {},
  };
}

function stringifyUnknown(value: unknown, maxChars: number): string {
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
    const json = JSON.stringify(
      value,
      (_key, nested) => {
        if (typeof nested === "string") {
          return nested.length > 12_000 ? `${nested.slice(0, 12_000)}...[truncated]` : nested;
        }
        return nested;
      },
      2,
    );
    return json.length > maxChars ? `${json.slice(0, maxChars)}\n...[truncated]` : json;
  } catch {
    return "[unserializable]";
  }
}

function extractText(value: unknown, maxChars: number): string {
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
      const text = (entry as { text?: unknown }).text;
      return typeof text === "string" ? text : stringifyUnknown(entry, Math.min(maxChars, 2000));
    })
    .filter(Boolean)
    .join("\n");
}

function normalizeMessageRecord(entry: unknown, maxChars: number): Record<string, unknown> | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const record = entry as {
    role?: unknown;
    content?: unknown;
    type?: unknown;
    name?: unknown;
    toolName?: unknown;
    toolCallId?: unknown;
    tool_call_id?: unknown;
    id?: unknown;
    error?: unknown;
    result?: unknown;
    details?: unknown;
    tool_calls?: unknown;
    toolCalls?: unknown;
  };

  const role =
    typeof record.role === "string"
      ? record.role
      : typeof record.type === "string"
        ? record.type
        : "unknown";
  const normalized: Record<string, unknown> = {
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

async function appendBridgeEvent(event: Record<string, unknown>): Promise<void> {
  await appendFile(BRIDGE_EVENTS_PATH, `${JSON.stringify(event)}\n`, "utf8");
}

async function writeLastBridgeRequest(payload: Record<string, unknown>): Promise<void> {
  await writeFile(BRIDGE_LAST_REQUEST_PATH, JSON.stringify(payload, null, 2), "utf8");
}

function extractAssistantReply(payload: ChatCompletionResponse): string {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => (typeof item?.text === "string" ? item.text : ""))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
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
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      depth += 1;
      continue;
    }
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

function normalizeJudgeResponse(rawText: string): JudgeResponse {
  const jsonText = extractFirstJsonObject(rawText);
  if (!jsonText) {
    return {
      version: 1,
      decision: "stop",
      stopReason: "invalid_json_reply",
      shouldContinue: false,
      needsUserDecision: false,
      userQuestion: null,
      summary: rawText.trim() || "B 没有返回可解析的 JSON。",
      riskLevel: "medium",
      evidence: [],
      nextAction: "stop_run",
      continueHint: null,
    };
  }

  try {
    const parsed = JSON.parse(jsonText) as Partial<JudgeResponse> & {
      decision?: string;
      summary?: string;
      userQuestion?: string | null;
      continueHint?: string | null;
      stopReason?: string;
    };

    const decision =
      parsed.decision === "continue" || parsed.decision === "stop" || parsed.decision === "ask_user"
        ? parsed.decision
        : "stop";

    return {
      version: 1,
      decision,
      stopReason: typeof parsed.stopReason === "string" ? parsed.stopReason : "unknown",
      shouldContinue: decision === "continue",
      needsUserDecision: decision === "ask_user",
      userQuestion: typeof parsed.userQuestion === "string" ? parsed.userQuestion : null,
      summary:
        typeof parsed.summary === "string"
          ? parsed.summary
          : rawText.trim() || "B 没有提供 summary。",
      riskLevel:
        parsed.riskLevel === "low" ||
        parsed.riskLevel === "medium" ||
        parsed.riskLevel === "high" ||
        parsed.riskLevel === "critical"
          ? parsed.riskLevel
          : decision === "continue"
            ? "low"
            : "medium",
      evidence: Array.isArray(parsed.evidence)
        ? parsed.evidence.filter((item): item is string => typeof item === "string")
        : [],
      nextAction:
        decision === "continue"
          ? "continue_run"
          : decision === "ask_user"
            ? "ask_user"
            : "stop_run",
      continueHint: typeof parsed.continueHint === "string" ? parsed.continueHint : null,
    };
  } catch {
    return {
      version: 1,
      decision: "stop",
      stopReason: "invalid_json_reply",
      shouldContinue: false,
      needsUserDecision: false,
      userQuestion: null,
      summary: rawText.trim() || "B 返回的 JSON 解析失败。",
      riskLevel: "medium",
      evidence: [],
      nextAction: "stop_run",
      continueHint: null,
    };
  }
}

function resolveAgentIdFromSessionKey(sessionKey?: string): string | undefined {
  if (!sessionKey || !sessionKey.startsWith("agent:")) {
    return undefined;
  }
  const parts = sessionKey.split(":");
  return parts.length >= 2 ? parts[1] : undefined;
}

async function importRuntimeHelpers(): Promise<RuntimeHelpers> {
  if (!runtimeHelpersPromise) {
    runtimeHelpersPromise = (async () => {
      const fs = require("fs");
      const fsp = require("fs/promises");
      const candidateRoots = new Set<string>();
      let cursor = process.cwd();
      candidateRoots.add(cursor);
      cursor = __dirname;
      for (let i = 0; i < 10; i += 1) {
        candidateRoots.add(cursor);
        const parent = path.dirname(cursor);
        if (parent === cursor) {
          break;
        }
        cursor = parent;
      }

      const rootDir = Array.from(candidateRoots).find((candidate) => {
        return fs.existsSync(path.join(candidate, "dist"));
      });

      if (!rootDir) {
        throw new Error("Unable to locate OpenClaw dist/ runtime from clawkeeper-bands bridge");
      }

      const loadModule = async <T>(relativePath: string): Promise<T> => {
        const fullPath = path.join(rootDir, relativePath);
        const loaded = await import(pathToFileURL(fullPath).href);
        return loaded as T;
      };

      const distDir = path.join(rootDir, "dist");
      const distEntries = (await fsp.readdir(distDir))
        .filter((entry: string) => entry.endsWith(".js") && /^(sessions|paths|reply)-/.test(entry))
        .toSorted();

      const findNamedExport = async <T extends Function>(targetName: string): Promise<T> => {
        for (const entry of distEntries) {
          const mod = await loadModule<Record<string, unknown>>(`dist/${entry}`);
          for (const value of Object.values(mod)) {
            if (typeof value === "function" && value.name === targetName) {
              return value as T;
            }
          }
        }
        throw new Error(`Unable to resolve ${targetName} from OpenClaw dist bundles`);
      };

      const loadSessionStore =
        await findNamedExport<RuntimeHelpers["loadSessionStore"]>("loadSessionStore");
      const resolveStorePath =
        await findNamedExport<RuntimeHelpers["resolveStorePath"]>("resolveStorePath");
      const deliveryContextFromSession = await findNamedExport<
        RuntimeHelpers["deliveryContextFromSession"]
      >("deliveryContextFromSession");
      const routeReply = await findNamedExport<RuntimeHelpers["routeReply"]>("routeReply");

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

async function loadCurrentDeliveryContext(params: {
  cfg: unknown;
  sessionKey?: string;
}): Promise<{ delivery?: DeliveryContext; reason?: string }> {
  if (!params.sessionKey) {
    return { reason: "missing sessionKey" };
  }

  try {
    const helpers = await importRuntimeHelpers();
    const agentId = resolveAgentIdFromSessionKey(params.sessionKey);
    const storePath = helpers.resolveStorePath(
      (params.cfg as { session?: { store?: string } }).session?.store,
      {
        agentId,
      },
    );
    const store = helpers.loadSessionStore(storePath, { skipCache: true });
    const entry = store[params.sessionKey.toLowerCase()] ?? store[params.sessionKey];
    const delivery = helpers.deliveryContextFromSession(entry);
    if (!delivery?.channel || !delivery.to) {
      return { reason: "no deliveryContext on current session" };
    }
    return { delivery };
  } catch (error) {
    return { reason: error instanceof Error ? error.message : String(error) };
  }
}

async function replyToCurrentChannel(params: {
  cfg: unknown;
  sessionKey?: string;
  text?: string | null;
}): Promise<{ ok: boolean; reason?: string }> {
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
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

export function createAgentEndBridgeHook(
  pluginConfig: BridgeHookPluginConfig | undefined,
  openclawConfig: unknown,
) {
  return async (event: AgentEndEvent, ctx: AgentEndContext): Promise<void> => {
    const bridge = resolveBridgeConfig(pluginConfig);
    if (!bridge) {
      return;
    }

    const requestId = randomUUID();
    const delivery = await loadCurrentDeliveryContext({
      cfg: openclawConfig,
      sessionKey: ctx.sessionKey,
    });

    const normalizedMessages = (event.messages ?? [])
      .map((message) => normalizeMessageRecord(message, bridge.maxContextChars))
      .filter((message): message is Record<string, unknown> => Boolean(message));

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
      model: bridge.model,
      messages: [
        { role: "system", content: bridge.systemPrompt },
        {
          role: "user",
          content: [
            bridge.userPrompt,
            "",
            stringifyUnknown(
              {
                requestId,
                forwardedContext,
                policy: bridge.policy,
              },
              bridge.maxContextChars,
            ),
          ].join("\n"),
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
        method: "POST",
        headers: {
          Authorization: `Bearer ${bridge.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
        signal: AbortSignal.timeout(bridge.timeoutMs),
      });

      const payload = (await response.json()) as ChatCompletionResponse;
      const rawReply = extractAssistantReply(payload);
      const judge = normalizeJudgeResponse(rawReply);

      if (judge.decision === "ask_user") {
        await setPendingDecision(ctx.sessionKey, {
          pendingDecision: true,
          origin: "skillkeeper-context-judge",
          requestId,
          question: judge.userQuestion ?? judge.summary,
          continueHint: judge.continueHint ?? undefined,
          createdAt: new Date().toISOString(),
        });
      } else {
        await clearPendingDecision(ctx.sessionKey);
      }

      let deliveryResult: { ok: boolean; reason?: string } | undefined;
      if (judge.decision === "ask_user") {
        deliveryResult = await replyToCurrentChannel({
          cfg: openclawConfig,
          sessionKey: ctx.sessionKey,
          text: judge.userQuestion ?? judge.summary,
        });
      } else if (judge.decision === "stop" && judge.summary) {
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
      logger.info("[bridge] agent_end context judge completed", bridgeEvent);
    } catch (error) {
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
      logger.warn("[bridge] agent_end context judge failed", bridgeEvent);
    }
  };
}
