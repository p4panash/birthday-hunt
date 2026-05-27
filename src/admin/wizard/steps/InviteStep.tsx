import { useState } from 'react';
import Icon from '../../Icon';
import { STEPS, type HuntDraft } from '../data';
import { AiNudge, Field, StepPage } from '../primitives';

interface Props {
  draft: HuntDraft;
  setDraft: React.Dispatch<React.SetStateAction<HuntDraft>>;
}

export default function InviteStep({ draft, setDraft }: Props) {
  const [email, setEmail] = useState('');
  const addInvitee = () => {
    if (!email) return;
    setDraft((d) => ({ ...d, invitees: [...d.invitees, email] }));
    setEmail('');
  };
  return (
    <StepPage
      step={STEPS[7]}
      intro="Last step. Send the hunt link, generate a printable QR, or just hand them a slip of paper."
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 32 }}>
        <div>
          <Field
            label="Send to"
            hint="They'll get a link + a calendar invite for the start time."
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                placeholder="name@email.com or +40…"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addInvitee()}
              />
              <button className="btn btn-primary" onClick={addInvitee}>
                Add
              </button>
            </div>
          </Field>
          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {draft.invitees.map((e, i) => (
              <div
                key={i}
                className="card"
                style={{
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'oklch(0.86 0.04 70)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    color: 'var(--ink)',
                  }}
                >
                  {e[0]?.toUpperCase()}
                </div>
                <span style={{ flex: 1, fontSize: 13 }}>{e}</span>
                {i === 0 && <span className="chip chip-mono">PRIMARY</span>}
                <button
                  className="btn-quiet"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      invitees: d.invitees.filter((_, j) => j !== i),
                    }))
                  }
                  style={{
                    width: 24,
                    height: 24,
                    padding: 0,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--muted)',
                  }}
                >
                  <Icon name="x" size={13} />
                </button>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 28 }}>
            <div className="label" style={{ marginBottom: 10 }}>
              Or share with…
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <ShareTile icon="link" label="Copy link" sub="goodloot.app/h/8mhl" />
              <ShareTile icon="qr" label="Print QR" sub="A5 poster · PDF" />
              <ShareTile icon="send" label="Telegram" />
              <ShareTile icon="send" label="WhatsApp" />
            </div>
          </div>

          <AiNudge>
            Reminder: I'll schedule the hunt to start at {draft.timeStart} on{' '}
            {draft.date}. You'll get a ping 24h before to confirm.
          </AiNudge>
        </div>

        <div
          className="card"
          style={{ padding: 20, textAlign: 'center', alignSelf: 'flex-start' }}
        >
          <div
            className="mono"
            style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--muted)' }}
          >
            HUNTER PREVIEW
          </div>
          <div className="serif" style={{ fontSize: 20, marginTop: 8 }}>
            {draft.title}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--muted)',
              fontStyle: 'italic',
              fontFamily: 'var(--serif)',
            }}
          >
            {draft.stops.length} stops · {draft.stops.length} clues · 1{' '}
            {draft.reward.kind === 'locker' ? 'locker' : 'finale'}
          </div>

          <div style={{ margin: '18px auto', width: 140, height: 140 }}>
            <QRPlaceholder />
          </div>

          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
            Hunters scan to open the first clue.
          </div>
          <button
            className="btn btn-ghost"
            style={{
              marginTop: 12,
              fontSize: 12,
              width: '100%',
              justifyContent: 'center',
            }}
          >
            <Icon name="copy" size={13} /> Copy invite text
          </button>
        </div>
      </div>
    </StepPage>
  );
}

function ShareTile({
  icon,
  label,
  sub,
}: {
  icon: 'link' | 'qr' | 'send';
  label: string;
  sub?: string;
}) {
  return (
    <div
      className="card"
      style={{
        padding: 12,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minWidth: 160,
      }}
    >
      <Icon name={icon} size={16} color="var(--ink-2)" />
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        {sub && (
          <div className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

function QRPlaceholder() {
  const SIZE = 21;
  const cells: { x: number; y: number; on: boolean }[] = [];
  const seedRand = (i: number) => ((i * 9301 + 49297) % 233280) / 233280;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const inFinder =
        (x < 7 && y < 7) ||
        (x > SIZE - 8 && y < 7) ||
        (x < 7 && y > SIZE - 8);
      if (inFinder) {
        const fx = x < 7 ? x : SIZE - 1 - x;
        const fy = y < 7 ? y : SIZE - 1 - y;
        const isBorder = fx === 0 || fy === 0 || fx === 6 || fy === 6;
        const isInner = fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4;
        cells.push({ x, y, on: isBorder || isInner });
      } else {
        cells.push({ x, y, on: seedRand(x * 17 + y * 31) > 0.55 });
      }
    }
  }
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ width: 140, height: 140 }}>
      {cells
        .filter((c) => c.on)
        .map((c, i) => (
          <rect key={i} x={c.x} y={c.y} width="1" height="1" fill="var(--ink)" />
        ))}
    </svg>
  );
}
