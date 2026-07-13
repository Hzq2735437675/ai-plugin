# AI Baseline Kit 安装与植入说明

- 包名：`ai-baseline-kit`
- 当前版本：`0.3.0`
- 包元数据：[`plugin.json`](plugin.json)
- 主入口：[`AGENTS.md`](AGENTS.md)
- 详细说明：[`README.md`](README.md)

## 适用方式

这是一个**完整目录植入包**，不是需要安装到目标项目依赖树中的运行时库。植入时必须保留 `ai-baseline-kit/` 目录结构，不要把其中的 `docs/`、`skills/`、`scripts/` 拆散到目标项目根目录。

## 最小植入：只复制一个目录

将本包的整个目录复制到目标项目根目录即可：

```text
<target-project>/
└── ai-baseline-kit/
```

复制后，向 AI 说明“本项目已植入 `ai-baseline-kit`”，并要求先读取：

```text
ai-baseline-kit/AGENTS.md
```

`ai-baseline-kit/` 内已经包含规则、skills、项目地图模板、默认新项目模板、入口文档、包元数据和无第三方依赖的检查脚本，不依赖本仓库的 Git 历史或根目录文件。

## 可选：接入 AI 工具的根级自动入口

部分 AI 工具只会自动读取目标项目根目录的 `AGENTS.md` 或 `CLAUDE.md`。为了让这些工具无需额外提示就发现本包，可在目标项目根目录创建或追加入口约束：

```text
本项目使用内嵌 AI 基线规范包。任何代码改动前，先读取：
ai-baseline-kit/AGENTS.md
```

目标项目已有 `AGENTS.md` 或 `CLAUDE.md` 时，不要覆盖原内容，只追加上述入口约束。根级入口是**可选的激活适配层**，不是 `ai-baseline-kit/` 的运行依赖。

## 新项目植入

1. 复制 `ai-baseline-kit/` 到目标项目根目录。
2. 如果项目是前端项目且未指定技术栈，AI 使用 `templates/react18-antd-tailwind-ts/` 作为默认起点。
3. 如果用户明确选择 Vue 3 + Vite，AI 使用 `templates/vue3-vite-ts/`。
4. 如果用户已经指定其他技术栈，用户选择优先；本包不自动生成第三方标准模板。
5. 首次接入前运行诊断并生成或审核 `ai-baseline-kit/docs/project-scheme.yml`。
6. 先读取结构规划 skill，再开始实现。
7. 开发后运行基线一致性回归。

## 项目工具命令

在目标项目根目录执行：

```bash
# 诊断技术栈和项目边界
node ai-baseline-kit/scripts/project-doctor.mjs

# 生成/更新项目地图
node ai-baseline-kit/scripts/project-bootstrap.mjs

# 仅在空目录初始化标准模板（二选一）
node ai-baseline-kit/scripts/project-bootstrap.mjs --init-template --stack react18-antd-tailwind-ts
node ai-baseline-kit/scripts/project-bootstrap.mjs --init-template --stack vue3-vite-ts

# 统一验证
node ai-baseline-kit/scripts/project-validate.mjs --typecheck --build
```

内置标准模板只有 React 18 + Vite 与 Vue 3 + Vite 两个。检测到旧项目后，bootstrap 只生成项目地图，不会复制模板；旧项目的 Vue、React、Angular 等技术栈都原样保留。

## 已有项目植入

1. 复制 `ai-baseline-kit/` 到目标项目根目录。
2. AI 扫描 package manifest、lockfile、源码入口、构建配置、路由、状态、i18n 和模块目录。
3. 保留 Vue、React、Angular 或其他旧技术栈，不自动迁移到默认 React 模板。
4. 生成或审核 `ai-baseline-kit/docs/project-scheme.yml`，记录真实结构和边界。
5. 只按旧项目现有架构和本包规则开发增量需求。
6. 回归检查：

```bash
node ai-baseline-kit/scripts/baseline-check.mjs
```

## 目录约定

植入后：

- `baseline_root`：`ai-baseline-kit/`
- `project_root`：`ai-baseline-kit/` 的父目录，也就是目标项目根目录
- 规则、skill、模板和检查脚本：位于 `baseline_root`
- 业务代码、依赖、路由、模块和资源：位于 `project_root`

## 升级

升级时以包版本为单位替换完整的 `ai-baseline-kit/` 目录，并保留目标项目根目录已有的 AI 入口文件和业务代码。升级后重新运行：

```bash
node ai-baseline-kit/scripts/baseline-check.mjs
```

如果目标项目的基线规则或项目地图发生变化，应由 AI 按当前版本重新读取并审核 `docs/project-scheme.yml`。

## 卸载

删除目标项目根目录的 `ai-baseline-kit/`。如果曾经在根级 `AGENTS.md` 或 `CLAUDE.md` 中追加入口约束，也一并移除专门为本包添加的段落，但不要删除原有内容。

## 版本规则

包版本遵循语义化版本号：

- `MAJOR`：植入协议、入口或目录契约不兼容。
- `MINOR`：向后兼容地新增 skill、规则或检查能力。
- `PATCH`：向后兼容地修复文档、规则或脚本问题。

## 技术栈选择

植入包后，AI 会根据目标项目状态选择开发模式：

- **旧项目**：检测到 `package.json`、lockfile、源码、构建配置、路由或应用入口时，保留旧项目真实技术栈。Vue、React、Angular 等都可以接入，不自动迁移。
- **新前端项目**：没有既有应用技术栈且用户没有指定其他方案时，使用 `templates/react18-antd-tailwind-ts/` 作为默认起点。
- **Vue 新项目**：用户明确选择 Vue 3 + Vite 时，使用 `templates/vue3-vite-ts/`。
- **用户指定优先**：用户在初始化前指定其他技术栈时，按用户选择创建项目，并继续使用本包的边界、模块、装配和回归规则。

默认策略文件：

```text
ai-baseline-kit/docs/stack-profiles.yml
```

标准模板说明：

```text
ai-baseline-kit/templates/react18-antd-tailwind-ts/README.md
ai-baseline-kit/templates/vue3-vite-ts/README.md
```

模板只在新项目初始化时作为可运行参考，不应套用于已有项目。
