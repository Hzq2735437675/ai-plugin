import { ConfigProvider } from 'antd';
import { BrowserRouter } from 'react-router-dom';
import { createAppTheme } from '@/theme/antd-theme';
import { AppRoutes } from './AppRoutes';

const appTheme = createAppTheme();

export function App() {
  return (
    <ConfigProvider theme={appTheme}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ConfigProvider>
  );
}
