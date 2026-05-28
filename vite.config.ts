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
        strategies: 'injectManifest',
        srcDir: 'src/pwa',
        filename: 'sw.ts',
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
        injectManifest: {
          // Pre-cache the app shell + assets. Hashed filenames make cache
          // busting automatic. Runtime caching for OSM tiles and Google
          // Fonts is wired in src/pwa/sw.ts.
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
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
