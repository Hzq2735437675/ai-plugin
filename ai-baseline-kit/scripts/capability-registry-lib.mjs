import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const REGISTRY_RELATIVE_PATH = 'capabilities/index.json';
const registryCache = new Map();
const manifestCache = new Map();
const preparedRegistryCache = new WeakMap();
const registryMetadata = new WeakMap();
const manifestMetadata = new WeakMap();
const routeCache = new Map();

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replaceAll(/[，。；、：！？（）【】“”‘’]/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function digest(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function requestText(request) {
  if (request == null) return '';
  if (typeof request === 'string') {
    const possibleFile = path.resolve(request);
    if (request && fs.existsSync(possibleFile) && fs.statSync(possibleFile).isFile()) {
      return fs.readFileSync(possibleFile, 'utf8');
    }
    return request;
  }
  return JSON.stringify(request);
}

function isSafeRelativePath(value) {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0')) return false;
  if (path.isAbsolute(value) || path.win32.isAbsolute(value) || path.posix.isAbsolute(value) || /^[A-Za-z]:/.test(value)) return false;
  const segments = value.replaceAll('\\', '/').split('/');
  return !segments.includes('..') && !segments.every((segment) => segment === '' || segment === '.');
}

function arrayHasDuplicates(values) {
  return Array.isArray(values) && new Set(values).size !== values.length;
}

function triggerMatched(text, normalizedTrigger) {
  if (!normalizedTrigger) return false;
  if (/^[a-z0-9_-]+$/i.test(normalizedTrigger)) {
    const escaped = normalizedTrigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9_-])${escaped}([^a-z0-9_-]|$)`, 'i').test(text);
  }
  return text.includes(normalizedTrigger);
}

function fileState(file) {
  const stat = fs.statSync(file);
  return { key: `${file}:${stat.mtimeMs}:${stat.size}`, size: stat.size };
}

function readCachedJson(file, cache, label) {
  const state = fileState(file);
  const cached = cache.get(file);
  if (cached?.key === state.key) return cached;
  let value;
  try {
    value = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${label}无法解析: ${error.message}`);
  }
  const result = { key: state.key, size: state.size, value };
  cache.set(file, result);
  return result;
}

function prepareRegistry(registry) {
  const cached = preparedRegistryCache.get(registry);
  if (cached) return cached;
  const prepared = registry.capabilities.map((capability) => ({
    ...capability,
    normalizedIntents: capability.intents.map(normalizeText),
    normalizedTriggers: capability.triggers.map((trigger) => ({ raw: trigger, normalized: normalizeText(trigger) })),
  }));
  preparedRegistryCache.set(registry, prepared);
  return prepared;
}

export function validateCapabilityManifest(manifest, { baselineRoot = '', expectedId = '' } = {}) {
  const violations = [];
  const fail = (message) => violations.push(message);
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { valid: false, violations: ['能力 manifest 必须是 JSON 对象。'] };
  }
  if (manifest.schemaVersion !== 1) fail('能力 manifest schemaVersion 必须为 1。');
  if (manifest.kind !== 'ai-baseline-capability-manifest') fail('能力 manifest kind 必须为 ai-baseline-capability-manifest。');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(manifest.id || '')) fail(`能力 manifest id 非法: ${manifest.id || '<empty>'}`);
  if (expectedId && manifest.id !== expectedId) fail(`能力 manifest id 与索引不一致: expected ${expectedId}, received ${manifest.id || '<empty>'}`);
  if (!['lifecycle', 'planning', 'specialized', 'validation'].includes(manifest.loadPhase)) fail(`能力 ${manifest.id || '<empty>'} 的 loadPhase 非法。`);
  for (const field of ['skillFiles', 'contextFiles', 'scripts', 'requires']) {
    if (!Array.isArray(manifest[field])) {
      fail(`能力 ${manifest.id || '<empty>'} 的 ${field} 必须是数组。`);
      continue;
    }
    if (arrayHasDuplicates(manifest[field])) fail(`能力 ${manifest.id || '<empty>'} 的 ${field} 不允许重复项。`);
  }
  for (const field of ['skillFiles', 'contextFiles', 'scripts']) {
    for (const value of manifest[field] || []) {
      if (!isSafeRelativePath(value)) fail(`能力 ${manifest.id || '<empty>'} 的 ${field} 包含不安全路径: ${value}`);
      else if (baselineRoot && !fs.existsSync(path.join(baselineRoot, value))) fail(`能力 ${manifest.id || '<empty>'} 引用文件不存在: ${value}`);
    }
  }
  for (const required of manifest.requires || []) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(required || '')) fail(`能力 ${manifest.id || '<empty>'} 的依赖 id 非法: ${required || '<empty>'}`);
  }
  return { valid: violations.length === 0, violations };
}

