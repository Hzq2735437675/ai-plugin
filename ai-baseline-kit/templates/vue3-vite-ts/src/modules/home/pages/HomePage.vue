<script setup lang="ts">
import PageTitle from '@/shared/components/PageTitle.vue';
import SectionCard from '@/shared/components/SectionCard.vue';
import styles from '../styles/home-overview.module.css';
</script>

<template>
  <div :class="styles.homeOverviewPage">
    <PageTitle
      title="AI Baseline Starter"
      description="Vue 3 标准模板已接入 Element Plus，并保持 shell、shared、modules 与静态装配边界清晰。"
    />

    <el-alert
      :class="styles.homeOverviewStatus"
      title="默认使用 Element Plus 原生主题；项目级视觉只从 src/theme/theme.css 覆盖。"
      type="success"
      :closable="false"
      show-icon
    />

    <el-row :class="styles.homeOverviewFeatureCards" :gutter="16">
      <el-col :xs="24" :md="12">
        <SectionCard title="边界清晰">
          页面属于 home 模块，共享展示组件位于 shared，不跨模块直接引用私有实现。
        </SectionCard>
      </el-col>
      <el-col :xs="24" :md="12">
        <SectionCard title="可持续扩展">
          新业务创建独立模块，并通过 module.meta、manifest、routes 和 menu 显式加入静态装配入口。
        </SectionCard>
      </el-col>
    </el-row>
  </div>
</template>
