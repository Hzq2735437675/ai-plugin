# AI 前端模块装配系统

> 机器包名：`ai-baseline-kit`

> 当前版本：`0.17.0`

AI 前端模块装配系统是一套**由 AI 编排、以工程契约约束、在构建期组合模块**的前端工程能力包。它面向自然语言或产品文档驱动的开发场景，让 AI 不只是生成页面代码，还必须完成需求确认、模块拆解、文件边界控制、自动测试、跨项目模块迁移、项目组合和最终验收。

本仓库采用多包结构；当前可直接植入业务项目的兼容包位于 `ai-baseline-kit/`。为保持已有项目的 `baseline_root`、安装路径和脚本调用兼容，产品展示名称改为“AI 前端模块装配系统”后，机器包名和目录名仍保留为 `ai-baseline-kit`。

## 一句话定位

> 让 AI 按契约生产、迁移和组合前端模块。

它不是单纯的代码模板、Prompt 集合或页面生成器，而是一套覆盖以下阶段的工程闭环：

```text
自然语言 / 产品文档
  -> 需求分析与最少确认问题
  -> Feature Spec
  -> 模块归属与文件白名单
  -> React / Vue 结构化代码生成
  -> Acceptance 自动测试
  -> AST 模块边界检查
  -> 模块导出、兼容检查与增量导入
  -> 多模块构建期装配
  -> typecheck / test / build / baseline 验收
```

## 极简使用

复制后，如果项目根入口尚未接入，首次只需说：

```text
请接入并使用项目根目录 ai-baseline-kit 的 AI 前端模块装配系统处理本次需求：<需求或产品文档路径>
```

系统会创建或安全追加根 `AGENTS.md` / `CLAUDE.md`。完成首次接入后，使用者不需要背 Prompt、Skill 或脚本，直接说目标即可：

```text
帮我实现：新增客户列表页，支持名称和状态筛选。
按这个产品文档开发：docs/product/customer.md
把项目 A 的客户模块和项目 B 的授权模块组合成项目 C。
检查并修复当前项目。
```

AI 从项目根目录 `AGENTS.md` 或 `CLAUDE.md` 自动进入装配闭环。只有真正阻塞实施的问题才会一次性向用户确认；Feature Spec、Change Plan、文件白名单、测试、AST、validate、gate 和失败修复均由系统内部完成。只有最终 Gate 通过并生成可复核的 delivery receipt，系统才允许声明完成。

## 公司推广与资产资料

- [使用指南](ai-baseline-kit/docs/使用指南.md)
- [系统说明书与资产验收建议](ai-baseline-kit/docs/system-specification.md)
- [Skill 独立抽离与使用指南](ai-baseline-kit/docs/skill-standalone-guide.md)
- [系统说明图（PNG）](ai-baseline-kit/docs/assets/ai-frontend-module-assembler-overview.png)
- [系统说明图（可编辑 SVG）](ai-baseline-kit/docs/assets/ai-frontend-module-assembler-overview.svg)

## 核心能力

| 能力 | 当前实现 |
| --- | --- |
| 自然语言和产品文档入口 | `smart-develop` 统一处理新建、旧项目增量、修复与跨项目组合；组合请求自动委托 `smart-compose` |
| 新项目生成 | 默认 React 18 + TypeScript + Vite + Ant Design；明确选择 Vue 时提供 Vue 3 + TypeScript + Vite + Element Plus 模板 |
| 旧项目接入 | 扫描真实技术栈并建立增量基线，不强制迁移为标准模板 |
| 模块化生成 | 每个模块具有 `module.meta.json`、manifest、公开入口、路由、权限、验收与测试契约 |
| 自动验收测试 | 生成 Vitest 契约、权限、页面状态、组件测试、API mock 和 Playwright E2E 骨架 |
| 模块迁移 | 支持 `module-export`、`module-compatibility-check`、`module-import` |
| 项目组合 | 支持将多个同技术栈模块包装配为新项目，并生成 `docs/project-composition.json` |
| 边界治理 | TypeScript/Vue AST 依赖图检查模块、shared、shell 和 npm/dev 依赖边界 |
| UI 一致性 | React 保持 Ant Design 默认视觉；Vue 保持 Element Plus 默认视觉；统一通过 `src/theme/theme.css` 修改全局主题 |
| 样式隔离 | 统一 styleIsolation 契约 + 可插拔策略适配器；CSS Modules 为标准默认值，导出前执行目标兼容性检查 |
| 硬约束执行 | Change Plan ready 门禁、实际 diff 白名单、禁止路径、状态机、事务快照和失败回滚 |
| 验证闭环 | 支持 package、contract、baseline、typecheck、test 和 production build 回归 |