export function loadCapabilityManifest(baselineRoot, capabilityEntry) {
  const root = path.resolve(baselineRoot);
  if (!capabilityEntry || !isSafeRelativePath(capabilityEntry.manifest)) throw new Error(`能力 ${capabilityEntry?.id || '<empty>'} 的 manifest 路径无效。`);
  const file = path.join(root, capabilityEntry.manifest);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`能力 manifest 不存在: ${capabilityEntry.manifest}`);
  const loaded = readCachedJson(file, manifestCache, '能力 manifest');
  const validation = validateCapabilityManifest(loaded.value, { baselineRoot: root, expectedId: capabilityEntry.id });
  if (!validation.valid) throw new Error(`能力 manifest 无效 (${capabilityEntry.id}):\n- ${validation.violations.join('\n- ')}`);
  manifestMetadata.set(loaded.value, { file, relativePath: capabilityEntry.manifest, key: loaded.key, size: loaded.size });
  return loaded.value;
}

export function validateCapabilityRegistry(registry, { baselineRoot = '', validateManifests = false } = {}) {
  const violations = [];
  const fail = (message) => violations.push(message);
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) return { valid: false, violations: ['能力注册表必须是 JSON 对象。'] };
  if (registry.schemaVersion !== 2) fail('schemaVersion 必须为 2。');
  if (registry.kind !== 'ai-baseline-capability-registry') fail('kind 必须为 ai-baseline-capability-registry。');
  if (registry.routing?.mode !== 'explicit-progressive') fail('routing.mode 必须为 explicit-progressive。');
  if (registry.routing?.strategy !== 'two-stage-manifest') fail('routing.strategy 必须为 two-stage-manifest。');
  if (!Number.isInteger(registry.routing?.maxPrimaryCapabilities) || registry.routing.maxPrimaryCapabilities < 1 || registry.routing.maxPrimaryCapabilities > 8) fail('routing.maxPrimaryCapabilities 必须是 1-8 的整数。');
  if (!Number.isInteger(registry.routing?.routeCacheSize) || registry.routing.routeCacheSize < 0 || registry.routing.routeCacheSize > 1024) fail('routing.routeCacheSize 必须是 0-1024 的整数。');
  if (!Array.isArray(registry.capabilities) || registry.capabilities.length === 0) fail('capabilities 至少需要登记一项。');

  for (const [label, values] of [['bootstrapContext', registry.bootstrapContext], ['projectContext', registry.projectContext]]) {
    if (!Array.isArray(values)) {
      fail(`${label} 必须是数组。`);
      continue;
    }
    if (arrayHasDuplicates(values)) fail(`${label} 不允许重复项。`);
    for (const value of values) {
      if (!isSafeRelativePath(value)) fail(`${label} 包含不安全路径: ${value}`);
      else if (baselineRoot && label === 'bootstrapContext' && !fs.existsSync(path.join(baselineRoot, value))) fail(`${label} 引用文件不存在: ${value}`);
    }
  }

  const ids = new Set();
  for (const capability of registry.capabilities || []) {
    if (!capability || typeof capability !== 'object' || Array.isArray(capability)) {
      fail('capability 索引项必须是对象。');
      continue;
    }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(capability.id || '')) fail(`能力 id 非法: ${capability.id || '<empty>'}`);
    if (ids.has(capability.id)) fail(`能力 id 重复: ${capability.id}`);
    ids.add(capability.id);
    if (!capability.summary) fail(`能力 ${capability.id || '<empty>'} 缺少 summary。`);
    if (!Number.isInteger(capability.priority)) fail(`能力 ${capability.id || '<empty>'} 的 priority 必须是整数。`);
    for (const field of ['intents', 'triggers']) {
      if (!Array.isArray(capability[field])) fail(`能力 ${capability.id || '<empty>'} 的 ${field} 必须是数组。`);
      else if (arrayHasDuplicates(capability[field])) fail(`能力 ${capability.id || '<empty>'} 的 ${field} 不允许重复项。`);
    }
    if (!isSafeRelativePath(capability.manifest)) fail(`能力 ${capability.id || '<empty>'} 的 manifest 路径不安全: ${capability.manifest}`);
    else if (baselineRoot && !fs.existsSync(path.join(baselineRoot, capability.manifest))) fail(`能力 manifest 不存在: ${capability.manifest}`);
  }

  if (!ids.has(registry.routing?.defaultCapability)) fail(`默认能力未登记: ${registry.routing?.defaultCapability || '<empty>'}`);

  if (baselineRoot && validateManifests && violations.length === 0) {
    const manifests = new Map();
    for (const capability of registry.capabilities) {
      try {
        manifests.set(capability.id, loadCapabilityManifest(baselineRoot, capability));
      } catch (error) {
        fail(error.message);
      }
    }
    for (const [id, manifest] of manifests) {
      for (const required of manifest.requires) if (!ids.has(required)) fail(`能力 ${id} 依赖未登记能力: ${required}`);
    }
    const visiting = new Set();
    const visited = new Set();
    function visit(id, chain = []) {
      if (visiting.has(id)) {
        fail(`能力依赖存在循环: ${[...chain, id].join(' -> ')}`);
        return;
      }
      if (visited.has(id) || !manifests.has(id)) return;
      visiting.add(id);
      for (const required of manifests.get(id).requires) visit(required, [...chain, id]);
      visiting.delete(id);
      visited.add(id);
    }
    for (const id of ids) visit(id);
  }

  return { valid: violations.length === 0, violations };
}

