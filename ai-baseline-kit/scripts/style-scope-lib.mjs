import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  analyzeClassNaming,
  DEFAULT_CLASS_NAMING_PATTERN,
  DEFAULT_MODULE_STYLE_EXTENSION,
  LEGACY_CLASS_NAMING_MODE,
  normalizeModuleStyleExtension,
  resolveClassNamingPolicy,
  resolveModuleStyleExtension,
} from './style-class-naming-lib.mjs';

export const STYLE_MODULE_PATTERN = '*.module.{css,scss,sass,less,styl,stylus}';
export const VITE_SCOPED_NAME_PATTERN = 'm_[name]_[local]__[hash:base64:6]';
export const STYLE_ISOLATION_STRATEGIES = Object.freeze([
  'css-modules',
  'vue-scoped',
  'utility-css',
  'css-in-js',
  'shadow-dom',
  'hybrid',
  'custom',
]);

const STYLE_EXTENSIONS = new Set(['.css', '.scss', '.sass', '.less', '.styl', '.stylus']);
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.vue', '.mjs', '.cjs']);
const IGNORED_DIRECTORIES = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', 'coverage', 'ai-baseline-kit', '.ai-frontend-assembler']);
const GENERIC_STYLE_FILE = /^index(?:\.module)?\.(?:css|scss|sass|less|styl|stylus)$/i;
const CSS_IN_JS_PACKAGES = ['styled-components', '@emotion/react', '@emotion/styled', '@vanilla-extract/css', 'goober'];
const BUILTIN_ADAPTER_BY_STRATEGY = Object.freeze({
  'css-modules': 'builtin-css-modules',
  'vue-scoped': 'builtin-vue-scoped',
  'utility-css': 'builtin-utility-css',
  'css-in-js': 'builtin-css-in-js',
  'shadow-dom': 'builtin-shadow-dom',
  hybrid: 'builtin-hybrid',
});

function normalize(value) {
  return String(value || '').replace(/\\/g, '/');
}

