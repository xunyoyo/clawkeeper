# Clawkeeper-Watcher for OpenClaw

面向 OpenClaw 的最小安全控制插件。

职责：

- 审计当前运行边界
- 应用可确定的安全修正
- 为 agent 注入一段最小行为约束
- 提供 `context-judge` HTTP 判定接口

## 适用场景

- 先看当前 OpenClaw 配置有没有明显边界问题
- 对安全且确定的项执行一次标准化修正
- 在安装第三方 skill 前做供应链扫描
- 持续监视 `openclaw.json` 和 `AGENTS.md` 是否漂移

## 快速开始

完整安装：

```sh
bash install.sh
```

安装后建议顺序：

```sh
npx openclaw clawkeeper-watcher audit
npx openclaw clawkeeper-watcher harden
npx openclaw clawkeeper-watcher scan-skill ~/.openclaw/skills/some-skill
```

## 安装

只安装插件：

```sh
npx openclaw plugins install -l .
```

插件和 skill 一起安装：

```sh
npx openclaw clawkeeper-watcher skill install
```

一键安装：

```sh
bash install.sh
```

如果你把它装在 `OpenClaw B` 上，它还会提供一个 HTTP 路由：

```sh
POST /plugins/clawkeeper-watcher/context-judge
```

这个路由接收 `A` 转发过来的结构化上下文，并返回：

- `continue`
- `stop`
- `ask_user`

## 命令

```sh
npx openclaw clawkeeper-watcher install
npx openclaw clawkeeper-watcher audit
npx openclaw clawkeeper-watcher audit --json
npx openclaw clawkeeper-watcher audit --fix
npx openclaw clawkeeper-watcher harden
npx openclaw clawkeeper-watcher monitor
npx openclaw clawkeeper-watcher rollback
npx openclaw clawkeeper-watcher status
npx openclaw clawkeeper-watcher skill install
npx openclaw clawkeeper-watcher scan-skill <name-or-path>
npx openclaw clawkeeper-watcher tool-logs                    # 查看今天的工具调用日志
npx openclaw clawkeeper-watcher tool-logs --date 2026-03-14 # 查看指定日期的日志
npx openclaw clawkeeper-watcher tool-logs --tool bash        # 过滤特定工具
npx openclaw clawkeeper-watcher tool-logs --all              # 列出所有日志文件
npx openclaw clawkeeper-watcher log-path                     # 显示今天日志文件的完整路径
```

## 控制面

- 网络暴露面
- 操作入口认证
- 文件系统边界
- 高风险执行审批
- 运行时规则加载状态
- 第三方 skill 风险模式
- **工具调用日志** — 自动记录所有工具调用到 `workspace/log/`
- **Context Judge** — 对外提供结构化上下文判定能力

## 输出约定

审计和扫描报告都尽量保持同一结构：

- `severity`
- `evidence`
- `autofix`
- `fix`
- `next`

这样可以直接用于人工复核，也可以被脚本消费。

## 示例

仓库自带一个演示 skill：

```sh
npm run smoke:scan
```

它会扫描 [examples/unsafe-skill](/Users/xunyoyo/Desktop/PICT/clawkeeper/packages/clawkeeper/examples/unsafe-skill) 并输出一个最小结果。

## 开发

运行测试：

```sh
npm test
```

发布前至少确认：

- `npm test` 通过
- `npx openclaw clawkeeper-watcher audit` 可运行
- `npx openclaw clawkeeper-watcher scan-skill <path>` 可运行
- `skill/SKILL.md` 与插件命令保持一致

## 结构

```text
packages/clawkeeper-watcher/
  examples/
  src/
    core/
    plugin/
    reporters/
    index.js
  skill/
    SKILL.md
    skill.json
    configs/
    scripts/
  CHANGELOG.md
  LICENSE
  openclaw.plugin.json
```
