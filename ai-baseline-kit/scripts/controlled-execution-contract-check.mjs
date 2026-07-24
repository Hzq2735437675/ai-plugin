#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateChangePlanGate } from './change-scope-validator-lib.mjs';
import { canTransition, createExecutionState, transitionExecutionState } from './execution-state-machine-lib.mjs';
import { executeControlledChange } from './controlled-change-executor-lib.mjs';

function plan(allowedRoots = ['src/modules/orders']) {
  return { schemaVersion: 1, kind: 'frontend-change-plan', status: 'ready', featureSpec: 'fixture', decision: { type: 'modify-feature', reason: 'fixture' }, ownership: { layer: 'modules', module: 'orders', moduleRoot: 'src/modules/orders' }, assembly: {}, files: { create: [], modify: [], allowedRoots, forbidden: ['.git/**'] }, requiredQuestions: [] };
}
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-controlled-execution-'));
try {
  const notReady = plan(); notReady.status = 'needs-confirmation';
  assert.equal(validateChangePlanGate(notReady).valid, false);
  const blocked = plan(); blocked.requiredQuestions = [{ question: 'confirm', blocking: true }];
  assert.equal(validateChangePlanGate(blocked).valid, false);
  const noRoots = plan([]); assert.equal(validateChangePlanGate(noRoots).valid, false);

  const state = createExecutionState({ id: 'state-fixture' });
  assert.equal(canTransition('initialized', 'planned'), true);
  assert.throws(() => transitionExecutionState(state, 'completed'), /非法执行状态跳转/);

  const allowedProject = path.join(root, 'allowed-project');
  fs.mkdirSync(path.join(allowedProject, 'src', 'modules', 'orders'), { recursive: true });
  fs.writeFileSync(path.join(allowedProject, 'src', 'modules', 'orders', 'index.ts'), 'export const value = 1;\n');
  const allowed = await executeControlledChange({
    projectRoot: allowedProject, workspace: path.join(root, 'allowed-workspace'), changePlan: plan(),
    execute: () => { fs.writeFileSync(path.join(allowedProject, 'src', 'modules', 'orders', 'index.ts'), 'export const value = 2;\n'); fs.writeFileSync(path.join(allowedProject, 'src', 'modules', 'orders', 'new.ts'), 'export {};\n'); },
    validate: () => ({ passed: true, checks: ['fixture'] }),
  });
  assert.equal(allowed.state, 'completed');
  assert.deepEqual(allowed.changes.map((item) => item.type).sort(), ['create', 'modify']);

  const escapedProject = path.join(root, 'escaped-project');
  fs.mkdirSync(path.join(escapedProject, 'src', 'modules', 'orders'), { recursive: true });
  fs.mkdirSync(path.join(escapedProject, 'src', 'modules', 'users'), { recursive: true });
  fs.writeFileSync(path.join(escapedProject, 'src', 'modules', 'orders', 'index.ts'), 'orders-before\n');
  fs.writeFileSync(path.join(escapedProject, 'src', 'modules', 'users', 'index.ts'), 'users-before\n');
  const escaped = await executeControlledChange({
    projectRoot: escapedProject, workspace: path.join(root, 'escaped-workspace'), changePlan: plan(),
    execute: () => { fs.writeFileSync(path.join(escapedProject, 'src', 'modules', 'users', 'index.ts'), 'users-after\n'); fs.writeFileSync(path.join(escapedProject, 'outside.txt'), 'forbidden\n'); },
    validate: () => ({ passed: true }),
  });
  assert.equal(escaped.state, 'rolled-back');
  assert.ok(escaped.violations.some((item) => item.code === 'out-of-scope-change'));
  assert.equal(fs.readFileSync(path.join(escapedProject, 'src', 'modules', 'users', 'index.ts'), 'utf8'), 'users-before\n');
  assert.equal(fs.existsSync(path.join(escapedProject, 'outside.txt')), false);

  const validationProject = path.join(root, 'validation-project');
  fs.mkdirSync(path.join(validationProject, 'src', 'modules', 'orders'), { recursive: true });
  fs.mkdirSync(path.join(validationProject, 'src', 'modules', 'users'), { recursive: true });
  fs.writeFileSync(path.join(validationProject, 'src', 'modules', 'orders', 'index.ts'), 'before\n');
  fs.writeFileSync(path.join(validationProject, 'src', 'modules', 'users', 'index.ts'), 'users-before\n');
  const validationMutation = await executeControlledChange({
    projectRoot: validationProject, workspace: path.join(root, 'validation-workspace'), changePlan: plan(),
    execute: () => fs.writeFileSync(path.join(validationProject, 'src', 'modules', 'orders', 'index.ts'), 'after\n'),
    validate: () => { fs.writeFileSync(path.join(validationProject, 'src', 'modules', 'users', 'index.ts'), 'users-after\n'); return { passed: true }; },
  });
  assert.equal(validationMutation.state, 'rolled-back');
  assert.ok(validationMutation.violations.some((item) => item.path === 'src/modules/users/index.ts'));
  assert.equal(fs.readFileSync(path.join(validationProject, 'src', 'modules', 'orders', 'index.ts'), 'utf8'), 'before\n');
  assert.equal(fs.readFileSync(path.join(validationProject, 'src', 'modules', 'users', 'index.ts'), 'utf8'), 'users-before\n');

  const baselineProject = path.join(root, 'baseline-project');
  fs.mkdirSync(path.join(baselineProject, 'src', 'modules', 'orders'), { recursive: true });
  fs.mkdirSync(path.join(baselineProject, 'ai-baseline-kit'), { recursive: true });
  fs.writeFileSync(path.join(baselineProject, 'ai-baseline-kit', 'AGENTS.md'), 'before\n');
  const baselinePlan = plan(['src/modules/orders', 'ai-baseline-kit/AGENTS.md']);
  const baseline = await executeControlledChange({
    projectRoot: baselineProject, workspace: path.join(root, 'baseline-workspace'), changePlan: baselinePlan,
    execute: () => fs.writeFileSync(path.join(baselineProject, 'ai-baseline-kit', 'AGENTS.md'), 'after\n'),
    validate: () => ({ passed: true }),
  });
  assert.equal(baseline.state, 'rolled-back');
  assert.ok(baseline.violations.some((item) => item.code === 'forbidden-file-change'));
  assert.equal(fs.readFileSync(path.join(baselineProject, 'ai-baseline-kit', 'AGENTS.md'), 'utf8'), 'before\n');

  console.log('controlled-execution-contract-check: pass');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
