/**
 * Test mode is active only when the URL currently has `?test=1`. It is
 * intentionally NOT sticky — the clean link the recipient receives must never
 * surface the dev tools, and a stale localStorage flag could leak them.
 */
export function detectTestMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('test') === '1';
  } catch {
    return false;
  }
}
