import fs from 'node:fs';
import path from 'node:path';

export function normalizePath(value) {
  return String(value ?? '').replace(/\\/g, '/');
}

export function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`无法读取 JSON 文件 ${file}: ${error.message}`);
  }
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function slugify(value, fallback = '') {
  const slug = String(value ?? '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

export function pascalCase(value) {
  return String(value ?? '')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('');
}

export function camelCase(value) {
  const pascal = pascalCase(value);
  return pascal ? `${pascal.charAt(0).toLowerCase()}${pascal.slice(1)}` : '';
}

export function unique(values) {
  return [...new Set((values ?? []).filter(Boolean))];
}

export function question(id, field, text, reason = '') {
  return { id, field, question: text, reason, blocking: true };
}

export function normalizeQuestion(item, index = 0) {
  if (typeof item === 'string') return question(`question-${index + 1}`, 'unknown', item);
  return {
    id: item?.id || `question-${index + 1}`,
    field: item?.field || 'unknown',
    question: item?.question || '请补充该必需信息。',
    reason: item?.reason || '',
    blocking: item?.blocking !== false,
  };
}

export function blockingQuestions(document) {
  return (document?.requiredQuestions ?? document?.required_questions ?? [])
    .map(normalizeQuestion)
    .filter((item) => item.blocking !== false);
}

export function ensureInside(root, candidate, label = '目标路径') {
  const absoluteRoot = path.resolve(root);
  const absoluteCandidate = path.resolve(candidate);
  const relative = path.relative(absoluteRoot, absoluteCandidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${label}越过项目根目录: ${normalizePath(absoluteCandidate)}`);
  }
  return absoluteCandidate;
}

export function relativeImport(fromFile, toFileWithoutExtension) {
  let relative = normalizePath(path.relative(path.dirname(fromFile), toFileWithoutExtension));
  if (!relative.startsWith('.')) relative = `./${relative}`;
  return relative;
}

export function inferArchetype(text) {
  if (/审批|流程|workflow|状态流转/i.test(text)) return 'workflow';
  if (/仪表盘|看板|dashboard|统计|指标/i.test(text)) return 'dashboard';
  if (/配置|设置|configuration/i.test(text)) return 'configuration';
  if (/主从|详情|master.?detail/i.test(text)) return 'master-detail';
  if (/实时|监控|websocket|sse/i.test(text)) return 'real-time-monitoring';
  if (/增删改查|crud|列表|新增|编辑|删除|查询/i.test(text)) return 'crud';
  return 'custom';
}

export function validateFeatureSpec(spec) {
  const questions = (spec.requiredQuestions ?? []).map(normalizeQuestion);
  const push = (id, field, text, reason) => {
    if (!questions.some((item) => item.field === field && item.blocking !== false)) {
      questions.push(question(id, field, text, reason));
    }
  };

  if (!slugify(spec.feature?.id)) push('feature-id', 'feature.id', '请确认稳定的英文 kebab-case 功能标识。', '该标识用于目录、路由名和模块契约。');
  if (!spec.feature?.title) push('feature-title', 'feature.title', '请确认功能名称。', '名称用于页面、菜单和验收报告。');
  if (!slugify(spec.feature?.module || spec.feature?.domain)) push('feature-module', 'feature.module', '请确认该需求归属的新模块或已有模块英文标识。', '模块归属决定文件边界和是否允许组合迁移。');
  if (!(spec.pages?.length || spec.actions?.length || spec.capabilities?.length)) push('feature-scope', 'pages/actions', '请确认至少一个页面、用户动作或无界面能力。', '无法据此生成路由、组件和功能边界。');
  if (!spec.acceptance?.length) push('acceptance', 'acceptance', '请补充可验证的验收条件。', '静态结构正确不能替代产品行为验收。');

  for (const [index, page] of (spec.pages ?? []).entries()) {
    if (!page.id) push(`page-${index + 1}-id`, `pages[${index}].id`, `请确认第 ${index + 1} 个页面的英文标识。`, '页面文件和路由名称必须稳定。');
    if (!page.route) push(`page-${index + 1}-route`, `pages[${index}].route`, `请确认页面“${page.name || page.id || index + 1}”的路由。`, '路由属于模块公开契约。');
    if (!Array.isArray(page.states) || !page.states.length) push(`page-${index + 1}-states`, `pages[${index}].states`, `请确认页面“${page.name || page.id || index + 1}”需要覆盖的 loading/empty/error/ready/permission 状态。`, '页面状态完整性必须可验证。');
  }

  if ((spec.source?.text ?? '').match(/权限|permission|角色|role/i) && !(spec.permissions?.length)) {
    push('permissions', 'permissions', '需求涉及权限，请确认权限码、角色与无权限行为。', '权限不能由生成器自行猜测。');
  }
  if ((spec.source?.text ?? '').match(/接口|api|endpoint/i) && !(spec.api?.length)) {
    push('api-contract', 'api', '需求涉及接口，请确认 API 方法、路径、请求和响应契约。', '接口契约不应根据描述臆造。');
  }

  return uniqueQuestions(questions);
}

export function uniqueQuestions(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.field}|${item.question}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function printQuestions(questions) {
  if (!questions.length) return;
  console.log('required_questions:');
  for (const item of questions) {
    console.log(`- [${item.field}] ${item.question}${item.reason ? `（${item.reason}）` : ''}`);
  }
}
