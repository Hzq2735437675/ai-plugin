# packages/

这是未来新增 AI 能力包的标准目录。

当前的 `ai-baseline-kit/` 仍保留在仓库根目录，因为它需要以完整目录直接植入目标项目，并遵守 `baseline_root = ai-baseline-kit/` 的兼容约定。后续新包默认放在：

```text
packages/<package-name>/
```

每个包必须自包含以下内容：

```text
packages/<package-name>/
├── README.md
├── plugin.json
├── INSTALL.md
└── <primary-entry>
```

其中：

- `README.md`：包能力、适用边界和目录说明。
- `plugin.json`：名称、语义化版本号、入口、分发方式和依赖元数据。
- `INSTALL.md`：安装、植入、升级、卸载和验证说明。
- `<primary-entry>`：AI 或运行时使用的明确主入口，例如 `AGENTS.md`、`SKILL.md` 或 `index.js`。

新增包后必须同步更新仓库根目录的 `package-registry.json`，不能只创建目录而不登记。包独立版本管理，但共享本仓库的包契约和检查脚本。
