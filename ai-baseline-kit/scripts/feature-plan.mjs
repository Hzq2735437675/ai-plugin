#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { analyzeProject, parseArgs, resolveRoots } from './project-tools-lib.mjs';
import {
  blockingQuestions,
  normalizePath,
  printQuestions,
  question,
  readJson,
  slugify,
  uniqueQuestions,
  writeJson,
} from './feature-tools-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const { baselineRoot, projectRoot: defaultProjectRoot } = resolveRoots(import.meta.url);
const projectRoot = path.resolve(args['project-root'] || defaultProjectRoot);
const specFile = path.resolve(args.spec || args._[0] || '');

function preservedProfile() {
  const schemeFile = path.join(baselineRoot, 'docs', 'project-scheme.yml');
  if (!fs.existsSync(schemeFile)) return undefined;
  const match = fs.readFileSync(schemeFile, 'utf8').match(/^\s*selected_profile:\s*['"]?([^'"\r\n]+)['"]?\s*$/m);
  const profile = match?.[1]?.trim();
  return profile && profile !== 'existing-project-detected' ? profile : undefined;
}

function sourceExtension(framework) {
  if (/vue/i.test(framework)) return '.vue';
  if (/react|preact/i.test(framework)) return '.tsx';
  return '';
}

function expectedFiles(moduleRoot, spec, framework) {
  const extension = sourceExtension(framework);
  const pages = (spec.pages ?? []).map((page) => path.join(moduleRoot, 'pages', slugify(page.id, 'feature'), `index${extension}`));
  return [
    path.join(moduleRoot, 'module.meta.json'),
    path.join(moduleRoot, 'index.ts'),
    path.join(moduleRoot, 'manifest.ts'),
    path.join(moduleRoot, 'routes.ts'),
    path.join(moduleRoot, 'menu.ts'),
    path.join(moduleRoot, 'access.ts'),
    path.join(moduleRoot, 'api', 'index.ts'),
    path.join(moduleRoot, 'types', 'index.ts'),
    path.join(moduleRoot, 'components', 'index.ts'),
    path.join(moduleRoot, 'stores', 'index.ts'),
    path.join(moduleRoot, 'directives', 'index.ts'),
    path.join(moduleRoot, 'locales', 'index.ts'),
    path.join(moduleRoot, 'styles', 'index.css'),
    path.join(moduleRoot, 'assets', 'README.md'),
    path.join(moduleRoot, 'acceptance.md'),
    ...pages,
  ].map(normalizePath);
}

