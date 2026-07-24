import fs from 'node:fs';
import path from 'node:path';

export const PROJECT_STATE_DIRECTORY = '.ai-frontend-assembler';
export const PROJECT_STATE_SCHEMA_VERSION = 1;

function normalize(value) {
  return value.replace(/\\/g, '/');
}

function readText(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function readMapStatus(file) {
  const match = readText(file).match(/^\s*map_status:\s*['"]?([^'"\r\n]+)['"]?\s*$/m);
  return match?.[1]?.trim() || '';
}

function readPackageVersion(baselineRoot) {
  try {
    return JSON.parse(fs.readFileSync(path.join(baselineRoot, 'plugin.json'), 'utf8')).version || 'unknown';
  } catch {
    return 'unknown';
  }
}

export function getProjectStatePaths(projectRoot, baselineRoot) {
  const resolvedProjectRoot = path.resolve(projectRoot);
  const resolvedBaselineRoot = path.resolve(baselineRoot);
  const stateRoot = path.join(resolvedProjectRoot, PROJECT_STATE_DIRECTORY);
  return {
    projectRoot: resolvedProjectRoot,
    baselineRoot: resolvedBaselineRoot,
    stateRoot,
    schemeFile: path.join(stateRoot, 'project-scheme.yml'),
    legacyBaselineFile: path.join(stateRoot, 'legacy-baseline.json'),
    manifestFile: path.join(stateRoot, 'state.json'),
    adaptersRoot: path.join(stateRoot, 'adapters'),
    legacySchemeFile: path.join(resolvedBaselineRoot, 'docs', 'project-scheme.yml'),
    legacyLegacyBaselineFile: path.join(resolvedBaselineRoot, 'docs', 'legacy-baseline.json'),
  };
}

export function isPackageRepositoryReferenceFile(file) {
  return readMapStatus(file) === 'package-repository-reference';
}

export function resolveProjectSchemeFile(projectRoot, baselineRoot) {
  const paths = getProjectStatePaths(projectRoot, baselineRoot);
  if (fs.existsSync(paths.schemeFile)) return paths.schemeFile;
  if (fs.existsSync(paths.legacySchemeFile)) return paths.legacySchemeFile;
  return paths.schemeFile;
}

export function resolveLegacyBaselineFile(projectRoot, baselineRoot) {
  const paths = getProjectStatePaths(projectRoot, baselineRoot);
  if (fs.existsSync(paths.legacyBaselineFile)) return paths.legacyBaselineFile;
  if (fs.existsSync(paths.legacyLegacyBaselineFile)) return paths.legacyLegacyBaselineFile;
  return paths.legacyBaselineFile;
}

function copyIfMissing(source, destination, migrations) {
  if (!fs.existsSync(source) || fs.existsSync(destination)) return;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  migrations.push({ from: normalize(source), to: normalize(destination) });
}

export function writeProjectStateManifest({ projectRoot, baselineRoot, mode = 'target-project' }) {
  const paths = getProjectStatePaths(projectRoot, baselineRoot);
  fs.mkdirSync(paths.stateRoot, { recursive: true });
  let previous = {};
  try {
    previous = JSON.parse(fs.readFileSync(paths.manifestFile, 'utf8'));
  } catch {
    previous = {};
  }
  const now = new Date().toISOString();
  const manifest = {
    schemaVersion: PROJECT_STATE_SCHEMA_VERSION,
    kind: 'ai-frontend-assembler-project-state',
    storage: 'project-external',
    packageDirectory: path.basename(paths.baselineRoot),
    packageVersion: readPackageVersion(paths.baselineRoot),
    createdAt: previous.createdAt || now,
    updatedAt: now,
    mode,
    files: {
      projectScheme: `${PROJECT_STATE_DIRECTORY}/project-scheme.yml`,
      legacyBaseline: `${PROJECT_STATE_DIRECTORY}/legacy-baseline.json`,
      adapters: `${PROJECT_STATE_DIRECTORY}/adapters`,
    },
    upgrade: {
      strategy: 'replace-package-directory',
      packageStateSeparated: true,
    },
  };
  fs.writeFileSync(paths.manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return paths.manifestFile;
}

export function migrateLegacyProjectState({ projectRoot, baselineRoot, create = false } = {}) {
  const paths = getProjectStatePaths(projectRoot, baselineRoot);
  const migrations = [];
  const legacySchemeIsTarget = fs.existsSync(paths.legacySchemeFile)
    && !isPackageRepositoryReferenceFile(paths.legacySchemeFile);

  if (legacySchemeIsTarget) copyIfMissing(paths.legacySchemeFile, paths.schemeFile, migrations);
  copyIfMissing(paths.legacyLegacyBaselineFile, paths.legacyBaselineFile, migrations);

  if (create || fs.existsSync(paths.stateRoot) || migrations.length) {
    const scheme = resolveProjectSchemeFile(projectRoot, baselineRoot);
    const mode = isPackageRepositoryReferenceFile(scheme) ? 'package-repository-reference' : 'target-project';
    writeProjectStateManifest({ projectRoot, baselineRoot, mode });
  }

  return { ...paths, migrations };
}

export function projectStateRelative(projectRoot, file) {
  return normalize(path.relative(path.resolve(projectRoot), path.resolve(file)));
}
