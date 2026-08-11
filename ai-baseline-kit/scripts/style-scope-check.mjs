#!/usr/bin/env node
import path from 'node:path';
import { analyzeStyleIsolation, listStyleIsolationAdapters } from './style-scope-lib.mjs';
import { parseArgs, resolveRoots } from './project-tools-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const { projectRoot: defaultProjectRoot } = resolveRoots(import.meta.url);
const projectRoot = path.resolve(args['project-root'] || defaultProjectRoot);
const modulesRoot = args['modules-root'] || 'src/modules';

try {
  if (args['list-adapters']) {
    console.log(listStyleIsolationAdapters().join('\n'));
    process.exit(0);
  }
  const report = analyzeStyleIsolation({
    projectRoot,
    modulesRoot,
    moduleName: args.module || '',
    strategy: args.strategy || '',
    adapter: args.adapter || '',
    customAdapter: args['custom-adapter'] || '',
  });
  if (args.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log('style-scope-check: report');
    console.log(`project_root: ${projectRoot}`);
    console.log(`modules_root: ${modulesRoot}`);
    console.log(`strategy: ${report.strategy}`);
    console.log(`adapter: ${report.adapter}`);
    console.log(`style-files: ${report.summary.styleFiles}`);
    console.log(`css-modules: ${report.summary.cssModules}`);
    console.log(`vue-scoped-blocks: ${report.summary.vueScopedBlocks}`);
    console.log(`global-dependencies: ${report.globalDependencies.join(',') || 'none'}`);
    for (const item of report.violations) console.log(`[${item.level}] ${item.id}: ${item.message}${item.file ? ` (${item.file})` : ''}`);
    console.log(`summary: ${report.violations.filter((item) => item.level === 'error').length} error(s)`);
  }
  if (report.violations.some((item) => item.level === 'error')) process.exit(1);
  if (!args.json) console.log('style-scope-check: pass');
} catch (error) {
  console.error(`style-scope-check: fail: ${error.message}`);
  process.exit(1);
}
