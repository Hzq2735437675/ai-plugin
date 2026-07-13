# React 18 + Ant Design + Tailwind CSS + TypeScript 默认模板

这是 `ai-baseline-kit` 在**新建前端项目且没有既定技术栈**时使用的默认参考模板。

## 适用条件

只有同时满足以下条件时才使用本模板：

- 项目是新的前端项目。
- 项目根目录没有已有应用源码、package manifest、构建配置或路由入口。
- 用户没有在初始化前指定其他技术栈。

如果是旧项目，即使旧项目使用 Vue、React 或其他框架，也必须优先识别并保留旧项目的技术栈，不得自动迁移到本模板。

## 默认技术栈

```text
React 18
TypeScript
Vite
Ant Design 5
Tailwind CSS 3
React Router 6
```

状态管理和国际化保持 `project-defined`：只有业务确实需要时再选择并接入，避免模板预置不必要的全局复杂度。

## 运行

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

## 结构

```text
src/
├── app/                         # shell、路由和静态模块装配
│   ├── App.tsx
│   ├── AppRoutes.tsx
│   ├── AppShell.tsx
│   └── module-assembler.ts
├── shared/                      # 跨模块复用的类型和组件
│   ├── components/
│   └── types/
├── modules/
│   └── home/                    # 示例业务模块
│       ├── index.ts
│       ├── manifest.tsx
│       └── pages/
├── main.tsx
└── styles.css
```

模块通过 `src/app/module-assembler.ts` 静态暴露能力，再由 `AppRoutes.tsx` 装配路由。后续业务模块应保持相同的显式装配方式，不通过运行时全量扫描或跨模块私有路径导入实现隐式耦合。

## 模板边界

本模板只提供最小可运行骨架，不预置：

- 业务 API
- 登录和权限实现
- 全局状态管理
- 国际化资源
- 具体业务模块
- 生产环境部署配置

这些能力应根据项目需求，按 `ai-baseline-kit` 的结构规划流程逐项增加。
