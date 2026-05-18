const KEY = 'bday-hunt-test';

/**
 * Detect test mode from URL or sticky storage.
 *
 *   ?test=1 → enable + stick
 *   ?test=0 → disable + clear
 *   (else)  → read from localStorage
 */
export function detectTestMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const url = new URLSearchParams(window.location.search);
    if (url.get('test') === '1') {
      localStorage.setItem(KEY, '1');
      return true;
    }
    if (url.get('test') === '0') {
      localStorage.removeItem(KEY);
      return false;
    }
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}
