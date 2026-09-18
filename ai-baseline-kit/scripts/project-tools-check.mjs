#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  analyzeProject,
  buildProjectScheme,
  copyDirectory,
  ensureRootEntrypoints,
  readPackageVersion,
  resolveRoots,
  resolveTypecheckScript,
  STANDARD_PROFILES,
} from './project-tools-lib.mjs';

const { baselineRoot } = resolveRoots(import.meta.url);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-baseline-tools-'));
try {
  const emptyProject = path.join(tempRoot, 'empty');
  fs.mkdirSync(emptyProject, { recursive: true });
  const entrypointProject = path.join(tempRoot, 'entrypoints');
  fs.mkdirSync(entrypointProject, { recursive: true });
  assert.deepEqual(ensureRootEntrypoints(entrypointProject), ['AGENTS.md', 'CLAUDE.md']);
  for (const file of ['AGENTS.md', 'CLAUDE.md']) {
    const text = fs.readFileSync(path.join(entrypointProject, file), 'utf8');
    assert.match(text, /ai-baseline-kit\/AGENTS\.md/);
    assert.match(text, /有效交付回执/);
  }
  assert.deepEqual(ensureRootEntrypoints(entrypointProject), []);

  const customEntrypointProject = path.join(tempRoot, 'custom-entrypoints');
  fs.mkdirSync(customEntrypointProject, { recursive: true });
  fs.writeFileSync(path.join(customEntrypointProject, 'AGENTS.md'), '# 原项目规则\n\n不要修改 legacy/。\n');
  fs.writeFileSync(path.join(customEntrypointProject, 'CLAUDE.md'), '# Claude 原规则\n\n使用 pnpm。\n');
  assert.deepEqual(ensureRootEntrypoints(customEntrypointProject), ['AGENTS.md', 'CLAUDE.md']);
  const customAgents = fs.readFileSync(path.join(customEntrypointProject, 'AGENTS.md'), 'utf8');
  const customClaude = fs.readFileSync(path.join(customEntrypointProject, 'CLAUDE.md'), 'utf8');
  assert.match(customAgents, /不要修改 legacy\//);
  assert.match(customClaude, /使用 pnpm/);
  assert.equal((customAgents.match(/ai-baseline-kit:entrypoint:start/g) || []).length, 1);
  assert.equal((customClaude.match(/ai-baseline-kit:entrypoint:start/g) || []).length, 1);
  assert.deepEqual(ensureRootEntrypoints(customEntrypointProject), []);

  const legacyEntrypointProject = path.join(tempRoot, 'legacy-entrypoints');
  fs.mkdirSync(legacyEntrypointProject, { recursive: true });
  const legacyRules = '# 旧版项目规则\n\n读取 ai-baseline-kit/AGENTS.md。\n按 ai-baseline-kit/skills/baseline-structure-skill/SKILL.md 与 ai-baseline-kit/skills/baseline-conformance-skill/SKILL.md 执行。\n';
  fs.writeFileSync(path.join(legacyEntrypointProject, 'AGENTS.md'), legacyRules);
  fs.writeFileSync(path.join(legacyEntrypointProject, 'CLAUDE.md'), legacyRules);
  assert.deepEqual(ensureRootEntrypoints(legacyEntrypointProject), ['AGENTS.md', 'CLAUDE.md']);
  for (const file of ['AGENTS.md', 'CLAUDE.md']) {
    const upgraded = fs.readFileSync(path.join(legacyEntrypointProject, file), 'utf8');
    assert.match(upgraded, /# 旧版项目规则/);
    assert.equal((upgraded.match(/ai-baseline-kit:entrypoint:start/g) || []).length, 1);
    assert.match(upgraded, /有效交付回执/);
  }
  assert.deepEqual(ensureRootEntrypoints(legacyEntrypointProject), []);

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

  const packageVersion = readPackageVersion(baselineRoot);
  const template = fs.readFileSync(path.join(baselineRoot, 'docs', 'project-scheme.template.yml'), 'utf8');
  const templateVersion = template.match(/^\s*scheme_version:\s*['"]?([^'"\r\n]+)['"]?\s*$/m)?.[1];
  const generatedVersion = buildProjectScheme(emptyReport).match(/^\s*scheme_version:\s*['"]?([^'"\r\n]+)['"]?\s*$/m)?.[1];
  assert.equal(templateVersion, packageVersion, 'project-scheme 模板版本必须与 plugin.json 一致');
  assert.equal(generatedVersion, packageVersion, 'project-scheme 生成版本必须与 plugin.json 一致');

  assert.equal(resolveTypecheckScript({ typecheck: 'tsc --noEmit' }), 'typecheck');
  assert.equal(resolveTypecheckScript({ 'type-check': 'tsc --noEmit' }), 'type-check');
  assert.equal(resolveTypecheckScript({ typecheck: 'tsc --noEmit', 'type-check': 'vue-tsc --noEmit' }), 'typecheck');
  assert.equal(resolveTypecheckScript({}), '');

  const validationFixtures = [
    { manager: 'npm', scripts: { typecheck: 'tsc --noEmit' }, expected: 'npm run typecheck' },
    { manager: 'pnpm', scripts: { 'type-check': 'vue-tsc --noEmit' }, expected: 'pnpm run type-check' },
    { manager: 'yarn', scripts: { typecheck: 'tsc --noEmit' }, expected: 'yarn typecheck' },
    { manager: 'bun', scripts: { 'type-check': 'tsc --noEmit' }, expected: 'bun run type-check' },
  ];
  for (const fixture of validationFixtures) {
    const fixtureRoot = path.join(tempRoot, `validation-${fixture.manager}`);
    fs.mkdirSync(fixtureRoot, { recursive: true });
    fs.writeFileSync(path.join(fixtureRoot, 'package.json'), JSON.stringify({
      name: `validation-${fixture.manager}`,
      packageManager: `${fixture.manager}@1.0.0`,
      scripts: fixture.scripts,
    }));
    assert.equal(analyzeProject(fixtureRoot).validation.typecheck, fixture.expected);
  }
  const noValidationRoot = path.join(tempRoot, 'validation-none');
  fs.mkdirSync(noValidationRoot, { recursive: true });
  fs.writeFileSync(path.join(noValidationRoot, 'package.json'), JSON.stringify({ name: 'validation-none', scripts: {} }));
  assert.equal(analyzeProject(noValidationRoot).validation.typecheck, 'unknown');

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
