import fs from 'node:fs';
import path from 'node:path';
import { beginCompositionTransaction, commitCompositionTransaction, failCompositionTransaction, rollbackCompositionTransaction } from './composition-transaction-lib.mjs';
import { diffProjectSnapshots, snapshotProjectFiles, validateChangedFiles, validateChangePlanGate } from './change-scope-validator-lib.mjs';
import { createExecutionState, transitionExecutionState } from './execution-state-machine-lib.mjs';
import { writeJson } from './feature-tools-lib.mjs';

const DEFAULT_POLICY = Object.freeze({ rollbackOnFailure: true, requireValidation: true, maxRepairAttempts: 0, allowBaselineMaintenance: false, additionalAllowedRoots: [] });
function save(file, record) { writeJson(file, record); }

export async function executeControlledChange({ projectRoot, workspace, changePlan, request = {}, policy = {}, execute, validate, repair }) {
  const absoluteProjectRoot = path.resolve(projectRoot);
  const absoluteWorkspace = path.resolve(workspace);
  if (absoluteWorkspace === absoluteProjectRoot || absoluteWorkspace.startsWith(`${absoluteProjectRoot}${path.sep}`)) throw new Error('受控执行工作区必须位于目标项目之外。');
  fs.mkdirSync(absoluteWorkspace, { recursive: true });
  const plannedPolicy = changePlan?.executionPolicy ?? {};
  const requestedRepairs = policy.maxRepairAttempts ?? plannedPolicy.maxRepairAttempts ?? DEFAULT_POLICY.maxRepairAttempts;
  const executionPolicy = { ...DEFAULT_POLICY, ...plannedPolicy, ...policy, maxRepairAttempts: Math.max(0, Math.min(3, Math.trunc(Number(requestedRepairs) || 0))) };
  const recordFile = path.join(absoluteWorkspace, 'controlled-execution.json');
  const record = createExecutionState({ id: path.basename(absoluteWorkspace), request, policy: executionPolicy });
  record.projectRoot = absoluteProjectRoot; record.changePlan = changePlan; record.recordFile = recordFile; save(recordFile, record);
  const gate = validateChangePlanGate(changePlan);
  if (!gate.valid) {
    transitionExecutionState(record, 'failed', { reason: 'change-plan-gate' }); record.violations.push(...gate.violations); save(recordFile, record); return record;
  }
  transitionExecutionState(record, 'planned'); save(recordFile, record);
  const transactionRoot = path.join(absoluteWorkspace, `transaction-${Date.now()}`);
  const transaction = beginCompositionTransaction({ projectRoot: absoluteProjectRoot, transactionRoot, metadata: { executionId: record.id } });
  record.transactionRoot = transaction.transactionRoot;
  try {
    const before = snapshotProjectFiles(absoluteProjectRoot);
    transitionExecutionState(record, 'executing'); save(recordFile, record);
    record.executeResult = await execute({ record, projectRoot: absoluteProjectRoot });
    let attempts = 0;
    while (true) {
      transitionExecutionState(record, 'scope-validation', { attempt: attempts });
      const after = snapshotProjectFiles(absoluteProjectRoot);
      record.changes = diffProjectSnapshots(before, after);
      const scopeResult = validateChangedFiles({ changes: record.changes, changePlan, policy: executionPolicy });
      record.scope = scopeResult.scope; record.violations = scopeResult.violations; save(recordFile, record);
      if (!scopeResult.valid) throw new Error(scopeResult.violations.map((item) => item.message).join('\n'));
      transitionExecutionState(record, 'validating', { attempt: attempts }); save(recordFile, record);
      const validation = validate ? await validate({ record, projectRoot: absoluteProjectRoot, attempt: attempts }) : { passed: !executionPolicy.requireValidation, checks: [] };
      record.validation.push(validation);
      const afterValidation = snapshotProjectFiles(absoluteProjectRoot);
      record.changes = diffProjectSnapshots(before, afterValidation);
      const finalScopeResult = validateChangedFiles({ changes: record.changes, changePlan, policy: executionPolicy });
      record.scope = finalScopeResult.scope; record.violations = finalScopeResult.violations; save(recordFile, record);
      if (!finalScopeResult.valid) throw new Error(finalScopeResult.violations.map((item) => item.message).join('\n'));
      if (validation.passed) break;
      if (!repair || attempts >= executionPolicy.maxRepairAttempts) throw new Error(validation.message || '受控执行验证失败。');
      transitionExecutionState(record, 'repairing', { attempt: attempts + 1 }); save(recordFile, record);
      const repairResult = await repair({ record, projectRoot: absoluteProjectRoot, validation, attempt: attempts + 1 }); record.repairs ??= []; record.repairs.push({ attempt: attempts + 1, result: repairResult ?? null }); attempts += 1; save(recordFile, record);
    }
    record.transaction = commitCompositionTransaction(transactionRoot, { executionId: record.id });
    transitionExecutionState(record, 'completed'); save(recordFile, record); return record;
  } catch (error) {
    record.error = { message: error.message, stack: error.stack };
    if (record.state !== 'failed') transitionExecutionState(record, 'failed', { reason: error.message });
    failCompositionTransaction(transactionRoot, error);
    if (executionPolicy.rollbackOnFailure) { record.transaction = rollbackCompositionTransaction(transactionRoot, { automatic: true, reason: error.message }); transitionExecutionState(record, 'rolled-back'); }
    save(recordFile, record); return record;
  }
}
