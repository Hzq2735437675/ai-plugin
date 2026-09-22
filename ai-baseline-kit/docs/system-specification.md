# AI 前端模块装配系统：系统说明书

> 文档性质：公司级软件资产说明与技术规格
> 产品名称：AI 前端模块装配系统
> 机器包名：`ai-baseline-kit`
> 当前适用版本：`0.17.0`
> 文档日期：2026-08-11
> 文档策略：只描述当前版本的系统能力和契约，不保留以前版本的功能介绍。

## 当前核心能力与契约

### 样式策略适配器与可移植契约

样式治理的系统不变量是“模块局部样式不得产生不受控全局污染，且隔离机制必须可声明、可验证、可迁移”。项目地图声明 `strategy`、`adapter`、支持策略、局部 fallback、custom adapter 和全局入口；标准模板默认使用 `builtin-css-modules`。

`style-scope-lib.mjs` 提供内置 adapter registry，覆盖 CSS Modules、Vue scoped、utility CSS、CSS-in-JS、Shadow DOM 和 hybrid。custom 策略只允许加载项目根内显式登记的同步 `.cjs` adapter。模块 bundle 记录实际使用策略、预处理器、外部样式依赖和 custom adapter SHA-256 指纹；兼容性检查在复制模块前确认目标项目能力并补齐可确定的依赖。

标准 Vite 新项目使用 `semantic-module-page-feature` 的 owner 命名 CSS Modules：默认 owner 为 `<module-id>-<page-id>.module.scss`；旧项目新增页面在只有一种模块样式后缀时沿用，混合 css、scss、less、sass 等后缀时回退 SCSS。后缀探测不迁移、不重命名、不改写旧样式文件。构建类名按 `m_[name]_[local]__[hash:base64:6]` 生成，类名包含模块、页面、功能和角色语义。`style-scope-check` 在基线验证和模块导出前检查普通局部样式、副作用导入、全局根选择器与泛化文件名。现有项目保留真实工具链，并按项目地图与 changed/legacy 模式增量治理。

### 两级能力路由与分阶段加载

`capabilities/index.json` 是稳定、轻量、可审计的发现索引；`capabilities/manifests/*.json` 是按命中解析的详细能力契约。路由器不扫描目录，只按索引中的显式路径读取 manifest，并沿 `requires` 构建依赖拓扑。

路由结果使用 bootstrap、dependencies、primary、project 四个阶段描述 AI 应读取的文件，同时保留 `load.baselineFiles` 兼容扁平调用方。内核对索引归一化结果、manifest 文件和最终路由使用有界缓存，并根据文件状态、项目状态签名和请求摘要自动失效。每次路由输出置信度、兜底、歧义和加载比例，便于运行记录审计。

### 覆盖升级与状态保护

复制当前 `ai-baseline-kit/` 覆盖包目录后，统一入口 `ai-run activate` 根据 `.ai-frontend-assembler/` 是否已有状态自动选择首次 bootstrap 或安全 upgrade。升级不覆盖项目专属 `project-scheme.yml` 与 `legacy-baseline.json`，并依据包内 `upgrade-manifest.json` 安全删除明确登记的废弃文件。

## 1. 资产标识

| 字段 | 内容 |
| --- | --- |
| 产品名称 | AI 前端模块装配系统 |
| 英文建议名 | AI Frontend Module Assembly System |
| 机器包名 | `ai-baseline-kit` |
| 资产类型 | 内嵌式 AI 工程能力包 / 前端研发治理工具 |
| 当前版本 | `0.17.0` |
| 主入口 | `ai-baseline-kit/AGENTS.md` |
| 统一执行入口 | `ai-baseline-kit/scripts/ai-run.mjs` |
| 分发方式 | 整目录复制到目标项目根目录 |
| 项目状态目录 | `.ai-frontend-assembler/` |
| 支持的 AI 入口 | `AGENTS.md`、`CLAUDE.md` |
| 权属主体 | 由公司资产管理员根据实际组织信息登记 |
| 维护责任人 | 由公司研发效能或前端架构责任人登记 |
| 源代码仓库 | 由公司资产管理员登记正式仓库地址和访问级别 |

