# AI Baseline Kit 安装与植入说明

- 包名：`ai-baseline-kit`
- 当前版本：`0.17.0`
- 文档策略：只维护当前版本的安装、接入和升级方式，不保留旧版本功能介绍。
- 运行环境：Node.js 20 或以上版本（推荐使用公司统一的当前 LTS 版本）
- 包元数据：[`plugin.json`](plugin.json)
- 主入口：[`AGENTS.md`](AGENTS.md)
- 详细说明：[`README.md`](README.md)
- 使用指南：[`docs/使用指南.md`](docs/使用指南.md)
- 系统说明书：[`docs/system-specification.md`](docs/system-specification.md)
- Skill 独立使用：[`docs/skill-standalone-guide.md`](docs/skill-standalone-guide.md)

## 当前样式与能力路由说明

- 标准 React/Vue Vite 模板默认使用 CSS Modules，文件按 owner 命名，构建类名使用 `m_[name]_[local]__[hash:base64:6]`。 新页面默认按 `semantic-module-page-feature` 生成 `<module-id>-<page-id>.module.css`，类名包含模块、页面、功能和角色语义，并经过唯一性校验。
- 装配系统同时支持 `vue-scoped`、`utility-css`、`css-in-js`、`shadow-dom`、`hybrid` 和项目内 `.cjs` custom adapter。
- 项目通过 `.ai-frontend-assembler/project-scheme.yml` 的 `style_isolation.strategy` / `adapter` 声明真实隔离方式。
- 模块导出和导入会验证样式策略、预处理器、外部样式依赖与 custom adapter 指纹。
- 能力发现使用轻量 `capabilities/index.json` 和独立 `capabilities/manifests/*.json`；AI 自动完成能力路由和分阶段加载，使用者不需要选择 Skill。

## 推荐的日常入口

安装后，普通使用者只需要自然语言，不需要理解底层 Skill、Schema 或模块 CLI：

```text
请接入并使用项目根目录 ai-baseline-kit 的 AI 前端模块装配系统处理本次需求：接入并检查当前项目。
帮我实现：<需求>
按这个产品文档开发：<路径>
把项目 A 的 <模块> 和项目 B 的 <模块> 组合成项目 C。
检查并修复当前项目。
```

AI 会自动选择 `smart-develop`、`smart-compose`、`validate`、`gate` 或升级流程。以下命令只用于 AI、CI 或排障人员直接调用：

```bash
# 旧项目增量模式
node ai-baseline-kit/scripts/smart-develop.mjs --document <product-doc> --project-root <project-root>

# 新项目创建模式；目标必须是空目录或不存在目录
node ai-baseline-kit/scripts/smart-develop.mjs --request "<需求>" --target <new-project> --create --stack vue3-vite-ts
```

说明：

- 不带 `--create` 时始终按旧项目增量模式处理；目标缺少 `package.json` 会阻断并请求确认，不会悄悄创建项目。
- 默认自动修复 2 次，可通过 `--max-repair-attempts 0..3` 调整，硬上限为 3。
- 图片、扫描 PDF、在线 Figma 等需要外部提取器：`--extractor <node-script>` 或环境变量 `AI_BASELINE_DOCUMENT_EXTRACTOR`。
- 自动修复只能修改 Change Plan 白名单内文件，验证失败、越界或耗尽次数会自动回滚。

## 适用方式

这是一个**完整目录植入包**，不是需要安装到目标项目依赖树中的运行时库。植入时必须保留 `ai-baseline-kit/` 目录结构，不要把其中的 `docs/`、`skills/`、`scripts/` 拆散到目标项目根目录。

## 最小植入：只复制一个目录

将本包的整个目录复制到目标项目根目录即可：

```text
<target-project>/
└── ai-baseline-kit/
```

复制后，在目标项目根目录对 AI 说：

```text
请接入并使用项目根目录 ai-baseline-kit 的 AI 前端模块装配系统处理本次需求：接入并检查当前项目。
```

这条首次接入 Prompt 不依赖项目原先存在 `AGENTS.md` / `CLAUDE.md`。AI 会先读取 `ai-baseline-kit/AGENTS.md`，缺少根入口时创建，已有但未指向本包时保留原内容并追加，重复执行保持幂等。

