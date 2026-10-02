import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'node:fs';
import path from 'node:path';

function copyOrtWasm(): Plugin {
  const copy = () => {
    const src = path.resolve(__dirname, 'node_modules/onnxruntime-web/dist');
    const dest = path.resolve(__dirname, 'public/ort');
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(dest, { recursive: true });
    for (const file of fs.readdirSync(src)) {
      if (file.endsWith('.wasm') || file.endsWith('.mjs')) {
        fs.copyFileSync(path.join(src, file), path.join(dest, file));
      }
    }
  };
  return {
    name: 'copy-ort-wasm',
    buildStart: copy,
    configureServer: copy,
  };
}

export default defineConfig({
  plugins: [
    copyOrtWasm(),
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'ort/*.wasm', 'ort/*.mjs'],
      manifest: {
        name: 'AgriFusionNet',
        short_name: 'AgriFusionNet',
        description: 'Sistem pendukung keputusan pertanian cerdas',
        theme_color: '#2d5016',
        background_color: '#f4f7f0',
        display: 'standalone',
        lang: 'id',
        start_url: '/',
        scope: '/',
        id: '/',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wasm,mjs}'],
        maximumFileSizeToCacheInBytes: 25 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\/api\/v1\/features\/disease\/model\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'disease-model-cache',
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /\/ort\/.*\.(wasm|mjs)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ort-wasm-cache',
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /\/api\/v1\/(crop-cycles|farms)(\?|$)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'agrifusion-api-shell',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
