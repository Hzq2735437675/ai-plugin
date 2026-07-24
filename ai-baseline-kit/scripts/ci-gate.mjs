#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, resolveRoots } from './project-tools-lib.mjs';
import { PROJECT_STATE_DIRECTORY, getProjectStatePaths, isPackageRepositoryReferenceFile, resolveProjectSchemeFile } from './project-state-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const { baselineRoot, projectRoot: defaultProjectRoot } = resolveRoots(import.meta.url);
const projectRoot = path.resolve(args['project-root'] || defaultProjectRoot);
const state = getProjectStatePaths(projectRoot, baselineRoot);
const schemeFile = resolveProjectSchemeFile(projectRoot, baselineRoot);
const checks = [];

function record(label, passed, detail = '') {
  checks.push({ label, passed, detail });
  console.log(`[${passed ? 'pass' : 'fail'}] ${label}${detail ? `: ${detail}` : ''}`);
}

function run(label, script, scriptArgs) {
  const result = spawnSync(process.execPath, [path.join(baselineRoot, 'scripts', script), ...scriptArgs], {
    cwd: projectRoot,
    stdio: 'inherit',
  });
  const passed = result.status === 0;
  record(label, passed, `exit ${result.status ?? 1}`);
  return passed;
}

function checkEntrypoint(file) {
  const target = path.join(projectRoot, file);
  const text = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  return text.includes('ai-baseline-kit/AGENTS.md');
}

try {
  const packageRepository = fs.existsSync(path.join(projectRoot, 'package-registry.json'));
  const externalScheme = path.resolve(schemeFile) === path.resolve(state.schemeFile);
  record('project-state', packageRepository || (externalScheme && fs.existsSync(schemeFile) && !isPackageRepositoryReferenceFile(schemeFile)), packageRepository ? 'package repository reference' : `${PROJECT_STATE_DIRECTORY}/project-scheme.yml`);
  record('AGENTS entrypoint', checkEntrypoint('AGENTS.md'), 'AGENTS.md');
  record('CLAUDE entrypoint', checkEntrypoint('CLAUDE.md'), 'CLAUDE.md');

  if (!args['allow-parser-fallback'] && !args['baseline-only']) {
    run('AST parser hard gate', 'ast-boundary-check.mjs', ['--project-root', projectRoot, '--require-parser']);
  }

  const validateArgs = ['--project-root', projectRoot];
  for (const flag of ['baseline-only', 'with-e2e', 'install-playwright', 'no-strict', 'skip-typecheck', 'skip-lint', 'skip-test', 'skip-build']) {
    if (args[flag]) validateArgs.push(`--${flag}`);
  }
  run('project validation', 'project-validate.mjs', validateArgs);

  const failed = checks.filter((item) => !item.passed);
  console.log(`ci-gate: ${failed.length ? 'fail' : 'pass'}`);
  console.log(`checks: ${checks.length}`);
  if (failed.length) process.exit(1);
} catch (error) {
  console.error(`ci-gate: fail: ${error.message}`);
  process.exit(1);
}
