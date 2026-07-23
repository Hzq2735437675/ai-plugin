#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { copyDirectory, parseArgs, resolveRoots } from './project-tools-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const { baselineRoot } = resolveRoots(import.meta.url);
const selected = args.profile || args._[0] || 'all';
const supported = ['all', 'react18-antd-tailwind-ts', 'vue3-vite-ts'];
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-baseline-template-build-'));
const MAX_VUE_JS_CHUNK_BYTES = 500 * 1024;

function run(command, commandArgs, cwd) {
  const npmCommand = command === 'npm';
  const result = spawnSync(command, commandArgs, {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
    shell: npmCommand,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${commandArgs.join(' ')} 执行失败\n${result.error?.message || ''}\n${result.stdout || ''}\n${result.stderr || ''}`);
  }
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
}


function assertAstRejectsViolation(projectRoot, script) {
  const fixture = path.join(projectRoot, 'src', 'shared', '__ast-boundary-invalid.ts');
  fs.writeFileSync(fixture, "import '@/modules/home/routes';\n");
  try {
    const result = spawnSync(process.execPath, [script('ast-boundary-check.mjs'), '--project-root', projectRoot, '--require-parser'], {
      cwd: projectRoot,
      encoding: 'utf8',
    });
    const combined = `${result.stdout || ''}\n${result.stderr || ''}`;
    assert.notEqual(result.status, 0, 'AST 边界检查未拒绝 shared -> module 私有依赖');
    assert.match(combined, /ast_shared_depends_on_module/);
  } finally {
    fs.rmSync(fixture, { force: true });
  }
}

function listFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(target));
    else files.push(target);
  }
  return files;
}

function assertVueChunkBudget(distRoot) {
  const chunks = listFiles(distRoot)
    .filter((file) => file.endsWith('.js'))
    .map((file) => ({ file, bytes: fs.statSync(file).size }))
    .sort((left, right) => right.bytes - left.bytes);
  assert.ok(chunks.length > 0, 'Vue 模板构建后未找到 JavaScript 产物');
  const largest = chunks[0];
  console.log(`template-build: vue largest-js=${(largest.bytes / 1024).toFixed(2)} KiB (${path.relative(distRoot, largest.file)})`);
  assert.ok(
    largest.bytes < MAX_VUE_JS_CHUNK_BYTES,
    `Vue 模板最大 JavaScript chunk ${(largest.bytes / 1024).toFixed(2)} KiB 超过 ${MAX_VUE_JS_CHUNK_BYTES / 1024} KiB；请检查 Element Plus 是否退化为全量导入`,
  );
}

function sampleSpec(module, title, route) {
  return {
    schemaVersion: 1,
    kind: 'frontend-feature-spec',
    status: 'ready',
    feature: { id: `${module}-management`, title, domain: module, module, archetype: 'crud', summary: `${title}功能`, ownership: 'module' },
    source: { type: 'product-document', path: `docs/product/${module}.md`, text: '' },
    actors: [{ id: 'operator', name: '运营人员' }],
    capabilities: [`${module}:view`],
    pages: [{
      id: `${module}-list`,
      name: `${title}列表`,
      route,
      menu: true,
      permission: `${module}:view`,
      states: ['loading', 'empty', 'error', 'ready', 'permission-denied'],
    }],
    actions: [{ id: `view-${module}`, name: `查看${title}`, permission: `${module}:view`, confirmationRequired: false }],
    entities: [{ name: `${module}Entity`, fields: [] }],
    api: [{ id: `get-${module}`, method: 'GET', path: `/api/${module}`, purpose: `查询${title}` }],
    state: { scope: 'module', persistence: 'none', items: [] },
    permissions: [`${module}:view`],
    dependencies: { modules: [], shared: ['shared/types/module'], npm: [] },
    ui: { library: 'project-default', theme: 'global-theme', reuse: [] },
    acceptance: [{ id: `accept-${module}`, given: `用户拥有 ${module}:view 权限`, when: `访问 ${route}`, then: '页面完整处理所有标准状态' }],
    requiredQuestions: [],
    notes: [],
  };
}

function buildProfile({ profile, directory, module, title, route }) {
  const projectRoot = path.join(tempRoot, directory);
  fs.mkdirSync(projectRoot, { recursive: true });
  copyDirectory(baselineRoot, path.join(projectRoot, 'ai-baseline-kit'), { force: false, projectRoot });
  const script = (name) => path.join(projectRoot, 'ai-baseline-kit', 'scripts', name);

  run(process.execPath, [script('project-bootstrap.mjs'), '--project-root', projectRoot, '--init-template', '--stack', profile], projectRoot);
  const featureFile = path.join(projectRoot, 'docs', 'features', `${module}.feature.json`);
  const planFile = path.join(projectRoot, 'docs', 'plans', `${module}.plan.json`);
  fs.mkdirSync(path.dirname(featureFile), { recursive: true });
  fs.mkdirSync(path.dirname(planFile), { recursive: true });
  fs.writeFileSync(featureFile, `${JSON.stringify(sampleSpec(module, title, route), null, 2)}\n`);

  run(process.execPath, [script('feature-plan.mjs'), '--project-root', projectRoot, '--spec', featureFile, '--output', planFile], projectRoot);
  run(process.execPath, [script('feature-generate.mjs'), '--project-root', projectRoot, '--spec', featureFile, '--plan', planFile], projectRoot);
  run(process.execPath, [script('project-validate.mjs'), '--project-root', projectRoot, '--baseline-only'], projectRoot);
  run('npm', ['install', '--no-audit', '--no-fund'], projectRoot);
  run(process.execPath, [script('ast-boundary-check.mjs'), '--project-root', projectRoot, '--require-parser'], projectRoot);
  assertAstRejectsViolation(projectRoot, script);
  run('npm', ['run', 'test'], projectRoot);
  run('npm', ['run', 'typecheck'], projectRoot);
  run('npm', ['run', 'build'], projectRoot);
  const distRoot = path.join(projectRoot, 'dist');
  assert.ok(fs.existsSync(distRoot), `${profile} 未生成 dist`);
  if (profile === 'vue3-vite-ts') assertVueChunkBudget(distRoot);
  console.log(`template-build: ${profile} pass`);
}

try {
  if (!supported.includes(selected)) throw new Error(`不支持的 profile: ${selected}。可选值: ${supported.join(', ')}`);
  const fixtures = [
    { profile: 'react18-antd-tailwind-ts', directory: 'react', module: 'order', title: '订单管理', route: '/orders' },
    { profile: 'vue3-vite-ts', directory: 'vue', module: 'customer', title: '客户管理', route: '/customers' },
  ];
  for (const fixture of fixtures.filter((item) => selected === 'all' || item.profile === selected)) buildProfile(fixture);
  console.log('template-build-check: pass');
} catch (error) {
  console.error(`template-build-check: fail: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (args['keep-temp']) console.log(`temp-root: ${tempRoot}`);
  else fs.rmSync(tempRoot, { recursive: true, force: true });
}
