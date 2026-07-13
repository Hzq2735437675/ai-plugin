#!/usr/bin/env node
import path from 'node:path';
import {
  analyzeProject,
  copyDirectory,
  parseArgs,
  projectHasBusinessFiles,
  profileTemplatePath,
  writeProjectScheme,
  STANDARD_PROFILES,
  DEFAULT_PROFILE_ID,
  resolveRoots,
} from './project-tools-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const { baselineRoot, projectRoot: defaultProjectRoot } = resolveRoots(import.meta.url);
const projectRoot = path.resolve(args['project-root'] || defaultProjectRoot);
const initTemplateProfile = typeof args['init-template'] === 'string' ? args['init-template'] : undefined;
const requestedProfile = args.stack || initTemplateProfile || args._[0]
  || (args['init-template'] ? DEFAULT_PROFILE_ID : undefined);
const shouldInitTemplate = Boolean(args['init-template']);
const profileId = requestedProfile || DEFAULT_PROFILE_ID;

try {
  if (requestedProfile && !STANDARD_PROFILES[requestedProfile]) {
    throw new Error(`不支持的标准模板: ${requestedProfile}。可选值: ${Object.keys(STANDARD_PROFILES).join(', ')}`);
  }

  const before = analyzeProject(projectRoot, { requestedProfile });
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
  });
  const schemeFile = writeProjectScheme(report, baselineRoot);
  console.log(`project-bootstrap: pass`);
  console.log(`mode: ${report.mode}`);
  console.log(`profile: ${report.profile}`);
  console.log(`scheme: ${path.relative(projectRoot, schemeFile).replaceAll('\\', '/')}`);
  if (shouldInitTemplate) console.log(`template: ${profileId}`);
  if (args.json) console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(`project-bootstrap: fail: ${error.message}`);
  process.exit(1);
}
