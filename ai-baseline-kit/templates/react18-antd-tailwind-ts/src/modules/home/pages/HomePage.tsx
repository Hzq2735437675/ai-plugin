import { Button, Space } from 'antd';
import { PageTitle, SectionCard } from '@/shared/components/PagePrimitives';
import styles from '../styles/home.module.css';

export function HomePage() {
  return (
    <div className={styles.page}>
      <PageTitle
        title="AI Baseline Starter"
        description="这是新项目默认模板，用于展示清晰的 shell、shared、modules 和静态装配边界。"
      />
      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard title="边界清晰">
          页面属于 home 模块，共享展示组件位于 shared，不跨模块直接引用私有实现。
        </SectionCard>
        <SectionCard title="可持续扩展">
          新业务应创建独立模块，并通过 manifest、routes 和 menu 显式加入装配入口。
        </SectionCard>
      </div>
      <Space className="mt-6">
        <Button type="primary">开始开发</Button>
        <Button>查看项目地图</Button>
      </Space>
    </div>
  );
}
