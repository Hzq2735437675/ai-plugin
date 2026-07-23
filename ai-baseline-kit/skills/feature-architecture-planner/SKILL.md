---
name: feature-architecture-planner
description: 将已确认的 Frontend Feature Spec 与目标项目地图转换为可执行、可审计的模块架构和文件变更计划；决定创建模块、扩展模块或共享能力，限定文件白名单、装配点和依赖，遇到旧项目未知边界或不安全装配时必须向用户确认。
---

# Feature Architecture Planner

## 目标
生成 `docs/plans/<feature-id>.plan.json`，在代码生成前固定模块归属、复用策略、装配点、依赖和允许修改的文件边界。

## 前置条件
- 读取 `ai-baseline-kit/AGENTS.md`、基线规则、工程工作流和 `docs/project-scheme.yml`。
- 输入 Feature Spec 必须为 `status: ready`，不存在 blocking `requiredQuestions`。
- 旧项目优先保留真实技术栈，并使用增量治理；不强迫一次重构历史代码。

## 决策规则
- `create-module`：独立业务域且目标模块不存在。
- `extend-module`：能力属于已有业务域。
- `shared-capability`：确有两个以上业务域复用、且不含单一业务域语义。
- `shell-change`：仅限启动、全局布局、主题、全局路由装配等应用级职责。
- 模块不得直接依赖其他模块；组合通过 shell 的公开 manifest 或 shared 契约完成。

## 计划内容
必须明确：
- ownership layer、module 和 moduleRoot。
- route/menu/access/locales/store/API/theme 的装配点。
- reuse、npm/shared/permission 依赖。
- `files.create`、`files.modify`、`files.allowedRoots`、`files.forbidden`。
- 模块 archetype、capabilities、可迁移范围和同栈限制。
- 验证命令与旧项目 `changed` 模式。

## 工作流
1. 运行：
   `node ai-baseline-kit/scripts/feature-plan.mjs --spec <feature-spec.json>`
2. 检查脚本输出与实际代码，不把脚本推断当作最终架构事实。
3. 若装配文件无受控标记、模块根目录未知、公共 ModuleManifest 契约未知、框架不受内置生成器支持，向用户提出最少确认问题。
4. 用户确认后更新 project scheme 或计划，直到 `status: ready`。
5. `create-module` / 受控 `extend-module` 可运行 `feature-generate.mjs`；其他决策由 AI 严格按文件白名单实现。
6. 生成后运行 conformance 和项目验证。

## 模块组合要求
每个新模块必须包含 `module.meta.json` 和运行时 `manifest.ts`：
- `module.meta.json` 描述能力、依赖、入口、来源和可迁移条件。
- `manifest.ts` 提供项目运行时装配。
- 公共入口只从 `index.ts` 暴露。
- 模块组合只改 shell 唯一静态装配器，不扫描目录、不使用动态 glob。
