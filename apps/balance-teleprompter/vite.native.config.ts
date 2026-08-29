import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname, 'native-src'),
  base: './',
  publicDir: resolve(__dirname, 'public'),
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(__dirname) },
  },
  build: {
    outDir: resolve(__dirname, 'www'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'native-src/index.html'),
        privacy: resolve(__dirname, 'native-src/privacy.html'),
      },
    },
  },
});
