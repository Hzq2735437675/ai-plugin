#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  cleanProtectedArtifacts,
  discoverBuildOutputDirectories,
  findProtectedArtifacts,
} from './build-isolation-lib.mjs';
import { parseArgs, resolveRoots } from './project-tools-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const { baselineRoot, projectRoot: defaultProjectRoot } = resolveRoots(import.meta.url);
const projectRoot = path.resolve(args['project-root'] || defaultProjectRoot);
const explicitOutputs = String(args.output || process.env.AI_BASELINE_OUTPUT_DIRS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const shouldClean = !args.check;

try {
  const outputDirectories = discoverBuildOutputDirectories(projectRoot, explicitOutputs);
  const findings = findProtectedArtifacts({ projectRoot, baselineRoot, outputDirectories });
  const cleaned = shouldClean ? cleanProtectedArtifacts(findings) : [];
  const remaining = findProtectedArtifacts({ projectRoot, baselineRoot, outputDirectories });

  console.log(`build-artifact-guard: ${remaining.length ? 'fail' : 'pass'}`);
  console.log(`mode: ${shouldClean ? 'clean-and-verify' : 'check-only'}`);
  console.log(`outputs-scanned: ${outputDirectories.filter((item) => item.startsWith(projectRoot) && item !== projectRoot && fs.existsSync(item)).length}`);
  console.log(`protected-artifacts-found: ${findings.length}`);
  console.log(`protected-artifacts-cleaned: ${cleaned.length}`);
  for (const item of cleaned) console.log(`- cleaned: ${item}`);
  for (const item of remaining) console.error(`- remaining: ${item.relative}`);
  if (remaining.length) process.exit(1);
} catch (error) {
  console.error(`build-artifact-guard: fail: ${error.message}`);
  process.exit(1);
}
