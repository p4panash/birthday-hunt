// Team mode: WebSocket-driven cooperative play. useTeamState mirrors the
// authoritative HuntState from the DO; dispatch sends actions over the wire.
//
// A small presence ribbon shows who else is online with you (and a red dot
// when the WebSocket is disconnected). It's intentionally tiny so it doesn't
// fight the existing v1 UI for attention.

import { useQrSlices } from './lib/useQrSlices';
import { detectTestMode } from './lib/testMode';
import { useTeamState } from './lib/useTeamState';
import type { TeamSession } from './lib/teamSession';
import GameShell from './GameShell';
import PresenceRibbon from './components/PresenceRibbon';

const QR_SRC = `${import.meta.env.BASE_URL}qr.jpg`;

interface Props {
  session: TeamSession;
}

export default function TeamMode({ session }: Props) {
  const { state, dispatch, hydrated, presence, connected } = useTeamState({
    teamId: session.team_id,
    playerId: session.player_id,
    localTestMode: detectTestMode(),
  });
  const sliceUrls = useQrSlices(QR_SRC);

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
      />
    </>
  );
}
