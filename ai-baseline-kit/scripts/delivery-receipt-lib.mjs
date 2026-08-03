import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { normalizePath } from './feature-tools-lib.mjs';

function hashBuffer(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function hashFile(file) {
  return hashBuffer(fs.readFileSync(file));
}

function safeRelative(projectRoot, value) {
  const relative = normalizePath(String(value || '')).replace(/^\.\//, '');
  const absolute = path.resolve(projectRoot, relative);
  const root = path.resolve(projectRoot);
  const relativeToRoot = path.relative(root, absolute);
  if (!relative || relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) return null;
  return normalizePath(relativeToRoot);
}

function normalizeChangeType(value) {
  const type = String(value || 'unknown').toLowerCase();
  return ['create', 'modify', 'delete', 'unknown'].includes(type) ? type : 'unknown';
}

export function normalizeChangedFiles(projectRoot, changes = []) {
  const normalized = new Map();
  for (const source of changes) {
    const item = typeof source === 'string' ? { path: source, type: 'unknown' } : source;
    const relative = safeRelative(projectRoot, item?.path);
    if (!relative) continue;
    const file = path.join(projectRoot, relative);
    const exists = fs.existsSync(file) && fs.statSync(file).isFile();
    normalized.set(relative, {
      path: relative,
      type: normalizeChangeType(item?.type),
      sha256: exists ? hashFile(file) : null,
    });
  }
  return [...normalized.values()].sort((left, right) => left.path.localeCompare(right.path));
}

export function changedFilesHash(manifest) {
  return hashBuffer(JSON.stringify(manifest));
}

function runGit(projectRoot, args) {
  return spawnSync('git', ['-c', 'core.quotepath=false', ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    windowsHide: true,
  });
}

function gitRoot(projectRoot) {
  const result = runGit(projectRoot, ['rev-parse', '--show-toplevel']);
  if (result.status !== 0) return '';
  return path.resolve(result.stdout.trim());
}

function gitPaths(projectRoot, repositoryRoot, args) {
  const result = runGit(projectRoot, ['-C', repositoryRoot, ...args, '-z']);
  if (result.status !== 0) return [];
  return result.stdout
    .split('\0')
    .filter(Boolean)
    .map((file) => {
      const absolute = path.resolve(repositoryRoot, file);
      const relative = path.relative(path.resolve(projectRoot), absolute);
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return '';
      return normalizePath(relative);
    })
    .filter(Boolean);
}

export function discoverGitChanges(projectRoot) {
  const root = gitRoot(projectRoot);
  if (!root) return [];
  const changes = new Map();
  const recordTracked = (file) => {
    const absolute = path.join(projectRoot, file);
    changes.set(file, { path: file, type: fs.existsSync(absolute) ? 'modify' : 'delete' });
  };
  for (const file of gitPaths(projectRoot, root, ['diff', '--name-only', '--diff-filter=ACMRD'])) recordTracked(file);
  for (const file of gitPaths(projectRoot, root, ['diff', '--cached', '--name-only', '--diff-filter=ACMRD'])) recordTracked(file);
  for (const file of gitPaths(projectRoot, root, ['ls-files', '--others', '--exclude-standard'])) {
    changes.set(file, { path: file, type: 'create' });
  }
  return [...changes.values()].sort((left, right) => left.path.localeCompare(right.path));
}

export function buildChangedFileManifest(projectRoot, changes = []) {
  const manifest = normalizeChangedFiles(projectRoot, changes);
  return { manifest, sha256: changedFilesHash(manifest) };
}

export function verifyDeliveryReceipt(receiptFile, { projectRoot, requestId = '' } = {}) {
  const violations = [];
  let receipt = null;
  try {
    receipt = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
  } catch (error) {
    return { valid: false, receipt: null, violations: [`无法读取交付回执: ${error.message}`] };
  }
  if (receipt?.schemaVersion !== 1) violations.push('交付回执 schemaVersion 必须为 1。');
  if (receipt?.kind !== 'ai-frontend-delivery-receipt') violations.push('交付回执 kind 不正确。');
  if (receipt?.status !== 'passed') violations.push('交付回执 status 必须为 passed。');
  if (!receipt?.requestId) violations.push('交付回执缺少 requestId。');
  if (requestId && receipt?.requestId !== requestId) violations.push('交付回执不属于当前请求。');
  if (path.resolve(receipt?.projectRoot || '') !== path.resolve(projectRoot)) violations.push('交付回执不属于当前项目根目录。');
  if (receipt?.checks?.implementationCompleteness !== 'passed') violations.push('交付回执实现完整性检查未通过。');
  if (!['passed', 'passed-with-fallback-allowed', 'not-run'].includes(receipt?.checks?.astBoundary)) violations.push('交付回执 AST 边界检查状态无效。');
  if (receipt?.checks?.projectValidation !== 'passed') violations.push('交付回执项目验证未通过。');
  if (receipt?.checks?.finalGate !== 'passed') violations.push('交付回执 finalGate 未通过。');
  for (const field of ['featureSpec', 'changePlan']) {
    if (receipt?.[field] && !safeRelative(projectRoot, receipt[field])) violations.push(`交付回执 ${field} 路径越出项目根目录。`);
  }
  if (!/^[a-f0-9]{64}$/.test(receipt?.changedFilesHash || '')) violations.push('交付回执缺少有效 changedFilesHash。');
  const manifest = Array.isArray(receipt?.changedFiles) ? receipt.changedFiles : [];
  if (receipt?.changedFilesHash !== changedFilesHash(manifest)) violations.push('交付回执 changedFilesHash 与文件清单不一致。');
  for (const item of manifest) {
    const relative = safeRelative(projectRoot, item?.path);
    if (!relative || relative !== item.path) {
      violations.push(`交付回执包含非法路径: ${item?.path || '(empty)'}`);
      continue;
    }
    const type = normalizeChangeType(item?.type);
    if (type !== item?.type) violations.push(`交付回执包含无效变更类型: ${relative}`);
    const file = path.join(projectRoot, relative);
    const exists = fs.existsSync(file) && fs.statSync(file).isFile();
    if (item.sha256 === null && type !== 'delete') violations.push(`交付回执缺少非删除文件哈希: ${relative}`);
    if (type === 'delete' && exists) violations.push(`交付回执标记为删除但文件仍存在: ${relative}`);
    if (typeof item.sha256 === 'string' && (!exists || hashFile(file) !== item.sha256)) violations.push(`交付回执文件哈希已失效: ${relative}`);
  }
  return { valid: violations.length === 0, receipt, violations };
}
