import fs from 'node:fs';
import path from 'node:path';
import { builtinModules, createRequire } from 'node:module';
import { resolveProjectSchemeFile } from './project-state-lib.mjs';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue']);
const RESOLVE_EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.json'];
const BUILTINS = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)]);

function normalize(value) {
  return value.replace(/\\/g, '/');
}

function pathWithin(candidate, parent) {
  if (!candidate || !parent) return false;
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function walk(directory, ignoredNames, result = []) {
  if (!directory || !fs.existsSync(directory)) return result;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredNames.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full, ignoredNames, result);
    else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) result.push(full);
  }
  return result;
}

function readYamlScalar(text, dottedKey) {
  const parts = dottedKey.split('.');
  const lines = text.split(/\r?\n/);
  let start = 0;
  let parentIndent = -1;
  for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
    const part = parts[partIndex];
    let found = null;
    for (let index = start; index < lines.length; index += 1) {
      const match = lines[index].match(new RegExp(`^(\\s*)${part}:\\s*(.*)$`));
      if (!match || match[1].length <= parentIndent) continue;
      found = { index, indent: match[1].length, value: match[2].trim() };
      break;
    }
    if (!found) return '';
    if (partIndex === parts.length - 1) return found.value.replace(/^["']|["']$/g, '');
    start = found.index + 1;
    parentIndent = found.indent;
  }
  return '';
}

function findBaselineRoot(projectRoot, providedBaselineRoot) {
  const embedded = path.join(projectRoot, 'ai-baseline-kit');
  if (fs.existsSync(path.join(embedded, 'docs', 'project-scheme.yml'))) return embedded;
  return providedBaselineRoot || embedded;
}

function loadProjectModule(projectRoot, name) {
  try {
    const requireFromProject = createRequire(path.join(projectRoot, 'package.json'));
    return requireFromProject(name);
  } catch {
    return null;
  }
}

function packageName(specifier) {
  if (specifier.startsWith('@')) return specifier.split('/').slice(0, 2).join('/');
  return specifier.split('/')[0];
}

function isBareSpecifier(specifier) {
  return !specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.startsWith('#') && !specifier.startsWith('@/') && !specifier.startsWith('~/');
}

function isTestFile(file) {
  const normalized = normalize(file);
  return /(^|\/)tests\//.test(normalized) || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(normalized);
}

function moduleAt(file, modulesRoot) {
  if (!pathWithin(file, modulesRoot)) return null;
  const relative = normalize(path.relative(modulesRoot, file));
  const name = relative.split('/')[0];
  return name ? { name, root: path.join(modulesRoot, name), relative } : null;
}

function readModuleMetadata(moduleRoot) {
  const file = path.join(moduleRoot, 'module.meta.json');
  if (!fs.existsSync(file)) return { file, metadata: null };
  try {
    return { file, metadata: JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch {
    return { file, metadata: null };
  }
}

function resolveWithExtensions(candidate) {
  for (const extension of RESOLVE_EXTENSIONS) {
    const file = `${candidate}${extension}`;
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return path.resolve(file);
  }
  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    for (const extension of RESOLVE_EXTENSIONS.slice(1)) {
      const indexFile = path.join(candidate, `index${extension}`);
      if (fs.existsSync(indexFile) && fs.statSync(indexFile).isFile()) return path.resolve(indexFile);
    }
  }
  return '';
}

function fallbackResolve(projectRoot, fromFile, specifier) {
  if (specifier.startsWith('.')) return resolveWithExtensions(path.resolve(path.dirname(fromFile), specifier));
  if (specifier.startsWith('@/') || specifier.startsWith('~/')) return resolveWithExtensions(path.resolve(projectRoot, 'src', specifier.slice(2)));
  if (specifier.startsWith('/')) return resolveWithExtensions(path.resolve(projectRoot, `.${specifier}`));
  return '';
}

function scriptKind(ts, file) {
  const extension = path.extname(file).toLowerCase();
  if (extension === '.tsx') return ts.ScriptKind.TSX;
  if (extension === '.jsx') return ts.ScriptKind.JSX;
  if (extension === '.js' || extension === '.mjs' || extension === '.cjs') return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function vueScripts(file, source, vueCompiler) {
  if (vueCompiler?.parse) {
    try {
      const parsed = vueCompiler.parse(source, { filename: file });
      const blocks = [parsed.descriptor.script, parsed.descriptor.scriptSetup].filter(Boolean);
      return { code: blocks.map((block) => block.content).join('\n'), mode: 'typescript+vue-compiler-sfc' };
    } catch {
      // The regex fallback below still gives the TypeScript parser a bounded script-only input.
    }
  }
  const blocks = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
  return { code: blocks.join('\n'), mode: 'typescript+vue-script-fallback' };
}

function importEdges(ts, sourceFile) {
  const edges = [];
  function add(specifier, kind, typeOnly, position) {
    if (typeof specifier !== 'string' || !specifier) return;
    const line = sourceFile.getLineAndCharacterOfPosition(position).line + 1;
    edges.push({ specifier, kind, typeOnly: Boolean(typeOnly), line });
  }
  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      add(node.moduleSpecifier.text, 'import', node.importClause?.isTypeOnly, node.getStart(sourceFile));
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      add(node.moduleSpecifier.text, 'export', node.isTypeOnly, node.getStart(sourceFile));
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && ts.isStringLiteralLike(node.moduleReference.expression)) {
      add(node.moduleReference.expression.text, 'import-equals', node.isTypeOnly, node.getStart(sourceFile));
    } else if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) add(node.arguments[0].text, 'dynamic-import', false, node.getStart(sourceFile));
      else if (ts.isIdentifier(node.expression) && node.expression.text === 'require') add(node.arguments[0].text, 'require', false, node.getStart(sourceFile));
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return edges;
}

function loadTsConfig(ts, projectRoot) {
  const configPath = ['tsconfig.json', 'jsconfig.json'].map((name) => path.join(projectRoot, name)).find((file) => fs.existsSync(file));
  if (!configPath) return { configPath: '', options: { allowJs: true, moduleResolution: ts.ModuleResolutionKind.Bundler ?? ts.ModuleResolutionKind.NodeNext } };
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  if (read.error) return { configPath, options: { allowJs: true } };
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, projectRoot, undefined, configPath);
  return { configPath, options: parsed.options };
}

