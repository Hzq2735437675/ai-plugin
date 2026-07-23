# AI 前端模块装配系统

> 机器包名：`ai-baseline-kit`

> 当前版本：`0.6.0`

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

## 核心能力

| 能力 | 当前实现 |
| --- | --- |
| 自然语言和产品文档入口 | AI 按 skill 转换为 Feature Spec；存在阻断性未知项时必须先向用户确认 |
| 新项目生成 | 默认 React 18 + TypeScript + Vite + Ant Design；明确选择 Vue 时提供 Vue 3 + TypeScript + Vite + Element Plus 模板 |
| 旧项目接入 | 扫描真实技术栈并建立增量基线，不强制迁移为标准模板 |
| 模块化生成 | 每个模块具有 `module.meta.json`、manifest、公开入口、路由、权限、验收与测试契约 |
| 自动验收测试 | 生成 Vitest 契约、权限、页面状态、组件测试、API mock 和 Playwright E2E 骨架 |
| 模块迁移 | 支持 `module-export`、`module-compatibility-check`、`module-import` |
| 项目组合 | 支持将多个同技术栈模块包装配为新项目，并生成 `docs/project-composition.json` |
| 边界治理 | TypeScript/Vue AST 依赖图检查模块、shared、shell 和 npm/dev 依赖边界 |
| UI 一致性 | React 保持 Ant Design 默认视觉；Vue 保持 Element Plus 默认视觉；统一通过 `src/theme/theme.css` 修改全局主题 |
| 验证闭环 | 支持 package、contract、baseline、typecheck、test 和 production build 回归 |

## 典型场景：从项目 A、B 组合项目 C

当项目 A、B 使用同一技术栈且已经按照模块边界开发时，可以直接向 AI 描述：

> 从项目 A 抽离客户管理和订单管理，从项目 B 抽离财务结算和消息通知，组成项目 C。保留路由、权限、接口、状态和国际化；有冲突或不确定项先询问，完成后运行测试、类型检查、构建和基线检查。

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

自然语言由能够读取仓库、修改文件并执行命令的 AI 编码代理理解；脚本负责确定性的结构生成、兼容检查、安全写入和验收阻断。当前不是一个脱离大模型也能独立理解自然语言的单体 CLI。

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
| AI 前端模块装配系统 | `ai-baseline-kit` | `0.6.0` | 可嵌入 AI 工程能力包 | [`ai-baseline-kit/AGENTS.md`](ai-baseline-kit/AGENTS.md) | [`ai-baseline-kit/INSTALL.md`](ai-baseline-kit/INSTALL.md) |

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