## 典型场景：从项目 A、B 组合项目 C

当项目 A、B 使用同一技术栈且已经按照模块边界开发时，可以直接向 AI 描述：

> 把项目 A 的客户管理和订单管理模块，与项目 B 的财务结算和消息通知模块，组合成项目 C。

AI 编码代理读取本包规则后，应按以下流程执行：

```text
扫描 A/B
  -> 将自然语言能力映射到真实模块
  -> 检查 module.meta.json 和 manifest
  -> 导出模块包和 SHA-256 文件清单
  -> 检查技术栈、路由、shared、依赖和主题兼容性
  -> 在 C 中创建或保持目标技术栈
  -> 静态装配模块、路由、权限、主题和 i18n
  -> 生成模块导入回执与项目组合清单
  -> 运行 AST、Vitest、typecheck、build 和 baseline-check
```

普通使用者只需要提供原话或产品文档：

```bash
node ai-baseline-kit/scripts/smart-develop.mjs --request "把项目 A 的客户管理和项目 B 的订单管理组合成项目 C" --workspace-root <workspace>
```

脚本会自动发现 A/B/C、选择同栈模板、聚合必须确认项，并通过受控执行器装配和验证。以下命令仅用于调试或高级集成：

底层命令示例：

```bash
# 从 A、B 导出模块
node ai-baseline-kit/scripts/module-export.mjs --project-root <project-a> --module customer --output <customer-bundle>
node ai-baseline-kit/scripts/module-export.mjs --project-root <project-b> --module settlement --output <settlement-bundle>

# 在组合前检查单个模块与目标项目的兼容性
node ai-baseline-kit/scripts/module-compatibility-check.mjs --project-root <project-c> --bundle <customer-bundle>

# 在空目录创建项目 C 并组合多个模块包
node ai-baseline-kit/scripts/project-compose.mjs --project-root <project-c> --stack vue3-vite-ts --bundles <customer-bundle>,<settlement-bundle>

# 安装依赖后执行 AST 和完整基线检查
node ai-baseline-kit/scripts/ast-boundary-check.mjs --project-root <project-c> --require-parser
node ai-baseline-kit/scripts/baseline-check.mjs --project-root <project-c> --fail-on-warn
```

自然语言仍由大模型负责深层业务语义理解，但 `smart-compose` 已提供确定性的工作区发现、项目别名解析、任务路由、问题聚合和跨项目装配入口；脚本通过同一状态机、文件边界和回滚机制约束不同大模型的执行结果。

## 架构方式

本系统采用：

- **AI 编排式开发**：大模型理解需求、选择工具并驱动修复闭环。
- **契约驱动工程**：Feature Spec、Change Plan、module metadata、manifest 和 composition 文件共同约束代码。
- **构建期模块组合**：模块通过静态 assembler 组合为统一项目，而不是运行时加载的微前端子应用。
- **旧项目增量治理**：历史违规可建立快照，本轮新增违规必须修复。

因此，本项目更准确的技术称谓是：

> **AI 编排式、契约驱动的构建期前端模块装配系统。**

## 当前安全边界

- 模块迁移默认要求同技术栈。
- 源项目和目标项目的 `modules_root`、`shared_root` 必须兼容；当前不会猜测并重写任意复杂相对路径。
- 同名模块、路由冲突和内容不同的 shared 契约不会被静默覆盖。
- 模块不得直接依赖另一个模块的私有文件。
- 无法从自然语言可靠推断的业务断言保留为 `todo/fixme`，不得伪造测试已经通过。
- Playwright 配置和 E2E 骨架会生成；真实浏览器执行需要目标环境安装 Playwright 浏览器。
- React 与 Vue 模块不会自动跨栈转换。

## 当前能力包

