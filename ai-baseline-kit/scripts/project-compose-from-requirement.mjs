#!/usr/bin/env node
import path from 'node:path';
import { executeComposition, resumeComposition, rollbackCompositionRun } from './composition-orchestrator-lib.mjs';
import { parseArgs, resolveRoots } from './project-tools-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const { baselineRoot } = resolveRoots(import.meta.url);
try {
  let result;
  if (args.rollback) result = rollbackCompositionRun(args.rollback);
  else if (args.resume) result = await resumeComposition(args.resume, { baselineRoot, withE2e: Boolean(args['with-e2e']), installPlaywright: Boolean(args['install-playwright']), rollbackOnFailure: !args['no-rollback'] });
  else result = await executeComposition({
    request: args.request || args.text || '', sources: args.sources || '', target: args.target || args['project-root'], stack: args.stack || '', workspace: args.workspace,
    apply: Boolean(args.apply), baselineRoot, withE2e: Boolean(args['with-e2e']), installPlaywright: Boolean(args['install-playwright']), rollbackOnFailure: !args['no-rollback'],
  });
  console.log(`project-compose-from-requirement: ${['completed', 'planned', 'rolled-back'].includes(result.status) ? 'pass' : 'blocked'}`);
  console.log(`status: ${result.status}`);
  console.log(`state: ${result.stateFile || path.join(result.workspace, 'composition-run.json')}`);
  for (const item of result.requiredQuestions || []) console.log(`question: ${item.question}`);
  if (args.json) console.log(JSON.stringify(result, null, 2));
  if (!['completed', 'planned', 'rolled-back'].includes(result.status)) process.exit(2);
} catch (error) {
  console.error(`project-compose-from-requirement: fail: ${error.message}`);
  process.exit(1);
}
