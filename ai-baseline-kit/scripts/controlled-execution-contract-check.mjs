#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateChangePlanGate } from './change-scope-validator-lib.mjs';
import { canTransition, createExecutionState, transitionExecutionState } from './execution-state-machine-lib.mjs';
import { executeControlledChange } from './controlled-change-executor-lib.mjs';

function plan(allowedRoots = ['src/modules/orders']) {
  return { schemaVersion: 1, kind: 'frontend-change-plan', status: 'ready', featureSpec: 'fixture', decision: { type: 'modify-feature', reason: 'fixture' }, ownership: { layer: 'modules', module: 'orders', moduleRoot: 'src/modules/orders' }, assembly: {}, files: { create: [], modify: [], allowedRoots, forbidden: ['.git/**'] }, requiredQuestions: [] };
}
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
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

  const repairProject = path.join(root, 'repair-project');
  fs.mkdirSync(path.join(repairProject, 'src', 'modules', 'orders'), { recursive: true });
  const repairFile = path.join(repairProject, 'src', 'modules', 'orders', 'index.ts');
  fs.writeFileSync(repairFile, 'broken\n');
  let validations = 0; let repairs = 0;
  const repairPlan = plan(); repairPlan.executionPolicy = { rollbackOnFailure: true, requireValidation: true, maxRepairAttempts: 2 };
  const repaired = await executeControlledChange({
    projectRoot: repairProject, workspace: path.join(root, 'repair-workspace'), changePlan: repairPlan,
    execute: () => fs.writeFileSync(repairFile, 'generated-broken\n'),
    validate: () => ({ passed: ++validations > 1, message: 'fixture validation failed' }),
    repair: () => { repairs += 1; fs.writeFileSync(repairFile, 'generated-fixed\n'); },
  });
  assert.equal(repaired.state, 'completed');
  assert.equal(repairs, 1);
  assert.equal(repaired.validation.length, 2);
  assert.equal(fs.readFileSync(repairFile, 'utf8'), 'generated-fixed\n');

  const repairEscapeProject = path.join(root, 'repair-escape-project');
  fs.mkdirSync(path.join(repairEscapeProject, 'src', 'modules', 'orders'), { recursive: true });
  fs.mkdirSync(path.join(repairEscapeProject, 'src', 'modules', 'users'), { recursive: true });
  fs.writeFileSync(path.join(repairEscapeProject, 'src', 'modules', 'orders', 'index.ts'), 'before\n');
  fs.writeFileSync(path.join(repairEscapeProject, 'src', 'modules', 'users', 'index.ts'), 'users-before\n');
  const escapeRepairPlan = plan(); escapeRepairPlan.executionPolicy = { rollbackOnFailure: true, requireValidation: true, maxRepairAttempts: 1 };
  const repairEscaped = await executeControlledChange({
    projectRoot: repairEscapeProject, workspace: path.join(root, 'repair-escape-workspace'), changePlan: escapeRepairPlan,
    execute: () => fs.writeFileSync(path.join(repairEscapeProject, 'src', 'modules', 'orders', 'index.ts'), 'after\n'),
    validate: () => ({ passed: false, message: 'force repair' }),
    repair: () => fs.writeFileSync(path.join(repairEscapeProject, 'src', 'modules', 'users', 'index.ts'), 'escaped\n'),
  });
  assert.equal(repairEscaped.state, 'rolled-back');
  assert.ok(repairEscaped.violations.some((item) => item.path === 'src/modules/users/index.ts'));

  const cliProject = path.join(root, 'cli-repair-project');
  const cliModuleRoot = path.join(cliProject, 'src', 'modules', 'orders');
  fs.mkdirSync(cliModuleRoot, { recursive: true });
  fs.writeFileSync(path.join(cliModuleRoot, 'index.ts'), 'before\n');
  const cliPlan = plan(); cliPlan.executionPolicy = { rollbackOnFailure: true, requireValidation: true, maxRepairAttempts: 9 };
  const cliPlanFile = path.join(cliProject, 'change-plan.json');
  fs.writeFileSync(cliPlanFile, `${JSON.stringify(cliPlan, null, 2)}\n`);
  const executeScript = path.join(cliProject, 'execute.mjs');
  const validateScript = path.join(cliProject, 'validate.mjs');
  const repairScript = path.join(cliProject, 'repair.mjs');
  fs.writeFileSync(executeScript, "import fs from 'node:fs'; fs.writeFileSync('src/modules/orders/index.ts', 'generated-broken\\n');\n");
  fs.writeFileSync(validateScript, "import fs from 'node:fs'; process.exit(fs.readFileSync('src/modules/orders/index.ts', 'utf8').includes('fixed') ? 0 : 1);\n");
  fs.writeFileSync(repairScript, "import fs from 'node:fs'; fs.writeFileSync('src/modules/orders/index.ts', 'generated-fixed\\n');\n");
  const cli = spawnSync(process.execPath, [path.join(currentDirectory, 'controlled-change-executor.mjs'), '--project-root', cliProject, '--plan', cliPlanFile, '--script', executeScript, '--validate-script', validateScript, '--repair-script', repairScript, '--workspace', path.join(root, 'cli-repair-workspace')], { cwd: cliProject, encoding: 'utf8' });
  assert.equal(cli.status, 0, `${cli.stdout}\n${cli.stderr}`);
  assert.equal(fs.readFileSync(path.join(cliModuleRoot, 'index.ts'), 'utf8'), 'generated-fixed\n');
  const cliRecord = JSON.parse(fs.readFileSync(path.join(root, 'cli-repair-workspace', 'controlled-execution.json'), 'utf8'));
  assert.equal(cliRecord.policy.maxRepairAttempts, 3);
  assert.equal(cliRecord.repairs.length, 1);

  console.log('controlled-execution-contract-check: pass');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
