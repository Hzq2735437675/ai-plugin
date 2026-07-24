import path from 'node:path';
import { uniqueQuestions } from './feature-tools-lib.mjs';

const RISK_ORDER = { L3: 0, L2: 1, L1: 2, L0: 3 };
export function aggregateQuestions(items) {
  const normalized = uniqueQuestions((items ?? []).filter(Boolean).map((item, index) => ({
    id: item.id || `question-${index + 1}`, field: item.field || 'request', question: item.question || item.message,
    reason: item.reason || '', risk: item.risk || 'L3', blocking: item.blocking !== false, options: item.options || [], recommended: item.recommended || '',
  })));
  normalized.sort((left, right) => (RISK_ORDER[left.risk] ?? 9) - (RISK_ORDER[right.risk] ?? 9) || left.id.localeCompare(right.id));
  return { questions: normalized, blocking: normalized.filter((item) => item.blocking).length, summary: normalized.length ? `需要一次性确认 ${normalized.length} 项，其中 ${normalized.filter((item) => item.blocking).length} 项阻断执行。` : '无需用户确认。' };
}
