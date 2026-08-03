---
name: baseline-structure-skill
description: 开发前将任意项目的变更需求整理成符合项目基线的结构化实现方案。适用于新增或修改页面、模块、路由、组件、API、store、配置、样式、国际化、依赖，或进行局部重构；优先读取当前仓库的 AGENTS.md、docs/baseline-rules.yml 或同等规则文件。
---

# Baseline Structure Skill

## 目标
在编码前，把普通需求转成可执行、可审计、符合当前项目基线的开发方案。该 skill 不绑定具体项目、框架或目录名；项目差异必须来自当前仓库的规则文件。

标准可移植入口为 `skills/baseline-structure-skill/SKILL.md`。

整包植入模式下：
- `baseline_root`: `ai-baseline-kit/`，本 skill、规则和工作流位于此目录；包内 `docs/project-scheme.yml` 仅是仓库参考地图。
- `project_root`: `ai-baseline-kit/` 的父目录，业务代码、依赖、路由、模块和资源均按此目录读取或修改。
- 读取规则时优先使用 `baseline_root`；规划业务变更时只触碰 `project_root` 中的目标范围。

## 与产品需求闭环的关系

- 输入是自然语言、产品文档或原型说明时，先使用 `requirement-to-feature-spec`，不得跳过 blocking `requiredQuestions`。
- 复杂功能或模块变更在本 skill 前先使用 `feature-architecture-planner` 生成 change plan；本 skill 以 `files.allowedRoots` 为硬边界补充实现细节。
- 简单、明确且不改变模块边界的小改动可直接使用本 skill，但仍需记录最小范围。

## 输入
优先读取：
- `ai-baseline-kit/AGENTS.md` 或当前仓库的 `AGENTS.md`
- `ai-baseline-kit/docs/baseline-rules.yml` 或当前仓库的 `docs/baseline-rules.yml`
- `ai-baseline-kit/docs/engineering-workflow.yml` 或当前仓库的 `docs/engineering-workflow.yml`（若存在）
- `project_root/.ai-frontend-assembler/project-scheme.yml`（目标项目地图；缺失时先 bootstrap）
- 当前仓库已有的同等基线、架构、目录或开发规范文件
- 用户需求和已知目标文件

如果缺少项目规则文件，先基于仓库现有目录和代码模式推断；无法安全推断时，说明缺口。

## 输出
输出一份简短结构化方案，至少包含：
- 目标层级或边界
- 目标模块或领域
- 目标页面或入口
- 路由或装配点
- 组件
- API 或服务
- store、状态或缓存
- locales、文案或配置
- styles 或主题
- dependencies
- validation
- build isolation（涉及构建、部署、输出目录或 package scripts 时）

小改动可以输出压缩版，但必须覆盖范围、影响面和验证点。

## 工作流
1. 读取项目入口规则，确认 `ai-baseline-kit/AGENTS.md`、包内规则/工作流和 `.ai-frontend-assembler/project-scheme.yml` 是否存在。
2. 判断需求归属：骨架/应用层、共享层、模块/业务域层，或项目自定义分层。
3. 找到最小安全改动范围，列出会触碰的文件或目录。
4. 标出新增内容的归属：页面、路由、组件、API、状态、样式、文案、配置、依赖。
5. 检查是否存在跨层、跨模块、命名、样式、国际化、依赖或装配风险。
   - 如果项目规则或现有体系要求国际化，且本次涉及用户可见文案，在方案中写明：`locales: 使用 project-i18n-localizer 独立完成国际化配置或文案抽取`。
   - 如果项目没有国际化规则或现有 i18n 体系，不强制新增国际化，只标注当前项目未启用或未要求。
6. 明确开发后应运行的回归检查；涉及构建或部署时，同时确认部署 ignore、npm 嵌套排除、`scripts.postbuild` 和实际输出目录守卫。

## 失败处理
- 如果需求跨越多个模块或边界，先拆分方案，或把复用能力上移到项目规定的共享层。
- 如果目标目录不清楚，先通过仓库模式推断；仍不明确时停止并提出边界问题。
- 如果项目规则与用户要求冲突，说明冲突点，并优先请求确认。
- 不为赶进度跳过结构化判断。

## 示例
```text
目标层级或边界: modules
目标模块或领域: billing/order
目标页面或入口: pages/order-list
路由或装配点: 模块 routes.ts
组件: order-filter, order-table
API 或服务: order list query
store、状态或缓存: 无新增全局状态
locales、文案或配置: 模块 zh/en 文案
styles 或主题: 页面目录 index.scss
dependencies: 不新增第三方依赖
build isolation: 保持 ai-baseline-kit 与项目装配状态不进入构建产物
validation: 检查无跨模块直接引用、路由在模块入口注册、样式和文案归属正确，并运行 build-artifact-guard --check
```
