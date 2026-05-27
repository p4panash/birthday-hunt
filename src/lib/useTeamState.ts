// Hook that mirrors the server-authoritative HuntState into a React reducer.
//
// The DO is authoritative: this hook never applies actions locally. Instead it
// sends ClientMsg.action over the WebSocket and lets the server's ServerMsg.state
// frame drive the React state. That guarantees every teammate sees the same
// step within one round-trip.
//
// localTestMode is merged on top of the server state so `?test=1` stays a
// per-device flag (resolved decision #6).
//
// Social bundle extension: the same WS carries a second channel of social
// events (chat, reactions, pings — Phase 1). They're exposed here too because
// the WS is the only one — opening a second socket would multiply DO costs
// and complicate hibernation accounting.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ServerMsgSchema } from 'shared/messages';
import type {
  HuntAction,
  HuntState,
} from 'shared/state/types';
import type {
  ChatMessage,
  PlayerPresence,
  ReactionEmoji,
} from 'shared/messages';
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
  /** Chat history, chronological (oldest first). */
  chat: ChatMessage[];
  /**
   * Monotonically-incrementing counter bumped each time the server delivers
   * a `chat_snapshot` (i.e. on initial connect and on every reconnect).
   * Consumers should treat the entire `chat` array as "already seen" when
   * this value changes — otherwise a reconnect would re-flag old messages
   * as unread.
   */
  chatSnapshotRev: number;
  /** Pulses true for ~1s when admin wipes chat — UI can show a toast. */
  chatWiped: boolean;
  sendChat: (body: string) => void;
  /**
   * Send a floating reaction. Echoes locally too so the sender sees it
   * without waiting for the WS round-trip.
   */
  sendReaction: (emoji: ReactionEmoji) => void;
  /**
   * Active floating reactions, garbage-collected automatically by the hook
   * after their 2-second TTL. Each render passes these to FloatingReactionLayer.
   */
  reactions: FloatingReaction[];
  /**
   * Active map pings, garbage-collected after their 5-second TTL.
   */
  pings: ActivePing[];
  /** Drop a map ping at (lat, lng). */
  sendPing: (lat: number, lng: number) => void;
  /**
   * Broadcast our own GPS position to teammates. Called by the team shell
   * whenever the local geo watcher emits a new fix; throttled internally
   * to ≤1 update per 2 seconds.
   */
  publishPosition: (lat: number, lng: number, accuracy?: number) => void;
}

export interface FloatingReaction {
  id: string;
  emoji: ReactionEmoji;
  sender_id: string;
  sender_name: string;
  expires_at: number;
}

export interface ActivePing {
  id: string;
  lat: number;
  lng: number;
  sender_id: string;
  sender_name: string;
  expires_at: number;
}

