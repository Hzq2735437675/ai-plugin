# Templates

这里存放新项目初始化时供 AI 使用的参考模板。模板不是旧项目迁移目标，也不是植入目标项目时必须复制的运行时依赖。

## 当前默认模板

```text
react18-antd-tailwind-ts/
```

适用条件：

- 目标是前端项目。
- 项目尚未确定技术栈。
- 项目根目录没有已有 package manifest、源码入口或构建配置。
- 用户没有在初始化前指定其他技术栈。

默认技术栈：

```text
React 18 + TypeScript + Vite + Ant Design 5 + Tailwind CSS 3
```

模板提供一个可运行的最小示例，展示 shell、shared、modules、静态模块装配、路由和基础验证命令。AI 应把它当作结构参考或新项目起点，而不是把模板目录本身当作目标项目的业务模块。

旧项目即使使用 Vue、React 或其他技术栈，也不应套用该模板；旧项目必须先走已有技术栈识别流程。
