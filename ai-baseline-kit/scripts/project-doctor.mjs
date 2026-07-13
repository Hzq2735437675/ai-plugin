#!/usr/bin/env node
import path from 'node:path';
import { analyzeProject, parseArgs, resolveRoots } from './project-tools-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const { projectRoot: defaultProjectRoot } = resolveRoots(import.meta.url);
const projectRoot = path.resolve(args['project-root'] || defaultProjectRoot);

try {
  const report = analyzeProject(projectRoot, { requestedProfile: args.stack });
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`project_root: ${report.projectRoot}`);
    console.log(`mode: ${report.mode}`);
    console.log(`profile: ${report.profile}`);
    console.log(`framework: ${report.stack.framework}`);
    console.log(`ui_library: ${report.stack.ui_library}`);
    console.log(`language: ${report.stack.language}`);
    console.log(`build_tool: ${report.stack.build_tool}`);
    console.log(`router: ${report.stack.router}`);
    console.log(`state_manager: ${report.stack.state_manager}`);
    console.log(`i18n: ${report.stack.i18n}`);
    console.log(`style_solution: ${report.stack.style_solution}`);
    console.log(`modules_root: ${report.modules.root}`);
    console.log(`confidence: ${report.confidence}`);
    if (report.evidence.length) {
      console.log('\nevidence:');
      for (const item of report.evidence) console.log(`- ${item}`);
    }
    if (report.warnings.length) {
      console.log('\nwarnings:');
      for (const item of report.warnings) console.log(`- ${item}`);
    }
  }
} catch (error) {
  console.error(`project-doctor: fail: ${error.message}`);
  process.exit(1);
}
