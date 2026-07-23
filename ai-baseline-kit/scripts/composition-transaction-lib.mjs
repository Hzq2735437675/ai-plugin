import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { normalizePath, readJson, writeJson } from './feature-tools-lib.mjs';

const ALWAYS_PRESERVE = new Set(['.git']);
const HEAVY_DIRECTORIES = new Set(['node_modules', 'dist', 'build', 'coverage', '.vite', '.turbo']);

function pathWithin(candidate, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function assertSafeProjectRoot(projectRoot) {
  const resolved = path.resolve(projectRoot);
  const parsed = path.parse(resolved);
  if (resolved === parsed.root || resolved.length < parsed.root.length + 4) throw new Error(`拒绝对不安全项目根目录执行事务: ${resolved}`);
  return resolved;
}

function walk(directory, projectRoot, files = [], directories = []) {
  if (!fs.existsSync(directory)) return { files, directories };
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ALWAYS_PRESERVE.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`事务不处理符号链接: ${normalizePath(path.relative(projectRoot, target))}`);
    if (entry.isDirectory()) {
      directories.push(target);
      if (HEAVY_DIRECTORIES.has(entry.name)) continue;
      walk(target, projectRoot, files, directories);
    } else {
      files.push(target);
    }
  }
  return { files, directories };
}

function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function copyFile(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function removeSafe(target, projectRoot) {
  const resolved = path.resolve(target);
  if (!pathWithin(resolved, projectRoot) || resolved === path.resolve(projectRoot)) throw new Error(`拒绝删除事务边界外路径: ${resolved}`);
  fs.rmSync(resolved, { recursive: true, force: true });
}

export function createTransactionId(prefix = 'compose') {
  const stamp = new Date().toISOString().replaceAll(/[-:.TZ]/g, '').slice(0, 14);
  return `${prefix}-${stamp}-${crypto.randomBytes(3).toString('hex')}`;
}

export function beginCompositionTransaction({ projectRoot, transactionRoot, metadata = {} }) {
  const absoluteProjectRoot = assertSafeProjectRoot(projectRoot);
  const absoluteTransactionRoot = path.resolve(transactionRoot);
  if (pathWithin(absoluteTransactionRoot, absoluteProjectRoot)) throw new Error('事务备份目录必须位于目标项目之外，避免快照递归。');
  if (fs.existsSync(absoluteTransactionRoot)) throw new Error(`事务目录已存在: ${absoluteTransactionRoot}`);
  fs.mkdirSync(path.join(absoluteTransactionRoot, 'backup'), { recursive: true });

  const initialExists = fs.existsSync(absoluteProjectRoot);
  const topLevel = initialExists ? fs.readdirSync(absoluteProjectRoot, { withFileTypes: true }).map((entry) => ({ name: entry.name, directory: entry.isDirectory() })) : [];
  const snapshot = initialExists ? walk(absoluteProjectRoot, absoluteProjectRoot) : { files: [], directories: [] };
  const files = snapshot.files.map((file) => {
    const relative = normalizePath(path.relative(absoluteProjectRoot, file));
    copyFile(file, path.join(absoluteTransactionRoot, 'backup', relative));
    return { path: relative, sha256: hashFile(file) };
  });
  const manifest = {
    schemaVersion: 1,
    kind: 'ai-baseline-composition-transaction',
    id: path.basename(absoluteTransactionRoot),
    status: 'active',
    createdAt: new Date().toISOString(),
    projectRoot: absoluteProjectRoot,
    initialExists,
    initialTopLevel: topLevel,
    initialDirectories: snapshot.directories.map((directory) => normalizePath(path.relative(absoluteProjectRoot, directory))),
    files,
    metadata,
    events: [{ at: new Date().toISOString(), type: 'begin' }],
  };
  writeJson(path.join(absoluteTransactionRoot, 'transaction.json'), manifest);
  return { transactionRoot: absoluteTransactionRoot, manifest };
}

export function loadCompositionTransaction(transactionRoot) {
  const absoluteTransactionRoot = path.resolve(transactionRoot);
  const file = path.join(absoluteTransactionRoot, 'transaction.json');
  if (!fs.existsSync(file)) throw new Error(`事务记录不存在: ${file}`);
  return { transactionRoot: absoluteTransactionRoot, file, manifest: readJson(file) };
}

function updateTransaction(transactionRoot, mutate) {
  const loaded = loadCompositionTransaction(transactionRoot);
  const next = mutate(loaded.manifest) || loaded.manifest;
  writeJson(loaded.file, next);
  return next;
}

export function recordTransactionEvent(transactionRoot, type, details = {}) {
  return updateTransaction(transactionRoot, (manifest) => {
    manifest.events ??= [];
    manifest.events.push({ at: new Date().toISOString(), type, ...details });
    return manifest;
  });
}

export function commitCompositionTransaction(transactionRoot, details = {}) {
  return updateTransaction(transactionRoot, (manifest) => {
    if (manifest.status !== 'active') throw new Error(`只能提交 active 事务，当前状态: ${manifest.status}`);
    manifest.status = 'committed';
    manifest.committedAt = new Date().toISOString();
    manifest.events.push({ at: manifest.committedAt, type: 'commit', ...details });
    return manifest;
  });
}

export function rollbackCompositionTransaction(transactionRoot, details = {}) {
  const loaded = loadCompositionTransaction(transactionRoot);
  const manifest = loaded.manifest;
  if (!['active', 'failed'].includes(manifest.status)) throw new Error(`只能回滚 active/failed 事务，当前状态: ${manifest.status}`);
  const projectRoot = assertSafeProjectRoot(manifest.projectRoot);
  fs.mkdirSync(projectRoot, { recursive: true });

  const initialTopLevel = new Map((manifest.initialTopLevel ?? []).map((item) => [item.name, item]));
  for (const entry of fs.readdirSync(projectRoot, { withFileTypes: true })) {
    if (ALWAYS_PRESERVE.has(entry.name)) continue;
    if (!initialTopLevel.has(entry.name)) removeSafe(path.join(projectRoot, entry.name), projectRoot);
  }

  const initialFiles = new Set((manifest.files ?? []).map((item) => item.path));
  const current = walk(projectRoot, projectRoot);
  for (const file of current.files) {
    const relative = normalizePath(path.relative(projectRoot, file));
    if (!initialFiles.has(relative)) removeSafe(file, projectRoot);
  }

  for (const item of manifest.files ?? []) {
    const backup = path.join(loaded.transactionRoot, 'backup', item.path);
    if (!fs.existsSync(backup)) throw new Error(`事务备份文件缺失: ${item.path}`);
    copyFile(backup, path.join(projectRoot, item.path));
  }

  manifest.status = 'rolled-back';
  manifest.rolledBackAt = new Date().toISOString();
  manifest.events.push({ at: manifest.rolledBackAt, type: 'rollback', ...details });
  writeJson(loaded.file, manifest);
  return manifest;
}

export function failCompositionTransaction(transactionRoot, error) {
  return updateTransaction(transactionRoot, (manifest) => {
    if (manifest.status === 'active') manifest.status = 'failed';
    manifest.failedAt = new Date().toISOString();
    manifest.events.push({ at: manifest.failedAt, type: 'failure', message: String(error?.message || error) });
    return manifest;
  });
}
