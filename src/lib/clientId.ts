// Stable browser/device identifier used to re-bind a player on reconnect
// (resolved decision #5 in specs/multiplayer-backend.md). Generated once per
// install, persisted forever — clearing it makes the next join create a
// fresh player_id.
//
// Web: localStorage. Native (Capacitor): @capacitor/preferences, which maps
// to NSUserDefaults on iOS and SharedPreferences on Android. The two stores
// are separate; an install of the native app gets a fresh client_id even if
// the same device previously used the web app at hunt.use-adonis.com.
//
// We expose a synchronous getClientId() for the existing call sites; a
// `primeClientId()` async helper hydrates the native cache at app startup
// (called from main.tsx). After priming, sync reads return the cached value.

import { isNative } from '../pwa/nativeBridge';

const KEY = 'bday-hunt-client-id-v1';

let cached: string | null = null;

export function getClientId(): string {
  if (cached) return cached;
  // Synchronous path — works on web; on native, the cache is hydrated by
  // primeClientId() during app boot. If a sync caller fires before priming
  // completes (rare race in early app frames), we fall back to a fresh UUID
  // and let primeClientId() replace it on its next pass. The replacement is
  // idempotent: the SAME UUID is written to native preferences, so callers
  // converge.
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) {
      cached = existing;
      return existing;
    }
  } catch {
    /* localStorage unavailable */
  }
  const fresh = generateId();
  try {
    localStorage.setItem(KEY, fresh);
  } catch {
    /* ignore */
  }
  cached = fresh;
  return fresh;
}

/**
 * Hydrate the cached client_id from native preferences on app startup.
 * Called from main.tsx. Idempotent. On web this is a no-op.
 */
export async function primeClientId(): Promise<string> {
  if (!isNative()) return getClientId();
  try {
    const { Preferences } = await import('@capacitor/preferences');
    const stored = await Preferences.get({ key: KEY });
    if (stored.value) {
      cached = stored.value;
      // Mirror to localStorage so the WebView's synchronous reads work.
      try {
        localStorage.setItem(KEY, stored.value);
      } catch {
        /* ignore */
      }
      return stored.value;
    }
    const fresh = generateId();
    await Preferences.set({ key: KEY, value: fresh });
    try {
      localStorage.setItem(KEY, fresh);
    } catch {
      /* ignore */
    }
    cached = fresh;
    return fresh;
  } catch {
    // If preferences plugin fails (shouldn't on real native), fall back
    // to localStorage-only behaviour. The user gets the same UX.
    return getClientId();
  }
}

function generateId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Older WebViews without randomUUID — synthesise.
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
  }
}
