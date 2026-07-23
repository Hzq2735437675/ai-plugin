import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';

const templateRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    vue(),
    Components({ dts: false, resolvers: [ElementPlusResolver({ importStyle: false })] }),
  ],
  resolve: { alias: { '@': path.resolve(templateRoot, './src') } },
  test: {
    environment: 'jsdom',
    include: ['src/modules/**/tests/**/*.test.ts'],
    exclude: ['src/modules/**/tests/e2e/**'],
  },
});

