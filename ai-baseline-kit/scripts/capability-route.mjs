#!/usr/bin/env node
import path from 'node:path';
import { parseArgs, resolveRoots } from './project-tools-lib.mjs';
import { resolveCapabilityRoute } from './capability-registry-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const { baselineRoot, projectRoot: defaultProjectRoot } = resolveRoots(import.meta.url);

function compactRoute(route) {
  return {
    schemaVersion: route.schemaVersion,
    kind: route.kind,
    routingMode: route.routingMode,
    routingStrategy: route.routingStrategy,
    primaryCapabilities: route.primaryCapabilities.map((item) => item.id),
    capabilities: route.capabilities.map((item) => item.id),
    load: {
      stages: route.load.stages.map((stage) => ({
        id: stage.id,
        files: stage.files.filter((file) => file.exists).map((file) => file.path),
      })),
      baselineFiles: route.load.baselineFiles,
      projectFiles: route.load.projectFiles.filter((item) => item.exists).map((item) => item.path),
      scripts: route.load.scripts,
    },
    diagnostics: route.diagnostics,
    performance: route.performance,
  };
}

try {
  const request = args.request || args.input || args.document || args.text || args._.join(' ');
  if (!request && !args.intent) throw new Error('请提供自然语言需求、文档路径或 --intent。');
  const projectRoot = path.resolve(args['project-root'] || defaultProjectRoot);
  const route = resolveCapabilityRoute({
    baselineRoot,
    projectRoot,
    request,
    intent: args.intent || '',
  });
  if (args.compact) {
    console.log(JSON.stringify(compactRoute(route)));
  } else if (args.json) {
    console.log(JSON.stringify(route, null, 2));
  } else {
    console.log('capability-route: pass');
    console.log(`strategy: ${route.routingStrategy}`);
    console.log(`confidence: ${route.diagnostics.confidence}`);
    console.log(`primary: ${route.primaryCapabilities.map((item) => item.id).join(', ')}`);
    console.log(`capabilities: ${route.capabilities.map((item) => item.id).join(', ')}`);
    console.log('load-stages:');
    for (const stage of route.load.stages) {
      console.log(`- ${stage.id}:`);
      for (const file of stage.files.filter((item) => item.exists)) console.log(`  - ${file.path}`);
    }
    console.log(`manifests: ${route.performance.loadedManifestCount}/${route.performance.registeredCapabilityCount}`);
    console.log(`cache-hit: ${route.performance.routeCacheHit}`);
  }
} catch (error) {
  console.error(`capability-route: fail: ${error.message}`);
  process.exit(1);
}
