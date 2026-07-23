import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { discoverProjectModules, selectModulesFromDiscovery } from './module-discovery-lib.mjs';
import { exportModuleBundle, readModuleBundle, validateBundleSet } from './module-portability-lib.mjs';
import { repairModuleBundle } from './module-bundle-repair-lib.mjs';
import { beginCompositionTransaction, commitCompositionTransaction, failCompositionTransaction, loadCompositionTransaction, recordTransactionEvent, rollbackCompositionTransaction } from './composition-transaction-lib.mjs';
import { readJson, writeJson, unique } from './feature-tools-lib.mjs';

const DEFAULT_POLICIES = {
  moduleNameConflict: 'prefix-source',
  routeConflict: 'prefix-module',
  permissionConflict: 'prefix-module',
  sharedConflict: 'ask',
  dependencyConflict: 'ask',
  rollbackOnFailure: true,
  validate: true,
  e2e: false,
};

function now() { return new Date().toISOString(); }
function safeId(value) { return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'source'; }
function splitSources(value) {
  return String(value || '').split(';').map((item) => item.trim()).filter(Boolean).map((item, index) => {
    const equals = item.indexOf('=');
    return equals > 0 ? { id: safeId(item.slice(0, equals)), projectRoot: path.resolve(item.slice(equals + 1)) } : { id: `source-${index + 1}`, projectRoot: path.resolve(item) };
  });
}
function requestTextFromFile(file) {
  if (!file) return '';
  const absolute = path.resolve(file);
  if (!fs.existsSync(absolute)) throw new Error(`需求文件不存在: ${absolute}`);
  if (path.extname(absolute).toLowerCase() === '.json') return readJson(absolute);
  return fs.readFileSync(absolute, 'utf8');
}
function normalizeRequest({ request, sources, target, stack, policies = {} }) {
  const loaded = typeof request === 'string' && fs.existsSync(path.resolve(request)) ? requestTextFromFile(request) : request;
  const object = loaded && typeof loaded === 'object' ? loaded : {};
  const text = typeof loaded === 'string' ? loaded : object.request?.text || object.text || '';
  const sourceList = object.sources?.length ? object.sources : Array.isArray(sources) ? sources : splitSources(sources);
  const targetRoot = object.target?.projectRoot || target;
  if (!sourceList.length) throw new Error('必须提供至少一个来源项目：--sources "a=<path>;b=<path>"。');
  if (!targetRoot) throw new Error('必须通过 --target 指定目标项目。');
  return {
    schemaVersion: 1,
    kind: 'ai-baseline-composition-request',
    status: object.status || 'ready',
    request: { text },
    sources: sourceList.map((item, index) => ({ id: safeId(item.id || `source-${index + 1}`), projectRoot: path.resolve(item.projectRoot) })),
    target: { projectRoot: path.resolve(targetRoot), stack: object.target?.stack || stack || '' },
    selections: object.selections || [],
    policies: { ...DEFAULT_POLICIES, ...(object.policies || {}), ...policies },
    requiredQuestions: object.requiredQuestions || [],
  };
}
function question(id, field, text, reason) { return { id, field, question: text, reason, blocking: true }; }
function explicitModules(request, sourceId) { return request.selections.find((item) => item.source === sourceId)?.modules || []; }
function writeRun(stateFile, state) { state.updatedAt = now(); writeJson(stateFile, state); }
function runNode(script, args, cwd) {
  const activeCwd = fs.existsSync(cwd) ? cwd : path.dirname(cwd);
  const result = spawnSync(process.execPath, [script, ...args], { cwd: activeCwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${path.basename(script)} 执行失败:\n${result.error?.message || result.stderr || result.stdout || 'unknown error'}`);
  return result;
}
function conflictGroups(bundles, field) {
  const map = new Map();
  for (const bundle of bundles) for (const value of field(bundle.manifest) || []) {
    const items = map.get(value) || []; items.push(bundle); map.set(value, items);
  }
  return [...map.entries()].filter(([, items]) => items.length > 1);
}
function repairBundle(bundle, options, workspace) {
  const output = path.join(workspace, 'repaired', `${bundle.sourceId}-${safeId(options.rename || bundle.manifest.module.name)}-${Date.now()}`);
  return { ...bundle, ...repairModuleBundle({ bundlePath: bundle.path, output, force: true, ...options }), path: output };
}
function applySafeRepairs(inputBundles, policies, workspace, questions) {
  let bundles = [...inputBundles];
  const duplicates = new Map();
  for (const bundle of bundles) {
    const list = duplicates.get(bundle.manifest.module.name) || []; list.push(bundle); duplicates.set(bundle.manifest.module.name, list);
  }
  for (const [name, items] of duplicates) {
    if (items.length < 2) continue;
    if (policies.moduleNameConflict !== 'prefix-source') {
      questions.push(question(`module-name-${name}`, 'policies.moduleNameConflict', `模块名 ${name} 在多个来源中重复，请确认重命名策略。`, '同名模块不能静默覆盖。'));
      continue;
    }
    for (const item of items) {
      const renamed = repairBundle(item, { rename: `${item.sourceId}-${name}` }, workspace);
      bundles = bundles.map((bundle) => bundle === item ? renamed : bundle);
    }
  }
  for (const [route, items] of conflictGroups(bundles, (manifest) => manifest.contracts.routes)) {
    if (policies.routeConflict !== 'prefix-module') {
      questions.push(question(`route-${safeId(route)}`, 'policies.routeConflict', `路由 ${route} 在多个模块中冲突，请确认路由前缀。`, '路由冲突会造成装配覆盖。'));
      continue;
    }
    for (const item of items) {
      const repaired = repairBundle(item, { routePrefix: `/${item.manifest.module.name}` }, workspace);
      bundles = bundles.map((bundle) => bundle === item ? repaired : bundle);
    }
  }
  for (const [permission, items] of conflictGroups(bundles, (manifest) => manifest.contracts.permissions)) {
    if (policies.permissionConflict !== 'prefix-module') {
      questions.push(question(`permission-${safeId(permission)}`, 'policies.permissionConflict', `权限 ${permission} 在多个模块中冲突，请确认命名空间。`, '权限冲突可能造成越权或错误授权。'));
      continue;
    }
    for (const item of items) {
      const repaired = repairBundle(item, { permissionPrefix: item.manifest.module.name }, workspace);
      bundles = bundles.map((bundle) => bundle === item ? repaired : bundle);
    }
  }
  return bundles;
}

export function loadCompositionInput(options) { return normalizeRequest(options); }

export function rollbackCompositionRun(runFileOrWorkspace) {
  const candidate = path.resolve(runFileOrWorkspace);
  const stateFile = fs.statSync(candidate).isDirectory() ? path.join(candidate, 'composition-run.json') : candidate;
  const state = readJson(stateFile);
  if (!state.transactionRoot) throw new Error('该组合运行尚未创建事务，无法回滚。');
  const transaction = rollbackCompositionTransaction(state.transactionRoot, { runId: state.id, manual: true });
  state.status = 'rolled-back'; state.transaction = transaction; writeRun(stateFile, state);
  return state;
}

export function executeComposition(options) {
  const request = normalizeRequest(options);
  const runId = options.runId || `compose-${Date.now()}`;
  const targetParent = path.dirname(request.target.projectRoot);
  const workspace = path.resolve(options.workspace || path.join(targetParent, '.ai-baseline-compose', `${path.basename(request.target.projectRoot)}-${runId}`));
  if (path.resolve(workspace).startsWith(`${path.resolve(request.target.projectRoot)}${path.sep}`)) throw new Error('组合工作区必须位于目标项目之外。');
  fs.mkdirSync(workspace, { recursive: true });
  const stateFile = path.join(workspace, 'composition-run.json');
  const state = { schemaVersion: 1, kind: 'ai-baseline-composition-run', id: runId, createdAt: now(), status: 'running', dryRun: !options.apply, request, workspace, stateFile, steps: [], discoveries: [], selections: [], bundles: [], requiredQuestions: unique([...(request.requiredQuestions || [])]) };
  const step = (name, status, details = {}) => { state.steps.push({ name, status, at: now(), ...details }); writeRun(stateFile, state); };
  writeRun(stateFile, state);
  try {
    for (const source of request.sources) {
      const report = discoverProjectModules({ projectRoot: source.projectRoot, query: request.request.text });
      state.discoveries.push({ source: source.id, report });
      let modules = explicitModules(request, source.id);
      if (!modules.length) {
        const selected = selectModulesFromDiscovery(report, request.request.text);
        modules = selected.selected;
        state.requiredQuestions.push(...selected.questions);
      }
      for (const name of modules) {
        const found = report.modules.find((item) => item.name === name || item.directory === name);
        if (!found) state.requiredQuestions.push(question(`missing-${source.id}-${name}`, 'selections', `来源 ${source.id} 中不存在模块 ${name}，请重新确认。`, '显式选择无法映射到可导出模块。'));
        else if (!found.readiness.ready) state.requiredQuestions.push(question(`unready-${source.id}-${name}`, 'selections', `模块 ${name} 尚不满足可迁移契约，请先补齐：${found.readiness.blockers.map((item) => item.path || item.code).join('、')}。`, '不完整模块不可安全组合。'));
        else state.selections.push({ source: source.id, module: found.name, projectRoot: source.projectRoot });
      }
    }
    state.requiredQuestions = unique(state.requiredQuestions.map((item) => JSON.stringify(item))).map((item) => JSON.parse(item));
    step('discover-select', state.requiredQuestions.length ? 'blocked' : 'passed');
    if (state.requiredQuestions.length) { state.status = 'needs-confirmation'; writeRun(stateFile, state); return state; }
    if (!state.selections.length) throw new Error('没有识别出任何可组合模块。');
    if (!options.apply) { state.status = 'planned'; step('dry-run', 'passed'); writeRun(stateFile, state); return state; }

    let bundles = [];
    for (const selection of state.selections) {
      const output = path.join(workspace, 'bundles', `${selection.source}-${selection.module}`);
      const exported = exportModuleBundle({ projectRoot: selection.projectRoot, moduleName: selection.module, output, force: true });
      bundles.push({ sourceId: selection.source, path: exported.outputRoot, manifest: exported.manifest });
    }
    step('export', 'passed', { count: bundles.length });
    const repairQuestions = [];
    bundles = applySafeRepairs(bundles, request.policies, workspace, repairQuestions);
    state.requiredQuestions.push(...repairQuestions);
    if (state.requiredQuestions.length) { state.status = 'needs-confirmation'; state.bundles = bundles.map((item) => item.path); step('repair', 'blocked'); writeRun(stateFile, state); return state; }
    step('repair', 'passed');
    const compatibility = validateBundleSet(bundles.map((item) => item.path));
    state.compatibility = compatibility;
    if (!compatibility.compatible) {
      const unresolved = compatibility.blockers.map((item) => question(`compat-${safeId(item.code)}-${state.requiredQuestions.length}`, item.code, item.message, '该冲突不属于可机械证明安全的自动修复范围。'));
      state.requiredQuestions.push(...unresolved); state.status = 'needs-confirmation'; step('compatibility', 'blocked'); writeRun(stateFile, state); return state;
    }
    step('compatibility', 'passed');
    const transactionRoot = path.join(workspace, `transaction-${Date.now()}`);
    const transaction = beginCompositionTransaction({ projectRoot: request.target.projectRoot, transactionRoot, metadata: { runId } });
    state.transactionRoot = transaction.transactionRoot; step('transaction', 'passed');
    const composeScript = path.resolve(options.baselineRoot, 'scripts', 'project-compose.mjs');
    const composeArgs = ['--project-root', request.target.projectRoot, '--bundles', bundles.map((item) => item.path).join(',')];
    if (request.target.stack) composeArgs.push('--stack', request.target.stack);
    runNode(composeScript, composeArgs, request.target.projectRoot);
    recordTransactionEvent(transactionRoot, 'compose-complete', { bundles: bundles.length }); step('compose', 'passed');
    if (request.policies.validate !== false) {
      const validateArgs = ['--project-root', request.target.projectRoot];
      if (options.withE2e || request.policies.e2e) validateArgs.push('--with-e2e');
      if (options.installPlaywright) validateArgs.push('--install-playwright');
      runNode(path.resolve(options.baselineRoot, 'scripts', 'project-validate.mjs'), validateArgs, request.target.projectRoot);
      step('validate', 'passed');
    }
    state.bundles = bundles.map((item) => ({ source: item.sourceId, path: item.path, module: item.manifest.module.name }));
    state.transaction = commitCompositionTransaction(transactionRoot, { runId });
    state.status = 'completed'; step('complete', 'passed'); writeRun(stateFile, state); return state;
  } catch (error) {
    state.error = { message: error.message, stack: error.stack }; state.status = 'failed';
    if (state.transactionRoot) {
      try { failCompositionTransaction(state.transactionRoot, error); if (request.policies.rollbackOnFailure !== false && options.rollbackOnFailure !== false) { state.transaction = rollbackCompositionTransaction(state.transactionRoot, { automatic: true, reason: error.message }); state.status = 'rolled-back'; } } catch (rollbackError) { state.rollbackError = rollbackError.message; }
    }
    step('failure', 'failed', { message: error.message }); writeRun(stateFile, state); return state;
  }
}

export function resumeComposition(runFileOrWorkspace, options = {}) {
  const candidate = path.resolve(runFileOrWorkspace);
  const stateFile = fs.statSync(candidate).isDirectory() ? path.join(candidate, 'composition-run.json') : candidate;
  const previous = readJson(stateFile);
  if (previous.transactionRoot) {
    const tx = loadCompositionTransaction(previous.transactionRoot).manifest;
    if (['active', 'failed'].includes(tx.status)) rollbackCompositionTransaction(previous.transactionRoot, { resume: true });
  }
  return executeComposition({ ...options, request: previous.request, target: previous.request.target.projectRoot, sources: previous.request.sources, stack: previous.request.target.stack, workspace: previous.workspace, runId: previous.id, apply: true });
}

export { splitSources };
