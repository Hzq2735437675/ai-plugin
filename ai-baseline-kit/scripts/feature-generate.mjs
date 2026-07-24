#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs, resolveRoots } from './project-tools-lib.mjs';
import { acceptanceDevDependencies, writeAcceptanceTests } from './acceptance-test-lib.mjs';
import {
  blockingQuestions,
  camelCase,
  ensureInside,
  normalizePath,
  pascalCase,
  readJson,
  relativeImport,
  slugify,
  unique,
  writeJson,
} from './feature-tools-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const { baselineRoot, projectRoot: defaultProjectRoot } = resolveRoots(import.meta.url);
const projectRoot = path.resolve(args['project-root'] || defaultProjectRoot);
const specFile = path.resolve(args.spec || '');
const planFile = path.resolve(args.plan || args._[0] || '');
const changed = [];

function quote(value) {
  return `'${String(value ?? '').replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

function writeFile(file, content, options = {}) {
  ensureInside(projectRoot, file);
  if (fs.existsSync(file) && !options.force && !args.force) throw new Error(`目标文件已存在，未覆盖: ${normalizePath(path.relative(projectRoot, file))}`);
  if (args['dry-run']) {
    changed.push(`create:${normalizePath(path.relative(projectRoot, file))}`);
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
  changed.push(`create:${normalizePath(path.relative(projectRoot, file))}`);
}

function updateFile(file, transform) {
  ensureInside(projectRoot, file);
  const before = fs.readFileSync(file, 'utf8');
  const after = transform(before);
  if (after === before) return;
  if (!args['dry-run']) fs.writeFileSync(file, after, 'utf8');
  changed.push(`modify:${normalizePath(path.relative(projectRoot, file))}`);
}

function insertBefore(text, marker, line) {
  if (text.includes(line)) return text;
  const index = text.indexOf(marker);
  if (index < 0) throw new Error(`受控标记不存在: ${marker}`);
  return `${text.slice(0, index)}${line}\n${text.slice(index)}`;
}

function pageDefinitions(spec, framework) {
  return (spec.pages ?? []).map((page, index) => {
    const id = slugify(page.id, `page-${index + 1}`);
    return {
      ...page,
      id,
      component: `${pascalCase(id)}Page`,
      extension: /vue/i.test(framework) ? 'vue' : 'tsx',
    };
  });
}

function renderReactPage(page) {
  return `import '../../styles/index.css';\n\nexport function ${page.component}() {\n  return (\n    <section className="module-page">\n      <header className="module-page__header">\n        <h1>${page.name}</h1>\n        <p>该页面由功能规格生成，请按验收条件补充业务实现。</p>\n      </header>\n      <div className="module-page__content" data-page-state="ready">\n        <p>路由：${page.route}</p>\n      </div>\n    </section>\n  );\n}\n`;
}

function usesElementPlus(uiLibrary) {
  return /element\s*plus/i.test(uiLibrary || '');
}

function defaultNpmDependencies(framework, uiLibrary) {
  if (/vue/i.test(framework) && usesElementPlus(uiLibrary)) return ['element-plus'];
  if (/react|preact/i.test(framework)) return ['react'];
  return [];
}

function renderVuePage(page, uiLibrary) {
  if (!usesElementPlus(uiLibrary)) {
    return `<script setup lang="ts">\nimport '../../styles/index.css';\n</script>\n\n<template>\n  <section class="module-page">\n    <header class="module-page__header">\n      <h1>${page.name}</h1>\n      <p>该页面由功能规格生成，请按验收条件补充业务实现。</p>\n    </header>\n    <div class="module-page__content" data-page-state="ready">\n      <p>路由：${page.route}</p>\n    </div>\n  </section>\n</template>\n`;
  }

  return `<script setup lang="ts">\nimport '../../styles/index.css';\n</script>\n\n<template>\n  <section class="module-page">\n    <header class="module-page__header">\n      <h1>${page.name}</h1>\n      <p>该页面由功能规格生成，请按验收条件补充业务实现。</p>\n    </header>\n    <el-alert title="页面结构已生成" type="info" :closable="false" show-icon />\n    <el-card class="module-page__content" shadow="never" data-page-state="ready">\n      <p>路由：${page.route}</p>\n    </el-card>\n  </section>\n</template>\n`;
}

function renderRoutes(moduleVar, pages, framework) {
  const imports = pages.map((page) => /vue/i.test(framework)
    ? `import ${page.component} from './pages/${page.id}/index.vue';`
    : `import { ${page.component} } from './pages/${page.id}/index';`).join('\n');
  const entries = pages.map((page) => /vue/i.test(framework)
    ? `  { name: ${quote(`${moduleVar}-${page.id}`)}, path: ${quote(page.route)}, component: ${page.component} },`
    : `  { name: ${quote(`${moduleVar}-${page.id}`)}, path: ${quote(page.route)}, element: createElement(${page.component}) },`).join('\n');
  const reactImport = /vue/i.test(framework) ? '' : "import { createElement } from 'react';\n";
  return `${reactImport}// ai-baseline:route-imports:start\n${imports}${imports ? '\n' : ''}// ai-baseline:route-imports:end\nimport type { ModuleRoute } from '${moduleVar.typeImport}';\n\nexport const ${moduleVar.camel}Routes: ModuleRoute[] = [\n  // ai-baseline:route-list:start\n${entries}${entries ? '\n' : ''}  // ai-baseline:route-list:end\n];\n`;
}