export function loadCapabilityRegistry(baselineRoot) {
  const root = path.resolve(baselineRoot);
  const file = path.join(root, REGISTRY_RELATIVE_PATH);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`能力注册表不存在: ${file}`);
  const loaded = readCachedJson(file, registryCache, '能力注册表');
  const validation = validateCapabilityRegistry(loaded.value, { baselineRoot: root });
  if (!validation.valid) throw new Error(`能力注册表无效:\n- ${validation.violations.join('\n- ')}`);
  registryMetadata.set(loaded.value, { file, key: loaded.key, size: loaded.size, fingerprint: digest(loaded.key).slice(0, 16) });
  return loaded.value;
}

function resolveSelectedCapabilities({ baselineRoot, registry, primary }) {
  const byId = new Map(registry.capabilities.map((item) => [item.id, item]));
  const primaryIds = new Set(primary.map((item) => item.capability.id));
  const selected = [];
  const selectedById = new Map();
  const loadedManifestMeta = new Map();
  const visiting = new Set();

  function visit(id, selection, chain = []) {
    if (visiting.has(id)) throw new Error(`能力依赖存在循环: ${[...chain, id].join(' -> ')}`);
    const existing = selectedById.get(id);
    if (existing) {
      if (primaryIds.has(id)) existing.selection = 'primary';
      return;
    }
    const entry = byId.get(id);
    if (!entry) throw new Error(`能力依赖未登记: ${id}`);
    visiting.add(id);
    const manifest = loadCapabilityManifest(baselineRoot, entry);
    const meta = manifestMetadata.get(manifest);
    loadedManifestMeta.set(id, meta);
    for (const required of manifest.requires) visit(required, `required-by:${id}`, [...chain, id]);
    visiting.delete(id);
    const item = {
      ...entry,
      ...manifest,
      manifest: entry.manifest,
      selection: primaryIds.has(id) ? 'primary' : selection,
    };
    selectedById.set(id, item);
    selected.push(item);
  }

  for (const item of primary) visit(item.capability.id, item.reason);
  return { selected, loadedManifestMeta };
}

