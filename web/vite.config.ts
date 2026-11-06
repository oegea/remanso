import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Sin dependencias remotas: todo lo que la aplicación necesita se sirve desde
// su propio origen y el service worker lo guarda para uso sin conexión.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/*.svg', 'icons/*.png'],
      manifest: {
        name: 'Remanso',
        short_name: 'Remanso',
        description: 'Diario, cuadernos, objetivos y cambio conductual. Todo en tu dispositivo, cifrado.',
        lang: 'es',
        start_url: '/',
        display: 'standalone',
        background_color: '#F6F3EC',
        theme_color: '#F6F3EC',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,wasm,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: '/index.html',
        // Voz guía de Meditar: se guarda frase a frase la primera vez que suena (y toda la voz
        // al empezar una sesión), sin entrar en la precarga inicial.
        runtimeCaching: [{
          urlPattern: ({ url }) => url.pathname.startsWith('/voz/'),
          handler: 'CacheFirst',
          options: { cacheName: 'remanso-voz-v1', rangeRequests: true, cacheableResponse: { statuses: [0, 200] }, expiration: { maxEntries: 100 } },
        }],
      },
    }),
  ],
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
  worker: { format: 'es' },
  server: {
    headers: {
      // Necesario para OPFS/SharedArrayBuffer si se usa; inocuo en caso contrario.
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: { target: 'es2022', sourcemap: false },
});