function renderAcceptance(spec) {
  const items = (spec.acceptance ?? []).map((item) => `## ${item.id}\n\n- Given: ${item.given}\n- When: ${item.when}\n- Then: ${item.then}\n`).join('\n');
  return `# ${spec.feature.title}验收条件\n\n${items || '- 待补充可执行验收条件。\n'}`;
}

function updateAssembler(assemblerFile, moduleRoot, variable) {
  const importTarget = relativeImport(assemblerFile, path.join(moduleRoot, 'index'));
  const importLine = `import { moduleManifest as ${variable}Module } from '${importTarget}';`;
  updateFile(assemblerFile, (text) => {
    let next = insertBefore(text, '// ai-baseline:module-imports:end', importLine);
    next = insertBefore(next, '  // ai-baseline:module-list:end', `  ${variable}Module,`);
    return next;
  });
}

function updateGeneratedModule(moduleRoot, moduleVar, pages, spec, npmDependencies, devDependencies) {
  const routesFile = path.join(moduleRoot, 'routes.ts');
  for (const page of pages) {
    const importLine = /vue/i.test(moduleVar.framework)
      ? `import ${page.component} from './pages/${page.id}/index.vue';`
      : `import { ${page.component} } from './pages/${page.id}/index';`;
    const entryLine = /vue/i.test(moduleVar.framework)
      ? `  { name: ${quote(`${moduleVar.id}-${page.id}`)}, path: ${quote(page.route)}, component: ${page.component} },`
      : `  { name: ${quote(`${moduleVar.id}-${page.id}`)}, path: ${quote(page.route)}, element: createElement(${page.component}) },`;
    updateFile(routesFile, (text) => insertBefore(insertBefore(text, '// ai-baseline:route-imports:end', importLine), '  // ai-baseline:route-list:end', entryLine));
  }

  const menuFile = path.join(moduleRoot, 'menu.ts');
  for (const page of pages.filter((item) => item.menu !== false)) {
    const line = `  { key: ${quote(`${moduleVar.id}-${page.id}`)}, label: ${quote(page.name)}, path: ${quote(page.route)} },`;
    updateFile(menuFile, (text) => insertBefore(text, '  // ai-baseline:menu-list:end', line));
  }

  const accessFile = path.join(moduleRoot, 'access.ts');
  for (const permission of unique([...(spec.permissions ?? []), ...pages.map((page) => page.permission)])) {
    updateFile(accessFile, (text) => insertBefore(text, '  // ai-baseline:access-list:end', `  ${quote(permission)},`));
  }

  const metaFile = path.join(moduleRoot, 'module.meta.json');
  const meta = readJson(metaFile);
  meta.title ||= spec.feature.title;
  meta.aliases = unique([...(meta.aliases ?? []), spec.feature.title, spec.feature.domain]);
  meta.capabilities = unique([...(meta.capabilities ?? []), ...(spec.capabilities ?? [])]);
  meta.permissions = unique([...(meta.permissions ?? []), ...(spec.permissions ?? [])]);
  meta.dependencies ??= { modules: [], shared: [], npm: [], dev: [] };
  meta.dependencies.npm = unique([...(meta.dependencies.npm ?? []), ...npmDependencies, ...(spec.dependencies?.npm ?? [])]);
  meta.dependencies.dev = unique([...(meta.dependencies.dev ?? []), ...devDependencies]);
  meta.provenance = unique([...(meta.provenance ?? []), normalizePath(path.relative(projectRoot, specFile))]);
  if (!args['dry-run']) writeJson(metaFile, meta);
  changed.push(`modify:${normalizePath(path.relative(projectRoot, metaFile))}`);

  const manifestDependencies = meta.dependencies.npm;
  const manifestDevDependencies = meta.dependencies.dev;
  updateFile(path.join(moduleRoot, 'manifest.ts'), (text) => {
    let next = text.replace(/npm:\s*\[[^\]]*\],/, `npm: ${JSON.stringify(manifestDependencies)},`);
    if (/\bdev:\s*\[/.test(next)) return next.replace(/dev:\s*\[[^\]]*\],/, `dev: ${JSON.stringify(manifestDevDependencies)},`);
    return next.replace(/(npm:\s*\[[^\]]*\],)/, `$1\n    dev: ${JSON.stringify(manifestDevDependencies)},`);
  });
  updateFile(path.join(moduleRoot, 'acceptance.md'), (text) => `${text.trim()}\n\n${renderAcceptance(spec).replace(/^# .+\n+/, '')}`);
}

