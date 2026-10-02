/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '127.0.0.1' // Bind strictly to localhost for security
  },
  resolve: {
    alias: {
      '@shared-types': path.resolve(__dirname, './packages/shared-types/src'),
      '@schemas': path.resolve(__dirname, './packages/schemas/src'),
      '@test-fixtures': path.resolve(__dirname, './packages/test-fixtures/src')
    }
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'apps/**/*.test.ts', 'apps/**/*.test.tsx']
  }
});
