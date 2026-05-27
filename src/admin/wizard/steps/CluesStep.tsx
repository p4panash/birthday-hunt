import { useState } from 'react';
import Icon from '../../Icon';
import type { HuntDraft } from '../data';
import { AiNudge, Field } from '../primitives';

interface Props {
  draft: HuntDraft;
  setDraft: React.Dispatch<React.SetStateAction<HuntDraft>>;
}

export default function CluesStep({ draft, setDraft }: Props) {
  const [active, setActive] = useState(draft.stops[0]?.id ?? '');
  const stop = draft.stops.find((s) => s.id === active) ?? draft.stops[0];
  const clue = stop ? draft.clues[stop.id] ?? { type: 'Riddle', text: '' } : null;
  const [regen, setRegen] = useState(false);

  const setClueText = (text: string) => {
    if (!stop) return;
    setDraft((d) => ({
      ...d,
      clues: { ...d.clues, [stop.id]: { ...(d.clues[stop.id] ?? { type: 'Riddle' }), text } },
    }));
  };

  if (!stop || !clue) {
    return (
      <div style={{ flex: 1, padding: 48 }}>
        <p style={{ color: 'var(--muted)' }}>No stops yet — go back to step 05.</p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <div
        style={{
          width: 280,
          flexShrink: 0,
          borderRight: '1px solid var(--line)',
          background: 'var(--paper)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '20px 18px 12px' }}>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--muted)',
              letterSpacing: '0.12em',
              marginBottom: 6,
            }}
          >
            STEP 06
          </div>
          <h1 className="serif" style={{ fontSize: 28, lineHeight: 1.05, margin: 0 }}>
            The clues
          </h1>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
          {draft.stops.map((s, i) => {
            const on = s.id === active;
            const done = draft.clues[s.id]?.text;
            return (
              <div
                key={s.id}
                className="card"
                style={{
                  padding: 12,
                  marginBottom: 6,
                  cursor: 'pointer',
                  background: on ? 'var(--terra-soft)' : 'var(--paper)',
                  borderColor: on ? 'var(--terra)' : 'var(--line)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
                onClick={() => setActive(s.id)}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'var(--terra)',
                    color: 'white',
                    fontSize: 11,
                    fontFamily: 'var(--mono)',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {done ? draft.clues[s.id]!.type + ' clue' : 'no clue yet'}
                  </div>
                </div>
                {done && <Icon name="check" size={13} color="var(--moss, oklch(0.50 0.08 150))" stroke={2.4} />}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ flex: 1, padding: '36px 48px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
          <div
            className="mono"
            style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.12em' }}
          >
            STOP {String(stop.order ?? 1).padStart(2, '0')} · {stop.type.toUpperCase()}
          </div>
        </div>
        <h2 className="serif" style={{ fontSize: 40, lineHeight: 1.05, margin: 0 }}>
          {stop.name}
        </h2>
        <p
          style={{
            fontSize: 14,
            color: 'var(--muted)',
            marginTop: 6,
            fontStyle: 'italic',
            fontFamily: 'var(--serif)',
          }}
        >
          {stop.blurb}
        </p>

        <div style={{ marginTop: 28, maxWidth: 640 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div className="label">Clue text</div>
            <span style={{ flex: 1 }} />
            <span className="chip chip-mono" style={{ background: 'var(--bg-2)' }}>
              {clue.type}
            </span>
          </div>
          <div style={{ position: 'relative' }}>
            <textarea
              className="textarea"
              rows={5}
              value={clue.text}
              onChange={(e) => setClueText(e.target.value)}
              style={{
                fontFamily: 'var(--serif)',
                fontSize: 19,
                lineHeight: 1.45,
                padding: 16,
              }}
            />
            {regen && (
              <div
                className="shimmer"
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 'var(--r-md)',
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 12 }}
              onClick={() => {
                setRegen(true);
                setTimeout(() => setRegen(false), 1200);
              }}
            >
              <Icon name="spark" size={13} /> Rewrite with AI
            </button>
            <button className="btn btn-ghost" style={{ fontSize: 12 }}>
              <Icon name="undo" size={13} /> Make easier
            </button>
            <button className="btn btn-ghost" style={{ fontSize: 12 }}>
              <Icon name="puzzle" size={13} /> Make trickier
            </button>
          </div>
        </div>

        <div
          style={{
            marginTop: 28,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 14,
            maxWidth: 640,
          }}
        >
          <Field label="Hint (after 5 min)" hint="Optional. Shown if hunters tap 'Need a nudge?'">
            <textarea className="textarea" rows={2} placeholder="A gentle nudge…" />
          </Field>
          <Field label="Confirm by" hint="How hunters prove they made it.">
            <select className="input">
              <option>Photo of the place</option>
              <option>Type a code word</option>
              <option>NPC unlocks it</option>
            </select>
          </Field>
        </div>

        <AiNudge>
          Tone is consistent across stops: short sentences, second person, one in-joke per
          stop. Using &ldquo;you&rdquo; not &ldquo;{draft.recipient}&rdquo; — feels more
          intimate.
        </AiNudge>
      </div>
    </div>
  );
}
