"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createClawkeeperStartupAuditRoute = createClawkeeperStartupAuditRoute;
const STARTUP_AUDIT_CONTEXT_KEY = 'clawkeeper:start-audit';
const DRIFT_ALERT_CONTEXT_KEY = 'clawkeeper:drift-alert';
const SKILL_GUARD_ALERT_CONTEXT_KEY = 'clawkeeper:skill-guard-alert';
const DEFAULT_AGENT_ID = 'main';
const DEFAULT_MAIN_KEY = 'main';
function writeJson(res, statusCode, payload) {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
}
async function readJsonBody(req) {
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const raw = Buffer.concat(chunks).toString('utf8').trim();
    return raw ? JSON.parse(raw) : {};
}
function normalizeToken(value, fallback) {
    const trimmed = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return trimmed || fallback;
}
function resolveMainSessionKey(cfg) {
    const config = cfg;
    if (config?.session?.scope === 'global') {
        return 'global';
    }
    const agents = Array.isArray(config?.agents?.list) ? config.agents.list : [];
    const defaultAgentId = agents.find((agent) => agent?.default)?.id ?? agents[0]?.id ?? DEFAULT_AGENT_ID;
    return `agent:${normalizeToken(defaultAgentId, DEFAULT_AGENT_ID)}:${normalizeToken(config?.session?.mainKey, DEFAULT_MAIN_KEY)}`;
}
function normalizeCounts(input) {
    const counts = (input && typeof input === 'object' ? input : {});
    return {
        critical: Number(counts.critical ?? 0),
        high: Number(counts.high ?? 0),
        medium: Number(counts.medium ?? 0),
        low: Number(counts.low ?? 0),
    };
}
function formatNotificationEventText(payload) {
    const counts = normalizeCounts(payload.counts);
    const countText = ['critical', 'high', 'medium', 'low']
        .filter((level) => counts[level] > 0)
        .map((level) => `${level}=${counts[level]}`)
        .join(', ');
    const topFindings = Array.isArray(payload.topFindings)
        ? payload.topFindings.filter((item) => typeof item === 'string' && item.trim().length > 0).slice(0, 3)
        : [];
    const segments = [
        payload.event === 'skill_guard_alert'
            ? typeof payload.file === 'string' && payload.file.trim()
                ? Number.isFinite(payload.score)
                    ? `Skill Guard: "${payload.file.trim()}" score ${payload.score}/100.`
                    : `Skill Guard: "${payload.file.trim()}" reported findings.`
                : 'Skill Guard reported findings.'
            : payload.event === 'drift_alert'
                ? Number.isFinite(payload.score)
                    ? `User OpenClaw drift alert: score ${payload.score}/100.`
                    : 'User OpenClaw drift alert reported findings.'
                : Number.isFinite(payload.score)
                    ? `User OpenClaw startup audit: score ${payload.score}/100.`
                    : 'User OpenClaw startup audit reported findings.',
        (payload.event === 'drift_alert' || payload.event === 'skill_guard_alert') && typeof payload.file === 'string' && payload.file.trim()
            ? payload.event === 'skill_guard_alert' ? `Skill: ${payload.file.trim()}.` : `File: ${payload.file.trim()}.`
            : null,
        countText ? `Findings: ${countText}.` : null,
        topFindings.length ? `Top issues: ${topFindings.join(', ')}.` : null,
        typeof payload.nextAction === 'string' && payload.nextAction.trim() ? `Next: ${payload.nextAction.trim()}` : null,
    ].filter(Boolean);
    return segments.join(' ');
}
function normalizePayload(body) {
    return {
        version: Number(body.version ?? 1),
        source: typeof body.source === 'string' ? body.source : '',
        mode: typeof body.mode === 'string' ? body.mode : '',
        event: typeof body.event === 'string' ? body.event : '',
        score: Number.isFinite(body.score) ? Number(body.score) : undefined,
        summary: typeof body.summary === 'string' ? body.summary : undefined,
        counts: body.counts,
        topFindings: Array.isArray(body.topFindings) ? body.topFindings : undefined,
        nextAction: typeof body.nextAction === 'string' ? body.nextAction : null,
        file: typeof body.file === 'string' ? body.file : null,
        ts: typeof body.ts === 'string' ? body.ts : undefined,
    };
}
function createClawkeeperStartupAuditRoute(deps) {
    return async function clawkeeperStartupAuditRoute(req, res) {
        if (req.method !== 'POST') {
            writeJson(res, 405, { ok: false, error: 'Method Not Allowed' });
            return true;
        }
        try {
            const body = await readJsonBody(req);
            const payload = normalizePayload(body);
            if (payload.source !== 'clawkeeper-watcher' ||
                (payload.event !== 'startup_audit' && payload.event !== 'drift_alert' && payload.event !== 'skill_guard_alert')) {
                writeJson(res, 400, { ok: false, error: 'Invalid clawkeeper notification payload' });
                return true;
            }
            const sessionKey = resolveMainSessionKey(deps.config);
            const text = formatNotificationEventText(payload);
            const contextKey = payload.event === 'drift_alert' ? DRIFT_ALERT_CONTEXT_KEY
                : payload.event === 'skill_guard_alert' ? SKILL_GUARD_ALERT_CONTEXT_KEY
                    : STARTUP_AUDIT_CONTEXT_KEY;
            const queued = deps.runtime?.system?.enqueueSystemEvent?.(text, {
                sessionKey,
                contextKey,
            }) ?? false;
            if (queued) {
                deps.runtime?.system?.requestHeartbeatNow?.({
                    reason: payload.event === 'drift_alert' ? 'clawkeeper-drift-alert'
                        : payload.event === 'skill_guard_alert' ? 'clawkeeper-skill-guard-alert'
                            : 'clawkeeper-startup-audit',
                    sessionKey,
                });
            }
            deps.logger.info('[clawkeeper-bands] clawkeeper notification received', {
                sessionKey,
                queued,
                score: payload.score,
                source: payload.source,
                event: payload.event,
            });
            writeJson(res, 200, { ok: true, queued, sessionKey });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            deps.logger.warn('[clawkeeper-bands] startup audit notification failed', { error: message });
            writeJson(res, 400, { ok: false, error: message });
        }
        return true;
    };
}
//# sourceMappingURL=startup-audit-route.js.map