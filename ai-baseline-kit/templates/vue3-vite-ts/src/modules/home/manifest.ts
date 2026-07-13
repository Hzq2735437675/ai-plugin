import HomePage from './pages/HomePage.vue';
import type { ModuleManifest } from '@/shared/types/module';

export const homeModule = {
  name: 'home',
  version: '0.1.0',
  domain: 'home',
  routes: [
    {
      name: 'home-index',
      path: '/',
      component: HomePage,
    },
  ],
  menus: [
    {
      key: 'home',
      label: '首页',
      path: '/',
    },
  ],
  access: [],
  locales: [],
  stores: [],
  directives: [],
  dependencies: {
    shared: ['shared/components/PageTitle', 'shared/components/SectionCard'],
    base_components: [],
    npm: [],
    env: [],
    assets: [],
    permissions: [],
  },
} satisfies ModuleManifest;