function projectContextState(projectRoot, relativePaths) {
  const resolvedRoot = projectRoot ? path.resolve(projectRoot) : '';
  const files = relativePaths.map((relativePath) => {
    const absolutePath = resolvedRoot ? path.join(resolvedRoot, relativePath) : '';
    const exists = Boolean(absolutePath && fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile());
    const stat = exists ? fs.statSync(absolutePath) : null;
    return {
      path: relativePath,
      exists,
      signature: exists ? `${relativePath}:${stat.mtimeMs}:${stat.size}` : `${relativePath}:missing`,
    };
  });
  return { files, signature: files.map((item) => item.signature).join('|') };
}

function buildLoadPlan({ registry, selected, primaryIds, projectFiles }) {
  const stageOrder = ['bootstrap', 'dependencies', 'primary', 'project'];
  const stages = new Map(stageOrder.map((id) => [id, { id, files: [] }]));
  const baselineFileMap = new Map();

  function addBaseline(stageId, relativePath, kind, capabilityId = '') {
    const existing = baselineFileMap.get(relativePath);
    const reason = capabilityId || 'registry-bootstrap';
    if (existing) {
      existing.reasons = unique([...existing.reasons, reason]);
      return;
    }
    const file = { path: relativePath, scope: 'baseline', kind, exists: true, reasons: [reason] };
    baselineFileMap.set(relativePath, file);
    stages.get(stageId).files.push(file);
  }

  for (const relativePath of registry.bootstrapContext) addBaseline('bootstrap', relativePath, 'bootstrap-context');
  for (const capability of selected) {
    const stageId = primaryIds.has(capability.id) ? 'primary' : 'dependencies';
    for (const relativePath of capability.skillFiles) addBaseline(stageId, relativePath, 'skill', capability.id);
    for (const relativePath of capability.contextFiles) addBaseline(stageId, relativePath, 'context', capability.id);
  }
  for (const item of projectFiles) {
    stages.get('project').files.push({
      path: item.path,
      scope: 'project',
      kind: 'project-context',
      exists: item.exists,
      reasons: ['project-state'],
    });
  }

  return {
    stages: stageOrder.map((id) => stages.get(id)).filter((stage) => stage.files.length > 0),
    baselineFiles: [...baselineFileMap.keys()],
  };
}

function routeDiagnostics(primary, scored) {
  const fallback = primary.every((item) => item.reason === 'default');
  const top = scored[0];
  const second = scored[1];
  const scoreGap = top ? top.score - (second?.score || 0) : 0;
  const hasIntent = primary.some((item) => item.intentMatch);
  const triggerCount = primary.reduce((count, item) => count + item.matchedTriggers.length, 0);
  const confidence = fallback ? 'low' : hasIntent || triggerCount >= 2 || scoreGap >= 200 ? 'high' : 'medium';
  return {
    confidence,
    fallback,
    ambiguous: Boolean(top && second && scoreGap < 100 && !hasIntent),
    scoreGap,
    matchedPrimaryCount: primary.length,
  };
}

function cacheRoute(key, route, limit) {
  if (limit <= 0) return;
  routeCache.delete(key);
  routeCache.set(key, route);
  while (routeCache.size > limit) routeCache.delete(routeCache.keys().next().value);
}

export function clearCapabilityCaches() {
  registryCache.clear();
  manifestCache.clear();
  routeCache.clear();
}

