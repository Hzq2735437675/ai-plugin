#!/usr/bin/env node
import path from 'node:path';
import { parseArgs, resolveRoots } from './project-tools-lib.mjs';
import { exportModuleBundle } from './module-portability-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const { projectRoot: defaultProjectRoot } = resolveRoots(import.meta.url);
const projectRoot = path.resolve(args['project-root'] || defaultProjectRoot);
const moduleName = args.module || args._[0];
const output = path.resolve(args.output || args._[1] || path.join(projectRoot, 'dist', 'module-bundles', moduleName || 'module'));

try {
  if (!moduleName) throw new Error('请通过 --module <name> 指定要导出的模块。');
  const result = exportModuleBundle({ projectRoot, moduleName, output, force: Boolean(args.force) });
  console.log('module-export: pass');
  console.log(`module: ${result.manifest.module.name}`);
  console.log(`output: ${result.outputRoot}`);
  console.log(`files: ${result.manifest.files.length}`);
  console.log(`shared-contracts: ${result.manifest.contracts.shared.length}`);
  if (args.json) console.log(JSON.stringify(result.manifest, null, 2));
} catch (error) {
  console.error(`module-export: fail: ${error.message}`);
  process.exit(1);
}
