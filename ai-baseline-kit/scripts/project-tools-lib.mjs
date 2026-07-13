import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const STANDARD_PROFILES = Object.freeze({
  'react18-antd-tailwind-ts': {
    id: 'react18-antd-tailwind-ts',
    name: 'React 18 + Vite + Ant Design + Tailwind CSS + TypeScript',
    framework: 'React 18',
    ui_library: 'Ant Design 5',
    language: 'TypeScript',
    build_tool: 'Vite',
    router: 'React Router 6',
    state_manager: 'project-defined',
    i18n: 'project-defined',
    style_solution: 'Tailwind CSS 3 + project-defined local styles',
    template: 'templates/react18-antd-tailwind-ts',
    shell_root: 'src/app',
    shared_root: 'src/shared',
    modules_root: 'src/modules',
    base_components_root: 'src/shared/components',
    common_assets_root: 'src/assets',
    entrypoint: 'src/main.tsx',
    router_entrypoint: 'src/app/AppRoutes.tsx',
    module_assembler: 'src/app/module-assembler.ts',
  },
  'vue3-vite-ts': {
    id: 'vue3-vite-ts',
    name: 'Vue 3 + Vite + Vue Router + TypeScript',
    framework: 'Vue 3',
    ui_library: 'project-defined',
    language: 'TypeScript',
    build_tool: 'Vite',
    router: 'Vue Router 4',
    state_manager: 'project-defined',
    i18n: 'project-defined',
    style_solution: 'project-defined local styles',
    template: 'templates/vue3-vite-ts',
    shell_root: 'src/app',
    shared_root: 'src/shared',
    modules_root: 'src/modules',
    base_components_root: 'src/shared/components',
    common_assets_root: 'src/assets',
    entrypoint: 'src/main.ts',
    router_entrypoint: 'src/app/router.ts',
    module_assembler: 'src/app/module-assembler.ts',
  },
});

export const DEFAULT_PROFILE_ID = 'react18-antd-tailwind-ts';

const FRAMEWORK_DEPENDENCIES = [
  ['Vue', ['vue', '@vitejs/plugin-vue']],
  ['React', ['react', '@vitejs/plugin-react', '@vitejs/plugin-react-swc']],
  ['Angular', ['@angular/core', '@angular/cli']],
  ['Svelte', ['svelte', '@sveltejs/vite-plugin-svelte']],
];

const UI_DEPENDENCIES = [
  ['Ant Design', ['antd']],
  ['Ant Design Vue', ['ant-design-vue']],
  ['Material UI', ['@mui/material']],
  ['Element Plus', ['element-plus']],
  ['Element UI', ['element-ui']],
];

const STATE_DEPENDENCIES = [
  ['Pinia', ['pinia']],
  ['Vuex', ['vuex']],
  ['Zustand', ['zustand']],
  ['Redux Toolkit', ['@reduxjs/toolkit', 'redux']],
];

const I18N_DEPENDENCIES = [
  ['Vue I18n', ['vue-i18n']],
  ['i18next', ['i18next', 'react-i18next']],
  ['React Intl', ['react-intl']],
];

const STYLE_DEPENDENCIES = [
  ['Tailwind CSS', ['tailwindcss']],
  ['Sass', ['sass', 'sass-loader']],
  ['Less', ['less', 'less-loader']],
  ['CSS-in-JS', ['styled-components', '@emotion/react']],
];

const ENTRYPOINT_CANDIDATES = [
  'src/main.tsx',
  'src/main.ts',
  'src/main.jsx',
  'src/main.js',
  'src/index.tsx',
  'src/index.ts',
  'src/App.vue',
  'src/app/App.tsx',
  'src/app/App.vue',
  'app/page.tsx',
  'pages/index.tsx',
];

const ROUTER_CANDIDATES = [
  'src/app/router.ts',
  'src/router/index.ts',
  'src/router.ts',
  'src/routes/index.ts',
  'src/routes.ts',
  'src/app/AppRoutes.tsx',
];

const MODULE_ROOT_CANDIDATES = ['src/modules', 'src/features', 'modules', 'features'];

function normalize(value) {
  return value.replace(/\\/g, '/');
}

function safeReadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function readPackageManifest(projectRoot) {
  const file = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(file)) return { file: '', data: null };
  return { file: 'package.json', data: safeReadJson(file) };
}

function dependencyMap(packageData) {
  const map = new Map();
  for (const bucket of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [name, version] of Object.entries(packageData?.[bucket] ?? {})) {
      if (!map.has(name)) map.set(name, String(version));
    }
  }
  return map;
}

function firstDependency(map, names) {
  return names.find((name) => map.has(name)) ?? '';
}

