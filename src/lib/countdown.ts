import { useEffect, useState } from 'react';
import { useTestOverrides } from './testOverrides';

export type Countdown = {
  totalMs: number;
  hh: string;
  mm: string;
  ss: string;
  expired: boolean;
};

/**
 * Live ticking countdown from `Date.now()` to `deadlineISO`. Updates once a
 * second. Returns padded `HH:MM:SS` strings ready for display.
 *
 * If `testOverrides.deadlineOverride` is set, it takes precedence over the
 * passed `deadlineISO` so test-mode can fast-forward the timer.
 *
 * No urgency tiers, no color shifts — atmospherics are the styling's job.
 */
export function useCountdown(deadlineISO: string): Countdown {
  const { deadlineOverride } = useTestOverrides();
  const target = deadlineOverride ?? deadlineISO;
  const [cd, setCd] = useState<Countdown>(() => compute_(target));

  useEffect(() => {
    setCd(compute_(target));
    const id = window.setInterval(() => setCd(compute_(target)), 1000);
    return () => window.clearInterval(id);
  }, [target]);

  return cd;
}

function compute_(deadlineISO: string): Countdown {
  const target = Date.parse(deadlineISO);
  if (Number.isNaN(target)) {
    return { totalMs: 0, hh: '--', mm: '--', ss: '--', expired: true };
  }
  const totalMs = Math.max(0, target - Date.now());
  if (totalMs === 0) {
    return { totalMs: 0, hh: '00', mm: '00', ss: '00', expired: true };
  }
  const totalSec = Math.floor(totalMs / 1000);
  const hh = Math.floor(totalSec / 3600);
  const mm = Math.floor((totalSec % 3600) / 60);
  const ss = totalSec % 60;
  return {
    totalMs,
    hh: pad(hh),
    mm: pad(mm),
    ss: pad(ss),
    expired: false,
  };
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
