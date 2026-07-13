# AGENTS.md

本文件用于“整包植入模式”：将 `ai-baseline-kit/` 整个目录放在目标项目根目录下，不需要把 `docs/`、`skills/`、`scripts/` 抽到业务项目根目录。

路径约定：
- `baseline_root`: 当前 `ai-baseline-kit/` 目录。
- `project_root`: `ai-baseline-kit/` 的父目录，也就是目标业务项目根目录。
- 本文件中未特别说明的规范路径，都相对于 `baseline_root`。
- 业务代码、依赖、路由、模块、资源扫描，都相对于 `project_root`。

1. 任何改动前，先读取 `docs/baseline-rules.yml`、`docs/engineering-workflow.yml`，以及 `docs/project-scheme.yml`（若存在）；如果 `docs/project-scheme.yml` 不存在，先用 `skills/project-scheme-bootstrap/SKILL.md` 扫描 `project_root` 并在 `baseline_root/docs/project-scheme.yml` 生成项目地图，再用 `skills/baseline-structure-skill/SKILL.md` 把需求整理成明确范围。
2. 只在目标页面、模块或分层内工作，不碰无关文件；除非用户明确要求维护基线包，否则不要修改 `ai-baseline-kit/`。
3. 不要自动向 `project_root/.gitignore` 追加 `ai-baseline-kit/`；规范包变化应允许在 Git 中显示，便于审计、同步和提交。
4. 新增或修改页面、模块、路由、组件、状态、API、文案、样式、资源、配置或依赖时，必须遵守基线：同技术栈、shell/shared/modules（或项目等价层）分层、零交叉依赖、静态装配、命名收敛、文案归属、样式外置、资源随模块走、依赖显式声明。
5. 模块必须通过统一入口和 manifest 暴露自身能力。跨域复用先进入项目定义的 shared；基础 UI 包装只放在项目定义的基础组件层，不塞具体业务逻辑。
6. 任何结构变更后，必须同步维护或重新生成 `baseline_root/docs/project-scheme.yml`，并按 `skills/baseline-conformance-skill/SKILL.md` 回归；如结果为 `fail`，只修复违规项，再回归到 `pass`。
7. 可运行 `node ai-baseline-kit/scripts/baseline-check.mjs` 做硬检查；脚本会读取 `baseline_root` 内规则并检查 `project_root` 业务代码。
8. 如果目标项目存在 `.claude-baseline-doc.txt`，它只作为长版参考源，不作为日常主入口。
