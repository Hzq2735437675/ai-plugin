import fs from 'node:fs';
import path from 'node:path';
import { discoverWorkspaceProjects } from './workspace-discovery-lib.mjs';
import { resolveWorkspaceIntent } from './intent-resolver-lib.mjs';
import { aggregateQuestions } from './question-aggregator-lib.mjs';
import { executeComposition } from './composition-orchestrator-lib.mjs';
import { writeJson } from './feature-tools-lib.mjs';

function now() { return new Date().toISOString(); }
function safeName(value) { return String(value || 'smart-compose').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'smart-compose'; }
function writeRecord(file, record) { record.updatedAt = now(); writeJson(file, record); }

export async function runSmartCompose({ request, workspaceRoot, baselineRoot, target = '', stack = '', planOnly = false, withE2e = false, installPlaywright = false, maxDepth = 2, runId = '' }) {
  const root = path.resolve(workspaceRoot || process.cwd());
  const id = runId || `smart-compose-${Date.now()}`;
  const runWorkspace = path.join(root, '.ai-baseline-compose', safeName(id));
  fs.mkdirSync(runWorkspace, { recursive: true });
  const recordFile = path.join(runWorkspace, 'smart-compose-run.json');
  const record = { schemaVersion: 1, kind: 'ai-baseline-smart-compose-run', id, status: 'analyzing', createdAt: now(), updatedAt: now(), workspaceRoot: root, runWorkspace, recordFile, request: typeof request === 'string' ? request : request?.request?.text || request?.text || '', steps: [], requiredQuestions: [] };
  const step = (name, status, details = {}) => { record.steps.push({ name, status, at: now(), ...details }); writeRecord(recordFile, record); };
  writeRecord(recordFile, record);

  try {
    const discovery = discoverWorkspaceProjects({ workspaceRoot: root, maxDepth });
    record.discovery = discovery; step('workspace-discovery', 'passed', { projects: discovery.projects.length });
    const intent = resolveWorkspaceIntent({ request, discovery, target, stack });
    record.intent = intent;
    const aggregated = aggregateQuestions(intent.requiredQuestions || []);
    record.requiredQuestions = aggregated.questions;
    step('intent-resolution', aggregated.blocking ? 'blocked' : 'passed', { task: intent.task, confidence: intent.confidence });
    if (aggregated.blocking) { record.status = 'needs-confirmation'; record.questionSummary = aggregated.summary; writeRecord(recordFile, record); return record; }

    if (intent.task !== 'compose-project') {
      record.status = 'routed';
      record.route = intent.task === 'create-project' ? ['requirement-to-feature-spec', 'feature-architecture-planner', 'controlled-change-executor'] : ['requirement-to-feature-spec', 'baseline-structure-skill', 'controlled-change-executor', 'baseline-conformance-skill'];
      record.message = '该需求已完成意图识别，应由功能需求闭环继续执行；smart-compose 不会伪装为已完成业务开发。';
      step('route', 'passed', { route: record.route }); writeRecord(recordFile, record); return record;
    }

    record.status = planOnly ? 'planning' : 'executing'; writeRecord(recordFile, record);
    const composition = await executeComposition({ request: intent.request, target: intent.target?.projectRoot, stack: intent.target?.stack, workspace: path.join(runWorkspace, 'composition'), apply: !planOnly, baselineRoot, withE2e, installPlaywright, rollbackOnFailure: true });
    record.composition = composition;
    record.requiredQuestions = aggregateQuestions(composition.requiredQuestions || []).questions;
    if (composition.status === 'needs-confirmation') record.status = 'needs-confirmation';
    else if (composition.status === 'completed') record.status = 'completed';
    else if (composition.status === 'planned') record.status = 'planned';
    else if (composition.status === 'rolled-back') record.status = 'rolled-back';
    else record.status = 'failed';
    step('composition', ['completed', 'planned'].includes(record.status) ? 'passed' : record.status === 'needs-confirmation' ? 'blocked' : 'failed', { compositionStatus: composition.status });
    writeRecord(recordFile, record); return record;
  } catch (error) {
    record.status = 'failed'; record.error = { message: error.message, stack: error.stack };
    step('failure', 'failed', { message: error.message }); writeRecord(recordFile, record); return record;
  }
}
