import fs from 'node:fs';
import path from 'node:path';

export const UPGRADE_MANIFEST_FILE = 'upgrade-manifest.json';

function normalize(value) {
  return String(value || '').replace(/\\/g, '/');
}

function isWithin(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function readManifest(file) {
  if (!fs.existsSync(file)) return { schemaVersion: 1, obsoleteFiles: [] };
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (parsed?.schemaVersion !== 1 || !Array.isArray(parsed?.obsoleteFiles)) {
    throw new Error(`${UPGRADE_MANIFEST_FILE} 格式无效，必须包含 schemaVersion: 1 和 obsoleteFiles 数组。`);
  }
  return parsed;
}

function resolveObsoleteFile(baselineRoot, relative) {
  const normalized = normalize(relative).replace(/^\.\//, '');
  if (!normalized || normalized === '.' || normalized.endsWith('/') || path.isAbsolute(normalized)) {
    throw new Error(`升级清理路径必须是能力包内文件或目录: ${relative}`);
  }
  const root = path.resolve(baselineRoot);
  const target = path.resolve(root, normalized);
  if (!isWithin(target, root)) throw new Error(`升级清理路径越出能力包目录: ${relative}`);
  return { normalized, target, root };
}

export function cleanObsoletePackageFiles({ baselineRoot, manifestFile = path.join(baselineRoot, UPGRADE_MANIFEST_FILE) } = {}) {
  const manifest = readManifest(manifestFile);
  const cleaned = [];
  const missing = [];
  for (const relative of manifest.obsoleteFiles) {
    const resolved = resolveObsoleteFile(baselineRoot, relative);
    if (!fs.existsSync(resolved.target)) {
      missing.push(resolved.normalized);
      continue;
    }
    const stat = fs.lstatSync(resolved.target);
    if (!stat.isSymbolicLink()) {
      const realRoot = fs.realpathSync.native(resolved.root);
      const realTarget = fs.realpathSync.native(resolved.target);
      if (!isWithin(realTarget, realRoot)) throw new Error(`拒绝清理能力包目录之外的真实路径: ${resolved.normalized}`);
    }
    fs.rmSync(resolved.target, { recursive: stat.isDirectory(), force: true });
    cleaned.push(resolved.normalized);
  }
  return { cleaned, missing, manifest };
}
