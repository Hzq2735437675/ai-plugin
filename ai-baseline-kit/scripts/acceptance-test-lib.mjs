import path from 'node:path';
import { camelCase, normalizePath, pascalCase, slugify, unique } from './feature-tools-lib.mjs';

function quote(value) {
  return JSON.stringify(String(value ?? ''));
}

export function acceptanceDevDependencies(framework) {
  return /vue/i.test(framework)
    ? ['vitest', '@vue/test-utils', '@playwright/test', 'jsdom']
    : ['vitest', '@testing-library/react', '@playwright/test', 'jsdom'];
}

function contractData(spec) {
  return {
    feature: {
      id: spec.feature.id,
      title: spec.feature.title,
      module: spec.feature.module || spec.feature.domain,
    },
    pages: (spec.pages ?? []).map((page) => ({
      id: page.id,
      name: page.name,
      route: page.route,
      permission: page.permission || '',
      states: page.states ?? [],
    })),
    permissions: unique([...(spec.permissions ?? []), ...(spec.pages ?? []).map((page) => page.permission)]),
    api: (spec.api ?? []).map((item) => ({ id: item.id, method: item.method, path: item.path, purpose: item.purpose || '' })),
    acceptance: (spec.acceptance ?? []).map((item) => ({ id: item.id, given: item.given, when: item.when, then: item.then })),
  };
}

function renderContract(spec, variable) {
  return `export const ${variable}AcceptanceContract = ${JSON.stringify(contractData(spec), null, 2)} as const;\n`;
}

function renderStateTests(spec, variable, featureId) {
  return `import { describe, expect, it } from 'vitest';\nimport { ${variable}AcceptanceContract } from './${featureId}.contract';\n\ndescribe('${spec.feature.title} page state contract', () => {\n  it('页面状态契约可枚举', () => {\n    expect(Array.isArray(${variable}AcceptanceContract.pages)).toBe(true);\n  });\n\n  for (const page of ${variable}AcceptanceContract.pages) {\n    it(\`${'${page.name}'} 声明 ready 状态\`, () => {\n      expect(page.states).toContain('ready');\n    });\n\n    it(\`${'${page.name}'} 的状态声明无重复\`, () => {\n      expect(new Set(page.states).size).toBe(page.states.length);\n    });\n  }\n});\n`;
}

function renderPermissionTests(spec, variable, featureId) {
  return `import { describe, expect, it } from 'vitest';\nimport { ${variable}AcceptanceContract } from './${featureId}.contract';\n\ndescribe('${spec.feature.title} permission contract', () => {\n  it('权限集合无重复项', () => {\n    expect(new Set(${variable}AcceptanceContract.permissions).size).toBe(${variable}AcceptanceContract.permissions.length);\n  });\n\n  for (const page of ${variable}AcceptanceContract.pages) {\n    if (!page.permission) continue;\n    it(\`${'${page.name}'} 权限已进入模块权限集合\`, () => {\n      expect(${variable}AcceptanceContract.permissions).toContain(page.permission);\n    });\n  }\n});\n`;
}

function renderAcceptanceTests(spec, variable, featureId) {
  return `import { describe, expect, it } from 'vitest';\nimport { ${variable}AcceptanceContract } from './${featureId}.contract';\n\ndescribe('${spec.feature.title} acceptance mapping', () => {\n  it('每条验收条件都保留 Given / When / Then', () => {\n    for (const scenario of ${variable}AcceptanceContract.acceptance) {\n      expect(scenario.given).not.toBe('');\n      expect(scenario.when).not.toBe('');\n      expect(scenario.then).not.toBe('');\n    }\n  });\n${(spec.acceptance ?? []).map((item) => `\n  it.todo(${quote(`[${item.id}] Given ${item.given}; When ${item.when}; Then ${item.then}`)});`).join('')}\n});\n`;
}

function renderApiMock(spec, variable) {
  return `import { vi } from 'vitest';\n\nexport const ${variable}ApiMocks = ${JSON.stringify((spec.api ?? []).map((item) => ({ id: item.id, method: item.method, path: item.path, response: {} })), null, 2)} as const;\n\nexport function install${pascalCase(variable)}ApiMock() {\n  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {\n    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;\n    const method = (init?.method || 'GET').toUpperCase();\n    const handler = ${variable}ApiMocks.find((item) => url.includes(item.path) && item.method.toUpperCase() === method);\n    if (!handler) return new Response(JSON.stringify({ message: 'Unhandled generated API mock' }), { status: 501 });\n    return new Response(JSON.stringify(handler.response), { status: 200, headers: { 'content-type': 'application/json' } });\n  });\n  vi.stubGlobal('fetch', mock);\n  return mock;\n}\n`;
}

