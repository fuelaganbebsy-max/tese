import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages 项目站点访问路径: https://<user>.github.io/tese1/
  base: process.env.GITHUB_ACTIONS ? '/tese1/' : '/',
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173 },
});
