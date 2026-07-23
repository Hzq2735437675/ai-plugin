#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs, resolveRoots } from './project-tools-lib.mjs';
import { importModuleBundle } from './module-portability-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const { baselineRoot, projectRoot: defaultProjectRoot } = resolveRoots(import.meta.url);
const projectRoot = path.resolve(args['project-root'] || defaultProjectRoot);
const bundlePath = path.resolve(args.bundle || args._[0] || '');

try {
  if (!bundlePath || !fs.existsSync(bundlePath)) throw new Error('请通过 --bundle <directory> 提供模块包。');
  const result = importModuleBundle({ bundlePath, projectRoot, dryRun: Boolean(args['dry-run']) });
  if (!args['dry-run'] && !args['skip-bootstrap']) {
    const bootstrap = spawnSync(process.execPath, [path.join(baselineRoot, 'scripts', 'project-bootstrap.mjs'), '--project-root', projectRoot, '--no-legacy-baseline'], { cwd: projectRoot, encoding: 'utf8' });
    if (bootstrap.status !== 0) throw new Error(`模块已导入，但项目地图更新失败: ${bootstrap.stderr || bootstrap.stdout}`);
  }
  console.log('module-import: pass');
  console.log(`module: ${result.report.module}`);
  console.log(`mode: ${args['dry-run'] ? 'dry-run' : 'apply'}`);
  console.log(`changes: ${result.changed.length}`);
  for (const item of result.changed) console.log(`- ${item}`);
  if (args.json) console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(`module-import: fail: ${error.message}`);
  process.exit(1);
}