function identifyDependency(map, candidates) {
  for (const [label, names] of candidates) {
    const dependency = firstDependency(map, names);
    if (dependency) return { label, dependency };
  }
  return { label: 'unknown', dependency: '' };
}

function firstExisting(projectRoot, candidates) {
  return candidates.find((candidate) => fs.existsSync(path.join(projectRoot, candidate))) ?? '';
}

function directoryExists(projectRoot, candidate) {
  return fs.existsSync(path.join(projectRoot, candidate))
    && fs.statSync(path.join(projectRoot, candidate)).isDirectory();
}

function detectBuildTool(map, configFiles) {
  if (map.has('vite') || configFiles.some((file) => file.startsWith('vite.config'))) return 'Vite';
  if (map.has('next') || configFiles.some((file) => file.startsWith('next.config'))) return 'Next.js';
  if (map.has('nuxt') || configFiles.some((file) => file.startsWith('nuxt.config'))) return 'Nuxt';
  if (map.has('webpack') || configFiles.some((file) => file.startsWith('webpack.config'))) return 'Webpack';
  if (map.has('@angular/cli') || configFiles.includes('angular.json')) return 'Angular CLI';
  return 'unknown';
}

function detectRouter(map) {
  if (map.has('react-router-dom')) return 'React Router 6';
  if (map.has('vue-router')) return 'Vue Router 4';
  if (map.has('@angular/router')) return 'Angular Router';
  return 'unknown';
}

function detectLanguage(map, projectRoot) {
  if (map.has('typescript') || fs.existsSync(path.join(projectRoot, 'tsconfig.json'))) return 'TypeScript';
  if (fs.existsSync(path.join(projectRoot, 'jsconfig.json'))) return 'JavaScript';
  return 'unknown';
}

function detectConfigFiles(projectRoot) {
  const names = [
    'vite.config.ts', 'vite.config.js', 'vite.config.mjs',
    'next.config.js', 'next.config.mjs', 'next.config.ts',
    'nuxt.config.ts', 'nuxt.config.js',
    'webpack.config.js', 'webpack.config.ts',
    'angular.json', 'astro.config.mjs',
    'tailwind.config.ts', 'tailwind.config.js',
    'postcss.config.cjs', 'eslint.config.js', '.eslintrc.js',
  ];
  return names.filter((name) => fs.existsSync(path.join(projectRoot, name)));
}

function detectModules(projectRoot) {
  const root = MODULE_ROOT_CANDIDATES.find((candidate) => directoryExists(projectRoot, candidate)) ?? '';
  if (!root) return { root: 'unknown', items: [] };
  const items = fs.readdirSync(path.join(projectRoot, root), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const moduleRoot = normalize(path.join(root, entry.name));
      const manifest = firstExisting(projectRoot, [
        `${moduleRoot}/manifest.ts`,
        `${moduleRoot}/manifest.tsx`,
        `${moduleRoot}/manifest.js`,
        `${moduleRoot}/manifest.json`,
        `${moduleRoot}/manifest.yml`,
      ]);
      return {
        name: entry.name,
        root: moduleRoot,
        manifest: manifest || 'unknown',
      };
    });
  return { root, items };
}

function detectEntrypoints(projectRoot) {
  return {
    app: firstExisting(projectRoot, ENTRYPOINT_CANDIDATES) || 'unknown',
    router: firstExisting(projectRoot, ROUTER_CANDIDATES) || 'unknown',
    module_assembler: firstExisting(projectRoot, [
      'src/app/module-assembler.ts',
      'src/app/module-assembler.tsx',
      'src/app/module-assembler.js',
      'src/app/module-assembler.tsx',
    ]) || 'unknown',
    api_client: firstExisting(projectRoot, [
      'src/shared/api/client.ts',
      'src/api/client.ts',
      'src/services/http.ts',
      'src/services/api.ts',
      'src/api/index.ts',
    ]) || 'unknown',
  };
}

function detectValidation(packageData, profile) {
  const scripts = packageData?.scripts ?? {};
  return {
    typecheck: scripts.typecheck ? 'npm run typecheck' : 'unknown',
    lint: scripts.lint ? 'npm run lint' : 'unknown',
    test: scripts.test ? 'npm test' : 'unknown',
    build: scripts.build ? 'npm run build' : profile ? 'npm run build' : 'unknown',
  };
}

function hasApplicationSignal(projectRoot, packageManifest, configFiles) {
  return Boolean(
    packageManifest.file
    || configFiles.length
    || firstExisting(projectRoot, ['index.html', 'src', 'app', 'pages'])
  );
}

function findProfile(id) {
  if (!id) return null;
  const profile = STANDARD_PROFILES[id];
  if (!profile) throw new Error(`不支持的标准模板: ${id}。可选值: ${Object.keys(STANDARD_PROFILES).join(', ')}`);
  return profile;
}

