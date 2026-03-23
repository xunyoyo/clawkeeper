const DEFAULT_USER_BRIDGE_PATH = '/plugins/clawbands/clawkeeper-startup-audit';
const DEFAULT_TIMEOUT_MS = 10_000;

function normalizePath(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    return DEFAULT_USER_BRIDGE_PATH;
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function resolveTimeoutMs(value) {
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
}

function buildSeverityCounts(report) {
  const summary = report?.summary ?? {};
  return {
    critical: Number(summary.critical ?? 0),
    high: Number(summary.high ?? 0),
    medium: Number(summary.medium ?? 0),
    low: Number(summary.low ?? 0),
  };
}

function buildNotificationSummary(report) {
  const counts = buildSeverityCounts(report);
  const nonZero = ['critical', 'high', 'medium', 'low']
    .filter((key) => counts[key] > 0)
    .map((key) => `${key}=${counts[key]}`);

  const findings = Array.isArray(report?.findings) ? report.findings : [];
  const findingCount = findings.length;
  const topFindings = findings
    .slice(0, 3)
    .map((item) => item?.id || item?.title)
    .filter(Boolean);

  const summaryText = [
    `Clawkeeper startup audit found ${findingCount} issue${findingCount === 1 ? '' : 's'}.`,
    nonZero.length ? `Counts: ${nonZero.join(', ')}.` : null,
    topFindings.length ? `Top issues: ${topFindings.join(', ')}.` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    summaryText,
    counts,
    topFindings,
    nextAction: Array.isArray(report?.nextSteps) && report.nextSteps.length > 0 ? report.nextSteps[0] : null,
  };
}

function resolveUserBridgeConfig(pluginConfig = {}) {
  const raw = pluginConfig?.notify?.userBridge;
  if (!raw || typeof raw !== 'object' || raw.enabled !== true) {
    return null;
  }

  return {
    url: typeof raw.url === 'string' ? raw.url.trim().replace(/\/$/, '') : '',
    token: typeof raw.token === 'string' ? raw.token.trim() : '',
    path: normalizePath(raw.path),
    timeoutMs: resolveTimeoutMs(raw.timeoutMs),
  };
}

export async function notifyStartupAuditToUserBridge({ pluginConfig = {}, report, logger, mode = 'local' }) {
  const bridge = resolveUserBridgeConfig(pluginConfig);
  if (!bridge) {
    return { sent: false, reason: 'disabled' };
  }

  const findings = Array.isArray(report?.findings) ? report.findings : [];
  if (findings.length === 0) {
    return { sent: false, reason: 'clean' };
  }

  if (!bridge.url || !bridge.token) {
    logger?.warn?.('[Clawkeeper-Watcher] userBridge notification is enabled but url/token is missing');
    return { sent: false, reason: 'missing_config' };
  }

  const summary = buildNotificationSummary(report);
  const payload = {
    version: 1,
    source: 'clawkeeper-watcher',
    mode,
    event: 'startup_audit',
    score: report.score,
    summary: summary.summaryText,
    counts: summary.counts,
    topFindings: summary.topFindings,
    nextAction: summary.nextAction,
    ts: new Date().toISOString(),
  };

  const response = await fetch(`${bridge.url}${bridge.path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bridge.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(bridge.timeoutMs),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(
      `userBridge returned ${response.status}${details ? `: ${details.slice(0, 200)}` : ''}`,
    );
  }

  return { sent: true, payload };
}
