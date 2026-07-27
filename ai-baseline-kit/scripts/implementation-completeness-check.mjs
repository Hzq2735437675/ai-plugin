#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, resolveRoots } from './project-tools-lib.mjs';
import { normalizePath } from './feature-tools-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const { projectRoot: defaultProjectRoot } = resolveRoots(import.meta.url);
const projectRoot = path.resolve(args['project-root'] || defaultProjectRoot);
const allowedExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.vue']);
const ignoredRoots = ['ai-baseline-kit/', 'node_modules/', 'dist/', 'build/', 'coverage/', '.git/'];
const patterns = [
  { id: 'generated-placeholder', regex: /该页面由功能规格生成，请按验收条件补充业务实现|页面结构已生成/ },
  { id: 'not-implemented', regex: /throw\s+new\s+Error\s*\(\s*['"`]Not implemented|\bNOT_IMPLEMENTED\b/i },
  { id: 'skipped-test', regex: /\b(?:describe|it|test)\.(?:skip|todo)\s*\(/ },
  { id: 'unfinished-marker', regex: /\b(?:TODO|FIXME)\b|待补充|暂未实现/ },
];

function gitLines(commandArgs) {
  const result = spawnSync('git', commandArgs, { cwd: projectRoot, encoding: 'utf8', shell: process.platform === 'win32' });
  return result.status === 0 ? result.stdout.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) : [];
}

function changedFilesFromInput() {
  if (!args['changed-files']) return [];
  const file = path.resolve(args['changed-files']);
  if (!fs.existsSync(file)) throw new Error(`变更文件清单不存在: ${file}`);
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  const items = Array.isArray(parsed) ? parsed : parsed.changes;
  if (!Array.isArray(items)) throw new Error('变更文件清单必须是数组或包含 changes 数组。');
  return items.map((item) => typeof item === 'string' ? item : item?.path).filter(Boolean);
}

function discoverChangedFiles() {
  const supplied = changedFilesFromInput();
  if (supplied.length) return supplied;
  return [...new Set([
    ...gitLines(['diff', '--name-only', '--diff-filter=ACMR']),
    ...gitLines(['diff', '--cached', '--name-only', '--diff-filter=ACMR']),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ])];
}

try {
  const files = [...new Set(discoverChangedFiles().map(normalizePath))]
    .filter((file) => allowedExtensions.has(path.extname(file).toLowerCase()))
    .filter((file) => !ignoredRoots.some((root) => file === root.slice(0, -1) || file.startsWith(root)))
    .filter((file) => fs.existsSync(path.join(projectRoot, file)));
  const violations = [];
  for (const file of files) {
    const lines = fs.readFileSync(path.join(projectRoot, file), 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      if (line.includes('ai-baseline:approved-incomplete')) return;
      for (const pattern of patterns) {
        if (pattern.regex.test(line)) violations.push({ id: pattern.id, file, line: index + 1, text: line.trim().slice(0, 180) });
      }
    });
  }
  console.log(`implementation-completeness-check: ${violations.length ? 'fail' : 'pass'}`);
  console.log(`files: ${files.length}`);
  console.log(`violations: ${violations.length}`);
  for (const item of violations) console.log(`error: ${item.id}: ${item.file}:${item.line}: ${item.text}`);
  if (args.json) console.log(JSON.stringify({ passed: violations.length === 0, files, violations }, null, 2));
  if (violations.length) process.exit(1);
} catch (error) {
  console.error(`implementation-completeness-check: fail: ${error.message}`);
  process.exit(1);
}
