---
name: project-scheme-bootstrap
description: 自动引导新项目或旧项目生成 docs/project-scheme.yml 的 bootstrap skill。适用于项目首次接入基线规则、缺少 project-scheme.yml、空目录从零建项目、用户已指定技术栈的新项目、用户只给业务需求但未指定技术栈的新项目、旧项目中途纳入基线，或需要自动识别技术栈、目录分层、路由、状态、i18n、API client、模块和验证命令时；优先从用户需求和仓库文件推断，无法可靠判断时只提出最少确认问题。
---

# Project Scheme Bootstrap

## 目标
在不要求用户手写 `project-defined` 的前提下，为新项目或旧项目生成 `docs/project-scheme.yml`。在整包植入模式下，该文件位于 `ai-baseline-kit/docs/project-scheme.yml`，扫描对象是 `ai-baseline-kit` 的父目录。该 skill 负责先把项目地图和边界立起来，让后续开发可以按基线从容推进。

## 触发场景
- `docs/project-scheme.yml` 不存在。
- 新项目刚复制基线包，还没有项目地图。
- 空目录或近似空目录中，用户已经说明要使用的技术栈。
- 空目录或近似空目录中，用户只说明业务需求，没有说明技术栈。
- 旧项目中途接入基线规则。
- 需要重新识别项目真实技术栈、目录、入口、模块和验证命令。

## 必须读取
优先读取：
- `AGENTS.md`
- `docs/baseline-rules.yml`
- `docs/engineering-workflow.yml`
- `package.json`、lockfile、workspace 配置
- Vite、Webpack、Next、Nuxt、Vue CLI、Angular、Svelte、Astro、Umi、Rsbuild、Rspack 等配置文件
- TypeScript、ESLint、Prettier、Stylelint、Tailwind、PostCSS 等配置
- `src/`、`app/`、`pages/`、`router/`、`routes/`、`store/`、`stores/`、`i18n/`、`locales/`、`api/`、`services/`、`components/`、`modules/` 等目录
- 用户当前需求中的应用类型、目标端、技术栈、UI 库、语言、业务域和约束

路径约定：
- `baseline_root`: `ai-baseline-kit/`。
- `project_root`: `ai-baseline-kit/` 的父目录。
- 生成文件写入 `baseline_root/docs/project-scheme.yml`。
- 扫描依赖、源码、路由、模块和资源时使用 `project_root`。

## 场景判断
先判断当前属于哪种场景：

1. **旧项目中途接入**：存在 package manifest、源码目录、构建配置或已有业务代码。
2. **新项目且已指定技术栈**：仓库为空或近似为空，但用户需求里明确给出框架、构建工具或 UI 库，例如 Vue3 + Vite、React + Vite、Next.js、Nuxt。
3. **新项目但未指定技术栈**：仓库为空或近似为空，用户只给业务目标，例如“做一个设备管理后台”。

不同场景使用不同策略，不要混用。

## 新项目策略
### 已指定技术栈
当用户已经说明技术栈时：

1. 从用户需求中提取：
   - framework
   - ui_library
   - language
   - build_tool
   - router
   - state_manager
   - i18n
   - style_solution
   - app_type 或 target
2. 如果某些字段未明说，但能由技术栈常识稳定推断，可以写入推断值，并在 `evidence` 中标记来自用户需求或常见搭配。
3. 生成 `baseline_root/docs/project-scheme.yml` 初版。
4. 允许后续初始化项目骨架，但骨架创建必须由 `baseline-structure-skill` 先规划范围。

### 未指定技术栈
当仓库为空且用户未说明技术栈时：

1. 不要自行决定 Vue、React、Next、Nuxt 或其他框架。
2. 先生成一个最小 `baseline_root/docs/project-scheme.yml`：
   - 已知业务目标写入 `project.purpose`
   - 技术栈字段写 `unknown`
   - `confidence` 写 `low`
   - `required_questions` 只列最少关键问题
