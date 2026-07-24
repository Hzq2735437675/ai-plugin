#!/usr/bin/env node
import path from 'node:path';
import { discoverWorkspaceProjects } from './workspace-discovery-lib.mjs';
import { parseArgs } from './project-tools-lib.mjs';
import { writeJson } from './feature-tools-lib.mjs';
const args = parseArgs(process.argv.slice(2));
try {
  const report = discoverWorkspaceProjects({ workspaceRoot: path.resolve(args.root || args['workspace-root'] || process.cwd()), maxDepth: Number(args.depth || 2) });
  if (args.output) writeJson(path.resolve(args.output), report);
  console.log('workspace-discover: pass'); console.log(`projects: ${report.projects.length}`);
  for (const project of report.projects) console.log(`- ${project.name}: ${project.relativePath} profile=${project.profile}`);
  if (args.json) console.log(JSON.stringify(report, null, 2));
} catch (error) { console.error(`workspace-discover: fail: ${error.message}`); process.exit(1); }
