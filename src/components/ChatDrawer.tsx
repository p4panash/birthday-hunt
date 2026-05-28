// Slide-in chat drawer for team mode. Reads ChatMessage[] from useTeamState
// and surfaces a send box for new messages.
//
// Layout: right-side panel, ~320px wide on desktop, full-width on mobile.
// Self messages right-aligned with accent color; others left-aligned with
// sender name above the bubble.
//
// Auto-scroll behaviour: when a new message arrives, scroll to the bottom
// only if the user is already near the bottom (within 80px) — don't yank
// them up while they're reading history.

import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from 'shared/messages';

interface Props {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  selfPlayerId: string;
  onSend: (body: string) => void;
}

const MAX_CHARS = 280;
const STICK_TO_BOTTOM_PX = 80;

export default function ChatDrawer({
  open,
  onClose,
  messages,
  selfPlayerId,
  onSend,
}: Props) {
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

  // Track whether the user is at the bottom (so we can decide auto-scroll).
  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop;
    stickToBottomRef.current = distanceFromBottom < STICK_TO_BOTTOM_PX;
  }

  // Auto-scroll to bottom on new message if user is sticking, and on open.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, open]);

  // When the drawer closes, reset the "stick to bottom" intent so the next
  // open always lands the user at the latest message. Also defensively
  // returns keyboard focus to the document body — the parent should focus
  // its own trigger button, but we should at least not strand focus inside
  // the off-screen panel.
  useEffect(() => {
    if (open) return;
    stickToBottomRef.current = true;
    const active = document.activeElement;
    if (active instanceof HTMLElement && listRef.current?.parentElement?.contains(active)) {
      active.blur();
    }
  }, [open]);

  function submit() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setDraft('');
    stickToBottomRef.current = true;
  }

  const overLimit = draft.length > MAX_CHARS;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 'min(360px, 100vw)',
        background: 'rgba(31, 20, 48, 0.96)',
        color: '#FFD89C',
        borderLeft: '1px solid rgba(255, 216, 156, 0.18)',
        backdropFilter: 'blur(12px)',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 200ms ease-out',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 60,
        pointerEvents: open ? 'auto' : 'none',
      }}
      data-testid="chat-drawer"
      aria-hidden={!open}
      // `inert` on the closed drawer disables not just pointer events but
      // also Tab focus, screen-reader virtual cursor, and click events on
      // descendants. Modern browsers (Chrome 102+, Safari 15.5+, Firefox
      // 112+) ship this; older fallback to aria-hidden behaviour.
      {...({ inert: !open ? '' : undefined } as Record<string, string | undefined>)}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 16px',
          borderBottom: '1px solid rgba(255, 216, 156, 0.12)',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
        }}
      >
        <span>Team chat</span>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            color: 'inherit',
            border: 'none',
            cursor: 'pointer',
            fontSize: 18,
            opacity: 0.7,
          }}
          aria-label="close chat"
          data-testid="chat-close"
        >
          ✕
        </button>
      </header>

      <div
        ref={listRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
        data-testid="chat-list"
      >
        {messages.length === 0 ? (
          <div
            style={{ opacity: 0.5, fontSize: 13, textAlign: 'center', marginTop: 24 }}
          >
            No messages yet. Say hi 👋
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.player_id === selfPlayerId;
            return (
              <div
                key={m.id}
                style={{
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                }}
                data-testid={`chat-msg-${m.id}`}
                data-self={mine ? 'true' : 'false'}
              >
                {!mine && (
                  <div
                    style={{
                      fontSize: 10,
                      opacity: 0.55,
                      marginBottom: 2,
                      letterSpacing: 0.3,
                    }}
                  >
                    {m.player_name || 'someone'}
                  </div>
                )}
                <div
                  style={{
                    background: mine
                      ? 'rgba(255, 216, 156, 0.22)'
                      : 'rgba(255, 255, 255, 0.08)',
                    color: mine ? '#FFE9C0' : '#FFD89C',
                    padding: '8px 12px',
                    borderRadius: 14,
                    fontSize: 14,
                    lineHeight: 1.35,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {m.body}
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        style={{
          padding: '10px 12px 14px',
          borderTop: '1px solid rgba(255, 216, 156, 0.12)',
          display: 'flex',
          gap: 8,
          alignItems: 'flex-end',
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Say something to the team…"
          rows={1}
          maxLength={MAX_CHARS + 50}
          style={{
            flex: 1,
            background: 'rgba(0,0,0,0.25)',
            color: '#FFD89C',
            border: `1px solid ${overLimit ? '#FF6B5B' : 'rgba(255, 216, 156, 0.2)'}`,
            borderRadius: 10,
            padding: '8px 10px',
            fontSize: 14,
            fontFamily: 'inherit',
            resize: 'none',
            outline: 'none',
            lineHeight: 1.35,
          }}
          data-testid="chat-input"
        />
        <button
          type="submit"
          disabled={!draft.trim() || overLimit}
          style={{
            background: '#FFD89C',
            color: '#1F1430',
            border: 'none',
            borderRadius: 10,
            padding: '8px 14px',
            fontWeight: 600,
            cursor: draft.trim() && !overLimit ? 'pointer' : 'not-allowed',
            opacity: draft.trim() && !overLimit ? 1 : 0.4,
          }}
          data-testid="chat-send"
        >
          Send
        </button>
      </form>
    </div>
  );
}
