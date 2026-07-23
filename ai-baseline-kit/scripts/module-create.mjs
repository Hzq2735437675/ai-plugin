#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs, resolveRoots } from './project-tools-lib.mjs';
import { normalizePath, slugify, writeJson } from './feature-tools-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const { baselineRoot, projectRoot: defaultProjectRoot } = resolveRoots(import.meta.url);
const projectRoot = path.resolve(args['project-root'] || defaultProjectRoot);
const moduleId = slugify(args.name || args.module || args._[0]);

function run(script, scriptArgs) {
  const result = spawnSync(process.execPath, [path.join(baselineRoot, 'scripts', script), ...scriptArgs], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) process.exit(result.status || 1);
}

try {
  if (!moduleId) throw new Error('请通过 --name <kebab-case> 指定模块名。');
  const title = args.title || moduleId;
  const route = typeof args.route === 'string' ? args.route : '';
  const pageId = slugify(args.page || `${moduleId}-index`);
  const specFile = path.join(projectRoot, 'docs', 'features', `${moduleId}.feature.json`);
  const planFile = path.join(projectRoot, 'docs', 'plans', `${moduleId}.plan.json`);
  if (fs.existsSync(specFile) && !args.force) throw new Error(`功能规格已存在，未覆盖: ${normalizePath(path.relative(projectRoot, specFile))}`);

  const pages = route ? [{ id: pageId, name: title, route, menu: true, permission: '', states: ['loading', 'empty', 'error', 'ready'] }] : [];
  const spec = {
    $schema: '../../../ai-baseline-kit/docs/feature-spec.schema.json',
    schemaVersion: 1,
    kind: 'frontend-feature-spec',
    status: 'ready',
    feature: { id: moduleId, title, domain: slugify(args.domain || moduleId), module: moduleId, archetype: args.archetype || 'custom', summary: args.summary || `创建 ${title} 独立业务模块。`, ownership: 'module' },
    source: { type: 'explicit-cli', path: '', text: '' },
    actors: [],
    capabilities: [args.capability || `${moduleId}:view`],
    pages,
    actions: [],
    entities: [],
    api: [],
    state: { scope: 'module', persistence: 'none', items: [] },
    permissions: [],
    dependencies: { modules: [], shared: [], npm: [] },
    ui: { library: 'project-default', theme: 'global-theme', reuse: [] },
    acceptance: [{ id: `${moduleId}-contract`, given: '项目已完成模块装配', when: route ? `用户访问 ${route}` : `应用加载 ${moduleId} 模块`, then: '模块只能通过公开入口暴露能力，且不直接依赖其他业务模块' }],
    requiredQuestions: [],
    notes: ['module-create 仅用于用户已明确模块边界的场景；复杂产品需求应先使用 requirement-to-feature-spec。'],
  };
  writeJson(specFile, spec);
  run('feature-plan.mjs', ['--project-root', projectRoot, '--spec', specFile, '--output', planFile]);
  run('feature-generate.mjs', ['--project-root', projectRoot, '--spec', specFile, '--plan', planFile, ...(args.force ? ['--force'] : [])]);
  console.log('module-create: pass');
} catch (error) {
  console.error(`module-create: fail: ${error.message}`);
  process.exit(1);
}