`ai-baseline-kit/` 内已经包含规则、skills、项目地图模板、默认新项目模板、入口文档、包元数据和无第三方依赖的检查脚本，不依赖本仓库的 Git 历史或根目录文件。

## 自动接入 AI 工具的根级强入口

部分 AI 工具只会自动读取目标项目根目录的 `AGENTS.md` 或 `CLAUDE.md`。为了让这些工具无需额外提示就发现本包，可在目标项目根目录创建或追加入口约束：

```text
本项目使用内嵌 AI 基线规范包。任何代码改动前，先读取：
ai-baseline-kit/AGENTS.md
```

运行 `ai-run.mjs activate` / `project-bootstrap.mjs` 后会自动完成此步骤：目标项目已有 `AGENTS.md` 或 `CLAUDE.md` 时只追加受控段落，不覆盖原内容；缺失时自动创建；再次运行不会重复追加。根级入口是 AI 自动发现和强制执行基线的必要激活层。

### 首次接入自动隔离构建产物

同一次 `activate/init` 还会自动完成构建隔离，新项目和旧项目行为一致：

1. 保留 `ai-baseline-kit/` 和 `.ai-frontend-assembler/` 的 Git 可见性，不修改 `.gitignore`；
2. 使用目录内 `.npmignore` 阻止二者进入 `npm pack`；
3. 创建或增强 `.dockerignore`、`.vercelignore`，并增强已存在的 `.npmignore`、`.gcloudignore`、`.cfignore`；
4. 如果 `package.json` 存在 `scripts.build`，幂等接入 `scripts.postbuild` 产物守卫；
5. 构建后只清理输出目录内误复制的 `ai-baseline-kit/` 与 `.ai-frontend-assembler/`，不会删除项目根源码。

自定义输出目录无法从构建配置中识别时，可执行：

```bash
node ai-baseline-kit/scripts/build-artifact-guard.mjs --clean --output release-web
node ai-baseline-kit/scripts/build-artifact-guard.mjs --check --output release-web
```

## 新项目植入

1. 复制 `ai-baseline-kit/` 到目标项目根目录。
2. 如果项目是前端项目且未指定技术栈，AI 使用 `templates/react18-antd-tailwind-ts/` 作为默认起点。
3. 如果用户明确选择 Vue 3 + Vite，AI 使用默认集成 Element Plus 的 `templates/vue3-vite-ts/`。
4. 如果用户已经指定其他技术栈，用户选择优先；本包不自动生成第三方标准模板。
5. 首次接入前运行诊断并生成或审核 `.ai-frontend-assembler/project-scheme.yml`。
6. 先读取结构规划 skill，再开始实现。
7. 开发后运行基线一致性回归。

## 项目工具命令

在目标项目根目录执行：

```bash
# 诊断技术栈和项目边界
node ai-baseline-kit/scripts/project-doctor.mjs

# 生成/更新项目地图
node ai-baseline-kit/scripts/project-bootstrap.mjs

# 仅在空目录初始化标准模板（二选一）
node ai-baseline-kit/scripts/project-bootstrap.mjs --init-template --stack react18-antd-tailwind-ts
node ai-baseline-kit/scripts/project-bootstrap.mjs --init-template --stack vue3-vite-ts

# 统一验证：严格基线 + 自动执行项目已声明的 typecheck/lint/test/build
node ai-baseline-kit/scripts/project-validate.mjs

# 仅检查基线边界
node ai-baseline-kit/scripts/project-validate.mjs --baseline-only
```

内置标准模板只有 React 18 + Vite 与 Vue 3 + Vite + Element Plus 两个。检测到旧项目后，bootstrap 只生成项目地图，不会复制模板；旧项目的 Vue、React、Angular 等技术栈都原样保留。

## 已有项目植入

1. 复制 `ai-baseline-kit/` 到目标项目根目录。
2. AI 扫描 package manifest、lockfile、源码入口、构建配置、路由、状态、i18n 和模块目录。
3. 保留 Vue、React、Angular 或其他旧技术栈，不自动迁移到默认 React 模板。
4. 生成或审核 `.ai-frontend-assembler/project-scheme.yml`，记录真实结构和边界。
5. 只按旧项目现有架构和本包规则开发增量需求。
6. 回归检查：

