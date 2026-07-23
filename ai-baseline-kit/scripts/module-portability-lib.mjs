import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { analyzeProject } from './project-tools-lib.mjs';
import { camelCase, ensureInside, normalizePath, readJson, relativeImport, unique, writeJson } from './feature-tools-lib.mjs';

const BUNDLE_FILE = 'module-bundle.json';
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.json', '.css', '.scss', '.less'];

function pathWithin(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function walk(directory, files = []) {
  if (!fs.existsSync(directory)) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`模块包不允许符号链接: ${normalizePath(target)}`);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'build', 'coverage', '.git'].includes(entry.name)) continue;
      walk(target, files);
    } else {
      files.push(target);
    }
  }
  return files;
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function copyFile(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function copyTree(source, destination) {
  for (const file of walk(source)) copyFile(file, path.join(destination, path.relative(source, file)));
}

function safeRemoveDirectory(directory) {
  const resolved = path.resolve(directory);
  const parsed = path.parse(resolved);
  if (resolved === parsed.root || resolved.length < parsed.root.length + 4) throw new Error(`拒绝删除不安全路径: ${resolved}`);
  fs.rmSync(resolved, { recursive: true, force: true });
}

function readPackage(projectRoot) {
  const file = path.join(projectRoot, 'package.json');
  return { file, data: fs.existsSync(file) ? readJson(file) : null };
}

function dependencyVersion(packageData, name) {
  for (const bucket of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    if (packageData?.[bucket]?.[name]) return packageData[bucket][name];
  }
  return '';
}

function resolveExistingPath(base) {
  const candidates = [
    base,
    ...SOURCE_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => path.join(base, `index${extension}`)),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}

function sharedDependencyTarget(projectRoot, sharedRoot, dependency) {
  const normalized = normalizePath(dependency).replace(/^@\//, '').replace(/^~\//, '');
  if (normalized.startsWith(`${normalizePath(sharedRoot)}/`) || normalized === normalizePath(sharedRoot)) {
    return path.join(projectRoot, normalized);
  }
  if (normalized.startsWith('src/shared/')) return path.join(projectRoot, normalized);
  if (normalized.startsWith('shared/')) return path.join(projectRoot, sharedRoot, normalized.slice('shared/'.length));
  return path.join(projectRoot, sharedRoot, normalized);
}

function collectSharedFiles(projectRoot, sharedRoot, dependencies) {
  const files = [];
  const unresolved = [];
  for (const dependency of dependencies) {
    const requested = sharedDependencyTarget(projectRoot, sharedRoot, dependency);
    const resolved = resolveExistingPath(requested);
    if (!resolved) {
      unresolved.push(dependency);
      continue;
    }
    const targets = fs.statSync(resolved).isDirectory() ? walk(resolved) : [resolved];
    for (const file of targets) {
      if (!pathWithin(file, path.join(projectRoot, sharedRoot))) throw new Error(`shared 契约越界: ${dependency}`);
      files.push({
        contract: dependency,
        sourcePath: normalizePath(path.relative(projectRoot, file)),
        relativePath: normalizePath(path.relative(path.join(projectRoot, sharedRoot), file)),
      });
    }
  }
  return { files, unresolved };
}

function collectRoutePaths(moduleRoot) {
  const routeFiles = walk(moduleRoot).filter((file) => /routes?\.(?:ts|tsx|js|jsx)$/i.test(file));
  const values = [];
  for (const file of routeFiles) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\bpath\s*:\s*["']([^"']+)["']/g)) values.push(match[1]);
  }
  return unique(values);
}

function collectRequiredThemeTokens(moduleRoot) {
  const tokens = [];
  for (const file of walk(moduleRoot).filter((item) => /\.(?:css|scss|less|vue|tsx|jsx|ts|js)$/i.test(item))) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(/var\(\s*(--app-[a-z0-9-]+)/gi)) tokens.push(match[1]);
  }
  return unique(tokens).sort();
}

function parseCssVariables(text) {
  const variables = {};
  for (const match of text.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) variables[match[1]] = match[2].trim();
  return variables;
}

