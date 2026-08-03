# Skills Index

使用以下仓库内 skill 文档作为日常工作流入口。标准可移植 skill 使用目录形态。

普通需求不要从本目录顺序读取全部 Skill。先读取 `../capabilities/index.json`，由 `../scripts/capability-route.mjs` 自动返回本次需要加载的 Skill 和上下文；本文件保留为人工浏览索引。

- `intelligent-frontend-assembler/`: 面向普通使用者的零配置总入口，以 `smart-develop` 为统一入口，将自然语言或多格式产品文档路由到受控生成、旧项目增量改造、自动修复或跨项目模块装配，并强制文件白名单、验收覆盖、验证门禁和失败回滚。
- `baseline-structure-skill/`: 对齐系统 `baseline-structure-planner`，开发前结构化需求或迁移计划，输出所属层级、影响面、依赖和验证计划。
- `baseline-conformance-skill/`: 对齐系统 `baseline-conformance-checker`，开发后按项目基线回归，输出 pass/fail、违规项、修复项和 rerun/verify 建议。
- `project-scheme-bootstrap/`: 项目首次接入时自动扫描新旧项目，生成 `.ai-frontend-assembler/project-scheme.yml`，减少手写 `project-defined`。
- `requirement-to-feature-spec/`: 将自然语言或产品文档转换为 Feature Spec，并在权限、API、模块、路由、状态或验收不明确时驱动用户确认。
- `feature-architecture-planner/`: 将 ready Feature Spec 转换为模块决策、文件白名单、装配点和依赖计划。
- `project-i18n-localizer/`: 对齐系统 `project-i18n-localizer`，用于项目级国际化识别、配置、文案抽取、翻译和覆盖验证。

配套规则文件：

- `../docs/baseline-rules.yml`: 定义分层、模块契约、装配契约和迁移规则。
- `../docs/engineering-workflow.yml`: 定义新功能、旧页模块化、模块迁移、新项目初始化和回归闭环的执行流程。
- `../docs/project-scheme.yml`: 随包提供的仓库参考地图；真实目标项目地图位于 `project_root/.ai-frontend-assembler/project-scheme.yml`，不存在时先 bootstrap。

可移植 skill 目录建议：

- 新增或带引用资料的 skill 使用目录形态：`skill-name/SKILL.md`、`skill-name/references/`、`skill-name/agents/`。

长版参考源仍然是 `.claude-baseline-doc.txt`；本索引不替代它。

## 独立抽离说明

各 Skill 可以按职责单独调用，但当前并非全部物理自包含。结构规划、基线审查和国际化 Skill 更适合独立使用；统一智能装配、项目地图生成和架构计划仍依赖整包的规则、Schema、脚本与项目状态。抽离前请阅读 [`../docs/skill-standalone-guide.md`](../docs/skill-standalone-guide.md)，不要只复制总控 `SKILL.md` 后宣称具备完整工程闭环。