```bash
node ai-baseline-kit/scripts/project-validate.mjs
```

## 目录约定

植入后：

- `baseline_root`：`ai-baseline-kit/`
- `project_root`：`ai-baseline-kit/` 的父目录，也就是目标项目根目录
- 规则、skill、模板和检查脚本：位于 `baseline_root`
- 目标项目专属地图、旧项目快照和状态清单：位于 `project_root/.ai-frontend-assembler/`
- 业务代码、依赖、路由、模块和资源：位于 `project_root`

## 升级

当前版本要求目标项目专属状态与能力包目录彻底分离：

```text
<target-project>/
├── ai-baseline-kit/                  # 可直接整目录替换
├── .ai-frontend-assembler/           # 项目专属状态，升级时保留
│   ├── project-scheme.yml
│   ├── legacy-baseline.json
│   └── state.json
├── AGENTS.md
└── CLAUDE.md
```

已接入当前版本后，后续升级只需：

1. 将最新 `ai-baseline-kit/` 复制到旧项目并直接覆盖/替换整个同名目录。
2. 不删除 `.ai-frontend-assembler/`，不需要手工备份或恢复项目地图。
3. 告诉 AI：“我已经复制覆盖了 ai-baseline-kit，请按当前装配包自动完成项目更新和自检，保留项目地图、历史状态和业务代码。”

AI 统一执行 `ai-run activate` 并完成后续严格 Gate；普通用户不需要执行任何命令。生产 CI 仍应安装 TypeScript/Vue AST 解析依赖并执行严格门禁。

如果历史项目仍把专属的 `project-scheme.yml` 或 `legacy-baseline.json` 保存在 `ai-baseline-kit/docs/`，应在这些文件仍存在时覆盖当前包并运行 `ai-run activate`，系统会一次性迁移到 `.ai-frontend-assembler/`。如果迁移前已经删除唯一的项目专属状态，则无法自动恢复，应先从版本库找回文件。

多 AI 自动发现暂时只维护目标项目根目录的 `AGENTS.md` 与 `CLAUDE.md`；不会创建 Cursor、Copilot 或其他工具专属入口。

## 卸载

删除目标项目根目录的 `ai-baseline-kit/`。如需彻底移除系统，再删除 `.ai-frontend-assembler/`；仅升级时不得删除该目录。如果曾经在根级 `AGENTS.md` 或 `CLAUDE.md` 中追加入口约束，也一并移除专门为本包添加的段落，但不要删除原有内容。

## 版本规则

包版本遵循语义化版本号：

- `MAJOR`：植入协议、入口或目录契约不兼容。
- `MINOR`：向后兼容地新增 skill、规则或检查能力。
- `PATCH`：向后兼容地修复文档、规则或脚本问题。
- README、安装说明、使用指南和系统说明书只维护当前版本，不允许重新加入历史版本介绍。
- 仅在本仓库 `ai-plugin` 根目录维护整个包仓库时，提交前才使用 `node scripts/package-check.mjs`。把 `ai-baseline-kit/` 单独嵌入业务项目后，目标项目通常没有该根脚本；此时应使用 `node ai-baseline-kit/scripts/project-tools-check.mjs`、`node ai-baseline-kit/scripts/baseline-contract-check.mjs` 和 `node ai-baseline-kit/scripts/baseline-check.mjs --fail-on-warn` 验证包自身或项目。
- 嵌入项目还需要让宿主 ESLint 忽略 `ai-baseline-kit/**` 和 `.ai-frontend-assembler/**`；请修改宿主自己的 flat config、旧版 `.eslintignore`，或将 lint 范围限制为 `src`。`.gitignore` 不会控制 ESLint 扫描，本包也不会自动改写宿主工具配置。

## 接入后的需求生产闭环

AI 必须依次读取和执行：

