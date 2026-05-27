// Tiny top-right pill showing connected teammates. Tap to expand the list.
// Intentionally minimal — the existing v1 UI does the heavy lifting and this
// just answers "who else is here?" without competing for attention.

import { useState } from 'react';
import type { PlayerPresence } from 'shared/messages';

interface Props {
  presence: PlayerPresence[];
  connected: boolean;
  selfPlayerId: string;
}

export default function PresenceRibbon({
  presence,
  connected,
  selfPlayerId,
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
      }}
    >
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
  );
}
