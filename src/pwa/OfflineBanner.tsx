// Top-of-screen banner shown when the browser reports we're offline.
// Listens to the online/offline events; safe for SSR (only mounts client-
// side via React). Doesn't interfere with the app shell — the SW serves
// the cached HTML/JS and the app boots; this banner just labels the state.

import { useEffect, useState } from 'react';

export default function OfflineBanner() {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const onUp = () => setOnline(true);
    const onDown = () => setOnline(false);
    window.addEventListener('online', onUp);
    window.addEventListener('offline', onDown);
    return () => {
      window.removeEventListener('online', onUp);
      window.removeEventListener('offline', onDown);
    };
  }, []);

  if (online) return null;

  return (
    <div
      data-testid="offline-banner"
      role="status"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: '#FF6B5B',
        color: '#1F1430',
        fontSize: 12,
        fontWeight: 600,
        textAlign: 'center',
        padding: '4px 12px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
        paddingTop: 'max(env(safe-area-inset-top), 4px)',
      }}
    >
      You're offline — reconnect to continue your hunt.
    </div>
  );
}
