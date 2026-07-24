---
name: intelligent-frontend-assembler
description: 以 smart-develop 为统一入口，将自然语言或多格式产品文档路由到新项目生成、旧项目增量、受控修复、模块抽离与跨项目装配闭环；自动聚合必须确认项，并强制 Change Plan、文件白名单、验收覆盖、验证门禁和失败回滚。
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
2. 所有自然语言、产品文档、API 文档、原型导出或 ready Feature Spec 优先进入：
   ```bash
   node ai-baseline-kit/scripts/smart-develop.mjs --request "<原话或文档路径>" --project-root "<目标项目>"
   ```
3. 文档先标准化；无法可靠读取的图片、扫描 PDF、在线 Figma 或二进制文档必须要求提取器/文本版本，不得猜测内容。
4. `smart-develop` 自动发现工作区并判断 `create-project`、`modify-feature`、`repair-project` 或 `compose-project`；组合任务由总控委托 `smart-compose`。
5. L0/L1/L2 且可机械证明安全的决定自动执行。L3、业务语义不明确或破坏风险不可证明时，将 blocking questions 一次性聚合后询问，不得一步一问。
6. 非 ready Feature Spec、存在 blocking questions、Change Plan 无 `files.allowedRoots` 时禁止写业务文件。
7. 新项目必须显式使用创建模式；旧项目默认增量模式，不得因为目标路径错误自动创建工程。
8. 所有写入必须进入 `controlled-change-executor`：目标项目外事务快照、实际 diff 白名单、禁止路径、验证门禁和失败回滚均不可绕过。
9. 自动修复默认最多 2 次、硬上限 3 次；每轮只能在原 Change Plan 范围内重新生成/修复，并重新执行范围检查和项目验证。
10. 生成测试时必须同时生成 acceptance coverage 清单；无法可靠推导的业务行为使用 `todo/fixme`，不得伪造自动化断言或测试通过。
11. 成功必须留下 `smart-develop-run.json` 和 `controlled-execution.json`；失败必须回滚并保留失败原因、验证输出和违规文件。

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
