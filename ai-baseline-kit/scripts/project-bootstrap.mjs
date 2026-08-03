#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  analyzeProject,
  copyDirectory,
  ensureRootEntrypoints,
  parseArgs,
  projectHasBusinessFiles,
  profileTemplatePath,
  writeProjectScheme,
  STANDARD_PROFILES,
  DEFAULT_PROFILE_ID,
  resolveRoots,
} from './project-tools-lib.mjs';
import { getProjectStatePaths, isPackageRepositoryReferenceFile, migrateLegacyProjectState, projectStateRelative, resolveProjectSchemeFile, resolveLegacyBaselineFile, writeProjectStateManifest } from './project-state-lib.mjs';
import { ensureBuildIsolation } from './build-isolation-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const { baselineRoot, projectRoot: defaultProjectRoot } = resolveRoots(import.meta.url);
const projectRoot = path.resolve(args['project-root'] || defaultProjectRoot);
const initTemplateProfile = typeof args['init-template'] === 'string' ? args['init-template'] : undefined;
const requestedProfile = args.stack || initTemplateProfile || args._[0]
  || (args['init-template'] ? DEFAULT_PROFILE_ID : undefined);
const shouldInitTemplate = Boolean(args['init-template']);
const profileId = requestedProfile || DEFAULT_PROFILE_ID;

function readPreservedProfile() {
  const schemeFile = resolveProjectSchemeFile(projectRoot, baselineRoot);
  if (!fs.existsSync(schemeFile)) return undefined;
  const match = fs.readFileSync(schemeFile, 'utf8')
    .match(/^\s*selected_profile:\s*['"]?([^'"\r\n]+)['"]?\s*$/m);
  const profile = match?.[1]?.trim();
  return profile && STANDARD_PROFILES[profile] ? profile : undefined;
}

try {
  if (requestedProfile && !STANDARD_PROFILES[requestedProfile]) {
    throw new Error(`不支持的标准模板: ${requestedProfile}。可选值: ${Object.keys(STANDARD_PROFILES).join(', ')}`);
  }

  const stateMigration = migrateLegacyProjectState({ projectRoot, baselineRoot, create: true });
  const preservedProfile = readPreservedProfile();
  const before = analyzeProject(projectRoot, { requestedProfile, preservedProfile });
  if (shouldInitTemplate) {
    if (before.mode === 'existing-project' && !args.force) {
      throw new Error('目标目录已检测到既有项目；初始化模板前请确认目标为空，或显式使用 --force。');
    }
    if (projectHasBusinessFiles(projectRoot) && !args.force) {
      throw new Error('目标目录包含业务文件；为避免覆盖现有项目，模板初始化已停止。');
    }
    copyDirectory(profileTemplatePath(baselineRoot, profileId), projectRoot, { force: Boolean(args.force), projectRoot });
  }

  const report = analyzeProject(projectRoot, {
    requestedProfile,
    initializedProfile: shouldInitTemplate ? profileId : undefined,
    preservedProfile: shouldInitTemplate ? undefined : preservedProfile,
  });
  const entrypointChanges = ensureRootEntrypoints(projectRoot, path.basename(baselineRoot));
  const buildIsolation = ensureBuildIsolation({ projectRoot, baselineRoot });
  const statePaths = getProjectStatePaths(projectRoot, baselineRoot);
  const preserveExistingScheme = fs.existsSync(statePaths.schemeFile) && !args['refresh-project-scheme'];
  const schemeFile = preserveExistingScheme
    ? statePaths.schemeFile
    : writeProjectScheme(report, baselineRoot, { projectRoot });
  writeProjectStateManifest({ projectRoot, baselineRoot, mode: isPackageRepositoryReferenceFile(schemeFile) ? 'package-repository-reference' : 'target-project' });
  const legacyBaselineFile = resolveLegacyBaselineFile(projectRoot, baselineRoot);
  let legacyBaseline = 'not-applicable';
  const shouldWriteLegacyBaseline = report.mode === 'existing-project'
    && !args['no-legacy-baseline']
    && (!fs.existsSync(legacyBaselineFile) || args['refresh-legacy-baseline']);
  if (shouldWriteLegacyBaseline) {
    const snapshot = spawnSync(process.execPath, [
      path.join(baselineRoot, 'scripts', 'baseline-check.mjs'),
      '--project-root', projectRoot,
      '--write-baseline',
    ], { cwd: projectRoot, encoding: 'utf8' });
    if (snapshot.status !== 0) throw new Error(`旧项目历史基线生成失败: ${snapshot.stderr || snapshot.stdout}`);
    legacyBaseline = args['refresh-legacy-baseline'] ? 'refreshed' : 'created';
  } else if (report.mode === 'existing-project' && fs.existsSync(legacyBaselineFile)) {
    legacyBaseline = 'preserved';
  }
  console.log(`project-bootstrap: pass`);
  console.log(`mode: ${report.mode}`);
  console.log(`profile: ${report.profile}`);
  console.log(`scheme: ${projectStateRelative(projectRoot, schemeFile)}`);
  console.log(`scheme-action: ${preserveExistingScheme ? 'preserved' : args['refresh-project-scheme'] ? 'refreshed' : 'created'}`);
  if (stateMigration.migrations.length) console.log(`project-state-migration: ${stateMigration.migrations.length}`);
  if (shouldInitTemplate) console.log(`template: ${profileId}`);
  console.log(`ai-entrypoints: ${entrypointChanges.length ? entrypointChanges.join(', ') : 'unchanged'}`);
  console.log(`build-isolation: ${buildIsolation.packageHook.status}`);
  console.log(`legacy-baseline: ${legacyBaseline}`);
  if (args.json) console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(`project-bootstrap: fail: ${error.message}`);
  process.exit(1);
}
