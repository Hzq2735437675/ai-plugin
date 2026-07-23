import { createElement } from 'react';
// ai-baseline:route-imports:start
import { HomePage } from './pages/HomePage';
// ai-baseline:route-imports:end
import type { ModuleRoute } from '@/shared/types/module';

export const homeRoutes: ModuleRoute[] = [
  // ai-baseline:route-list:start
  {
    name: 'home-index',
    path: '/',
    element: createElement(HomePage),
  },
  // ai-baseline:route-list:end
];
