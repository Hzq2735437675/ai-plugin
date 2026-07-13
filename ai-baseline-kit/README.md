# AI Baseline Kit

- 包名：`ai-baseline-kit`
- 当前版本：`0.1.0`
- 包元数据：[`plugin.json`](plugin.json)
- 安装/植入说明：[`INSTALL.md`](INSTALL.md)
- AI 主入口：[`AGENTS.md`](AGENTS.md)

这是一套可以整体植入任意项目根目录的 AI 开发基线包。推荐用法是：不要把包内 `docs/`、`skills/`、`scripts/` 抽散到项目根目录，而是直接保留整个 `ai-baseline-kit/` 文件夹。

## 能力概览

- 通过 `AGENTS.md` 建立 AI 开发强入口。
- 通过 `project-scheme-bootstrap` 扫描并维护目标项目地图。
- 通过 `baseline-structure-skill` 在开发前明确结构边界。
- 通过 `baseline-conformance-skill` 在开发后执行基线回归。
- 通过 `project-i18n-localizer` 处理项目级国际化配置和文案归属。
- 通过 `baseline-check.mjs` 执行无第三方依赖的硬检查。

## 植入方式

完整的新项目接入、已有项目接入、升级、卸载和验证步骤见 [`INSTALL.md`](INSTALL.md)。核心分发目录是：

```text
<target-project>/
├── ai-baseline-kit/
├── AGENTS.md
└── CLAUDE.md
```

复制后直接和 AI 说需求即可；根入口会要求 AI 读取：

```text
ai-baseline-kit/AGENTS.md
```

如果目标项目已有 `AGENTS.md` 或 `CLAUDE.md`，不要覆盖原文件，应在保留原内容的前提下追加 ai-baseline 强约束段落。

## 路径约定

- `baseline_root`: `ai-baseline-kit/`
- `project_root`: `ai-baseline-kit/` 的父目录，也就是业务项目根目录
- 规范文件、skills、模板、脚本都在 `baseline_root`
- 业务代码、依赖、路由、模块、资源都在 `project_root`
- `project-scheme.yml` 默认生成在 `baseline_root/docs/project-scheme.yml`

## 文件职责

- `AGENTS.md`: AI 工作入口和硬约束。
- `docs/baseline-rules.yml`: 通用基线规则，包含分层、模块契约、装配、命名、样式、i18n、迁移和回归规则。
- `docs/engineering-workflow.yml`: 不同任务的执行流程，例如新功能、旧页模块化、模块迁移和回归闭环。
- `docs/project-scheme.yml`: 目标项目地图，记录当前项目真实技术栈、目录、入口、模块和迁移边界。
- `docs/project-scheme.template.yml`: 项目地图模板。
- `docs/project-scheme.schema.yml`: `project-scheme.yml` 的结构约束。
- `docs/module-manifest.template.yml`: 新模块 manifest 模板。
- `docs/module-manifest.schema.yml`: `module manifest` 的结构约束。
- `scripts/baseline-check.mjs`: 无第三方依赖的基线硬检查脚本，可给 AI、本地开发或 CI 使用。
- `skills/project-scheme-bootstrap/SKILL.md`: 自动扫描新项目或旧项目并生成 `docs/project-scheme.yml`。
- `skills/baseline-structure-skill/SKILL.md`: 开发前结构化需求。
- `skills/baseline-conformance-skill/SKILL.md`: 开发后基线符合性回归。
- `skills/project-i18n-localizer/SKILL.md`: 项目级国际化识别、配置、文案抽取、翻译和覆盖验证。

## 启动方式

第一次开发前让 AI 执行：

```text
读取 ai-baseline-kit/AGENTS.md。
如果 ai-baseline-kit/docs/project-scheme.yml 不存在，先运行 ai-baseline-kit/skills/project-scheme-bootstrap/SKILL.md。
```

无法可靠判断的字段会写成 `unknown`，并在 `required_questions` 中列出最少确认问题。

## 使用顺序

1. 读取 `ai-baseline-kit/AGENTS.md`。
2. 读取 `ai-baseline-kit/docs/baseline-rules.yml` 和 `ai-baseline-kit/docs/engineering-workflow.yml`。
3. 如果不存在 `ai-baseline-kit/docs/project-scheme.yml`，先使用 `ai-baseline-kit/skills/project-scheme-bootstrap/SKILL.md` 生成。
4. 读取或生成 `ai-baseline-kit/docs/project-scheme.yml`。
5. 开发前使用 `ai-baseline-kit/skills/baseline-structure-skill/SKILL.md` 明确范围。
6. 只在规划范围内改业务代码。
7. 开发后使用 `ai-baseline-kit/skills/baseline-conformance-skill/SKILL.md` 回归。
8. 涉及用户可见文案或 i18n 时，使用 `ai-baseline-kit/skills/project-i18n-localizer/SKILL.md`。
9. 不自动向 `.gitignore` 追加 `ai-baseline-kit/`，让规范包变化保持 Git 可见。
10. 可运行 `node ai-baseline-kit/scripts/baseline-check.mjs` 做硬检查。
