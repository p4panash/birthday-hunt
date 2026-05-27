import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// `base` defaults to /birthday-hunt/ for GitHub Pages compatibility.
// Cloudflare Pages deploys override via VITE_BASE_PATH=/.
//
// `server.proxy` lets `vite dev` (5173) forward /api/* and the WebSocket
// upgrade to `wrangler dev` (8787) so the frontend talks to the real Worker
// over the same origin during development.
//
// Phase 2: VitePWA generates the service worker + manifest. The SW pre-caches
// static assets and serves a runtime offline shell. `/api/*` is intentionally
// NetworkOnly so chat / state never hits a stale cache.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const basePath = env.VITE_BASE_PATH ?? '/';

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: null, // we register manually from src/pwa/registerSw.ts
        includeAssets: [
          'favicon.ico',
          'qr.jpg',
          'icons/apple-touch-icon.png',
        ],
        manifest: {
          name: 'goodLoot — Cooperative Treasure Hunts',
          short_name: 'goodLoot',
          description:
            'Cooperative GPS treasure hunts for any occasion. Join a team, follow the clues, find the prize.',
          theme_color: '#1F1430',
          background_color: '#1F1430',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: 'icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'icons/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // Pre-cache the app shell + assets. The hashed asset filenames make
          // cache busting automatic.
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          // Runtime caching rules.
          runtimeCaching: [
            {
              // OSM tiles — survive offline once cached, refresh in background.
              urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'osm-tiles',
                expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
              },
            },
            {
              // Google Fonts CSS — short cache, network-first to pick up
              // updates.
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'gfonts-css' },
            },
            {
              // Google Fonts woff2 — long cache, immutable filenames.
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gfonts-woff2',
                expiration: { maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 },
              },
            },
          ],
          // API never cached — chat / state must be live.
          navigateFallbackDenylist: [/^\/api\//, /^\/admin/],
        },
        devOptions: {
          // The dev SW is helpful for testing installability locally; disable
          // if it interferes with HMR (it currently does not).
          enabled: false,
        },
      }),
    ],
    base: basePath,
    resolve: {
      alias: {
        shared: fileURLToPath(new URL('./shared', import.meta.url)),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8787',
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
