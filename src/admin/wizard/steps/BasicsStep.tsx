// Step 01 — Basics
//
// Ported from the Quest Wizard.html design package (chat2): a one-line
// header, display-scale serif hunt-name input, a row with For / On /
// Between (recipient with initials avatar, date with relative annotation,
// time window with hour-span annotation), an 8-template horizontal rail
// with per-template sample clues, a selected-template descriptor strip,
// and a compact share-preview row with an artwork dropper placeholder.
//
// Time start/end aren't on HuntDraft as part of the patch flow yet — we
// thread them as local component state but mirror the values used by
// submit.ts (which derives the deadline ISO from draft.date + draft.timeEnd).

import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Icon, { type IconName } from '../../Icon';
import {
  OCCASIONS,
  OCCASION_VIBES,
  STEPS,
  type HuntDraft,
  type OccasionId,
  type OccasionVibe,
} from '../data';
import { AiNudge, StepPage } from '../primitives';

interface Props {
  draft: HuntDraft;
  set: <K extends keyof HuntDraft>(k: K, v: HuntDraft[K]) => void;
}

interface ParsedDate {
  dow: string;
  dowShort: string;
  month: string;
  monthShort: string;
  day: number;
  year: number;
  relative: string;
}

function parseHuntDate(iso: string): ParsedDate | null {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  const DOW = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday',
    'Thursday', 'Friday', 'Saturday',
  ];
  const MON = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  let relative: string;
  if (days === 0) relative = 'today';
  else if (days === 1) relative = 'tomorrow';
  else if (days === -1) relative = 'yesterday';
  else if (days > 1 && days < 21) relative = `in ${days} days`;
  else if (days >= 21) relative = `in ${Math.round(days / 7)} weeks`;
  else relative = `${Math.abs(days)} days ago`;
  return {
    dow: DOW[d.getDay()],
    dowShort: DOW[d.getDay()].slice(0, 3),
    month: MON[d.getMonth()],
    monthShort: MON[d.getMonth()].slice(0, 3),
    day: d.getDate(),
    year: d.getFullYear(),
    relative,
  };
}

