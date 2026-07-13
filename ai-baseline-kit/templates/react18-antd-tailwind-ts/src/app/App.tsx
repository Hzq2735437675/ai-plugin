import { ConfigProvider } from 'antd';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './AppRoutes';

export function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 8,
        },
      }}
    >
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ConfigProvider>
  );
}
