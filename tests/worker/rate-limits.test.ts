// Unit tests for the sliding-window RateLimiter. Time is injected.

import { describe, expect, it } from 'vitest';
import { RateLimiter, RATE_LIMITS } from '../../worker/lib/rate-limits';

describe('RateLimiter — chat (1/sec, 30/min)', () => {
  it('allows the first event', () => {
    const rl = new RateLimiter();
    expect(rl.check('chat', 'p1', 1000)).toEqual({ ok: true });
  });

  it('blocks a second event in the same second', () => {
    const rl = new RateLimiter();
    rl.check('chat', 'p1', 1000);
    const r = rl.check('chat', 'p1', 1500);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.retry_after_ms).toBeGreaterThan(0);
      expect(r.retry_after_ms).toBeLessThanOrEqual(1000);
    }
  });

  it('allows one event per second indefinitely under the perMinute cap', () => {
    const rl = new RateLimiter();
    for (let i = 0; i < 20; i++) {
      const r = rl.check('chat', 'p1', i * 1500);
      expect(r).toEqual({ ok: true });
    }
  });

  it('blocks the 31st event in the same minute', () => {
    const rl = new RateLimiter();
    // 30 events spaced 1.5s apart (well above the 1/sec cap, but at the
    // 30/min cap). The 31st should be rejected by the per-minute window.
    let t = 1_000;
    for (let i = 0; i < 30; i++) {
      const r = rl.check('chat', 'p1', t);
      expect(r.ok, `event ${i + 1}`).toBe(true);
      t += 1500;
    }
    // 31st event still inside the 60s window (event #2 was at 2500, so the
    // window covers events 2..30 + this one).
    const r = rl.check('chat', 'p1', t);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.retry_after_ms).toBeGreaterThan(0);
    }
  });

  it('expires entries beyond the 60s window', () => {
    const rl = new RateLimiter();
    // Burn one event at t=0.
    rl.check('chat', 'p1', 0);
    // 70s later, the entry should have aged out — new event allowed.
    expect(rl.check('chat', 'p1', 70_000)).toEqual({ ok: true });
  });

  it('isolates players', () => {
    const rl = new RateLimiter();
    rl.check('chat', 'alice', 1000);
    const alice = rl.check('chat', 'alice', 1500);
    const bob = rl.check('chat', 'bob', 1500);
    expect(alice.ok).toBe(false);
    expect(bob.ok).toBe(true);
  });

  it('isolates kinds (separate buckets)', () => {
    const rl = new RateLimiter();
    rl.check('chat', 'p1', 1000);
    // Reaction has its own bucket — not blocked by chat's first hit.
    expect(rl.check('reaction', 'p1', 1100)).toEqual({ ok: true });
  });
});

describe('RateLimiter — reactions (2/sec, 60/min)', () => {
  it('allows 2 events in the same second, blocks the 3rd', () => {
    const rl = new RateLimiter();
    expect(rl.check('reaction', 'p1', 1000).ok).toBe(true);
    expect(rl.check('reaction', 'p1', 1200).ok).toBe(true);
    expect(rl.check('reaction', 'p1', 1400).ok).toBe(false);
  });
});

describe('RATE_LIMITS constants', () => {
  it('matches spec values', () => {
    expect(RATE_LIMITS.chat.perSecond).toBe(1);
    expect(RATE_LIMITS.chat.perMinute).toBe(30);
    expect(RATE_LIMITS.chat.bodyMaxChars).toBe(280);
    expect(RATE_LIMITS.reaction.perSecond).toBe(2);
    expect(RATE_LIMITS.reaction.perMinute).toBe(60);
    expect(RATE_LIMITS.ping.perSecond).toBe(1);
    expect(RATE_LIMITS.ping.perMinute).toBe(20);
  });
});