try {
  if (!specFile || !fs.existsSync(specFile)) throw new Error('请通过 --spec <feature-spec.json> 提供已确认的功能规格。');
  const spec = readJson(specFile);
  const report = analyzeProject(projectRoot, { preservedProfile: preservedProfile() });
  const moduleName = slugify(spec.feature?.module || spec.feature?.domain || spec.feature?.id);
  const questions = [...blockingQuestions(spec)];
  const modulesRoot = report.layers.modules_root;
  const framework = report.stack.framework;

  if (!moduleName) questions.push(question('module-name', 'feature.module', '请确认模块英文标识。'));
  if (!modulesRoot || modulesRoot === 'unknown') questions.push(question('modules-root', 'layers.modules_root', '请确认旧项目的模块根目录。', '生成器不会猜测文件边界。'));
  if (!/react|preact|vue/i.test(framework)) questions.push(question('framework-generator', 'stack.framework', `当前识别框架为 ${framework}，请确认生成适配策略或由 AI 按计划实现。`, '内置确定性生成器当前支持 React/Preact/Vue。'));

  const moduleRoot = modulesRoot === 'unknown' ? 'unknown' : normalizePath(path.join(modulesRoot, moduleName));
  const moduleExists = moduleRoot !== 'unknown' && fs.existsSync(path.join(projectRoot, moduleRoot));
  const ownershipLayer = spec.feature?.ownership === 'shared' ? 'shared' : spec.feature?.ownership === 'shell' ? 'shell' : 'modules';
  const decisionType = ownershipLayer === 'shared' ? 'shared-capability' : moduleExists ? 'extend-module' : 'create-module';
  const assembler = report.entrypoints.module_assembler;
  const assemblerFile = assembler && assembler !== 'unknown' ? path.join(projectRoot, assembler) : '';

  if (decisionType === 'extend-module') {
    const controlledFiles = [
      ['routes.ts', 'ai-baseline:route-list:start'],
      ['menu.ts', 'ai-baseline:menu-list:start'],
      ['access.ts', 'ai-baseline:access-list:start'],
    ];
    for (const [fileName, marker] of controlledFiles) {
      const file = path.join(projectRoot, moduleRoot, fileName);
      if (!fs.existsSync(file) || !fs.readFileSync(file, 'utf8').includes(marker)) {
        questions.push(question(`module-marker-${fileName}`, `${moduleRoot}/${fileName}`, `已有模块缺少 ${marker} 受控标记，请确认由 AI 安全改造后再自动扩展。`, '生成器不会猜测改写任意旧模块契约。'));
      }
    }
    for (const required of ['module.meta.json', 'acceptance.md']) {
      if (!fs.existsSync(path.join(projectRoot, moduleRoot, required))) {
        questions.push(question(`module-contract-${required}`, `${moduleRoot}/${required}`, `已有模块缺少 ${required}，请先补齐可迁移模块契约。`));
      }
    }
  }

  if (decisionType === 'create-module') {
    if (!assemblerFile || !fs.existsSync(assemblerFile)) {
      questions.push(question('module-assembler', 'entrypoints.module_assembler', '请确认静态模块装配文件。', '新模块必须通过 shell 的唯一装配点接入。'));
    } else {
      const assemblerText = fs.readFileSync(assemblerFile, 'utf8');
      if (!assemblerText.includes('ai-baseline:module-imports:start') || !assemblerText.includes('ai-baseline:module-list:start')) {
        questions.push(question('assembler-markers', 'entrypoints.module_assembler', '现有装配文件缺少受控生成标记，请确认由 AI 安全改造装配点。', '生成器不会用不可靠正则改写任意旧项目装配代码。'));
      }
    }
    const sharedContract = report.layers.shared_root !== 'unknown'
      ? path.join(projectRoot, report.layers.shared_root, 'types', 'module.ts')
      : '';
    if (!sharedContract || !fs.existsSync(sharedContract)) {
      questions.push(question('module-type-contract', 'layers.shared_root', '请确认 ModuleManifest 公共类型契约位置。', '生成模块需要复用项目真实公共契约。'));
    }
  }

  const files = moduleRoot === 'unknown' ? [] : expectedFiles(moduleRoot, spec, framework);
  const plan = {
    $schema: '../change-plan.schema.json',
    schemaVersion: 1,
    kind: 'frontend-change-plan',
    status: 'needs-confirmation',
    featureSpec: normalizePath(path.relative(projectRoot, specFile)),
    project: {
      mode: report.mode,
      framework,
      uiLibrary: report.stack.ui_library,
      profile: report.profile,
      confidence: report.confidence,
    },
    decision: {
      type: decisionType,
      reason: decisionType === 'create-module'
        ? `业务域 ${moduleName} 尚无模块，创建可独立组合的模块。`
        : decisionType === 'extend-module'
          ? `业务域 ${moduleName} 已存在，功能应扩展该模块而不是创建重复模块。`
          : `该能力被明确归属为 ${ownershipLayer} 层。`,
    },
    ownership: { layer: ownershipLayer, module: moduleName, moduleRoot, sharedRoot: report.layers.shared_root },
    reuse: {
      shared: spec.dependencies?.shared ?? [],
      baseComponents: spec.ui?.reuse ?? [],
      forbiddenModuleImports: ['其他 modules 的私有文件'],
    },
    assembly: {
      moduleAssembler: assembler,
      routes: Boolean(spec.pages?.length),
      menus: Boolean(spec.pages?.some((page) => page.menu !== false)),
      access: Boolean(spec.permissions?.length),
      locales: report.stack.i18n !== 'unknown' && report.stack.i18n !== 'project-defined',
      stores: spec.state?.scope === 'module' && Boolean(spec.state?.items?.length),
      api: Boolean(spec.api?.length),
      theme: report.entrypoints.theme || 'unknown',
    },
    dependencies: {
      shared: spec.dependencies?.shared ?? [],
      npm: spec.dependencies?.npm ?? [],
      permissions: spec.permissions ?? [],
      modules: [],
    },
    files: {
      create: decisionType === 'create-module' ? files : files.filter((file) => !fs.existsSync(path.join(projectRoot, file))),
      modify: [assembler, decisionType === 'extend-module' ? moduleRoot : ''].filter(Boolean),
      allowedRoots: [moduleRoot, assembler].filter(Boolean),
      forbidden: ['其他业务模块私有目录', '未在 dependencies 中声明的 npm 包', 'ai-baseline-kit/**（除非维护基线包）'],
    },
    moduleContract: {
      contractVersion: 1,
      archetype: spec.feature?.archetype || 'custom',
      capabilities: spec.capabilities ?? [],
      portable: ownershipLayer === 'modules',
      sameStackOnly: true,
      crossModuleImports: false,
    },
    validation: ['baseline-check --mode changed|full', 'typecheck', 'lint（若项目存在）', 'test（若项目存在）', 'build'],
    requiredQuestions: uniqueQuestions(questions),
  };
  plan.status = plan.requiredQuestions.length ? 'needs-confirmation' : 'ready';

  const outputFile = path.resolve(args.output || path.join(projectRoot, 'docs', 'plans', `${slugify(spec.feature?.id, 'feature')}.plan.json`));
  writeJson(outputFile, plan);
  console.log(`feature-plan: ${plan.status === 'ready' ? 'pass' : 'needs-confirmation'}`);
  console.log(`decision: ${decisionType}`);
  console.log(`change-plan: ${normalizePath(path.relative(projectRoot, outputFile))}`);
  printQuestions(plan.requiredQuestions);
  if (plan.status !== 'ready' && !args['allow-draft']) process.exit(2);
} catch (error) {
  console.error(`feature-plan: fail: ${error.message}`);
  process.exit(1);
}


