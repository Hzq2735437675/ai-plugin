import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeProject, parseArgs, resolveRoots } from './project-tools-lib.mjs';
import { normalizePath, readJson } from './feature-tools-lib.mjs';

export function verifyAcceptanceCoverageManifest(file) {
  const manifest = readJson(file);
  const root = path.dirname(file);
  const violations = [];
  const supportedTypes = new Set(['acceptance', 'page-state', 'permission', 'api']);
  const coverage = Array.isArray(manifest.coverage) ? manifest.coverage : [];
  const seenIds = new Set();
  let mapped = 0;

  if (manifest.schemaVersion !== 1) violations.push({ code: 'coverage-schema-version', message: `${file} 使用了不支持的 schemaVersion。` });
  if (manifest.kind !== 'ai-baseline-acceptance-coverage') violations.push({ code: 'coverage-kind', message: `${file} 不是验收覆盖清单。` });
  if (!Array.isArray(manifest.coverage)) violations.push({ code: 'coverage-list', message: `${file} 缺少 coverage 数组。` });

  for (const item of coverage) {
    const itemViolations = [];
    if (!supportedTypes.has(item.type)) itemViolations.push({ code: 'coverage-type', id: item.id, message: `${item.id || 'unknown'} 使用了不支持的覆盖类型 ${item.type || 'missing'}。` });
    if (!item.id) itemViolations.push({ code: 'coverage-id', message: `${file} 存在无 id 覆盖项。` });
    else if (seenIds.has(item.id)) itemViolations.push({ code: 'coverage-id-duplicate', id: item.id, message: `${file} 存在重复覆盖项 ${item.id}。` });
    else seenIds.add(item.id);
    if (!item.marker || typeof item.marker !== 'string') itemViolations.push({ code: 'coverage-marker', id: item.id, message: `${item.id || 'unknown'} 缺少可审计 marker。` });
    if (typeof item.automated !== 'boolean') itemViolations.push({ code: 'coverage-automated', id: item.id, message: `${item.id || 'unknown'} 必须显式声明 automated。` });
    if (!Array.isArray(item.files) || !item.files.length) itemViolations.push({ code: 'coverage-files', id: item.id, message: `${item.id || 'unknown'} 没有映射测试文件。` });

    for (const relative of item.files || []) {
      const target = path.resolve(root, relative);
      const within = path.relative(root, target);
      if (within.startsWith('..') || path.isAbsolute(within)) {
        itemViolations.push({ code: 'coverage-path', id: item.id, message: `${item.id} 引用了测试目录外文件。` });
        continue;
      }
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
        itemViolations.push({ code: 'coverage-file-missing', id: item.id, path: relative, message: `${item.id} 缺少覆盖文件 ${relative}。` });
        continue;
      }
      if (!fs.readFileSync(target, 'utf8').includes(item.marker || item.id)) {
        itemViolations.push({ code: 'coverage-marker-missing', id: item.id, path: relative, message: `${relative} 未包含覆盖标记 ${item.marker || item.id}。` });
      }
    }

    if (!itemViolations.length) mapped += 1;
    violations.push(...itemViolations);
  }

  const automated = coverage.filter((item) => item.automated === true).length;
  const expectedStructuralCoverage = coverage.length ? Math.round((mapped / coverage.length) * 100) : 100;
  const expectedAutomatedCoverage = coverage.length ? Math.round((automated / coverage.length) * 100) : 100;
  if (manifest.summary?.total !== coverage.length) violations.push({ code: 'coverage-total-mismatch', message: `summary.total 与覆盖项数量不一致: ${manifest.summary?.total ?? 'missing'}/${coverage.length}。` });
  if (manifest.summary?.mapped !== mapped) violations.push({ code: 'coverage-mapped-mismatch', message: `summary.mapped 与实际有效映射不一致: ${manifest.summary?.mapped ?? 'missing'}/${mapped}。` });
  if (manifest.summary?.automated !== automated) violations.push({ code: 'coverage-automated-mismatch', message: `summary.automated 与自动化覆盖项不一致: ${manifest.summary?.automated ?? 'missing'}/${automated}。` });
  if (manifest.summary?.structuralCoverage !== expectedStructuralCoverage) violations.push({ code: 'coverage-structural-percentage', message: `structuralCoverage 应为 ${expectedStructuralCoverage}。` });
  if (manifest.summary?.automatedCoverage !== expectedAutomatedCoverage) violations.push({ code: 'coverage-automated-percentage', message: `automatedCoverage 应为 ${expectedAutomatedCoverage}。` });

  return { valid: violations.length === 0, file, manifest, calculated: { total: coverage.length, mapped, automated, structuralCoverage: expectedStructuralCoverage, automatedCoverage: expectedAutomatedCoverage }, violations };
}

