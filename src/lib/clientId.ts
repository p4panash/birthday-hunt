// Stable browser identifier used to re-bind a player on reconnect (resolved
// decision #5 in specs/multiplayer-backend.md). Generated once per browser,
// persisted in localStorage forever — clearing it makes the next join create a
// fresh player_id.

const KEY = 'bday-hunt-client-id-v1';

export function getClientId(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
  } catch {
    /* localStorage might be unavailable (privacy mode) — fall through to ephemeral id */
  }
  const fresh = crypto.randomUUID();
  try {
    localStorage.setItem(KEY, fresh);
  } catch {
    /* swallow — we'll get a new one next page load, harmless */
  }
  return fresh;
}
