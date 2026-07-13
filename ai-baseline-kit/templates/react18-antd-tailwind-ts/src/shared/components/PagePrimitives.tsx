import type { ReactNode } from 'react';
import { Card, Typography } from 'antd';

const { Paragraph, Title } = Typography;

export function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="h-full shadow-sm" title={title}>
      <Paragraph className="!mb-0 text-slate-600">{children}</Paragraph>
    </Card>
  );
}

export function PageTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <Title level={2} className="!mb-2">{title}</Title>
      <Paragraph className="!mb-0 text-slate-500">{description}</Paragraph>
    </div>
  );
}