export function analyzeProject(projectRoot, options = {}) {
  const absoluteRoot = path.resolve(projectRoot);
  const { file: packageFile, data: packageData } = readPackageManifest(absoluteRoot);
  const dependencyVersions = dependencyMap(packageData);
  const configFiles = detectConfigFiles(absoluteRoot);
  const existing = hasApplicationSignal(absoluteRoot, { file: packageFile }, configFiles);
  const requestedProfile = findProfile(options.requestedProfile);
  const initializedProfile = findProfile(options.initializedProfile);
  const detectedFramework = identifyDependency(dependencyVersions, FRAMEWORK_DEPENDENCIES);
  const detectedUi = identifyDependency(dependencyVersions, UI_DEPENDENCIES);
  const detectedState = identifyDependency(dependencyVersions, STATE_DEPENDENCIES);
  const detectedI18n = identifyDependency(dependencyVersions, I18N_DEPENDENCIES);
  const detectedStyle = identifyDependency(dependencyVersions, STYLE_DEPENDENCIES);
  const buildTool = detectBuildTool(dependencyVersions, configFiles);
  const router = detectRouter(dependencyVersions);
  const language = detectLanguage(dependencyVersions, absoluteRoot);
  const modules = detectModules(absoluteRoot);
  const entrypoints = detectEntrypoints(absoluteRoot);

  const initialized = Boolean(initializedProfile);
  let mode = existing && !initialized ? 'existing-project' : 'new-frontend-project';
  let profile = initializedProfile;
  if (!profile && !existing) profile = requestedProfile ?? STANDARD_PROFILES[DEFAULT_PROFILE_ID];

  const stack = existing
    ? {
        framework: detectedFramework.label,
        ui_library: detectedUi.label,
        language,
        build_tool: buildTool,
        router,
        state_manager: detectedState.label,
        i18n: detectedI18n.label,
        style_solution: detectedStyle.label,
      }
    : {
        framework: profile.framework,
        ui_library: profile.ui_library,
        language: profile.language,
        build_tool: profile.build_tool,
        router: profile.router,
        state_manager: profile.state_manager,
        i18n: profile.i18n,
        style_solution: profile.style_solution,
      };

  const roots = existing
    ? {
        shell_root: directoryExists(absoluteRoot, 'src/app') ? 'src/app' : 'unknown',
        shared_root: directoryExists(absoluteRoot, 'src/shared') ? 'src/shared' : 'unknown',
        modules_root: modules.root,
        base_components_root: directoryExists(absoluteRoot, 'src/shared/components') ? 'src/shared/components' : 'unknown',
        common_assets_root: directoryExists(absoluteRoot, 'src/assets') ? 'src/assets' : 'unknown',
      }
    : {
        shell_root: profile.shell_root,
        shared_root: profile.shared_root,
        modules_root: profile.modules_root,
        base_components_root: profile.base_components_root,
        common_assets_root: profile.common_assets_root,
      };

  const evidence = [];
  if (packageFile) evidence.push(`发现 ${packageFile}`);
  if (configFiles.length) evidence.push(`发现构建/工具配置: ${configFiles.join(', ')}`);
  if (detectedFramework.dependency) evidence.push(`框架依赖: ${detectedFramework.dependency}`);
  if (requestedProfile) evidence.push(`用户指定标准模板: ${requestedProfile.id}`);
  if (initialized) evidence.push(`已初始化标准模板: ${initializedProfile.id}`);
  if (!existing && !initialized) evidence.push(`新前端项目默认模板: ${(profile ?? STANDARD_PROFILES[DEFAULT_PROFILE_ID]).id}`);
  if (modules.root !== 'unknown') evidence.push(`模块根目录: ${modules.root}`);

  return {
    schemaVersion: 1,
    projectRoot: absoluteRoot,
    mode,
    profile: profile?.id ?? 'existing-project-detected',
    package: {
      name: packageData?.name ?? path.basename(absoluteRoot),
      version: packageData?.version ?? 'unknown',
      manifest: packageFile || 'unknown',
      dependencies: Object.fromEntries(dependencyVersions),
    },
    stack,
    layers: roots,
    entrypoints,
    modules,
    validation: detectValidation(packageData, profile),
    confidence: existing && !initialized ? (detectedFramework.label === 'unknown' ? 'medium' : 'high') : 'high',
    evidence,
    warnings: [
      ...(existing && !initialized && detectedFramework.label === 'unknown' ? ['已检测到项目文件，但无法可靠识别框架。'] : []),
      ...(existing && !initialized && !packageFile ? ['未发现 package.json，部分技术栈信息可能不完整。'] : []),
    ],
  };
}

