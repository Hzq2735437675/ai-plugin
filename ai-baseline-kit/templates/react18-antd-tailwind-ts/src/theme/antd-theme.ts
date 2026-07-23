import type { ThemeConfig } from 'antd';

const fallback = {
  colorPrimary: '#1677ff',
  colorSuccess: '#52c41a',
  colorWarning: '#faad14',
  colorError: '#ff4d4f',
  colorText: 'rgba(0, 0, 0, 0.88)',
  colorTextSecondary: 'rgba(0, 0, 0, 0.65)',
  colorBgLayout: '#f5f5f5',
  colorBgContainer: '#ffffff',
  colorBorder: '#d9d9d9',
  borderRadius: 6,
  fontSize: 14,
};

function cssValue(name: string, defaultValue: string) {
  if (typeof document === 'undefined') return defaultValue;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || defaultValue;
}

function cssNumber(name: string, defaultValue: number) {
  const parsed = Number.parseFloat(cssValue(name, String(defaultValue)));
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export function createAppTheme(): ThemeConfig {
  return {
    token: {
      colorPrimary: cssValue('--app-color-primary', fallback.colorPrimary),
      colorSuccess: cssValue('--app-color-success', fallback.colorSuccess),
      colorWarning: cssValue('--app-color-warning', fallback.colorWarning),
      colorError: cssValue('--app-color-error', fallback.colorError),
      colorText: cssValue('--app-color-text', fallback.colorText),
      colorTextSecondary: cssValue('--app-color-text-secondary', fallback.colorTextSecondary),
      colorBgLayout: cssValue('--app-color-bg-layout', fallback.colorBgLayout),
      colorBgContainer: cssValue('--app-color-bg-container', fallback.colorBgContainer),
      colorBorder: cssValue('--app-color-border', fallback.colorBorder),
      borderRadius: cssNumber('--app-border-radius', fallback.borderRadius),
      fontSize: cssNumber('--app-font-size', fallback.fontSize),
    },
  };
}