本说明书不替代公司的知识产权、开源合规、安全分级和发布审批制度。权属主体、责任人、仓库地址、密级等组织信息不得由工具自行猜测，应在纳入资产体系时由公司正式登记。

## 1.1 构建隔离契约

系统采用“Git 可审计、产物不可携带”的双轨策略：源码仓库保留 `ai-baseline-kit/` 与 `.ai-frontend-assembler/`，首次激活自动配置 npm 嵌套排除、Docker/Vercel ignore 和 `postbuild` 产物守卫。构建输出在 clean 后还会执行 check，非标准输出目录通过 CLI 或环境变量显式声明。

## 2. 建设目标

系统用于解决以下问题：

1. 不同人员以自然语言或产品文档提出需求时，AI 输出结构不一致；
2. AI 容易跳过确认、猜测接口和权限、修改无关文件；
3. 新旧项目目录结构不同，统一规则难以落地；
4. 模块无法独立拆解，跨项目复用依赖人工复制；
5. UI、主题、国际化、路由、权限、API 和状态归属容易失控；
6. 仅靠提示词无法证明代码经过测试和边界校验；
7. 能力包升级可能覆盖项目专属地图和历史状态。

目标结果：

> 将 AI 的自由生成行为转化为“规格驱动、文件白名单、模块契约、自动验证、失败修复或回滚”的受控工程过程。

## 3. 非目标

系统不承诺：

- 让任何普通聊天模型在没有仓库和终端权限时自动完成项目；
- 数学意义上 100% 理解所有模糊产品需求；
- 自动替代产品验收、代码评审、安全审计和发布审批；
- 在不同技术栈之间无损迁移模块；
- 自动迁移旧项目到 React 或 Vue 标准模板；
- 自动创建 Cursor、Copilot 或其他厂商专属入口；
- 自动决定公司权属、密级、许可证和责任人信息。

## 4. 总体架构

![系统总体说明图](assets/ai-frontend-module-assembler-overview.png)

可编辑矢量图：[`assets/ai-frontend-module-assembler-overview.svg`](assets/ai-frontend-module-assembler-overview.svg)；流程源图：[`assets/ai-frontend-module-assembler-overview.mmd`](assets/ai-frontend-module-assembler-overview.mmd)。

系统分为六个逻辑层：

### 4.1 AI 接入层

- 根目录 `AGENTS.md`；
- 根目录 `CLAUDE.md`；
- 包内 `AGENTS.md`；
- 面向普通使用者的 `intelligent-frontend-assembler` Skill。

职责：确保 AI 首先读取系统入口、项目规则和执行顺序。首次激活时，系统必须检查根 `AGENTS.md` 与 `CLAUDE.md`：缺失则创建；存在但未接入时保留原文并追加带管理标记的装配入口；已有受控段落时原位更新。该过程必须幂等，不得覆盖项目自身规则。

### 4.2 需求编译层

- `document-normalize.mjs`；
- `requirement-to-feature-spec`；
- `requirement-compile.mjs`；
- Feature Spec schema；
- blocking question gate。

职责：将自然语言、产品文档、API 文档或已提取的原型说明转换为可审计 Feature Spec，区分明确事实、合理推断和必须确认项。

### 4.3 架构计划层

- `feature-architecture-planner`；
- `baseline-structure-skill`；
- `feature-plan.mjs`；
- Change Plan schema；
- 项目地图 `project-scheme.yml`。

职责：决定功能属于 shell、shared 还是 modules，形成文件白名单、装配点、依赖和验证计划。

### 4.4 受控执行层

- `smart-develop.mjs`；
- `controlled-change-executor.mjs`；
- `feature-generate.mjs`；
- 执行状态机；
- 事务和回滚组件。

职责：只在批准范围内新增或修改文件，记录执行状态，失败时修复或回滚。

### 4.5 模块装配层

