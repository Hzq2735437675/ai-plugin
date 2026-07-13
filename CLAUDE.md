# CLAUDE.md

本项目使用内嵌 AI 基线规范包。任何代码改动、结构判断、目录调整、模块/路由/API/store/样式/i18n/依赖处理前，先读取：

```text
ai-baseline-kit/AGENTS.md
```

涉及实现或改造时，必须按 `ai-baseline-kit/skills/baseline-structure-skill/SKILL.md` 先明确范围；完成后按 `ai-baseline-kit/skills/baseline-conformance-skill/SKILL.md` 回归。

除非用户明确要求维护基线包，否则不要修改 `ai-baseline-kit/`；业务开发按基线包中的 `baseline_root` / `project_root` 路径约定执行。
