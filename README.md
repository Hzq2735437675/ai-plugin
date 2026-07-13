# ai-plugin

面向 AI 开发能力包的多包仓库。

本仓库的每个能力包都应能够被独立识别、阅读、复制和植入目标项目。包本身不依赖本仓库的 Git 历史才能使用；包目录内必须包含自己的元数据、入口文档和安装说明。

## 当前包

| 包 | 版本 | 类型 | 入口 | 安装/植入说明 |
| --- | --- | --- | --- | --- |
| `ai-baseline-kit` | `0.2.0` | 可嵌入 AI 工程基线包 | [`ai-baseline-kit/AGENTS.md`](ai-baseline-kit/AGENTS.md) | [`ai-baseline-kit/INSTALL.md`](ai-baseline-kit/INSTALL.md) |

完整登记信息见 [`package-registry.json`](package-registry.json)。

## 仓库布局

```text
ai-plugin/
├── ai-baseline-kit/       # 当前可直接植入目标项目的兼容包
├── packages/              # 后续新增能力包的标准目录
├── package-registry.json  # 包索引和分发信息
├── package-*.schema.json  # 包元数据契约
└── scripts/
    └── package-check.mjs  # 包结构和元数据检查
```

当前 `ai-baseline-kit/` 保持在仓库根目录，是为了兼容它作为完整目录植入目标项目时的 `baseline_root` 约定。新增包默认放在 `packages/<package-name>/`，不应直接复制现有包的私有实现或隐式依赖。

## 包契约

每个包至少包含以下文件：

```text
<package-name>/
├── README.md       # 包定位、能力和使用说明
├── plugin.json     # 名称、版本、入口和分发元数据
├── INSTALL.md      # 安装、植入、升级和验证说明
└── <primary-entry> # AI 或运行时的主入口，例如 AGENTS.md
```

约定：

- `plugin.json` 是包身份和版本的机器可读来源，版本使用语义化版本号。
- `README.md` 面向人和 AI 介绍包能力、边界和目录。
- `INSTALL.md` 说明复制/安装、已有项目接入、升级和验证流程。
- `plugin.json.entrypoints.primary` 必须指向包的主入口。
- 所有包依赖、伴随文件和目标布局都必须在包元数据或安装文档中显式说明。
- 包之间不得通过隐式相对路径耦合；跨包复用应登记为显式依赖。

## 检查

```bash
node scripts/package-check.mjs
node ai-baseline-kit/scripts/baseline-check.mjs
```

## 新增包流程

1. 在 `packages/<package-name>/` 创建包目录。
2. 添加独立的 `README.md`、`plugin.json`、`INSTALL.md` 和主入口文件。
3. 在 `package-registry.json` 登记包名、版本、路径、入口和安装说明。
4. 运行 `node scripts/package-check.mjs`。
5. 更新项目地图并运行基线回归。
6. 使用独立提交记录包的新增或版本升级。

## 技术栈策略

复制 `ai-baseline-kit/` 到其他项目后，AI 按以下优先级工作：

1. 用户明确指定的技术栈。
2. 旧项目扫描得到的真实技术栈，并保持原项目技术栈开发。
3. 新前端项目默认采用 React 18 + TypeScript + Vite + Ant Design 5 + Tailwind CSS 3 + React Router 6。

因此，同一个基线包既可以接入 Vue、React 等旧项目，也可以作为未定技术栈项目的默认 React 工程起点。默认策略和参考模板位于 `ai-baseline-kit/docs/stack-profiles.yml` 与 `ai-baseline-kit/templates/react18-antd-tailwind-ts/`。
