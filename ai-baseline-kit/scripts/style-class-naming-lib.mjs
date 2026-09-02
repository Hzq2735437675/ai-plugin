import fs from 'node:fs';
import path from 'node:path';

export const CLASS_NAMING_MODES = Object.freeze(['owner-local', 'semantic-module-page-feature']);
export const DEFAULT_CLASS_NAMING_MODE = 'semantic-module-page-feature';
export const LEGACY_CLASS_NAMING_MODE = 'owner-local';
export const DEFAULT_CLASS_NAMING_PATTERN = 'm_[name]_[local]__[hash:base64:6]';
export const DEFAULT_FORBIDDEN_GENERIC_LOCALS = Object.freeze([
  'page',
  'root',
  'content',
  'container',
  'wrapper',
  'header',
  'footer',
  'section',
]);

const STYLE_EXTENSIONS = ['css', 'scss', 'sass', 'less', 'styl', 'stylus'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.vue', '.mjs', '.cjs']);
const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.nuxt',
  'coverage',
  'ai-baseline-kit',
  '.ai-frontend-assembler',
]);
const CSS_MODULE_PATTERN = new RegExp(`\\.module\\.(?:${STYLE_EXTENSIONS.join('|')})$`, 'i');

function normalize(value) {
  return String(value ?? '').replace(/\\/g, '/');
}

function walk(directory, files = []) {
  if (!directory || !fs.existsSync(directory)) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target, files);
    else files.push(target);
  }
  return files;
}

