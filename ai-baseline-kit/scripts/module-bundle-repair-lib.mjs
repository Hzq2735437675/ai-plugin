import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { readModuleBundle } from './module-portability-lib.mjs';
import { ensureInside, normalizePath, readJson, writeJson } from './feature-tools-lib.mjs';

const TEXT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.vue', '.json', '.css', '.scss', '.less', '.md']);

function walk(directory, files = []) {
  if (!fs.existsSync(directory)) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`模块修复不处理符号链接: ${target}`);
    if (entry.isDirectory()) walk(target, files);
    else files.push(target);
  }
  return files;
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function copyTree(source, destination) {
  for (const file of walk(source)) {
    const target = path.join(destination, path.relative(source, file));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(file, target);
  }
}

function safeRemove(directory) {
  const resolved = path.resolve(directory);
  const parsed = path.parse(resolved);
  if (resolved === parsed.root || resolved.length < parsed.root.length + 4) throw new Error(`拒绝删除不安全路径: ${resolved}`);
  fs.rmSync(resolved, { recursive: true, force: true });
}

function quoteRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeRoutePrefix(prefix) {
  const value = String(prefix || '').trim();
  if (!value) return '';
  return `/${value.replace(/^\/+|\/+$/g, '')}`;
}

function prefixedRoute(prefix, route) {
  const normalizedPrefix = normalizeRoutePrefix(prefix);
  if (!normalizedPrefix || route === '/') return normalizedPrefix || '/';
  return `${normalizedPrefix}/${String(route).replace(/^\/+/, '')}`.replaceAll(/\/{2,}/g, '/');
}

function replaceQuotedValue(text, from, to) {
  const escaped = quoteRegExp(from);
  return text.replace(new RegExp(`(["'])${escaped}\\1`, 'g'), (match, quote) => `${quote}${to}${quote}`);
}

function rewriteTextFiles(moduleRoot, transform) {
  const changed = [];
  for (const file of walk(moduleRoot)) {
    if (!TEXT_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
    const current = fs.readFileSync(file, 'utf8');
    const next = transform(current, file);
    if (next !== current) {
      fs.writeFileSync(file, next, 'utf8');
      changed.push(normalizePath(path.relative(moduleRoot, file)));
    }
  }
  return changed;
}

function rewriteModuleIdentity(moduleRoot, oldName, newName) {
  const metadataFile = path.join(moduleRoot, 'module.meta.json');
  const metadata = readJson(metadataFile);
  metadata.name = newName;
  metadata.provenance = [...new Set([...(metadata.provenance ?? []), `composition-repair:rename:${oldName}->${newName}`])];
  writeJson(metadataFile, metadata);

  const manifestFile = path.join(moduleRoot, metadata.entrypoints?.manifest || 'manifest.ts');
  if (!fs.existsSync(manifestFile)) throw new Error('模块重命名要求存在 manifest.ts。');
  const current = fs.readFileSync(manifestFile, 'utf8');
  const pattern = new RegExp(`(\\bname\\s*:\\s*)(["'])${quoteRegExp(oldName)}\\2`);
  const next = current.replace(pattern, (_, prefix, quote) => `${prefix}${quote}${newName}${quote}`);
  if (next === current) throw new Error(`无法在 manifest 中安全重写模块 name: ${oldName}`);
  fs.writeFileSync(manifestFile, next, 'utf8');
  return ['module.meta.json', normalizePath(path.relative(moduleRoot, manifestFile))];
}

function rewriteRoutes(moduleRoot, routes, prefix) {
  const routeMap = Object.fromEntries(routes.map((route) => [route, prefixedRoute(prefix, route)]));
  const changed = rewriteTextFiles(moduleRoot, (text) => {
    let next = text;
    for (const [from, to] of Object.entries(routeMap)) next = replaceQuotedValue(next, from, to);
    return next;
  });
  return { routes: routes.map((route) => routeMap[route]), changed };
}

function rewriteNamespace(moduleRoot, values, prefix) {
  const normalized = String(prefix || '').replace(/[.:]+$/g, '');
  if (!normalized) return { values, changed: [] };
  const map = Object.fromEntries(values.map((value) => [value, `${normalized}:${String(value).replace(/^.*?:/, '')}`]));
  const changed = rewriteTextFiles(moduleRoot, (text) => {
    let next = text;
    for (const [from, to] of Object.entries(map)) next = replaceQuotedValue(next, from, to);
    return next;
  });
  return { values: values.map((value) => map[value]), changed };
}

function refreshManifestFiles(outputRoot, manifest) {
  manifest.files = walk(path.join(outputRoot, 'module')).map((file) => ({
    path: normalizePath(path.relative(path.join(outputRoot, 'module'), file)),
    bundlePath: normalizePath(path.relative(outputRoot, file)),
    sha256: sha256(file),
  }));
  manifest.shared.files = (manifest.shared?.files ?? []).map((item) => ({
    ...item,
    sha256: sha256(path.join(outputRoot, item.bundlePath)),
  }));
}

export function repairModuleBundle({ bundlePath, output, rename = '', routePrefix = '', permissionPrefix = '', force = false }) {
  const source = readModuleBundle(bundlePath);
  const outputRoot = path.resolve(output);
  if (fs.existsSync(outputRoot)) {
    if (!force) throw new Error(`修复输出目录已存在: ${outputRoot}`);
    safeRemove(outputRoot);
  }
  fs.mkdirSync(outputRoot, { recursive: true });
  copyTree(source.bundleRoot, outputRoot);

  const manifestFile = path.join(outputRoot, 'module-bundle.json');
  const manifest = readJson(manifestFile);
  const moduleRoot = ensureInside(outputRoot, path.join(outputRoot, 'module'), '模块修复目录');
  const repairs = [];

  if (rename && rename !== manifest.module.name) {
    const oldName = manifest.module.name;
    const changed = rewriteModuleIdentity(moduleRoot, oldName, rename);
    manifest.module.name = rename;
    repairs.push({ type: 'rename-module', from: oldName, to: rename, changed });
  }

  if (routePrefix) {
    const rewritten = rewriteRoutes(moduleRoot, manifest.contracts.routes ?? [], routePrefix);
    manifest.contracts.routes = rewritten.routes;
    repairs.push({ type: 'prefix-routes', prefix: normalizeRoutePrefix(routePrefix), changed: rewritten.changed, routes: rewritten.routes });
  }

  if (permissionPrefix) {
    const rewritten = rewriteNamespace(moduleRoot, manifest.contracts.permissions ?? [], permissionPrefix);
    manifest.contracts.permissions = rewritten.values;
    manifest.module.permissions = rewritten.values;
    repairs.push({ type: 'namespace-permissions', prefix: permissionPrefix, changed: rewritten.changed, permissions: rewritten.values });
  }

  manifest.repairedAt = new Date().toISOString();
  manifest.repairs = [...(manifest.repairs ?? []), ...repairs];
  refreshManifestFiles(outputRoot, manifest);
  writeJson(manifestFile, manifest);
  readModuleBundle(outputRoot);
  return { outputRoot, manifest, repairs };
}
