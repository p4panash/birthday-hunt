// Team mode: WebSocket-driven cooperative play. useTeamState mirrors the
// authoritative HuntState from the DO; dispatch sends actions over the wire.
//
// A small presence ribbon shows who else is online with you (and a red dot
// when the WebSocket is disconnected). It's intentionally tiny so it doesn't
// fight the existing v1 UI for attention.
//
// Social bundle (P1-P3): chat drawer, floating reactions, mini-map with
// pings. The map only mounts during the active LocationActive step.

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useQrSlices } from './lib/useQrSlices';
import { detectTestMode } from './lib/testMode';
import { useTeamState } from './lib/useTeamState';
import type { TeamSession } from './lib/teamSession';
import { tierFromDistance, useGeoWatch } from './geo/useGeoWatch';
import GameShell from './GameShell';
import PresenceRibbon from './components/PresenceRibbon';
import ChatDrawer from './components/ChatDrawer';
import ReactionTray from './components/ReactionTray';
import FloatingReactionLayer from './components/FloatingReactionLayer';
import { config } from './config';

// Leaflet weighs ~38KB gz; keep it out of the initial bundle.
const TeamMap = lazy(() => import('./components/TeamMap'));

const QR_SRC = `${import.meta.env.BASE_URL}qr.jpg`;

interface Props {
  session: TeamSession;
}

export default function TeamMode({ session }: Props) {
  const {
    state,
    dispatch,
    hydrated,
    presence,
    connected,
    chat,
    chatSnapshotRev,
    sendChat,
    reactions,
    sendReaction,
    pings,
    sendPing,
    publishPosition,
  } = useTeamState({
    teamId: session.team_id,
    playerId: session.player_id,
    localTestMode: detectTestMode(),
  });
  const sliceUrls = useQrSlices(QR_SRC);

  // Local GPS — only watch when the active step needs it. The hook needs a
  // target to compute distance against; we use the current checkpoint's
  // coords when state.step.kind === 'location', null otherwise.
  const activeCheckpoint =
    state.step.kind === 'location' ? config.checkpoints[state.step.n] : null;
  const geo = useGeoWatch(
    activeCheckpoint
      ? { lat: activeCheckpoint.lat, lng: activeCheckpoint.lng }
      : null,
  );

  // Publish position to teammates whenever we get a fix.
  useEffect(() => {
    if (geo.lat == null || geo.lng == null) return;
    publishPosition(geo.lat, geo.lng, geo.accuracyMeters ?? undefined);
  }, [geo.lat, geo.lng, geo.accuracyMeters, publishPosition]);

  // Chat drawer + unread counter (same as before).
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const lastSeenIdRef = useRef<number>(0);
  const lastSnapshotRevRef = useRef<number>(chatSnapshotRev);

  useEffect(() => {
    if (chatSnapshotRev === lastSnapshotRevRef.current) return;
    lastSnapshotRevRef.current = chatSnapshotRev;
    lastSeenIdRef.current = chat.length > 0 ? chat[chat.length - 1].id : 0;
    setUnread(0);
  }, [chatSnapshotRev, chat]);

  useEffect(() => {
    if (chat.length === 0) {
      lastSeenIdRef.current = 0;
      setUnread(0);
      return;
    }
    const newest = chat[chat.length - 1];
    if (chatOpen) {
      lastSeenIdRef.current = newest.id;
      setUnread(0);
      return;
    }
    const incoming = chat.filter(
      (m) => m.id > lastSeenIdRef.current && m.player_id !== session.player_id,
    );
    if (incoming.length > 0) {
      setUnread((u) => u + incoming.length);
      lastSeenIdRef.current = newest.id;
    }
  }, [chat, chatOpen, session.player_id]);

  function openChat() {
    setChatOpen(true);
    setUnread(0);
    if (chat.length > 0) {
      lastSeenIdRef.current = chat[chat.length - 1].id;
    }
  }

  if (!hydrated) {
    return (
      <div className="app-shell" style={{ padding: 32, opacity: 0.6 }}>
        connecting…
      </div>
    );
  }

  // Render the map only when there's an active checkpoint to anchor against.
  const tier = tierFromDistance(geo.distanceMeters);
  const mapSlot = activeCheckpoint ? (
    <Suspense fallback={null}>
      <TeamMap
        selfPlayerId={session.player_id}
        selfLat={geo.lat}
        selfLng={geo.lng}
        presence={presence}
        pings={pings}
        checkpoint={{ lat: activeCheckpoint.lat, lng: activeCheckpoint.lng }}
        showCheckpoint={tier === 'onTop'}
        onMapTap={sendPing}
      />
    </Suspense>
  ) : null;

  return (
    <>
      <GameShell
        state={state}
        dispatch={dispatch}
        sliceUrls={sliceUrls}
        locationMapSlot={mapSlot}
      />
      <PresenceRibbon
        presence={presence}
        connected={connected}
        selfPlayerId={session.player_id}
        onOpenChat={openChat}
        unreadChatCount={unread}
      />
      <ChatDrawer
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={chat}
        selfPlayerId={session.player_id}
        onSend={sendChat}
      />
      <ReactionTray onReact={sendReaction} />
      <FloatingReactionLayer reactions={reactions} />
    </>
  );
}
