<script setup lang="ts">
import PageTitle from '@/shared/components/PageTitle.vue';
import SectionCard from '@/shared/components/SectionCard.vue';
</script>

<template>
  <div>
    <PageTitle
      title="AI Baseline Starter"
      description="这是 Vue 3 默认模板，用于展示清晰的 shell、shared、modules 和静态装配边界。"
    />
    <div class="card-grid">
      <SectionCard title="边界清晰">
        页面属于 home 模块，共享展示组件位于 shared，不跨模块直接引用私有实现。
      </SectionCard>
      <SectionCard title="可持续扩展">
        新业务应创建独立模块，并通过 manifest、routes 和 menu 显式加入装配入口。
      </SectionCard>
    </div>
  </div>
</template>
