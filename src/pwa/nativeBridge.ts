// Feature detection for the Capacitor shell. The web app must continue
// working unchanged in plain browsers; this helper centralises the
// "are we running inside the native wrapper?" check so feature branches
// don't import @capacitor/core directly all over the codebase.

import { Capacitor } from '@capacitor/core';

export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export type NativePlatform = 'ios' | 'android' | 'web';

export function platform(): NativePlatform {
  try {
    const p = Capacitor.getPlatform();
    if (p === 'ios' || p === 'android') return p;
    return 'web';
  } catch {
    return 'web';
  }
}
