import fs from 'node:fs';
import path from 'node:path';
import { readJson, unique } from './feature-tools-lib.mjs';
import { aggregateQuestions } from './question-aggregator-lib.mjs';

function normalize(value) { return String(value || '').toLowerCase().replaceAll(/[，。；、]/g, ' ').replaceAll(/\s+/g, ' ').trim(); }
function requestValue(request) {
  if (request && typeof request === 'object') return request;
  const value = String(request || ''); const file = path.resolve(value);
  if (value && fs.existsSync(file)) return path.extname(file).toLowerCase() === '.json' ? readJson(file) : fs.readFileSync(file, 'utf8');
  return value;
}
function classify(text) {
  if (/组合|装配|抽离|抽取|迁移|合并.*项目|compose|extract|migrate/i.test(text)) return 'compose-project';
  if (/新建|创建|生成.*项目|create.*project/i.test(text)) return 'create-project';
  if (/修复|治理|规范|改造|repair|refactor/i.test(text)) return 'repair-project';
  return 'modify-feature';
}
function mentioned(project, text) {
  return project.aliases.some((alias) => {
    if (alias.length === 1) return new RegExp(`(?:项目|project)\\s*${alias}(?:\\b|[^a-z0-9])`, 'i').test(text);
    return text.includes(alias);
  });
}
function targetToken(text) {
  const patterns = [/(?:形成|组合成|生成|创建)(?:一个)?(?:新的?)?(?:项目)?\s*([a-z0-9_-]+)/i, /(?:into|to)\s+(?:project\s+)?([a-z0-9_-]+)/i];
  for (const pattern of patterns) { const match = text.match(pattern); if (match?.[1]) return match[1]; }
  return '';
}
function targetDirectory(root, token) {
  const clean = String(token || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '');
  return path.join(root, clean.length === 1 ? `project-${clean}` : clean);
}
export function resolveWorkspaceIntent({ request, discovery, target = '', stack = '' }) {
  const loaded = requestValue(request);
  if (loaded && typeof loaded === 'object' && loaded.kind === 'ai-baseline-composition-request') return { task: 'compose-project', status: loaded.status || 'ready', request: loaded, requiredQuestions: loaded.requiredQuestions || [], confidence: 1 };
  const text = typeof loaded === 'string' ? loaded : loaded?.request?.text || loaded?.text || '';
  const normalized = normalize(text); const task = classify(normalized); const questions = [];
  const mentionedProjects = discovery.projects.filter((project) => mentioned(project, normalized));
  const token = targetToken(normalized);
  let targetProject = target ? null : discovery.projects.find((project) => token && project.aliases.some((alias) => alias === token || alias === `project-${token}` || alias === `项目${token}`));
  const targetRoot = target ? path.resolve(target) : targetProject?.projectRoot || (token ? targetDirectory(discovery.workspaceRoot, token) : '');
  let sources = mentionedProjects.filter((project) => project.projectRoot !== targetRoot);
  if (task === 'compose-project' && !sources.length) questions.push({ id: 'confirm-source-projects', field: 'sources', question: '无法从需求中唯一识别来源项目，请明确需要抽离模块的项目名称。', reason: '工作区项目别名未与需求可靠匹配。', risk: 'L3', blocking: true });
  if (task === 'compose-project' && !targetRoot) questions.push({ id: 'confirm-target-project', field: 'target.projectRoot', question: '请确认新项目名称或目标项目路径。', reason: '需求中未识别到组合目标。', risk: 'L3', blocking: true });
  const profiles = unique(sources.map((item) => item.profile).filter((item) => item && item !== 'unknown'));
  const inferredStack = stack || (profiles.length === 1 ? profiles[0] : targetProject?.profile || '');
  if (task === 'compose-project' && profiles.length > 1 && !stack && !targetProject) questions.push({ id: 'confirm-target-stack', field: 'target.stack', question: `来源项目技术栈不一致：${profiles.join('、')}，请确认目标技术栈。`, reason: '跨技术栈模块不能直接机械组合。', risk: 'L3', blocking: true });
  const aggregated = aggregateQuestions(questions);
  const compositionRequest = {
    schemaVersion: 1, kind: 'ai-baseline-composition-request', status: aggregated.blocking ? 'needs-confirmation' : 'ready', request: { text },
    sources: sources.map((project) => ({ id: project.id, projectRoot: project.projectRoot })), target: { projectRoot: targetRoot, stack: inferredStack }, selections: [],
    policies: { moduleNameConflict: 'prefix-source', routeConflict: 'prefix-module', permissionConflict: 'prefix-module', sharedConflict: 'ask', dependencyConflict: 'ask', rollbackOnFailure: true, validate: true, e2e: false }, requiredQuestions: aggregated.questions,
  };
  return { schemaVersion: 1, kind: 'ai-baseline-workspace-intent', task, status: compositionRequest.status, confidence: aggregated.blocking ? 0.5 : 0.9, text, sources, target: { projectRoot: targetRoot, stack: inferredStack }, request: compositionRequest, requiredQuestions: aggregated.questions, questionSummary: aggregated.summary };
}
