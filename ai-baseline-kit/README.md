# AI Baseline Kit

- 包名：`ai-baseline-kit`
- 当前版本：`0.3.0`
- 包元数据：[`plugin.json`](plugin.json)
- 安装/植入说明：[`INSTALL.md`](INSTALL.md)
- AI 主入口：[`AGENTS.md`](AGENTS.md)

这是一套可以整体植入任意项目根目录的 AI 开发基线包。最小用法是：**只复制整个 `ai-baseline-kit/` 文件夹**，不需要复制本仓库其他目录，也不依赖本仓库的 Git 历史。

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
- [`templates/vue3-vite-ts/`](templates/vue3-vite-ts/)：用户明确选择 Vue 3 + Vite 时使用。

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

## 植入方式

### 最小方式：只复制包目录

```text
<target-project>/
└── ai-baseline-kit/
```

复制后让 AI 先读取 `ai-baseline-kit/AGENTS.md` 即可使用。若 AI 工具只自动读取根级 `AGENTS.md` 或 `CLAUDE.md`，再按 [`INSTALL.md`](INSTALL.md) 追加一个很短的根级入口；根级文件是自动发现适配层，不是本包的必要依赖。

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
- `scripts/baseline-check.mjs`: 无第三方依赖的基线硬检查脚本，可给 AI、本地开发或 CI 使用。
- `scripts/project-doctor.mjs`: 诊断目标项目的框架、构建工具、路由、状态、i18n、样式、模块和验证脚本。
- `scripts/project-bootstrap.mjs`: 生成/更新项目地图；空目录可用 `--init-template --stack <profile>` 初始化标准模板。
- `scripts/project-validate.mjs`: 统一执行基线检查和可选的 `typecheck`、`lint`、`test`、`build`。
- `scripts/project-tools-check.mjs`: 无第三方依赖的项目工具自测。
- `skills/project-scheme-bootstrap/SKILL.md`: 自动扫描新项目或旧项目并生成 `docs/project-scheme.yml`。
- `skills/baseline-structure-skill/SKILL.md`: 开发前结构化需求。
- `skills/baseline-conformance-skill/SKILL.md`: 开发后基线符合性回归。
- `skills/project-i18n-localizer/SKILL.md`: 项目级国际化识别、配置、文案抽取、翻译和覆盖验证。
- `templates/react18-antd-tailwind-ts/`: 新前端项目默认参考模板。

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

# 统一回归；按目标项目已有 scripts 选择可选检查
node ai-baseline-kit/scripts/project-validate.mjs
node ai-baseline-kit/scripts/project-validate.mjs --typecheck --build
```

`project-bootstrap.mjs` 检测到已有项目时不会自动复制模板；如需初始化模板，目标目录必须为空或显式使用 `--force`。旧项目应只生成项目地图并保留真实技术栈。

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