try {
  if (!specFile || !fs.existsSync(specFile)) throw new Error('请通过 --spec <feature-spec.json> 提供功能规格。');
  if (!planFile || !fs.existsSync(planFile)) throw new Error('请通过 --plan <change-plan.json> 提供架构计划。');
  const spec = readJson(specFile);
  const plan = readJson(planFile);
  const blockers = [...blockingQuestions(spec), ...blockingQuestions(plan)];
  if (spec.status !== 'ready' || plan.status !== 'ready' || blockers.length) throw new Error('功能规格或架构计划仍有必须确认项，禁止生成代码。');
  if (!['create-module', 'extend-module'].includes(plan.decision?.type)) throw new Error(`确定性生成器暂不处理 ${plan.decision?.type}；请由 AI 严格按文件计划实现。`);

  const framework = plan.project?.framework || '';
  const uiLibrary = plan.project?.uiLibrary || '';
  if (!/react|preact|vue/i.test(framework)) throw new Error(`不支持的生成框架: ${framework}`);
  const moduleId = slugify(plan.ownership?.module);
  const moduleRoot = ensureInside(projectRoot, path.join(projectRoot, plan.ownership.moduleRoot), '模块路径');
  const camel = camelCase(moduleId);
  const pascal = pascalCase(moduleId);
  const sharedContract = path.join(projectRoot, plan.ownership.sharedRoot, 'types', 'module');
  const typeImport = relativeImport(path.join(moduleRoot, 'manifest.ts'), sharedContract);
  const pages = pageDefinitions(spec, framework);
  const moduleVar = { id: moduleId, camel, pascal, framework, typeImport };
  const npmDependencies = defaultNpmDependencies(framework, uiLibrary);
  const devDependencies = acceptanceDevDependencies(framework);

  for (const page of pages) {
    const pageFile = path.join(moduleRoot, 'pages', page.id, `index.${page.extension}`);
    if (!fs.existsSync(pageFile) || args.force) writeFile(pageFile, /vue/i.test(framework) ? renderVuePage(page, uiLibrary) : renderReactPage(page), { force: Boolean(args.force) });
  }

  if (plan.decision.type === 'create-module') {
    const moduleMeta = {
      schemaVersion: 1,
      kind: 'ai-baseline-module',
      name: moduleId,
      title: spec.feature.title,
      aliases: unique([spec.feature.title, spec.feature.domain]),
      version: '0.1.0',
      domain: spec.feature.domain || moduleId,
      archetype: spec.feature.archetype || 'custom',
      ownership: 'module',
      capabilities: spec.capabilities ?? [],
      entrypoints: { public: 'index.ts', manifest: 'manifest.ts', routes: 'routes.ts', menus: 'menu.ts', access: 'access.ts' },
      dependencies: { modules: [], shared: spec.dependencies?.shared ?? [], npm: unique([...npmDependencies, ...(spec.dependencies?.npm ?? [])]), dev: devDependencies },
      permissions: spec.permissions ?? [],
      portability: { sameStackOnly: true, shellPrivateImports: false, crossModuleImports: false },
      provenance: [normalizePath(path.relative(projectRoot, specFile))],
    };
    writeFile(path.join(moduleRoot, 'module.meta.json'), `${JSON.stringify(moduleMeta, null, 2)}\n`);
    writeFile(path.join(moduleRoot, 'index.ts'), `export { ${camel}Module, ${camel}Module as moduleManifest } from './manifest';\nexport { ${camel}Routes, ${camel}Routes as routes } from './routes';\nexport { ${camel}Menus, ${camel}Menus as menus } from './menu';\nexport { ${camel}Access, ${camel}Access as access } from './access';\nexport { ${camel}Locales, ${camel}Locales as locales } from './locales';\nexport { ${camel}Stores, ${camel}Stores as stores } from './stores';\nexport { ${camel}Directives, ${camel}Directives as directives } from './directives';\n`);
    writeFile(path.join(moduleRoot, 'routes.ts'), renderRoutes(moduleVar, pages, framework));
    const menuEntries = pages.filter((page) => page.menu !== false).map((page) => `  { key: ${quote(`${moduleId}-${page.id}`)}, label: ${quote(page.name)}, path: ${quote(page.route)} },`).join('\n');
    writeFile(path.join(moduleRoot, 'menu.ts'), `import type { ModuleMenu } from '${relativeImport(path.join(moduleRoot, 'menu.ts'), sharedContract)}';\n\nexport const ${camel}Menus: ModuleMenu[] = [\n  // ai-baseline:menu-list:start\n${menuEntries}${menuEntries ? '\n' : ''}  // ai-baseline:menu-list:end\n];\n`);
    const permissions = unique([...(spec.permissions ?? []), ...pages.map((page) => page.permission)]);
    writeFile(path.join(moduleRoot, 'access.ts'), `export const ${camel}Access = [\n  // ai-baseline:access-list:start\n${permissions.map((item) => `  ${quote(item)},`).join('\n')}${permissions.length ? '\n' : ''}  // ai-baseline:access-list:end\n] as const;\n`);
    writeFile(path.join(moduleRoot, 'locales', 'index.ts'), `export const ${camel}Locales = [${quote(`${moduleId}.title`)}] as const;\n`);
    writeFile(path.join(moduleRoot, 'stores', 'index.ts'), `export const ${camel}Stores: string[] = [];\n`);
    writeFile(path.join(moduleRoot, 'directives', 'index.ts'), `export const ${camel}Directives: string[] = [];\n`);
    writeFile(path.join(moduleRoot, 'components', 'index.ts'), 'export {};\n');
    writeFile(path.join(moduleRoot, 'types', 'index.ts'), 'export {};\n');
    const apiDescriptors = (spec.api ?? []).map((item) => `  { id: ${quote(item.id)}, method: ${quote(item.method)}, path: ${quote(item.path)} },`).join('\n');
    writeFile(path.join(moduleRoot, 'api', 'index.ts'), `export const ${camel}Api = [\n${apiDescriptors}${apiDescriptors ? '\n' : ''}] as const;\n`);
    writeFile(path.join(moduleRoot, 'styles', 'index.css'), `.module-page {\n  display: grid;\n  gap: var(--app-space-lg, 24px);\n}\n\n.module-page__header h1,\n.module-page__header p {\n  margin: 0;\n}\n\n.module-page__content {\n  padding: var(--app-space-lg, 24px);\n  background: var(--app-color-bg-container);\n  border: 1px solid var(--app-color-border);\n  border-radius: var(--app-border-radius);\n}\n`);
    writeFile(path.join(moduleRoot, 'assets', 'README.md'), `# ${spec.feature.title} assets\n\n仅存放 ${moduleId} 模块私有资源。\n`);
    writeFile(path.join(moduleRoot, 'acceptance.md'), renderAcceptance(spec));
    const deps = unique([...npmDependencies, ...(spec.dependencies?.npm ?? [])]);
    writeFile(path.join(moduleRoot, 'manifest.ts'), `import { ${camel}Access } from './access';\nimport { ${camel}Directives } from './directives';\nimport { ${camel}Locales } from './locales';\nimport { ${camel}Menus } from './menu';\nimport { ${camel}Routes } from './routes';\nimport { ${camel}Stores } from './stores';\nimport type { ModuleManifest } from '${typeImport}';\n\nexport const ${camel}Module = {\n  name: ${quote(moduleId)},\n  version: '0.1.0',\n  domain: ${quote(spec.feature.domain || moduleId)},\n  routes: ${camel}Routes,\n  menus: ${camel}Menus,\n  access: ${camel}Access,\n  locales: ${camel}Locales,\n  stores: ${camel}Stores,\n  directives: ${camel}Directives,\n  dependencies: {\n    shared: ${JSON.stringify(spec.dependencies?.shared ?? [])},\n    base_components: ${JSON.stringify(spec.ui?.reuse ?? [])},\n    npm: ${JSON.stringify(deps)},\n    dev: ${JSON.stringify(devDependencies)},\n    env: [],\n    assets: [],\n    permissions: ${JSON.stringify(spec.permissions ?? [])},\n  },\n} satisfies ModuleManifest;\n`);
    updateAssembler(path.join(projectRoot, plan.assembly.moduleAssembler), moduleRoot, camel);
  } else {
    updateGeneratedModule(moduleRoot, moduleVar, pages, spec, npmDependencies, devDependencies);
  }

  writeAcceptanceTests({
    moduleRoot,
    spec,
    framework,
    force: Boolean(args.force),
    writeFile,
  });

  if (!args['dry-run'] && !args['skip-bootstrap']) {
    const bootstrap = spawnSync(process.execPath, [path.join(baselineRoot, 'scripts', 'project-bootstrap.mjs'), '--project-root', projectRoot, '--no-legacy-baseline'], { cwd: projectRoot, encoding: 'utf8' });
    if (bootstrap.status !== 0) throw new Error(`代码已生成，但项目地图更新失败: ${bootstrap.stderr || bootstrap.stdout}`);
  }

  console.log('feature-generate: pass');
  console.log(`decision: ${plan.decision.type}`);
  console.log(`module: ${normalizePath(path.relative(projectRoot, moduleRoot))}`);
  console.log(`changes: ${changed.length}`);
  for (const item of changed) console.log(`- ${item}`);
} catch (error) {
  console.error(`feature-generate: fail: ${error.message}`);
  process.exit(1);
}