function yamlScalar(value) {
  const text = String(value ?? 'unknown');
  if (/^[A-Za-z0-9_./@:+-]+$/.test(text)) return text;
  return `'${text.replaceAll("'", "''")}'`;
}

function yamlList(items, indent = '  ') {
  if (!items?.length) return [`${indent}[]`];
  return items.map((item) => `${indent}- ${yamlScalar(item)}`);
}

function currentDate() {
  return new Date().toISOString().slice(0, 10);
}

export function buildProjectScheme(report, options = {}) {
  const profile = STANDARD_PROFILES[report.profile] ?? null;
  const projectName = report.package.name || path.basename(report.projectRoot);
  const schemeVersion = options.schemeVersion ?? '0.3.0';
  const modules = report.modules.items ?? [];
  const lines = [
    'project:',
    `  name: ${yamlScalar(projectName)}`,
    '  map_status: target-project',
    '  purpose: AI 可读、可控边界和可持续维护的项目地图。',
    `  scheme_version: ${yamlScalar(schemeVersion)}`,
    `  updated_at: ${currentDate()}`,
    '  update_source: project-bootstrap',
    '',
    'stack:',
    ...Object.entries(report.stack).map(([key, value]) => `  ${key}: ${yamlScalar(value)}`),
    '',
    'layers:',
    ...Object.entries(report.layers).map(([key, value]) => `  ${key}: ${yamlScalar(value)}`),
    '',
    'entrypoints:',
    ...Object.entries(report.entrypoints).map(([key, value]) => `  ${key}: ${yamlScalar(value)}`),
    '',
    'modules:',
    `  root: ${yamlScalar(report.modules.root)}`,
    '  manifest_pattern: manifest.ts-or-equivalent',
    '  items:',
  ];

  if (!modules.length) {
    lines.push('    []');
  } else {
    for (const module of modules) {
      lines.push(`    - name: ${yamlScalar(module.name)}`);
      lines.push(`      root: ${yamlScalar(module.root)}`);
      lines.push(`      manifest: ${yamlScalar(module.manifest)}`);
    }
  }

  lines.push(
    '',
    'validation:',
    ...Object.entries(report.validation).map(([key, value]) => `  ${key}: ${yamlScalar(value)}`),
    '',
    'stack_selection:',
    `  mode: ${yamlScalar(report.mode)}`,
    `  selected_profile: ${yamlScalar(report.profile)}`,
    '  supported_standard_profiles:',
    ...yamlList(Object.keys(STANDARD_PROFILES), '    '),
    '  user_override: allowed-before-initialization',
    '',
    'required_questions: []',
    `confidence: ${yamlScalar(report.confidence)}`,
    'evidence:',
    ...yamlList(report.evidence, '  '),
    '',
  );
  return `${lines.join('\n')}\n`;
}

export function writeProjectScheme(report, baselineRoot, options = {}) {
  const file = path.join(baselineRoot, 'docs', 'project-scheme.yml');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buildProjectScheme(report, options), 'utf8');
  return file;
}

function shouldIgnoreCopyEntry(name) {
  return ['node_modules', 'dist', 'build', '.git', 'coverage'].includes(name);
}

export function copyDirectory(source, destination, options = {}) {
  if (!fs.existsSync(source)) throw new Error(`模板目录不存在: ${source}`);
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (shouldIgnoreCopyEntry(entry.name)) continue;
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, destinationPath, options);
    } else {
      if (fs.existsSync(destinationPath) && !options.force) {
        throw new Error(`目标文件已存在，未覆盖: ${normalize(path.relative(options.projectRoot ?? destination, destinationPath))}`);
      }
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

export function projectHasBusinessFiles(projectRoot) {
  if (!fs.existsSync(projectRoot)) return false;
  const ignored = new Set(['ai-baseline-kit', '.git', '.github', '.vscode']);
  return fs.readdirSync(projectRoot, { withFileTypes: true })
    .some((entry) => !ignored.has(entry.name));
}

export function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    const [key, inlineValue] = token.slice(2).split('=', 2);
    if (inlineValue !== undefined) {
      args[key] = inlineValue;
    } else if (argv[index + 1] && !argv[index + 1].startsWith('--')) {
      args[key] = argv[index + 1];
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

export function resolveRoots(scriptUrl) {
  const scriptDirectory = path.dirname(fileURLToPath(scriptUrl));
  const baselineRoot = path.resolve(scriptDirectory, '..');
  return { baselineRoot, projectRoot: path.resolve(baselineRoot, '..') };
}

export function profileTemplatePath(baselineRoot, profileId) {
  const profile = findProfile(profileId);
  return path.join(baselineRoot, profile.template);
}