| 产品展示名称 | 机器包名 | 版本 | 类型 | AI 主入口 | 安装说明 |
| --- | --- | --- | --- | --- | --- |
| AI 前端模块装配系统 | `ai-baseline-kit` | `0.17.0` | 可嵌入 AI 工程能力包 | [`ai-baseline-kit/AGENTS.md`](ai-baseline-kit/AGENTS.md) | [`ai-baseline-kit/INSTALL.md`](ai-baseline-kit/INSTALL.md) |

完整登记信息见 [`package-registry.json`](package-registry.json)。

## 植入目标项目

最小安装方式是将整个目录复制到目标项目根目录：

```text
<target-project>/
├── ai-baseline-kit/
├── src/
└── package.json
```

然后向 AI 发出第一条指令：

```text
读取 ai-baseline-kit/AGENTS.md，扫描当前项目并按其中工作流执行本次需求；如果存在必须确认但无法从项目中判断的信息，先向我提问。
```

包会保持以下路径语义：

```text
baseline_root = <target-project>/ai-baseline-kit
project_root  = <target-project>
```

不要将 `ai-baseline-kit/` 自动加入目标项目 `.gitignore`，这样规则、脚本和版本变化可以继续被审计和提交。

## 技术栈策略

AI 按以下优先级选择技术栈：

1. 用户明确指定的技术栈。
2. 旧项目扫描得到的真实技术栈。
3. 未指定技术栈的新前端项目默认使用 React 18 + TypeScript + Vite + Ant Design 5 + Tailwind CSS 3。

内置标准模板：

- `react18-antd-tailwind-ts`：默认新项目模板，使用 Ant Design 默认视觉。
- `vue3-vite-ts`：Vue 3 模板，使用 Composition API、`<script setup lang="ts">`、Pinia、Vue Router 和 Element Plus 默认视觉。

两个模板都将全局主题修改入口收敛到：

```text
src/theme/theme.css
```

## 仓库布局

```text
ai-plugin/
├── ai-baseline-kit/       # 当前可直接植入目标项目的兼容包
├── packages/              # 后续新增独立能力包的标准目录
├── package-registry.json  # 包索引和分发信息
├── package-*.schema.json  # 包元数据契约
└── scripts/
    └── package-check.mjs  # 多包结构和元数据检查
```

`ai-baseline-kit/` 暂时保留在仓库根目录，以兼容整包植入时的 `baseline_root` 约定。后续新增包默认进入 `packages/<package-name>/`，跨包依赖必须显式登记，不得通过隐式相对路径耦合。

## 主要验证命令

```bash
# 多包仓库契约
node scripts/package-check.mjs

# 工具自测和离线契约回归
node ai-baseline-kit/scripts/capability-registry-contract-check.mjs
node ai-baseline-kit/scripts/project-tools-check.mjs
node ai-baseline-kit/scripts/baseline-contract-check.mjs

# 当前项目严格基线
node ai-baseline-kit/scripts/baseline-check.mjs --fail-on-warn

# 真实 React/Vue 模板安装、测试、类型检查和生产构建
node ai-baseline-kit/scripts/template-build-check.mjs
node ai-baseline-kit/scripts/template-build-check.mjs --profile react18-antd-tailwind-ts
node ai-baseline-kit/scripts/template-build-check.mjs --profile vue3-vite-ts
```

## 包契约

每个独立能力包至少包含：

```text
<package-name>/
├── README.md
├── plugin.json
├── INSTALL.md
└── <primary-entry>
```

约定：

- `plugin.json` 是包身份和版本的机器可读来源。
- `README.md` 面向人和 AI 说明能力、边界和使用方式。
- `INSTALL.md` 说明植入、升级和验证流程。
- `plugin.json.entrypoints.primary` 必须指向包的 AI 主入口。
- 包之间不得通过隐式相对路径耦合。
- 新增包需要登记到 `package-registry.json` 并通过 `scripts/package-check.mjs`。
- 面向使用者的文档只能出现注册表中的当前包版本；`package-check.mjs` 会阻止历史版本介绍重新进入 README、安装说明、使用指南和系统说明书。

## 当前版本能力详解

> 文档维护原则：本 README 只描述当前版本的能力、使用方式和约束，不保留以前版本的功能介绍。历史变化请通过 Git 提交记录或正式发布记录查询。

