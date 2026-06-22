import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { authMockPlugin } from './dev/authMock';

export default defineConfig({
  // GitHub Pages 项目站点访问路径: https://<user>.github.io/tese/
  base: process.env.GITHUB_ACTIONS ? '/tese/' : '/',
  plugins: [react(), authMockPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: { host: '127.0.0.1', port: 5173 },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/@react-three/drei')) {
            return 'vendor-r3f-drei';
          }
          if (id.includes('node_modules/@react-three/fiber')) {
            return 'vendor-r3f';
          }
          if (id.includes('node_modules/three')) {
            return 'vendor-three-core';
          }
          if (id.includes('node_modules/zustand')) {
            return 'vendor-state';
          }
        },
      },
    },
  },
});
