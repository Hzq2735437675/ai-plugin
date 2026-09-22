# Vue 3 + Vite + Element Plus + TypeScript 标准模板

这是 `ai-baseline-kit` 支持的 Vue 标准模板，适用于：

- 新建前端项目。
- 用户明确选择 Vue 3 + Vite。
- 目标项目尚未形成既有业务技术栈。

旧项目即使使用 Vue，也不能直接套用本模板；旧项目必须先扫描并保留原有目录、依赖、路由、状态管理和 UI 框架。

## 技术栈

```text
Vue 3
TypeScript
Vite
Vue Router 4
Element Plus
```

Element Plus 是 Vue 标准模板的默认 UI 框架。状态管理、国际化和 API Client 保持 `project-defined`，只有业务确实需要时再接入。用户在初始化前明确指定其他 Vue UI 框架时，以用户选择为准。

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
│   ├── api/                    # 项目统一请求入口
│   ├── components/
│   └── types/
├── modules/
│   └── home/
│       ├── access.ts
│       ├── api/
│       ├── assets/
│       ├── components/
│       ├── directives/
│       ├── index.ts
│       ├── locales/
│       ├── manifest.ts
│       ├── menu.ts
│       ├── module.meta.json
│       ├── pages/
│       ├── routes.ts
│       ├── stores/
│       ├── styles/
│       └── types/
├── theme/
│   └── theme.css              # 唯一项目级主题覆盖入口
├── main.ts
└── styles.css                 # 只维护应用布局，不定义第二套品牌 token
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

## 全局主题与模块生成

- Element Plus 组件由 `unplugin-vue-components` + `ElementPlusResolver` 在构建时按需导入；`src/main.ts` 不做全量注册。
- 唯一项目级主题覆盖入口是 `src/theme/theme.css`；默认不覆盖 `--el-*`，所以保留 Element Plus 原生默认配色。主题选择器使用 `html:root`，确保未来品牌变量覆盖不受组件样式注入顺序影响。
- 调整品牌视觉时只修改 `theme.css` 中的 Element Plus CSS 变量及 `--app-*` 语义映射，不在页面、shared 或 modules 中复制品牌 token。
- `src/styles.css` 只承载壳层和通用布局，模块局部样式仍随模块存放。
- `ElMessage`、`ElNotification` 等 JavaScript API 必须在使用文件中从 `element-plus` 显式导入，禁止额外引入 API 自动导入以保持依赖可审计。
- `src/app/module-assembler.ts`、模块 routes/menu/access 内置受控标记，可由 `feature-generate.mjs` 安全新增或扩展模块。
- 每个模块必须包含 `module.meta.json`、`manifest.ts`、`acceptance.md` 和唯一公开 `index.ts`，使用 Element Plus 的模块必须在静态与运行时依赖契约中声明 `element-plus`。


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
- 模块级样式使用 `styles/<module-id>.module.scss`；组件级样式使用 `<Owner>.module.scss`，使用 Less/CSS 时保持同样的 `.module.<ext>` 规则。
- 页面或组件必须通过 `import styles from './Owner.module.scss'` 绑定导入，并使用 `styles.xxx`；禁止副作用导入模块局部样式。
- 标准新项目默认使用 SCSS；旧项目新增页面在模块样式后缀唯一时保持一致的 `.module.<ext>`，混合多个后缀时回退 `.module.scss`，且不改写旧样式文件。模板使用 `semantic-module-page-feature`，页面 owner 为 `<module-id>-<page-id>.module.scss`，局部类名按模块 + 页面 + 功能 + 角色生成；构建规则仍为 `m_[name]_[local]__[hash:base64:6]`。
- `:root`、`html`、`body`、`#app`、`#root` 只能由全局主题/应用入口管理；第三方组件覆盖可在 owner 内谨慎使用 `:global(...)`。
