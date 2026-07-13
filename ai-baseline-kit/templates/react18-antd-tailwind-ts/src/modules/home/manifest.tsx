import { HomePage } from './pages/HomePage';
import type { ModuleManifest } from '@/shared/types/module';

export const homeModule = {
  name: 'home',
  version: '0.1.0',
  domain: 'home',
  routes: [
    {
      name: 'home-index',
      path: '/',
      element: <HomePage />,
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
    shared: ['shared/components/PagePrimitives'],
    base_components: [],
    npm: ['antd'],
    env: [],
    assets: [],
    permissions: [],
  },
} satisfies ModuleManifest;