1. `skills/requirement-to-feature-spec/SKILL.md`：理解自然语言或产品文档，生成 Feature Spec；有关键未知项时向用户提问。
2. `skills/feature-architecture-planner/SKILL.md`：决定创建/扩展模块或共享能力，限定文件白名单。
3. `scripts/feature-generate.mjs` 或 AI 按计划实现。
4. `skills/baseline-conformance-skill/SKILL.md` 与 `scripts/project-validate.mjs`：完成检查闭环。

旧项目首次 bootstrap 默认创建历史违规快照，日常验证使用增量模式：

```bash
node ai-baseline-kit/scripts/baseline-check.mjs --mode changed --fail-on-warn
```

标准新项目使用全量基线检查模式。全局主题入口登记在 `project-scheme.yml.entrypoints.theme`；React/Vue 模板默认是 `src/theme/theme.css`；Vue 模板通过组件解析器按需导入 Element Plus，并默认不覆盖其原生颜色变量。

基线包维护者可运行以下真实构建回归；脚本会在系统临时目录中初始化模板、生成示例模块、安装依赖并执行 typecheck/build：

```bash
node ai-baseline-kit/scripts/template-build-check.mjs
```

## 技术栈选择

植入包后，AI 会根据目标项目状态选择开发模式：

- **旧项目**：检测到 `package.json`、lockfile、源码、构建配置、路由或应用入口时，保留旧项目真实技术栈。Vue、React、Angular 等都可以接入，不自动迁移。
- **新前端项目**：没有既有应用技术栈且用户没有指定其他方案时，使用 `templates/react18-antd-tailwind-ts/` 作为默认起点。
- **Vue 新项目**：用户明确选择 Vue 3 + Vite 时，使用默认集成 Element Plus 的 `templates/vue3-vite-ts/`。
- **用户指定优先**：用户在初始化前指定其他技术栈时，按用户选择创建项目，并继续使用本包的边界、模块、装配和回归规则。

默认策略文件：

```text
ai-baseline-kit/docs/stack-profiles.yml
```

标准模板说明：

```text
ai-baseline-kit/templates/react18-antd-tailwind-ts/README.md
ai-baseline-kit/templates/vue3-vite-ts/README.md
```

模板只在新项目初始化时作为可运行参考，不应套用于已有项目。


## 模块迁移和组合

模块跨项目复用必须先导出 bundle，再在目标项目执行兼容性检查；禁止直接复制模块目录后绕过 shared、主题、依赖、路由和装配契约。

```bash
node ai-baseline-kit/scripts/module-export.mjs --project-root <project-a> --module <module> --output <bundle-dir>
node ai-baseline-kit/scripts/module-compatibility-check.mjs --project-root <project-b> --bundle <bundle-dir>
node ai-baseline-kit/scripts/module-import.mjs --project-root <project-b> --bundle <bundle-dir>
node ai-baseline-kit/scripts/project-compose.mjs --project-root <new-project> --stack vue3-vite-ts --bundles <bundle-a>,<bundle-b>
```

目标项目安装依赖后，使用以下命令强制 AST 解析器可用并复核导入边界：

```bash
node ai-baseline-kit/scripts/ast-boundary-check.mjs --project-root <project-root> --require-parser
```

## 自然语言跨项目组合

安装后可执行：

```bash
node ai-baseline-kit/scripts/project-compose-from-requirement.mjs --request <需求文档> --sources "a=<项目A>;b=<项目B>" --target <项目C> --stack vue3-vite-ts
node ai-baseline-kit/scripts/project-compose-from-requirement.mjs --request <需求文档> --sources "a=<项目A>;b=<项目B>" --target <项目C> --stack vue3-vite-ts --apply
```

首次命令默认只输出计划和必须确认问题；`--apply` 才修改目标项目。失败默认事务回滚。真实浏览器验收需项目声明 `test:e2e`，并显式传入 `--with-e2e`；浏览器安装也必须显式传入 `--install-playwright`。

## 零配置智能入口

安装后，普通使用者只需让 AI 执行：

```bash
node ai-baseline-kit/scripts/smart-compose.mjs --request "<自然语言或产品文档路径>" --workspace-root "<工作区>"
```

默认自动执行可证明安全的 L0/L1/L2 决策；L3 必须确认项一次性返回。跨项目写入通过事务、实际 diff 白名单和验证门禁，失败自动回滚。
