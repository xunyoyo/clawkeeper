"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPendingDecision = getPendingDecision;
exports.setPendingDecision = setPendingDecision;
exports.clearPendingDecision = clearPendingDecision;
const promises_1 = require("fs/promises");
const path_1 = __importDefault(require("path"));
const Logger_1 = require("../core/Logger");
const PENDING_DECISIONS_PATH = path_1.default.join(Logger_1.CLAWKEEPER_BANDS_DATA_DIR, "pending-decisions.json");
async function loadPendingDecisionMap() {
    try {
        const raw = await (0, promises_1.readFile)(PENDING_DECISIONS_PATH, "utf8");
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    }
    catch {
        return {};
    }
}
async function savePendingDecisionMap(map) {
    await (0, promises_1.writeFile)(PENDING_DECISIONS_PATH, JSON.stringify(map, null, 2), "utf8");
}
async function getPendingDecision(sessionKey) {
    if (!sessionKey) {
        return null;
    }
    const map = await loadPendingDecisionMap();
    return map[sessionKey] ?? map[sessionKey.toLowerCase()] ?? null;
}
async function setPendingDecision(sessionKey, decision) {
    if (!sessionKey) {
        return;
    }
    const map = await loadPendingDecisionMap();
    map[sessionKey] = decision;
    if (sessionKey.toLowerCase() !== sessionKey) {
        map[sessionKey.toLowerCase()] = decision;
    }
    await savePendingDecisionMap(map);
}
async function clearPendingDecision(sessionKey) {
    if (!sessionKey) {
        return;
    }
    const map = await loadPendingDecisionMap();
    delete map[sessionKey];
    delete map[sessionKey.toLowerCase()];
    await savePendingDecisionMap(map);
}
//# sourceMappingURL=pending-decision-store.js.map