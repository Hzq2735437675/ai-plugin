#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { analyzeProject, parseArgs, resolveRoots } from './project-tools-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const { baselineRoot, projectRoot: defaultProjectRoot } = resolveRoots(import.meta.url);
const projectRoot = path.resolve(args['project-root'] || defaultProjectRoot);
const report = analyzeProject(projectRoot);
const results = [];

function run(label, command, commandArgs) {
  const result = spawnSync(command, commandArgs, { cwd: projectRoot, stdio: 'inherit', shell: process.platform === 'win32' });
  const passed = result.status === 0;
  results.push({ label, passed, status: result.status });
  return passed;
}

const baselineScript = path.join(baselineRoot, 'scripts', 'baseline-check.mjs');
if (fs.existsSync(baselineScript)) run('baseline-check', process.execPath, [baselineScript]);

const packageData = report.package.manifest !== 'unknown'
  ? JSON.parse(fs.readFileSync(path.join(projectRoot, report.package.manifest), 'utf8'))
  : null;
const requestedChecks = [
  ['typecheck', Boolean(args.typecheck)],
  ['lint', Boolean(args.lint)],
  ['test', Boolean(args.test)],
  ['build', Boolean(args.build)],
];
for (const [script, requested] of requestedChecks) {
  if (!requested) continue;
  if (!packageData?.scripts?.[script]) {
    results.push({ label: script, passed: false, status: null, skipped: true });
    console.error(`project-validate: 缺少 package.json scripts.${script}`);
    continue;
  }
  run(`npm run ${script}`, 'npm', ['run', script]);
}

const failed = results.filter((item) => !item.passed).length;
console.log(`project-validate: ${failed ? 'fail' : 'pass'}`);
console.log(`profile: ${report.profile}`);
console.log(`checks: ${results.length}`);
if (failed) process.exit(1);
