import fs from 'node:fs';
import path from 'node:path';

export const BUILD_ISOLATION_START = '# ai-baseline-kit:build-isolation:start';
export const BUILD_ISOLATION_END = '# ai-baseline-kit:build-isolation:end';
export const BUILD_GUARD_SCRIPT = 'build-artifact-guard.mjs';
export const DEFAULT_OUTPUT_DIRECTORIES = Object.freeze([
  'dist',
  'build',
  'out',
  '.output',
  '.next',
  '.nuxt',
  'storybook-static',
]);

const DEPLOY_IGNORE_FILES = Object.freeze([
  { name: '.dockerignore', create: true },
  { name: '.vercelignore', create: true },
  { name: '.npmignore', create: false },
  { name: '.gcloudignore', create: false },
  { name: '.cfignore', create: false },
]);

function normalize(value) {
  return value.replace(/\\/g, '/');
}

function detectNewline(text) {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function managedBlock(baselineDirName) {
  return [
    BUILD_ISOLATION_START,
    `${baselineDirName}/`,
    '.ai-frontend-assembler/',
    BUILD_ISOLATION_END,
  ].join('\n');
}

function mergeManagedBlock(current, block) {
  const newline = detectNewline(current);
  const normalizedBlock = block.replace(/\n/g, newline);
  const start = current.indexOf(BUILD_ISOLATION_START);
  const end = current.indexOf(BUILD_ISOLATION_END);
  if (start >= 0 && end >= start) {
    const afterEnd = end + BUILD_ISOLATION_END.length;
    return `${current.slice(0, start)}${normalizedBlock}${current.slice(afterEnd)}`;
  }
  const prefix = current.length === 0 ? '' : `${current.replace(/[\r\n]+$/g, '')}${newline}${newline}`;
  return `${prefix}${normalizedBlock}${newline}`;
}

function ensureIgnoreFile(projectRoot, descriptor, baselineDirName) {
  const file = path.join(projectRoot, descriptor.name);
  if (!fs.existsSync(file) && !descriptor.create) return { file: descriptor.name, status: 'not-applicable' };
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const next = mergeManagedBlock(current, managedBlock(baselineDirName));
  if (next === current) return { file: descriptor.name, status: 'unchanged' };
  fs.writeFileSync(file, next, 'utf8');
  return { file: descriptor.name, status: fs.existsSync(file) && current ? 'updated' : 'created' };
}

function ensureNestedNpmIgnore(directory) {
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, '.npmignore');
  const desired = '*\n';
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (current === desired || current === '*\r\n') return { file, status: 'unchanged' };
  fs.writeFileSync(file, desired, 'utf8');
  return { file, status: current ? 'updated' : 'created' };
}

function indentOfJson(text) {
  const match = text.match(/\n([ \t]+)"/);
  if (!match) return 2;
  return match[1].includes('\t') ? '\t' : match[1].length;
}

function newlineAtEnd(text) {
  return /\r?\n$/.test(text);
}

export function buildGuardCommand(baselineDirName = 'ai-baseline-kit') {
  return `node ${normalize(path.join(baselineDirName, 'scripts', BUILD_GUARD_SCRIPT))} --clean`;
}

function ensurePackageBuildHook(projectRoot, baselineDirName) {
  const packageFile = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(packageFile)) return { status: 'not-applicable', reason: 'package.json missing' };
  const current = fs.readFileSync(packageFile, 'utf8');
  const data = JSON.parse(current);
  if (!data.scripts?.build) return { status: 'not-applicable', reason: 'scripts.build missing' };
  const command = buildGuardCommand(baselineDirName);
  const postbuild = data.scripts.postbuild;
  if (typeof postbuild === 'string' && postbuild.includes(BUILD_GUARD_SCRIPT)) return { status: 'unchanged', command: postbuild };
  if (postbuild !== undefined && typeof postbuild !== 'string') {
    throw new Error('package.json scripts.postbuild 必须是字符串，无法自动接入构建产物隔离守卫。');
  }
  data.scripts.postbuild = postbuild ? `${postbuild} && ${command}` : command;
  const newline = detectNewline(current);
  let next = JSON.stringify(data, null, indentOfJson(current)).replace(/\n/g, newline);
  if (newlineAtEnd(current)) next += newline;
  fs.writeFileSync(packageFile, next, 'utf8');
  return { status: postbuild ? 'updated' : 'created', command: data.scripts.postbuild };
}

