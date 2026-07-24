#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { copyDirectory, parseArgs, resolveRoots } from './project-tools-lib.mjs';
import { checkModuleCompatibility, importModuleBundle, readModuleBundle, validateBundleSet } from './module-portability-lib.mjs';
import { writeJson } from './feature-tools-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const { baselineRoot, projectRoot: defaultProjectRoot } = resolveRoots(import.meta.url);
const projectRoot = path.resolve(args['project-root'] || defaultProjectRoot);
const bundleValues = [args.bundles, args.bundle, ...args._].filter(Boolean).flatMap((value) => String(value).split(',')).filter(Boolean);
const bundlePaths = bundleValues.map((value) => path.resolve(value));

function run(script, scriptArgs) {
  const result = spawnSync(process.execPath, [script, ...scriptArgs], { cwd: projectRoot, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${path.basename(script)} 执行失败:\n${result.stderr || result.stdout}`);
  return result;
}

try {
  if (!bundlePaths.length) throw new Error('请通过 --bundles <bundle-a,bundle-b> 提供至少一个模块包。');
  for (const bundle of bundlePaths) if (!fs.existsSync(bundle)) throw new Error(`模块包不存在: ${bundle}`);
  const bundleSet = validateBundleSet(bundlePaths);
  if (!bundleSet.compatible) throw new Error(bundleSet.blockers.map((item) => item.message).join('\n'));

  const targetKit = path.join(projectRoot, path.basename(baselineRoot));
  const hasPackage = fs.existsSync(path.join(projectRoot, 'package.json'));
  if (!hasPackage) {
    if (!args.stack) throw new Error('组合到空目录时必须通过 --stack 指定标准模板。');
    if (args['dry-run']) throw new Error('空目录组合的 dry-run 请使用 project-compose-from-requirement 或 smart-compose，以保证目标目录零写入。');
    if (!fs.existsSync(targetKit)) copyDirectory(baselineRoot, targetKit, { force: false, projectRoot });
    run(path.join(targetKit, 'scripts', 'project-bootstrap.mjs'), ['--project-root', projectRoot, '--init-template', '--stack', args.stack]);
  }

  const reports = bundlePaths.map((bundlePath) => checkModuleCompatibility({ bundlePath, projectRoot }));
  const blockers = reports.flatMap((report) => report.blockers.map((item) => ({ module: report.module, ...item })));
  if (blockers.length) throw new Error(blockers.map((item) => `[${item.module}] ${item.message}`).join('\n'));

  const imports = [];
  if (!args['dry-run']) {
    if (!fs.existsSync(targetKit)) copyDirectory(baselineRoot, targetKit, { force: false, projectRoot });
    for (const bundlePath of bundlePaths) imports.push(importModuleBundle({ bundlePath, projectRoot }));
    const activeKit = fs.existsSync(targetKit) ? targetKit : baselineRoot;
    run(path.join(activeKit, 'scripts', 'project-bootstrap.mjs'), ['--project-root', projectRoot, '--no-legacy-baseline']);
  }

  const bundles = bundlePaths.map((bundlePath) => readModuleBundle(bundlePath).manifest);
  const composition = {
    schemaVersion: 1,
    kind: 'ai-baseline-project-composition',
    generatedAt: new Date().toISOString(),
    status: args['dry-run'] ? 'planned' : 'applied',
    target: { projectRoot, stack: args.stack || reports[0]?.targetStack?.profile || 'existing-project' },
    modules: bundles.map((bundle) => ({
      name: bundle.module.name,
      version: bundle.module.version,
      capabilities: bundle.contracts.capabilities,
      routes: bundle.contracts.routes,
      permissions: bundle.contracts.permissions,
      shared: bundle.contracts.shared,
      npm: bundle.contracts.npm,
      dev: bundle.contracts.dev,
      themeTokens: bundle.contracts.theme.requiredTokens,
    })),
    compatibility: reports.map((report) => ({ module: report.module, compatible: report.compatible, actions: report.actions })),
  };
  const output = path.resolve(args.output || path.join(projectRoot, 'docs', 'project-composition.json'));
  if (!args['dry-run'] || args.output) writeJson(output, composition);
  console.log('project-compose: pass');
  console.log(`mode: ${args['dry-run'] ? 'dry-run' : 'apply'}`);
  console.log(`modules: ${composition.modules.map((item) => item.name).join(', ')}`);
  console.log(`composition: ${output}`);
  if (args.json) console.log(JSON.stringify(composition, null, 2));
} catch (error) {
  console.error(`project-compose: fail: ${error.message}`);
  process.exit(1);
}
