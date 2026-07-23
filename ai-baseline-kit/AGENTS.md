# AGENTS.md

本文件用于“整包植入模式”：将 `ai-baseline-kit/` 整个目录放在目标项目根目录下，不需要把 `docs/`、`skills/`、`scripts/` 抽到业务项目根目录。

路径约定：
- `baseline_root`: 当前 `ai-baseline-kit/` 目录。
- `project_root`: `ai-baseline-kit/` 的父目录，也就是目标业务项目根目录。
- 本文件中未特别说明的规范路径，都相对于 `baseline_root`。
- 如果 docs/project-scheme.yml 中 project.map_status 为 package-repository-reference，说明它是随包提供的仓库参考地图；复制到其他项目后必须先重新运行 skills/project-scheme-bootstrap/SKILL.md 覆盖为目标项目地图。
- 业务代码、依赖、路由、模块、资源扫描，都相对于 `project_root`。

1. 任何改动前，先读取 `docs/baseline-rules.yml`、`docs/engineering-workflow.yml`，以及 `docs/project-scheme.yml`（若存在）；如果 `docs/project-scheme.yml` 不存在，或其中 `project.map_status` 为 `package-repository-reference`，先用 `skills/project-scheme-bootstrap/SKILL.md` 扫描 `project_root` 并在 `baseline_root/docs/project-scheme.yml` 生成项目地图。自然语言或产品文档需求先按 `skills/requirement-to-feature-spec/SKILL.md` 形成 ready Feature Spec，再按 `skills/feature-architecture-planner/SKILL.md` 和 `skills/baseline-structure-skill/SKILL.md` 固定模块归属与文件范围。
2. 只在目标页面、模块或分层内工作，不碰无关文件；除非用户明确要求维护基线包，否则不要修改 `ai-baseline-kit/`。
3. 不要自动向 `project_root/.gitignore` 追加 `ai-baseline-kit/`；规范包变化应允许在 Git 中显示，便于审计、同步和提交。
4. 新增或修改页面、模块、路由、组件、状态、API、文案、样式、资源、配置或依赖时，必须遵守基线：同技术栈、shell/shared/modules（或项目等价层）分层、零交叉依赖、静态装配、命名收敛、文案归属、样式外置、资源随模块走、依赖显式声明。
5. 模块必须通过统一入口和 manifest 暴露自身能力。跨域复用先进入项目定义的 shared；基础 UI 包装只放在项目定义的基础组件层，不塞具体业务逻辑。
6. 任何结构变更后，必须同步维护或重新生成 `baseline_root/docs/project-scheme.yml`，并按 `skills/baseline-conformance-skill/SKILL.md` 回归；如结果为 `fail`，只修复违规项，再回归到 `pass`。
7. 可运行 `node ai-baseline-kit/scripts/baseline-check.mjs` 做硬检查；脚本会读取 `baseline_root` 内规则并检查 `project_root` 业务代码。
8. 如果目标项目存在 `.claude-baseline-doc.txt`，它只作为长版参考源，不作为日常主入口。

## 产品需求到代码的强制入口

收到自然语言、详细大白话、产品文档、API 文档或原型说明时，按以下顺序执行：

```text
requirement-to-feature-spec
  -> 用户确认 requiredQuestions
  -> feature-architecture-planner
  -> feature-generate 或 AI 按文件白名单实现
  -> baseline-conformance
  -> project-validate
```

Feature Spec 或 Change Plan 仍有 blocking `requiredQuestions` 时，必须向用户提问，禁止直接生成业务代码。新模块必须同时提供静态 `module.meta.json` 和运行时 `manifest.ts`，模块之间不得直接引用。

旧项目首次 bootstrap 自动记录 `docs/legacy-baseline.json`；后续默认使用 `baseline-check --mode changed`，只阻断新增违规。不得通过自动刷新快照掩盖新问题。

生成器必须将 Feature Spec acceptance 同步生成为模块 `tests/` 下的 Vitest 契约/权限/页面状态/组件测试、API mock 和 Playwright E2E 骨架；不能可靠从自然语言推导的行为断言保留为 `todo/fixme`，不得伪造已完成测试。目标项目安装依赖后必须运行 `ast-boundary-check.mjs --require-parser`。

跨项目模块复用必须使用 `module-export -> module-compatibility-check -> module-import`，多个模块组成新项目使用 `project-compose`；禁止绕过兼容性报告直接覆盖同名模块、shared 契约或主题。

## 技术栈选择策略

`ai-baseline-kit` 支持两种项目接入模式：

- **旧项目模式**：先扫描项目的 package manifest、lockfile、源码、构建配置、路由、状态、i18n 和模块目录；保留旧项目已有技术栈，不因为接入基线包而迁移到默认模板。
- **新项目模式**：如果没有检测到既有应用技术栈，且用户没有指定其他方案，使用 `docs/stack-profiles.yml` 中的 `default_new_frontend`，即 React 18 + TypeScript + Vite + Ant Design 5 + Tailwind CSS 3 + React Router 6。
- **Vue 标准模板**：如果用户在初始化前明确选择 Vue 3 + Vite，使用 `templates/vue3-vite-ts/`；默认 UI 框架为 Element Plus，默认保留其原生配色，项目级覆盖集中到 `src/theme/theme.css`。
- **旧项目模式优先**：只要检测到既有项目文件或应用技术栈，就不复制标准模板，保留 Vue、React、Angular、Svelte 或其他真实技术栈。

内置标准新项目模板只有两个：

```text
ai-baseline-kit/templates/react18-antd-tailwind-ts/
ai-baseline-kit/templates/vue3-vite-ts/
```

初始化或接入时，AI 先读取：

```text
ai-baseline-kit/docs/stack-profiles.yml
ai-baseline-kit/templates/<selected-profile>/README.md
```

可使用无第三方依赖的工具完成诊断、地图初始化和验证：

```bash
node ai-baseline-kit/scripts/project-doctor.mjs
node ai-baseline-kit/scripts/project-bootstrap.mjs
node ai-baseline-kit/scripts/project-validate.mjs
```

如果用户在初始化前明确选择其他技术栈，用户选择优先；本包只提供 React 18 + Vite 与 Vue 3 + Vite + Element Plus 两个内置新项目模板，其他技术栈由 AI 按用户选择创建或在旧项目中原地维护。
