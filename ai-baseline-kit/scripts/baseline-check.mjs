#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';
import { analyzeAstBoundaries } from './ast-boundary-lib.mjs';
import { PROJECT_STATE_DIRECTORY, migrateLegacyProjectState, resolveLegacyBaselineFile, resolveProjectSchemeFile } from './project-state-lib.mjs';
import { ensureRootEntrypoints, hasStrongRootEntrypoint } from './project-tools-lib.mjs';
import { inspectBuildIsolation } from './build-isolation-lib.mjs';
import { analyzeStyleIsolation } from './style-scope-lib.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const baselineRoot = path.resolve(scriptDir, '..');
const baselineDirName = path.basename(baselineRoot);
const defaultProjectRoot = path.resolve(baselineRoot, '..');
const projectRootArgIndex = process.argv.indexOf('--project-root');
const valueFlags = new Set(['--project-root', '--mode', '--baseline-file']);
const positionalRoot = process.argv.find((arg, index) => index > 1 && !arg.startsWith('--') && !valueFlags.has(process.argv[index - 1]));
const root = projectRootArgIndex >= 0
  ? path.resolve(process.argv[projectRootArgIndex + 1] || defaultProjectRoot)
  : positionalRoot
    ? path.resolve(positionalRoot)
    : defaultProjectRoot;
const failOnWarn = process.argv.includes('--fail-on-warn') || process.argv.includes('--strict');
const fixGitignore = process.argv.includes('--fix-gitignore');
const fixEntrypoints = process.argv.includes('--fix-entrypoints') || process.argv.includes('--fix-ai-entrypoints');
const modeIndex = process.argv.indexOf('--mode');
const checkMode = modeIndex >= 0 ? process.argv[modeIndex + 1] : 'full';
const writeLegacyBaseline = process.argv.includes('--write-baseline') || process.argv.includes('--write-legacy-baseline');
const stateMigration = migrateLegacyProjectState({ projectRoot: root, baselineRoot });
const projectSchemeFile = resolveProjectSchemeFile(root, baselineRoot);
const projectSchemeDisplay = normalize(path.relative(root, projectSchemeFile));
const baselineFileIndex = process.argv.indexOf('--baseline-file');
const legacyBaselineFile = path.resolve(baselineFileIndex >= 0
  ? process.argv[baselineFileIndex + 1] || resolveLegacyBaselineFile(root, baselineRoot)
  : resolveLegacyBaselineFile(root, baselineRoot));

if (!['full', 'changed'].includes(checkMode)) {
  console.error(`baseline-check: 不支持 --mode ${checkMode}；可选值为 full 或 changed。`);
  process.exit(1);
}

const results = [];
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.vue', '.mjs', '.cjs']);
const builtinPackages = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)]);

function normalize(value) {
  return value.replace(/\\/g, '/');
}

function record(level, id, message, file = '') {
  results.push({ level, id, message, file: normalize(file) });
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function baselineExists(rel) {
  return fs.existsSync(path.join(baselineRoot, rel));
}

function readBaseline(rel) {
  return fs.readFileSync(path.join(baselineRoot, rel), 'utf8');
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', 'coverage', baselineDirName, PROJECT_STATE_DIRECTORY].includes(entry.name)) continue;
      walk(full, acc);
    } else {
      acc.push(full);
    }
  }
  return acc;
}

function getYamlScalar(text, dottedKey) {
  const parts = dottedKey.split('.');
  const lines = text.split(/\r?\n/);
  let start = 0;
  let parentIndent = -1;
  for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
    const part = parts[partIndex];
    let foundIndex = -1;
    let foundIndent = -1;
    let foundValue = '';
    for (let index = start; index < lines.length; index += 1) {
      const match = lines[index].match(new RegExp(`^(\\s*)${part}:\\s*(.*)$`));
      if (!match) continue;
      const indent = match[1].length;
      if (indent <= parentIndent) continue;
      foundIndex = index;
      foundIndent = indent;
      foundValue = match[2].trim();
      break;
    }
    if (foundIndex < 0) return '';
    if (partIndex === parts.length - 1) return foundValue.replace(/^["']|["']$/g, '');
    start = foundIndex + 1;
    parentIndent = foundIndent;
  }
  return '';
}

function hasYamlKey(text, key) {
  return new RegExp(`(^|\\n)\\s*${key}:`).test(text);
}

function hasManifestField(text, key) {
  const explicitKey = new RegExp(`(^|[,{\\n\\r])\\s*${key}\\s*:`);
  const shorthandKey = new RegExp(`(^|[,{\\n\\r])\\s*${key}\\s*(,|})`);
  return hasYamlKey(text, key) || explicitKey.test(text) || shorthandKey.test(text);
}

function extractArrayField(text, key) {
  const match = text.match(new RegExp(`(?:^|[,{\\n\\r])\\s*${key}\\s*:\\s*\\[([\\s\\S]*?)\\]`));
  if (!match) return [];
  return [...match[1].matchAll(/["']([^"']+)["']/g)].map((item) => item[1]);
}

function extractImports(text) {
  const imports = new Set();
  const patterns = [
    /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g,
    /import\(\s*["']([^"']+)["']\s*\)/g,
    /require\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) imports.add(match[1]);
  }
  return [...imports];
}

