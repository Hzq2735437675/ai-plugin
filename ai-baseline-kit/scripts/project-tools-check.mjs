#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  analyzeProject,
  buildProjectScheme,
  copyDirectory,
  STANDARD_PROFILES,
  resolveRoots,
} from './project-tools-lib.mjs';

const { baselineRoot } = resolveRoots(import.meta.url);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-baseline-tools-'));
try {
  const emptyProject = path.join(tempRoot, 'empty');
  fs.mkdirSync(emptyProject, { recursive: true });
  const emptyReport = analyzeProject(emptyProject);
  assert.equal(emptyReport.mode, 'new-frontend-project');
  assert.equal(emptyReport.profile, 'react18-antd-tailwind-ts');

  const vueProject = path.join(tempRoot, 'vue');
  fs.mkdirSync(path.join(vueProject, 'src', 'modules', 'home'), { recursive: true });
  fs.writeFileSync(path.join(vueProject, 'package.json'), JSON.stringify({
    name: 'vue-fixture',
    dependencies: { vue: '^3.5.0', 'vue-router': '^4.0.0', pinia: '^2.0.0' },
    devDependencies: { vite: '^6.0.0', typescript: '^5.0.0', '@vitejs/plugin-vue': '^5.0.0' },
    scripts: { typecheck: 'vue-tsc --noEmit', build: 'vite build' },
  }));
  fs.writeFileSync(path.join(vueProject, 'vite.config.ts'), 'export default {}');
  fs.writeFileSync(path.join(vueProject, 'src', 'main.ts'), '');
  fs.writeFileSync(path.join(vueProject, 'src', 'modules', 'home', 'manifest.ts'), '');
  const vueReport = analyzeProject(vueProject);
  assert.equal(vueReport.mode, 'existing-project');
  assert.equal(vueReport.stack.framework, 'Vue');
  assert.equal(vueReport.stack.router, 'Vue Router 4');
  assert.equal(vueReport.modules.root, 'src/modules');
  assert.equal(vueReport.modules.items[0].name, 'home');

  const initializedVueReport = analyzeProject(vueProject, { initializedProfile: 'vue3-vite-ts' });
  assert.equal(initializedVueReport.mode, 'new-frontend-project');
  assert.equal(initializedVueReport.profile, 'vue3-vite-ts');

  const reactProject = path.join(tempRoot, 'react');
  fs.mkdirSync(path.join(reactProject, 'src'), { recursive: true });
  fs.writeFileSync(path.join(reactProject, 'package.json'), JSON.stringify({
    name: 'react-fixture',
    dependencies: { react: '^18.3.0', 'react-dom': '^18.3.0', 'react-router-dom': '^6.0.0', antd: '^5.0.0' },
    devDependencies: { vite: '^5.0.0', typescript: '^5.0.0', '@vitejs/plugin-react': '^4.0.0', tailwindcss: '^3.0.0' },
  }));
  const reactReport = analyzeProject(reactProject);
  assert.equal(reactReport.mode, 'existing-project');
  assert.equal(reactReport.stack.framework, 'React');
  assert.equal(reactReport.stack.ui_library, 'Ant Design');
  assert.equal(reactReport.stack.router, 'React Router 6');

  const scheme = buildProjectScheme(emptyReport);
  assert.match(scheme, /map_status: target-project/);
  assert.match(scheme, /selected_profile: react18-antd-tailwind-ts/);
  assert.equal(Object.keys(STANDARD_PROFILES).length, 2);

  const templateDestination = path.join(tempRoot, 'copied-template');
  copyDirectory(path.join(baselineRoot, 'templates', 'vue3-vite-ts'), templateDestination, { force: false, projectRoot: templateDestination });
  assert.ok(fs.existsSync(path.join(templateDestination, 'package.json')));
  assert.ok(fs.existsSync(path.join(templateDestination, 'src', 'app', 'router.ts')));

  console.log('project-tools-check: pass');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
