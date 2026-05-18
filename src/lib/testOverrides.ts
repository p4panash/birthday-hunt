import { useSyncExternalStore } from 'react';

/**
 * Module-level overrides for test mode. Bypasses real GPS / clock so the
 * dev can rehearse the whole flow from a desk. Lives outside React for the
 * pieces that aren't easily prop-drilled (useGeoWatch, useCountdown).
 */

type State = {
  mockGeo: { lat: number; lng: number; accuracy: number } | null;
  deadlineOverride: string | null;
};

let state: State = { mockGeo: null, deadlineOverride: null };
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): State {
  return state;
}

export function useTestOverrides(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function setMockGeo(g: State['mockGeo']): void {
  state = { ...state, mockGeo: g };
  notify();
}

export function setDeadlineOverride(d: State['deadlineOverride']): void {
  state = { ...state, deadlineOverride: d };
  notify();
}

export function clearTestOverrides(): void {
  state = { mockGeo: null, deadlineOverride: null };
  notify();
}
