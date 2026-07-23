#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { discoverProjectModules } from './module-discovery-lib.mjs';
import { parseArgs, resolveRoots } from './project-tools-lib.mjs';
import { writeJson } from './feature-tools-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const { projectRoot: defaultProjectRoot } = resolveRoots(import.meta.url);
const projectRoot = path.resolve(args['project-root'] || defaultProjectRoot);
const query = args.query || args.request || '';

try {
  const report = discoverProjectModules({ projectRoot, query });
  if (args.output) writeJson(path.resolve(args.output), report);
  console.log('module-discover: pass');
  console.log(`project: ${report.project.name}`);
  console.log(`modules: ${report.summary.total}`);
  console.log(`ready: ${report.summary.ready}`);
  for (const item of report.modules) {
    console.log(`- ${item.name}: ready=${item.readiness.ready} score=${item.match.score} title=${item.title}`);
  }
  if (args.json) console.log(JSON.stringify(report, null, 2));
  if (args['fail-on-unready'] && report.summary.ready !== report.summary.total) process.exit(1);
} catch (error) {
  console.error(`module-discover: fail: ${error.message}`);
  process.exit(1);
}
