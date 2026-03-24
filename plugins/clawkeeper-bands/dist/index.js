"use strict";
/**
 * Clawkeeper-Bands - Put safety bands on OpenClaw
 * Public API Exports
 */
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CMD_CONFIG = exports.DEFAULT_WS_CONFIG = exports.DEFAULT_POLICY = exports.isPluginRegistered = exports.unregisterPlugin = exports.registerPlugin = exports.saveOpenClawConfig = exports.loadOpenClawConfig = exports.isOpenClawInstalled = exports.CLAWKEEPER_BANDS_RESPOND_TOOL = exports.getProtectedModules = exports.getToolMapping = exports.createToolCallHook = exports.ClawkeeperBandsPlugin = exports.StatsTracker = exports.DecisionLog = exports.PolicyStore = exports.CLAWKEEPER_BANDS_DATA_DIR = exports.LOG_PATH = exports.logger = exports.approvalQueue = exports.Arbitrator = exports.Interceptor = void 0;
// Core Components
var Interceptor_1 = require("./core/Interceptor");
Object.defineProperty(exports, "Interceptor", { enumerable: true, get: function () { return Interceptor_1.Interceptor; } });
var Arbitrator_1 = require("./core/Arbitrator");
Object.defineProperty(exports, "Arbitrator", { enumerable: true, get: function () { return Arbitrator_1.Arbitrator; } });
var ApprovalQueue_1 = require("./core/ApprovalQueue");
Object.defineProperty(exports, "approvalQueue", { enumerable: true, get: function () { return ApprovalQueue_1.approvalQueue; } });
var Logger_1 = require("./core/Logger");
Object.defineProperty(exports, "logger", { enumerable: true, get: function () { return Logger_1.logger; } });
Object.defineProperty(exports, "LOG_PATH", { enumerable: true, get: function () { return Logger_1.LOG_PATH; } });
Object.defineProperty(exports, "CLAWKEEPER_BANDS_DATA_DIR", { enumerable: true, get: function () { return Logger_1.CLAWKEEPER_BANDS_DATA_DIR; } });
// Storage
var PolicyStore_1 = require("./storage/PolicyStore");
Object.defineProperty(exports, "PolicyStore", { enumerable: true, get: function () { return PolicyStore_1.PolicyStore; } });
var DecisionLog_1 = require("./storage/DecisionLog");
Object.defineProperty(exports, "DecisionLog", { enumerable: true, get: function () { return DecisionLog_1.DecisionLog; } });
var StatsTracker_1 = require("./storage/StatsTracker");
Object.defineProperty(exports, "StatsTracker", { enumerable: true, get: function () { return StatsTracker_1.StatsTracker; } });
// Plugin
var index_1 = require("./plugin/index");
Object.defineProperty(exports, "ClawkeeperBandsPlugin", { enumerable: true, get: function () { return __importDefault(index_1).default; } });
var tool_interceptor_1 = require("./plugin/tool-interceptor");
Object.defineProperty(exports, "createToolCallHook", { enumerable: true, get: function () { return tool_interceptor_1.createToolCallHook; } });
Object.defineProperty(exports, "getToolMapping", { enumerable: true, get: function () { return tool_interceptor_1.getToolMapping; } });
Object.defineProperty(exports, "getProtectedModules", { enumerable: true, get: function () { return tool_interceptor_1.getProtectedModules; } });
Object.defineProperty(exports, "CLAWKEEPER_BANDS_RESPOND_TOOL", { enumerable: true, get: function () { return tool_interceptor_1.CLAWKEEPER_BANDS_RESPOND_TOOL; } });
var config_manager_1 = require("./plugin/config-manager");
Object.defineProperty(exports, "isOpenClawInstalled", { enumerable: true, get: function () { return config_manager_1.isOpenClawInstalled; } });
Object.defineProperty(exports, "loadOpenClawConfig", { enumerable: true, get: function () { return config_manager_1.loadOpenClawConfig; } });
Object.defineProperty(exports, "saveOpenClawConfig", { enumerable: true, get: function () { return config_manager_1.saveOpenClawConfig; } });
Object.defineProperty(exports, "registerPlugin", { enumerable: true, get: function () { return config_manager_1.registerPlugin; } });
Object.defineProperty(exports, "unregisterPlugin", { enumerable: true, get: function () { return config_manager_1.unregisterPlugin; } });
Object.defineProperty(exports, "isPluginRegistered", { enumerable: true, get: function () { return config_manager_1.isPluginRegistered; } });
// Configuration
var config_1 = require("./config");
Object.defineProperty(exports, "DEFAULT_POLICY", { enumerable: true, get: function () { return config_1.DEFAULT_POLICY; } });
var config_2 = require("./config");
Object.defineProperty(exports, "DEFAULT_WS_CONFIG", { enumerable: true, get: function () { return config_2.DEFAULT_WS_CONFIG; } });
var config_3 = require("./config");
Object.defineProperty(exports, "DEFAULT_CMD_CONFIG", { enumerable: true, get: function () { return config_3.DEFAULT_CMD_CONFIG; } });
// Types
__exportStar(require("./types"), exports);
//# sourceMappingURL=index.js.map