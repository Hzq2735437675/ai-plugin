#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { copyDirectory, resolveRoots } from './project-tools-lib.mjs';
import { discoverProjectModules, selectModulesFromDiscovery } from './module-discovery-lib.mjs';
import { beginCompositionTransaction, rollbackCompositionTransaction } from './composition-transaction-lib.mjs';
import { executeComposition } from './composition-orchestrator-lib.mjs';

const { baselineRoot } = resolveRoots(import.meta.url);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-composition-contract-'));
try {
  const a = path.join(root, 'project-a'); const b = path.join(root, 'project-b'); const c = path.join(root, 'project-c');
  copyDirectory(path.join(baselineRoot, 'templates', 'vue3-vite-ts'), a, { force: false, projectRoot: a });
  copyDirectory(path.join(baselineRoot, 'templates', 'vue3-vite-ts'), b, { force: false, projectRoot: b });
  for (const [project, title, alias] of [[a, '客户管理', '客户中心'], [b, '财务结算', '结算中心']]) {
    const file = path.join(project, 'src', 'modules', 'home', 'module.meta.json');
    const meta = JSON.parse(fs.readFileSync(file, 'utf8')); meta.title = title; meta.aliases = [title, alias];
    fs.writeFileSync(file, `${JSON.stringify(meta, null, 2)}\n`);
  }
  const discovery = discoverProjectModules({ projectRoot: a, query: '请抽离客户管理模块' });
  assert.equal(discovery.modules[0].name, 'home'); assert.ok(discovery.modules[0].match.score >= 80);
  assert.deepEqual(selectModulesFromDiscovery(discovery, '请抽离客户管理模块').selected, ['home']);
  const ambiguous = discoverProjectModules({ projectRoot: a, query: '完全无关需求' });
  assert.equal(selectModulesFromDiscovery(ambiguous, '完全无关需求').questions[0].blocking, true);

  const rollbackTarget = path.join(root, 'rollback-target'); fs.mkdirSync(rollbackTarget); fs.writeFileSync(path.join(rollbackTarget, 'original.txt'), 'before');
  const txRoot = path.join(root, 'rollback-transaction'); beginCompositionTransaction({ projectRoot: rollbackTarget, transactionRoot: txRoot });
  fs.writeFileSync(path.join(rollbackTarget, 'original.txt'), 'after'); fs.writeFileSync(path.join(rollbackTarget, 'created.txt'), 'new');
  rollbackCompositionTransaction(txRoot); assert.equal(fs.readFileSync(path.join(rollbackTarget, 'original.txt'), 'utf8'), 'before'); assert.equal(fs.existsSync(path.join(rollbackTarget, 'created.txt')), false);

  const request = { schemaVersion: 1, kind: 'ai-baseline-composition-request', status: 'ready', request: { text: '组合客户管理和财务结算' }, sources: [{ id: 'a', projectRoot: a }, { id: 'b', projectRoot: b }], target: { projectRoot: c, stack: 'vue3-vite-ts' }, selections: [{ source: 'a', modules: ['home'] }, { source: 'b', modules: ['home'] }], policies: { moduleNameConflict: 'prefix-source', routeConflict: 'prefix-module', permissionConflict: 'prefix-module', sharedConflict: 'ask', dependencyConflict: 'ask', rollbackOnFailure: true, validate: false, e2e: false }, requiredQuestions: [] };
  const dry = await executeComposition({ request, baselineRoot, workspace: path.join(root, 'dry-workspace'), apply: false });
  assert.equal(dry.status, 'planned'); assert.equal(fs.existsSync(c), false, 'dry-run 不得修改目标项目');
  const applied = await executeComposition({ request, baselineRoot, workspace: path.join(root, 'apply-workspace'), apply: true });
  assert.equal(applied.status, 'completed', applied.error?.message); assert.ok(fs.existsSync(path.join(c, 'src', 'modules', 'a-home'))); assert.ok(fs.existsSync(path.join(c, 'src', 'modules', 'b-home'))); assert.ok(fs.existsSync(path.join(c, 'docs', 'project-composition.json')));
  const existing = path.join(root, 'existing-target');
  copyDirectory(path.join(baselineRoot, 'templates', 'vue3-vite-ts'), existing, { force: false, projectRoot: existing });
  fs.rmSync(path.join(existing, 'src', 'modules', 'home'), { recursive: true, force: true });
  fs.writeFileSync(path.join(existing, 'src', 'app', 'module-assembler.ts'), "// ai-baseline:module-imports:start\n// ai-baseline:module-imports:end\n\nexport const modules = [\n  // ai-baseline:module-list:start\n  // ai-baseline:module-list:end\n] as const;\n");
  const existingRequest = { ...request, target: { projectRoot: existing, stack: 'vue3-vite-ts' }, sources: [{ id: 'a', projectRoot: a }], selections: [{ source: 'a', modules: ['home'] }], policies: { ...request.policies, validate: false } };
  const existingApplied = await executeComposition({ request: existingRequest, baselineRoot, workspace: path.join(root, 'existing-workspace'), apply: true });
  assert.equal(existingApplied.status, 'completed', existingApplied.error?.message);
  assert.ok(fs.existsSync(path.join(existing, 'src', 'modules', 'home')));
  assert.ok(fs.existsSync(path.join(existing, '.ai-frontend-assembler', 'project-scheme.yml')));
  assert.ok(existingApplied.controlledExecution.changes.every((item) => existingApplied.changePlan.files.allowedRoots.some((rootPath) => rootPath === '.' || item.path === rootPath || item.path.startsWith(`${rootPath}/`))));

  console.log('composition-contract-check: pass');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