- `module-discover`；
- `module-export`；
- `module-compatibility-check`；
- `module-import`；
- `project-compose`；
- `smart-compose`。

职责：在同技术栈范围内发现、导出、校验、导入和组合模块，处理依赖、shared、路由、权限、主题和 i18n 契约。

### 4.6 验证治理层

- `baseline-check.mjs`；
- `ast-boundary-check.mjs`；
- `acceptance-coverage-check.mjs`；
- `implementation-completeness-check.mjs`；
- `project-validate.mjs`；
- `ci-gate.mjs`；
- `delivery-gate.mjs`；
- delivery receipt 与 `delivery-receipt.schema.json`；
- `baseline-conformance-skill`。

职责：验证模块边界、验收覆盖、实现完整性、类型、lint、测试和构建，形成硬门禁。最终 Gate 通过后生成绑定当前 request ID 和变更文件 SHA-256 的交付回执；没有有效回执不得声明完成。

## 5. 核心处理流程

### 5.1 需求到代码

```text
输入需求
  → 激活或补强根 AGENTS.md / CLAUDE.md
  → 文档标准化
  → Feature Spec
  → blocking question gate
  → Change Plan
  → 文件白名单
  → 受控生成/修改
  → 验收测试映射
  → 实现完整性检查
  → AST 和基线检查
  → typecheck/lint/test/build
  → 修复或回滚
  → Delivery Gate 通过
  → 生成并校验交付回执后交付
```

### 5.2 跨项目模块组合

```text
项目 A/B
  → 模块发现
  → 模块导出 bundle
  → 目标技术栈和 shared 契约检查
  → 缺失依赖与冲突报告
  → 用户确认 blocking 项
  → 事务化导入和 shell 装配
  → 合并主题/权限/路由/i18n
  → 生成组合清单
  → 验证失败则回滚
```

### 5.3 旧项目增量治理

```text
创建或安全追加根 AI 入口
  → 扫描现状
  → 生成项目地图
  → 记录历史 baseline
  → 历史问题不阻断
  → 本次新增违规必须修复
  → 结构变化同步项目地图
```

## 6. 项目分层模型

### 6.1 shell

负责：

- 应用启动；
- 全局路由、布局、主题和样式；
- 全局状态和指令；
- 模块静态装配；
- 无明确业务域归属的基础页面。

不得依赖模块私有实现。

### 6.2 shared

负责：

- 跨业务域复用组件；
- 公共 hooks、utils、types；
- 明确跨域共享的状态和文案；
- 与具体模块无关的共享契约。

不得依赖某个具体模块，也不能成为业务代码垃圾桶。

### 6.3 modules

负责：

- 业务域页面；
- 模块路由、菜单和访问控制；
- 模块 API、状态、类型、文案、样式和资源；
- 模块公开入口和 manifest。

模块之间不得直接引用。跨模块协作必须通过 shell 装配、shared 契约或显式事件/接口完成。

## 7. 标准模块契约

新增模块至少应具备项目等价结构：

```text
modules/<module>/
├── index.ts
├── manifest.ts
├── module.meta.json
├── routes.ts
├── menu.ts
├── access.ts
├── api/
├── components/
├── pages/
├── store/
├── locales/
├── styles/
├── tests/
└── assets/
```

并满足：

- `index.ts` 是公开导出边界；
- `manifest.ts` 是运行时装配入口；
- `module.meta.json` 是迁移和兼容性检查的静态元数据；
- 路由、菜单、权限、API、i18n、测试和资源随模块归属；
- 新模块不能直接导入另一模块的私有代码；
- 对外依赖和 shared 契约必须显式声明。

## 8. 输入和输出契约

### 8.1 输入

支持：

- 自然语言；
- 产品文档；
- API 文档；
- 已提取的 PDF/Word/图片/原型文本；
- Feature Spec；
- 跨项目组合需求；
- 项目路径、模块路径和目标技术栈。

### 8.2 中间产物