function stackFingerprint(report) {
  return {
    profile: report.profile,
    framework: report.stack.framework,
    uiLibrary: report.stack.ui_library,
    language: report.stack.language,
    buildTool: report.stack.build_tool,
    router: report.stack.router,
    stateManager: report.stack.state_manager,
    i18n: report.stack.i18n,
  };
}

function normalizeStackValue(value) {
  return String(value || '').trim().toLowerCase().replaceAll(/\s+/g, ' ');
}

function compareStack(source, target, sameStackOnly) {
  if (!sameStackOnly) return [];
  const keys = ['framework', 'uiLibrary', 'language', 'buildTool', 'router'];
  return keys.flatMap((key) => {
    const left = normalizeStackValue(source[key]);
    const right = normalizeStackValue(target[key]);
    if (!left || !right || left === 'unknown' || right === 'unknown' || left === right) return [];
    return [{ code: 'stack-mismatch', field: key, source: source[key], target: target[key], message: `技术栈不兼容: ${key} (${source[key]} -> ${target[key]})` }];
  });
}

function readBundleRoot(bundlePath) {
  const absolute = path.resolve(bundlePath);
  if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) return path.dirname(absolute);
  return absolute;
}

export function readModuleBundle(bundlePath) {
  const bundleRoot = readBundleRoot(bundlePath);
  const manifestFile = path.join(bundleRoot, BUNDLE_FILE);
  if (!fs.existsSync(manifestFile)) throw new Error(`模块包缺少 ${BUNDLE_FILE}: ${bundleRoot}`);
  const manifest = readJson(manifestFile);
  if (manifest.schemaVersion !== 1 || manifest.kind !== 'ai-baseline-module-bundle') throw new Error('不支持的模块包格式。');
  for (const item of [...(manifest.files ?? []), ...(manifest.shared?.files ?? [])]) {
    const file = ensureInside(bundleRoot, path.join(bundleRoot, item.bundlePath), '模块包文件');
    if (!fs.existsSync(file)) throw new Error(`模块包文件缺失: ${item.bundlePath}`);
    if (sha256(file) !== item.sha256) throw new Error(`模块包校验和不一致: ${item.bundlePath}`);
  }
  return { bundleRoot, manifest };
}

export function exportModuleBundle({ projectRoot, moduleName, output, force = false }) {
  const absoluteProjectRoot = path.resolve(projectRoot);
  const report = analyzeProject(absoluteProjectRoot);
  const modulesRoot = report.layers.modules_root;
  const sharedRoot = report.layers.shared_root;
  if (!modulesRoot || modulesRoot === 'unknown') throw new Error('无法确定源项目模块根目录。');
  if (!sharedRoot || sharedRoot === 'unknown') throw new Error('无法确定源项目 shared 根目录。');
  const moduleRoot = ensureInside(absoluteProjectRoot, path.join(absoluteProjectRoot, modulesRoot, moduleName), '源模块');
  const metadataFile = path.join(moduleRoot, 'module.meta.json');
  if (!fs.existsSync(metadataFile)) throw new Error(`模块缺少 module.meta.json: ${moduleName}`);
  const metadata = readJson(metadataFile);
  if (metadata.name !== moduleName) throw new Error(`模块目录与 metadata.name 不一致: ${moduleName} != ${metadata.name}`);
  const outputRoot = path.resolve(output);
  if (fs.existsSync(outputRoot)) {
    if (!force) throw new Error(`导出目录已存在: ${outputRoot}`);
    safeRemoveDirectory(outputRoot);
  }
  fs.mkdirSync(outputRoot, { recursive: true });

  const moduleFiles = walk(moduleRoot).map((file) => {
    const relativePath = normalizePath(path.relative(moduleRoot, file));
    const bundlePath = normalizePath(path.join('module', relativePath));
    copyFile(file, path.join(outputRoot, bundlePath));
    return { path: relativePath, bundlePath, sha256: sha256(file) };
  });

  const sharedDependencies = metadata.dependencies?.shared ?? [];
  const shared = collectSharedFiles(absoluteProjectRoot, sharedRoot, sharedDependencies);
  const sharedFiles = shared.files.map((item) => {
    const source = path.join(absoluteProjectRoot, item.sourcePath);
    const bundlePath = normalizePath(path.join('shared', item.relativePath));
    copyFile(source, path.join(outputRoot, bundlePath));
    return { ...item, bundlePath, sha256: sha256(source) };
  });

  const packageData = readPackage(absoluteProjectRoot).data;
  const runtimeDependencies = Object.fromEntries((metadata.dependencies?.npm ?? []).map((name) => [name, dependencyVersion(packageData, name)]));
  const devDependencies = Object.fromEntries((metadata.dependencies?.dev ?? []).map((name) => [name, dependencyVersion(packageData, name)]));
  const themeEntrypoint = report.entrypoints.theme;
  const themeFile = themeEntrypoint && themeEntrypoint !== 'unknown' ? path.join(absoluteProjectRoot, themeEntrypoint) : '';
  const themeVariables = themeFile && fs.existsSync(themeFile) ? parseCssVariables(fs.readFileSync(themeFile, 'utf8')) : {};
  const requiredTokens = collectRequiredThemeTokens(moduleRoot);
  const themeDefinitions = Object.fromEntries(requiredTokens.filter((token) => themeVariables[token]).map((token) => [token, themeVariables[token]]));

  const manifest = {
    schemaVersion: 1,
    kind: 'ai-baseline-module-bundle',
    createdAt: new Date().toISOString(),
    module: metadata,
    source: {
      project: { name: report.package.name, version: report.package.version },
      stack: stackFingerprint(report),
      roots: { modules: modulesRoot, shared: sharedRoot },
      themeEntrypoint,
    },
    files: moduleFiles,
    contracts: {
      routes: collectRoutePaths(moduleRoot),
      permissions: metadata.permissions ?? [],
      capabilities: metadata.capabilities ?? [],
      npm: runtimeDependencies,
      dev: devDependencies,
      shared: sharedDependencies,
      theme: { requiredTokens, definitions: themeDefinitions },
    },
    shared: { files: sharedFiles, unresolved: shared.unresolved },
  };
  writeJson(path.join(outputRoot, BUNDLE_FILE), manifest);
  return { outputRoot, manifest };
}