export function ensureBuildIsolation({ projectRoot, baselineRoot }) {
  const resolvedProjectRoot = path.resolve(projectRoot);
  const resolvedBaselineRoot = path.resolve(baselineRoot);
  const baselineDirName = path.basename(resolvedBaselineRoot);
  const ignoreFiles = DEPLOY_IGNORE_FILES.map((descriptor) => ensureIgnoreFile(resolvedProjectRoot, descriptor, baselineDirName));
  const packageNpmIgnore = ensureNestedNpmIgnore(resolvedBaselineRoot);
  const stateNpmIgnore = ensureNestedNpmIgnore(path.join(resolvedProjectRoot, '.ai-frontend-assembler'));
  const packageHook = ensurePackageBuildHook(resolvedProjectRoot, baselineDirName);
  return { ignoreFiles, packageNpmIgnore, stateNpmIgnore, packageHook };
}

export function inspectBuildIsolation({ projectRoot, baselineRoot }) {
  const resolvedProjectRoot = path.resolve(projectRoot);
  const resolvedBaselineRoot = path.resolve(baselineRoot);
  const baselineDirName = path.basename(resolvedBaselineRoot);
  const expected = [`${baselineDirName}/`, '.ai-frontend-assembler/'];
  const ignoreFiles = DEPLOY_IGNORE_FILES.map((descriptor) => {
    const file = path.join(resolvedProjectRoot, descriptor.name);
    if (!fs.existsSync(file)) return { file: descriptor.name, required: descriptor.create, status: 'missing', missing: expected };
    const text = fs.readFileSync(file, 'utf8');
    const missing = expected.filter((entry) => !text.split(/\r?\n/).map((line) => line.trim()).includes(entry));
    return { file: descriptor.name, required: descriptor.create, status: missing.length ? 'incomplete' : 'ready', missing };
  });
  const packageFile = path.join(resolvedProjectRoot, 'package.json');
  let packageHook = { status: 'not-applicable', reason: 'package.json missing' };
  if (fs.existsSync(packageFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
      packageHook = data.scripts?.build
        ? { status: typeof data.scripts.postbuild === 'string' && data.scripts.postbuild.includes(BUILD_GUARD_SCRIPT) ? 'ready' : 'missing' }
        : { status: 'not-applicable', reason: 'scripts.build missing' };
    } catch (error) {
      packageHook = { status: 'invalid', reason: error.message };
    }
  }
  const packageNpmIgnore = fs.existsSync(path.join(resolvedBaselineRoot, '.npmignore'))
    && fs.readFileSync(path.join(resolvedBaselineRoot, '.npmignore'), 'utf8').split(/\r?\n/).includes('*');
  const stateIgnoreFile = path.join(resolvedProjectRoot, '.ai-frontend-assembler', '.npmignore');
  const stateNpmIgnore = fs.existsSync(stateIgnoreFile)
    && fs.readFileSync(stateIgnoreFile, 'utf8').split(/\r?\n/).includes('*');
  return { ignoreFiles, packageHook, packageNpmIgnore, stateNpmIgnore };
}

function collectJsonOutputPaths(value, collected = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectJsonOutputPaths(item, collected);
    return collected;
  }
  if (!value || typeof value !== 'object') return collected;
  for (const [key, item] of Object.entries(value)) {
    if (['outputPath', 'outputDir', 'distDir'].includes(key)) {
      if (typeof item === 'string') collected.add(item);
      else if (item && typeof item === 'object' && typeof item.base === 'string') collected.add(item.base);
    }
    collectJsonOutputPaths(item, collected);
  }
  return collected;
}

function addRegexMatches(text, regex, target) {
  for (const match of text.matchAll(regex)) {
    const value = match.slice(1).find(Boolean);
    if (value) target.add(value);
  }
}