- Normalized Document；
- Feature Spec；
- requiredQuestions；
- Change Plan；
- Controlled Execution Record；
- Acceptance Coverage Report；
- Module Bundle；
- Compatibility Report；
- Project Composition Manifest；
- Delivery Receipt。

### 8.3 输出

- 符合项目真实技术栈的前端文件；
- 明确的模块目录和公开入口；
- 路由、菜单、权限、API、状态、主题和 i18n 装配；
- Vitest、API mock 和 Playwright 骨架或可证明测试；
- 验证报告、失败原因、修复记录和剩余风险；
- 绑定当前请求及变更文件哈希的交付回执；
- 跨项目组合后的模块清单。

## 9. 项目状态和升级边界

项目专属状态必须位于：

```text
.ai-frontend-assembler/
├── project-scheme.yml
├── legacy-baseline.json
├── state.json
├── deliveries/
│   └── <request-id>.delivery.json
└── adapters/
```

`ai-baseline-kit/` 被定义为可替换包，不能保存唯一的项目专属状态。

升级原则：

```text
保留 .ai-frontend-assembler/
→ 直接复制并覆盖新 ai-baseline-kit/
→ AI 统一执行 ai-run activate
→ 自动路由 bootstrap / upgrade
→ 自动清理升级清单中明确登记的废弃包内文件
→ doctor / validate / delivery gate
```

升级不得重新生成已有项目地图，也不得刷新旧项目历史快照；允许直接覆盖包目录，并由安全升级清单清理明确登记的废弃文件。

## 10. 技术栈支持策略

### 10.1 内置新项目模板

- React 18 + TypeScript + Vite + Ant Design 5 + Tailwind CSS 3；
- Vue 3 + TypeScript + Vite + Element Plus。

### 10.2 旧项目

保留旧项目真实技术栈。系统可以识别和治理 React、Vue、Angular 或其他前端项目，但不保证每种技术栈都拥有专用代码生成模板。

### 10.3 模块迁移

默认限定同技术栈。不同技术栈之间只能迁移业务规格、接口契约或设计意图，不能承诺直接复用组件和运行时代码。

## 11. UI、主题和国际化约定

- React 模板保留 Ant Design 默认配色；
- Vue 模板保留 Element Plus 默认配色；
- 全局主题通过项目地图声明的单一入口维护，模板默认为 `src/theme/theme.css`；
- 模块私有样式和资源随模块；
- i18n 推荐扁平稳定 key，例如 `licensing.summary.title`；
- 不采用中文与 key 双向映射；
- 模块导出时语言资源必须纳入 bundle 和冲突检查。

## 12. 控制能力分级

| 层级 | 控制方式 | 可靠性说明 |
| --- | --- | --- |
| L0 | 项目说明和 Skill 提示 | 依赖 AI 主动遵循 |
| L1 | Schema、项目地图和静态规则 | 可以发现结构和字段问题 |
| L2 | 文件白名单、执行状态机和事务 | 可以限制受控执行范围并回滚 |
| L3 | AST、测试、构建和 CI Gate | 可以阻止已知工程违规进入交付 |
| L4 | 产品、测试、评审和发布审批 | 验证业务语义、安全和组织合规 |

系统不能只依赖 L0。公司正式使用时至少应强制 L2 + L3，并保留 L4 人工责任。

## 13. 安全与审计

### 13.1 修改安全

- 默认只修改 Change Plan 白名单文件；
- 旧项目采用增量模式；
- 跨项目组合采用事务和失败回滚；
- 不允许自动覆盖同名模块和 shared 契约；
- 高风险动作缺少验收和失败策略时必须阻断。

### 13.2 审计证据

建议纳入 Git：

- `.ai-frontend-assembler/`；
- Feature Spec；
- Change Plan；
- 测试文件；
- 组合清单；
- 验证和 Gate 结果摘要；
- `.ai-frontend-assembler/deliveries/` 中的交付回执；
- 能力包版本和升级记录。

### 13.3 数据安全

本系统本身不要求上传公司代码到外部服务，但实际 AI 工具可能使用外部模型。公司使用前必须根据数据分级选择允许的模型、部署方式和脱敏规则。