function targetRoutePaths(projectRoot, modulesRoot, excludingModule = '') {
  const root = path.join(projectRoot, modulesRoot);
  if (!fs.existsSync(root)) return [];
  const paths = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true }).filter((item) => item.isDirectory() && item.name !== excludingModule)) {
    paths.push(...collectRoutePaths(path.join(root, entry.name)));
  }
  return unique(paths);
}

function targetThemeVariables(projectRoot, entrypoint) {
  if (!entrypoint || entrypoint === 'unknown') return {};
  const file = path.join(projectRoot, entrypoint);
  return fs.existsSync(file) ? parseCssVariables(fs.readFileSync(file, 'utf8')) : {};
}

function compareShared(bundle, projectRoot, targetSharedRoot) {
  const actions = [];
  const blockers = [];
  const grouped = new Map();
  for (const item of bundle.shared?.files ?? []) {
    const list = grouped.get(item.contract) ?? [];
    list.push(item);
    grouped.set(item.contract, list);
  }
  for (const dependency of bundle.contracts.shared ?? []) {
    const items = grouped.get(dependency) ?? [];
    if (!items.length) {
      blockers.push({ code: 'shared-contract-unavailable', dependency, message: `模块包未携带 shared 契约: ${dependency}` });
      continue;
    }
    for (const item of items) {
      const target = path.join(projectRoot, targetSharedRoot, item.relativePath);
      if (!fs.existsSync(target)) {
        actions.push({ type: 'copy-shared', dependency, path: normalizePath(path.relative(projectRoot, target)) });
      } else if (sha256(target) !== item.sha256) {
        blockers.push({ code: 'shared-contract-conflict', dependency, path: normalizePath(path.relative(projectRoot, target)), message: `目标项目存在不兼容 shared 契约: ${dependency}` });
      }
    }
  }
  return { actions, blockers };
}