function packageName(specifier) {
  if (specifier.startsWith('@')) return specifier.split('/').slice(0, 2).join('/');
  return specifier.split('/')[0];
}

function isBareSpecifier(specifier) {
  return !specifier.startsWith('.')
    && !specifier.startsWith('/')
    && !specifier.startsWith('@/')
    && !specifier.startsWith('~/')
    && !specifier.startsWith('#');
}

function resolveProjectSpecifier(fromFile, specifier) {
  if (specifier.startsWith('.')) return path.resolve(path.dirname(fromFile), specifier);
  if (specifier.startsWith('@/')) return path.resolve(root, 'src', specifier.slice(2));
  if (specifier.startsWith('~/')) return path.resolve(root, 'src', specifier.slice(2));
  return '';
}

function pathWithin(candidate, parent) {
  if (!candidate || !parent) return false;
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function gitignoreHidesBaselineKit(text) {
  const accepted = [baselineDirName, `${baselineDirName}/`, `/${baselineDirName}`, `/${baselineDirName}/`];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('!'))
    .some((line) => accepted.includes(line));
}

function ensureAiEntrypoints() {
  const files = ['AGENTS.md', 'CLAUDE.md'];
  if (!fixEntrypoints) {
    for (const file of files) {
      const filePath = path.join(root, file);
      const existsEntrypoint = fs.existsSync(filePath);
      const text = existsEntrypoint ? fs.readFileSync(filePath, 'utf8') : '';
      if (existsEntrypoint && hasStrongRootEntrypoint(text, baselineDirName)) continue;
      record('warn', existsEntrypoint ? 'weak_ai_entrypoint' : 'missing_ai_entrypoint', `${file} 缺少 ai-baseline-kit 强入口约束；运行 baseline-check.mjs --fix-entrypoints 可自动补齐。`, file);
    }
    return;
  }

  const existed = new Map(files.map((file) => [file, fs.existsSync(path.join(root, file))]));
  const changed = new Set(ensureRootEntrypoints(root, baselineDirName));
  for (const file of files) {
    if (changed.has(file)) record('info', existed.get(file) ? 'ai_entrypoint_strengthened' : 'ai_entrypoint_created', `已补齐 ${file} 的 ai-baseline-kit 强入口约束。`, file);
  }
}

function checkGitignoreAllowsBaselineKitChanges() {
  const gitignorePath = path.join(root, '.gitignore');
  const text = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
  if (fixGitignore) record('info', 'fix_gitignore_deprecated', '--fix-gitignore 已废弃；脚本不会自动修改 .gitignore。', '.gitignore');
  if (gitignoreHidesBaselineKit(text)) record('warn', 'baseline_kit_gitignored', `目标项目 .gitignore 隐藏 ${baselineDirName}/；请显式移除该规则。`, '.gitignore');
  if (text.split(/\r?\n/).some((line) => ['.ai-frontend-assembler', '.ai-frontend-assembler/'].includes(line.trim()))) record('warn', 'project_state_gitignored', `目标项目 .gitignore 隐藏 ${PROJECT_STATE_DIRECTORY}/；项目地图和旧项目基线必须保持可追踪。`, '.gitignore');
}

