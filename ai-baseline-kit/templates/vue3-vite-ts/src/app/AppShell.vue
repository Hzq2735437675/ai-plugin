<script setup lang="ts">
import { computed } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import { modules } from './module-assembler';

const route = useRoute();
const menus = modules.flatMap((module) => module.menus);
const currentPath = computed(() => route.path);
</script>

<template>
  <el-container class="app-shell">
    <el-aside class="app-sidebar" width="240px">
      <div class="app-brand">AI Baseline</div>
      <el-menu class="app-menu" :default-active="currentPath" router>
        <el-menu-item v-for="menu in menus" :key="menu.key" :index="menu.path">
          {{ menu.label }}
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container class="app-main">
      <el-header class="app-topbar">
        <strong>Vue 3 标准项目模板</strong>
        <el-space class="app-topbar__meta" :size="8">
          <el-tag effect="plain">Element Plus</el-tag>
          <span>Vue 3 · Vite · TypeScript</span>
        </el-space>
      </el-header>

      <el-main class="page-content">
        <RouterView />
      </el-main>
    </el-container>
  </el-container>
</template>
