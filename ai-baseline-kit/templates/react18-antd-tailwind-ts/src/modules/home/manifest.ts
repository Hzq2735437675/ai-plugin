import { homeAccess } from './access';
import { homeDirectives } from './directives';
import { homeLocales } from './locales';
import { homeMenus } from './menu';
import { homeRoutes } from './routes';
import { homeStores } from './stores';
import type { ModuleManifest } from '@/shared/types/module';

export const homeModule = {
  name: 'home',
  version: '0.1.0',
  domain: 'home',
  routes: homeRoutes,
  menus: homeMenus,
  access: homeAccess,
  locales: homeLocales,
  stores: homeStores,
  directives: homeDirectives,
  dependencies: {
    shared: ['shared/components/PagePrimitives', 'shared/types/module'],
    base_components: [],
    npm: ['antd', 'react'],
    dev: ["@playwright/test", "@testing-library/react", "jsdom", "vitest"],
    env: [],
    assets: [],
    permissions: [],
  },
} satisfies ModuleManifest;
