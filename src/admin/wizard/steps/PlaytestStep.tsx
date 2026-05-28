// Simulated playtest: a phone preview on the left + a timeline of "moments"
// on the right. Tap any moment to scrub the phone. Read-only.

import { useEffect, useState } from 'react';
import Icon from '../../Icon';
import type { HuntDraft } from '../data';
import { MapCanvas, MapPin } from '../MapCanvas';

interface Props {
  draft: HuntDraft;
}

interface Moment {
  id: string;
  stopIdx: number;
  kind: 'arrive' | 'clue' | 'reveal';
  title: string;
  time: string;
}

function buildMoments(draft: HuntDraft): Moment[] {
  // Generate moments dynamically from the actual stops on the draft so the
  // playtest reflects what the user has assembled.
  const ms: Moment[] = [];
  ms.push({ id: 'open', stopIdx: 0, kind: 'arrive', title: 'Hunters open the link', time: 'T+0' });
  draft.stops.forEach((_s, i) => {
    ms.push({
      id: `c${i}`,
      stopIdx: i,
      kind: 'clue',
      title: `Clue ${String(i + 1).padStart(2, '0')} reveals`,
      time: `T+${i === 0 ? '10s' : `${i * 16}m`}`,
    });
    if (i < draft.stops.length - 1) {
      ms.push({
        id: `a${i + 1}`,
        stopIdx: i + 1,
        kind: 'arrive',
        title: `Arrive at ${draft.stops[i + 1].name}`,
        time: `T+${(i + 1) * 16}m`,
      });
    }
  });
  ms.push({
    id: 'reveal',
    stopIdx: draft.stops.length - 1,
    kind: 'reveal',
    title: `${draft.reward.kind === 'locker' ? 'Locker unlocks' : 'Finale reveals'} · ${draft.reward.code}`,
    time: `T+${draft.stops.length * 16}m`,
  });
  return ms;
}

