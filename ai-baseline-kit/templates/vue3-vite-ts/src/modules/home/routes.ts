// ai-baseline:route-imports:start
import HomePage from './pages/HomePage.vue';
// ai-baseline:route-imports:end
import type { ModuleRoute } from '@/shared/types/module';

export const homeRoutes: ModuleRoute[] = [
  // ai-baseline:route-list:start
  {
    name: 'home-index',
    path: '/',
    component: HomePage,
  },
  // ai-baseline:route-list:end
];
