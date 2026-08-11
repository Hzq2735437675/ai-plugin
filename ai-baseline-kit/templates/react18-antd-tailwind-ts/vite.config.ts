import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const templateRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  css: {
    modules: {
      generateScopedName: 'm_[name]_[local]__[hash:base64:6]',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(templateRoot, './src'),
    },
  },
});
