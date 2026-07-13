<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
}>();
</script>

<template>
  <header class="page-title">
    <h1>{{ title }}</h1>
    <p>{{ description }}</p>
  </header>
</template>