function pathWithin(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function walk(directory, files = []) {
  if (!directory || !fs.existsSync(directory)) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function unquoteYamlScalar(value) {
  const text = String(value ?? '').trim();
  if ((text.startsWith("'") && text.endsWith("'")) || (text.startsWith('"') && text.endsWith('"'))) {
    const inner = text.slice(1, -1);
    return text.startsWith("'") ? inner.replaceAll("''", "'") : inner.replaceAll('\\"', '"');
  }
  return text;
}

function readStyleIsolationScheme(projectRoot) {
  const candidates = [
    path.join(projectRoot, '.ai-frontend-assembler', 'project-scheme.yml'),
    path.join(projectRoot, '.ai-frontend-assembler', 'project-scheme.yaml'),
  ];
  const file = candidates.find((candidate) => fs.existsSync(candidate));
  if (!file) return {};
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const result = {};
  let inSection = false;
  for (const line of lines) {
    if (/^style_isolation:\s*$/.test(line)) {
      inSection = true;
      continue;
    }
    if (!inSection) continue;
    if (/^[^\s#][^:]*:\s*/.test(line)) break;
    const match = line.match(/^\s{2}([A-Za-z0-9_-]+):\s*(.*?)\s*$/);
    if (match) result[match[1]] = unquoteYamlScalar(match[2]);
  }
  return result;
}

function valueOf(source, ...keys) {
  for (const key of keys) {
    if (source?.[key] !== undefined && source[key] !== null && source[key] !== '') return source[key];
  }
  return undefined;
}

function splitList(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function normalizeStrategy(value) {
  const strategy = String(value || '').trim().toLowerCase();
  const aliases = {
    cssmodules: 'css-modules',
    'css-module': 'css-modules',
    scoped: 'vue-scoped',
    tailwind: 'utility-css',
    utility: 'utility-css',
    cssinjs: 'css-in-js',
    shadow: 'shadow-dom',
    mixed: 'hybrid',
  };
  return aliases[strategy] || strategy;
}

export function isStyleFile(file) {
  return STYLE_EXTENSIONS.has(path.extname(String(file).split('?')[0]).toLowerCase());
}

export function isCssModuleFile(file) {
  return /\.module\.(?:css|scss|sass|less|styl|stylus)$/i.test(String(file).split('?')[0]);
}

function moduleNameFor(file, modulesRoot) {
  if (!pathWithin(file, modulesRoot)) return '';
  return normalize(path.relative(modulesRoot, file)).split('/')[0] || '';
}

function stripStyleQuery(specifier) {
  return String(specifier || '').split('?')[0];
}

function extractStyleImports(text) {
  const imports = [];
  const pattern = /import\s+(?:(.*?)\s+from\s+)?['"]([^'"]+\.(?:css|scss|sass|less|styl|stylus)(?:\?[^'"]+)?)['"]\s*;?/g;
  for (const match of text.matchAll(pattern)) {
    const specifier = match[2];
    imports.push({
      binding: (match[1] || '').trim(),
      specifier,
      fileSpecifier: stripStyleQuery(specifier),
      query: specifier.includes('?') ? specifier.slice(specifier.indexOf('?') + 1) : '',
    });
  }
  return imports;
}

function extractVueStyleBlocks(text) {
  const blocks = [];
  const pattern = /<style\b([^>]*)>([\s\S]*?)<\/style>/gi;
  for (const match of text.matchAll(pattern)) {
    const attrs = match[1] || '';
    const sourceMatch = attrs.match(/\bsrc\s*=\s*['"]([^'"]+)['"]/i);
    const langMatch = attrs.match(/\blang\s*=\s*['"]([^'"]+)['"]/i);
    blocks.push({
      scoped: /(?:^|\s)scoped(?:\s|=|$)/i.test(attrs),
      module: /(?:^|\s)module(?:\s|=|$)/i.test(attrs),
      src: sourceMatch?.[1] || '',
      lang: langMatch?.[1] || 'css',
      content: match[2] || '',
    });
  }
  return blocks;
}

function hasForbiddenGlobalSelector(text) {
  const withoutComments = text.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutComments.split(/\r?\n/).some((line) => {
    const value = line.trim();
    if (!value || value.startsWith('@')) return false;
    return /^(?::global\(\s*)?(?::root\b|html\b|body\b|#app\b|#root\b)/.test(value);
  });
}

function readViteScopedName(projectRoot) {
  for (const name of ['vite.config.ts', 'vite.config.js', 'vite.config.mjs', 'vite.config.cjs']) {
    const file = path.join(projectRoot, name);
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    const match = text.match(/generateScopedName\s*:\s*['"]([^'"]+)['"]/);
    if (match) return match[1];
  }
  return '';
}

function packageSignals(projectRoot) {
  const packageData = readJson(path.join(projectRoot, 'package.json')) || {};
  const dependencies = {
    ...(packageData.dependencies || {}),
    ...(packageData.devDependencies || {}),
    ...(packageData.peerDependencies || {}),
  };
  return {
    utilityCss: Boolean(dependencies.tailwindcss) || ['tailwind.config.js', 'tailwind.config.cjs', 'tailwind.config.mjs', 'tailwind.config.ts'].some((name) => fs.existsSync(path.join(projectRoot, name))),
    cssInJs: CSS_IN_JS_PACKAGES.some((name) => Boolean(dependencies[name])),
  };
}

function inspectStyleContext({ projectRoot, modulesRoot, moduleName = '' }) {
  const absoluteProjectRoot = path.resolve(projectRoot);
  const absoluteModulesRoot = path.resolve(absoluteProjectRoot, modulesRoot || 'src/modules');
  const targetRoot = moduleName ? path.join(absoluteModulesRoot, moduleName) : absoluteModulesRoot;
  const files = fs.existsSync(targetRoot) ? walk(targetRoot) : [];
  const styleFiles = files.filter(isStyleFile);
  const sourceFiles = files.filter((file) => SOURCE_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const imports = [];
  const vueBlocks = [];
  let cssInJsUsage = false;
  let shadowDomUsage = false;

  for (const file of sourceFiles) {
    const text = fs.readFileSync(file, 'utf8');
    for (const item of extractStyleImports(text)) imports.push({ ...item, sourceFile: file });
    if (path.extname(file).toLowerCase() === '.vue') {
      for (const block of extractVueStyleBlocks(text)) vueBlocks.push({ ...block, sourceFile: file });
    }
    if (/from\s+['"](?:styled-components|@emotion\/react|@emotion\/styled|@vanilla-extract\/css|goober)['"]|\b(?:styled|css)\s*`/.test(text)) cssInJsUsage = true;
    if (/attachShadow\s*\(|adoptedStyleSheets|customElements\.define\s*\(|\bshadowRoot\b/.test(text)) shadowDomUsage = true;
  }

  return {
    projectRoot: absoluteProjectRoot,
    modulesRoot: absoluteModulesRoot,
    targetRoot,
    moduleName,
    files,
    styleFiles,
    sourceFiles,
    imports,
    vueBlocks,
    cssModules: styleFiles.filter(isCssModuleFile),
    unscopedStyles: styleFiles.filter((file) => !isCssModuleFile(file)),
    cssInJsUsage,
    shadowDomUsage,
  };
}

function inferFromContext(context, buildTool = '') {
  const signals = packageSignals(context.projectRoot);
  const strategies = [];
  if (context.cssModules.length) strategies.push('css-modules');
  if (context.vueBlocks.some((block) => block.scoped)) strategies.push('vue-scoped');
  if (signals.utilityCss) strategies.push('utility-css');
  if (signals.cssInJs || context.cssInJsUsage) strategies.push('css-in-js');
  if (context.shadowDomUsage) strategies.push('shadow-dom');
  const supportedStrategies = [...new Set(strategies)];
  let strategy = 'project-defined';
  if (supportedStrategies.length === 1) strategy = supportedStrategies[0];
  else if (supportedStrategies.length > 1) strategy = 'hybrid';
  else if (/vite/i.test(buildTool) && !context.styleFiles.length) strategy = 'css-modules-preferred';
  else if (context.unscopedStyles.length || context.vueBlocks.some((block) => !block.scoped && !block.module)) strategy = 'global-local-styles';
  return { strategy, supportedStrategies };
}

export function inferStyleIsolation({ projectRoot, modulesRoot, buildTool = '' }) {
  const context = inspectStyleContext({ projectRoot, modulesRoot });
  const inferred = inferFromContext(context, buildTool);
  const viteScopedName = readViteScopedName(context.projectRoot);
  const strategyForAdapter = inferred.strategy === 'css-modules-preferred' ? 'css-modules' : inferred.strategy;
  return {
    strategy: inferred.strategy,
    adapter: BUILTIN_ADAPTER_BY_STRATEGY[strategyForAdapter] || 'project-defined',
    supported_strategies: inferred.supportedStrategies.join(',') || strategyForAdapter,
    module_file_pattern: STYLE_MODULE_PATTERN,
    scoped_name_pattern: viteScopedName || (/vite/i.test(buildTool) ? 'vite-default-hash' : 'bundler-defined'),
    local_style_fallback: inferred.strategy === 'css-modules' ? 'none' : 'css-modules',
    custom_adapter: 'none',
    generic_index_files: 'forbidden',
    module_global_selectors: 'forbidden',
    module_style_files: context.cssModules.length,
    unscoped_module_style_files: context.unscopedStyles.length,
  };
}

export function resolveStyleIsolationPolicy({ projectRoot, modulesRoot, buildTool = '', styleIsolation = {}, strategy = '', adapter = '', customAdapter = '' }) {
  const scheme = readStyleIsolationScheme(path.resolve(projectRoot));
  const inferred = inferStyleIsolation({ projectRoot, modulesRoot, buildTool });
  const merged = { ...inferred, ...scheme, ...styleIsolation };
  let resolvedStrategy = normalizeStrategy(strategy || valueOf(merged, 'strategy'));
  if (['', 'project-defined', 'css-modules-preferred'].includes(resolvedStrategy)) resolvedStrategy = inferred.strategy === 'css-modules-preferred' ? 'css-modules' : inferred.strategy;
  if (resolvedStrategy === 'global-local-styles') resolvedStrategy = 'css-modules';
  const resolvedAdapter = adapter || valueOf(merged, 'adapter') || BUILTIN_ADAPTER_BY_STRATEGY[resolvedStrategy] || 'project-defined';
  const moduleStyleExtension = resolveModuleStyleExtension({
    projectRoot,
    modulesRoot,
    explicitExtension: valueOf(merged, 'module_style_extension', 'moduleStyleExtension'),
    fallback: DEFAULT_MODULE_STYLE_EXTENSION,
  });
  return {
    strategy: resolvedStrategy || 'css-modules',
    adapter: resolvedAdapter,
    supportedStrategies: splitList(valueOf(merged, 'supported_strategies', 'supportedStrategies')),
    moduleFilePattern: valueOf(merged, 'module_file_pattern', 'moduleFilePattern') || STYLE_MODULE_PATTERN,
    moduleStyleExtension: normalizeModuleStyleExtension(moduleStyleExtension),
    scopedNamePattern: valueOf(merged, 'scoped_name_pattern', 'scopedNamePattern') || 'bundler-defined',
    localStyleFallback: normalizeStrategy(valueOf(merged, 'local_style_fallback', 'localStyleFallback') || (resolvedStrategy === 'css-modules' ? 'none' : 'css-modules')),
    customAdapter: customAdapter || valueOf(merged, 'custom_adapter', 'customAdapter') || '',
    genericIndexFiles: valueOf(merged, 'generic_index_files', 'genericIndexFiles') || 'forbidden',
    moduleGlobalSelectors: valueOf(merged, 'module_global_selectors', 'moduleGlobalSelectors') || 'forbidden',
    globalEntrypoints: splitList(valueOf(merged, 'global_entrypoints', 'globalEntrypoints')),
    ...resolveClassNamingPolicy({
      classNamingMode: valueOf(merged, 'class_naming_mode', 'classNamingMode') || LEGACY_CLASS_NAMING_MODE,
      classNamingPattern: valueOf(merged, 'class_naming_pattern', 'classNamingPattern') || DEFAULT_CLASS_NAMING_PATTERN,
      forbiddenGenericLocals: valueOf(merged, 'forbidden_generic_class_names', 'forbiddenGenericLocals'),
    }),
  };
}

function relativeFile(context, file) {
  return normalize(path.relative(context.projectRoot, file));
}

function resolveImportedFile(sourceFile, specifier) {
  if (!specifier.startsWith('.')) return '';
  return path.resolve(path.dirname(sourceFile), stripStyleQuery(specifier));
}

function createViolationCollector() {
  const violations = [];
  return {
    violations,
    add(level, id, message, file = '') {
      violations.push({ level, id, message, file: normalize(file) });
    },
  };
}

function validateCommon(context, policy, add) {
  for (const file of context.styleFiles) {
    const relative = relativeFile(context, file);
    if (policy.genericIndexFiles !== 'allowed' && GENERIC_STYLE_FILE.test(path.basename(file))) {
      add('error', 'module_style_generic_filename', '模块样式禁止使用 index.css/index.module.css 等泛化文件名；请使用模块名或组件名作为 owner。', relative);
    }
    if (policy.moduleGlobalSelectors !== 'allowed' && hasForbiddenGlobalSelector(fs.readFileSync(file, 'utf8'))) {
      add('error', 'module_style_global_selector', '模块局部样式不得定义 :root、html、body、#app 或 #root；全局主题和壳层样式应进入项目登记的全局入口。', relative);
    }
  }
  if (policy.moduleGlobalSelectors !== 'allowed') {
    for (const block of context.vueBlocks) {
      if (hasForbiddenGlobalSelector(block.content)) {
        add('error', 'module_style_global_selector', 'Vue 模块局部 style 中不得定义 :root、html、body、#app 或 #root。', relativeFile(context, block.sourceFile));
      }
    }
  }
}

function validateCssModuleImports(context, add, { allowScopedSources = new Set(), allowInlineImports = false } = {}) {
  const inlineReferenced = new Set();
  for (const styleImport of context.imports) {
    const imported = resolveImportedFile(styleImport.sourceFile, styleImport.specifier);
    if (!imported || !pathWithin(imported, context.modulesRoot)) continue;
    const sourceRelative = relativeFile(context, styleImport.sourceFile);
    if (isCssModuleFile(styleImport.fileSpecifier)) {
      if (!styleImport.binding) add('error', 'module_style_mapping_missing', `CSS Module ${styleImport.specifier} 必须通过绑定导入并消费类名。`, sourceRelative);
      continue;
    }
    if (allowInlineImports && styleImport.binding && /(?:^|&)(?:inline|raw)(?:&|$)/.test(styleImport.query)) {
      inlineReferenced.add(imported);
      continue;
    }
    if (allowScopedSources.has(imported)) continue;
    add('error', 'module_style_side_effect_import', `模块源码不得副作用导入未隔离样式 ${styleImport.specifier}；请使用当前 strategy 允许的隔离方式。`, sourceRelative);
  }
  return inlineReferenced;
}

function validateCssModules(context, policy, add) {
  for (const file of context.styleFiles) {
    if (!isCssModuleFile(file)) {
      add('error', 'module_style_not_scoped', `模块 ${moduleNameFor(file, context.modulesRoot) || context.moduleName || 'unknown'} 的局部样式必须使用 CSS Modules (*.module.*)。`, relativeFile(context, file));
    }
  }
  validateCssModuleImports(context, add);
}

function scopedVueSources(context, add, { requireAllBlocksScoped = true } = {}) {
  const sources = new Set();
  for (const block of context.vueBlocks) {
    if (requireAllBlocksScoped && !block.scoped && !block.module) {
      add('error', 'vue_style_not_scoped', 'Vue 模块内的 <style> 必须声明 scoped 或 module。', relativeFile(context, block.sourceFile));
    }
    if (block.src && (block.scoped || block.module)) sources.add(path.resolve(path.dirname(block.sourceFile), stripStyleQuery(block.src)));
  }
  return sources;
}

function validateVueScoped(context, policy, add) {
  const scopedSources = scopedVueSources(context, add);
  for (const file of context.styleFiles) {
    if (!isCssModuleFile(file) && !scopedSources.has(file)) {
      add('error', 'vue_scoped_style_unbound', '普通样式文件必须通过 <style scoped src="..."> 引用，或改为 CSS Module。', relativeFile(context, file));
    }
  }
  validateCssModuleImports(context, add, { allowScopedSources: scopedSources });
}

function validateWithCssModuleFallback(context, policy, add, strategyLabel) {
  if (policy.localStyleFallback !== 'css-modules') {
    for (const file of context.styleFiles) add('error', 'strategy_local_style_forbidden', `${strategyLabel} 策略不允许模块内存在独立样式文件。`, relativeFile(context, file));
    validateCssModuleImports(context, add);
    return;
  }
  validateCssModules(context, policy, add);
}

function validateShadowDom(context, policy, add) {
  const inlineReferenced = validateCssModuleImports(context, add, { allowInlineImports: true });
  for (const file of context.styleFiles) {
    if (!isCssModuleFile(file) && !inlineReferenced.has(file)) {
      add('error', 'shadow_style_not_bound', 'Shadow DOM 普通样式必须通过带绑定的 ?inline/?raw 导入，或改为 CSS Module。', relativeFile(context, file));
    }
  }
}

function validateHybrid(context, policy, add) {
  const scopedSources = scopedVueSources(context, add, { requireAllBlocksScoped: true });
  const inlineReferenced = validateCssModuleImports(context, add, { allowScopedSources: scopedSources, allowInlineImports: true });
  for (const file of context.styleFiles) {
    if (!isCssModuleFile(file) && !scopedSources.has(file) && !inlineReferenced.has(file)) {
      add('error', 'hybrid_style_unclaimed', 'hybrid 策略中的样式必须由 CSS Modules、Vue scoped src 或 Shadow DOM ?inline/?raw 明确接管。', relativeFile(context, file));
    }
  }
}

const BUILTIN_ADAPTERS = Object.freeze({
  'builtin-css-modules': validateCssModules,
  'builtin-vue-scoped': validateVueScoped,
  'builtin-utility-css': (context, policy, add) => validateWithCssModuleFallback(context, policy, add, 'utility-css'),
  'builtin-css-in-js': (context, policy, add) => validateWithCssModuleFallback(context, policy, add, 'css-in-js'),
  'builtin-shadow-dom': validateShadowDom,
  'builtin-hybrid': validateHybrid,
});

export function listStyleIsolationAdapters() {
  return Object.keys(BUILTIN_ADAPTERS);
}

function runCustomAdapter(context, policy, add) {
  if (!policy.customAdapter) {
    add('error', 'custom_style_adapter_missing', 'custom 样式策略必须在 project-scheme.yml 中声明 custom_adapter。');
    return;
  }
  const adapterFile = path.resolve(context.projectRoot, policy.customAdapter);
  if (!pathWithin(adapterFile, context.projectRoot)) {
    add('error', 'custom_style_adapter_outside_project', 'custom_adapter 必须位于项目根目录内。', policy.customAdapter);
    return;
  }
  if (!fs.existsSync(adapterFile)) {
    add('error', 'custom_style_adapter_not_found', '找不到 custom_adapter 文件。', policy.customAdapter);
    return;
  }
  if (path.extname(adapterFile).toLowerCase() !== '.cjs') {
    add('error', 'custom_style_adapter_format', '同步 Gate 当前只允许 CommonJS .cjs 自定义适配器。', policy.customAdapter);
    return;
  }
  const require = createRequire(import.meta.url);
  const loaded = require(adapterFile);
  const analyze = loaded.analyzeStyleIsolation || loaded.analyze || loaded.default;
  if (typeof analyze !== 'function') {
    add('error', 'custom_style_adapter_invalid', 'custom_adapter 必须导出 analyze(context) 或 analyzeStyleIsolation(context)。', policy.customAdapter);
    return;
  }
  const result = analyze({
    projectRoot: context.projectRoot,
    modulesRoot: context.modulesRoot,
    targetRoot: context.targetRoot,
    moduleName: context.moduleName,
    files: context.files.map((file) => relativeFile(context, file)),
    styleFiles: context.styleFiles.map((file) => relativeFile(context, file)),
    sourceFiles: context.sourceFiles.map((file) => relativeFile(context, file)),
    policy,
  }) || {};
  for (const violation of result.violations || []) add(violation.level || 'error', violation.id || 'custom_style_violation', violation.message || '自定义样式隔离检查失败。', violation.file || '');
}

export function analyzeStyleIsolation({ projectRoot, modulesRoot, moduleName = '', styleIsolation = {}, strategy = '', adapter = '', customAdapter = '', buildTool = '' }) {
  const context = inspectStyleContext({ projectRoot, modulesRoot, moduleName });
  const policy = resolveStyleIsolationPolicy({ projectRoot, modulesRoot, buildTool, styleIsolation, strategy, adapter, customAdapter });
  const collector = createViolationCollector();

  if (!fs.existsSync(context.targetRoot)) {
    return {
      strategy: 'not-applicable',
      adapter: policy.adapter,
      policy,
      files: [],
      globalDependencies: [],
      usedStrategies: [],
      violations: [],
      summary: { modules: 0, styleFiles: 0, cssModules: 0, unscopedStyles: 0, vueScopedBlocks: 0 },
    };
  }

  validateCommon(context, policy, collector.add);
  if (policy.strategy === 'custom' || policy.adapter === 'custom') runCustomAdapter(context, policy, collector.add);
  else {
    const adapterFn = BUILTIN_ADAPTERS[policy.adapter] || BUILTIN_ADAPTERS[BUILTIN_ADAPTER_BY_STRATEGY[policy.strategy]];
    if (!adapterFn) collector.add('error', 'style_strategy_unsupported', `不支持样式隔离策略 ${policy.strategy} / adapter ${policy.adapter}。`);
    else adapterFn(context, policy, collector.add);
  }

  if (context.cssModules.length && policy.classNamingMode === 'semantic-module-page-feature') {
    const classNamingReport = analyzeClassNaming({
      projectRoot: context.projectRoot,
      modulesRoot: path.relative(context.projectRoot, context.modulesRoot),
      moduleName: context.moduleName,
      policy,
    });
    for (const violation of classNamingReport.violations) collector.violations.push(violation);
  }

  const externalGlobalDependencies = [...new Set(context.imports
    .filter((item) => !item.specifier.startsWith('.'))
    .map((item) => item.specifier))].sort();
  const moduleNames = new Set(context.files.map((file) => moduleNameFor(file, context.modulesRoot)).filter(Boolean));
  const detected = inferFromContext(context, buildTool);
  const usedStrategies = [...new Set([
    ...(policy.strategy === 'hybrid' ? detected.supportedStrategies : [policy.strategy]),
    ...(context.cssModules.length && policy.localStyleFallback === 'css-modules' ? ['css-modules'] : []),
  ].filter((item) => STYLE_ISOLATION_STRATEGIES.includes(item) && item !== 'hybrid'))];

  return {
    strategy: policy.strategy,
    adapter: policy.adapter,
    policy,
    files: context.styleFiles.map((file) => relativeFile(context, file)),
    globalDependencies: externalGlobalDependencies,
    usedStrategies,
    violations: collector.violations,
    summary: {
      modules: moduleNames.size || (moduleName ? 1 : 0),
      styleFiles: context.styleFiles.length,
      cssModules: context.cssModules.length,
      unscopedStyles: context.unscopedStyles.length,
      vueScopedBlocks: context.vueBlocks.filter((block) => block.scoped).length,
      classNamingMode: policy.classNamingMode,
    },
  };
}
