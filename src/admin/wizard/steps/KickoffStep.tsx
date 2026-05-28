// Kickoff — single-prompt entry. User writes one paragraph; the Worker calls
// Claude with tool-use and streams the partial JSON back as Server-Sent
// Events. Each `line` event reveals one row of the draft preview the instant
// the model finishes writing it — the feel is "watching Claude think out loud".
//
// Falls back to a canned local draft if the Worker is unreachable so the
// designer-facing demo still works without a key.

import { useEffect, useRef, useState } from 'react';
import Icon from '../../Icon';
import { KICKOFF_PROMPTS, type HuntDraft, type SuggestedStop } from '../data';
import { MapCanvas } from '../MapCanvas';

interface Props {
  draft: HuntDraft;
  onDraft: (next: HuntDraft) => void;
  onSkip: () => void;
}

type LineId = 'occasion' | 'city' | 'theme' | 'shape' | 'stops' | 'reward';

interface DraftLine {
  id: LineId;
  label: string;
  value: string;
}

const LINE_ORDER: LineId[] = ['occasion', 'city', 'theme', 'shape', 'stops', 'reward'];

const LINE_LABELS: Record<LineId, string> = {
  occasion: 'Occasion',
  city: 'City',
  theme: 'Theme',
  shape: 'Pace',
  stops: 'Suggested stops',
  reward: 'Finale',
};

// Map an AI-generated stop into the wizard's SuggestedStop shape. The AI
// provides real lat/lng for each venue (approximate but city-correct);
// Step 05 renders these on a real Leaflet+OSM map.
function synthStop(
  s: { name: string; type: string; blurb: string; lat: number; lng: number },
  i: number,
): SuggestedStop {
  return {
    id: `ai-${i}-${s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}`,
    lat: s.lat,
    lng: s.lng,
    name: s.name,
    type: s.type,
    time: '20m',
    chosen: true,
    order: i + 1,
    blurb: s.blurb,
    tag: 'AI suggested',
  };
}

const LOCAL_FALLBACK: Record<LineId, string> = {
  occasion: 'Birthday · Mihaela · 14 Jun 2026',
  city: 'Cluj-Napoca · Centru istoric (1.8 km loop)',
  theme: 'A book of firsts — romantic, 5 stops',
  shape: 'Sweet difficulty · ~1h 30m · 5,400 steps',
  stops: 'Klausenburg → Cărturești → Parcul Central → Insomnia → Cetățuia',
  reward: 'Locker on Cetățuia · code 07-23-14 · warm hand-written note',
};

