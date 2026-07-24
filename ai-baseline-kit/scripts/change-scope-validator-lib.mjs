import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { normalizePath } from './feature-tools-lib.mjs';

const SKIP_DIRECTORIES = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.vite', '.turbo']);
const ALWAYS_FORBIDDEN = ['.git', '.git/**'];

function hashFile(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function normalizeRule(value) { return normalizePath(String(value || '').trim()).replace(/^\.\//, '').replace(/\/$/, ''); }
function looksLikePathRule(value) { return /[\\/*?.]/.test(value) || /^[a-z0-9_.-]+$/i.test(value); }
function globRegex(pattern) {
  const normalized = normalizeRule(pattern);
  let result = '^';
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    if (char === '*' && normalized[index + 1] === '*') { result += '.*'; index += 1; }
    else if (char === '*') result += '[^/]*';
    else if (char === '?') result += '[^/]';
    else result += char.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
  }
  return new RegExp(`${result}$`, 'i');
}
function matchesRule(relativePath, rule) {
  const target = normalizeRule(relativePath);
  const normalized = normalizeRule(rule);
  if (!normalized) return false;
  if (normalized === '.' || normalized === '**' || normalized === '**/*') return true;
  if (normalized.includes('*') || normalized.includes('?')) return globRegex(normalized).test(target);
  return target === normalized || target.startsWith(`${normalized}/`);
}
function walk(directory, root, output) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (SKIP_DIRECTORIES.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`范围快照不支持符号链接: ${normalizePath(path.relative(root, target))}`);
    if (entry.isDirectory()) walk(target, root, output);
    else output.set(normalizePath(path.relative(root, target)), hashFile(target));
  }
}

export function snapshotProjectFiles(projectRoot) {
  const files = new Map();
  walk(path.resolve(projectRoot), path.resolve(projectRoot), files);
  return files;
}

export function diffProjectSnapshots(before, after) {
  const changes = [];
  for (const [file, sha256] of after) {
    if (!before.has(file)) changes.push({ path: file, type: 'create' });
    else if (before.get(file) !== sha256) changes.push({ path: file, type: 'modify' });
  }
  for (const file of before.keys()) if (!after.has(file)) changes.push({ path: file, type: 'delete' });
  return changes.sort((left, right) => left.path.localeCompare(right.path));
}

export function compileChangeScope(changePlan, policy = {}) {
  const files = changePlan?.files ?? {};
  const allowed = [...(files.allowedRoots ?? []), ...(files.create ?? []), ...(files.modify ?? []), ...(policy.additionalAllowedRoots ?? [])]
    .map(normalizeRule).filter(Boolean);
  const forbidden = [...ALWAYS_FORBIDDEN, ...(files.forbidden ?? []), ...(policy.forbidden ?? [])]
    .map(normalizeRule).filter((item) => item && looksLikePathRule(item));
  if (!policy.allowBaselineMaintenance) forbidden.push('ai-baseline-kit', 'ai-baseline-kit/**');
  return { allowed: [...new Set(allowed)], forbidden: [...new Set(forbidden)] };
}

export function validateChangePlanGate(changePlan) {
  const violations = [];
  if (!changePlan || changePlan.kind !== 'frontend-change-plan') violations.push({ code: 'change-plan-invalid', message: '必须提供 frontend-change-plan。' });
  if (changePlan?.status !== 'ready') violations.push({ code: 'change-plan-not-ready', message: `Change Plan 状态必须为 ready，当前为 ${changePlan?.status || 'missing'}。` });
  const questions = (changePlan?.requiredQuestions ?? []).filter((item) => item.blocking !== false);
  if (questions.length) violations.push({ code: 'blocking-questions', questions, message: `仍有 ${questions.length} 个必须确认项。` });
  if (!(changePlan?.files?.allowedRoots ?? []).length) violations.push({ code: 'allowed-roots-missing', message: 'Change Plan 必须声明 files.allowedRoots。' });
  return { valid: violations.length === 0, violations };
}

export function validateChangedFiles({ changes, changePlan, policy = {} }) {
  const scope = compileChangeScope(changePlan, policy);
  const violations = [];
  for (const change of changes) {
    const forbidden = scope.forbidden.find((rule) => matchesRule(change.path, rule));
    if (forbidden) {
      violations.push({ code: 'forbidden-file-change', path: change.path, type: change.type, rule: forbidden, message: `修改了禁止路径: ${change.path}` });
      continue;
    }
    if (!scope.allowed.some((rule) => matchesRule(change.path, rule))) {
      violations.push({ code: 'out-of-scope-change', path: change.path, type: change.type, message: `实际修改不在文件白名单中: ${change.path}` });
    }
  }
  return { valid: violations.length === 0, scope, changes, violations };
}
