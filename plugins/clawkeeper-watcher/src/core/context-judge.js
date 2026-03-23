const DEFAULT_POLICY = {
  maxRiskBeforeStop: 'critical',
  requireUserConfirmationFor: ['exec', 'bash', 'shell', 'network', 'write'],
  autoContinueAllowed: false,
  maxToolStepsWithoutUserTurn: 3,
  treatCommandExecutionAsHighRisk: true
};

const RISK_ORDER = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

const USER_STOP_RE = /\b(停止|取消|不要|算了|终止|stop|cancel|abort|don't|do not)\b/i;
const USER_CONTINUE_RE = /\b(继续|是|好的|确认|继续做|ok|okay|yes|continue|go ahead)\b/i;

function normalizePolicy(policy = {}) {
  return {
    ...DEFAULT_POLICY,
    ...policy,
    requireUserConfirmationFor: Array.isArray(policy.requireUserConfirmationFor)
      ? policy.requireUserConfirmationFor
      : DEFAULT_POLICY.requireUserConfirmationFor
  };
}

function normalizeMessage(message) {
  if (!message || typeof message !== 'object') {
    return null;
  }

  return {
    role: typeof message.role === 'string' ? message.role : 'unknown',
    content: typeof message.content === 'string' ? message.content : '',
    toolName: typeof message.toolName === 'string'
      ? message.toolName
      : typeof message.name === 'string'
        ? message.name
        : '',
    raw: typeof message.raw === 'string' ? message.raw : '',
    error: typeof message.error === 'string' ? message.error : '',
    result: typeof message.result === 'string' ? message.result : ''
  };
}

function lastMessageByRole(messages, role) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === role) {
      return messages[i];
    }
  }
  return null;
}

function lastMessageIndexByRole(messages, role) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === role) {
      return i;
    }
  }
  return -1;
}

function summarizeEvidence(messages) {
  const evidence = [];
  for (const message of messages) {
    if (!message) continue;
    if (message.toolName) {
      evidence.push(`tool=${message.toolName}`);
    }
    if (message.error) {
      evidence.push(`error=${message.error.slice(0, 120)}`);
    }
    if (message.result && /CTX_PROBE_|CMD_OUT_|exitCode|signal|stderr|stdout/i.test(message.result)) {
      evidence.push(`result=${message.result.slice(0, 120)}`);
    }
  }
  return evidence.slice(0, 8);
}

function buildBaseDecision(overrides = {}) {
  return {
    version: 1,
    decision: 'continue',
    stopReason: 'completed',
    shouldContinue: true,
    needsUserDecision: false,
    userQuestion: null,
    summary: '当前上下文未命中需要额外确认的条件。',
    riskLevel: 'low',
    evidence: [],
    nextAction: 'continue_run',
    continueHint: null,
    ...overrides
  };
}