export function checkProjectAcceptanceCoverage(projectRoot, { requireManifests = false } = {}) {
  const absoluteProjectRoot = path.resolve(projectRoot); const report = analyzeProject(absoluteProjectRoot); const root = report.layers.modules_root === 'unknown' ? '' : path.join(absoluteProjectRoot, report.layers.modules_root); const files = []; const moduleMetaFiles = [];
  const walk = (directory) => { if (!directory || !fs.existsSync(directory)) return; for (const entry of fs.readdirSync(directory, { withFileTypes: true })) { const target = path.join(directory, entry.name); if (entry.isDirectory()) walk(target); else if (entry.name.endsWith('.acceptance-coverage.json')) files.push(target); else if (entry.name === 'module.meta.json') moduleMetaFiles.push(target); } };
  walk(root); const reports = files.map(verifyAcceptanceCoverageManifest); const violations = reports.flatMap((item) => item.violations); const manifestSet = new Set(files.map((file) => path.resolve(file)));
  for (const metaFile of moduleMetaFiles) {
    const meta = readJson(metaFile); const moduleRoot = path.dirname(metaFile);
    for (const provenance of meta.provenance || []) {
      if (!String(provenance).endsWith('.feature.json')) continue;
      const featureFile = path.resolve(absoluteProjectRoot, provenance); const relativeFeature = path.relative(absoluteProjectRoot, featureFile);
      if (relativeFeature.startsWith('..') || path.isAbsolute(relativeFeature)) { violations.push({ code: 'coverage-provenance-outside', path: normalizePath(path.relative(absoluteProjectRoot, metaFile)), message: `模块来源规格越出项目边界: ${provenance}。` }); continue; }
      if (!fs.existsSync(featureFile)) { violations.push({ code: 'coverage-feature-spec-missing', path: normalizePath(relativeFeature), message: `模块声明的 Feature Spec 不存在: ${normalizePath(relativeFeature)}。` }); continue; }
      const feature = readJson(featureFile); const featureId = feature.feature?.id;
      if (!featureId) { violations.push({ code: 'coverage-feature-id-missing', path: normalizePath(relativeFeature), message: `Feature Spec 缺少 feature.id: ${normalizePath(relativeFeature)}。` }); continue; }
      const expected = path.resolve(moduleRoot, 'tests', `${featureId}.acceptance-coverage.json`);
      if (!manifestSet.has(expected)) violations.push({ code: 'coverage-manifest-missing', path: normalizePath(path.relative(absoluteProjectRoot, expected)), message: `Feature ${featureId} 缺少验收覆盖清单。` });
    }
  }
  if (requireManifests && !files.length) violations.push({ code: 'coverage-manifest-missing', message: '项目没有验收覆盖清单。' });
  return { valid: violations.length === 0, projectRoot: absoluteProjectRoot, manifests: files.map((file) => normalizePath(path.relative(absoluteProjectRoot, file))), reports, violations };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const args = parseArgs(process.argv.slice(2)); const { projectRoot: defaultRoot } = resolveRoots(import.meta.url); const result = checkProjectAcceptanceCoverage(path.resolve(args['project-root'] || defaultRoot), { requireManifests: Boolean(args.require) });
  console.log(`acceptance-coverage-check: ${result.valid ? 'pass' : 'fail'}`); console.log(`manifests: ${result.manifests.length}`); for (const item of result.violations) console.log(`violation: ${item.code}: ${item.message}`); if (args.json) console.log(JSON.stringify(result, null, 2)); if (!result.valid) process.exit(1);
}
