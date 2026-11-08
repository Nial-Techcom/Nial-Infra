import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// `base: './'` keeps asset URLs relative so the same build also loads from file:// inside the desktop app.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 3000, proxy: { '/api': { target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:5000', changeOrigin: true } } },
  build: { chunkSizeWarningLimit: 1200 },
});
