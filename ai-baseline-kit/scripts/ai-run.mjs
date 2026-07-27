#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { parseArgs, resolveRoots } from './project-tools-lib.mjs';

const raw = process.argv.slice(2);
const args = parseArgs(raw);
const { baselineRoot, projectRoot: defaultProjectRoot } = resolveRoots(import.meta.url);
const command = args._[0] || (args.request || args.document || args.input ? 'develop' : 'init');
const projectRoot = path.resolve(args['project-root'] || defaultProjectRoot);

function withoutCommand(argv) {
  let removed = false;
  return argv.filter((item) => {
    if (!removed && !item.startsWith('--') && item === command) {
      removed = true;
      return false;
    }
    return true;
  });
}

function ensureProjectRoot(argv) {
  return argv.some((item) => item === '--project-root' || item.startsWith('--project-root='))
    ? argv
    : [...argv, '--project-root', projectRoot];
}

function run(script, argv) {
  const result = spawnSync(process.execPath, [path.join(baselineRoot, 'scripts', script), ...argv], {
    cwd: projectRoot,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

try {
  const passthrough = withoutCommand(raw);
  let status;
  if (command === 'init' || command === 'activate') {
    const bootstrapArgs = ensureProjectRoot(passthrough.filter((item) => item !== '--plan-only'));
    status = run('project-bootstrap.mjs', bootstrapArgs);
  } else if (command === 'upgrade') {
    status = run('project-upgrade.mjs', ensureProjectRoot(passthrough));
  } else if (command === 'doctor' || command === 'status') {
    status = run('project-doctor.mjs', ensureProjectRoot(passthrough));
  } else if (command === 'develop' || command === 'compose' || command === 'repair') {
    status = run('smart-develop.mjs', ensureProjectRoot(passthrough));
  } else if (command === 'validate') {
    status = run('project-validate.mjs', ensureProjectRoot(passthrough));
  } else if (command === 'gate') {
    status = run('delivery-gate.mjs', ensureProjectRoot(passthrough));
  } else {
    throw new Error(`不支持的统一入口命令: ${command}。可选值: init, activate, develop, compose, repair, validate, gate, doctor, upgrade。`);
  }
  process.exit(status);
} catch (error) {
  console.error(`ai-run: fail: ${error.message}`);
  process.exit(1);
}
