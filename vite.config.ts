import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// `base` defaults to /birthday-hunt/ for GitHub Pages compatibility.
// Cloudflare Pages deploys override via VITE_BASE_PATH=/.
//
// `server.proxy` lets `vite dev` (5173) forward /api/* and the WebSocket
// upgrade to `wrangler dev` (8787) so the frontend talks to the real Worker
// over the same origin during development.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Default '/' targets Cloudflare Pages root. The GH Pages fallback workflow
  // sets VITE_BASE_PATH=/birthday-hunt/ for its build.
  const basePath = env.VITE_BASE_PATH ?? '/';

  return {
    plugins: [react()],
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
