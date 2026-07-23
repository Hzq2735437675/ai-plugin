import fs from 'node:fs';
import path from 'node:path';
import { analyzeProject } from './project-tools-lib.mjs';
import { normalizePath, readJson, unique } from './feature-tools-lib.mjs';

const SEARCHABLE_EXTENSIONS = new Set(['.md', '.json', '.ts', '.tsx', '.js', '.jsx', '.vue']);
const REQUIRED_MODULE_PATHS = ['module.meta.json', 'index.ts', 'manifest.ts', 'acceptance.md', 'tests'];
const MAX_SEARCH_FILE_BYTES = 256 * 1024;

function walk(directory, files = []) {
  if (!fs.existsSync(directory)) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'build', 'coverage', '.git'].includes(entry.name)) continue;
      walk(target, files);
    } else {
      files.push(target);
    }
  }
  return files;
}

function firstMarkdownHeading(file) {
  if (!fs.existsSync(file)) return '';
  const match = fs.readFileSync(file, 'utf8').match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || '';
}

function searchableText(moduleRoot, metadata) {
  const chunks = [
    metadata.name,
    metadata.title,
    metadata.displayName,
    metadata.domain,
    metadata.archetype,
    ...(metadata.aliases ?? []),
    ...(metadata.capabilities ?? []),
    ...(metadata.permissions ?? []),
    firstMarkdownHeading(path.join(moduleRoot, 'acceptance.md')),
  ];
  for (const file of walk(moduleRoot)) {
    if (!SEARCHABLE_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
    if (fs.statSync(file).size > MAX_SEARCH_FILE_BYTES) continue;
    chunks.push(fs.readFileSync(file, 'utf8'));
  }
  return chunks.filter(Boolean).join('\n').toLowerCase();
}

function normalizeQuery(value) {
  return String(value || '').toLowerCase().replaceAll('：', ':').replaceAll(/[，。；、|]/g, ' ');
}

function queryTerms(query) {
  const normalized = normalizeQuery(query);
  const base = normalized.split(/[\s,;()[\]{}<>"']+/).map((item) => item.trim()).filter((item) => item.length >= 2);
  const phrases = [...normalized.matchAll(/[\u3400-\u9fff]{2,12}/g)].map((match) => match[0]);
  return unique([...base, ...phrases]).sort((left, right) => right.length - left.length);
}

function aliasesFor(metadata, title) {
  const capabilityDomains = (metadata.capabilities ?? []).map((item) => String(item).split(':')[0]);
  return unique([
    metadata.name,
    metadata.title,
    metadata.displayName,
    metadata.domain,
    title,
    ...(metadata.aliases ?? []),
    ...capabilityDomains,
  ].filter((item) => String(item || '').trim().length >= 2).map((item) => String(item).toLowerCase()));
}

function matchModule(query, searchText, aliases) {
  const normalized = normalizeQuery(query);
  const matchedAliases = aliases.filter((alias) => normalized.includes(alias));
  const matchedTerms = queryTerms(query).filter((term) => searchText.includes(term));
  let score = 0;
  for (const alias of matchedAliases) score += alias.includes('-') || /^[a-z0-9:]+$/i.test(alias) ? 100 : 80;
  for (const term of matchedTerms.slice(0, 8)) score += Math.min(30, term.length * 3);
  return { score, matchedAliases, matchedTerms: matchedTerms.slice(0, 12) };
}

function discoverRoutes(moduleRoot) {
  const routes = [];
  for (const file of walk(moduleRoot)) {
    if (!/routes?\.(?:[cm]?[jt]sx?)$/i.test(path.basename(file))) continue;
    if (fs.statSync(file).size > MAX_SEARCH_FILE_BYTES) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\bpath\s*:\s*[\"']([^\"']+)[\"']/g)) routes.push(match[1]);
  }
  return unique(routes);
}

function moduleReadiness(moduleRoot, metadata) {
  const blockers = [];
  const warnings = [];
  for (const item of REQUIRED_MODULE_PATHS) {
    if (!fs.existsSync(path.join(moduleRoot, item))) blockers.push({ code: 'module-file-missing', path: item, message: `模块缺少 ${item}` });
  }
  if (!metadata) blockers.push({ code: 'module-meta-invalid', message: 'module.meta.json 不存在或无法解析。' });
  if (metadata?.dependencies?.modules?.length) blockers.push({ code: 'cross-module-contract', modules: metadata.dependencies.modules, message: '模块声明了其他业务模块依赖，不可直接组合。' });
  if (metadata?.portability?.sameStackOnly === undefined) warnings.push({ code: 'portability-policy-missing', message: '模块未显式声明 sameStackOnly。' });
  return { ready: blockers.length === 0, blockers, warnings };
}

export function discoverProjectModules({ projectRoot, query = '' }) {
  const absoluteProjectRoot = path.resolve(projectRoot);
  const project = analyzeProject(absoluteProjectRoot);
  const modulesRoot = project.layers.modules_root;
  const absoluteModulesRoot = modulesRoot && modulesRoot !== 'unknown' ? path.join(absoluteProjectRoot, modulesRoot) : '';
  const modules = [];

  if (absoluteModulesRoot && fs.existsSync(absoluteModulesRoot)) {
    for (const entry of fs.readdirSync(absoluteModulesRoot, { withFileTypes: true }).filter((item) => item.isDirectory())) {
      const moduleRoot = path.join(absoluteModulesRoot, entry.name);
      const metadataFile = path.join(moduleRoot, 'module.meta.json');
      let metadata = null;
      try {
        metadata = fs.existsSync(metadataFile) ? readJson(metadataFile) : null;
      } catch {
        metadata = null;
      }
      const title = firstMarkdownHeading(path.join(moduleRoot, 'acceptance.md')).replace(/\s+Acceptance$/i, '');
      const searchText = searchableText(moduleRoot, metadata ?? { name: entry.name });
      const aliases = aliasesFor(metadata ?? { name: entry.name }, title);
      const match = query ? matchModule(query, searchText, aliases) : { score: 0, matchedAliases: [], matchedTerms: [] };
      const readiness = moduleReadiness(moduleRoot, metadata);
      modules.push({
        name: metadata?.name || entry.name,
        directory: entry.name,
        title: metadata?.title || metadata?.displayName || title || entry.name,
        domain: metadata?.domain || 'unknown',
        version: metadata?.version || 'unknown',
        archetype: metadata?.archetype || 'unknown',
        capabilities: metadata?.capabilities ?? [],
        permissions: metadata?.permissions ?? [],
        routes: discoverRoutes(moduleRoot),
        aliases,
        path: normalizePath(path.relative(absoluteProjectRoot, moduleRoot)),
        readiness,
        match,
      });
    }
  }

  modules.sort((left, right) => query ? right.match.score - left.match.score || left.name.localeCompare(right.name) : left.name.localeCompare(right.name));
  return {
    schemaVersion: 1,
    kind: 'ai-baseline-module-discovery-report',
    generatedAt: new Date().toISOString(),
    projectRoot: absoluteProjectRoot,
    project: {
      name: project.package.name,
      version: project.package.version,
      profile: project.profile,
      framework: project.stack.framework,
      uiLibrary: project.stack.ui_library,
      language: project.stack.language,
      buildTool: project.stack.build_tool,
    },
    roots: { modules: modulesRoot, shared: project.layers.shared_root },
    query,
    modules,
    summary: {
      total: modules.length,
      ready: modules.filter((item) => item.readiness.ready).length,
      matched: modules.filter((item) => item.match.score > 0).length,
    },
  };
}

export function selectModulesFromDiscovery(report, query, { minimumScore = 80, ambiguityDelta = 20 } = {}) {
  const candidates = report.modules.filter((item) => item.readiness.ready && item.match.score >= minimumScore);
  if (!candidates.length) {
    return {
      selected: [],
      ambiguous: [],
      questions: [{
        id: `confirm-${path.basename(report.projectRoot)}-modules`,
        field: 'selections',
        question: `未能从需求中可靠识别项目 ${report.project.name || path.basename(report.projectRoot)} 的目标模块，请明确模块名。`,
        reason: '模块自动发现没有达到安全置信度阈值。',
        blocking: true,
      }],
    };
  }

  const selected = [];
  const ambiguous = [];
  for (const candidate of candidates) {
    const aliasMatched = candidate.match.matchedAliases.length > 0;
    if (aliasMatched) selected.push(candidate.name);
  }
  if (!selected.length) {
    const top = candidates[0];
    const second = candidates[1];
    if (second && top.match.score - second.match.score < ambiguityDelta) ambiguous.push(top.name, second.name);
    else selected.push(top.name);
  }

  const questions = ambiguous.length ? [{
    id: `confirm-${path.basename(report.projectRoot)}-module-match`,
    field: 'selections',
    question: `项目 ${report.project.name || path.basename(report.projectRoot)} 中存在多个相近模块候选：${unique(ambiguous).join('、')}，请确认需要抽离的模块。`,
    reason: `需求“${query}”对应多个相近候选。`,
    blocking: true,
  }] : [];
  return { selected: unique(selected), ambiguous: unique(ambiguous), questions };
}
