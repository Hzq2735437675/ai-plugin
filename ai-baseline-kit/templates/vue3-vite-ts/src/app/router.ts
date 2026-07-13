import { createRouter, createWebHistory } from 'vue-router';
import { modules } from './module-assembler';
import AppShell from './AppShell.vue';

const moduleRoutes = modules.flatMap((module) => module.routes);

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: AppShell,
      children: moduleRoutes.map((route) => ({
        name: route.name,
        path: route.path === '/' ? '' : route.path.replace(/^\//, ''),
        component: route.component,
      })),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
});
