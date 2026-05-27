// Per-player rate limits for the Social bundle (chat, reactions, pings).
// Single source of truth — tests and the DO handler both import these.
//
// Limits are in-memory (per DO instance). They reset on DO hibernation;
// that's acceptable: limits exist to stop buggy clients, not to enforce
// a hard quota.

export const RATE_LIMITS = {
  chat: { perSecond: 1, perMinute: 30, bodyMaxChars: 280 },
  reaction: { perSecond: 2, perMinute: 60 },
  ping: { perSecond: 1, perMinute: 20 },
} as const;

export type RateLimitKind = keyof typeof RATE_LIMITS;

interface Window {
  perSecond: number;
  perMinute: number;
}

/**
 * Sliding-window rate limiter keyed by `${kind}:${playerId}`.
 *
 * Stores timestamps (ms) of recent events; on every check, prunes entries
 * older than 60s, then counts against both the per-second and per-minute
 * caps. Returns { ok: true } if the event fits, or { ok: false, retryAfterMs }
 * with the wait until the oldest blocking event expires.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  check(
    kind: RateLimitKind,
    playerId: string,
    now: number = Date.now(),
  ): { ok: true } | { ok: false; retry_after_ms: number } {
    const limit: Window = RATE_LIMITS[kind];
    const key = `${kind}:${playerId}`;
    const minuteAgo = now - 60_000;
    const secondAgo = now - 1_000;

    const stored = this.hits.get(key) ?? [];
    const recent = stored.filter((t) => t >= minuteAgo);

    const inLastSecond = recent.filter((t) => t >= secondAgo).length;
    if (inLastSecond >= limit.perSecond) {
      const oldestInWindow = recent.find((t) => t >= secondAgo)!;
      // Clamp to ≥1 — clock skew / exact-boundary timestamps could otherwise
      // produce 0 or negative, which clients would interpret as "no wait".
      const wait = Math.max(1, 1_000 - (now - oldestInWindow));
      return { ok: false, retry_after_ms: wait };
    }

    if (recent.length >= limit.perMinute) {
      const oldestInWindow = recent[0]!;
      const wait = Math.max(1, 60_000 - (now - oldestInWindow));
      return { ok: false, retry_after_ms: wait };
    }

    recent.push(now);
    this.hits.set(key, recent);
    return { ok: true };
  }

  /** Test-only helper. */
  reset(): void {
    this.hits.clear();
  }
}