3. 只问足以开始搭建项目的问题，通常不超过 3 个：
   - 目标端或应用类型，例如 Web 后台、官网、移动端、小程序、桌面端。
   - 技术栈偏好，例如 Vue3 + Vite、React + Vite、Next.js。
   - UI 库偏好，例如 Ant Design、Element Plus、无 UI 库。
4. 用户回答后，更新 `docs/project-scheme.yml`，再进入 `baseline-structure-skill`。

## 旧项目策略
旧项目中途接入时：

1. 优先从仓库文件推断真实技术栈和目录结构。
2. 只生成或更新 `docs/project-scheme.yml`。
3. 不移动旧代码，不做结构重构，不创建新模块。
4. 对不符合基线的旧结构，只记录现状和风险，后续改造必须另走结构化规划。

## 扫描规则
1. 从用户需求、依赖和配置推断：
   - framework
   - ui_library
   - language
   - build_tool
   - router
   - state_manager
   - i18n
   - style_solution
2. 从目录结构推断：
   - shell_root
   - shared_root
   - modules_root
   - base_components_root
   - common_assets_root
3. 从入口文件推断：
   - app
   - router
   - module_assembler
   - menu_assembler
   - access_assembler
   - locale_assembler
   - store_assembler
   - api_client
   - permission_context
4. 从已有文件推断模块：
   - 模块目录
   - manifest 或等价入口
   - routes、menus、stores、locales、api、assets
   - 已知依赖
5. 从 scripts 推断验证命令：
   - typecheck
   - lint
   - test
   - build

## 写入规则
生成或更新 `baseline_root/docs/project-scheme.yml`：

- 能可靠推断的字段写入具体值。
- 不能可靠推断的字段写 `unknown`。
- 不要为了填满字段编造路径或技术栈。
- 在 `required_questions` 中列出最少确认问题。
- 在 `confidence` 中标记 `high`、`medium` 或 `low`。
- 在 `evidence` 中记录关键判断依据，例如文件路径、依赖名或配置名。
- 新项目未指定技术栈时，可以先写低置信度 scheme，但不得开始生成业务代码。
- 旧项目接入时，不移动旧文件，不创建模块结构，不改变路由或构建配置。

## 输出结构
`baseline_root/docs/project-scheme.yml` 至少包含：

```yaml
project:
  name: detected-or-unknown
  purpose: unknown
  scheme_version: 0.1.0
  updated_at: YYYY-MM-DD
  update_source: project-scheme-bootstrap

stack:
  framework: detected-or-unknown
  ui_library: detected-or-unknown
  language: detected-or-unknown
  build_tool: detected-or-unknown
  router: detected-or-unknown
  state_manager: detected-or-unknown
  i18n: detected-or-unknown
  style_solution: detected-or-unknown

layers:
  shell_root: detected-or-unknown
  shared_root: detected-or-unknown
  modules_root: detected-or-unknown
  base_components_root: detected-or-unknown
  common_assets_root: detected-or-unknown

entrypoints:
  app: detected-or-unknown
  router: detected-or-unknown
  module_assembler: detected-or-unknown
  api_client: detected-or-unknown

modules:
  root: detected-or-unknown
  items: []

validation:
  typecheck: detected-or-unknown
  lint: detected-or-unknown
  test: detected-or-unknown
  build: detected-or-unknown

required_questions: []
confidence: medium
evidence:
  - source: package.json or user_request
    finding: detected fact
```

## 失败处理
- 如果仓库为空或尚未选择技术栈，先从用户需求提取；仍无法判断时，只问目标端、技术栈和 UI 库这类最少关键问题。
- 如果用户要求“你来决定技术栈”，可以根据应用类型给出一个保守推荐，但必须把该选择写入 `evidence` 和 `required_questions` 或方案说明中，等待用户确认后再搭建。
- 如果多个框架信号冲突，保留 `unknown` 并列出冲突证据。
- 如果缺少模块结构，不强制创建；只记录当前项目尚未模块化。
- 如果目标项目已经有等价架构文档，优先把它吸收到 `project-scheme.yml`，不要另立一套冲突规则。
