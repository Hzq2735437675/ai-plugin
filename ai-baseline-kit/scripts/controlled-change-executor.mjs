#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { executeControlledChange } from './controlled-change-executor-lib.mjs';
import { parseArgs, resolveRoots } from './project-tools-lib.mjs';
import { readJson } from './feature-tools-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const { baselineRoot, projectRoot: defaultProjectRoot } = resolveRoots(import.meta.url);
function inside(candidate, root) { const relative = path.relative(path.resolve(root), path.resolve(candidate)); return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)); }
function scriptPath(value, projectRoot) {
  const absolute = path.resolve(value);
  if (!fs.existsSync(absolute)) throw new Error(`执行脚本不存在: ${absolute}`);
  if (!inside(absolute, projectRoot) && !inside(absolute, baselineRoot)) throw new Error('执行脚本必须位于目标项目或 AI 基线包内。');
  return absolute;
}
function parseScriptArgs(value) {
  if (!value) return [];
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) throw new Error('--script-args-json 必须是字符串数组。');
  return parsed;
}
function run(script, scriptArgs, cwd) {
  const result = spawnSync(process.execPath, [script, ...scriptArgs], { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${path.basename(script)} 执行失败:\n${result.stderr || result.stdout || result.error?.message || 'unknown error'}`);
  return { passed: true, status: result.status, stdout: result.stdout, stderr: result.stderr };
}

try {
  const projectRoot = path.resolve(args['project-root'] || defaultProjectRoot);
  const planFile = path.resolve(args.plan || '');
  if (!args.plan || !fs.existsSync(planFile)) throw new Error('必须通过 --plan <change-plan.json> 提供 Change Plan。');
  if (!args.script) throw new Error('必须通过 --script <受控 Node 脚本> 指定执行器。');
  const changePlan = readJson(planFile);
  const executeScript = scriptPath(args.script, projectRoot);
  const validateScript = args['validate-script'] ? scriptPath(args['validate-script'], projectRoot) : '';
  const requireValidation = changePlan.executionPolicy?.requireValidation !== false;
  if (requireValidation && !validateScript) throw new Error('Change Plan 要求验证，必须通过 --validate-script <validation-script> 提供验证器。');
  const executeArgs = parseScriptArgs(args['script-args-json']);
  const validateArgs = parseScriptArgs(args['validate-args-json']);
  const workspace = path.resolve(args.workspace || path.join(path.dirname(projectRoot), '.ai-baseline-executions', `execution-${Date.now()}`));
  const result = await executeControlledChange({
    projectRoot, workspace, changePlan, request: { source: planFile },
    policy: { rollbackOnFailure: !args['no-rollback'], requireValidation, maxRepairAttempts: 0, allowBaselineMaintenance: Boolean(args['allow-baseline-maintenance']) },
    execute: () => run(executeScript, executeArgs, projectRoot),
    validate: validateScript ? () => run(validateScript, validateArgs, projectRoot) : undefined,
  });
  console.log(`controlled-change-executor: ${result.state === 'completed' ? 'pass' : 'fail'}`);
  console.log(`state: ${result.state}`);
  console.log(`record: ${result.recordFile}`);
  for (const item of result.violations || []) console.log(`violation: ${item.code}: ${item.message}`);
  if (args.json) console.log(JSON.stringify(result, null, 2));
  if (result.state !== 'completed') process.exit(result.state === 'failed' ? 2 : 1);
} catch (error) {
  console.error(`controlled-change-executor: fail: ${error.message}`);
  process.exit(1);
}