function pathWithin(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function stripStyleQuery(value) {
  return String(value || '').split('?')[0];
}

function isCssModuleFile(file) {
  return CSS_MODULE_PATTERN.test(stripStyleQuery(file));
}

function moduleNameFor(file, modulesRoot) {
  if (!pathWithin(file, modulesRoot)) return '';
  return normalize(path.relative(modulesRoot, file)).split('/')[0] || '';
}

function styleOwnerFor(file) {
  return path.basename(file).replace(CSS_MODULE_PATTERN, '');
}

function kebab(value) {
  return String(value ?? '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function camel(value) {
  return kebab(value)
    .split('-')
    .filter(Boolean)
    .map((part, index) => index === 0 ? part : `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('');
}

function uniqueTokens(tokens) {
  const seen = new Set();
  return tokens.filter(Boolean).filter((token) => {
    if (seen.has(token)) return false;
    seen.add(token);
    return true;
  });
}

function pageIdForSource(file, modulesRoot) {
  const relative = normalize(path.relative(modulesRoot, file));
  const match = relative.match(/^[^/]+\/pages\/([^/]+)/i);
  return match?.[1] || '';
}

function extractStyleImports(text) {
  const imports = [];
  const extensionPattern = STYLE_EXTENSIONS.join('|');
  const pattern = new RegExp(`import\\s+(?:(.*?)\\s+from\\s+)?['"]([^'"]+\\.(?:${extensionPattern})(?:\\?[^'"]+)?)['"]\\s*;?`, 'g');
  for (const match of text.matchAll(pattern)) {
    imports.push({ binding: (match[1] || '').trim(), specifier: match[2] });
  }
  return imports;
}

function resolveImportedFile(sourceFile, specifier) {
  if (!specifier.startsWith('.')) return '';
  const base = path.resolve(path.dirname(sourceFile), stripStyleQuery(specifier));
  const candidates = [
    base,
    ...STYLE_EXTENSIONS.map((extension) => `${base}.${extension}`),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}

function extractClassNames(text) {
  const withoutComments = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const withoutGlobal = withoutComments.replace(/:global\((?:[^()]|\([^()]*\))*\)/g, '');
  return [...new Set([...withoutGlobal.matchAll(/\.([A-Za-z_][A-Za-z0-9_-]*)/g)].map((match) => match[1]))];
}

function parseList(value, fallback) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  const parsed = String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
  return parsed.length ? parsed : [...fallback];
}

export function normalizeClassNamingMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  if (mode === 'semantic' || mode === 'semantic-module-page' || mode === 'semantic-module-page-feature') {
    return 'semantic-module-page-feature';
  }
  if (mode === 'legacy' || mode === 'owner' || mode === 'owner-local') return 'owner-local';
  return mode || LEGACY_CLASS_NAMING_MODE;
}

export function resolveClassNamingPolicy(source = {}) {
  const mode = normalizeClassNamingMode(source.classNamingMode || source.class_naming_mode || source.mode);
  const resolved = {
    mode: CLASS_NAMING_MODES.includes(mode) ? mode : LEGACY_CLASS_NAMING_MODE,
    pattern: source.classNamingPattern || source.class_naming_pattern || DEFAULT_CLASS_NAMING_PATTERN,
    forbiddenGenericLocals: parseList(
      source.forbiddenGenericLocals || source.forbidden_generic_class_names,
      DEFAULT_FORBIDDEN_GENERIC_LOCALS,
    ),
  };
  return {
    ...resolved,
    classNamingMode: resolved.mode,
    classNamingPattern: resolved.pattern,
  };
}

export function createPageStyleNaming({ moduleId, pageId, featureId = '', role = '' }) {
  const moduleToken = kebab(moduleId);
  const pageToken = kebab(pageId);
  const featureToken = kebab(featureId || pageId || moduleId);
  const roleToken = kebab(role);
  const owner = [moduleToken, pageToken].filter(Boolean).join('-');
  const local = camel(uniqueTokens([moduleToken, pageToken, featureToken, roleToken]).join('-'));
  return {
    owner,
    fileName: `${owner}.module.css`,
    local,
    module: moduleToken,
    page: pageToken,
    feature: featureToken,
    role: roleToken,
    key: `${owner}.${local}`,
  };
}

export function createPageStyleContract({ moduleId, pageId, featureId = '' }) {
  return {
    page: createPageStyleNaming({ moduleId, pageId, featureId, role: 'page' }),
    header: createPageStyleNaming({ moduleId, pageId, featureId, role: 'header' }),
    content: createPageStyleNaming({ moduleId, pageId, featureId, role: 'content' }),
  };
}

export function analyzeClassNaming({ projectRoot, modulesRoot = 'src/modules', moduleName = '', policy = {}, mode = '' }) {
  const absoluteProjectRoot = path.resolve(projectRoot);
  const absoluteModulesRoot = path.resolve(absoluteProjectRoot, modulesRoot);
  const targetRoot = moduleName ? path.join(absoluteModulesRoot, moduleName) : absoluteModulesRoot;
  const resolvedPolicy = resolveClassNamingPolicy({ ...policy, mode: mode || policy.mode });
  const files = walk(targetRoot).filter(isCssModuleFile);
  const sourceFiles = walk(targetRoot).filter((file) => SOURCE_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const usages = new Map();
  const violations = [];
  const add = (level, id, message, file = '') => violations.push({
    level,
    id,
    message,
    file: normalize(path.relative(absoluteProjectRoot, file || targetRoot)),
  });

  if (resolvedPolicy.mode !== 'semantic-module-page-feature') {
    return {
      ...resolvedPolicy,
      files: files.map((file) => normalize(path.relative(absoluteProjectRoot, file))),
      usages: [],
      violations,
      summary: { styleFiles: files.length, pageStyleFiles: 0, classes: 0, owners: files.length },
    };
  }

  for (const sourceFile of sourceFiles) {
    const pageId = pageIdForSource(sourceFile, absoluteModulesRoot);
    for (const styleImport of extractStyleImports(fs.readFileSync(sourceFile, 'utf8'))) {
      if (!styleImport.binding) continue;
      const imported = resolveImportedFile(sourceFile, styleImport.specifier);
      if (!imported || !isCssModuleFile(imported)) continue;
      const entry = usages.get(imported) || { pages: new Set(), sources: [] };
      if (pageId) entry.pages.add(pageId);
      entry.sources.push(sourceFile);
      usages.set(imported, entry);
    }
  }

  const ownerFiles = new Map();
  let classCount = 0;
  for (const file of files) {
    const relative = normalize(path.relative(absoluteProjectRoot, file));
    const moduleId = moduleNameFor(file, absoluteModulesRoot);
    const owner = styleOwnerFor(file);
    const ownerKey = owner.toLowerCase();
    if (ownerFiles.has(ownerKey)) {
      add('error', 'style_owner_duplicate', `CSS Module owner “${owner}” 在多个样式文件中重复；owner 必须包含模块和页面语义以保证跨页面唯一。`, file);
    } else {
      ownerFiles.set(ownerKey, file);
    }

    const usage = usages.get(file);
    for (const pageId of usage?.pages || []) {
      if (!owner.toLowerCase().includes(kebab(moduleId))) {
        add('error', 'style_owner_missing_module', `页面 ${pageId} 使用的 CSS Module owner “${owner}” 未包含模块语义；请使用 ${moduleId}-${pageId}.module.css。`, file);
      }
      if (!owner.toLowerCase().includes(kebab(pageId))) {
        add('error', 'style_owner_missing_page', `页面 ${pageId} 使用的 CSS Module owner “${owner}” 未包含页面语义；请使用 ${moduleId}-${pageId}.module.css。`, file);
      }
    }

    const locals = extractClassNames(fs.readFileSync(file, 'utf8'));
    classCount += locals.length;
    for (const local of locals) {
      if (resolvedPolicy.forbiddenGenericLocals.includes(local.toLowerCase())) {
        add('error', 'style_class_generic_name', `CSS Module 类名 “.${local}” 过于泛化；请使用模块、页面、功能或组件角色语义命名。`, file);
      }
      if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(local)) {
        add('error', 'style_class_invalid_name', `CSS Module 类名 “.${local}” 不符合稳定命名规则。`, file);
      }
    }

    if (usage?.pages?.size > 1) {
      add('error', 'style_owner_shared_by_pages', `同一 CSS Module owner “${owner}” 被多个页面共享；页面级样式应拆分为各自的 owner 文件。`, file);
    }

    if (owner.toLowerCase() === kebab(moduleId).toLowerCase() && usage?.pages?.size) {
      add('error', 'style_owner_module_only', `页面样式 owner “${owner}” 只有模块名，缺少页面语义；请拆分为模块-页面 owner。`, file);
    }

    if (relative.includes('/styles/') && !owner) {
      add('error', 'style_owner_missing', 'CSS Module 必须具有可追踪的 owner 文件名。', file);
    }
  }

  return {
    ...resolvedPolicy,
    files: files.map((file) => normalize(path.relative(absoluteProjectRoot, file))),
    usages: [...usages.entries()].map(([file, usage]) => ({
      file: normalize(path.relative(absoluteProjectRoot, file)),
      pages: [...usage.pages].sort(),
      sources: usage.sources.map((source) => normalize(path.relative(absoluteProjectRoot, source))).sort(),
    })),
    violations,
    summary: {
      styleFiles: files.length,
      pageStyleFiles: [...usages.values()].filter((usage) => usage.pages.size).length,
      classes: classCount,
      owners: ownerFiles.size,
    },
  };
}