function checkBuildIsolation() {
  if (isPackageRepositoryReference()) return;
  const isolation = inspectBuildIsolation({ projectRoot: root, baselineRoot });
  for (const item of isolation.ignoreFiles) {
    if (item.required && item.status !== 'ready') record('warn', 'build_deploy_ignore_missing', `${item.file} 缺少 AI 能力包部署排除规则；重新运行 ai-run activate 可自动修复。`, item.file);
  }
  if (!isolation.packageNpmIgnore) record('error', 'baseline_package_npm_exclusion_missing', `${baselineDirName}/.npmignore 缺失，npm pack 可能包含能力包。`, `${baselineDirName}/.npmignore`);
  if (!isolation.stateNpmIgnore) record('warn', 'project_state_npm_exclusion_missing', `${PROJECT_STATE_DIRECTORY}/.npmignore 缺失，npm pack 可能包含项目装配状态。`, `${PROJECT_STATE_DIRECTORY}/.npmignore`);
  if (isolation.packageHook.status === 'missing') record('warn', 'build_artifact_guard_missing', 'package.json scripts.postbuild 未接入构建产物隔离守卫；重新运行 ai-run activate 可自动修复。', 'package.json');
  if (isolation.packageHook.status === 'invalid') record('error', 'build_artifact_guard_invalid_package', `package.json 无法检查构建隔离: ${isolation.packageHook.reason}`, 'package.json');
}

function checkRequiredFiles() {
  const required = [
    'AGENTS.md',
    'README.md',
    'INSTALL.md',
    'plugin.json',
    'docs/baseline-rules.yml',
    'docs/engineering-workflow.yml',
    'docs/project-scheme.schema.yml',
    'docs/module-manifest.schema.yml',
    'docs/stack-profiles.yml',
    'docs/feature-spec.schema.json',
    'docs/feature-spec.template.json',
    'docs/change-plan.schema.json',
    'docs/change-plan.template.json',
    'docs/module-meta.schema.json',
    'docs/legacy-baseline.schema.json',
    'docs/project-state.schema.json',
    'docs/design-system.yml',
    'skills/project-scheme-bootstrap/SKILL.md',
    'skills/baseline-structure-skill/SKILL.md',
    'skills/baseline-conformance-skill/SKILL.md',
    'skills/requirement-to-feature-spec/SKILL.md',
    'skills/feature-architecture-planner/SKILL.md',
    'scripts/baseline-check.mjs',
    'scripts/project-state-lib.mjs',
    'scripts/ai-run.mjs',
    'scripts/ci-gate.mjs',
    'scripts/project-upgrade.mjs',
    'scripts/package-upgrade-contract-check.mjs',
    'scripts/project-doctor.mjs',
    'scripts/project-bootstrap.mjs',
    'scripts/project-validate.mjs',
    'scripts/project-tools-check.mjs',
    'scripts/baseline-contract-check.mjs',
    'scripts/template-build-check.mjs',
    'scripts/build-isolation-lib.mjs',
    'scripts/build-artifact-guard.mjs',
    'scripts/build-isolation-contract-check.mjs',
    'scripts/requirement-compile.mjs',
    'scripts/feature-plan.mjs',
    'scripts/feature-generate.mjs',
    'scripts/module-create.mjs',
    'templates/react18-antd-tailwind-ts/README.md',
    'templates/vue3-vite-ts/README.md',
  ];
  for (const rel of required) {
    if (!baselineExists(rel)) record('error', 'missing_required_file', `缺少基线包文件: ${baselineDirName}/${rel}`, rel);
  }
  if (!baselineExists('docs/project-scheme.yml')) record('error', 'missing_package_reference_scheme', `缺少 ${baselineDirName}/docs/project-scheme.yml 包参考地图。`, projectSchemeDisplay);
}

function projectSchemeText() {
  return fs.existsSync(projectSchemeFile) ? fs.readFileSync(projectSchemeFile, 'utf8') : '';
}

function isPackageRepositoryRoot() {
  const registry = path.join(root, 'package-registry.json');
  return fs.existsSync(registry) && fs.readFileSync(registry, 'utf8').includes('ai-baseline-kit');
}

function isPackageRepositoryReference() {
  const text = projectSchemeText();
  return getYamlScalar(text, 'project.map_status') === 'package-repository-reference';
}

