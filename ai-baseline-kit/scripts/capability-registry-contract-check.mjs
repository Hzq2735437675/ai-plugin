#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clearCapabilityCaches,
  loadCapabilityManifest,
  loadCapabilityRegistry,
  resolveCapabilityRoute,
  validateCapabilityManifest,
  validateCapabilityRegistry,
} from './capability-registry-lib.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const baselineRoot = path.resolve(scriptDir, '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-capability-registry-'));

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function graphFixture({ cycle = false, missing = false } = {}) {
  const fixtureRoot = path.join(tempRoot, `graph-${cycle ? 'cycle' : missing ? 'missing' : 'valid'}`);
  fs.mkdirSync(fixtureRoot, { recursive: true });
  fs.writeFileSync(path.join(fixtureRoot, 'AGENTS.md'), '# fixture\n');
  const capabilityEntries = [
    { id: 'alpha', summary: 'alpha', priority: 10, intents: [], triggers: ['alpha'], manifest: 'capabilities/alpha.json' },
    { id: 'beta', summary: 'beta', priority: 5, intents: [], triggers: ['beta'], manifest: 'capabilities/beta.json' },
  ];
  const manifests = {
    alpha: {
      schemaVersion: 1,
      kind: 'ai-baseline-capability-manifest',
      id: 'alpha',
      loadPhase: 'planning',
      skillFiles: [],
      contextFiles: [],
      scripts: [],
      requires: missing ? ['not-registered'] : cycle ? ['beta'] : [],
    },
    beta: {
      schemaVersion: 1,
      kind: 'ai-baseline-capability-manifest',
      id: 'beta',
      loadPhase: 'validation',
      skillFiles: [],
      contextFiles: [],
      scripts: [],
      requires: cycle ? ['alpha'] : [],
    },
  };
  for (const [id, manifest] of Object.entries(manifests)) writeJson(path.join(fixtureRoot, `capabilities/${id}.json`), manifest);
  return {
    fixtureRoot,
    registry: {
      schemaVersion: 2,
      kind: 'ai-baseline-capability-registry',
      routing: {
        mode: 'explicit-progressive',
        strategy: 'two-stage-manifest',
        defaultCapability: 'alpha',
        maxPrimaryCapabilities: 2,
        routeCacheSize: 8,
      },
      bootstrapContext: ['AGENTS.md'],
      projectContext: [],
      capabilities: capabilityEntries,
    },
  };
}

