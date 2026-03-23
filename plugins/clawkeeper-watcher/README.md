# Clawkeeper-Watcher for OpenClaw

面向 OpenClaw 的核心安全控制插件，跟随 clawkeeper 双端架构运行。

## 双端模式

插件通过 `config.mode`（或 `CLAWKEEPER_MODE` 环境变量）自动感知运行模式，默认 `local`。

| 能力 | Remote | Local |
|---|---|---|
| Context Judge HTTP 端点 | yes | yes |
| 事件日志（tool/message/LLM） | yes（被动） | yes |
| 审计 / 加固 / 漂移检测 | - | yes |
| Skill 安装 | - | yes |
| CLI 只读命令（status/logs/scan-skill） | yes | yes |

## 安装

安装插件：

```sh
npx openclaw plugins install -l .
```

安装插件附带的 runtime skill（仅 local 模式）：

```sh
npx openclaw clawkeeper-watcher skill install
```

## 命令

### 双端通用（remote + local）

```sh
npx openclaw clawkeeper-watcher status                            # 当前安全分数
npx openclaw clawkeeper-watcher logs                              # 查看今天的事件日志
npx openclaw clawkeeper-watcher logs --date 2026-03-14            # 查看指定日期的日志
npx openclaw clawkeeper-watcher logs --type before_tool_call      # 按事件类型过滤
npx openclaw clawkeeper-watcher logs --tool bash                  # 按工具名过滤
npx openclaw clawkeeper-watcher logs --scan                       # 扫描日志中的安全风险
npx openclaw clawkeeper-watcher logs --scan --save-report         # 扫描并保存报告
npx openclaw clawkeeper-watcher logs --all                        # 列出所有日志文件
npx openclaw clawkeeper-watcher log-path                          # 显示今天日志文件路径
npx openclaw clawkeeper-watcher scan-skill <name-or-path>         # 扫描第三方 skill
```

### 仅 Local 模式

在 remote 模式下执行以下命令会被拒绝并提示切换到 local 端。

```sh
npx openclaw clawkeeper-watcher install                           # 安装 bundled skill
npx openclaw clawkeeper-watcher audit                             # 运行安全审计
npx openclaw clawkeeper-watcher audit --json                      # JSON 格式输出
npx openclaw clawkeeper-watcher audit --fix                       # 审计后自动修复
npx openclaw clawkeeper-watcher harden                            # 应用安全加固
npx openclaw clawkeeper-watcher monitor                           # 前台运行漂移监控
npx openclaw clawkeeper-watcher skill install                     # 安装 bundled runtime skill
npx openclaw clawkeeper-watcher rollback [backup]                 # 恢复备份
```

## Context Judge HTTP 端点

两个模式都会注册：

```
POST /plugins/clawkeeper-watcher/context-judge
```

接收结构化上下文，返回判定结果：`continue` / `stop` / `ask_user`。
响应中包含 `mode` 和 `localEnhanced` 字段以区分端侧。

## 控制面

- 网络暴露面
- 操作入口认证
- 文件系统边界
- 高风险执行审批
- 运行时规则加载状态
- 第三方 skill 风险模式
- 事件日志 -- 自动记录工具调用、消息收发、LLM 交互到 `workspace/log/`
- Context Judge -- 对外提供结构化上下文判定能力

## 输出约定

审计和扫描报告保持统一结构：

- `severity`
- `evidence`
- `autofix`
- `fix`
- `next`

可直接用于人工复核，也可被脚本消费。

## 示例

仓库自带演示 skill：

```sh
npm run smoke:scan
```

会扫描 `examples/unsafe-skill` 并输出最小结果。

## 开发

运行测试：

```sh
npm test
```

发布前确认：

- `npm test` 通过
- `npx openclaw clawkeeper-watcher audit` 可运行（local 模式）
- `npx openclaw clawkeeper-watcher scan-skill <path>` 可运行
- `skill/SKILL.md` 与插件命令保持一致

## 结构

```text
plugins/clawkeeper-watcher/
  src/
    core/           # 审计引擎、加固、漂移监控、context-judge 等核心逻辑
    plugin/          # SDK 注册、CLI 命令、HTTP handler
    reporters/       # 控制台和 JSON 报告格式化
    index.js
  skill/
    SKILL.md
    skill.json
    configs/
    scripts/
  openclaw.plugin.json
  package.json
```
