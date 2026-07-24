#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { ensureRootEntrypoints, parseArgs, resolveRoots } from './project-tools-lib.mjs';
import { isPackageRepositoryReferenceFile, migrateLegacyProjectState, projectStateRelative, resolveProjectSchemeFile, writeProjectStateManifest } from './project-state-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const { baselineRoot, projectRoot: defaultProjectRoot } = resolveRoots(import.meta.url);
const projectRoot = path.resolve(args['project-root'] || defaultProjectRoot);

try {
  const migration = migrateLegacyProjectState({ projectRoot, baselineRoot });
  const schemeFile = resolveProjectSchemeFile(projectRoot, baselineRoot);
  const packageRepository = fs.existsSync(path.join(projectRoot, 'package-registry.json'));
  if (!fs.existsSync(schemeFile) || (isPackageRepositoryReferenceFile(schemeFile) && !packageRepository)) {
    throw new Error('未找到可保留的项目专属地图。首次接入请运行 ai-run init；从 0.9.x 或更早版本升级时，应先迁移旧项目状态。');
  }
  const entrypoints = ensureRootEntrypoints(projectRoot, path.basename(baselineRoot));
  const manifest = writeProjectStateManifest({
    projectRoot,
    baselineRoot,
    mode: isPackageRepositoryReferenceFile(schemeFile) ? 'package-repository-reference' : 'target-project',
  });
  console.log('project-upgrade: pass');
  console.log(`scheme: ${projectStateRelative(projectRoot, schemeFile)}`);
  console.log(`state: ${projectStateRelative(projectRoot, manifest)}`);
  console.log(`migrated: ${migration.migrations.length}`);
  console.log(`ai-entrypoints: ${entrypoints.length ? entrypoints.join(', ') : 'unchanged'}`);
} catch (error) {
  console.error(`project-upgrade: fail: ${error.message}`);
  process.exit(1);
}
