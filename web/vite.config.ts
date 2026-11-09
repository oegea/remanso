import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';

/**
 * Huella del contenido de cada frase de la voz guía (public/voz/<voz>/<id>.mp3). Va en la
 * dirección de cada archivo (`voiceUrl`), porque el service worker los guarda con
 * CacheFirst: así una frase regenerada llega también a quien ya tenía la anterior.
 */
function voiceRev(): Record<string, Record<string, string>> {
  const root = new URL('./public/voz/', import.meta.url);
  const out: Record<string, Record<string, string>> = {};
  for (const voice of readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    out[voice] = {};
    for (const f of readdirSync(new URL(`${voice}/`, root)).filter((n) => n.endsWith('.mp3')).sort()) {
      out[voice][f.slice(0, -4)] = createHash('sha256').update(readFileSync(new URL(`${voice}/${f}`, root))).digest('hex').slice(0, 10);
    }
  }
  return out;
}

// Sin dependencias remotas: todo lo que la aplicación necesita se sirve desde
// su propio origen y el service worker lo guarda para uso sin conexión.
export default defineConfig({
  define: { __VOICE_REV__: JSON.stringify(voiceRev()) },
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
        // al empezar una sesión), sin entrar en la precarga inicial. Cada dirección lleva la
        // huella de su contenido (`?v=`), así que CacheFirst nunca sirve una toma antigua;
        // `warmVoice` retira las que ya no son las vigentes.
        runtimeCaching: [{
          urlPattern: ({ url }) => url.pathname.startsWith('/voz/'),
          handler: 'CacheFirst',
          options: { cacheName: 'remanso-voz-v1', rangeRequests: true, cacheableResponse: { statuses: [0, 200] }, expiration: { maxEntries: 200 } },
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