function resolveImport(ts, projectRoot, fromFile, specifier, compilerOptions) {
  if (isBareSpecifier(specifier)) return '';
  try {
    const resolved = ts.resolveModuleName(specifier, fromFile, compilerOptions, ts.sys).resolvedModule?.resolvedFileName;
    if (resolved) return path.resolve(resolved.replace(/\.d\.ts$/, '.ts'));
  } catch {
    // Custom .vue and projects with incomplete tsconfig are handled by fallbackResolve.
  }
  return fallbackResolve(projectRoot, fromFile, specifier);
}

function isModulePublicEntry(target, moduleInfo) {
  if (!target || !moduleInfo) return false;
  const relative = normalize(path.relative(moduleInfo.root, target));
  return /^index(?:\.[cm]?[jt]sx?)?$/.test(relative);
}

function makeViolation(id, message, edge) {
  return { level: 'error', id, message, file: edge.from, line: edge.line, specifier: edge.specifier, to: edge.to || '' };
}

export function analyzeAstBoundaries({ projectRoot, baselineRoot } = {}) {
  const resolvedProjectRoot = path.resolve(projectRoot || process.cwd());
  const resolvedBaselineRoot = findBaselineRoot(resolvedProjectRoot, baselineRoot);
  const schemeFile = resolveProjectSchemeFile(resolvedProjectRoot, resolvedBaselineRoot);
  const scheme = fs.existsSync(schemeFile) ? fs.readFileSync(schemeFile, 'utf8') : '';
  const modulesRootRel = readYamlScalar(scheme, 'modules.root') || readYamlScalar(scheme, 'layers.modules_root') || 'src/modules';
  const sharedRootRel = readYamlScalar(scheme, 'layers.shared_root') || 'src/shared';
  const shellRootRel = readYamlScalar(scheme, 'layers.shell_root') || 'src/app';
  const modulesRoot = path.resolve(resolvedProjectRoot, modulesRootRel);
  const sharedRoot = path.resolve(resolvedProjectRoot, sharedRootRel);
  const shellRoot = path.resolve(resolvedProjectRoot, shellRootRel);
  const ts = loadProjectModule(resolvedProjectRoot, 'typescript');
  const vueCompiler = loadProjectModule(resolvedProjectRoot, '@vue/compiler-sfc');
  const report = {
    kind: 'ai-baseline-ast-boundary-report',
    schemaVersion: 1,
    projectRoot: normalize(resolvedProjectRoot),
    parser: {
      available: Boolean(ts),
      typescript: ts?.version || '',
      vue: vueCompiler ? 'compiler-sfc' : 'script-fallback',
      config: '',
    },
    layers: { modulesRoot: normalize(modulesRootRel), sharedRoot: normalize(sharedRootRel), shellRoot: normalize(shellRootRel) },
    files: [],
    edges: [],
    violations: [],
    notices: [],
  };
  if (!ts) {
    report.notices.push({ level: 'info', id: 'ast_parser_unavailable', message: '目标项目尚未安装 TypeScript；AST 边界检查已明确降级，安装依赖后使用 --require-parser 强制复核。' });
    return report;
  }

  const tsConfig = loadTsConfig(ts, resolvedProjectRoot);
  report.parser.config = tsConfig.configPath ? normalize(path.relative(resolvedProjectRoot, tsConfig.configPath)) : '';
  const ignored = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', 'coverage', path.basename(resolvedBaselineRoot)]);
  const sourceRoot = fs.existsSync(path.join(resolvedProjectRoot, 'src')) ? path.join(resolvedProjectRoot, 'src') : resolvedProjectRoot;
  const files = walk(sourceRoot, ignored).sort();
  const moduleMetadata = new Map();
  const violations = [];

  for (const file of files) {
    const relativeFile = normalize(path.relative(resolvedProjectRoot, file));
    const source = fs.readFileSync(file, 'utf8');
    let code = source;
    let parserMode = 'typescript';
    if (path.extname(file) === '.vue') {
      const extracted = vueScripts(file, source, vueCompiler);
      code = extracted.code;
      parserMode = extracted.mode;
    }
    const sourceFile = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, scriptKind(ts, file));
    report.files.push({ file: relativeFile, parser: parserMode });
    for (const found of importEdges(ts, sourceFile)) {
      const resolved = resolveImport(ts, resolvedProjectRoot, file, found.specifier, tsConfig.options);
      const edge = { from: relativeFile, specifier: found.specifier, to: resolved ? normalize(path.relative(resolvedProjectRoot, resolved)) : '', kind: found.kind, typeOnly: found.typeOnly, line: found.line };
      report.edges.push(edge);
      const fromModule = moduleAt(file, modulesRoot);
      const targetModule = resolved ? moduleAt(resolved, modulesRoot) : null;
      const fromShared = pathWithin(file, sharedRoot);
      const fromShell = pathWithin(file, shellRoot);
      const targetShell = resolved && pathWithin(resolved, shellRoot);

      if (fromModule && targetModule && fromModule.name !== targetModule.name) {
        violations.push(makeViolation('ast_cross_module_import', `模块 ${fromModule.name} 不得直接依赖模块 ${targetModule.name}。`, edge));
      }
      if (fromShared && targetModule) {
        violations.push(makeViolation('ast_shared_depends_on_module', `shared 不得依赖模块 ${targetModule.name}。`, edge));
      }
      if (fromShell && targetModule && !isModulePublicEntry(resolved, targetModule)) {
        violations.push(makeViolation('ast_shell_imports_module_private_file', `shell 只能通过模块 ${targetModule.name} 的公开 index 入口装配。`, edge));
      }
      if (fromModule && targetShell) {
        violations.push(makeViolation('ast_module_depends_on_shell_private', `模块 ${fromModule.name} 不得依赖 shell 私有实现。`, edge));
      }

      if (fromModule && isBareSpecifier(found.specifier)) {
        const dependency = packageName(found.specifier);
        if (BUILTINS.has(dependency) || BUILTINS.has(found.specifier)) continue;
        if (!moduleMetadata.has(fromModule.name)) moduleMetadata.set(fromModule.name, readModuleMetadata(fromModule.root));
        const metadataEntry = moduleMetadata.get(fromModule.name);
        const runtime = new Set((metadataEntry.metadata?.dependencies?.npm ?? []).map(packageName));
        const dev = new Set((metadataEntry.metadata?.dependencies?.dev ?? []).map(packageName));
        const test = isTestFile(file);
        if (test && !runtime.has(dependency) && !dev.has(dependency)) {
          violations.push(makeViolation('ast_undeclared_module_test_dependency', `模块测试使用了 module.meta.json dependencies.npm/dev 未声明的依赖: ${dependency}`, edge));
        } else if (!test && !runtime.has(dependency)) {
          const id = dev.has(dependency) ? 'ast_runtime_dependency_declared_as_dev' : 'ast_undeclared_module_runtime_dependency';
          const message = dev.has(dependency)
            ? `模块生产源码使用的依赖只声明在 dependencies.dev: ${dependency}`
            : `模块生产源码使用了 dependencies.npm 未声明的依赖: ${dependency}`;
          violations.push(makeViolation(id, message, edge));
        }
      }
    }
  }

  const seen = new Set();
  report.violations = violations.filter((item) => {
    const key = `${item.id}|${item.file}|${item.line}|${item.specifier}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return report;
}
