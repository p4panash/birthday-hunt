import { config } from '../config';

/**
 * Two-element sound system: unlock chime (×3) and finale fanfare (×1).
 * Files at `public/sound/unlock.ogg` and `public/sound/finale.ogg`.
 *
 * If files are missing (Phase 9 hasn't sourced them yet), `.play()` rejects
 * silently — no UI fallback, no error. This is by design.
 */

const base = typeof window !== 'undefined' ? import.meta.env.BASE_URL : '/';

let unlockEl: HTMLAudioElement | null = null;
let finaleEl: HTMLAudioElement | null = null;

function lazy(src: string): HTMLAudioElement {
  const el = new Audio(`${base}${src}`);
  el.preload = 'auto';
  return el;
}

export function playUnlock(): void {
  if (typeof window === 'undefined') return;
  if (!unlockEl) unlockEl = lazy(config.sound.unlockSrc);
  unlockEl.currentTime = 0;
  unlockEl.play().catch(() => {
    // Missing file or autoplay denied — silent.
  });
}

export function playFinale(): void {
  if (typeof window === 'undefined') return;
  if (!finaleEl) finaleEl = lazy(config.sound.finaleSrc);
  finaleEl.currentTime = 0;
  finaleEl.play().catch(() => {
    // Missing file or autoplay denied — silent.
  });
}
