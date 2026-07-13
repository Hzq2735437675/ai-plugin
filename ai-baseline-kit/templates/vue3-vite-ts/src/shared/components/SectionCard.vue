<script setup lang="ts">
defineProps<{
  title: string;
}>();
</script>

<template>
  <section class="section-card">
    <h2>{{ title }}</h2>
    <p><slot /></p>
  </section>
</template>
