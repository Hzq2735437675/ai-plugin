<script setup lang="ts">
defineProps<{
  title: string;
}>();
</script>

<template>
  <el-card class="section-card" shadow="never">
    <template #header>
      <strong>{{ title }}</strong>
    </template>
    <div class="section-card__body">
      <slot />
    </div>
  </el-card>
</template>
