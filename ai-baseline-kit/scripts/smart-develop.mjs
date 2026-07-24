#!/usr/bin/env node
import path from 'node:path';
import { parseArgs, resolveRoots } from './project-tools-lib.mjs';
import { runSmartDevelop } from './smart-develop-lib.mjs';
const args = parseArgs(process.argv.slice(2)); const { baselineRoot, projectRoot } = resolveRoots(import.meta.url);
try {
  const request = args.request || args.input || args.file || args.document || args.text || args._.join(' '); if (!request) throw new Error('请直接输入自然语言、产品文档或 Feature Spec。');
  const result = await runSmartDevelop({ request, workspaceRoot: path.resolve(args['workspace-root'] || args.root || projectRoot), baselineRoot, projectRoot: args['project-root'] ? path.resolve(args['project-root']) : '', target: args.target || '', stack: args.stack || '', module: args.module || '', create: Boolean(args.create || args['create-project']), planOnly: Boolean(args['plan-only'] || args.plan), extractor: args.extractor || '', maxRepairAttempts: Number(args['max-repair-attempts'] ?? 2), install: !args['no-install'], withE2e: Boolean(args['with-e2e']), runId: args['run-id'] || '' });
  console.log(`smart-develop: ${['completed', 'planned', 'routed'].includes(result.status) ? 'pass' : result.status === 'needs-confirmation' ? 'blocked' : 'fail'}`); console.log(`status: ${result.status}`); console.log(`record: ${result.recordFile}`); for (const item of result.requiredQuestions || []) console.log(`question: ${item.question}`); if (args.json) console.log(JSON.stringify(result, null, 2)); if (result.status === 'needs-confirmation') process.exit(2); if (!['completed', 'planned', 'routed'].includes(result.status)) process.exit(1);
} catch (error) { console.error(`smart-develop: fail: ${error.message}`); process.exit(1); }
