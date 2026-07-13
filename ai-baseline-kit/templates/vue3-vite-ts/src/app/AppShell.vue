<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router';
import { computed } from 'vue';
import { modules } from './module-assembler';

const route = useRoute();
const menus = modules.flatMap((module) => module.menus);
const currentPath = computed(() => route.path);
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">AI Baseline</div>
      <nav class="menu" aria-label="主导航">
        <RouterLink
          v-for="menu in menus"
          :key="menu.key"
          :to="menu.path"
          class="menu-link"
          :class="{ active: currentPath === menu.path }"
        >
          {{ menu.label }}
        </RouterLink>
      </nav>
    </aside>
    <main class="main-content">
      <header class="topbar">
        <strong>默认 Vue 3 项目模板</strong>
        <span>Vue 3 · Vite · TypeScript</span>
      </header>
      <section class="page-content">
        <RouterView />
      </section>
    </main>
  </div>
</template>