export function checkModuleCompatibility({ bundlePath, projectRoot }) {
  const { bundleRoot, manifest } = readModuleBundle(bundlePath);
  const absoluteProjectRoot = path.resolve(projectRoot);
  const report = analyzeProject(absoluteProjectRoot);
  const blockers = [];
  const warnings = [];
  const actions = [];
  const moduleName = manifest.module.name;
  blockers.push(...compareStack(manifest.source.stack, stackFingerprint(report), manifest.module.portability?.sameStackOnly !== false));

  const targetModulesRoot = report.layers.modules_root;
  const targetSharedRoot = report.layers.shared_root;
  if (!targetModulesRoot || targetModulesRoot === 'unknown') blockers.push({ code: 'modules-root-unknown', message: '无法确定目标项目模块根目录。' });
  if (!targetSharedRoot || targetSharedRoot === 'unknown') blockers.push({ code: 'shared-root-unknown', message: '无法确定目标项目 shared 根目录。' });
  if (targetModulesRoot && targetModulesRoot !== 'unknown' && manifest.source.roots.modules !== targetModulesRoot) {
    blockers.push({ code: 'modules-root-mismatch', source: manifest.source.roots.modules, target: targetModulesRoot, message: '源/目标 modules_root 不一致，当前安全导入器不重写任意内部相对路径。' });
  }
  if (targetSharedRoot && targetSharedRoot !== 'unknown' && manifest.source.roots.shared !== targetSharedRoot) {
    blockers.push({ code: 'shared-root-mismatch', source: manifest.source.roots.shared, target: targetSharedRoot, message: '源/目标 shared_root 不一致，当前安全导入器不重写任意 shared 引用。' });
  }
  if (targetModulesRoot && targetModulesRoot !== 'unknown' && fs.existsSync(path.join(absoluteProjectRoot, targetModulesRoot, moduleName))) {
    blockers.push({ code: 'module-already-exists', module: moduleName, message: `目标项目已存在模块: ${moduleName}` });
  }

  const packageData = readPackage(absoluteProjectRoot).data;
  if (!packageData) blockers.push({ code: 'package-json-missing', message: '目标项目缺少 package.json。' });
  for (const [name, version] of Object.entries(manifest.contracts.npm ?? {})) {
    if (!dependencyVersion(packageData, name)) {
      if (version) actions.push({ type: 'add-dependency', bucket: 'dependencies', name, version });
      else blockers.push({ code: 'dependency-version-unknown', name, message: `无法确定 npm 依赖版本: ${name}` });
    }
  }
  for (const [name, version] of Object.entries(manifest.contracts.dev ?? {})) {
    if (!dependencyVersion(packageData, name)) {
      if (version) actions.push({ type: 'add-dependency', bucket: 'devDependencies', name, version });
      else blockers.push({ code: 'dependency-version-unknown', name, message: `无法确定开发依赖版本: ${name}` });
    }
  }

  if (targetSharedRoot && targetSharedRoot !== 'unknown') {
    const shared = compareShared(manifest, absoluteProjectRoot, targetSharedRoot);
    blockers.push(...shared.blockers);
    actions.push(...shared.actions);
  }

  if (targetModulesRoot && targetModulesRoot !== 'unknown') {
    const existingRoutes = new Set(targetRoutePaths(absoluteProjectRoot, targetModulesRoot, moduleName));
    for (const route of manifest.contracts.routes ?? []) {
      if (existingRoutes.has(route)) blockers.push({ code: 'route-conflict', route, message: `目标项目已存在路由: ${route}` });
    }
  }

  const assembler = report.entrypoints.module_assembler;
  if (!assembler || assembler === 'unknown' || !fs.existsSync(path.join(absoluteProjectRoot, assembler))) {
    blockers.push({ code: 'module-assembler-missing', message: '目标项目缺少集中模块装配器。' });
  } else {
    const assemblerText = fs.readFileSync(path.join(absoluteProjectRoot, assembler), 'utf8');
    if (!assemblerText.includes('// ai-baseline:module-imports:end') || !assemblerText.includes('// ai-baseline:module-list:end')) {
      blockers.push({ code: 'module-assembler-uncontrolled', path: assembler, message: '模块装配器缺少受控静态标记。' });
    } else {
      actions.push({ type: 'assemble-module', path: assembler, module: moduleName });
    }
  }

  const themeVariables = targetThemeVariables(absoluteProjectRoot, report.entrypoints.theme);
  for (const token of manifest.contracts.theme?.requiredTokens ?? []) {
    if (themeVariables[token]) continue;
    const value = manifest.contracts.theme?.definitions?.[token];
    if (value) actions.push({ type: 'merge-theme-token', token, value, path: report.entrypoints.theme });
    else blockers.push({ code: 'theme-token-missing', token, message: `目标主题缺少模块所需 token，且模块包没有可合并定义: ${token}` });
  }
  if ((manifest.shared?.unresolved ?? []).length) warnings.push({ code: 'source-shared-unresolved', dependencies: manifest.shared.unresolved, message: '源项目导出时有 shared 契约未解析。' });

  return {
    schemaVersion: 1,
    kind: 'ai-baseline-module-compatibility-report',
    module: moduleName,
    bundleRoot,
    targetProject: absoluteProjectRoot,
    targetStack: stackFingerprint(report),
    compatible: blockers.length === 0,
    blockers,
    warnings,
    actions,
    summary: {
      missingRuntimeDependencies: actions.filter((item) => item.type === 'add-dependency' && item.bucket === 'dependencies').map((item) => item.name),
      missingDevDependencies: actions.filter((item) => item.type === 'add-dependency' && item.bucket === 'devDependencies').map((item) => item.name),
      sharedCopies: actions.filter((item) => item.type === 'copy-shared').map((item) => item.path),
      themeTokens: actions.filter((item) => item.type === 'merge-theme-token').map((item) => item.token),
    },
  };
}