## 14. 当前限制和剩余风险

1. 尚未激活的项目仍需要使用一次默认安全入口 Prompt，或显式执行 `ai-run activate`；激活后根入口是否被 AI 自动读取仍取决于具体工具能力；
2. CI Gate 已提供，但是否作为合并必过项需要项目自行接入 CI；
3. 手工单独运行 Gate 时，尚未实现 Git 提交范围与 Change Plan 文件白名单的提交级精确对账；受控执行路径已限制白名单；
4. 完整性检查可拒绝已知 TODO/FIXME、todo/skip 和显式占位模式，但不能证明所有业务语义均已实现；
5. 动态导入、复杂别名、运行时插件和非标准构建系统可能需要 `.ai-frontend-assembler/adapters/`；
6. 工程检查和交付回执无法替代产品验收、安全评审与代码评审；
7. 模块跨项目迁移仍以同技术栈和兼容 shared 契约为前提。

## 15. 统一命令接口

```bash
node ai-baseline-kit/scripts/ai-run.mjs init
node ai-baseline-kit/scripts/ai-run.mjs activate
node ai-baseline-kit/scripts/ai-run.mjs develop --request "<需求>"
node ai-baseline-kit/scripts/ai-run.mjs compose --request "<组合需求>" --workspace-root "<工作区>"
node ai-baseline-kit/scripts/ai-run.mjs repair --request "<修复目标>"
node ai-baseline-kit/scripts/ai-run.mjs validate
node ai-baseline-kit/scripts/ai-run.mjs gate
node ai-baseline-kit/scripts/ai-run.mjs doctor
node ai-baseline-kit/scripts/ai-run.mjs status
node ai-baseline-kit/scripts/ai-run.mjs activate
```

`ai-run` 不提供可交互可视化界面，符合“降低使用者负担、优先智能化自动化”的产品原则。

## 16. 验证与质量保证

在 `ai-plugin` 多包仓库根目录维护基线包时至少执行：

```bash
node scripts/package-check.mjs
node ai-baseline-kit/scripts/capability-registry-contract-check.mjs
node ai-baseline-kit/scripts/project-tools-check.mjs
node ai-baseline-kit/scripts/package-upgrade-contract-check.mjs
node ai-baseline-kit/scripts/intelligent-development-contract-check.mjs
node ai-baseline-kit/scripts/delivery-closure-contract-check.mjs
node ai-baseline-kit/scripts/baseline-contract-check.mjs
node ai-baseline-kit/scripts/baseline-check.mjs --fail-on-warn
git diff --check
```

将 `ai-baseline-kit/` 单独嵌入其他业务项目时，不运行 `node scripts/package-check.mjs`，因为它属于本仓库的 `package-repository-reference` 维护场景，并依赖根 `package-registry.json`。嵌入项目改用 `ai-baseline-kit/scripts/` 下的项目检查与验证脚本。

契约回归覆盖：

- 两级显式能力注册、依赖拓扑、分阶段加载、有界缓存、路由诊断和注册表安全约束；
- React/Vue 新建和扩展；
- 主题入口；
- 验收测试生成；
- 模块可移植和项目组合；
- 受控执行硬门禁；
- 自然语言智能开发；
- 多格式文档标准化；
- 修复闭环；
- 旧项目增量治理；
- 根 `AGENTS.md` / `CLAUDE.md` 的创建、保留追加和幂等更新；
- 实现完整性门禁、交付回执生成及文件变更后失效；
- 整包替换升级和外置状态保留。

## 17. 公司上线建议

正式全公司推广前建议完成：

1. 指定产品负责人、技术负责人和资产管理员；
2. 确定正式仓库、分支策略、版本发布流程和变更记录；
3. 将 `ai-run gate` 接入公司 CI，设置为合并必过；
4. 建立允许使用的 AI 工具和数据分级清单；
5. 选取 React、Vue、旧项目和模块组合各至少一个试点；
6. 保存试点的 Feature Spec、Change Plan、代码差异和验证报告；
7. 对初次使用者开展一次 30 分钟操作培训；
8. 明确异常升级、规则冲突和跨模块 shared 变更的审批人；
9. 按季度复核模板依赖版本、规则适用性和模型兼容性。

