# AGENTS.md

本文件用于“整包植入模式”：将 `ai-baseline-kit/` 整个目录放在目标项目根目录下，不需要把 `docs/`、`skills/`、`scripts/` 抽到业务项目根目录。

路径约定：
- `baseline_root`: 当前 `ai-baseline-kit/` 目录。
- `project_root`: `ai-baseline-kit/` 的父目录，也就是目标业务项目根目录。
- 本文件中未特别说明的规范路径，都相对于 `baseline_root`。
- `baseline_root/docs/project-scheme.yml` 是随包提供的仓库参考地图，不得在目标项目中覆盖为业务项目地图。
- 目标项目专属状态统一位于 `project_root/.ai-frontend-assembler/`：项目地图为 `project-scheme.yml`，旧项目历史快照为 `legacy-baseline.json`，状态清单为 `state.json`。
- 用户复制或覆盖新版 `ai-baseline-kit/` 后，统一运行 `ai-run activate`：不存在外置状态时首次 bootstrap，存在外置状态时自动 upgrade；升级路径必须保留项目地图和历史快照，并按 `upgrade-manifest.json` 安全清理旧版残留文件。
- `project-bootstrap` 默认不得覆盖已有项目地图；只有用户明确要求重新扫描项目结构时才允许传入 `--refresh-project-scheme`。
- 业务代码、依赖、路由、模块、资源扫描，都相对于 `project_root`；`.ai-frontend-assembler/` 必须保留并纳入版本管理。

1. 任何改动前，先读取 `docs/baseline-rules.yml`、`docs/engineering-workflow.yml` 和 `project_root/.ai-frontend-assembler/project-scheme.yml`；如果目标项目地图不存在，先用 `skills/project-scheme-bootstrap/SKILL.md` 扫描 `project_root` 并生成外置项目状态。自然语言或产品文档需求先按 `skills/requirement-to-feature-spec/SKILL.md` 形成 ready Feature Spec，再按 `skills/feature-architecture-planner/SKILL.md` 和 `skills/baseline-structure-skill/SKILL.md` 固定模块归属与文件范围。
2. 只在目标页面、模块或分层内工作，不碰无关文件；除非用户明确要求维护基线包，否则不要修改 `ai-baseline-kit/`。
3. 不要自动向 `project_root/.gitignore` 追加 `ai-baseline-kit/`；规范包变化应允许在 Git 中显示，便于审计、同步和提交。首次 `activate/init` 必须建立构建隔离：维护部署 ignore、npm 嵌套排除和 `postbuild` 产物守卫，使 `ai-baseline-kit/` 与 `.ai-frontend-assembler/` 不进入前端构建产物、npm 发布包或常见部署上下文。
4. 新增或修改页面、模块、路由、组件、状态、API、文案、样式、资源、配置或依赖时，必须遵守基线：同技术栈、shell/shared/modules（或项目等价层）分层、零交叉依赖、静态装配、命名收敛、文案归属、样式外置、资源随模块走、依赖显式声明。
5. 模块必须通过统一入口和 manifest 暴露自身能力。跨域复用先进入项目定义的 shared；基础 UI 包装只放在项目定义的基础组件层，不塞具体业务逻辑。
6. 任何结构变更后，必须同步维护或重新生成 `project_root/.ai-frontend-assembler/project-scheme.yml`，并按 `skills/baseline-conformance-skill/SKILL.md` 回归；如结果为 `fail`，只修复违规项，再回归到 `pass`。
7. 可运行 `node ai-baseline-kit/scripts/baseline-check.mjs` 做硬检查；脚本会读取 `baseline_root` 内规则并检查 `project_root` 业务代码。构建后必须运行 `node ai-baseline-kit/scripts/build-artifact-guard.mjs --check`；标准 `activate/init` 会自动把 clean-and-verify 守卫接入 `scripts.postbuild`。
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

旧项目首次 bootstrap 自动记录 `project_root/.ai-frontend-assembler/legacy-baseline.json`；后续默认使用 `baseline-check --mode changed`，只阻断新增违规。不得通过自动刷新快照掩盖新问题。

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

## 面向用户的极简自然语言入口

用户不需要复述内部工作流、Skill 名称、Schema 名称或脚本命令。只要用户表达以下意图，AI 必须自动读取本文件并选择统一入口展开完整闭环：

