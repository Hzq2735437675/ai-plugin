export const EXECUTION_STATES = Object.freeze([
  'initialized', 'analyzing', 'awaiting-confirmation', 'planned', 'executing',
  'scope-validation', 'validating', 'repairing', 'completed', 'failed', 'rolled-back',
]);

const TRANSITIONS = Object.freeze({
  initialized: ['analyzing', 'planned', 'failed'],
  analyzing: ['awaiting-confirmation', 'planned', 'failed'],
  'awaiting-confirmation': ['planned', 'failed'],
  planned: ['executing', 'failed'],
  executing: ['scope-validation', 'failed'],
  'scope-validation': ['validating', 'repairing', 'failed'],
  validating: ['repairing', 'completed', 'failed'],
  repairing: ['scope-validation', 'validating', 'failed'],
  failed: ['rolled-back'],
  completed: [],
  'rolled-back': [],
});

function timestamp() { return new Date().toISOString(); }
export function createExecutionState({ id, request = {}, policy = {} }) {
  return { schemaVersion: 1, kind: 'ai-baseline-controlled-execution', id, state: 'initialized', createdAt: timestamp(), updatedAt: timestamp(), request, policy, history: [{ at: timestamp(), from: null, to: 'initialized' }], violations: [], validation: [] };
}
export function canTransition(from, to) { return Boolean(TRANSITIONS[from]?.includes(to)); }
export function transitionExecutionState(record, to, details = {}) {
  if (!EXECUTION_STATES.includes(to)) throw new Error(`未知执行状态: ${to}`);
  if (!canTransition(record.state, to)) throw new Error(`非法执行状态跳转: ${record.state} -> ${to}`);
  const at = timestamp(); record.history.push({ at, from: record.state, to, ...details }); record.state = to; record.updatedAt = at; return record;
}
export function assertExecutionTerminal(record) {
  if (!['completed', 'rolled-back'].includes(record.state)) throw new Error(`执行尚未安全结束: ${record.state}`);
  return record;
}
