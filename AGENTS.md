# AGENTS.md

本项目使用内嵌 AI 基线规范包。任何代码改动、结构判断、目录调整、模块/路由/API/store/样式/i18n/依赖处理前，先读取：

```text
ai-baseline-kit/AGENTS.md
```

涉及实现或改造时，必须按 `ai-baseline-kit/skills/baseline-structure-skill/SKILL.md` 先明确范围；完成后按 `ai-baseline-kit/skills/baseline-conformance-skill/SKILL.md` 回归。

除非用户明确要求维护基线包，否则不要修改 `ai-baseline-kit/`；业务开发按基线包中的 `baseline_root` / `project_root` 路径约定执行。

## 多包仓库约定

本仓库支持多个可独立植入的 AI 能力包：

- 当前兼容包保留在 `ai-baseline-kit/`，不要为迁移到多包目录而破坏其 `baseline_root` 约定。
- 后续新增包默认放在 `packages/<package-name>/`。
- 每个包必须拥有独立的 `README.md`、`plugin.json`、`INSTALL.md` 和明确主入口。
- 每个包的名称和版本必须登记在根目录 `package-registry.json` 中。
- 修改包目录后先运行 `node scripts/package-check.mjs` 和 `node ai-baseline-kit/scripts/capability-registry-contract-check.mjs`，再运行 `node ai-baseline-kit/scripts/baseline-check.mjs`。
- 包之间不得使用隐式相对路径耦合；跨包依赖必须在包元数据中显式声明。

## AI 前端模块装配系统

<!-- ai-baseline-kit:entrypoint:start -->
本项目已接入 **AI 前端模块装配系统**。任何代码改动、结构判断、目录调整、模块/路由/API/store/样式/i18n/依赖处理前，必须先读取：

```text
ai-baseline-kit/AGENTS.md
```

处理自然语言需求或产品文档时，必须使用 ai-baseline-kit 的统一装配入口完成需求分析、blocking question、Change Plan、白名单实现、测试与验证闭环；不要要求用户复述内部 Skill 或脚本步骤。

- 自动能力路由：先读取 `ai-baseline-kit/capabilities/index.json`，由 AI 内部调用 `ai-baseline-kit/scripts/capability-route.mjs`；路由器只解析命中的能力 manifest，AI 按 `load.stages` 顺序加载存在的文件，并兼容 `load.baselineFiles`；禁止要求用户选择 Skill。
- 开发前：按路由结果中的 `ai-baseline-kit/skills/baseline-structure-skill/SKILL.md` 明确范围。
- 开发后：按路由结果中的 `ai-baseline-kit/skills/baseline-conformance-skill/SKILL.md` 回归。
- 统一接入与更新：复制或覆盖 `ai-baseline-kit/` 后运行 `node ai-baseline-kit/scripts/ai-run.mjs activate --project-root .`；首次使用自动初始化，检测到已有 `.ai-frontend-assembler/` 状态时自动进入安全升级，保留项目地图和历史快照。
- 项目地图保护：已有 `.ai-frontend-assembler/project-scheme.yml` 时禁止通过 bootstrap 重写；只有用户明确要求重新扫描时才允许使用 `--refresh-project-scheme`。
- 完成声明：只有最终 Gate 通过并生成当前请求对应的有效交付回执后，才可以向用户声明“已完成”“全部通过”或“可以交付”。

除非用户明确要求维护基线包，否则不要修改 `ai-baseline-kit/`；业务开发按包内 `baseline_root` / `project_root` 路径约定执行。
<!-- ai-baseline-kit:entrypoint:end -->