- `接入装配系统并检查当前项目`：自动执行初始化、项目识别、入口补齐、诊断和首次门禁。
- `帮我实现：<需求>`：按旧项目增量或新项目创建模式完成需求分析、必要确认、受控开发、测试和验证。
- `按这个产品文档开发：<路径>`：读取并标准化文档；无法可靠提取时只提出必要的 blocking question。
- `把项目 A 的 <模块> 和项目 B 的 <模块> 组合成项目 C`：自动执行项目发现、模块发现、导出、兼容性检查、事务化组合、冲突确认和完整门禁。
- `检查并修复当前项目`：自动执行 validate、gate 和白名单内的有限修复。
- `升级装配系统并验证项目`：直接覆盖新版包后统一执行 `ai-run activate`，保留 `.ai-frontend-assembler/`，由 AI 自动完成升级迁移、doctor、validate 和 gate。

用户使用其他自然语言表达同等意图时同样处理，禁止要求用户改写成固定 Prompt。除非存在真正阻塞实施且无法从用户输入、产品文档或项目现状可靠推断的问题，否则不要把 Feature Spec、Change Plan、AST、validate、gate、CLI 参数或内部步骤转嫁给用户。对用户默认只输出两类信息：

1. 一次性聚合的 blocking questions；
2. 最终修改文件、验证结果、组合/迁移清单和剩余风险摘要。

内部仍必须完整执行需求规格、变更计划、文件白名单、模块边界、i18n、验收测试、事务写入、验证门禁和失败修复/回滚，不得因为用户提示词简短而降级流程。

## 根目录 AI 入口自动接入与完成声明锁

目标项目不要求预先存在 `AGENTS.md` 或 `CLAUDE.md`。首次使用装配系统时，必须先执行入口接入：

- 缺少根 `AGENTS.md` / `CLAUDE.md`：创建两个薄入口；
- 已存在但没有指向 `ai-baseline-kit`：保留原文并追加受控装配入口；
- 已存在且已接入：不得重复追加；
- 自动追加必须可幂等，不能覆盖或改写原有项目规则；
- 后续任何需求都从根入口发现本包，再进入 `smart-develop` 或 `smart-compose`，不得只读取嵌套包文件后绕过统一入口。

开发输出只有在当前请求对应的 `.ai-frontend-assembler/deliveries/<request-id>.delivery.json` 同时满足以下条件时，才能声明“已完成”“全部通过”或“可以交付”：

- `status: passed`；
- `checks.finalGate: passed`；
- `changedFilesHash` 存在且能与当前文件哈希复核一致。

Gate 失败、回执缺失、回执过期或只完成了页面骨架时，必须报告 `needs-confirmation` / `failed`，不能用自然语言包装成完成。

## 统一智能开发总入口与硬约束

用户提供自然语言、详细大白话、产品文档、API 文档、原型导出、ready Feature Spec 或跨项目组合要求时，优先使用 `skills/intelligent-frontend-assembler/SKILL.md` 并运行 `scripts/smart-develop.mjs`。所有输入先标准化；跨项目组合由总控自动委托 `scripts/smart-compose.mjs`，不得要求普通用户手工选择底层 CLI。

内置文档标准化支持文本、Markdown、HTML、JSON/OpenAPI、Figma JSON、DOCX 和基础文本型 PDF。图片、扫描 PDF、在线 Figma 或无法可靠读取的二进制文档必须使用外部提取器或向用户索取文本版本；提取为空或不可靠时返回 blocking question，禁止伪造文档内容。

L0/L1/L2 且可机械证明安全的内容自动处理；L3、业务语义冲突或破坏风险无法证明时，将必须确认项一次性聚合提问。新项目必须显式进入创建模式；旧项目默认增量模式，目标路径缺少 `package.json` 时不得自动当作新项目创建。

任何 AI 都不得仅凭 Prompt 或 Skill 自认合规后直接写业务代码。执行必须满足：`frontend-change-plan.status=ready`、无 blocking questions、声明 `files.allowedRoots`、实际 diff 未越界、未触碰禁止路径、验证通过。所有写入进入目标项目外事务；失败、越界或验证未通过必须回滚并保留 `smart-develop-run.json` / `controlled-execution.json` 审计记录。

自动修复默认最多 2 次，硬上限 3 次。每轮修复只能在原 Change Plan 白名单内进行，并重新执行实际 diff 检查和完整验证；不得通过扩大范围、刷新 legacy snapshot 或降低检查等级制造“通过”。

每个生成特性必须生成 `*.acceptance-coverage.json`，覆盖 Feature Spec acceptance、页面状态、权限和 API mock 到真实测试文件的映射。无法可靠推导的业务行为保留为 `todo/fixme`，不得伪造自动化断言、OCR 结果或测试通过。
