import { Layout, Menu } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { modules } from '@/app/module-assembler';

const { Header, Content, Sider } = Layout;
const menus = modules.flatMap((module) => module.menus);

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Layout className="app-layout min-h-screen">
      <Sider className="app-sider" breakpoint="lg" collapsedWidth="0">
        <div className="app-brand">AI Baseline</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menus.map((menu) => ({ key: menu.path, label: menu.label }))}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header className="app-header">
          <span className="app-header__title">默认 React 项目模板</span>
          <span className="app-header__meta">React 18 · Ant Design · Tailwind · TypeScript</span>
        </Header>
        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
