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
  const result = spawnSync(command, commandArgs, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  const passed = result.status === 0;
  results.push({ label, passed, status: result.status });
  return passed;
}

function schemeScalar(key) {
  const schemeFile = path.join(baselineRoot, 'docs', 'project-scheme.yml');
  if (!fs.existsSync(schemeFile)) return '';
  const line = fs.readFileSync(schemeFile, 'utf8')
    .split(/\r?\n/)
    .find((item) => item.trimStart().startsWith(`${key}:`));
  return line ? line.slice(line.indexOf(':') + 1).trim().replace(/^['"]|['"]$/g, '') : '';
}

function selectedProfile() {
  const schemeFile = path.join(baselineRoot, 'docs', 'project-scheme.yml');
  if (!fs.existsSync(schemeFile)) return report.profile;
  const match = fs.readFileSync(schemeFile, 'utf8')
    .match(/^\s*selected_profile:\s*['"]?([^'"\r\n]+)['"]?\s*$/m);
  return match?.[1]?.trim() || report.profile;
}

function packageRunCommand(packageManager, script) {
  if (packageManager === 'yarn') return ['yarn', [script]];
  return [packageManager, ['run', script]];
}

const baselineScript = path.join(baselineRoot, 'scripts', 'baseline-check.mjs');
if (fs.existsSync(baselineScript)) {
  const baselineArgs = [baselineScript, '--project-root', projectRoot];
  const projectMode = schemeScalar('mode') || report.mode;
  const baselineMode = args.mode || (projectMode === 'existing-project' ? 'changed' : 'full');
  baselineArgs.push('--mode', baselineMode);
  if (!args['no-strict']) baselineArgs.push('--fail-on-warn');
  run(`baseline-check --mode ${baselineMode}`, process.execPath, baselineArgs);
} else {
  results.push({ label: 'baseline-check', passed: false, status: null });
  console.error('project-validate: 缺少 baseline-check.mjs');
}

const coverageScript = path.join(baselineRoot, 'scripts', 'acceptance-coverage-check.mjs');
if (!args['skip-acceptance-coverage'] && fs.existsSync(coverageScript)) run('acceptance-coverage-check', process.execPath, [coverageScript, '--project-root', projectRoot]);

const packageData = report.package.manifest !== 'unknown'
  ? JSON.parse(fs.readFileSync(path.join(projectRoot, report.package.manifest), 'utf8'))
  : null;
const packageManager = report.stack.package_manager || 'npm';
const checkNames = ['typecheck', 'lint', 'test', 'build'];

if (!args['baseline-only']) {
  for (const script of checkNames) {
    const explicitlyRequested = Boolean(args[script]);
    const explicitlySkipped = Boolean(args[`skip-${script}`]);
    const exists = Boolean(packageData?.scripts?.[script]);

    if (explicitlySkipped) continue;
    if (!exists) {
      if (explicitlyRequested) {
        results.push({ label: script, passed: false, status: null });
        console.error(`project-validate: 缺少 package.json scripts.${script}`);
      }
      continue;
    }

    const [command, commandArgs] = packageRunCommand(packageManager, script);
    run(`${command} ${commandArgs.join(' ')}`, command, commandArgs);
  }
}


if (!args['baseline-only'] && args['install-playwright']) {
  const command = packageManager === 'npm' ? 'npx' : packageManager === 'pnpm' ? 'pnpm' : 'yarn';
  const commandArgs = packageManager === 'npm' ? ['playwright', 'install', 'chromium'] : packageManager === 'pnpm' ? ['exec', 'playwright', 'install', 'chromium'] : ['playwright', 'install', 'chromium'];
  run(`${command} ${commandArgs.join(' ')}`, command, commandArgs);
}

if (!args['baseline-only'] && args['with-e2e']) {
  if (!packageData?.scripts?.['test:e2e']) {
    results.push({ label: 'test:e2e', passed: false, status: null });
    console.error('project-validate: --with-e2e 要求 package.json scripts.test:e2e');
  } else {
    const [command, commandArgs] = packageRunCommand(packageManager, 'test:e2e');
    run(`${command} ${commandArgs.join(' ')}`, command, commandArgs);
  }
}

const failed = results.filter((item) => !item.passed).length;
console.log(`project-validate: ${failed ? 'fail' : 'pass'}`);
console.log(`profile: ${selectedProfile()}`);
console.log(`package-manager: ${packageManager}`);
console.log(`checks: ${results.length}`);
if (failed) process.exit(1);