export default function KickoffStep({ draft, onDraft, onSkip }: Props) {
  const [prompt, setPrompt] = useState('');
  const [phase, setPhase] = useState<'idle' | 'thinking' | 'done' | 'error'>('idle');
  // Lines arrive over SSE keyed by id. Display order is fixed by LINE_ORDER.
  const [lineMap, setLineMap] = useState<Record<LineId, string | null>>({
    occasion: null, city: null, theme: null, shape: null, stops: null, reward: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [draftPatch, setDraftPatch] = useState<Partial<HuntDraft> | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    taRef.current?.focus();
    return () => abortRef.current?.abort();
  }, []);

  const fillFromFallback = () => {
    LINE_ORDER.forEach((id, i) => {
      setTimeout(
        () => setLineMap((prev) => ({ ...prev, [id]: LOCAL_FALLBACK[id] })),
        300 + i * 320,
      );
    });
    setTimeout(() => setPhase('done'), 300 + LINE_ORDER.length * 320 + 80);
  };

  const generate = async () => {
    if (!prompt.trim() || phase === 'thinking') return;
    setPhase('thinking');
    setError(null);
    setDraftPatch(null);
    setLineMap({
      occasion: null, city: null, theme: null, shape: null, stops: null, reward: null,
    });

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    try {
      const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
      const res = await fetch(`${apiBase}/api/admin/wizard/draft`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ prompt: prompt.trim() }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(`draft failed: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE: each event is separated by a blank line (\n\n).
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const block of parts) {
          if (!block.trim()) continue;
          const eventLine = block.split('\n').find((l) => l.startsWith('event:'));
          const dataLine = block.split('\n').find((l) => l.startsWith('data:'));
          if (!eventLine || !dataLine) continue;
          const eventName = eventLine.slice('event:'.length).trim();
          let data: unknown;
          try {
            data = JSON.parse(dataLine.slice('data:'.length).trim());
          } catch {
            continue;
          }

          if (eventName === 'line') {
            const ln = data as DraftLine;
            setLineMap((prev) => ({ ...prev, [ln.id]: ln.value }));
          } else if (eventName === 'done') {
            const d = data as { patch: Partial<HuntDraft> };
            setDraftPatch(d.patch);
            setPhase('done');
          } else if (eventName === 'error') {
            const e = data as { message: string };
            setError(e.message + ' (using local sample)');
            fillFromFallback();
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError((e as Error).message + ' (using local sample)');
      fillFromFallback();
    }
  };

  const tryAnother = () => {
    abortRef.current?.abort();
    setPhase('idle');
    setError(null);
    setDraftPatch(null);
    setLineMap({
      occasion: null, city: null, theme: null, shape: null, stops: null, reward: null,
    });
  };

  const applyDraft = () => {
    if (!draftPatch) {
      onDraft(draft);
      return;
    }
    // If the AI returned a `stops` array, materialise it into the wizard's
    // SuggestedStop[] shape. Coords are synthesised by spreading across the
    // viewBox — real geocoding is out of scope for v1; the abstract map is
    // a visual aid, not a survey. The user can drag pins on Step 05 once
    // we ship that interaction.
    const aiStops = (
      draftPatch as Partial<HuntDraft> & {
        stops?: { name: string; type: string; blurb: string; lat: number; lng: number }[];
      }
    ).stops;
    // Spread the categorical patch (title/recipient/etc.) but explicitly
    // pluck out `stops` — it's not part of the HuntDraft enum-field set,
    // and we need to convert it to SuggestedStop[] before assigning.
    const { stops: _aiStopsKey, ...categoricalPatch } = draftPatch as Partial<
      HuntDraft
    > & { stops?: unknown };
    void _aiStopsKey;
    const next: HuntDraft = { ...draft, ...categoricalPatch };
    if (Array.isArray(aiStops) && aiStops.length >= 3) {
      next.stops = aiStops.map((s, i) => synthStop(s, i));
      next.suggestions = []; // AI already curated; show the chosen route only
    }
    onDraft(next);
  };

  return (
    <div
      className="ab"
      style={{
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        background: 'var(--bg)',
        height: '100%',
      }}
    >
      {/* faint cartographic background */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.35,
          pointerEvents: 'none',
        }}
      >
        <MapCanvas tone="light" showLabels={false} density={0.5} />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 50% 40%, transparent 0%, var(--bg) 70%)',
          }}
        />
      </div>

      {/* top bar */}
      <header
        style={{
          position: 'relative',
          zIndex: 1,
          padding: '20px 28px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ flex: 1 }} />
        <button className="btn btn-quiet" onClick={onSkip} style={{ fontSize: 12 }}>
          Skip — set up manually <Icon name="arrow-r" size={13} />
        </button>
      </header>

      {/* center stack */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 28px 60px',
          overflowY: 'auto',
        }}
      >
        <div style={{ width: '100%', maxWidth: 720 }}>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--muted)',
              letterSpacing: '0.16em',
              textAlign: 'center',
            }}
          >
            START A NEW HUNT
          </div>
          <h1
            className="serif"
            style={{
              fontSize: 64,
              lineHeight: 1,
              textAlign: 'center',
              margin: '14px 0 6px',
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
            }}
          >
            Tell me about the hunt
          </h1>
          <p
            style={{
              textAlign: 'center',
              fontSize: 17,
              color: 'var(--muted)',
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
              margin: 0,
            }}
          >
            One paragraph. I'll draft a route, theme, clues, and a finale for you to refine.
          </p>

          {/* prompt box */}
          <div
            style={{
              marginTop: 28,
              position: 'relative',
              background: 'var(--paper)',
              border: '1px solid var(--line)',
              borderRadius: 16,
              boxShadow: 'var(--shadow-2)',
              transition: 'box-shadow 200ms, border-color 200ms',
            }}
          >
            <textarea
              ref={taRef}
              className="textarea"
              rows={4}
              placeholder="A birthday hunt for my girlfriend in Cluj. 5 stops in Centru, warm and romantic, ending at a locker on Cetățuia with her gift."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  generate();
                }
              }}
              disabled={phase === 'thinking'}
              style={{
                border: 'none',
                background: 'transparent',
                fontFamily: 'var(--serif)',
                fontSize: 21,
                lineHeight: 1.45,
                padding: '20px 22px 14px',
                color: 'var(--ink)',
                boxShadow: 'none',
              }}
            />
            <div
              style={{
                padding: '10px 14px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                borderTop: '1px solid var(--line)',
              }}
            >
              <span
                className="mono"
                style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em' }}
              >
                <Icon
                  name="spark"
                  size={11}
                  color="var(--terra)"
                  style={{ display: 'inline-block', verticalAlign: -2, marginRight: 4 }}
                />
                CLAUDE DRAFTS 8 STEPS · YOU EDIT EVERY ONE
              </span>
              <span style={{ flex: 1 }} />
              <span className="kbd">⏎ to generate</span>
              <button
                className="btn btn-terra"
                onClick={generate}
                disabled={!prompt.trim() || phase === 'thinking'}
                style={{ opacity: !prompt.trim() ? 0.5 : 1 }}
              >
                {phase === 'thinking' ? (
                  <>
                    Drafting…{' '}
                    <span
                      className="dot"
                      style={{ background: 'white', opacity: 0.6 }}
                    />
                  </>
                ) : (
                  <>
                    Draft my hunt <Icon name="arrow-r" size={14} />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* example prompts */}
          {phase === 'idle' && (
            <div style={{ marginTop: 22 }}>
              <div
                className="label"
                style={{ marginBottom: 10, textAlign: 'center' }}
              >
                Or try a starter
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                }}
              >
                {KICKOFF_PROMPTS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setPrompt(p);
                      taRef.current?.focus();
                    }}
                    className="card"
                    style={{
                      padding: '12px 14px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      background: 'var(--paper)',
                      border: '1px solid var(--line)',
                      fontFamily: 'var(--serif)',
                      fontSize: 14.5,
                      lineHeight: 1.5,
                      color: 'var(--ink-2)',
                      fontStyle: 'italic',
                    }}
                  >
                    <Icon
                      name={(['cake', 'crown', 'briefcase', 'heart'] as const)[i]}
                      size={14}
                      color="var(--terra)"
                      style={{
                        display: 'inline-block',
                        verticalAlign: -2,
                        marginRight: 8,
                      }}
                    />
                    {p.length > 90 ? p.slice(0, 90) + '…' : p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* draft preview that streams in */}
          {phase !== 'idle' && (
            <div
              style={{
                marginTop: 28,
                background: 'var(--paper)',
                border: '1px solid var(--line)',
                borderRadius: 16,
                padding: '20px 24px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'var(--ink)',
                    color: 'var(--bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="spark" size={14} />
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.12em',
                    color: 'var(--muted)',
                  }}
                >
                  CLAUDE · DRAFT
                </div>
                <span style={{ flex: 1 }} />
                {phase === 'done' && (
                  <span className="chip chip-moss">
                    <Icon name="check" size={11} stroke={2.4} /> Ready to refine
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {LINE_ORDER.map((id) => {
                  const value = lineMap[id];
                  const shown = value !== null;
                  return (
                    <div
                      key={id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '120px 1fr',
                        gap: 16,
                        alignItems: 'baseline',
                        opacity: shown ? 1 : 0.25,
                        transform: shown ? 'translateY(0)' : 'translateY(4px)',
                        transition: 'opacity 320ms, transform 320ms',
                      }}
                    >
                      <div className="label">{LINE_LABELS[id]}</div>
                      <div
                        className="serif"
                        style={{
                          fontSize: 18,
                          lineHeight: 1.35,
                          color: 'var(--ink)',
                          position: 'relative',
                        }}
                      >
                        {shown ? (
                          value
                        ) : (
                          <span
                            style={{
                              display: 'inline-block',
                              width: '70%',
                              height: 16,
                              background: 'var(--bg-2)',
                              borderRadius: 4,
                            }}
                            className="shimmer"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {error && (
                <div
                  style={{
                    marginTop: 14,
                    fontSize: 12,
                    color: 'var(--terra)',
                    fontFamily: 'var(--mono)',
                  }}
                >
                  {error}
                </div>
              )}
              {phase === 'done' && (
                <div
                  style={{
                    marginTop: 20,
                    paddingTop: 18,
                    borderTop: '1px solid var(--line)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <button
                    className="btn btn-quiet"
                    onClick={tryAnother}
                    style={{ fontSize: 13 }}
                  >
                    <Icon name="undo" size={13} /> Try another prompt
                  </button>
                  <span style={{ flex: 1 }} />
                  <button
                    className="btn btn-ghost"
                    onClick={onSkip}
                    style={{ fontSize: 13 }}
                  >
                    Open all 8 steps
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={applyDraft}
                    style={{ fontSize: 13 }}
                  >
                    Refine step by step <Icon name="arrow-r" size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* footer */}
      <footer
        style={{
          position: 'relative',
          zIndex: 1,
          padding: '16px 28px',
          borderTop: '1px solid var(--line)',
          background: 'var(--paper)',
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          fontSize: 12,
          color: 'var(--muted)',
        }}
      >
        <span>v1 · saved locally</span>
        <span style={{ flex: 1 }} />
        <span>
          Have a draft?{' '}
          <a
            style={{
              color: 'var(--terra)',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            Load it
          </a>
        </span>
      </footer>
    </div>
  );
}
