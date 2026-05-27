// Team mode: WebSocket-driven cooperative play. useTeamState mirrors the
// authoritative HuntState from the DO; dispatch sends actions over the wire.
//
// A small presence ribbon shows who else is online with you (and a red dot
// when the WebSocket is disconnected). It's intentionally tiny so it doesn't
// fight the existing v1 UI for attention.
//
// Social bundle (P1): adds a chat drawer accessed via a fab on the ribbon.

import { useEffect, useRef, useState } from 'react';
import { useQrSlices } from './lib/useQrSlices';
import { detectTestMode } from './lib/testMode';
import { useTeamState } from './lib/useTeamState';
import type { TeamSession } from './lib/teamSession';
import GameShell from './GameShell';
import PresenceRibbon from './components/PresenceRibbon';
import ChatDrawer from './components/ChatDrawer';

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
  } = useTeamState({
    teamId: session.team_id,
    playerId: session.player_id,
    localTestMode: detectTestMode(),
  });
  const sliceUrls = useQrSlices(QR_SRC);

  // Chat drawer + unread counter. The counter increments whenever a new
  // chat_new arrives while the drawer is closed and the sender isn't us;
  // resets on drawer open. The chatSnapshotRev cursor is bumped by
  // useTeamState on every (re)connect so we can treat the snapshot's
  // entire history as "already seen" and not inflate the badge on
  // reconnects.
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const lastSeenIdRef = useRef<number>(0);
  const lastSnapshotRevRef = useRef<number>(chatSnapshotRev);

  // When a snapshot arrives, treat its full payload as seen.
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
    // Count messages newer than lastSeen that weren't sent by us.
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

  return (
    <>
      <GameShell state={state} dispatch={dispatch} sliceUrls={sliceUrls} />
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
    </>
  );
}
