import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// IMPORTANT: keep `base` in sync with the GitHub Pages repo name.
// If you rename the repo, change this. For user-pages (username.github.io/) use '/'.
export default defineConfig({
  plugins: [react()],
  base: '/birthday-hunt/',
});
