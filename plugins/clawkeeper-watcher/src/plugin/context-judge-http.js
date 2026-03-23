import { judgeForwardedContext } from '../core/context-judge.js';

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
  if (!raw) {
    return {};
  }
  return JSON.parse(raw);
}

export function createContextJudgeHttpHandler({ logger, defaultPolicy = {}, mode = 'local' }) {
  return async function contextJudgeHttpHandler(req, res) {
    if (req.method !== 'POST') {
      writeJson(res, 405, { error: 'Method Not Allowed' });
      return true;
    }

    try {
      const body = await readJsonBody(req);
      const decision = judgeForwardedContext({
        ...body,
        mode,
        policy: {
          ...(defaultPolicy || {}),
          ...(body.policy && typeof body.policy === 'object' ? body.policy : {})
        }
      });
      logger.info(`[Clawkeeper-Watcher] context-judge decision=${decision.decision} stopReason=${decision.stopReason}`);
      writeJson(res, 200, decision);
    } catch (error) {
      logger.warn(`[Clawkeeper-Watcher] context-judge request failed: ${error.message}`);
      writeJson(res, 400, {
        version: 1,
        decision: 'stop',
        stopReason: 'missing_input',
        shouldContinue: false,
        needsUserDecision: false,
        userQuestion: null,
        summary: `context-judge 请求无效：${error.message}`,
        riskLevel: 'medium',
        evidence: [],
        nextAction: 'stop_run',
        continueHint: null
      });
    }

    return true;
  };
}
