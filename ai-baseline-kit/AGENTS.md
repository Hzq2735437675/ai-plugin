# AGENTS.md

本文件用于“整包植入模式”：将 `ai-baseline-kit/` 整个目录放在目标项目根目录下，不需要把 `docs/`、`skills/`、`scripts/` 抽到业务项目根目录。

路径约定：
- `baseline_root`: 当前 `ai-baseline-kit/` 目录。
- `project_root`: `ai-baseline-kit/` 的父目录，也就是目标业务项目根目录。
- 本文件中未特别说明的规范路径，都相对于 `baseline_root`。
- 如果 docs/project-scheme.yml 中 project.map_status 为 package-repository-reference，说明它是随包提供的仓库参考地图；复制到其他项目后必须先重新运行 skills/project-scheme-bootstrap/SKILL.md 覆盖为目标项目地图。
- 业务代码、依赖、路由、模块、资源扫描，都相对于 `project_root`。

1. 任何改动前，先读取 `docs/baseline-rules.yml`、`docs/engineering-workflow.yml`，以及 `docs/project-scheme.yml`（若存在）；如果 `docs/project-scheme.yml` 不存在，或其中 `project.map_status` 为 `package-repository-reference`，先用 `skills/project-scheme-bootstrap/SKILL.md` 扫描 `project_root` 并在 `baseline_root/docs/project-scheme.yml` 生成项目地图，再用 `skills/baseline-structure-skill/SKILL.md` 把需求整理成明确范围。
2. 只在目标页面、模块或分层内工作，不碰无关文件；除非用户明确要求维护基线包，否则不要修改 `ai-baseline-kit/`。
3. 不要自动向 `project_root/.gitignore` 追加 `ai-baseline-kit/`；规范包变化应允许在 Git 中显示，便于审计、同步和提交。
4. 新增或修改页面、模块、路由、组件、状态、API、文案、样式、资源、配置或依赖时，必须遵守基线：同技术栈、shell/shared/modules（或项目等价层）分层、零交叉依赖、静态装配、命名收敛、文案归属、样式外置、资源随模块走、依赖显式声明。
5. 模块必须通过统一入口和 manifest 暴露自身能力。跨域复用先进入项目定义的 shared；基础 UI 包装只放在项目定义的基础组件层，不塞具体业务逻辑。
6. 任何结构变更后，必须同步维护或重新生成 `baseline_root/docs/project-scheme.yml`，并按 `skills/baseline-conformance-skill/SKILL.md` 回归；如结果为 `fail`，只修复违规项，再回归到 `pass`。
7. 可运行 `node ai-baseline-kit/scripts/baseline-check.mjs` 做硬检查；脚本会读取 `baseline_root` 内规则并检查 `project_root` 业务代码。
8. 如果目标项目存在 `.claude-baseline-doc.txt`，它只作为长版参考源，不作为日常主入口。

## 技术栈选择策略

`ai-baseline-kit` 支持两种项目接入模式：

- **旧项目模式**：先扫描项目的 package manifest、lockfile、源码、构建配置、路由、状态、i18n 和模块目录；保留旧项目已有技术栈，不因为接入基线包而迁移到默认模板。
- **新项目模式**：如果没有检测到既有应用技术栈，且用户没有指定其他方案，使用 `docs/stack-profiles.yml` 中的 `default_new_frontend`，即 React 18 + TypeScript + Vite + Ant Design 5 + Tailwind CSS 3 + React Router 6。
- **Vue 标准模板**：如果用户在初始化前明确选择 Vue 3 + Vite，使用 `templates/vue3-vite-ts/`。
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

如果用户在初始化前明确选择其他技术栈，用户选择优先；本包只提供 React 18 + Vite 与 Vue 3 + Vite 两个内置新项目模板，其他技术栈由 AI 按用户选择创建或在旧项目中原地维护。
