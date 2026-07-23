#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, resolveRoots } from './project-tools-lib.mjs';
import {
  inferArchetype,
  normalizeQuestion,
  printQuestions,
  readJson,
  slugify,
  unique,
  validateFeatureSpec,
  writeJson,
} from './feature-tools-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const { projectRoot } = resolveRoots(import.meta.url);
const inputFile = path.resolve(args.input || args._[0] || '');

function extractTitle(text, fallback) {
  const heading = text.match(/^\s*#\s+(.+)$/m)?.[1]?.trim();
  const firstLine = text.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  return heading || firstLine?.replace(/^[-*\d.、\s]+/, '').slice(0, 80) || fallback;
}

function extractRoutes(text) {
  return unique([...text.matchAll(/(?:^|\s)(\/[a-zA-Z0-9_/:.-]+)/g)].map((match) => match[1]));
}

function extractAcceptance(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines
    .filter((line) => /^(?:[-*]\s*)?(?:验收|acceptance|given|当.+时|如果.+则)/i.test(line))
    .slice(0, 12)
    .map((line, index) => ({
      id: `acceptance-${index + 1}`,
      given: '满足产品文档中的前置条件',
      when: '用户执行对应操作',
      then: line.replace(/^[-*\s]+/, ''),
    }));
}

function compileText(text, sourcePath) {
  const inferredTitle = extractTitle(text, path.basename(sourcePath, path.extname(sourcePath)));
  const id = slugify(args['feature-id'] || path.basename(sourcePath, path.extname(sourcePath)));
  const moduleName = slugify(args.module || args.domain || id);
  const routes = extractRoutes(text);
  const pageLines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => /页面|page|列表|详情|看板|配置/i.test(line));
  const pages = routes.map((route, index) => ({
    id: slugify(route.split('/').filter(Boolean).at(-1), `page-${index + 1}`),
    name: pageLines[index]?.replace(/^[-*\d.、\s]+/, '').slice(0, 40) || `${inferredTitle}页面`,
    route,
    menu: index === 0,
    permission: '',
    states: ['loading', 'empty', 'error', 'ready'],
  }));

  return {
    $schema: '../feature-spec.schema.json',
    schemaVersion: 1,
    kind: 'frontend-feature-spec',
    status: 'needs-confirmation',
    feature: {
      id,
      title: inferredTitle,
      domain: slugify(args.domain || moduleName),
      module: moduleName,
      archetype: inferArchetype(text),
      summary: text.replace(/\s+/g, ' ').slice(0, 300),
      ownership: args.ownership || 'module',
    },
    source: {
      type: path.extname(sourcePath).toLowerCase() === '.md' ? 'product-document' : 'natural-language',
      path: path.relative(projectRoot, sourcePath).replaceAll('\\', '/'),
      text,
    },
    actors: [],
    capabilities: [],
    pages,
    actions: [],
    entities: [],
    api: [],
    state: { scope: 'module', persistence: 'unknown', items: [] },
    permissions: [],
    dependencies: { modules: [], shared: [], npm: [] },
    ui: { library: 'project-default', theme: 'global-theme', reuse: [] },
    acceptance: extractAcceptance(text),
    requiredQuestions: [],
    notes: ['此文件由确定性脚本完成初步抽取；AI 必须结合原始需求补全语义，不得把脚本推断当作产品事实。'],
  };
}

try {
  if (!inputFile || !fs.existsSync(inputFile) || !fs.statSync(inputFile).isFile()) {
    throw new Error('请通过 --input <file> 提供自然语言、Markdown 产品文档或结构化 JSON。');
  }

  const extension = path.extname(inputFile).toLowerCase();
  const raw = fs.readFileSync(inputFile, 'utf8');
  const spec = extension === '.json' ? readJson(inputFile) : compileText(raw, inputFile);
  spec.schemaVersion = 1;
  spec.kind = 'frontend-feature-spec';
  spec.requiredQuestions = [
    ...(spec.requiredQuestions ?? []).map(normalizeQuestion),
    ...validateFeatureSpec(spec),
  ].filter((item, index, items) => items.findIndex((candidate) => `${candidate.field}|${candidate.question}` === `${item.field}|${item.question}`) === index);
  spec.status = spec.requiredQuestions.some((item) => item.blocking !== false) ? 'needs-confirmation' : 'ready';

  const featureId = slugify(spec.feature?.id, 'feature-draft');
  const outputFile = path.resolve(args.output || path.join(projectRoot, 'docs', 'features', `${featureId}.feature.json`));
  writeJson(outputFile, spec);

  console.log(`requirement-compile: ${spec.status === 'ready' ? 'pass' : 'needs-confirmation'}`);
  console.log(`feature-spec: ${path.relative(projectRoot, outputFile).replaceAll('\\', '/')}`);
  console.log(`source-type: ${spec.source?.type || 'structured-json'}`);
  printQuestions(spec.requiredQuestions.filter((item) => item.blocking !== false));
  if (spec.status !== 'ready' && !args['allow-draft']) process.exit(2);
} catch (error) {
  console.error(`requirement-compile: fail: ${error.message}`);
  process.exit(1);
}
