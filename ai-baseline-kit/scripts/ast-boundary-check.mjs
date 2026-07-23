#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, resolveRoots } from './project-tools-lib.mjs';
import { analyzeAstBoundaries } from './ast-boundary-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const { baselineRoot, projectRoot: defaultProjectRoot } = resolveRoots(import.meta.url);
const projectRoot = path.resolve(args['project-root'] || defaultProjectRoot);

try {
  const report = analyzeAstBoundaries({ projectRoot, baselineRoot });
  if (args.output) {
    const output = path.resolve(args.output);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`ast-boundary-check: ${report.violations.length ? 'fail' : 'pass'}`);
    console.log(`parser: ${report.parser.available ? `typescript ${report.parser.typescript}` : 'unavailable'}`);
    console.log(`files: ${report.files.length}`);
    console.log(`edges: ${report.edges.length}`);
    console.log(`violations: ${report.violations.length}`);
    for (const item of report.notices) console.log(`${item.level}: ${item.id}: ${item.message}`);
    for (const item of report.violations) console.log(`${item.level}: ${item.id}: ${item.file}:${item.line}: ${item.message}`);
  }
  if ((args['require-parser'] && !report.parser.available) || report.violations.length) process.exitCode = 1;
} catch (error) {
  console.error(`ast-boundary-check: fail: ${error.message}`);
  process.exitCode = 1;
}
