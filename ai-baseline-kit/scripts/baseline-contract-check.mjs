#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { analyzeProject, buildProjectScheme, copyDirectory, resolveRoots } from './project-tools-lib.mjs';

const { baselineRoot } = resolveRoots(import.meta.url);
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-baseline-contract-'));

function run(projectRoot, relativeScript, args = []) {
  return spawnSync(process.execPath, [path.join(projectRoot, relativeScript), ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
}

function output(result) {
  return `${result.stdout || ''}\n${result.stderr || ''}`;
}

function assertPass(result, label) {
  assert.equal(result.status, 0, `${label} failed:\n${output(result)}`);
}

function installKit(projectRoot) {
  copyDirectory(baselineRoot, path.join(projectRoot, 'ai-baseline-kit'), {
    force: false,
    projectRoot,
  });
}

function bootstrap(profile, name) {
  const projectRoot = path.join(tempRoot, name);
  fs.mkdirSync(projectRoot, { recursive: true });
  installKit(projectRoot);
  const result = run(projectRoot, 'ai-baseline-kit/scripts/project-bootstrap.mjs', [
    '--project-root', projectRoot,
    '--init-template',
    '--stack', profile,
  ]);
  assertPass(result, `${name} bootstrap`);
  assert.ok(fs.existsSync(path.join(projectRoot, 'AGENTS.md')));
  assert.ok(fs.existsSync(path.join(projectRoot, 'CLAUDE.md')));
  assert.match(fs.readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf8'), /AI 前端模块装配系统/);
  assert.match(fs.readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf8'), /有效交付回执/);
  assert.match(fs.readFileSync(path.join(projectRoot, 'CLAUDE.md'), 'utf8'), /AI 前端模块装配系统/);
  assert.match(fs.readFileSync(path.join(projectRoot, 'CLAUDE.md'), 'utf8'), /有效交付回执/);
  assert.ok(fs.existsSync(path.join(projectRoot, 'src', 'theme', 'theme.css')));
  const mainFile = path.join(projectRoot, profile === 'vue3-vite-ts' ? 'src/main.ts' : 'src/main.tsx');
  assert.match(fs.readFileSync(mainFile, 'utf8'), /theme\/theme\.css/);

  const legacySnapshot = path.join(projectRoot, '.ai-frontend-assembler', 'legacy-baseline.json');
  assert.equal(fs.existsSync(legacySnapshot), false, '标准新项目不应创建旧项目历史快照');
  const rerun = run(projectRoot, 'ai-baseline-kit/scripts/project-bootstrap.mjs', ['--project-root', projectRoot]);
  assertPass(rerun, `${name} bootstrap rerun`);
  assert.match(rerun.stdout, new RegExp(`profile: ${profile}`));
  assert.match(rerun.stdout, /ai-entrypoints: unchanged/);
  assert.equal(fs.existsSync(legacySnapshot), false, '标准模板重复 bootstrap 不应误建旧项目快照');
  return projectRoot;
}

function readyFeature({ id, module, title, pageId, pageName, route, permission }) {
  return {
    $schema: '../feature-spec.schema.json',
    schemaVersion: 1,
    kind: 'frontend-feature-spec',
    status: 'ready',
    feature: {
      id,
      title,
      domain: module,
      module,
      archetype: 'crud',
      summary: `${title}功能`,
      ownership: 'module',
    },
    source: { type: 'product-document', path: `docs/product/${id}.md`, text: '' },
    actors: [{ id: 'operator', name: '运营人员' }],
    capabilities: [`${module}:view`],
    pages: [{
      id: pageId,
      name: pageName,
      route,
      menu: true,
      permission,
      states: ['loading', 'empty', 'error', 'ready', 'permission-denied'],
    }],
    actions: [{ id: `view-${pageId}`, name: `查看${pageName}`, permission, confirmationRequired: false }],
    entities: [{ name: `${module}Entity`, fields: [] }],
    api: [{ id: `get-${pageId}`, method: 'GET', path: `/api/${module}`, purpose: `查询${title}` }],
    state: { scope: 'module', persistence: 'none', items: [] },
    permissions: [permission],
    dependencies: { modules: [], shared: ['shared/types/module'], npm: [] },
    ui: { library: 'project-default', theme: 'global-theme', reuse: [] },
    acceptance: [{
      id: `accept-${pageId}`,
      given: `用户拥有 ${permission} 权限`,
      when: `访问 ${route}`,
      then: '页面完整处理 loading、empty、error、ready 和 permission-denied 状态',
    }],
    requiredQuestions: [],
    notes: [],
  };
}

function generateFeature(projectRoot, spec, expectedDecision) {
  const featuresDir = path.join(projectRoot, 'docs', 'features');
  const plansDir = path.join(projectRoot, 'docs', 'plans');
  fs.mkdirSync(featuresDir, { recursive: true });
  fs.mkdirSync(plansDir, { recursive: true });
  const specFile = path.join(featuresDir, `${spec.feature.id}.feature.json`);
  const planFile = path.join(plansDir, `${spec.feature.id}.plan.json`);
  fs.writeFileSync(specFile, `${JSON.stringify(spec, null, 2)}\n`);

  const plan = run(projectRoot, 'ai-baseline-kit/scripts/feature-plan.mjs', [
    '--project-root', projectRoot,
    '--spec', specFile,
    '--output', planFile,
  ]);
  assertPass(plan, `${spec.feature.id} feature plan`);
  assert.match(plan.stdout, new RegExp(`decision: ${expectedDecision}`));
  const planData = JSON.parse(fs.readFileSync(planFile, 'utf8'));
  assert.equal(planData.status, 'ready');
  assert.equal(planData.project.mode, 'new-frontend-project');

  const generated = run(projectRoot, 'ai-baseline-kit/scripts/feature-generate.mjs', [
    '--project-root', projectRoot,
    '--spec', specFile,
    '--plan', planFile,
  ]);
  assertPass(generated, `${spec.feature.id} generation`);
  assert.match(generated.stdout, new RegExp(`decision: ${expectedDecision}`));
  return { specFile, planFile };
}

try {
  const reactProject = bootstrap('react18-antd-tailwind-ts', 'react');
  const requirementFile = path.join(reactProject, 'docs', 'product', 'rough-request.md');
  const draftFile = path.join(reactProject, 'docs', 'features', 'rough-request.feature.json');
  fs.mkdirSync(path.dirname(requirementFile), { recursive: true });
  fs.writeFileSync(requirementFile, '# 订单需求\n做一个订单列表页面 /orders，能查询和取消订单。\n');
  const draft = run(reactProject, 'ai-baseline-kit/scripts/requirement-compile.mjs', [
    '--input', requirementFile,
    '--output', draftFile,
  ]);
  assert.equal(draft.status, 2, `自然语言草稿应触发确认门禁:\n${output(draft)}`);
  assert.match(draft.stdout, /requirement-compile: needs-confirmation/);
  const draftData = JSON.parse(fs.readFileSync(draftFile, 'utf8'));
  assert.equal(draftData.status, 'needs-confirmation');
  assert.ok(draftData.requiredQuestions.some((item) => item.blocking !== false));

  const orderSpec = readyFeature({
    id: 'order-management', module: 'order', title: '订单管理',
    pageId: 'order-list', pageName: '订单列表', route: '/orders', permission: 'order:view',
  });
  generateFeature(reactProject, orderSpec, 'create-module');
  assert.ok(fs.existsSync(path.join(reactProject, 'src', 'modules', 'order', 'module.meta.json')));
  assert.ok(fs.existsSync(path.join(reactProject, 'src', 'modules', 'order', 'tests', 'order-management.component.test.tsx')));
  assert.ok(fs.existsSync(path.join(reactProject, 'src', 'modules', 'order', 'tests', 'e2e', 'order-management.spec.ts')));
  const reactAssembler = path.join(reactProject, 'src', 'app', 'module-assembler.ts');
  assert.match(fs.readFileSync(reactAssembler, 'utf8'), /orderModule/);

  const detailSpec = readyFeature({
    id: 'order-detail', module: 'order', title: '订单详情',
    pageId: 'order-detail', pageName: '订单详情', route: '/orders/:id', permission: 'order:view',
  });
  generateFeature(reactProject, detailSpec, 'extend-module');
  const orderRoutes = fs.readFileSync(path.join(reactProject, 'src', 'modules', 'order', 'routes.ts'), 'utf8');
  assert.match(orderRoutes, /OrderDetailPage/);
  assert.equal((fs.readFileSync(reactAssembler, 'utf8').match(/orderModule/g) || []).length, 2, '装配器应只有一次 import 和一次列表项');
  const orderMeta = JSON.parse(fs.readFileSync(path.join(reactProject, 'src', 'modules', 'order', 'module.meta.json'), 'utf8'));
  assert.ok(orderMeta.provenance.some((item) => item.includes('order-detail.feature.json')));
  const reactCheck = run(reactProject, 'ai-baseline-kit/scripts/project-validate.mjs', ['--baseline-only']);
  assertPass(reactCheck, 'React generated module strict validation');
  assert.match(reactCheck.stdout, /profile: react18-antd-tailwind-ts/);

  const vueProject = bootstrap('vue3-vite-ts', 'vue');
  const vuePackage = JSON.parse(fs.readFileSync(path.join(vueProject, 'package.json'), 'utf8'));
  assert.ok(vuePackage.dependencies['element-plus'], 'Vue 标准模板必须声明 element-plus');
  assert.ok(vuePackage.devDependencies['unplugin-vue-components'], 'Vue 标准模板必须声明组件按需导入插件');
  const vueViteConfig = fs.readFileSync(path.join(vueProject, 'vite.config.ts'), 'utf8');
  assert.match(vueViteConfig, /Components\(/);
  assert.match(vueViteConfig, /dts:\s*false/);
  assert.match(vueViteConfig, /ElementPlusResolver\(\{ importStyle: 'css' \}\)/);
  const vueTsconfig = JSON.parse(fs.readFileSync(path.join(vueProject, 'tsconfig.json'), 'utf8'));
  assert.ok(vueTsconfig.compilerOptions.types.includes('element-plus/global'));
  const vueMain = fs.readFileSync(path.join(vueProject, 'src', 'main.ts'), 'utf8');
  assert.match(vueMain, /createApp\(App\)\.use\(router\)\.mount\('#app'\)/);
  assert.doesNotMatch(vueMain, /import ElementPlus from 'element-plus'/);
  assert.doesNotMatch(vueMain, /element-plus\/dist\/index\.css/);
  assert.doesNotMatch(vueMain, /\.use\(ElementPlus\)/);
  const vueTheme = fs.readFileSync(path.join(vueProject, 'src', 'theme', 'theme.css'), 'utf8');
  assert.match(vueTheme, /html:root\s*\{/);
  assert.match(vueTheme, /--app-color-primary: var\(--el-color-primary\)/);
  const activeVueTheme = vueTheme.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(activeVueTheme, /--el-color-primary:\s*#[0-9a-f]{3,8}\s*;/i, '默认主题不得主动覆盖 Element Plus 主色');
  const customerSpec = readyFeature({
    id: 'customer-management', module: 'customer', title: '客户管理',
    pageId: 'customer-list', pageName: '客户列表', route: '/customers', permission: 'customer:view',
  });
  generateFeature(vueProject, customerSpec, 'create-module');
  const customerPageFile = path.join(vueProject, 'src', 'modules', 'customer', 'pages', 'customer-list', 'index.vue');
  assert.ok(fs.existsSync(customerPageFile));
  assert.match(fs.readFileSync(customerPageFile, 'utf8'), /<el-card/);
  const customerMeta = JSON.parse(fs.readFileSync(path.join(vueProject, 'src', 'modules', 'customer', 'module.meta.json'), 'utf8'));
  assert.deepEqual(customerMeta.dependencies.npm, ['element-plus']);
  assert.deepEqual(customerMeta.dependencies.dev, ['vitest', '@vue/test-utils', '@playwright/test', 'jsdom']);
  assert.ok(fs.existsSync(path.join(vueProject, 'src', 'modules', 'customer', 'tests', 'customer-management.component.test.ts')));
  assert.ok(fs.existsSync(path.join(vueProject, 'src', 'modules', 'customer', 'tests', 'customer-management.api.mock.ts')));
  assert.match(fs.readFileSync(path.join(vueProject, 'src', 'modules', 'customer', 'manifest.ts'), 'utf8'), /npm: \["element-plus"\]/);
  const customerDetailSpec = readyFeature({
    id: 'customer-detail', module: 'customer', title: '客户详情',
    pageId: 'customer-detail', pageName: '客户详情', route: '/customers/:id', permission: 'customer:view',
  });
  generateFeature(vueProject, customerDetailSpec, 'extend-module');
  const extendedCustomerMeta = JSON.parse(fs.readFileSync(path.join(vueProject, 'src', 'modules', 'customer', 'module.meta.json'), 'utf8'));
  assert.deepEqual(extendedCustomerMeta.dependencies.npm, ['element-plus']);
  assert.match(fs.readFileSync(path.join(vueProject, 'src', 'modules', 'customer', 'manifest.ts'), 'utf8'), /npm: \["element-plus"\]/);
  const vueCheck = run(vueProject, 'ai-baseline-kit/scripts/project-validate.mjs', ['--baseline-only']);
  assertPass(vueCheck, 'Vue generated module strict validation');
  assert.match(vueCheck.stdout, /profile: vue3-vite-ts/);

  const customerBundle = path.join(tempRoot, 'bundles', 'customer');
  const exported = run(vueProject, 'ai-baseline-kit/scripts/module-export.mjs', [
    '--project-root', vueProject, '--module', 'customer', '--output', customerBundle,
  ]);
  assertPass(exported, 'customer module export');
  assert.ok(fs.existsSync(path.join(customerBundle, 'module-bundle.json')));

  const vueTarget = bootstrap('vue3-vite-ts', 'vue-target');
  const compatible = run(vueTarget, 'ai-baseline-kit/scripts/module-compatibility-check.mjs', [
    '--project-root', vueTarget, '--bundle', customerBundle,
  ]);
  assertPass(compatible, 'customer module compatibility');
  const imported = run(vueTarget, 'ai-baseline-kit/scripts/module-import.mjs', [
    '--project-root', vueTarget, '--bundle', customerBundle,
  ]);
  assertPass(imported, 'customer module import');
  assert.ok(fs.existsSync(path.join(vueTarget, 'src', 'modules', 'customer', 'module.meta.json')));
  assert.ok(fs.existsSync(path.join(vueTarget, 'docs', 'module-imports', 'customer.json')));
  assert.match(fs.readFileSync(path.join(vueTarget, 'src', 'app', 'module-assembler.ts'), 'utf8'), /customerModule/);
  assertPass(run(vueTarget, 'ai-baseline-kit/scripts/baseline-check.mjs', ['--project-root', vueTarget, '--fail-on-warn']), 'imported target strict baseline');

  const reactTarget = bootstrap('react18-antd-tailwind-ts', 'react-target');
  const incompatible = run(reactTarget, 'ai-baseline-kit/scripts/module-compatibility-check.mjs', [
    '--project-root', reactTarget, '--bundle', customerBundle,
  ]);
  assert.notEqual(incompatible.status, 0, 'Vue module bundle must not import into React target');
  assert.match(output(incompatible), /stack-|shared-contract-conflict/);

  const composedProject = path.join(tempRoot, 'composed-vue');
  fs.mkdirSync(composedProject, { recursive: true });
  const composed = run(vueProject, 'ai-baseline-kit/scripts/project-compose.mjs', [
    '--project-root', composedProject, '--stack', 'vue3-vite-ts', '--bundles', customerBundle,
  ]);
  assertPass(composed, 'project compose');
  assert.ok(fs.existsSync(path.join(composedProject, 'src', 'modules', 'customer', 'module.meta.json')));
  assert.ok(fs.existsSync(path.join(composedProject, 'docs', 'project-composition.json')));
  assertPass(run(composedProject, 'ai-baseline-kit/scripts/baseline-check.mjs', ['--project-root', composedProject, '--fail-on-warn']), 'composed project strict baseline');

  const invalidProject = bootstrap('vue3-vite-ts', 'invalid');
  fs.rmSync(path.join(invalidProject, 'src', 'modules', 'home', 'routes.ts'));
  fs.rmSync(path.join(invalidProject, 'src', 'modules', 'home', 'module.meta.json'));
  fs.writeFileSync(
    path.join(invalidProject, 'src', 'shared', 'illegal.ts'),
    "import HomePage from '@/modules/home/pages/HomePage.vue';\nexport default HomePage;\n",
  );
  fs.appendFileSync(
    path.join(invalidProject, 'src', 'modules', 'home', 'pages', 'HomePage.vue'),
    "\n<script lang=\"ts\">import axios from 'axios'; export default { created() { void axios; } };</script>\n<style>.bad { color: red; }</style>\n",
  );
  fs.writeFileSync(
    path.join(invalidProject, 'src', 'app', 'illegal-assembly.ts'),
    "export const modules = import.meta.glob('../modules/**/manifest.ts');\n",
  );
  const invalidCheck = run(invalidProject, 'ai-baseline-kit/scripts/baseline-check.mjs', ['--fail-on-warn']);
  const invalidOutput = output(invalidCheck);
  assert.notEqual(invalidCheck.status, 0, 'Invalid fixture unexpectedly passed strict baseline');
  for (const rule of [
    'module_contract_file_missing',
    'shared_depends_on_module',
    'undeclared_module_npm_dependency',
    'module_inline_style',
    'dynamic_module_assembly',
  ]) assert.match(invalidOutput, new RegExp(rule), `Invalid fixture did not report ${rule}`);

  const metadataProject = bootstrap('react18-antd-tailwind-ts', 'metadata-invalid');
  const metadataFile = path.join(metadataProject, 'src', 'modules', 'home', 'module.meta.json');
  const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
  metadata.dependencies.modules = ['order'];
  metadata.dependencies.shared = [];
  fs.writeFileSync(metadataFile, `${JSON.stringify(metadata, null, 2)}\n`);
  const metadataCheck = run(metadataProject, 'ai-baseline-kit/scripts/baseline-check.mjs', ['--fail-on-warn']);
  assert.notEqual(metadataCheck.status, 0, 'Invalid module metadata unexpectedly passed');
  assert.match(output(metadataCheck), /module_metadata_cross_module_dependency/);
  assert.match(output(metadataCheck), /module_metadata_manifest_mismatch/);

  const legacyProject = path.join(tempRoot, 'legacy');
  fs.mkdirSync(legacyProject, { recursive: true });
  copyDirectory(path.join(baselineRoot, 'templates', 'vue3-vite-ts'), legacyProject, { force: false, projectRoot: legacyProject });
  installKit(legacyProject);
  fs.writeFileSync(
    path.join(legacyProject, 'src', 'shared', 'historical-illegal.ts'),
    "import HomePage from '@/modules/home/pages/HomePage.vue';\nexport default HomePage;\n",
  );
  const legacyBootstrap = run(legacyProject, 'ai-baseline-kit/scripts/project-bootstrap.mjs', ['--project-root', legacyProject]);
  assertPass(legacyBootstrap, 'legacy bootstrap');
  const snapshotFile = path.join(legacyProject, '.ai-frontend-assembler', 'legacy-baseline.json');
  assert.ok(fs.existsSync(snapshotFile), '旧项目首次接入应写入历史快照');
  const changedBefore = run(legacyProject, 'ai-baseline-kit/scripts/baseline-check.mjs', [
    '--project-root', legacyProject, '--mode', 'changed', '--fail-on-warn',
  ]);
  assertPass(changedBefore, 'legacy changed baseline should ignore historical violations');
  fs.writeFileSync(
    path.join(legacyProject, 'src', 'shared', 'new-illegal.ts'),
    "import HomePage from '@/modules/home/pages/HomePage.vue';\nexport default HomePage;\n",
  );
  const changedAfter = run(legacyProject, 'ai-baseline-kit/scripts/baseline-check.mjs', [
    '--project-root', legacyProject, '--mode', 'changed', '--fail-on-warn',
  ]);
  assert.notEqual(changedAfter.status, 0, 'legacy changed baseline must reject new violations');
  assert.match(output(changedAfter), /shared_depends_on_module/);

  const detectedLegacy = path.join(tempRoot, 'legacy-detection');
  fs.mkdirSync(path.join(detectedLegacy, 'src', 'domains'), { recursive: true });
  fs.mkdirSync(path.join(detectedLegacy, 'src', 'http'), { recursive: true });
  fs.writeFileSync(path.join(detectedLegacy, 'package.json'), JSON.stringify({
    name: 'legacy-preact-fixture',
    packageManager: 'pnpm@10.13.1',
    dependencies: { preact: '^10.0.0', wouter: '^3.0.0', mobx: '^6.0.0' },
    devDependencies: { vite: '^7.0.0', typescript: '^5.0.0' },
  }));
  fs.writeFileSync(path.join(detectedLegacy, 'vite.config.ts'), 'export default {};\n');
  fs.writeFileSync(path.join(detectedLegacy, 'src', 'http', 'client.ts'), 'export const client = {};\n');
  const legacyReport = analyzeProject(detectedLegacy);
  const legacyScheme = buildProjectScheme(legacyReport);
  assert.equal(legacyReport.stack.framework, 'Preact');
  assert.equal(legacyReport.stack.router, 'Wouter');
  assert.equal(legacyReport.stack.state_manager, 'MobX');
  assert.equal(legacyReport.stack.package_manager, 'pnpm');
  assert.equal(legacyReport.layers.modules_root, 'src/domains');
  assert.equal(legacyReport.entrypoints.api_client, 'src/http/client.ts');
  assert.match(legacyScheme, /required_questions:\r?\n\s+- field:/);

  const controlledExecutionContracts = spawnSync(process.execPath, [path.join(baselineRoot, 'scripts', 'controlled-execution-contract-check.mjs')], { cwd: baselineRoot, encoding: 'utf8' });
  assertPass(controlledExecutionContracts, 'controlled execution contract check');
  console.log(controlledExecutionContracts.stdout.trim());

  const smartComposeContracts = spawnSync(process.execPath, [path.join(baselineRoot, 'scripts', 'smart-compose-contract-check.mjs')], { cwd: baselineRoot, encoding: 'utf8' });
  assertPass(smartComposeContracts, 'smart compose contract check');
  console.log(smartComposeContracts.stdout.trim());

  const intelligentDevelopmentContracts = spawnSync(process.execPath, [path.join(baselineRoot, 'scripts', 'intelligent-development-contract-check.mjs')], { cwd: baselineRoot, encoding: 'utf8' });
  assertPass(intelligentDevelopmentContracts, 'intelligent development contract check');
  console.log(intelligentDevelopmentContracts.stdout.trim());

  const compositionContracts = spawnSync(process.execPath, [path.join(baselineRoot, 'scripts', 'composition-contract-check.mjs')], { cwd: baselineRoot, encoding: 'utf8' });
  assertPass(compositionContracts, 'composition contract check');
  console.log(compositionContracts.stdout.trim());

  const deliveryClosureContracts = spawnSync(process.execPath, [path.join(baselineRoot, 'scripts', 'delivery-closure-contract-check.mjs')], { cwd: baselineRoot, encoding: 'utf8' });
  assertPass(deliveryClosureContracts, 'delivery closure contract check');
  console.log(deliveryClosureContracts.stdout.trim());

  const buildIsolationContracts = spawnSync(process.execPath, [path.join(baselineRoot, 'scripts', 'build-isolation-contract-check.mjs')], { cwd: baselineRoot, encoding: 'utf8' });
  assertPass(buildIsolationContracts, 'build isolation contract check');
  console.log(buildIsolationContracts.stdout.trim());

  const packageUpgradeContracts = spawnSync(process.execPath, [path.join(baselineRoot, 'scripts', 'package-upgrade-contract-check.mjs')], { cwd: baselineRoot, encoding: 'utf8' });
  assertPass(packageUpgradeContracts, 'package upgrade contract check');
  console.log(packageUpgradeContracts.stdout.trim());

  console.log('baseline-contract-check: pass');
  console.log('requirement-confirmation-gate: pass');
  console.log('react-create-and-extend: pass');
  console.log('vue-create-and-extend: pass');
  console.log('theme-entrypoint: pass');
  console.log('acceptance-test-generation: pass');
  console.log('module-portability-and-compose: pass');
  console.log('controlled-execution-hard-gates: pass');
  console.log('delivery-closure-hard-gate: pass');
  console.log('build-artifact-isolation: pass');
  console.log('smart-compose-zero-config: pass');
  console.log('smart-develop-unified-entry: pass');
  console.log('document-normalization-multiformat: pass');
  console.log('controlled-repair-loop: pass');
  console.log('acceptance-coverage-gate: pass');
  console.log('invalid-fixtures: rejected');
  console.log('legacy-incremental-baseline: pass');
  console.log('legacy-detection: pass');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
