# AI Baseline Kit

这是一套可以整体植入任意项目根目录的 AI 开发基线包。推荐用法是：不要把包内 `docs/`、`skills/`、`scripts/` 抽散到项目根目录，而是直接保留整个 `ai-baseline-kit/` 文件夹。

## 植入方式

推荐优先让 AI 完成接入操作；能让 AI 追加和检查的，不要求人手动跑脚本。

标准分发目录是 `ai-baseline-kit/`：

```text
ai-baseline-kit/
  ai-baseline-kit/
  AGENTS.md
  CLAUDE.md
```

### 新项目

直接把分发目录里的三件套复制到项目根目录：

```text
target-project/
  ai-baseline-kit/
  AGENTS.md
  CLAUDE.md
  src/
  package.json
  ...
```

复制后直接和 AI 说需求即可；根入口会要求 AI 读取：

```text
ai-baseline-kit/AGENTS.md
```

### 旧项目无入口文件

如果旧项目没有 `AGENTS.md` 和 `CLAUDE.md`，也按新项目方式复制三件套：

```text
target-project/
  ai-baseline-kit/
  AGENTS.md
  CLAUDE.md
```

### 旧项目已有入口文件

不要覆盖旧项目已有的 `AGENTS.md` 或 `CLAUDE.md`。只复制 `ai-baseline-kit/`，然后对 AI 说：

```text
请读取 ai-baseline-kit/AGENTS.md，在不覆盖现有内容的前提下，为当前项目补齐或增强 AGENTS.md、CLAUDE.md，然后再开始需求。
```

AI 应保留原入口内容，只追加 ai-baseline 强约束段落。必要时可由 AI 运行：

也可以运行 `node ai-baseline-kit/scripts/baseline-check.mjs --fix-entrypoints` 自动处理项目根入口：没有 `AGENTS.md` 或 `CLAUDE.md` 时创建；已有但缺少强约束时追加受控段落，不覆盖原内容。

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
- `docs/module-manifest.schema.yml`: 模块 manifest 的结构约束。
- `scripts/baseline-check.mjs`: 无第三方依赖的基线硬检查脚本，可给 AI、本地开发或 CI 使用。
- `skills/project-scheme-bootstrap/SKILL.md`: 自动扫描新项目或旧项目并生成 `docs/project-scheme.yml`。
- `skills/baseline-structure-skill/SKILL.md`: 开发前结构化需求。
- `skills/baseline-conformance-skill/SKILL.md`: 开发后基线符合性回归。
- `skills/project-i18n-localizer/SKILL.md`: 国际化配置、文案抽取、翻译和覆盖验证。

## 启动方式

第一次开发前让 AI 执行：

```text
读取 ai-baseline-kit/AGENTS.md。
如果 ai-baseline-kit/docs/project-scheme.yml 不存在，先运行 ai-baseline-kit/skills/project-scheme-bootstrap/SKILL.md。
```

bootstrap 支持两类入口：

- 旧项目中途接入：从 `project_root` 的 `package.json`、构建配置、目录结构、路由、状态、i18n、API client、已有模块和 scripts 自动推断项目地图。
- 新项目从零开始：先从用户当前需求中提取技术栈、目标端、UI 库和业务类型；如果用户没有说明技术栈，不凭空选择框架，只问目标端、技术栈和 UI 库等最少关键问题。

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

## Git 可见性

默认允许 `ai-baseline-kit/` 的变化在 Git 中显示，便于审计、同步和提交规范包升级。

检查 `.gitignore` 是否隐藏规范包：

```bash
node ai-baseline-kit/scripts/baseline-check.mjs
```

如果脚本提示 `.gitignore` 已忽略 `ai-baseline-kit/`，需要显示规范包变化时，请由开发者显式移除该忽略规则。`--fix-gitignore` 已废弃，不会再自动追加忽略项。

## AI 入口修复

检查项目根 `AGENTS.md` 和 `CLAUDE.md` 是否包含 ai-baseline 强入口：

```bash
node ai-baseline-kit/scripts/baseline-check.mjs
```

自动创建或增强入口文件：

```bash
node ai-baseline-kit/scripts/baseline-check.mjs --fix-entrypoints
```

如果入口文件已存在，脚本只追加强约束段落，不覆盖原有内容。

## 硬检查

在目标项目根目录运行：

```bash
node ai-baseline-kit/scripts/baseline-check.mjs
```

在任意目录运行时，可以显式指定业务项目根目录：

```bash
node path/to/ai-baseline-kit/scripts/baseline-check.mjs --project-root path/to/target-project
```

如果希望 warning 也让命令失败：

```bash
node ai-baseline-kit/scripts/baseline-check.mjs --fail-on-warn
```

脚本会检查：

- 基线规范包入口文件是否存在。
- 项目根 `AGENTS.md` 和 `CLAUDE.md` 是否包含 ai-baseline 强入口约束。
- 目标项目 `.gitignore` 是否隐藏 `ai-baseline-kit/`。
- `ai-baseline-kit/docs/project-scheme.yml` 是否存在并包含关键字段。
- 模块根目录和模块 manifest 是否完整。
- manifest 是否包含依赖声明桶。
- 是否存在明显跨模块直接 import。
- 是否有可能未抽取的中文可见文案。

脚本不替代 `baseline-conformance-skill`，而是给 AI 回归和 CI 增加一层可执行检查。

## 维护方式

推荐把 `ai-baseline-kit/` 当成一个完整规范包维护和替换：

- 升级规则时替换整个 `ai-baseline-kit/`。
- 业务项目根目录保留薄 `AGENTS.md` 和 `CLAUDE.md` 入口，用来兼容不同 AI 工具。
- 不在业务项目根目录散落复制 `docs/`、`skills/`、`scripts/`，避免多份规则漂移。
- 保持规范包变化在 Git 中可见，便于审计升级内容。

这套规则可以跨项目复用。可通用的是工程原则和 AI 工作流；项目差异由 `project-scheme-bootstrap` 扫描生成到 `ai-baseline-kit/docs/project-scheme.yml`，人只需要确认 AI 无法可靠推断的少数字段。