export default function PlaytestStep({ draft }: Props) {
  const moments = buildMoments(draft);
  const [activeIdx, setActiveIdx] = useState(0);
  const moment = moments[activeIdx];
  const stop = draft.stops[moment.stopIdx] ?? draft.stops[0];
  const clue = stop ? draft.clues[stop.id] : null;
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setActiveIdx((i) => (i + 1 >= moments.length ? 0 : i + 1));
    }, 1600);
    return () => clearInterval(id);
  }, [playing, moments.length]);

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <div
        style={{
          flex: 1,
          padding: '36px 48px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 6 }}>
          <div
            className="mono"
            style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.12em' }}
          >
            STEP 09
          </div>
          <div style={{ width: 28, height: 1, background: 'var(--line-2)' }} />
        </div>
        <h1 className="serif" style={{ fontSize: 44, lineHeight: 1.05, margin: 0 }}>
          Playtest the hunt
        </h1>
        <p
          style={{
            fontSize: 16,
            color: 'var(--muted)',
            maxWidth: 520,
            marginTop: 12,
            lineHeight: 1.5,
          }}
        >
          Walk it from your hunter's phone before you publish. Tap any moment to scrub. If
          something feels thin, jump back and rewrite.
        </p>

        <div
          style={{
            marginTop: 28,
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            flex: 1,
          }}
        >
          <div
            style={{
              width: 300,
              height: 600,
              flexShrink: 0,
              background: '#1a1612',
              borderRadius: 38,
              padding: 12,
              boxShadow: 'var(--shadow-3)',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 8,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 90,
                height: 24,
                borderRadius: 12,
                background: '#0c0a08',
                zIndex: 3,
              }}
            />
            <div
              style={{
                width: '100%',
                height: '100%',
                background: 'var(--bg)',
                borderRadius: 28,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <PhoneScreen moment={moment} stop={stop} clue={clue} draft={draft} />
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              alignItems: 'flex-start',
            }}
          >
            <div className="label">Hunter's view</div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--muted)',
                maxWidth: 220,
                lineHeight: 1.55,
              }}
            >
              This is the screen your hunters see at{' '}
              <span className="mono" style={{ color: 'var(--ink)' }}>
                {moment.time}
              </span>
              .
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                className="btn btn-ghost"
                style={{ width: 38, height: 38, padding: 0, justifyContent: 'center' }}
                onClick={() => {
                  setPlaying(false);
                  setActiveIdx((i) => Math.max(0, i - 1));
                }}
              >
                <Icon name="arrow-l" size={14} />
              </button>
              <button
                className="btn btn-primary"
                style={{ width: 38, height: 38, padding: 0, justifyContent: 'center' }}
                onClick={() => setPlaying((p) => !p)}
              >
                {playing ? <Icon name="minus" size={14} /> : <Icon name="arrow-r" size={14} />}
              </button>
              <button
                className="btn btn-ghost"
                style={{ width: 38, height: 38, padding: 0, justifyContent: 'center' }}
                onClick={() => {
                  setPlaying(false);
                  setActiveIdx((i) => Math.min(moments.length - 1, i + 1));
                }}
              >
                <Icon name="arrow-r" size={14} />
              </button>
            </div>
            <div
              style={{
                marginTop: 12,
                padding: '12px 14px',
                background: 'var(--bg-2)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--r-md)',
                maxWidth: 260,
              }}
            >
              <div
                className="mono"
                style={{
                  fontSize: 10,
                  color: 'var(--muted)',
                  letterSpacing: '0.12em',
                  marginBottom: 6,
                }}
              >
                READOUT
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.45 }}>
                {moment.kind === 'clue' && (
                  <>
                    Clue rendered as <b>{clue?.type ?? 'Riddle'}</b>. Reading time ~6s.
                  </>
                )}
                {moment.kind === 'arrive' && (
                  <>
                    GPS unlock at <b>{stop?.name}</b>. Radius 30m.
                  </>
                )}
                {moment.kind === 'reveal' && (
                  <>Final reveal triggers the locker code overlay and the message.</>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <aside
        style={{
          width: 360,
          flexShrink: 0,
          borderLeft: '1px solid var(--line)',
          background: 'var(--paper)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '24px 22px 14px', borderBottom: '1px solid var(--line)' }}>
          <div className="serif" style={{ fontSize: 22, lineHeight: 1.1 }}>
            Timeline
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            {moments.length} moments
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
          {moments.map((m, i) => {
            const on = activeIdx === i;
            return (
              <div
                key={m.id}
                onClick={() => {
                  setPlaying(false);
                  setActiveIdx(i);
                }}
                style={{
                  position: 'relative',
                  padding: '12px 12px 12px 36px',
                  borderRadius: 'var(--r-md)',
                  background: on ? 'var(--terra-soft)' : 'transparent',
                  borderLeft: `2px solid ${on ? 'var(--terra)' : 'transparent'}`,
                  marginBottom: 2,
                  cursor: 'pointer',
                  transition: 'background 120ms',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: 16,
                    top: 0,
                    bottom: 0,
                    width: 1,
                    background:
                      i === moments.length - 1 ? 'transparent' : 'var(--line)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: 11,
                    top: 14,
                    width: 11,
                    height: 11,
                    borderRadius: '50%',
                    background:
                      m.kind === 'reveal'
                        ? 'var(--terra)'
                        : on
                        ? 'var(--ink)'
                        : 'var(--paper)',
                    border: `2px solid ${
                      m.kind === 'reveal' ? 'var(--terra)' : 'var(--ink)'
                    }`,
                    zIndex: 1,
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <div
                    style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}
                  >
                    {m.title}
                  </div>
                  <span style={{ flex: 1 }} />
                  <span
                    className="mono"
                    style={{ fontSize: 10, color: 'var(--muted)' }}
                  >
                    {m.time}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            borderTop: '1px solid var(--line)',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--bg-2)',
          }}
        >
          <Icon name="check" size={14} color="var(--moss, oklch(0.50 0.08 150))" stroke={2.4} />
          <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
            No gaps detected · ready to publish
          </span>
        </div>
      </aside>
    </div>
  );
}

interface PhoneScreenProps {
  moment: Moment;
  stop?: HuntDraft['stops'][number];
  clue: { type: string; text: string } | null;
  draft: HuntDraft;
}

function PhoneScreen({ moment, stop, clue, draft }: PhoneScreenProps) {
  if (!stop) return null;
  if (moment.kind === 'arrive') {
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          <MapCanvas tone="light" showLabels={false}>
            <MapPin
              x={stop.x ?? 500}
              y={stop.y ?? 350}
              n={stop.order ?? 1}
              pulse
              large
            />
          </MapCanvas>
        </div>
        <div
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            bottom: 16,
            background: 'var(--paper)',
            borderRadius: 16,
            padding: 14,
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            border: '1px solid var(--line)',
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 10,
              color: 'var(--terra)',
              letterSpacing: '0.12em',
            }}
          >
            STOP {String(stop.order ?? 1).padStart(2, '0')} · UNLOCKED
          </div>
          <div className="serif" style={{ fontSize: 21, lineHeight: 1.1, marginTop: 6 }}>
            {stop.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            {stop.tag}
          </div>
          <button
            className="btn btn-terra"
            style={{
              width: '100%',
              justifyContent: 'center',
              marginTop: 12,
              fontSize: 13,
            }}
          >
            Open the clue <Icon name="arrow-r" size={13} />
          </button>
        </div>
      </div>
    );
  }
  if (moment.kind === 'clue') {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          padding: '36px 22px 22px',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-2)',
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 10,
            color: 'var(--muted)',
            letterSpacing: '0.12em',
          }}
        >
          STOP {String(stop.order ?? 1).padStart(2, '0')} ·{' '}
          {clue?.type?.toUpperCase() ?? 'RIDDLE'}
        </div>
        <div
          className="serif"
          style={{
            fontSize: 18,
            color: 'var(--muted-2)',
            marginTop: 6,
            fontStyle: 'italic',
          }}
        >
          {stop.name}
        </div>
        <div
          className="serif"
          style={{
            marginTop: 22,
            fontSize: 22,
            lineHeight: 1.35,
            color: 'var(--ink)',
          }}
        >
          {clue?.text ?? 'No clue yet.'}
        </div>
        <span style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
          <button
            className="btn btn-ghost"
            style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
          >
            Need a nudge?
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
          >
            I'm here <Icon name="check" size={13} />
          </button>
        </div>
      </div>
    );
  }
  if (moment.kind === 'reveal') {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          background:
            'linear-gradient(180deg, var(--ink) 0%, oklch(0.28 0.04 50) 100%)',
          color: 'var(--bg)',
          padding: '36px 22px 22px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div
          className="mono"
          style={{ fontSize: 10, letterSpacing: '0.16em', opacity: 0.6 }}
        >
          FINALE
        </div>
        <div
          className="serif"
          style={{
            fontSize: 40,
            lineHeight: 1,
            marginTop: 18,
            textAlign: 'center',
            letterSpacing: '-0.01em',
          }}
        >
          The code is
        </div>
        <div
          className="mono"
          style={{
            marginTop: 22,
            fontSize: 40,
            letterSpacing: '0.16em',
            padding: '14px 18px',
            border: '1.5px dashed rgba(255,255,255,0.4)',
            borderRadius: 12,
          }}
        >
          {draft.reward.code}
        </div>
        <p
          className="serif-italic"
          style={{
            fontSize: 16,
            marginTop: 22,
            textAlign: 'center',
            opacity: 0.85,
            lineHeight: 1.45,
            maxWidth: 220,
          }}
        >
          &ldquo;{draft.reward.message.slice(0, 100)}…&rdquo;
        </p>
        <span style={{ flex: 1 }} />
        <div
          style={{
            fontSize: 10,
            opacity: 0.5,
            letterSpacing: '0.12em',
          }}
          className="mono"
        >
          GOODLOOT · {draft.title.toUpperCase()}
        </div>
      </div>
    );
  }
  return null;
}
