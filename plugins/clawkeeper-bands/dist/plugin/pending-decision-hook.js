"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPendingDecisionPromptHook = createPendingDecisionPromptHook;
const pending_decision_store_1 = require("./pending-decision-store");
const CONTINUE_RE = /\b(继续|是|好的|确认|继续做|ok|okay|yes|continue|go ahead)\b/i;
const STOP_RE = /\b(不要|停止|取消|算了|终止|stop|cancel|abort|don't|do not)\b/i;
function extractText(value) {
    if (typeof value === 'string') {
        return value;
    }
    if (!Array.isArray(value)) {
        return '';
    }
    return value
        .map((item) => (item && typeof item === 'object' && typeof item.text === 'string'
        ? String(item.text)
        : ''))
        .filter(Boolean)
        .join('\n');
}
function latestUserText(messages) {
    if (!Array.isArray(messages)) {
        return '';
    }
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        const message = messages[i];
        if (!message || typeof message !== 'object') {
            continue;
        }
        const role = message.role;
        if (role === 'user') {
            return extractText(message.content);
        }
    }
    return '';
}
function createPendingDecisionPromptHook() {
    return async (event, ctx) => {
        const pending = await (0, pending_decision_store_1.getPendingDecision)(ctx.sessionKey);
        if (!pending) {
            return undefined;
        }
        const latestUser = latestUserText(event.messages);
        if (CONTINUE_RE.test(latestUser)) {
            await (0, pending_decision_store_1.clearPendingDecision)(ctx.sessionKey);
            return {
                prependContext: [
                    '系统注记：上一轮安全判定要求用户确认。',
                    `用户问题：${pending.question}`,
                    '用户现在已明确确认继续，可以继续后续流程。',
                    pending.continueHint ? `继续提示：${pending.continueHint}` : '',
                ]
                    .filter(Boolean)
                    .join('\n'),
            };
        }
        if (STOP_RE.test(latestUser)) {
            await (0, pending_decision_store_1.clearPendingDecision)(ctx.sessionKey);
            return {
                prependContext: [
                    '系统注记：上一轮安全判定要求用户确认。',
                    `用户问题：${pending.question}`,
                    '用户现在明确拒绝继续执行高风险动作。',
                    '不要继续原操作，只需简短确认已停止并等待新的指令。',
                ].join('\n'),
            };
        }
        return {
            prependContext: [
                '系统注记：当前会话仍存在一个未完成的安全确认。',
                `待确认问题：${pending.question}`,
                '如果用户没有明确回答继续或停止，你可以先处理用户的新问题，但不要擅自继续上一轮高风险动作。',
                pending.continueHint ? `继续提示：${pending.continueHint}` : '',
            ]
                .filter(Boolean)
                .join('\n'),
        };
    };
}
//# sourceMappingURL=pending-decision-hook.js.map