#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildChangedFileManifest, discoverGitChanges, verifyDeliveryReceipt } from './delivery-receipt-lib.mjs';
import { writeJson } from './feature-tools-lib.mjs';

const baselineRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-delivery-closure-'));
function run(script, args) {
  return spawnSync(process.execPath, [path.join(baselineRoot, 'scripts', script), ...args], { cwd: root, encoding: 'utf8' });
}
try {
  const source = path.join(root, 'src', 'feature.ts');
  const changedFiles = path.join(root, 'changed-files.json');
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.writeFileSync(source, 'export const feature = true;\n');
  writeJson(changedFiles, { changes: [{ path: 'src/feature.ts', type: 'create' }] });
  const clean = run('implementation-completeness-check.mjs', ['--project-root', root, '--changed-files', changedFiles]);
  assert.equal(clean.status, 0, clean.stderr || clean.stdout);

  fs.writeFileSync(source, '// TODO: incomplete\nexport const feature = true;\n');
  const incomplete = run('implementation-completeness-check.mjs', ['--project-root', root, '--changed-files', changedFiles]);
  assert.notEqual(incomplete.status, 0);
  assert.match(`${incomplete.stdout}${incomplete.stderr}`, /unfinished-marker/);

  fs.writeFileSync(source, '// TODO: approved later ai-baseline:approved-incomplete\nexport const feature = true;\n');
  const approved = run('implementation-completeness-check.mjs', ['--project-root', root, '--changed-files', changedFiles]);
  assert.equal(approved.status, 0, approved.stderr || approved.stdout);

  fs.writeFileSync(source, 'export const feature = true;\n');
  const manifest = buildChangedFileManifest(root, [{ path: 'src/feature.ts', type: 'create' }]);
  const receiptFile = path.join(root, 'receipt.json');
  writeJson(receiptFile, {
    schemaVersion: 1,
    kind: 'ai-frontend-delivery-receipt',
    status: 'passed',
    requestId: 'contract',
    createdAt: new Date().toISOString(),
    projectRoot: root,
    changedFilesHash: manifest.sha256,
    changedFiles: manifest.manifest,
    checks: { implementationCompleteness: 'passed', astBoundary: 'passed', projectValidation: 'passed', finalGate: 'passed' },
    remainingRisks: [],
  });
  assert.equal(verifyDeliveryReceipt(receiptFile, { projectRoot: root, requestId: 'contract' }).valid, true);
  const forgedReceipt = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
  forgedReceipt.checks.implementationCompleteness = 'not-run';
  writeJson(receiptFile, forgedReceipt);
  assert.equal(verifyDeliveryReceipt(receiptFile, { projectRoot: root, requestId: 'contract' }).valid, false);
  forgedReceipt.checks.implementationCompleteness = 'passed';
  forgedReceipt.projectRoot = path.join(root, 'other-project');
  writeJson(receiptFile, forgedReceipt);
  assert.equal(verifyDeliveryReceipt(receiptFile, { projectRoot: root, requestId: 'contract' }).valid, false);
  forgedReceipt.projectRoot = root;
  writeJson(receiptFile, forgedReceipt);
  fs.writeFileSync(source, 'export const feature = false;\n');
  assert.equal(verifyDeliveryReceipt(receiptFile, { projectRoot: root, requestId: 'contract' }).valid, false);
  const gitProject = path.join(root, 'git-project');
  fs.mkdirSync(gitProject, { recursive: true });
  const deletedFile = path.join(gitProject, 'deleted.ts');
  fs.writeFileSync(deletedFile, 'export const removed = true;\n');
  for (const command of [
    ['init'],
    ['add', 'deleted.ts'],
    ['-c', 'user.name=AI-Baseline', '-c', 'user.email=baseline@example.invalid', 'commit', '-m', 'fixture'],
  ]) {
    const result = spawnSync('git', command, { cwd: gitProject, encoding: 'utf8', shell: process.platform === 'win32' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
  fs.rmSync(deletedFile);
  assert.ok(discoverGitChanges(gitProject).some((item) => item.path === 'deleted.ts'), 'git deletion must be included in delivery manifest discovery');

  const gateProject = path.join(root, 'gate-project');
  fs.mkdirSync(path.join(gateProject, 'src'), { recursive: true });
  fs.writeFileSync(path.join(gateProject, 'package.json'), `${JSON.stringify({ name: 'delivery-gate-fixture', private: true, scripts: {} }, null, 2)}\n`);
  fs.writeFileSync(path.join(gateProject, 'src', 'main.ts'), 'export const ready = true;\n');
  const bootstrap = run('project-bootstrap.mjs', ['--project-root', gateProject]);
  assert.equal(bootstrap.status, 0, bootstrap.stderr || bootstrap.stdout);
  const gateChanged = path.join(gateProject, 'changed-files.json');
  writeJson(gateChanged, { changes: [{ path: 'src/main.ts', type: 'modify' }] });
  const gateReceipt = path.join(gateProject, '.ai-frontend-assembler', 'deliveries', 'gate-contract.delivery.json');
  const gateArgs = ['--project-root', gateProject, '--request-id', 'gate-contract', '--changed-files', gateChanged, '--output', gateReceipt, '--allow-parser-fallback', '--no-strict', '--skip-typecheck', '--skip-lint', '--skip-test', '--skip-build'];
  const gatePassed = run('delivery-gate.mjs', gateArgs);
  assert.equal(gatePassed.status, 0, `${gatePassed.stdout}\n${gatePassed.stderr}`);
  assert.equal(verifyDeliveryReceipt(gateReceipt, { projectRoot: gateProject, requestId: 'gate-contract' }).valid, true);
  const repeatedGate = run('delivery-gate.mjs', gateArgs);
  assert.equal(repeatedGate.status, 0, `${repeatedGate.stdout}\n${repeatedGate.stderr}`);
  assert.equal(verifyDeliveryReceipt(gateReceipt, { projectRoot: gateProject, requestId: 'gate-contract' }).valid, true, 'repeated Gate must not hash its own stale receipt');
  fs.writeFileSync(path.join(gateProject, 'src', 'main.ts'), '// TODO: unfinished gate contract\nexport const ready = true;\n');
  const gateFailed = run('delivery-gate.mjs', gateArgs);
  assert.notEqual(gateFailed.status, 0);
  assert.equal(fs.existsSync(gateReceipt), false, 'failing gate must remove stale delivery receipt');

  console.log('delivery-closure-contract-check: pass');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

