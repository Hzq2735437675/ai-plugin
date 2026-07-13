import { Layout, Menu } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { modules } from '@/app/module-assembler';

const { Header, Content, Sider } = Layout;
const menus = modules.flatMap((module) => module.menus);

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Layout className="min-h-screen">
      <Sider breakpoint="lg" collapsedWidth="0">
        <div className="px-5 py-5 text-lg font-semibold text-white">AI Baseline</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menus.map((menu) => ({ key: menu.path, label: menu.label }))}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header className="flex items-center justify-between bg-white px-6 shadow-sm">
          <span className="font-medium text-slate-700">默认 React 项目模板</span>
          <span className="text-sm text-slate-500">React 18 · Ant Design · Tailwind · TypeScript</span>
        </Header>
        <Content className="bg-slate-50 p-6">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
