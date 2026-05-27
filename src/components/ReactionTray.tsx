// Compact reaction tray pinned to the bottom-right of the team screen.
// Six fixed emojis (spec § Reactions). Tap dispatches sendReaction; the hook
// adds a local-echo entry to `reactions` and broadcasts to the team via WS.

import type { ReactionEmoji } from 'shared/messages';
import { REACTION_EMOJIS } from 'shared/messages';

interface Props {
  onReact: (emoji: ReactionEmoji) => void;
}

export default function ReactionTray({ onReact }: Props) {
  return (
    <div
      data-testid="reaction-tray"
      style={{
        position: 'fixed',
        right: 12,
        bottom: 'max(env(safe-area-inset-bottom), 16px)',
        zIndex: 55,
        display: 'flex',
        gap: 4,
        background: 'rgba(31, 20, 48, 0.78)',
        border: '1px solid rgba(255, 216, 156, 0.18)',
        borderRadius: 999,
        padding: '6px 8px',
        backdropFilter: 'blur(8px)',
      }}
    >
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onReact(emoji)}
          data-testid={`reaction-${emoji}`}
          aria-label={`send ${emoji} reaction`}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: 22,
            lineHeight: 1,
            padding: '4px 6px',
            borderRadius: 999,
            color: 'inherit',
          }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