### 可插拔样式隔离

- 所有模块必须声明并通过可验证的样式隔离契约；CSS Modules 是 React/Vue Vite 标准模板默认值，但不是唯一允许的方案。
- 内置 `css-modules`、`vue-scoped`、`utility-css`、`css-in-js`、`shadow-dom` 和 `hybrid` adapter，并支持项目显式登记 `.cjs` custom adapter。
- 标准 CSS Modules 文件按 owner 命名；新项目默认生成 `.module.scss`，旧项目新增页面仅在模块样式后缀唯一时沿用，混合 css/scss/less/sass 时回退 SCSS，不迁移或改写旧样式文件。构建类名使用 `m_[name]_[local]__[hash:base64:6]`，禁止 `styles/index.css` 等泛化局部样式名称。
- 项目地图记录 `strategy`、`adapter`、模块样式后缀、支持策略、局部样式 fallback 和全局入口。
- 模块 bundle 携带实际使用策略、预处理器、外部全局样式依赖和 custom adapter 指纹，导入前校验目标项目是否兼容。

### 两级能力路由与渐进加载

- `capabilities/index.json` 只承担轻量能力发现，不承载全部 Skill、上下文和脚本清单。
- `capabilities/manifests/*.json` 显式声明详细依赖；路由器只解析本次命中的 manifest 及其依赖。
- AI 按 bootstrap、dependencies、primary、project 阶段加载存在的文件，用户不需要选择 Skill 或内部脚本。
- 能力注册表禁止隐式目录扫描和动态脚本注册，并通过契约检查验证路径、依赖和循环关系。

### 安全接入、升级与构建隔离

- 新旧项目统一执行 `node ai-baseline-kit/scripts/ai-run.mjs activate`，系统自动判断首次接入或安全升级。
- 项目地图、历史快照、状态和交付回执统一保存到 `.ai-frontend-assembler/`，直接覆盖 `ai-baseline-kit/` 不会丢失项目专属状态。
- 能力包和项目状态保持 Git 可见，但通过 npm、Docker、Vercel ignore 与 `postbuild` 产物守卫排除出构建和部署产物。
- `upgrade-manifest.json` 只清理明确登记的包内废弃文件，不覆盖业务代码和项目地图。

### 根入口与交付闭环

- 首次接入自动创建或安全追加根 `AGENTS.md` / `CLAUDE.md`，后续 AI 从项目根入口自动发现装配系统。
- 自然语言或产品文档统一进入 Feature Spec、blocking question、Change Plan、文件白名单、受控实现和验证流程。
- `implementation-completeness-check.mjs` 拒绝 TODO/FIXME、跳过测试、占位实现和未实现异常。
- `delivery-gate.mjs` 生成绑定 request ID、变更文件和 SHA-256 的交付回执；没有当前有效回执时不得声明交付完成。

### 智能开发入口

```bash
# 旧项目增量开发
node ai-baseline-kit/scripts/smart-develop.mjs \
  --document docs/product/order-review.docx \
  --project-root <existing-project>

# 在空目录创建新项目
node ai-baseline-kit/scripts/smart-develop.mjs \
  --request "创建订单审核前端，包含列表、权限、接口和验收条件" \
  --target <new-project> \
  --create \
  --stack vue3-vite-ts
```

`smart-develop.mjs` 接收自然语言、产品文档或 ready Feature Spec，执行标准化、意图识别、架构计划、受控生成、验收覆盖、验证和有界修复。复杂扫描 PDF、图片 OCR 和在线 Figma 需要显式配置 extractor；无法可靠提取时必须阻断并提问，不能伪造内容。

### 自然语言模块组合

```bash
node ai-baseline-kit/scripts/project-compose-from-requirement.mjs \
  --request docs/composition-request.json \
  --sources "a=<project-a>;b=<project-b>" \
  --target <project-c> \
  --stack vue3-vite-ts \
  --apply
```

组合流程按 `discover -> select/question -> export -> safe repair -> compatibility -> transaction -> compose -> validate -> commit/rollback` 执行。自动修复仅限可机械证明安全的模块身份、路由前缀和权限命名空间；shared 内容和 npm 主版本等语义冲突继续阻断并提问。
