#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { copyDirectory, resolveRoots } from './project-tools-lib.mjs';

const { baselineRoot } = resolveRoots(import.meta.url);
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-build-isolation-contract-'));

function run(projectRoot, script, args = []) {
  return spawnSync(process.execPath, [path.join(projectRoot, 'ai-baseline-kit', 'scripts', script), ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
}

function output(result) {
  return `${result.stdout || ''}\n${result.stderr || ''}`;
}

try {
  const projectRoot = path.join(tempRoot, 'existing-project');
  fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, '.dockerignore'), 'node_modules/\n', 'utf8');
  fs.writeFileSync(path.join(projectRoot, 'package.json'), `${JSON.stringify({
    name: 'build-isolation-fixture',
    version: '1.0.0',
    private: true,
    scripts: { build: 'vite build', postbuild: 'node scripts/existing-postbuild.mjs' },
    dependencies: { vue: '^3.5.0' },
    devDependencies: { vite: '^6.0.0', typescript: '^5.0.0' },
  }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(projectRoot, 'src', 'main.ts'), 'export {};\n', 'utf8');
  copyDirectory(baselineRoot, path.join(projectRoot, 'ai-baseline-kit'), { force: false, projectRoot });

  const bootstrap = run(projectRoot, 'project-bootstrap.mjs', ['--project-root', projectRoot]);
  assert.equal(bootstrap.status, 0, `bootstrap failed:\n${output(bootstrap)}`);
  assert.match(bootstrap.stdout, /build-isolation: updated/);

  for (const ignoreFile of ['.dockerignore', '.vercelignore']) {
    const text = fs.readFileSync(path.join(projectRoot, ignoreFile), 'utf8');
    assert.match(text, /ai-baseline-kit\//);
    assert.match(text, /\.ai-frontend-assembler\//);
  }
  assert.match(fs.readFileSync(path.join(projectRoot, '.dockerignore'), 'utf8'), /node_modules\//, 'existing ignore rules must be preserved');
  assert.equal(fs.readFileSync(path.join(projectRoot, 'ai-baseline-kit', '.npmignore'), 'utf8').trim(), '*');
  assert.equal(fs.readFileSync(path.join(projectRoot, '.ai-frontend-assembler', '.npmignore'), 'utf8').trim(), '*');

  const packageData = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  assert.match(packageData.scripts.postbuild, /existing-postbuild/);
  assert.match(packageData.scripts.postbuild, /build-artifact-guard\.mjs --clean/);

  const beforeRerun = new Map(['.dockerignore', '.vercelignore', 'package.json'].map((file) => [file, fs.readFileSync(path.join(projectRoot, file), 'utf8')]));
  const rerun = run(projectRoot, 'project-bootstrap.mjs', ['--project-root', projectRoot]);
  assert.equal(rerun.status, 0, `bootstrap rerun failed:\n${output(rerun)}`);
  for (const [file, content] of beforeRerun) assert.equal(fs.readFileSync(path.join(projectRoot, file), 'utf8'), content, `${file} must be idempotent`);

  const forbiddenImportFile = path.join(projectRoot, 'src', 'forbidden-ai-import.ts');
  fs.writeFileSync(forbiddenImportFile, "import '../ai-baseline-kit/scripts/ai-run.mjs';\n", 'utf8');
  const importBoundary = run(projectRoot, 'baseline-check.mjs', ['--project-root', projectRoot]);
  assert.notEqual(importBoundary.status, 0, 'business source imports from ai-baseline-kit must fail validation');
  assert.match(output(importBoundary), /business_imports_ai_package/);
  fs.rmSync(forbiddenImportFile);

  const leakedKit = path.join(projectRoot, 'dist', 'nested', 'ai-baseline-kit');
  const leakedState = path.join(projectRoot, 'dist', '.ai-frontend-assembler');
  fs.mkdirSync(leakedKit, { recursive: true });
  fs.mkdirSync(leakedState, { recursive: true });
  fs.writeFileSync(path.join(leakedKit, 'AGENTS.md'), 'leak', 'utf8');
  fs.writeFileSync(path.join(leakedState, 'state.json'), '{}', 'utf8');

  const check = run(projectRoot, 'build-artifact-guard.mjs', ['--project-root', projectRoot, '--check']);
  assert.notEqual(check.status, 0, 'check-only mode must reject leaked AI artifacts');
  assert.match(output(check), /protected-artifacts-found: 2/);

  const clean = run(projectRoot, 'build-artifact-guard.mjs', ['--project-root', projectRoot, '--clean']);
  assert.equal(clean.status, 0, `clean mode failed:\n${output(clean)}`);
  assert.equal(fs.existsSync(leakedKit), false);
  assert.equal(fs.existsSync(leakedState), false);

  fs.writeFileSync(path.join(projectRoot, 'vite.config.ts'), "export default { build: { outDir: 'release-web' } };\n", 'utf8');
  const customLeak = path.join(projectRoot, 'release-web', 'ai-baseline-kit');
  fs.mkdirSync(customLeak, { recursive: true });
  const customClean = run(projectRoot, 'build-artifact-guard.mjs', ['--project-root', projectRoot]);
  assert.equal(customClean.status, 0, `custom output clean failed:\n${output(customClean)}`);
  assert.equal(fs.existsSync(customLeak), false, 'configured custom output directory must be protected');

  const pack = spawnSync('npm', ['pack', '--dry-run', '--json'], { cwd: projectRoot, encoding: 'utf8', shell: process.platform === 'win32' });
  assert.equal(pack.status, 0, `npm pack dry-run failed:\n${output(pack)}`);
  const packed = JSON.parse(pack.stdout);
  const files = packed[0]?.files?.map((item) => item.path) ?? [];
  assert.equal(files.some((file) => file.startsWith('ai-baseline-kit/')), false, 'npm pack must exclude ai-baseline-kit');
  assert.equal(files.some((file) => file.startsWith('.ai-frontend-assembler/')), false, 'npm pack must exclude assembler project state');

  const externalOutput = path.join(tempRoot, 'external-output');
  const linkedOutput = path.join(projectRoot, 'linked-output');
  const externalLeak = path.join(externalOutput, 'ai-baseline-kit');
  fs.mkdirSync(externalLeak, { recursive: true });
  fs.writeFileSync(path.join(externalLeak, 'AGENTS.md'), 'must-not-delete', 'utf8');
  fs.symlinkSync(externalOutput, linkedOutput, process.platform === 'win32' ? 'junction' : 'dir');
  const unsafeClean = run(projectRoot, 'build-artifact-guard.mjs', ['--project-root', projectRoot, '--clean', '--output', 'linked-output']);
  assert.notEqual(unsafeClean.status, 0, 'guard must reject output links that resolve outside the project root');
  assert.match(output(unsafeClean), /拒绝扫描项目目录之外的构建输出/);
  assert.equal(fs.existsSync(externalLeak), true, 'guard must never clean through an external output link');

  console.log('build-isolation-contract-check: pass');
  console.log('bootstrap-ignore-rules: pass');
  console.log('postbuild-guard-hook: pass');
  console.log('artifact-clean-and-verify: pass');
  console.log('artifact-path-safety: pass');
  console.log('npm-pack-exclusion: pass');
  console.log('business-import-boundary: pass');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
