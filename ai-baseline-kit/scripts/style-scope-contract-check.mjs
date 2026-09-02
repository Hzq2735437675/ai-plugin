#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  analyzeStyleIsolation,
  inferStyleIsolation,
  listStyleIsolationAdapters,
  resolveStyleIsolationPolicy,
  VITE_SCOPED_NAME_PATTERN,
} from './style-scope-lib.mjs';

const baselineRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-style-scope-'));

function write(root, relative, content) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

function project(name, packageJson = {}) {
  const root = path.join(tempRoot, name);
  fs.mkdirSync(root, { recursive: true });
  write(root, 'package.json', `${JSON.stringify({ name, private: true, ...packageJson }, null, 2)}\n`);
  return root;
}

try {
  assert.deepEqual(listStyleIsolationAdapters(), [
    'builtin-css-modules',
    'builtin-vue-scoped',
    'builtin-utility-css',
    'builtin-css-in-js',
    'builtin-shadow-dom',
    'builtin-hybrid',
  ]);

  const cssModulesRoot = project('css-modules');
  write(cssModulesRoot, 'vite.config.ts', `export default { css: { modules: { generateScopedName: '${VITE_SCOPED_NAME_PATTERN}' } } };\n`);
  write(cssModulesRoot, 'src/modules/orders/styles/orders.module.css', '.page { display: grid; }\n.popover { :global(.ant-popover-inner) { padding: 0; } }\n');
  write(cssModulesRoot, 'src/modules/orders/pages/index.tsx', "import styles from '../styles/orders.module.css';\nexport const pageClass = styles.page;\n");
  const cssModulesPass = analyzeStyleIsolation({ projectRoot: cssModulesRoot, modulesRoot: 'src/modules', strategy: 'css-modules' });
  assert.equal(cssModulesPass.violations.length, 0);
  assert.equal(cssModulesPass.adapter, 'builtin-css-modules');
  assert.equal(cssModulesPass.summary.cssModules, 1);
  assert.equal(inferStyleIsolation({ projectRoot: cssModulesRoot, modulesRoot: 'src/modules', buildTool: 'Vite' }).scoped_name_pattern, VITE_SCOPED_NAME_PATTERN);

  const semanticRoot = project('semantic-class-naming');
  write(semanticRoot, '.ai-frontend-assembler/project-scheme.yml', 'style_isolation:\n  strategy: css-modules\n  adapter: builtin-css-modules\n  class_naming_mode: semantic-module-page-feature\n  class_naming_pattern: m_[name]_[local]__[hash:base64:6]\n');
  write(semanticRoot, 'src/modules/orders/styles/orders-review-list.module.css', '.ordersReviewListOrderReviewPage { display: grid; }\n.ordersReviewListOrderReviewHeader { margin: 0; }\n.ordersReviewListOrderReviewContent { padding: 8px; }\n:global(.ant-button) { color: red; }\n');
  write(semanticRoot, 'src/modules/orders/pages/review-list/OrderReviewListPage.tsx', "import styles from '../../styles/orders-review-list.module.css';\nexport const pageClass = styles.ordersReviewListOrderReviewPage;\n");
  const semanticPass = analyzeStyleIsolation({ projectRoot: semanticRoot, modulesRoot: 'src/modules' });
  assert.equal(semanticPass.violations.length, 0);
  assert.equal(semanticPass.policy.classNamingMode, 'semantic-module-page-feature');
  assert.equal(semanticPass.summary.classNamingMode, 'semantic-module-page-feature');

  const sharedOwnerRoot = project('style-owner-shared-by-pages');
  write(sharedOwnerRoot, '.ai-frontend-assembler/project-scheme.yml', 'style_isolation:\n  strategy: css-modules\n  class_naming_mode: semantic-module-page-feature\n');
  write(sharedOwnerRoot, 'src/modules/orders/styles/orders-shared.module.css', '.ordersSharedPanel { display: grid; }\n');
  write(sharedOwnerRoot, 'src/modules/orders/pages/review-list/index.tsx', "import styles from '../../styles/orders-shared.module.css';\nexport const review = styles.ordersSharedPanel;\n");
  write(sharedOwnerRoot, 'src/modules/orders/pages/detail/index.tsx', "import styles from '../../styles/orders-shared.module.css';\nexport const detail = styles.ordersSharedPanel;\n");
  const sharedOwnerFail = analyzeStyleIsolation({ projectRoot: sharedOwnerRoot, modulesRoot: 'src/modules' });
  assert.ok(sharedOwnerFail.violations.some((item) => item.id === 'style_owner_shared_by_pages'));

  const moduleOnlyRoot = project('style-owner-module-only');
  write(moduleOnlyRoot, '.ai-frontend-assembler/project-scheme.yml', 'style_isolation:\n  strategy: css-modules\n  class_naming_mode: semantic-module-page-feature\n');
  write(moduleOnlyRoot, 'src/modules/orders/styles/orders.module.css', '.ordersReviewPanel { display: grid; }\n');
  write(moduleOnlyRoot, 'src/modules/orders/pages/review-list/index.tsx', "import styles from '../../styles/orders.module.css';\nexport const review = styles.ordersReviewPanel;\n");
  const moduleOnlyFail = analyzeStyleIsolation({ projectRoot: moduleOnlyRoot, modulesRoot: 'src/modules' });
  assert.ok(moduleOnlyFail.violations.some((item) => item.id === 'style_owner_module_only'));

  const genericClassRoot = project('style-class-generic-name');
  write(genericClassRoot, '.ai-frontend-assembler/project-scheme.yml', 'style_isolation:\n  strategy: css-modules\n  class_naming_mode: semantic-module-page-feature\n');
  write(genericClassRoot, 'src/modules/orders/styles/orders-review-list.module.css', '.page { display: grid; }\n.content { padding: 8px; }\n');
  write(genericClassRoot, 'src/modules/orders/pages/review-list/index.tsx', "import styles from '../../styles/orders-review-list.module.css';\nexport const review = styles.page;\n");
  const genericClassFail = analyzeStyleIsolation({ projectRoot: genericClassRoot, modulesRoot: 'src/modules' });
  assert.ok(genericClassFail.violations.some((item) => item.id === 'style_class_generic_name'));

  const duplicateOwnerRoot = project('style-owner-duplicate');
  write(duplicateOwnerRoot, '.ai-frontend-assembler/project-scheme.yml', 'style_isolation:\n  strategy: css-modules\n  class_naming_mode: semantic-module-page-feature\n');
  write(duplicateOwnerRoot, 'src/modules/orders/styles/review-list.module.css', '.ordersReviewListPanel { display: grid; }\n');
  write(duplicateOwnerRoot, 'src/modules/orders/pages/review-list/index.tsx', "import styles from '../../styles/review-list.module.css';\nexport const review = styles.ordersReviewListPanel;\n");
  write(duplicateOwnerRoot, 'src/modules/billing/styles/review-list.module.css', '.billingReviewListPanel { display: grid; }\n');
  write(duplicateOwnerRoot, 'src/modules/billing/pages/review-list/index.tsx', "import styles from '../../styles/review-list.module.css';\nexport const review = styles.billingReviewListPanel;\n");
  const duplicateOwnerFail = analyzeStyleIsolation({ projectRoot: duplicateOwnerRoot, modulesRoot: 'src/modules' });
  assert.ok(duplicateOwnerFail.violations.some((item) => item.id === 'style_owner_duplicate'));

  write(cssModulesRoot, 'src/modules/orders/styles/index.css', '.page { color: red; }\n');
  write(cssModulesRoot, 'src/modules/orders/pages/legacy.tsx', "import '../styles/index.css';\nexport const legacy = true;\n");
  const cssModulesFail = analyzeStyleIsolation({ projectRoot: cssModulesRoot, modulesRoot: 'src/modules', strategy: 'css-modules' });
  assert.ok(cssModulesFail.violations.some((item) => item.id === 'module_style_not_scoped'));
  assert.ok(cssModulesFail.violations.some((item) => item.id === 'module_style_generic_filename'));
  assert.ok(cssModulesFail.violations.some((item) => item.id === 'module_style_side_effect_import'));

  const vueScopedRoot = project('vue-scoped', { dependencies: { vue: '^3.5.0' } });
  write(vueScopedRoot, '.ai-frontend-assembler/project-scheme.yml', 'style_isolation:\n  strategy: vue-scoped\n  adapter: builtin-vue-scoped\n  local_style_fallback: css-modules\n');
  write(vueScopedRoot, 'src/modules/orders/styles/OrderPage.less', '.page { display: grid; }\n');
  write(vueScopedRoot, 'src/modules/orders/pages/OrderPage.vue', '<script setup lang="ts"></script>\n<template><section class="page" /></template>\n<style scoped src="../styles/OrderPage.less"></style>\n');
  const vueScopedPass = analyzeStyleIsolation({ projectRoot: vueScopedRoot, modulesRoot: 'src/modules' });
  assert.equal(vueScopedPass.strategy, 'vue-scoped');
  assert.equal(vueScopedPass.violations.length, 0);
  assert.equal(vueScopedPass.summary.vueScopedBlocks, 1);
  write(vueScopedRoot, 'src/modules/orders/pages/UnsafePage.vue', '<template><section class="unsafe" /></template>\n<style>.unsafe { color: red; }</style>\n');
  const vueScopedFail = analyzeStyleIsolation({ projectRoot: vueScopedRoot, modulesRoot: 'src/modules' });
  assert.ok(vueScopedFail.violations.some((item) => item.id === 'vue_style_not_scoped'));

  const utilityRoot = project('utility', { devDependencies: { tailwindcss: '^3.4.0' } });
  write(utilityRoot, 'src/modules/orders/pages/OrderPage.tsx', 'export const OrderPage = () => <section className="grid gap-4" />;\n');
  let utilityReport = analyzeStyleIsolation({ projectRoot: utilityRoot, modulesRoot: 'src/modules', strategy: 'utility-css' });
  assert.equal(utilityReport.violations.length, 0);
  write(utilityRoot, 'src/modules/orders/styles/orders.module.css', '.gridFallback { display: grid; }\n');
  write(utilityRoot, 'src/modules/orders/pages/fallback.tsx', "import styles from '../styles/orders.module.css';\nexport const fallback = styles.gridFallback;\n");
  utilityReport = analyzeStyleIsolation({ projectRoot: utilityRoot, modulesRoot: 'src/modules', strategy: 'utility-css' });
  assert.equal(utilityReport.violations.length, 0);
  assert.equal(inferStyleIsolation({ projectRoot: utilityRoot, modulesRoot: 'src/modules', buildTool: 'Vite' }).strategy, 'hybrid');

  const cssInJsRoot = project('css-in-js', { dependencies: { 'styled-components': '^6.0.0' } });
  write(cssInJsRoot, 'src/modules/orders/pages/OrderPage.tsx', "import styled from 'styled-components';\nexport const Page = styled.section`display: grid;`;\n");
  const cssInJsPass = analyzeStyleIsolation({ projectRoot: cssInJsRoot, modulesRoot: 'src/modules', strategy: 'css-in-js' });
  assert.equal(cssInJsPass.violations.length, 0);
  assert.equal(inferStyleIsolation({ projectRoot: cssInJsRoot, modulesRoot: 'src/modules' }).strategy, 'css-in-js');

  const shadowRoot = project('shadow-dom');
  write(shadowRoot, 'src/modules/widget/styles/Widget.css', ':host { display: block; }\n');
  write(shadowRoot, 'src/modules/widget/Widget.ts', "import cssText from './styles/Widget.css?inline';\nexport class Widget extends HTMLElement { constructor() { super(); this.attachShadow({ mode: 'open' }).innerHTML = `<style>${cssText}</style>`; } }\n");
  const shadowPass = analyzeStyleIsolation({ projectRoot: shadowRoot, modulesRoot: 'src/modules', strategy: 'shadow-dom' });
  assert.equal(shadowPass.violations.length, 0);
  assert.equal(inferStyleIsolation({ projectRoot: shadowRoot, modulesRoot: 'src/modules' }).strategy, 'shadow-dom');

  const hybridRoot = project('hybrid');
  write(hybridRoot, 'src/modules/orders/styles/orders.module.css', '.page { display: grid; }\n');
  write(hybridRoot, 'src/modules/orders/styles/OrderPanel.less', '.panel { padding: 8px; }\n');
  write(hybridRoot, 'src/modules/orders/pages/OrderPage.tsx', "import styles from '../styles/orders.module.css';\nexport const page = styles.page;\n");
  write(hybridRoot, 'src/modules/orders/pages/OrderPanel.vue', '<template><section class="panel" /></template>\n<style scoped src="../styles/OrderPanel.less"></style>\n');
  const hybridPass = analyzeStyleIsolation({ projectRoot: hybridRoot, modulesRoot: 'src/modules', strategy: 'hybrid' });
  assert.equal(hybridPass.violations.length, 0);

  const customRoot = project('custom');
  write(customRoot, '.ai-frontend-assembler/project-scheme.yml', 'style_isolation:\n  strategy: custom\n  adapter: custom\n  custom_adapter: scripts/style-adapter.cjs\n');
  write(customRoot, 'scripts/style-adapter.cjs', "exports.analyze = ({ files }) => ({ violations: files.some((file) => file.endsWith('forbidden.ts')) ? [{ level: 'error', id: 'custom_forbidden', message: 'forbidden file', file: 'src/modules/orders/forbidden.ts' }] : [] });\n");
  write(customRoot, 'src/modules/orders/index.ts', 'export const orders = true;\n');
  assert.equal(analyzeStyleIsolation({ projectRoot: customRoot, modulesRoot: 'src/modules' }).violations.length, 0);
  write(customRoot, 'src/modules/orders/forbidden.ts', 'export const forbidden = true;\n');
  assert.ok(analyzeStyleIsolation({ projectRoot: customRoot, modulesRoot: 'src/modules' }).violations.some((item) => item.id === 'custom_forbidden'));
  assert.equal(resolveStyleIsolationPolicy({ projectRoot: customRoot, modulesRoot: 'src/modules' }).customAdapter, 'scripts/style-adapter.cjs');

  for (const relative of [
    'templates/react18-antd-tailwind-ts/vite.config.ts',
    'templates/vue3-vite-ts/vite.config.ts',
  ]) {
    const text = fs.readFileSync(path.join(baselineRoot, relative), 'utf8');
    assert.match(text, /generateScopedName/);
    assert.match(text, /m_\[name\]_\[local\]__\[hash:base64:6\]/);
  }

  for (const relative of [
    'templates/react18-antd-tailwind-ts/src/modules/home/styles/home-overview.module.css',
    'templates/vue3-vite-ts/src/modules/home/styles/home-overview.module.css',
    'templates/react18-antd-tailwind-ts/src/vite-env.d.ts',
    'templates/vue3-vite-ts/src/vite-env.d.ts',
  ]) assert.ok(fs.existsSync(path.join(baselineRoot, relative)), `缺少模板 CSS Module 支持文件: ${relative}`);

  for (const relative of [
    'templates/react18-antd-tailwind-ts/src/modules/home/pages/HomePage.tsx',
    'templates/vue3-vite-ts/src/modules/home/pages/HomePage.vue',
  ]) {
    const text = fs.readFileSync(path.join(baselineRoot, relative), 'utf8');
    assert.match(text, /import styles from ['"]\.\.\/styles\/home-overview\.module\.css['"]/);
  }

  console.log('style-scope-contract-check: pass');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
