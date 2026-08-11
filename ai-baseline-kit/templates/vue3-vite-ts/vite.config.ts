import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';

const templateRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    vue(),
    Components({
      dts: false,
      resolvers: [ElementPlusResolver({ importStyle: 'css' })],
    }),
  ],
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
