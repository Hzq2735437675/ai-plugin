# Skills Index

使用以下仓库内 skill 文档作为日常工作流入口。标准可移植 skill 使用目录形态。

- `baseline-structure-skill/`: 对齐系统 `baseline-structure-planner`，开发前结构化需求或迁移计划，输出所属层级、影响面、依赖和验证计划。
- `baseline-conformance-skill/`: 对齐系统 `baseline-conformance-checker`，开发后按项目基线回归，输出 pass/fail、违规项、修复项和 rerun/verify 建议。
- `project-scheme-bootstrap/`: 项目首次接入时自动扫描新旧项目，生成 `ai-baseline-kit/docs/project-scheme.yml`，减少手写 `project-defined`。
- `requirement-to-feature-spec/`: 将自然语言或产品文档转换为 Feature Spec，并在权限、API、模块、路由、状态或验收不明确时驱动用户确认。
- `feature-architecture-planner/`: 将 ready Feature Spec 转换为模块决策、文件白名单、装配点和依赖计划。
- `project-i18n-localizer/`: 对齐系统 `project-i18n-localizer`，用于项目级国际化识别、配置、文案抽取、翻译和覆盖验证。

配套规则文件：

- `../docs/baseline-rules.yml`: 定义分层、模块契约、装配契约和迁移规则。
- `../docs/engineering-workflow.yml`: 定义新功能、旧页模块化、模块迁移、新项目初始化和回归闭环的执行流程。
- `../docs/project-scheme.yml`: 记录目标项目地图，供 AI 读取真实结构和迁移边界；不存在时先由 `project-scheme-bootstrap` 扫描 `project_root` 生成。

可移植 skill 目录建议：

- 新增或带引用资料的 skill 使用目录形态：`skill-name/SKILL.md`、`skill-name/references/`、`skill-name/agents/`。

长版参考源仍然是 `.claude-baseline-doc.txt`；本索引不替代它。
