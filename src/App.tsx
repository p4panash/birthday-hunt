// Top-level mode router. Three modes:
//   1. `/join`               → invite-code entry
//   2. team session present  → cooperative multiplayer (WebSocket-driven)
//   3. otherwise             → solo mode (v1 behaviour, untouched)
//
// Admin SPA mounts at /admin via a separate Vite entrypoint (see src/admin/).

import { useEffect, useState } from 'react';
import SoloMode from './SoloMode';
import TeamMode from './TeamMode';
import Join from './screens/Join';
import AdminApp from './admin/AdminApp';
import { loadTeamSession, type TeamSession } from './lib/teamSession';
import OfflineBanner from './pwa/OfflineBanner';
import UpdateToast from './pwa/UpdateToast';

type Route = 'admin' | 'join' | 'team' | 'solo';

function decideRoute(pathname: string, session: TeamSession | null): Route {
  if (pathname.includes('/admin')) return 'admin';
  if (pathname.endsWith('/join') || pathname.includes('/join/')) return 'join';
  if (session) return 'team';
  return 'solo';
}

export default function App() {
  const [session, setSession] = useState<TeamSession | null>(() =>
    loadTeamSession(),
  );
  const [route, setRoute] = useState<Route>(() =>
    decideRoute(window.location.pathname, loadTeamSession()),
  );

  useEffect(() => {
    function onPopState() {
      setRoute(decideRoute(window.location.pathname, loadTeamSession()));
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Admin SPA owns its full chrome; PWA overlays are mounted there separately
  // if/when we want them in admin (not for v1).
  if (route === 'admin') {
    return <AdminApp />;
  }

  return (
    <>
      <OfflineBanner />
      <UpdateToast />
      {route === 'join' ? (
        <Join
          onJoined={() => {
            const next = loadTeamSession();
            setSession(next);
            // Drop the /join from the URL so a reload lands in team mode.
            const base = import.meta.env.BASE_URL || '/';
            window.history.replaceState(null, '', base);
            setRoute('team');
          }}
        />
      ) : route === 'team' && session ? (
        <TeamMode session={session} />
      ) : (
        <SoloMode />
      )}
    </>
  );
}