export function resolveCapabilityRoute({ baselineRoot, projectRoot = '', request = '', intent = '' }) {
  const registry = loadCapabilityRegistry(baselineRoot);
  const registryMeta = registryMetadata.get(registry);
  const text = normalizeText(requestText(request));
  const normalizedIntent = normalizeText(intent);
  const scored = prepareRegistry(registry).map((capability) => {
    const intentMatch = Boolean(normalizedIntent && capability.normalizedIntents.includes(normalizedIntent));
    const matchedTriggers = capability.normalizedTriggers
      .filter((trigger) => triggerMatched(text, trigger.normalized))
      .map((trigger) => trigger.raw);
    return {
      capability,
      score: (intentMatch ? 10000 : 0) + matchedTriggers.length * 100 + capability.priority,
      intentMatch,
      matchedTriggers,
    };
  }).filter((item) => item.intentMatch || item.matchedTriggers.length > 0)
    .sort((left, right) => right.score - left.score || left.capability.id.localeCompare(right.capability.id));

  const fallbackCapability = registry.capabilities.find((item) => item.id === registry.routing.defaultCapability);
  const maxPrimary = registry.routing.maxPrimaryCapabilities;
  const primary = (scored.length ? scored.slice(0, maxPrimary) : [{
    capability: fallbackCapability,
    score: 0,
    intentMatch: false,
    matchedTriggers: [],
  }]).map((item) => ({
    ...item,
    reason: item.intentMatch
      ? `intent:${normalizedIntent}`
      : item.matchedTriggers.length
        ? `trigger:${item.matchedTriggers.join(',')}`
        : 'default',
  }));

  const { selected, loadedManifestMeta } = resolveSelectedCapabilities({ baselineRoot, registry, primary });
  const projectState = projectContextState(projectRoot, registry.projectContext);
  const manifestSignature = [...loadedManifestMeta.entries()].map(([id, meta]) => `${id}:${meta.key}`).join('|');
  const routeKey = digest([registryMeta.key, manifestSignature, projectState.signature, normalizedIntent, text].join('\n'));
  const cached = routeCache.get(routeKey);
  if (cached) {
    routeCache.delete(routeKey);
    routeCache.set(routeKey, cached);
    const result = structuredClone(cached);
    result.performance.routeCacheHit = true;
    return result;
  }

  const primaryIds = new Set(primary.map((item) => item.capability.id));
  const loadPlan = buildLoadPlan({ registry, selected, primaryIds, projectFiles: projectState.files });
  const scripts = unique(selected.flatMap((item) => item.scripts));
  const selectedSkillFiles = unique(selected.flatMap((item) => item.skillFiles));
  const loadedManifestBytes = [...loadedManifestMeta.values()].reduce((total, meta) => total + meta.size, 0);
  const route = {
    schemaVersion: 2,
    kind: 'ai-baseline-capability-route',
    routingMode: registry.routing.mode,
    routingStrategy: registry.routing.strategy,
    requestIntent: normalizedIntent,
    registry: {
      schemaVersion: registry.schemaVersion,
      fingerprint: digest(`${registryMeta.key}|${manifestSignature}`).slice(0, 16),
    },
    primaryCapabilities: primary.map((item) => ({
      id: item.capability.id,
      score: item.score,
      reason: item.reason,
      matchedTriggers: item.matchedTriggers,
    })),
    capabilities: selected.map((item) => ({
      id: item.id,
      summary: item.summary,
      selection: item.selection,
      loadPhase: item.loadPhase,
      manifest: item.manifest,
    })),
    load: {
      stages: loadPlan.stages,
      baselineFiles: loadPlan.baselineFiles,
      projectFiles: projectState.files.map(({ path: relativePath, exists }) => ({ path: relativePath, exists })),
      manifests: selected.map((item) => item.manifest),
      scripts,
    },
    diagnostics: routeDiagnostics(primary, scored),
    performance: {
      registeredCapabilityCount: registry.capabilities.length,
      selectedCapabilityCount: selected.length,
      loadedManifestCount: loadedManifestMeta.size,
      loadedManifestBytes,
      registryIndexBytes: registryMeta.size,
      selectedSkillFileCount: selectedSkillFiles.length,
      selectedBaselineFileCount: loadPlan.baselineFiles.length,
      manifestLoadRatio: Number((loadedManifestMeta.size / registry.capabilities.length).toFixed(4)),
      routeCacheHit: false,
      routeCacheLimit: registry.routing.routeCacheSize,
      progressive: true,
    },
  };

  cacheRoute(routeKey, route, registry.routing.routeCacheSize);
  return structuredClone(route);
}
