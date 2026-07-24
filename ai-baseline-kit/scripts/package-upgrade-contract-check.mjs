#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyDirectory } from './project-tools-lib.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const sourceKit = path.resolve(scriptDir, '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-baseline-upgrade-'));

function runRaw(projectRoot, script, args = []) {
  return spawnSync(process.execPath, [path.join(projectRoot, 'ai-baseline-kit', 'scripts', script), ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
}

function run(projectRoot, script, args = []) {
  const result = runRaw(projectRoot, script, ['--project-root', projectRoot, ...args]);
  assert.equal(result.status, 0, `${script} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

function copyKit(projectRoot) {
  copyDirectory(sourceKit, path.join(projectRoot, 'ai-baseline-kit'), { force: false, projectRoot });
}

function assertSafeTemp(target) {
  const resolved = path.resolve(target);
  assert.ok(resolved.startsWith(path.resolve(tempRoot) + path.sep), `unsafe temp target: ${resolved}`);
}

try {
  const project = path.join(tempRoot, 'existing-project');
  fs.mkdirSync(path.join(project, 'src'), { recursive: true });
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({ name: 'upgrade-fixture', dependencies: { vue: '^3.5.0' }, devDependencies: { vite: '^6.0.0', typescript: '^5.0.0' }, scripts: {} }, null, 2));
  fs.writeFileSync(path.join(project, 'src', 'main.ts'), 'export {};\n');
  copyKit(project);
  run(project, 'project-bootstrap.mjs');

  const stateRoot = path.join(project, '.ai-frontend-assembler');
  const schemeFile = path.join(stateRoot, 'project-scheme.yml');
  const legacyFile = path.join(stateRoot, 'legacy-baseline.json');
  assert.ok(fs.existsSync(schemeFile));
  assert.ok(fs.existsSync(legacyFile));
  assert.ok(fs.existsSync(path.join(project, 'AGENTS.md')));
  assert.ok(fs.existsSync(path.join(project, 'CLAUDE.md')));
  assert.ok(!fs.existsSync(path.join(project, '.cursor')));
  assert.ok(!fs.existsSync(path.join(project, '.github', 'copilot-instructions.md')));
  const schemeBefore = fs.readFileSync(schemeFile, 'utf8');
  const legacyBefore = fs.readFileSync(legacyFile, 'utf8');

  const installedKit = path.join(project, 'ai-baseline-kit');
  assertSafeTemp(installedKit);
  fs.rmSync(installedKit, { recursive: true, force: true });
  copyKit(project);
  assert.equal(fs.readFileSync(schemeFile, 'utf8'), schemeBefore);
  assert.equal(fs.readFileSync(legacyFile, 'utf8'), legacyBefore);
  const upgradeOutput = runRaw(project, 'ai-run.mjs', ['upgrade', '--project-root', project]);
  assert.equal(upgradeOutput.status, 0, `ai-run upgrade failed:\n${upgradeOutput.stdout}\n${upgradeOutput.stderr}`);
  assert.match(`${upgradeOutput.stdout}${upgradeOutput.stderr}`, /project-upgrade: pass/);
  assert.equal(fs.readFileSync(schemeFile, 'utf8'), schemeBefore, 'upgrade must not regenerate project scheme');
  assert.equal(fs.readFileSync(legacyFile, 'utf8'), legacyBefore, 'upgrade must not refresh legacy baseline');
  assert.ok(fs.existsSync(path.join(project, 'AGENTS.md')));
  assert.ok(fs.existsSync(path.join(project, 'CLAUDE.md')));
  assert.ok(!fs.existsSync(path.join(project, '.cursor')));
  assert.ok(!fs.existsSync(path.join(project, '.github', 'copilot-instructions.md')));
  const unsupported = runRaw(project, 'ai-run.mjs', ['unsupported-command', '--project-root', project]);
  assert.notEqual(unsupported.status, 0, 'ai-run must reject unsupported commands');
  assert.match(`${unsupported.stdout}${unsupported.stderr}`, /不支持的统一入口命令/);

  const legacyProject = path.join(tempRoot, 'legacy-0.9-project');
  fs.mkdirSync(legacyProject, { recursive: true });
  fs.writeFileSync(path.join(legacyProject, 'package.json'), JSON.stringify({ name: 'legacy-fixture' }));
  copyKit(legacyProject);
  const legacyKitDocs = path.join(legacyProject, 'ai-baseline-kit', 'docs');
  const legacyScheme = 'project:\n  name: legacy-fixture\n  map_status: target-project\n';
  const legacySnapshot = JSON.stringify({ schemaVersion: 1, kind: 'ai-baseline-legacy-snapshot', violations: [] }, null, 2) + '\n';
  fs.writeFileSync(path.join(legacyKitDocs, 'project-scheme.yml'), legacyScheme);
  fs.writeFileSync(path.join(legacyKitDocs, 'legacy-baseline.json'), legacySnapshot);
  const output = run(legacyProject, 'project-upgrade.mjs');
  assert.match(output, /migrated: 2/);
  assert.equal(fs.readFileSync(path.join(legacyProject, '.ai-frontend-assembler', 'project-scheme.yml'), 'utf8'), legacyScheme);
  assert.equal(fs.readFileSync(path.join(legacyProject, '.ai-frontend-assembler', 'legacy-baseline.json'), 'utf8'), legacySnapshot);

  console.log('package-upgrade-contract-check: pass');
} finally {
  assertSafeTemp(path.join(tempRoot, 'cleanup'));
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
