#!/usr/bin/env node
import path from 'node:path';
import { parseArgs, resolveRoots } from './project-tools-lib.mjs';
import { runSmartCompose } from './smart-compose-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const { baselineRoot, projectRoot } = resolveRoots(import.meta.url);
try {
  const request = args.request || args.file || args.document || args.text || args._.join(' ');
  if (!request) throw new Error('请直接输入自然语言需求，或通过 --request <文本|产品文档路径> 提供需求。');
  const result = await runSmartCompose({
    request,
    workspaceRoot: path.resolve(args['workspace-root'] || args.root || projectRoot),
    baselineRoot,
    target: args.target || '',
    stack: args.stack || '',
    planOnly: Boolean(args['plan-only'] || args.plan),
    withE2e: Boolean(args['with-e2e']),
    installPlaywright: Boolean(args['install-playwright']),
    maxDepth: Number(args.depth || 2),
    runId: args['run-id'] || '',
  });
  console.log(`smart-compose: ${['completed', 'planned', 'routed'].includes(result.status) ? 'pass' : result.status === 'needs-confirmation' ? 'blocked' : 'fail'}`);
  console.log(`status: ${result.status}`);
  console.log(`record: ${result.recordFile}`);
  if (result.composition?.request?.target?.projectRoot) console.log(`target: ${result.composition.request.target.projectRoot}`);
  for (const item of result.requiredQuestions || []) console.log(`question: ${item.question}`);
  if (result.route) console.log(`route: ${result.route.join(' -> ')}`);
  if (args.json) console.log(JSON.stringify(result, null, 2));
  if (result.status === 'needs-confirmation') process.exit(2);
  if (['failed', 'rolled-back'].includes(result.status)) process.exit(1);
} catch (error) {
  console.error(`smart-compose: fail: ${error.message}`);
  process.exit(1);
}
