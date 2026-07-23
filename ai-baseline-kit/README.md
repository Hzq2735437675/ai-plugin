# AI 前端模块装配系统

- 产品展示名称：AI 前端模块装配系统
- 机器包名：`ai-baseline-kit`
- 当前版本：`0.6.0`
- 包元数据：[`plugin.json`](plugin.json)
- 安装/植入说明：[`INSTALL.md`](INSTALL.md)
- AI 主入口：[`AGENTS.md`](AGENTS.md)

这是一套可以整体植入任意项目根目录的、由 AI 编排并受工程契约约束的前端模块装配能力包。它将自然语言或产品文档转换为结构化规格，驱动 React/Vue 模块生成、验收测试、模块边界检查、跨项目迁移和构建期项目组合。

最小用法是：**只复制整个 `ai-baseline-kit/` 文件夹**，不需要复制本仓库其他目录，也不依赖本仓库的 Git 历史。为保持既有项目的安装路径和 `baseline_root` 兼容，产品展示名称变更后仍保留 `ai-baseline-kit` 作为机器包名和目录名。

> 一句话定位：让 AI 按契约生产、迁移和组合前端模块。

## 技术栈选择模式

本包不会把标准模板强加给所有项目，而是按项目状态选择模式：

### 旧项目模式

如果目标项目已经存在 `package.json`、lockfile、源码、构建配置、路由或其他应用入口，AI 先识别实际技术栈并保留它。无论项目使用 Vue、React、Angular 还是其他技术栈，都按旧项目的真实结构继续开发，不自动迁移框架或重构目录。

### 新项目模式

如果目标项目没有既有应用技术栈，且用户没有在初始化前指定其他方案，默认使用：

```text
React 18 + TypeScript + Vite + Ant Design 5 + Tailwind CSS 3 + React Router 6
```

默认技术栈策略见 [`docs/stack-profiles.yml`](docs/stack-profiles.yml)。内置标准新项目模板只有两个：

- [`templates/react18-antd-tailwind-ts/`](templates/react18-antd-tailwind-ts/)：未指定技术栈时的默认模板。
- [`templates/vue3-vite-ts/`](templates/vue3-vite-ts/)：用户明确选择 Vue 3 + Vite 时使用，默认集成 Element Plus。

用户在初始化前明确指定其他技术栈时，用户选择优先；本包不会为 Next、Nuxt、Angular 等额外提供内置模板，但仍可在旧项目中按真实技术栈接入和开发。

## 能力概览

- 通过 `AGENTS.md` 建立 AI 开发强入口。
- 通过 `project-scheme-bootstrap` 扫描并维护目标项目地图。
- 通过 `baseline-structure-skill` 在开发前明确结构边界。
- 通过 `baseline-conformance-skill` 在开发后执行基线回归。
- 通过 `project-i18n-localizer` 处理项目级国际化配置和文案归属。
- 通过 `baseline-check.mjs` 执行无第三方依赖的硬检查。
- 通过两个标准模板示范 shell、shared、modules、manifest 和静态路由/菜单装配。
- 通过 `project-doctor.mjs` 自动诊断旧项目技术栈和边界。
- 通过 `project-bootstrap.mjs` 生成目标项目地图，或在空目录初始化 React/Vue 标准模板。
- 通过 `project-validate.mjs` 统一执行基线检查、类型检查、lint、测试和构建。
- 通过 `requirement-to-feature-spec` 与 `requirement-compile.mjs` 建立自然语言/产品文档的确认式规格。
- 通过 `feature-architecture-planner`、`feature-plan.mjs` 和 `feature-generate.mjs` 生成受文件白名单约束的模块代码。
- 通过 `module.meta.json` 支持同技术栈模块的拆解、组合和迁移审计。
- 通过 `module-export`、`module-import`、`module-compatibility-check` 和 `project-compose` 实现模块包迁移与项目组合。
- 将 Feature Spec 的 acceptance 自动映射为 Vitest 契约/权限/页面状态/组件测试、API mock 和 Playwright E2E 骨架。
- 通过 `ast-boundary-check.mjs` 使用目标项目 TypeScript/Vue 编译器构建依赖图并检查真实导入边界。
- 通过 `baseline-check --mode changed` 对旧项目进行增量治理。
- 通过 `template-build-check.mjs` 在临时目录真实安装依赖，并验证 React/Vue 生成模块后的 typecheck 与 production build。

