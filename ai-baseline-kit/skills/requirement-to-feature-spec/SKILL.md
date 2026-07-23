---
name: requirement-to-feature-spec
description: 将任意人员的自然语言需求、详细大白话、产品文档或已提取的原型说明转换为机器可读 Frontend Feature Spec；识别事实、推断和缺口，对影响模块边界、权限、API、路由、状态或验收的未知项必须先向用户提问，确认后才能进入代码生成。
---

# Requirement to Feature Spec

## 目标
把自然语言或产品文档转换为 `docs/features/<feature-id>.feature.json`。本 skill 负责语义理解和确认闭环；确定性脚本只负责初步抽取与结构校验，不能替代产品判断。

## 必读
1. `ai-baseline-kit/AGENTS.md`
2. `docs/baseline-rules.yml`
3. `docs/project-scheme.yml`；缺失或为参考地图时先运行 project bootstrap
4. `docs/feature-spec.schema.json` 与 `docs/feature-spec.template.json`
5. 用户消息、上传文档、API 文档、原型说明和已有项目代码

## 流程
1. 完整阅读输入；若工具无法直接读取 PDF、Word、图片或链接，先提取内容，不能假装已读。
2. 将信息分成：`explicit`（文档明确）、`inferred`（有证据推断）、`unknown`（必须确认）。
3. 识别 actors、pages、actions、entities、API、state、permissions、dependencies、UI、acceptance。
4. 判断功能归属：已有模块、新模块、shared 或 shell。不能只因多个页面复用就放 shared；业务域能力默认属于模块。
5. 为每个页面列出 loading、empty、error、ready、permission-denied 等适用状态。
6. 将所有阻断未知项写入 `requiredQuestions`，一次只问最少、最关键的问题；用户回答后更新同一规格。
7. 只有 `requiredQuestions` 无 blocking 项且验收条件可验证时，才将 `status` 改为 `ready`。
8. 运行：
   `node ai-baseline-kit/scripts/requirement-compile.mjs --input <spec.json> --output docs/features/<id>.feature.json`

## 必须提问的情况
- 模块归属、稳定英文标识或路由不明确。
- 文档提到权限但没有权限码、角色或无权限行为。
- 文档提到 API 但没有方法、路径或关键请求/响应契约。
- 删除、审批、支付、发布等高风险动作缺少确认和失败策略。
- 页面状态、数据持久化、跨模块复用或验收条件不明确。
- 用户要求与项目现有技术栈或基线冲突。

## 禁止
- 猜测接口字段、权限码、业务状态机或产品验收事实。
- 因脚本生成了草稿就跳过用户确认。
- 在 feature spec ready 前直接生成业务代码。
- 把整个产品文档无筛选地复制进规格，造成上下文污染。

## 输出
- Feature Spec 路径和状态。
- explicit / inferred / unknown 摘要。
- 若未 ready：直接向用户提出 `requiredQuestions`。
- 若 ready：进入 `feature-architecture-planner`。