## 18. 公司资产验收建议

### 18.1 功能验收

- 自然语言需求可以进入确认和开发闭环；
- 产品文档可以生成结构化规格；
- blocking question 可以阻止不确定需求直接生成代码；
- 新旧项目均能生成项目地图；
- 根入口缺失时自动创建，已有自定义规则时安全追加且重复执行不重复；
- React/Vue 标准模板可以构建；
- 同栈模块可以导出、检查、导入和组合；
- 验证失败可以修复或回滚；
- Gate 通过后生成有效交付回执，代码被再次修改后旧回执失效；
- 整包替换后项目状态保持不变。

### 18.2 管理验收

- 版本、仓库、责任人和权属登记完整；
- 使用手册、系统说明书和架构图齐全；
- 变更记录和发布审批可追溯；
- CI Gate 已接入；
- 数据安全和模型使用范围已审批；
- 试点项目验收记录已归档。

## 19. 文档和资产清单

| 资产 | 路径 |
| --- | --- |
| 产品 README | `ai-baseline-kit/README.md` |
| 安装说明 | `ai-baseline-kit/INSTALL.md` |
| 使用指南 | `ai-baseline-kit/docs/使用指南.md` |
| 系统说明书 | `ai-baseline-kit/docs/system-specification.md` |
| Skill 独立使用指南 | `ai-baseline-kit/docs/skill-standalone-guide.md` |
| 系统说明图 | `ai-baseline-kit/docs/assets/ai-frontend-module-assembler-overview.svg` |
| 系统说明图 PNG | `ai-baseline-kit/docs/assets/ai-frontend-module-assembler-overview.png` |
| 可编辑源图 | `ai-baseline-kit/docs/assets/ai-frontend-module-assembler-overview.mmd` |
| 包元数据 | `ai-baseline-kit/plugin.json` |
| 规则 | `ai-baseline-kit/docs/baseline-rules.yml` |
| 工程流程 | `ai-baseline-kit/docs/engineering-workflow.yml` |
| 交付回执 Schema | `ai-baseline-kit/docs/delivery-receipt.schema.json` |
| 包契约回归 | `ai-baseline-kit/scripts/baseline-contract-check.mjs` |

## 20. 说明图再生成 Prompt

如需使用公司视觉模型重新生成宣传版位图，可使用：

```text
请生成一张 16:9、企业级、中文信息架构图，标题为“AI 前端模块装配系统”。
整体使用干净的浅灰背景、深灰文字、Element Plus 风格蓝色 #409EFF 为主色，绿色表示验证通过，橙色表示需要确认，红色表示阻断或回滚。
从左到右展示完整流程：
1. 输入端：自然语言、产品文档、项目 A/B 模块；
2. AI 接入：自动创建或安全追加 AGENTS.md、CLAUDE.md，统一入口 ai-run；
3. 需求闭环：文档标准化、Feature Spec、blocking question、Change Plan；
4. 受控执行：文件白名单、模块契约、代码生成、事务和回滚；
5. 自动验收：Vitest、Playwright、API mock、权限和页面状态测试；
6. 工程门禁：实现完整性、AST 边界、baseline、typecheck、lint、test、build、Delivery Gate；
7. 输出端：结构化前端项目和带变更文件哈希的 delivery receipt，包含 shell、shared、modules、theme、i18n、tests；
8. 下方独立展示跨项目组合链路：module discover → export → compatibility check → import/compose → 项目 C；
9. 底部横向基础层：baseline rules、project scheme、schemas、.ai-frontend-assembler state。
画面必须层级清楚、中文无错字、箭头方向明确、适合公司内部培训和软件资产登记，不使用人物插画，不使用夸张 3D，不添加虚构公司 Logo。
```
