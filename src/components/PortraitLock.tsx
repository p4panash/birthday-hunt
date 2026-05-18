import { useEffect, useState } from 'react';

/**
 * Covers the screen with a friendly nudge when the device is in landscape.
 * The Web doesn't give us a real orientation lock; this is a polite block.
 */
export default function PortraitLock({ children }: { children: React.ReactNode }) {
  const [isLandscape, setIsLandscape] = useState(() => detectLandscape());

  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)');
    const handler = (e: MediaQueryListEvent) => setIsLandscape(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  if (isLandscape && isNarrowEnoughToBeAPhone()) {
    return (
      <div className="portrait-lock">
        <div className="portrait-lock__icon" aria-hidden>↻</div>
        <h2 className="portrait-lock__title">nope.</h2>
        <p className="portrait-lock__body">portrait only. flip me.</p>
      </div>
    );
  }

  return <>{children}</>;
}

function detectLandscape(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(orientation: landscape)').matches;
}

/** Skip the lock screen on desktop/iPad so test-mode demos work. */
function isNarrowEnoughToBeAPhone(): boolean {
  if (typeof window === 'undefined') return false;
  // shortest viewport edge under 600px ≈ a phone
  return Math.min(window.innerWidth, window.innerHeight) < 600;
}
