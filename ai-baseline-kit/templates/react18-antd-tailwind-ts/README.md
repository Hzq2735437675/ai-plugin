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
│   ├── api/                    # 项目统一请求入口
│   ├── components/
│   └── types/
├── modules/
│   └── home/                    # 示例业务模块
│       ├── access.ts
│       ├── api/
│       ├── assets/
│       ├── components/
│       ├── directives/
│       ├── index.ts
│       ├── locales/
│       ├── manifest.ts
│       ├── menu.ts
│       ├── pages/
│       ├── routes.ts
│       ├── stores/
│       ├── styles/
│       └── types/
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


## 全局主题与模块生成

- 唯一全局主题入口：`src/theme/theme.css`。默认视觉：Ant Design 5 原生默认 token。
- 页面和模块样式消费 `--app-*` 语义变量，不复制品牌 token。
- `src/app/module-assembler.ts`、模块 routes/menu/access 内置受控标记，可由 `feature-generate.mjs` 安全新增或扩展模块。
- 每个模块必须包含 `module.meta.json`、`manifest.ts`、`acceptance.md` 和唯一公开 `index.ts`。


## 验收测试与边界验证

```bash
npm run test
node ai-baseline-kit/scripts/ast-boundary-check.mjs --require-parser
npm run typecheck
npm run build
```

模块 `tests/` 由 Feature Spec 自动生成；Playwright 浏览器执行使用 `npm run test:e2e`，首次运行前按 Playwright 提示安装浏览器。


## 模块样式隔离

- Vite 已内置 CSS Modules，不需要安装额外样式唯一化插件。 这是当前模板的默认 adapter；装配系统本身还支持在项目地图中登记其他隔离策略。
- 模块级样式使用 `styles/<module-id>.module.css`；组件级样式使用 `<Owner>.module.css`，使用 Less/SCSS 时保持同样的 `.module.<ext>` 规则。
- 页面或组件必须通过 `import styles from './Owner.module.css'` 绑定导入，并使用 `styles.xxx`；禁止副作用导入模块局部样式。
- 模板默认使用 `semantic-module-page-feature`：页面 owner 为 `<module-id>-<page-id>.module.css`，局部类名按模块 + 页面 + 功能 + 角色生成；构建规则仍为 `m_[name]_[local]__[hash:base64:6]`。
- `:root`、`html`、`body`、`#app`、`#root` 只能由全局主题/应用入口管理；第三方组件覆盖可在 owner 内谨慎使用 `:global(...)`。