function initials(name: string): string {
  if (!name) return '?';
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

function timeSpan(a: string, b: string): string | null {
  const parse = (s: string): number | null => {
    const m = /^(\d{1,2}):(\d{2})/.exec(s);
    return m ? Number(m[1]) + Number(m[2]) / 60 : null;
  };
  const av = parse(a);
  const bv = parse(b);
  if (av == null || bv == null) return null;
  const d = bv - av;
  if (d <= 0) return null;
  const h = Math.floor(d);
  const m = Math.round((d - h) * 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h window`;
  return `${h}h ${m}m window`;
}

interface BigFieldProps {
  overline: string;
  annotation?: string | null;
  children: ReactNode;
}

function BigField({ overline, annotation, children }: BigFieldProps) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 6,
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 10.5,
            letterSpacing: '0.14em',
            color: 'var(--muted)',
            textTransform: 'uppercase',
          }}
        >
          {overline}
        </div>
        {annotation && (
          <div
            style={{
              fontSize: 11.5,
              color: 'var(--ink-2)',
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
              whiteSpace: 'nowrap',
              marginLeft: 8,
            }}
          >
            {annotation}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

export default function BasicsStep({ draft, set }: Props) {
  const occ = OCCASIONS.find((o) => o.id === draft.occasion) ?? OCCASIONS[0];
  const vibe: OccasionVibe = OCCASION_VIBES[draft.occasion] ?? OCCASION_VIBES.birthday;
  const date = parseHuntDate(draft.date);

  // Time start/end live on the HuntDraft (threaded by createHunt as deadline).
  const span = timeSpan(draft.timeStart, draft.timeEnd);

  // Selected template index (1-based for display).
  const selectedIdx =
    OCCASIONS.findIndex((o) => o.id === draft.occasion) + 1 || 1;

  return (
    <StepPage
      step={STEPS[0]}
      slim
      maxWidth={1180}
      intro="Name, recipient, when, and the energy we should match."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0 }}>
        {/* Hunt name — display-scale serif input */}
        <BigField overline="The hunt is called">
          <input
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. lma m1halcea"
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 38,
              padding: '8px 0',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid var(--line)',
              borderRadius: 0,
              letterSpacing: '-0.015em',
              color: 'var(--ink)',
              outline: 'none',
              width: '100%',
            }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: 16,
              marginTop: 6,
              fontSize: 11.5,
              color: 'var(--muted)',
            }}
          >
            <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic' }}>
              Hunters see this on the invite &amp; home screen.
            </span>
            <span
              className="mono"
              style={{ opacity: 0.7, whiteSpace: 'nowrap' }}
            >
              {(draft.title || '').length}/40
            </span>
          </div>
        </BigField>

        {/* Row: For · On · Between */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.1fr 1fr 1.1fr',
            gap: 16,
          }}
        >
          <BigField overline="For">
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  left: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'oklch(0.86 0.05 50)',
                  color: 'var(--ink)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--serif)',
                  fontSize: 13.5,
                  letterSpacing: '0.02em',
                }}
              >
                {initials(draft.recipient)}
              </div>
              <input
                className="input"
                value={draft.recipient}
                onChange={(e) => set('recipient', e.target.value)}
                style={{ paddingLeft: 44, fontSize: 14 }}
              />
            </div>
          </BigField>

          <BigField overline="On" annotation={date ? date.relative : null}>
            <div style={{ position: 'relative' }}>
              <Icon
                name="calendar"
                size={14}
                color="var(--muted)"
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />
              <input
                className="input"
                type="date"
                value={draft.date}
                onChange={(e) => set('date', e.target.value)}
                style={{ paddingLeft: 36, fontSize: 14 }}
              />
            </div>
          </BigField>

          <BigField overline="Between" annotation={span}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                className="input mono"
                value={draft.timeStart}
                onChange={(e) => set('timeStart', e.target.value)}
                style={{
                  textAlign: 'center',
                  padding: '10px 6px',
                  fontSize: 13.5,
                }}
              />
              <span style={{ color: 'var(--muted-2)', fontSize: 12 }}>→</span>
              <input
                className="input mono"
                value={draft.timeEnd}
                onChange={(e) => set('timeEnd', e.target.value)}
                style={{
                  textAlign: 'center',
                  padding: '10px 6px',
                  fontSize: 13.5,
                }}
              />
            </div>
          </BigField>
        </div>

        {/* Templates — full-width horizontal rail */}
        <div style={{ marginTop: 6 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 12,
                minWidth: 0,
              }}
            >
              <div
                className="mono"
                style={{
                  fontSize: 10.5,
                  letterSpacing: '0.14em',
                  color: 'var(--muted)',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}
              >
                Templates
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--ink-2)',
                  fontFamily: 'var(--serif)',
                  fontStyle: 'italic',
                }}
              >
                Pick a starting point — sets tone, stops, pacing, finale.
              </div>
            </div>
            <div
              className="mono"
              style={{
                fontSize: 10.5,
                color: 'var(--muted)',
                letterSpacing: '0.08em',
                whiteSpace: 'nowrap',
              }}
            >
              {selectedIdx} / {OCCASIONS.length}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridAutoFlow: 'column',
              gridAutoColumns: '280px',
              gap: 12,
              overflowX: 'auto',
              paddingBottom: 8,
              marginLeft: -4,
              marginRight: -4,
              paddingLeft: 4,
              paddingRight: 4,
              scrollSnapType: 'x mandatory',
            }}
          >
            {OCCASIONS.map((o) => {
              const on = draft.occasion === o.id;
              const v = OCCASION_VIBES[o.id];
              return (
                <TemplateCard
                  key={o.id}
                  occ={o}
                  vibe={v}
                  selected={on}
                  onSelect={() => set('occasion', o.id as OccasionId)}
                />
              );
            })}
          </div>

          {/* Selected template descriptor */}
          <div
            style={{
              marginTop: 12,
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 18,
              alignItems: 'center',
              padding: '10px 14px',
              borderLeft: `2px solid ${vibe.accent}`,
            }}
          >
            <div
              style={{
                fontSize: 12.5,
                color: 'var(--ink-2)',
                lineHeight: 1.5,
                fontFamily: 'var(--serif)',
                fontStyle: 'italic',
              }}
            >
              {vibe.line}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
              }}
            >
              <Icon name="gift" size={13} color={vibe.accent} />
              <span
                className="mono"
                style={{
                  fontSize: 10.5,
                  color: 'var(--muted)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                Finale
              </span>
              <span style={{ fontSize: 12.5, color: 'var(--ink)' }}>
                · {vibe.finale}
              </span>
            </div>
          </div>
        </div>

        {/* Share preview strip — artwork dropper + summary chips */}
        <SharePreviewStrip
          draft={draft}
          occasion={occ}
          vibe={vibe}
          date={date}
        />

        <AiNudge>
          I noticed you picked{' '}
          <span className="serif-italic">{occ.label.toLowerCase()}</span> for{' '}
          {draft.recipient || 'them'}. I'll lean into{' '}
          {vibe.vibe.split(' · ')[0]} for the clue voice.
        </AiNudge>
      </div>
    </StepPage>
  );
}

interface TemplateCardProps {
  occ: (typeof OCCASIONS)[number];
  vibe: OccasionVibe;
  selected: boolean;
  onSelect: () => void;
}

function TemplateCard({ occ, vibe, selected, onSelect }: TemplateCardProps) {
  const cardStyle: CSSProperties = {
    scrollSnapAlign: 'start',
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    cursor: 'pointer',
    background: 'var(--paper)',
    border: `1px solid ${selected ? 'var(--ink)' : 'var(--line)'}`,
    borderRadius: 'var(--r-md)',
    color: 'var(--ink)',
    fontFamily: 'var(--sans)',
    textAlign: 'left' as const,
    boxShadow: selected ? '0 0 0 3px oklch(0.88 0.012 60), var(--shadow-1)' : 'none',
    transition: 'border-color 120ms, box-shadow 160ms',
    position: 'relative',
    overflow: 'hidden',
    minHeight: 248,
  };
  return (
    <button onClick={onSelect} style={cardStyle}>
      <div
        style={{
          padding: '12px 14px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--line-2)',
          background: selected ? 'oklch(0.97 0.014 70)' : 'transparent',
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 7,
            background: selected ? vibe.accent : 'var(--bg-2)',
            color: selected ? 'white' : 'var(--ink-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 160ms',
          }}
        >
          <Icon name={occ.icon as IconName} size={15} stroke={1.6} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {vibe.pop && !selected && (
            <span
              className="mono"
              style={{
                fontSize: 8.5,
                letterSpacing: '0.12em',
                color: 'var(--muted)',
                textTransform: 'uppercase',
                padding: '3px 7px',
                border: '1px solid var(--line)',
                borderRadius: 999,
              }}
            >
              {vibe.pop}
            </span>
          )}
          {selected && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 10,
                fontFamily: 'var(--mono)',
                letterSpacing: '0.1em',
                color: vibe.accent,
                textTransform: 'uppercase',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: vibe.accent,
                  display: 'inline-block',
                }}
              />
              Selected
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          padding: '12px 14px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 7,
          flex: 1,
        }}
      >
        <div
          className="serif"
          style={{ fontSize: 20, lineHeight: 1.05, color: 'var(--ink)' }}
        >
          {occ.label}
        </div>
        <div
          className="mono"
          style={{
            fontSize: 10,
            color: 'var(--muted)',
            letterSpacing: '0.04em',
          }}
        >
          {vibe.vibe}
        </div>
        <div
          style={{
            marginTop: 4,
            padding: '7px 9px',
            background: 'var(--bg-2)',
            borderLeft: `2px solid ${selected ? vibe.accent : 'var(--line-2)'}`,
            fontFamily: 'var(--serif)',
            fontStyle: 'italic',
            fontSize: 12,
            color: 'var(--ink-2)',
            lineHeight: 1.45,
          }}
        >
          &ldquo;{vibe.sample}&rdquo;
        </div>
      </div>

      <div
        style={{
          padding: '10px 14px 12px',
          marginTop: 10,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 4,
          borderTop: '1px solid var(--line-2)',
        }}
      >
        {(
          [
            ['Stops', vibe.stops.replace(' stops', '')],
            ['Length', vibe.duration.replace('~', '')],
            ['Tone', vibe.difficulty],
          ] as const
        ).map(([k, val]) => (
          <div key={k}>
            <div
              className="mono"
              style={{
                fontSize: 9,
                letterSpacing: '0.12em',
                color: 'var(--muted)',
                textTransform: 'uppercase',
              }}
            >
              {k}
            </div>
            <div
              style={{ fontSize: 12, color: 'var(--ink)', marginTop: 2 }}
            >
              {val}
            </div>
          </div>
        ))}
      </div>
    </button>
  );
}

interface ShareStripProps {
  draft: HuntDraft;
  occasion: (typeof OCCASIONS)[number];
  vibe: OccasionVibe;
  date: ParsedDate | null;
}

function SharePreviewStrip({ draft, occasion, vibe, date }: ShareStripProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '140px 1fr',
        gap: 18,
        padding: '14px 16px',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        background: 'oklch(0.97 0.012 75)',
        alignItems: 'center',
      }}
    >
      <ArtworkSlot />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          minWidth: 0,
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.14em',
            color: 'var(--muted)',
            textTransform: 'uppercase',
          }}
        >
          Share preview · this is what the recipient sees
        </div>
        <div
          className="serif"
          style={{
            fontSize: 22,
            lineHeight: 1.05,
            color: 'var(--ink)',
            fontStyle: draft.title ? 'normal' : 'italic',
            opacity: draft.title ? 1 : 0.45,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {draft.title || 'untitled hunt'}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            marginTop: 2,
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '2px 8px',
              borderRadius: 999,
              background: 'white',
              border: '1px solid var(--line)',
              fontSize: 11,
              color: vibe.accent,
              fontWeight: 500,
            }}
          >
            <Icon name={occasion.icon as IconName} size={10} color={vibe.accent} />
            {occasion.label}
          </span>
          <span
            style={{
              fontSize: 12,
              color: 'var(--ink-2)',
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
            }}
          >
            for {draft.recipient || '—'}
          </span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
            ·
          </span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>
            {date ? `${date.dowShort} ${date.day} ${date.monthShort}` : '— —'}
          </span>
        </div>
      </div>
    </div>
  );
}

// Small drop-target for hunt artwork. Stores the chosen image as a data
// URL in localStorage so it survives reloads of the wizard. Full pipeline
// (upload to R2 + thread through HuntConfig) lives in a follow-up; this
// gives the user something to drag onto while we wire it.
const ARTWORK_KEY = 'wizard-postcard-artwork';

function ArtworkSlot() {
  const [src, setSrc] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ARTWORK_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (src == null) return;
    try {
      localStorage.setItem(ARTWORK_KEY, src);
    } catch {
      /* quota — fall through */
    }
  }, [src]);

  function onFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setSrc(reader.result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <label
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 140,
        height: 96,
        borderRadius: 8,
        background: src ? 'transparent' : 'white',
        border: src ? 'none' : '1.5px dashed var(--line-2)',
        backgroundImage: src ? `url(${src})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {!src && (
        <span
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.12em',
            color: 'var(--muted-2)',
            textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          Drop
          <br />
          artwork
        </span>
      )}
      <input
        type="file"
        accept="image/*"
        style={{
          position: 'absolute',
          opacity: 0,
          inset: 0,
          cursor: 'pointer',
        }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </label>
  );
}
