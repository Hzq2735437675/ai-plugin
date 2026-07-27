# AI 前端模块装配系统

- 产品展示名称：AI 前端模块装配系统
- 机器包名：`ai-baseline-kit`
- 当前版本：`0.11.0`
- 包元数据：[`plugin.json`](plugin.json)
- 安装/植入说明：[`INSTALL.md`](INSTALL.md)
- AI 主入口：[`AGENTS.md`](AGENTS.md)
- 使用指南：[`docs/使用指南.md`](docs/使用指南.md)
- 系统说明书：[`docs/system-specification.md`](docs/system-specification.md)
- Skill 独立使用指南：[`docs/skill-standalone-guide.md`](docs/skill-standalone-guide.md)
- 系统说明图：[`PNG`](docs/assets/ai-frontend-module-assembler-overview.png) / [`SVG`](docs/assets/ai-frontend-module-assembler-overview.svg) / [`Mermaid`](docs/assets/ai-frontend-module-assembler-overview.mmd)

这是一套可以整体植入任意项目根目录的、由 AI 编排并受工程契约约束的前端模块装配能力包。它将自然语言或产品文档转换为结构化规格，驱动 React/Vue 模块生成、验收测试、模块边界检查、跨项目迁移和构建期项目组合。

最小用法是：**只复制整个 `ai-baseline-kit/` 文件夹**，不需要复制本仓库其他目录，也不依赖本仓库的 Git 历史。为保持既有项目的安装路径和 `baseline_root` 兼容，产品展示名称变更后仍保留 `ai-baseline-kit` 作为机器包名和目录名。

> 一句话定位：让 AI 按契约生产、迁移和组合前端模块。

## 一句话使用

首次接入：

```text
请接入并使用项目根目录 ai-baseline-kit 的 AI 前端模块装配系统处理本次需求：接入并检查当前项目。
```

日常开发或组合：

```text
帮我实现：<需求>
按这个产品文档开发：<路径>
把项目 A 的 <模块> 和项目 B 的 <模块> 组合成项目 C。
检查并修复当前项目。
```

用户不需要写固定长提示词，也不需要知道内部 Skill、Feature Spec、Change Plan、AST 或脚本命令。若根入口尚未接入，首次只需说“请接入并使用项目根目录 ai-baseline-kit 的 AI 前端模块装配系统处理本次需求：<需求>”；系统会创建或安全追加根 `AGENTS.md` / `CLAUDE.md`。之后 AI 从根入口自动展开完整流程，只在存在 blocking question 时一次性提问。

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
- 通过 `smart-develop.mjs` 统一接收自然语言、产品文档或 ready Feature Spec，并路由新建、增量修改、修复和跨项目组合。
- 通过 `document-normalize.mjs` 将多格式输入转换为可审计标准文档；无法可靠提取时生成 blocking question。
- 通过 `acceptance-coverage-check.mjs` 校验 acceptance、页面状态、权限和 API 到真实测试文件的映射。
- 通过 `project-scheme-bootstrap` 扫描并维护目标项目地图。
- 通过 `baseline-structure-skill` 在开发前明确结构边界。
- 通过 `baseline-conformance-skill` 在开发后执行基线回归。
- 通过 `project-i18n-localizer` 处理项目级国际化配置和文案归属。
- 通过 `baseline-check.mjs` 执行无第三方依赖的硬检查。
- 通过两个标准模板示范 shell、shared、modules、manifest 和静态路由/菜单装配。
- 通过 `project-doctor.mjs` 自动诊断旧项目技术栈和边界。
- 通过 `project-bootstrap.mjs` 生成目标项目地图，或在空目录初始化 React/Vue 标准模板。
- 通过 `project-validate.mjs` 统一执行基线检查、类型检查、lint、测试和构建。
- 通过 `delivery-gate.mjs` 拒绝占位实现并生成带变更文件哈希的交付回执；没有当前有效回执不得返回 `completed`。
- 通过 `requirement-to-feature-spec` 与 `requirement-compile.mjs` 建立自然语言/产品文档的确认式规格。
- 通过 `feature-architecture-planner`、`feature-plan.mjs` 和 `feature-generate.mjs` 生成受文件白名单约束的模块代码。
- 通过 `module.meta.json` 支持同技术栈模块的拆解、组合和迁移审计。
- 通过 `module-export`、`module-import`、`module-compatibility-check` 和 `project-compose` 实现模块包迁移与项目组合。
- 将 Feature Spec 的 acceptance 自动映射为 Vitest 契约/权限/页面状态/组件测试、API mock 和 Playwright E2E 骨架。
- 通过 `ast-boundary-check.mjs` 使用目标项目 TypeScript/Vue 编译器构建依赖图并检查真实导入边界。
- 通过 `baseline-check --mode changed` 对旧项目进行增量治理。
- 通过 `template-build-check.mjs` 在临时目录真实安装依赖，并验证 React/Vue 生成模块后的 typecheck 与 production build。

## 根入口自动接入与交付回执（0.11.0）

