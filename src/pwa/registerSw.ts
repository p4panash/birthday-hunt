// Service worker registration helper.
//
// vite-plugin-pwa generates `virtual:pwa-register` which exposes the
// `registerSW` function that handles the install lifecycle. We wrap it so
// the caller (main.tsx) gets a small typed surface: a registration handle
// plus an `onUpdate` event we use to show a "refresh available" toast.
//
// Idempotent on multiple calls — the underlying API short-circuits if a
// registration already exists for the current scope.

import { registerSW } from 'virtual:pwa-register';

export interface SwHandle {
  /** Force the waiting SW to activate (called when the user clicks "refresh"). */
  update: () => Promise<void>;
}

interface RegisterOptions {
  onNeedRefresh: () => void;
  onOfflineReady?: () => void;
}

let handle: SwHandle | null = null;

export function registerSw(opts: RegisterOptions): SwHandle {
  if (handle) return handle;

  // `registerSW` returns an `updateSW` function — calling it skipWaitings
  // the waiting SW and reloads the page once active.
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      opts.onNeedRefresh();
    },
    onOfflineReady() {
      opts.onOfflineReady?.();
    },
    onRegisterError(err) {
      // Don't crash the app; SW is a progressive enhancement.
      console.warn('[pwa] SW register failed', err);
    },
  });

  handle = {
    update: () => updateSW(true),
  };
  return handle;
}
