// Toast that surfaces when a new SW version is waiting. Click "refresh"
// triggers skipWaiting + reload. Click "later" dismisses for this session.

import { useEffect, useState } from 'react';
import { registerSw } from './registerSw';

export default function UpdateToast() {
  const [showRefresh, setShowRefresh] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handle = registerSw({
      onNeedRefresh: () => setShowRefresh(true),
      onOfflineReady: () => {
        // Optional: a one-time "you're ready to work offline" toast could
        // surface here. Keep it quiet for v1 — the offline shell speaks
        // for itself.
      },
    });
    // No teardown — the SW lifecycle outlives any single component.
    return () => {
      void handle; // intentional: keep handle alive for the session
    };
  }, []);

  if (!showRefresh || dismissed) return null;

  return (
    <div
      data-testid="pwa-update-toast"
      role="status"
      style={{
        position: 'fixed',
        bottom: 'max(env(safe-area-inset-bottom), 16px)',
        left: 12,
        zIndex: 90,
        background: 'rgba(31, 20, 48, 0.96)',
        color: '#FFD89C',
        border: '1px solid rgba(255, 216, 156, 0.2)',
        borderRadius: 12,
        padding: '10px 14px',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        maxWidth: 'calc(100vw - 24px)',
        fontSize: 13,
      }}
    >
      <span>A new version is ready.</span>
      <button
        onClick={async () => {
          const handle = registerSw({ onNeedRefresh: () => {} });
          await handle.update();
        }}
        data-testid="pwa-update-refresh"
        style={{
          background: '#FFD89C',
          color: '#1F1430',
          border: 'none',
          borderRadius: 8,
          padding: '5px 12px',
          fontWeight: 600,
          cursor: 'pointer',
          fontSize: 12,
        }}
      >
        Refresh
      </button>
      <button
        onClick={() => setDismissed(true)}
        aria-label="dismiss"
        style={{
          background: 'transparent',
          color: 'inherit',
          border: 'none',
          opacity: 0.6,
          cursor: 'pointer',
          fontSize: 16,
          padding: '0 4px',
        }}
      >
        ✕
      </button>
    </div>
  );
}