try {
  clearCapabilityCaches();
  const registry = loadCapabilityRegistry(baselineRoot);
  const fullValidation = validateCapabilityRegistry(registry, { baselineRoot, validateManifests: true });
  assert.equal(fullValidation.valid, true, fullValidation.violations.join('\n'));
  assert.equal(registry.schemaVersion, 2);
  assert.equal(registry.routing.mode, 'explicit-progressive');
  assert.equal(registry.routing.strategy, 'two-stage-manifest');
  assert.ok(registry.capabilities.length >= 5);
  assert.ok(registry.capabilities.every((item) => item.manifest && !('skillFiles' in item)));
  assert.deepEqual(registry.bootstrapContext, ['AGENTS.md', 'capabilities/index.json']);

  const lifecycleManifest = loadCapabilityManifest(baselineRoot, registry.capabilities.find((item) => item.id === 'project-lifecycle'));
  assert.equal(validateCapabilityManifest(lifecycleManifest, { baselineRoot, expectedId: 'project-lifecycle' }).valid, true);

  const feature = resolveCapabilityRoute({
    baselineRoot,
    projectRoot: tempRoot,
    request: '新增订单审核页面和接口',
    intent: 'modify-feature',
  });
  assert.equal(feature.schemaVersion, 2);
  assert.equal(feature.routingStrategy, 'two-stage-manifest');
  assert.equal(feature.primaryCapabilities[0].id, 'feature-development');
  assert.ok(feature.capabilities.some((item) => item.id === 'delivery-conformance' && item.selection.startsWith('required-by:')));
  assert.ok(feature.load.baselineFiles.includes('skills/requirement-to-feature-spec/SKILL.md'));
  assert.ok(feature.load.baselineFiles.includes('skills/baseline-conformance-skill/SKILL.md'));
  assert.ok(feature.load.stages.some((stage) => stage.id === 'dependencies'));
  assert.ok(!feature.load.baselineFiles.includes('skills/project-scheme-bootstrap/SKILL.md'));
  assert.equal(feature.performance.loadedManifestCount, 2);
  assert.ok(feature.performance.loadedManifestCount < feature.performance.registeredCapabilityCount);
  assert.equal(feature.performance.routeCacheHit, false);

  const featureCached = resolveCapabilityRoute({
    baselineRoot,
    projectRoot: tempRoot,
    request: '新增订单审核页面和接口',
    intent: 'modify-feature',
  });
  assert.equal(featureCached.performance.routeCacheHit, true);
  assert.equal(featureCached.registry.fingerprint, feature.registry.fingerprint);

  const compose = resolveCapabilityRoute({
    baselineRoot,
    projectRoot: tempRoot,
    request: '把项目 A 的订单模块抽离并迁移到项目 B',
    intent: 'compose-project',
  });
  assert.equal(compose.primaryCapabilities[0].id, 'project-composition');
  assert.ok(compose.load.scripts.includes('scripts/smart-compose.mjs'));
  assert.ok(compose.capabilities.some((item) => item.id === 'delivery-conformance'));

  const lifecycle = resolveCapabilityRoute({
    baselineRoot,
    projectRoot: tempRoot,
    request: '我已经复制覆盖了最新版装配包 ai-baseline-kit，请自动更新',
  });
  assert.equal(lifecycle.primaryCapabilities[0].id, 'project-lifecycle');
  assert.ok(lifecycle.load.scripts.includes('scripts/project-upgrade.mjs'));
  assert.equal(lifecycle.performance.loadedManifestCount, 1);
  assert.ok(!lifecycle.load.baselineFiles.includes('docs/baseline-rules.yml'));

  const localized = resolveCapabilityRoute({
    baselineRoot,
    projectRoot: tempRoot,
    request: '新增用户页面，并把中文文案做成 i18n 多语言',
    intent: 'modify-feature',
  });
  assert.ok(localized.primaryCapabilities.some((item) => item.id === 'project-i18n'));
  assert.ok(localized.load.baselineFiles.includes('skills/project-i18n-localizer/SKILL.md'));
  assert.ok(localized.capabilities.some((item) => item.id === 'delivery-conformance'));

  const fallback = resolveCapabilityRoute({ baselineRoot, projectRoot: tempRoot, request: '帮我处理一下这个需求' });
  assert.equal(fallback.primaryCapabilities[0].id, 'feature-development');
  assert.equal(fallback.diagnostics.fallback, true);
  assert.equal(fallback.diagnostics.confidence, 'low');

  const invalidIndex = structuredClone(registry);
  invalidIndex.capabilities[0].manifest = '../outside.json';
  const invalidIndexResult = validateCapabilityRegistry(invalidIndex, { baselineRoot });
  assert.equal(invalidIndexResult.valid, false);
  assert.ok(invalidIndexResult.violations.some((item) => item.includes('manifest 路径不安全')));

  const invalidManifest = structuredClone(lifecycleManifest);
  invalidManifest.contextFiles = ['../outside.md'];
  const invalidManifestResult = validateCapabilityManifest(invalidManifest, { baselineRoot, expectedId: 'project-lifecycle' });
  assert.equal(invalidManifestResult.valid, false);
  assert.ok(invalidManifestResult.violations.some((item) => item.includes('不安全路径')));

  const missingFixture = graphFixture({ missing: true });
  const missingResult = validateCapabilityRegistry(missingFixture.registry, { baselineRoot: missingFixture.fixtureRoot, validateManifests: true });
  assert.equal(missingResult.valid, false);
  assert.ok(missingResult.violations.some((item) => item.includes('依赖未登记能力')));

  const cycleFixture = graphFixture({ cycle: true });
  const cycleResult = validateCapabilityRegistry(cycleFixture.registry, { baselineRoot: cycleFixture.fixtureRoot, validateManifests: true });
  assert.equal(cycleResult.valid, false);
  assert.ok(cycleResult.violations.some((item) => item.includes('能力依赖存在循环')));

  const source = fs.readFileSync(path.join(baselineRoot, 'scripts', 'capability-registry-lib.mjs'), 'utf8');
  for (const forbidden of ['readdirSync', 'opendirSync', 'eval(', 'new Function', 'execSync', 'spawnSync', 'import(']) {
    assert.ok(!source.includes(forbidden), `能力路由内核禁止出现 ${forbidden}`);
  }

  console.log('capability-registry-contract-check: pass');
  console.log(`capabilities: ${registry.capabilities.length}`);
  console.log('strategy: two-stage-manifest');
  console.log('progressive-load-plan: pass');
  console.log('bounded-route-cache: pass');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
