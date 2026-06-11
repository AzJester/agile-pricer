/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative base so the same build works at the domain root, under a
  // GitHub Pages project path (/agile-pricer/), or opened from disk.
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Astrion Agile Pricing Studio',
        short_name: 'Agile Pricer',
        description: 'Agile fixed-price bid modeling for federal pursuits',
        theme_color: '#222230',
        background_color: '#f4f5f8',
        display: 'standalone',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg}'],
        maximumFileSizeToCacheInBytes: 5_000_000,
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          // Heavy export libraries load only when an export is triggered,
          // but keep them in named chunks for cache stability.
          exceljs: ['exceljs'],
          docx: ['docx'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  // vitest 2.x types are built against its bundled vite 5, so the `test`
  // key doesn't typecheck against vite 6's UserConfig without this cast.
} as Parameters<typeof defineConfig>[0]);
