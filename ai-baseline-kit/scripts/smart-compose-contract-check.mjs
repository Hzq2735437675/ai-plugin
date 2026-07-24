#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { copyDirectory, resolveRoots } from './project-tools-lib.mjs';
import { discoverWorkspaceProjects } from './workspace-discovery-lib.mjs';
import { resolveWorkspaceIntent } from './intent-resolver-lib.mjs';
import { runSmartCompose } from './smart-compose-lib.mjs';

const { baselineRoot } = resolveRoots(import.meta.url);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-smart-compose-contract-'));
try {
  const a = path.join(root, 'project-a');
  const b = path.join(root, 'project-b');
  copyDirectory(path.join(baselineRoot, 'templates', 'vue3-vite-ts'), a, { force: false, projectRoot: a });
  copyDirectory(path.join(baselineRoot, 'templates', 'vue3-vite-ts'), b, { force: false, projectRoot: b });
  for (const [project, title, alias] of [[a, '客户管理', '客户中心'], [b, '订单管理', '订单中心']]) {
    const file = path.join(project, 'src', 'modules', 'home', 'module.meta.json');
    const meta = JSON.parse(fs.readFileSync(file, 'utf8')); meta.title = title; meta.aliases = [title, alias];
    fs.writeFileSync(file, `${JSON.stringify(meta, null, 2)}\n`);
  }

  const discovery = discoverWorkspaceProjects({ workspaceRoot: root, maxDepth: 2 });
  assert.equal(discovery.projects.length, 2);
  const aliases = discovery.projects.find((item) => item.relativePath === 'project-a').aliases;
  for (const alias of ['a', '项目a', '项目 a']) assert.ok(aliases.includes(alias));

  const intent = resolveWorkspaceIntent({ request: '把项目 A 的客户管理和项目 B 的订单管理组合成项目 C', discovery });
  assert.equal(intent.task, 'compose-project');
  assert.equal(intent.status, 'ready');
  assert.deepEqual(intent.sources.map((item) => item.relativePath).sort(), ['project-a', 'project-b']);
  assert.equal(intent.target.projectRoot, path.join(root, 'project-c'));

  const planned = await runSmartCompose({ request: '把项目 A 的客户管理和项目 B 的订单管理组合成项目 C', workspaceRoot: root, baselineRoot, planOnly: true, runId: 'plan' });
  assert.equal(planned.status, 'planned');
  assert.equal(fs.existsSync(path.join(root, 'project-c')), false, 'plan-only 不得创建目标项目');

  const applied = await runSmartCompose({ request: '把项目 A 的客户管理和项目 B 的订单管理组合成项目 C', workspaceRoot: root, baselineRoot, runId: 'apply' });
  assert.equal(applied.status, 'completed', applied.error?.message || applied.composition?.error?.message);
  assert.ok(fs.existsSync(path.join(root, 'project-c', 'src', 'modules', 'project-a-home')));
  assert.ok(fs.existsSync(path.join(root, 'project-c', 'src', 'modules', 'project-b-home')));
  assert.equal(applied.composition.controlledExecution.state, 'completed');
  assert.ok(applied.composition.controlledExecution.changes.length > 0);

  const ambiguous = await runSmartCompose({ request: '把项目 A 和项目 B 的部分模块组合成项目 D', workspaceRoot: root, baselineRoot, planOnly: true, runId: 'ambiguous' });
  assert.equal(ambiguous.status, 'needs-confirmation');
  assert.ok(ambiguous.requiredQuestions.length > 0);

  const mixedRoot = path.join(root, 'mixed');
  const va = path.join(mixedRoot, 'project-a'); const rb = path.join(mixedRoot, 'project-b');
  copyDirectory(path.join(baselineRoot, 'templates', 'vue3-vite-ts'), va, { force: false, projectRoot: va });
  copyDirectory(path.join(baselineRoot, 'templates', 'react18-antd-tailwind-ts'), rb, { force: false, projectRoot: rb });
  const mixed = await runSmartCompose({ request: '把项目 A 和项目 B 的模块组合成项目 C', workspaceRoot: mixedRoot, baselineRoot, planOnly: true, runId: 'mixed' });
  assert.equal(mixed.status, 'needs-confirmation');
  assert.ok(mixed.requiredQuestions.some((item) => item.field === 'target.stack'));

  console.log('smart-compose-contract-check: pass');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
