import fs from 'node:fs';
import path from 'node:path';
import { analyzeProject } from './project-tools-lib.mjs';
import { normalizePath, unique } from './feature-tools-lib.mjs';

const SKIP = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.vite', '.turbo', '.ai-baseline-compose']);
function effectiveProfile(report) {
  if (report.profile && !['unknown', 'existing-project-detected'].includes(report.profile)) return report.profile;
  if (report.stack.framework === 'Vue' && report.stack.build_tool === 'Vite' && report.stack.language === 'TypeScript' && report.stack.ui_library === 'Element Plus') return 'vue3-vite-ts';
  if (report.stack.framework === 'React' && report.stack.build_tool === 'Vite' && report.stack.language === 'TypeScript' && report.stack.ui_library === 'Ant Design') return 'react18-antd-tailwind-ts';
  return report.profile || 'unknown';
}
function heading(directory) {
  const file = path.join(directory, 'README.md'); if (!fs.existsSync(file)) return '';
  return fs.readFileSync(file, 'utf8').match(/^#\s+(.+)$/m)?.[1]?.trim() || '';
}
function aliases(directory, report) {
  const name = path.basename(directory); const values = [name, report.package.name, heading(directory)];
  const match = name.match(/^(?:project|项目)[-_ ]?([a-z0-9]+)$/i);
  if (match) values.push(match[1], `项目${match[1]}`, `项目 ${match[1]}`);
  return unique(values.filter(Boolean).map((item) => String(item).toLowerCase()));
}
function candidate(directory) {
  return fs.existsSync(path.join(directory, 'package.json')) || (fs.existsSync(path.join(directory, 'src')) && fs.existsSync(path.join(directory, 'ai-baseline-kit')));
}
function scan(directory, depth, maxDepth, output) {
  if (depth > maxDepth || !fs.existsSync(directory)) return;
  if (candidate(directory)) { output.push(directory); return; }
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || SKIP.has(entry.name) || entry.name.startsWith('.')) continue;
    scan(path.join(directory, entry.name), depth + 1, maxDepth, output);
  }
}
export function discoverWorkspaceProjects({ workspaceRoot, maxDepth = 2 }) {
  const root = path.resolve(workspaceRoot);
  const directories = []; scan(root, 0, maxDepth, directories);
  const projects = directories.map((directory) => {
    const report = analyzeProject(directory);
    return {
      id: path.basename(directory).toLowerCase().replace(/[^a-z0-9_-]+/g, '-'),
      name: report.package.name !== 'unknown' ? report.package.name : path.basename(directory),
      projectRoot: directory,
      relativePath: normalizePath(path.relative(root, directory)) || '.',
      aliases: aliases(directory, report),
      mode: report.mode,
      profile: effectiveProfile(report),
      stack: { framework: report.stack.framework, language: report.stack.language, buildTool: report.stack.build_tool, uiLibrary: report.stack.ui_library },
      roots: { modules: report.layers.modules_root, shared: report.layers.shared_root },
      baselineInstalled: fs.existsSync(path.join(directory, 'ai-baseline-kit')),
    };
  });
  return { schemaVersion: 1, kind: 'ai-baseline-workspace-discovery', generatedAt: new Date().toISOString(), workspaceRoot: root, projects, summary: { projects: projects.length, profiles: unique(projects.map((item) => item.profile)) } };
}
