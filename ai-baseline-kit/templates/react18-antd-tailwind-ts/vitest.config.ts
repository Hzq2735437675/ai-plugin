import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const templateRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(templateRoot, './src') } },
  test: {
    environment: 'jsdom',
    include: ['src/modules/**/tests/**/*.test.ts', 'src/modules/**/tests/**/*.test.tsx'],
    exclude: ['src/modules/**/tests/e2e/**'],
  },
});
