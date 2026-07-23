#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { repairModuleBundle } from './module-bundle-repair-lib.mjs';
import { parseArgs } from './project-tools-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const bundlePath = path.resolve(args.bundle || args._[0] || '');
const output = path.resolve(args.output || args._[1] || '');

try {
  if (!bundlePath || !fs.existsSync(bundlePath)) throw new Error('请通过 --bundle <directory> 提供模块包。');
  if (!output) throw new Error('请通过 --output <directory> 提供修复输出目录。');
  const result = repairModuleBundle({
    bundlePath,
    output,
    rename: args.rename || '',
    routePrefix: args['route-prefix'] || '',
    permissionPrefix: args['permission-prefix'] || '',
    force: Boolean(args.force),
  });
  console.log('module-bundle-repair: pass');
  console.log(`module: ${result.manifest.module.name}`);
  console.log(`repairs: ${result.repairs.length}`);
  console.log(`output: ${result.outputRoot}`);
  if (args.json) console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(`module-bundle-repair: fail: ${error.message}`);
  process.exit(1);
}