const REACTION_TTL_MS = 2_000;
const POSITION_MIN_GAP_MS = 2_000;

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
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatSnapshotRev, setChatSnapshotRev] = useState(0);
  const [chatWiped, setChatWiped] = useState(false);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [pings, setPings] = useState<ActivePing[]>([]);
  const lastPositionAtRef = useRef<number>(0);

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
        // Guard against StrictMode (and slow async close) double-delivery:
        // if this socket is no longer the active one, drop the frame.
        if (wsRef.current !== ws) return;
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
        } else if (parsed.type === 'chat_snapshot') {
          setChat(parsed.messages);
          setChatSnapshotRev((r) => r + 1);
        } else if (parsed.type === 'chat_new') {
          setChat((prev) => [...prev, parsed.message]);
        } else if (parsed.type === 'chat_wiped') {
          setChat([]);
          setChatWiped(true);
          setTimeout(() => setChatWiped(false), 1000);
        } else if (parsed.type === 'react_show') {
          // Server reactions never collide with local-echo ids (different
          // prefixes), so unconditional append is safe. The own-reaction's
          // server broadcast IS rendered alongside the local echo because
          // they share emoji but render at different jitter positions —
          // visually one tap = one emoji on sender's screen because the
          // local echo lifetime (2s) covers any RTT.
          if (parsed.sender_id === playerId) {
            // Suppress server echo of our own reaction to avoid double-render.
            return;
          }
          setReactions((prev) => [
            ...prev,
            {
              id: parsed.id,
              emoji: parsed.emoji,
              sender_id: parsed.sender_id,
              sender_name: parsed.sender_name,
              expires_at: Date.now() + REACTION_TTL_MS,
            },
          ]);
        } else if (parsed.type === 'ping_show') {
          // Same dedup logic: suppress our own echo from the server.
          if (parsed.sender_id === playerId) return;
          setPings((prev) => [
            ...prev,
            {
              id: parsed.id,
              lat: parsed.lat,
              lng: parsed.lng,
              sender_id: parsed.sender_id,
              sender_name: parsed.sender_name,
              expires_at: parsed.expires_at,
            },
          ]);
        }
        // pong / error: ignored client-side (logged via DevTools if needed)
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
    // The handler refs playerId for own-echo dedup; teamId for the URL.
  }, [teamId, playerId]);

  const dispatch = useCallback((action: HuntAction) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      // Drop silently in dev; production could queue and retry.
      return;
    }
    ws.send(JSON.stringify({ v: 1, type: 'action', action }));
  }, []);

  const sendChat = useCallback((body: string) => {
    const trimmed = body.trim();
    if (!trimmed) return;
    if (trimmed.length > 280) return; // server will also reject; spare the round-trip
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ v: 1, type: 'chat_send', body: trimmed }));
  }, []);

  // GC stale reactions + pings every 250ms.
  useEffect(() => {
    const handle = setInterval(() => {
      const now = Date.now();
      setReactions((prev) => {
        const next = prev.filter((r) => r.expires_at > now);
        return next.length === prev.length ? prev : next;
      });
      setPings((prev) => {
        const next = prev.filter((p) => p.expires_at > now);
        return next.length === prev.length ? prev : next;
      });
    }, 250);
    return () => clearInterval(handle);
  }, []);

  const sendReaction = useCallback(
    (emoji: ReactionEmoji) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      // Local echo: render immediately under a client-generated id so the
      // sender doesn't wait for the round-trip. The server will broadcast
      // its own id; the reducer dedupes server frames whose id matches a
      // local echo (we use a `local-` prefix to keep keyspaces disjoint).
      const localId = `local-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      setReactions((prev) => [
        ...prev,
        {
          id: localId,
          emoji,
          sender_id: playerId,
          sender_name: '', // local echo doesn't render the name
          expires_at: Date.now() + REACTION_TTL_MS,
        },
      ]);
      ws.send(JSON.stringify({ v: 1, type: 'react_send', emoji }));
    },
    [playerId],
  );

  const sendPing = useCallback(
    (lat: number, lng: number) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      // Local echo. Same dedup rationale as reactions: own pings render
      // immediately and the server broadcast for our own send is dropped.
      const localId = `local-pg-${Date.now().toString(36)}`;
      setPings((prev) => [
        ...prev,
        {
          id: localId,
          lat,
          lng,
          sender_id: playerId,
          sender_name: '',
          expires_at: Date.now() + 5_000,
        },
      ]);
      ws.send(JSON.stringify({ v: 1, type: 'ping_send', lat, lng }));
    },
    [playerId],
  );

  const publishPosition = useCallback(
    (lat: number, lng: number, accuracy?: number) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const now = Date.now();
      if (now - lastPositionAtRef.current < POSITION_MIN_GAP_MS) return;
      lastPositionAtRef.current = now;
      ws.send(
        JSON.stringify({
          v: 1,
          type: 'presence_position',
          lat,
          lng,
          accuracy,
        }),
      );
    },
    [],
  );

  const state = useMemo<HuntState>(
    () => ({ ...serverState, testMode: localTestMode }),
    [serverState, localTestMode],
  );

  return {
    state,
    dispatch,
    presence,
    connected,
    hydrated,
    chat,
    chatSnapshotRev,
    chatWiped,
    sendChat,
    sendReaction,
    reactions,
    pings,
    sendPing,
    publishPosition,
  };
}
