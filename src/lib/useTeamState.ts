// Hook that mirrors the server-authoritative HuntState into a React reducer.
//
// The DO is authoritative: this hook never applies actions locally. Instead it
// sends ClientMsg.action over the WebSocket and lets the server's ServerMsg.state
// frame drive the React state. That guarantees every teammate sees the same
// step within one round-trip.
//
// localTestMode is merged on top of the server state so `?test=1` stays a
// per-device flag (resolved decision #6).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ServerMsgSchema } from 'shared/messages';
import type {
  HuntAction,
  HuntState,
} from 'shared/state/types';
import type { PlayerPresence } from 'shared/messages';
import { initialState } from 'shared/state/reducer';
import { teamWebSocketUrl } from './api';

const MAX_BACKOFF_MS = 10_000;

export interface UseTeamStateResult {
  state: HuntState;
  dispatch: (action: HuntAction) => void;
  presence: PlayerPresence[];
  connected: boolean;
  /** Has the first state frame arrived from the server? */
  hydrated: boolean;
}

export function useTeamState(args: {
  teamId: string;
  playerId: string;
  localTestMode: boolean;
}): UseTeamStateResult {
  const { teamId, playerId, localTestMode } = args;

  const [serverState, setServerState] = useState<HuntState>(initialState);
  const [presence, setPresence] = useState<PlayerPresence[]>([]);
  const [connected, setConnected] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    function open() {
      if (cancelledRef.current) return;
      const ws = new WebSocket(teamWebSocketUrl(teamId, playerId));
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        setConnected(true);
        reconnectAttemptRef.current = 0;
      });

      ws.addEventListener('message', (event) => {
        if (typeof event.data !== 'string') return;
        let parsed;
        try {
          parsed = ServerMsgSchema.parse(JSON.parse(event.data));
        } catch {
          return; // ignore unknown frames
        }
        if (parsed.type === 'state') {
          setServerState(parsed.state);
          setHydrated(true);
        } else if (parsed.type === 'presence') {
          setPresence(parsed.players);
        }
        // pong/error are observable via diagnostics later; ignored here
      });

      ws.addEventListener('close', () => {
        setConnected(false);
        if (cancelledRef.current) return;
        const delay = Math.min(
          1000 * 2 ** reconnectAttemptRef.current,
          MAX_BACKOFF_MS,
        );
        reconnectAttemptRef.current += 1;
        setTimeout(open, delay);
      });

      ws.addEventListener('error', () => {
        try {
          ws.close();
        } catch {
          /* swallow */
        }
      });
    }

    open();

    return () => {
      cancelledRef.current = true;
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) {
        try {
          ws.close();
        } catch {
          /* swallow */
        }
      }
    };
  }, [teamId, playerId]);

  const dispatch = useCallback((action: HuntAction) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      // Drop silently in dev; production could queue and retry.
      return;
    }
    ws.send(JSON.stringify({ v: 1, type: 'action', action }));
  }, []);

  const state = useMemo<HuntState>(
    () => ({ ...serverState, testMode: localTestMode }),
    [serverState, localTestMode],
  );

  return { state, dispatch, presence, connected, hydrated };
}