function checkProjectScheme() {
  const text = projectSchemeText();
  if (!text) return;
  if (isPackageRepositoryReference() && !isPackageRepositoryRoot()) {
    record('error', 'project_state_not_initialized', `目标项目尚未初始化专属状态；请先运行 project-bootstrap，状态将写入 ${PROJECT_STATE_DIRECTORY}/。`, `${PROJECT_STATE_DIRECTORY}/project-scheme.yml`);
    return;
  }
  const top = ['project', 'stack', 'layers', 'entrypoints', 'modules', 'validation', 'required_questions', 'confidence', 'evidence'];
  for (const key of top) {
    if (!hasYamlKey(text, key)) record('error', 'project_scheme_missing_key', `project-scheme 缺少字段: ${key}`, projectSchemeDisplay);
  }
  const requiredScalars = ['stack.framework', 'stack.build_tool', 'stack.router', 'stack.package_manager', 'layers.modules_root', 'entrypoints.app', 'entrypoints.api_client', 'entrypoints.theme', 'modules.root', 'validation.build'];
  const unknownKeys = [];
  for (const key of requiredScalars) {
    const value = getYamlScalar(text, key);
    if (!value) record('error', 'project_scheme_empty_value', `project-scheme 字段为空或无法识别: ${key}`, projectSchemeDisplay);
    if (value === 'unknown') unknownKeys.push(key);
  }
  if (!isPackageRepositoryReference() && unknownKeys.length) {
    const questionsEmpty = /required_questions:\s*\[\s*\]/.test(text);
    record(questionsEmpty ? 'error' : 'warn', 'project_scheme_unresolved_boundaries', `project-scheme 仍有未解析关键字段: ${unknownKeys.join(', ')}`, projectSchemeDisplay);
  }
}

function detectModulesRoot() {
  const text = projectSchemeText();
  if (text) {
    const explicit = getYamlScalar(text, 'modules.root') || getYamlScalar(text, 'layers.modules_root');
    if (explicit && !['unknown', 'project-defined', 'not-applicable-package-repository'].includes(explicit)) return explicit.replace(/\\/g, '/');
  }
  for (const candidate of ['src/modules', 'src/features', 'src/domains', 'src/packages', 'modules', 'features']) {
    if (exists(candidate)) return candidate;
  }
  return '';
}

function checkManifestText(rel, text) {
  const required = ['name', 'version', 'domain', 'routes', 'menus', 'access', 'locales', 'stores', 'directives', 'dependencies'];
  for (const key of required) {
    if (!hasManifestField(text, key)) record('error', 'module_manifest_missing_key', `模块 manifest 缺少字段: ${key}`, rel);
  }
  const deps = ['shared', 'base_components', 'npm', 'dev', 'env', 'assets', 'permissions'];
  for (const key of deps) {
    if (!hasManifestField(text, key)) record('error', 'module_manifest_missing_dependency_bucket', `manifest.dependencies 缺少依赖桶: ${key}`, rel);
  }
}

function readPackageDependencies() {
  const packagePath = path.join(root, 'package.json');
  const empty = { runtime: new Set(), dev: new Set(), all: new Set() };
  if (!fs.existsSync(packagePath)) return empty;
  try {
    const data = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const runtime = new Set(Object.keys({ ...(data.dependencies ?? {}), ...(data.peerDependencies ?? {}), ...(data.optionalDependencies ?? {}) }));
    const dev = new Set(Object.keys(data.devDependencies ?? {}));
    return { runtime, dev, all: new Set([...runtime, ...dev]) };
  } catch {
    record('error', 'package_json_invalid', 'package.json 不是有效 JSON。', 'package.json');
    return empty;
  }
}

function findManifest(modRoot) {
  return ['manifest.yml', 'manifest.yaml', 'manifest.json', 'manifest.ts', 'manifest.tsx', 'manifest.js', 'manifest.jsx']
    .map((name) => path.join(modRoot, name))
    .find((file) => fs.existsSync(file));
}

function moduleNameFromPath(candidate, modulesRootAbs) {
  if (!pathWithin(candidate, modulesRootAbs)) return '';
  const relative = normalize(path.relative(modulesRootAbs, candidate));
  return relative.split('/')[0] || '';
}

