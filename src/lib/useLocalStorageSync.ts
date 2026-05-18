import { useEffect, useRef } from 'react';

/**
 * Persists a value to localStorage on every change. Use alongside useReducer.
 *
 *   const [state, dispatch] = useReducer(huntReducer, initialState, init);
 *   useLocalStorageSync(STORAGE_KEY, state);
 *
 * Hydration is handled by the lazy initializer passed to useReducer (see App.tsx),
 * not here — keeping load and save symmetric on the same key.
 */
export function useLocalStorageSync<T>(key: string, value: T): void {
  const firstRun = useRef(true);
  useEffect(() => {
    // Skip the very first effect to avoid stomping freshly-hydrated state
    // with an identical write (cheap, but pointless).
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Quota exceeded or private mode — silently degrade.
    }
  }, [key, value]);
}

/** Lazy hydration helper. Returns parsed value or the provided fallback. */
export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