## 自然语言 / 产品文档到模块代码

标准闭环：

```text
用户自然语言或产品文档
  -> requirement-to-feature-spec
  -> docs/features/<id>.feature.json
  -> 必须确认 requiredQuestions
  -> feature-architecture-planner
  -> docs/plans/<id>.plan.json
  -> feature-generate / AI 按文件白名单实现
  -> baseline-check + typecheck + test + build
```

常用命令：

```bash
node ai-baseline-kit/scripts/requirement-compile.mjs --input docs/product/feature.md --allow-draft
node ai-baseline-kit/scripts/feature-plan.mjs --spec docs/features/<id>.feature.json
node ai-baseline-kit/scripts/feature-generate.mjs --spec docs/features/<id>.feature.json --plan docs/plans/<id>.plan.json
node ai-baseline-kit/scripts/module-create.mjs --name billing --title 计费管理 --route /billing
```

自然语言语义由大模型按 skill 理解；脚本负责结构、边界和安全写入。接口字段、权限码、状态机、模块归属或验收条件不确定时必须先向用户提问，不能让脚本或模型自行猜测。

每个可组合模块同时包含：

- `module.meta.json`：静态能力、依赖、入口、来源和迁移限制。
- `manifest.ts`：运行时路由、菜单、权限、文案、store 和指令装配。
- `acceptance.md`：由产品验收条件映射的模块验收清单。
- `tests/`：Feature Spec 自动生成的 Vitest、API mock 与 Playwright 验收测试文件。
- `index.ts`：模块唯一公开入口。

模块不得直接依赖其他模块；多个模块形成新项目时，只通过 shell 静态装配器组合。

## 模块迁移、组合与 AST 边界检查

```bash
# 从项目 A 导出同技术栈模块
node ai-baseline-kit/scripts/module-export.mjs --project-root <project-a> --module customer --output <bundle-dir>

# 在项目 B 先检查技术栈、shared、路由、依赖、主题和装配器契约
node ai-baseline-kit/scripts/module-compatibility-check.mjs --project-root <project-b> --bundle <bundle-dir>

# 兼容后增量导入，不覆盖既有同名模块
node ai-baseline-kit/scripts/module-import.mjs --project-root <project-b> --bundle <bundle-dir>

# 在空目录按标准技术栈组合多个模块包
node ai-baseline-kit/scripts/project-compose.mjs --project-root <new-project> --stack vue3-vite-ts --bundles <bundle-a>,<bundle-b>

# 安装目标项目依赖后执行 AST 级依赖图检查
node ai-baseline-kit/scripts/ast-boundary-check.mjs --project-root <project-root> --require-parser
```

迁移器默认只允许同技术栈、相同 `modules_root` / `shared_root` 的模块安全迁移；不会在缺少 AST import rewrite 的情况下猜测并重写任意相对路径。组合结果记录在 `docs/project-composition.json`，单模块导入回执记录在 `docs/module-imports/<module>.json`。

## UI 主题一致性

默认 React 模板保持 Ant Design 5 原生默认配色，并提供唯一全局变量入口 `src/theme/theme.css`。`src/theme/antd-theme.ts` 只是读取 CSS 变量的薄适配层。Vue 标准模板默认集成 Element Plus，通过 `unplugin-vue-components` 按需导入组件，保持 Element Plus 原生默认配色，并把 `src/theme/theme.css` 作为唯一项目级主题覆盖入口。用户或 AI 调整品牌视觉时只修改对应模板的全局主题文件，不在页面散落颜色、圆角和基础间距。旧项目继续保留已存在的 UI 框架和主题。

完整规则见 `docs/design-system.yml`。

## 旧项目增量模式

旧项目首次运行 bootstrap 时会创建 `ai-baseline-kit/docs/legacy-baseline.json`，记录接入前历史违规。之后默认：

```bash
node ai-baseline-kit/scripts/baseline-check.mjs --mode changed --fail-on-warn
```

`changed` 只阻断快照之后出现的新违规；`full` 仍可用于查看全量问题。重复 bootstrap 不会刷新快照，只有经过人工审查后才能显式使用 `--refresh-legacy-baseline`。

## 植入方式

### 最小方式：只复制包目录

```text
<target-project>/
└── ai-baseline-kit/
```