function updatePackageJson(projectRoot, actions) {
  const { file, data } = readPackage(projectRoot);
  if (!data) throw new Error('目标项目缺少 package.json。');
  for (const action of actions.filter((item) => item.type === 'add-dependency')) {
    data[action.bucket] ??= {};
    data[action.bucket][action.name] = action.version;
    data[action.bucket] = Object.fromEntries(Object.entries(data[action.bucket]).sort(([left], [right]) => left.localeCompare(right)));
  }
  writeJson(file, data);
}

function updateAssembler(projectRoot, assemblerRelative, modulesRoot, moduleName) {
  const assembler = path.join(projectRoot, assemblerRelative);
  const moduleRoot = path.join(projectRoot, modulesRoot, moduleName);
  const variable = camelCase(moduleName);
  const importTarget = relativeImport(assembler, path.join(moduleRoot, 'index'));
  const importLine = `import { moduleManifest as ${variable}Module } from '${importTarget}';`;
  let text = fs.readFileSync(assembler, 'utf8');
  if (!text.includes(importLine)) text = text.replace('// ai-baseline:module-imports:end', `${importLine}\n// ai-baseline:module-imports:end`);
  const listLine = `  ${variable}Module,`;
  if (!text.includes(listLine)) text = text.replace('  // ai-baseline:module-list:end', `${listLine}\n  // ai-baseline:module-list:end`);
  fs.writeFileSync(assembler, text, 'utf8');
}

function mergeTheme(projectRoot, actions) {
  const themeActions = actions.filter((item) => item.type === 'merge-theme-token');
  if (!themeActions.length) return;
  const entrypoint = themeActions[0].path;
  if (!entrypoint || entrypoint === 'unknown') throw new Error('无法确定主题入口。');
  const file = path.join(projectRoot, entrypoint);
  let text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const declarations = themeActions.filter((item) => !new RegExp(`${item.token.replaceAll('-', '\\-')}\\s*:`).test(text));
  if (!declarations.length) return;
  text = `${text.trimEnd()}\n\n/* ai-baseline:module-theme-tokens:start */\nhtml:root {\n${declarations.map((item) => `  ${item.token}: ${item.value};`).join('\n')}\n}\n/* ai-baseline:module-theme-tokens:end */\n`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
}

function writeImportReceipt(projectRoot, manifest, report) {
  const file = path.join(projectRoot, 'docs', 'module-imports', `${manifest.module.name}.json`);
  writeJson(file, {
    schemaVersion: 1,
    kind: 'ai-baseline-module-import-receipt',
    importedAt: new Date().toISOString(),
    module: manifest.module.name,
    version: manifest.module.version,
    source: manifest.source,
    contracts: manifest.contracts,
    actions: report.actions,
  });
  return file;
}