首次调用装配系统时会自动检查目标项目根目录：缺少 `AGENTS.md` / `CLAUDE.md` 就创建；已有文件但未接入本包时保留原文并追加带标记的受控段落；再次运行只更新该段落，不重复追加。这样后续支持这些入口的 AI 可以从项目根目录自动发现本系统。

最终交付由 `delivery-gate.mjs` 执行。它在原 CI Gate 前增加实现完整性检查，并在全部通过后生成 `.ai-frontend-assembler/deliveries/<request-id>.delivery.json`。回执记录 Feature Spec、Change Plan、变更文件及其 SHA-256；没有当前请求的有效回执，`smart-develop` 不得返回 `completed`，AI 也不得声明“已完成”或“全部通过”。

## 可替换升级与统一 AI 入口（0.10.0）

本版本把目标项目专属状态移出 `ai-baseline-kit/`，统一存放到项目根目录 `.ai-frontend-assembler/`。因此项目完成一次接入后，未来升级可以直接把最新 `ai-baseline-kit/` 整目录复制并替换旧目录，不再备份/恢复项目地图或历史快照。

```bash
# 首次接入
node ai-baseline-kit/scripts/ai-run.mjs activate

# 自然语言或产品文档开发
node ai-baseline-kit/scripts/ai-run.mjs develop --document <product-doc>

# 整目录替换包后升级，不重建项目地图、不刷新旧项目快照
node ai-baseline-kit/scripts/ai-run.mjs upgrade

# CI/交付硬门禁
node ai-baseline-kit/scripts/ai-run.mjs gate
```

统一入口支持 `init / activate / develop / compose / repair / validate / gate / doctor / upgrade`。目标项目自动发现入口只保留 `AGENTS.md` 与 `CLAUDE.md`，不会生成 Cursor、Copilot 等额外配置。`.ai-frontend-assembler/` 必须提交到版本库且升级时不得删除。

## 统一智能开发入口（0.9.0）

普通使用者只需要提供原话或文档，不需要手工串联底层命令：

```bash
# 旧项目增量开发
node ai-baseline-kit/scripts/smart-develop.mjs \
  --request "给订单模块增加审核列表、orders.review 权限和 GET /api/orders/review" \
  --project-root <existing-project>

# 上传/指定产品文档
node ai-baseline-kit/scripts/smart-develop.mjs \
  --document docs/product/order-review.docx \
  --project-root <existing-project>

# 创建新项目必须显式声明 --create，避免把错误路径当作新项目
node ai-baseline-kit/scripts/smart-develop.mjs \
  --request "创建订单审核项目" \
  --target <empty-target> \
  --create \
  --stack vue3-vite-ts
```

总控流程：

```text
多格式文档标准化
  -> 工作区发现与意图识别
  -> 跨项目组合委托 smart-compose，或编译 ready Feature Spec
  -> Change Plan 与文件白名单
  -> 将审计版 Feature Spec / Change Plan 固化到目标项目 docs/features 与 docs/changes
  -> 目标项目外事务快照
  -> 生成/增量修改
  -> acceptance coverage + baseline + typecheck + lint + test + build
  -> 失败时在同一白名单内有界修复
  -> 成功提交事务，或失败回滚
```

默认最多自动修复 2 次，任何调用都不能超过 3 次。修复不允许扩大原 Change Plan 的文件范围；每轮验证后都重新检查实际 diff。业务断言无法由需求可靠推导时保留 `todo/fixme`，不伪造已通过测试。

文档标准化内置支持文本、Markdown、RST、CSV、YAML、HTML、JSON、OpenAPI JSON、Figma JSON、DOCX 和基础文本型 PDF。图片、复杂扫描 PDF、在线 Figma 或其他二进制格式通过 `--extractor <node-script>` / `AI_BASELINE_DOCUMENT_EXTRACTOR` 接入；适配器缺失或提取为空时状态为 `needs-confirmation`。

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

## 零配置智能入口与硬约束执行

普通使用者只提供自然语言或产品文档：

```bash
node ai-baseline-kit/scripts/smart-compose.mjs --request "把项目 A 的客户管理和项目 B 的订单管理组合成项目 C" --workspace-root <workspace>
```

`smart-compose` 自动发现项目、解析来源/目标、聚合必须确认项并调用组合总控。所有写入必须经过 `frontend-change-plan` ready 门禁、实际 diff 白名单、禁止路径、验证门禁和事务回滚；不允许 Skill 或任意大模型绕过硬约束直接修改业务代码。

底层受控执行入口：

```bash
node ai-baseline-kit/scripts/controlled-change-executor.mjs --project-root <project> --plan <change-plan.json> --script <node-script> --validate-script <validation-script>
```

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

旧项目首次运行 bootstrap 时会创建 `.ai-frontend-assembler/legacy-baseline.json`，记录接入前历史违规。之后默认：

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

复制后首次让 AI 执行 `ai-run activate`（或使用使用指南中的默认安全入口 Prompt）。它会生成或安全追加项目根 `AGENTS.md`、`CLAUDE.md` 强入口，并生成目标项目地图；已有根文件不会被覆盖，重复执行不会重复追加。

### 路径约定

