// Tiny top-right pill showing connected teammates. Tap to expand the list.
// Intentionally minimal — the existing v1 UI does the heavy lifting and this
// just answers "who else is here?" without competing for attention.
//
// Social bundle (P1): adds a chat fab next to the presence pill with an
// unread-count badge. Click opens the chat drawer (rendered by the parent,
// which also owns the open/closed state).

import { useState } from 'react';
import type { PlayerPresence } from 'shared/messages';
import PushOptInPill from '../pwa/PushOptInPill';

interface Props {
  presence: PlayerPresence[];
  connected: boolean;
  selfPlayerId: string;
  /** When provided, renders a chat fab. */
  onOpenChat?: () => void;
  unreadChatCount?: number;
  /** When provided, renders the push opt-in pill (team mode only). */
  teamId?: string;
}

export default function PresenceRibbon({
  presence,
  connected,
  selfPlayerId,
  onOpenChat,
  unreadChatCount = 0,
  teamId,
}: Props) {
  const [open, setOpen] = useState(false);

  // De-duplicate by playerId — a player with two tabs counts as one.
  const seen = new Set<string>();
  const others: PlayerPresence[] = [];
  for (const p of presence) {
    if (p.playerId === selfPlayerId) continue;
    if (seen.has(p.playerId)) continue;
    seen.add(p.playerId);
    others.push(p);
  }

  const label = (() => {
    if (!connected) return 'offline';
    if (others.length === 0) return 'solo';
    if (others.length === 1) return `+ ${others[0].name || 'someone'}`;
    return `+ ${others.length} teammates`;
  })();

  return (
    <div
      style={{
        position: 'fixed',
        top: 'max(env(safe-area-inset-top), 12px)',
        right: 12,
        zIndex: 50,
        pointerEvents: 'auto',
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
      }}
    >
      {teamId && (
        <PushOptInPill teamId={teamId} playerId={selfPlayerId} />
      )}
      {onOpenChat && (
        <button
          onClick={onOpenChat}
          data-testid="chat-fab"
          aria-label={
            unreadChatCount > 0
              ? `Open chat (${unreadChatCount} unread)`
              : 'Open chat'
          }
          style={{
            position: 'relative',
            background: 'rgba(31, 20, 48, 0.78)',
            color: '#FFD89C',
            border: '1px solid rgba(255, 216, 156, 0.18)',
            borderRadius: 999,
            padding: '6px 10px',
            fontSize: 12,
            fontFamily: 'inherit',
            backdropFilter: 'blur(8px)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span aria-hidden style={{ fontSize: 14 }}>💬</span>
          <span style={{ fontWeight: 500 }}>chat</span>
          {unreadChatCount > 0 && (
            <span
              data-testid="chat-unread-badge"
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                background: '#FF6B5B',
                color: '#1F1430',
                fontSize: 10,
                fontWeight: 700,
                minWidth: 16,
                height: 16,
                lineHeight: '16px',
                textAlign: 'center',
                borderRadius: 999,
                padding: '0 4px',
              }}
            >
              {unreadChatCount > 99 ? '99+' : unreadChatCount}
            </span>
          )}
        </button>
      )}
      <div>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            background: 'rgba(31, 20, 48, 0.78)',
            color: '#FFD89C',
            border: '1px solid rgba(255, 216, 156, 0.18)',
            borderRadius: 999,
            padding: '6px 12px',
            fontSize: 12,
            fontFamily: 'inherit',
            fontWeight: 500,
            backdropFilter: 'blur(8px)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            maxWidth: 200,
          }}
          title={connected ? 'connected' : 'reconnecting…'}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: connected ? '#9BD89C' : '#FF6B5B',
              display: 'inline-block',
              boxShadow: connected ? '0 0 6px #9BD89C' : '0 0 6px #FF6B5B',
            }}
          />
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {label}
          </span>
        </button>
        {open && others.length > 0 && (
          <div
            style={{
              marginTop: 6,
              background: 'rgba(31, 20, 48, 0.92)',
              color: '#FFD89C',
              border: '1px solid rgba(255, 216, 156, 0.18)',
              borderRadius: 12,
              padding: '8px 12px',
              fontSize: 12,
              backdropFilter: 'blur(8px)',
              minWidth: 140,
            }}
          >
            {others.map((p) => (
              <div
                key={p.playerId}
                style={{ padding: '3px 0', display: 'flex', gap: 8 }}
              >
                <span style={{ opacity: 0.5 }}>·</span>
                <span>{p.name || 'unnamed'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