复制后先运行 `project-bootstrap.mjs`。它会生成或安全追加项目根 `AGENTS.md`、`CLAUDE.md` 强入口，并生成目标项目地图；已有根文件不会被覆盖。

### 路径约定

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
- `docs/feature-spec.schema.json`: 自然语言或产品文档确认后的功能规格契约。
- `docs/change-plan.schema.json`: 模块归属、装配点、依赖和文件白名单契约。
- `docs/module-meta.schema.json`: 可组合模块的静态身份、能力、依赖和迁移限制契约。
- `docs/design-system.yml`: Ant Design 默认视觉策略和唯一全局主题入口规则。
- `docs/legacy-baseline.schema.json`: 旧项目历史违规快照契约。
- `scripts/baseline-check.mjs`: 无第三方依赖的基线硬检查脚本，可给 AI、本地开发或 CI 使用。
- `scripts/project-doctor.mjs`: 诊断目标项目的框架、构建工具、路由、状态、i18n、样式、模块和验证脚本。
- `scripts/project-bootstrap.mjs`: 生成/更新项目地图和根级 AI 强入口；空目录可用 `--init-template --stack <profile>` 初始化标准模板。
- `scripts/project-validate.mjs`: 默认严格执行基线检查，并自动运行项目已声明的 `typecheck`、`lint`、`test`、`build`。
- `scripts/project-tools-check.mjs`: 无第三方依赖的项目诊断/地图工具自测。
- `scripts/baseline-contract-check.mjs`: 自然语言确认门禁、React/Vue 模块生成/扩展、元数据边界和旧项目增量治理的离线契约回归。
- `scripts/template-build-check.mjs`: 在系统临时目录创建真实 React/Vue 项目、生成示例模块、安装依赖并运行 typecheck/build。
- `skills/project-scheme-bootstrap/SKILL.md`: 自动扫描新项目或旧项目并生成 `docs/project-scheme.yml`。
- `skills/requirement-to-feature-spec/SKILL.md`: 将自然语言/产品文档转换为 Feature Spec，并对未知项提问。
- `skills/feature-architecture-planner/SKILL.md`: 选择创建/扩展模块或共享能力，并生成文件边界计划。
- `skills/baseline-structure-skill/SKILL.md`: 开发前结构化需求。
- `skills/baseline-conformance-skill/SKILL.md`: 开发后基线符合性回归。
- `skills/project-i18n-localizer/SKILL.md`: 项目级国际化识别、配置、文案抽取、翻译和覆盖验证。
- `templates/react18-antd-tailwind-ts/`: 新前端项目默认参考模板。
- `templates/vue3-vite-ts/`: 用户明确选择 Vue 3 + Vite 时的 Element Plus 参考模板。

## 项目工具

在包已复制到目标项目根目录后，从目标项目根目录执行：

```bash
# 诊断旧项目或确认新项目默认选择
node ai-baseline-kit/scripts/project-doctor.mjs
node ai-baseline-kit/scripts/project-doctor.mjs --json

# 生成/更新 ai-baseline-kit/docs/project-scheme.yml
node ai-baseline-kit/scripts/project-bootstrap.mjs

# 空目录初始化标准模板（二选一）
node ai-baseline-kit/scripts/project-bootstrap.mjs --init-template --stack react18-antd-tailwind-ts
node ai-baseline-kit/scripts/project-bootstrap.mjs --init-template --stack vue3-vite-ts

# 统一回归：严格基线 + 自动执行已声明的 typecheck/lint/test/build
node ai-baseline-kit/scripts/project-validate.mjs

# 只验证文件和模块边界，或按需跳过某一项
node ai-baseline-kit/scripts/project-validate.mjs --baseline-only
node ai-baseline-kit/scripts/project-validate.mjs --skip-test

# 基线包维护：真实验证两个模板在生成模块后的安装、类型检查和生产构建
node ai-baseline-kit/scripts/template-build-check.mjs
node ai-baseline-kit/scripts/template-build-check.mjs --profile react18-antd-tailwind-ts
```

`project-bootstrap.mjs` 会安全创建或追加根级 `AGENTS.md`、`CLAUDE.md`，并生成项目地图。检测到已有项目时不会自动复制模板；如需初始化模板，目标目录必须为空或显式使用 `--force`。旧项目应只生成项目地图并保留真实技术栈。

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