function checkModuleImports(modRoot, moduleName, modulesRootAbs, manifestText, packageDependencies) {
  const declaredNpm = new Set(extractArrayField(manifestText, 'npm').map(packageName));
  const declaredDev = new Set(extractArrayField(manifestText, 'dev').map(packageName));
  for (const dependency of declaredNpm) {
    if (!packageDependencies.runtime.has(dependency)) record('error', 'manifest_npm_not_installed', `manifest 声明的运行时 npm 依赖未出现在 package.json dependencies/peerDependencies/optionalDependencies: ${dependency}`, normalize(path.relative(root, modRoot)));
  }
  for (const dependency of declaredDev) {
    if (!packageDependencies.all.has(dependency)) record('error', 'manifest_dev_not_installed', `manifest 声明的开发依赖未出现在 package.json: ${dependency}`, normalize(path.relative(root, modRoot)));
  }
  for (const file of walk(modRoot).filter((item) => sourceExtensions.has(path.extname(item)))) {
    const rel = normalize(path.relative(root, file));
    const isTestFile = /(^|\/)tests\//.test(rel) || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(rel);
    const text = fs.readFileSync(file, 'utf8');
    for (const specifier of extractImports(text)) {
      const resolved = resolveProjectSpecifier(file, specifier);
      const targetModule = moduleNameFromPath(resolved, modulesRootAbs);
      if (targetModule && targetModule !== moduleName) record('error', 'cross_module_import', `模块 ${moduleName} 直接引用了模块 ${targetModule}`, rel);
      if (isBareSpecifier(specifier)) {
        const dependency = packageName(specifier);
        if (builtinPackages.has(dependency) || builtinPackages.has(specifier)) continue;
        if (isTestFile) {
          if (!declaredNpm.has(dependency) && !declaredDev.has(dependency)) {
            record('error', 'undeclared_module_test_dependency', `模块测试使用了 dependencies.npm/dev 未声明的依赖: ${dependency}`, rel);
          }
        } else if (!declaredNpm.has(dependency)) {
          const id = declaredDev.has(dependency) ? 'module_runtime_dep_declared_as_dev' : 'undeclared_module_npm_dependency';
          const message = declaredDev.has(dependency)
            ? `模块生产代码使用的依赖只声明在 dependencies.dev: ${dependency}`
            : `模块使用了 manifest.dependencies.npm 未声明的依赖: ${dependency}`;
          record('error', id, message, rel);
        }
      }
    }
    if (path.extname(file) === '.vue' && /<style(?:\s|>)/.test(text)) record('error', 'module_inline_style', '模块 Vue 组件包含内联 style；请按基线外置到所属 styles 文件。', rel);
    if (['.tsx', '.jsx'].includes(path.extname(file)) && /\bstyle\s*=\s*\{/.test(text)) record('error', 'module_inline_style', '模块 JSX 组件包含内联 style；请按基线外置到所属样式文件。', rel);
    if (normalize(file).includes('/api/') && /(axios\s*\.\s*create|new\s+Axios|interceptors\s*\.)/.test(text)) {
      record('error', 'module_private_api_client', '模块 API 创建了私有请求实例或拦截器；必须使用项目统一 API client。', rel);
    }
  }
}

function checkSharedAndShellDirections(modulesRootAbs) {
  const scheme = projectSchemeText();
  const sharedRoot = getYamlScalar(scheme, 'layers.shared_root');
  const shellRoot = getYamlScalar(scheme, 'layers.shell_root');
  if (sharedRoot && !['unknown', 'project-defined'].includes(sharedRoot) && exists(sharedRoot)) {
    for (const file of walk(path.join(root, sharedRoot)).filter((item) => sourceExtensions.has(path.extname(item)))) {
      const text = fs.readFileSync(file, 'utf8');
      for (const specifier of extractImports(text)) {
        const resolved = resolveProjectSpecifier(file, specifier);
        if (moduleNameFromPath(resolved, modulesRootAbs)) record('error', 'shared_depends_on_module', 'shared 不得依赖具体业务模块。', path.relative(root, file));
      }
    }
  }
  if (shellRoot && !['unknown', 'project-defined'].includes(shellRoot) && exists(shellRoot)) {
    for (const file of walk(path.join(root, shellRoot)).filter((item) => sourceExtensions.has(path.extname(item)))) {
      const text = fs.readFileSync(file, 'utf8');
      for (const specifier of extractImports(text)) {
        const resolved = resolveProjectSpecifier(file, specifier);
        const targetModule = moduleNameFromPath(resolved, modulesRootAbs);
        if (!targetModule) continue;
        const moduleRoot = path.join(modulesRootAbs, targetModule);
        const relative = normalize(path.relative(moduleRoot, resolved));
        if (relative && !/^index(?:\.[a-z]+)?$/i.test(relative)) record('error', 'shell_imports_module_private_file', `shell 只能通过模块公开入口导入模块 ${targetModule}。`, path.relative(root, file));
      }
    }
  }
}

function checkProtectedPackageImports() {
  const protectedStateRoot = path.join(root, PROJECT_STATE_DIRECTORY);
  for (const file of walk(root).filter((item) => sourceExtensions.has(path.extname(item)))) {
    const rel = normalize(path.relative(root, file));
    const text = fs.readFileSync(file, 'utf8');
    for (const specifier of extractImports(text)) {
      const normalizedSpecifier = normalize(specifier).replace(/^\/+/, '');
      const directProtectedImport = normalizedSpecifier === baselineDirName
        || normalizedSpecifier.startsWith(`${baselineDirName}/`)
        || normalizedSpecifier === PROJECT_STATE_DIRECTORY
        || normalizedSpecifier.startsWith(`${PROJECT_STATE_DIRECTORY}/`);
      const resolved = resolveProjectSpecifier(file, specifier);
      const resolvedProtectedImport = pathWithin(resolved, baselineRoot) || pathWithin(resolved, protectedStateRoot);
      if (directProtectedImport || resolvedProtectedImport) {
        record('error', 'business_imports_ai_package', `业务源码不得导入 ${baselineDirName}/ 或 ${PROJECT_STATE_DIRECTORY}/；否则构建工具可能把装配包内容内联进前端产物: ${specifier}`, rel);
      }
    }
  }
}

function checkDynamicAssembly() {
  for (const file of walk(root).filter((item) => sourceExtensions.has(path.extname(item)))) {
    const text = fs.readFileSync(file, 'utf8');
    if (/import\.meta\.glob(?:Eager)?\s*\(/.test(text)) record('error', 'dynamic_module_assembly', '禁止使用 import.meta.glob 动态扫描装配模块；请使用显式静态注册。', path.relative(root, file));
  }
}

function checkModules() {
  if (isPackageRepositoryReference()) return;
  const modulesRoot = detectModulesRoot();
  if (!modulesRoot) {
    record('warn', 'modules_root_unknown', '无法确定模块根目录；必须先由 project-bootstrap 记录现状并确认边界。');
    return;
  }
  const absRoot = path.join(root, modulesRoot);
  if (!fs.existsSync(absRoot)) {
    record('error', 'modules_root_missing', `project-scheme 指向的模块根目录不存在: ${modulesRoot}`, modulesRoot);
    return;
  }
  const moduleDirs = fs.readdirSync(absRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  if (moduleDirs.length === 0) {
    record('warn', 'modules_empty', `模块根目录为空: ${modulesRoot}`, modulesRoot);
    return;
  }
  const packageDependencies = readPackageDependencies();
  const requiredFiles = ['module.meta.json', 'acceptance.md', 'index.ts', 'routes.ts', 'menu.ts', 'access.ts'];
  const requiredDirectories = ['pages', 'components', 'api', 'types', 'stores', 'locales', 'styles', 'assets', 'directives', 'tests'];
  for (const entry of moduleDirs) {
    const mod = entry.name;
    const modRoot = path.join(absRoot, mod);
    const modRel = normalize(path.relative(root, modRoot));
    const manifest = findManifest(modRoot);
    if (!manifest) {
      record('error', 'module_manifest_missing', `模块缺少 manifest: ${mod}`, modRel);
      continue;
    }
    const manifestText = fs.readFileSync(manifest, 'utf8');
    checkManifestText(path.relative(root, manifest), manifestText);
    const metadataFile = path.join(modRoot, 'module.meta.json');
    if (fs.existsSync(metadataFile)) {
      try {
        const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
        for (const key of ['schemaVersion', 'kind', 'name', 'version', 'domain', 'archetype', 'ownership', 'capabilities', 'entrypoints', 'dependencies', 'portability', 'provenance']) {
          if (metadata[key] === undefined) record('error', 'module_metadata_missing_key', `module.meta.json 缺少字段: ${key}`, path.relative(root, metadataFile));
        }
        for (const key of ['modules', 'shared', 'npm', 'dev']) {
          if (!Array.isArray(metadata.dependencies?.[key])) record('error', 'module_metadata_missing_dependency_bucket', `module.meta.json dependencies.${key} 必须为数组。`, path.relative(root, metadataFile));
        }
        if (metadata.kind !== 'ai-baseline-module') record('error', 'module_metadata_kind_invalid', 'module.meta.json kind 必须为 ai-baseline-module。', path.relative(root, metadataFile));
        if (metadata.name && metadata.name !== mod) record('error', 'module_metadata_name_mismatch', `module.meta.json name 与目录名不一致: ${metadata.name} != ${mod}`, path.relative(root, metadataFile));
        if (metadata.ownership !== 'module') record('error', 'module_metadata_ownership_invalid', 'module.meta.json ownership 必须为 module。', path.relative(root, metadataFile));
        if (Array.isArray(metadata.dependencies?.modules) && metadata.dependencies.modules.length) record('error', 'module_metadata_cross_module_dependency', 'module.meta.json 不得声明直接模块依赖；请通过 shared 或 shell 组合。', path.relative(root, metadataFile));
        if (metadata.portability?.crossModuleImports !== false) record('error', 'module_metadata_portability_invalid', 'module.meta.json portability.crossModuleImports 必须为 false。', path.relative(root, metadataFile));
        if (metadata.portability?.shellPrivateImports !== false) record('error', 'module_metadata_portability_invalid', 'module.meta.json portability.shellPrivateImports 必须为 false。', path.relative(root, metadataFile));
        for (const key of ['shared', 'npm', 'dev']) {
          const staticValues = [...new Set(metadata.dependencies?.[key] ?? [])].sort();
          const runtimeValues = [...new Set(extractArrayField(manifestText, key))].sort();
          if (JSON.stringify(staticValues) !== JSON.stringify(runtimeValues)) {
            record('error', 'module_metadata_manifest_mismatch', `module.meta.json dependencies.${key} 与 manifest.dependencies.${key} 不一致。`, path.relative(root, metadataFile));
          }
        }
        const staticPermissions = [...new Set(metadata.permissions ?? [])].sort();
        const runtimePermissions = [...new Set(extractArrayField(manifestText, 'permissions'))].sort();
        if (JSON.stringify(staticPermissions) !== JSON.stringify(runtimePermissions)) {
          record('error', 'module_metadata_manifest_mismatch', 'module.meta.json permissions 与 manifest.dependencies.permissions 不一致。', path.relative(root, metadataFile));
        }
      } catch (error) {
        record('error', 'module_metadata_invalid_json', `module.meta.json 不是有效 JSON: ${error.message}`, path.relative(root, metadataFile));
      }
    }
    for (const requiredFile of requiredFiles) {
      const variants = requiredFile === 'routes.ts' ? ['routes.ts', 'routes.tsx', 'routes.js', 'routes.jsx'] : [requiredFile, requiredFile.replace(/\.ts$/, '.js')];
      if (!variants.some((name) => fs.existsSync(path.join(modRoot, name)))) record('error', 'module_contract_file_missing', `模块 ${mod} 缺少契约文件: ${requiredFile}`, modRel);
    }
    for (const requiredDirectory of requiredDirectories) {
      if (!fs.existsSync(path.join(modRoot, requiredDirectory))) record('error', 'module_contract_directory_missing', `模块 ${mod} 缺少契约目录: ${requiredDirectory}/`, modRel);
    }
    const indexFile = ['index.ts', 'index.tsx', 'index.js', 'index.jsx'].map((name) => path.join(modRoot, name)).find((file) => fs.existsSync(file));
    if (indexFile) {
      const indexText = fs.readFileSync(indexFile, 'utf8');
      for (const exported of ['moduleManifest', 'routes', 'menus', 'access', 'locales', 'stores', 'directives']) {
        if (!new RegExp(`\\b${exported}\\b`).test(indexText)) record('error', 'module_public_export_missing', `模块公开入口缺少导出: ${exported}`, path.relative(root, indexFile));
      }
    }
    checkModuleImports(modRoot, mod, absRoot, manifestText, packageDependencies);
  }
  checkSharedAndShellDirections(absRoot);
}


function checkAstBoundaries() {
  if (isPackageRepositoryReference()) return;
  const report = analyzeAstBoundaries({ projectRoot: root, baselineRoot });
  for (const notice of report.notices) record(notice.level || 'info', notice.id, notice.message);
  for (const violation of report.violations) {
    const line = violation.line ? `:${violation.line}` : '';
    record(violation.level || 'error', violation.id, `${violation.message}${line ? ` [line ${violation.line}]` : ''}`, violation.file);
  }
}

function checkStyleIsolation() {
  if (isPackageRepositoryReference()) return;
  const modulesRoot = detectModulesRoot();
  if (!modulesRoot) return;
  const report = analyzeStyleIsolation({ projectRoot: root, modulesRoot });
  for (const violation of report.violations) record(violation.level || 'error', violation.id, violation.message, violation.file);
}

function checkI18nHints() {
  if (isPackageRepositoryReference()) return;
  const i18n = getYamlScalar(projectSchemeText(), 'stack.i18n').toLowerCase();
  if (!i18n || ['unknown', 'project-defined', 'none', 'disabled', 'false'].includes(i18n)) return;
  const chinesePattern = /[\u4e00-\u9fff]/;
  for (const file of walk(root).filter((item) => sourceExtensions.has(path.extname(item)))) {
    const rel = normalize(path.relative(root, file));
    if (rel.includes('/locales/') || rel.includes('/i18n/')) continue;
    const text = fs.readFileSync(file, 'utf8');
    if (chinesePattern.test(text)) record('warn', 'possible_hardcoded_visible_text', '项目已启用 i18n，发现中文文本，请确认是否应进入所属 locales。', rel);
  }
}

if (stateMigration.migrations.length) record('info', 'project_state_migrated', `已将 ${stateMigration.migrations.length} 个旧版项目状态文件迁移到 ${PROJECT_STATE_DIRECTORY}/。`, PROJECT_STATE_DIRECTORY);
checkRequiredFiles();
checkGitignoreAllowsBaselineKitChanges();
checkBuildIsolation();
ensureAiEntrypoints();
checkProjectScheme();
checkModules();
checkStyleIsolation();
checkProtectedPackageImports();
checkAstBoundaries();
checkDynamicAssembly();
checkI18nHints();

function violationFingerprint(item) {
  return `${item.level}|${item.id}|${item.file}|${item.message}`;
}

if (writeLegacyBaseline) {
  const snapshot = {
    schemaVersion: 1,
    kind: 'ai-baseline-legacy-snapshot',
    generatedAt: new Date().toISOString(),
    projectRoot: normalize(root),
    violations: results
      .filter((item) => item.level === 'error' || item.level === 'warn')
      .map((item) => ({ ...item, fingerprint: violationFingerprint(item) })),
  };
  fs.mkdirSync(path.dirname(legacyBaselineFile), { recursive: true });
  fs.writeFileSync(legacyBaselineFile, `${JSON.stringify(snapshot, null, 2)}
`, 'utf8');
  console.log('baseline-check: legacy-baseline-written');
  console.log(`baseline-file: ${normalize(path.relative(root, legacyBaselineFile))}`);
  console.log(`historical-violations: ${snapshot.violations.length}`);
  process.exit(0);
}

let displayResults = [...results];
let historicalCount = 0;
if (checkMode === 'changed') {
  if (!fs.existsSync(legacyBaselineFile)) {
    displayResults.push({
      level: 'error',
      id: 'legacy_baseline_missing',
      message: 'changed 模式缺少历史违规快照；旧项目首次接入请先运行 baseline-check --write-baseline。',
      file: normalize(path.relative(root, legacyBaselineFile)),
    });
  } else {
    try {
      const snapshot = JSON.parse(fs.readFileSync(legacyBaselineFile, 'utf8'));
      const historical = new Set((snapshot.violations ?? []).map((item) => item.fingerprint || violationFingerprint(item)));
      historicalCount = displayResults.filter((item) => (item.level === 'error' || item.level === 'warn') && historical.has(violationFingerprint(item))).length;
      displayResults = displayResults.filter((item) => item.level === 'info' || !historical.has(violationFingerprint(item)));
    } catch (error) {
      displayResults.push({ level: 'error', id: 'legacy_baseline_invalid', message: `历史违规快照无效: ${error.message}`, file: normalize(path.relative(root, legacyBaselineFile)) });
    }
  }
}

console.log(`baseline_root: ${baselineRoot}`);
console.log(`project_root: ${root}`);
console.log(`mode: ${checkMode}`);
if (checkMode === 'changed') console.log(`historical-violations-ignored: ${historicalCount}`);
console.log('');
const order = { error: 0, warn: 1, info: 2 };
displayResults.sort((a, b) => order[a.level] - order[b.level] || a.id.localeCompare(b.id));
for (const item of displayResults) {
  const location = item.file ? ` (${item.file})` : '';
  console.log(`[${item.level}] ${item.id}: ${item.message}${location}`);
}
const errors = displayResults.filter((item) => item.level === 'error').length;
const warnings = displayResults.filter((item) => item.level === 'warn').length;
console.log(`
summary: ${errors} error(s), ${warnings} warning(s)`);
if (errors > 0 || (failOnWarn && warnings > 0)) process.exit(1);
