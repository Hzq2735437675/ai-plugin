---
name: baseline-conformance-skill
description: 开发后检查任意项目的新增或修改内容是否符合当前项目基线。适用于验证模块边界、目录层级、跨模块引用、路由或装配、样式、国际化、命名、依赖和遗漏项；优先读取当前仓库的 AGENTS.md、docs/baseline-rules.yml 或同等规则文件，并驱动修复到验证闭环。
---

# Baseline Conformance Skill

## 目标
在实现完成后，按当前仓库的基线规则做结构回归，给出明确的 pass/fail、违规项、修复方向和重新验证建议。该 skill 不绑定具体项目、框架或目录名。

标准可移植入口为 `skills/baseline-conformance-skill/SKILL.md`。

整包植入模式下：
- `baseline_root`: `ai-baseline-kit/`，本 skill、规则、工作流和脚本位于此目录；包内 `docs/project-scheme.yml` 仅是仓库参考地图。
- `project_root`: `ai-baseline-kit/` 的父目录，业务代码、依赖、路由、模块和资源均按此目录检查。
- 回归时优先读取 `baseline_root` 中的规则；违规修复只修改 `project_root` 的目标业务范围，除非用户明确要求维护规范包。

## 输入
优先读取：
- `ai-baseline-kit/AGENTS.md` 或当前仓库的 `AGENTS.md`
- `ai-baseline-kit/docs/baseline-rules.yml` 或当前仓库的 `docs/baseline-rules.yml`
- `ai-baseline-kit/docs/engineering-workflow.yml` 或当前仓库的 `docs/engineering-workflow.yml`（若存在）
- `project_root/.ai-frontend-assembler/project-scheme.yml`（目标项目地图）
- 当前仓库已有的同等基线、架构、目录或开发规范文件
- 本轮变更文件
- 开发前结构化方案

如果缺少结构化方案，先根据变更文件补一个最小方案，再回归。

## 输出
必须输出：
- `pass` 或 `fail`
- `violations`
- `required_fixes`
- `rerun`
- `verify`

没有问题时，也要说明剩余风险或未运行的验证。

## 检查项
1. 改动是否停留在预期边界内。
2. 页面、模块、组件、API、store、配置、样式、文案是否放在正确层级。
3. 是否存在跨模块、跨领域或反向依赖。
4. 路由、菜单、权限、依赖注入或其他装配点是否集中、显式、可裁剪。
5. 样式是否符合项目规则，例如外置、命名、作用域或主题约束。
6. 国际化或文案是否补齐并放在所属层。
   - 如果项目要求国际化，检查是否存在未抽取的用户可见文案、语言文件未同步、key 领域归属错误、动态文案被字符串拼接。
   - 发现国际化问题时，要求使用 `project-i18n-localizer` 重新修复；本 skill 只记录基线违规和修复方向。
7. 命名是否符合项目规则。
8. 是否新增不必要依赖，或遗漏必须注册/导出的依赖。
9. 整包植入时，目标项目 `.gitignore` 是否隐藏 `ai-baseline-kit/`，从而导致规范包变化不可见。
10. 是否误改无关文件。

## 新项目与旧项目验证模式

- 标准新项目：`baseline-check --mode full --fail-on-warn`。
- 已建立 `.ai-frontend-assembler/legacy-baseline.json` 的旧项目：`baseline-check --mode changed --fail-on-warn`，历史违规不阻断，但任何新增违规都必须修复。
- 新增模块即使位于旧项目，也必须完整拥有 `module.meta.json`、manifest、acceptance、契约目录和公开入口。
- 不得通过刷新 legacy snapshot 绕过本轮新增违规。

## fix -> verify 闭环
1. 如果结果为 `fail`，只修复 `violations` 中列出的项。
2. 每轮修复后重新运行同一检查。
3. 建议最多 3-5 轮，避免无限循环。
4. 如果连续失败来自规则歧义，停止并说明需要用户或项目规则确认。
5. 只有无剩余违规项时才给出 `pass`。

## 示例
```text
pass: fail
violations:
  - 新页面放在共享层，但只被单一模块使用
  - 组件直接导入了另一个模块的 store
required_fixes:
  - 将页面移回所属模块目录
  - 将可复用状态抽到共享层，或改为模块内私有状态
rerun: 修复后重新执行 baseline-conformance-checker
verify: 预期页面归属正确，无跨模块直接导入，无遗漏文案或样式
```
