#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const baselineRoot = path.resolve(scriptDir, '..');
const baselineDirName = path.basename(baselineRoot);
const defaultProjectRoot = path.resolve(baselineRoot, '..');
const projectRootArgIndex = process.argv.indexOf('--project-root');
const positionalRoot = process.argv.find((arg, index) => index > 1 && !arg.startsWith('--') && process.argv[index - 1] !== '--project-root');
const root = projectRootArgIndex >= 0
  ? path.resolve(process.argv[projectRootArgIndex + 1] || defaultProjectRoot)
  : positionalRoot
    ? path.resolve(positionalRoot)
    : defaultProjectRoot;
const failOnWarn = process.argv.includes('--fail-on-warn');
const fixGitignore = process.argv.includes('--fix-gitignore');
const fixEntrypoints = process.argv.includes('--fix-entrypoints') || process.argv.includes('--fix-ai-entrypoints');

const results = [];

function record(level, id, message, file = '') {
  results.push({ level, id, message, file });
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function baselineExists(rel) {
  return fs.existsSync(path.join(baselineRoot, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function readBaseline(rel) {
  return fs.readFileSync(path.join(baselineRoot, rel), 'utf8');
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', 'coverage', baselineDirName].includes(entry.name)) continue;
      walk(full, acc);
    } else {
      acc.push(full);
    }
  }
  return acc;
}

function getYamlScalar(text, dottedKey) {
  const parts = dottedKey.split('.');
  let indent = -1;
  let cursor = text.split(/\r?\n/);
  for (const part of parts) {
    const matcher = new RegExp(`^(\\s*)${part}:\\s*(.*)$`);
    let found = null;
    for (const line of cursor) {
      const match = line.match(matcher);
      if (!match) continue;
      const currentIndent = match[1].length;
      if (currentIndent > indent) {
        found = { indent: currentIndent, value: match[2].trim() };
        break;
      }
    }
    if (!found) return '';
    indent = found.indent;
    if (part === parts.at(-1)) return found.value.replace(/^["']|["']$/g, '');
    cursor = cursor.slice(cursor.findIndex((line) => matcher.test(line)) + 1);
  }
  return '';
}

function hasYamlKey(text, key) {
  return new RegExp(`(^|\\n)\\s*${key}:`).test(text);
}

function hasManifestField(text, key) {
  const explicitKey = new RegExp(`(^|[,{\\n\\r])\\s*${key}\\s*:`);
  const shorthandKey = new RegExp(`(^|[,{\\n\\r])\\s*${key}\\s*(,|})`);
  return hasYamlKey(text, key) || explicitKey.test(text) || shorthandKey.test(text);
}

function gitignoreHidesBaselineKit(text) {
  const accepted = [
    baselineDirName,
    `${baselineDirName}/`,
    `/${baselineDirName}`,
    `/${baselineDirName}/`,
  ];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('!'))
    .some((line) => accepted.includes(line));
}

function strongEntrypointText(title) {
  return `${title}

本项目使用内嵌 AI 基线规范包。任何代码改动、结构判断、目录调整、模块/路由/API/store/样式/i18n/依赖处理前，先读取：

\`\`\`text
${baselineDirName}/AGENTS.md
\`\`\`

涉及实现或改造时，必须按 \`${baselineDirName}/skills/baseline-structure-skill/SKILL.md\` 先明确范围；完成后按 \`${baselineDirName}/skills/baseline-conformance-skill/SKILL.md\` 回归。

除非用户明确要求维护基线包，否则不要修改 \`${baselineDirName}/\`；业务开发按基线包中的 \`baseline_root\` / \`project_root\` 路径约定执行。`;
}

function hasStrongEntrypoint(text) {
  return [
    `${baselineDirName}/AGENTS.md`,
    `${baselineDirName}/skills/baseline-structure-skill/SKILL.md`,
    `${baselineDirName}/skills/baseline-conformance-skill/SKILL.md`,
    '任何代码改动',
    '结构判断',
  ].every((token) => text.includes(token));
}

function ensureAiEntrypoints() {
  for (const file of ['AGENTS.md', 'CLAUDE.md']) {
    const filePath = path.join(root, file);
    const existsEntrypoint = fs.existsSync(filePath);
    const text = existsEntrypoint ? fs.readFileSync(filePath, 'utf8') : '';

    if (existsEntrypoint && hasStrongEntrypoint(text)) continue;

    if (!fixEntrypoints) {
      record(
        'warn',
        existsEntrypoint ? 'weak_ai_entrypoint' : 'missing_ai_entrypoint',
        `${file} 缺少 ai-baseline-kit 强入口约束；建议运行 baseline-check.mjs --fix-entrypoints 自动补齐。`,
        file,
      );
      continue;
    }

    const content = existsEntrypoint
      ? `${text}${text.endsWith('\n') ? '\n' : '\n\n'}${strongEntrypointText('## AI Baseline Kit')}\n`
      : `${strongEntrypointText(`# ${file}`)}\n`;

    fs.writeFileSync(filePath, content, 'utf8');
    record('info', existsEntrypoint ? 'ai_entrypoint_strengthened' : 'ai_entrypoint_created', `已补齐 ${file} 的 ai-baseline-kit 强入口约束。`, file);
  }
}

function checkGitignoreAllowsBaselineKitChanges() {
  const gitignorePath = path.join(root, '.gitignore');
  const rel = '.gitignore';
  const existsGitignore = fs.existsSync(gitignorePath);
  const text = existsGitignore ? fs.readFileSync(gitignorePath, 'utf8') : '';

  if (fixGitignore) {
    record(
      'info',
      'fix_gitignore_deprecated',
      '--fix-gitignore 已废弃；脚本不会再自动向 .gitignore 追加 ai-baseline-kit/。',
      rel,
    );
  }

  if (!gitignoreHidesBaselineKit(text)) return;

  record(
    'warn',
    'baseline_kit_gitignored',
    `目标项目 .gitignore 当前隐藏 ${baselineDirName}/；如需显示规范包变化，请显式移除该忽略规则。`,
    rel,
  );
}

function checkRequiredFiles() {
  const required = [
    'AGENTS.md',
    'docs/baseline-rules.yml',
    'docs/engineering-workflow.yml',
    'skills/project-scheme-bootstrap/SKILL.md',
    'skills/baseline-structure-skill/SKILL.md',
    'skills/baseline-conformance-skill/SKILL.md',
  ];
  for (const rel of required) {
    if (!baselineExists(rel)) record('error', 'missing_required_file', `缺少基线包文件: ${baselineDirName}/${rel}`, rel);
  }
  if (!baselineExists('docs/project-scheme.yml')) {
    record('warn', 'missing_project_scheme', `缺少 ${baselineDirName}/docs/project-scheme.yml；首次接入时应先运行 project-scheme-bootstrap。`, `${baselineDirName}/docs/project-scheme.yml`);
  }
}

function checkProjectScheme() {
  if (!baselineExists('docs/project-scheme.yml')) return;
  const text = readBaseline('docs/project-scheme.yml');
  const top = ['project', 'stack', 'layers', 'entrypoints', 'modules', 'validation', 'required_questions', 'confidence', 'evidence'];
  for (const key of top) {
    if (!hasYamlKey(text, key)) record('error', 'project_scheme_missing_key', `project-scheme 缺少字段: ${key}`, `${baselineDirName}/docs/project-scheme.yml`);
  }
  const requiredScalars = [
    'stack.framework',
    'stack.build_tool',
    'stack.router',
    'layers.modules_root',
    'entrypoints.app',
    'entrypoints.api_client',
    'modules.root',
    'validation.build',
  ];
  for (const key of requiredScalars) {
    const value = getYamlScalar(text, key);
    if (!value) record('warn', 'project_scheme_empty_value', `project-scheme 字段为空或无法识别: ${key}`, `${baselineDirName}/docs/project-scheme.yml`);
  }
}

function detectModulesRoot() {
  if (baselineExists('docs/project-scheme.yml')) {
    const text = readBaseline('docs/project-scheme.yml');
    const explicit = getYamlScalar(text, 'modules.root') || getYamlScalar(text, 'layers.modules_root');
    if (explicit && explicit !== 'unknown' && explicit !== 'project-defined') return explicit.replace(/\\/g, '/');
  }
  for (const candidate of ['src/modules', 'src/features', 'modules', 'features']) {
    if (exists(candidate)) return candidate;
  }
  return '';
}

function isKnownLegacyModule(mod) {
  if (!baselineExists('docs/project-scheme.yml')) return false;
  const text = readBaseline('docs/project-scheme.yml').replace(/\\/g, '/');
  return text.includes(`path: src/modules/${mod}`) && text.includes('status: legacy_or_incomplete_manifest');
}

function checkManifestText(rel, text) {
  const required = ['name', 'version', 'domain', 'routes', 'menus', 'access', 'locales', 'stores', 'directives', 'dependencies'];
  for (const key of required) {
    if (!hasManifestField(text, key)) {
      record('error', 'module_manifest_missing_key', `模块 manifest 缺少字段: ${key}`, rel);
    }
  }
  const deps = ['shared', 'base_components', 'npm', 'env', 'assets', 'permissions'];
  for (const key of deps) {
    if (!hasManifestField(text, key)) {
      record('warn', 'module_manifest_missing_dependency_bucket', `manifest.dependencies 可能缺少依赖桶: ${key}`, rel);
    }
  }
}

function checkModules() {
  const modulesRoot = detectModulesRoot();
  if (!modulesRoot) {
    record('warn', 'modules_root_unknown', '无法确定模块根目录；旧项目可先由 project-scheme-bootstrap 记录现状。');
    return;
  }
  const absRoot = path.join(root, modulesRoot);
  if (!fs.existsSync(absRoot)) {
    record('warn', 'modules_root_missing', `project-scheme 指向的模块根目录不存在: ${modulesRoot}`, modulesRoot);
    return;
  }
  const moduleDirs = fs.readdirSync(absRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  if (moduleDirs.length === 0) {
    record('warn', 'modules_empty', `模块根目录为空: ${modulesRoot}`, modulesRoot);
    return;
  }
  const moduleNames = moduleDirs.map((entry) => entry.name);
  for (const mod of moduleNames) {
    const modRoot = path.join(absRoot, mod);
    const manifest = ['manifest.yml', 'manifest.yaml', 'manifest.json', 'manifest.ts', 'manifest.js']
      .map((name) => path.join(modRoot, name))
      .find((file) => fs.existsSync(file));
    if (!manifest) {
      const level = isKnownLegacyModule(mod) ? 'warn' : 'error';
      const message = isKnownLegacyModule(mod)
        ? `旧模块暂未补齐 manifest，已在 project-scheme 标记为 legacy_or_incomplete_manifest: ${mod}`
        : `模块缺少 manifest: ${mod}`;
      record(level, 'module_manifest_missing', message, path.relative(root, modRoot));
    } else {
      checkManifestText(path.relative(root, manifest), fs.readFileSync(manifest, 'utf8'));
    }
  }
  checkCrossModuleImports(absRoot, moduleNames);
}

function checkCrossModuleImports(absRoot, moduleNames) {
  const codeExt = new Set(['.ts', '.tsx', '.js', '.jsx', '.vue', '.mjs', '.cjs']);
  for (const file of walk(absRoot).filter((item) => codeExt.has(path.extname(item)))) {
    const rel = path.relative(absRoot, file).replace(/\\/g, '/');
    const owner = rel.split('/')[0];
    const text = fs.readFileSync(file, 'utf8');
    for (const target of moduleNames) {
      if (target === owner) continue;
      const patterns = [
        new RegExp(`from\\s+['"][^'"]*[/@]modules/${target}(/|['"])`),
        new RegExp(`import\\(['"][^'"]*[/@]modules/${target}(/|['"])`),
        new RegExp(`from\\s+['"]\\.\\.[^'"]*/${target}(/|['"])`),
      ];
      if (patterns.some((pattern) => pattern.test(text))) {
        record('error', 'cross_module_import', `模块 ${owner} 直接引用了模块 ${target}`, path.relative(root, file));
      }
    }
  }
}

function checkI18nHints() {
  const files = walk(root).filter((file) => /\.(vue|tsx|jsx|ts|js)$/.test(file) && !file.includes(`${path.sep}node_modules${path.sep}`));
  const chinesePattern = /[\u4e00-\u9fff]/;
  for (const file of files) {
    const rel = path.relative(root, file).replace(/\\/g, '/');
    if (rel.startsWith('docs/') || rel.startsWith('skills/') || rel.includes('/locales/') || rel.includes('/i18n/')) continue;
    const text = fs.readFileSync(file, 'utf8');
    if (chinesePattern.test(text)) {
      record('warn', 'possible_hardcoded_visible_text', '发现中文文本，请确认是否应进入所属 locales。', rel);
    }
  }
}

checkRequiredFiles();
checkGitignoreAllowsBaselineKitChanges();
ensureAiEntrypoints();
checkProjectScheme();
checkModules();
checkI18nHints();

console.log(`baseline_root: ${baselineRoot}`);
console.log(`project_root: ${root}\n`);

const order = { error: 0, warn: 1, info: 2 };
results.sort((a, b) => order[a.level] - order[b.level] || a.id.localeCompare(b.id));

for (const item of results) {
  const location = item.file ? ` (${item.file})` : '';
  console.log(`[${item.level}] ${item.id}: ${item.message}${location}`);
}

const errors = results.filter((item) => item.level === 'error').length;
const warnings = results.filter((item) => item.level === 'warn').length;

console.log(`\nsummary: ${errors} error(s), ${warnings} warning(s)`);

if (errors > 0 || (failOnWarn && warnings > 0)) {
  process.exit(1);
}
