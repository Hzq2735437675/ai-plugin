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
  assert.equal(STANDARD_PROFILES['react18-antd-tailwind-ts'].theme, 'src/theme/theme.css');
  assert.equal(STANDARD_PROFILES['vue3-vite-ts'].theme, 'src/theme/theme.css');
  assert.equal(STANDARD_PROFILES['vue3-vite-ts'].ui_library, 'Element Plus');

  const vueProject = path.join(tempRoot, 'vue');
  fs.mkdirSync(path.join(vueProject, 'src', 'modules', 'home'), { recursive: true });
  fs.writeFileSync(path.join(vueProject, 'package.json'), JSON.stringify({
    name: 'vue-fixture',
    dependencies: { vue: '^3.5.0', 'vue-router': '^4.0.0', 'element-plus': '^2.14.3', pinia: '^2.0.0' },
    devDependencies: { vite: '^6.0.0', typescript: '^5.0.0', '@vitejs/plugin-vue': '^5.0.0' },
    scripts: { typecheck: 'vue-tsc --noEmit', build: 'vite build' },
  }));
  fs.writeFileSync(path.join(vueProject, 'vite.config.ts'), 'export default {}');
  fs.writeFileSync(path.join(vueProject, 'src', 'main.ts'), '');
  fs.writeFileSync(path.join(vueProject, 'src', 'modules', 'home', 'manifest.ts'), '');
  fs.writeFileSync(path.join(vueProject, 'src', 'modules', 'home', 'module.meta.json'), '{}');
  fs.mkdirSync(path.join(vueProject, 'src', 'theme'), { recursive: true });
  fs.writeFileSync(path.join(vueProject, 'src', 'theme', 'theme.css'), ':root {}\n');
  const vueReport = analyzeProject(vueProject);
  assert.equal(vueReport.mode, 'existing-project');
  assert.equal(vueReport.stack.framework, 'Vue');
  assert.equal(vueReport.stack.router, 'Vue Router 4');
  assert.equal(vueReport.stack.ui_library, 'Element Plus');
  assert.equal(vueReport.modules.root, 'src/modules');
  assert.equal(vueReport.modules.items[0].name, 'home');
  assert.equal(vueReport.modules.items[0].metadata, 'src/modules/home/module.meta.json');
  assert.equal(vueReport.entrypoints.theme, 'src/theme/theme.css');

  const initializedVueReport = analyzeProject(vueProject, { initializedProfile: 'vue3-vite-ts' });
  assert.equal(initializedVueReport.mode, 'new-frontend-project');
  assert.equal(initializedVueReport.profile, 'vue3-vite-ts');
  assert.equal(initializedVueReport.stack.ui_library, 'Element Plus');
  assert.equal(initializedVueReport.entrypoints.theme, 'src/theme/theme.css');

  const preservedVueReport = analyzeProject(vueProject, { preservedProfile: 'vue3-vite-ts' });
  assert.equal(preservedVueReport.mode, 'new-frontend-project');
  assert.equal(preservedVueReport.profile, 'vue3-vite-ts');

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
  assert.match(buildProjectScheme(vueReport), /theme: src\/theme\/theme.css/);
  assert.match(buildProjectScheme(vueReport), /metadata: src\/modules\/home\/module.meta.json/);
  assert.equal(Object.keys(STANDARD_PROFILES).length, 2);

  const templateDestination = path.join(tempRoot, 'copied-template');
  copyDirectory(path.join(baselineRoot, 'templates', 'vue3-vite-ts'), templateDestination, { force: false, projectRoot: templateDestination });
  assert.ok(fs.existsSync(path.join(templateDestination, 'package.json')));
  assert.ok(fs.existsSync(path.join(templateDestination, 'src', 'app', 'router.ts')));
  assert.ok(fs.existsSync(path.join(templateDestination, 'src', 'theme', 'theme.css')));
  assert.ok(fs.existsSync(path.join(templateDestination, 'src', 'modules', 'home', 'module.meta.json')));
  const copiedPackage = JSON.parse(fs.readFileSync(path.join(templateDestination, 'package.json'), 'utf8'));
  assert.ok(copiedPackage.dependencies['element-plus']);
  assert.ok(copiedPackage.devDependencies['unplugin-vue-components']);
  const copiedViteConfig = fs.readFileSync(path.join(templateDestination, 'vite.config.ts'), 'utf8');
  assert.match(copiedViteConfig, /Components\(/);
  assert.match(copiedViteConfig, /dts:\s*false/);
  assert.match(copiedViteConfig, /ElementPlusResolver\(\{ importStyle: 'css' \}\)/);
  const copiedTsconfig = JSON.parse(fs.readFileSync(path.join(templateDestination, 'tsconfig.json'), 'utf8'));
  assert.ok(copiedTsconfig.compilerOptions.types.includes('element-plus/global'));
  const copiedMain = fs.readFileSync(path.join(templateDestination, 'src', 'main.ts'), 'utf8');
  assert.match(copiedMain, /createApp\(App\)\.use\(router\)\.mount\('#app'\)/);
  assert.doesNotMatch(copiedMain, /import ElementPlus from 'element-plus'/);
  assert.doesNotMatch(copiedMain, /element-plus\/dist\/index\.css/);
  assert.doesNotMatch(copiedMain, /\.use\(ElementPlus\)/);

  console.log('project-tools-check: pass');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
