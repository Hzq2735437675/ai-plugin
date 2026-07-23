#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, resolveRoots } from './project-tools-lib.mjs';
import { checkModuleCompatibility } from './module-portability-lib.mjs';
import { writeJson } from './feature-tools-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const { projectRoot: defaultProjectRoot } = resolveRoots(import.meta.url);
const projectRoot = path.resolve(args['project-root'] || defaultProjectRoot);
const bundlePath = path.resolve(args.bundle || args._[0] || '');

try {
  if (!bundlePath || !fs.existsSync(bundlePath)) throw new Error('请通过 --bundle <directory> 提供模块包。');
  const report = checkModuleCompatibility({ bundlePath, projectRoot });
  if (args.output) writeJson(path.resolve(args.output), report);
  console.log(`module-compatibility-check: ${report.compatible ? 'pass' : 'fail'}`);
  console.log(`module: ${report.module}`);
  console.log(`compatible: ${report.compatible}`);
  console.log(`blocking: ${report.blockers.length}`);
  console.log(`actions: ${report.actions.length}`);
  for (const blocker of report.blockers) console.log(`- blocker:${blocker.code}: ${blocker.message}`);
  for (const action of report.actions) console.log(`- action:${action.type}: ${action.name || action.path || action.token || action.module || ''}`);
  if (args.json) console.log(JSON.stringify(report, null, 2));
  if (!report.compatible) process.exitCode = 1;
} catch (error) {
  console.error(`module-compatibility-check: fail: ${error.message}`);
  process.exit(1);
}
