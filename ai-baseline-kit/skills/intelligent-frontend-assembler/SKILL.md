---
name: intelligent-frontend-assembler
description: 将自然语言或产品文档路由到零配置前端生成、模块抽离与跨项目装配闭环；自动发现项目、聚合必须确认项，并强制通过 Change Plan、文件白名单、验证门禁和失败回滚执行。
---

# Intelligent Frontend Assembler

## 目标

让使用者只提供自然语言或产品文档，不需要理解模块包、Schema、CLI 或事务。AI 负责分析、拆解、提问、执行、检查和回滚；脚本负责最终硬约束。

## 触发场景

- 从项目 A、B 抽离部分模块形成项目 C。
- 在旧项目中增量新增、迁移、修复或治理功能。
- 从自然语言或产品文档创建结构化前端项目。
- 需要确保不同大模型遵循相同文件边界与验证闭环。

## 强制流程

1. 读取 `AGENTS.md`、`docs/baseline-rules.yml`、`docs/project-scheme.yml`。
2. 自然语言跨项目组合优先运行：
   ```bash
   node ai-baseline-kit/scripts/smart-compose.mjs --request "<用户原话或文档路径>" --workspace-root "<工作区>"
   ```
3. L0/L1/L2 且可机械证明安全的决定自动执行，不询问用户。
4. L3、业务语义不明确或破坏性风险不可证明时，将所有 blocking questions 一次性聚合后询问；不得一步一问。
5. 非跨项目组合需求按以下链路执行：
   ```text
   requirement-to-feature-spec
   -> feature-architecture-planner / baseline-structure-skill
   -> controlled-change-executor
   -> baseline-conformance-skill
   ```
6. 不允许绕过 `frontend-change-plan` 的 `status: ready`、`files.allowedRoots` 和 blocking question 门禁直接修改业务文件。
7. 实际文件 diff 必须通过范围检查；超出白名单或触碰禁止路径立即失败并回滚。
8. 成功必须同时满足范围检查和项目验证；失败必须留下 `controlled-execution.json` 或 `smart-compose-run.json` 审计记录。

## 交互原则

- 不向普通用户暴露底层 CLI 细节，只说明结果、确认项和失败原因。
- 可以从仓库、产品文档和现有模式推断的内容不得询问。
- 需要确认时说明影响范围、推荐选项和不确认的风险。
- 旧项目默认增量模式，不以“统一规范”为理由大面积重写历史代码。

## 前端默认约束

- Vue 3：Composition API、`<script setup lang="ts">`、Element Plus 默认配色。
- React：遵循当前标准模板和 Ant Design 默认主题。
- 全局主题只从项目约定的唯一入口修改；Vue 标准入口为 `src/theme/theme.css`。
- 模块通过静态 assembler 装配，不直接跨模块引用私有实现。

## 完成输出

```text
status: completed | planned | needs-confirmation | rolled-back | failed
scope: 实际 create / modify / delete 文件
validation: 已执行检查及结果
questions: 一次性必须确认项（如有）
record: 审计记录路径
rollback: 是否发生及事务路径
```
