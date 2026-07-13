#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = path.join(root, 'package-registry.json');
const errors = [];

function fail(message, file = '') {
  errors.push(file ? `${message} (${file})` : message);
}

function isSafeRelativePath(relativePath) {
  return typeof relativePath === 'string'
    && relativePath.length > 0
    && !path.isAbsolute(relativePath)
    && !relativePath.split(/[\\/]/).includes('..');
}

function normalize(relativePath) {
  return relativePath.replace(/\\/g, '/').replace(/\/$/, '');
}

function readJson(relativePath) {
  if (!isSafeRelativePath(relativePath)) {
    fail('JSON 路径必须是安全的相对路径', relativePath);
    return null;
  }
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail('文件不存在', relativePath);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    fail(`JSON 无法解析: ${error.message}`, relativePath);
    return null;
  }
}

function checkFile(relativePath, label) {
  if (!isSafeRelativePath(relativePath)) {
    fail(`${label} 不是安全的相对路径`);
    return false;
  }
  if (!fs.existsSync(path.join(root, relativePath))) {
    fail(`${label} 指向的文件不存在`, relativePath);
    return false;
  }
  return true;
}

function checkManifest(item) {
  const manifest = readJson(item.manifest);
  if (!manifest) return;

  for (const field of ['schemaVersion', 'name', 'version', 'type', 'description', 'entrypoints', 'installation', 'distribution', 'dependencies']) {
    if (!(field in manifest)) fail(`manifest 缺少字段: ${field}`, item.manifest);
  }
  if (manifest.schemaVersion !== 1) fail('manifest.schemaVersion 必须为 1', item.manifest);
  if (manifest.name !== item.name) fail('注册表名称与 manifest.name 不一致', item.name);
  if (manifest.version !== item.version) fail('注册表版本与 manifest.version 不一致', item.name);

  const packageRoot = normalize(path.dirname(item.manifest));
  if (normalize(item.path) !== packageRoot) fail('注册表 path 必须与 manifest 所在目录一致', item.name);

  for (const [key, entry] of Object.entries(manifest.entrypoints ?? {})) {
    const entryPath = `${packageRoot}/${entry}`;
    if (!isSafeRelativePath(entry)) fail(`entrypoints.${key} 不是安全的相对路径`, item.manifest);
    else if (!fs.existsSync(path.join(root, packageRoot, entry))) fail(`entrypoints.${key} 指向的文件不存在`, entryPath);
  }

  const guide = manifest.installation?.guide;
  if (!isSafeRelativePath(guide)) fail('manifest.installation.guide 不是安全的相对路径', item.manifest);
  else if (normalize(item.installation) !== `${packageRoot}/${normalize(guide)}`) {
    fail('manifest.installation.guide 与注册表 installation 不一致', item.name);
  }
}

const registry = readJson('package-registry.json');
if (registry) {
  if (registry.schemaVersion !== 1) fail('package-registry.json schemaVersion 必须为 1');
  if (!Array.isArray(registry.packages) || registry.packages.length === 0) {
    fail('package-registry.json 必须登记至少一个包');
  }

  const names = new Set();
  const paths = new Set();
  for (const item of registry.packages ?? []) {
    if (!item || typeof item !== 'object') {
      fail('包登记项必须是对象');
      continue;
    }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(item.name ?? '')) fail('包名必须使用 kebab-case', item.name ?? 'unknown');
    if (!/^\d+\.\d+\.\d+$/.test(item.version ?? '')) fail('包版本必须是三段语义化版本号', item.name ?? 'unknown');
    if (names.has(item.name)) fail('包名重复', item.name);
    if (paths.has(item.path)) fail('包路径重复', item.path);
    names.add(item.name);
    paths.add(item.path);

    checkFile(item.path, '包目录');
    checkFile(item.manifest, 'manifest');
    checkFile(item.readme, 'README');
    checkFile(item.entry, '主入口');
    checkFile(item.installation, '安装说明');
    checkManifest(item);
  }
}

if (errors.length > 0) {
  console.error(`package-check: fail (${errors.length} error(s))`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('package-check: pass');
console.log(`registry: ${path.relative(root, registryPath)}`);
console.log(`packages: ${registry.packages.length}`);
