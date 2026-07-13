# AI Baseline Kit 安装与植入说明

- 包名：`ai-baseline-kit`
- 当前版本：`0.1.0`
- 包元数据：[`plugin.json`](plugin.json)
- 主入口：[`AGENTS.md`](AGENTS.md)
- 详细说明：[`README.md`](README.md)

## 适用方式

这是一个**完整目录植入包**，不是需要安装到目标项目依赖树中的运行时库。植入时必须保留 `ai-baseline-kit/` 目录结构，不要把其中的 `docs/`、`skills/`、`scripts/` 拆散到目标项目根目录。

## 新项目植入

将以下内容复制到目标项目根目录：

```text
<target-project>/
├── ai-baseline-kit/
├── AGENTS.md
└── CLAUDE.md
```

其中 `AGENTS.md` 和 `CLAUDE.md` 是目标项目根入口；如果目标项目已有这两个文件，不要覆盖原内容，应追加基线入口约束。

## 已有项目植入

1. 复制 `ai-baseline-kit/` 到目标项目根目录。
2. 检查目标项目根目录是否存在 `AGENTS.md` 和 `CLAUDE.md`。
3. 不存在时，复制本仓库对应的根入口文件；已存在时，要求 AI 在不覆盖原文的前提下补齐基线入口。
4. 让 AI 先读取 `ai-baseline-kit/AGENTS.md`。
5. 首次接入时生成 `ai-baseline-kit/docs/project-scheme.yml`。
6. 运行基线检查：

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

升级时以包版本为单位替换完整的 `ai-baseline-kit/` 目录，并保留目标项目根目录已有的 `AGENTS.md`、`CLAUDE.md` 和业务代码。升级后重新运行：

```bash
node ai-baseline-kit/scripts/baseline-check.mjs
```

如果目标项目的基线规则或项目地图发生变化，应由 AI 按当前版本重新读取并审核 `docs/project-scheme.yml`。

## 卸载

删除目标项目根目录的 `ai-baseline-kit/` 后，同时移除根入口文件中专门为该包追加的基线约束段落。不要删除原有项目自己的 `AGENTS.md` 或 `CLAUDE.md` 内容。

## 版本规则

包版本遵循语义化版本号：

- `MAJOR`：植入协议、入口或目录契约不兼容。
- `MINOR`：向后兼容地新增 skill、规则或检查能力。
- `PATCH`：向后兼容地修复文档、规则或脚本问题。