export function judgeForwardedContext(input = {}) {
  const mode = typeof input.mode === 'string' ? input.mode : 'local';
  const localEnhanced = mode === 'local';

  // Wrap buildBaseDecision to always include mode metadata
  const decide = (overrides = {}) => buildBaseDecision({ localEnhanced, mode, ...overrides });

  const requestId = typeof input.requestId === 'string' ? input.requestId : null;
  const forwardedContext = input.forwardedContext && typeof input.forwardedContext === 'object'
    ? input.forwardedContext
    : null;
  const policy = normalizePolicy(input.policy);

  if (!forwardedContext || !Array.isArray(forwardedContext.messages) || forwardedContext.messages.length === 0) {
    return decide({
      decision: 'stop',
      stopReason: 'missing_input',
      shouldContinue: false,
      summary: '缺少 forwardedContext.messages，无法完成上下文判定。',
      riskLevel: 'medium',
      evidence: requestId ? [`requestId=${requestId}`] : [],
      nextAction: 'stop_run'
    });
  }

  const normalizedMessages = forwardedContext.messages.map(normalizeMessage).filter(Boolean);
  const metadata = forwardedContext.metadata && typeof forwardedContext.metadata === 'object'
    ? forwardedContext.metadata
    : {};

  const lastUserIndex = lastMessageIndexByRole(normalizedMessages, 'user');
  const activeMessages = lastUserIndex >= 0 ? normalizedMessages.slice(lastUserIndex) : normalizedMessages;
  const lastUser = lastMessageByRole(normalizedMessages, 'user');
  const toolMessages = activeMessages.filter((message) => message.toolName && message.toolName !== 'clawbands_respond');
  const toolCount = toolMessages.length;
  const toolNames = new Set(toolMessages.map((message) => message.toolName.toLowerCase()).filter(Boolean));
  const hasCommandTool = ['exec', 'bash', 'shell'].some((name) => toolNames.has(name));
  const hasToolError = activeMessages.some((message) => message.error);
  const lastUserContent = lastUser?.content ?? '';

  const evidence = [
    requestId ? `requestId=${requestId}` : null,
    metadata.sessionKey ? `sessionKey=${metadata.sessionKey}` : null,
    `messageCount=${normalizedMessages.length}`,
    `activeMessageCount=${activeMessages.length}`,
    `toolCount=${toolCount}`,
    ...summarizeEvidence(activeMessages)
  ].filter(Boolean);

  if (USER_STOP_RE.test(lastUserContent)) {
    return decide({
      decision: 'stop',
      stopReason: 'user_requested_stop',
      shouldContinue: false,
      summary: '用户最新一条消息明确表示停止或取消，A 应停止继续执行。',
      riskLevel: 'low',
      evidence,
      nextAction: 'stop_run'
    });
  }

  if (hasToolError || metadata.success === false) {
    return decide({
      decision: 'stop',
      stopReason: metadata.error ? 'upstream_error' : 'unknown',
      shouldContinue: false,
      summary: metadata.error
        ? `A 侧本轮运行失败：${String(metadata.error).slice(0, 160)}`
        : 'A 侧本轮运行中出现错误上下文，建议先停止继续执行并检查失败原因。',
      riskLevel: 'high',
      evidence,
      nextAction: 'stop_run'
    });
  }

  if (toolCount > policy.maxToolStepsWithoutUserTurn) {
    return decide({
      decision: 'ask_user',
      stopReason: 'tool_loop_limit',
      shouldContinue: false,
      needsUserDecision: true,
      userQuestion: `这一轮已经连续执行了 ${toolCount} 次工具调用。是否继续下一步？`,
      summary: '连续工具调用次数达到上限，建议回到用户确认。',
      riskLevel: 'high',
      evidence,
      nextAction: 'ask_user',
      continueHint: '仅在用户明确确认后继续，并优先减少下一轮工具调用数量。'
    });
  }

  const needsRiskConfirmation =
    (hasCommandTool && policy.treatCommandExecutionAsHighRisk) ||
    policy.requireUserConfirmationFor.some((keyword) => toolNames.has(String(keyword).toLowerCase()));

  if (needsRiskConfirmation && !policy.autoContinueAllowed) {
    const question = USER_CONTINUE_RE.test(lastUserContent)
      ? '检测到高风险动作，但用户刚刚已经给出继续信号。请再次确认是否继续执行。'
      : '检测到命令执行或高风险工具调用。是否继续下一步操作？';
    return decide({
      decision: 'ask_user',
      stopReason: 'waiting_user_confirmation',
      shouldContinue: false,
      needsUserDecision: true,
      userQuestion: question,
      summary: '上下文包含高风险动作，按策略需要用户明确确认。',
      riskLevel: 'high',
      evidence,
      nextAction: 'ask_user',
      continueHint: '如果用户确认继续，下一轮可以继续执行，但要避免重复发送同一确认问题。'
    });
  }

  const highestRisk = hasCommandTool ? 'medium' : 'low';
  const stopAt = String(policy.maxRiskBeforeStop || 'critical').toLowerCase();
  if (RISK_ORDER[highestRisk] >= (RISK_ORDER[stopAt] ?? RISK_ORDER.critical)) {
    return decide({
      decision: 'stop',
      stopReason: 'high_risk_action',
      shouldContinue: false,
      summary: `风险等级 ${highestRisk} 达到策略阈值 ${stopAt}，建议停止本轮。`,
      riskLevel: highestRisk,
      evidence,
      nextAction: 'stop_run'
    });
  }

  return decide({
    decision: 'continue',
    stopReason: 'completed',
    shouldContinue: true,
    needsUserDecision: false,
    summary: '当前上下文可继续，无需额外用户确认。',
    riskLevel: highestRisk,
    evidence,
    nextAction: 'continue_run',
    continueHint: hasCommandTool ? '如果下一轮继续执行命令，建议再次经过 context-judge。' : null
  });
}
