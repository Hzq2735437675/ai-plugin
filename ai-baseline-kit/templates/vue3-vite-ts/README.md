# Vue 3 + Vite + TypeScript 标准模板

这是 `ai-baseline-kit` 支持的 Vue 标准模板，适用于：

- 新建前端项目。
- 用户明确选择 Vue 3 + Vite。
- 目标项目尚未形成既有业务技术栈。

旧项目即使使用 Vue，也不能直接套用本模板；旧项目必须先扫描并保留原有目录、依赖、路由和状态管理。

## 技术栈

```text
Vue 3
TypeScript
Vite
Vue Router 4
```

UI 库、状态管理、国际化和 API Client 保持 `project-defined`，只有业务确实需要时再接入。

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
├── app/
│   ├── App.vue
│   ├── AppShell.vue
│   ├── module-assembler.ts
│   └── router.ts
├── shared/
│   ├── components/
│   └── types/
├── modules/
│   └── home/
│       ├── index.ts
│       ├── manifest.ts
│       └── pages/
├── main.ts
└── styles.css
```

模块能力通过 `src/app/module-assembler.ts` 静态装配，路由通过 `src/app/router.ts` 集中注册，模块之间不得直接引用彼此的私有实现。

## 模板边界

本模板不预置：

- 业务 API。
- 登录和权限实现。
- 全局状态管理。
- 国际化资源。
- 生产部署配置。
- 具体业务模块以外的复杂基础设施。

这些能力应由 AI 根据需求先规划，再按 `ai-baseline-kit` 的边界规则逐项增加。