export function discoverBuildOutputDirectories(projectRoot, explicit = []) {
  const root = path.resolve(projectRoot);
  const relative = new Set(DEFAULT_OUTPUT_DIRECTORIES);
  for (const item of explicit) if (item) relative.add(item);

  const packageFile = path.join(root, 'package.json');
  if (fs.existsSync(packageFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
      const buildScript = data.scripts?.build ?? '';
      addRegexMatches(buildScript, /(?:--outDir|--output-path|--outputPath|--dest)\s+(?:["']([^"']+)["']|([^\s&|]+))/g, {
        add(value) { relative.add(value); },
      });
    } catch {
      // package.json validity is checked elsewhere.
    }
  }

  for (const jsonFile of ['angular.json']) {
    const file = path.join(root, jsonFile);
    if (!fs.existsSync(file)) continue;
    try {
      for (const item of collectJsonOutputPaths(JSON.parse(fs.readFileSync(file, 'utf8')))) relative.add(item);
    } catch {
      // Invalid tool config is outside this guard's responsibility.
    }
  }

  const configNames = [
    'vite.config.ts', 'vite.config.js', 'vite.config.mts', 'vite.config.mjs',
    'vue.config.js', 'vue.config.cjs',
    'next.config.js', 'next.config.mjs', 'next.config.ts',
    'nuxt.config.ts', 'nuxt.config.js',
    'svelte.config.js', 'astro.config.mjs', 'astro.config.ts',
  ];
  for (const configName of configNames) {
    const file = path.join(root, configName);
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    addRegexMatches(text, /(?:outDir|outputDir|distDir|buildDir)\s*:\s*["']([^"']+)["']/g, relative);
  }

  const unsafeRoots = new Set(['', '.', './']);
  const protectedSourceRoots = new Set(['src', 'public', 'ai-baseline-kit', '.ai-frontend-assembler']);
  return [...relative]
    .map((item) => normalize(String(item).trim()).replace(/^\.\//, '').replace(/\/$/, ''))
    .filter((item) => item && !unsafeRoots.has(item))
    .filter((item) => !protectedSourceRoots.has(item.split('/')[0]))
    .map((item) => path.resolve(root, item))
    .filter((item, index, all) => item !== root && all.indexOf(item) === index);
}

function isWithin(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

export function findProtectedArtifacts({ projectRoot, baselineRoot, outputDirectories }) {
  const root = path.resolve(projectRoot);
  const realRoot = fs.realpathSync.native(root);
  const baselineDirName = path.basename(path.resolve(baselineRoot));
  const protectedNames = new Set([baselineDirName, '.ai-frontend-assembler']);
  const findings = [];
  for (const outputRoot of outputDirectories) {
    const resolvedOutput = path.resolve(outputRoot);
    if (!isWithin(resolvedOutput, root) || !fs.existsSync(resolvedOutput)) continue;
    const realOutput = fs.realpathSync.native(resolvedOutput);
    if (!isWithin(realOutput, realRoot)) throw new Error(`拒绝扫描项目目录之外的构建输出: ${resolvedOutput}`);
    const queue = [resolvedOutput];
    while (queue.length) {
      const current = queue.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (protectedNames.has(entry.name)) {
          findings.push({ outputRoot: resolvedOutput, path: full, relative: normalize(path.relative(root, full)), type: entry.isDirectory() ? 'directory' : 'file' });
          continue;
        }
        if (entry.isDirectory() && !entry.isSymbolicLink()) queue.push(full);
      }
    }
  }
  return findings;
}

export function cleanProtectedArtifacts(findings) {
  const cleaned = [];
  for (const finding of findings) {
    const outputRoot = path.resolve(finding.outputRoot);
    const resolved = path.resolve(finding.path);
    if (!isWithin(resolved, outputRoot)) throw new Error(`拒绝清理输出目录之外的路径: ${resolved}`);
    if (!fs.existsSync(resolved)) continue;
    const entry = fs.lstatSync(resolved);
    if (!entry.isSymbolicLink()) {
      const realOutput = fs.realpathSync.native(outputRoot);
      const realTarget = fs.realpathSync.native(resolved);
      if (!isWithin(realTarget, realOutput)) throw new Error(`拒绝清理真实输出目录之外的路径: ${resolved}`);
    }
    fs.rmSync(resolved, { recursive: finding.type === 'directory', force: true });
    cleaned.push(finding.relative);
  }
  return cleaned;
}