- `baseline_root`: `ai-baseline-kit/`
- `project_root`: `ai-baseline-kit/` 的父目录，也就是业务项目根目录
- 规范文件、skills、模板、脚本都在 `baseline_root`
- 业务代码、依赖、路由、模块、资源都在 `project_root`
- 目标项目地图生成在 `project_root/.ai-frontend-assembler/project-scheme.yml`；包内 `docs/project-scheme.yml` 仅是仓库参考地图

## 直接覆盖升级

已使用 `0.10.0+` 完成接入的项目，升级只需直接替换整个 `ai-baseline-kit/`，然后运行：

```bash
node ai-baseline-kit/scripts/ai-run.mjs upgrade
node ai-baseline-kit/scripts/ai-run.mjs validate
```

项目专属的 `.ai-frontend-assembler/`、根 `AGENTS.md`、根 `CLAUDE.md` 和业务代码都位于包目录外，不会因替换包目录丢失。`0.9.x` 及更早项目应在旧项目专属文件仍存在时执行一次迁移；详见 `INSTALL.md`。

## 文件职责

- `AGENTS.md`: AI 工作入口和硬约束。
- `docs/baseline-rules.yml`: 通用基线规则，包含分层、模块契约、装配、命名、样式、i18n、迁移和回归规则。
- `docs/engineering-workflow.yml`: 不同任务的执行流程，例如新功能、旧页模块化、模块迁移和回归闭环。
- `.ai-frontend-assembler/project-scheme.yml`: 目标项目地图，记录真实技术栈、目录、入口、模块和迁移边界。
- `.ai-frontend-assembler/legacy-baseline.json`: 旧项目接入前历史违规快照。
- `.ai-frontend-assembler/state.json`: 外置状态版本和可替换升级策略清单。
- `docs/project-scheme.yml`: 能力包仓库参考地图，不承载目标项目专属状态。
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
- `skills/project-scheme-bootstrap/SKILL.md`: 自动扫描新项目或旧项目并生成 `.ai-frontend-assembler/project-scheme.yml`。
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

# 生成/更新 .ai-frontend-assembler/project-scheme.yml
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
如果 .ai-frontend-assembler/project-scheme.yml 不存在，先运行 ai-baseline-kit/skills/project-scheme-bootstrap/SKILL.md。
```

无法可靠判断的字段会写成 `unknown`，并在 `required_questions` 中列出最少确认问题。

## 使用顺序

1. 读取 `ai-baseline-kit/AGENTS.md`。
2. 读取 `ai-baseline-kit/docs/baseline-rules.yml` 和 `ai-baseline-kit/docs/engineering-workflow.yml`。
3. 如果不存在 `.ai-frontend-assembler/project-scheme.yml`，先使用 `ai-baseline-kit/skills/project-scheme-bootstrap/SKILL.md` 生成。
4. 读取或生成 `.ai-frontend-assembler/project-scheme.yml`。
5. 开发前使用 `ai-baseline-kit/skills/baseline-structure-skill/SKILL.md` 明确范围。
6. 只在规划范围内改业务代码。
7. 开发后使用 `ai-baseline-kit/skills/baseline-conformance-skill/SKILL.md` 回归。
8. 涉及用户可见文案或 i18n 时，使用 `ai-baseline-kit/skills/project-i18n-localizer/SKILL.md`。
9. 不自动向 `.gitignore` 追加 `ai-baseline-kit/`，让规范包变化保持 Git 可见。
10. 可运行 `node ai-baseline-kit/scripts/baseline-check.mjs` 做硬检查。

## 零配置智能装配与硬约束内核（0.8.0）

- `smart-compose.mjs`：自然语言/产品文档零配置入口。
- `workspace-discover.mjs`：自动识别工作区项目、别名和同栈 profile。
- `controlled-change-executor.mjs`：Change Plan、状态机、实际 diff、验证和回滚硬门禁。
- `intelligent-frontend-assembler`：不增加 UI 的 AI 总控 Skill。
- 新增受控执行与智能装配契约测试。

## 自然语言模块装配总控（0.7.0）

```bash
# 默认仅规划，不改目标项目
node ai-baseline-kit/scripts/project-compose-from-requirement.mjs --request <需求.md或json> --sources "a=<项目A>;b=<项目B>" --target <项目C> --stack vue3-vite-ts
# 应用、验证，失败自动回滚
node ai-baseline-kit/scripts/project-compose-from-requirement.mjs --request <需求.md或json> --sources "a=<项目A>;b=<项目B>" --target <项目C> --stack vue3-vite-ts --apply
# 恢复或回滚
node ai-baseline-kit/scripts/project-compose-from-requirement.mjs --resume <workspace>
node ai-baseline-kit/scripts/project-compose-from-requirement.mjs --rollback <workspace>
```

总控按 `discover -> select/question -> export -> safe repair -> compatibility -> transaction -> compose -> validate -> commit/rollback` 执行。自动修复仅限模块身份、路由前缀和权限命名空间；shared 内容和 npm 主版本等语义冲突继续阻断并提问。运行记录使用 `docs/composition-run.schema.json`，请求契约使用 `docs/composition-request.schema.json`。