function renderReactComponentTests(spec) {
  const imports = (spec.pages ?? []).map((page) => `import { ${pascalCase(slugify(page.id))}Page } from '../pages/${slugify(page.id)}/index';`).join('\n');
  const tests = (spec.pages ?? []).map((page) => `  it(${quote(`${page.name} 默认渲染 ready 状态`)}, () => {\n    const { container } = render(<${pascalCase(slugify(page.id))}Page />);\n    expect(screen.getByRole('heading', { name: ${quote(page.name)} })).toBeTruthy();\n    expect(container.querySelector('[data-page-state="ready"]')).toBeTruthy();\n  });`).join('\n\n') || `  it.todo('该功能尚未声明可挂载页面');`;
  return `import { render, screen } from '@testing-library/react';\nimport { describe, expect, it } from 'vitest';\n${imports}\n\ndescribe('${spec.feature.title} component acceptance', () => {\n${tests}\n});\n`;
}

function renderVueComponentTests(spec) {
  const imports = (spec.pages ?? []).map((page) => `import ${pascalCase(slugify(page.id))}Page from '../pages/${slugify(page.id)}/index.vue';`).join('\n');
  const tests = (spec.pages ?? []).map((page) => `  it(${quote(`${page.name} 默认渲染 ready 状态`)}, () => {\n    const wrapper = mount(${pascalCase(slugify(page.id))}Page);\n    expect(wrapper.get('h1').text()).toBe(${quote(page.name)});\n    expect(wrapper.find('[data-page-state="ready"]').exists()).toBe(true);\n  });`).join('\n\n') || `  it.todo('该功能尚未声明可挂载页面');`;
  return `import { mount } from '@vue/test-utils';\nimport { describe, expect, it } from 'vitest';\n${imports}\n\ndescribe('${spec.feature.title} component acceptance', () => {\n${tests}\n});\n`;
}

function renderE2eTests(spec) {
  const pages = (spec.pages ?? []).map((page) => `  test(${quote(`${page.name} 页面可访问并进入 ready 状态`)}, async ({ page: browserPage }) => {\n    await browserPage.goto(${quote(page.route)});\n    await expect(browserPage.getByRole('heading', { name: ${quote(page.name)} })).toBeVisible();\n    await expect(browserPage.locator('[data-page-state="ready"]')).toBeVisible();\n  });`).join('\n\n');
  const acceptance = (spec.acceptance ?? []).map((item) => `\n  test.fixme(${quote(`[${item.id}] Given ${item.given}; When ${item.when}; Then ${item.then}`)}, async () => {\n    // AI 或开发者完成业务实现后，将该场景改为可执行断言。\n  });`).join('');
  return `import { expect, test } from '@playwright/test';\n\ntest.describe('${spec.feature.title}', () => {\n${pages}${acceptance}\n});\n`;
}

export function acceptanceTestFiles({ moduleRoot, spec, framework }) {
  const featureId = slugify(spec.feature.id || `${spec.feature.module}-feature`);
  const variable = camelCase(featureId);
  const testRoot = path.join(moduleRoot, 'tests');
  const files = [
    { file: path.join(testRoot, `${featureId}.contract.ts`), content: renderContract(spec, variable) },
    { file: path.join(testRoot, `${featureId}.page-states.test.ts`), content: renderStateTests(spec, variable, featureId) },
    { file: path.join(testRoot, `${featureId}.permissions.test.ts`), content: renderPermissionTests(spec, variable, featureId) },
    { file: path.join(testRoot, `${featureId}.acceptance.test.ts`), content: renderAcceptanceTests(spec, variable, featureId) },
    { file: path.join(testRoot, `${featureId}.api.mock.ts`), content: renderApiMock(spec, variable) },
    { file: path.join(testRoot, /vue/i.test(framework) ? `${featureId}.component.test.ts` : `${featureId}.component.test.tsx`), content: /vue/i.test(framework) ? renderVueComponentTests(spec) : renderReactComponentTests(spec) },
    { file: path.join(testRoot, 'e2e', `${featureId}.spec.ts`), content: renderE2eTests(spec) },
  ];
  return files.map((item) => ({ ...item, relative: normalizePath(path.relative(moduleRoot, item.file)) }));
}

export function writeAcceptanceTests({ moduleRoot, spec, framework, force = false, writeFile }) {
  const changed = [];
  for (const item of acceptanceTestFiles({ moduleRoot, spec, framework })) {
    writeFile(item.file, item.content, { force });
    changed.push(item.relative);
  }
  return changed;
}
