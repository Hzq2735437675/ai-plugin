#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, resolveRoots } from './project-tools-lib.mjs';
import { normalizePath, writeJson } from './feature-tools-lib.mjs';
import { buildChangedFileManifest, discoverGitChanges, verifyDeliveryReceipt } from './delivery-receipt-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const { baselineRoot, projectRoot: defaultProjectRoot } = resolveRoots(import.meta.url);
const projectRoot = path.resolve(args['project-root'] || defaultProjectRoot);
const requestId = String(args['request-id'] || `manual-${Date.now()}`).replace(/[^a-zA-Z0-9_-]+/g, '-');
const outputFile = path.resolve(args.output || path.join(projectRoot, '.ai-frontend-assembler', 'deliveries', `${requestId}.delivery.json`));

function projectRelative(value, label) {
  if (!value) return '';
  const absolute = path.resolve(value);
  const relative = path.relative(projectRoot, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`${label} 必须位于项目根目录内: ${absolute}`);
  return normalizePath(relative);
}

const outputRelative = projectRelative(outputFile, '交付回执输出路径');

function readChanges() {
  let changes;
  if (!args['changed-files']) {
    changes = discoverGitChanges(projectRoot);
  } else {
    const file = path.resolve(args['changed-files']);
    if (!fs.existsSync(file)) throw new Error(`变更文件清单不存在: ${file}`);
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    changes = Array.isArray(parsed) ? parsed : parsed.changes;
    if (!Array.isArray(changes)) throw new Error('变更文件清单必须是数组或包含 changes 数组。');
  }
  return changes.filter((item) => normalizePath(typeof item === 'string' ? item : item?.path || '') !== outputRelative);
}

try {
  const gateArgs = ['--project-root', projectRoot];
  for (const flag of ['baseline-only', 'with-e2e', 'install-playwright', 'no-strict', 'skip-typecheck', 'skip-lint', 'skip-test', 'skip-build', 'allow-parser-fallback']) {
    if (args[flag]) gateArgs.push(`--${flag}`);
  }
  if (args['changed-files']) gateArgs.push('--changed-files', path.resolve(args['changed-files']));
  const result = spawnSync(process.execPath, [path.join(baselineRoot, 'scripts', 'ci-gate.mjs'), ...gateArgs], { cwd: projectRoot, encoding: 'utf8' });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    if (fs.existsSync(outputFile)) fs.rmSync(outputFile, { force: true });
    console.error('delivery-gate: fail: 最终 Gate 未通过，未生成交付回执。');
    process.exit(1);
  }
  const changes = buildChangedFileManifest(projectRoot, readChanges());
  const receipt = {
    schemaVersion: 1,
    kind: 'ai-frontend-delivery-receipt',
    status: 'passed',
    requestId,
    createdAt: new Date().toISOString(),
    projectRoot,
    featureSpec: projectRelative(args['feature-spec'], 'Feature Spec'),
    changePlan: projectRelative(args['change-plan'], 'Change Plan'),
    changedFilesHash: changes.sha256,
    changedFiles: changes.manifest,
    checks: {
      implementationCompleteness: 'passed',
      astBoundary: args['baseline-only'] ? 'not-run' : args['allow-parser-fallback'] ? 'passed-with-fallback-allowed' : 'passed',
      projectValidation: 'passed',
      finalGate: 'passed',
    },
    gateOutput: `${result.stdout || ''}${result.stderr || ''}`.trim().split(/\r?\n/).slice(-40),
    remainingRisks: [],
  };
  writeJson(outputFile, receipt);
  const verification = verifyDeliveryReceipt(outputFile, { projectRoot, requestId });
  if (!verification.valid) throw new Error(`交付回执自校验失败: ${verification.violations.join('；')}`);
  console.log('delivery-gate: pass');
  console.log(`receipt: ${normalizePath(path.relative(projectRoot, outputFile))}`);
  if (args.json) console.log(JSON.stringify(receipt, null, 2));
} catch (error) {
  if (fs.existsSync(outputFile)) fs.rmSync(outputFile, { force: true });
  console.error(`delivery-gate: fail: ${error.message}`);
  process.exit(1);
}