export function importModuleBundle({ bundlePath, projectRoot, dryRun = false }) {
  const { bundleRoot, manifest } = readModuleBundle(bundlePath);
  const report = checkModuleCompatibility({ bundlePath: bundleRoot, projectRoot });
  if (!report.compatible) throw new Error(`模块不兼容:\n${report.blockers.map((item) => `- ${item.message}`).join('\n')}`);
  if (dryRun) return { report, changed: [] };
  const absoluteProjectRoot = path.resolve(projectRoot);
  const targetReport = analyzeProject(absoluteProjectRoot);
  const moduleTarget = path.join(absoluteProjectRoot, targetReport.layers.modules_root, manifest.module.name);
  copyTree(path.join(bundleRoot, 'module'), moduleTarget);
  for (const item of manifest.shared?.files ?? []) {
    const target = path.join(absoluteProjectRoot, targetReport.layers.shared_root, item.relativePath);
    if (!fs.existsSync(target)) copyFile(path.join(bundleRoot, item.bundlePath), target);
  }
  updatePackageJson(absoluteProjectRoot, report.actions);
  mergeTheme(absoluteProjectRoot, report.actions);
  updateAssembler(absoluteProjectRoot, targetReport.entrypoints.module_assembler, targetReport.layers.modules_root, manifest.module.name);
  const receipt = writeImportReceipt(absoluteProjectRoot, manifest, report);
  return {
    report,
    changed: [
      normalizePath(path.relative(absoluteProjectRoot, moduleTarget)),
      ...report.summary.sharedCopies,
      ...report.summary.themeTokens.map((token) => `theme:${token}`),
      normalizePath(path.relative(absoluteProjectRoot, receipt)),
    ],
  };
}

function dependencyMajor(version) {
  const match = String(version || '').match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

export function validateBundleSet(bundlePaths) {
  const bundles = bundlePaths.map((bundlePath) => readModuleBundle(bundlePath));
  const blockers = [];
  const warnings = [];
  const moduleNames = new Set();
  const routes = new Map();
  const shared = new Map();
  const dependencies = new Map();
  for (const bundle of bundles) {
    const name = bundle.manifest.module.name;
    if (moduleNames.has(name)) blockers.push({ code: 'duplicate-module', module: name, message: `组合清单包含重复模块: ${name}` });
    moduleNames.add(name);
    for (const route of bundle.manifest.contracts.routes ?? []) {
      if (routes.has(route)) blockers.push({ code: 'bundle-route-conflict', route, modules: [routes.get(route), name], message: `模块包之间路由冲突: ${route}` });
      else routes.set(route, name);
    }
    for (const item of bundle.manifest.shared?.files ?? []) {
      const key = item.relativePath;
      if (shared.has(key) && shared.get(key).sha256 !== item.sha256) blockers.push({ code: 'bundle-shared-conflict', path: key, modules: [shared.get(key).module, name], message: `模块包之间 shared 契约冲突: ${key}` });
      else shared.set(key, { sha256: item.sha256, module: name });
    }
    for (const bucket of ['npm', 'dev']) {
      for (const [dependency, version] of Object.entries(bundle.manifest.contracts?.[bucket] ?? {})) {
        const key = `${bucket}:${dependency}`;
        const previous = dependencies.get(key);
        if (!previous) {
          dependencies.set(key, { module: name, version });
          continue;
        }
        if (previous.version === version) continue;
        const leftMajor = dependencyMajor(previous.version);
        const rightMajor = dependencyMajor(version);
        if (leftMajor !== null && rightMajor !== null && leftMajor !== rightMajor) {
          blockers.push({ code: 'bundle-dependency-major-conflict', bucket, dependency, versions: [previous.version, version], modules: [previous.module, name], message: `模块包 npm 主版本冲突: ${dependency} (${previous.version} / ${version})` });
        } else {
          warnings.push({ code: 'bundle-dependency-range-difference', bucket, dependency, versions: [previous.version, version], modules: [previous.module, name], message: `模块包依赖范围不同但主版本一致: ${dependency} (${previous.version} / ${version})` });
        }
      }
    }
  }
  return { compatible: blockers.length === 0, blockers, warnings, bundles };
}
