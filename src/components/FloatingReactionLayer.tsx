// Full-screen overlay that renders the active reactions as absolutely-
// positioned emojis floating up and fading. The hook owns the lifecycle
// (TTL + GC); this component just paints what it's given.

import { useMemo } from 'react';
import type { FloatingReaction } from '../lib/useTeamState';

const ANIM_MS = 2000;

interface Props {
  reactions: FloatingReaction[];
}

interface ReactionWithJitter extends FloatingReaction {
  /** Stable horizontal offset (px from center) keyed on id. */
  xJitter: number;
}

export default function FloatingReactionLayer({ reactions }: Props) {
  // Compute jitter once per id so re-renders don't move emojis horizontally.
  const decorated = useMemo<ReactionWithJitter[]>(
    () =>
      reactions.map((r) => ({
        ...r,
        xJitter: hashJitter(r.id),
      })),
    [reactions],
  );

  return (
    <>
      <style>{REACTION_KEYFRAMES}</style>
      <div
        data-testid="reaction-layer"
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 70,
          overflow: 'hidden',
        }}
      >
        {decorated.map((r) => (
          <div
            key={r.id}
            data-testid="floating-reaction"
            data-emoji={r.emoji}
            style={{
              position: 'absolute',
              left: `calc(50% + ${r.xJitter}px)`,
              bottom: 80,
              transform: 'translateX(-50%)',
              animation: `bday-react ${ANIM_MS}ms ease-out forwards`,
              fontSize: 32,
              textShadow: '0 2px 8px rgba(0,0,0,0.5)',
              willChange: 'transform, opacity',
            }}
          >
            <div>{r.emoji}</div>
            {r.sender_name && (
              <div
                style={{
                  fontSize: 10,
                  color: '#FFD89C',
                  opacity: 0.7,
                  textAlign: 'center',
                  marginTop: 2,
                  textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.sender_name}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// Deterministic ±120 px jitter from the reaction id, so the same id always
// places at the same X (no jitter on re-render).
function hashJitter(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return ((h % 240) - 120);
}

const REACTION_KEYFRAMES = `
@keyframes bday-react {
  0%   { transform: translate(-50%, 0) scale(0.8); opacity: 0; }
  15%  { transform: translate(-50%, -10px) scale(1.1); opacity: 1; }
  100% { transform: translate(-50%, -180px) scale(1); opacity: 0; }
}
`;
